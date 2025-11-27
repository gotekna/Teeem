# Plan: Gold Standard Setup for Schema Registry (foundations table)

## Current State

The `Schema Registry` foundation entry exists (ID: 453) with:
- ✅ `name`: "Schema Registry"
- ✅ `database_table_name`: "foundations"
- ✅ `model_class`: "Foundation"
- ✅ `table_type`: "system"
- ❌ `columns`: 0 defined (should have ~20)
- ❌ `title_column`: null (should be "name")

## Problem

The Schema Registry table has no column definitions, so it won't display properly in TeeemTableView. Users can't view/manage the foundations through the standard table UI.

## Solution: Define Columns for Schema Registry

### Columns to Add (based on actual `foundations` table schema)

| Column Name | Type | Display Name | Required | Notes |
|-------------|------|--------------|----------|-------|
| id | whole_number | ID | yes | Primary key |
| name | single_line_text | Name | yes | **Title column** |
| singular_name | single_line_text | Singular Name | no | Display name |
| plural_name | single_line_text | Plural Name | no | Display name |
| database_table_name | single_line_text | Database Table | yes | Actual PG table |
| model_class | single_line_text | Model Class | no | Rails model name |
| table_type | choice | Type | no | system/custom |
| slug | single_line_text | Slug | yes | URL identifier |
| description | multiple_lines_text | Description | no | |
| icon | single_line_text | Icon | no | Icon class |
| title_column | single_line_text | Title Column | no | Which column is the title |
| searchable | boolean | Searchable | no | |
| is_live | boolean | Is Live | no | |
| has_saved_views | boolean | Has Saved Views | no | |
| has_ui | boolean | Has UI | no | |
| feature | single_line_text | Feature | no | Feature group |
| api_endpoint | single_line_text | API Endpoint | no | |
| file_location | single_line_text | File Location | no | |
| created_at | date_time | Created | no | |
| updated_at | date_time | Updated | no | |

### Implementation Steps

1. **Create columns for Schema Registry foundation**
   - Add each column with appropriate type and settings
   - Set `name` as the title column
   - Set `table_type` as a choice field with options: system, custom

2. **Update the foundation record**
   - Set `title_column` to "name"
   - Ensure `has_ui` is true

3. **Verify in UI**
   - Open Schema Registry in TeeemTableView
   - Confirm all foundations are visible
   - Test filtering and sorting

## Code to Execute

```ruby
# Run via: bin/rails runner 'load "scripts/setup_schema_registry_columns.rb"'

foundation = Foundation.find_by(name: "Schema Registry")

# Update foundation settings
foundation.update!(title_column: "name")

# Define columns
columns_to_create = [
  { column_name: "id", column_type: "whole_number", name: "ID", required: true, position: 1 },
  { column_name: "name", column_type: "single_line_text", name: "Name", required: true, is_title: true, position: 2 },
  { column_name: "singular_name", column_type: "single_line_text", name: "Singular Name", position: 3 },
  { column_name: "plural_name", column_type: "single_line_text", name: "Plural Name", position: 4 },
  { column_name: "database_table_name", column_type: "single_line_text", name: "Database Table", required: true, position: 5 },
  { column_name: "model_class", column_type: "single_line_text", name: "Model Class", position: 6 },
  { column_name: "table_type", column_type: "choice", name: "Type", available_choices: ["system", "custom"], position: 7 },
  { column_name: "slug", column_type: "single_line_text", name: "Slug", required: true, position: 8 },
  { column_name: "description", column_type: "multiple_lines_text", name: "Description", position: 9 },
  { column_name: "icon", column_type: "single_line_text", name: "Icon", position: 10 },
  { column_name: "title_column", column_type: "single_line_text", name: "Title Column", position: 11 },
  { column_name: "searchable", column_type: "boolean", name: "Searchable", position: 12 },
  { column_name: "is_live", column_type: "boolean", name: "Is Live", position: 13 },
  { column_name: "has_saved_views", column_type: "boolean", name: "Has Saved Views", position: 14 },
  { column_name: "has_ui", column_type: "boolean", name: "Has UI", position: 15 },
  { column_name: "feature", column_type: "single_line_text", name: "Feature", position: 16 },
  { column_name: "api_endpoint", column_type: "single_line_text", name: "API Endpoint", position: 17 },
  { column_name: "file_location", column_type: "single_line_text", name: "File Location", position: 18 },
  { column_name: "created_at", column_type: "date_time", name: "Created", position: 19 },
  { column_name: "updated_at", column_type: "date_time", name: "Updated", position: 20 },
]

columns_to_create.each do |col_attrs|
  foundation.columns.find_or_create_by(column_name: col_attrs[:column_name]) do |col|
    col.assign_attributes(col_attrs)
  end
end

puts "Created #{foundation.columns.count} columns for Schema Registry"
```

## Risks & Considerations

- **None significant** - This is adding metadata only, no schema changes
- Columns table already exists and is used by other foundations
- No migration needed

## Estimated Effort

- ~10 minutes to run the script and verify
