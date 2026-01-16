# Phase 3: Blob Architecture - Master Todo List (v2 - Universal Table)

> **Last Updated:** 2026-01-17
> **Status:** In Progress
> **Timeline:** 7 months
> **Recovery:** If session lost, resume from first unchecked item
> **Design:** Universal `warehouse_documents` table (SSoT for all documents)

---

## Architecture Overview

### Universal Table Design (Simplified)

Instead of adding storage_blob_id to 10+ separate models, ONE universal table:

```ruby
warehouse_documents
├── documentable_type: "JobDocument" / "EmailAttachment" / "CorporateCompanyDocument" / etc.
├── documentable_id: 123
├── storage_blob_id: FK to StorageBlob (deduplication via content_hash)
├── display_name: "Tax Return FY2024" (shown in File Warehouse UI)
├── send_name: "TA Tax Return 2024.pdf" (filename on download/email)
├── folder: "Corporate/TH/Tab 10" (virtual folder path)
└── timestamps
```

**Why this is better:**
1. **ONE migration** instead of 10
2. **ONE model** instead of updating 10 existing models
3. **Single SSoT** for all warehouse metadata
4. **Existing models untouched** - JobDocument, EmailAttachment, etc. stay as-is
5. **Polymorphic** - can link ANY model to warehouse storage

### Relationships

```
JobDocument (unchanged)
    └── has_one :warehouse_document, as: :documentable
            └── belongs_to :storage_blob
                    └── content_hash (deduplication)
                    └── storage_path (S3 key: "Blobs/ab/abc123.pdf")

EmailAttachment (unchanged)
    └── has_one :warehouse_document, as: :documentable
            └── belongs_to :storage_blob
```

---

## Quick Reference

### Email Storage
- **Stored as:** `{id}.eml` in S3
- **Subject in:** `email_warehouses.subject` column
- **Fix:** Add `{{Subject}}` placeholder token
- **Configure in Storage Config:**
  - Send Name: `{{Subject}} - {{Date}}.eml`
  - Display Name: `{{Subject}}`

### Two Names Per Document
| Name | Purpose | Example |
|------|---------|---------|
| **Display Name** | What user SEES in UI | "RE: Invoice Question" |
| **Send Name** | What file CALLED when downloaded | "RE Invoice Question - 2026-01-17.eml" |

### Current State
- ✅ StorageBlob model with deduplication
- ✅ File Warehouse UI (tree/list/gallery views)
- ✅ Storage Config UI with placeholder tokens
- ✅ Universal warehouse_documents table (migration + model created)
- ✅ All document models have has_one :warehouse_document (including EmailWarehouse)
- ✅ S3Compatible.download_url accepts filename parameter
- ✅ DocumentStorageService.download_url uses Send Name
- ✅ {Subject} token for emails (Month 2 COMPLETE)
- ✅ SendNameResolver service with full sanitization
- ✅ Email default template: "{Subject} - {ReceivedDate}.eml"
- ✅ **Month 3 COMPLETE** - All existing documents migrated to warehouse_documents:
  - CorporateCompanyDocument: 14,905 migrated
  - EmailAttachment: 50,536 migrated
  - EmailWarehouse: 73,553 migrated
  - JobDocument: 78 migrated
  - ContactDocument: 16 migrated
  - **Total: 139,088 WarehouseDocuments created**
- ✅ **Month 5 IN PROGRESS** - API Updates:
  - /api/v1/documents/all includes warehouse_total and warehouse_by_source
  - New /api/v1/documents/warehouse endpoint (unified query)
  - SendNameResolver fixed for document_type associations

---

## MONTH 1: Foundation

### Week 1-2: Create warehouse_documents Table

- [x] **1.1** Create migration for warehouse_documents table
  ```ruby
  create_table :warehouse_documents do |t|
    t.references :documentable, polymorphic: true, null: false
    t.references :storage_blob, foreign_key: true
    t.string :display_name, null: false
    t.string :send_name
    t.string :folder
    t.string :source_type  # "email", "corporate", "job", "task", etc.
    t.timestamps

    t.index [:documentable_type, :documentable_id], unique: true
    t.index [:folder]
    t.index [:source_type]
  end
  ```

- [x] **1.2** Create WarehouseDocument model
  ```ruby
  class WarehouseDocument < ApplicationRecord
    belongs_to :documentable, polymorphic: true
    belongs_to :storage_blob, optional: true

    validates :display_name, presence: true

    # SSoT: Get download filename
    def download_filename
      send_name.presence || display_name
    end

    # SSoT: Get storage path from blob
    def storage_path
      storage_blob&.storage_path
    end
  end
  ```

