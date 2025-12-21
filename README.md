# FitLoop 🍎📸

> AI-powered food logging and nutrition analysis using Google Gemini

## Overview

FitLoop is a mobile app that uses computer vision and LLM-powered analysis to help users track their nutrition. Users photograph their meals, and Gemini AI handles:

- **Food Detection**: Identifies foods in images
- **Portion Estimation**: Estimates serving sizes in grams
- **Macro Calculation**: Computes calories, protein, carbs, fat, fiber
- **PID Recommendations**: Provides personalized nutritional guidance using Proportional-Integral-Derivative analysis

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Image Upload | Direct base64 | MVP simplicity, S3-ready abstraction |
| Portion Calibration | Heuristics + confidence | Zero friction, confirmation catches uncertainty |
| Confidence Thresholds | Balanced (0.80/0.75) | Good UX/accuracy balance |
| Gemini Calls | Two-call flow | Vision → Confirm → PID for accuracy |
| Retry Strategy | Hybrid | Retry network, repair JSON, manual fallback |
| Corrections | Store for training | Capture data, no automation yet |
| Image Processing | Smart compression | 20-30% cost savings |
| Confirmation UI | Hybrid quick-tap | Fast confirm, full edit when needed |
| PID Tuning | Moderate + Gemini severity | Gemini outputs 0-1 severity directly |
| Privacy Consent | Layered disclosure | GDPR-friendly, minimal friction |

## Project Structure

```
FitLoop/
├── README.md                    # This file
├── FUTURE_PLANS.md              # Roadmap and deferred enhancements
├── requirements.txt             # Python dependencies
│
├── docs/                        # Documentation
│   └── ARCHITECTURE.md          # Detailed MVP architecture document
│
├── prompts/                     # Gemini prompt templates
│   ├── vision_prompt.json       # Food detection prompt
│   └── pid_prompt.json          # PID analysis prompt
│
├── schemas/                     # JSON schemas (v1)
│   ├── food_detect_response_v1.json
│   └── kpi_pid_response_v1.json
│
├── backend/                     # FastAPI backend
│   ├── config.py               # Configuration and thresholds
│   ├── models.py               # Pydantic models
│   ├── image_processor.py      # Image compression/processing
│   ├── gemini_client.py        # Gemini API wrapper
│   ├── orchestrator.py         # Pipeline orchestration
│   └── main.py                 # FastAPI application
│
├── api/                         # API documentation
│   └── openapi.yaml            # OpenAPI 3.1 specification
│
├── frontend/                    # Frontend documentation
│   └── confirmation_flow.md    # UI flow and components
│
└── testing/                     # Test plan and data
    ├── test_plan.md            # Comprehensive test plan
    └── sample_datasets.json    # Sample test data
```

## Quick Start

### Prerequisites

- Python 3.11+
- Google Cloud project with Gemini API enabled
- Gemini API key

### Installation

```bash
# Clone the repository
cd FitLoop

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export GEMINI_API_KEY="your-api-key-here"
```

### Run the Server

```bash
cd backend
uvicorn main:app --reload --port 8000
```

### API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Architecture Documentation

For detailed architecture decisions, UX design, and technical specifications, see:
- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** - Complete MVP architecture document

## API Flow

### Standard Meal Logging (3 steps)

```
1. POST /api/v1/meals/analyze
   Body: { image_base64, meal_type, dietary_preferences, allergies }
   Returns: { meal_id, detection, next_step }

2. POST /api/v1/meals/{meal_id}/confirm
   Body: { items (confirmed/corrected) }
   Returns: { confirmed_items, meal_totals, next_step }

3. POST /api/v1/meals/{meal_id}/pid
   Body: { user_profile, daily_targets, todays_intake, weekly_summary, ... }
   Returns: { recommendations, daily_summary, next_meal_suggestions }
```

### Quick Log (auto-accepted meals)

```
POST /api/v1/meals/quick-log
Body: { request, pid_request }
Returns: Full results if all items auto-accepted, or requires_confirmation: true
```

## Configuration

Key environment variables in `backend/config.py`:

```bash
# Gemini API
GEMINI_API_KEY=your-key

# Confidence Thresholds (adjust via env vars)
FOOD_ID_AUTO_ACCEPT=0.80      # Auto-accept above this
FOOD_ID_CONFIRM_MIN=0.55      # Confirm between 0.55-0.79
PORTION_AUTO_ACCEPT=0.75      # Auto-accept above this
PORTION_CONFIRM_MIN=0.45      # Confirm between 0.45-0.74

# Image Processing
IMAGE_MAX_DIMENSION=1024      # Max image dimension (pixels)
IMAGE_JPEG_QUALITY=85         # JPEG compression quality
```

## Testing

```bash
# Run all tests
pytest testing/ -v

# Run with coverage
pytest testing/ --cov=backend --cov-report=html
```

See `testing/test_plan.md` for detailed test categories and requirements.

## Prompt Templates

### Vision Prompt (`prompts/vision_prompt.json`)
- Identifies foods in images
- Estimates portions using plate-size heuristics
- Calculates macros from USDA database
- Returns confidence scores for routing

### PID Prompt (`prompts/pid_prompt.json`)
- Analyzes daily/weekly intake vs targets
- Calculates severity scores (0-1) using PID principles
- Generates actionable recommendations
- Respects dietary preferences and health conditions

## Future Enhancements

See `FUTURE_PLANS.md` for detailed roadmap including:
- S3 image storage migration
- Correction-based learning and caching
- Reference object calibration
- Goal/condition-based PID intensity
- Adaptive confidence thresholds
- HITL review queue

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]

