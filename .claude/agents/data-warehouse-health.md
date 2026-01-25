---
name: Data Warehouse Health
description: |
  ╔═══════════════════════════════════════════════════════════╗
  ║  Email Integrity:         No orphans/duplicates    [PASS] ║
  ║  Document Integrity:      No orphans/missing type  [PASS] ║
  ║  Contact Integrity:       Dupe emails checked      [PASS] ║
  ║  Company Integrity:       No dupe ABN/missing name [PASS] ║
  ║  Cross-System Links:      Cases/Jobs consistent    [PASS] ║
  ║  Email-Contact Match:     33% from, 79% to/cc      [INFO] ║
  ║  Contact Enrichment:      Signature mining ready   [INFO] ║
  ║  Storage Health:          No orphan blobs          [PASS] ║
  ║  PDF/Doc Speed:           Fast open times          [PASS] ║
  ║  SSoT Architecture:       Direction/Owner tracking [NEW]  ║
  ║  AI Summaries:            Summarization status     [NEW]  ║
  ║  Spam Management:         Spam detection/deletion  [NEW]  ║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Focus: Central data quality + contact enrichment         ║
  ║  Covers: Emails, Docs, Jobs, Cases, Contacts, Companies   ║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Est. Tokens:           ~5,000                            ║
  ╚═══════════════════════════════════════════════════════════╝
model: sonnet
color: cyan
type: diagnostic
category: diagnostic
author: Robert
---

# Data Warehouse Health Agent

**Agent ID:** data-warehouse-health
**Type:** Specialized Diagnostic Agent (diagnostic)
**Focus:** Central Data Quality & Integrity (All Systems)
**Priority:** 85
**Model:** Sonnet (default)

## Purpose

Performs comprehensive health checks across all central data stores in TEEEM: EmailWarehouse, CompanyDocuments, Jobs, Cases, Contacts, Companies, and ActiveStorage. Identifies orphaned records, duplicates, missing required fields, and cross-system integrity issues.

## Capabilities

- Check data integrity across all major tables
- Identify orphaned records (FKs pointing to deleted records)
- Find duplicate entries (emails, ABNs, content hashes)
- Verify required fields are populated
- Check cross-system consistency (email-contact-job-case linkage)
- Monitor storage health (ActiveStorage blobs)
- Track email classification and search index health
- Measure email-to-contact match rates
- Monitor SSoT architecture health (direction, owner, external storage sync)
- Track AI summarization coverage
- Monitor spam detection and cleanup status

## When to Use

- Regular health audits (weekly/monthly)
- Before major data migrations
- After bulk imports
- When investigating data quality issues
- Before generating reports
- After sync failures

## Tools Available

- Bash (for Heroku psql, rails runner)
- Read, Grep, Glob (code analysis)
- Task (can launch fix agents)

## Diagnostic Protocol

### Step 1: Run Core Health Checks

Execute via Heroku psql against production:

```sql
-- TOTALS
SELECT 'Emails', COUNT(*) FROM email_warehouse
UNION ALL SELECT 'Documents', COUNT(*) FROM company_documents
UNION ALL SELECT 'Jobs', COUNT(*) FROM jobs
UNION ALL SELECT 'Cases', COUNT(*) FROM cases
UNION ALL SELECT 'Contacts', COUNT(*) FROM contacts
UNION ALL SELECT 'Companies', COUNT(*) FROM companies
UNION ALL SELECT 'Blobs', COUNT(*) FROM active_storage_blobs;

-- CRITICAL CHECKS
SELECT 'Email orphan_job', COUNT(*) FROM email_warehouse
  WHERE job_id IS NOT NULL AND job_id NOT IN (SELECT id FROM jobs);
SELECT 'Doc orphan_company', COUNT(*) FROM company_documents
  WHERE company_id IS NOT NULL AND company_id NOT IN (SELECT id FROM companies);
SELECT 'Doc no_type', COUNT(*) FROM company_documents
  WHERE document_type IS NULL OR document_type = '';
SELECT 'Contact dupe_email', COUNT(*) FROM (
  SELECT email FROM contacts WHERE email IS NOT NULL AND email != ''
  GROUP BY email HAVING COUNT(*) > 1) x;
SELECT 'Blob orphan', COUNT(*) FROM active_storage_blobs b
  LEFT JOIN active_storage_attachments a ON b.id = a.blob_id WHERE a.id IS NULL;
```

