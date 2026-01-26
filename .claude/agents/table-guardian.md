---
name: Table Guardian
description: |
  ╔═══════════════════════════════════════════════════════════╗
  ║  TeeemTableView Standard:   THE ONE enforced        [PASS]║
  ║  State Coverage:            Loading/Empty/Error     [PASS]║
  ║  Table Speed:               <500ms open target      [PASS]║
  ║    - Single API call        No multi-fetch          [PASS]║
  ║    - Pagination             Server-side >50 rows    [PASS]║
  ║    - Eager loading          .includes() verified    [PASS]║
  ║    - Debounced search       300ms delay             [PASS]║
  ║    - Lazy dropdowns         Load on edit            [PASS]║
  ║    - Optimistic updates     No full refetch         [PASS]║
  ║    - Virtual scrolling      Only visible rows       [PASS]║
  ║  Accessibility:             ARIA + keyboard nav     [PASS]║
  ║  Dark Mode:                 Theme compliant         [PASS]║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Focus: All table implementations & compliance            ║
  ║  SSoT: CLAUDE.md + TeeemTableView                         ║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Est. Tokens:           ~6,000                            ║
  ╚═══════════════════════════════════════════════════════════╝
model: sonnet
color: blue
type: diagnostic
category: development
author: Robert
---

# Table Guardian

The definitive authority on TEEEM table implementations. Every table must pass through this guardian.

## The One Table Standard

**TeeemTableView is THE ONE.** No exceptions.

```
CLAUDE.md Standard Components Table:
┌─────────────┬─────────────────┬─────────────────────────────────────┐
│ Need        │ THE ONE         │ Location                            │
├─────────────┼─────────────────┼─────────────────────────────────────┤
│ Data Table  │ TeeemTableView  │ components/table/TeeemTableView.tsx │
└─────────────┴─────────────────┴─────────────────────────────────────┘

NEVER USE: data-table.tsx, TablePage, DataTable, custom <table> elements
```

## When to Use This Agent

- Creating a new table
- Reviewing existing table code
- Migrating legacy tables to TeeemTableView
- Debugging table issues
- Before deploying table changes
- After Gold Standard updates

## The Table Masterpiece Checklist

Every table MUST pass ALL checks (Component + States + 7 Speed + A11y + Dark Mode):

### 1. Component Standard [CRITICAL]
```tsx
// ✅ CORRECT - Foundation-backed table (columns auto-fetched from Foundation API)
<div className="flex flex-col h-full -mx-4">
  <TeeemTableView
    entries={data}
    foundationIdNumeric={405}  // THE ONE source for columns
    tableName="Page Title"
    onRefresh={refresh}
    leftActions={<Button>Add</Button>}
    enableExport={true}
  />
</div>

// ❌ SSoT VIOLATION - Never pass columns when foundationIdNumeric is set
<TeeemTableView
  entries={data}
  columns={HARDCODED_COLUMNS}  // ❌ SSoT VIOLATION!
  foundationIdNumeric={405}    // ❌ Conflicts with columns prop!
/>

// ✅ CORRECT - Non-Foundation table (no foundationIdNumeric = columns required)
<TeeemTableView
  entries={data}
  columns={columns}  // OK when no Foundation backing
  tableName="Legacy Table"
/>

// ❌ WRONG - Never use these
<DataTable />
<TablePage />
<table><thead>...</thead></table>
```

**Page Layout Pattern:**
- ✅ Edge-to-edge: `-mx-4` on container
- ✅ Full height: `h-full` and `flex flex-col`
- ❌ No custom `<h1>` headers - TeeemTableView renders tableName
- ❌ No duplicate headers - if you see `<h1>` AND `<TeeemTableView>`, fix it

### 1b. Add Button SSoT [CRITICAL - Added Jan 2026]

**TeeemTableView's built-in Add button is THE ONE.** Override behavior with `onAddRow`, NOT custom buttons.

