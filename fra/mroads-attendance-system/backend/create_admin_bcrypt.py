"""
Create admin user using raw bcrypt library directly to avoid passlib issues
"""
import sqlite3
import uuid
import bcrypt

db_path = "attendance.db"

try:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # Create users table if not exists
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Delete existing admin users
    c.execute("DELETE FROM users WHERE email IN ('admin@gmail.com', 'admin@test.com')")
    conn.commit()
    
    # Hash password using bcrypt directly
    password = "admin"
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')
    
    # Insert new admin user
    admin_id = str(uuid.uuid4())
    c.execute("""
        INSERT INTO users (id, email, password_hash, name, role)
        VALUES (?, ?, ?, ?, ?)
    """, (admin_id, "admin@gmail.com", password_hash, "Admin User", "admin"))
    
    conn.commit()
    conn.close()
    
    print("✓ Admin user created successfully!")
    print("  Email: admin@gmail.com")
    print("  Password: admin")
    print(f"  Password hash: {password_hash}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
