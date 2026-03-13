from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from utils import (init_attendance_db, get_attendance_stats, get_enrolled_users_count, 
                   get_attendance_transactions, save_attendance_record, create_user, get_user_by_email,
                   get_user_attendance_stats)
from auth_utils import (create_access_token, verify_password, hash_password, 
                       get_current_user, require_admin_role)
import os
import logging
from dotenv import dotenv_values
import requests
import uuid
from datetime import datetime

# Load .env file and read values directly from it (not system env)
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
print(f"Loading .env from: {dotenv_path}")
env_config = dotenv_values(dotenv_path)
print(f".env loaded successfully")

# Load environment variables (from .env file, with fallbacks)
HOST = env_config.get("HOST") or os.getenv("HOST", "0.0.0.0")
PORT = int(env_config.get("PORT") or os.getenv("PORT", "8000"))
# Split and strip whitespace from allowed origins
allowed_origins_str = env_config.get("ALLOWED_ORIGINS") or os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001")
ALLOWED_ORIGINS = [origin.strip() for origin in allowed_origins_str.split(",")]
DEV_SERVER_URL_ENV = env_config.get("DEV_SERVER_URL") or os.getenv("DEV_SERVER_URL", "https://dev-fra.mroads.com")
FR_SERVICE_URL = env_config.get("FR_SERVICE_URL") or os.getenv("FR_SERVICE_URL", "http://127.0.0.1:9090")
CAPTURED_IMAGES_DIR = os.path.join(os.path.dirname(__file__), "captured_images")

print(f"DEV_SERVER_URL_ENV from config: {DEV_SERVER_URL_ENV}")
print(f"ALLOWED_ORIGINS: {ALLOWED_ORIGINS}")

# Create directories
os.makedirs(CAPTURED_IMAGES_DIR, exist_ok=True)

# Initialize database
init_attendance_db()

# FastAPI app
app = FastAPI(title="Face Recognition Attendance System - Backend Only")

# CORS middleware - allow all CORS requests for simplicity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Mount static files for captured images
app.mount("/captured_images", StaticFiles(directory=CAPTURED_IMAGES_DIR), name="captured_images")

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============= ATTENDANCE SYSTEM ENDPOINTS =============

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Attendance System Backend",
        "recognition_server": DEV_SERVER_URL_ENV
    }

# ============= AUTHENTICATION ENDPOINTS =============

