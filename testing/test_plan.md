# FitLoop Test Plan

> Version 1.0.0 (MVP)

## Overview

This test plan covers validation of the Gemini-powered food analysis pipeline before production deployment.

## Test Categories

1. **Unit Tests** - Individual component validation
2. **Integration Tests** - API endpoint testing
3. **Vision Accuracy Tests** - Gemini food detection quality
4. **PID Logic Tests** - Recommendation accuracy
5. **Edge Case Tests** - Error handling and fallbacks
6. **Performance Tests** - Latency and throughput

---

## 1. Unit Tests

### 1.1 Image Processor Tests

| Test ID | Description | Input | Expected Output |
|---------|-------------|-------|-----------------|
| IMG-001 | Valid JPEG processing | 1024x768 JPEG | Compressed base64, hash |
| IMG-002 | PNG with transparency | PNG with alpha | RGB JPEG, white background |
| IMG-003 | Oversized image resize | 4000x3000 image | Resized to 1024px max |
| IMG-004 | EXIF orientation fix | Portrait image with EXIF rotation | Correctly oriented |
| IMG-005 | Image too large | 10MB file | ValueError raised |
| IMG-006 | Invalid image data | Random bytes | Appropriate error |

### 1.2 Confidence Threshold Tests

| Test ID | Description | Confidence Values | Expected Status |
|---------|-------------|-------------------|-----------------|
| THR-001 | High confidence auto-accept | food=0.85, portion=0.80 | AUTO_ACCEPTED |
| THR-002 | Medium confidence confirm | food=0.70, portion=0.65 | PENDING_CONFIRMATION |
| THR-003 | Low food ID confidence | food=0.50, portion=0.80 | REJECTED |
| THR-004 | Low portion confidence | food=0.85, portion=0.40 | REJECTED |
| THR-005 | Borderline auto-accept | food=0.80, portion=0.75 | AUTO_ACCEPTED |
| THR-006 | Borderline confirm | food=0.79, portion=0.74 | PENDING_CONFIRMATION |

### 1.3 Retry Logic Tests

| Test ID | Description | Scenario | Expected Behavior |
|---------|-------------|----------|-------------------|
| RTY-001 | Network retry success | Fail once, succeed | Returns result after 1 retry |
| RTY-002 | Max retries exceeded | Fail 3 times | GeminiAPIError raised |
| RTY-003 | Repair prompt success | Invalid JSON first | Parses repaired response |
| RTY-004 | Repair prompt failure | Invalid JSON both times | Manual entry fallback |
| RTY-005 | Backoff timing | Multiple retries | Exponential backoff observed |

---

## 2. Integration Tests

### 2.1 API Endpoint Tests

| Test ID | Endpoint | Method | Test Case | Expected |
|---------|----------|--------|-----------|----------|
| API-001 | /health | GET | Health check | 200, status: healthy |
| API-002 | /api/v1/meals/analyze | POST | Valid image | 200, detection results |
| API-003 | /api/v1/meals/analyze | POST | Invalid base64 | 400, error message |
| API-004 | /api/v1/meals/analyze | POST | No image | 422, validation error |
| API-005 | /api/v1/meals/{id}/confirm | POST | Valid confirmation | 200, confirmed items |
| API-006 | /api/v1/meals/{id}/confirm | POST | Unknown meal_id | 404, not found |
| API-007 | /api/v1/meals/{id}/pid | POST | Unconfirmed meal | 400, must confirm first |
| API-008 | /api/v1/meals/{id}/pid | POST | Valid request | 200, recommendations |
| API-009 | /api/v1/meals/manual | POST | Manual entry | 200, meal logged |
| API-010 | /api/v1/meals/quick-log | POST | High confidence | 200, full flow complete |
| API-011 | /api/v1/meals/quick-log | POST | Low confidence | 200, requires_confirmation: true |

### 2.2 End-to-End Flow Tests

| Test ID | Flow | Steps | Expected |
|---------|------|-------|----------|
| E2E-001 | Happy path (auto-accept) | analyze → quick-log | Full results in one call |
| E2E-002 | Confirmation flow | analyze → confirm → pid | 3-step success |
| E2E-003 | Correction flow | analyze → edit → confirm → pid | Correction logged |
| E2E-004 | Manual fallback | analyze fails → manual entry | Manual entry success |

---

## 3. Vision Accuracy Tests

### 3.1 Test Dataset Requirements

**Minimum samples per category:**
- Simple single-item meals: 20 images
- Multi-item plates: 30 images
- Beverages: 10 images
- Mixed dishes: 15 images
- Ambiguous items: 15 images

**Total minimum: 90 test images**

### 3.2 Food Identification Accuracy

| Test ID | Category | Target Accuracy | Measurement |
|---------|----------|-----------------|-------------|
| VIS-001 | Simple proteins (chicken, steak, fish) | ≥85% correct | Top-1 match |
| VIS-002 | Grains (rice, pasta, bread) | ≥80% correct | Top-1 match |
| VIS-003 | Vegetables | ≥85% correct | Top-1 match |
| VIS-004 | Fruits | ≥90% correct | Top-1 match |
| VIS-005 | Mixed dishes | ≥70% correct | Top-1 match |
| VIS-006 | Beverages | ≥80% correct | Top-1 match |

