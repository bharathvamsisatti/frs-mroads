"""
Create admin user with SHA256 hash
"""
import sqlite3
import uuid
import hashlib

def hash_password(password: str) -> str:
    """Hash a password using SHA256 with salt."""
    salt = "mroads-attendance-salt-2024"
    return hashlib.sha256((password + salt).encode()).hexdigest()

db_path = "attendance.db"

try:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # Delete existing admin users
    c.execute("DELETE FROM users WHERE email IN ('admin@gmail.com', 'admin@test.com')")
    conn.commit()
    
    # Hash password using SHA256
    password = "admin"
    password_hash = hash_password(password)
    
    # Insert new admin user
    admin_id = str(uuid.uuid4())
    c.execute("""
        INSERT INTO users (id, email, password_hash, name, role)
        VALUES (?, ?, ?, ?, ?)
    """, (admin_id, "admin@gmail.com", password_hash, "Admin User", "admin"))
    
    conn.commit()
    conn.close()
    
    print("✓ Admin user created successfully with SHA256!")
    print("  Email: admin@gmail.com")
    print("  Password: admin")
    print(f"  Hash: {password_hash}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
