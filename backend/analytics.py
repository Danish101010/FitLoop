"""
Analytics and insights engine for FitLoop.
Provides coaching feedback, trend analysis, and intelligent insights.
"""

from datetime import date, timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
import json

from database import User, DailySummary, MealLog, WaterLog, UserWaterGoal, WorkoutLog
from models import (
    StatusLevel, DailyInsight, MacroBalance, MealTypeBreakdown,
    TopFoodItem, WeekOverWeekDelta, StreakInfo
)


# =============================================================================
# STATUS & COACHING LOGIC
# =============================================================================

def compute_daily_status(
    calories_in: int,
    calories_out: int,
    calorie_target: int,
    protein_consumed: float,
    protein_target: float,
    water_percent: float,
    workout_count: int
) -> tuple[StatusLevel, str, str]:
    """
    Compute the daily coaching status based on multiple factors.
    Returns (status_level, status_message, emoji).
    """
    net_calories = calories_in - calories_out
    calorie_ratio = net_calories / calorie_target if calorie_target > 0 else 0
    protein_ratio = protein_consumed / protein_target if protein_target > 0 else 0
    
    issues = []
    positives = []
    
    # Check calorie status
    if calorie_ratio > 1.2:
        issues.append("calorie_over")
    elif calorie_ratio < 0.6:
        issues.append("calorie_under")
    elif 0.9 <= calorie_ratio <= 1.1:
        positives.append("calorie_perfect")
    
    # Check protein status
    if protein_ratio < 0.7:
        issues.append("protein_low")
    elif protein_ratio >= 0.9:
        positives.append("protein_good")
    
    # Check hydration
    if water_percent >= 80:
        positives.append("hydration_good")
    elif water_percent < 50:
        issues.append("hydration_low")
    
    # Check workout
    if workout_count > 0:
        positives.append("active_day")
    
    # Determine overall status
    if len(issues) >= 2:
        status = StatusLevel.CRITICAL
        emoji = "⚠️"
        if "calorie_over" in issues:
            message = "You've exceeded your calorie target significantly. Consider a lighter dinner or extra movement."
        elif "calorie_under" in issues and "protein_low" in issues:
            message = "You're running low on both calories and protein. Time to fuel up with a balanced meal!"
        else:
            message = "A few areas need attention today. Let's get back on track!"
    elif len(issues) == 1:
        status = StatusLevel.WARNING
        emoji = "💡"
        if "calorie_over" in issues:
            message = "Slightly over on calories. A short walk can help balance it out."
        elif "calorie_under" in issues:
            message = "You're under your calorie goal. Make sure to eat enough to fuel your body."
        elif "protein_low" in issues:
            message = "Protein is running low. Consider adding some lean protein to your next meal."
        elif "hydration_low" in issues:
            message = "Don't forget to drink water! You're behind on hydration."
        else:
            message = "Almost there! One small adjustment will get you on track."
    elif len(positives) >= 3:
        status = StatusLevel.EXCELLENT
        emoji = "🌟"
        message = "Outstanding day! You're crushing your nutrition, hydration, and activity goals!"
    else:
        status = StatusLevel.OK
        emoji = "👍"
        if positives:
            if "calorie_perfect" in positives:
                message = "Great job staying on target with your calories!"
            elif "protein_good" in positives:
                message = "Excellent protein intake today. Keep it up!"
            elif "hydration_good" in positives:
                message = "Staying well hydrated! Your body thanks you."
            else:
                message = "You're doing well! Keep the momentum going."
        else:
            message = "Keep logging your meals to stay on track with your goals."
    
    return status, message, emoji


