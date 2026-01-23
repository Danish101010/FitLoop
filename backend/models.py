"""
FitLoop Pydantic Models
Version: 1.0.0 (MVP)

These models match the JSON schemas in /schemas/ directory.
"""
from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel, Field
from enum import Enum


# =============================================================================
# ENUMS
# =============================================================================
class MealType(str, Enum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"
    SNACK = "snack"


class FoodCategory(str, Enum):
    PROTEIN = "protein"
    CARBOHYDRATE = "carbohydrate"
    VEGETABLE = "vegetable"
    FRUIT = "fruit"
    DAIRY = "dairy"
    FAT = "fat"
    BEVERAGE = "beverage"
    CONDIMENT = "condiment"
    MIXED_DISH = "mixed_dish"
    SNACK = "snack"
    DESSERT = "dessert"
    OTHER = "other"


class PreparationMethod(str, Enum):
    RAW = "raw"
    BOILED = "boiled"
    STEAMED = "steamed"
    GRILLED = "grilled"
    FRIED = "fried"
    BAKED = "baked"
    ROASTED = "roasted"
    SAUTEED = "sauteed"
    POACHED = "poached"
    UNKNOWN = "unknown"


class ConfirmationStatus(str, Enum):
    AUTO_ACCEPTED = "auto_accepted"
    PENDING_CONFIRMATION = "pending_confirmation"
    USER_CONFIRMED = "user_confirmed"
    USER_CORRECTED = "user_corrected"
    REJECTED = "rejected"


class ActionType(str, Enum):
    ADD_FOOD = "add_food"
    MODERATE_INTAKE = "moderate_intake"
    SUBSTITUTE = "substitute"
    TIMING_ADJUSTMENT = "timing_adjustment"
    HYDRATION = "hydration"


# =============================================================================
# NUTRITION MODELS
# =============================================================================
class Nutrition(BaseModel):
    calories: float = Field(ge=0, description="Total calories (kcal)")
    protein_g: float = Field(ge=0, description="Protein in grams")
    carbs_g: float = Field(ge=0, description="Carbohydrates in grams")
    fat_g: float = Field(ge=0, description="Fat in grams")
    fiber_g: Optional[float] = Field(default=0, ge=0, description="Dietary fiber in grams")
    sodium_mg: Optional[float] = Field(default=0, ge=0, description="Sodium in milligrams")
    sugar_g: Optional[float] = Field(default=0, ge=0, description="Total sugars in grams")


class NutritionTotals(BaseModel):
    calories: float = Field(ge=0)
    protein_g: float = Field(ge=0)
    carbs_g: float = Field(ge=0)
    fat_g: float = Field(ge=0)
    fiber_g: Optional[float] = Field(default=0, ge=0)


# =============================================================================
# FOOD DETECTION MODELS
# =============================================================================
class Alternative(BaseModel):
    name: str
    confidence: float = Field(ge=0, le=1)


class Identification(BaseModel):
    confidence: float = Field(ge=0, le=1, description="Confidence score for food identification")
    alternatives: list[Alternative] = Field(default_factory=list, max_length=3)


class Portion(BaseModel):
    grams: float = Field(ge=1, le=5000, description="Estimated weight in grams")
    household_measure: str = Field(description="Human-readable portion description")
    confidence: float = Field(ge=0, le=1, description="Confidence score for portion estimation")


class FoodItem(BaseModel):
    item_id: str = Field(pattern=r"^item_[0-9]{3}$")
    food_name: str = Field(min_length=1, max_length=100)
    food_category: FoodCategory
    portion: Portion
    identification: Identification
    nutrition: Nutrition
    preparation_method: Optional[PreparationMethod] = PreparationMethod.UNKNOWN
    flags: list[str] = Field(default_factory=list)


class ImageQuality(BaseModel):
    score: float = Field(ge=0, le=1)
    issues: list[str] = Field(default_factory=list)


class FoodDetectResponse(BaseModel):
    """Response from Gemini Vision API for food detection."""
    request_id: str = Field(pattern=r"^req_[a-zA-Z0-9]+$")
    timestamp: datetime
    status: Literal["success", "partial", "no_food_detected", "error"]
    error_message: Optional[str] = None
    image_quality: Optional[ImageQuality] = None
    items: list[FoodItem] = Field(default_factory=list)
    meal_totals: NutritionTotals
    requires_confirmation: bool = False
    confirmation_reason: Optional[str] = None
    items_needing_confirmation: list[str] = Field(default_factory=list)


# =============================================================================
# PID ANALYSIS MODELS
# =============================================================================
class NutrientStatus(BaseModel):
    target: float = Field(ge=0)
    consumed: float = Field(ge=0)
    remaining: float
    percent_complete: float = Field(ge=0)


class PidComponents(BaseModel):
    p_contribution: float = Field(ge=0, le=1, description="Proportional contribution")
    i_contribution: float = Field(ge=0, le=1, description="Integral contribution")
    d_contribution: float = Field(ge=0, le=1, description="Derivative contribution")


class FoodSuggestion(BaseModel):
    name: str
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    fiber_g: Optional[float] = None
    calories: Optional[float] = None
    fits_preferences: bool = True
    note: Optional[str] = None


class Recommendation(BaseModel):
    priority: int = Field(ge=1, le=5)
    nutrient: str
    type: Literal["deficit", "surplus", "trend_warning", "goal_progress"]
    severity: float = Field(ge=0, le=1)
    pid_components: Optional[PidComponents] = None
    current_gap: Optional[str] = None
    weekly_context: Optional[str] = None
    suggestion: str = Field(min_length=10, max_length=500)
    food_suggestions: list[FoodSuggestion] = Field(default_factory=list, max_length=5)
    action_type: ActionType = ActionType.ADD_FOOD


class DailySummary(BaseModel):
    overall_score: float = Field(ge=0, le=1)
    headline: str = Field(max_length=150)
    encouragement: Optional[str] = Field(default=None, max_length=300)
    streak_info: Optional[dict] = None


class MealSuggestionNutrition(BaseModel):
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    fiber_g: Optional[float] = None


class MealSuggestion(BaseModel):
    meal_name: str
    estimated_nutrition: MealSuggestionNutrition
    why: str
    recipe_hint: Optional[str] = None


class AnalysisPeriod(BaseModel):
    today: date
    week_start: date


class KpiPidResponse(BaseModel):
    """Response from Gemini PID analysis API."""
    request_id: str = Field(pattern=r"^pid_[a-zA-Z0-9]+$")
    timestamp: datetime
    status: Literal["success", "partial", "error"]
    error_message: Optional[str] = None
    user_id: Optional[str] = None
    analysis_period: Optional[AnalysisPeriod] = None
    current_status: dict[str, NutrientStatus] = Field(default_factory=dict)
    recommendations: list[Recommendation] = Field(default_factory=list, max_length=5)
    daily_summary: DailySummary
    next_meal_suggestions: list[MealSuggestion] = Field(default_factory=list, max_length=3)


# =============================================================================
# REQUEST MODELS
# =============================================================================
class AnalyzeMealRequest(BaseModel):
    """Request to analyze a food image."""
    image_base64: str = Field(description="Base64 encoded image data")
    meal_type: MealType
    dietary_preferences: Optional[str] = "no specific restrictions"
    allergies: Optional[str] = "none"
    user_notes: Optional[str] = None


class ConfirmMealRequest(BaseModel):
    """Request to confirm or correct a meal analysis."""
    meal_id: str
    items: list[dict] = Field(description="Confirmed/corrected food items (flexible shape)")
    user_confirmed: bool = True


class UserProfile(BaseModel):
    """User profile for PID analysis."""
    user_id: str
    age: int = Field(ge=1, le=120)
    sex: Literal["male", "female", "other"]
    weight_kg: float = Field(ge=20, le=500)
    height_cm: float = Field(ge=50, le=300)
    activity_level: Literal["sedentary", "lightly_active", "moderately_active", "very_active", "extremely_active"]
    primary_goal: Literal["lose_weight", "maintain_weight", "gain_weight", "build_muscle", "improve_health"]
    goal_intensity: Literal["relaxed", "moderate", "strict"] = "moderate"
    dietary_preferences: Optional[str] = None
    health_conditions: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)


