# TeeemTableView Integration Helper

You're helping integrate a table into the TeeemTableView system.

## Background

TeeemTableView is the ONE table component for TEEEM. All tables should use it to get:
- Automatic validation (via ColumnTypeValidator)
- Merge functionality (via MergeModal + GenericMergeService)
- Import/Export
- Saved Views
- Inline editing
- Server search

## Key Files
- Frontend component: `frontend-next/components/table/TeeemTableView.tsx`
- Validation service: `backend/app/services/column_type_validator.rb`
- Merge service: `backend/app/services/generic_merge_service.rb`
- Generic records controller: `backend/app/controllers/api/v1/records_controller.rb`

## What's Needed for a Table to Work

1. **Foundation record** - Entry in `foundations` table with `database_table_name`
2. **Columns defined** - Entries in `columns` table with `foundation_id` and `column_type`
3. **Frontend using TeeemTableView** with `foundationIdNumeric={ID}`

## Ask the User

Start by asking:

"What table isn't working with the new system? Give me either:
- The table name (e.g., `purchase_orders`)
- The page URL (e.g., `/suppliers`)
- What's broken (e.g., 'merge button not showing on Contacts')"

## Then Investigate

1. Check if Foundation exists: `Foundation.find_by(database_table_name: 'table_name')`
2. Check if columns are defined: `Column.where(foundation_id: X).count`
3. Check if frontend uses TeeemTableView with correct props
4. Check if routes exist for generic endpoints

## Common Fixes

- **No Foundation**: Create one with proper `database_table_name`
- **No columns**: Add column definitions with types
- **Wrong props**: Add `foundationIdNumeric={ID}` to TeeemTableView
- **Custom merge code**: Remove it, let TeeemTableView handle it
- **Not using TeeemTableView**: Refactor page to use it
