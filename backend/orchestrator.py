"""
FitLoop Orchestrator
Version: 1.0.0 (MVP)

Main orchestration logic for the food analysis pipeline.
Implements the two-call flow: Vision → Confirm → PID (Decision 4: Option B)
"""
import logging
from datetime import datetime, date
from typing import Optional
import secrets
from pydantic import ValidationError

from models import (
    FoodDetectResponse,
    KpiPidResponse,
    FoodItem,
    ConfirmationStatus,
    CorrectionLog,
    AnalyzeMealRequest,
    ConfirmMealRequest,
    PidAnalysisRequest,
)
from config import (
    FOOD_ID_AUTO_ACCEPT,
    FOOD_ID_CONFIRM_MIN,
    PORTION_AUTO_ACCEPT,
    PORTION_CONFIRM_MIN,
)
from image_processor import get_image_processor, decode_base64_image
from gemini_client import get_gemini_client, GeminiAPIError

logger = logging.getLogger(__name__)


# =============================================================================
# CONFIRMATION LOGIC (Decision 3: Balanced thresholds)
# =============================================================================
def determine_item_status(item: dict) -> tuple[ConfirmationStatus, list[str]]:
    """
    Determine confirmation status for a single food item.
    
    Returns:
        Tuple of (status, reasons)
    """
    reasons = []
    
    # Check food identification confidence
    id_confidence = item.get("identification", {}).get("confidence", 0)
    portion_confidence = item.get("portion", {}).get("confidence", 0)
    
    # Below minimum threshold → reject
    if id_confidence < FOOD_ID_CONFIRM_MIN:
        return ConfirmationStatus.REJECTED, ["Food identification confidence too low"]
    
    if portion_confidence < PORTION_CONFIRM_MIN:
        return ConfirmationStatus.REJECTED, ["Portion estimation confidence too low"]
    
    # Check for auto-accept
    if id_confidence >= FOOD_ID_AUTO_ACCEPT and portion_confidence >= PORTION_AUTO_ACCEPT:
        return ConfirmationStatus.AUTO_ACCEPTED, []
    
    # Otherwise needs confirmation
    if id_confidence < FOOD_ID_AUTO_ACCEPT:
        reasons.append(f"Food ID confidence {id_confidence:.0%} (threshold {FOOD_ID_AUTO_ACCEPT:.0%})")
    if portion_confidence < PORTION_AUTO_ACCEPT:
        reasons.append(f"Portion confidence {portion_confidence:.0%} (threshold {PORTION_AUTO_ACCEPT:.0%})")
    
    return ConfirmationStatus.PENDING_CONFIRMATION, reasons


def process_detection_response(response: dict) -> dict:
    """
    Process Gemini detection response and add confirmation metadata.
    
    Implements Decision 3: Balanced confidence thresholds
    """
    items = response.get("items", [])
    items_needing_confirmation = []
    all_auto_accepted = True
    any_rejected = False
    
    for item in items:
        status, reasons = determine_item_status(item)
        item["_confirmation_status"] = status.value
        item["_confirmation_reasons"] = reasons
        
        if status == ConfirmationStatus.PENDING_CONFIRMATION:
            items_needing_confirmation.append(item.get("item_id"))
            all_auto_accepted = False
        elif status == ConfirmationStatus.REJECTED:
            any_rejected = True
            all_auto_accepted = False
    
    # Update response metadata
    response["requires_confirmation"] = not all_auto_accepted
    response["items_needing_confirmation"] = items_needing_confirmation
    
    if items_needing_confirmation:
        response["confirmation_reason"] = (
            f"{len(items_needing_confirmation)} item(s) need confirmation due to confidence below threshold"
        )
    elif any_rejected:
        response["confirmation_reason"] = "Some items could not be identified with sufficient confidence"
    else:
        response["confirmation_reason"] = None
    
    return response


# =============================================================================
# CORRECTION LOGGING (Decision 6: Store for training)
# =============================================================================
async def log_correction(
    user_id: str,
    meal_id: str,
    original_response: dict,
    user_correction: list[dict],
    db_session,  # Database session - implementation depends on your DB choice
) -> CorrectionLog:
    """
    Log user corrections for future training data.
    
    Decision 6: Option C - Store corrections but don't use for automation yet.
    """
    # Determine correction type
    original_items = {item["item_id"]: item for item in original_response.get("items", [])}
    corrected_items = {item["item_id"]: item for item in user_correction}
    
    correction_types = set()
    
    for item_id, corrected in corrected_items.items():
        if item_id not in original_items:
            correction_types.add("added_item")
            continue
        
        original = original_items[item_id]
        
        if original.get("food_name") != corrected.get("food_name"):
            correction_types.add("food_name")
        
        orig_grams = original.get("portion", {}).get("grams", 0)
        corr_grams = corrected.get("portion", {}).get("grams", 0)
        if abs(orig_grams - corr_grams) > 10:  # >10g difference
            correction_types.add("portion")
    
    for item_id in original_items:
        if item_id not in corrected_items:
            correction_types.add("removed_item")
    
    # Determine primary correction type
    if "added_item" in correction_types or "removed_item" in correction_types:
        correction_type = "added_item" if "added_item" in correction_types else "removed_item"
    elif "food_name" in correction_types and "portion" in correction_types:
        correction_type = "both"
    elif "food_name" in correction_types:
        correction_type = "food_name"
    elif "portion" in correction_types:
        correction_type = "portion"
    else:
        correction_type = "both"  # Default
    
    correction_log = CorrectionLog(
        correction_id=f"corr_{secrets.token_hex(8)}",
        user_id=user_id,
        meal_id=meal_id,
        original_response=FoodDetectResponse(**original_response),
        user_correction=[FoodItem(**item) for item in user_correction],
        correction_type=correction_type,
        timestamp=datetime.utcnow(),
    )
    
    # Store to database (implementation depends on your DB)
    # await db_session.corrections.insert_one(correction_log.model_dump())
    
    logger.info(f"Logged correction {correction_log.correction_id} for meal {meal_id}: {correction_type}")
    
    return correction_log