### 3.3 Portion Estimation Accuracy

| Test ID | Category | Target Accuracy | Measurement |
|---------|----------|-----------------|-------------|
| POR-001 | Proteins | ±30% of actual grams | Reference weighed |
| POR-002 | Grains/Carbs | ±35% of actual grams | Reference weighed |
| POR-003 | Vegetables | ±30% of actual grams | Reference weighed |
| POR-004 | Liquids | ±25% of actual ml | Reference measured |

### 3.4 Challenging Scenarios

| Test ID | Scenario | Expectation |
|---------|----------|-------------|
| CHL-001 | Poor lighting | Graceful degradation, confidence reflects |
| CHL-002 | Partial occlusion | Detect visible items, flag hidden |
| CHL-003 | Multiple similar items | Count correctly |
| CHL-004 | Unusual plating | Still detect foods |
| CHL-005 | Non-food objects in frame | Ignore non-food |
| CHL-006 | Empty plate | no_food_detected status |

---

## 4. PID Logic Tests

### 4.1 Severity Calculation Tests

| Test ID | Scenario | Expected Severity |
|---------|----------|-------------------|
| PID-001 | 5% protein deficit | 0.1-0.2 (slight) |
| PID-002 | 15% protein deficit | 0.2-0.4 (moderate) |
| PID-003 | 30% protein deficit | 0.4-0.6 (moderate) |
| PID-004 | 50% protein deficit | 0.6-0.8 (significant) |
| PID-005 | 70% protein deficit | 0.8-1.0 (urgent) |
| PID-006 | Weekly pattern (low protein all week) | Higher I-component |
| PID-007 | Trend (declining protein) | Higher D-component |

### 4.2 Recommendation Quality Tests

| Test ID | Input State | Expected Recommendation |
|---------|-------------|------------------------|
| REC-001 | Protein deficit | Specific protein foods |
| REC-002 | Fiber deficit | High-fiber suggestions |
| REC-003 | Sodium surplus | Moderation advice |
| REC-004 | On track all nutrients | Encouragement, maintenance tips |
| REC-005 | Vegetarian user, protein deficit | Plant-based protein suggestions |
| REC-006 | Allergies (nuts), needs protein | Nut-free alternatives only |

### 4.3 Dietary Preference Compliance

| Test ID | Preference | Recommendation Check |
|---------|------------|---------------------|
| PRF-001 | Vegetarian | No meat suggestions |
| PRF-002 | Vegan | No animal products |
| PRF-003 | Pescatarian | Fish ok, no meat |
| PRF-004 | Gluten-free | No gluten-containing foods |
| PRF-005 | Nut allergy | No nut-containing suggestions |

---

## 5. Edge Case Tests

### 5.1 Error Handling

| Test ID | Error Scenario | Expected Handling |
|---------|----------------|-------------------|
| ERR-001 | Gemini API timeout | Retry with backoff |
| ERR-002 | Gemini rate limit | 429 error, retry after delay |
| ERR-003 | Invalid JSON response | Repair prompt attempt |
| ERR-004 | Network disconnect | Graceful error, retry option |
| ERR-005 | Malformed image | Clear error message |

### 5.2 Boundary Conditions

| Test ID | Condition | Expected |
|---------|-----------|----------|
| BND-001 | Very small portion (5g) | Detected with low confidence |
| BND-002 | Very large portion (2000g) | Detected, flagged if unusual |
| BND-003 | Many items (>10) | All detected, may need scrolling |
| BND-004 | 0 calories food (water) | Correctly 0 cal |
| BND-005 | Very high calorie (2000+ per item) | Flagged for review |

---

## 6. Performance Tests

### 6.1 Latency Requirements

| Test ID | Operation | Target | Maximum |
|---------|-----------|--------|---------|
| LAT-001 | Image upload + compress | <500ms | 1000ms |
| LAT-002 | Gemini vision call | <3s | 5s |
| LAT-003 | Gemini PID call | <2s | 4s |
| LAT-004 | Full analyze flow | <4s | 7s |
| LAT-005 | Full quick-log flow | <6s | 10s |

### 6.2 Throughput Tests

| Test ID | Scenario | Target |
|---------|----------|--------|
| THR-001 | Concurrent users (10) | All complete <10s |
| THR-002 | Burst (20 requests in 5s) | No failures |
| THR-003 | Sustained load (100 req/min) | p95 <5s |

---

## Sample Test Data

### Test Image Categories

