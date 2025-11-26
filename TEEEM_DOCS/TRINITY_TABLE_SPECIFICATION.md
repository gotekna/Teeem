# Trinity Table Specification

**Component:** `TrinityTableView.jsx`
**Version:** 2.0.0
**Last Updated:** 2025-11-17
**Authority:** Chapter 19 - Custom Tables & Formulas
**Reference Implementation:** [frontend/src/components/documentation/TrinityTableView.jsx](../frontend/src/components/documentation/TrinityTableView.jsx)

---

## Overview

The Trinity Table is the **gold standard** for displaying Bible, Teacher, and Lexicon entries in TEEEM. It implements all Chapter 19 table requirements and serves as the reference implementation for advanced data tables.

**Used for:**
- Trinity documentation browsing (Bible, Teacher, Lexicon)
- Complex data display with filtering, sorting, searching
- Multi-category data with unified interface

**Key Features:**
- ✅ Category filtering (Bible/Teacher/Lexicon)
- ✅ Row selection with bulk actions
- ✅ All data visible in columns (no hidden expand rows)
- ✅ Column resizing
- ✅ Column reordering (drag & drop)
- ✅ Column visibility toggle
- ✅ Inline column filters
- ✅ Global search across all fields
- ✅ Sticky headers with gradient backdrop
- ✅ Sticky horizontal scrollbar
- ✅ State persistence (localStorage)
- ✅ Dark mode support
- ✅ Responsive design

---

## Column Structure

### Required Columns (Fixed Order)

**RULE #20.1:** First column MUST be checkbox for row selection, locked position, minimal size.

```javascript
const COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  // ... data columns ...
  { key: 'actions', label: 'Actions', resizable: false, sortable: false, filterable: false, width: 120 }
]
```

**Gold Standard Requirements:**
- Width: 32px (minimal size to fit checkbox)
- Padding: px-1 (minimal horizontal padding)
- Non-resizable (locked size)
- Non-reorderable (always first)
- Centered alignment (header and cells)

### Data Columns

| Column | Width | Resizable | Sortable | Filterable | Filter Type | Tooltip |
|--------|-------|-----------|----------|------------|-------------|---------|
| select | 32px | ❌ | ❌ | ❌ | - | - |
| chapter | 200px | ✅ | ✅ | ✅ | dropdown | Chapter number and name |
| section | 100px | ✅ | ✅ | ✅ | text | Section number (e.g., 2.01) |
| type | 120px | ✅ | ✅ | ✅ | dropdown | Entry type |
| title | 300px | ✅ | ✅ | ✅ | text | Entry title |
| content | 400px | ✅ | ❌ | ✅ | text | Primary content (truncated to 150 chars) |
| component | 180px | ✅ | ✅ | ✅ | text | Component name |
| status | 140px | ✅ | ✅ | ✅ | dropdown | Entry status |
| severity | 120px | ✅ | ✅ | ✅ | dropdown | Severity level |
| actions | 120px | ❌ | ❌ | ❌ | - | - |

---

## Column Configuration Properties

Each column definition supports:

```javascript
{
  key: 'columnName',           // Unique identifier
  label: 'Display Name',       // Header text
  resizable: true|false,       // Can user resize?
  sortable: true|false,        // Can user sort?
  filterable: true|false,      // Can user filter?
  filterType: 'text'|'dropdown', // Filter UI type
  width: 200,                  // Default width in pixels
  tooltip: 'Help text'         // Optional tooltip (future)
}
```

---

## Feature Specifications

### 1. Row Selection (Chapter 20.1)

**Checkbox Column:**
- First column (non-reorderable)
- Header has "select all" checkbox
- Shows selected count in bulk action bar
- Persists across pagination (future)

**Bulk Actions:**
- Edit Selected (placeholder)
- Delete Selected (with confirmation)
- Clear Selection

**Visual Feedback:**
- Bulk action bar appears when rows selected
- Shows count: "3 entries selected"
- Indigo background theme

### 2. Category Filtering

