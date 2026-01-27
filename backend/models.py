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
    confidence: float = Field(ge=0, le=1, default=0.5)


class Identification(BaseModel):
    confidence: float = Field(ge=0, le=1, default=0.5, description="Confidence score for food identification")
    alternatives: list[Alternative] = Field(default_factory=list)


class PortionUnit(str, Enum):
    GRAMS = "g"
    PIECES = "pieces"
    CUPS = "cups"
    TBSP = "tbsp"


class Portion(BaseModel):
    grams: float = Field(ge=0, le=10000, description="Estimated weight in grams (standardized)")
    household_measure: str = Field(default="1 serving", description="Human-readable portion description")
    confidence: float = Field(ge=0, le=1, default=0.5, description="Confidence score for portion estimation")
    # New fields for explicit portion editing
    amount: Optional[float] = Field(default=None, ge=0, description="User-specified amount in selected unit")
    unit: Optional[str] = Field(default="g", description="Unit of measurement (g, pieces, cups, tbsp)")
    grams_equivalent: Optional[float] = Field(default=None, ge=0, description="Calculated grams from amount and unit")


class FoodItem(BaseModel):
    item_id: str = Field(pattern=r"^item_[0-9]+$", description="Item identifier")
    food_name: str = Field(min_length=1, max_length=200)
    food_category: FoodCategory = FoodCategory.OTHER
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
    meal_description: Optional[str] = Field(
        default=None,
        max_length=500,
        description="Optional user description of the meal to help AI identify foods (e.g., 'chicken dumplings with soy sauce')"
    )


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


# =============================================================================
# WATER INTAKE MODELS
# =============================================================================
class WaterIntakeType(str, Enum):
    WATER = "water"
    TEA = "tea"
    COFFEE = "coffee"
    JUICE = "juice"
    OTHER = "other"


class WaterLogCreate(BaseModel):
    """Request to log water intake."""
    amount_ml: int = Field(ge=1, le=5000, description="Water amount in milliliters")
    note: Optional[str] = Field(default=None, max_length=200, description="Optional note")


class WaterLogResponse(BaseModel):
    """Response for a single water log entry."""
    id: int
    user_id: int
    log_date: date
    log_time: datetime
    amount_ml: int
    note: Optional[str] = None
    created_at: datetime


class WaterDailySummary(BaseModel):
    """Daily water intake summary."""
    date: date
    total_ml: int = 0
    goal_ml: int = 2000
    percent_complete: float = 0
    logs_count: int = 0
    logs: list[WaterLogResponse] = Field(default_factory=list)


class WaterWeeklySummary(BaseModel):
    """Weekly water intake summary."""
    week_start: date
    week_end: date
    daily_summaries: list[WaterDailySummary] = Field(default_factory=list)
    avg_daily_ml: float = 0
    goal_met_days: int = 0
    total_ml: int = 0


class WaterGoalUpdate(BaseModel):
    """Request to update water goal."""
    daily_goal_ml: int = Field(ge=500, le=10000, description="Daily water goal in milliliters")


class WaterGoalResponse(BaseModel):
    """Response for water goal."""
    user_id: int
    daily_goal_ml: int = 2000


# =============================================================================
# WORKOUT LOGGING MODELS
# =============================================================================
class WorkoutType(str, Enum):
    CARDIO = "cardio"
    STRENGTH = "strength"
    FLEXIBILITY = "flexibility"
    SPORTS = "sports"
    HIIT = "hiit"
    WALKING = "walking"
    RUNNING = "running"
    CYCLING = "cycling"
    SWIMMING = "swimming"
    YOGA = "yoga"
    OTHER = "other"