def generate_daily_insights(
    calories_in: int,
    calories_out: int,
    calorie_target: int,
    protein_consumed: float,
    protein_target: float,
    carbs_consumed: float,
    carbs_target: float,
    fat_consumed: float,
    fat_target: float,
    water_percent: float,
    meals_logged: int,
    workout_minutes: int
) -> list[DailyInsight]:
    """
    Generate up to 3 actionable insights based on the day's data.
    Prioritizes warnings, then successes, then tips.
    """
    insights = []
    
    net_calories = calories_in - calories_out
    
    # WARNINGS (priority 1)
    if net_calories > calorie_target * 1.15:
        deficit = net_calories - calorie_target
        insights.append(DailyInsight(
            type="warning",
            icon="🔥",
            title="Calorie Surplus",
            message=f"You're {deficit} kcal over target. A 30-min walk burns ~150 calories."
        ))
    
    if protein_consumed < protein_target * 0.6 and meals_logged >= 2:
        remaining = protein_target - protein_consumed
        insights.append(DailyInsight(
            type="warning",
            icon="🥩",
            title="Low Protein Alert",
            message=f"Only {int(protein_consumed)}g protein so far. Aim for {int(remaining)}g more today."
        ))
    
    if fat_consumed > fat_target * 1.3:
        insights.append(DailyInsight(
            type="warning",
            icon="🧈",
            title="Fat Intake High",
            message="Fat consumption exceeded target. Balance with lean proteins for remaining meals."
        ))
    
    if water_percent < 40 and meals_logged >= 2:
        insights.append(DailyInsight(
            type="warning",
            icon="💧",
            title="Hydration Reminder",
            message="You're behind on water. Drink a glass now to catch up!"
        ))
    
    # SUCCESS (priority 2)
    if 0.9 <= net_calories / calorie_target <= 1.1 and meals_logged >= 2:
        insights.append(DailyInsight(
            type="success",
            icon="🎯",
            title="Perfect Calorie Day",
            message="Your calorie intake is right on target. Excellent work!"
        ))
    
    if protein_consumed >= protein_target * 0.9:
        insights.append(DailyInsight(
            type="success",
            icon="💪",
            title="Protein Goal Achieved",
            message=f"Great job hitting {int(protein_consumed)}g of protein today!"
        ))
    
    if workout_minutes >= 30:
        insights.append(DailyInsight(
            type="success",
            icon="🏆",
            title="Active Day",
            message=f"{workout_minutes} minutes of exercise! You burned {calories_out} calories."
        ))
    
    if water_percent >= 100:
        insights.append(DailyInsight(
            type="success",
            icon="💦",
            title="Hydration Champion",
            message="You've met your daily water goal. Your body is well hydrated!"
        ))
    
    # TIPS (priority 3)
    if meals_logged == 0:
        insights.append(DailyInsight(
            type="tip",
            icon="📸",
            title="Log Your First Meal",
            message="Start tracking today! Snap a photo of your breakfast to begin."
        ))
    
    if meals_logged == 1 and calories_in < calorie_target * 0.3:
        insights.append(DailyInsight(
            type="tip",
            icon="🥗",
            title="Balanced Day Ahead",
            message="Plan your remaining meals to hit your protein and calorie goals."
        ))
    
    # Sort by priority (warnings first, then success, then tips) and limit to 3
    priority = {"warning": 0, "success": 1, "tip": 2, "info": 3}
    insights.sort(key=lambda x: priority.get(x.type, 3))
    
    return insights[:3]


# =============================================================================
# MACRO BALANCE CALCULATIONS
# =============================================================================

def compute_macro_balance(
    protein_g: float,
    carbs_g: float,
    fat_g: float
) -> MacroBalance:
    """
    Calculate macro nutrient breakdown as percentages of total calories.
    Protein/Carbs = 4 cal/g, Fat = 9 cal/g
    """
    protein_cal = protein_g * 4
    carbs_cal = carbs_g * 4
    fat_cal = fat_g * 9
    total_cal = protein_cal + carbs_cal + fat_cal
    
    if total_cal == 0:
        return MacroBalance()
    
    return MacroBalance(
        protein_percent=round((protein_cal / total_cal) * 100, 1),
        carbs_percent=round((carbs_cal / total_cal) * 100, 1),
        fat_percent=round((fat_cal / total_cal) * 100, 1),
        protein_calories=int(protein_cal),
        carbs_calories=int(carbs_cal),
        fat_calories=int(fat_cal)
    )


# =============================================================================
# MEAL BREAKDOWN
# =============================================================================

def compute_meal_breakdown(db: Session, user_id: int, target_date: date) -> MealTypeBreakdown:
    """
    Aggregate calories by meal type for a given day.
    """
    meals = db.query(MealLog).filter(
        MealLog.user_id == user_id,
        MealLog.meal_date == target_date
    ).all()
    
    breakdown = MealTypeBreakdown()
    
    for meal in meals:
        meal_type = meal.meal_type.lower() if meal.meal_type else "snack"
        calories = meal.total_calories or 0
        
        if meal_type == "breakfast":
            breakdown.breakfast += calories
        elif meal_type == "lunch":
            breakdown.lunch += calories
        elif meal_type == "dinner":
            breakdown.dinner += calories
        else:
            breakdown.snack += calories
    
    return breakdown


