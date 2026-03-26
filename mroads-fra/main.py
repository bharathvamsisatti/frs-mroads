from fastapi import FastAPI, File, UploadFile, Form
from utils import init_db, migrate_db_clear_old_embeddings, enroll_user_np, verify_user_np, get_db_connection
import numpy as np
from PIL import Image
import io
import mysql.connector
from typing import List
import uuid
import os
import cv2
import base64
from face_extractor.utils import detect_and_crop_faces_with_fallback
import logging

from fastapi.middleware.cors import CORSMiddleware

# Suppress TensorFlow and Keras INFO logs
logging.getLogger('tensorflow').setLevel(logging.WARNING)
logging.getLogger('keras').setLevel(logging.WARNING)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Use path outside project for media
MEDIA_DIR = os.path.join(os.path.dirname(os.getcwd()), "mroads_faces")

@app.on_event("startup")
def startup_event():
    init_db()

@app.post("/migrate")
def migrate():
    """Migrate DB: clear old data and create new schema."""
    migrate_db_clear_old_embeddings()
    return {"message": "Database migrated successfully."}

@app.post("/enroll")
async def enroll(files: List[UploadFile] = File(...), name: str = Form(...)):
    if len(files) < 3 or len(files) > 5:
        return {"error": "Upload between 3 and 5 files"}
    
    images_np = []
    for file in files:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image = image.convert('RGB')  # Ensure RGB format
        image_np = np.array(image)
        images_np.append(image_np)
    
    try:
        enroll_user_np(name, images_np)
        return {"message": f"Enrolled {name} with {len(files)} images using 4 models."}
    except Exception as e:
        return {"error": str(e)}

@app.post("/register")
async def register(files: List[UploadFile] = File(...), name: str = Form(...), email: str = Form(...)):
    if len(files) < 1 or len(files) > 5:
        return {"error": "Provide 1-5 images"}
    
    # Generate user_id
    user_id = str(uuid.uuid4())
    
    # Save images
    enrolled_dir = os.path.join(MEDIA_DIR, "enrolled", name)
    os.makedirs(enrolled_dir, exist_ok=True)
    
    image_paths = []
    images_np = []
    for i, file in enumerate(files):
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image = image.convert('RGB')
        image_np = np.array(image)
        images_np.append(image_np)
        
        # Save image
        image_filename = f"{name}_{i+1}.jpg"
        image_path = os.path.join(enrolled_dir, image_filename)
        image.save(image_path)
        image_paths.append(image_path)
    
    # Use first image as reference
    image_url = image_paths[0] if image_paths else ""
    
    try:
        # STEP 1: Enroll faces FIRST (fail fast before touching the DB)
        enroll_user_np(name, images_np)
        
        # STEP 2: Only insert/update user record AFTER successful enrollment
        conn = get_db_connection()
        c = conn.cursor()
        # Remove any stale/ghost user records for this person before inserting a fresh one
        c.execute("DELETE FROM users WHERE person_id = %s", (name,))
        c.execute("INSERT INTO users (user_id, person_id, email, image_url, name) VALUES (%s, %s, %s, %s, %s)",
                  (user_id, name, email, image_url, name))
        conn.commit()
        conn.close()
        
        return {"message": f"Registered {name} with {len(files)} images."}
    except Exception as e:
        return {"error": str(e)}

