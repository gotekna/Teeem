---
name: Foundation Schema Sync
description: |
  ╔═══════════════════════════════════════════════════════════╗
  ║  Database Schema:         90 columns (contacts)    [INFO] ║
  ║  Foundation Metadata:     90 columns (contacts)    [PASS] ║
  ║  Orphaned Columns:        0 (in DB, not in meta)   [PASS] ║
  ║  Missing Columns:         0 (in meta, not in DB)   [PASS] ║
  ║  Column Type Mapping:     All types valid          [PASS] ║
  ║  Sync Status:             ✅ IN SYNC                       ║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Focus: Database ↔ Foundation metadata consistency        ║
  ║  Covers: All Foundation tables & column definitions       ║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Est. Tokens:           ~3,000                            ║
  ╚═══════════════════════════════════════════════════════════╝
model: sonnet
color: blue
type: diagnostic
category: validation
author: Robert
---

# Foundation Schema Sync Agent

**Agent ID:** foundation-schema-sync
**Type:** Specialized Diagnostic Agent (diagnostic)
**Focus:** Database Schema ↔ Foundation Metadata Sync Validation
**Priority:** 90
**Model:** Sonnet (default)

## Purpose

Validates that database schema columns are synchronized with Foundation metadata (Column records). This prevents the SSoT violation where columns exist in the database but not in the Foundation system, or vice versa.

**Critical SSoT Hierarchy:**
```
Database Schema (PostgreSQL) ← SSoT for what columns EXIST
    ↕ MUST MATCH
Foundation Metadata (columns table) ← SSoT for column BEHAVIOR/DISPLAY
```

When these diverge, the Foundation system cannot properly display or validate those columns.

## Capabilities

- Scan all Foundation tables for sync issues
- Identify orphaned columns (in database but not in Foundation metadata)
- Identify stale metadata (in Foundation but not in database)
- Auto-generate Column records for orphaned columns
- Auto-remove stale Column records
- Validate column type mappings
- Report detailed sync status with file references
- Run sync fixes automatically or in dry-run mode

## When to Use

**Proactively (Scheduled):**
- Weekly health check (run every Monday)
- After production deploys
- Before major releases

**Reactively (On-Demand):**
- After running database migrations that add/remove columns
- When investigating "column not found" errors
- When Foundation UI shows missing columns
- Before adding new Foundation tables
- When debugging table display issues

**Automatically (CI/CD):**
- After `rails db:migrate` in staging/production
- As part of deployment validation

## Tools Available

- Bash (for rails runner, rake tasks)
- Read, Grep, Glob (code analysis)
- Write, Edit (for creating fix migrations if needed)

## Diagnostic Protocol

### Step 1: Run Foundation Sync Check

**Command:**
```bash
cd backend && bin/rails foundation:check
```

**Expected Output (GOOD):**
```
🔍 Checking Foundation column sync...

✅ All Foundation columns are in sync!
```

**Problem Output:**
```
🔍 Checking Foundation column sync...

=== Contacts (contacts) ===
  🔴 Orphaned (in DB, not in Foundation): xero_contact_types, city, state
  🟡 Missing (in Foundation, not in DB): old_field, deprecated_column

📊 Summary:
   1 foundation(s) with column sync issues
   3 orphaned column(s) (in DB but not in Foundation metadata)
   2 missing column(s) (in Foundation metadata but not in DB)

Run 'rails foundation:sync' to automatically fix these issues.
```

### Step 2: Analyze the Issues

For each Foundation with issues, determine:

**A. Orphaned Columns (in DB, not in metadata):**
- These are "invisible" to the Foundation system
- Users cannot see/edit these columns in the UI
- API may not return these columns
- **Action Required:** Add Column records

**B. Missing Columns (in metadata, not in DB):**
- These cause errors when Foundation tries to read them
- May have been deleted via migration but metadata not updated
- **Action Required:** Remove stale Column records

**C. Special Columns to Ignore:**
- `id`, `created_at`, `updated_at` (Rails auto-generated)
- Any columns explicitly excluded by Foundation system

### Step 3: Validate Column Types

For each orphaned column, verify the inferred column type is correct:

