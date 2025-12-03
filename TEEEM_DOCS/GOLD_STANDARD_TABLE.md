# Gold Standard Table - Single Source of Truth

**Authority:** Trinity Documentation points here as THE reference for all table/column behavior.

**Purpose:** When anything is wrong with tables or columns, read THIS file first, fix it here, then sync code to match.

---

## The 31 Column Types

Every table in TEEEM can use these column types. Each type has specific validation rules, SQL storage, and display behavior.

### Text Types (6)

| # | Type | SQL | Validation Rules | Example |
|---|------|-----|------------------|---------|
| 1 | `single_line_text` | VARCHAR(255) | Optional, max 255 characters | CONC-001, STL-042A |
| 2 | `multiple_lines_text` | TEXT | Supports line breaks, unlimited length | Notes with\nmultiple lines |
| 3 | `email` | VARCHAR(255) | Must contain @, valid email format | supplier@example.com |
| 4 | `phone` | VARCHAR(20) | Format: (03) 9123 4567 or 1300 numbers | (03) 9123 4567 |
| 5 | `mobile` | VARCHAR(20) | Format: 04XX XXX XXX, starts with 04 | 0407 397 541 |
| 6 | `url` | VARCHAR(500) | Valid URL, starts with http:// or https:// | https://example.com/doc.pdf |

### Number Types (4)

| # | Type | SQL | Validation Rules | Example |
|---|------|-----|------------------|---------|
| 7 | `number` | NUMERIC(10,2) | Decimal numbers, up to 2 decimal places | 123.45 |
| 8 | `whole_number` | INTEGER | Integers only, no decimals | 42 |
| 9 | `currency` | NUMERIC(10,2) | Positive, 2 decimals, displays with $ | $1,234.56 |
| 10 | `percentage` | NUMERIC(5,2) | 0-100, displays with % symbol | 15.5% |

### Date & Time Types (2)

| # | Type | SQL | Validation Rules | Example |
|---|------|-----|------------------|---------|
| 11 | `date` | DATE | Stored: YYYY-MM-DD, Display: DD/MM/YYYY | 19/11/2024 |
| 12 | `date_and_time` | TIMESTAMP | Full timestamp with time | 19/11/2024 14:30 |

### Special Types (4)

| # | Type | SQL | Validation Rules | Example |
|---|------|-----|------------------|---------|
| 13 | `gps_coordinates` | VARCHAR(100) | Latitude, Longitude format | -33.8688, 151.2093 |
| 14 | `color_picker` | VARCHAR(7) | Hex color format #RRGGBB | #FF5733 |
| 15 | `file_upload` | TEXT | File path or URL to uploaded file | /uploads/doc.pdf |
| 16 | `action_buttons` | VARCHAR(255) | JSON config for row actions | {"buttons": [...]} |

### Selection Types (2)

| # | Type | SQL | Validation Rules | Example |
|---|------|-----|------------------|---------|
| 17 | `boolean` | BOOLEAN | True or False only | true, false |
| 18 | `choice` | VARCHAR(50) | Must be one of predefined options | Active, Pending, Complete |

### Relationship Types (3)

| # | Type | SQL | Validation Rules | Example |
|---|------|-----|------------------|---------|
| 19 | `lookup` | VARCHAR(255) | Must reference valid value from linked table | Product #123 |
| 20 | `multiple_lookups` | TEXT | Array of IDs stored as JSON | [1, 5, 12] |
| 21 | `user` | INTEGER | Must reference valid user ID | User #7 |

### Computed Types (1)

| # | Type | SQL | Validation Rules | Example |
|---|------|-----|------------------|---------|
| 22 | `computed` | VIRTUAL | Read-only, calculated from formula | $1,255.00 (price × qty) |

### Advanced Types (3)

| # | Type | SQL | Validation Rules | Example |
|---|------|-----|------------------|---------|
| 23 | `structured_data` | JSONB | Valid JSON object, supports nesting | {"key": "value"} |
| 24 | `array_of_items` | TEXT[] | Array of text values | ["tag1", "tag2"] |
| 25 | `searchable_text` | TSVECTOR | Read-only, auto-generated for search | 'search':1 'term':2 |

### Australian Types (6)

