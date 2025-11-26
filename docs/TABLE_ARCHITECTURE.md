# TEEEM Table Architecture

This document provides a visual overview of the table component architecture in TEEEM.

## Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    TABLE COMPONENTS                          │
└─────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                         DataTable (NEW STANDARD)                        │
│  Location: /frontend/src/components/DataTable.jsx                      │
│                                                                         │
│  Purpose: Standard table for data listing views                        │
│                                                                         │
│  Features:                                                              │
│  ✓ Sortable headers (asc → desc → none)                               │
│  ✓ Dark mode support                                                   │
│  ✓ Loading & empty states                                             │
│  ✓ Responsive design                                                   │
│  ✓ Row click handling                                                  │
│  ✓ Custom column rendering                                            │
│  ✓ Custom sort functions                                              │
│                                                                         │
│  Use for:                                                              │
│  • User lists, project lists, resource listings                        │
│  • Dashboard data grids                                                │
│  • Any "list all X" view                                              │
│  • Reports and analytics tables                                        │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                     TablePage (Inline Edit Grid)                        │
│  Location: /frontend/src/pages/TablePage.jsx                           │
│                                                                         │
│  Purpose: Google Sheets-style editable data grid                       │
│                                                                         │
│  Features:                                                              │
│  ✓ Click-to-edit cells                                                │
│  ✓ Sticky first column & row numbers                                  │
│  ✓ Multiple column types (text, number, currency, lookup, etc.)       │
│  ✓ Dynamic column creation                                             │
│  ✓ Real-time updates to backend                                       │
│  ✓ Custom cell renderers per type                                     │
│                                                                         │
│  Use for:                                                              │
│  • User-created dynamic tables                                         │
│  • Airtable/Google Sheets-like experiences                            │
│  • Heavy data entry workflows                                          │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                   TaskTable (Gantt Inline Edit)                        │
│  Location: /frontend/src/components/gantt/TaskTable.jsx                │
│                                                                         │
│  Purpose: Task table for Gantt chart with inline editing               │
│                                                                         │
│  Features:                                                              │
│  ✓ Inline editing (dates, numbers, dropdowns)                         │
│  ✓ Sortable headers                                                   │
│  ✓ Progress bars with color coding                                    │
│  ✓ Assigned user dropdowns with avatars                               │
│  ✓ Supplier selection                                                  │
│  ✓ Status/category badges                                             │
│  ✓ Optimistic updates                                                 │
│                                                                         │
│  Use for:                                                              │
│  • Gantt chart table view                                             │
│  • Master schedule editing                                             │
│  • Project task management                                             │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                    POTable (Purchase Orders)                            │
│  Location: /frontend/src/components/purchase-orders/POTable.jsx        │
│                                                                         │
│  Purpose: Purchase order listing table                                  │
│                                                                         │
│  Status: CANDIDATE FOR REFACTORING → DataTable                        │
│                                                                         │
│  Current Features:                                                      │
│  • Clickable rows                                                      │
│  • Status badges                                                       │
│  • Action menu (View, Edit, Delete)                                   │
│  • Supplier links                                                      │
│                                                                         │
│  Would Gain from DataTable:                                            │
│  + Sortable headers                                                    │
│  + Consistent UI                                                       │
│  + Better maintainability                                              │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

## Decision Tree: Which Table Component to Use?

```
START: I need to display tabular data
│
├─ Does the user need to edit cells inline (click cell to edit)?
│  │
│  ├─ YES: Is it a dynamic user-created table?
│  │  │
│  │  ├─ YES → Use TablePage.jsx pattern
│  │  │         (Google Sheets-style grid)
│  │  │
│  │  └─ NO: Is it for Gantt/scheduling tasks?
│  │     │
│  │     ├─ YES → Use TaskTable.jsx pattern
│  │     │         (Gantt inline edit table)
│  │     │
│  │     └─ NO → Create custom inline-edit table
│  │               (see TablePage.jsx for patterns)
│  │
│  └─ NO: Is it a simple data listing/viewing table?
│     │
│     ├─ YES → Use DataTable component ⭐
│     │         (Standard sortable table)
│     │
│     └─ NO: Consider if table is right UI pattern
│               (maybe use cards, list, or other layout)
```

## Column Configuration Comparison

### DataTable Columns
```jsx
// Simple configuration object
const columns = [
  {
    key: 'name',              // Data key
    label: 'Name',            // Header text
    sortable: true,           // Enable sorting
    render: (row) => <div/>,  // Custom renderer
    sortFn: (a, b, dir) => {}, // Custom sort
  }
]
```

