"""
FitLoop FastAPI Application
Version: 2.0.0 (With Auth & Progress Tracking)

Main API endpoints for the food-logging nutrition app.
"""
import os
import logging
import json
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, date, timedelta
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Depends, Header, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from models import (
    AnalyzeMealRequest,
    ConfirmMealRequest,
    PidAnalysisRequest,
    FoodItem,
    MealType,
    # Water tracking models
    WaterLogCreate,
    WaterLogResponse,
    WaterDailySummary,
    WaterWeeklySummary,
    WaterGoalUpdate,
    WaterGoalResponse,
    # Workout logging models
    WorkoutLogCreate,
    WorkoutLogResponse,
    WorkoutDailySummary,
    WorkoutWeeklySummary,
)
from orchestrator import get_orchestrator, MealAnalysisOrchestrator
from config import RATE_LIMIT_MEALS_PER_HOUR, RATE_LIMIT_PID_PER_HOUR
from database import get_db, User, MealLog, DailySummary, WaterLog, UserWaterGoal, WorkoutLog, PendingMeal, init_db
from auth import (
    UserCreate, UserLogin, UserResponse, UserUpdate, Token,
    create_user, authenticate_user, update_user,
    get_user_by_email, get_user_by_username,
    create_access_token, get_current_user, require_auth
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# =============================================================================
# APP LIFECYCLE
# =============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("FitLoop API starting up...")
    # Initialize database
    init_db()
    logger.info("Database initialized")
    yield
    logger.info("FitLoop API shutting down...")
    # Cleanup resources here


app = FastAPI(
    title="FitLoop API",
    description="AI-powered food logging and nutrition analysis",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS middleware - configure allowed origins from environment
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# DEPENDENCIES
# =============================================================================
def get_orchestrator_dep() -> MealAnalysisOrchestrator:
    """Dependency to get the orchestrator."""
    return get_orchestrator()


# =============================================================================
# RESPONSE MODELS
# =============================================================================
class AnalyzeMealResponse(BaseModel):
    success: bool
    meal_id: str
    detection: Optional[dict] = None
    next_step: Optional[str] = None
    error: Optional[str] = None
    message: Optional[str] = None


class ConfirmMealResponse(BaseModel):
    success: bool
    meal_id: str
    confirmed_items: Optional[list[dict]] = None
    meal_totals: Optional[dict] = None
    was_corrected: bool = False
    next_step: Optional[str] = None
    error: Optional[str] = None
    message: Optional[str] = None


class PidAnalysisResponse(BaseModel):
    success: bool
    analysis: Optional[dict] = None
    error: Optional[str] = None
    message: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    version: str


# =============================================================================
# PENDING MEALS HELPERS (Database-backed storage)
# =============================================================================
def get_pending_meal(db: Session, meal_id: str) -> Optional[PendingMeal]:
    """Get a pending meal from database, checking expiration."""
    pending = db.query(PendingMeal).filter(PendingMeal.meal_id == meal_id).first()
    if pending and pending.expires_at < datetime.utcnow():
        # Meal expired, delete it
        db.delete(pending)
        db.commit()
        return None
    return pending


def store_pending_meal(db: Session, meal_id: str, user_id: str, meal_type: str, detection: dict):
    """Store a pending meal in the database."""
    # Set expiration to 1 hour from now
    expires_at = datetime.utcnow() + timedelta(hours=1)
    pending = PendingMeal(
        meal_id=meal_id,
        user_id=str(user_id),
        meal_type=meal_type,
        detection_json=json.dumps(detection),
        expires_at=expires_at
    )
    db.add(pending)
    db.commit()


def delete_pending_meal(db: Session, meal_id: str):
    """Delete a pending meal from the database."""
    db.query(PendingMeal).filter(PendingMeal.meal_id == meal_id).delete()
    db.commit()


def cleanup_expired_pending_meals(db: Session):
    """Remove expired pending meals."""
    db.query(PendingMeal).filter(PendingMeal.expires_at < datetime.utcnow()).delete()
    db.commit()


# =============================================================================
# API ENDPOINTS
# =============================================================================
@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Health check endpoint."""
    return HealthResponse(status="healthy", version="2.0.0")


# =============================================================================
# AUTH ENDPOINTS
# =============================================================================
@app.post("/api/v1/auth/signup", response_model=Token, tags=["Auth"])
async def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user account."""
    # Check if email exists
    if get_user_by_email(db, user_data.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username exists
    if get_user_by_username(db, user_data.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Create user
    user = create_user(db, user_data)
    
    # Create token - sub must be a string for python-jose
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    
    return Token(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


@app.post("/api/v1/auth/login", response_model=Token, tags=["Auth"])
async def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """Login with email and password."""
    user = authenticate_user(db, login_data.email, login_data.password)
    
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )
    
    # sub must be a string for python-jose
    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    
    return Token(
        access_token=access_token,
        user=UserResponse.model_validate(user)
    )


@app.get("/api/v1/auth/me", response_model=UserResponse, tags=["Auth"])
async def get_me(user: User = Depends(require_auth)):
    """Get current user profile."""
    return UserResponse.model_validate(user)


@app.put("/api/v1/auth/me", response_model=UserResponse, tags=["Auth"])
async def update_me(
    user_data: UserUpdate,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Update current user profile."""
    updated_user = update_user(db, user, user_data)
    return UserResponse.model_validate(updated_user)


# =============================================================================
# MEAL ENDPOINTS
# =============================================================================
@app.post("/api/v1/meals/analyze", response_model=AnalyzeMealResponse, tags=["Meals"])
async def analyze_meal(
    request: AnalyzeMealRequest,
    user: Optional[User] = Depends(get_current_user),
    orchestrator: MealAnalysisOrchestrator = Depends(get_orchestrator_dep),
    db: Session = Depends(get_db),
):
    """
    Analyze a food image and detect items with portions.
    
    This is Step 1 of the meal logging flow:
    1. **Analyze** (this endpoint) → Returns detected foods
    2. **Confirm** → User confirms or corrects
    3. **PID Analysis** → Get nutritional recommendations
    
    The response includes:
    - `detection`: Detected food items with confidence scores
    - `next_step`: Either "confirm" (needs user input) or "pid_analysis" (auto-accepted)
    - `meal_id`: Use this ID for subsequent confirm/PID calls
    """
    user_id = user.id if user else "guest"
    logger.info(f"Analyzing meal for user {user_id}, type: {request.meal_type}")
    
    result = await orchestrator.analyze_meal_image(request)
    
    if result["success"]:
        # Store detection for confirmation step in database
        store_pending_meal(
            db=db,
            meal_id=result["meal_id"],
            user_id=str(user_id),
            meal_type=request.meal_type,
            detection=result["detection"]
        )
    
    return AnalyzeMealResponse(**result)


@app.post("/api/v1/meals/{meal_id}/confirm", response_model=ConfirmMealResponse, tags=["Meals"])
async def confirm_meal(
    meal_id: str,
    request: ConfirmMealRequest,
    user: Optional[User] = Depends(get_current_user),
    orchestrator: MealAnalysisOrchestrator = Depends(get_orchestrator_dep),
    db: Session = Depends(get_db),
):
    """
    Confirm or correct a meal detection.
    
    This is Step 2 of the meal logging flow.
    
    Send the confirmed (or corrected) list of food items.
    Corrections are logged for future model improvement.
    """
    # Get original detection from database
    pending_meal = get_pending_meal(db, meal_id)
    if not pending_meal:
        raise HTTPException(status_code=404, detail="Meal not found or already confirmed")
    
    # Parse the stored data
    pending = {
        "detection": json.loads(pending_meal.detection_json),
        "user_id": pending_meal.user_id,
        "meal_type": pending_meal.meal_type,
    }
    user_id = user.id if user else "guest"
    
    # Verify ownership (skip for guest users)
    if str(pending["user_id"]) != str(user_id) and pending["user_id"] != "guest":
        raise HTTPException(status_code=403, detail="Not authorized to confirm this meal")
    
    logger.info(f"Confirming meal {meal_id} for user {user_id}")
    
    try:
        result = await orchestrator.confirm_meal(
            request=request,
            original_detection=pending["detection"],
            user_id=str(user_id),
            db_session=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if result["success"]:
        # Delete the pending meal from database (it's now confirmed)
        delete_pending_meal(db, meal_id)
        
        # Save to database if user is authenticated
        if user:
            today = date.today()
            meal_log = MealLog(
                user_id=user.id,
                meal_id=meal_id,
                meal_type=pending["meal_type"],
                meal_date=today,
                total_calories=result["meal_totals"].get("calories", 0),
                total_protein=result["meal_totals"].get("protein_g", 0),
                total_carbs=result["meal_totals"].get("carbs_g", 0),
                total_fat=result["meal_totals"].get("fat_g", 0),
                total_fiber=result["meal_totals"].get("fiber_g", 0),
                food_items_json=json.dumps(result.get("confirmed_items", [])),
            )
            db.add(meal_log)
            
            # Update or create daily summary
            daily_summary = db.query(DailySummary).filter(
                DailySummary.user_id == user.id,
                DailySummary.summary_date == today
            ).first()
            
            if daily_summary:
                daily_summary.total_calories += result["meal_totals"].get("calories", 0)
                daily_summary.total_protein += result["meal_totals"].get("protein_g", 0)
                daily_summary.total_carbs += result["meal_totals"].get("carbs_g", 0)
                daily_summary.total_fat += result["meal_totals"].get("fat_g", 0)
                daily_summary.total_fiber += result["meal_totals"].get("fiber_g", 0)
                daily_summary.meals_logged += 1
            else:
                daily_summary = DailySummary(
                    user_id=user.id,
                    summary_date=today,
                    total_calories=result["meal_totals"].get("calories", 0),
                    total_protein=result["meal_totals"].get("protein_g", 0),
                    total_carbs=result["meal_totals"].get("carbs_g", 0),
                    total_fat=result["meal_totals"].get("fat_g", 0),
                    total_fiber=result["meal_totals"].get("fiber_g", 0),
                    meals_logged=1,
                    calorie_target=user.calorie_target,
                    protein_target=user.protein_target,
                    carbs_target=user.carbs_target,
                    fat_target=user.fat_target,
                )
                db.add(daily_summary)
            
            db.commit()
    
    return ConfirmMealResponse(**result)


@app.post("/api/v1/meals/{meal_id}/pid", response_model=PidAnalysisResponse, tags=["Meals"])
async def run_pid_analysis(
    meal_id: str,
    request: PidAnalysisRequest,
    user: Optional[User] = Depends(get_current_user),
    orchestrator: MealAnalysisOrchestrator = Depends(get_orchestrator_dep),
    db: Session = Depends(get_db),
):
    """
    Run PID analysis after meal confirmation.
    
    This is Step 3 of the meal logging flow.
    
    Returns personalized nutritional recommendations based on:
    - Today's intake so far
    - Weekly trends
    - User's goals and health profile
    """
    # Get confirmed meal from database
    meal_log = db.query(MealLog).filter(MealLog.meal_id == meal_id).first()
    if not meal_log:
        raise HTTPException(status_code=404, detail="Meal not found or not yet confirmed")
    
    # Build the confirmed meal data from the database record
    confirmed_meal = {
        "meal_totals": {
            "calories": meal_log.total_calories,
            "protein_g": meal_log.total_protein,
            "carbs_g": meal_log.total_carbs,
            "fat_g": meal_log.total_fat,
            "fiber_g": meal_log.total_fiber,
        },
        "confirmed_items": json.loads(meal_log.food_items_json) if meal_log.food_items_json else [],
    }
    
    user_id = user.id if user else "guest"
    logger.info(f"Running PID analysis for meal {meal_id}")
    
    result = await orchestrator.run_pid_analysis(
        request=request,
        confirmed_meal=confirmed_meal,
    )
    
    # Save PID analysis to meal log if user authenticated
    if result["success"] and user:
        meal_log.pid_analysis_json = json.dumps(result.get("analysis", {}))
        db.commit()
    
    return PidAnalysisResponse(**result)


@app.post("/api/v1/meals/quick-log", tags=["Meals"])
async def quick_log_meal(
    request: AnalyzeMealRequest,
    pid_request: PidAnalysisRequest,
    user: Optional[User] = Depends(get_current_user),
    orchestrator: MealAnalysisOrchestrator = Depends(get_orchestrator_dep),
):
    """
    Quick log endpoint for auto-accepted meals.
    
    Combines analyze + auto-confirm + PID in one call.
    Only works if all items are auto-accepted (high confidence).
    """
    user_id = user.id if user else "guest"
    
    # Step 1: Analyze
    analysis_result = await orchestrator.analyze_meal_image(request)
    
    if not analysis_result["success"]:
        return {"success": False, **analysis_result}
    
    # Check if confirmation is needed
    if analysis_result.get("next_step") == "confirm":
        return {
            "success": True,
            "requires_confirmation": True,
            "meal_id": analysis_result["meal_id"],
            "detection": analysis_result["detection"],
            "message": "Some items need confirmation. Use the standard flow.",
        }
    
    # Auto-confirm (all items were auto-accepted)
    items = analysis_result["detection"]["items"]
    confirm_request = ConfirmMealRequest(
        meal_id=analysis_result["meal_id"],
        items=[FoodItem(**item) for item in items],
        user_confirmed=True,
    )
    
    confirm_result = await orchestrator.confirm_meal(
        request=confirm_request,
        original_detection=analysis_result["detection"],
        user_id=str(user_id),
    )
    
    # Step 3: PID Analysis
    pid_result = await orchestrator.run_pid_analysis(
        request=pid_request,
        confirmed_meal=confirm_result,
    )
    
    return {
        "success": True,
        "meal_id": analysis_result["meal_id"],
        "detection": analysis_result["detection"],
        "meal_totals": confirm_result["meal_totals"],
        "pid_analysis": pid_result.get("analysis"),
    }


@app.post("/api/v1/meals/manual", tags=["Meals"])
async def manual_meal_entry(
    items: list[FoodItem],
    meal_type: MealType,
    user: Optional[User] = Depends(get_current_user),
):
    """
    Manual meal entry endpoint.
    
    For cases where image analysis fails or user prefers typing.
    Skips the vision step entirely.
    """
    meal_id = f"meal_{secrets.token_hex(8)}"
    
    # Calculate totals
    totals = {
        "calories": sum(item.nutrition.calories for item in items),
        "protein_g": sum(item.nutrition.protein_g for item in items),
        "carbs_g": sum(item.nutrition.carbs_g for item in items),
        "fat_g": sum(item.nutrition.fat_g for item in items),
        "fiber_g": sum(item.nutrition.fiber_g or 0 for item in items),
    }
    
    return {
        "success": True,
        "meal_id": meal_id,
        "meal_type": meal_type,
        "items": [item.model_dump() for item in items],
        "meal_totals": totals,
        "next_step": "pid_analysis",
    }


# =============================================================================
# PROGRESS TRACKING ENDPOINTS
# =============================================================================
@app.get("/api/v1/progress/today", tags=["Progress"])
async def get_today_progress(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get today's nutrition progress."""
    today = date.today()
    
    summary = db.query(DailySummary).filter(
        DailySummary.user_id == user.id,
        DailySummary.summary_date == today
    ).first()
    
    if summary:
        return {
            "date": today.isoformat(),
            "calories": {"consumed": summary.total_calories, "target": user.calorie_target},
            "protein": {"consumed": summary.total_protein, "target": user.protein_target},
            "carbs": {"consumed": summary.total_carbs, "target": user.carbs_target},
            "fat": {"consumed": summary.total_fat, "target": user.fat_target},
            "fiber": {"consumed": summary.total_fiber, "target": user.fiber_target},
            "meals_logged": summary.meals_logged,
        }
    
    return {
        "date": today.isoformat(),
        "calories": {"consumed": 0, "target": user.calorie_target},
        "protein": {"consumed": 0, "target": user.protein_target},
        "carbs": {"consumed": 0, "target": user.carbs_target},
        "fat": {"consumed": 0, "target": user.fat_target},
        "fiber": {"consumed": 0, "target": user.fiber_target},
        "meals_logged": 0,
    }


@app.get("/api/v1/progress/weekly", tags=["Progress"])
async def get_weekly_progress(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get last 7 days of nutrition progress with trends and insights."""
    from analytics import (
        compute_week_over_week, compute_streaks, get_top_foods, generate_weekly_insights
    )
    
    today = date.today()
    week_ago = today - timedelta(days=6)
    
    summaries = db.query(DailySummary).filter(
        DailySummary.user_id == user.id,
        DailySummary.summary_date >= week_ago,
        DailySummary.summary_date <= today
    ).order_by(DailySummary.summary_date).all()
    
    # Create a dict for quick lookup
    summary_map = {s.summary_date: s for s in summaries}
    
    # Build response for all 7 days
    days = []
    totals = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0, "meals": 0}
    goal_hit_days = 0
    protein_goal_days = 0
    
    for i in range(7):
        day_date = week_ago + timedelta(days=i)
        summary = summary_map.get(day_date)
        
        if summary:
            # Check if calorie goal was hit (within ±10%)
            calorie_ratio = summary.total_calories / user.calorie_target if user.calorie_target > 0 else 0
            calorie_goal_met = 0.9 <= calorie_ratio <= 1.1
            if calorie_goal_met:
                goal_hit_days += 1
            
            # Check protein goal
            protein_ratio = summary.total_protein / user.protein_target if user.protein_target > 0 else 0
            if protein_ratio >= 0.9:
                protein_goal_days += 1
            
            day_data = {
                "date": day_date.isoformat(),
                "day_name": day_date.strftime("%a"),
                "calories": summary.total_calories,
                "protein": summary.total_protein,
                "carbs": summary.total_carbs,
                "fat": summary.total_fat,
                "fiber": summary.total_fiber,
                "meals_logged": summary.meals_logged,
                "calorie_goal_met": calorie_goal_met,
                "calorie_ratio": round(calorie_ratio * 100, 1),
            }
            totals["calories"] += summary.total_calories
            totals["protein"] += summary.total_protein
            totals["carbs"] += summary.total_carbs
            totals["fat"] += summary.total_fat
            totals["fiber"] += summary.total_fiber
            totals["meals"] += summary.meals_logged
        else:
            day_data = {
                "date": day_date.isoformat(),
                "day_name": day_date.strftime("%a"),
                "calories": 0,
                "protein": 0,
                "carbs": 0,
                "fat": 0,
                "fiber": 0,
                "meals_logged": 0,
                "calorie_goal_met": False,
                "calorie_ratio": 0,
            }
        
        days.append(day_data)
    
    # Compute averages
    days_with_data = len(summaries) or 1
    averages = {
        "calories": round(totals["calories"] / days_with_data, 1),
        "protein": round(totals["protein"] / days_with_data, 1),
        "carbs": round(totals["carbs"] / days_with_data, 1),
        "fat": round(totals["fat"] / days_with_data, 1),
        "fiber": round(totals["fiber"] / days_with_data, 1),
    }
    
    targets = {
        "calories": user.calorie_target,
        "protein": user.protein_target,
        "carbs": user.carbs_target,
        "fat": user.fat_target,
        "fiber": user.fiber_target,
    }
    
    # Compute week-over-week deltas
    wow_delta = compute_week_over_week(db, user.id, today)
    
    # Compute streaks
    streaks = compute_streaks(db, user.id, today)
    
    # Get top foods
    top_foods = get_top_foods(db, user.id, days=7, limit=5)
    
    # Generate weekly insights
    insights = generate_weekly_insights(
        averages=averages,
        targets=targets,
        goal_hit_days=goal_hit_days,
        protein_goal_days=protein_goal_days,
        streaks=streaks,
        wow_delta=wow_delta
    )
    
    return {
        "period": "weekly",
        "start_date": week_ago.isoformat(),
        "end_date": today.isoformat(),
        "days": days,
        "averages": averages,
        "totals": totals,
        "targets": targets,
        
        # Enhanced analytics
        "wow_delta": wow_delta.model_dump(),
        "streaks": streaks.model_dump(),
        "top_foods": [f.model_dump() for f in top_foods],
        "insights": [i.model_dump() for i in insights],
        
        # Consistency metrics
        "goal_hit_days": goal_hit_days,
        "protein_goal_days": protein_goal_days,
        "days_logged": len(summaries),
    }


@app.get("/api/v1/progress/monthly", tags=["Progress"])
async def get_monthly_progress(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get last 30 days of nutrition progress."""
    today = date.today()
    month_ago = today - timedelta(days=29)
    
    summaries = db.query(DailySummary).filter(
        DailySummary.user_id == user.id,
        DailySummary.summary_date >= month_ago,
        DailySummary.summary_date <= today
    ).order_by(DailySummary.summary_date).all()
    
    # Create a dict for quick lookup
    summary_map = {s.summary_date: s for s in summaries}
    
    # Build response for all 30 days
    days = []
    totals = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0, "meals": 0}
    days_with_data = 0
    
    for i in range(30):
        day_date = month_ago + timedelta(days=i)
        summary = summary_map.get(day_date)
        
        if summary:
            days_with_data += 1
            day_data = {
                "date": day_date.isoformat(),
                "calories": summary.total_calories,
                "protein": summary.total_protein,
                "carbs": summary.total_carbs,
                "fat": summary.total_fat,
                "meals_logged": summary.meals_logged,
            }
            totals["calories"] += summary.total_calories
            totals["protein"] += summary.total_protein
            totals["carbs"] += summary.total_carbs
            totals["fat"] += summary.total_fat
            totals["fiber"] += summary.total_fiber
            totals["meals"] += summary.meals_logged
        else:
            day_data = {
                "date": day_date.isoformat(),
                "calories": 0,
                "protein": 0,
                "carbs": 0,
                "fat": 0,
                "meals_logged": 0,
            }
        
        days.append(day_data)
    
    # Calculate weekly summaries for the month
    weeks = []
    for week_num in range(4):
        week_start = week_num * 7
        week_end = min(week_start + 7, 30)
        week_days = days[week_start:week_end]
        
        week_calories = sum(d["calories"] for d in week_days)
        week_protein = sum(d["protein"] for d in week_days)
        
        weeks.append({
            "week": week_num + 1,
            "total_calories": week_calories,
            "avg_calories": round(week_calories / len(week_days), 1),
            "total_protein": week_protein,
            "avg_protein": round(week_protein / len(week_days), 1),
        })
    
    avg_divisor = max(days_with_data, 1)
    
    return {
        "period": "monthly",
        "start_date": month_ago.isoformat(),
        "end_date": today.isoformat(),
        "days": days,
        "weeks": weeks,
        "averages": {
            "calories": round(totals["calories"] / avg_divisor, 1),
            "protein": round(totals["protein"] / avg_divisor, 1),
            "carbs": round(totals["carbs"] / avg_divisor, 1),
            "fat": round(totals["fat"] / avg_divisor, 1),
        },
        "totals": totals,
        "days_logged": days_with_data,
        "targets": {
            "calories": user.calorie_target,
            "protein": user.protein_target,
            "carbs": user.carbs_target,
            "fat": user.fat_target,
        }
    }


@app.get("/api/v1/meals/history", tags=["Meals"])
async def get_meal_history(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db),
    limit: int = 20,
    offset: int = 0,
):
    """Get user's meal history."""
    meals = db.query(MealLog).filter(
        MealLog.user_id == user.id
    ).order_by(MealLog.created_at.desc()).offset(offset).limit(limit).all()
    
    return {
        "meals": [
            {
                "id": meal.id,
                "meal_id": meal.meal_id,
                "meal_type": meal.meal_type,
                "meal_date": meal.meal_date.isoformat(),
                "total_calories": meal.total_calories,
                "total_protein": meal.total_protein,
                "total_carbs": meal.total_carbs,
                "total_fat": meal.total_fat,
                "food_items": json.loads(meal.food_items_json) if meal.food_items_json else [],
                "created_at": meal.created_at.isoformat(),
            }
            for meal in meals
        ],
        "total": db.query(MealLog).filter(MealLog.user_id == user.id).count(),
        "limit": limit,
        "offset": offset,
    }


# =============================================================================
# WATER TRACKING ENDPOINTS
# =============================================================================
@app.post("/api/v1/water/log", response_model=WaterLogResponse, tags=["Water"])
async def log_water_intake(
    request: WaterLogCreate,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Log water intake."""
    today = date.today()
    
    water_log = WaterLog(
        user_id=user.id,
        log_date=today,
        amount_ml=request.amount_ml,
        note=request.note,
    )
    db.add(water_log)
    db.commit()
    db.refresh(water_log)
    
    logger.info(f"Water logged for user {user.id}: {request.amount_ml}ml")
    
    return WaterLogResponse(
        id=water_log.id,
        user_id=water_log.user_id,
        log_date=water_log.log_date,
        log_time=water_log.log_time,
        amount_ml=water_log.amount_ml,
        note=water_log.note,
        created_at=water_log.created_at,
    )


@app.delete("/api/v1/water/log/{log_id}", tags=["Water"])
async def delete_water_log(
    log_id: int,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Delete a water log entry."""
    water_log = db.query(WaterLog).filter(
        WaterLog.id == log_id,
        WaterLog.user_id == user.id
    ).first()
    
    if not water_log:
        raise HTTPException(status_code=404, detail="Water log not found")
    
    db.delete(water_log)
    db.commit()
    
    return {"success": True, "message": "Water log deleted"}


@app.get("/api/v1/water/today", response_model=WaterDailySummary, tags=["Water"])
async def get_today_water(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get today's water intake summary."""
    today = date.today()
    
    # Get user's water goal
    water_goal = db.query(UserWaterGoal).filter(
        UserWaterGoal.user_id == user.id
    ).first()
    goal_ml = water_goal.daily_goal_ml if water_goal else 2000
    
    # Get today's water logs
    logs = db.query(WaterLog).filter(
        WaterLog.user_id == user.id,
        WaterLog.log_date == today
    ).order_by(WaterLog.log_time).all()
    
    total_ml = sum(log.amount_ml for log in logs)
    percent_complete = round((total_ml / goal_ml) * 100, 1) if goal_ml > 0 else 0
    
    return WaterDailySummary(
        date=today,
        total_ml=total_ml,
        goal_ml=goal_ml,
        percent_complete=min(percent_complete, 100),
        logs_count=len(logs),
        logs=[
            WaterLogResponse(
                id=log.id,
                user_id=log.user_id,
                log_date=log.log_date,
                log_time=log.log_time,
                amount_ml=log.amount_ml,
                note=log.note,
                created_at=log.created_at,
            )
            for log in logs
        ]
    )


@app.get("/api/v1/water/weekly", response_model=WaterWeeklySummary, tags=["Water"])
async def get_weekly_water(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get last 7 days of water intake."""
    today = date.today()
    week_ago = today - timedelta(days=6)
    
    # Get user's water goal
    water_goal = db.query(UserWaterGoal).filter(
        UserWaterGoal.user_id == user.id
    ).first()
    goal_ml = water_goal.daily_goal_ml if water_goal else 2000
    
    # Get all water logs for the week
    logs = db.query(WaterLog).filter(
        WaterLog.user_id == user.id,
        WaterLog.log_date >= week_ago,
        WaterLog.log_date <= today
    ).order_by(WaterLog.log_date, WaterLog.log_time).all()
    
    # Group by date
    logs_by_date = {}
    for log in logs:
        if log.log_date not in logs_by_date:
            logs_by_date[log.log_date] = []
        logs_by_date[log.log_date].append(log)
    
    # Build daily summaries
    daily_summaries = []
    total_ml = 0
    goal_met_days = 0
    
    for i in range(7):
        day_date = week_ago + timedelta(days=i)
        day_logs = logs_by_date.get(day_date, [])
        day_total = sum(log.amount_ml for log in day_logs)
        total_ml += day_total
        
        percent = round((day_total / goal_ml) * 100, 1) if goal_ml > 0 else 0
        if day_total >= goal_ml:
            goal_met_days += 1
        
        daily_summaries.append(WaterDailySummary(
            date=day_date,
            total_ml=day_total,
            goal_ml=goal_ml,
            percent_complete=min(percent, 100),
            logs_count=len(day_logs),
            logs=[
                WaterLogResponse(
                    id=log.id,
                    user_id=log.user_id,
                    log_date=log.log_date,
                    log_time=log.log_time,
                    amount_ml=log.amount_ml,
                    note=log.note,
                    created_at=log.created_at,
                )
                for log in day_logs
            ]
        ))
    
    avg_daily = round(total_ml / 7, 1)
    
    return WaterWeeklySummary(
        week_start=week_ago,
        week_end=today,
        daily_summaries=daily_summaries,
        avg_daily_ml=avg_daily,
        goal_met_days=goal_met_days,
        total_ml=total_ml,
    )


@app.get("/api/v1/water/goal", response_model=WaterGoalResponse, tags=["Water"])
async def get_water_goal(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get user's daily water goal."""
    water_goal = db.query(UserWaterGoal).filter(
        UserWaterGoal.user_id == user.id
    ).first()
    
    if not water_goal:
        # Create default goal
        water_goal = UserWaterGoal(user_id=user.id, daily_goal_ml=2000)
        db.add(water_goal)
        db.commit()
        db.refresh(water_goal)
    
    return WaterGoalResponse(
        user_id=water_goal.user_id,
        daily_goal_ml=water_goal.daily_goal_ml,
    )


@app.put("/api/v1/water/goal", response_model=WaterGoalResponse, tags=["Water"])
async def update_water_goal(
    request: WaterGoalUpdate,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Update user's daily water goal."""
    water_goal = db.query(UserWaterGoal).filter(
        UserWaterGoal.user_id == user.id
    ).first()
    
    if not water_goal:
        water_goal = UserWaterGoal(user_id=user.id, daily_goal_ml=request.daily_goal_ml)
        db.add(water_goal)
    else:
        water_goal.daily_goal_ml = request.daily_goal_ml
    
    db.commit()
    db.refresh(water_goal)
    
    logger.info(f"Water goal updated for user {user.id}: {request.daily_goal_ml}ml")
    
    return WaterGoalResponse(
        user_id=water_goal.user_id,
        daily_goal_ml=water_goal.daily_goal_ml,
    )


# =============================================================================
# WORKOUT LOGGING ENDPOINTS
# =============================================================================
@app.post("/api/v1/workouts/log", response_model=WorkoutLogResponse, tags=["Workouts"])
async def log_workout(
    request: WorkoutLogCreate,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Log a workout."""
    today = date.today()
    
    # Estimate calories if not provided
    calories_burned = request.calories_burned
    if calories_burned is None:
        # Basic estimation based on duration and intensity
        # MET values: low=3, moderate=5, high=8
        met_values = {"low": 3, "moderate": 5, "high": 8}
        intensity = request.intensity.value if request.intensity else "moderate"
        met = met_values.get(intensity, 5)
        # Calories = MET * weight(kg) * duration(hours)
        weight_kg = user.weight_kg if user.weight_kg else 70
        calories_burned = int(met * weight_kg * (request.duration_minutes / 60))
    
    workout_log = WorkoutLog(
        user_id=user.id,
        log_date=today,
        workout_type=request.workout_type.value,
        workout_name=request.workout_name,
        duration_minutes=request.duration_minutes,
        calories_burned=calories_burned,
        intensity=request.intensity.value if request.intensity else None,
        notes=request.notes,
    )
    db.add(workout_log)
    db.commit()
    db.refresh(workout_log)
    
    logger.info(f"Workout logged for user {user.id}: {request.workout_type} for {request.duration_minutes}min")
    
    return WorkoutLogResponse(
        id=workout_log.id,
        user_id=workout_log.user_id,
        log_date=workout_log.log_date,
        log_time=workout_log.log_time,
        workout_type=workout_log.workout_type,
        workout_name=workout_log.workout_name,
        duration_minutes=workout_log.duration_minutes,
        calories_burned=workout_log.calories_burned,
        intensity=workout_log.intensity,
        notes=workout_log.notes,
        created_at=workout_log.created_at,
    )


@app.delete("/api/v1/workouts/log/{log_id}", tags=["Workouts"])
async def delete_workout_log(
    log_id: int,
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Delete a workout log entry."""
    workout_log = db.query(WorkoutLog).filter(
        WorkoutLog.id == log_id,
        WorkoutLog.user_id == user.id
    ).first()
    
    if not workout_log:
        raise HTTPException(status_code=404, detail="Workout log not found")
    
    db.delete(workout_log)
    db.commit()
    
    return {"success": True, "message": "Workout log deleted"}


@app.get("/api/v1/workouts/today", response_model=WorkoutDailySummary, tags=["Workouts"])
async def get_today_workouts(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get today's workouts summary."""
    today = date.today()
    
    workouts = db.query(WorkoutLog).filter(
        WorkoutLog.user_id == user.id,
        WorkoutLog.log_date == today
    ).order_by(WorkoutLog.log_time).all()
    
    total_duration = sum(w.duration_minutes for w in workouts)
    total_calories = sum(w.calories_burned or 0 for w in workouts)
    
    return WorkoutDailySummary(
        date=today,
        total_duration_minutes=total_duration,
        total_calories_burned=total_calories,
        workouts_count=len(workouts),
        workouts=[
            WorkoutLogResponse(
                id=w.id,
                user_id=w.user_id,
                log_date=w.log_date,
                log_time=w.log_time,
                workout_type=w.workout_type,
                workout_name=w.workout_name,
                duration_minutes=w.duration_minutes,
                calories_burned=w.calories_burned,
                intensity=w.intensity,
                notes=w.notes,
                created_at=w.created_at,
            )
            for w in workouts
        ]
    )


@app.get("/api/v1/workouts/weekly", response_model=WorkoutWeeklySummary, tags=["Workouts"])
async def get_weekly_workouts(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get last 7 days of workouts."""
    today = date.today()
    week_ago = today - timedelta(days=6)
    
    workouts = db.query(WorkoutLog).filter(
        WorkoutLog.user_id == user.id,
        WorkoutLog.log_date >= week_ago,
        WorkoutLog.log_date <= today
    ).order_by(WorkoutLog.log_date, WorkoutLog.log_time).all()
    
    # Group by date
    workouts_by_date = {}
    for w in workouts:
        if w.log_date not in workouts_by_date:
            workouts_by_date[w.log_date] = []
        workouts_by_date[w.log_date].append(w)
    
    # Build daily summaries
    daily_summaries = []
    total_duration = 0
    total_calories = 0
    workout_days = 0
    
    for i in range(7):
        day_date = week_ago + timedelta(days=i)
        day_workouts = workouts_by_date.get(day_date, [])
        
        day_duration = sum(w.duration_minutes for w in day_workouts)
        day_calories = sum(w.calories_burned or 0 for w in day_workouts)
        
        total_duration += day_duration
        total_calories += day_calories
        if day_workouts:
            workout_days += 1
        
        daily_summaries.append(WorkoutDailySummary(
            date=day_date,
            total_duration_minutes=day_duration,
            total_calories_burned=day_calories,
            workouts_count=len(day_workouts),
            workouts=[
                WorkoutLogResponse(
                    id=w.id,
                    user_id=w.user_id,
                    log_date=w.log_date,
                    log_time=w.log_time,
                    workout_type=w.workout_type,
                    workout_name=w.workout_name,
                    duration_minutes=w.duration_minutes,
                    calories_burned=w.calories_burned,
                    intensity=w.intensity,
                    notes=w.notes,
                    created_at=w.created_at,
                )
                for w in day_workouts
            ]
        ))
    
    return WorkoutWeeklySummary(
        week_start=week_ago,
        week_end=today,
        daily_summaries=daily_summaries,
        total_duration_minutes=total_duration,
        total_calories_burned=total_calories,
        total_workouts=len(workouts),
        avg_daily_duration=round(total_duration / 7, 1),
        workout_days=workout_days,
    )


# =============================================================================
# EXTENDED PROGRESS ENDPOINTS (with water & workouts)
# =============================================================================
@app.get("/api/v1/progress/today/full", tags=["Progress"])
async def get_today_full_progress(
    user: User = Depends(require_auth),
    db: Session = Depends(get_db)
):
    """Get today's full progress including nutrition, water, workouts, and coaching insights."""
    from analytics import (
        compute_daily_status, generate_daily_insights, compute_macro_balance,
        compute_meal_breakdown, compute_streaks
    )
    
    today = date.today()
    
    # Get nutrition summary
    nutrition_summary = db.query(DailySummary).filter(
        DailySummary.user_id == user.id,
        DailySummary.summary_date == today
    ).first()
    
    # Get water data
    water_goal = db.query(UserWaterGoal).filter(
        UserWaterGoal.user_id == user.id
    ).first()
    water_goal_ml = water_goal.daily_goal_ml if water_goal else 2000
    
    water_logs = db.query(WaterLog).filter(
        WaterLog.user_id == user.id,
        WaterLog.log_date == today
    ).all()
    water_total = sum(log.amount_ml for log in water_logs)
    water_percent = round((water_total / water_goal_ml) * 100, 1) if water_goal_ml > 0 else 0
    
    # Get workout data
    workouts = db.query(WorkoutLog).filter(
        WorkoutLog.user_id == user.id,
        WorkoutLog.log_date == today
    ).all()
    workout_duration = sum(w.duration_minutes for w in workouts)
    workout_calories = sum(w.calories_burned or 0 for w in workouts)
    
    # Extract nutrition values
    food_calories = nutrition_summary.total_calories if nutrition_summary else 0
    protein = nutrition_summary.total_protein if nutrition_summary else 0
    carbs = nutrition_summary.total_carbs if nutrition_summary else 0
    fat = nutrition_summary.total_fat if nutrition_summary else 0
    fiber = nutrition_summary.total_fiber if nutrition_summary else 0
    meals_logged = nutrition_summary.meals_logged if nutrition_summary else 0
    
    # Calculate net calories
    net_calories = food_calories - workout_calories
    
    # Determine calorie status
    if user.calorie_target > 0:
        calorie_ratio = net_calories / user.calorie_target
        if calorie_ratio > 1.1:
            calorie_status = "over"
        elif calorie_ratio < 0.85:
            calorie_status = "under"
        else:
            calorie_status = "on_track"
    else:
        calorie_status = "on_track"
    
    # Compute macro balance
    macro_balance = compute_macro_balance(protein, carbs, fat)
    
    # Compute meal breakdown
    meal_breakdown = compute_meal_breakdown(db, user.id, today)
    
    # Compute coaching status
    status_level, status_message, status_emoji = compute_daily_status(
        calories_in=food_calories,
        calories_out=workout_calories,
        calorie_target=user.calorie_target,
        protein_consumed=protein,
        protein_target=user.protein_target,
        water_percent=water_percent,
        workout_count=len(workouts)
    )
    
    # Generate insights
    insights = generate_daily_insights(
        calories_in=food_calories,
        calories_out=workout_calories,
        calorie_target=user.calorie_target,
        protein_consumed=protein,
        protein_target=user.protein_target,
        carbs_consumed=carbs,
        carbs_target=user.carbs_target,
        fat_consumed=fat,
        fat_target=user.fat_target,
        water_percent=water_percent,
        meals_logged=meals_logged,
        workout_minutes=workout_duration
    )
    
    return {
        "date": today.isoformat(),
        
        # Core calorie data
        "calories_in": food_calories,
        "calories_out": workout_calories,
        "net_calories": net_calories,
        "calorie_target": user.calorie_target,
        "calorie_status": calorie_status,
        "calorie_balance": user.calorie_target - net_calories,
        
        # Nutrition breakdown
        "nutrition": {
            "calories": {"consumed": food_calories, "target": user.calorie_target},
            "protein": {"consumed": protein, "target": user.protein_target},
            "carbs": {"consumed": carbs, "target": user.carbs_target},
            "fat": {"consumed": fat, "target": user.fat_target},
            "fiber": {"consumed": fiber, "target": user.fiber_target},
            "meals_logged": meals_logged,
        },
        
        # Macro balance (percentage breakdown)
        "macro_balance": macro_balance.model_dump(),
        
        # Meal type breakdown
        "meal_breakdown": meal_breakdown.model_dump(),
        
        # Water tracking
        "water": {
            "total_ml": water_total,
            "goal_ml": water_goal_ml,
            "percent": water_percent,
            "logs_count": len(water_logs),
        },
        
        # Workout tracking
        "workouts": {
            "count": len(workouts),
            "duration_minutes": workout_duration,
            "calories_burned": workout_calories,
        },
        
        # Coaching feedback
        "status_level": status_level.value,
        "status_message": status_message,
        "status_emoji": status_emoji,
        
        # Actionable insights (max 3)
        "insights": [insight.model_dump() for insight in insights],
    }


# =============================================================================
# ERROR HANDLERS
# =============================================================================
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "internal_error", "message": "An unexpected error occurred"},
    )


# =============================================================================
# RUN SERVER
# =============================================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