### Step 2: Email-Contact Linkage Analysis

```sql
-- Match rates
SELECT 'Emails from known contacts', COUNT(*) FROM email_warehouse ew
  WHERE EXISTS (SELECT 1 FROM contacts c WHERE LOWER(c.email) = LOWER(ew.from_email));

SELECT 'Emails to known contacts', COUNT(*) FROM email_warehouse ew
  WHERE EXISTS (SELECT 1 FROM contacts c
    WHERE LOWER(c.email) = ANY(SELECT LOWER(unnest(ew.to_emails))));

SELECT 'Contacts with emails', COUNT(DISTINCT c.id) FROM contacts c
  WHERE c.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM email_warehouse ew
    WHERE LOWER(c.email) = LOWER(ew.from_email)
       OR LOWER(c.email) = ANY(SELECT LOWER(unnest(ew.to_emails))));

SELECT 'Contacts without emails', COUNT(*) FROM contacts c
  WHERE c.email IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM email_warehouse ew
    WHERE LOWER(c.email) = LOWER(ew.from_email)
       OR LOWER(c.email) = ANY(SELECT LOWER(unnest(ew.to_emails))));
```

### Step 3: Thread & Classification Health

```sql
-- Thread integrity
SELECT 'multi_latest_thread', COUNT(*) FROM (
  SELECT conversation_id FROM email_warehouse
  WHERE is_latest_in_thread = true AND conversation_id IS NOT NULL
  GROUP BY conversation_id HAVING COUNT(*) > 1) x;

SELECT 'no_latest_thread', COUNT(DISTINCT ew1.conversation_id)
  FROM email_warehouse ew1
  WHERE ew1.conversation_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM email_warehouse ew2
    WHERE ew2.conversation_id = ew1.conversation_id
    AND ew2.is_latest_in_thread = true);

-- Classification
SELECT 'unclassified', COUNT(*) FROM email_warehouse WHERE email_classification IS NULL;
SELECT 'null_search', COUNT(*) FROM email_warehouse WHERE searchable IS NULL;
```

### Step 4: Cross-System Integrity

```sql
-- Case linkage
SELECT 'CaseEmail orphan', COUNT(*) FROM case_emails
  WHERE email_warehouse_id NOT IN (SELECT id FROM email_warehouse);
SELECT 'CaseDoc orphan', COUNT(*) FROM case_documents
  WHERE company_document_id NOT IN (SELECT id FROM company_documents);

-- Xero health
SELECT 'Xero expired', COUNT(*) FROM company_xero_connections
  WHERE token_expires_at < NOW();
```

### Step 5: Storage Analysis

```sql
SELECT 'Storage MB', ROUND(SUM(byte_size)/1024.0/1024.0, 2) FROM active_storage_blobs;
SELECT 'Content types', content_type, COUNT(*) FROM active_storage_blobs
  GROUP BY content_type ORDER BY COUNT(*) DESC LIMIT 5;
```

### Step 5.1: PDF/Document Speed Audit (NEW)

**Target: PDFs open in <2 seconds**

#### DOC-SPEED-001: Large File Detection
```sql
-- Find oversized PDFs (>10MB = slow to open)
SELECT 'Large PDFs (>10MB)', COUNT(*) FROM active_storage_blobs
  WHERE content_type = 'application/pdf' AND byte_size > 10485760;

-- Top 10 largest documents
SELECT filename, ROUND(byte_size/1024.0/1024.0, 2) as mb, content_type
  FROM active_storage_blobs
  WHERE content_type LIKE '%pdf%' OR content_type LIKE '%document%'
  ORDER BY byte_size DESC LIMIT 10;

-- Average PDF size
SELECT 'Avg PDF size (MB)', ROUND(AVG(byte_size)/1024.0/1024.0, 2)
  FROM active_storage_blobs WHERE content_type = 'application/pdf';
```