```
testing/
├── images/
│   ├── simple_meals/
│   │   ├── grilled_chicken_01.jpg
│   │   ├── salmon_fillet_01.jpg
│   │   ├── rice_bowl_01.jpg
│   │   └── ...
│   ├── complex_meals/
│   │   ├── dinner_plate_01.jpg  # Multiple items
│   │   ├── stir_fry_01.jpg      # Mixed dish
│   │   └── ...
│   ├── challenging/
│   │   ├── dark_lighting_01.jpg
│   │   ├── partial_view_01.jpg
│   │   ├── blurry_01.jpg
│   │   └── ...
│   └── edge_cases/
│       ├── empty_plate.jpg
│       ├── non_food.jpg
│       └── ...
└── ground_truth/
    └── annotations.json
```

### Ground Truth Annotation Format

```json
{
  "grilled_chicken_01.jpg": {
    "items": [
      {
        "food_name": "Grilled Chicken Breast",
        "actual_grams": 165,
        "actual_calories": 180,
        "actual_protein_g": 34
      }
    ],
    "notes": "Single item, good lighting, standard plate"
  },
  "dinner_plate_01.jpg": {
    "items": [
      {
        "food_name": "Grilled Salmon",
        "actual_grams": 180,
        "actual_calories": 280
      },
      {
        "food_name": "Roasted Potatoes",
        "actual_grams": 150,
        "actual_calories": 130
      },
      {
        "food_name": "Steamed Asparagus",
        "actual_grams": 80,
        "actual_calories": 20
      }
    ],
    "notes": "Multi-item plate, good lighting"
  }
}
```

### Sample User Profiles for PID Testing

```json
{
  "test_users": [
    {
      "id": "test_user_01",
      "profile": {
        "age": 30,
        "sex": "female",
        "weight_kg": 65,
        "height_cm": 168,
        "activity_level": "moderately_active",
        "primary_goal": "maintain_weight",
        "goal_intensity": "moderate",
        "dietary_preferences": "vegetarian",
        "health_conditions": [],
        "allergies": []
      },
      "daily_targets": {
        "calories": 2000,
        "protein_g": 100,
        "carbs_g": 250,
        "fat_g": 65,
        "fiber_g": 28
      }
    },
    {
      "id": "test_user_02",
      "profile": {
        "age": 45,
        "sex": "male",
        "weight_kg": 90,
        "height_cm": 180,
        "activity_level": "sedentary",
        "primary_goal": "lose_weight",
        "goal_intensity": "strict",
        "dietary_preferences": null,
        "health_conditions": ["type_2_diabetes"],
        "allergies": ["shellfish"]
      },
      "daily_targets": {
        "calories": 1800,
        "protein_g": 135,
        "carbs_g": 150,
        "fat_g": 60,
        "fiber_g": 35
      }
    },
    {
      "id": "test_user_03",
      "profile": {
        "age": 25,
        "sex": "male",
        "weight_kg": 75,
        "height_cm": 178,
        "activity_level": "very_active",
        "primary_goal": "build_muscle",
        "goal_intensity": "strict",
        "dietary_preferences": null,
        "health_conditions": [],
        "allergies": ["tree_nuts", "peanuts"]
      },
      "daily_targets": {
        "calories": 3000,
        "protein_g": 180,
        "carbs_g": 350,
        "fat_g": 100,
        "fiber_g": 35
      }
    }
  ]
}
```

---

## Test Execution

### Pre-Launch Checklist

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Vision accuracy meets targets (>80% overall)
- [ ] Portion estimation within acceptable range (±35%)
- [ ] PID recommendations respect dietary preferences
- [ ] Latency targets met (p95 <5s for full flow)
- [ ] Error handling works correctly
- [ ] Manual fallback functions properly

### Automation

```bash
# Run all tests
pytest testing/ -v

# Run specific categories
pytest testing/test_unit.py -v
pytest testing/test_integration.py -v
pytest testing/test_vision_accuracy.py -v --image-dir=testing/images/

# Run with coverage
pytest testing/ --cov=backend --cov-report=html
```

### Manual Testing Checklist

1. **Camera Integration**
   - [ ] Photo capture works on iOS
   - [ ] Photo capture works on Android
   - [ ] Gallery selection works
   
2. **Confirmation UI**
   - [ ] Collapsed card displays correctly
   - [ ] Expand/collapse animation smooth
   - [ ] Portion slider responsive
   - [ ] Alternative selection works
   - [ ] Confirm all button works

3. **PID Display**
   - [ ] Recommendations render correctly
   - [ ] Food suggestions are actionable
   - [ ] Severity indicators visible

4. **Error States**
   - [ ] Network error shows retry option
   - [ ] Analysis failure shows manual entry
   - [ ] Loading states are clear

---

## Success Criteria

### MVP Launch Requirements

| Metric | Target | Blocking? |
|--------|--------|-----------|
| Food ID accuracy | ≥75% | Yes |
| Portion accuracy | ±40% | Yes |
| API latency (p95) | <7s | Yes |
| Error rate | <5% | Yes |
| Crash rate | <1% | Yes |
| PID preference compliance | 100% | Yes |

### Post-Launch Monitoring

- Track actual accuracy vs. user corrections
- Monitor API latency percentiles
- Alert on error rate spikes
- Review user feedback for common issues

