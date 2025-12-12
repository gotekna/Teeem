---
name: Foundation View Sync
description: |
  ╔═══════════════════════════════════════════════════════════╗
  ║  Foundation Columns:      23 (Jobs table)          [INFO] ║
  ║  Views in Foundation:     13 views                 [INFO] ║
  ║  Views in Sync:           13/13                    [PASS] ║
  ║  Missing Columns:         0                        [PASS] ║
  ║  Extra Columns:           0                        [PASS] ║
  ║  Sync Status:             ✅ ALL VIEWS IN SYNC             ║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Focus: FoundationView ↔ Foundation columns sync          ║
  ║  Covers: All views for all Foundation tables              ║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Est. Tokens:           ~2,000                            ║
  ╚═══════════════════════════════════════════════════════════╝
model: sonnet
color: purple
type: diagnostic
category: validation
author: Robert
---

# Foundation View Sync Agent

**Agent ID:** foundation-view-sync
**Type:** Specialized Diagnostic Agent (diagnostic)
**Focus:** FoundationView ↔ Foundation Column Sync Validation
**Priority:** 85
**Model:** Sonnet (default)

## Purpose

Validates that all FoundationViews are synchronized with their Foundation's columns. When a column is added or removed from a Foundation, all views for that Foundation must be updated to include/remove that column.

**Critical SSoT Hierarchy:**
```
Foundation Columns (columns table) ← SSoT for what columns EXIST
    ↕ MUST MATCH
FoundationView Columns (JSON field) ← SSoT for which columns are VISIBLE/HIDDEN in each view
```

When these diverge:
- View Manager doesn't show all available columns
- Users can't toggle visibility of new columns
- Deleted columns remain in view configs (orphaned references)
- View filters/sorts may reference non-existent columns

## Capabilities

- Scan all FoundationViews for sync issues
- Identify missing columns (in Foundation but not in views)
- Identify extra columns (in views but not in Foundation)
- Auto-sync views when columns are created/deleted (via Column model callbacks)
- Manual sync via rake tasks for bulk operations
- Validate view column counts match Foundation column counts

## When to Use

**Proactively (Scheduled):**
- Weekly health check (run every Monday)
- After production deploys
- Before major releases

**Reactively (On-Demand):**
- After manually adding columns via Rails migrations
- When users report "can't see all columns in View Manager"
- When investigating view display issues
- Before adding new Foundation tables

**Automatically (Built-in):**
- ✅ **NEW:** Column model callbacks automatically sync views
  - `after_commit :add_to_saved_views` (when column created)
  - `before_destroy :remove_from_saved_views` (when column deleted)
- No manual intervention needed for normal column operations

## Tools Available

- Bash (for rails runner, rake tasks)
- Read, Grep, Glob (code analysis)

## Diagnostic Protocol

### Step 1: Run FoundationView Sync Check

**Command:**
```bash
cd backend && bin/rails foundation_views:check
```

**Expected Output (GOOD):**
```
=== Checking Foundations for View Sync Issues ===

✓ All foundations are in sync!
```

**Problem Output:**
```
=== Checking Foundations for View Sync Issues ===

Found 3 foundations that need syncing:

  Jobs
    Mismatched views: 12/13

  Contacts
    Mismatched views: 9/9

  Pricebook
    Mismatched views: 4/5

Run 'bin/rails foundation_views:sync_all' to fix all issues
```

### Step 2: Analyze the Issues

For each Foundation with mismatched views, determine:

**A. Missing Columns (in Foundation, not in views):**
- New columns added to Foundation but not yet in view configs
- Views will show incomplete column lists in View Manager
- **Action Required:** Add columns to all views (defaults to hidden)

**B. Extra Columns (in views, not in Foundation):**
- Columns deleted from Foundation but still referenced in views
- Orphaned column references in view configs
- May cause errors when rendering views
- **Action Required:** Remove orphaned columns from all views

**Common Extra Columns (legacy UI artifacts):**
- `user_id` - Old UI pattern, no longer used
- `select` - Checkbox column, should not be in config
- `actions` - Action buttons column, should not be in config
- `full_name` - Computed/virtual column, not a real column

### Step 3: Run Sync Fix (if needed)

**Note:** Auto-sync now prevents most issues. Only needed for:
- Legacy views created before auto-sync was implemented
- Bulk operations where callbacks were skipped
- Manual database changes outside Rails

**Check specific Foundation:**
```bash
cd backend && bin/rails "foundation_views:sync_foundation[Jobs]"
```

**Fix all Foundations:**
```bash
cd backend && bin/rails foundation_views:sync_all
```

