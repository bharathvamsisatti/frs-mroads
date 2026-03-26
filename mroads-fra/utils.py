
import pickle
import mysql.connector
from deepface import DeepFace
import numpy as np
from typing import Optional, List, Dict, Tuple
from datetime import datetime
from scipy.spatial.distance import cosine, cdist
import cv2
import os
import tempfile

# Models to use
MODELS = ['Facenet512', 'ArcFace', 'VGG-Face', 'DeepFace']

THRESHOLDS = {
    'Facenet512': 0.30,  # 99.6% accuracy model - balanced
    'ArcFace': 0.45,     # 99.5% accuracy model - balanced
    'VGG-Face': 0.50,    # 98.9% accuracy model - balanced
    'DeepFace': 0.30,    # Standard model - more lenient
    'InsightFace': 0.40  # Modern model - balanced
}

# Model weights for scoring (higher weight = more trusted)
MODEL_WEIGHTS = {
    'Facenet512': 2.0,  # Highest accuracy - most trusted
    'ArcFace': 1.8,     # Very high accuracy
    'VGG-Face': 1.2,    # Good accuracy
    'DeepFace': 1.0,    # Baseline
    'InsightFace': 1.5
}

from dotenv import load_dotenv

load_dotenv()

def get_db_connection(with_db=True):
    config = {
        "host": os.getenv("DB_HOST", "localhost"),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", "root"),
    }
    if with_db:
        config["database"] = "faces_db"
    return mysql.connector.connect(**config)

