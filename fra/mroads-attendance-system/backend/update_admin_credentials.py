"""
Update admin user to match the frontend demo credentials
Email: admin@gmail.com
Password: admin
"""
import sqlite3

db_path = "attendance.db"

try:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # Pre-generated bcrypt hash for password "admin" (not "admin123")
    # Generated with: bcrypt.hashpw(b"admin", bcrypt.gensalt(rounds=12))
    password_hash_for_admin = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYzpLaEg7Ky"
    
    # Check if admin@gmail.com exists
    c.execute("SELECT * FROM users WHERE email = ?", ("admin@gmail.com",))
    existing = c.fetchone()
    
    if existing:
        print("Admin user with admin@gmail.com already exists!")
    else:
        # Check if admin@test.com exists and update it
        c.execute("SELECT * FROM users WHERE email = ?", ("admin@test.com",))
        test_admin = c.fetchone()
        
        if test_admin:
            # Update the email from admin@test.com to admin@gmail.com
            c.execute("""
                UPDATE users 
                SET email = ?, password_hash = ?
                WHERE email = ?
            """, ("admin@gmail.com", password_hash_for_admin, "admin@test.com"))
            conn.commit()
            print("✓ Updated admin user successfully!")
            print("  Email: admin@gmail.com")
            print("  Password: admin")
        else:
            # Create new admin@gmail.com user
            import uuid
            admin_id = str(uuid.uuid4())
            c.execute("""
                INSERT INTO users (id, email, password_hash, name, role)
                VALUES (?, ?, ?, ?, ?)
            """, (admin_id, "admin@gmail.com", password_hash_for_admin, "Admin User", "admin"))
            conn.commit()
            print("✓ Created admin user successfully!")
            print("  Email: admin@gmail.com")
            print("  Password: admin")
    
    conn.close()
    print("\nYou can now login with:")
    print("  Email: admin@gmail.com")
    print("  Password: admin")
    
except Exception as e:
    print(f"Error: {e}")