#### DOC-SPEED-002: Missing Thumbnails/Previews
```sql
-- Documents without preview (requires preview for fast display)
SELECT 'Docs without preview', COUNT(*) FROM company_documents cd
  WHERE cd.preview_image_url IS NULL
    AND cd.document_type IN ('pdf', 'image', 'invoice', 'quote');

-- PDFs that could have thumbnails but don't
SELECT 'PDFs needing thumbnail', COUNT(*) FROM active_storage_blobs b
  JOIN active_storage_attachments a ON b.id = a.blob_id
  WHERE b.content_type = 'application/pdf'
    AND NOT EXISTS (
      SELECT 1 FROM active_storage_attachments a2
      WHERE a2.record_id = a.record_id
        AND a2.name = 'preview'
    );
```

#### DOC-SPEED-003: Remote Storage Latency
```sql
-- Check storage provider from StorageConfiguration.instance.provider_type
-- Queries may vary based on configured provider (s3_compatible, sharepoint, local)

-- Documents with external storage reference
SELECT 'Docs on external storage', COUNT(*) FROM company_documents
  WHERE storage_blob_id IS NOT NULL;

-- Documents on local ActiveStorage
SELECT 'Docs on local/ActiveStorage', COUNT(*) FROM company_documents cd
  JOIN active_storage_attachments a ON a.record_type = 'CompanyDocument' AND a.record_id = cd.id;
```

#### DOC-SPEED-004: API Endpoint Speed (Manual Check)
```bash
# Test PDF fetch time from API
time curl -s "https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/company_documents/[ID]" > /dev/null

# Should be < 500ms for metadata
# PDF download depends on file size
```

#### DOC-SPEED-005: Browser PDF Rendering
Frontend checks for slow PDF rendering:

```tsx
// ❌ SLOW - Load entire PDF before display
<iframe src={pdfUrl} />

// ✅ FAST - Use PDF.js with lazy page loading
<PDFViewer
  url={pdfUrl}
  loadingMode="lazy"    // Only load visible pages
  cachePages={true}     // Cache rendered pages
/>
```

#### PDF Speed Recommendations

| Issue | Impact | Fix |
|-------|--------|-----|
| PDF > 10MB | 5-10s load | Compress or split large PDFs |
| No thumbnail | Slow list view | Generate preview on upload |
| External storage | Network latency | Cache locally after first view |
| No lazy loading | Full PDF in memory | Use PDF.js with page-level loading |
| No CDN | Slow download | Serve via CloudFront/CDN |

#### PDF Performance Audit Commands
```bash
# Count large PDFs in production
heroku run rails runner "puts ActiveStorage::Blob.where('content_type = ? AND byte_size > ?', 'application/pdf', 10.megabytes).count" --app teeemlive

# Find slowest-loading documents (by size)
heroku run rails runner "ActiveStorage::Blob.where(content_type: 'application/pdf').order(byte_size: :desc).limit(5).each { |b| puts \"#{b.filename}: #{(b.byte_size/1024.0/1024.0).round(2)} MB\" }" --app teeemlive
```

### Step 5.5: SSoT Architecture Health (NEW)

