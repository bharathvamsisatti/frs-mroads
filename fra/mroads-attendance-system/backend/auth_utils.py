from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
from dotenv import dotenv_values

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
env_config = dotenv_values(dotenv_path)

# JWT Configuration
SECRET_KEY = env_config.get("JWT_SECRET_KEY") or os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-in-production-please")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

import hashlib

# Password hashing - Using SHA256 temporarily to avoid bcrypt issues
# TODO: Switch back to bcrypt once configuration issues are resolved
def hash_password(password: str) -> str:
    """Hash a password using SHA256 with salt."""
    # Simple SHA256 hashing with a fixed salt for testing
    # In production, use proper bcrypt with per-user salts
    salt = "mroads-attendance-salt-2024"
    return hashlib.sha256((password + salt).encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return hash_password(plain_password) == hashed_password


# HTTP Bearer security scheme
security = HTTPBearer()


def create_access_token(data: dict, role: str = "user", expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token with user data and role.
    
    Args:
        data: User data to include in token (e.g., user_id, email, name)
        role: User role (default: "user", can be "admin")
        expires_delta: Optional custom expiration time
    
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    to_encode["role"] = role
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> dict:
    """
    Verify JWT token and return payload.
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded token payload
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    Dependency to get current user from JWT token.
    
    Args:
        credentials: HTTP Authorization credentials
    
    Returns:
        User data from token payload
    
    Raises:
        HTTPException: If token is invalid
    """
    token = credentials.credentials
    payload = verify_token(token)
    
    user_id = payload.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return payload


def require_admin_role(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency to verify user has admin role.
    
    Args:
        current_user: Current user data from JWT
    
    Returns:
        User data if admin
    
    Raises:
        HTTPException: If user is not an admin (403 Forbidden)
    """
    role = current_user.get("role")
    if role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Access forbidden. Admin role required.",
        )
    return current_user


def get_user_role(token: str) -> Optional[str]:
    """
    Extract user role from JWT token.
    
    Args:
        token: JWT token string
    
    Returns:
        User role or None if invalid
    """
    try:
        payload = verify_token(token)
        return payload.get("role")
    except:
        return None
