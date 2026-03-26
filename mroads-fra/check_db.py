from utils import get_db_connection

conn = get_db_connection()
c = conn.cursor()

# Get all tables
c.execute("SHOW TABLES")
tables = [row[0] for row in c.fetchall()]

print("\n=== TABLES ===")
print("Tables:", tables)

print("\n=== TABLE SCHEMA ===")
for table in tables:
    print(f"\n{table}:")
    c.execute(f"DESCRIBE {table}")
    columns = c.fetchall()
    for col in columns:
        print(f"  {col[0]} ({col[1]})" + (" - PRIMARY KEY" if col[3] == 'PRI' else ""))

# Show record counts
print("\n=== RECORD COUNTS ===")
for table in tables:
    c.execute(f"SELECT COUNT(*) FROM {table}")
    count = c.fetchone()[0]
    print(f"{table}: {count} records")

conn.close()
