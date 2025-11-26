# Table Standards - Complete Inventory & Guidelines

**Last Updated:** 2025-11-16
**Gold Standard:** [ContactsPage.jsx](frontend/src/pages/ContactsPage.jsx)
**Authority:** Chapter 19 - UI/UX Standards & Patterns

---

## 📋 Complete Table Inventory

### ✅ Tier 1: Gold Standard Tables (Full Feature Set)

**Reference Implementations - Use these as templates:**

1. **ContactsPage.jsx** - 🏆 GOLD STANDARD
   - ✅ Sticky headers
   - ✅ Column resize
   - ✅ Column reorder
   - ✅ Inline filters
   - ✅ Search
   - ✅ Sort
   - ✅ Dark mode
   - **Use for:** Complex data tables with heavy user interaction

2. **POTable.jsx** (Purchase Orders)
   - ✅ All features from ContactsPage
   - ✅ Row actions
   - ✅ Status badges
   - **Use for:** Transaction/document tables

---

### 🟡 Tier 2: Advanced Tables (Partial Features)

**Need upgrades to match Tier 1:**

#### Pages:
3. **PriceBooksPage.jsx**
   - ✅ Basic table structure
   - 🔴 Missing: Inline filters
   - 🔴 Missing: Search clear button
   - **Needs:** 2 upgrades

4. **SuppliersPage.jsx**
   - ✅ Basic sorting
   - 🔴 Missing: Sticky headers
   - 🔴 Missing: Column resize
   - **Needs:** 2 upgrades

5. **PurchaseOrdersPage.jsx**
   - ✅ Search and filter
   - 🔴 Missing: Column reorder
   - **Needs:** 1 upgrade

6. **JobDetailPage.jsx** (multiple tables)
   - Tasks table
   - Purchase orders table
   - Estimates table
   - 🔴 Missing: Sticky headers on all
   - **Needs:** 3 upgrades

7. **ContactDetailPage.jsx**
   - Activities table
   - Addresses table
   - Related contacts table
   - 🔴 Missing: Consistent styling
   - **Needs:** 3 upgrades

8. **PriceBookItemDetailPage.jsx**
   - Price history table
   - 🔴 Missing: Sort functionality
   - **Needs:** 1 upgrade

9. **MasterSchedulePage.jsx** (Gantt)
   - Task table/grid hybrid
   - ✅ Custom implementation (protected)
   - ⚠️ Special case - don't modify without Gantt Bible Ch 9

10. **XeroSyncPage.jsx**
    - Sync history table
    - 🔴 Missing: Pagination
    - **Needs:** 1 upgrade

11. **DocumentsPage.jsx**
    - File listing table
    - 🔴 Missing: Column filters
    - **Needs:** 1 upgrade

12. **PublicHolidaysPage.jsx**
    - Holidays table
    - 🔴 Missing: Inline edit
    - **Needs:** 1 upgrade

---

### 🟢 Tier 3: Simple Tables (DataTable.jsx Component)

**Already compliant - use DataTable component:**

13. **DataTable.jsx** - Simple table component
    - ✅ Basic sorting
    - ✅ Dark mode
    - ✅ Responsive
    - **Use for:** Simple read-only lists

14. **TemplateTable.jsx** (Folder templates)
    - Uses DataTable
    - ✅ Compliant

---

### ⚙️ Settings Tables (Admin/Config)

**Lower priority for upgrades:**

15. **TablesTab.jsx** (Custom tables management)
    - Table list
    - 🔴 Missing: Search
    - **Needs:** 1 upgrade

16. **TableColumnManager.jsx**
    - Column configuration table
    - 🔴 Missing: Drag reorder
    - **Needs:** 1 upgrade

17. **UserManagementTab.jsx**
    - Users table
    - 🔴 Missing: Inline filters
    - **Needs:** 1 upgrade

18. **BugHunterTests.jsx**
    - Test results table
    - 🔴 Missing: Status filters
    - **Needs:** 1 upgrade

19. **XeroFieldMappingTab.jsx**
    - Field mapping table
    - ✅ Minimal table (OK)

20. **ContactRolesManagement.jsx**
    - Roles table
    - ✅ Simple list (OK)

21. **PricebookMatchPreview.jsx**
    - Preview table
    - ✅ Read-only (OK)

22. **SupervisorChecklistTab.jsx**
    - Checklist table
    - 🔴 Missing: Checkboxes
    - **Needs:** 1 upgrade

---

### 🎯 Modal/Embedded Tables

**Context-specific tables in modals:**

23. **AiReviewModal.jsx** (Estimates)
    - Discrepancies table
    - ✅ Read-only summary (OK)

