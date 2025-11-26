# TEEEM TEACHER - Chapter 19: UI/UX

**Last Updated:** 2025-11-20 10:09 AEST
**Authority Level:** Reference (HOW to implement Bible rules)
**Audience:** Claude Code + Human Developers

---

## 📚 Navigation

**Other Teacher Chapters:**
- [Main Teacher Index](../TEEEM_TEACHER.md)

**Related Documentation:**
- 📖 [TEEEM Bible (Rules)](../TEEEM_BIBLE.md)
- 📕 [TEEEM Lexicon (Bug History)](../TEEEM_LEXICON.md)
- 📘 [User Manual](../TEEEM_USER_MANUAL.md)

---

## Chapter 19: UI/UX

## §19.1: TEEEMTableView - The One Table Standard

🧩 Component

### Description
## 🎯 TEEEMTableView: The ONLY Table Component for TEEEM

**Component:** `frontend/src/components/documentation/TEEEMTableView.jsx`
**Gold Standard Demo:** http://localhost:5173/settings?tab=gold-standard
**Template:** `frontend/src/components/settings/GoldStandardTableTab.jsx`

---

## 📋 Quick Start Template

```jsx
import { useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import TEEEMTableView from '../components/documentation/TEEEMTableView'

// 1. Define columns
const COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'name', label: 'Name', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200, tooltip: 'Item name' },
  { key: 'email', label: 'Email', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200 },
  { key: 'status', label: 'Status', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120 },
  { key: 'price', label: 'Price', resizable: true, sortable: true, width: 120, showSum: true, sumType: 'currency' },
]

export default function MyTable() {
  const [data, setData] = useState([])

  // 2. Define handlers
  const handleEdit = (entry) => {
    setData(prev => prev.map(item => item.id === entry.id ? entry : item))
  }

  const handleDelete = (entry) => {
    setData(prev => prev.filter(item => item.id !== entry.id))
  }

  const handleAddNew = () => {
    // Your add logic
  }

  // 3. Render
  return (
    <TEEEMTableView
      category="my_unique_table"
      entries={data}
      columns={COLUMNS}
      onEdit={handleEdit}
      onDelete={handleDelete}
      enableImport={true}
      enableExport={true}
      customActions={
        <button onClick={handleAddNew}>
          <PlusIcon className="h-5 w-5" />
          Add Item
        </button>
      }
    />
  )
}
```

---

## 🔧 Column Configuration

### Required Properties
```javascript
{
  key: 'column_name',    // Data field name
  label: 'Display Name', // Header text
  width: 200            // Width in pixels
}
```

### Optional Properties
```javascript
{
  resizable: true,           // User can resize (default: false)
  sortable: true,            // User can sort (default: false)
  filterable: true,          // Show filter (default: false)
  filterType: 'text',        // 'text' or 'dropdown'
  tooltip: 'Help text',      // Hover tooltip
  showSum: true,             // Show sum in footer (default: false)
  sumType: 'currency',       // 'currency' or 'number'
  isComputed: true,          // Computed column (default: false)
  computeFunction: (entry) => entry.price * entry.qty
}
```

### Column Types Examples

**Text:**
```javascript
{ key: 'name', label: 'Name', filterType: 'text', width: 200 }
```

**Email:**
```javascript
{ key: 'email', label: 'Email', filterType: 'text', width: 200 }
```

**Dropdown/Choice:**
```javascript
{ key: 'status', label: 'Status', filterType: 'dropdown', width: 120 }
// Options populated from unique values in data
```

**Currency:**
```javascript
{ key: 'price', label: 'Price', width: 120, showSum: true, sumType: 'currency' }
```

**Number:**
```javascript
{ key: 'quantity', label: 'Qty', width: 100, showSum: true, sumType: 'number' }
```

