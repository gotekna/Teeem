- If i ever flag an error, pull on the bug-hunter agent to go and find the issue. Consult with the backend developer to come up with a solution in the fastest possible manner
- every time i ask to make a design or a front end change, use the design agent. I want design to remain consistant
- when implementing features that users should be able to customize or configure themselves, consult with the no-code agent first to ensure we're empowering users rather than hardcoding values. The no-code agent will work with the frontend designer to create intuitive configuration UIs. Focus areas include: table customization, view presets, filters, dashboard layouts, form templates, and user preferences. PRIMARY PATTERN: inline editing inspired by Airtable and Monday.com - click to edit, auto-save, no unnecessary modals
- SECURITY: Before ANY deployment, the deploy-manager agent MUST scan for leaked API keys, tokens, secrets, and credentials. Run the API key detection script and BLOCK deployment if any secrets are found. Never push API keys, access tokens, private keys, or credentials to production. All secrets must be in environment variables only.
- when creating pills, lets use this code as reference export default function Example() {
  return (
    <>
      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-400/10 dark:text-gray-400">
        Badge
      </span>
      <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-400/10 dark:text-red-400">
        Badge
      </span>
      <span className="inline-flex items-center rounded-md bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-500">
        Badge
      </span>
      <span className="inline-flex items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-400/10 dark:text-green-400">
        Badge
      </span>
      <span className="inline-flex items-center rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-400/10 dark:text-blue-400">
        Badge
      </span>
      <span className="inline-flex items-center rounded-md bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-400">
        Badge
      </span>
      <span className="inline-flex items-center rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 dark:bg-purple-400/10 dark:text-purple-400">
        Badge
      </span>
      <span className="inline-flex items-center rounded-md bg-pink-100 px-2 py-1 text-xs font-medium text-pink-700 dark:bg-pink-400/10 dark:text-pink-400">
        Badge
      </span>
    </>
  )
}
 I want to be able to use the same colours and keep the UI/UX vibrant and fun

---

## TABLE STANDARDS

**CRITICAL:** The `DataTable` component (`/Users/jakebaird/teeem/frontend/src/components/DataTable.jsx`) is THE standard for ALL data tables in TEEEM.

### When to Use DataTable

Use the `DataTable` component for:
- List views (users, projects, records, etc.)
- Data grids that need sorting
- Any tabular data display
- Dashboard data tables
- Resource listings

**DO NOT use** `DataTable` for:
- Google Sheets-style editable grids (use existing TablePage.jsx pattern)
- Gantt charts (use existing gantt components)
- Specialized inline-editing tables (like TaskTable.jsx)
- Forms or non-tabular layouts

### Component Features

1. **Sortable Headers**: Click column headers to sort (asc -> desc -> none)
   - Visual indicators: ChevronUpIcon / ChevronDownIcon
   - Hover state shows sort affordance
   - Custom sort functions supported via `sortFn` prop

2. **Full Dark Mode Support**: All styling includes dark: variants

3. **Responsive Design**:
   - Mobile-first approach
   - Horizontal scroll on small screens
   - Proper spacing at all breakpoints

4. **Loading States**: Built-in loading spinner

5. **Empty States**: Customizable empty state with optional action button

6. **Header Section**: Title, description, and primary action button

7. **Row Interaction**: Optional onClick handler for row clicks

8. **Flexible Rendering**: Custom render functions per column

### Basic Usage

```jsx
import DataTable from '../components/DataTable'

function MyTablePage() {
  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {row.name}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/50">
          {row.status}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      align: 'right',
      render: (row) => (
        <a
          href="#"
          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Edit
        </a>
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
        onClick: handleAddUser,
      }}
      onRowClick={(row) => navigate(`/users/${row.id}`)}
      defaultSortKey="name"
    />
  )
}
```

### Column Configuration

Each column object supports:

