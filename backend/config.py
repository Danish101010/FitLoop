"""
FitLoop Configuration
Version: 1.0.0 (MVP)
"""
import os

# Fix gRPC DNS resolution issue on macOS - must be set before importing google libraries
os.environ.setdefault("GRPC_DNS_RESOLVER", "native")

from typing import Literal

# =============================================================================
# GEMINI API CONFIGURATION
# =============================================================================
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Use gemini-1.5-flash for better vision capabilities and JSON output
GEMINI_MODEL_VISION = os.getenv("GEMINI_MODEL_VISION", "gemini-2.5-flash-lite")
GEMINI_MODEL_PID = os.getenv("GEMINI_MODEL_PID", "gemini-2.5-flash-lite")

# Generation parameters (deterministic for production)
GEMINI_VISION_CONFIG = {
    "temperature": 0.1,
    "top_p": 0.95,
    "top_k": 20,
    "max_output_tokens": 2048,
}

GEMINI_PID_CONFIG = {
    "temperature": 0.2,
    "top_p": 0.95,
    "top_k": 20,
    "max_output_tokens": 1024,
}

# =============================================================================
# CONFIDENCE THRESHOLDS (Decision 3: Balanced)
# =============================================================================
# Food identification thresholds
FOOD_ID_AUTO_ACCEPT = float(os.getenv("FOOD_ID_AUTO_ACCEPT", "0.80"))
FOOD_ID_CONFIRM_MIN = float(os.getenv("FOOD_ID_CONFIRM_MIN", "0.55"))
FOOD_ID_REJECT_BELOW = float(os.getenv("FOOD_ID_REJECT_BELOW", "0.55"))

# Portion estimation thresholds
PORTION_AUTO_ACCEPT = float(os.getenv("PORTION_AUTO_ACCEPT", "0.75"))
PORTION_CONFIRM_MIN = float(os.getenv("PORTION_CONFIRM_MIN", "0.45"))
PORTION_REJECT_BELOW = float(os.getenv("PORTION_REJECT_BELOW", "0.45"))

# =============================================================================
# IMAGE PROCESSING (Decision 7: Smart Compression)
# =============================================================================
IMAGE_MAX_DIMENSION = int(os.getenv("IMAGE_MAX_DIMENSION", "1024"))
IMAGE_JPEG_QUALITY = int(os.getenv("IMAGE_JPEG_QUALITY", "85"))
IMAGE_MAX_SIZE_BYTES = 4 * 1024 * 1024  # 4MB max

# =============================================================================
# RETRY CONFIGURATION (Decision 5: Hybrid)
# =============================================================================
MAX_NETWORK_RETRIES = int(os.getenv("MAX_NETWORK_RETRIES", "0"))
RETRY_BACKOFF_BASE = 1.0  # seconds
RETRY_BACKOFF_MAX = 8.0  # seconds
ENABLE_REPAIR_PROMPT = False  # Disable extra round-trips; rely on first response only

# =============================================================================
# PID CONFIGURATION (Decision 9: Moderate defaults)
# =============================================================================
PID_DEFAULT_INTENSITY: Literal["gentle", "moderate", "aggressive"] = "moderate"

# Severity thresholds for translation
SEVERITY_SLIGHT_MAX = 0.3
SEVERITY_MODERATE_MAX = 0.6
# Above 0.6 = significant

# =============================================================================
# DATABASE / STORAGE
# =============================================================================
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fitloop.db")
CORRECTIONS_COLLECTION = "meal_corrections"  # For future training data

# =============================================================================
# RATE LIMITING
# =============================================================================
RATE_LIMIT_MEALS_PER_HOUR = 20
RATE_LIMIT_PID_PER_HOUR = 30

