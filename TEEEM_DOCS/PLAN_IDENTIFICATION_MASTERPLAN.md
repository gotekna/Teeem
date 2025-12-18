# Plan Identification System - Grand Master Plan

## Vision

**100% reliable, self-healing plan identification** that correctly categorizes every architectural drawing with zero human intervention.

## Current State (Problems)

```
❌ SSoT VIOLATIONS:
├── PlanSetService.extract_sheet_info_with_ai
├── PlanAiAnalysisJob.find_plan_type_for_sheet
└── JobPlansController.find_plan_type_for_sheet  ← DUPLICATE!

❌ RELIABILITY ISSUES:
├── AI-only approach can hallucinate
├── No confidence scoring
├── No fallback when AI fails
└── No learning from corrections
```

## Target State (6-Month Vision)

```
✅ SINGLE SOURCE OF TRUTH:
└── PlanIdentificationService (THE ONE)

✅ HYBRID PIPELINE:
├── Layer 1: OCR Extract (fast, deterministic)
├── Layer 2: Pattern Match (rule-based, auditable)
├── Layer 3: AI Validate (smart, contextual)
└── Layer 4: Human Override (learning feedback)

✅ CONFIDENCE SCORING:
├── Each layer contributes a score
├── Combined score determines action
└── Low confidence → flags for review

✅ SELF-HEALING:
├── Tracks all decisions with reasoning
├── Human corrections feed back to improve
└── Detects patterns in mistakes
```

---

## Architecture

### The Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PLAN IDENTIFICATION PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PDF Page Input                                                              │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ LAYER 1: OCR EXTRACTION                                              │    │
│  │ ─────────────────────────────────────────────────────────────────── │    │
│  │ • Extract ALL text from PDF (preserve positions)                    │    │
│  │ • Identify title block region (bottom-right, right edge)            │    │
│  │ • Extract structured fields:                                        │    │
│  │   - Sheet number (e.g., "A-101", "01", "S3")                        │    │
│  │   - Sheet name/title (e.g., "GROUND FLOOR PLAN")                    │    │
│  │   - Date, Revision, Scale                                           │    │
│  │ • Output: { raw_text, structured_fields, confidence }               │    │
│  │ • Technology: Tesseract OCR + PDF text extraction                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ LAYER 2: PATTERN MATCHING                                            │    │
│  │ ─────────────────────────────────────────────────────────────────── │    │
│  │ • Match extracted text against PlanType names                       │    │
│  │ • Fuzzy matching with Levenshtein distance                          │    │
│  │ • Keyword extraction ("floor", "elevation", "site", etc.)           │    │
│  │ • Rule-based scoring:                                               │    │
│  │   - Exact match: 100%                                               │    │
│  │   - Fuzzy match (>90% similar): 85%                                 │    │
│  │   - Keyword match: 70%                                              │    │
│  │   - No match: 0%                                                    │    │
│  │ • Output: { plan_type_id, confidence, match_reason }                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ LAYER 3: AI VALIDATION (if confidence < 85%)                         │    │
│  │ ─────────────────────────────────────────────────────────────────── │    │
│  │ • Only triggered when pattern matching is uncertain                 │    │
│  │ • Sends to Claude Vision:                                           │    │
│  │   - PDF page image                                                  │    │
│  │   - OCR extracted text                                              │    │
│  │   - Available plan types list                                       │    │
│  │   - Pattern match suggestion + confidence                           │    │
│  │ • AI confirms, corrects, or flags for human review                  │    │
│  │ • Output: { plan_type_id, confidence, ai_reasoning }                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ LAYER 4: DECISION ENGINE                                             │    │
│  │ ─────────────────────────────────────────────────────────────────── │    │
│  │ • Combines all layer outputs                                        │    │
│  │ • Weighted confidence calculation                                   │    │
│  │ • Decision matrix:                                                  │    │
│  │   - Confidence ≥ 95%: Auto-assign, no review needed                 │    │
│  │   - Confidence 80-94%: Auto-assign, flag for spot-check             │    │
│  │   - Confidence 60-79%: Auto-assign, queue for review                │    │
│  │   - Confidence < 60%: Don't assign, require human review            │    │
│  │ • Stores full decision audit trail                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ LAYER 5: LEARNING FEEDBACK LOOP                                      │    │
│  │ ─────────────────────────────────────────────────────────────────── │    │
│  │ • Human corrections are captured                                    │    │
│  │ • Patterns in corrections analyzed                                  │    │
│  │ • New rules added to pattern matching                               │    │
│  │ • AI prompt improved based on common mistakes                       │    │
│  │ • Monthly accuracy reports generated                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### New Tables

