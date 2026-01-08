# TeeemTableView Architecture

## 4-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: TeeemTableView.tsx (~500 lines target)           │
│  - Thin composition shell                                   │
│  - Backward compatible 87-prop API                         │
│  - Currently: 6,691 lines (migration in progress)          │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Compound Components (compound/)                   │
│  - Table.Root, Table.Toolbar, Table.Body, Table.Footer     │
│  - Radix-inspired composable primitives                    │
│  - Use for custom table layouts                            │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Feature Hooks (hooks/)                           │
│  - useSorting, useFiltering, useGrouping, useSearch        │
│  - Each hook: { state, actions, apply }                    │
│  - Uses same Jotai atoms as TeeemTableView                 │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Headless Core (lib/table-core/)                  │
│  - filterRows, sortRows, searchRows, groupRows             │
│  - Pure functions, no React dependencies                   │
│  - ✅ Already integrated via table-data-utils.ts           │
└─────────────────────────────────────────────────────────────┘
```

## File Locations

```
lib/table-core/                    # Layer 1: Headless Core
├── types.ts
├── pipeline/
│   ├── filterRows.ts
│   ├── sortRows.ts
│   ├── searchRows.ts
│   └── groupRows.ts
└── index.ts

components/table/
├── hooks/                         # Layer 2: Feature Hooks
│   ├── useSorting.ts
│   ├── useFiltering.ts
│   ├── useGrouping.ts
│   ├── useSearch.ts
│   ├── useSelection.ts
│   ├── useTableCore.ts           # Orchestrator
│   └── index.ts
│
├── compound/                      # Layer 3: Compound Components
│   ├── TableContext.tsx
│   ├── TableRoot.tsx
│   ├── Toolbar.tsx
│   ├── Header.tsx
│   ├── Body.tsx
│   ├── Footer.tsx
│   └── index.ts                  # Exports Table.* namespace
│
├── sections/                      # Layer 3: Section Components
│   └── index.ts                  # Re-exports existing sections
│
├── TeeemTableView.tsx            # Layer 4: Full-featured
├── SimpleTable.tsx               # Layer 4: Lightweight demo
└── index.ts                      # Public exports
```

## Usage Patterns

### Pattern 1: Full-Featured Table (TeeemTableView)

```tsx
// For tables that need all features
<TeeemTableView
  foundationId="jobs"
  autoFetchRecords
  onRowClick={handleRowClick}
/>
```

### Pattern 2: Simple Table (SimpleTable)

```tsx
// For lightweight tables using new architecture
<SimpleTable
  columns={columns}
  rows={rows}
  title="My Data"
  onAdd={handleAdd}
/>
```

### Pattern 3: Custom Composition (Table.*)

```tsx
// For advanced customization
import { Table } from '@/components/table/compound';

<Table.Root columns={columns} rows={rows}>
  <Table.Toolbar>
    <Table.Search />
    <Button onClick={exportData}>Export</Button>
  </Table.Toolbar>
  <Table.Header />
  <Table.Body />
  <Table.Footer />
</Table.Root>
```

### Pattern 4: Direct Hook Usage

```tsx
// For custom table implementations
import { useSorting, useFiltering, useSearch } from '@/components/table/hooks';

function MyCustomTable({ rows }) {
  const sorting = useSorting();
  const filtering = useFiltering();

  // Process data through pipeline
  let data = filtering.apply(rows);
  data = sorting.apply(data, columns);

  return (
    <div>
      <button onClick={() => sorting.actions.toggleSort('name')}>
        Sort by Name
      </button>
      {/* ... */}
    </div>
  );
}
```

## Migration Guide

### Current State

TeeemTableView is 6,691 lines. It already uses:
- ✅ Headless core functions via `table-data-utils.ts`
- ✅ Jotai atoms for state (`searchQueryAtom`, `currentSortColumnsAtom`, etc.)
- ✅ Extracted section components (`TableHeaderSection`, `TableFooterSection`)

### Migration Steps

#### Step 1: Use Feature Hooks (Low Risk)

Replace direct atom usage with hooks. Both use the same atoms, so they coexist safely.

```tsx
// Before
const [sortColumns, setSortColumns] = useAtom(currentSortColumnsAtom);
const handleSort = useCallback((key) => {
  setSortColumns((prev) => { /* complex logic */ });
}, []);

// After
const sorting = useSorting();
// sorting.state.sortColumns === sortColumns
// sorting.actions.toggleSort === handleSort
```

#### Step 2: Use Section Components (Medium Risk)

Replace inline render code with section components.

```tsx
// Before (in render)
{showHeader && (
  <div className="flex items-center...">
    <h1>{title}</h1>
    {/* 50+ lines of header UI */}
  </div>
)}

// After
<TableToolbar
  title={title}
  totalCount={entries.length}
  onAdd={handleAdd}
  onRefresh={handleRefresh}
/>
```

#### Step 3: Use Compound Components (Optional)

For new tables or major refactors, use the compound component API.

### Compatibility Notes

1. **Atoms are shared**: Hooks use the same Jotai atoms as TeeemTableView
2. **Gradual adoption**: Mix old and new patterns safely
3. **No breaking changes**: Existing TeeemTableView API unchanged
4. **Test with Gold Standard**: Use `/admin/system?tab=components` to verify

## Testing

### Gold Standard Table

The Gold Standard Table at `/admin/system?tab=components` tests all 34 column types and features. Use it to verify:

- [ ] All column types render correctly
- [ ] Sorting works (single and multi-column)
- [ ] Filtering works (all operators)
- [ ] Search works (all modes)
- [ ] Selection works (single, multi, range)
- [ ] Grouping works
- [ ] Inline editing works
- [ ] Performance (100K rows at 60fps)

### Running Tests

```bash
# TypeScript check
npx tsc --noEmit

# Build
npm run build

# Unit tests (when added)
npm test
```

## Architecture Principles

1. **Pure Data Processing**: Layer 1 has no React dependencies
2. **Feature Hooks Pattern**: `{ state, actions, apply }` interface
3. **Composition over Configuration**: Compound components for flexibility
4. **Backward Compatibility**: TeeemTableView props unchanged
5. **Same State Source**: All layers use the same Jotai atoms
