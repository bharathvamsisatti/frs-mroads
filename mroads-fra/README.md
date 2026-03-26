# Facial Recognition API

A production-ready Python project for facial recognition using FastAPI and DeepFace.

## Features

- **Enroll**: Accept an image and name to store face embeddings.
- **Verify**: Accept an image and return the matched identity.
- **Health Check**: Simple health endpoint.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the server:
   ```bash
   uvicorn main:app --reload
   ```

3. The API will be available at `http://localhost:8000`.

## Endpoints

- `POST /enroll`: Upload image and provide name.
- `POST /verify`: Upload image to verify.
- `GET /health`: Health check.

## Docker

Build and run with Docker:
```bash
docker build -t facial-api .
docker run -p 8000:8000 facial-api
```