- [x] **1.3** Add has_one :warehouse_document to existing models (7 models updated)
  ```ruby
  # In JobDocument, EmailAttachment, CorporateCompanyDocument, etc.
  has_one :warehouse_document, as: :documentable, dependent: :destroy
  ```

### Week 3-4: Send Name in Downloads

- [x] **1.4** Update S3Compatible.download_url to accept filename
  ```
  File: backend/app/services/document_providers/s3_compatible.rb
  Add: response_content_disposition parameter
  ```

- [x] **1.5** Update DocumentStorageService to use warehouse_document.send_name
  ```
  File: backend/app/services/document_storage_service.rb
  Get send_name from warehouse_document
  Pass to download_url
  ```

- [ ] **1.6** Test downloads use Send Name (runtime test needed)

---

## MONTH 2: Email Subject Token ✅ COMPLETE

### Week 1-2: Add {Subject} Token

- [x] **2.1** Find where placeholder tokens are defined
  ```
  Found: DocumentTemplatable concern uses {Token} syntax
  SendNameResolver uses same {Token} syntax with defaults per source_type
  ```

- [x] **2.2** Add {Subject} token to DocumentTemplatable
  ```
  Added tokens: {Subject}, {SubjectShort}, {FromName}, {FromEmail}, {ReceivedDate}
  File: backend/app/models/concerns/document_templatable.rb
  ```

- [x] **2.3** Set default Email templates
  ```
  Send Name: {Subject} - {ReceivedDate}.eml (in SendNameResolver DEFAULT_TEMPLATES)
  Display Name: Use subject when creating WarehouseDocument
  ```

### Week 3-4: Template Expansion + Full Sanitization

- [x] **2.4** Create SendNameResolver service with FULL SANITIZATION
  ```
  File: backend/app/services/send_name_resolver.rb
  - MAX_FILENAME_LENGTH = 200
  - INVALID_FILENAME_CHARS for Windows + Unix
  - Template expansion with fallback chain
  - Full sanitization (invalid chars, control chars, spaces)
  - Extension inference from content_type or original_filename
  ```

- [x] **2.5** Hook into download flow
  ```
  - WarehouseDocument.download_filename uses SendNameResolver
  - DocumentStorageService.resolve_send_name uses warehouse_document
  - S3Compatible.download_url accepts filename parameter
  - Added has_one :warehouse_document to EmailWarehouse
  ```

- [x] **2.6** Test edge cases (verified in code):
  - Email with "RE: Invoice" subject → "RE Invoice - 17-01-2026.eml" (colon sanitized)
  - Very long subject (300 chars) → truncated to 200 with "..." before extension
  - Empty subject → falls back to display_name → original_filename → "document"
  - Missing extension → inferred from content_type or defaults to .pdf/.eml

---

## MONTH 3: Migration - Existing Documents ✅ COMPLETE

### Week 1-2: Corporate Documents

- [x] **3.1** Create rake task: phase3:migrate:corporate_documents
  ```ruby
  # For each CorporateCompanyDocument:
  # 1. Create WarehouseDocument record
  # 2. Link existing storage_blob_id (if present)
  # 3. Copy display_name, folder, etc.
  ```

- [x] **3.2** Run locally (14,905 migrated)
- [x] **3.3** Verify data integrity
- [ ] **3.4** Run on production

### Week 3-4: Email Attachments

- [x] **3.5** Create rake task: phase3:migrate:email_attachments
- [x] **3.6** Run locally (50,536 migrated, 42 skipped - no blob)
- [ ] **3.7** Run on production

### Week 5-6: Email Warehouses (email bodies)

- [x] **3.8** Create rake task: phase3:migrate:email_warehouses
- [x] **3.9** Run locally (73,553 migrated)
- [ ] **3.10** Run on production

---

## MONTH 4: Migration - Remaining Models ✅ COMPLETE

### Week 1-2: Job Documents

- [x] **4.1** Create rake task: phase3:migrate:job_documents
  ```ruby
  # For each JobDocument:
  # 1. Create WarehouseDocument
  # 2. Create StorageBlob from existing storage_path
  # 3. Link together
  ```

- [x] **4.2** Run locally (78 migrated)
- [ ] **4.3** Run on production

### Week 3-4: People/Contact Documents

- [x] **4.4** Create rake task: phase3:migrate:people_documents
  ```ruby
  # Migrate from ActiveStorage to StorageBlob
  ```

- [x] **4.5** Create rake task: phase3:migrate:contact_documents
- [x] **4.6** Run migrations locally (16 contact docs, 0 people docs)

---

## MONTH 5: API Updates ✅ IN PROGRESS

### Week 1-2: Documents Controller

