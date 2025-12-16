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

**Row 1 - Main Toolbar:**
```
[+ Add]  [Search...]  [View: Inline/Panel]  [Custom Actions]  [Filters]  [⋮ Menu]
   ↑          ↑              ↑                     ↑               ↑          ↑
leftActions  always    grouped only         customActions    auto when   dropdown
                                                              foundation
                                                                ID set
```

**Row 2 - Saved Views (when present):**
```
[⌄ Expand/Collapse]  [Type]  [XERO sorting]  [Person]  ...other saved views...
         ↑              ↑          ↑             ↑
    grouped only   saved view  saved view   saved view
```

**Notes:**
- **Expand/Collapse button**: Single rotating chevron (⌄), only visible when table is grouped, appears left of saved view buttons
- **View toggle**: "Inline/Panel" buttons, only visible when table is grouped, appears in main toolbar after search
- **Saved views**: Second row only appears when saved views exist

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
   - Location: `TeeemTableView.tsx` → Toolbar section with GlobalViewsManager integration
   - Opens `showGlobalViewsManager` state
   - Note: TeeemTableView refactored into modular structure (see core/ subdirectories)

2. **GlobalViewsManager**: Rendered at end of component when `foundationIdNumeric` is set
   - Location: `TeeemTableView.tsx` → End of component JSX (GlobalViewsManager component)
   - Receives columns transformed from COLUMNS array
   - Note: View management logic moved to core/hooks/ during modular refactoring
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

## View-Only / Read-Only Tables

Some tables display data where users cannot add, edit, or delete records. Use these patterns:

### Option 1: Fully View-Only (No Actions)

```tsx
<TeeemTableView
  entries={data}
  columns={columns}
  viewOnly={true}  // ← Disables ALL editing actions
  tableName="Audit Log"
/>
```

### Option 2: Selective - No Add Button, But Can Edit/Delete

```tsx
<TeeemTableView
  entries={data}
  columns={columns}
  // onAddRow omitted = no [+ Add] button in toolbar
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
```

### Option 3: Can Add But Not Edit (Log Entries)

```tsx
<TeeemTableView
  entries={data}
  columns={columns}
  onAddRow={handleAdd}  // ← Shows [+ Add] button
  // onEdit omitted = no edit action in row menu
/>
```

### Use Cases for View-Only Tables

| Use Case | Pattern |
|----------|---------|
| Audit logs | `viewOnly={true}` |
| History/activity feeds | `viewOnly={true}` |
| Aggregated/computed data | `viewOnly={true}` |
| Child records on parent page | Omit `onAddRow` |
| Feature tracking/progress | `viewOnly={true}` |
| System-generated records | `viewOnly={true}` |

---

## Sticky Columns (Horizontal Scroll)

When scrolling horizontally, certain columns stay frozen at the left edge:

| Column | Position | Sticky Left | Z-Index |
|--------|----------|-------------|---------|
| Select checkbox | 0 | `left: 0` | 10 (cells), 30 (header) |
| First data column | 1 | `left: selectWidth` | 10 (cells), 30 (header) |
| Actions | Last | `right: 0` (when Pin Actions enabled) | 10 |

**Pin Actions Toggle:**
- **ON**: Actions column visible and sticky to right edge
- **OFF**: Actions column hidden entirely from table

**Implementation:**
- `getStickyColumnStyles()` in TeeemTableView.tsx determines which columns are sticky
- Background color required for sticky cells to cover content behind
- Box shadow on first data column provides visual separation

**Group Headers (Cascading View):**
- Group header row split into 2 cells: sticky cell (colSpan=2) + filler cell
- Sticky cell covers select + first data column width
- Height matches data rows (`py-1` padding)

---

## Grouped Tables

### Grouping Behavior

When a table is grouped (via GlobalViewsManager or `initialGroupByColumn` prop):

**Visual Changes:**
- Second toolbar row appears with Expand/Collapse chevron (if saved views exist)
- View toggle appears in main toolbar (Inline/Panel modes)
- Table header shows NO selection checkbox column
- Group rows display with collapse/expand chevrons on the left
- Group header rows match data row height for visual consistency

**Selection in Grouped Tables:**
- Selection bar appears ABOVE the table (not in header)
- Selection bar includes:
  - Dropdown with "Select All", "Select Expanded", "Clear Selection"
  - "X rows visible" count
  - Bulk action buttons (Bulk Update, Inline Edit, Merge)
  - "X selected" count
  - Clear button
- Selection bar only visible when rows are selected

**Expand/Collapse:**
- **Single chevron button** (⌄) rotates:
  - Points DOWN when all groups expanded
  - Points UP when any groups collapsed
- Located left of saved view buttons in second toolbar row
- Only visible when table is grouped
- Uses `requestAnimationFrame` for smooth performance

**Performance Optimizations:**
- Row selections batched via `requestAnimationFrame`
- Reduces re-renders during multi-select
- `SelectCheckbox` component memoized
- Initial row limit: 100 rows

---

## Table Styling Standards

### Page Container Pattern (Edge-to-Edge Tables)

**SSoT: TeeemTableView handles the header internally.** Pages should NOT implement their own headers.

