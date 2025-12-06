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

## §19.2: Column Type Validation - Single Source of Truth

🧩 Component

### Description

**Backend Service:** `backend/app/services/column_type_validator.rb`
**Backend Concern:** `backend/app/models/concerns/auto_column_validation.rb`
**Frontend Validation:** `frontend-next/components/table/core/column-renderer/CellValidation.tsx` → `validateCell()`

**Note:** Validation logic was extracted from TeeemTableView during modular refactoring (commit 917c571f).

The column validation system ensures ALL tables enforce the same validation rules automatically. Define a column type once → validation applies everywhere.

---

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SINGLE SOURCE OF TRUTH                       │
│                                                                 │
│   columns table (foundation_id, column_name, column_type)       │
│                           │                                     │
│           ┌───────────────┴───────────────┐                     │
│           ▼                               ▼                     │
│   ┌───────────────────┐         ┌───────────────────┐          │
│   │ Backend           │         │ Frontend          │          │
│   │ ColumnTypeValidator│         │ validateCell()   │          │
│   │                   │         │ in TeeemTableView │          │
│   └─────────┬─────────┘         └─────────┬─────────┘          │
│             │                             │                     │
│             ▼                             ▼                     │
│   ┌───────────────────┐         ┌───────────────────┐          │
│   │ AutoColumnValidation│       │ Real-time UI      │          │
│   │ (ApplicationRecord) │       │ validation errors │          │
│   └─────────┬─────────┘         └───────────────────┘          │
│             │                                                   │
│             ▼                                                   │
│   ┌───────────────────┐                                        │
│   │ ALL Models        │  ← Automatic validation on save        │
│   │ (Jobs, Contacts,  │                                        │
│   │  Products, etc.)  │                                        │
│   └───────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

### How It Works

**1. Column types defined in database:**
```sql
-- columns table
| foundation_id | column_name | column_type |
|---------------|-------------|-------------|
| 204           | email       | email       |
| 204           | phone       | phone       |
| 204           | abn         | abn         |
```

**2. Backend validates automatically on save:**
```ruby
# Any model inheriting from ApplicationRecord
job = Job.new(email: "invalid", phone: "123")
job.save
# => false
# job.errors[:email] => ["must be a valid email address"]
# job.errors[:phone] => ["must have at least 8 digits"]
```

**3. Frontend validates in real-time:**
```tsx
// TeeemTableView shows red border + error message
// User sees error immediately when they blur the field
```

---

### Adding a New Column Type

**Step 1: Add to backend ColumnTypeValidator**

```ruby
# backend/app/services/column_type_validator.rb

def validate(value, column_type)
  case column_type&.to_s
  # ... existing types ...

  when 'my_new_type'
    unless str_value.match?(/\A[A-Z]{3}\d{4}\z/)
      return "must be 3 letters followed by 4 digits"
    end
  end
end

# Optional: Add formatting
def format_value(value, column_type)
  case column_type&.to_s
  when 'my_new_type'
    value.to_s.upcase  # Auto-uppercase
  end
end
```

**Step 2: Add to frontend validateCell**

```tsx
// frontend-next/components/table/core/column-renderer/CellValidation.tsx
// Note: Validation logic extracted from TeeemTableView during modular refactoring

const validateCell = useCallback((columnKey: string, value: unknown, columnType?: string): string | null => {
  switch (columnType) {
    // ... existing types ...

    case 'my_new_type':
      if (!/^[A-Z]{3}\d{4}$/.test(strValue)) {
        return 'Must be 3 letters followed by 4 digits';
      }
      break;
  }
}, []);
```

**Step 3: Add to columns table**
- Via TEEEM UI: Admin → System → Columns
- Or via API: `POST /api/v1/columns`

---

### Supported Column Types

| Type | Validation Rule | Auto-Format |
|------|-----------------|-------------|
| `email` | Valid email format | - |
| `phone` | 8+ digits, allows +()-space | `0XXX XXX XXX` |
| `mobile` | Same as phone | `0XXX XXX XXX` |
| `url` | Valid HTTP/HTTPS URL | - |
| `whole_number` | Integer ≥ 0 | - |
| `number` | Decimal ≥ 0 | - |
| `currency` | Decimal ≥ 0 | - |
| `percentage` | 0-100 | - |
| `gps_coordinates` | `lat,lng` format | - |
| `color_picker` | `#RRGGBB` hex | - |
| `abn` | 11 digits | `XX XXX XXX XXX` |
| `acn` | 9 digits | `XXX XXX XXX` |
| `bsb` | 6 digits | `XXX-XXX` |
| `bank_account` | 6-10 digits | - |
| `postcode` | 4 digits | - |
| `tfn` | 8-9 digits | - |

---

### Caching

Column types are cached per table for 5 minutes to avoid repeated DB queries:

```ruby
# Cache is automatic, but can be cleared manually:
ColumnTypeValidator.clear_cache('jobs')      # Clear one table
ColumnTypeValidator.clear_cache              # Clear all

# Clear cache when column definitions change
# (handled automatically by Column model callbacks)
```

---

### Testing Validation

**Backend:**
```ruby
# Test in rails console
validator = ColumnTypeValidator
validator.validate("bad-email", "email")
# => "must be a valid email address"

validator.validate("test@example.com", "email")
# => nil (valid)

validator.format_value("0412345678", "phone")
# => "0412 345 678"
```