**Quick Filter Buttons:**
- ✨ All Categories (default)
- 📖 Bible (purple theme)
- 🔧 Teacher (blue theme)
- 📕 Lexicon (orange theme)

**Visual States:**
- Active: colored background + ring-2 border
- Inactive: gray background, hover effect
- Only shows when viewing all categories (category=null)

**Implementation:**
```javascript
// Prop-based filtering
<TrinityTableView category="bible" />  // Show only Bible

// Component internal filtering
<TrinityTableView category={null} />   // Show all with filter buttons
```

### 3. Column Resizing

**Resize Handle:**
- 1px wide, right edge of column header
- Hover: indigo highlight
- Drag to resize
- Minimum width: 100px

**State Persistence:**
- Saves to localStorage: `lexiconTableViewState`
- Restores on page load
- Per-column width tracking

### 5. Column Reordering (Chapter 20.5)

**Drag & Drop:**
- Drag column headers to reorder
- Visual feedback: indigo background during drag
- Cannot reorder: select, expand, actions columns
- Persists to localStorage

**Implementation:**
```javascript
draggable={column.resizable}
onDragStart={(e) => handleDragStart(e, colKey)}
onDragOver={handleDragOver}
onDrop={(e) => handleDrop(e, colKey)}
```

### 6. Column Visibility (Chapter 20.10)

**Columns Menu:**
- Icon: EyeIcon
- Label: "Columns"
- Dropdown with checkboxes
- Cannot hide: select, expand, actions

**State:**
- Object: `{ chapter: true, section: true, ... }`
- Persists to localStorage
- Defaults all visible

### 7. Inline Column Filters (Chapter 20.1)

**Filter UI in Headers:**
- Text filters: `<input type="text" placeholder="Filter..." />`
- Dropdown filters: `<select>` with options

**Filter Types:**
- **Text:** section, title, component
- **Dropdown:** chapter, type, status, severity, category

**Clear Filters:**
- "Clear All Filters" button (red theme)
- Only shows when filters active
- Clears all inline + global filters

### 8. Global Search (Chapter 20.20)

**Search Box:**
- Left-aligned in toolbar
- Icon: MagnifyingGlassIcon
- Placeholder: "Search across all fields..."
- Clear button (X) when text present

**Search Scope:**
Searches across: title, component, scenario, root_cause, solution, description

**Results Display:**
- "Found X of Y entries" below search box
- Updates live as you type

### 9. Sticky Headers (Chapter 20.2)

**Implementation:**
```jsx
<thead className="sticky top-0 z-10 backdrop-blur-sm bg-blue-600 dark:bg-blue-800">
```

**Features:**
- Blue background (bg-blue-600 / dark:bg-blue-800)
- White text for contrast
- Blur backdrop effect
- Z-index: 10
- White sort icons
- Filter inputs styled for blue background

### 10. Sticky Horizontal Scrollbar

**RULE #20.19:** Native browser scrollbars styled with blue theme matching header color.

**Removed Feature:**
- ~~Sticky horizontal scrollbar at bottom~~ - Removed due to duplicate scrollbar display issue
- Now uses only native browser scrollbars with custom blue styling

**Scrollbar Styling (WebKit/Chrome/Safari):**
```css
.trinity-table-scroll::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}
.trinity-table-scroll::-webkit-scrollbar-track {
  background: #E0E7FF;  /* Light blue track */
  border-radius: 6px;
}
.trinity-table-scroll::-webkit-scrollbar-thumb {
  background: #2563EB;  /* Blue-600 - matches header */
  border-radius: 6px;
  border: 2px solid #E0E7FF;
}
.trinity-table-scroll::-webkit-scrollbar-thumb:hover {
  background: #1D4ED8;  /* Darker blue on hover */
}
```

**Firefox Scrollbar:**
```jsx
style={{
  scrollbarWidth: 'thin',
  scrollbarColor: '#2563EB #E0E7FF'  /* thumb track */
}}
```

**Dark Mode:**
- Track: #1E293B (dark slate)
- Thumb: #1E40AF (blue-800)
- Hover: #1E3A8A (darker blue)