**Type Inference Logic:**
```ruby
# String columns
"email" if col_name.include?("email")
"phone" if col_name.include?("phone") && !col_name.include?("mobile")
"mobile" if col_name.include?("mobile")
"url" if col_name.include?("url")
"abn" if col_name == "abn"
"acn" if col_name == "acn"
"bsb" if col_name.include?("bsb")
"tfn" if col_name == "tfn"
"postcode" if col_name == "postcode"
"single_line_text" (default)

# Text columns
"array_of_items" if db_col.array?
"multiple_lines_text" (default)

# Numeric columns
"whole_number" (integers)
"percentage" if col_name includes "percent" or "rate"
"currency" if col_name includes "price", "cost", "amount"
"number" (default for decimals)

# Other types
"boolean" (boolean fields)
"date" (date fields)
"date_and_time" (datetime/timestamp fields)
"structured_data" (jsonb/json fields)
```

**Review each inferred type and flag any that seem incorrect.**

### Step 4: Run Sync Fix (if approved)

**Dry-run mode (safe):**
```bash
cd backend && bin/rails foundation:check
```

**Auto-fix mode:**
```bash
cd backend && bin/rails foundation:sync
```

**Fix specific Foundation:**
```bash
cd backend && bin/rails 'foundation:sync_foundation[Contacts]'
```

**Expected Fix Output:**
```
🔧 Syncing Foundation metadata with database schema...

=== Contacts (contacts) ===
  ➕ Adding orphaned column: xero_contact_types (array_of_items)
  ➕ Adding orphaned column: city (single_line_text)
  ➕ Adding orphaned column: state (single_line_text)
  ➖ Removing stale metadata: old_field
  ➖ Removing stale metadata: deprecated_column

✅ Sync complete!
   3 column(s) added to Foundation metadata
   2 stale column metadata removed
   0 foundation(s) skipped (need manual review)
```

### Step 5: Verify Fix

**Re-run check:**
```bash
cd backend && bin/rails foundation:check
```

**Should now show:**
```
✅ All Foundation columns are in sync!
```

**Verify specific Foundation:**
```bash
cd backend && bin/rails runner "
foundation = Foundation.find_by(name: 'Contacts')
table_name = foundation.database_table_name
db_cols = ActiveRecord::Base.connection.columns(table_name).map(&:name) - ['id', 'created_at', 'updated_at']
meta_cols = foundation.columns.pluck(:column_name)
puts \"DB: #{db_cols.count}, Meta: #{meta_cols.count}, Match: #{db_cols.sort == meta_cols.sort}\"
"
```

### Step 6: Document the Issue (if it was a bug)