**Expected Fix Output:**
```
=== Syncing Views for Jobs ===

View: all (Global, ID: 125)
  Adding 1 missing columns:
    + design_id

View: Default View (Personal, ID: 118)
  Adding 1 missing columns:
    + design_id
  Removing 2 extra columns:
    - select
    - actions

=== Summary for Jobs ===
Views synced: 12/13
Columns added: 7
Columns removed: 7
```

### Step 4: Verify Fix

**Re-run check:**
```bash
cd backend && bin/rails foundation_views:check
```

**Should now show:**
```
✓ All foundations are in sync!
```

**Verify specific Foundation:**
```bash
cd backend && bin/rails runner "
foundation = Foundation.find_by(name: 'Jobs')
all_view = FoundationView.global_views.find_by(foundation_id: foundation.id, name: 'all')
puts 'Foundation columns: ' + foundation.columns.count.to_s
puts 'View columns: ' + all_view.columns['visible'].keys.count.to_s
puts 'Status: ' + (foundation.columns.count == all_view.columns['visible'].keys.count ? '✅ SYNCED' : '❌ MISMATCHED')
"
```

### Step 5: Test Auto-Sync (Optional)

Verify auto-sync is working by creating/deleting a test column:

```bash
cd backend && bin/rails runner "
foundation = Foundation.find_by(name: 'Jobs')
before_count = foundation.foundation_views.first.columns['visible'].keys.count

# Create test column (auto-sync triggers)
col = foundation.columns.create!(
  name: 'Test Auto Sync',
  column_name: 'test_auto_sync',
  column_type: 'single_line_text',
  position: 999
)

after_count = foundation.foundation_views.first.columns['visible'].keys.count
puts 'Before: ' + before_count.to_s + ', After: ' + after_count.to_s
puts (after_count == before_count + 1 ? '✅ Auto-sync working!' : '❌ Auto-sync failed!')

# Clean up
col.destroy!
"
```

## Success Criteria

✅ **PASS Criteria:**
- All FoundationViews have matching column counts with their Foundation
- No missing columns in any views
- No extra/orphaned columns in any views
- Auto-sync callbacks are working (Column model)
- View Manager displays all available columns

⚠️ **WARNING Criteria:**
- 1-3 Foundations with minor view sync issues
- Only legacy/personal views out of sync (global views OK)
- Auto-sync working but legacy views need manual sync

❌ **FAIL Criteria:**
- Critical Foundations (Jobs, Contacts, Pricebook) have view sync issues
- More than 5 Foundations out of sync
- Auto-sync callbacks not working
- Sync fix fails or errors
- Global views out of sync

## Common Issues & Solutions

### Issue 1: "Can't see all columns in View Manager"
**Symptom:** User reports missing columns in UI
**Cause:** New column added but not synced to views
**Fix:** Run `bin/rails foundation_views:sync_all`
**Prevention:** Ensure Column model callbacks are enabled

### Issue 2: "Extra columns showing in view config"
**Symptom:** Deleted column still appears in view JSON
**Cause:** Column deleted but `remove_from_saved_views` callback didn't run
**Fix:** Run sync task to clean up orphaned columns
**Prevention:** Always delete columns via Rails (not raw SQL)

### Issue 3: Auto-sync not working
**Symptom:** New columns not appearing in views automatically
**Cause:** Callbacks disabled or service not loaded
**Fix:** Check Column model has `after_commit :add_to_saved_views`
**Fix:** Verify FoundationViewSyncService is loaded
**Prevention:** Run test suite to verify callbacks

### Issue 4: Performance issues with many views
**Symptom:** Creating a column takes 10+ seconds
**Cause:** Auto-sync updating 100+ views synchronously
**Fix:** Consider moving sync to background job for large Foundations
**Prevention:** Optimize FoundationViewSyncService for batch operations

## Files & Locations

**Service Class:**
```
backend/app/services/foundation_view_sync_service.rb
```

**Column Model (Auto-sync callbacks):**
```
backend/app/models/column.rb
  - after_commit :add_to_saved_views, on: :create
  - before_destroy :remove_from_saved_views
```

**Rake Tasks:**
```
backend/lib/tasks/foundation_views.rake
  - rails foundation_views:check (dry run)
  - rails foundation_views:sync_all (fix all)
  - rails foundation_views:sync_foundation[Name] (fix one)
```

**Models:**
- `backend/app/models/foundation.rb` - Foundation model
- `backend/app/models/foundation_view.rb` - View model
- `backend/app/models/column.rb` - Column model (with auto-sync)

## Auto-Sync Implementation

**How It Works:**

