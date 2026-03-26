import sqlite3
import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def get_mysql_conn(with_db=True):
    config = {
        "host": os.getenv("DB_HOST", "localhost"),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", "root"),
    }
    if with_db:
        config["database"] = "faces_db"
    return mysql.connector.connect(**config)

def migrate():
    sqlite_path = "faces.db"
    if not os.path.exists(sqlite_path):
        print(f"File {sqlite_path} not found.")
        return

    # Create MySQL DB/Tables first
    from utils import init_db
    init_db()

    conn_sqlite = sqlite3.connect(sqlite_path)
    # Using Row for convenience
    conn_sqlite.row_factory = sqlite3.Row
    cursor_sqlite = conn_sqlite.cursor()

    conn_mysql = get_mysql_conn()
    cursor_mysql = conn_mysql.cursor()

    print("Migrating users table...")
    cursor_sqlite.execute("SELECT * FROM users")
    rows = cursor_sqlite.fetchall()
    for row in rows:
        cursor_mysql.execute(
            "REPLACE INTO users (user_id, person_id, email, image_url, name) VALUES (%s, %s, %s, %s, %s)",
            (row['user_id'], row['person_id'], row['email'], row['image_url'], row['name'])
        )
    print(f"Migrated {len(rows)} users.")

    print("Migrating face_embeddings table...")
    cursor_sqlite.execute("SELECT * FROM face_embeddings")
    rows = cursor_sqlite.fetchall()
    for row in rows:
        cursor_mysql.execute(
            "REPLACE INTO face_embeddings (person_id, model_name, sample_id, embedding, created_at) VALUES (%s, %s, %s, %s, %s)",
            (row['person_id'], row['model_name'], row['sample_id'], row['embedding'], row['created_at'])
        )
    print(f"Migrated {len(rows)} embeddings.")

    conn_mysql.commit()
    conn_sqlite.close()
    conn_mysql.close()
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
