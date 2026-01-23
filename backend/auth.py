"""
FitLoop Authentication Module
JWT-based authentication with password hashing
"""
import os
from datetime import datetime, timedelta
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, Field

from database import get_db, User

# =============================================================================
# CONFIGURATION
# =============================================================================

# Secret key for JWT - in production, use a secure random key from environment
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fitloop-super-secret-key-change-in-production-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security scheme
security = HTTPBearer(auto_error=False)


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class UserCreate(BaseModel):
    """Request model for user registration"""
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=100)
    full_name: Optional[str] = None
    calorie_target: int = Field(default=2000, ge=1000, le=5000)
    protein_target: int = Field(default=150, ge=50, le=500)
    carbs_target: int = Field(default=250, ge=50, le=600)
    fat_target: int = Field(default=65, ge=20, le=200)


class UserLogin(BaseModel):
    """Request model for user login"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Response model for user data"""
    id: int
    email: str
    username: str
    full_name: Optional[str]
    calorie_target: int
    protein_target: int
    carbs_target: int
    fat_target: int
    fiber_target: int
    dietary_preferences: str
    allergies: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """Request model for updating user profile"""
    full_name: Optional[str] = None
    calorie_target: Optional[int] = Field(default=None, ge=1000, le=5000)
    protein_target: Optional[int] = Field(default=None, ge=50, le=500)
    carbs_target: Optional[int] = Field(default=None, ge=50, le=600)
    fat_target: Optional[int] = Field(default=None, ge=20, le=200)
    fiber_target: Optional[int] = Field(default=None, ge=10, le=100)
    dietary_preferences: Optional[str] = None
    allergies: Optional[str] = None


class Token(BaseModel):
    """Response model for authentication token"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    """Token payload data"""
    user_id: Optional[int] = None
    email: Optional[str] = None


# =============================================================================
# PASSWORD UTILITIES
# =============================================================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


# =============================================================================
# JWT UTILITIES
# =============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[TokenData]:
    """Decode and validate a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        email: str = payload.get("email")
        
        if user_id_str is None:
            return None
        
        # Convert string back to int
        user_id = int(user_id_str)
        return TokenData(user_id=user_id, email=email)
    except JWTError as e:
        print(f"[Auth] JWT Error: {e}")
        return None
    except (ValueError, TypeError):
        return None


# =============================================================================
# USER OPERATIONS
# =============================================================================

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get a user by email"""
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Get a user by username"""
    return db.query(User).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Get a user by ID"""
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, user_data: UserCreate) -> User:
    """Create a new user"""
    hashed_password = get_password_hash(user_data.password)
    
    db_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        calorie_target=user_data.calorie_target,
        protein_target=user_data.protein_target,
        carbs_target=user_data.carbs_target,
        fat_target=user_data.fat_target,
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Authenticate a user by email and password"""
    user = get_user_by_email(db, email)
    
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
        
    return user


def update_user(db: Session, user: User, user_data: UserUpdate) -> User:
    """Update user profile"""
    update_data = user_data.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        if value is not None:
            setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    return user


# =============================================================================
# AUTHENTICATION DEPENDENCY
# =============================================================================

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """
    Get the current authenticated user from JWT token.
    Returns None if no token provided (allows guest access for some endpoints).
    """
    print(f"[Auth] get_current_user called, credentials: {credentials}")
    if credentials is None:
        print("[Auth] No credentials provided")
        return None
    
    print(f"[Auth] Token received: {credentials.credentials[:50] if credentials.credentials else 'None'}...")
    token_data = decode_token(credentials.credentials)
    
    if token_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = get_user_by_id(db, token_data.user_id)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled",
        )
    
    return user


async def require_auth(
    user: Optional[User] = Depends(get_current_user)
) -> User:
    """
    Require authentication - raises 401 if not authenticated.
    Use this dependency for protected endpoints.
    """
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