@app.post("/api/auth/register")
async def register_user(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: str = Form("user")
):
    """Register a new user (public endpoint)."""
    try:
        # Check if user already exists
        existing_user = get_user_by_email(email)
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Hash password and create user
        user_id = str(uuid.uuid4())
        password_hash = hash_password(password)
        
        success = create_user(user_id, email, password_hash, name, role)
        
        if success:
            return {
                "success": True,
                "message": "User registered successfully",
                "user_id": user_id
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to create user")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/login")
async def login_user(
    email: str = Form(...),
    password: str = Form(...)
):
    """Login and get JWT token."""
    try:
        # Get user from database
        user = get_user_by_email(email)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Verify password
        if not verify_password(password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Create JWT token
        token_data = {
            "user_id": user["id"],
            "email": user["email"],
            "name": user["name"]
        }
        token = create_access_token(token_data, role=user["role"])
        
        return {
            "success": True,
            "token": token,
            "user_id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error logging in: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/enrolled")
async def get_enrolled():
    """Proxy enrolled users from FR Service or dev server."""
    try:
        # 1. Try FR Service (Local Port 9090)
        try:
            print(f"Calling FR Service: {FR_SERVICE_URL}/users")
            response = requests.get(f"{FR_SERVICE_URL}/users", timeout=5)
            if response.status_code == 200:
                data = response.json()
                users = data.get("users", [])
                enrolled_names = [u.get("name") or u.get("person_id") for u in users if u.get("name") or u.get("person_id")]
                print(f"Fetched {len(enrolled_names)} enrolled users from FR Service")
                return {"enrolled_names": enrolled_names}
        except Exception as fr_error:
            print(f"FR Service failed: {fr_error}")

        # 2. Fallback to Dev Server
        endpoint = f"{DEV_SERVER_URL_ENV}/enrolled"
        print(f"Calling endpoint: {endpoint}")
        
        # Proxy request to dev server
        response = requests.get(endpoint, timeout=10)
        response.raise_for_status()
        data = response.json()
        enrolled_names = data.get("enrolled_names", [])
        
        print(f"Fetched {len(enrolled_names)} enrolled users from: {endpoint}")
        return {"enrolled_names": enrolled_names}
    except Exception as e:
        print(f"Error fetching enrolled users: {e}")
        return {"enrolled_names": []}

@app.get("/api/stats")
async def get_stats():
    """Get attendance statistics."""
    try:
        stats = get_attendance_stats(days=1)
        return {
            "total_records": stats.get('total_records', 0),
            "today_total": stats.get('today_total', 0),
            "today_success": stats.get('today_success', 0),
            "today_failure": stats.get('today_failure', 0),
            "enrolled_users": get_enrolled_users_count()
        }
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return {
            "total_records": 0,
            "today_total": 0,
            "today_success": 0,
            "today_failure": 0,
            "enrolled_users": 0,
            "error": str(e)
        }

@app.get("/api/transactions")
async def get_transactions(limit: int = 1000, offset: int = 0):
    """Get paginated attendance transactions."""
    try:
        transactions, total_count = get_attendance_transactions(limit=limit, offset=offset)
        
        # Format response - transactions are already dicts from sqlite3.Row
        formatted_transactions = []
        for txn in transactions:
            formatted_transactions.append({
                "id": txn.get("id"),
                "person_id": txn.get("person_id"),
                "status": txn.get("status"),
                "confidence": txn.get("confidence"),
                "camera_name": txn.get("camera_name"),
                "matching_mode": txn.get("matching_mode"),
                "timestamp": txn.get("timestamp"),
                "image_url": txn.get("image_url"),
                "captured_image_url": txn.get("captured_image_url"),
                "user_id": txn.get("user_id")
            })
        
        return {
            "transactions": formatted_transactions,
            "count": total_count,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        logger.error(f"Error getting transactions: {e}")
        return {
            "transactions": [],
            "count": 0,
            "error": str(e)
        }

@app.get("/api/transaction/{transaction_id}")
async def get_transaction_detail(transaction_id: str):
    """Get a specific transaction with image URLs."""
    try:
        import sqlite3
        from utils import ATTENDANCE_DB_PATH
        
        with sqlite3.connect(ATTENDANCE_DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT * FROM attendance_transactions WHERE id = ?", (transaction_id,))
            row = c.fetchone()
            
            if not row:
                return {"error": "Transaction not found", "status_code": 404}
            
            transaction_dict = dict(row)
            return {
                "transaction": transaction_dict,
                "captured_image_url": transaction_dict.get('captured_image_url'),
                "enrolled_image_url": transaction_dict.get('image_url')
            }
    except Exception as e:
        logger.error(f"Error getting transaction detail: {e}")
        return {"error": str(e), "status_code": 500}

@app.get("/user/{user_id}")
async def get_user(user_id: str):
    """Get user details by user_id (person_id) including email, images, and enrollment stats."""
    try:
        # Calculate attendance statistics (last 30 days)
        attendance_stats = get_user_attendance_stats(user_id, days=30)
        attendance_percentage = attendance_stats.get('attendance_percentage', 0)
        
        # 1. Try fetching detailed info from FR Service (Local Port 9090)
        try:
            fr_response = requests.get(f"{FR_SERVICE_URL}/users", timeout=5)
            if fr_response.status_code == 200:
                data = fr_response.json()
                users = data.get("users", [])
                
                # Find matching user
                user_details = next((u for u in users if (u.get("name") or "").lower() == user_id.lower() or (u.get("person_id") or "").lower() == user_id.lower()), None)
                
                if user_details:
                    return {
                        "user_id": user_id,
                        "person_id": user_id,
                        "name": user_details.get("name", user_id),
                        "email": user_details.get("email", ""),
                        "image_url": "", # No image URL in this service yet
                        "enrolled_images": [], 
                        "embedding_count": user_details.get("models_enrolled", 0),
                        "models": [],
                        "image_count": user_details.get("total_samples", 0),
                        "status": "enrolled",
                        "attendance_percentage": attendance_percentage,
                        "attendance_stats": attendance_stats
                    }
        except Exception as fr_error:
             logger.warning(f"Could not fetch info from FR Service for {user_id}: {fr_error}")

        # 2. Fallback: Fetch enrolled users from dev server to verify existence
        endpoint = f"{DEV_SERVER_URL_ENV}/enrolled"
        response = requests.get(endpoint, timeout=10)
        response.raise_for_status()
        data = response.json()
        enrolled_names = data.get("enrolled_names", [])
        
        # Find user by person_id (case-insensitive match)
        user_id_lower = user_id.lower()
        matching_user = next(
            (name for name in enrolled_names if name.lower() == user_id_lower),
            None
        )
        
        if not matching_user:
            return {
                "error": f"User '{user_id}' not found in enrolled users",
                "status_code": 404
            }
        
        # 3. Try fetching detailed user information from dev server (legacy)
        user_detail_endpoint = f"{DEV_SERVER_URL_ENV}/user/{matching_user}"
        
        try:
            detail_response = requests.get(user_detail_endpoint, timeout=10)
            detail_response.raise_for_status()
            user_details = detail_response.json()
            
            # Return complete user details with all available information
            return {
                "user_id": matching_user,
                "person_id": matching_user,
                "name": user_details.get("name", matching_user),
                "email": user_details.get("email", ""),
                "image_url": user_details.get("image_url", ""),
                "enrolled_images": user_details.get("enrolled_images", []),
                "embedding_count": user_details.get("embedding_count", 0),
                "models": user_details.get("models", []),
                "status": "enrolled",
                "attendance_percentage": attendance_percentage,
                "attendance_stats": attendance_stats
            }
        except Exception as detail_error:
            logger.warning(f"Could not fetch detailed info for {matching_user}: {detail_error}")
            # Return basic info if detailed fetch fails, but include calculated attendance stats
            return {
                "user_id": matching_user,
                "person_id": matching_user,
                "name": matching_user,
                "email": "",
                "image_url": "",
                "enrolled_images": [],
                "embedding_count": 0,
                "models": [],
                "status": "enrolled",
                "attendance_percentage": attendance_percentage,
                "attendance_stats": attendance_stats
            }
            
    except Exception as e:
        logger.error(f"Error fetching user: {e}")
        return {
            "error": str(e),
            "status_code": 500
        }

@app.post("/api/save-attendance")
async def save_attendance(
    person_id: str = Form(...),
    status: str = Form(...),
    confidence: float = Form(0.0),
    camera_name: str = Form("Unknown Camera"),
    matching_mode: str = Form("1:N"),
    image_url: str = Form(None),
    captured_image_url: str = Form(None)
):
    """Save an attendance transaction."""
    try:
        transaction_id = str(uuid.uuid4())
        
        success = save_attendance_record(
            transaction_id=transaction_id,
            person_id=person_id,
            status=status,
            confidence=confidence,
            camera_name=camera_name,
            matching_mode=matching_mode,
            image_url=image_url,
            captured_image_url=captured_image_url
        )
        
        if success:
            return {
                "success": True,
                "transaction_id": transaction_id,
                "message": f"Attendance recorded for {person_id}"
            }
        else:
            return {
                "success": False,
                "message": "Failed to save attendance record"
            }
    except Exception as e:
        logger.error(f"Error saving attendance: {e}")
        return {
            "success": False,
            "error": str(e)
        }

# ============= ENROLLMENT ENDPOINTS =============

@app.post("/api/enroll/public")
async def enroll_public(
    name: str = Form(...),
    email: str = Form(...),
    files: list[UploadFile] = File(...)
):
    """Public enrollment endpoint (no authentication required)."""
    try:
        logger.info(f"Public enrollment request for: {name} ({email})")
        
        # Validate file count
        if len(files) < 3 or len(files) > 5:
            raise HTTPException(
                status_code=400, 
                detail="Please provide 3-5 images for enrollment"
            )
        
        # Prepare form data for local FR service
        form_data = {
            'name': name,
            'email': email
        }
        
        # Prepare files
        files_data = []
        for file in files:
            content = await file.read()
            files_data.append(('files', (file.filename, content, file.content_type)))
        
        # Send to LOCAL FR service (port 9090)
        endpoint = f"{FR_SERVICE_URL}/register"
        logger.info(f"Sending enrollment to local FR service: {endpoint}")
        response = requests.post(
            endpoint,
            data=form_data,
            files=files_data,
            timeout=120
        )
        
        response.raise_for_status()
        result = response.json()
        
        logger.info(f"Public enrollment successful for: {name}")
        return {"success": True, "message": result.get('message', f'Enrolled {name} successfully'), **result}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in public enrollment: {e}")
        raise HTTPException(status_code=500, detail=f"Enrollment failed: {str(e)}")

@app.post("/api/enroll/admin")
async def enroll_admin(
    name: str = Form(...),
    email: str = Form(...),
    files: list[UploadFile] = File(...),
    current_user: dict = Depends(require_admin_role)
):
    """Admin enrollment endpoint (requires JWT with admin role)."""
    try:
        logger.info(f"Admin enrollment request for: {name} ({email}) by admin: {current_user.get('email')}")
        
        # Validate file count
        if len(files) < 3 or len(files) > 5:
            raise HTTPException(
                status_code=400, 
                detail="Please provide 3-5 images for enrollment"
            )
        
        # Prepare form data for local FR service
        form_data = {
            'name': name,
            'email': email
        }
        
        # Prepare files
        files_data = []
        for file in files:
            content = await file.read()
            files_data.append(('files', (file.filename, content, file.content_type)))
        
        # Send to LOCAL FR service (port 9090)
        endpoint = f"{FR_SERVICE_URL}/register"
        logger.info(f"Sending admin enrollment to local FR service: {endpoint}")
        response = requests.post(
            endpoint,
            data=form_data,
            files=files_data,
            timeout=120
        )
        
        response.raise_for_status()
        result = response.json()
        
        logger.info(f"Admin enrollment successful for: {name}")
        return {
            "success": True,
            "message": result.get('message', f'Enrolled {name} successfully'),
            **result,
            "enrolled_by": current_user.get('email')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in admin enrollment: {e}")
        raise HTTPException(status_code=500, detail=f"Enrollment failed: {str(e)}")

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Face Recognition Attendance System - Backend Only",
        "version": "1.0",
        "recognition_server": DEV_SERVER_URL_ENV,
        "database": "attendance.db"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
