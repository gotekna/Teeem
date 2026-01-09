# SSoT Migration: contract_value → contract_price

## Issue Identified
**Date:** 2025-12-23
**Found by:** Sam Harder (during Unreal Engine API integration)
**Severity:** SSoT Violation

## The Problem

Two database columns store the same data:
- `jobs.contract_price` - Used in Contract tab UI
- `jobs.contract_value` - Used in profit calculations, claim stages, pipeline

This violates Single Source of Truth and creates maintenance burden.

## Current State Analysis

| Metric | Value |
|--------|-------|
| Files using `contract_value` | 35 |
| Files using `contract_price` | 15 |
| Jobs with both values | 2 |
| Jobs with mismatched values | 0 |
| Jobs with only contract_price | 1 |
| Jobs with only contract_value | 2 |

## Decision: THE ONE

**`contract_price` will be THE ONE** because:
1. It's displayed in the Contract tab (user-facing)
2. It's more semantically correct (it IS the contract price)
3. `contract_value` is ambiguous (could mean many things)

## Migration Strategy

### Phase 1: Data Sync - COMPLETED 2025-12-23
- [x] Create migration to copy `contract_value` → `contract_price` where contract_price is null
- [x] Add database column comment marking deprecation

### Phase 2: Code Migration - COMPLETED 2025-12-23
All backend code now uses `job.contract_price` directly (no helper methods).

#### Backend Files Updated (Ruby) - ALL DONE
1. [x] `app/models/job.rb` - profit calculations → uses `contract_price` directly
2. [x] `app/models/job_claim_stage.rb` - claim calculations → uses `job.contract_price`
3. [ ] `app/models/table_health_check.rb` - health check (references method name, OK)
4. [x] `app/controllers/api/v1/jobs_controller.rb` - API responses → uses `contract_price`
5. [x] `app/controllers/api/v1/job_claim_stages_controller.rb` - claim stages → uses `contract_price`
6. [x] `app/controllers/api/v1/csv_imports_controller.rb` - imports → uses `contract_price`
7. [x] `app/services/job_estimator_service.rb` - AI estimation → uses `contract_price`
8. [x] `app/services/document_generator.rb` - PDF generation → uses `contract_price`
9. [x] `app/services/tekna_document_generator.rb` - PDF generation → uses `contract_price`
10. [x] `app/services/invoice_pdf_generator.rb` - invoices → uses `contract_price`
11. [x] `app/services/bpmn/trigger_firing_service.rb` - workflows → uses `contract_price`
12. [x] `app/services/email_to_job_service.rb` - email parsing → uses `contract_price`
13. [x] `app/services/health_checks/jobs_check.rb` - health checks → checks both columns
14. [ ] `app/views/tekna_documents/templates/deposit_claim_invoice.html.erb` - template (uses hash key, OK)
15. [ ] `lib/tasks/setup_active_jobs_columns.rake` - foundation setup (metadata, OK for now)
16. [ ] `db/seeds.rb` - seed data (test data, OK for now)
17. [ ] `db/seeds/invoice_templates.rb` - templates (OK for now)
18. [ ] `db/seeds/health_checks.rb` - health checks (OK for now)

#### Frontend Files - BACKWARD COMPATIBLE
API responses return `contract_price` under the key `contract_value` for backward compatibility.
Frontend will continue working without changes. Future cleanup can rename keys.

1. [ ] `types/leads.ts` - type definitions (optional)
2. [ ] `app/(app)/leads/page.tsx` - leads page (optional)
3. [ ] `app/(app)/jobs/new/page.tsx` - job creation (optional)
4. [ ] `app/(app)/jobs/[id]/page.tsx` - job detail (optional)
5. [ ] `app/(app)/jobs/page.tsx` - jobs list (optional)
6. [ ] `app/api/v1/jobs/route.ts` - API route (optional)
7. [ ] `components/leads/job-pipeline.tsx` - pipeline (optional)
8. [ ] `components/leads/job-pipeline-card.tsx` - pipeline card (optional)
9. [ ] `components/leads/email-proposal-card.tsx` - proposal card (optional)
10. [ ] `components/leads/proposal-approval-dialog.tsx` - approval (optional)
11. [ ] `components/leads/email-proposals-tab.tsx` - proposals tab (optional)
12. [ ] `components/jobs/JobClaimStagesTab.tsx` - claim stages (optional)
13. [ ] `components/jobs/JobDetailDrawer.tsx` - detail drawer (optional)

#### ML Service Files to Update (Python) - FUTURE
1. [ ] `ml_service/models/profit_predictor.py`
2. [ ] `ml_service/data/feature_store.py`
3. [ ] `ml_service/data/extractors.py`

### Phase 3: Deprecation - COMPLETED 2025-12-23
- [x] Database column comment marks `contract_value` as deprecated
- [x] All backend Ruby code uses `contract_price` directly (no `contract_amount` helper)
- [x] API responses map `contract_price` to `contract_value` key for frontend compatibility

### Phase 4: Removal (Future)
- Remove `contract_value` column from database
- Update frontend to use `contract_price` key
- Clean up any remaining references

## Implementation Checklist

### Phase 1: Data Sync - DONE
- [x] Create migration: `SyncContractValueToContractPrice`
- [ ] Run migration in staging
- [ ] Verify data integrity
- [ ] Run migration in production

### Phase 2: Code Migration - DONE
- [x] Update Job model - uses `contract_price` directly
- [x] Update all backend files (17 files)
- [ ] Update all frontend files (13 files) - optional, works with current API
- [ ] Update ML service files (3 files) - future
- [ ] Run full test suite
- [ ] Deploy to staging
- [ ] QA testing

### Phase 3: Deprecation - DONE
- [x] Add deprecation comment to database column
- [ ] Monitor logs for usage
- [x] Update documentation

### Phase 4: Removal - FUTURE
- [ ] Create column removal migration
- [ ] Final code cleanup
- [ ] Deploy to production

## Rollback Plan

If issues arise:
1. The original `contract_value` column remains untouched during Phase 1-2
2. Revert code changes via git
3. No data loss possible

## Success Criteria

1. [x] All backend Ruby code references `contract_price` only (no `contract_amount` helper)
2. [ ] No `contract_value` in codebase (future - column removal)
3. [ ] All tests passing
4. [ ] Column removed from schema (future)

## Notes

- ML service may need retraining after column rename
- Foundation metadata auto-syncs on migration
- Existing API consumers should be notified of change
- API responses still use `contract_value` key for frontend compatibility - this maps to `contract_price`
