"""
FitLoop Gemini API Client
Version: 1.0.0 (MVP)

Handles all communication with Google Gemini API.
Implements retry logic and repair prompts per Decision 5.
"""
import json
import asyncio
import logging
from typing import Any
from datetime import datetime
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions

from config import (
    GEMINI_API_KEY,
    GEMINI_MODEL_VISION,
    GEMINI_MODEL_PID,
    GEMINI_VISION_CONFIG,
    GEMINI_PID_CONFIG,
    MAX_NETWORK_RETRIES,
    RETRY_BACKOFF_BASE,
    RETRY_BACKOFF_MAX,
    ENABLE_REPAIR_PROMPT,
)
from image_processor import ImageData

logger = logging.getLogger(__name__)


# =============================================================================
# PROMPT TEMPLATES
# =============================================================================
VISION_SYSTEM_PROMPT = """You are a professional nutritionist AI assistant specializing in food identification and portion estimation from photographs. Your role is to:

1. IDENTIFY all distinct food items visible in the image
2. ESTIMATE portion sizes in grams using visual cues (plate size ~25cm standard, utensils, hands as reference)
3. CALCULATE macronutrients and calories for each item based on USDA/standard nutritional databases
4. PROVIDE confidence scores (0.0-1.0) for both identification and portion estimation
5. SUGGEST alternative interpretations when confidence is below 0.8

RULES:
- Always return valid JSON matching the specified schema
- Use conservative portion estimates when uncertain (prefer underestimate)
- Flag items that are partially obscured or ambiguous
- Consider cooking methods visible in the image (fried, grilled, raw, etc.)
- Account for sauces, dressings, and toppings as separate items when significant
- Round grams to nearest 5g, calories to nearest 5 kcal
- If no food is detected, return empty items array with appropriate message

PORTION ESTIMATION HEURISTICS:
- Standard dinner plate: 25-27cm diameter
- Salad/side plate: 18-20cm diameter
- Bowl: 300-500ml typical
- Palm of hand: ~85g cooked meat
- Fist: ~1 cup or 150g cooked rice/pasta
- Thumb tip: ~1 tbsp or 15g
- Smartphone for scale: ~15cm length"""

PID_SYSTEM_PROMPT = """You are a professional nutritionist AI providing personalized dietary guidance using PID (Proportional-Integral-Derivative) analysis principles:

**P (Proportional):** React to TODAY's nutritional gaps or surpluses
**I (Integral):** Consider ACCUMULATED patterns over the past 7 days
**D (Derivative):** Note TRENDS and rate of change in intake

Your role is to:
1. ANALYZE the user's current nutritional status against their targets
2. CALCULATE severity scores (0.0-1.0) for each nutritional concern
3. GENERATE actionable, supportive recommendations
4. PRIORITIZE suggestions by impact and urgency
5. SUGGEST specific foods that would help address deficiencies

RULES:
- Always return valid JSON matching the KpiPidResponse schema
- Be supportive and non-judgmental in language
- Severity 0.0-0.3: gentle suggestion, 0.3-0.6: clear recommendation, 0.6-1.0: important action
- Consider the user's dietary preferences and restrictions
- Account for health conditions when flagged (increase severity for relevant nutrients)
- Maximum 5 recommendations per response, prioritized by severity
- Provide specific, actionable food suggestions (not generic advice)
- Consider meal timing (if this is breakfast, don't suggest dinner-heavy foods)

SEVERITY CALCULATION:
- < 10% deviation from target: severity 0.1-0.2
- 10-20% deviation: severity 0.2-0.4
- 20-35% deviation: severity 0.4-0.6
- 35-50% deviation: severity 0.6-0.8
- > 50% deviation: severity 0.8-1.0
- Health conditions related to nutrient: multiply severity by 1.3
- Strict goals flagged: multiply severity by 1.2

TONE:
- Moderate intensity (default): supportive coach
- Be encouraging, focus on "adding good" rather than "avoiding bad"
- Use phrases like "Consider adding..." "Great opportunity to..." "You might enjoy...\""""

REPAIR_PROMPT_TEMPLATE = """Your previous response was not valid JSON or did not match the expected schema.

ORIGINAL RESPONSE (truncated):
{original_response}

ERROR:
{error_message}

Please return ONLY valid JSON matching the expected schema. No explanations, no markdown, just the JSON object."""


class GeminiAPIError(Exception):
    """Custom exception for Gemini API errors."""
    def __init__(self, message: str, retryable: bool = False, original_error: Exception = None):
        super().__init__(message)
        self.retryable = retryable
        self.original_error = original_error


