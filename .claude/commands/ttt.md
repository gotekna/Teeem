# /ttt - Trinity Documentation Lookup

**Shortcut:** `/ttt [search_term]`

Efficiently search and access Trinity documentation (Bible, Teacher, Lexicon) using the Dense Index API pattern.

## What This Command Does

The `/ttt` command provides token-efficient access to TEEEM's Trinity documentation system by:
1. Searching the dense index via API first
2. Reading ONLY the relevant chapter files
3. Saving 98% of tokens vs reading full files

## Trinity Documentation Categories

### 📖 Bible (RULES)
- MUST/NEVER/ALWAYS statements
- Coding standards and conventions
- Security requirements
- Database schema rules
- API design patterns

### 🔧 Teacher (HOW-TO)
- Step-by-step implementation patterns
- Complete code examples
- Component templates
- Feature implementation guides
- Common patterns and utilities

### 📕 Lexicon (KNOWLEDGE)
- Bug history (what went wrong, how it was fixed)
- Architecture decisions (why we chose X over Y)
- Test catalog (what tests exist)
- Performance notes
- Common issues and solutions

## Usage Examples

```bash
# Search across all documentation
/ttt table

# Search specific category
/ttt bible table
/ttt teacher teeemtableview
/ttt lexicon performance

# Multiple search terms
/ttt xero bills warehouse
```

## Execution Protocol

### Step 1: Search Dense Index via API

**CRITICAL:** NEVER read full documentation files directly. Always search first.

```bash
# Search all categories
GET https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/api/v1/trinity/search?q=[search_term]

# Search specific category
GET https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/api/v1/trinity?category=[bible|teacher|lexicon]&search=[search_term]
```

**API Response Format:**
```json
{
  "success": true,
  "results": [
    {
      "id": 200,
      "chapter_number": 19,
      "section_number": "19.1",
      "title": "TEEEMTableView - The One Table Standard",
      "category": "teacher",
      "dense_index": "191 teeemtableviewtheonetablestandard component teacher..."
    }
  ]
}
```

### Step 2: Read ONLY Relevant Chapter Files

Based on search results, read the specific chapter file:

**Teacher Chapters (Split Files - Preferred):**
```
TEEEM_DOCS/TEACHER/CHAPTER_XX_TOPIC_NAME.md
```

**Chapter Number Guide:**
- Chapter 0-2: Core System (auth, database, API)
- Chapter 3-7: Data Management (tables, imports, exports)
- Chapter 8-12: Business Logic (jobs, suppliers, quotes)
- Chapter 13-17: Integrations (Xero, OneDrive, AI)
- Chapter 18-21: UI/UX & Documentation

**Bible & Lexicon (Monolithic - Use Sparingly):**
```
TEEEM_DOCS/TEEEM_BIBLE.md      # ~56KB total
TEEEM_DOCS/TEEEM_LEXICON.md    # ~107KB total
```

### Step 3: Present Findings

Format the response with:
1. **Search Results Summary** - List matching entries with chapter numbers
2. **Relevant Content** - Show content from identified chapters
3. **Related Entries** - Include links to related documentation
4. **Next Steps** - Suggest follow-up searches or actions

## Token Efficiency

**Old Approach (WRONG):**
- Read entire TEEEM_TEACHER.md: ~553,000 tokens ❌ (file too large)
- Read all three docs: ~716,000 tokens ❌ (exceeds limits)

**New Approach (CORRECT):**
- Search dense index via API: ~100 tokens ✅
- Read relevant Teacher chapter: ~15,000 tokens ✅
- Total: ~15,100 tokens (98% reduction) ✅

## Arguments

| Command | Action |
|---------|--------|
| `/ttt [term]` | Search all categories for term |
| `/ttt bible [term]` | Search Bible only |
| `/ttt teacher [term]` | Search Teacher only |
| `/ttt lexicon [term]` | Search Lexicon only |
| `/ttt chapter XX` | Read specific Teacher chapter directly |
| `/ttt warehouse` | Run data warehouse audit (check API usage patterns) |

## Examples

### Example 1: Find Table Implementation
```bash
/ttt table
```
**Expected Output:**
```
🔍 Trinity Search: "table"

Found 3 entries:

📖 BIBLE
- #19.002: Gold Standard Table is SSoT for column types

🔧 TEACHER
- Chapter 19.1: TEEEMTableView - The One Table Standard
- Chapter 19.2: Custom Tables with Formulas

📕 LEXICON
- Bug #045: Table sorting performance issue

Reading Chapter 19.1...
[Content from CHAPTER_19_UI_UX.md]
```