### 11. State Persistence (Chapter 20.5B)

**localStorage Key:** `lexiconTableViewState`

**Persisted State:**
```javascript
{
  columnWidths: { chapter: 200, section: 100, ... },
  columnOrder: ['select', 'expand', 'chapter', ...],
  visibleColumns: { chapter: true, section: true, ... },
  sortBy: 'chapter',
  sortDir: 'asc'
}
```

**NOT Persisted:**
- Search query
- Filters
- Selected rows
- Expanded rows

**Load/Save:**
- Load on mount (useEffect with empty deps)
- Save on every state change (useEffect with deps)
- Try/catch for corrupted data

### 12. Sorting (Chapter 20.14)

**Click Headers to Sort:**
- First click: ascending
- Second click: descending
- Third click: return to default (future)

**Visual Indicator:**
- ChevronUpIcon (asc)
- ChevronDownIcon (desc)
- Indigo color theme

**Special Sorting:**
- **Severity:** Custom order (low=1, medium=2, high=3, critical=4)
- **Chapter:** Numeric sort
- **Section:** String sort (formatted as X.YY)

### 13. Single-Line Rows (Chapter 20.15)

**RULE #20.15:** All table rows MUST display as single lines with ellipsis truncation.

**Cell Styling:**
```jsx
className="whitespace-nowrap overflow-hidden text-ellipsis max-w-0"
```

**Requirements:**
- No multi-line cells
- Content truncates with "..." ellipsis
- No vertical scrolling within cells
- Hover shows full content in tooltip (future enhancement)

**Cell Content Truncation:**
- All cells use `truncate` class on inner divs
- Chapter: Single line "Ch X - Chapter Name"
- Title: Truncated with ellipsis
- Content: Pre-truncated to 150 chars, then CSS ellipsis
- All other fields: Single line with CSS ellipsis

### 14. Alternating Row Colors (Chapter 20.16)

**Row Striping for Readability:**
- Even rows (0, 2, 4...): `bg-white dark:bg-gray-900`
- Odd rows (1, 3, 5...): `bg-blue-50 dark:bg-blue-900/20`
- Hover state: `bg-blue-100 dark:bg-blue-800/30`