- `key` (required): Data key to access
- `label` (required): Column header text
- `sortable` (default: true): Enable sorting
- `render` (optional): Custom render function
- `getValue` (optional): Custom value getter for sorting
- `sortFn` (optional): Custom sort function
- `align` (optional): 'left' | 'center' | 'right'
- `headerClassName` (optional): Custom header classes
- `cellClassName` (optional): Custom cell classes

### Status Badges in Tables

Always use the standardized badge pattern with ring:

```jsx
// Active/Success
<span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/50">
  Active
</span>

// Warning/Pending
<span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-500 dark:ring-yellow-500/50">
  Pending
</span>

// Error/Inactive
<span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-500/50">
  Inactive
</span>

// Info/Default
<span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-500/50">
  Draft
</span>
```

### Avatar/Image in Tables

For user avatars or images in first column:

```jsx
{
  key: 'user',
  label: 'User',
  sortable: true,
  render: (row) => (
    <div className="flex items-center">
      <div className="size-11 shrink-0">
        <img
          alt=""
          src={row.avatar}
          className="size-11 rounded-full dark:outline dark:outline-1 dark:outline-white/10"
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

### Two-Line Cells

For cells with primary and secondary text:

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

### Action Links/Buttons

Last column should contain actions with sr-only text for accessibility:

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

### Custom Sort Functions

For non-standard sorting (e.g., priority order):

```jsx
{
  key: 'priority',
  label: 'Priority',
  sortable: true,
  sortFn: (a, b, direction) => {
    const priorityOrder = { High: 3, Medium: 2, Low: 1 }
    const aValue = priorityOrder[a.priority] || 0
    const bValue = priorityOrder[b.priority] || 0
    return direction === 'asc' ? aValue - bValue : bValue - aValue
  },
}
```

### Examples Reference

See `/Users/jakebaird/teeem/frontend/src/components/DataTableExample.jsx` for comprehensive examples including:
- User table with avatars and two-line cells
- Project table with status badges
- Empty state handling
- Loading states
- Conditional row styling
- Custom sort functions

### Files to Refactor

The following files use custom table implementations and should be evaluated for migration to DataTable:

1. **KEEP AS-IS** (specialized inline editing):
   - `/Users/jakebaird/teeem/frontend/src/pages/TablePage.jsx` - Google Sheets-style grid
   - `/Users/jakebaird/teeem/frontend/src/components/gantt/TaskTable.jsx` - Gantt task table with inline editing

2. **CONSIDER REFACTORING** (can use DataTable):
   - `/Users/jakebaird/teeem/frontend/src/components/purchase-orders/POTable.jsx` - Purchase order listing
   - Any new list views or data grids

### Migration Checklist

When migrating an existing table to DataTable:

1. Identify if table needs inline editing (if yes, keep custom implementation)
2. Map existing columns to DataTable column config
3. Extract custom rendering logic to column `render` functions
4. Move sorting logic to DataTable's built-in sorting or custom `sortFn`
5. Replace header section with DataTable's title/description/actionButton props
6. Update empty states to use DataTable's empty state props
7. Test sorting on all columns
8. Test responsive behavior on mobile
9. Test dark mode
10. Verify accessibility (keyboard navigation, screen readers)

### DO NOT

- DO NOT create custom table components without checking if DataTable can handle it
- DO NOT use inconsistent sorting UI (always use ChevronUp/Down icons)
- DO NOT forget dark mode variants on custom renders
- DO NOT skip accessibility attributes (sr-only text for actions)
- DO NOT hardcode styles (use Tailwind utility classes)
- DO NOT create tables without sortable headers unless specifically required

### Design Philosophy

DataTable follows Tailwind UI Application UI patterns:
- Clean, professional aesthetic
- Minimal borders (divide-y for rows)
- Hover states for interactivity
- Consistent spacing (py-5 for cells, py-3.5 for headers)
- Typography hierarchy (font-semibold for headers, font-medium for primary text)
- Full dark mode support throughout
- whenever anything gets deployed, i only want it to give me the URL teeem.vercel.app. Anything else should be excluded as it's then deploying to the incorrect location Please consult the delpoy agent
- whenever a deploy happens, in the following chat please specify the deploy number