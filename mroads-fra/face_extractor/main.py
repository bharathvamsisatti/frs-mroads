from fastapi import FastAPI, File, UploadFile, HTTPException
import uuid
import os
import cv2
from utils import detect_and_crop_faces

app = FastAPI(title="Face Extractor API")

# Use path outside project for media
MEDIA_DIR = os.path.join(os.path.dirname(os.getcwd()), "mroads_faces")

@app.post("/api/face-extractor/upload")
async def upload_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    request_id = str(uuid.uuid4())
    folder = os.path.join(MEDIA_DIR, request_id)
    os.makedirs(folder, exist_ok=True)

    original_filename = file.filename
    original_path = os.path.join(folder, original_filename)
    with open(original_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Detect and crop faces
    faces = detect_and_crop_faces(original_path)

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
                "confidence": face['confidence'],
                "bbox": face['bbox'],
                "crop_url": crop_urls[i]
            } for i, face in enumerate(faces)
        ]
    }
    return response