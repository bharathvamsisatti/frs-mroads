"""
Create admin user using raw bcrypt library directly to avoid passlib issues
"""
import uuid
import bcrypt
from utils import get_db_connection

try:
    conn = get_db_connection()
    c = conn.cursor()
    
    # Create users table if not exists
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
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
        VALUES (%s, %s, %s, %s, %s)
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
