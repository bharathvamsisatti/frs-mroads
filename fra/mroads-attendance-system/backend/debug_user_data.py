
import requests
from utils import get_db_connection
import os

DEV_SERVER_URL = "https://dev-fra.mroads.com"
USER_TO_CHECK = "Anusha"
DB_PATH = "attendance_db"
LOG_FILE = "debug_log.txt"

def log(msg):
    print(msg)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

# Clear log file
with open(LOG_FILE, "w") as f:
    f.write(f"--- Debugging User: {USER_TO_CHECK} ---\n")


# 1. Check Dev Server Enrolled List
log(f"\n1. Checking /enrolled endpoint...")
try:
    resp = requests.get(f"{DEV_SERVER_URL}/enrolled")
    if resp.status_code == 200:
        data = resp.json()
        enrolled = data.get('enrolled_names', [])
        log(f"Enrolled users: {enrolled}")
        
        # Try to fetch details for the first user
        if enrolled:
            test_user = enrolled[0]
            log(f"\nTesting detailed fetch for random user: '{test_user}'")
            
            # Original
            resp2 = requests.get(f"{DEV_SERVER_URL}/user/{test_user}")
            log(f"Status for '/user/{test_user}': {resp2.status_code}")
            
            # With /api prefix
            resp3 = requests.get(f"{DEV_SERVER_URL}/api/user/{test_user}")
            log(f"Status for '/api/user/{test_user}': {resp3.status_code}")
            
            # With /api/v1 prefix
            resp4 = requests.get(f"{DEV_SERVER_URL}/api/v1/user/{test_user}")
            log(f"Status for '/api/v1/user/{test_user}': {resp4.status_code}")
                
        if USER_TO_CHECK in enrolled:
            log(f"✅ '{USER_TO_CHECK}' is in the enrolled list.")
        else:
             # Case insensitive check
            matches = [n for n in enrolled if n.lower() == USER_TO_CHECK.lower()]
            if matches:
                log(f"✅ Found case-insensitive match: {matches[0]}")
                USER_TO_CHECK = matches[0] # Use the correct casing
            else:
                log(f"❌ '{USER_TO_CHECK}' NOT found in enrolled list.")
    else:
        log(f"❌ Failed to fetch /enrolled: {resp.status_code}")
except Exception as e:
    log(f"❌ Error fetching /enrolled: {e}")

# (Rest of script for specific user check...)
# 2. Check Dev Server User Details
log(f"\n2. Checking /user/{USER_TO_CHECK} endpoint...")
# ...

# 2. Check Dev Server User Details
log(f"\n2. Checking /user/{USER_TO_CHECK} endpoint...")
try:
    resp = requests.get(f"{DEV_SERVER_URL}/user/{USER_TO_CHECK}")
    log(f"Status Code: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        log(f"Data keys: {list(data.keys())}")
        log(f"Email: {data.get('email')}")
        log(f"Images count: {len(data.get('enrolled_images', []))}")
    else:
        log(f"Response: {resp.text}")
except Exception as e:
    log(f"❌ Error fetching user details: {e}")

# 3. Check Local Database Stats
log(f"\n3. Checking Local Database...")
try:
    conn = get_db_connection()
    c = conn.cursor()
        
        # Check enrolled_users table
        try:
            c.execute("SELECT COUNT(*) FROM enrolled_users")
            enrolled_count = c.fetchone()[0]
            log(f"Enrolled users in LOCAL DB: {enrolled_count}")
            
            if enrolled_count > 0:
                c.execute("SELECT * FROM enrolled_users LIMIT 5")
                rows = c.fetchall()
                log(f"Sample local enrolled users: {rows}")
        except Exception as e:
            log(f"Error reading enrolled_users table: {e}")

        # Check specific user
        c.execute("SELECT COUNT(*) FROM attendance_transactions WHERE person_id = %s", (USER_TO_CHECK,))
        count = c.fetchone()[0]
        log(f"Total transactions for '{USER_TO_CHECK}': {count}")
        
        # Check all transactions sample
        c.execute("SELECT DISTINCT person_id FROM attendance_transactions LIMIT 5")
        users = c.fetchall()
        log(f"Sample users in DB: {[u[0] for u in users]}")
        
        conn.close()
    except Exception as e:
        log(f"❌ Database error: {e}")
