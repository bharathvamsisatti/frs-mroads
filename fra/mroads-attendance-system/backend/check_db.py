
import sqlite3
import os
from tabulate import tabulate # You might need to install this: pip install tabulate
# If tabulate is not available, we'll use simple printing

DB_PATH = "attendance.db"

def check_database():
    if not os.path.exists(DB_PATH):
        print(f"❌ Database file '{DB_PATH}' not found!")
        return

    print(f"📂 Connected to database: {DB_PATH}\n")
    
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # 1. List all tables
        c.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = c.fetchall()
        
        if not tables:
            print("No tables found in the database.")
            return

        print(f"Found {len(tables)} tables:")
        print("-" * 50)

        for table in tables:
            table_name = table[0]
            print(f"\n📋 TABLE: {table_name}")
            
            # Get row count
            c.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = c.fetchone()[0]
            print(f"   Rows: {count}")
            
            # Get columns info
            c.execute(f"PRAGMA table_info({table_name})")
            columns = c.fetchall()
            # columns format: (cid, name, type, notnull, dflt_value, pk)
            print("   Columns:")
            for col in columns:
                pk = "🔑" if col[5] else ""
                print(f"     - {col[1]} ({col[2]}) {pk}")

            # Show sample data (first 3 rows)
            if count > 0:
                print("   Sample Data (Top 3):")
                c.execute(f"SELECT * FROM {table_name} LIMIT 3")
                rows = c.fetchall()
                for row in rows:
                    print(f"     {row}")
            else:
                print("   (Table is empty)")
                
            print("-" * 50)

        conn.close()

    except Exception as e:
        print(f"❌ Error inspecting database: {e}")

if __name__ == "__main__":
    check_database()
