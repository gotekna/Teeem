# DataTable Component

**Location**: `/Users/jakebaird/teeem/frontend/src/components/DataTable.jsx`

The standard table component for all data listing views in TEEEM. Follows Tailwind UI Application UI patterns with full dark mode support, sortable columns, and responsive design.

## When to Use

Use `DataTable` for:
- User lists, project lists, resource listings
- Any "list all X" view
- Dashboard data grids
- Data that needs sorting

**DO NOT** use for:
- Inline editing grids (use TablePage.jsx pattern)
- Gantt charts
- Forms

## Quick Start

```jsx
import DataTable from '../components/DataTable'

function UsersPage() {
  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (user) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {user.name}
        </span>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (user) => (
        <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/50">
          {user.status}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      title="Users"
      description="A list of all users in your account"
      data={users}
      columns={columns}
      actionButton={{
        label: 'Add user',
        onClick: () => setShowModal(true),
      }}
      onRowClick={(user) => navigate(`/users/${user.id}`)}
    />
  )
}
```

## Props

### Header Props
- `title` (string): Page/section title
- `description` (string): Subtitle/description text
- `actionButton` (object): Primary action button
  - `label` (string): Button text
  - `onClick` (function): Click handler

### Data Props
- `data` (array, required): Array of data objects
- `columns` (array, required): Column configuration (see below)

### Row Props
- `onRowClick` (function): Click handler for rows
- `rowClassName` (string | function): CSS classes for rows

### Empty State Props
- `emptyStateTitle` (string): Title when no data
- `emptyStateDescription` (string): Description when no data
- `emptyStateAction` (object): Optional action button for empty state

### Other Props
- `loading` (boolean): Show loading spinner
- `className` (string): Additional CSS classes
- `defaultSortKey` (string): Initial sort column
- `defaultSortDirection` ('asc' | 'desc'): Initial sort direction

## Column Configuration

Each column object:

```jsx
{
  key: 'fieldName',              // Required: data key
  label: 'Column Header',        // Required: header text
  sortable: true,                // Optional: enable sorting (default: true)
  render: (row) => <div>...</div>, // Optional: custom cell renderer
  getValue: (row) => row.field,  // Optional: custom value for sorting
  sortFn: (a, b, dir) => {...},  // Optional: custom sort function
  align: 'left',                 // Optional: 'left', 'center', 'right'
  headerClassName: 'class',      // Optional: custom header classes
  cellClassName: 'class',        // Optional: custom cell classes
}
```

## Common Patterns

### User with Avatar
```jsx
{
  key: 'user',
  label: 'User',
  sortable: true,
  render: (row) => (
    <div className="flex items-center">
      <div className="size-11 shrink-0">
        <img
          src={row.avatar}
          className="size-11 rounded-full dark:outline dark:outline-1 dark:outline-white/10"
          alt=""
        />
      </div>
      <div className="ml-4">
        <div className="font-medium text-gray-900 dark:text-white">{row.name}</div>
        <div className="mt-1 text-gray-500 dark:text-gray-400">{row.email}</div>
      </div>
    </div>
  ),
}
```

### Status Badge
```jsx
{
  key: 'status',
  label: 'Status',
  sortable: true,
  render: (row) => (
    <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/50">
      {row.status}
    </span>
  ),
}
```

### Two-Line Cell
```jsx
{
  key: 'title',
  label: 'Title',
  sortable: true,
  render: (row) => (
    <div>
      <div className="text-gray-900 dark:text-white">{row.title}</div>
      <div className="mt-1 text-gray-500 dark:text-gray-400">{row.department}</div>
    </div>
  ),
}
```

### Action Column
```jsx
{
  key: 'actions',
  label: '',
  sortable: false,
  align: 'right',
  render: (row) => (
    <a
      href="#"
      onClick={(e) => {
        e.stopPropagation() // Prevent row click
        handleEdit(row)
      }}
      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
    >
      Edit<span className="sr-only">, {row.name}</span>
    </a>
  ),
}
```

### Custom Sort (Priority)
```jsx
{
  key: 'priority',
  label: 'Priority',
  sortable: true,
  sortFn: (a, b, direction) => {
    const order = { High: 3, Medium: 2, Low: 1 }
    const aVal = order[a.priority] || 0
    const bVal = order[b.priority] || 0
    return direction === 'asc' ? aVal - bVal : bVal - aVal
  },
}
```

## Badge Color Reference

```jsx
// Success/Active
bg-green-50 text-green-700 ring-green-600/20
dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/50

// Warning/Pending
bg-yellow-50 text-yellow-800 ring-yellow-600/20
dark:bg-yellow-900/30 dark:text-yellow-500 dark:ring-yellow-500/50

// Error/Inactive
bg-red-50 text-red-700 ring-red-600/20
dark:bg-red-900/30 dark:text-red-400 dark:ring-red-500/50

// Info/Default
bg-blue-50 text-blue-700 ring-blue-600/20
dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-500/50

// Gray/Neutral
bg-gray-100 text-gray-600 ring-gray-500/10
dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20
```

## Examples

See `/Users/jakebaird/teeem/frontend/src/components/DataTableExample.jsx` for:
- Complete user table with avatars
- Project table with status badges
- Empty state handling
- Loading states
- Conditional row styling
- Custom sort functions

## Features

- **Sortable Headers**: Click to sort (asc → desc → none)
  - Visual indicators (ChevronUp/Down icons)
  - Hover state shows sort affordance
- **Dark Mode**: Full dark mode support on all elements
- **Responsive**: Mobile-first with horizontal scroll
- **Loading State**: Built-in spinner
- **Empty State**: Customizable with optional action
- **Row Click**: Optional onClick for navigation
- **Flexible Rendering**: Custom render per column
- **Accessibility**: ARIA attributes, semantic HTML

## Notes

- Sorting is client-side (sorts the `data` array)
- All columns are sortable by default (set `sortable: false` to disable)
- First column gets left padding, last column gets right padding
- Action column should be last with `align: 'right'` and `sortable: false`
- Use `e.stopPropagation()` in cell click handlers to prevent row click
- Dark mode classes must be included in custom renders

## Related Documentation

- **Full Standards**: `/Users/jakebaird/teeem/CLAUDE.md` (TABLE STANDARDS section)
- **Refactoring Audit**: `/Users/jakebaird/teeem/TABLE_REFACTORING_AUDIT.md`
- **Tailwind UI Reference**: https://tailwindui.com (Application UI → Tables)