```tsx
// ✅ CORRECT - TeeemTableView handles everything (SSoT)
<div className="flex flex-col h-full -mx-4">
  <TeeemTableView
    entries={records}
    totalCount={totalCount}
    tableName="Jobs"
    foundationIdNumeric={tableId}
    // ... other props
  />
</div>

// ❌ WRONG - Custom header duplicates TeeemTableView functionality
<div className="flex flex-col h-full">
  <h1>Jobs</h1>                    {/* DON'T DO THIS */}
  <p>15 of 150 jobs</p>            {/* DON'T DO THIS */}
  <TeeemTableView ... />
</div>
```

**TeeemTableView built-in header shows:**
- `tableName` as h1 title
- Record count: "X of Y records" (using `totalCount` and filtered count)

**Key classes:**
- `-mx-4` on outer container breaks out of parent `px-4` padding for edge-to-edge
- `h-full` on outer container ensures full height
- `showHeader={false}` prop to hide if custom header needed (rare)

### Cell Spacing
```
TableHead: px-1 (4px horizontal padding)
TableCell: px-1 py-0.5 (4px horizontal, 2px vertical)
```

**Rationale:** Compact spacing maximizes data density while maintaining readability.

### Typography
- Cell text: `text-[11px]` (11px font size)
- Monospace values: Font mono for codes, IDs, technical values
- Date format: DD/MM/YYYY (Australian standard)
- **Group headers**: `text-[13px] font-bold truncate whitespace-nowrap` (no wrapping)

### Colors
- **System columns** (id, created_at, updated_at): `hsl(47, 100%, 96%)` (light yellow tint)
- **Selection highlight**: Default theme accent
- **Group rows**: Muted background with bold text

---

## Code Locations (Must Match This Spec)

| What | File | Must Match |
|------|------|------------|
| **Column Types & Validation** |
| SQL Types | `backend/app/models/column.rb` → `COLUMN_SQL_TYPE_MAP` | Section: The 31 Column Types |
| Validation | `backend/app/controllers/api/v1/column_types_controller.rb` | Section: The 31 Column Types |
| Categories | `column_types_controller.rb` → `categorize_column_type()` | Section headers above |
| Frontend Cache | `frontend-next/lib/column-types.ts` | Generated from API |
| System Columns | `TeeemTableView.tsx` → `SYSTEM_GENERATED_TYPES` | Section: System-Generated |
| **UI & Styling** |
| Cell Spacing | `frontend-next/components/ui/table.tsx` → TableHead, TableCell | Section: Table Styling Standards |
| Toolbar Layout | `frontend-next/components/table/TeeemTableView.tsx` (lines 3260-3520) | Section: Standard Toolbar Layout |
| Grouped Tables | `frontend-next/components/table/TeeemTableView.tsx` → renderInlineGroupRows | Section: Grouped Tables |
| Selection Bar | `frontend-next/components/table/TeeemTableView.tsx` (lines 2979-3088) | Section: Selection in Grouped Tables |
| Expand/Collapse | `frontend-next/components/table/TeeemTableView.tsx` (lines 3466-3487) | Section: Expand/Collapse |
| Sticky Columns | `frontend-next/components/table/TeeemTableView.tsx` → getStickyColumnStyles | Section: Sticky Columns |
| View Save | `frontend-next/components/table/TeeemTableView.tsx` → saveNewView | Section: View Persistence |

**Architecture Note (2025-12-06):**

TeeemTableView was refactored from a monolithic file (~6,000 lines) into a modular structure. Components are now organized in `/core` subdirectories:
- **Main component:** `frontend-next/components/table/TeeemTableView.tsx` (3,520 lines)
- **Cell rendering:** `core/column-renderer/` - Cell display, validation, formatting (CellValidation.tsx: 549 lines)
- **State management:** `core/state/` - useState hooks extracted
- **Custom hooks:** `core/hooks/` - useTableSchema, useExport, table handlers
- **Filtering logic:** `core/filtering/` - FilterEvaluator
- **Table sections:** `core/table-sections/` - Header, Footer, Body components
- **Cell components:** `core/cell-components/` - Individual cell type components

See commits 917c571f (Phase 1 & 2) and 0f07ddab (Phase 3) for refactoring details.

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

## View Persistence (What Gets Saved)

When saving a view, these settings are persisted:

| Category | Settings |
|----------|----------|
| **Columns** | `visible`, `order`, `widths`, `autoFitColumns`, `smartFit`, `showTotals`, `stickyActions` |
| **Filters** | `cascadeFilters`, `filterGroups`, `interGroupLogic` |
| **Sorting** | `sort_order` (array of column + direction) |
| **Grouping** | `group_by_columns` (cascading column keys) |

**Implementation:**
- `saveNewView()` in TeeemTableView.tsx - manual save button
- `saveViewAtom` in view-state-atoms.ts - auto-save (must match saveNewView)

---

## Version History

| Date | Change |
|------|--------|
| 2025-12-16 | SSoT: TeeemTableView now handles header/count internally (showHeader prop). Pages no longer implement custom headers. |
| 2025-12-16 | Added Sticky Columns, View Persistence, Page Container Pattern, group header no-wrap |
| 2024-12-03 | Created as SSoT, documented all 31 column types |
