# Quick Start Guide - Running Your Attendance System

## TL;DR - Your Architecture

```
FTP Puller (Node.js)
    ↓ (writes attendance.db directly)
Attendance Database (SQLite)
    ↓ (queries via API)
Backend API (FastAPI - 200 lines, minimal)
    ↓ (HTTP responses)
Frontend (React - port 3000)
```

**Answer:** YES, you need backend - it's lightweight and handles concurrent DB access safely.

---

## Three Ways to Run

### **Option A: Development Mode (3 Terminal Windows)**

```bash
# Window 1: Frontend (port 3000)
cd frontend
npm install
npm run dev

# Window 2: Backend (port 8000)
cd backend
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Window 3: FTP Puller (continuous)
cd ftp-puller
npm install
npm start
```

**Access:** http://localhost:3000

---

### **Option B: Production Mode (Background Processes)**

```bash
# Install pm2 process manager
npm install -g pm2

# Start all services
pm2 start backend/main.py --name "attendance-api" --interpreter python3
pm2 start ftp-puller/index.js --name "ftp-monitor"
npm --prefix frontend run dev &

# View logs
pm2 logs

# Stop all
pm2 stop all
pm2 delete all
```

---

### **Option C: Docker Compose (Recommended for Deployment)**

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DEV_SERVER_URL=http://127.0.0.1:9090
    volumes:
      - ./backend/attendance.db:/app/attendance.db
      - ./backend/captured_images:/app/captured_images
    command: uvicorn main:app --host 0.0.0.0 --port 8000

  ftp-puller:
    build:
      context: ftp-puller
      dockerfile: Dockerfile
    volumes:
      - ./backend/attendance.db:/app/attendance.db
      - ./backend/captured_images:/app/captured_images
    environment:
      - FTP_HOST=${FTP_HOST}
      - FTP_PORT=${FTP_PORT}
      - FTP_USERNAME=${FTP_USERNAME}
      - FTP_PASSWORD=${FTP_PASSWORD}
      - BACKEND_API_URL=http://backend:8000
    depends_on:
      - backend

  frontend:
    build:
      context: frontend
    ports:
      - "3000:3000"
    environment:
      - VITE_LOCAL_BACKEND_URL=http://localhost:8000
    depends_on:
      - backend