# =============================================================================
# STREAK CALCULATIONS
# =============================================================================

def compute_streaks(db: Session, user_id: int, reference_date: date) -> StreakInfo:
    """
    Calculate various streak metrics for the user.
    """
    streaks = StreakInfo()
    
    # Get all daily summaries ordered by date
    summaries = db.query(DailySummary).filter(
        DailySummary.user_id == user_id,
        DailySummary.summary_date <= reference_date
    ).order_by(DailySummary.summary_date.desc()).limit(365).all()
    
    if not summaries:
        return streaks
    
    # Calculate current streak (consecutive days with meals logged)
    current_streak = 0
    check_date = reference_date
    
    summary_dates = {s.summary_date for s in summaries}
    
    while check_date in summary_dates:
        current_streak += 1
        check_date -= timedelta(days=1)
    
    streaks.current_streak = current_streak
    
    # Calculate longest streak
    longest = 0
    current = 0
    dates_list = sorted(summary_dates)
    
    for i, d in enumerate(dates_list):
        if i == 0:
            current = 1
        elif (d - dates_list[i-1]).days == 1:
            current += 1
        else:
            longest = max(longest, current)
            current = 1
    longest = max(longest, current)
    streaks.longest_streak = longest
    
    # Days logged this week
    week_start = reference_date - timedelta(days=reference_date.weekday())
    week_summaries = [s for s in summaries if week_start <= s.summary_date <= reference_date]
    streaks.days_logged_this_week = len(week_summaries)
    streaks.meals_logged_this_week = sum(s.meals_logged for s in week_summaries)
    
    # Water goal streak
    water_goal = db.query(UserWaterGoal).filter(
        UserWaterGoal.user_id == user_id
    ).first()
    goal_ml = water_goal.daily_goal_ml if water_goal else 2000
    
    water_streak = 0
    check_date = reference_date
    
    while True:
        daily_water = db.query(func.sum(WaterLog.amount_ml)).filter(
            WaterLog.user_id == user_id,
            WaterLog.log_date == check_date
        ).scalar() or 0
        
        if daily_water >= goal_ml:
            water_streak += 1
            check_date -= timedelta(days=1)
        else:
            break
        
        if water_streak > 30:  # Limit lookup
            break
    
    streaks.water_goal_met_streak = water_streak
    
    # Workout streak
    workout_streak = 0
    check_date = reference_date
    
    while True:
        workouts = db.query(WorkoutLog).filter(
            WorkoutLog.user_id == user_id,
            WorkoutLog.log_date == check_date
        ).first()
        
        if workouts:
            workout_streak += 1
            check_date -= timedelta(days=1)
        else:
            break
        
        if workout_streak > 30:
            break
    
    streaks.workout_streak = workout_streak
    
    return streaks


# =============================================================================
# WEEK-OVER-WEEK COMPARISON
# =============================================================================

