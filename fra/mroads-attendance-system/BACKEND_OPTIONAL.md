# Optional: How to Remove Backend API (If Needed Later)

## When You Might Want to Remove Backend

⚠️ Only do this if ALL of the following are true:

```
✅ Frontend and FTP Puller run on SAME machine/server
✅ Only ONE person/process accesses database at a time
✅ No external clients need to query attendance data
✅ Don't need HTTP API integrations
✅ Dashboard refresh delays (few seconds) are acceptable
✅ Not planning to scale to cloud
```

If ANY of these is false → **Keep the backend API.**

---

## Path A: Use sql.js (Browser-Based SQLite)

### What is sql.js?
- SQLite running in JavaScript (WebAssembly)
- Database file loaded into browser memory
- No backend needed!
- Fast for read-heavy workloads

### Setup

**Frontend side:**

```bash
cd frontend
npm install sql.js
```

**Update** `frontend/src/services/db.ts`:

```typescript
import initSqlJs from 'sql.js';
import axios from 'axios';

class LocalDatabase {
  private db: any;
  private SQL: any;

  async init() {
    this.SQL = await initSqlJs();
    
    // Load attendance.db file from server
    const response = await axios.get(
      '/attendance.db',
      { responseType: 'arraybuffer' }
    );
    
    const data = new Uint8Array(response.data);
    this.db = new this.SQL.Database(data);
  }

  async getTransactions(limit = 100, offset = 0) {
    const stmt = this.db.prepare(
      'SELECT * FROM attendance_transactions ORDER BY timestamp DESC LIMIT ? OFFSET ?'
    );
    stmt.bind([limit, offset]);
    
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    
    return results;
  }

  async getStats() {
    const totalStmt = this.db.prepare(
      'SELECT COUNT(*) as total FROM attendance_transactions'
    );
    totalStmt.step();
    const { total } = totalStmt.getAsObject();
    totalStmt.free();

    return { total };
  }
}

export default LocalDatabase;
```

**Update** `frontend/vite.config.ts`:

```typescript
export default {
  server: {
    proxy: {
      '/attendance.db': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
};
```

**Backend change:** Just serve the database file as static

```python
# In main.py, keep only this endpoint:
@app.get("/attendance.db")
async def serve_db():
    return FileResponse("attendance.db", media_type="application/octet-stream")
```

### Pros ✅
- Instant queries (no HTTP)
- No backend REST API needed
- Works offline

### Cons ❌
- Browser memory usage (entire DB loaded)
- Only works for read-only on frontend
- Cannot handle real-time updates easily
- File locked while browser has it open

---

## Path B: Use Shared SQLite File (File System Level)

### What is this?
- FTP Puller and Frontend both access same SQLite file
- No backend, no network

### Prerequisites
```
✅ Frontend running on same server as FTP Puller
✅ Same filesystem access (localhost or network drive)
```

### Setup

**Frontend side** - Use `better-sqlite3`:

```bash
npm install better-sqlite3
```

**Create** `frontend/src/services/localDb.ts`:

```typescript
import Database from 'better-sqlite3';
import path from 'path';

class LocalDatabase {
  private db: any;

  constructor(dbPath: string = '../backend/attendance.db') {
    const fullPath = path.resolve(__dirname, dbPath);
    this.db = new Database(fullPath);
    this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for safety
  }

  getTransactions(limit = 100, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT * FROM attendance_transactions 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  }

  getStats() {
    const totalStmt = this.db.prepare(
      'SELECT COUNT(*) as total FROM attendance_transactions'
    );
    const { total } = totalStmt.get();
    return { total };
  }

  close() {
    this.db.close();
  }
}

export default LocalDatabase;
```

### Pros ✅
- Fast (direct file access)
- No network overhead
- Simple setup

### Cons ❌
- ⚠️ **DATABASE LOCKS** - if both FTP and Frontend access simultaneously
- Only works if same machine
- SQLite not designed for high concurrency
- Node.js only (not browser)

---

## Path C: Hybrid - Keep Minimal Backend, Remove All Other Code

### What is this?
- Keep FastAPI backend, but strip it down further
- Remove all non-essential endpoints

### Current Backend (200 lines):
```python
@app.get("/health")
@app.get("/enrolled")
@app.get("/api/stats")
@app.get("/api/transactions")
@app.get("/api/transaction/{id}")
@app.post("/api/save-attendance")
@app.get("/captured_images/*")
```

