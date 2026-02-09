# Dead Columns & Tables Report v2 — 2026-02-09

**Environment:** Staging (teeem-staging) hitting production database
**Tool:** `rails db:dead_all` (v2 with model/Foundation/camelCase safeguards)
**Date:** 9 February 2026
**Branch:** Staging

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Tables in schema | 471 |
| Framework tables skipped | 12 |
| Tables with model files (skipped) | 434 |
| Tables with code refs (skipped) | 15 |
| **Truly orphaned tables** | **10** |
| Columns checked | 1,930 |
| Skipped (universal) | 1,119 |
| Skipped (belongs_to FK) | 957 |
| Skipped (Foundation column) | 2,242 |
| Skipped (ambiguous name) | 790 |
| Skipped (has code refs) | 1,858 |
| **Flagged columns** | **72** |

**v1 to v2 improvement:** 4,454 flagged columns to 72 (98% false positive reduction). 125 "dead" tables to 10.

---

## Dead Tables

### Truly Orphaned (No model, no Foundation, no code refs, no data) — 4 tables

| Table | Columns |
|-------|---------|
| document_activities | 8 |
| document_verification_feedbacks | 17 |
| job_people | 7 |
| page_help_contents | 12 |

### Orphaned But Has Data (No model/Foundation/code, but has rows) — 6 tables

| Table | Columns | Rows |
|-------|---------|------|
| folder_template_items | 8 | 83 |
| health_check_caches | 6 | 37 |
| user_job_tab_configs | 7 | 18 |
| xero_feature_tabs | 13 | 17 |
| foundation_trading_names | 7 | 2 |
| table_protections | 5 | 2 |

### INFO: 242 tables have a model but 0 rows (unused features, NOT dead)

These are real features (GL accounting, assets, BPMN, etc.) that have been built but not yet used. Correctly excluded from dead table detection.

---

## Dead Columns

### HIGH CONFIDENCE — Orphaned table columns with stale data (4 columns)

These columns are on tables with NO model file. The data is genuinely stale.

| Table | Column | Rows with Data |
|-------|--------|---------------|
| job_documents | cad_metadata | 55 |
| plan_identifications | ocr_structured_fields | 32 |
| user_job_tab_configs | job_tab_id | 18 |
| table_protections | is_protected | 2 |

### HIGH CONFIDENCE — Orphaned table columns, empty (15 columns across 7 tables)

| Table | Dead Columns |
|-------|-------------|
| case_documents | 1 |
| document_duplicate_reviews | 1 |
| document_verification_feedbacks | 5 |
| job_documents | 1 |
| page_help_contents | 5 |
| plan_identifications | 1 |
| user_job_tab_configs | 1 |

### MEDIUM CONFIDENCE — Active table columns with stale data (4 columns)

These tables have model files but these specific columns have 0 code references. Could be replaced columns with stale data.

| Table | Column | Rows with Data |
|-------|--------|---------------|
| external_invoices | payment_portal_enabled | 6,371 |
| external_invoices | payment_reminder_count | 6,371 |
| external_invoices | source_of_truth | 6,371 |
| ai_service_configs | extra_config | 5 |

### MEDIUM CONFIDENCE — Active table columns, empty (42 columns)

Likely scaffolded but never populated. Low priority.

| Table | Columns |
|-------|---------|
| ato_effective_life_rates | division_43_category |
| bill_payment_batches | bank_response, self_balancing_reference |
| bill_payments | remittance_email, remittance_sent_at, send_remittance |
| columns | override_validation_message |
| company_approval_rules | escalation_hours |
| e_signature_certificates | certificate_storage_file_id |
| e_signature_signers | browser_fingerprint |
| email_aliases | polaris_alias_id |
| email_subscriptions | stripe_payment_method_id |
| email_sync_statuses | oldest_email_synced, sync_cursor |
| external_invoices | last_payment_reminder_at |
| geofence_events | notification_sent |
| gl_equipment_usages | end_meter, start_meter |
| gl_invoice_lines | external_line_id |
| gl_invoices | payment_token_expires_at, sync_metadata |
| gl_report_runs | export_file_id |
| gl_tpar_payees | abn_withheld |
| insurance_policies | cover_type, insured_party, monthly_premium |
| people_documents | document_number, issuing_authority, issuing_country, legacy_corporate_document_id |
| polaris_credentials | reseller_id |
| sm_task_photos | exif_timestamp, face_match_confidence, face_verification_result, site_visibility_score, site_visible, weather_detected |
| stripe_configurations | stripe_account_id, webhook_endpoint_id |
| synced_emails | user_classification_at, user_classification_by_id |
| tenant_settings | billing_address |

---

## Recommendations

### Immediate (safe)
1. **Drop 4 truly orphaned empty tables** — `document_activities`, `document_verification_feedbacks`, `job_people`, `page_help_contents` — no model, no code, no Foundation, no data

### Short-term
2. **Investigate 6 orphaned tables with data** — especially `folder_template_items` (83 rows) and `health_check_caches` (37 rows)
3. **Review `external_invoices` medium-confidence columns** — `payment_portal_enabled`, `payment_reminder_count`, `source_of_truth` all have 6,371 rows but no code refs

### Low priority
4. **42 empty medium-confidence columns** — scaffolded-but-unused columns on active models, no urgency

---

## v2 Safeguards

| Safeguard | Effect |
|-----------|--------|
| Model file check | 434 tables with models excluded from dead table detection |
| Foundation column exclusion | 2,242 column instances excluded (dynamically accessed via Foundation API) |
| camelCase search | Frontend patterns like `folderPath` matched for `folder_path` columns |
| Confidence levels | HIGH = orphaned table, MEDIUM = active table with unused column |
| No "safe to drop" language | Results require human review before any action |