If the sync issue was caused by a bug (e.g., migration didn't update metadata), document it in Trinity Lexicon:

**Required fields:**
- **Category:** Lexicon (Bug History)
- **Chapter:** 1 (Database/Schema)
- **Title:** "Foundation Sync Bug: [table_name] - [brief description]"
- **Bug Type:** Data Inconsistency
- **Affected Tables:** [list tables]
- **Root Cause:** [why did schema and metadata diverge?]
- **Fix Applied:** [migration or sync command used]
- **Prevention:** [how to prevent this in the future]

## Success Criteria

✅ **PASS Criteria:**
- All Foundation tables have matching database columns and metadata
- No orphaned columns (except intentionally excluded ones)
- No missing columns (except Rails auto-generated ones)
- All column types are correctly mapped
- Foundation UI displays all columns properly

⚠️ **WARNING Criteria:**
- 1-5 minor sync issues (non-critical tables)
- Some Foundations skipped (special handling required)
- Column type inference needs manual review

❌ **FAIL Criteria:**
- Critical Foundation tables (Contacts, Jobs) out of sync
- More than 10 orphaned columns in a single Foundation
- Sync fix fails or errors
- Column records deleted but still referenced in code

## Common Issues & Solutions

### Issue 1: "Foundation not found" error
**Symptom:** Task fails with "Foundation 'X' not found"
**Cause:** Foundation record doesn't exist in database
**Fix:** Check if this is a system table that needs Foundation setup

### Issue 2: "Table does not exist" error
**Symptom:** Task skips Foundation, says table doesn't exist
**Cause:** Foundation.database_table_name doesn't match actual table
**Fix:** Update Foundation record or check for typos

### Issue 3: Too many orphaned columns
**Symptom:** 20+ columns missing from metadata
**Cause:** Initial Foundation setup incomplete
**Fix:** Run full sync, then review each column type manually

### Issue 4: Stale metadata won't delete
**Symptom:** Sync reports removing column but it persists
**Cause:** Column might be referenced in FoundationViews or filters
**Fix:** Check Column.remove_from_saved_views callback

### Issue 5: Wrong column type inferred
**Symptom:** Column added as "single_line_text" but should be "email"
**Cause:** Column name doesn't match inference patterns
**Fix:** Manually update Column.column_type after sync

## Files & Locations

**Task Definition:**
```
backend/lib/tasks/foundation_sync.rake
```

**Key Tasks:**
- `rails foundation:check` - Validate sync status
- `rails foundation:sync` - Auto-fix all Foundations
- `rails foundation:sync_foundation[Name]` - Sync specific Foundation

**Models:**
- `backend/app/models/foundation.rb` - Foundation model
- `backend/app/models/column.rb` - Column metadata model

**Migrations:**
- `backend/db/migrate/*_add_missing_*_foundation_columns.rb` - Example fix migrations

**Tests:**
- (TODO) Add RSpec tests for foundation:check task
- (TODO) Add RSpec tests for column type inference

## Related Agents

- **SSoT Agent** - Validates documentation consistency (complementary)
- **Data Warehouse Health** - Validates data integrity (complementary)
- **Gold Standard Table Integration** - Validates column type definitions

## Final Report Format

**If ALL IN SYNC:**
```
╔════════════════════════════════════════════════════════════════╗
║          FOUNDATION SCHEMA SYNC - VALIDATION COMPLETE           ║
╠════════════════════════════════════════════════════════════════╣
║  STATUS: ✅ ALL IN SYNC                                         ║
╠════════════════════════════════════════════════════════════════╣
║  Foundations Checked:     42                                   ║
║  Total Columns Validated: 2,847                                ║
║  Orphaned Columns:        0                                    ║
║  Missing Columns:         0                                    ║
║  Sync Issues:             0                                    ║
╠════════════════════════════════════════════════════════════════╣
║  Database Schema ↔ Foundation Metadata: SYNCHRONIZED           ║
╠════════════════════════════════════════════════════════════════╣
║  Tokens Used: ~2,500 (input) / ~500 (output)                  ║
╚════════════════════════════════════════════════════════════════╝
```

**If ISSUES FOUND:**
```
╔════════════════════════════════════════════════════════════════╗
║          FOUNDATION SCHEMA SYNC - VALIDATION COMPLETE           ║
╠════════════════════════════════════════════════════════════════╣
║  STATUS: ⚠️ ISSUES FOUND - ACTION REQUIRED                     ║
╠════════════════════════════════════════════════════════════════╣
║  Foundations Checked:     42                                   ║
║  Foundations with Issues: 3                                    ║
║  Total Columns Validated: 2,847                                ║
║  Orphaned Columns:        12 (in DB, not in Foundation)        ║
║  Missing Columns:         5 (in Foundation, not in DB)         ║
╠════════════════════════════════════════════════════════════════╣
║  CRITICAL ISSUES:                                              ║
║  - Contacts: 3 orphaned columns                                ║
║    • xero_contact_types, city, state                           ║
║  - Jobs: 2 orphaned columns                                    ║
║    • ted_number, archived_at                                   ║
║  - Purchase Orders: 5 missing columns                          ║
║    • old_status, legacy_field, etc.                            ║
╠════════════════════════════════════════════════════════════════╣
║  FIX COMMAND:                                                  ║
║  cd backend && bin/rails foundation:sync                       ║
╠════════════════════════════════════════════════════════════════╣
║  Tokens Used: ~3,200 (input) / ~800 (output)                  ║
╚════════════════════════════════════════════════════════════════╝
```

## Bible Rules Enforced

- **#1.13**: Single Source of Truth - Eliminate Data Duplication
- **#1.6**: Documentation Authority Hierarchy
- **#19.002**: Gold Standard Table is SSoT for column behavior
- **(New)**: Database schema is SSoT for what columns exist; Foundation metadata is SSoT for how columns behave

## Maintenance Notes

**When to Update This Agent:**
- New Foundation tables added
- Column type inference logic changes
- New special handling required for certain Foundations
- Sync task changes (foundation_sync.rake)

**Alert User If:**
- More than 5 Foundations out of sync
- Critical Foundation (Contacts, Jobs, Purchase Orders) has issues
- Sync fix fails multiple times
- Column type inference produces many incorrect types