# =============================================================================
# MAIN ORCHESTRATION
# =============================================================================
class MealAnalysisOrchestrator:
    """
    Orchestrates the meal analysis pipeline.
    
    Flow (Decision 4: Option B - Two calls):
    1. User uploads image
    2. Vision API detects foods
    3. Check confidence thresholds
    4. If needed, get user confirmation
    5. After confirmation, run PID analysis
    6. Return recommendations
    """
    
    def __init__(self):
        self.image_processor = get_image_processor()
        self.gemini_client = get_gemini_client()
    
    async def analyze_meal_image(
        self,
        request: AnalyzeMealRequest,
    ) -> dict:
        """
        Step 1: Analyze food image and return detection results.
        
        This is the first API call in the two-call flow.
        """
        meal_id = f"meal_{secrets.token_hex(8)}"
        
        try:
            # Decode and process image
            image_bytes = decode_base64_image(request.image_base64)
            image_data = await self.image_processor.prepare_for_gemini(image_bytes)
            
            # Call Gemini Vision API
            detection_result = await self.gemini_client.analyze_food_image(
                image_data=image_data,
                meal_type=request.meal_type.value,
                dietary_preferences=request.dietary_preferences,
                allergies=request.allergies,
            )
            
            # Process response and add confirmation metadata
            processed_result = process_detection_response(detection_result)
            
            # Add meal tracking metadata
            processed_result["meal_id"] = meal_id
            processed_result["image_hash"] = image_data["hash"]
            processed_result["meal_type"] = request.meal_type.value
            
            return {
                "success": True,
                "meal_id": meal_id,
                "detection": processed_result,
                "next_step": "confirm" if processed_result["requires_confirmation"] else "pid_analysis",
            }
            
        except GeminiAPIError as e:
            logger.error(f"Gemini API error in meal analysis: {e}")
            
            # Decision 5 Layer 3: Fallback to manual entry
            return {
                "success": False,
                "meal_id": meal_id,
                "error": "manual_entry_required",
                "message": "We couldn't analyze this image. Please type what you ate.",
                "details": str(e),
            }
        
        except ValueError as e:
            logger.error(f"Image processing error: {e}")
            return {
                "success": False,
                "meal_id": meal_id,
                "error": "invalid_image",
                "message": str(e),
            }
    
    async def confirm_meal(
        self,
        request: ConfirmMealRequest,
        original_detection: dict,
        user_id: str,
        db_session=None,
    ) -> dict:
        """
        Step 2: Process user confirmation/corrections.
        
        Stores corrections for training data (Decision 6).
        Returns confirmed meal data ready for PID analysis.
        """
        confirmed_items = self._normalize_confirmed_items(
            original_detection=original_detection,
            incoming_items=request.items,
        )

        # Check if user made corrections
        items_changed = self._detect_changes(
            original_detection.get("items", []),
            [item.model_dump() for item in confirmed_items]
        )
        
        if items_changed and db_session:
            await log_correction(
                user_id=user_id,
                meal_id=request.meal_id,
                original_response=original_detection,
                user_correction=[item.model_dump() for item in confirmed_items],
                db_session=db_session,
            )
        
        # Calculate final totals from confirmed items
        totals = self._calculate_totals(confirmed_items)
        
        return {
            "success": True,
            "meal_id": request.meal_id,
            "confirmed_items": [item.model_dump() for item in confirmed_items],
            "meal_totals": totals,
            "was_corrected": items_changed,
            "next_step": "pid_analysis",
        }
    
    async def run_pid_analysis(
        self,
        request: PidAnalysisRequest,
        confirmed_meal: dict,
    ) -> dict:
        """
        Step 3: Run PID analysis after meal confirmation.
        
        This is the second API call in the two-call flow.
        """
        try:
            pid_result = await self.gemini_client.analyze_pid(
                user_profile=request.user_profile.model_dump(),
                daily_targets=request.daily_targets.model_dump(),
                todays_intake=request.todays_intake.model_dump(),
                weekly_summary=request.weekly_summary.model_dump(),
                current_meal_type=request.current_meal_type.value,
                time_of_day=request.time_of_day,
                meals_remaining=request.meals_remaining,
            )
            
            return {
                "success": True,
                "analysis": pid_result,
            }
            
        except GeminiAPIError as e:
            logger.error(f"Gemini API error in PID analysis: {e}")
            
            # PID failure is non-critical - meal is already logged
            return {
                "success": False,
                "error": "pid_analysis_failed",
                "message": "Meal logged successfully, but we couldn't generate recommendations right now.",
                "details": str(e),
            }
    
    def _detect_changes(self, original: list[dict], confirmed: list[dict]) -> bool:
        """Detect if user made changes to the detection."""
        if len(original) != len(confirmed):
            return True
        
        for orig, conf in zip(original, confirmed):
            if orig.get("food_name") != conf.get("food_name"):
                return True
            if abs(orig.get("portion", {}).get("grams", 0) - conf.get("portion", {}).get("grams", 0)) > 5:
                return True
        
        return False
    
    def _calculate_totals(self, items: list[FoodItem]) -> dict:
        """Calculate nutrition totals from confirmed items."""
        totals = {
            "calories": 0,
            "protein_g": 0,
            "carbs_g": 0,
            "fat_g": 0,
            "fiber_g": 0,
        }
        
        for item in items:
            totals["calories"] += item.nutrition.calories
            totals["protein_g"] += item.nutrition.protein_g
            totals["carbs_g"] += item.nutrition.carbs_g
            totals["fat_g"] += item.nutrition.fat_g
            totals["fiber_g"] += item.nutrition.fiber_g or 0
        
        return totals

    def _normalize_confirmed_items(
        self,
        original_detection: dict,
        incoming_items: list[dict],
    ) -> list[FoodItem]:
        """Merge user-confirmed items with original detection and validate."""
        originals = {
            item.get("item_id"): item
            for item in original_detection.get("items", [])
            if isinstance(item, dict) and item.get("item_id")
        }

        normalized: list[FoodItem] = []
        errors: list[dict] = []

        for raw in incoming_items:
            item_id = raw.get("item_id") if isinstance(raw, dict) else None
            base = originals.get(item_id, {})

            merged = {**base, **(raw or {})}

            portion = merged.get("portion") or {}
            merged["portion"] = {
                "grams": portion.get("grams", base.get("portion", {}).get("grams", 100)) or 100,
                "household_measure": portion.get(
                    "household_measure",
                    base.get("portion", {}).get("household_measure", "1 serving"),
                ) or "1 serving",
                "confidence": portion.get(
                    "confidence",
                    base.get("portion", {}).get("confidence", 0.5),
                ) or 0.5,
            }

            identification = merged.get("identification") or {}
            raw_alternatives = identification.get(
                "alternatives",
                base.get("identification", {}).get("alternatives", []),
            ) or []
            
            # Normalize alternatives - can be strings or dicts
            normalized_alternatives = []
            for alt in raw_alternatives:
                if isinstance(alt, str):
                    normalized_alternatives.append({"name": alt, "confidence": 0.5})
                elif isinstance(alt, dict):
                    normalized_alternatives.append({
                        "name": alt.get("name", str(alt)),
                        "confidence": alt.get("confidence", 0.5)
                    })
            
            merged["identification"] = {
                "confidence": identification.get(
                    "confidence",
                    base.get("identification", {}).get("confidence", 0.5),
                ) or 0.5,
                "alternatives": normalized_alternatives,
            }

            if not merged.get("item_id"):
                merged["item_id"] = f"item_{len(normalized) + 1:03d}"

            merged.setdefault("food_category", base.get("food_category", "other"))
            merged.setdefault("nutrition", base.get("nutrition"))
            merged.setdefault("preparation_method", base.get("preparation_method", "unknown"))
            merged.setdefault("flags", base.get("flags", []))

            if merged.get("nutrition") is None:
                merged["nutrition"] = {
                    "calories": 0,
                    "protein_g": 0,
                    "carbs_g": 0,
                    "fat_g": 0,
                    "fiber_g": 0,
                    "sodium_mg": 0,
                    "sugar_g": 0,
                }

            try:
                normalized.append(FoodItem.model_validate(merged))
            except ValidationError as e:
                logger.warning(f"Validation error for item {item_id}: {e.errors()}. Merged data: {merged}")
                # Try to fix common issues and retry
                # Fix item_id format if needed
                if not merged["item_id"].startswith("item_") or not merged["item_id"][5:].isdigit():
                    merged["item_id"] = f"item_{len(normalized) + 1:03d}"
                # Ensure food_name exists
                if not merged.get("food_name"):
                    merged["food_name"] = "Unknown Food"
                try:
                    normalized.append(FoodItem.model_validate(merged))
                except ValidationError as e2:
                    errors.append({"item_id": item_id or "unknown", "errors": e2.errors()})

        if errors:
            logger.error(f"Invalid confirmed items after fix attempts: {errors}")
            raise ValueError(f"Invalid confirmed items: {errors}")

        return normalized


# Singleton instance
_orchestrator: MealAnalysisOrchestrator | None = None


def get_orchestrator() -> MealAnalysisOrchestrator:
    """Get or create the orchestrator singleton."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = MealAnalysisOrchestrator()
    return _orchestrator