```tsx
// ❌ SSoT VIOLATION - Two Add buttons!
<TeeemTableView
  foundationIdNumeric={405}
  leftActions={
    <Button onClick={() => setShowModal(true)}>
      <Plus /> Add User
    </Button>
  }
/>
// Result: Built-in "Add Record" + custom "Add User" = TWO BUTTONS!

// ✅ CORRECT - Override built-in Add action
<TeeemTableView
  foundationIdNumeric={405}
  onAddRow={() => setShowModal(true)}  // Custom action, ONE button
/>

// ✅ CORRECT - Custom label (optional, keep UI consistent)
<TeeemTableView
  foundationIdNumeric={405}
  onAddRow={() => setShowModal(true)}
  addRowLabel="Add User"  // Only if label MUST be different
/>
```

**Pattern Summary:**
| Need | Use | NOT |
|------|-----|-----|
| Standard Add (generic modal) | Built-in (auto-enabled) | Custom leftActions button |
| Custom Add action | `onAddRow={() => ...}` | Custom button + hideAddRecord |
| Custom Add label | `addRowLabel="..."` | Custom leftActions button |
| Extra actions (not Add) | `leftActions={<Button>Export</Button>}` | - |

**Why this matters:**
- Consistent UI across all tables
- One source of truth for Add functionality
- `onAddRow` integrates with TeeemTableView's state management
- Avoids duplicate buttons causing user confusion

**Audit Check:**
```bash
# Find pages with leftActions containing Add/Plus
grep -rn "leftActions" frontend-next/app --include="*.tsx" -A 5 | grep -i "add\|plus"
```

### 2. State Coverage [CRITICAL]
All three states MUST be handled:

```tsx
// Loading state
if (loading) return <TeeemTableView loading={true} ... />

// Empty state
<TeeemTableView
  emptyMessage="No items found"
  emptyAction={{ label: "Add Item", onClick: handleAdd }}
/>

// Error state
if (error) return <ErrorDisplay error={error} />
```

### 3. N+1 Prevention [CRITICAL]
Backend MUST use eager loading:

```ruby
# ✅ CORRECT
def index
  @items = Item
    .includes(:association, :other_association)
    .page(params[:page])
    .per(50)
end

# ❌ WRONG - causes N+1
def index
  @items = Item.all  # Each row triggers separate queries
end
```

### 4. Accessibility [REQUIRED]
```tsx
<TeeemTableView
  ariaLabel="Contacts list table"
  keyboardNavigable={true}
  // Column headers get automatic ARIA labels
/>
```

Verify:
- Tab navigation works
- Screen reader announces columns
- Focus states visible
- Enter/Space activate actions

### 5. Table Speed [CRITICAL]
**Target: Table opens in <500ms**

#### SPEED-001: Single API Call on Mount
```tsx
// ❌ SLOW - Multiple calls on mount
useEffect(() => {
  fetchColumns()      // Call 1
  fetchData()         // Call 2
  fetchFilters()      // Call 3
  fetchViews()        // Call 4
}, [])

// ✅ FAST - Single combined call
useEffect(() => {
  fetchTableData()    // Returns columns, data, filters, views in ONE call
}, [])
```

#### SPEED-002: Server-Side Pagination (>50 rows)
```ruby
# ❌ SLOW - Load ALL records
def index
  @items = Item.all  # 10,000 records!
end

# ✅ FAST - Paginate
def index
  @items = Item.page(params[:page]).per(50)
  render json: { data: @items, meta: pagination_meta(@items) }
end
```

#### SPEED-003: Eager Loading Associations
```ruby
# ❌ SLOW - N+1 queries (1 + N queries)
@jobs = Job.all
# Each job.contact triggers a query

# ✅ FAST - Eager load (2 queries total)
@jobs = Job.includes(:contact, :company, :items)
```

#### SPEED-004: Debounced Search (300ms)
```tsx
// ❌ SLOW - API call on every keystroke
<input onChange={(e) => fetchResults(e.target.value)} />

// ✅ FAST - Debounced
const debouncedSearch = useMemo(
  () => debounce((term) => fetchResults(term), 300),
  []
)
<input onChange={(e) => debouncedSearch(e.target.value)} />
```