```ruby
# plan_identifications - Audit trail for every identification decision
create_table :plan_identifications do |t|
  t.references :job_plan, null: false, foreign_key: true
  t.references :identified_plan_type, foreign_key: { to_table: :plan_types }
  t.references :identified_plan_category, foreign_key: { to_table: :plan_categories }

  # OCR Layer Results
  t.text :ocr_raw_text
  t.jsonb :ocr_structured_fields  # { sheet_number, sheet_name, date, revision }
  t.integer :ocr_confidence       # 0-100

  # Pattern Match Layer Results
  t.integer :pattern_match_plan_type_id
  t.integer :pattern_match_confidence  # 0-100
  t.string :pattern_match_reason       # "exact_match", "fuzzy_match", "keyword_match"

  # AI Layer Results (nullable - only when AI was invoked)
  t.integer :ai_plan_type_id
  t.integer :ai_confidence         # 0-100
  t.text :ai_reasoning
  t.boolean :ai_invoked, default: false

  # Final Decision
  t.integer :final_confidence      # 0-100 weighted average
  t.string :decision_status        # "auto_assigned", "flagged_review", "needs_human"
  t.boolean :human_reviewed, default: false
  t.references :reviewed_by, foreign_key: { to_table: :users }
  t.datetime :reviewed_at

  # Human Override (for learning)
  t.integer :human_override_plan_type_id
  t.text :human_override_reason

  t.timestamps
end

# plan_identification_rules - Learned rules from human corrections
create_table :plan_identification_rules do |t|
  t.string :rule_type          # "keyword", "pattern", "exclusion"
  t.string :match_text         # The text to match
  t.references :plan_type, foreign_key: true
  t.integer :priority          # Higher = checked first
  t.integer :success_count     # How many times this rule succeeded
  t.integer :failure_count     # How many times this rule was overridden
  t.boolean :is_active, default: true
  t.references :created_by, foreign_key: { to_table: :users }

  t.timestamps
end
```

---

## Service Architecture (SSoT)

### THE ONE Service

```ruby
# app/services/plan_identification_service.rb
#
# THE SINGLE SOURCE OF TRUTH for plan identification.
# All plan type/category identification MUST go through this service.
#
# Usage:
#   result = PlanIdentificationService.identify(pdf_content, job)
#   result = PlanIdentificationService.identify_from_text(extracted_text, job)
#   result = PlanIdentificationService.reidentify(job_plan)
#
class PlanIdentificationService
  # Configuration
  AUTO_ASSIGN_THRESHOLD = 95      # Auto-assign without review
  SPOT_CHECK_THRESHOLD = 80       # Auto-assign but flag for spot-check
  REVIEW_THRESHOLD = 60           # Auto-assign but queue for review
  HUMAN_REQUIRED_THRESHOLD = 60   # Below this, require human

  class Result
    attr_accessor :plan_type, :plan_category, :job_plan_tab,
                  :confidence, :status, :audit_record,
                  :display_name, :short_name
  end

  def self.identify(pdf_content, job)
    new(job).identify_from_pdf(pdf_content)
  end

  def self.identify_from_text(text, job)
    new(job).identify_from_text(text)
  end

  def self.reidentify(job_plan)
    new(job_plan.job).reidentify_plan(job_plan)
  end

  private

  def identify_from_pdf(pdf_content)
    # Layer 1: OCR
    ocr_result = OcrExtractionLayer.extract(pdf_content)

    # Layer 2: Pattern Match
    pattern_result = PatternMatchingLayer.match(ocr_result, @plan_types)

    # Layer 3: AI (if needed)
    ai_result = nil
    if pattern_result.confidence < SPOT_CHECK_THRESHOLD
      ai_result = AiValidationLayer.validate(pdf_content, ocr_result, pattern_result, @plan_types)
    end

    # Layer 4: Decision
    decision = DecisionEngine.decide(ocr_result, pattern_result, ai_result)

    # Layer 5: Record for learning
    audit = create_audit_record(ocr_result, pattern_result, ai_result, decision)

    build_result(decision, audit)
  end
end
```

### Layer Services

```ruby
# app/services/plan_identification/ocr_extraction_layer.rb
# app/services/plan_identification/pattern_matching_layer.rb
# app/services/plan_identification/ai_validation_layer.rb
# app/services/plan_identification/decision_engine.rb
# app/services/plan_identification/learning_engine.rb
```

---

## Implementation Phases

