"""
FitLoop FastAPI Application
Version: 1.0.0 (MVP)

Main API endpoints for the food-logging nutrition app.
"""
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import (
    AnalyzeMealRequest,
    ConfirmMealRequest,
    PidAnalysisRequest,
    FoodItem,
    MealType,
)
from orchestrator import get_orchestrator, MealAnalysisOrchestrator
from config import RATE_LIMIT_MEALS_PER_HOUR, RATE_LIMIT_PID_PER_HOUR

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
    # Initialize any resources here (DB connections, etc.)
    yield
    logger.info("FitLoop API shutting down...")
    # Cleanup resources here


app = FastAPI(
    title="FitLoop API",
    description="AI-powered food logging and nutrition analysis",
    version="1.0.0",
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
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """
    Stub authentication dependency.
    Replace with real auth in production.
    """
    # TODO: Implement real authentication
    if not authorization:
        # For MVP, allow unauthenticated requests with a default user
        return {"user_id": "demo_user", "authenticated": False}
    
    # Parse Bearer token and validate
    # For now, just extract a user ID from the token
    return {"user_id": "authenticated_user", "authenticated": True}


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
    return HealthResponse(status="healthy", version="1.0.0")


@app.post("/api/v1/meals/analyze", response_model=AnalyzeMealResponse, tags=["Meals"])
async def analyze_meal(
    request: AnalyzeMealRequest,
    user: dict = Depends(get_current_user),
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
    logger.info(f"Analyzing meal for user {user['user_id']}, type: {request.meal_type}")
    
    result = await orchestrator.analyze_meal_image(request)
    
    if result["success"]:
        # Store detection for confirmation step
        _pending_meals[result["meal_id"]] = {
            "detection": result["detection"],
            "user_id": user["user_id"],
            "meal_type": request.meal_type,
        }
    
    return AnalyzeMealResponse(**result)


@app.post("/api/v1/meals/{meal_id}/confirm", response_model=ConfirmMealResponse, tags=["Meals"])
async def confirm_meal(
    meal_id: str,
    request: ConfirmMealRequest,
    user: dict = Depends(get_current_user),
    orchestrator: MealAnalysisOrchestrator = Depends(get_orchestrator_dep),
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
    
    # Verify ownership
    if pending["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to confirm this meal")
    
    logger.info(f"Confirming meal {meal_id} for user {user['user_id']}")
    
    result = await orchestrator.confirm_meal(
        request=request,
        original_detection=pending["detection"],
        user_id=user["user_id"],
        db_session=None,  # TODO: Pass real DB session
    )
    
    if result["success"]:
        # Update stored meal with confirmed data
        _pending_meals[meal_id]["confirmed"] = result
    
    return ConfirmMealResponse(**result)


@app.post("/api/v1/meals/{meal_id}/pid", response_model=PidAnalysisResponse, tags=["Meals"])
async def run_pid_analysis(
    meal_id: str,
    request: PidAnalysisRequest,
    user: dict = Depends(get_current_user),
    orchestrator: MealAnalysisOrchestrator = Depends(get_orchestrator_dep),
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
    
    logger.info(f"Running PID analysis for meal {meal_id}")
    
    result = await orchestrator.run_pid_analysis(
        request=request,
        confirmed_meal=pending["confirmed"],
    )
    
    # Clean up pending meal (move to permanent storage in production)
    if result["success"]:
        del _pending_meals[meal_id]
    
    return PidAnalysisResponse(**result)


@app.post("/api/v1/meals/quick-log", tags=["Meals"])
async def quick_log_meal(
    request: AnalyzeMealRequest,
    pid_request: PidAnalysisRequest,
    user: dict = Depends(get_current_user),
    orchestrator: MealAnalysisOrchestrator = Depends(get_orchestrator_dep),
):
    """
    Quick log endpoint for auto-accepted meals.
    
    Combines analyze + auto-confirm + PID in one call.
    Only works if all items are auto-accepted (high confidence).
    """
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
        user_id=user["user_id"],
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
    user: dict = Depends(get_current_user),
):
    """
    Manual meal entry endpoint.
    
    For cases where image analysis fails or user prefers typing.
    Skips the vision step entirely.
    """
    import secrets
    
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
# ERROR HANDLERS
# =============================================================================
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return {"error": "internal_error", "message": "An unexpected error occurred"}


# =============================================================================
# RUN SERVER
# =============================================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

