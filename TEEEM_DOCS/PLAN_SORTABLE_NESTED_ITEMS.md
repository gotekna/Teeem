# Plan: Upgrade SortableList/SortableItem for Nested Hierarchies

## Overview

Upgrade the standard DnD components (`SortableList`, `SortableItem`) to natively support nested/hierarchical items with auto-indentation, expand/collapse, and recursive rendering.

## Current State

**Location:** `frontend-next/components/ui/dnd.tsx`

Currently, SortableList/SortableItem:
- Handle flat lists only
- Require manual rendering of children
- Require manual expand/collapse state management
- Require manual indentation styling

**Problem:** EntityTabsConfig has ~100 lines of custom code to handle nested tabs that should be in the standard component.

## Proposed Changes

### 1. Add `children` Support to Item Interface

```typescript
interface SortableItemData {
  id: number;
  children?: SortableItemData[];
  // ... other fields
}
```

### 2. Add Props to SortableList

```typescript
interface SortableListProps<T extends SortableItemData> {
  items: T[];
  onReorder: (items: T[]) => void;

  // NEW PROPS:
  renderItem: (item: T, depth: number, isExpanded: boolean, toggleExpand: () => void) => React.ReactNode;
  nested?: boolean;                    // Enable nested mode (default: false)
  defaultExpanded?: boolean;           // Auto-expand all on load (default: true)
  indentSize?: number;                 // Indent per level in rem (default: 2.5)
  maxDepth?: number;                   // Max nesting depth (default: 10)
}
```

### 3. Internal State Management

SortableList should internally manage:
- `expandedItems: Set<number>` - which items are expanded
- Auto-expand on mount if `defaultExpanded={true}`
- Recursive rendering of children when expanded

### 4. Auto-Indentation

SortableItem should automatically apply indentation based on depth:

```typescript
// Inside SortableItem
const indentClass = cn(
  depth === 1 && "ml-10 border-l-4 border-l-muted-foreground/30",
  depth === 2 && "ml-20 border-l-4 border-l-primary/30",
  depth >= 3 && "ml-28 border-l-4 border-l-primary/50"
);
```

Or use dynamic style:
```typescript
style={{ marginLeft: depth > 0 ? `${depth * indentSize}rem` : undefined }}
```

### 5. Expand/Collapse Button

Auto-render expand/collapse chevron for items with children:

```typescript
{item.children && item.children.length > 0 && (
  <Button variant="ghost" size="icon" onClick={toggleExpand}>
    {isExpanded ? <ChevronDown /> : <ChevronRight />}
  </Button>
)}
```

### 6. Usage Example (After Upgrade)

```tsx
// BEFORE: ~100 lines of custom code in EntityTabsConfig
// AFTER: Simple usage

<SortableList
  items={tabs}
  nested={true}
  defaultExpanded={true}
  indentSize={2.5}
  onReorder={handleReorder}
  renderItem={(tab, depth, isExpanded, toggleExpand) => (
    <div className="flex items-center gap-2">
      <span>{tab.display_name}</span>
      <Badge>{tab.tab_key}</Badge>
      {tab.children?.length > 0 && (
        <Badge variant="secondary">{tab.children.length} sub-tabs</Badge>
      )}
    </div>
  )}
/>
```

## Implementation Steps

### Step 1: Update Types (dnd.tsx)

Add `children` to the base item interface and new props to SortableList.

### Step 2: Add Expand State (dnd.tsx)

Add `useState` for expanded items inside SortableList.

### Step 3: Create Recursive Render Function (dnd.tsx)

```typescript
const renderItemWithChildren = (item: T, depth: number): React.ReactNode => {
  const isExpanded = expandedItems.has(item.id);
  const toggleExpand = () => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(item.id) ? next.delete(item.id) : next.add(item.id);
      return next;
    });
  };

  return (
    <React.Fragment key={item.id}>
      <SortableItem
        id={item.id}
        depth={depth}
        indentSize={indentSize}
        hasChildren={item.children && item.children.length > 0}
        isExpanded={isExpanded}
        onToggleExpand={toggleExpand}
      >
        {renderItem(item, depth, isExpanded, toggleExpand)}
      </SortableItem>

      {isExpanded && item.children && item.children.length > 0 && (
        <div className="space-y-2 mt-2">
          {item.children.map(child => renderItemWithChildren(child, depth + 1))}
        </div>
      )}
    </React.Fragment>
  );
};
```

### Step 4: Update SortableItem (dnd.tsx)

Add depth-based indentation:

```typescript
interface SortableItemProps {
  // existing props...
  depth?: number;
  indentSize?: number;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

// In component:
const indentStyle = depth > 0 ? { marginLeft: `${depth * (indentSize || 2.5)}rem` } : undefined;

<div style={indentStyle} className={cn(
  "border rounded-lg",
  depth > 0 && "border-l-4 border-l-muted-foreground/30"
)}>
  {hasChildren && (
    <Button onClick={onToggleExpand}>
      {isExpanded ? <ChevronDown /> : <ChevronRight />}
    </Button>
  )}
  {children}
</div>
```

### Step 5: Auto-Expand on Mount (dnd.tsx)

```typescript
useEffect(() => {
  if (nested && defaultExpanded) {
    const collectIds = (items: T[]): number[] => {
      return items.flatMap(item => [
        ...(item.children?.length ? [item.id] : []),
        ...(item.children ? collectIds(item.children) : [])
      ]);
    };
    setExpandedItems(new Set(collectIds(items)));
  }
}, [items, nested, defaultExpanded]);
```

### Step 6: Refactor EntityTabsConfig

Remove custom nested rendering code and use the upgraded SortableList.

## Files to Modify

1. `frontend-next/components/ui/dnd.tsx` - Main changes
2. `frontend-next/components/admin/EntityTabsConfig.tsx` - Simplify after upgrade

## Testing

1. EntityTabsConfig - nested tabs expand/collapse
2. Drag reordering still works at all levels
3. Position typing works
4. Indentation is visible
5. Auto-expand on load

## Backwards Compatibility

- All new props are optional with sensible defaults
- `nested={false}` (default) preserves current flat-list behavior
- Existing usages don't need changes