```

Run:
```bash
docker-compose up
```

---

## What Each Service Does

### **Frontend (React, port 3000)**
- Displays attendance dashboard
- Shows transaction history
- Shows statistics

**Calls:**
```
GET  http://localhost:8000/api/transactions
GET  http://localhost:8000/api/stats
GET  http://localhost:8000/enrolled
```

### **Backend (FastAPI, port 8000) - LIGHTWEIGHT**

7 Endpoints:
```
GET  /health                    → {"status": "healthy"}
GET  /enrolled                  → {"enrolled_names": [...]}
GET  /api/stats                 → {"total_records": X, "today_total": Y, ...}
GET  /api/transactions          → {"transactions": [...], "count": X}
GET  /api/transaction/{id}      → {"transaction": {...}}
POST /api/save-attendance       → {"success": true}
GET  /captured_images/*         → (static file serving)
```

**Memory Usage:** ~50MB
**CPU Usage:** Minimal (just DB queries)

### **FTP Puller (Node.js, continuous)**

```
1. Every 30 seconds:
   - Connect to FTP server
   - List new images from /Picture/Face Detection/YYYYMMDD/
   - Download image files

2. For each image:
   - Send to http://127.0.0.1:9090/recognize
   - Get user info back
   - Save attendance record to attendance.db
   - Save captured image to /backend/captured_images/

3. Track processed files (avoid reprocessing)
```

**Memory Usage:** ~100MB
**CPU Usage:** Low (sleeps between polls)

---

## Configuration Files

### **Backend - `backend/.env`**
```
HOST=0.0.0.0
PORT=8000
DEV_SERVER_URL=http://127.0.0.1:9090
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### **Frontend - `frontend/.env.local`**
```
VITE_LOCAL_BACKEND_URL=http://localhost:8000
VITE_DEV_SERVER_URL=http://127.0.0.1:9090
```

### **FTP Puller - `ftp-puller/.env`**
```
FTP_HOST=192.168.1.100
FTP_PORT=2121
FTP_USERNAME=admin
FTP_PASSWORD=password
FTP_REMOTE_DIR=/Picture/Face Detection/
BACKEND_API_URL=http://127.0.0.1:9090
MAX_FILES_TO_PROCESS=2
```

---

## Database Structure

**File:** `backend/attendance.db` (SQLite)

**Table:** `attendance_transactions`
```
┌─────────────────────────────────────────────────────────┐
│ attendance_transactions                                 │
├─────────────────────────────────────────────────────────┤
│ id (uuid)               Primary Key                     │
│ user_id (string)        User identifier                 │
│ person_id (string)      Person name                     │
│ status (string)         'success' or 'unknown'          │
│ confidence (float)      0.0 to 1.0                      │
│ camera_name (string)    'Camera 1', etc.                │
│ matching_mode (string)  '1:N' (one to many)             │
│ timestamp (datetime)    When recorded                    │
│ image_url (string)      Enrollment photo URL            │
│ captured_image_url (string) Captured photo URL          │
└─────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### **Backend won't start**
```bash
# Check if port 8000 is in use
lsof -i :8000

# Kill process
lsof -i :8000 -t | xargs kill -9

# Restart
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### **Frontend can't connect to backend**
```bash
# Check backend is running
curl http://localhost:8000/health

# Check CORS is enabled (should see "Access-Control-Allow-Origin")
curl -i http://localhost:8000/enrolled
```

### **FTP Puller not finding files**
```bash
# Check .env configuration
cat ftp-puller/.env

# Test FTP connection manually
# Use FileZilla to verify credentials and directory structure
```

### **Database locked errors**
```bash
# This happens when multiple processes access DB simultaneously
# Solution: Use backend API instead of direct file access
# Don't bypass the backend API
```

---

## Performance Tips

### **If Dashboard is Slow**

1. **Add pagination** (already done):
   ```
   GET /api/transactions?limit=100&offset=0
   ```

2. **Add caching** (optional):
   ```python
   from functools import lru_cache
   
   @lru_cache(maxsize=1)
   def get_stats():
       # Cache results for 1 minute
       return get_attendance_stats()
   ```

3. **Add database indexes** (if 10,000+ records):
   ```sql
   CREATE INDEX idx_timestamp ON attendance_transactions(timestamp DESC);
   CREATE INDEX idx_person_id ON attendance_transactions(person_id);
   ```

### **If FTP Puller Lags**

1. **Increase polling interval** (slower):
   ```
   # Reduce MAX_FILES_TO_PROCESS from 2 to 1
   ```

2. **Increase polling frequency** (faster):
   ```
   # Increase polling interval from 30s to 15s
   ```

---

## Recommended Setup for Production

```bash
# 1. Install dependencies
cd backend && pip install -r requirements.txt
cd ../ftp-puller && npm install
cd ../frontend && npm install

# 2. Install pm2 globally
npm install -g pm2

# 3. Start all services
pm2 start "cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000" --name "attendance-api"
pm2 start "cd ftp-puller && npm start" --name "ftp-monitor"
pm2 start "cd frontend && npm run build && npm run preview" --name "frontend"

# 4. Monitor
pm2 monit

# 5. Auto-restart on reboot
pm2 startup
pm2 save
```

---

## Architecture Decision Summary

| Component | Type | Language | Memory | Why Needed |
|-----------|------|----------|--------|-----------|
| **FTP Puller** | Service | Node.js | ~100MB | Monitors FTP, writes DB |
| **Backend API** | Service | Python | ~50MB | Provides REST API, handles concurrent DB access |
| **Frontend** | App | React | ~30MB | User interface |
| **Database** | File | SQLite | N/A | Stores attendance records |

**Total:** ~180MB memory (very lightweight)

**Verdict:** ✅ **YES, keep the backend API.** It's minimal (200 lines) and solves concurrency issues. Don't optimize prematurely.

---

## Next Steps

1. ✅ **Verify backend starts:**
   ```bash
   cd backend
   python3 main.py
   # Should see: "Application startup complete"
   ```

2. ✅ **Test endpoints:**
   ```bash
   curl http://localhost:8000/health
   curl http://localhost:8000/api/transactions
   ```

3. ✅ **Run all 3 services** in separate terminals

4. ✅ **Check attendance records** in frontend dashboard

Done! Your system is clean and lightweight. 🚀
