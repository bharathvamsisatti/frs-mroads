# Attendance System Architecture

## Overview
The system is designed with a clean separation of concerns between enrollment data management and attendance tracking:

- **Dev Server (https://dev-fra.mroads.com)**: Stores all face embeddings and user enrollment data
- **Local Backend (http://localhost:8000)**: Serves as API layer for attendance queries
- **Attendance Database (attendance.db)**: Local SQLite database for attendance transactions
- **Frontend (http://localhost:3000)**: React/Vite application for UI

## Data Sources

### 1. Dev Server - Enrollment & Recognition APIs
**URL**: `https://dev-fra.mroads.com`

**Provides**:
- Face embeddings and enrollment data
- User names and emails
- Enrollment API endpoints
- Recognition/verification endpoints

**Key Endpoints**:
- `GET /enrolled` - List all enrolled users
- `POST /register` - Register new users
- `POST /enroll` - Enroll users with face images
- `POST /verify` - Verify face against enrolled data
- `POST /recognize` - Recognize face in 1:N mode

### 2. Local Backend - Attendance API Layer
**URL**: `http://localhost:8000`

**Proxy Endpoints**:
- `GET /enrolled` - Proxies to dev server `/enrolled`
- `POST /register` - Proxies to dev server `/register`
- `POST /enroll` - Proxies to dev server `/enroll`
- `POST /verify` - Proxies to dev server `/verify`
- `POST /recognize` - Proxies to dev server `/recognize`

**Local Endpoints**:
- `GET /api/transactions` - Fetches from local `attendance.db`
- `GET /user/{user_id}` - User profile from `faces.db`

### 3. Attendance Database
**Path**: `backend/attendance.db`

**Schema**:
```sql
CREATE TABLE attendance_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  person_id TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence REAL,
  camera_name TEXT,
  matching_mode TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  image_url TEXT
)
```

**Data Flow**:
1. FTP Puller downloads images from camera
2. Sends to dev server for recognition via `/recognize`
3. Stores transaction result in local `attendance.db`

## Frontend Configuration

**Environment Variables** (`frontend/.env`):
```env
VITE_DEV_SERVER_URL=https://dev-fra.mroads.com
VITE_LOCAL_BACKEND_URL=http://localhost:8000
VITE_API_BASE_URL=http://localhost:8000
```

**API Routing**:
- `register()` → `DEV_SERVER_URL/register`
- `enroll()` → `DEV_SERVER_URL/enroll`
- `verify()` → `DEV_SERVER_URL/verify`
- `recognize()` → `DEV_SERVER_URL/recognize`
- `getEnrolled()` → `DEV_SERVER_URL/enrolled`
- `getTransactions()` → `LOCAL_BACKEND_URL/api/transactions`

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Port 3000)                     │
│                    React/Vite Application                        │
└──────────┬──────────────────────┬──────────────────────┬─────────┘
           │                      │                      │
    enrollment/              enrolled users         attendance
    recognition              transactions             tracking
    (DEV_SERVER_URL)       (LOCAL_BACKEND_URL)    (LOCAL_BACKEND_URL)
           │                      │                      │
           ▼                      ▼                      ▼
┌─────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   Dev Server        │  │  Local Backend   │  │   Attendance DB  │
│ https://dev...      │  │ http://loc:8000  │  │  attendance.db   │
│                     │  │                  │  │                  │
│ - Enrollment API    │  │ - Proxy APIs     │  │ - Transactions   │
│ - Recognition API   │  │ - Transaction    │  │ - Logs           │
│ - User Data         │  │   Queries        │  │ - Matching Data  │
│ - Face Embeddings   │  │                  │  │                  │
└─────────────────────┘  └──────────────────┘  └──────────────────┘
           ▲                                           ▲
           │                                           │
           │                                    ┌──────┴────────┐
           │                                    │                │
        recognize                            FTP Puller
        response                         (writes attendance)
           │                                    │
           └────────────────────────────────────┘
```

## Component Status

### ✅ Operational
- Dev Server: Enrollment data storage and APIs
- Local Backend: FastAPI layer with transaction queries
- Attendance Database: SQLite with transaction records
- Frontend: Vite React with dual-backend support
- FTP Puller: Monitoring and saving attendance records

### 📊 Current Data
- **Enrolled Users**: 7 (from dev server)
- **Attendance Records**: 11 (in local attendance.db)
- **Recognition Success Rate**: 73% (8 successful, 3 unknown)

## Configuration Files

### `/backend/.env`
```env
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://dev-fra.mroads.com
DB_PATH=faces.db
ATTENDANCE_DB_PATH=attendance.db
MEDIA_DIR=../mroads_faces
DEV_SERVER_URL=https://dev-fra.mroads.com
```

### `/frontend/.env`
```env
VITE_DEV_SERVER_URL=https://dev-fra.mroads.com
VITE_LOCAL_BACKEND_URL=http://localhost:8000
VITE_API_BASE_URL=http://localhost:8000
```

### `/ftp-puller/.env`
```env
FTP_HOST=172.16.2.64
FTP_PORT=2121
FTP_USERNAME=...
FTP_PASSWORD=...
BACKEND_API_URL=https://dev-fra.mroads.com
```

## Data Flow Examples

### Example 1: User Enrollment Flow
```
Frontend → register() → DEV_SERVER_URL/register
         → store embeddings on dev server
         ← return success
Frontend → show "User enrolled"
```

### Example 2: Attendance Recording Flow
```
FTP Puller → download image from camera
          → POST to DEV_SERVER_URL/recognize
          → receive recognition result
          → INSERT into attendance.db
          → log attendance transaction
```

### Example 3: Dashboard Data Display
```
Frontend → getEnrolled() → DEV_SERVER_URL/enrolled
        ← return 7 enrolled users
        → render in Dashboard
        
Frontend → getTransactions() → LOCAL_BACKEND_URL/api/transactions
        ← return 11 attendance records
        → render in Attendance Table
```

## Testing Commands

### Verify Dev Server
```bash
curl https://dev-fra.mroads.com/enrolled | python3 -m json.tool
```

### Verify Local Backend
```bash
curl http://localhost:8000/enrolled | python3 -m json.tool
curl http://localhost:8000/api/transactions | python3 -m json.tool
```

### Check Attendance Database
```bash
sqlite3 backend/attendance.db \
  "SELECT id, person_id, status, timestamp FROM attendance_transactions ORDER BY timestamp DESC LIMIT 5;"
```

## Security Considerations

1. **CORS**: Frontend allowed on http://localhost:3000 and dev server
2. **Dev Server**: Accessible via HTTPS only
3. **Local Backend**: Accessible only on localhost (development)
4. **Database**: SQLite with no authentication (development)
5. **Environment Variables**: Sensitive URLs kept in .env files

## Scalability Notes

- **Attendance DB Growth**: Currently ~11 records, grows with FTP image processing
- **Enrollment Storage**: Limited by dev server capacity
- **Transaction Queries**: Optimized with timestamp DESC ordering
- **Image Storage**: URLs stored, actual images on dev server

## Future Enhancements

1. Implement pagination for transaction queries
2. Add date range filtering for attendance reports
3. Implement face recognition confidence thresholds
4. Add multi-camera support with camera identification
5. Implement real-time attendance notification system
6. Add face image caching for performance