24. **EstimatesTab.jsx**
    - Line items table
    - 🔴 Missing: Inline edit
    - **Needs:** Inline editing

25. **PODocumentsTab.jsx**
    - Documents table
    - ✅ Simple list (OK)

26. **ScheduleTemplateEditor.jsx**
    - Template tasks table
    - ✅ Custom drag-drop (OK)

27. **PriceBookItemsModal.jsx**
    - Item picker table
    - 🔴 Missing: Search
    - **Needs:** Search feature

28. **GanttRulesModal.jsx**
    - Rules reference table
    - ✅ Documentation (OK)

29. **GanttBugHunterModal.jsx**
    - Test results table
    - ✅ Read-only results (OK)

30. **NewFeaturesTab.jsx**
    - Features list table
    - ✅ Simple list (OK)

---

### 📊 Designer/Builder Tables

**Custom table system (Chapter 18):**

31. **TablePage.jsx** - Custom table viewer
    - ✅ Dynamic columns
    - ✅ Formula support
    - 🔴 Missing: Export
    - **Needs:** CSV export

32. **TableBuilder.jsx**
    - Table designer
    - ✅ Drag-drop columns
    - ✅ Special purpose (OK)

33. **TableSettings.jsx** (Designer)
    - Settings table
    - ✅ Configuration UI (OK)

34. **Menus.jsx** (Designer)
    - Menu items table
    - ✅ Drag-drop (OK)

---

### 🔍 Special Cases

**Tables with unique requirements:**

35. **HealthPage.jsx**
    - System health metrics
    - ✅ Dashboard display (OK)

36. **SchemaPage.jsx**
    - Database schema display
    - ✅ Technical reference (OK)

37. **SystemPerformancePage.jsx**
    - Performance metrics
    - ✅ Monitoring UI (OK)

38. **Dashboard.jsx**
    - Multiple summary tables
    - ✅ Dashboard cards (OK)

39. **WorkflowsPage.jsx**
    - Workflow instances table
    - 🔴 Missing: Status filters
    - **Needs:** 1 upgrade

40. **WorkflowAdminPage.jsx**
    - Workflow definitions table
    - 🔴 Missing: Search
    - **Needs:** 1 upgrade

41. **ActiveJobsPage.jsx**
    - Jobs queue table
    - 🔴 Missing: Auto-refresh
    - **Needs:** Real-time updates

42. **ImportPage.jsx**
    - Import preview table
    - ✅ Temporary display (OK)

43. **TrainingSessionPage.jsx**
    - Training records table
    - 🔴 Missing: Date filters
    - **Needs:** 1 upgrade

44. **TrainingPage.jsx**
    - Training list
    - ✅ Simple list (OK)

45. **OutlookPage.jsx**
    - Email sync table
    - 🔴 Missing: Search
    - **Needs:** 1 upgrade

46. **OneDrivePage.jsx**
    - File browser table
    - 🔴 Missing: Tree view
    - **Needs:** Folder hierarchy

47. **ChatPage.jsx**
    - Messages display
    - ✅ Chat UI (not a table)

---

## 📈 Summary Statistics

**Total Tables Found:** 47+

### By Tier:
- **Tier 1 (Gold Standard):** 2 tables (4%)
- **Tier 2 (Advanced):** 13 tables (28%)
- **Tier 3 (Simple/DataTable):** 2 tables (4%)
- **Settings Tables:** 8 tables (17%)
- **Modal/Embedded:** 9 tables (19%)
- **Designer/Builder:** 4 tables (9%)
- **Special Cases:** 9 tables (19%)

### Upgrade Needs:
- 🔴 **Critical (missing core features):** 15 tables
- 🟡 **Medium (missing nice-to-haves):** 12 tables
- ✅ **Compliant (no changes needed):** 20 tables

---

## 🎯 ContactsPage Gold Standard Features

**Every advanced table SHOULD have these:**

### 1. Column Management
```jsx
// Column resizing
const [columnWidths, setColumnWidths] = useState({
  name: 250,
  email: 200,
  phone: 150,
  // ...
})

// Column reordering
const [columnOrder, setColumnOrder] = useState([
  'name', 'email', 'phone', 'city', 'state'
])

// Column visibility
const [visibleColumns, setVisibleColumns] = useState({
  name: true,
  email: true,
  phone: true,
  // ...
})
```

### 2. Sticky Header
```jsx
<div className="overflow-x-auto">
  <table className="min-w-full">
    <thead className="sticky top-0 bg-white dark:bg-gray-800 z-10">
      {/* Headers */}
    </thead>
    <tbody>
      {/* Rows */}
    </tbody>
  </table>
</div>
```

