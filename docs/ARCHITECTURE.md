# FitLoop MVP Architecture Document

> Version: 1.0.0  
> Last Updated: December 2024  
> Status: Production-Ready MVP

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Design Decisions](#3-design-decisions)
4. [Technical Architecture](#4-technical-architecture)
5. [API Design](#5-api-design)
6. [Data Models](#6-data-models)
7. [Gemini Integration](#7-gemini-integration)
8. [UX/UI Design](#8-uxui-design)
9. [Error Handling & Resilience](#9-error-handling--resilience)
10. [Privacy & Security](#10-privacy--security)
11. [Cost & Performance](#11-cost--performance)
12. [Configuration Reference](#12-configuration-reference)
13. [Glossary](#13-glossary)

---

## 1. Executive Summary

### 1.1 Product Vision

FitLoop is an AI-powered mobile application that enables users to track their nutrition by photographing meals. The app uses Google Gemini's vision and language capabilities to:

- Identify foods from photographs
- Estimate portion sizes and calculate nutritional values
- Provide personalized dietary recommendations using PID (Proportional-Integral-Derivative) analysis

### 1.2 MVP Scope

The MVP focuses on core functionality with production-safe defaults:

| Feature | MVP Scope | Future Scope |
|---------|-----------|--------------|
| Food Detection | Single image → multiple foods | Multi-image, video |
| Portion Estimation | Heuristic-based (plate size) | Reference object calibration |
| Recommendations | Per-meal + daily PID analysis | Real-time hints, meal planning |
| User Corrections | Stored for training | Used for personalization |
| Offline Mode | Not supported | Local model fallback |

### 1.3 Key Metrics

| Metric | MVP Target |
|--------|------------|
| Food ID Accuracy | ≥75% |
| Portion Accuracy | ±40% |
| API Latency (p95) | <7s |
| Error Rate | <5% |
| Auto-Accept Rate | ~60-70% |

---

## 2. System Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MOBILE APP                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Camera     │  │ Confirmation │  │    PID       │  │   Profile   │ │
│  │   Capture    │  │   Modal      │  │   Display    │  │   Manager   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS/REST
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │    Image     │  │    Gemini    │  │  Orchestr-   │  │   Storage   │ │
│  │  Processor   │  │    Client    │  │    ator      │  │   Layer     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      GOOGLE GEMINI API                                   │
│  ┌──────────────────────────┐  ┌────────────────────────────────────┐  │
│  │   gemini-1.5-flash       │  │   gemini-1.5-flash                 │  │
│  │   (Vision Analysis)      │  │   (PID Recommendations)            │  │
│  └──────────────────────────┘  └────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
┌────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│  User  │────▶│   Capture  │────▶│  Compress  │────▶│  Analyze   │
│        │     │   Photo    │     │   Image    │     │  (Gemini)  │
└────────┘     └────────────┘     └────────────┘     └────────────┘
                                                            │
                                                            ▼
┌────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│  View  │◀────│    PID     │◀────│  Confirm   │◀────│   Route    │
│  Tips  │     │  Analysis  │     │   Items    │     │ by Confid. │
└────────┘     └────────────┘     └────────────┘     └────────────┘
```

### 2.3 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Image Processor** | Compress, resize, fix orientation, encode base64 |
| **Gemini Client** | API communication, retry logic, JSON repair |
| **Orchestrator** | Pipeline coordination, confidence routing, correction logging |
| **Storage Layer** | Meal data, user profiles, correction logs (MVP: in-memory) |

---

## 3. Design Decisions

### 3.1 Decision Summary Table

| # | Decision | Choice | Rationale |
|---|----------|--------|-----------|
| 1 | Image Upload | Direct base64 | MVP simplicity, S3-ready abstraction |
| 2 | Portion Calibration | Heuristics + confidence gates | Zero friction, confirmation catches uncertainty |
| 3 | Confidence Thresholds | Balanced (0.80/0.75) | Good UX/accuracy balance |
| 4 | Gemini Call Pattern | Two calls (Vision → PID) | Separation of concerns, confirmed data for PID |
| 5 | Retry Strategy | Hybrid (retry + repair + fallback) | Graceful degradation |
| 6 | Correction Storage | Store for training only | Capture data without automation complexity |
| 7 | Image Cost Strategy | Smart compression | 20-30% cost savings, consistent quality |
| 8 | Confirmation UI | Hybrid quick-tap + expand | Fast for correct, detailed for edits |
| 9 | PID Tuning | Moderate + Gemini severity | Gemini calculates severity contextually |
| 10 | Privacy Consent | Layered disclosure | GDPR-friendly, minimal friction |

### 3.2 Detailed Decision Records

#### Decision 1: Image Upload Strategy

**Context:** How should food images be transmitted to Gemini for analysis?

**Options Considered:**
- A) Direct base64 encoding
- B) Upload to S3, send signed URL
- C) Thumbnail first, escalate for ambiguous cases

**Decision:** Option A with abstraction for future B migration

**Rationale:**
- Simplest architecture for MVP
- No infrastructure overhead (S3 buckets, IAM roles)
- Abstracted via `ImageProcessor` protocol for easy migration

**Trade-offs:**
- No image persistence for audit/retraining (acceptable for MVP)
- ~33% larger payloads due to base64 encoding

**Migration Path:**
```python
class ImageProcessor(Protocol):
    async def prepare_for_gemini(self, image_bytes: bytes) -> ImageData:
        ...

# MVP: Base64Processor
# v1.1: S3Processor (swap without changing calling code)
```

---

#### Decision 2: Portion Calibration Method

**Context:** How should we establish real-world scale for portion estimation?

**Options Considered:**
- A) Reference object (card/coin/finger) in first capture
- B) Plate-size heuristic default
- C) Optional user calibration flow later
- D) Hybrid heuristic + contextual prompts

**Decision:** Option B with confidence-gated user confirmation

**Rationale:**
- Zero onboarding friction (critical for MVP retention)
- Gemini's plate detection is reasonably accurate (~25-35% error)
- Confidence thresholds catch uncertain estimates

**Implementation:**
```python
# Gemini system prompt includes heuristics:
# - Standard dinner plate: 25-27cm diameter
# - Bowl: 300-500ml typical
# - Palm of hand: ~85g cooked meat
# - Fist: ~1 cup or 150g cooked rice
```

**Accuracy Expectation:** ±25-35% for standard plating

---

#### Decision 3: Confidence Thresholds

**Context:** What thresholds should govern auto-accept, confirmation, and rejection?

**Options Considered:**
- A) Conservative (0.90/0.85) — high accuracy, high friction
- B) Balanced (0.80/0.75) — moderate both
- C) Aggressive (0.65/0.60) — low friction, higher error rate
- D) Adaptive per-user thresholds

**Decision:** Option B (Balanced)

**Threshold Matrix:**

| Tier | Food ID | Portion | Behavior |
|------|---------|---------|----------|
| Auto-accept | ≥ 0.80 | ≥ 0.75 | Log silently |
| Confirm | 0.55-0.79 | 0.45-0.74 | Show confirmation modal |
| Reject | < 0.55 | < 0.45 | Ask to retake or manual entry |

**Expected Distribution:**
- ~60-70% auto-accepted
- ~25-35% need confirmation
- ~5-10% rejected/manual

**Configuration:**
```python
# Environment-configurable for hot-tuning
FOOD_ID_AUTO_ACCEPT = float(os.getenv("FOOD_ID_AUTO_ACCEPT", "0.80"))
FOOD_ID_CONFIRM_MIN = float(os.getenv("FOOD_ID_CONFIRM_MIN", "0.55"))
PORTION_AUTO_ACCEPT = float(os.getenv("PORTION_AUTO_ACCEPT", "0.75"))
PORTION_CONFIRM_MIN = float(os.getenv("PORTION_CONFIRM_MIN", "0.45"))
```

---

#### Decision 4: Gemini Call Granularity

**Context:** How should we structure Gemini API calls?

**Options Considered:**
- A) Single combined call (image → items → PID)
- B) Two calls: Vision first, then PID after confirmation
- C) Vision per-meal, PID aggregated end-of-day
- D) Hybrid with lightweight per-meal hints

**Decision:** Option B (Two calls)

**Rationale:**
- Separation of concerns (easier debugging)
- PID runs on *confirmed* data (more accurate recommendations)
- Can skip PID if user just wants quick logging
- PID can run asynchronously after confirmation

**Flow:**
```
[Photo] ──► [Gemini Vision] ──► [User Confirms] ──► [Gemini PID] ──► [Show Tips]
                                      │
                                      └──► [Store Corrections if any]
```

**Latency:**
- Vision: ~2-3s
- PID: ~1.5-2s (runs async after confirmation)
- Total perceived: ~2-3s (PID loads while user reviews)

---

#### Decision 5: Retry & Error Handling Strategy

**Context:** How should we handle Gemini API failures and malformed responses?

**Options Considered:**
- A) Auto-retry N times with backoff
- B) Repair-prompt once for parse errors
- C) Route to HITL queue
- D) Hybrid layered approach

**Decision:** Option D (Hybrid with manual entry fallback)

**Three-Layer Strategy:**

```
Layer 1: Retry Network Errors
├── 5xx, timeout, rate limit
├── Up to 2 retries
└── Exponential backoff (1s, 2s, 4s)

Layer 2: Repair Parse Errors
├── Invalid JSON or schema violation
├── Send repair prompt once
└── "Your previous response was not valid JSON..."

Layer 3: Fallback to Manual Entry
├── All retries exhausted
├── Repair prompt failed
└── Return: "Please type what you ate"
```

**Implementation:**
```python
async def analyze_with_fallback(image):
    try:
        response = await retry_with_backoff(gemini_vision, image)
        return parse_or_repair(response)
    except GeminiAPIError:
        return {
            "status": "manual_entry_required",
            "message": "We couldn't analyze this image. Please type what you ate."
        }
```

---

#### Decision 6: Correction Storage & Learning

**Context:** Should we store user corrections to improve future accuracy?

**Options Considered:**
- A) Store + build alias DB for automation
- B) Do not store corrections
- C) Store for training data only, no automation
- D) Store + simple text alias (no image matching)

**Decision:** Option C (Store for training, no automation)

**Rationale:**
- Captures valuable training data
- Avoids complexity of similarity matching
- No risk of propagating cached errors
- Can upgrade to automation in v1.1 with enough data

**Data Captured:**
```python
CorrectionLog = {
    "correction_id": "corr_xxx",
    "user_id": "user_123",
    "meal_id": "meal_abc",
    "original_response": {...},  # Full Gemini response
    "user_correction": [...],    # Corrected items
    "correction_type": "food_name" | "portion" | "both" | "added_item" | "removed_item",
    "timestamp": "2024-12-11T12:00:00Z"
}
```

---

#### Decision 7: Image Cost Strategy

**Context:** How should we optimize image resolution for cost vs. accuracy?

**Options Considered:**
- A) Always send full resolution
- B) Thumbnails, escalate for low confidence
- C) User opt-in for high-accuracy mode
- D) Smart compression (consistent optimization)

**Decision:** Option D (Smart compression)

**Implementation:**
```python
def smart_compress(image_bytes: bytes) -> bytes:
    img = Image.open(BytesIO(image_bytes))
    img = ImageOps.exif_transpose(img)  # Fix orientation
    
    # Resize to max 1024px on longest edge
    if max(img.size) > 1024:
        img.thumbnail((1024, 1024), Image.LANCZOS)
    
    # Compress as JPEG at 85% quality
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=85, optimize=True)
    return buffer.getvalue()
```

**Savings:**
- Token reduction: 20-30%
- Quality retention: Sufficient for food detection
- Consistency: All images processed identically

---

#### Decision 8: Confirmation UI

**Context:** How should users confirm or correct detected foods?

**Options Considered:**
- A) Quick-tap three choices (Correct/Close/Wrong)
- B) Editable sliders for grams
- C) Voice confirmation
- D) Hybrid quick-tap + expandable details
- E) Swipe gestures (Tinder-style)

**Decision:** Option D (Hybrid)

**UI States:**

| Confidence | Default State | Primary Action |
|------------|---------------|----------------|
| ≥ 0.80 (high) | Collapsed | "Looks good" prominent |
| 0.55-0.79 (medium) | Collapsed + warning | "Adjust" prominent |
| < 0.55 (low) | Expanded edit mode | Direct editing |

**Collapsed View:**
```
┌─────────────────────────────────────────────────────┐
│  🍗 Grilled Chicken Breast                          │
│  150g · 165 cal · 31g protein                       │
│  Confidence: ●●●●○ High                             │
│                                                     │
│  [✓ Looks good]              [✎ Adjust]            │
└─────────────────────────────────────────────────────┘
```

**Expanded View (on "Adjust" or low confidence):**
```
┌─────────────────────────────────────────────────────┐
│  🍚 Brown Rice                              [🔍]    │
│                                                     │
│  Select an alternative:                             │
│  [Brown Rice ●] [White Rice] [Quinoa] [Other...]   │
│                                                     │
│  Portion: [━━━━━━━━●━━━━━━━━━━] 195g               │
│                                                     │
│  [Save changes]                                     │
└─────────────────────────────────────────────────────┘
```

---

#### Decision 9: PID Tuning & Severity

**Context:** How should nutritional recommendations be calibrated?

**Options Considered:**
- A) Conservative (gentle suggestions)
- B) Balanced (moderate feedback)
- C) Aggressive (strong corrections)
- D) User-selectable intensity

**Decision:** Balanced default with Gemini-calculated severity

**Approach:**
- Gemini outputs `severity: 0.0-1.0` directly for each recommendation
- MVP uses moderate/balanced tone
- Future: Intensity adjusted by goals and health conditions

**Severity Bands:**
| Severity | Label | Tone |
|----------|-------|------|
| 0.0-0.3 | Slight | "Consider adding..." |
| 0.3-0.6 | Moderate | "You're short on... Try..." |
| 0.6-1.0 | Significant | "⚠️ Prioritize..." |

**Future Intensity Modifiers:**
```python
# v1.1: Adjust based on profile
if user.has_health_conditions:
    effective_severity *= 1.3
elif user.goal_intensity == "strict":
    effective_severity *= 1.2
elif user.goal_intensity == "relaxed":
    effective_severity *= 0.7
```

---

#### Decision 10: Privacy & Consent

**Context:** What consent language should we show for third-party AI processing?

**Options Considered:**
- A) Short consent (minimal text)
- B) Detailed consent (comprehensive)
- C) Layered consent (progressive disclosure)
- D) Granular consent (per-feature opt-in)

**Decision:** Option C (Layered consent)

**Implementation:**
```
┌─────────────────────────────────────────────────────┐
│  📸 AI-Powered Food Analysis                        │
│                                                     │
│  FitLoop uses Google's AI to analyze your food     │
│  photos and provide nutrition insights.             │
│                                                     │
│  [What data is used?]  ← expands inline            │
│  [How is it protected?] ← expands inline           │
│                                                     │
│  [✓] I agree to AI-powered food analysis           │
│                                                     │
│  [Continue]                                         │
└─────────────────────────────────────────────────────┘
```

**Expandable Details:**
- **What data is used?** Photos → Gemini, Goals → personalization, Health info → adjust advice
- **How is it protected?** Processed not stored by Google, encrypted, never sold

**Legal Requirements Met:**
- Names Google Gemini as third-party processor
- Clarifies "processed" vs "stored"
- Links to full Privacy Policy
- Provides opt-out path

---

## 4. Technical Architecture

### 4.1 Technology Stack

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| API Framework | FastAPI | 0.109.0 | Async support, auto-docs, Pydantic integration |
| Runtime | Python | 3.11+ | Type hints, performance improvements |
| AI Backend | Gemini 1.5 Flash | - | Cost-effective, fast, vision capable |
| Image Processing | Pillow | 10.2.0 | Mature, reliable, well-documented |
| Validation | Pydantic | 2.5.3 | Type safety, JSON schema generation |
| HTTP Client | httpx/aiohttp | - | Async HTTP for future integrations |

### 4.2 Module Dependency Graph

```
main.py (FastAPI App)
    │
    ├── orchestrator.py (Pipeline Coordination)
    │       │
    │       ├── image_processor.py (Image Handling)
    │       │       └── config.py
    │       │
    │       ├── gemini_client.py (AI Communication)
    │       │       └── config.py
    │       │
    │       └── models.py (Data Structures)
    │
    └── config.py (Configuration)
```

### 4.3 Async Architecture

```python
# All I/O operations are async
async def analyze_meal_image(request):
    # 1. Process image (CPU-bound, but fast)
    image_data = await image_processor.prepare_for_gemini(image_bytes)
    
    # 2. Call Gemini (I/O-bound, async)
    detection = await gemini_client.analyze_food_image(image_data, ...)
    
    # 3. Process response (CPU-bound, fast)
    return process_detection_response(detection)
```

### 4.4 Scalability Considerations

| Concern | MVP Approach | Scale Approach |
|---------|--------------|----------------|
| State Storage | In-memory dict | Redis/PostgreSQL |
| Rate Limiting | Per-process counters | Distributed rate limiter |
| Caching | None | Response caching for repeated items |
| Load Balancing | Single instance | Kubernetes/Cloud Run |

---

## 5. API Design

### 5.1 Endpoint Overview

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Health check |
| POST | `/api/v1/meals/analyze` | Analyze food image |
| POST | `/api/v1/meals/{id}/confirm` | Confirm/correct detection |
| POST | `/api/v1/meals/{id}/pid` | Get PID recommendations |
| POST | `/api/v1/meals/quick-log` | Combined flow for auto-accept |
| POST | `/api/v1/meals/manual` | Manual meal entry |

### 5.2 Standard Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Analyze                                                  │
│ POST /api/v1/meals/analyze                                      │
│ Body: { image_base64, meal_type, dietary_preferences, allergies }│
│ Returns: { meal_id, detection, next_step: "confirm"|"pid" }    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Confirm (if needed)                                     │
│ POST /api/v1/meals/{meal_id}/confirm                           │
│ Body: { items: [...confirmed/corrected items] }                 │
│ Returns: { confirmed_items, meal_totals, next_step: "pid" }    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: PID Analysis                                            │
│ POST /api/v1/meals/{meal_id}/pid                               │
│ Body: { user_profile, daily_targets, todays_intake, ... }      │
│ Returns: { recommendations, daily_summary, meal_suggestions }   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid request / Meal not confirmed |
| 404 | Meal not found |
| 422 | Validation error |
| 429 | Rate limited |
| 500 | Server error |

### 5.4 Error Response Format

```json
{
  "success": false,
  "error": "error_code",
  "message": "Human-readable message",
  "details": "Technical details (dev only)"
}
```

---

## 6. Data Models

### 6.1 Core Entities

#### FoodItem
```python
class FoodItem:
    item_id: str           # "item_001"
    food_name: str         # "Grilled Chicken Breast"
    food_category: str     # "protein"
    portion: Portion
    identification: Identification
    nutrition: Nutrition
    preparation_method: str
    flags: list[str]       # ["portion_uncertain"]
```

#### Portion
```python
class Portion:
    grams: float           # 150
    household_measure: str # "1 medium breast"
    confidence: float      # 0.85
```

#### Nutrition
```python
class Nutrition:
    calories: float        # 165
    protein_g: float       # 31
    carbs_g: float         # 0
    fat_g: float           # 3.6
    fiber_g: float         # 0
    sodium_mg: float       # 74
    sugar_g: float         # 0
```

### 6.2 Response Schemas

#### FoodDetectResponse
```python
class FoodDetectResponse:
    request_id: str
    timestamp: datetime
    status: "success" | "partial" | "no_food_detected" | "error"
    image_quality: ImageQuality
    items: list[FoodItem]
    meal_totals: NutritionTotals
    requires_confirmation: bool
    confirmation_reason: str | None
    items_needing_confirmation: list[str]
```

#### KpiPidResponse
```python
class KpiPidResponse:
    request_id: str
    timestamp: datetime
    status: "success" | "partial" | "error"
    current_status: dict[str, NutrientStatus]
    recommendations: list[Recommendation]  # max 5
    daily_summary: DailySummary
    next_meal_suggestions: list[MealSuggestion]  # max 3
```

#### Recommendation
```python
class Recommendation:
    priority: int          # 1-5
    nutrient: str          # "protein"
    type: str              # "deficit" | "surplus" | "trend_warning"
    severity: float        # 0.0-1.0
    pid_components: PidComponents
    suggestion: str        # Actionable text
    food_suggestions: list[FoodSuggestion]
    action_type: str       # "add_food" | "moderate_intake"
```

---

## 7. Gemini Integration

### 7.1 Model Configuration

| Parameter | Vision | PID |
|-----------|--------|-----|
| Model | gemini-1.5-flash | gemini-1.5-flash |
| Temperature | 0.1 | 0.2 |
| Top-P | 0.95 | 0.95 |
| Top-K | 40 | 40 |
| Max Tokens | 2048 | 1536 |
| Response Format | JSON | JSON |

### 7.2 Vision Prompt Structure

```
SYSTEM:
You are a professional nutritionist AI specializing in food identification 
and portion estimation from photographs.

RULES:
- Always return valid JSON
- Use conservative portion estimates when uncertain
- Confidence 0.0-1.0 for both identification and portion
- Provide alternatives when confidence < 0.8

HEURISTICS:
- Standard dinner plate: 25-27cm
- Palm of hand: ~85g cooked meat
- Fist: ~1 cup or 150g rice

USER:
Analyze this food image and identify all food items...
[Image attached as base64]

Meal type: {lunch}
Dietary preferences: {vegetarian}
Allergies: {peanuts}
```

### 7.3 PID Prompt Structure

```
SYSTEM:
You are a professional nutritionist providing PID-based dietary guidance.

P (Proportional): React to TODAY's gaps
I (Integral): Consider WEEKLY patterns
D (Derivative): Note TRENDS

SEVERITY CALCULATION:
- <10% deviation: 0.1-0.2
- 10-20% deviation: 0.2-0.4
- 20-35% deviation: 0.4-0.6
- 35-50% deviation: 0.6-0.8
- >50% deviation: 0.8-1.0

TONE: Supportive coach, "Consider adding..." not "You failed to..."

USER:
Analyze intake and provide recommendations...

User Profile: {age, sex, weight, goals, conditions}
Daily Targets: {calories: 2000, protein_g: 100, ...}
Today's Intake: {consumed so far}
Weekly Summary: {trends}
```

### 7.4 JSON Repair Strategy

When Gemini returns invalid JSON:

```python
REPAIR_PROMPT = """
Your previous response was not valid JSON.

ORIGINAL RESPONSE (truncated):
{original_response}

ERROR:
{error_message}

Please return ONLY valid JSON matching the expected schema.
No explanations, no markdown, just the JSON object.
"""
```

---

## 8. UX/UI Design

### 8.1 User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CAPTURE                                                       │
│    User opens camera, frames meal, taps capture                  │
│    - Full-screen camera preview                                  │
│    - Meal type selector (breakfast/lunch/dinner/snack)          │
│    - Tips overlay for first-time users                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ANALYZING                                                     │
│    Loading state while Gemini processes                          │
│    - Progress indicator                                          │
│    - "Identifying your meal..." message                         │
│    - 2-3 second typical duration                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. CONFIRMATION                                                  │
│    Show detected items for review                                │
│    - Collapsed cards for high-confidence items                  │
│    - Expanded cards for uncertain items                          │
│    - Quick-tap "Looks good" for correct                          │
│    - Expandable edit for corrections                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. RECOMMENDATIONS                                               │
│    Show PID analysis results                                     │
│    - Daily progress score                                        │
│    - Top recommendation with food suggestions                   │
│    - Expandable for all recommendations                          │
│    - Next meal ideas                                             │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Confirmation Card States

| State | Visual | User Action |
|-------|--------|-------------|
| High Confidence | Green indicator, "Looks good" prominent | 1-tap confirm |
| Medium Confidence | Yellow indicator, alternatives shown | Select or adjust |
| Low Confidence | Orange indicator, expanded by default | Must review |
| Editing | Full form with slider, search | Save changes |

### 8.3 Confidence Indicators

```
High (≥0.80):    ●●●●○  "High"
Medium (0.55-0.79): ●●●○○  "Medium"  
Low (<0.55):     ●●○○○  "Low"
```

### 8.4 Portion Slider Behavior

- Range: 10g to 2000g
- Default: Gemini's estimate
- Snap points: Common portions (100g, 150g, 200g, 250g, 300g)
- Household measure updates dynamically
- Nutrition recalculates in real-time

### 8.5 Error States

| Error | Display | Recovery |
|-------|---------|----------|
| Analysis failed | "We couldn't analyze this image" | Retake or manual entry |
| Network error | "Connection issue" | Retry button |
| No food detected | "No food items found" | Retake or manual entry |
| Low image quality | "Image too dark/blurry" | Retake with tips |

---

## 9. Error Handling & Resilience

### 9.1 Error Categories

| Category | Examples | Handling |
|----------|----------|----------|
| Network | Timeout, 5xx | Retry with backoff |
| Rate Limit | 429 | Backoff, queue |
| Parse | Invalid JSON | Repair prompt |
| Validation | Schema mismatch | Repair or fallback |
| Business | No food detected | Inform user |

### 9.2 Retry Configuration

```python
MAX_NETWORK_RETRIES = 2
RETRY_BACKOFF_BASE = 1.0  # seconds
RETRY_BACKOFF_MAX = 8.0   # seconds

# Backoff sequence: 1s, 2s, 4s (capped at 8s)
```

### 9.3 Graceful Degradation

```
Level 1: Full functionality
    ↓ (Gemini vision fails)
Level 2: Manual entry with search
    ↓ (Search fails)
Level 3: Manual entry with free text
    ↓ (Backend fails)
Level 4: Offline queue (future)
```

### 9.4 Logging Strategy

```python
# All Gemini interactions logged
logger.info(f"Gemini vision call for meal {meal_id}")
logger.warning(f"Gemini retry {attempt}/{max_retries}: {error}")
logger.error(f"Gemini failed after all retries: {error}")

# User corrections logged for training
logger.info(f"User correction logged: {correction_id}")
```

---

## 10. Privacy & Security

### 10.1 Data Classification

| Data Type | Classification | Retention |
|-----------|----------------|-----------|
| Food images | Sensitive | Not stored (MVP) |
| User profile | Personal | User account lifetime |
| Meal logs | Personal | User account lifetime |
| Corrections | Training data | Indefinite (anonymized) |

### 10.2 Third-Party Data Sharing

| Recipient | Data Shared | Purpose | Retention |
|-----------|-------------|---------|-----------|
| Google Gemini | Images, meal context | Analysis | Per Gemini ToS (processed, not stored) |

### 10.3 Consent Flow

**First Use:**
1. Show layered consent modal
2. Explain Google Gemini processing
3. Require checkbox acknowledgment
4. Link to full Privacy Policy
5. Store consent timestamp

**Data Subject Rights:**
- Export: All user data downloadable
- Deletion: Account deletion removes all data
- Opt-out: Can disable AI analysis (manual entry only)

### 10.4 Security Measures

| Measure | Implementation |
|---------|----------------|
| Transport | HTTPS/TLS 1.3 |
| Authentication | Bearer token (stub for MVP) |
| API Keys | Environment variables only |
| Input Validation | Pydantic models |
| Output Sanitization | Structured JSON responses |

---

## 11. Cost & Performance

### 11.1 Gemini API Costs (Estimated)

| Call Type | Input Tokens | Output Tokens | Cost/Call |
|-----------|--------------|---------------|-----------|
| Vision | ~1000-1500 | ~500-800 | ~$0.001-0.002 |
| PID | ~800-1200 | ~400-600 | ~$0.0008-0.001 |
| **Per Meal** | - | - | **~$0.002-0.003** |

**Monthly Estimates (per user):**
- 3 meals/day × 30 days = 90 meals
- Cost: ~$0.18-0.27/user/month

### 11.2 Cost Optimizations

| Optimization | Savings | Implemented |
|--------------|---------|-------------|
| Smart compression | 20-30% tokens | ✅ MVP |
| gemini-1.5-flash (vs Pro) | 50% | ✅ MVP |
| Skip PID if not needed | 30% of calls | ✅ MVP |
| Response caching | 10-20% | ❌ Future |
| Correction-based shortcuts | 20-40% | ❌ Future |

### 11.3 Latency Budgets

| Operation | Target | Maximum |
|-----------|--------|---------|
| Image compression | 200ms | 500ms |
| Gemini vision | 2.5s | 5s |
| Gemini PID | 1.5s | 3s |
| Total (analyze) | 3s | 6s |
| Total (quick-log) | 5s | 9s |

### 11.4 Performance Monitoring

```python
# Key metrics to track
metrics = {
    "gemini_vision_latency_p50": ...,
    "gemini_vision_latency_p95": ...,
    "gemini_pid_latency_p50": ...,
    "gemini_pid_latency_p95": ...,
    "auto_accept_rate": ...,
    "correction_rate": ...,
    "error_rate": ...,
}
```

---

## 12. Configuration Reference

### 12.1 Environment Variables

```bash
# Required
GEMINI_API_KEY=your-api-key

# Confidence Thresholds (adjustable)
FOOD_ID_AUTO_ACCEPT=0.80
FOOD_ID_CONFIRM_MIN=0.55
PORTION_AUTO_ACCEPT=0.75
PORTION_CONFIRM_MIN=0.45

# Image Processing
IMAGE_MAX_DIMENSION=1024
IMAGE_JPEG_QUALITY=85

# Retry Configuration
MAX_NETWORK_RETRIES=2

# Rate Limiting
RATE_LIMIT_MEALS_PER_HOUR=20
RATE_LIMIT_PID_PER_HOUR=30
```

### 12.2 Gemini Configuration

```python
GEMINI_VISION_CONFIG = {
    "temperature": 0.1,      # Low for deterministic outputs
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 2048,
}

GEMINI_PID_CONFIG = {
    "temperature": 0.2,      # Slightly higher for natural language
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 1536,
}
```

### 12.3 Threshold Reference

| Threshold | Default | Range | Purpose |
|-----------|---------|-------|---------|
| FOOD_ID_AUTO_ACCEPT | 0.80 | 0.6-0.95 | Above = auto-log |
| FOOD_ID_CONFIRM_MIN | 0.55 | 0.3-0.7 | Below = reject |
| PORTION_AUTO_ACCEPT | 0.75 | 0.5-0.9 | Above = trust estimate |
| PORTION_CONFIRM_MIN | 0.45 | 0.2-0.6 | Below = reject |

---

## 13. Glossary

| Term | Definition |
|------|------------|
| **Auto-accept** | Confidence high enough to log without user confirmation |
| **Confidence** | Gemini's certainty score (0.0-1.0) for detection |
| **HITL** | Human-in-the-loop review queue |
| **PID** | Proportional-Integral-Derivative control algorithm |
| **P-component** | Reacts to current day's deviation from target |
| **I-component** | Accumulates weekly patterns |
| **D-component** | Detects rate of change/trends |
| **Severity** | 0.0-1.0 score indicating urgency of recommendation |
| **Smart compression** | Resize + JPEG optimize before API call |
| **Repair prompt** | Secondary Gemini call to fix malformed JSON |
| **Layered consent** | Progressive disclosure of privacy info |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | Dec 2024 | FitLoop Team | Initial MVP architecture |

---

*This document serves as the authoritative reference for FitLoop MVP architecture decisions. For future enhancements, see `FUTURE_PLANS.md`.*

