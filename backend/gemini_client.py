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
VISION_SYSTEM_PROMPT = """You are a professional nutrition AI that analyzes food images.

TASKS:
1. Identify ALL distinct food items in the image
2. Estimate portion sizes in grams (plate ~25cm, bowl 300-500ml, palm ~85g meat, fist ~150g grain)
3. Calculate COMPLETE nutrition for each item: calories, protein_g, carbs_g, fat_g, fiber_g
4. Provide confidence scores (0.0-1.0) for identification and portion

RULES (STRICT):
- Return ONLY a valid JSON object, no markdown, no code fences, no explanations
- MUST include ALL nutrition fields for each item: calories, protein_g, carbs_g, fat_g, fiber_g
- Use USDA database values for nutrition calculations
- Round grams to nearest 5, calories to nearest 5
- If unsure, provide conservative estimates
"""

PID_SYSTEM_PROMPT = """You are a concise nutrition coach using PID principles.
- Proportional: respond to today's gaps/surpluses
- Integral: consider the past 7 days
- Derivative: note trends/rate of change

Tasks:
1) Analyze status vs targets
2) Score severity 0.0-1.0 per concern
3) Give actionable, supportive recommendations
4) Prioritize by impact (max 5)
5) Suggest concrete foods that fit preferences

Rules (non-negotiable):
- Respond with exactly one JSON object, no prose, no markdown, no code fences.
- The JSON must conform to KpiPidResponse keys provided in the schema hint.
- Severity bands: 0.0-0.3 gentle, 0.3-0.6 clear, 0.6-1.0 important.
- Respect preferences/allergies/health conditions.
- Tailor to meal timing.
- Keep tone encouraging; focus on adding helpful foods.
"""

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
        )
        
        self.pid_model = genai.GenerativeModel(
            model_name=GEMINI_MODEL_PID,
            generation_config=genai.GenerationConfig(**GEMINI_PID_CONFIG),
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
            except google_exceptions.ResourceExhausted as e:
                # Quota exceeded: do not retry, surface immediately
                logger.error(f"Gemini quota exceeded: {e}")
                raise GeminiAPIError(
                    f"Quota exceeded: {str(e)}",
                    retryable=False,
                    original_error=e,
                )
            except (
                google_exceptions.ServiceUnavailable,
                google_exceptions.DeadlineExceeded,
                google_exceptions.InternalServerError,
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
        # Log raw response for debugging
        logger.info(f"Raw Gemini response (first 500 chars): {response_text[:500]}")
        
        # Clean up response text
        text = response_text.strip()
        
        # Remove markdown code fences if present (various formats)
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```JSON"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        
        text = text.strip()

        # First attempt: direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Fallback: extract first JSON object
            extracted = self._extract_first_json_object(text)
            if extracted:
                try:
                    return json.loads(extracted)
                except json.JSONDecodeError as e:
                    logger.error(f"JSON parse error after extraction: {e}. Text: {extracted[:200]}")
                    raise GeminiAPIError(
                        f"Invalid JSON response after extraction: {str(e)}",
                        retryable=True,
                        original_error=e
                    )

            logger.error(f"No JSON object found in response: {text[:300]}")
            raise GeminiAPIError(
                "Invalid JSON response: unable to extract JSON object",
                retryable=True,
                original_error=ValueError("no_json_object_found"),
            )

    @staticmethod
    def _extract_first_json_object(text: str) -> str | None:
        """Extract the first JSON object from a string using brace matching."""
        start = text.find("{")
        if start == -1:
            return None
        depth = 0
        in_string = False
        escape = False
        for i in range(start, len(text)):
            ch = text[i]
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == '"':
                in_string = not in_string
            if in_string:
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return text[start : i + 1]
        return None
    
    async def _call_with_repair(
        self,
        model: genai.GenerativeModel,
        prompt: str | list,
        expected_schema: str,
    ) -> dict:
        """
        Call Gemini and parse JSON. No repair retries to keep call count minimal.
        """
        # First attempt
        async def make_call():
            response = await model.generate_content_async(prompt)
            return response.text
        
        try:
            response_text = await self._retry_with_backoff(make_call)
            return self._parse_json_response(response_text)
        except GeminiAPIError as e:
            # Surface parsing failures immediately without extra calls
            raise
    
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
        # Build user prompt - simpler, clearer format
        user_prompt = f"""{VISION_SYSTEM_PROMPT}

Analyze this {meal_type} meal image.
User dietary preferences: {dietary_preferences}
User allergies: {allergies}

For each food item found, provide:
- item_id (format: item_001, item_002, etc.)
- food_name (specific name like "Grilled Chicken Breast")
- food_category (one of: protein, carbohydrate, vegetable, fruit, dairy, fat, beverage, condiment, mixed_dish, snack, dessert, other)
- portion.grams (estimated weight)
- portion.household_measure (like "1 cup" or "1 medium piece")
- portion.confidence (0.0 to 1.0)
- identification.confidence (0.0 to 1.0)
- identification.alternatives (array, empty if confident)
- nutrition.calories (number)
- nutrition.protein_g (number)
- nutrition.carbs_g (number)
- nutrition.fat_g (number)
- nutrition.fiber_g (number)

Also include meal_totals with sum of all items.

Return ONLY the JSON object, starting with {{ and ending with }}. No explanations, no markdown."""

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
        
        # Handle case where Gemini returns a list directly instead of an object
        if isinstance(result, list):
            logger.info("Gemini returned a list, wrapping in object")
            result = {"items": result}
        
        # Normalize response - Gemini sometimes uses different key names
        # Handle "food_items" vs "items"
        if "food_items" in result and "items" not in result:
            result["items"] = result.pop("food_items")
        
        # Ensure items is a list
        if "items" not in result:
            result["items"] = []
        
        # Calculate meal_totals if not present
        if "meal_totals" not in result or not result["meal_totals"]:
            totals = {"calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0}
            for item in result.get("items", []):
                nutrition = item.get("nutrition", {})
                totals["calories"] += nutrition.get("calories", 0) or 0
                totals["protein_g"] += nutrition.get("protein_g", 0) or 0
                totals["carbs_g"] += nutrition.get("carbs_g", 0) or 0
                totals["fat_g"] += nutrition.get("fat_g", 0) or 0
                totals["fiber_g"] += nutrition.get("fiber_g", 0) or 0
            result["meal_totals"] = totals
        
        # Set status if not present
        if "status" not in result:
            result["status"] = "success" if result["items"] else "no_food_detected"
        
        # Add request metadata if not present
        if "request_id" not in result:
            result["request_id"] = f"req_{image_data['hash'][:8]}"
        if "timestamp" not in result:
            result["timestamp"] = datetime.utcnow().isoformat() + "Z"
        
        logger.info(f"Normalized result: {len(result.get('items', []))} items detected")
        
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
        user_prompt = f"""{PID_SYSTEM_PROMPT}

    Analyze the user's nutritional intake and provide personalized PID-based recommendations.

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

