import mysql.connector
from typing import Optional, List, Dict, Tuple
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

def get_db_connection(with_db=True):
    config = {
        "host": os.getenv("DB_HOST", "localhost"),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", "root"),
    }
    if with_db:
        config["database"] = "attendance_db"
    return mysql.connector.connect(**config)

def init_attendance_db():
    """Initialize attendance database with required tables."""
    conn = get_db_connection(with_db=False)
    c = conn.cursor()
    c.execute("CREATE DATABASE IF NOT EXISTS attendance_db")
    conn.commit()
    conn.close()
    
    conn = get_db_connection()
    c = conn.cursor()
    try:
        # Attendance transactions table
        c.execute('''CREATE TABLE IF NOT EXISTS attendance_transactions (
            id VARCHAR(255) PRIMARY KEY,
            user_id VARCHAR(255),
            person_id VARCHAR(255),
            status VARCHAR(50) NOT NULL,
            confidence REAL,
            camera_name VARCHAR(255),
            matching_mode VARCHAR(255),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            image_url TEXT,
            captured_image_url TEXT
        )''')
        
        # Enrolled users reference table (synced from dev server)
        c.execute('''CREATE TABLE IF NOT EXISTS enrolled_users (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            email VARCHAR(255),
            synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')
        
        # Users table for authentication
        c.execute('''CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')
        
        conn.commit()
    finally:
        conn.close()

def get_attendance_stats(days: int = 1) -> Dict:
    """Get attendance statistics for the last N days."""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # Total records
        c.execute("SELECT COUNT(*) FROM attendance_transactions")
        total_count = c.fetchone()[0]
        
        # Today's records (if days=1)
        if days == 1:
            c.execute("""
                SELECT COUNT(*) FROM attendance_transactions 
                WHERE DATE(timestamp) = CURDATE()
            """)
            today_count = c.fetchone()[0]
            
            # Today's success/failure
            c.execute("""
                SELECT COUNT(*) FROM attendance_transactions 
                WHERE DATE(timestamp) = CURDATE() AND status = 'success'
            """)
            today_success = c.fetchone()[0]
            
            c.execute("""
                SELECT COUNT(*) FROM attendance_transactions 
                WHERE DATE(timestamp) = CURDATE() AND (status = 'failure' OR status = 'warning')
            """)
            today_failure = c.fetchone()[0]
            
            return {
                'total_records': total_count,
                'today_total': today_count,
                'today_success': today_success,
                'today_failure': today_failure
            }
        
        return {'total_records': total_count}
    finally:
        conn.close()

def get_user_attendance_stats(person_id: str, days: int = 30) -> Dict:
    """Get attendance statistics for a specific user."""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        
        # Calculate date threshold (MySQL DATE_SUB syntax)
        date_query = f"DATE(timestamp) >= DATE_SUB(CURDATE(), INTERVAL {days} DAY)"
        
        # Total attempts for this user in last N days
        c.execute(f"""
            SELECT COUNT(*) FROM attendance_transactions 
            WHERE person_id = %s AND {date_query}
        """, (person_id,))
        total_attempts = c.fetchone()[0]
        
        if total_attempts == 0:
            return {
                'total_attempts': 0,
                'success_count': 0,
                'failure_count': 0,
                'attendance_percentage': 0,
                'days': days
            }
            
        # Successful attempts
        c.execute(f"""
            SELECT COUNT(*) FROM attendance_transactions 
            WHERE person_id = %s AND status = 'success' AND {date_query}
        """, (person_id,))
        success_count = c.fetchone()[0]
        
        # Failed/Warning attempts
        failure_count = total_attempts - success_count
        
        # Calculate percentage
        attendance_percentage = round((success_count / total_attempts) * 100, 1)
        
        return {
            'total_attempts': total_attempts,
            'success_count': success_count,
            'failure_count': failure_count,
            'attendance_percentage': attendance_percentage,
            'days': days
        }
    finally:
        conn.close()

def get_enrolled_users_count() -> int:
    """Get count of enrolled users."""
    try:
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM enrolled_users")
        return c.fetchone()[0]
    finally:
        conn.close()

def get_attendance_transactions(limit: int = 100, offset: int = 0, person_id: Optional[str] = None) -> Tuple[List[Dict], int]:
    """Get paginated attendance transactions, optionally filtered by person_id."""
    try:
        conn = get_db_connection()
        c = conn.cursor(dictionary=True)
        
        if person_id:
            # Get total count for user
            c.execute("SELECT COUNT(*) FROM attendance_transactions WHERE person_id = %s", (person_id,))
            total_count = c.fetchone()
            total_count = total_count['COUNT(*)'] if isinstance(total_count, dict) else total_count[0]
            
            # Get user transactions
            c.execute("""
                SELECT * FROM attendance_transactions 
                WHERE person_id = %s
                ORDER BY timestamp DESC 
                LIMIT %s OFFSET %s
            """, (person_id, limit, offset))
        else:
            # Get total count
            c.execute("SELECT COUNT(*) FROM attendance_transactions")
            total_count = c.fetchone()
            total_count = total_count['COUNT(*)'] if isinstance(total_count, dict) else total_count[0]
            
            # Get transactions
            c.execute("""
                SELECT * FROM attendance_transactions 
                ORDER BY timestamp DESC 
                LIMIT %s OFFSET %s
            """, (limit, offset))
        
        rows = c.fetchall()
        transactions = [dict(row) for row in rows]
        
        return transactions, total_count
    finally:
        conn.close()

def save_attendance_record(transaction_id: str, person_id: str, status: str, 
                          confidence: float, camera_name: str, matching_mode: str = '1:N',
                          image_url: str = None, captured_image_url: str = None) -> bool:
    """Save an attendance transaction record."""
    try:
        conn = get_db_connection()
        try:
            c = conn.cursor()
            c.execute("""
                INSERT INTO attendance_transactions 
                (id, person_id, status, confidence, camera_name, matching_mode, image_url, captured_image_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (transaction_id, person_id, status, confidence, camera_name, matching_mode, image_url, captured_image_url))
            conn.commit()
            return True
        finally:
            conn.close()
    except Exception as e:
        print(f"Error saving attendance record: {e}")
        return False

# ============= USER AUTHENTICATION FUNCTIONS =============

def create_user(user_id: str, email: str, password_hash: str, name: str, role: str = 'user') -> bool:
    """Create a new user in the database."""
    try:
        conn = get_db_connection()
        try:
            c = conn.cursor()
            c.execute("""
                INSERT INTO users (id, email, password_hash, name, role)
                VALUES (%s, %s, %s, %s, %s)
            """, (user_id, email, password_hash, name, role))
            conn.commit()
            return True
        finally:
            conn.close()
    except Exception as e:
        print(f"Error creating user: {e}")
        return False

def get_user_by_email(email: str) -> Optional[Dict]:
    """Get user by email address."""
    try:
        conn = get_db_connection()
        try:
            c = conn.cursor(dictionary=True)
            c.execute("SELECT * FROM users WHERE email = %s", (email,))
            row = c.fetchone()
            if row:
                return dict(row)
            return None
        finally:
            conn.close()
    except Exception as e:
        print(f"Error fetching user: {e}")
        return None
