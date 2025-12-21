# FitLoop Confirmation UI Flow

> Decision 8: Hybrid quick-tap + expandable adjustment

## Overview

The confirmation UI supports three modes based on confidence levels:
1. **Auto-accepted** (≥0.80 food ID, ≥0.75 portion) → Quick summary, optional edit
2. **Needs confirmation** (0.55-0.79 food ID, 0.45-0.74 portion) → Collapsed card with confirm/adjust
3. **Low confidence** (<0.55 food ID, <0.45 portion) → Expanded edit mode

## Flow Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      IMAGE CAPTURED                          │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    ANALYZING...                              │
│   ┌─────────────────────────────────┐                       │
│   │  🔍 Identifying your meal...    │                       │
│   │  ████████░░░░░░░░░░             │                       │
│   └─────────────────────────────────┘                       │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐    ┌─────────────────────────────┐
│   ALL AUTO-ACCEPTED     │    │   NEEDS CONFIRMATION        │
│   (High confidence)     │    │   (Medium/Low confidence)   │
└─────────────────────────┘    └─────────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐    ┌─────────────────────────────┐
│   QUICK SUMMARY VIEW    │    │   CONFIRMATION CARDS        │
│   "Meal logged! ✓"      │    │   (Per-item confirm/edit)   │
│   [View Details]        │    │                             │
└─────────────────────────┘    └─────────────────────────────┘
              │                               │
              └───────────────┬───────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    PID RECOMMENDATIONS                       │
