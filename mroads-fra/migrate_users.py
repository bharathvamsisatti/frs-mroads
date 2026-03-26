import uuid
import os
from utils import init_db, get_db_connection

def migrate_existing_users():
    # Ensure tables exist
    init_db()
    
    conn = get_db_connection()
    c = conn.cursor()
    
    # Get all existing person_ids from face_embeddings
    c.execute("SELECT DISTINCT person_id FROM face_embeddings")
    existing_persons = c.fetchall()
    
    print(f"Found {len(existing_persons)} existing persons")
    
    for (person_id,) in existing_persons:
        # Check if already in users table
        c.execute("SELECT user_id FROM users WHERE person_id = %s", (person_id,))
        if c.fetchone():
            print(f"Skipping {person_id}, already exists")
            continue  # Already exists
        
        # Generate dummy data
        user_id = str(uuid.uuid4())
        email = f"{person_id}@dummy.com"
        image_url = f"https://dummy.com/{person_id}.jpg"
        name = person_id
        
        # Insert
        c.execute("INSERT INTO users (user_id, person_id, email, image_url, name) VALUES (%s, %s, %s, %s, %s)",
                  (user_id, person_id, email, image_url, name))
        print(f"Added {person_id} to users table")
    
    conn.commit()
    conn.close()
    print("Migration complete")

if __name__ == "__main__":
    migrate_existing_users()