### Minimal Backend (100 lines):
```python
@app.get("/api/transactions")  # Just this one
@app.get("/captured_images/*")  # Just this one
```

Delete everything else. Let FTP Puller write directly to DB.

**Why?**
- FTP Puller: Still writes directly → Fast
- Frontend: Still queries via HTTP → Safe
- Minimal code → Minimal memory

---

## Migration Checklist

### **To Go From Full Backend to NO Backend:**

```
❌ Remove requirements.txt (no Python needed)
❌ Remove backend/ directory entirely
❌ Update frontend to use sql.js or better-sqlite3
❌ Update frontend .env (no VITE_LOCAL_BACKEND_URL)
❌ Reconfigure frontend build for Node.js execution
❌ Handle concurrent file access issues (⚠️ tricky!)
❌ Add backup strategy (now no API layer)
❌ Update deployment process

Time: 1-2 days
Risk: Medium
```

### **To Go to Minimal Backend:**

```
✅ Keep backend/ directory
✅ Delete 5 non-essential endpoints
✅ Keep /api/transactions and /captured_images
✅ No changes to frontend
✅ No changes to FTP puller

Time: 30 minutes
Risk: Low
```

---

## Recommendation

### **Current Setup (RECOMMENDED)** ✅

```
✅ FTP Puller → attendance.db (direct)
✅ Frontend → Backend API (HTTP)
✅ Benefits: Safe, scalable, simple
✅ Memory: ~180MB total
✅ Code: ~300 lines
```

### **If Removing Backend Later:**

**Pick Option A** (sql.js) → Browser-based SQLite
- Easiest migration
- No database locks
- No backend needed
- Works if accessed from single client only

**Don't pick Option B** (Shared File) → Too risky with concurrent access

---

## Decision Tree

```
┌─ Do you need HTTP API?
│  ├─ YES → Keep backend (current setup) ✅
│  └─ NO → Continue...
│
├─ Is frontend on same server as FTP Puller?
│  ├─ YES → Can use sql.js or shared file
│  └─ NO → Must keep backend (no other option)
│
├─ Do you need real-time updates?
│  ├─ YES → Keep backend
│  └─ NO → Can use sql.js
│
└─ Is this production code or prototype?
   ├─ Production → Keep backend (safer)
   └─ Prototype → Try sql.js
```

---

## Example: Using sql.js (If You Remove Backend)

### Frontend Component

```typescript
// frontend/src/hooks/useAttendance.ts
import { useState, useEffect } from 'react';
import initSqlJs from 'sql.js';

const useAttendance = () => {
  const [db, setDb] = useState<any>(null);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const loadDatabase = async () => {
      const SQL = await initSqlJs();
      
      // Load database file from attendance.db endpoint
      const response = await fetch('/attendance.db');
      const buffer = await response.arrayBuffer();
      const data = new Uint8Array(buffer);
      
      const database = new SQL.Database(data);
      setDb(database);
      
      // Load initial transactions
      const stmt = database.prepare(
        'SELECT * FROM attendance_transactions ORDER BY timestamp DESC LIMIT 100'
      );
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      
      setTransactions(results);
    };

    loadDatabase();
  }, []);

  const refreshTransactions = () => {
    if (!db) return;
    
    const stmt = db.prepare(
      'SELECT * FROM attendance_transactions ORDER BY timestamp DESC LIMIT 100'
    );
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    setTransactions(results);
  };

  return { transactions, refreshTransactions };
};

export default useAttendance;
```

### Using in Dashboard

```typescript
const Dashboard = () => {
  const { transactions, refreshTransactions } = useAttendance();

  useEffect(() => {
    // Refresh every 10 seconds
    const interval = setInterval(refreshTransactions, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1>Attendance Dashboard</h1>
      <TransactionTable data={transactions} />
    </div>
  );
};
```

---

## Summary

| Approach | Effort | Risk | Recommended |
|----------|--------|------|-------------|
| Keep Backend (Current) | ✅ 0 | Low | ✅ YES |
| Minimal Backend | ✅ 30min | Low | Maybe |
| sql.js | ⚠️ 2 hours | Medium | Only if needed |
| Shared File | ⚠️ 2 hours | High | No |

---

**Bottom Line:**

Your current setup with FastAPI backend is **lightweight and correct**.

Only change it if you have specific performance requirements or constraints. The overhead is minimal:

- **Code:** 200 lines
- **Memory:** 50MB
- **Startup:** 2 seconds
- **Benefits:** Safe, scalable, professional

**Keep it as is.** 🚀