**Implementation:**
```jsx
{filteredAndSorted.map((entry, index) => (
  <tr className={`${index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-blue-50 dark:bg-blue-900/20'} hover:bg-blue-100 dark:hover:bg-blue-800/30`}>
))}
```

### 15. Table Borders (Chapter 20.18)

**RULE #20.18:** Table container MUST have visible borders on all sides (top, right, bottom, left).

**Implementation:**
```jsx
<div className="flex-1 min-h-0 flex flex-col border border-gray-200 dark:border-gray-700 mx-4">
```

**Requirements:**
- Full border on all four sides of table container
- Border color: gray-200 (dark: gray-700)
- Horizontal margin (mx-4) to align with search bar above
- Borders frame the entire table content including top and bottom
- Creates a complete bordered box around the table

### 16. Header Cursor Styles (Chapter 20.22)

**RULE #20.22:** Table headers MUST provide visual cursor feedback for interactive elements.

**Cursor Types:**
- **Column Resize:** `cursor: col-resize` on resizable column headers
- **Drag Handle:** `cursor: grab` on three-dot icon (Bars3Icon), `cursor: grabbing` when active
- **Sort:** `cursor: pointer` on sortable headers

**Implementation:**
```css
.trinity-resize-handle {
  cursor: col-resize;
}
.trinity-drag-handle {
  cursor: grab;
}
.trinity-drag-handle:active {
  cursor: grabbing;
}
```

**Applied to:**
- Resizable columns: Add `trinity-resize-handle` class to `<th>`
- Drag icon: Add `trinity-drag-handle` class to `<Bars3Icon>`
- Sortable headers: Add `cursor-pointer` class to `<th>`

### 17. Typography Standards (Chapter 20.23)

**RULE #20.23:** Table headers and content MUST use system font with differentiated sizes.

**Header Font Specifications:**
```jsx
style={{
  fontSize: '18px',
  fontWeight: 'bold',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
}}
```

**Row Font Specifications:**
```jsx
style={{
  fontSize: '14px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
}}
```

**Requirements:**
- Header font size: 18px bold for emphasis and hierarchy
- Row font size: 14px regular for optimal data density
- Font family: System font stack (native OS fonts)
- Applied inline via style attribute for maximum specificity
- Ensures consistent, readable text across all platforms

### 16. Dark Mode (Chapter 20.17)

**Color Palette:**
- Header: blue-600 / blue-800
- Header text: white
- Background: white / gray-900
- Alternating rows: blue-50 / blue-900/20
- Text: gray-900 / white
- Borders: gray-200 / gray-700
- Hover: blue-100 / blue-800/30

**Status Badges:**
```javascript
const STATUS_COLORS = {
  open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  fixed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  by_design: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  monitoring: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
}
```

**Severity Badges:**
```javascript
const SEVERITY_COLORS = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
}
```

---

## Cell Rendering

### Content Cell

**Smart Content Display by Category:**

The Content column intelligently displays the most relevant content field based on the entry's category:

- **Bible entries:** Shows `description` → `details` → `examples` (first available)
- **Teacher entries:** Shows `summary` → `description` → `code_example` (first available)
- **Lexicon entries:** Shows `scenario` → `description` → `solution` (first available)

**Truncation:**
- Maximum displayed length: 150 characters
- Truncated content shows "..." at the end
- Full content visible in expanded row
- Shows "-" if no content available

**Styling:**
- Font size: text-sm
- Color: gray-600 (dark: gray-400)
- Max width: max-w-lg
- Not sortable (complex mixed content)
- Filterable via text search across all content fields

```jsx
case 'content':
  let contentText = ''
  if (entry.category === 'bible') {
    contentText = entry.description || entry.details || entry.examples || ''
  } else if (entry.category === 'teacher') {
    contentText = entry.summary || entry.description || entry.code_example || ''
  } else if (entry.category === 'lexicon') {
    contentText = entry.scenario || entry.description || entry.solution || ''
  }

  const maxLength = 150
  const displayText = contentText.length > maxLength
    ? contentText.substring(0, maxLength) + '...'
    : contentText

  return (
    <div className="max-w-lg text-sm text-gray-600 dark:text-gray-400">
      {displayText || '-'}
    </div>
  )
```

### Chapter Cell
```jsx
<>
  <div className="font-medium">Ch {entry.chapter_number}</div>
  <div className="text-xs text-gray-500 dark:text-gray-400">
    {CHAPTER_NAMES[entry.chapter_number]}
  </div>
</>
```

### Section Cell
- Format: X.YY (e.g., 2.01, 19.11)
- Font: mono
- Color: indigo

### Type Cell
- Icons: 🐛 (bug), 🏛️ (architecture), 📊 (test), 🎓 (note)
- Text label

### Status Cell
- Badge with icon + text
- Icons: ⚡ (open), ✅ (fixed), ⚠️ (by_design), 🔄 (monitoring)

### Severity Cell
- Badge with text only
- Color-coded by severity level

### Actions Cell
- Edit button: PencilIcon (blue)
- Delete button: TrashIcon (red)
- Hover effects

---

## Component Props

```typescript
interface TrinityTableViewProps {
  entries: Entry[]              // Array of Trinity entries
  onEdit: (entry) => void      // Edit callback
  onDelete: (entry) => void    // Delete callback
  stats?: Object               // Statistics (unused)
  category?: 'bible'|'teacher'|'lexicon'|null  // Filter by category
}
```

---

## Usage Examples

### Show All Categories
```jsx
<TrinityTableView
  entries={allEntries}
  onEdit={handleEdit}
  onDelete={handleDelete}
  category={null}
/>
```

### Show Only Bible Entries
```jsx
<TrinityTableView
  entries={allEntries}
  onEdit={handleEdit}
  onDelete={handleDelete}
  category="bible"