**Computed:**
```javascript
{
  key: 'total',
  label: 'Total',
  width: 140,
  isComputed: true,
  computeFunction: (entry) => (entry.price || 0) * (entry.quantity || 0),
  showSum: true,
  sumType: 'currency'
}
```

**Boolean:**
```javascript
{ key: 'is_active', label: 'Active', filterType: 'dropdown', width: 100 }
```

**Date/Time:**
```javascript
{ key: 'created_at', label: 'Created', width: 180 }
```

**Multi-line Text:**
```javascript
{ key: 'notes', label: 'Notes', width: 300 }
```

---

## 🎨 Features Included

### Built-in Features (No Setup Required)
- ✅ Column resize (drag borders)
- ✅ Column reorder (drag headers)
- ✅ Column show/hide (three-dot menu)
- ✅ Sorting (click headers, 3-state)
- ✅ Filtering (inline text/dropdown)
- ✅ Bulk select & delete
- ✅ Inline editing
- ✅ State persistence (localStorage)
- ✅ Dark mode support
- ✅ Responsive design
- ✅ Sum footers (currency/number)
- ✅ Computed columns
- ✅ Export functionality

### Props Reference

```javascript
<TEEEMTableView
  // Required
  category="unique_identifier"     // Used for localStorage keys
  entries={data}                   // Array of row objects
  columns={COLUMNS}                // Column definitions
  
  // Handlers
  onEdit={(entry) => {}}           // Called when row edited
  onDelete={(entry) => {}}         // Called when row deleted
  onImport={() => {}}              // Import button handler
  onExport={() => {}}              // Export button handler
  
  // Optional
  enableImport={true}              // Show import button
  enableExport={true}              // Show export button
  customActions={<Button />}       // Additional toolbar buttons
/>
```

---

## 📦 Data Format

Each entry must have an `id` field:

```javascript
const data = [
  {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    status: 'active',
    price: 100.50,
    quantity: 5,
    is_active: true,
    created_at: '2024-11-18T10:00:00Z',
    notes: 'Some notes here'
  }
]
```

---

## 🎓 Live Examples

1. **Gold Standard Demo:**
   - URL: `/settings?tab=gold-standard`
   - File: `frontend/src/components/settings/GoldStandardTableTab.jsx`
   - Shows ALL column types and features

2. **Trinity Documentation:**
   - URL: `/trinity`
   - File: `frontend/src/pages/TrinityPage.jsx`
   - Production example with filtering

3. **User Management:**
   - URL: `/settings?tab=users`
   - File: `frontend/src/components/settings/UserManagementTab.jsx`

4. **Contact Roles:**
   - URL: `/settings?tab=contact-roles`
   - File: `frontend/src/components/settings/ContactRolesManagement.jsx`

---

## ⚠️ Common Mistakes

❌ **Don't create custom table components**
```javascript
// WRONG
function MyCustomTable() {
  return <table>...</table>
}
```

✅ **Use TEEEMTableView**
```javascript
// CORRECT
function MyTable() {
  return <TEEEMTableView {...props} />
}
```

❌ **Don't use old patterns**
```javascript
// WRONG - DEPRECATED
import DataTable from '../components/DataTable'
import TablePage from '../pages/TablePage'
```

✅ **Only TEEEMTableView**
```javascript
// CORRECT
import TEEEMTableView from '../components/documentation/TEEEMTableView'
```

---

## 🔗 Related Rules

- **Bible #19.1:** Standard Table Component Usage
- **Bible #19.2:** Table Header Requirements
- **Bible #19.11A:** Table Toolbar Layout Standards
- **Bible #19.31:** Data-Dense Table Layout Pattern
- **Bible #19.34:** Modern Table Header Aesthetics
- **Bible #19.35:** Table Border Framing

---

**Remember: ONE TABLE. ONE STANDARD. TEEEMTableView.**



---

**Last Generated:** 2025-11-20 10:09 AEST
**Generated By:** `scripts/generate_teacher_chapters.rb`
**Maintained By:** Development Team via Database UI