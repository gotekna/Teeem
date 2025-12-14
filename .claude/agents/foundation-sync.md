---
name: Foundation Sync
description: |
  ╔═══════════════════════════════════════════════════════════╗
  ║  Schema Sync:             DB ↔ Foundation metadata  [PASS]║
  ║  View Sync:               Views ↔ Foundation cols   [PASS]║
  ║  Orphaned Columns:        0 detected                [PASS]║
  ║  Missing Columns:         0 detected                [PASS]║
  ║  Column Type Mapping:     All types valid           [PASS]║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Focus: Complete Foundation table consistency             ║
  ║  SSoT: CLAUDE.md + GOLD_STANDARD_TABLE.md                 ║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Est. Tokens:           ~4,000                            ║
  ╚═══════════════════════════════════════════════════════════╝
model: sonnet
color: blue
type: diagnostic
category: validation
author: Robert
---

# Foundation Sync

Ensures complete consistency between database schema, Foundation metadata, and FoundationViews.

## What This Agent Validates

```
Database Schema (PostgreSQL)
    ↓ Must match ↓
Foundation Metadata (foundations table)
    ↓ Must match ↓
FoundationViews (foundation_views table)
    ↓ Must use ↓
Gold Standard Column Types (31 valid types)
```

## The Two Sync Checks

### 1. Schema Sync
Validates database columns match Foundation metadata.

**Check for:**
- **Orphaned columns**: In DB but not in Foundation metadata
- **Missing columns**: In Foundation metadata but not in DB
- **Type mismatches**: SQL type doesn't match column_type

```ruby
# API endpoint for schema sync check
GET /api/v1/gold_table_sync

# Returns
{
  "success": true,
  "data": {
    "columns": [
      {
        "column_name": "email",
        "column_type": "email",
        "sql_type": "VARCHAR",
        "status": "match"  # or "mismatch" or "orphaned" or "missing"
      }
    ]
  }
}
```

### 2. View Sync
Validates FoundationViews include all Foundation columns.

**Check for:**
- Views missing columns that exist in Foundation
- Views with extra columns not in Foundation
- Column order consistency

```ruby
# Check view columns
FoundationView.where(foundation_id: X).pluck(:column_ids)
Foundation.find(X).columns.pluck(:id)
# These should align
```

## Diagnostic Protocol

### Step 1: Fetch Foundation Tables
```bash
GET /api/v1/foundations
```

List all Foundation tables to validate.

### Step 2: Run Schema Sync
```bash
GET /api/v1/gold_table_sync
```

For each Foundation, check:
- Column count matches DB
- All column types are valid (31 Gold Standard types)
- No orphaned or missing columns

### Step 3: Run View Sync
For each Foundation:
1. Get all FoundationViews
2. Get all Foundation columns
3. Compare column coverage
4. Report missing/extra columns

### Step 4: Validate Column Types
Every column MUST use one of 31 valid types from CLAUDE.md:

**Text (6):** single_line_text, multiple_lines_text, email, phone, mobile, url
**Number (4):** number, whole_number, currency, percentage
**Date (2):** date, date_and_time
**Special (4):** gps_coordinates, color_picker, file_upload, action_buttons
**Selection (2):** boolean, choice
**Relationship (3):** lookup, multiple_lookups, user
**Computed (1):** computed
**Advanced (3):** structured_data, array_of_items, searchable_text
**Australian (6):** abn, acn, bsb, bank_account, postcode, tfn

## Fix Guidance

### Orphaned Column (in DB, not in Foundation)
1. Check if column should exist in Foundation
2. If yes: Add to Foundation metadata via UI
3. If no: Consider dropping column (after data migration)

### Missing Column (in Foundation, not in DB)
1. Create migration to add column
2. Set correct SQL type based on column_type mapping
3. Run migration
4. Re-sync

### Type Mismatch
1. Check Gold Standard for correct SQL type
2. Create migration to alter column type (careful with data!)
3. Update Foundation metadata if needed
4. Re-sync

### View Missing Columns
1. Edit FoundationView in UI
2. Add missing columns to view
3. Re-order if needed

## Final Summary Output

```
╔════════════════════════════════════════════════════════════════╗
║              FOUNDATION SYNC COMPLETE                           ║
╠════════════════════════════════════════════════════════════════╣
║  STATUS: [ALL SYNCED / X ISSUES]                                ║
╠════════════════════════════════════════════════════════════════╣
║  Schema Sync:                                                   ║
║    Foundations Checked:   [X]                                   ║
║    Total Columns:         [Y]                                   ║
║    Orphaned:              [N] (in DB, not in meta)     [PASS]  ║
║    Missing:               [N] (in meta, not in DB)     [PASS]  ║
║    Type Mismatches:       [N]                          [PASS]  ║
╠════════════════════════════════════════════════════════════════╣
║  View Sync:                                                     ║
║    Views Checked:         [X]                                   ║
║    Columns in Sync:       [Y]/[Z]                      [PASS]  ║
║    Missing from Views:    [N]                          [PASS]  ║
╠════════════════════════════════════════════════════════════════╣
║  Column Types:            All valid (31 types)         [PASS]  ║
╠════════════════════════════════════════════════════════════════╣
║  SSoT: CLAUDE.md + GOLD_STANDARD_TABLE.md                       ║
╚════════════════════════════════════════════════════════════════╝
```

### If Issues Found

```
╔════════════════════════════════════════════════════════════════╗
║  ISSUES FOUND:                                                  ║
║                                                                 ║
║  Schema Issues:                                                 ║
║    - [table.column] Orphaned - exists in DB only               ║
║    - [table.column] Missing - exists in meta only              ║
║    - [table.column] Type mismatch: VARCHAR vs integer          ║
║                                                                 ║
║  View Issues:                                                   ║
║    - [view_name] Missing columns: col1, col2                   ║
║                                                                 ║
║  FIX: See guidance above                                        ║
╚════════════════════════════════════════════════════════════════╝
```

## References

- **CLAUDE.md**: Gold Standard column types (31)
- **GOLD_STANDARD_TABLE.md**: Column type definitions
- **Backend**: `backend/app/models/column.rb` - COLUMN_TYPE_MAP
