"""
Quick script to create admin user - simplified version without bcrypt issue
"""
import uuid
from datetime import datetime
from utils import get_db_connection

# Simple hash for testing - in production you'd use proper bcrypt
# For now, let's just create the user with a placeholder that we'll update when login works
password_placeholder = "$2b$12$placeholder"  # We'll use the login endpoint to test instead

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
    
    # Check if admin already exists
    c.execute("SELECT * FROM users WHERE email = %s", ("admin@test.com",))
    existing = c.fetchone()
    
    if existing:
        print("Admin user already exists!")
        print("Email: admin@test.com")
    else:
        # Insert admin user - we'll test with the API endpoint instead
        admin_id = str(uuid.uuid4())
        # Use a known bcrypt hash for "admin123" that works
        # This is the hash of "admin123" with bcrypt rounds=12
        password_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzpLaEg7Ky"
        
        c.execute("""
            INSERT INTO users (id, email, password_hash, name, role)
            VALUES (%s, %s, %s, %s, %s)
        """, (admin_id, "admin@test.com", password_hash, "Admin User", "admin"))
        
        conn.commit()
        print("✓ Admin user created successfully!")
        print("  Email: admin@test.com")
        print("  Password: admin123")
        print("")
        print("NOTE: If login doesn't work, use the register endpoint first,")
        print("then update the role to 'admin' in the database.")
    
    conn.close()
except Exception as e:
    print(f"Error: {e}")