def init_db():
    # First, create database if it doesn't exist
    conn = get_db_connection(with_db=False)
    c = conn.cursor()
    c.execute("CREATE DATABASE IF NOT EXISTS faces_db")
    conn.commit()
    conn.close()

    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS face_embeddings
                 (person_id VARCHAR(255), model_name VARCHAR(255), sample_id INT, embedding LONGBLOB, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY(person_id, model_name, sample_id))''')
    c.execute('''CREATE TABLE IF NOT EXISTS users
                 (user_id VARCHAR(255) PRIMARY KEY, person_id VARCHAR(255), email VARCHAR(255), image_url VARCHAR(255), name VARCHAR(255))''')
    conn.commit()
    conn.close()

def migrate_db_clear_old_embeddings():
    """Clear old embeddings and create new schema."""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("DROP TABLE IF EXISTS faces")
    c.execute("DROP TABLE IF EXISTS face_embeddings")
    c.execute('''CREATE TABLE face_embeddings
                 (person_id VARCHAR(255), model_name VARCHAR(255), sample_id INT, embedding LONGBLOB, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY(person_id, model_name, sample_id))''')
    conn.commit()
    conn.close()

def extract_embeddings_from_np(images_np: List[np.ndarray]) -> Dict[str, List[np.ndarray]]:
    """Extract embeddings for all models from a list of np arrays, return list per model."""
    embeddings = {model: [] for model in MODELS}
    for image_np in images_np:
        for model in MODELS:
            try:
                emb = DeepFace.represent(
                    img_path=image_np,
                    model_name=model,
                    detector_backend='mtcnn',
                    align=True,
                    enforce_detection=True
                )
                embeddings[model].append(np.array(emb[0]['embedding']))
            except Exception as e:
                print(f"Error extracting {model} from image: {e}")
                continue
    # Return list of embeddings per model
    embeddings_dict = {}
    for model, emb_list in embeddings.items():
        if emb_list:
            embeddings_dict[model] = emb_list
        else:
            embeddings_dict[model] = []
    
    # Check if any embeddings were extracted
    if all(not embs for embs in embeddings_dict.values()):
        raise ValueError("No faces detected in the provided images. Please ensure the images contain clear face photos.")
    
    return embeddings_dict

def save_embeddings(person_id: str, embeddings_dict: Dict[str, List[np.ndarray]]):
    """Save list of embeddings to DB."""
    conn = get_db_connection()
    c = conn.cursor()
    for model, embs in embeddings_dict.items():
        for sample_id, emb in enumerate(embs):
            c.execute("REPLACE INTO face_embeddings (person_id, model_name, sample_id, embedding) VALUES (%s, %s, %s, %s)",
                      (person_id, model, sample_id, emb.astype(np.float32).tobytes()))
    conn.commit()
    conn.close()

def load_embeddings() -> Dict[str, Dict[str, List[np.ndarray]]]:
    """Load all enrolled embeddings from DB."""
    enrolled: Dict[str, Dict[str, List[np.ndarray]]] = {}
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT person_id, model_name, sample_id, embedding FROM face_embeddings ORDER BY person_id, model_name, sample_id")
    rows = c.fetchall()
    for person_id, model_name, sample_id, emb_blob in rows:
        emb = np.frombuffer(emb_blob, dtype=np.float32)
        if person_id not in enrolled:
            enrolled[person_id] = {}
        if model_name not in enrolled[person_id]:
            enrolled[person_id][model_name] = []
        enrolled[person_id][model_name].append(emb)
    conn.close()
    return enrolled

def is_valid_face_crop(face_crop: np.ndarray, min_width: int = 40, min_height: int = 40) -> bool:
    """Validate that face crop is reasonable size and not corrupted/background."""
    if face_crop is None or not isinstance(face_crop, np.ndarray):
        print("  ❌ Crop validation: Not a valid numpy array")
        return False
    
    height, width = face_crop.shape[:2]
    
    # Reject if too small (ghost detection/artifacts)
    if width < min_width or height < min_height:
        print(f"  ❌ Crop validation: Size too small ({width}x{height} < {min_width}x{min_height})")
        return False
    
    # Reject if aspect ratio too extreme (not a face)
    aspect_ratio = width / height
    if aspect_ratio < 0.6 or aspect_ratio > 1.6:
        print(f"  ❌ Crop validation: Aspect ratio {aspect_ratio:.2f} out of range (0.6-1.6)")
        return False
    
    # Reject if mostly uniform color (background or corrupted)
    if face_crop.shape[2] == 3:  # RGB/BGR
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY) if len(face_crop.shape) == 3 else face_crop
    else:
        gray = face_crop if len(face_crop.shape) == 2 else cv2.cvtColor(face_crop, cv2.COLOR_RGB2GRAY)
    
    # Low variance = uniform color = likely not a face (lowered from 50 to 20 for CCTV)
    variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    if variance < 20:  # Very uniform/blurry - relaxed for compressed images
        print(f"  ❌ Crop validation: Variance {variance:.2f} too low (< 20)")
        return False
    
    print(f"  ✓ Crop validation: PASSED (size={width}x{height}, ratio={aspect_ratio:.2f}, var={variance:.2f})")
    return True

def enroll_user_np(person_id: str, images_np: List[np.ndarray]):
    """Enroll a user with 1-5 images (as np arrays) using all 4 models."""
    if len(images_np) < 1 or len(images_np) > 5:
        raise ValueError("Provide 1-5 images")
    
    # Import here to avoid circular import
    from face_extractor.utils import detect_and_crop_faces_with_fallback
    
    all_crops = []
    for image_np in images_np:
        tmp_path = None
        try:
            # Write temp file and close it BEFORE reading — fixes Windows [WinError 32]
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
                tmp_path = tmp.name
            cv2.imwrite(tmp_path, cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR))
            faces = detect_and_crop_faces_with_fallback(tmp_path)
            for face in faces:
                all_crops.append(face['crop'])
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
    
    if not all_crops:
        raise ValueError("No faces detected in the provided images. Please ensure the images contain clear face photos.")
    
    avg_embeddings = extract_embeddings_from_np(all_crops)
    save_embeddings(person_id, avg_embeddings)

def verify_user_np(query_image_np: np.ndarray) -> Tuple[str, float, Dict[str, float], List[dict], str]:
    """Verify user from np array, return (person_id or 'Unknown', score, per_model_max_sims, all_matches, reason)."""
    # Crop faces using face_extractor
    from face_extractor.utils import detect_and_crop_faces_with_fallback
    
    tmp_path = None
    try:
        # Write temp file and close it BEFORE reading — fixes Windows [WinError 32]
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tmp:
            tmp_path = tmp.name
        cv2.imwrite(tmp_path, cv2.cvtColor(query_image_np, cv2.COLOR_RGB2BGR))
        faces = detect_and_crop_faces_with_fallback(tmp_path)
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
    
    print(f"[VERIFY] Detected {len(faces)} face(s) from face_extractor")
    if not faces:
        return 'Unknown', 0.0, {}, [], 'no_face'
    
    # Validate all detected faces for quality - reject ghost faces
    print(f"[VERIFY] Validating {len(faces)} detected face(s)...")
    valid_faces = [f for f in faces if is_valid_face_crop(f['crop'])]
    print(f"[VERIFY] {len(valid_faces)} face(s) passed validation")
    
    if not valid_faces:
        return 'Unknown', 0.0, {}, [], 'no_face'
    
    # Try ALL detected faces — find the best match across all of them
    print(f"[VERIFY] Checking all {len(valid_faces)} face(s) against enrolled users...")
    
    overall_best_match: str = ""
    overall_best_score = 0.0
    overall_best_per_model = {}
    overall_best_sum_sim = 0.0
    
    all_matches = []

    for face_idx, face_info in enumerate(valid_faces):
        face_crop = face_info['crop']
        face_var = face_info.get('variance', 'N/A') if isinstance(face_info, dict) else 'N/A'
        print(f"[VERIFY] --- Face {face_idx + 1}/{len(valid_faces)} (var={face_var}) ---")

        # Extract embeddings from this face
        try:
            query_embeddings = extract_embeddings_from_np([face_crop])
        except Exception as e:
            print(f"[VERIFY] Face {face_idx + 1}: embedding failed ({type(e).__name__}: {e}), skipping")
            continue

        # Get single embedding per model
        query_embs = {model: embs[0] if embs else None for model, embs in query_embeddings.items()}

        # Load enrolled embeddings
        enrolled = load_embeddings()
        if not enrolled:
            continue

        best_match = ""
        best_score = 0.0
        best_per_model = {}
        best_sum_sim = 0.0

        for person_id, model_embs in enrolled.items():

            model_max_sims = {}
            sum_sim = 0.0

            for model in MODELS:
                if model in query_embs and query_embs[model] is not None and model in model_embs and model_embs[model]:

                    query_emb = np.array([query_embs[model]])
                    enrolled_embs = np.array(model_embs[model])

                    distances = cdist(query_emb, enrolled_embs, metric='cosine')[0]
                    similarities = 1 - distances
                    max_sim = float(np.max(similarities))

                    model_max_sims[model] = max_sim
                    sum_sim += max_sim

                    dist_threshold = THRESHOLDS[model]
                    sim_threshold = 1.0 - dist_threshold
                    passed = max_sim > sim_threshold
                    print(f"[SCORES] Face{face_idx+1} | {person_id} | {model}: sim={max_sim:.4f} sim_threshold={sim_threshold:.4f} {'✓ PASS' if passed else '✗ FAIL'}")
                else:
                    model_max_sims[model] = 0.0
                    print(f"[SCORES] Face{face_idx+1} | {person_id} | {model}: N/A (no embedding)")

            # Weighted average scoring using MODEL_WEIGHTS
            weighted_score = 0.0
            total_weight = 0.0
            weighted_threshold = 0.0
            models_passed = 0
            
            for m in MODELS:
                if m in model_max_sims and model_max_sims[m] > 0:
                    weight = MODEL_WEIGHTS.get(m, 1.0)
                    sim = model_max_sims[m]
                    sim_threshold = 1.0 - THRESHOLDS.get(m, 0.5)
                    
                    weighted_score += sim * weight
                    weighted_threshold += sim_threshold * weight
                    total_weight += weight
                    
                    if sim > sim_threshold:
                        models_passed += 1

            if total_weight > 0:
                score = weighted_score / total_weight
                AVG_THRESHOLD = weighted_threshold / total_weight
            else:
                score = 0.0
                AVG_THRESHOLD = 0.5
                
            decision = (score > AVG_THRESHOLD) and (models_passed >= 3)
            print(f"[SCORES] Face{face_idx+1} | {person_id} | AvgScore={score:.4f} → {'✓ MATCH' if decision else '✗ NO MATCH'} (dynamic_threshold={AVG_THRESHOLD:.4f}, models_passed={models_passed})")

            if decision:
                if score > best_score:
                    best_match = person_id
                    best_score = score
                    best_per_model = model_max_sims
                    best_sum_sim = sum_sim

                    print(f"[VERIFY] Face{face_idx+1} match: {person_id} (avg_score={score:.3f})")


        bbox_raw = face_info.get("bbox", []) if isinstance(face_info, dict) else []
        bbox = [int(v) for v in bbox_raw]

        # Record match for this specific face
        if best_match:
            all_matches.append({
                "face_idx": face_idx + 1,
                "identity": best_match,
                "average_score": float(best_score),
                "per_model_scores": {k: float(v) for k, v in best_per_model.items()},
                "bbox": bbox
            })
            # Update overall best
            if best_score > overall_best_score or (best_score == overall_best_score and best_sum_sim > overall_best_sum_sim):
                overall_best_match = best_match
                overall_best_score = best_score
                overall_best_per_model = best_per_model
                overall_best_sum_sim = best_sum_sim
                print(f"[VERIFY] New overall best: {best_match} from Face{face_idx+1} (score={best_score})")
        else:
            # Record failed match as Unknown
            all_matches.append({
                "face_idx": face_idx + 1,
                "identity": "Unknown",
                "average_score": 0.0,
                "per_model_scores": {},
                "bbox": bbox
            })

    if overall_best_match:
        # Sort all matches descending by score (Unknowns will naturally fall to the bottom)
        all_matches.sort(key=lambda x: x['average_score'], reverse=True)
        print(f"[VERIFY] FINAL MATCHES: {[m['identity'] for m in all_matches]} | TOP MATCH: {overall_best_match} with score {overall_best_score}")
        return overall_best_match, overall_best_score, overall_best_per_model, all_matches, 'success'
    else:
        print(f"[VERIFY] NO MATCH: No person passed consensus threshold across {len(valid_faces)} face(s)")
        # If no overall match, just return the Unknowns
        return 'Unknown', 0.0, {}, all_matches, 'no_match'