│   Personalized nutritional suggestions                       │
└──────────────────────────────────────────────────────────────┘
```

## UI Components

### 1. Loading State

```json
{
  "component": "AnalyzingOverlay",
  "props": {
    "message": "Identifying your meal...",
    "subtext": "This usually takes 2-3 seconds",
    "showProgress": true
  }
}
```

### 2. Collapsed Confirmation Card (Default)

Used for items with medium-high confidence.

```json
{
  "component": "FoodConfirmationCard",
  "variant": "collapsed",
  "props": {
    "item": {
      "item_id": "item_001",
      "food_name": "Grilled Chicken Breast",
      "portion": {
        "grams": 150,
        "household_measure": "1 medium breast",
        "confidence": 0.82
      },
      "identification": {
        "confidence": 0.91
      },
      "nutrition": {
        "calories": 165,
        "protein_g": 31,
        "carbs_g": 0,
        "fat_g": 3.6
      }
    },
    "confidenceIndicator": "high",
    "primaryAction": "looks_good",
    "secondaryAction": "adjust"
  }
}
```

**Visual Layout (Collapsed):**
```
┌─────────────────────────────────────────────────────┐
│  🍗 Grilled Chicken Breast                          │
│  150g · 165 cal · 31g protein                       │
│                                                     │
│  Confidence: ●●●●○ High                             │
│                                                     │
│  [✓ Looks good]              [✎ Adjust]            │
└─────────────────────────────────────────────────────┘
```

### 3. Expanded Edit Card

Used when user taps "Adjust" or for low-confidence items.

```json
{
  "component": "FoodConfirmationCard",
  "variant": "expanded",
  "props": {
    "item": {
      "item_id": "item_002",
      "food_name": "Brown Rice",
      "portion": {
        "grams": 195,
        "household_measure": "1 cup cooked",
        "confidence": 0.68
      },
      "identification": {
        "confidence": 0.75,
        "alternatives": [
          {"name": "White Rice", "confidence": 0.20},
          {"name": "Quinoa", "confidence": 0.05}
        ]
      }
    },
    "showAlternatives": true,
    "showPortionSlider": true,
    "showFoodSearch": true
  }
}
```

**Visual Layout (Expanded):**
```
┌─────────────────────────────────────────────────────┐
│  🍚 Brown Rice                              [🔍]    │
│                                                     │
│  Not quite right? Select an alternative:            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Brown Rice  │ │ White Rice  │ │  Quinoa     │   │
│  │    ●        │ │             │ │             │   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                     │
│  Portion:                                           │
│  [━━━━━━━━●━━━━━━━━━━] 195g                        │
│  ≈ 1 cup cooked                                     │
│                                                     │
│  Nutrition (estimated):                             │
│  215 cal · 5g protein · 45g carbs · 1.8g fat       │
│                                                     │
│  [Save changes]                                     │
└─────────────────────────────────────────────────────┘
```

### 4. Confirmation with Alternatives (Medium Confidence)

```json
{
  "component": "FoodConfirmationCard",
  "variant": "collapsed_with_alternatives",
  "props": {
    "item": {
      "food_name": "Brown Rice",
      "identification": {
        "confidence": 0.72,
        "alternatives": [
          {"name": "White Rice", "confidence": 0.18},
          {"name": "Quinoa", "confidence": 0.08}
        ]
      }
    },
    "showQuickAlternatives": true,
    "uncertaintyMessage": "Is this Brown Rice?"
  }
}
```

**Visual Layout:**
```
┌─────────────────────────────────────────────────────┐
│  ⚠️ Is this Brown Rice?                             │
│  195g · 215 cal                                     │
│                                                     │
│  Confidence: ●●●○○ Medium                           │
│                                                     │
│  Quick pick:                                        │
│  [Brown Rice ✓] [White Rice] [Quinoa] [Other...]   │
│                                                     │
│  [Confirm]                     [✎ Edit details]    │
└─────────────────────────────────────────────────────┘
```

### 5. Multiple Items Summary

```json
{
  "component": "MealConfirmationSummary",
  "props": {
    "meal_id": "meal_abc123",
    "items": [
      {"food_name": "Grilled Chicken", "status": "auto_accepted", "calories": 165},
      {"food_name": "Brown Rice", "status": "needs_confirmation", "calories": 215},
      {"food_name": "Steamed Broccoli", "status": "auto_accepted", "calories": 30}
    ],
    "meal_totals": {
      "calories": 410,
      "protein_g": 38.5,
      "carbs_g": 51,
      "fat_g": 5.7
    },
    "items_needing_confirmation": ["item_002"]
  }
}
```

**Visual Layout:**
```
┌─────────────────────────────────────────────────────┐
│  📸 Lunch · 3 items detected                        │
│                                                     │
│  ✓ Grilled Chicken · 150g · 165 cal                │
│  ⚠ Brown Rice · 195g · 215 cal          [Review]   │
│  ✓ Steamed Broccoli · 90g · 30 cal                 │
│                                                     │
│  ─────────────────────────────────────────          │
│  Total: 410 cal · 38g protein · 51g carbs          │
│                                                     │
│  [Confirm All]              [Review flagged items] │
└─────────────────────────────────────────────────────┘
```

### 6. Manual Entry Fallback

When image analysis fails completely:

```json
{
  "component": "ManualEntryPrompt",
  "props": {
    "message": "We couldn't analyze this image",
    "subtext": "The lighting or angle made it difficult. Please type what you ate.",
    "showImageTips": true,
    "actions": [
      {"label": "Type my meal", "action": "manual_entry"},
      {"label": "Retake photo", "action": "retake"}
    ]
  }
}
```

## Interaction Patterns

### Swipe Gestures (Optional Enhancement)

```json
{
  "gestures": {
    "swipe_right": {
      "action": "confirm_item",
      "feedback": "haptic_light",
      "visual": "green_checkmark_animation"
    },
    "swipe_left": {
      "action": "reject_item",
      "feedback": "haptic_medium",
      "visual": "expand_for_correction"
    },
    "swipe_up": {
      "action": "expand_details",
      "feedback": "haptic_light"
    }
  }
}
```

### Accessibility

```json
{
  "accessibility": {
    "confirm_button": {
      "label": "Confirm grilled chicken, 150 grams, 165 calories",
      "hint": "Double tap to confirm this food item"
    },
    "adjust_button": {
      "label": "Adjust grilled chicken details",
      "hint": "Double tap to edit portion size or change food"
    },
    "portion_slider": {
      "label": "Portion size slider, currently 195 grams",
      "hint": "Swipe left or right to adjust portion, double tap to enter exact value"
    }
  }
}
```

## State Management

### Confirmation Flow State

```typescript
interface ConfirmationState {
  meal_id: string;
  status: 'loading' | 'confirming' | 'confirmed' | 'error';
  items: ConfirmableItem[];
  itemsConfirmed: Set<string>;
  itemsEdited: Map<string, EditedItem>;
  canSubmit: boolean;
}

