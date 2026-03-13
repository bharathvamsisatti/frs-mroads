"""
Script to create an admin user for testing JWT authentication.
Run this script to create an admin user with email: admin@test.com and password: admin123
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from utils import init_attendance_db, create_user
from auth_utils import hash_password
import uuid

def create_admin_user():
    """Create an admin user for testing."""
    # Initialize database
    init_attendance_db()
    
    # Admin user details
    admin_id = str(uuid.uuid4())
    email = "admin@test.com"
    password = "admin123"
    name = "Admin User"
    role = "admin"
    
    # Hash password
    password_hash = hash_password(password)
    
    # Create user
    success = create_user(admin_id, email, password_hash, name, role)
    
    if success:
        print(f"✅ Admin user created successfully!")
        print(f"   Email: {email}")
        print(f"   Password: {password}")
        print(f"   Role: {role}")
        print(f"\nYou can now login with these credentials.")
    else:
        print("❌ Failed to create admin user. User may already exist.")

if __name__ == "__main__":
    create_admin_user()