class WorkoutIntensity(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


class WorkoutLogCreate(BaseModel):
    """Request to log a workout."""
    workout_type: WorkoutType
    workout_name: Optional[str] = Field(default=None, max_length=200, description="Custom workout name")
    duration_minutes: int = Field(ge=1, le=600, description="Workout duration in minutes")
    calories_burned: Optional[int] = Field(default=None, ge=0, le=5000, description="Estimated calories burned")
    intensity: Optional[WorkoutIntensity] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class WorkoutLogResponse(BaseModel):
    """Response for a single workout log entry."""
    id: int
    user_id: int
    log_date: date
    log_time: datetime
    workout_type: str
    workout_name: Optional[str] = None
    duration_minutes: int
    calories_burned: Optional[int] = None
    intensity: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


class WorkoutDailySummary(BaseModel):
    """Daily workout summary."""
    date: date
    total_duration_minutes: int = 0
    total_calories_burned: int = 0
    workouts_count: int = 0
    workouts: list[WorkoutLogResponse] = Field(default_factory=list)


class WorkoutWeeklySummary(BaseModel):
    """Weekly workout summary."""
    week_start: date
    week_end: date
    daily_summaries: list[WorkoutDailySummary] = Field(default_factory=list)
    total_duration_minutes: int = 0
    total_calories_burned: int = 0
    total_workouts: int = 0
    avg_daily_duration: float = 0
    workout_days: int = 0


# =============================================================================
# EXTENDED DAILY PROGRESS MODEL
# =============================================================================
class MacroBalance(BaseModel):
    """Macro nutrient breakdown as percentages of total calories."""
    protein_percent: float = 0
    carbs_percent: float = 0
    fat_percent: float = 0
    protein_calories: int = 0
    carbs_calories: int = 0
    fat_calories: int = 0


class StatusLevel(str, Enum):
    """Daily status levels for coaching feedback."""
    OK = "ok"
    WARNING = "warning"
    CRITICAL = "critical"
    EXCELLENT = "excellent"


class DailyInsight(BaseModel):
    """A single insight or recommendation."""
    type: Literal["warning", "success", "tip", "info"]
    icon: str = "💡"
    title: str
    message: str


class MealTypeBreakdown(BaseModel):
    """Calorie breakdown by meal type."""
    breakfast: int = 0
    lunch: int = 0
    dinner: int = 0
    snack: int = 0


class TopFoodItem(BaseModel):
    """A frequently logged food item."""
    name: str
    total_calories: int
    frequency: int


class WeekOverWeekDelta(BaseModel):
    """Week-over-week comparison data."""
    calories: float = 0  # Percentage change
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    direction_calories: Literal["up", "down", "stable"] = "stable"
    direction_protein: Literal["up", "down", "stable"] = "stable"


class StreakInfo(BaseModel):
    """Consistency and streak tracking."""
    current_streak: int = 0  # Consecutive days logged
    longest_streak: int = 0  # All-time best
    days_logged_this_week: int = 0  # Out of 7
    meals_logged_this_week: int = 0
    water_goal_met_streak: int = 0
    workout_streak: int = 0


class DailyProgressSummary(BaseModel):
    """Complete daily progress including nutrition, water, and workouts."""
    date: date
    
    # Nutrition
    nutrition: dict = Field(default_factory=dict)
    
    # Water
    water_total_ml: int = 0
    water_goal_ml: int = 2000
    water_percent: float = 0
    
    # Workouts
    workout_count: int = 0
    workout_duration_minutes: int = 0
    workout_calories_burned: int = 0
    
    # Net calories (food intake - workout calories)
    net_calories: float = 0


class EnhancedDailyProgress(BaseModel):
    """Enhanced daily progress with coaching insights."""
    date: date
    
    # Core nutrition data
    calories_in: int = 0
    calories_out: int = 0  # From workouts
    net_calories: int = 0
    calorie_target: int = 2000
    calorie_status: Literal["under", "on_track", "over"] = "on_track"
    
    # Macros
    protein: dict = Field(default_factory=dict)
    carbs: dict = Field(default_factory=dict)
    fat: dict = Field(default_factory=dict)
    fiber: dict = Field(default_factory=dict)
    
    # Macro balance
    macro_balance: MacroBalance = Field(default_factory=MacroBalance)
    
    # Water
    water: dict = Field(default_factory=dict)
    
    # Workouts
    workouts: dict = Field(default_factory=dict)
    
    # Coaching status
    status_level: StatusLevel = StatusLevel.OK
    status_message: str = "Keep it up! You're on track today."
    status_emoji: str = "👍"
    
    # Insights (max 3)
    insights: list[DailyInsight] = Field(default_factory=list)
    
    # Meal distribution
    meal_breakdown: MealTypeBreakdown = Field(default_factory=MealTypeBreakdown)
    meals_logged: int = 0


class EnhancedWeeklyProgress(BaseModel):
    """Enhanced weekly progress with trends and comparisons."""
    period: str = "weekly"
    start_date: date
    end_date: date
    
    # Daily data
    days: list[dict] = Field(default_factory=list)
    
    # Averages
    averages: dict = Field(default_factory=dict)
    totals: dict = Field(default_factory=dict)
    targets: dict = Field(default_factory=dict)
    
    # Week-over-week deltas
    wow_delta: WeekOverWeekDelta = Field(default_factory=WeekOverWeekDelta)
    
    # Streaks
    streaks: StreakInfo = Field(default_factory=StreakInfo)
    
    # Top foods this week
    top_foods: list[TopFoodItem] = Field(default_factory=list)
    
    # Weekly insights
    insights: list[DailyInsight] = Field(default_factory=list)
    
    # Consistency metrics
    goal_hit_days: int = 0  # Days where calorie goal ±10%
    protein_goal_days: int = 0