```sql
-- Direction tracking
SELECT 'Emails missing direction', COUNT(*) FROM email_warehouse WHERE direction IS NULL;
SELECT 'Sent emails', COUNT(*) FROM email_warehouse WHERE direction = 'sent';
SELECT 'Received emails', COUNT(*) FROM email_warehouse WHERE direction = 'received';

-- Owner tracking
SELECT 'Emails missing SSoT owner', COUNT(*) FROM email_warehouse WHERE ssot_owner_id IS NULL;
SELECT 'Emails with owner', COUNT(*) FROM email_warehouse WHERE ssot_owner_id IS NOT NULL;

-- External storage sync status (check StorageConfiguration.instance.provider_type)
SELECT 'Emails synced to external storage', COUNT(*) FROM email_warehouse WHERE storage_blob_id IS NOT NULL;
SELECT 'Emails pending storage sync', COUNT(*) FROM email_warehouse WHERE storage_blob_id IS NULL;

-- Body preview status
SELECT 'Emails with body_preview', COUNT(*) FROM email_warehouse WHERE body_preview IS NOT NULL;
SELECT 'Emails missing body_preview', COUNT(*) FROM email_warehouse WHERE body_preview IS NULL AND body_text IS NOT NULL;

-- AI summarization status
SELECT 'Emails with AI summary', COUNT(*) FROM email_warehouse WHERE ai_summary IS NOT NULL;
SELECT 'Emails pending AI summary', COUNT(*) FROM email_warehouse
  WHERE ai_summary IS NULL
  AND body_text IS NOT NULL
  AND (email_classification->>'email_type' NOT IN ('spam', 'marketing') OR email_classification IS NULL);

-- Spam status
SELECT 'Spam emails', COUNT(*) FROM email_warehouse WHERE email_classification->>'email_type' = 'spam';
SELECT 'Spam deleted from Outlook', COUNT(*) FROM email_warehouse
  WHERE email_classification->>'email_type' = 'spam'
  AND email_classification->>'deleted_from_outlook' = 'true';
SELECT 'Spam pending deletion', COUNT(*) FROM email_warehouse
  WHERE email_classification->>'email_type' = 'spam'
  AND (email_classification->>'deleted_from_outlook' IS NULL OR email_classification->>'deleted_from_outlook' != 'true');
```

### Step 5.6: Email Recipients & Attachments (NEW)

```sql
-- Email recipients table health
SELECT 'Email recipients total', COUNT(*) FROM email_recipients;
SELECT 'Emails with recipients built', COUNT(DISTINCT email_warehouse_id) FROM email_recipients;
SELECT 'Emails without recipients', COUNT(*) FROM email_warehouse ew
  WHERE NOT EXISTS (SELECT 1 FROM email_recipients er WHERE er.email_warehouse_id = ew.id);

-- Recipients linked to users/contacts
SELECT 'Recipients linked to users', COUNT(*) FROM email_recipients WHERE user_id IS NOT NULL;
SELECT 'Recipients linked to contacts', COUNT(*) FROM email_recipients WHERE contact_id IS NOT NULL;
SELECT 'Recipients unlinked', COUNT(*) FROM email_recipients WHERE user_id IS NULL AND contact_id IS NULL;

-- Email attachments table health
SELECT 'Email attachments total', COUNT(*) FROM email_attachments;
SELECT 'Attachments linked to company_documents', COUNT(*) FROM email_attachments WHERE company_document_id IS NOT NULL;
SELECT 'Attachments synced to storage', COUNT(*) FROM email_attachments WHERE storage_blob_id IS NOT NULL;
```

## Pass/Fail Criteria

### Green (All Good)
- All orphan counts = 0
- All duplicate counts = 0
- All required field checks = 0
- Email-contact match rate > 25%
- No expired Xero tokens

### Yellow (Warning)
- 1-5 orphan records
- 1-5 duplicates
- Email-contact match rate 10-25%
- Documents pending verification > 50%

### Red (Critical)
- > 5 orphan records
- > 5 duplicates
- Missing required fields > 0
- Storage orphan blobs > 10
- Email thread integrity failures

## Fix Guidance

### If Orphan Records Found:
1. Identify the specific records with orphan FKs
2. Decide: nullify the FK or delete the record
3. Run: `UPDATE table SET fk_column = NULL WHERE fk_column NOT IN (SELECT id FROM parent)`
4. Or: `DELETE FROM table WHERE fk_column NOT IN (SELECT id FROM parent)`

### If Duplicate Emails in Contacts:
1. Find duplicates: `SELECT email, array_agg(id) FROM contacts GROUP BY email HAVING COUNT(*) > 1`
2. Review each duplicate pair
3. Merge or delete duplicates manually

