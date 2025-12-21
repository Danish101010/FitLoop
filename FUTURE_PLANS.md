# FitLoop - Future Enhancements Roadmap

> This document tracks planned enhancements beyond MVP scope. Each item includes context on why it was deferred and prerequisites for implementation.

---

## 🗂️ Version Roadmap

| Version | Focus | Target |
|---------|-------|--------|
| v1.0 (MVP) | Core logging + Gemini vision + basic PID | Current |
| v1.1 | Image storage migration + correction automation | Post-launch |
| v1.2 | Advanced calibration + personalization | +2 months |
| v2.0 | ML fine-tuning + predictive features | +6 months |

---

## 📋 Deferred Enhancements

### 1. Image Storage Migration (S3/Cloud)

**Current (MVP):** Direct base64 upload to Gemini  
**Future:** Upload to S3, send signed URL to Gemini

**Benefits:**
- Image persistence for audit/debugging/retraining
- Retry without re-upload on Gemini failures
- Enables image-based correction matching (see #2)

**Prerequisites:**
- S3 bucket configuration
- IAM roles and signed URL generation
- Image retention policy (GDPR/privacy compliance)
- Cleanup job for expired images

**Effort:** Medium (1-2 weeks)

**Migration path:** `ImageProcessor` interface already abstracted - swap `Base64Processor` for `S3Processor`

---

### 2. Correction-Based Learning & Caching

**Current (MVP):** Store corrections in append-only log, no automation  
**Future:** Use stored corrections to improve accuracy and reduce API calls

**Phase 2a - Text Alias Automation:**
```python
# Simple text-based alias per user
user_aliases[user_id]["grain"] = "quinoa"
# Post-process Gemini responses with user's preferred names
```

**Phase 2b - Image Similarity Matching:**
```python
# Hash/embed images, find similar previous meals
if similar_image_exists(new_image, threshold=0.92):
    return cached_result  # Skip Gemini call
```

**Benefits:**
- 20-40% API cost reduction after 2-3 weeks
- Personalized accuracy improvement
- Faster responses for repeat meals

**Prerequisites:**
- 1000+ correction samples for validation
- Image embedding pipeline (CLIP or similar)
- Vector similarity search (Pinecone/pgvector)
- Cache invalidation strategy
- A/B test framework to measure accuracy impact

**Effort:** High (4-6 weeks)

**Risk:** Propagating cached errors - need confidence decay and periodic re-validation

---

### 3. Reference Object Calibration

**Current (MVP):** Plate-size heuristics with confidence-gated confirmation  
**Future:** Optional calibration flow with reference object (card/coin/finger)

**Benefits:**
- Portion accuracy improves from ±25-35% to ±10-15%
- One-time setup, persistent benefit
- Power users who want precision can opt-in

**Implementation:**
- Settings > "Improve Portion Accuracy"
- Guide user to photograph reference object
- Store calibration factor per user
- Apply calibration multiplier to all future estimates

**Prerequisites:**
- Calibration UI/UX design
- Reference object detection prompt for Gemini
- Per-user calibration storage
- Fallback logic if calibration is invalid

**Effort:** Medium (1-2 weeks)

---

### 4. Hybrid PID (Real-time hints + End-of-day summary)

**Current (MVP):** PID analysis after each confirmed meal  
**Future:** Quick hints per-meal + comprehensive daily summary

**Per-meal hint example:**
> "You're at 65% of your protein goal with one meal left today"

**End-of-day summary:**
> Full PID analysis with next-day recommendations

**Benefits:**
- More engaging UX
- Timely guidance when it matters
- Comprehensive daily reflection

**Prerequisites:**
- Lightweight PID prompt variant
- Daily summary trigger (time-based or user-initiated)
- Notification system for end-of-day summary

**Effort:** Medium (2-3 weeks)

---

### 5. HITL (Human-in-the-Loop) Review Queue

**Current (MVP):** Fallback to manual entry on repeated failures  
**Future:** Queue failed analyses for human review

**Benefits:**
- No data loss on edge cases
- Builds training dataset for hard cases
- Better user experience (delayed result vs. no result)

**Prerequisites:**
- Queue infrastructure (SQS/Redis)
- Review dashboard for operators
- Notification flow when review complete
- SLA definition (review within X hours)

**Effort:** High (3-4 weeks)

---

### 6. Goal & Condition-Based PID Intensity

**Current (MVP):** Moderate PID intensity for all users, Gemini outputs severity 0-1  
**Future:** Adjust intensity based on user goals and medical conditions

**Intensity Profiles:**
| Profile | Trigger | Behavior |
|---------|---------|----------|
| Gentle | Casual tracking, maintenance | Lower severity thresholds, softer language |
| Moderate | Default | Balanced feedback |
| Aggressive | Health conditions, strict goals | Higher urgency, stronger recommendations |

**Auto-escalation triggers:**
- User has flagged health conditions (diabetes, hypertension, kidney disease, etc.)
- User selected "strict" goal intensity in onboarding
- User is in active weight loss/gain phase with deadline
- Medical professional referral flag

**Implementation:**
```python
def calculate_effective_severity(base_severity: float, user: UserProfile) -> float:
    multiplier = 1.0
    if user.has_health_conditions:
        multiplier = 1.4
    elif user.goal_intensity == "strict":
        multiplier = 1.3
    elif user.goal_intensity == "relaxed":
        multiplier = 0.7
    return min(1.0, base_severity * multiplier)
```

**Prerequisites:**
- Health condition flags in user profile
- Goal intensity selection in onboarding
- Severity multiplier logic
- Adjusted copy templates for each intensity level

**Effort:** Low-Medium (1 week)

---

### 7. Adaptive Confidence Thresholds

**Current (MVP):** Fixed balanced thresholds (0.80/0.75 for auto-accept)  
**Future:** Per-user adaptive thresholds based on correction rate

**Logic:**
```python
# If user frequently corrects auto-accepted items, raise their threshold
if user_correction_rate > 0.15:
    user_thresholds.food_id_auto_accept += 0.05
```

**Benefits:**
- Optimizes friction/accuracy balance per user
- Self-tuning system
- Better UX for power users vs. casual users

**Prerequisites:**
- Correction rate tracking per user
- Threshold adjustment algorithm
- Min/max bounds to prevent extreme values
- A/B testing framework

**Effort:** Medium (2 weeks)

---

### 7. Offline Mode / Local Model

**Current (MVP):** Always online, Gemini API required  
**Future:** Lightweight local model for basic detection, sync when online

**Benefits:**
- Works without internet
- Lower latency for common foods
- Reduced API costs

**Prerequisites:**
- On-device ML framework (CoreML/TFLite)
- Model distillation from Gemini outputs
- Sync queue for offline meals
- Conflict resolution

**Effort:** Very High (2-3 months)

---

## 📊 Decision Log

| Date | Decision | Choice | Rationale |
|------|----------|--------|-----------|
| 2024-XX-XX | Image upload strategy | Direct base64 (A) | MVP simplicity, B-ready abstraction |
| 2024-XX-XX | Portion calibration | Heuristics + confidence (B) | Zero friction, confirmation catches uncertainty |
| 2024-XX-XX | Confidence thresholds | Balanced (B) | 0.80/0.75 auto-accept, good UX/accuracy balance |
| 2024-XX-XX | Gemini call granularity | Two calls (B) | Vision → Confirm → PID for accuracy |
| 2024-XX-XX | Retry strategy | Hybrid (D) | Retry network, repair parse, manual fallback |
| 2024-XX-XX | Correction storage | Store for training (C) | Capture data, no automation complexity |
| 2024-XX-XX | Image cost strategy | Smart compression (D) | 20-30% savings, consistent quality |
| 2024-XX-XX | Confirmation UI | Hybrid quick-tap + expand (D) | Fast confirm, full edit when needed |
| 2024-XX-XX | PID tuning | Moderate + Gemini severity | Gemini outputs 0-1, future goal/condition adjustment |
| 2024-XX-XX | Privacy consent | Layered (C) | Progressive disclosure, GDPR-friendly |

---

## 🔄 Review Schedule

- **Monthly:** Review correction logs, identify patterns
- **Quarterly:** Evaluate which enhancements to prioritize
- **Post-1000 users:** Re-evaluate caching/personalization ROI