/>
```

---

## Performance Optimizations (Chapter 20.16)

**Memoization:**
```javascript
const filteredAndSorted = useMemo(() => {
  // Expensive filtering and sorting
}, [entries, search, filters, sortBy, sortDir, columnFilters, category])
```

**Unique Value Lists:**
```javascript
const uniqueChapters = useMemo(() => {
  const chapters = [...new Set(entries.map(e => e.chapter_number))].sort()
  return chapters.map(num => ({ value: num, label: `Ch ${num}: ${CHAPTER_NAMES[num]}` }))
}, [entries])
```

**Ref-based Scroll Sync:**
- Uses refs for scroll containers
- No unnecessary re-renders
- Event listeners only when resizing

---

## Accessibility (Chapter 20.17)

**Keyboard Support:**
- Tab through headers and actions
- Enter/Space to toggle checkboxes
- Click/Enter to expand rows

**ARIA:**
- Semantic HTML: `<table>`, `<thead>`, `<tbody>`
- Scope on headers: `scope="col"` (future)
- Labels on icon buttons: `title="Edit"`, `title="Delete"`

**Screen Readers:**
- Checkbox labels from context
- Status badges readable as text

---

## Empty States (Chapter 20.12)

```jsx
{filteredAndSorted.length === 0 && (
  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
    No entries found matching your filters
  </div>
)}
```

**Differentiates:**
- No data at all
- No results matching filters

---

## Future Enhancements

### Planned Features
- [ ] Pagination for large datasets
- [ ] Export to CSV/Excel
- [ ] Advanced bulk edit modal
- [ ] Keyboard shortcuts (Ctrl+F for search)
- [ ] Column presets (save/load layouts)
- [ ] URL state for shareable filtered views
- [ ] Virtual scrolling for 1000+ rows
- [ ] Column tooltips
- [ ] Multi-column sort
- [ ] Frozen columns (pin left/right)

### Known Limitations
- No server-side filtering/sorting (all client-side)
- No pagination (shows all filtered results)
- Bulk edit is placeholder only
- No row drag & drop reordering
- No CSV import/export

---

## Migration Path

### From Basic Table
1. Copy column structure from TrinityTableView
2. Add row selection state
3. Add column state management
4. Add sticky header CSS
5. Add sticky scrollbar
6. Add localStorage persistence

### Testing Checklist
- [ ] All columns visible by default
- [ ] Column resize works and persists
- [ ] Column reorder works and persists
- [ ] Row selection works
- [ ] Bulk delete works with confirmation
- [ ] Search filters across all text fields
- [ ] Inline filters work per column
- [ ] Clear all filters works
- [ ] Sort works on all sortable columns
- [ ] Expand/collapse rows works
- [ ] Dark mode renders correctly
- [ ] Sticky header stays visible when scrolling
- [ ] Sticky scrollbar syncs with table
- [ ] Category filters work
- [ ] State persists across page refresh
- [ ] Actions (edit/delete) work
- [ ] Empty state shows when no results

---

## Related Documentation

- **Bible Rules:** [TEEEM_BIBLE.md Chapter 19](TEEEM_BIBLE.md) - MUST/NEVER rules
- **Implementation Patterns:** [TEEEM_TEACHER.md Chapter 19](TEEEM_TEACHER.md) - Code examples
- **Bug History:** [TEEEM_LEXICON.md Chapter 19](TEEEM_LEXICON.md) - Known issues
- **Component:** [frontend/src/components/documentation/TrinityTableView.jsx](../frontend/src/components/documentation/TrinityTableView.jsx)

---

## Glossary

- **Trinity:** Collective name for Bible, Teacher, Lexicon documentation system
- **Category:** One of: bible, teacher, lexicon (or null for all)
- **Entry:** A single row in the Trinity table (rule, pattern, or bug)
- **Inline Filter:** Column-specific filter in table header
- **Global Filter:** Legacy dropdown filters above table
- **Sticky Scrollbar:** Always-visible horizontal scrollbar at bottom
- **Column Order:** User-customizable sequence of columns
- **Column Visibility:** User-customizable show/hide state
- **State Persistence:** Saving UI state to localStorage