def compute_week_over_week(db: Session, user_id: int, reference_date: date) -> WeekOverWeekDelta:
    """
    Compare this week's averages to last week's.
    """
    # This week (last 7 days)
    this_week_end = reference_date
    this_week_start = reference_date - timedelta(days=6)
    
    # Last week
    last_week_end = this_week_start - timedelta(days=1)
    last_week_start = last_week_end - timedelta(days=6)
    
    def get_week_averages(start: date, end: date) -> dict:
        summaries = db.query(DailySummary).filter(
            DailySummary.user_id == user_id,
            DailySummary.summary_date >= start,
            DailySummary.summary_date <= end
        ).all()
        
        if not summaries:
            return {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
        
        count = len(summaries)
        return {
            "calories": sum(s.total_calories for s in summaries) / count,
            "protein": sum(s.total_protein for s in summaries) / count,
            "carbs": sum(s.total_carbs for s in summaries) / count,
            "fat": sum(s.total_fat for s in summaries) / count
        }
    
    this_week = get_week_averages(this_week_start, this_week_end)
    last_week = get_week_averages(last_week_start, last_week_end)
    
    def calc_delta(current: float, previous: float) -> tuple[float, str]:
        if previous == 0:
            return 0, "stable"
        delta = ((current - previous) / previous) * 100
        direction = "up" if delta > 5 else "down" if delta < -5 else "stable"
        return round(delta, 1), direction
    
    cal_delta, cal_dir = calc_delta(this_week["calories"], last_week["calories"])
    pro_delta, pro_dir = calc_delta(this_week["protein"], last_week["protein"])
    carb_delta, _ = calc_delta(this_week["carbs"], last_week["carbs"])
    fat_delta, _ = calc_delta(this_week["fat"], last_week["fat"])
    
    return WeekOverWeekDelta(
        calories=cal_delta,
        protein=pro_delta,
        carbs=carb_delta,
        fat=fat_delta,
        direction_calories=cal_dir,
        direction_protein=pro_dir
    )


# =============================================================================
# TOP FOODS
# =============================================================================

def get_top_foods(db: Session, user_id: int, days: int = 7, limit: int = 5) -> list[TopFoodItem]:
    """
    Get the most frequently logged foods in the past N days.
    """
    start_date = date.today() - timedelta(days=days-1)
    
    meals = db.query(MealLog).filter(
        MealLog.user_id == user_id,
        MealLog.meal_date >= start_date
    ).all()
    
    food_stats = {}
    
    for meal in meals:
        if not meal.food_items_json:
            continue
        
        try:
            items = json.loads(meal.food_items_json)
            for item in items:
                name = item.get("name") or item.get("food_name", "Unknown")
                calories = item.get("nutrition", {}).get("calories", 0)
                
                if name not in food_stats:
                    food_stats[name] = {"calories": 0, "count": 0}
                
                food_stats[name]["calories"] += calories
                food_stats[name]["count"] += 1
        except (json.JSONDecodeError, TypeError):
            continue
    
    # Sort by frequency, then by calories
    sorted_foods = sorted(
        food_stats.items(),
        key=lambda x: (x[1]["count"], x[1]["calories"]),
        reverse=True
    )[:limit]
    
    return [
        TopFoodItem(
            name=name,
            total_calories=int(stats["calories"]),
            frequency=stats["count"]
        )
        for name, stats in sorted_foods
    ]


# =============================================================================
# WEEKLY INSIGHTS
# =============================================================================

def generate_weekly_insights(
    averages: dict,
    targets: dict,
    goal_hit_days: int,
    protein_goal_days: int,
    streaks: StreakInfo,
    wow_delta: WeekOverWeekDelta
) -> list[DailyInsight]:
    """
    Generate insights based on weekly performance.
    """
    insights = []
    
    # Consistency
    if streaks.days_logged_this_week >= 6:
        insights.append(DailyInsight(
            type="success",
            icon="🔥",
            title="Logging Streak!",
            message=f"You've logged {streaks.days_logged_this_week} days this week. Keep it consistent!"
        ))
    elif streaks.days_logged_this_week <= 3:
        insights.append(DailyInsight(
            type="warning",
            icon="📝",
            title="Consistency Needed",
            message="Try to log your meals daily for better insights and progress tracking."
        ))
    
    # Calorie goal consistency
    if goal_hit_days >= 5:
        insights.append(DailyInsight(
            type="success",
            icon="🎯",
            title="Goal Crusher",
            message=f"You hit your calorie target {goal_hit_days} out of 7 days this week!"
        ))
    elif goal_hit_days <= 2:
        insights.append(DailyInsight(
            type="warning",
            icon="⚖️",
            title="Calorie Consistency",
            message="Try to stay closer to your calorie target more consistently."
        ))
    
    # Protein tracking
    if protein_goal_days >= 5:
        insights.append(DailyInsight(
            type="success",
            icon="💪",
            title="Protein Champion",
            message=f"Excellent protein intake on {protein_goal_days} days this week!"
        ))
    
    # Trends
    if wow_delta.direction_calories == "down" and wow_delta.calories < -10:
        insights.append(DailyInsight(
            type="info",
            icon="📉",
            title="Calorie Trend Down",
            message=f"Your calorie intake is {abs(wow_delta.calories):.0f}% lower than last week."
        ))
    elif wow_delta.direction_calories == "up" and wow_delta.calories > 15:
        insights.append(DailyInsight(
            type="warning",
            icon="📈",
            title="Calorie Trend Up",
            message=f"Calorie intake is {wow_delta.calories:.0f}% higher than last week. Stay mindful!"
        ))
    
    # Activity
    if streaks.workout_streak >= 3:
        insights.append(DailyInsight(
            type="success",
            icon="🏋️",
            title="Active Lifestyle",
            message=f"You've worked out {streaks.workout_streak} days in a row! Great dedication."
        ))
    
    return insights[:3]