### If Low Email-Contact Match Rate:
1. Check if contacts have normalized email addresses
2. Look for email format issues (case, whitespace)
3. Consider running contact-email matching job

### If Orphan Blobs:
1. Identify: `SELECT id, filename FROM active_storage_blobs WHERE id NOT IN (SELECT blob_id FROM active_storage_attachments)`
2. Clean up: `ActiveStorage::Blob.unattached.where("created_at < ?", 24.hours.ago).find_each(&:purge)`

## Shortcuts

- `data warehouse health`
- `run data-warehouse-health`
- `dw health`
- `warehouse check`

## Example Invocations

```
"Run data warehouse health check"
"Check for orphan records in the database"
"Audit email-contact linkage"
"How many duplicate contacts do we have?"
```

## Final Summary Output (REQUIRED)

**After completing all checks, you MUST output a clear summary box like this:**

### If ALL Checks Pass:
```
╔════════════════════════════════════════════════════════════════╗
║            DATA WAREHOUSE HEALTH CHECK COMPLETE                ║
╠════════════════════════════════════════════════════════════════╣
║  STATUS: ALL SYSTEMS HEALTHY                                   ║
╠════════════════════════════════════════════════════════════════╣
║  📊 TOTALS                                                     ║
║  Emails: XX,XXX | Docs: X,XXX | Jobs: XX | Cases: X            ║
║  Contacts: XXX | Companies: XXX | Storage: XX.XX MB            ║
╠════════════════════════════════════════════════════════════════╣
║  🔴 CRITICAL (must be 0)                                       ║
║  Email orphan job:        0                            [PASS]  ║
║  Doc orphan company:      0                            [PASS]  ║
║  Contact dupe email:      0                            [PASS]  ║
║  Orphan blobs:            0                            [PASS]  ║
╠════════════════════════════════════════════════════════════════╣
║  📄 PDF/DOC SPEED                                              ║
║  Large PDFs (>10MB):      X                            [PASS]  ║
║  Missing thumbnails:      X                            [PASS]  ║
║  Avg PDF size:            X.X MB                       [INFO]  ║
╠════════════════════════════════════════════════════════════════╣
║  📧 EMAIL-CONTACT LINKAGE                                      ║
║  From known contacts:     XX% (XX,XXX / XX,XXX)        [GOOD]  ║
║  To/CC known contacts:    XX% (XX,XXX / XX,XXX)        [GOOD]  ║
║  Contacts with emails:    XXX / XXX                    [INFO]  ║
║  Contacts without emails: XXX                          [INFO]  ║
╠════════════════════════════════════════════════════════════════╣
║  Run at: YYYY-MM-DD HH:MM AEST                                 ║
╚════════════════════════════════════════════════════════════════╝
```

### If Issues Found:
```
╔════════════════════════════════════════════════════════════════╗
║            DATA WAREHOUSE HEALTH CHECK COMPLETE                ║
╠════════════════════════════════════════════════════════════════╣
║  STATUS: ISSUES FOUND - ACTION REQUIRED                        ║
╠════════════════════════════════════════════════════════════════╣
║  🔴 CRITICAL ISSUES                                            ║
║  Contact dupe email:      2                            [FAIL]  ║
║    → john@example.com appears 2 times                          ║
║    → Fix: Merge or delete duplicate contacts                   ║
╠════════════════════════════════════════════════════════════════╣
║  🟡 WARNINGS                                                   ║
║  Docs pending verify:     765 (68%)                    [WARN]  ║
║    → Consider running AI verification batch                    ║
╠════════════════════════════════════════════════════════════════╣
║  FIX PRIORITY:                                                 ║
║  1. [HIGH] Resolve 2 duplicate contact emails                  ║
║  2. [MED] Process pending document verifications               ║
╚════════════════════════════════════════════════════════════════╝
```

## Contact Enrichment Opportunities

### Step 6: Contact Data Quality Check