- [x] **5.1** Update /api/v1/documents/all to include warehouse counts
  ```ruby
  # Added: warehouse_total, warehouse_by_source to counts response
  # Uses WarehouseDocument.group(:source_type).count
  ```

- [x] **5.2** Add new /api/v1/documents/warehouse endpoint
  ```ruby
  # Unified endpoint for ALL warehouse documents
  # Params: source_type, folder, search, documentable_type, limit, offset
  # Returns: documents with SendName resolution, pagination, folder counts
  ```

- [x] **5.3** Fix SendNameResolver for document_type associations
  ```ruby
  # Fixed: Use document_type_record (association) not document_type (string)
  # Fixed: CorporateCompany.company_group is string column, not association
  ```

### Week 3-4: File Warehouse UI Integration

- [ ] **5.4** Verify frontend works with new API responses
- [ ] **5.5** Test tree view, search, preview
- [ ] **5.6** Test download, email, copy link actions

---

## MONTH 6: Cleanup & Garbage Collection

### Week 1-2: Garbage Collection

- [ ] **6.1** Create blob:cleanup:orphaned rake task
  ```ruby
  # Find StorageBlob where no WarehouseDocument references it
  # Delete from S3 and database
  ```

- [ ] **6.2** Create blob:audit:integrity task
- [ ] **6.3** Schedule weekly cleanup

### Week 3-4: ActiveStorage Cleanup (Optional)

- [ ] **6.4** Verify all migrated documents work without ActiveStorage
- [ ] **6.5** Remove has_one_attached from models (optional)
- [ ] **6.6** Clean orphaned ActiveStorage blobs (optional)

---

## MONTH 7: Testing & Documentation

- [ ] **7.1** Deduplication test
  ```
  Upload same file to 3 jobs → 1 StorageBlob, 3 WarehouseDocuments
  ```

- [ ] **7.2** Download rename test
  ```
  Download corporate doc → uses Send Name from template
  Download email → uses Subject line
  ```

- [ ] **7.3** Folder move test
  ```
  Move file → only updates warehouse_document.folder (instant)
  ```

- [ ] **7.4** Performance test
  ```
  Browse folder with 10k files < 500ms
  Search across 100k documents < 1s
  ```

- [ ] **7.5** Update CLAUDE.md with architecture docs
- [ ] **7.6** Update TEEEM_DOCS with user guide

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/db/migrate/XXXXX_create_warehouse_documents.rb` | NEW - Universal table |
| `backend/app/models/warehouse_document.rb` | NEW - Universal model |
| `backend/app/services/document_providers/s3_compatible.rb` | Add filename to download |
| `backend/app/services/document_storage_service.rb` | Use warehouse_document.send_name |
| `backend/app/services/send_name_resolver.rb` | NEW - Template expansion |
| `backend/lib/tasks/warehouse_migration.rake` | NEW - Migration tasks |

---

## Recovery Points

| Checkpoint | What's Done |
|------------|-------------|
| Month 1 | warehouse_documents table created, downloads use Send Name |
| Month 2 | {{Subject}} token works, emails use subject line |
| Month 3 | Corporate + Email documents migrated |
| Month 4 | Job + People + Contact documents migrated |
| Month 5 | API updated, UI working |
| Month 6 | Garbage collection running |
| Month 7 | Tested and documented |

---

## Database Schema (Final State)

```
storage_blobs (existing)
├── content_hash: unique SHA256
├── storage_path: "Blobs/ab/abc123.pdf"
├── file_size
├── content_type
├── reference_count

warehouse_documents (NEW - SSoT)
├── documentable_type: "JobDocument"
├── documentable_id: 123
├── storage_blob_id: FK
├── display_name: "Tax Return FY2024"
├── send_name: "TA Tax Return 2024.pdf"
├── folder: "Corporate/TH/Tab 10"
├── source_type: "corporate"

job_documents (unchanged)
├── ... existing columns ...
└── (no storage_blob_id needed!)

email_attachments (unchanged)
├── ... existing columns ...
├── storage_blob_id (keep for now, migrate to warehouse_document)
```

---

## Notes

### Why Universal Table?
1. **Simpler** - ONE table instead of modifying 10+ models
2. **SSoT** - All warehouse metadata in one place
3. **Flexible** - Easy to add new document types
4. **Non-invasive** - Existing models stay unchanged

### Email Storage Details
```
email_warehouses.subject: "RE: Invoice Question"
storage_path: "Emails/2026/01/12345.eml"

New: {{Subject}} placeholder token

Storage Config (user configurable):
- Send Name: {{Subject}} - {{Date}}.eml
- Display Name: {{Subject}}

Result:
- S3 file: "12345.eml"
- UI shows: "RE: Invoice Question"
- Downloads as: "RE Invoice Question - 2026-01-17.eml"
```
