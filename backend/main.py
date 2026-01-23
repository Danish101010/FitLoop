"""
FitLoop FastAPI Application
Version: 2.0.0 (With Auth & Progress Tracking)

Main API endpoints for the food-logging nutrition app.
"""
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
)
from orchestrator import get_orchestrator, MealAnalysisOrchestrator
from config import RATE_LIMIT_MEALS_PER_HOUR, RATE_LIMIT_PID_PER_HOUR
from database import get_db, User, MealLog, DailySummary, init_db
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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
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
# IN-MEMORY STORAGE (Replace with database in production)
# =============================================================================
# Temporary storage for meal detections pending confirmation
_pending_meals: dict[str, dict] = {}


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
        # Store detection for confirmation step
        _pending_meals[result["meal_id"]] = {
            "detection": result["detection"],
            "user_id": user_id,
            "user": user,
            "meal_type": request.meal_type,
        }
    
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
    # Get original detection
    if meal_id not in _pending_meals:
        raise HTTPException(status_code=404, detail="Meal not found or already confirmed")
    
    pending = _pending_meals[meal_id]
    user_id = user.id if user else "guest"
    
    # Verify ownership (skip for guest users)
    if pending["user_id"] != user_id and pending["user_id"] != "guest":
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
        # Update stored meal with confirmed data
        _pending_meals[meal_id]["confirmed"] = result
        
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
    # Get confirmed meal
    if meal_id not in _pending_meals:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    pending = _pending_meals[meal_id]
    
    if "confirmed" not in pending:
        raise HTTPException(status_code=400, detail="Meal must be confirmed before PID analysis")
    
    user_id = user.id if user else "guest"
    logger.info(f"Running PID analysis for meal {meal_id}")
    
    result = await orchestrator.run_pid_analysis(
        request=request,
        confirmed_meal=pending["confirmed"],
    )
    
    # Save PID analysis to meal log if user authenticated
    if result["success"] and user:
        meal_log = db.query(MealLog).filter(MealLog.meal_id == meal_id).first()
        if meal_log:
            meal_log.pid_analysis_json = json.dumps(result.get("analysis", {}))
            db.commit()
    
    # Clean up pending meal
    if result["success"]:
        del _pending_meals[meal_id]
    
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
    """Get last 7 days of nutrition progress."""
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
    
    for i in range(7):
        day_date = week_ago + timedelta(days=i)
        summary = summary_map.get(day_date)
        
        if summary:
            day_data = {
                "date": day_date.isoformat(),
                "day_name": day_date.strftime("%a"),
                "calories": summary.total_calories,
                "protein": summary.total_protein,
                "carbs": summary.total_carbs,
                "fat": summary.total_fat,
                "fiber": summary.total_fiber,
                "meals_logged": summary.meals_logged,
                "calorie_goal_met": summary.total_calories >= (user.calorie_target * 0.8),
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
            }
        
        days.append(day_data)
    
    return {
        "period": "weekly",
        "start_date": week_ago.isoformat(),
        "end_date": today.isoformat(),
        "days": days,
        "averages": {
            "calories": round(totals["calories"] / 7, 1),
            "protein": round(totals["protein"] / 7, 1),
            "carbs": round(totals["carbs"] / 7, 1),
            "fat": round(totals["fat"] / 7, 1),
            "fiber": round(totals["fiber"] / 7, 1),
        },
        "totals": totals,
        "targets": {
            "calories": user.calorie_target,
            "protein": user.protein_target,
            "carbs": user.carbs_target,
            "fat": user.fat_target,
            "fiber": user.fiber_target,
        }
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