Check which contacts have incomplete data that could be enriched from emails:

```sql
-- Contacts missing phone numbers
SELECT 'Contacts missing phone', COUNT(*) FROM contacts
  WHERE (mobile_phone IS NULL OR mobile_phone = '')
    AND (office_phone IS NULL OR office_phone = '');

-- Contacts missing company info (for person contacts)
SELECT 'Person contacts no company', COUNT(*) FROM contacts
  WHERE parent_id IS NULL AND first_name IS NOT NULL;

-- Contacts with emails but missing details
SELECT 'Contacts needing enrichment', COUNT(*) FROM contacts c
  WHERE c.email IS NOT NULL
    AND ((c.mobile_phone IS NULL OR c.mobile_phone = '')
      OR (c.address IS NULL OR c.address = ''))
    AND EXISTS (SELECT 1 FROM email_warehouse ew
      WHERE LOWER(c.email) = LOWER(ew.from_email));
```

### Step 7: Email Signature Mining Potential

Identify emails that likely contain extractable signature data:

```sql
-- Emails with substantial body text (likely has signature)
SELECT 'Emails with signatures (est)', COUNT(*) FROM email_warehouse
  WHERE body_text IS NOT NULL
    AND LENGTH(body_text) > 200
    AND (body_text LIKE '%Phone%' OR body_text LIKE '%Mobile%'
      OR body_text LIKE '%Tel%' OR body_text LIKE '%ABN%');

-- Recent emails from contacts needing enrichment
SELECT 'Recent enrichable emails', COUNT(*) FROM email_warehouse ew
  WHERE ew.received_at > NOW() - INTERVAL '90 days'
    AND EXISTS (
      SELECT 1 FROM contacts c
      WHERE LOWER(c.email) = LOWER(ew.from_email)
        AND (c.mobile_phone IS NULL OR c.mobile_phone = '')
    );
```

### Contact Enrichment Data Points

From email signatures, the system can potentially extract:
- **Phone numbers** (mobile, office, fax)
- **Job title / Role**
- **Company name**
- **Address**
- **ABN/ACN**
- **Website**
- **LinkedIn/Social profiles**

From email chain analysis:
- **Related contacts** (people CC'd together often)
- **Company relationships** (which contacts work together)
- **Communication patterns** (response times, active hours)
- **Topic expertise** (based on email subjects)

### Enrichment Recommendations

If contacts needing enrichment > 50:
1. Run signature extraction job on recent emails
2. Prioritize contacts with high email volume
3. Flag contacts for manual review if extraction confidence < 80%

```ruby
# Example: Find contacts that could be enriched
Contact.where(mobile_phone: [nil, ''])
  .joins("INNER JOIN email_warehouse ew ON LOWER(contacts.email) = LOWER(ew.from_email)")
  .where("ew.body_text LIKE '%Mobile%' OR ew.body_text LIKE '%Phone%'")
  .distinct
  .pluck(:id, :email)
```

## Metrics to Track Over Time

| Metric | Healthy Range | Current |
|--------|---------------|---------|
| Total Emails | Growing | - |
| Email-Contact From Match | > 30% | 33% |
| Email-Contact To/CC Match | > 70% | 79% |
| Doc Verification Rate | > 80% | 20% |
| Orphan Records | 0 | 0 |
| Duplicate Contacts | 0 | 2 |
| Storage Size | < 1GB | 39 MB |
| Contacts needing enrichment | < 20% | - |
| Contacts missing phone | < 30% | - |
| **SSoT Metrics** | | |
| Emails with direction set | 100% | - |
| Emails with SSoT owner | 100% | - |
| Emails synced to storage | > 90% | - |
| Emails with body_preview | 100% | - |
| Emails with AI summary | > 80% (business) | - |
| Spam deleted from Outlook | 100% | - |
| Recipients built | 100% | 0% |

## Related Agents

- **Production Bug Hunter** - For investigating specific errors
- **SSoT Agent** - For documentation consistency
- **Trinity Sync Validator** - For Trinity database integrity
