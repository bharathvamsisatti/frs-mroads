#!/usr/bin/env python3
"""
Example usage of the refactored face recognition system.
Run this after migrating the DB and enrolling users.
"""

from utils import migrate_db_clear_old_embeddings, enroll_user, verify_user, re_enroll_all_users
import numpy as np
from PIL import Image

# 1. Migrate DB (clear old data)
print("Migrating DB...")
migrate_db_clear_old_embeddings()
print("DB migrated.")

# 2. Enroll users (dummy example with image paths)
# In real usage, provide actual image paths
user_list = [
    ("John", ["/path/to/john1.jpg", "/path/to/john2.jpg", "/path/to/john3.jpg"]),
    ("Jane", ["/path/to/jane1.jpg", "/path/to/jane2.jpg", "/path/to/jane3.jpg", "/path/to/jane4.jpg"])
]

print("Enrolling users...")
re_enroll_all_users(user_list)
print("Users enrolled.")

# 3. Verify a user (dummy example)
query_image_path = "/path/to/query.jpg"  # Replace with actual path
print("Verifying user...")
person_id, avg_score, per_model_scores = verify_user(query_image_path)
print(f"Identity: {person_id}, Average Score: {avg_score}")
print("Per-model scores:", per_model_scores)

# For API usage, use the FastAPI endpoints instead.