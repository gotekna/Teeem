# Table Routing Configuration

## Overview

This directory contains the **single source of truth** for table routing in TEEEM. All data tables must use `TablePage` with `TeeemTableView` to ensure consistency and feature inheritance.

## The Problem We Solved

Previously, developers created custom page components for each table:
- ❌ `ContactsPage.jsx` - custom implementation
- ❌ `PurchaseOrdersPage.jsx` - custom implementation
- ❌ `WhsInspectionsPage.jsx` - custom implementation
- ❌ 10+ other custom table pages

**Issues with this approach:**
- ⚠️ No schema editor (Create/Edit/Delete columns)
- ⚠️ Missing TeeemTableView features (filters, saved views, kanban)
- ⚠️ Inconsistent UI/UX across tables
- ⚠️ 10x more code to maintain
- ⚠️ Bug fixes needed in 10 places instead of 1

## The Solution

**One component to rule them all:** `TeeemTableView`

All tables now route through:
```
/tables/:id/:slug → TablePage → TeeemTableView (with enableSchemaEditor=true)
```

Legacy routes automatically redirect:
```
/contacts → /tables/214/contacts
/purchase-orders → /tables/217/purchase-orders
/whs/inspections → /tables/209/whs-inspections
```

## How to Add a New Table

### Step 1: Create the table in the database
```bash
cd backend
bin/rails generate model YourTable name:string description:text
bin/rails db:migrate
```

### Step 2: Add to `tableRoutes.js`
```javascript
{
  tableId: 999, // From database
  slug: 'your-table',
  name: 'Your Table',
  legacyRoute: '/your-table', // Optional: if you want /your-table to redirect
  hasCustomDetailPage: false, // true if /your-table/:id needs custom page
  description: 'What this table stores'
}
```

### Step 3: That's it!
- ✅ Users can access via `/tables/999/your-table`
- ✅ If you set `legacyRoute`, `/your-table` redirects automatically
- ✅ Inherits all TeeemTableView features
- ✅ Schema editor works out of the box

## When to Create Custom Pages

### ✅ YES - Create custom pages for:
- **Detail pages** - Rich detail views with multiple tabs, relationships, etc.
  - Example: `/contacts/:id` → `ContactDetailPage.jsx`
- **Wizards/Forms** - Multi-step creation flows
  - Example: `/purchase-orders/new` → `PurchaseOrderNewPage.jsx`
- **Dashboards** - Aggregated views, charts, metrics
  - Example: `/whs` → `WhsDashboardPage.jsx`

### ❌ NO - Don't create custom pages for:
- **List/Table views** - Always use TablePage + TeeemTableView
- **Simple CRUD** - Create/Read/Update/Delete → use TeeemTableView
- **"I need a table with filters"** - TeeemTableView has this
- **"I need to edit columns"** - TeeemTableView has this
- **"I need saved views"** - TeeemTableView has this

## Architecture

```
User Request: /contacts
      ↓
App.jsx detects legacy route
      ↓
Redirects to: /tables/214/contacts
      ↓
TablePage component loads
      ↓
TeeemTableView renders with:
  - enableSchemaEditor={true}
  - All columns from API
  - Filters, saved views, kanban
  - Bulk actions, import/export
      ↓
User sees: Gold Standard table experience
```

## File Structure

```
frontend/src/config/
├── README.md              ← You are here
├── tableRoutes.js         ← Table routing configuration (add new tables here)
└── ...other configs

frontend/src/pages/
├── TablePage.jsx          ← Universal table page (uses TeeemTableView)
├── ContactDetailPage.jsx  ← Custom detail page (OK to keep)
├── WhsDashboardPage.jsx   ← Custom dashboard (OK to keep)
└── ContactsPage.jsx       ← ❌ DEPRECATED - redirects to TablePage

frontend/src/components/documentation/
└── TeeemTableView.jsx    ← The gold standard (one component for all tables)
```

## Audit & Maintenance

### Check table routing configuration:
```javascript
// In browser console:
import { auditRoutes } from './config/tableRoutes'
auditRoutes()
```

### Find deprecated custom pages:
```bash
# These pages should be removed after confirming redirects work:
grep -r "ContactsPage\|PurchaseOrdersPage\|WhsSwmsPage" frontend/src/pages/
```

## Related Documentation

- **Trinity Bible Rule #20.37** - TeeemTableView: The One Table Standard
- **Teacher Chapter 19** - UI/UX Standards & Patterns
- **Trinity Lexicon** - Bug history for custom table implementations

## Migration History

| Date | Table | Action |
|------|-------|--------|
| 2025-11-25 | Contacts | Migrated to TablePage, added redirect |
| 2025-11-25 | Price Books | Migrated to TablePage, added redirect |
| 2025-11-25 | Purchase Orders | Migrated to TablePage, added redirect |
| 2025-11-25 | Users | Migrated to TablePage, added redirect |
| 2025-11-25 | All WHS Tables | Migrated to TablePage, added redirects |

## Questions?

Ask in #dev-frontend or check the Trinity documentation system.
