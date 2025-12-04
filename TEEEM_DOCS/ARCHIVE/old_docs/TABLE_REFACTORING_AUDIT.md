# DataTable Refactoring Audit

This document tracks all table implementations in TEEEM and provides recommendations for standardization using the new `DataTable` component.

## Global Standard

**Component**: `/Users/jakebaird/teeem/frontend/src/components/DataTable.jsx`

This is THE standard table component for all data listing views in TEEEM. It includes:
- Sortable headers with visual indicators
- Full dark mode support
- Loading and empty states
- Responsive design
- Flexible column rendering
- Row click handling

## Current Table Implementations

### 1. TablePage.jsx - Google Sheets-Style Grid
**Location**: `/Users/jakebaird/teeem/frontend/src/pages/TablePage.jsx`

**Status**: KEEP AS-IS

**Reason**:
- Specialized inline editing functionality (click cell to edit)
- Sticky columns (first column and row number)
- Custom cell renderers for different column types (currency, lookup, etc.)
- Integration with AddColumnModal for dynamic schema
- Google Sheets-inspired UX with cell-level editing
- This is fundamentally different from a data listing table

**Notes**: This is the main dynamic data grid for user-created tables. It's intentionally different from the standard DataTable because it needs inline editing capabilities similar to Airtable/Google Sheets.

---

### 2. TaskTable.jsx - Gantt Task Inline Editing Table
**Location**: `/Users/jakebaird/teeem/frontend/src/components/gantt/TaskTable.jsx`

**Status**: KEEP AS-IS

**Reason**:
- Highly specialized inline editing (dates, numbers, dropdowns)
- Integration with Gantt chart view
- Real-time editing with optimistic updates
- Complex state management for editing cells
- Custom dropdown components (AssignedUserDropdown, SupplierListbox)
- Progress bars with color-coded visualization
- Already implements sortable headers in custom way

**Notes**: This table has Monday.com/Airtable-style inline editing that's tightly coupled with the Gantt chart feature. The custom implementation is necessary for the UX requirements.

---

### 3. POTable.jsx - Purchase Orders Listing
**Location**: `/Users/jakebaird/teeem/frontend/src/components/purchase-orders/POTable.jsx`

**Status**: CANDIDATE FOR REFACTORING

**Current Implementation**:
- Basic table with clickable rows
- No sorting functionality
- Status badges
- Action dropdown menu (View, Edit, Delete)
- Expandable row state (not fully implemented)
- Clickable supplier links

**Recommendation**: **REFACTOR TO USE DataTable**

**Benefits of Refactoring**:
1. Gain sortable headers for free (PO number, supplier, date, total, status)
2. Consistent UI with rest of application
3. Dark mode already handled
4. Cleaner code with column configuration
5. Easier maintenance

**Refactoring Approach**:
```jsx
// Convert to DataTable configuration
const columns = [
  {
    key: 'purchase_order_number',
    label: 'PO Number',
    sortable: true,
    render: (po) => (
      <span className="font-medium text-gray-900 dark:text-white">
        {po.purchase_order_number}
      </span>
    ),
  },
  {
    key: 'supplier',
    label: 'Supplier',
    sortable: true,
    getValue: (po) => po.supplier?.name || '', // For sorting
    render: (po) => (
      po.supplier ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/suppliers/${po.supplier.id}`)
          }}
          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 hover:underline"
        >
          {po.supplier.name}
        </button>
      ) : '-'
    ),
  },
  {
    key: 'description',
    label: 'Description',
    sortable: true,
    cellClassName: 'max-w-md truncate',
    render: (po) => (
      <span className="text-gray-600 dark:text-gray-400">
        {po.description || '-'}
      </span>
    ),
  },
  {
    key: 'required_date',
    label: 'Required Date',
    sortable: true,
    render: (po) => formatDate(po.required_date),
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (po) => <POStatusBadge status={po.status} />,
  },
  {
    key: 'total',
    label: 'Total',
    sortable: true,
    align: 'right',
    render: (po) => (
      <span className="font-medium">
        {formatCurrency(po.total, false)}
      </span>
    ),
  },
  {
    key: 'actions',
    label: 'Actions',
    sortable: false,
    align: 'center',
    render: (po) => (
      <Menu as="div" className="relative inline-block text-left">
        {/* Existing menu implementation */}
      </Menu>
    ),
  },
]

// Use DataTable
<DataTable
  data={purchaseOrders}
  columns={columns}
  onRowClick={(po) => navigate(`/purchase-orders/${po.id}`)}
  emptyStateTitle="No purchase orders found"
  emptyStateDescription="Click 'New Purchase Order' to create one."
/>
```

**Effort**: Low-Medium (2-3 hours)

**Priority**: Medium - Would improve consistency but not urgent

---

### 4. ColumnHeader.jsx - Column Type Dropdown
**Location**: `/Users/jakebaird/teeem/frontend/src/components/table/ColumnHeader.jsx`

**Status**: NOT A TABLE (keep as-is)

**Notes**: This is a dropdown component for column configuration, not a data table. It's used within TablePage.jsx for managing column types.

---

## Future Table Implementations

### Guidelines for New Tables

When creating a new table/data grid in TEEEM:

1. **Ask: Does this table need inline cell editing?**
   - **YES**: Use custom implementation like TablePage.jsx or TaskTable.jsx
   - **NO**: Use DataTable component

2. **Ask: Is this a data listing view?**
   - **YES**: Use DataTable
   - **NO**: Consider if a table is the right component

3. **Ask: Will users need to sort this data?**
   - **YES**: DataTable includes sorting by default
   - **NO**: You can disable sorting per column with `sortable: false`

4. **Use DataTable for**:
   - User lists
   - Project lists
   - Supplier lists
   - Job lists
   - Invoice lists
   - Report tables
   - Dashboard data grids
   - Any "list all X" view

5. **DO NOT use DataTable for**:
   - Form layouts
   - Inline editing grids (use TablePage.jsx pattern)
   - Gantt charts
   - Calendar views
   - Kanban boards

---

## Migration Priority

### High Priority
None currently - existing custom tables serve specialized purposes

### Medium Priority
1. **POTable.jsx** - Would benefit from sorting and standardization

### Low Priority / Future Consideration
- Any new views being built that show lists of data

---

## Success Metrics

After standardizing tables across TEEEM, we should see:

1. **Consistency**: All data listing views have the same look, feel, and interaction patterns
2. **Sortability**: Users can sort all appropriate tables by clicking headers
3. **Maintainability**: Fewer custom table implementations to maintain
4. **Dark Mode**: Consistent dark mode support across all tables
5. **Accessibility**: Consistent ARIA attributes and keyboard navigation
6. **Mobile**: Consistent responsive behavior

---

## Questions for Product/Design

Before refactoring POTable.jsx:

1. Do we want sorting on Purchase Orders table?
2. Should we maintain the expandable row functionality (currently half-implemented)?
3. Are there other list views coming that would need similar functionality?

---

## Notes

- The DataTable component is intentionally flexible to handle various column configurations
- Custom render functions allow for any cell content (badges, avatars, links, menus, etc.)
- The component follows Tailwind UI Application UI patterns for consistency
- See `/Users/jakebaird/teeem/frontend/src/components/DataTableExample.jsx` for usage examples

---

## Recommendation Summary

**Immediate Action**: None required - current implementations serve their purposes

**Near-term**: Consider refactoring POTable.jsx to gain sorting and consistency

**Long-term**: Use DataTable for all new data listing views to maintain consistency

**Never Refactor**: TablePage.jsx and TaskTable.jsx - these are specialized inline-editing grids that need their custom implementations