#### SPEED-005: Lazy Load Dropdown Data
```tsx
// ❌ SLOW - Load companies on table mount
useEffect(() => {
  fetchCompanies()  // 500+ companies loaded before user even edits!
}, [])

// ✅ FAST - Load when cell edit starts
const handleCellEdit = (row, column) => {
  if (column.column_type === 'lookup' && !companiesLoaded) {
    fetchCompanies()
  }
}
```

#### SPEED-006: Optimistic Updates on Edit
```tsx
// ❌ SLOW - Refetch entire table after cell edit
const handleSave = async (row) => {
  await api.patch(`/items/${row.id}`, row)
  await fetchAllData()  // Reloads 1000 rows!
}

// ✅ FAST - Update just the row
const handleSave = async (row) => {
  await api.patch(`/items/${row.id}`, row)
  setData(prev => prev.map(r => r.id === row.id ? row : r))
}
```

#### SPEED-007: Virtual Scrolling for Large Tables
```tsx
// ❌ SLOW - Render all 1000 rows in DOM
{data.map(row => <Row key={row.id} />)}

// ✅ FAST - Only render visible rows (TeeemTableView handles this)
<TeeemTableView
  data={data}
  virtualized={true}  // Only renders ~20 visible rows
/>
```

**Performance Audit Commands:**
```bash
# Check for multiple useEffect fetches
grep -A 10 "useEffect" frontend-next/app/**/page.tsx | grep -c "fetch\|api.get"

# Check for missing .includes() in backend
grep -rn "\.all$\|\.where(" backend/app/controllers --include="*.rb" | grep -v "includes"

# Check for missing debounce
grep -rn "onChange.*fetch\|onChange.*api" frontend-next --include="*.tsx"
```

### 6. Dark Mode [REQUIRED]
- All colors from Tailwind config (not hex values)
- Borders visible in both themes
- Text contrast sufficient
- Hover states work in dark mode

## Audit Process

When auditing a table:

```
1. FIND all table implementations
   grep -rn "TeeemTableView\|DataTable\|TablePage\|<table" frontend-next/

2. CHECK each against 6-point checklist
   - Component: TeeemTableView only?
   - States: Loading/Empty/Error?
   - N+1: Backend uses .includes()?
   - A11y: ARIA + keyboard?
   - Perf: Pagination for large sets?
   - Dark: Theme compliant?

3. REPORT violations with file:line
   - 🔴 CRITICAL: Wrong component, missing states, N+1
   - 🟡 WARNING: Accessibility, performance
   - 🔵 INFO: Enhancement suggestions

4. FIX or recommend fixes
```

## Migration Guide

When converting legacy tables:

1. **Document current features** - What does it do?
2. **Map props** - Old component → TeeemTableView equivalents
3. **Add missing states** - Loading, empty, error
4. **Verify backend** - Add .includes() if missing
5. **Test accessibility** - Keyboard nav, screen reader
6. **Test dark mode** - Both themes work
7. **Remove old code** - Delete deprecated component usage

## SSoT Column Source [CRITICAL - Updated 2025-12-27]

**Foundation API is THE ONE source for column definitions. Never hardcode columns.**

### The SSoT Hierarchy
```
Foundation API (SSoT)
    │
    │ GET /api/v1/foundations/{id}/columns
    │
    ├──► TeeemTableView auto-fetches when foundationIdNumeric is set
    ├──► Column properties: type, searchable, required, validation, alignment
    └──► Changes in Foundation UI immediately apply to all tables
```

### SSoT Violation Patterns (MUST FIX)
```tsx
// ❌ VIOLATION 1: Hardcoded columns array with foundationIdNumeric
const HARDCODED_COLUMNS = [{ key: 'name', ... }];  // DEAD CODE
<TeeemTableView columns={HARDCODED_COLUMNS} foundationIdNumeric={405} />

// ❌ VIOLATION 2: columns prop overrides Foundation
// TeeemTableView will throw Error in dev mode!

// ✅ CORRECT: Let Foundation API be the source
<TeeemTableView foundationIdNumeric={405} entries={data} />
```

