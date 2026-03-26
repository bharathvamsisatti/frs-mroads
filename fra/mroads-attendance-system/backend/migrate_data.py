import sqlite3
from utils import get_db_connection
import os
import sys

def migrate_database():
    old_db = "attendance.db"
    if not os.path.exists(old_db):
        print(f"Old database {old_db} not found!")
        sys.exit(1)
        
    sqlite_conn = sqlite3.connect(old_db)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_c = sqlite_conn.cursor()
    
    mysql_conn = get_db_connection()
    mysql_c = mysql_conn.cursor()
    
    print("Migrating users...")
    sqlite_c.execute("SELECT * FROM users")
    users = sqlite_c.fetchall()
    
    for row in users:
        try:
            mysql_c.execute(
                "INSERT IGNORE INTO users (id, email, password_hash, name, role, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
                (row['id'], row['email'], row['password_hash'], row['name'], row['role'], row['created_at'])
            )
        except Exception as e:
            print(f"Error migrating user {row['email']}: {e}")
            pass
            
    print(f"Migrated {len(users)} users.")

    print("Migrating enrolled_users...")
    sqlite_c.execute("SELECT * FROM enrolled_users")
    enrolled_users = sqlite_c.fetchall()
    
    for row in enrolled_users:
        try:
            mysql_c.execute(
                "INSERT IGNORE INTO enrolled_users (id, name, email, synced_at) VALUES (%s, %s, %s, %s)",
                (row['id'], row['name'], row['email'], row['synced_at'])
            )
        except Exception as e:
            print(f"Error migrating enrolled_user {row['name']}: {e}")
            pass
            
    print(f"Migrated {len(enrolled_users)} enrolled_users.")

    print("Migrating attendance_transactions...")
    sqlite_c.execute("SELECT * FROM attendance_transactions")
    attendance_transactions = sqlite_c.fetchall()
    
    for row in attendance_transactions:
        try:
            mysql_c.execute(
                "INSERT IGNORE INTO attendance_transactions (id, user_id, person_id, status, confidence, camera_name, matching_mode, timestamp, image_url, captured_image_url) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
                (row['id'], row['user_id'], row['person_id'], row['status'], row['confidence'], row['camera_name'], row['matching_mode'], row['timestamp'], row['image_url'], row['captured_image_url'])
            )
        except Exception as e:
            print(f"Error migrating attendance_transaction {row['id']}: {e}")
            pass
            
    print(f"Migrated {len(attendance_transactions)} attendance_transactions.")

    mysql_conn.commit()
    sqlite_conn.close()
    mysql_conn.close()
    
    print("Migration complete!")

if __name__ == "__main__":
    migrate_database()
