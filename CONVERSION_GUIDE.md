# TrapidTableView Conversion Guide

## 🎯 Converting Custom Tables to TrapidTableView

This guide shows how to convert custom table implementations (UsersPage, SuppliersPage, ContactsPage) to use the standard TrapidTableView component.

---

## Example 1: UsersPage.jsx Conversion

### BEFORE (Custom Table - ~580 lines)
```javascript
// Complex state management
const [visibleColumns, setVisibleColumns] = useState({ id: true, name: true, ... })
const [availableColumns] = useState([...])
const [users, setUsers] = useState([])
const [searchQuery, setSearchQuery] = useState('')
const [roleFilter, setRoleFilter] = useState('all')
// ... hundreds of lines of table rendering code
```

### AFTER (TrapidTableView - ~100 lines)
```javascript
import { useState, useEffect } from 'react'
import { api } from '../api'
import TrapidTableView from '../components/documentation/TrapidTableView'
import { UserPlusIcon } from '@heroicons/react/24/outline'
import AddUserModal from '../components/settings/AddUserModal'
import Toast from '../components/Toast'

// 1. Define columns (matches your data structure)
const USER_COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'id', label: 'ID', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 80 },
  { key: 'name', label: 'Name', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200 },
  { key: 'email', label: 'Email', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 250 },
  { key: 'role', label: 'Role', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 150 },
  { key: 'assigned_role', label: 'Group', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 150 },
  { key: 'last_login_at', label: 'Last Login', resizable: true, sortable: true, filterable: false, width: 180 }
]

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/users')
      setUsers(Array.isArray(response) ? response : [])
    } catch (err) {
      console.error('Failed to load users:', err)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (user) => {
    // TrapidTableView handles inline editing automatically
    // Just save the changes
    try {
      await api.patch(`/api/v1/users/${user.id}`, { user })
      setToast({ message: 'User updated successfully', type: 'success' })
      loadUsers()
    } catch (error) {
      setToast({ message: 'Failed to update user', type: 'error' })
    }
  }

  const handleDelete = async (user) => {
    if (!confirm(`Are you sure you want to remove ${user.name}?`)) return

    try {
      await api.delete(`/api/v1/users/${user.id}`)
      setToast({ message: 'User removed successfully', type: 'success' })
      loadUsers()
    } catch (err) {
      setToast({ message: 'Failed to remove user', type: 'error' })
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading users...</div>
  }

  return (
    <div className="h-screen flex flex-col">
      <TrapidTableView
        category="users"
        tableId="users"
        tableName="Users"
        entries={users}
        columns={USER_COLUMNS}
        onEdit={handleEdit}
        onDelete={handleDelete}
        customActions={
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <UserPlusIcon className="h-5 w-5" />
            Add User
          </button>
        }
      />

      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onUserAdded={() => {
          setShowAddModal(false)
          loadUsers()
          setToast({ message: 'User added successfully', type: 'success' })
        }}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
```

**Lines of Code:**
- Before: ~580 lines
- After: ~100 lines
- **Reduction: 83%**

---

## Example 2: SuppliersPage.jsx Conversion

### Column Definition
```javascript
const SUPPLIER_COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'id', label: 'ID', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 80 },
  { key: 'name', label: 'Supplier Name', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200 },
  { key: 'rating', label: 'Rating', resizable: true, sortable: true, filterable: false, width: 100 },
  { key: 'pricebook_items_count', label: 'Items', resizable: true, sortable: true, filterable: false, width: 100 },
  { key: 'contact_full_name', label: 'Contact', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200 },
  { key: 'match_status', label: 'Status', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 150 }
]
```

### Implementation
```javascript
export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)

  const loadSuppliers = async () => {
    const response = await api.get('/api/v1/suppliers')
    // Transform data to flatten nested properties for table display
    const transformed = response.suppliers.map(s => ({
      ...s,
      contact_full_name: s.contact?.full_name || 'No contact',
      pricebook_items_count: s.pricebook_items?.length || 0,
      match_status: s.is_verified ? 'Verified' : (s.contact_id ? 'Needs Review' : 'Unmatched')
    }))
    setSuppliers(transformed)
  }

  return (
    <TrapidTableView
      category="suppliers"
      entries={suppliers}
      columns={SUPPLIER_COLUMNS}
      onEdit={handleEdit}
      onDelete={handleDelete}
      customActions={<Link to="/suppliers/new">New Supplier</Link>}
    />
  )
}
```