class GeminiClient:
    """
    Client for Google Gemini API with retry logic and repair prompts.
    
    Implements Decision 5: Hybrid retry strategy
    - Layer 1: Retry network errors with exponential backoff
    - Layer 2: Repair prompt for parse errors
    - Layer 3: Fallback to manual entry
    """
    
    def __init__(self):
        if not GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        
        genai.configure(api_key=GEMINI_API_KEY)
        
        # Initialize models
        self.vision_model = genai.GenerativeModel(
            model_name=GEMINI_MODEL_VISION,
            generation_config=genai.GenerationConfig(**GEMINI_VISION_CONFIG),
            system_instruction=VISION_SYSTEM_PROMPT,
        )
        
        self.pid_model = genai.GenerativeModel(
            model_name=GEMINI_MODEL_PID,
            generation_config=genai.GenerationConfig(**GEMINI_PID_CONFIG),
            system_instruction=PID_SYSTEM_PROMPT,
        )
    
    async def _retry_with_backoff(
        self,
        coro_func,
        *args,
        max_retries: int = MAX_NETWORK_RETRIES,
        **kwargs
    ) -> Any:
        """
        Execute coroutine with exponential backoff retry on network errors.
        
        Layer 1 of Decision 5: Retry network errors
        """
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                return await coro_func(*args, **kwargs)
            except (
                google_exceptions.ServiceUnavailable,
                google_exceptions.DeadlineExceeded,
                google_exceptions.ResourceExhausted,
                ConnectionError,
                TimeoutError,
            ) as e:
                last_error = e
                if attempt < max_retries:
                    backoff = min(
                        RETRY_BACKOFF_BASE * (2 ** attempt),
                        RETRY_BACKOFF_MAX
                    )
                    logger.warning(
                        f"Gemini API error (attempt {attempt + 1}/{max_retries + 1}): {e}. "
                        f"Retrying in {backoff}s..."
                    )
                    await asyncio.sleep(backoff)
                else:
                    logger.error(f"Gemini API failed after {max_retries + 1} attempts: {e}")
                    raise GeminiAPIError(
                        f"Network error after {max_retries + 1} attempts: {str(e)}",
                        retryable=False,
                        original_error=e
                    )
        
        raise GeminiAPIError(
            f"Unexpected retry loop exit: {last_error}",
            retryable=False,
            original_error=last_error
        )
    
    def _parse_json_response(self, response_text: str) -> dict:
        """
        Parse JSON from Gemini response, handling common issues.
        """
        # Clean up response text
        text = response_text.strip()
        
        # Remove markdown code fences if present
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        
        text = text.strip()
        
        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            raise GeminiAPIError(
                f"Invalid JSON response: {str(e)}",
                retryable=True,  # Can try repair prompt
                original_error=e
            )
    
    async def _call_with_repair(
        self,
        model: genai.GenerativeModel,
        prompt: str | list,
        expected_schema: str,
    ) -> dict:
        """
        Call Gemini and attempt repair prompt if JSON parsing fails.
        
        Layer 2 of Decision 5: Repair prompt for parse errors
        """
        # First attempt
        async def make_call():
            response = await model.generate_content_async(prompt)
            return response.text
        
        try:
            response_text = await self._retry_with_backoff(make_call)
            return self._parse_json_response(response_text)
        except GeminiAPIError as e:
            if not e.retryable or not ENABLE_REPAIR_PROMPT:
                raise
            
            # Attempt repair prompt
            logger.info("Attempting repair prompt for malformed JSON...")
            
            repair_prompt = REPAIR_PROMPT_TEMPLATE.format(
                original_response=response_text[:500] if 'response_text' in dir() else "N/A",
                error_message=str(e.original_error),
            ) + f"\n\nExpected schema:\n{expected_schema}"
            
            try:
                repair_response = await self._retry_with_backoff(
                    lambda: model.generate_content_async(repair_prompt)
                )
                return self._parse_json_response(repair_response.text)
            except GeminiAPIError:
                # Repair failed, re-raise original error
                logger.error("Repair prompt failed, manual entry required")
                raise GeminiAPIError(
                    "JSON parsing failed even after repair attempt",
                    retryable=False,
                    original_error=e.original_error
                )
    
    async def analyze_food_image(
        self,
        image_data: ImageData,
        meal_type: str,
        dietary_preferences: str = "no specific restrictions",
        allergies: str = "none",
    ) -> dict:
        """
        Analyze a food image and return detected items with nutrition.
        
        Args:
            image_data: Processed image data from ImageProcessor
            meal_type: Type of meal (breakfast, lunch, dinner, snack)
            dietary_preferences: User's dietary preferences
            allergies: User's known allergies
        
        Returns:
            FoodDetectResponse as dict
        """
        # Build user prompt
        user_prompt = f"""Analyze this food image and identify all food items with their estimated portions and nutritional content.

**User Context:**
- Meal type: {meal_type}
- User's dietary preferences: {dietary_preferences}
- Any known allergies: {allergies}

**Instructions:**
1. List each distinct food item you can identify
2. Estimate the portion size in grams
3. Calculate macros (protein, carbs, fat, fiber) and calories
4. Provide confidence scores for identification and portion
5. If confidence < 0.8, provide 2-3 alternative suggestions

Return ONLY valid JSON matching the FoodDetectResponse schema."""

        # Build content with image
        if image_data["type"] == "base64":
            content = [
                {
                    "mime_type": image_data["mime_type"],
                    "data": image_data["data"],
                },
                user_prompt,
            ]
        else:
            # URL-based (future S3 implementation)
            content = [
                {"url": image_data["url"]},
                user_prompt,
            ]
        
        # Expected schema for repair prompt
        expected_schema = """{
  "request_id": "req_xxx",
  "timestamp": "ISO8601",
  "status": "success|partial|no_food_detected|error",
  "items": [{"item_id": "item_001", "food_name": "...", "portion": {"grams": N, "confidence": 0-1}, ...}],
  "meal_totals": {"calories": N, "protein_g": N, "carbs_g": N, "fat_g": N},
  "requires_confirmation": true|false
}"""
        
        result = await self._call_with_repair(
            self.vision_model,
            content,
            expected_schema,
        )
        
        # Add request metadata if not present
        if "request_id" not in result:
            result["request_id"] = f"req_{image_data['hash'][:8]}"
        if "timestamp" not in result:
            result["timestamp"] = datetime.utcnow().isoformat() + "Z"
        
        return result
    
    async def analyze_pid(
        self,
        user_profile: dict,
        daily_targets: dict,
        todays_intake: dict,
        weekly_summary: dict,
        current_meal_type: str,
        time_of_day: str,
        meals_remaining: int,
    ) -> dict:
        """
        Perform PID analysis and return nutritional recommendations.
        
        Args:
            user_profile: User's profile including age, sex, weight, goals
            daily_targets: Daily nutritional targets
            todays_intake: Today's intake so far
            weekly_summary: Past 7 days summary
            current_meal_type: Type of meal just logged
            time_of_day: Current time (HH:MM)
            meals_remaining: Estimated meals remaining today
        
        Returns:
            KpiPidResponse as dict
        """
        user_prompt = f"""Analyze the user's nutritional intake and provide personalized PID-based recommendations.

**User Profile:**
- Age: {user_profile.get('age')}
- Sex: {user_profile.get('sex')}
- Weight: {user_profile.get('weight_kg')} kg
- Height: {user_profile.get('height_cm')} cm
- Activity level: {user_profile.get('activity_level')}
- Primary goal: {user_profile.get('primary_goal')}
- Goal intensity: {user_profile.get('goal_intensity', 'moderate')}
- Dietary preferences: {user_profile.get('dietary_preferences', 'none')}
- Health conditions: {user_profile.get('health_conditions', [])}
- Allergies: {user_profile.get('allergies', [])}

**Daily Targets:**
{json.dumps(daily_targets, indent=2)}

**Today's Intake (so far):**
{json.dumps(todays_intake, indent=2)}

**Past 7 Days Summary:**
{json.dumps(weekly_summary, indent=2)}

**Current Meal Context:**
- Meal just logged: {current_meal_type}
- Time of day: {time_of_day}
- Meals remaining today (estimated): {meals_remaining}

**Instructions:**
1. Calculate current status vs targets for key nutrients
2. Identify the top nutritional priorities (max 5)
3. For each, calculate severity (0.0-1.0) using PID principles
4. Provide specific, actionable recommendations
5. Suggest concrete foods that fit the user's preferences

Return ONLY valid JSON matching the KpiPidResponse schema."""

        expected_schema = """{
  "request_id": "pid_xxx",
  "timestamp": "ISO8601",
  "status": "success",
  "current_status": {"protein_g": {"target": N, "consumed": N, "remaining": N, "percent_complete": N}, ...},
  "recommendations": [{"priority": 1, "nutrient": "protein", "severity": 0-1, "suggestion": "...", ...}],
  "daily_summary": {"overall_score": 0-1, "headline": "...", "encouragement": "..."},
  "next_meal_suggestions": [{"meal_name": "...", "estimated_nutrition": {...}, "why": "..."}]
}"""
        
        result = await self._call_with_repair(
            self.pid_model,
            user_prompt,
            expected_schema,
        )
        
        # Add request metadata if not present
        if "request_id" not in result:
            import secrets
            result["request_id"] = f"pid_{secrets.token_hex(4)}"
        if "timestamp" not in result:
            result["timestamp"] = datetime.utcnow().isoformat() + "Z"
        
        return result


# Singleton instance
_client: GeminiClient | None = None


def get_gemini_client() -> GeminiClient:
    """Get or create the Gemini client singleton."""
    global _client
    if _client is None:
        _client = GeminiClient()
    return _client