@app.post("/verify")
async def verify(file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    image = image.convert('RGB')  # Ensure RGB format
    image_np = np.array(image)
    
    try:
        person_id, avg_score, per_model_scores, all_matches, reason = verify_user_np(image_np)
        if reason == 'no_face':
            return {
                "message": "No face detected in the provided image",
                "identity": "Unknown",
                "average_score": 0.0,
                "per_model_scores": {},
                "matches": []
            }
        elif reason == 'no_match':
            return {
                "message": "No matching user found in the database",
                "identity": "Unknown",
                "average_score": 0.0,
                "per_model_scores": {},
                "matches": all_matches
            }
        else:  # success
            return {
                "identity": person_id,
                "average_score": avg_score,
                "per_model_scores": per_model_scores,
                "matches": all_matches
            }
    except Exception as e:
        return {"error": str(e)}

@app.get("/enrolled")
def get_enrolled():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT DISTINCT person_id FROM face_embeddings")
    rows = c.fetchall()
    conn.close()
    names = [row[0] for row in rows]
    return {"enrolled_names": names}

@app.post("/recognize")
async def recognize(data: dict):
    """
    Recognize user from base64 image.
    Input: {"content": "base64string"}
    Output: {"message": "User found", "user_id": "...", "person": {...}}
    """
    base64_image = data.get("content")
    if not base64_image:
        return {"error": "No content provided"}
    
    try:
        # Decode base64
        image_data = base64.b64decode(base64_image)
        image = Image.open(io.BytesIO(image_data))
        image = image.convert('RGB')
        image_np = np.array(image)
        
        # Verify
        person_id, avg_score, per_model_scores, all_matches, reason = verify_user_np(image_np)
        
        # Enrich all matches with database info
        conn = get_db_connection()
        c = conn.cursor()
        enriched_matches = []
        for match in all_matches:
            match_id = match.get("identity", "Unknown")
            if match_id == "Unknown":
                enriched_matches.append({
                    "face_idx": match.get("face_idx"),
                    "identity": "Unknown",
                    "user_id": None,
                    "image_url": None,
                    "average_score": match.get("average_score", 0.0),
                    "per_model_scores": match.get("per_model_scores", {}),
                    "bbox": match.get("bbox", [])
                })
            else:
                c.execute("SELECT user_id, email, image_url, name FROM users WHERE person_id = %s", (match_id,))
                row = c.fetchone()
                if row:
                    user_id, email, image_url, name = row
                    enriched_matches.append({
                        "face_idx": match.get("face_idx"),
                        "identity": name,
                        "person_id": match_id,
                        "user_id": user_id,
                        "image_url": image_url,
                        "average_score": match.get("average_score", 0.0),
                        "per_model_scores": match.get("per_model_scores", {}),
                        "bbox": match.get("bbox", [])
                    })
                else:
                    enriched_matches.append({
                        "face_idx": match.get("face_idx"),
                        "identity": match_id,
                        "user_id": None,
                        "image_url": None,
                        "average_score": match.get("average_score", 0.0),
                        "per_model_scores": match.get("per_model_scores", {}),
                        "bbox": match.get("bbox", [])
                    })
        conn.close()

        # Check if user found
        if reason == 'no_face':
            return {
                "message": "No face detected in the provided image",
                "code": 201,
                "matches": []
            }
        elif reason == 'no_match':
            return {
                "message": f"Detected {len(enriched_matches)} unrecognized face(s)",
                "code": 201,
                "matches": enriched_matches
            }
        
        # Determine top match for backward compatibility
        top_match = enriched_matches[0]
        person = {
            "id": top_match["user_id"],
            "image_url": top_match["image_url"],
            "name": top_match["identity"]
        }
        
        return {
            "message": f"Found {len(enriched_matches)} user(s)",
            "user_id": top_match["user_id"],
            "person": person,
            "matches": enriched_matches
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/api/face-extractor/upload")
async def upload_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        return {"error": "File must be an image"}

    request_id = str(uuid.uuid4())
    folder = os.path.join(MEDIA_DIR, request_id)
    os.makedirs(folder, exist_ok=True)

    original_filename = file.filename
    original_path = os.path.join(folder, original_filename)
    with open(original_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Detect and crop faces
    faces = detect_and_crop_faces_with_fallback(original_path)

    # Save crops
    crop_urls = []
    basename = os.path.splitext(original_filename)[0]
    for i, face in enumerate(faces):
        crop_filename = f"{basename}_face_{i+1}.jpg"
        crop_path = os.path.join(folder, crop_filename)
        cv2.imwrite(crop_path, cv2.cvtColor(face['crop'], cv2.COLOR_RGB2BGR))
        crop_urls.append(f"/media/faces/{request_id}/{crop_filename}")

    response = {
        "request_id": request_id,
        "original_image_url": f"/media/faces/{request_id}/{original_filename}",
        "faces": [
            {
                "face_id": i+1,
                "confidence": float(face['confidence']),
                "bbox": [int(x) for x in face['bbox']],
                "crop_url": crop_urls[i]
            } for i, face in enumerate(faces)
        ]
    }
    return response

@app.delete("/remove-user/{person_id}")
def remove_user(person_id: str):
    """
    Remove a user and all their face embeddings from the database.
    
    Args:
        person_id: The name/ID of the person to remove (e.g., "Divyanand Gupta")
    
    Returns:
        JSON response with success status and number of records deleted
    """
    try:
        conn = get_db_connection()
        try:
            c = conn.cursor()
            
            # Delete all face embeddings for this person
            c.execute("DELETE FROM face_embeddings WHERE person_id = %s", (person_id,))
            embeddings_deleted = c.rowcount
            
            # Delete all user records for this person
            c.execute("DELETE FROM users WHERE person_id = %s", (person_id,))
            users_deleted = c.rowcount
            
            conn.commit()
        finally:
            conn.close()
            
            if embeddings_deleted == 0 and users_deleted == 0:
                return {
                    "success": False,
                    "message": f"No records found for person: {person_id}",
                    "embeddings_deleted": 0,
                    "users_deleted": 0
                }
            
            return {
                "success": True,
                "message": f"Successfully removed user '{person_id}' and all associated data",
                "embeddings_deleted": embeddings_deleted,
                "users_deleted": users_deleted
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": f"Failed to remove user: {str(e)}"
        }

@app.get("/users")
def get_all_users():
    """
    Get list of all enrolled users with their information.
    
    Returns:
        JSON list of all users and their details
    """
    try:
        conn = get_db_connection()
        try:
            c = conn.cursor(dictionary=True)
            
            # Get all unique persons with their enrollment stats
            c.execute("""
                SELECT DISTINCT 
                    u.person_id,
                    u.name,
                    u.email,
                    COUNT(DISTINCT f.model_name) as models_count,
                    SUM(CASE WHEN f.model_name IS NOT NULL THEN 1 ELSE 0 END) / 4 as total_samples
                FROM users u
                LEFT JOIN face_embeddings f ON u.person_id = f.person_id
                GROUP BY u.person_id
                ORDER BY u.person_id
            """)
            
            rows = c.fetchall()
            users = []
            for row in rows:
                users.append({
                    "person_id": row["person_id"],
                    "name": row["name"],
                    "email": row["email"],
                    "models_enrolled": row["models_count"],
                    "total_samples": float(row["total_samples"]) if row["total_samples"] else 0
                })
            
            return {
                "success": True,
                "total_enrolled": len(users),
                "users": users
            }
        finally:
            conn.close()
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": f"Failed to fetch users: {str(e)}"
        }