---

## Example 3: ContactsPage.jsx Conversion

### Column Definition
```javascript
const CONTACT_COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'id', label: 'ID', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 80 },
  { key: 'full_name', label: 'Name', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200 },
  { key: 'primary_contact_type', label: 'Type', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 150 },
  { key: 'email', label: 'Email', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 250 },
  { key: 'phone', label: 'Phone', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 150 },
  { key: 'website', label: 'Website', resizable: true, sortable: true, filterable: false, width: 180 },
  { key: 'xero_sync_status', label: 'Xero', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120 }
]
```

---

## 🔧 What to Remove vs Keep

### ❌ REMOVE (TrapidTableView handles this)
- `visibleColumns` state
- `columnWidths` state
- `columnOrder` state
- `columnFilters` state
- `sortBy` / `sortDirection` state
- `resizingColumn` / `draggedColumn` state
- All `localStorage.getItem` / `setItem` calls for table state
- Manual `<table>`, `<thead>`, `<tbody>` rendering
- Column resize handlers
- Column drag/drop handlers
- Filter input rendering
- Sort indicator rendering
- ColumnVisibilityModal (built into TrapidTableView)

### ✅ KEEP (Your business logic)
- Data fetching (`loadUsers`, `loadSuppliers`, etc.)
- API calls (`api.get`, `api.post`, etc.)
- Edit/Delete handlers
- Add modals
- Toast notifications
- Loading/error states

---

## 🎨 Advanced Features

### Custom Actions Toolbar
```javascript
<TrapidTableView
  customActions={
    <>
      <button onClick={handleImport}>Import</button>
      <button onClick={handleExport}>Export</button>
      <button onClick={handleAddNew}>Add New</button>
    </>
  }
/>
```

### Navigation on Row Double-Click
```javascript
<TrapidTableView
  onRowDoubleClick={(entry) => navigate(`/users/${entry.id}`)}
/>
```

### View Button Instead of Edit/Delete
```javascript
<TrapidTableView
  viewOnly={true}
  onView={(entry) => navigate(`/users/${entry.id}`)}
/>
```

### Currency/Number Columns with Sum Footer
```javascript
{
  key: 'total_amount',
  label: 'Total',
  width: 140,
  showSum: true,
  sumType: 'currency'
}
```

### Computed Columns
```javascript
{
  key: 'total',
  label: 'Total',
  isComputed: true,
  computeFunction: (entry) => entry.price * entry.quantity,
  showSum: true,
  sumType: 'currency'
}
```

---

## 📊 Migration Checklist

### For Each Page:

- [ ] Create `COLUMNS` array with proper configuration
- [ ] Transform data if needed (flatten nested objects)
- [ ] Replace table rendering with `<TrapidTableView />`
- [ ] Keep `onEdit` and `onDelete` handlers
- [ ] Move "Add" button to `customActions` prop
- [ ] Remove all manual state management
- [ ] Remove ColumnVisibilityModal import
- [ ] Test all features (sort, filter, resize, reorder)
- [ ] Verify localStorage persistence works
- [ ] Check mobile responsiveness

---

## 🚀 Conversion Priority

**Recommended Order:**

1. **UsersPage** (simplest - flat data structure)
2. **SuppliersPage** (medium - some nested data)
3. **ContactsPage** (complex - multi-tab, nested data)

---

## 📚 References

- **Trinity Teacher T19.1:** Full TrapidTableView documentation
- **Trinity Bible #20.37:** Table component standards
- **Gold Standard Demo:** `/settings?tab=gold-standard`
- **Live Example:** `frontend/src/components/settings/GoldStandardTableTab.jsx`

---

## ⚡ Quick Win Example

Want to see it in action? Convert UsersPage first:

```bash
# 1. Backup original
cp frontend/src/pages/UsersPage.jsx frontend/src/pages/UsersPage.jsx.backup

# 2. Replace with TrapidTableView version (see example above)

# 3. Test it out
# Navigate to /users in your app

# 4. Compare:
# - Column resize: Drag column borders ✓
# - Column reorder: Drag column headers ✓
# - Column hide/show: Three-dot menu ✓
# - Sorting: Click headers ✓
# - Filtering: Type in column filters ✓
# - Bulk delete: Select rows + delete ✓
# - State persistence: Refresh page, settings preserved ✓
```

---

**Result:** Same functionality, 83% less code, zero maintenance burden! 🎉