### 3. Inline Column Filters
```jsx
<th>
  <div className="flex items-center justify-between">
    <span>Name</span>
    <input
      type="text"
      placeholder="Filter..."
      className="ml-2 px-2 py-1 text-sm border rounded"
      onChange={(e) => handleFilterChange('name', e.target.value)}
    />
  </div>
</th>
```

### 4. Search with Clear Button
```jsx
<div className="relative">
  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2" />
  <input
    type="text"
    placeholder="Search contacts..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="pl-10 pr-10 py-2 border rounded-lg"
  />
  {searchQuery && (
    <button
      onClick={() => setSearchQuery('')}
      className="absolute right-3 top-1/2 -translate-y-1/2"
    >
      <XMarkIcon className="w-5 h-5" />
    </button>
  )}
</div>
```

### 5. Sort Indicators
```jsx
<th
  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
  onClick={() => handleSort('name')}
>
  <div className="flex items-center">
    <span>Name</span>
    {sortColumn === 'name' && (
      sortDirection === 'asc' ?
        <ChevronUpIcon className="w-4 h-4 ml-1" /> :
        <ChevronDownIcon className="w-4 h-4 ml-1" />
    )}
  </div>
</th>
```

### 6. Dark Mode Support
```jsx
<table className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  <thead className="bg-gray-50 dark:bg-gray-700">
    {/* Headers with dark mode classes */}
  </thead>
  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
    {/* Rows with dark mode hover states */}
  </tbody>
</table>
```

### 7. Row Actions
```jsx
<td className="px-6 py-4 text-right">
  <button
    onClick={() => handleEdit(contact.id)}
    className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400"
  >
    Edit
  </button>
  <button
    onClick={() => handleDelete(contact.id)}
    className="ml-3 text-red-600 hover:text-red-900 dark:text-red-400"
  >
    Delete
  </button>
</td>
```

### 8. Loading States
```jsx
{loading ? (
  <tr>
    <td colSpan={columns.length} className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto" />
    </td>
  </tr>
) : (
  /* Actual data rows */
)}
```

### 9. Empty States
```jsx
{contacts.length === 0 && !loading && (
  <tr>
    <td colSpan={columns.length} className="text-center py-12">
      <div className="text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium">No contacts found</p>
        <p className="text-sm mt-1">Try adjusting your search or filters</p>
        <button className="mt-4 btn-primary">
          Add New Contact
        </button>
      </div>
    </td>
  </tr>
)}
```

### 10. Pagination (if >100 rows)
```jsx
<div className="flex items-center justify-between px-4 py-3 border-t">
  <div className="text-sm text-gray-700 dark:text-gray-300">
    Showing {startRow} to {endRow} of {totalRows} results
  </div>
  <div className="flex gap-2">
    <button onClick={prevPage} disabled={page === 1}>Previous</button>
    <button onClick={nextPage} disabled={page === totalPages}>Next</button>
  </div>
</div>
```

---

## 🚀 Implementation Priority

### Phase 1: High-Traffic Pages (Week 1)
1. PriceBooksPage.jsx
2. SuppliersPage.jsx
3. PurchaseOrdersPage.jsx
4. JobDetailPage.jsx (all embedded tables)

### Phase 2: Detail Pages (Week 2)
5. ContactDetailPage.jsx (all embedded tables)
6. PriceBookItemDetailPage.jsx
7. DocumentsPage.jsx
8. PublicHolidaysPage.jsx

### Phase 3: Admin/Settings (Week 3)
9. TablesTab.jsx
10. UserManagementTab.jsx
11. BugHunterTests.jsx
12. WorkflowsPage.jsx

### Phase 4: Modals & Embedded (Week 4)
13. EstimatesTab.jsx
14. PriceBookItemsModal.jsx
15. TablePage.jsx (add export)

---

## ❌ Do NOT Modify

**Protected tables (special implementations):**
- MasterSchedulePage.jsx (Gantt - see Bible Ch 9)
- ScheduleTemplateEditor.jsx (drag-drop specific)
- TableBuilder.jsx (designer tool)
- ChatPage.jsx (not a table)

---

## 📚 References

- **Gold Standard:** [frontend/src/pages/ContactsPage.jsx](frontend/src/pages/ContactsPage.jsx)
- **Simple Tables:** [frontend/src/components/DataTable.jsx](frontend/src/components/DataTable.jsx)
- **Purchase Orders:** [frontend/src/components/purchase-orders/POTable.jsx](frontend/src/components/purchase-orders/POTable.jsx)
- **Chapter 19:** TEEEM_BIBLE.md - UI/UX Standards & Patterns
- **Chapter 19 Impact Analysis:** CHAPTER_19_IMPACT_ANALYSIS.md

---

**Next Step:** Review this list with team and approve implementation plan.