### Phase 1: Foundation (Month 1-2)
- [ ] Create `PlanIdentificationService` skeleton
- [ ] Migrate existing code into service
- [ ] Create `plan_identifications` table
- [ ] Remove duplicate code from controllers/jobs
- [ ] All identification goes through THE ONE service
- [ ] Basic audit trail working

### Phase 2: OCR Layer (Month 2-3)
- [ ] Add Tesseract OCR gem
- [ ] PDF text extraction (native PDF text)
- [ ] Title block region detection
- [ ] Structured field extraction
- [ ] OCR confidence scoring
- [ ] Unit tests with sample plans

### Phase 3: Pattern Matching (Month 3-4)
- [ ] Levenshtein fuzzy matching
- [ ] Keyword extraction and matching
- [ ] Rule-based scoring system
- [ ] `plan_identification_rules` table
- [ ] Admin UI to view/edit rules
- [ ] Pattern match confidence scoring

### Phase 4: AI Enhancement (Month 4-5)
- [ ] Structured AI prompts with plan types list
- [ ] AI confirms/corrects pattern match
- [ ] AI reasoning capture
- [ ] Cost tracking (only invoke when needed)
- [ ] AI confidence scoring
- [ ] Fallback handling when AI fails

### Phase 5: Learning Loop (Month 5-6)
- [ ] Human correction capture
- [ ] Automatic rule generation from corrections
- [ ] Monthly accuracy reports
- [ ] Dashboard for identification metrics
- [ ] Alert when accuracy drops
- [ ] A/B testing new rules

---

## Success Metrics

| Metric | Current | Month 3 | Month 6 |
|--------|---------|---------|---------|
| Auto-assign accuracy | ~70% | 85% | 98% |
| Human review required | ~30% | 15% | 2% |
| Time to identify (avg) | 5s | 2s | 1s |
| Cost per identification | $0.02 | $0.01 | $0.005 |
| SSoT compliance | 33% | 100% | 100% |

---

## SSoT Enforcement

### Code that MUST use PlanIdentificationService:

| Current Location | Action |
|-----------------|--------|
| `PlanSetService.extract_sheet_info_with_ai` | → Call `PlanIdentificationService` |
| `PlanAiAnalysisJob.find_plan_type_for_sheet` | → DELETE, use service |
| `JobPlansController.find_plan_type_for_sheet` | → DELETE, use service |
| `PlanSetUploadJob` | → Call `PlanIdentificationService` |
| Any future plan identification | → MUST use service |

### Guard Rails

```ruby
# Add to JobPlan model
class JobPlan < ApplicationRecord
  # Ensure plan_type changes go through the service
  before_save :validate_identification_source, if: :plan_type_id_changed?

  private

  def validate_identification_source
    unless @identified_via_service
      Rails.logger.warn "[SSoT VIOLATION] plan_type_id changed without PlanIdentificationService"
      # In production, could raise error to enforce
    end
  end
end
```

---

## File Structure

```
app/
├── services/
│   └── plan_identification/
│       ├── plan_identification_service.rb    # THE ONE (orchestrator)
│       ├── ocr_extraction_layer.rb           # Layer 1
│       ├── pattern_matching_layer.rb         # Layer 2
│       ├── ai_validation_layer.rb            # Layer 3
│       ├── decision_engine.rb                # Layer 4
│       ├── learning_engine.rb                # Layer 5
│       └── result.rb                         # Result object
├── models/
│   ├── plan_identification.rb                # Audit trail
│   └── plan_identification_rule.rb           # Learned rules
└── jobs/
    └── plan_identification_job.rb            # Background processing
```

---

## Dependencies

| Gem | Purpose |
|-----|---------|
| `rtesseract` | OCR text extraction |
| `pdf-reader` | Native PDF text extraction |
| `mini_magick` | PDF to image conversion |
| `levenshtein` | Fuzzy string matching |
| `anthropic` | Claude AI API |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| OCR fails on scanned plans | AI layer as fallback |
| AI hallucination | Pattern match as primary, AI only validates |
| New plan types not recognized | Learning loop adds rules automatically |
| Performance degradation | OCR/pattern match are fast, AI only when needed |
| Cost blowout from AI | Confidence threshold reduces AI calls by 80% |

---

## Approval

This plan requires 6 months and creates a **bulletproof, self-healing, learning system** for plan identification.

**Key principles:**
1. **SSoT** - One service, one place to change
2. **Layered** - Each layer can work independently
3. **Auditable** - Every decision is recorded with reasoning
4. **Learning** - Gets smarter from human corrections
5. **Reliable** - Multiple fallbacks, confidence scoring

Ready to proceed?