**Frontend:**
- Enter invalid data in TeeemTableView
- Field shows red border
- Error message appears below field
- Save button disabled until errors fixed

---

### Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Validation not running | Model doesn't inherit `ApplicationRecord` | Check model inheritance |
| Column type not found | Column not in `columns` table | Add column definition |
| Cache stale | Column type changed recently | Call `ColumnTypeValidator.clear_cache` |
| Frontend/backend mismatch | Rules not synced | Update both `validateCell` and `ColumnTypeValidator.validate` |

---

## §19.3: Gold Standard Table - The Reference Implementation

🧩 Component

### Description

**Backend Model:** `backend/app/models/gold_standard_table.rb`
**Backend Controller:** `backend/app/controllers/api/v1/gold_standard_table_controller.rb`
**Frontend:** `frontend-next/app/(app)/admin/system/components/GoldStandardTab.tsx`
**Foundation ID:** 1

The Gold Standard Table is the **reference implementation** for how ALL tables in TEEEM should work. It demonstrates every feature: validation, merge, import/export, views, filtering, and column types.

---

### Why Gold Standard Matters

```
Gold Standard Table = Template for ALL Tables

✅ Uses TeeemTableView (the ONE table component)
✅ Uses ColumnTypeValidator (SSoT for validation)
✅ Uses GenericMergeService (unified merge)
✅ Demonstrates all column types
✅ Shows proper API patterns
✅ Reference for new table implementations
```

---

### What Gold Standard Demonstrates

| Feature | Implementation |
|---------|----------------|
| **Validation** | All column types validated via `ColumnTypeValidator` |
| **Merge** | Built-in via `TeeemTableView` + `GenericMergeService` |
| **Import/Export** | CSV/Excel via TeeemTableView props |
| **Views** | Saved filters and column configurations |
| **Inline Editing** | Single-click dropdowns, double-click text |
| **Server Search** | API-powered search for large datasets |
| **Column Types** | Every supported type has an example |

---

### Using Gold Standard as Template

**When creating a new table page:**

1. **Copy the pattern from GoldStandardTab.tsx**
2. **Replace foundation ID and entity name**
3. **Configure columns from API or define statically**
4. **Wire up CRUD handlers**

```tsx
// Minimal table page following Gold Standard pattern
export default function MyTablePage() {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);

  // Load from API (like Gold Standard does)
  useEffect(() => {
    loadData();
    loadColumns();
  }, []);

  return (
    <TeeemTableView
      // Required
      foundationId="my_table"
      foundationIdNumeric={YOUR_TABLE_ID}
      rows={data}
      columns={columns}

      // CRUD handlers
      onRowUpdate={handleUpdate}
      onDelete={handleDelete}
      onBulkDelete={handleBulkDelete}

      // Features (all enabled by default with foundationId)
      enableImport={true}
      enableExport={true}
      enableMerge={true}  // Automatic with foundationIdNumeric

      // Merge display config
      mergeDisplayColumn="name"
      mergeSecondaryColumns={["category", "status"]}
    />
  );
}
```

---

### Gold Standard API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/gold_standard_table` | GET | List all items |
| `/api/v1/gold_standard_table/:id` | GET | Get single item |
| `/api/v1/gold_standard_table` | POST | Create item |
| `/api/v1/gold_standard_table/:id` | PATCH | Update item |
| `/api/v1/gold_standard_table/:id` | DELETE | Delete item |
| `/api/v1/gold_standard_table/bulk_delete` | POST | Delete multiple |
| `/api/v1/gold_standard_table/:id/merge` | POST | Merge items |

---

### Column Types Demonstrated

Gold Standard has example columns for EVERY supported type:

| Column Name | Column Type | Example Value |
|-------------|-------------|---------------|
| name | single_line_text | "Sample Item" |
| description | long_text | "Multi-line text..." |
| email | email | "test@example.com" |
| phone | phone | "0412 345 678" |
| website | url | "https://example.com" |
| quantity | whole_number | 42 |
| price | currency | 99.95 |
| discount | percentage | 15 |
| location | gps_coordinates | "-33.8688,151.2093" |
| brand_color | color_picker | "#FF5733" |
| abn | abn | "51 824 753 556" |
| status | dropdown | "Active" |
| tags | multi_select | ["Tag1", "Tag2"] |
| due_date | date | "2024-12-31" |
| is_active | boolean | true |

---

### Testing with Gold Standard

**Validation testing:**
1. Go to Admin → System → Gold Standard
2. Try entering invalid email, phone, ABN, etc.
3. See real-time validation errors
4. Backend rejects on save if invalid

**Merge testing:**
1. Select 2+ rows with checkboxes
2. Click "Merge" button
3. Choose primary record
4. Confirm merge
5. Verify data combined correctly

**Import/Export testing:**
1. Export to CSV/Excel
2. Modify data
3. Import back
4. Verify validation runs on import

---

### When to Reference Gold Standard

| Scenario | What to Check |
|----------|---------------|
| Creating new table | Copy GoldStandardTab.tsx structure |
| Adding column type | Check Gold Standard has example |
| Debugging validation | Test same data in Gold Standard first |
| Implementing merge | Gold Standard merge works? Your table should too |
| API patterns | Mirror Gold Standard controller |

---

**Last Generated:** 2025-11-20 10:09 AEST
**Generated By:** `scripts/generate_teacher_chapters.rb`
**Maintained By:** Development Team via Database UI