
import os
from utils import get_db_connection
from tabulate import tabulate # You might need to install this: pip install tabulate
# If tabulate is not available, we'll use simple printing

def check_database():
    print(f"📂 Connected to MySQL database attendance_db\n")
    
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # 1. List all tables
        c.execute("SHOW TABLES")
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
            c.execute(f"DESCRIBE {table_name}")
            columns = c.fetchall()
            # columns format: (Field, Type, Null, Key, Default, Extra)
            print("   Columns:")
            for col in columns:
                pk = "🔑" if col[3] == 'PRI' else ""
                print(f"     - {col[0]} ({col[1]}) {pk}")

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
