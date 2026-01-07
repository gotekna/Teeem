# TeeemTableView Integration Helper

You're helping integrate or fix a table in the TeeemTableView system.

## Single Source of Truth

**ALWAYS read `TEEEM_DOCS/GOLD_STANDARD_TABLE.md` first.**

This file defines:
- All 31 column types with SQL types, validation rules, and examples
- System-generated columns (id, created_at, updated_at)
- TeeemTableView standard features (what auto-enables)
- Code locations that must match the spec
- Troubleshooting workflow

## The Golden Rule

**When `foundationIdNumeric` is set, the table automatically gets:**
- Import/Export in menu
- Schema Editor (Create/Edit/Delete columns)
- Filters button in toolbar
- Table ID in menu
- System column highlighting (red background)

## Key Files

| What | File |
|------|------|
| **SSoT Spec** | `TEEEM_DOCS/GOLD_STANDARD_TABLE.md` |
| Frontend component | `frontend-next/components/table/TeeemTableView.tsx` |
| Column types API | `backend/app/controllers/api/v1/column_types_controller.rb` |
| SQL type mapping | `backend/app/models/column.rb` → `COLUMN_SQL_TYPE_MAP` |

## What's Needed for a Table to Work

1. **Foundation record** - Entry in `foundations` table with `database_table_name`
2. **Columns defined** - Entries in `columns` table with `foundation_id` and `column_type`
3. **Frontend using TeeemTableView** with `foundationIdNumeric={ID}`

That's it! Everything else auto-enables.

## Troubleshooting Workflow

1. **Read GOLD_STANDARD_TABLE.md** - Is the expected behavior documented?
2. **If not documented** - Add it to the MD first
3. **If documented but broken** - Find which code doesn't match
4. **Fix the code** - Make it match the spec
5. **Test in Gold Standard Table (ID: 1)** - Verify it works there first

## Ask the User

Start by asking:

"What table isn't working? Give me:
- The table name (e.g., `purchase_orders`)
- The page URL (e.g., `/corporate`)
- What's broken (e.g., 'Import missing from menu')"

## Investigation Steps

1. Read `TEEEM_DOCS/GOLD_STANDARD_TABLE.md` to understand expected behavior
2. Check if Foundation exists: `Foundation.find_by(database_table_name: 'table_name')`
3. Check if columns are defined: `Column.where(foundation_id: X).count`
4. Check if frontend uses TeeemTableView with `foundationIdNumeric`
5. Compare actual behavior to GOLD_STANDARD_TABLE.md spec

## Common Fixes

| Problem | Fix |
|---------|-----|
| Features missing | Add `foundationIdNumeric={ID}` to TeeemTableView |
| No Foundation | Create one with proper `database_table_name` |
| No columns | Add column definitions with types |
| Column type wrong | Check GOLD_STANDARD_TABLE.md for correct type |
| Validation wrong | Update backend controller to match MD spec |