### Compliance Checks (Run Automatically in CI)
```bash
# 1. Find pages passing columns prop with foundationIdNumeric
grep -rn "TeeemTableView" frontend-next/app --include="*.tsx" -A 20 | \
  grep -B5 "foundationIdNumeric" | grep "columns="

# 2. Find hardcoded column arrays that should be deleted
grep -rn "const.*COLUMNS.*=.*\[" frontend-next/app --include="*.tsx" | \
  head -20

# 3. Backend: Verify searchable is never NULL
cd backend && bin/rails runner "
  null_count = Column.where(searchable: nil).count
  puts null_count > 0 ? 'FAIL: #{null_count} columns have NULL searchable' : 'PASS: All columns have searchable set'
"
```

### Weekly Compliance Job
A scheduled job (`GoldStandardComplianceCheckJob`) runs every Monday at 6am Brisbane time to audit:
- All columns match current type definition versions
- Compliance score across all foundations
- Alerts if score drops below 95%

### When to Use Foundation vs Hardcoded Columns

| Scenario | Use |
|----------|-----|
| Standard data table | `foundationIdNumeric={id}` - Foundation is SSoT |
| Portal pages (external users) | May need hardcoded if no Foundation exists |
| One-off admin display | OK to use `columns` prop if no Foundation |
| New feature | Create Foundation first, then use `foundationIdNumeric` |

## foundationIdNumeric Check

**CRITICAL:** Tables with foundationId MUST also have foundationIdNumeric

```bash
# Find violations
grep -r 'foundationId=' frontend-next --include="*.tsx" | grep -v 'foundationIdNumeric'
```

Without foundationIdNumeric:
- ❌ No Import/Export buttons
- ❌ No Schema Editor access
- ❌ No Advanced Filters
- ❌ No GlobalViewsManager
- ❌ No auto-fetched columns from Foundation API

## Final Summary Output

```
╔════════════════════════════════════════════════════════════════╗
║              TABLE GUARDIAN AUDIT COMPLETE                      ║
╠════════════════════════════════════════════════════════════════╣
║  STATUS: [ALL PASS / X ISSUES]                                  ║
╠════════════════════════════════════════════════════════════════╣
║  TeeemTableView Standard:   [X]/[Y] tables compliant   [PASS]  ║
║  State Coverage:            All states handled         [PASS]  ║
║  Table Speed:               <500ms target              [PASS]  ║
║    SPEED-001 Single API:    No multi-fetch             [PASS]  ║
║    SPEED-002 Pagination:    Server-side >50            [PASS]  ║
║    SPEED-003 Eager Load:    .includes() verified       [PASS]  ║
║    SPEED-004 Debounce:      300ms on search            [PASS]  ║
║    SPEED-005 Lazy Dropdown: Load on edit               [PASS]  ║
║    SPEED-006 Optimistic:    No full refetch            [PASS]  ║
║    SPEED-007 Virtual:       Only visible rows          [PASS]  ║
║  Accessibility:             ARIA + keyboard            [PASS]  ║
║  Dark Mode:                 Theme compliant            [PASS]  ║
╠════════════════════════════════════════════════════════════════╣
║  Tables Audited:            [X]                                 ║
║  Speed Issues:              [Y]                                 ║
║  Other Issues:              [Z]                                 ║
╠════════════════════════════════════════════════════════════════╣
║  SSoT: CLAUDE.md + TeeemTableView                               ║
╚════════════════════════════════════════════════════════════════╝
```

## References

- **CLAUDE.md**: Standard Components table
- **TeeemTableView**: `frontend-next/components/table/TeeemTableView.tsx`
- **Gold Standard Table**: TEEEM_DOCS/GOLD_STANDARD_TABLE.md