class DailyTargets(BaseModel):
    """Daily nutritional targets."""
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: Optional[float] = 28
    sodium_mg: Optional[float] = 2300
    sugar_g: Optional[float] = 50


class TodaysIntake(BaseModel):
    """Today's intake summary."""
    meals_logged: int
    totals: NutritionTotals


class WeeklySummary(BaseModel):
    """7-day summary for PID integral component."""
    avg_daily_calories: float
    avg_daily_protein_g: float
    protein_goal_met_days: int = Field(ge=0, le=7)
    fiber_goal_met_days: int = Field(ge=0, le=7)
    trend_protein: Literal["improving", "stable", "declining", "stable_low", "stable_high"]
    trend_fiber: Literal["improving", "stable", "declining", "stable_low", "stable_high"]


class PidAnalysisRequest(BaseModel):
    """Request for PID nutritional analysis."""
    user_profile: UserProfile
    daily_targets: DailyTargets
    todays_intake: TodaysIntake
    weekly_summary: WeeklySummary
    current_meal_type: MealType
    time_of_day: str  # HH:MM format
    meals_remaining: int = Field(ge=0, le=10)


# =============================================================================
# CORRECTION LOGGING (Decision 6: Store for training)
# =============================================================================
class CorrectionLog(BaseModel):
    """Log entry for user corrections (training data)."""
    correction_id: str
    user_id: str
    meal_id: str
    original_response: FoodDetectResponse
    user_correction: list[FoodItem]
    correction_type: Literal["food_name", "portion", "both", "added_item", "removed_item"]
    timestamp: datetime