1. **When a column is created:**
   ```ruby
   # Column model - after_commit callback
   after_commit :add_to_saved_views, on: :create

   def add_to_saved_views
     FoundationViewSyncService.sync_foundation_views(foundation, column_name: column_name)
   end
   ```
   - Finds all views for the Foundation
   - Adds the new column to each view's `visible` hash (defaults to `false`)
   - Adds the column to each view's `order` array
   - Saves each view (skips validation to avoid orphaned view issues)

2. **When a column is deleted:**
   ```ruby
   # Column model - before_destroy callback
   before_destroy :remove_from_saved_views

   def remove_from_saved_views
     views = FoundationView.where(foundation_id: foundation_id)
     views.find_each do |view|
       view.columns['visible']&.delete(column_name)
       view.columns['order']&.delete(column_name)
       view.columns['widths']&.delete(column_name)
       view.filters&.delete(column_name)
       view.save!(validate: false)
     end
   end
   ```
   - Removes column from `visible`, `order`, `widths` hashes
   - Removes column from `filters` if present
   - Removes column from `sort_order` if it was the sort column

**Result:** Views stay synchronized automatically - no manual intervention needed!

## Related Agents

- **Foundation Schema Sync** - Validates database ↔ Foundation metadata sync (complementary)
- **SSoT Agent** - Validates documentation consistency (complementary)
- **UI Table Auditor** - Validates TeeemTableView compliance (complementary)

## Final Report Format

**If ALL IN SYNC:**
```
╔════════════════════════════════════════════════════════════════╗
║       FOUNDATION VIEW SYNC - VALIDATION COMPLETE                ║
╠════════════════════════════════════════════════════════════════╣
║  STATUS: ✅ ALL VIEWS IN SYNC                                   ║
╠════════════════════════════════════════════════════════════════╣
║  Foundations Checked:     30                                   ║
║  Total Views Validated:   127                                  ║
║  Views in Sync:           127/127                              ║
║  Missing Columns:         0                                    ║
║  Extra Columns:           0                                    ║
╠════════════════════════════════════════════════════════════════╣
║  FoundationViews ↔ Foundation Columns: SYNCHRONIZED            ║
║  Auto-Sync: ✅ ENABLED (Column model callbacks active)         ║
╠════════════════════════════════════════════════════════════════╣
║  Tokens Used: ~1,800 (input) / ~400 (output)                  ║
╚════════════════════════════════════════════════════════════════╝
```

**If ISSUES FOUND:**
```
╔════════════════════════════════════════════════════════════════╗
║       FOUNDATION VIEW SYNC - VALIDATION COMPLETE                ║
╠════════════════════════════════════════════════════════════════╣
║  STATUS: ⚠️ ISSUES FOUND - ACTION REQUIRED                     ║
╠════════════════════════════════════════════════════════════════╣
║  Foundations Checked:     30                                   ║
║  Foundations with Issues: 3                                    ║
║  Total Views Validated:   127                                  ║
║  Views in Sync:           73/127                               ║
║  Views Out of Sync:       54                                   ║
║  Columns to Add:          380                                  ║
║  Columns to Remove:       239                                  ║
╠════════════════════════════════════════════════════════════════╣
║  CRITICAL ISSUES:                                              ║
║  - Jobs: 12/13 views out of sync                               ║
║    Missing: design_id (7 views)                                ║
║    Extra: user_id, select, actions (7 views)                   ║
║                                                                ║
║  - Contacts: 9/9 views out of sync                             ║
║    Missing: 29 columns (avg per view)                          ║
║    Extra: full_name, contact_types (9 views)                   ║
║                                                                ║
║  - Pricebook: 4/5 views out of sync                            ║
║    Missing: category_id, supplier_id (4 views)                 ║
╠════════════════════════════════════════════════════════════════╣
║  FIX COMMAND:                                                  ║
║  cd backend && bin/rails foundation_views:sync_all             ║
╠════════════════════════════════════════════════════════════════╣
║  Tokens Used: ~2,400 (input) / ~900 (output)                  ║
╚════════════════════════════════════════════════════════════════╝
```

## Bible Rules Enforced

- **#1.13**: Single Source of Truth - Eliminate Data Duplication
- **#1.6**: Documentation Authority Hierarchy
- **#19.002**: Gold Standard Table is SSoT for column behavior
- **(New)**: Foundation columns are SSoT for what columns exist; FoundationViews are SSoT for column visibility per view

## Maintenance Notes

**When to Update This Agent:**
- FoundationViewSyncService changes
- Column model callback changes
- New view sync issues discovered
- Performance optimizations needed

**Alert User If:**
- More than 5 Foundations out of sync
- Critical Foundation (Jobs, Contacts, Purchase Orders) has view issues
- Auto-sync callbacks not working
- Sync fix fails multiple times