interface ConfirmableItem {
  item_id: string;
  original: FoodItem;
  current: FoodItem;
  confirmationStatus: 'auto_accepted' | 'pending' | 'confirmed' | 'edited' | 'rejected';
  needsConfirmation: boolean;
  confidenceLevel: 'high' | 'medium' | 'low';
}
```

### Actions

```typescript
type ConfirmationAction =
  | { type: 'CONFIRM_ITEM'; item_id: string }
  | { type: 'EDIT_ITEM'; item_id: string; changes: Partial<FoodItem> }
  | { type: 'SELECT_ALTERNATIVE'; item_id: string; alternative: string }
  | { type: 'REJECT_ITEM'; item_id: string }
  | { type: 'CONFIRM_ALL' }
  | { type: 'SUBMIT_CONFIRMATION' };
```

## Privacy Consent Modal (Decision 10)

Shown on first use:

```json
{
  "component": "PrivacyConsentModal",
  "variant": "layered",
  "props": {
    "title": "AI-Powered Food Analysis",
    "summary": "FitLoop uses Google's AI to analyze your food photos and provide nutrition insights.",
    "expandableSections": [
      {
        "title": "What data is used?",
        "content": "📷 Food photos → sent to Google Gemini\n🎯 Your goals → personalize recommendations\n🏥 Health info → adjust advice (if provided)"
      },
      {
        "title": "How is it protected?",
        "content": "• Photos are processed, not stored by Google\n• Your data is encrypted in transit and at rest\n• We never sell your data to third parties"
      }
    ],
    "consentCheckbox": {
      "label": "I agree to AI-powered food analysis",
      "required": true
    },
    "links": [
      {"label": "Privacy Policy", "url": "/privacy"},
      {"label": "Terms of Service", "url": "/terms"}
    ],
    "primaryAction": "Continue"
  }
}
```

## PID Recommendations Display

After confirmation, show personalized recommendations:

```json
{
  "component": "PidRecommendationsCard",
  "props": {
    "daily_summary": {
      "overall_score": 0.68,
      "headline": "Good progress on carbs and calories, but protein needs attention",
      "encouragement": "You're making solid choices! Adding protein at dinner will round out a great day."
    },
    "top_recommendation": {
      "nutrient": "protein",
      "severity": 0.65,
      "suggestion": "You're 35g short on protein. Try grilled salmon or shrimp for dinner.",
      "food_suggestions": [
        {"name": "Grilled Salmon (6oz)", "protein_g": 40},
        {"name": "Shrimp Stir-fry", "protein_g": 35}
      ]
    },
    "expandable": true,
    "showAllRecommendations": false
  }
}
```

**Visual Layout:**
```
┌─────────────────────────────────────────────────────┐
│  📊 Your Day So Far                                 │
│                                                     │
│  Overall: ████████░░ 68%                           │
│  "Good progress! Protein needs attention"           │
│                                                     │
│  💡 Top Tip                                         │
│  ─────────────────────────────────────────          │
│  You're 35g short on protein today.                 │
│                                                     │
│  Try for dinner:                                    │
│  • Grilled Salmon (6oz) - 40g protein              │
│  • Shrimp Stir-fry - 35g protein                   │
│                                                     │
│  [See all recommendations]                          │
└─────────────────────────────────────────────────────┘
```

