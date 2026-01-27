"""
FitLoop Database Configuration
Using Supabase (PostgreSQL) for production
Falls back to SQLite for local development without Supabase
"""
import os
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, Date, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.pool import StaticPool, QueuePool

logger = logging.getLogger(__name__)

# Database URL - Supabase PostgreSQL or SQLite fallback
# Supabase connection string format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
DATABASE_URL = os.getenv("DATABASE_URL", os.getenv("SUPABASE_DB_URL", "sqlite:///./fitloop.db"))

# Determine if using PostgreSQL (Supabase) or SQLite
is_postgres = DATABASE_URL.startswith("postgresql")

if is_postgres:
    # PostgreSQL settings for Supabase
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,  # Verify connections before use
        echo=False
    )
    logger.info("Connected to Supabase PostgreSQL database")
else:
    # SQLite settings for local development
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
    logger.info("Using local SQLite database")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# =============================================================================
# DATABASE MODELS
# =============================================================================

class User(Base):
    """User account model"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=True)
    
    # Body metrics (for calculating nutrition targets)
    age = Column(Integer, default=30)
    gender = Column(String(20), default="male")  # male, female
    height_cm = Column(Float, default=170)
    weight_kg = Column(Float, default=70)
    activity_level = Column(String(50), default="moderately_active")  # sedentary, lightly_active, moderately_active, very_active, extra_active
    fitness_goal = Column(String(50), default="maintain")  # lose_weight, lose_weight_slow, maintain, gain_muscle, gain_weight
    
    # Calculated nutrition targets
    calorie_target = Column(Integer, default=2000)
    protein_target = Column(Integer, default=150)
    carbs_target = Column(Integer, default=250)
    fat_target = Column(Integer, default=65)
    fiber_target = Column(Integer, default=30)
    
    # User preferences
    dietary_preferences = Column(String(500), default="")  # comma-separated
    allergies = Column(String(500), default="")  # comma-separated
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    meals = relationship("MealLog", back_populates="user", cascade="all, delete-orphan")
    daily_summaries = relationship("DailySummary", back_populates="user", cascade="all, delete-orphan")
    water_logs = relationship("WaterLog", back_populates="user", cascade="all, delete-orphan")
    water_goal = relationship("UserWaterGoal", back_populates="user", uselist=False, cascade="all, delete-orphan")
    workout_logs = relationship("WorkoutLog", back_populates="user", cascade="all, delete-orphan")


class MealLog(Base):
    """Logged meal with food items and nutrition"""
    __tablename__ = "meal_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    meal_id = Column(String(100), unique=True, index=True)  # The UUID from analysis
    
    meal_type = Column(String(50), nullable=False)  # breakfast, lunch, dinner, snack
    meal_date = Column(Date, nullable=False, index=True)
    meal_time = Column(DateTime, default=datetime.utcnow)
    
    # Nutrition totals
    total_calories = Column(Float, default=0)
    total_protein = Column(Float, default=0)
    total_carbs = Column(Float, default=0)
    total_fat = Column(Float, default=0)
    total_fiber = Column(Float, default=0)
    
    # Store detected items as JSON string
    food_items_json = Column(Text, nullable=True)
    
    # Image reference (optional - could store path or URL)
    image_url = Column(String(500), nullable=True)
    
    # PID analysis results
    pid_analysis_json = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="meals")


class DailySummary(Base):
    """Daily nutrition summary for quick progress queries"""
    __tablename__ = "daily_summaries"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    summary_date = Column(Date, nullable=False, index=True)
    
    # Totals for the day
    total_calories = Column(Float, default=0)
    total_protein = Column(Float, default=0)
    total_carbs = Column(Float, default=0)
    total_fat = Column(Float, default=0)
    total_fiber = Column(Float, default=0)
    
    # Meal counts
    meals_logged = Column(Integer, default=0)
    
    # Goals (snapshotted from user profile)
    calorie_target = Column(Integer, default=2000)
    protein_target = Column(Integer, default=150)
    carbs_target = Column(Integer, default=250)
    fat_target = Column(Integer, default=65)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="daily_summaries")
    
    # Unique constraint on user_id + summary_date
    __table_args__ = (
        UniqueConstraint('user_id', 'summary_date', name='unique_user_date'),
    )


class WaterLog(Base):
    """Individual water intake log entry"""
    __tablename__ = "water_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_date = Column(Date, nullable=False, index=True)
    log_time = Column(DateTime, default=datetime.utcnow)
    
    # Amount in milliliters
    amount_ml = Column(Integer, nullable=False)
    
    # Optional note (e.g., "morning coffee", "post-workout")
    note = Column(String(200), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="water_logs")


class UserWaterGoal(Base):
    """User's daily water intake goal"""
    __tablename__ = "user_water_goals"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    
    # Daily goal in milliliters (default 2000ml = 2L)
    daily_goal_ml = Column(Integer, default=2000)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="water_goal")


class WorkoutLog(Base):
    """Workout/exercise log entry"""
    __tablename__ = "workout_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_date = Column(Date, nullable=False, index=True)
    log_time = Column(DateTime, default=datetime.utcnow)
    
    # Workout details
    workout_type = Column(String(50), nullable=False)  # cardio, strength, flexibility, sports, other
    workout_name = Column(String(200), nullable=True)  # e.g., "Running", "Weight lifting", "Yoga"
    
    # Duration in minutes
    duration_minutes = Column(Integer, nullable=False)
    
    # Estimated calories burned (optional - can be calculated or manually entered)
    calories_burned = Column(Integer, nullable=True)
    
    # Intensity level (optional)
    intensity = Column(String(20), nullable=True)  # low, moderate, high
    
    # Optional notes
    notes = Column(String(500), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="workout_logs")


# =============================================================================
# DATABASE UTILITIES
# =============================================================================

def init_db():
    """Create all database tables"""
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Initialize database on module import
init_db()
