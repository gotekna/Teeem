# Phase 3: Blob Architecture - Master Todo List

> **Last Updated:** 2026-01-17
> **Status:** In Progress
> **Timeline:** 7 months
> **Recovery:** If session lost, resume from first unchecked item

---

## Quick Reference

### Email Storage
- **Stored as:** `{id}.eml` (e.g., "12345.eml") in S3
- **Subject in:** `email_warehouses.subject` column
- **Current:** Display & Send both show "12345.eml" (useless!)
- **Goal:** Display & Send BOTH use subject line:
  - Display Name: "RE: Invoice Question" (shown in UI)
  - Send Name: "RE Invoice Question - 2026-01-17.eml" (download)

### Two Names Per Document
| Name | Purpose | Example |
|------|---------|---------|
| **Display Name** | What user SEES in UI | "Accountant Advice" |
| **Send Name** | What file CALLED when downloaded/emailed | "TA Example 17-01-2026.pdf" |

### Current State (55% Complete)
- ✅ StorageBlob model with deduplication
- ✅ File Warehouse UI
- ✅ 4 models with storage_blob_id: corporate_company_documents, email_attachments, bill_inboxes, chat_messages
- ❌ 10+ models WITHOUT storage_blob_id: job_documents, people_documents, contact_documents, etc.
- ❌ Downloads don't use Send Name
- ❌ ActiveStorage still used by people_documents, contact_documents

---

## MONTH 1: Send Name in Downloads

### Week 1-2: S3 Download with Send Name

- [ ] **1.1** Update S3Compatible.download_url to accept filename
  ```
  File: backend/app/services/document_providers/s3_compatible.rb
  Line: 225
  Add: response_content_disposition parameter
  ```

- [ ] **1.2** Update DocumentStorageService.download_url to pass Send Name
  ```
  File: backend/app/services/document_storage_service.rb
  Line: 218
  Get Send Name from document's DocumentType template
  ```

- [ ] **1.3** Add send_name method to StorableDocument concern
  ```
  File: backend/app/models/concerns/storable_document.rb
  Add: expand template with document values
  Fallback: file_name if no template
  ```

### Week 3-4: Email Subject Token

- [ ] **1.4** Add {{Subject}} token for emails
  ```
  Find where tokens are defined (StorageConfiguration or similar)
  Map {{Subject}} → email_warehouse.subject
  ```

- [ ] **1.5** Update default Email Body Send Name template
  ```
  From: {{OriginalFileName}} (results in "12345.eml")
  To: {{Subject}} - {{Date}}.eml
  Result: "RE Invoice Question - 2026-01-17.eml"
  ```

- [ ] **1.6** Test all download scenarios
  - Corporate doc → DocumentType template
  - Email → Subject line
  - Job doc → file_name

---

## MONTH 2: Database Schema

### Week 1-2: Migrations

- [ ] **2.1** Migration: add storage_blob_id to job_documents
- [ ] **2.2** Migration: add storage_blob_id to people_documents
- [ ] **2.3** Migration: add storage_blob_id to contact_documents
- [ ] **2.4** Migration: add storage_blob_id to document_templates
- [ ] **2.5** Migration: add storage_blob_id to user_documents
- [ ] **2.6** Migration: add storage_blob_id to purchase_order_documents
- [ ] **2.7** Migration: add storage_blob_id to case_documents

### Week 3-4: Model Updates

- [ ] **2.8** JobDocument: add belongs_to :storage_blob
- [ ] **2.9** PeopleDocument: add belongs_to, REMOVE has_one_attached
- [ ] **2.10** ContactDocument: add belongs_to, REMOVE has_one_attached
- [ ] **2.11** Update remaining 5 document models

---

## MONTH 3: StorableDocument Concern (SSoT)

- [ ] **3.1** Create/update StorableDocument concern with:
  - storage_location (blob path or legacy path)
  - send_name (expanded template)
  - display_name_resolved (UI display)

- [ ] **3.2** Add expand_send_name_template method

- [ ] **3.3** Include in all document models:
  - [ ] CorporateCompanyDocument
  - [ ] JobDocument
  - [ ] PeopleDocument
  - [ ] ContactDocument
  - [ ] EmailAttachment
  - [ ] DocumentTemplate
  - [ ] UserDocument
  - [ ] PurchaseOrderDocument
  - [ ] CaseDocument

---

## MONTH 4: Bulk Migration

- [ ] **4.1** Create blob:migrate:job_documents rake task
- [ ] **4.2** Create blob:migrate:people_documents rake task
- [ ] **4.3** Create blob:migrate:contact_documents rake task
- [ ] **4.4** Create blob:migrate:all master task
- [ ] **4.5** Run on staging (~60k records)
- [ ] **4.6** Run on production

---

## MONTH 5: Remove ActiveStorage

- [ ] **5.1** Verify all PeopleDocument have storage_blob_id
- [ ] **5.2** Verify all ContactDocument have storage_blob_id
- [ ] **5.3** Remove has_one_attached from PeopleDocument
- [ ] **5.4** Remove has_one_attached from ContactDocument
- [ ] **5.5** Clean up orphaned ActiveStorage blobs

---

## MONTH 6: Garbage Collection

- [ ] **6.1** Create blob:cleanup:orphaned rake task
- [ ] **6.2** Create blob:audit:reference_counts task
- [ ] **6.3** Add Heroku Scheduler for weekly cleanup
- [ ] **6.4** Add monitoring for orphan growth

---

## MONTH 7: Testing & Polish

- [ ] **7.1** Deduplication test (same file → 1 blob)
- [ ] **7.2** Download rename test (Send Name works)
- [ ] **7.3** Folder move test (instant, no S3 copy)
- [ ] **7.4** Garbage collection test
- [ ] **7.5** Performance test (10k files < 500ms)
- [ ] **7.6** Update CLAUDE.md documentation

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/services/document_providers/s3_compatible.rb` | S3 download URL generation |
| `backend/app/services/document_storage_service.rb` | Storage abstraction layer |
| `backend/app/models/concerns/storable_document.rb` | SSoT for document storage |
| `backend/app/models/storage_blob.rb` | Blob deduplication model |
| `backend/app/models/job_document.rb` | Needs storage_blob_id |
| `backend/app/models/people_document.rb` | Needs storage_blob_id, remove ActiveStorage |
| `backend/app/models/contact_document.rb` | Needs storage_blob_id, remove ActiveStorage |

---

## Recovery Points

| Checkpoint | What's Done |
|------------|-------------|
| Month 1 | Downloads use Send Name |
| Month 2 | All models have storage_blob_id column |
| Month 3 | StorableDocument concern is SSoT |
| Month 4 | Existing documents migrated to blobs |
| Month 5 | ActiveStorage removed |
| Month 6 | Garbage collection running |
| Month 7 | Tested and documented |

---

## Notes

### Why Blob Architecture?
1. **Deduplication** - Same file sent to 100 people = 1 storage copy
2. **Lightning fast folders** - Moving files is instant (DB update only)
3. **Send Name** - Files download with proper names, not blob keys

### Email Storage Details
```
Table: email_warehouses
- subject: "RE: Invoice Question"
- storage_path: "Emails/2026/01/12345.eml"

Current: Downloads as "12345.eml"
Goal: Downloads as "RE Invoice Question - 2026-01-17.eml"
```
