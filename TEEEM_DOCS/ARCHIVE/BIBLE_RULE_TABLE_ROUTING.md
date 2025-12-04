# Bible Rule: Table Routing Standard (Add to Trinity)

**Category:** Bible (RULES)
**Chapter:** 20 (UI/UX Standards & Patterns)
**Section:** 20.37
**Type:** rule
**Title:** TEEEMTableView - The One Table Standard

---

## Rule

**ALL data tables in TEEEM MUST use `TablePage` with `TEEEMTableView` component.**

**NEVER create custom table page components** (e.g., `ContactsPage.jsx`, `PurchaseOrdersPage.jsx`) for list/grid views.

---

## Why This Rule Exists

### The Problem (2024-2025)
Developers created 10+ custom table pages:
- `ContactsPage.jsx` - 800 lines of custom table code
- `PurchaseOrdersPage.jsx` - 600 lines
- `WhsInspectionsPage.jsx` - 500 lines
- etc.

**Result:**
- ❌ No schema editor (users couldn't create/edit/delete columns)
- ❌ Missing TEEEMTableView features (filters, saved views, kanban)
- ❌ Inconsistent UI/UX across tables
- ❌ Bug fixes needed in 10 places instead of 1
- ❌ 5,000+ lines of duplicate code

### The Solution (2025-11-25)
One component: `TEEEMTableView`
- All tables route through `/tables/:id/:slug`
- Legacy routes redirect automatically
- Schema editor enabled everywhere
- Consistent features across all tables

---

## What You MUST Do

### ✅ Correct Pattern - Use TablePage

**1. Route Setup (App.jsx):**
```javascript
// Legacy route redirects to table route
<Route path="/contacts" element={<Navigate to="/tables/214/contacts" replace />} />

// Standard table route
<Route path="/tables/:id/:slug" element={<AppLayout><TablePage /></AppLayout>} />
```

**2. Table Configuration (tableRoutes.js):**
```javascript
{
  tableId: 214,
  slug: 'contacts',
  name: 'Contacts',
  legacyRoute: '/contacts',
  hasCustomDetailPage: true, // /contacts/:id uses custom page
  description: 'Business contacts and relationships'
}
```

**3. TablePage Implementation:**
```javascript
// TablePage.jsx already has this:
<TEEEMTableView
  tableIdNumeric={table.id}
  tableName={table.name}
  entries={records}
  columns={teeemColumns}
  enableSchemaEditor={true}  // ← The magic
  enableImport={true}
  enableExport={true}
  // ...all other features
/>
```

---

## What You MUST NEVER Do

### ❌ Incorrect Pattern - Custom Table Page

**DON'T DO THIS:**
```javascript
// ❌ BAD: Creating a custom table page
const ContactsPage = () => {
  const [contacts, setContacts] = useState([])
  // 800 lines of custom table implementation
  // Reinventing the wheel
  // Missing schema editor
  // Missing TEEEMTableView features
  return <CustomTable data={contacts} />
}

// ❌ BAD: Direct route to custom page
<Route path="/contacts" element={<ContactsPage />} />
```

**Why this is wrong:**
1. Duplicates TEEEMTableView functionality
2. Missing schema editor (users can't manage columns)
3. Missing filters, saved views, kanban, bulk actions
4. Inconsistent with other tables
5. More code to maintain
6. Harder to add features (must update 10+ pages vs 1 component)

---

## When Custom Pages ARE Allowed

### ✅ YES - Custom pages for these only:

**1. Detail Pages** (not list views)
```javascript
// ✅ GOOD: Rich detail page with tabs, relationships, etc.
<Route path="/contacts/:id" element={<ContactDetailPage />} />
```

**2. Creation Wizards**
```javascript
// ✅ GOOD: Multi-step form for complex creation
<Route path="/purchase-orders/new" element={<PurchaseOrderNewPage />} />
```

**3. Dashboards**
```javascript
// ✅ GOOD: Aggregated metrics, charts, not a table
<Route path="/whs" element={<WhsDashboardPage />} />
```

### ❌ NO - Custom pages for these:

- List/grid views → Use TEEEMTableView
- Simple CRUD tables → Use TEEEMTableView
- "I need filters" → TEEEMTableView has this
- "I need to edit columns" → TEEEMTableView has this
- "I need saved views" → TEEEMTableView has this
- "I need kanban" → TEEEMTableView has this

---

## Implementation Checklist

When creating a new table:

1. ☐ Create database table (Rails migration)
2. ☐ Add entry to `frontend/src/config/tableRoutes.js`
3. ☐ Add redirect in `App.jsx` (if legacy route needed)
4. ☐ Verify `/tables/:id/:slug` route works
5. ☐ Confirm schema editor appears (⚙️ menu → Schema section)
6. ☐ Test Create/Edit/Delete column functionality
7. ☐ **DO NOT** create custom table page component

---

## Enforcement

**Code Review Checklist:**
- [ ] No new `*Page.jsx` files for table list views
- [ ] All table routes use `/tables/:id/:slug` pattern
- [ ] `tableRoutes.js` updated for new tables
- [ ] Schema editor confirmed working

**Red Flags in PRs:**
- ⚠️ New file: `src/pages/SomethingPage.jsx` with table implementation
- ⚠️ Route: `<Route path="/something" element={<SomethingPage />} />`
- ⚠️ Missing from: `tableRoutes.js`

---

## Migration Status

| Table | Status | Notes |
|-------|--------|-------|
| Gold Standard | ✅ Always used TEEEMTableView | |
| Contacts | ✅ Migrated 2025-11-25 | Redirect added |
| Price Books | ✅ Migrated 2025-11-25 | Redirect added |
| Purchase Orders | ✅ Migrated 2025-11-25 | Redirect added |
| Users | ✅ Migrated 2025-11-25 | Redirect added |
| WHS Tables (5) | ✅ Migrated 2025-11-25 | All redirected |

---

## Related Rules

- **Bible #19.37** - Column Types Single Source of Truth
- **Teacher T19.001** - TEEEMTableView Component Documentation
- **Lexicon L20.001** - Custom Table Page Anti-Pattern Bug History

---

## References

- Configuration: `frontend/src/config/tableRoutes.js`
- Documentation: `frontend/src/config/README.md`
- Component: `frontend/src/components/documentation/TEEEMTableView.jsx`
- Routes: `frontend/src/App.jsx`

---

## Summary

**One sentence rule:**
> All data tables use TEEEMTableView via /tables/:id/:slug route with enableSchemaEditor=true.

**One sentence why:**
> Custom table pages duplicate code, lack schema editing, and create inconsistent UX.

**One sentence how:**
> Add table to tableRoutes.js, redirect legacy route if needed, done.

---

**This rule is CRITICAL for maintaining:**
- ✅ Consistent UI/UX across all tables
- ✅ Schema editor availability everywhere
- ✅ Single codebase for table features
- ✅ Easy maintenance and bug fixes
- ✅ Rapid new table creation

**Violation of this rule will:**
- ❌ Break schema editor for users
- ❌ Create UI inconsistency
- ❌ Add technical debt
- ❌ Fail code review