| # | Type | SQL | Validation Rules | Example |
|---|------|-----|------------------|---------|
| 26 | `abn` | VARCHAR(14) | 11 digits, format: XX XXX XXX XXX | 51 824 753 556 |
| 27 | `acn` | VARCHAR(11) | 9 digits, format: XXX XXX XXX | 004 085 616 |
| 28 | `bsb` | VARCHAR(7) | 6 digits, format: XXX-XXX | 063-000 |
| 29 | `bank_account` | VARCHAR(9) | Up to 9 digits | 12345678 |
| 30 | `postcode` | VARCHAR(4) | Exactly 4 digits | 3000 |
| 31 | `tfn` | VARCHAR(11) | 9 digits, format: XXX XXX XXX | 123 456 789 |

---

## System-Generated Columns

These columns are automatically managed and should NEVER be edited by users:

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-increment primary key |
| `created_at` | TIMESTAMP | When record was created |
| `updated_at` | TIMESTAMP | When record was last modified |

**Display:** System columns should have light red background (#fee2e2) to indicate read-only.

---

## TeeemTableView Standard Features

When a table has `foundationIdNumeric` set, it automatically gets:

| Feature | Behavior |
|---------|----------|
| **Import** | Enabled in menu |
| **Export** | Enabled in menu |
| **Schema Editor** | Create/Edit/Delete columns in menu |
| **Filters Button** | Visible in toolbar (built-in, not customActions) |
| **GlobalViewsManager** | Opens when Filters clicked |
| **Table ID Display** | Shows in menu under TABLE INFO |
| **System Column Highlighting** | Red background on id, created_at, updated_at |

### Standard Toolbar Layout

```
[+ Add]  [Search...]  [View Buttons]  [Custom Actions]  [Filters]  [⋮ Menu]
   ↑          ↑            ↑               ↑               ↑          ↑
leftActions  always    saved views    customActions    auto when   dropdown
                                                      foundation
                                                        ID set
```

### Minimal Implementation

```tsx
<TeeemTableView
  entries={data}
  columns={columns}
  foundationIdNumeric={TABLE_ID}  // ← This enables Filters button + GlobalViewsManager automatically
  tableName="My Table"
  onAddRow={handleAdd}            // ← Shows [+ Add] button in toolbar
  onView={handleView}
  onEdit={handleEdit}
  onDelete={handleDelete}
  onRefresh={handleRefresh}       // ← Called when views change in GlobalViewsManager
/>
```

### Implementation Details (for future reference)

**DO NOT duplicate this in page components.** The Filters button and GlobalViewsManager are built into TeeemTableView:

1. **Filters Button**: Rendered automatically in toolbar when `foundationIdNumeric` is set
   - Location: `TeeemTableView.tsx` line ~4247
   - Opens `showGlobalViewsManager` state

2. **GlobalViewsManager**: Rendered at end of component when `foundationIdNumeric` is set
   - Location: `TeeemTableView.tsx` line ~5448
   - Receives columns transformed from COLUMNS array
   - Calls `onRefresh` when views change
   - Calls `loadViewState` when a view is applied

**NEVER:**
- Pass Filters button via `customActions` (it's built-in)
- Import GlobalViewsManager in page components for table views
- Duplicate the state/button/component pattern in individual pages

**ALWAYS:**
- Just set `foundationIdNumeric` and `onRefresh` props
- The Filters button and GlobalViewsManager will appear automatically

---

## Code Locations (Must Match This Spec)

| What | File | Must Match |
|------|------|------------|
| SQL Types | `backend/app/models/column.rb` → `COLUMN_SQL_TYPE_MAP` | Section: The 31 Column Types |
| Validation | `backend/app/controllers/api/v1/column_types_controller.rb` | Section: The 31 Column Types |
| Categories | `column_types_controller.rb` → `categorize_column_type()` | Section headers above |
| Frontend Cache | `frontend-next/lib/column-types.ts` | Generated from API |
| System Columns | `TeeemTableView.tsx` → `SYSTEM_GENERATED_TYPES` | Section: System-Generated |

---

## Troubleshooting Workflow

**Problem with a table?**

1. **Read this file** - Is the expected behavior documented here?
2. **If not documented** - Add it to this file first
3. **If documented but broken** - Find which code location doesn't match
4. **Fix the code** - Make it match this spec
5. **Verify** - Test in Gold Standard Table (ID: 1) first

**Never:**
- Fix code without checking this spec first
- Add features to code without documenting here
- Have code that contradicts this spec

---

## Gold Standard Table (Foundation ID: 1)

The Gold Standard Table is a **demonstration** of this spec. It should have:
- One column of each type (31 columns)
- Sample data showing valid values
- All TeeemTableView features working

**URL:** `/admin/system?tab=gold-standard`

---

## Version History

| Date | Change |
|------|--------|
| 2024-12-03 | Created as SSoT, documented all 31 column types |