### TablePage Columns
```jsx
// Backend-defined schema
{
  id: 1,
  name: 'Name',
  column_name: 'name',
  column_type: 'single_line_text', // Type determines cell renderer
  position: 0,
  settings: {},                    // Type-specific config
}
```

### TaskTable Columns
```jsx
// Hardcoded columns with inline edit components
<SortableHeader field="name">Task Name</SortableHeader>
// Each cell has custom EditableCell/DateCell/DropdownCell
```

## Styling Consistency

All table components follow these standards:

### Colors
- **Header Background**: `bg-gray-50 dark:bg-gray-800/50`
- **Row Border**: `divide-y divide-gray-200 dark:divide-gray-700`
- **Row Hover**: `hover:bg-gray-50 dark:hover:bg-gray-800/50`
- **Text Primary**: `text-gray-900 dark:text-white`
- **Text Secondary**: `text-gray-500 dark:text-gray-400`

### Status Badges (with ring)
```jsx
// Success
className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/50"

// Warning
className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-500 dark:ring-yellow-500/50"

// Error
className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-500/50"

// Info
className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-500/50"
```

### Spacing
- **Header Padding**: `py-3.5` vertical, `px-3` horizontal
- **Cell Padding**: `py-5` vertical, `px-3` horizontal
- **First Column**: `pl-4 pr-3 sm:pl-0` (left padding on mobile only)
- **Last Column**: `pl-3 pr-4 sm:pr-0` (right padding on mobile only)

## Integration Patterns

### With React Router
```jsx
<DataTable
  data={items}
  columns={columns}
  onRowClick={(item) => navigate(`/items/${item.id}`)}
/>
```

### With Modal/Slideout
```jsx
<DataTable
  data={items}
  columns={columns}
  actionButton={{
    label: 'Add Item',
    onClick: () => setShowModal(true)
  }}
/>
```

### With API Loading
```jsx
const [data, setData] = useState([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  api.get('/items').then(res => {
    setData(res.data)
    setLoading(false)
  })
}, [])

<DataTable
  data={data}
  columns={columns}
  loading={loading}
/>
```

## File Structure

```
teeem/
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── DataTable.jsx                    ⭐ NEW STANDARD
│       │   ├── DataTableExample.jsx             📖 Examples
│       │   ├── DataTable.README.md              📖 Quick Ref
│       │   │
│       │   ├── table/
│       │   │   ├── ColumnHeader.jsx             (Used by TablePage)
│       │   │   ├── AddColumnModal.jsx           (Used by TablePage)
│       │   │   └── ...                          (Cell renderers)
│       │   │
│       │   ├── gantt/
│       │   │   └── TaskTable.jsx                (Gantt inline edit)
│       │   │
│       │   └── purchase-orders/
│       │       └── POTable.jsx                  (Candidate for refactor)
│       │
│       └── pages/
│           └── TablePage.jsx                    (Google Sheets grid)
│
├── CLAUDE.md                                    📖 TABLE STANDARDS section
├── TABLE_REFACTORING_AUDIT.md                  📋 Audit & recommendations
└── TABLE_ARCHITECTURE.md                       📐 This file
```

## Migration Path

### Phase 1: Standard Established ✅
- [x] Create DataTable component
- [x] Document in CLAUDE.md
- [x] Create examples
- [x] Audit existing tables

### Phase 2: Future Tables (Ongoing)
- [ ] Use DataTable for all new list views
- [ ] No new custom table implementations without justification

### Phase 3: Refactor Candidates (Optional)
- [ ] Consider POTable.jsx refactor for sorting
- [ ] Evaluate other list views as they're built

### Phase 4: Maintenance (Continuous)
- [ ] Update DataTable as needs arise
- [ ] Keep examples up to date
- [ ] Document new patterns

## Key Takeaways

1. **DataTable is THE standard** for data listing views
2. **TablePage.jsx and TaskTable.jsx** serve specialized inline-editing needs
3. **Always check DataTable first** before creating custom tables
4. **Sortable headers** should be standard on all appropriate tables
5. **Dark mode and accessibility** are non-negotiable
6. **Consistency > Custom** unless there's a strong UX reason

## Questions?

See:
- `/Users/jakebaird/teeem/frontend/src/components/DataTable.README.md` - Quick reference
- `/Users/jakebaird/teeem/frontend/src/components/DataTableExample.jsx` - Working examples
- `/Users/jakebaird/teeem/CLAUDE.md` - Full TABLE STANDARDS section
- https://tailwindui.com (Application UI → Tables) - Design inspiration