### Example 2: Find Architecture Decision
```bash
/ttt lexicon supplier bills
```
**Expected Output:**
```
🔍 Trinity Search: "supplier bills" (Lexicon only)

Found 1 entry:

📕 LEXICON
- Decision #023: Bills stored with supplier as SSoT (not job)
  - Reason: Suppliers never change, jobs can be reassigned
  - Date: 2025-12-07

[Content from relevant section]
```

### Example 3: Find Implementation Pattern
```bash
/ttt teacher warehouse endpoint
```
**Expected Output:**
```
🔍 Trinity Search: "warehouse endpoint" (Teacher only)

Found 2 entries:

🔧 TEACHER
- Chapter 13.5: Xero Data Warehouse Pattern
- Chapter 3.4: Building API Endpoints

Reading Chapter 13.5...
[Implementation pattern with code examples]
```

## API Base URL

**Production (Rob's Dev):**
```
https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/api/v1/trinity
```

## Common Search Terms

**Development:**
- `table`, `teeemtableview`, `column types`
- `api endpoint`, `controller`, `model`
- `authentication`, `authorization`, `security`

**Integration:**
- `xero`, `onedrive`, `email`, `sync`
- `warehouse`, `cache`, `performance`

**UI/UX:**
- `component`, `modal`, `form`, `validation`
- `responsive`, `dark mode`, `accessibility`

**Bugs/History:**
- `bug pattern`, `infinite loop`, `race condition`
- `migration`, `rollback`, `fix`

## Integration with /t Command

The `/t` (Trinity Code Review) and `/ttt` (Trinity Documentation) commands work together:

- **Use `/ttt`** when you need to:
  - Look up how to implement something
  - Check rules before coding
  - Research past bugs or decisions

- **Use `/t`** when you need to:
  - Audit existing code for compliance
  - Find SSoT violations
  - Run comprehensive quality checks

## Important Notes

**DO:**
- ✅ Always search dense index first via API
- ✅ Read only the specific chapter identified
- ✅ Check Bible for rules before implementing
- ✅ Check Teacher for implementation patterns
- ✅ Check Lexicon for historical context

**DON'T:**
- ❌ Read entire TEEEM_TEACHER.md (too large)
- ❌ Skip the dense index search step
- ❌ Assume you know the right chapter without searching
- ❌ Read all three documentation files at once

## File Structure Reference

```
TEEEM_DOCS/
├── TEEEM_BIBLE.md              # All Bible rules (~56KB)
├── TEEEM_LEXICON.md            # All Lexicon entries (~107KB)
├── TEEEM_TEACHER.md            # Full Teacher index (DO NOT READ)
├── TEEEM_USER_MANUAL.md        # End-user documentation
└── TEACHER/                     # Split Teacher chapters (READ THESE)
    ├── CHAPTER_19_UI_UX.md                    # ~8KB
    ├── CHAPTER_19_CUSTOM_TABLES_FORMULAS.md   # ~9KB
    └── [other chapters...]
```

## Keeping Documentation in Sync

**Database is Source of Truth:**
- All edits happen in the TEEEM UI (Documentation page)
- Markdown files are auto-generated exports

**To Export Latest:**
```bash
# Export Teacher chapters
cd backend && bin/rails teeem:export_teacher_split

# Export Bible
cd backend && bin/rails teeem:export_bible

# Export Lexicon
cd backend && bin/rails teeem:export_lexicon
```

## Performance Target

**Full Search + Read:** ~5-10 seconds
- API search: ~1s
- Parse results: ~1s
- Read chapter: ~3-5s
- Format output: ~1s

## Data Warehouse Audit

**Special Command:** `/ttt warehouse`

Runs a comprehensive audit of data warehouse usage across the entire codebase.

### What It Checks

**Frontend API Usage:**
- Which components use warehouse endpoints vs direct API calls
- Xero API usage patterns (`/api/v1/xero/*`)
- Cache opportunities and missing warehouse endpoints
- N+1 query patterns
- API call performance issues

**Backend Endpoints:**
- Available warehouse endpoints and coverage
- Missing warehouse tables
- Sync status and cache metadata
- Data integrity issues

### Execution Steps

1. **Scan Frontend Components**
   ```bash
   # Search for direct Xero API calls
   grep -r "/api/v1/xero/" frontend-next/components --include="*.tsx"
   grep -r "/api/v1/xero/" frontend-next/app --include="*.tsx"

   # Search for warehouse endpoint usage
   grep -r "/api/v1/external_invoices" frontend-next --include="*.tsx"
   ```

2. **Analyze Patterns**
   - Count components using warehouse vs direct API
   - Identify high-impact migration opportunities
   - Calculate potential performance improvements

3. **Generate Report**
   ```
   ════════════════════════════════════════════════════════════════
                    DATA WAREHOUSE AUDIT REPORT
                    [Brisbane Time]
   ════════════════════════════════════════════════════════════════

   SUMMARY
   ───────
   Total Components Checked: X
   Using Warehouse: Y (Z%)
   Using Direct API: W

   WAREHOUSE COVERAGE
   ──────────────────
   ✅ External Invoices (Bills/Invoices): 3 components (25%)
   ⚠️  Xero Contacts: 0 components (0%)
   ⚠️  Xero Payments: 0 components (0%)

   HIGH-PRIORITY MIGRATIONS
   ────────────────────────
   1. XeroTransactionsSection.tsx (3 API calls → 1 warehouse)
      Impact: 30-90x performance improvement

   2. XeroInvoiceDetailModal.tsx (detail view)
      Impact: 10-30x performance improvement

   RECOMMENDATIONS
   ───────────────
   - Migrate XeroTransactionsSection (highest impact)
   - Create warehouse endpoint for payments
   - Add cache metadata to existing endpoints
   - Document warehouse patterns in Teacher

   ════════════════════════════════════════════════════════════════
   ```

4. **Create Migration Tasks**
   - List specific files to update
   - Provide code examples for migrations
   - Estimate performance improvements

### Current Warehouse Status (as of 2025-12-07)

**Implemented:**
- ✅ External Invoices (bills/invoices) - 2,416 records
- ✅ `/api/v1/external_invoices/by_contact/{id}` endpoint
- ✅ `/api/v1/external_invoices/by_job/{id}` endpoint
- ✅ Cache metadata (last_synced_at, cache_age_seconds)

**Migration Success:**
- ✅ XeroInvoicesList.tsx - Migrated (10-100x faster)
- ✅ JobProfitTab.tsx - Using warehouse
- ⚠️ XeroTransactionsSection.tsx - Still using 3 Xero API calls (TOP PRIORITY)

**Performance Gains:**
- Bills tab: 1-3 seconds → <100ms (10-100x faster)
- Offline support enabled
- Cache age visibility for users

### Warehouse Best Practices

**When to Warehouse:**
- ✅ Frequently accessed data (invoices, bills, contacts)
- ✅ External API data (Xero, OneDrive)
- ✅ Data that changes infrequently
- ✅ Data needed offline

**When NOT to Warehouse:**
- ❌ Authentication/OAuth flows
- ❌ Real-time search queries
- ❌ System sync operations
- ❌ Write/update operations

**Warehouse Endpoint Pattern:**
```ruby
# Backend: app/controllers/api/v1/resource_controller.rb
def by_contact
  @resources = Resource.where(contact_id: params[:contact_id])
  render json: {
    success: true,
    data: @resources,
    meta: {
      source: 'local_cache',
      last_synced_at: sync_record&.synced_at,
      cache_age_seconds: cache_age
    }
  }
end
```

**Frontend Pattern:**
```typescript
// Use warehouse endpoint
const response = await api.get<WarehouseResponse>(
  `/api/v1/resource/by_contact/${contactId}`
);

// Show cache age
{response.meta?.last_synced_at && (
  <span>Last synced: {formatRelativeTime(response.meta.last_synced_at)}</span>
)}
```

### Related Documentation

After running warehouse audit, check:
- `TEEEM_DOCS/DATA_WAREHOUSE_AUDIT_REPORT.md` - Latest findings
- `TEEEM_DOCS/BILL_WAREHOUSE_IMPLEMENTATION.md` - Implementation example
- `TEEEM_DOCS/BILL_STORAGE_ARCHITECTURE.md` - SSoT architecture

### Output Files

Audit generates:
- `TEEEM_DOCS/DATA_WAREHOUSE_AUDIT_REPORT.md` - Full report
- Console summary with actionable recommendations
- Migration task list with priorities

## Related Commands

- `/t` - Trinity Code Review (audit existing code for SSoT, security, quality)
- `/ttt` - Trinity Documentation Lookup (this command)
- `/ttt warehouse` - Data Warehouse Audit (check API usage patterns)
- Use `/ttt` to research, then `/t` to audit, or `/ttt warehouse` for performance optimization
