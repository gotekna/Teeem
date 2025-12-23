# GanttCanvas Architecture Mapping

## Overview

This document maps the 16,276-line GanttCanvas.ts into logical domains for extraction into separate manager classes.

## Proposed Class Hierarchy

```
GanttCanvas (orchestrator, ~2,500 lines)
├── managers/
│   ├── SelectionManager.ts      (~600 lines)
│   ├── InteractionManager.ts    (~1,000 lines)
│   ├── DependencyManager.ts     (~800 lines)
│   ├── StateManager.ts          (~500 lines)
│   ├── ExportManager.ts         (~600 lines)
│   └── RenderCoordinator.ts     (~300 lines)
├── spatial/
│   └── SpatialIndex.ts          (~300 lines)
└── features/
    ├── FilterManager.ts         (~400 lines)
    ├── BaselineManager.ts       (~400 lines)
    ├── CriticalPathManager.ts   (~300 lines)
    └── CalendarManager.ts       (~400 lines)
```

---

## Domain Mapping

### 1. SELECTION MANAGER
**Purpose:** Manage task selection state and multi-select operations

| Method | Line | Action |
|--------|------|--------|
| `selectTask()` | ~2440 | Extract |
| `selectTasks()` | - | Extract |
| `deselectTask()` | - | Extract |
| `deselectAllTasks()` | - | Extract |
| `toggleTaskSelection()` | - | Extract |
| `getSelectedTasks()` | - | Extract |
| `isTaskSelected()` | - | Extract |
| `selectRange()` | - | Extract (shift+click) |
| `onSelectionChangeHandler()` | 916 | Keep callback registration |

**State to extract:**
- `selectedTaskIds: Set<string>`
- `lastSelectedTaskId: string | null`

---

### 2. INTERACTION MANAGER
**Purpose:** Handle drag, resize, progress bar, and mouse/touch interactions

| Method | Line | Action |
|--------|------|--------|
| `handleMouseDown()` | - | Extract |
| `handleMouseMove()` | - | Extract |
| `handleMouseUp()` | - | Extract |
| `handleMouseLeave()` | - | Extract |
| `handleTouchStart()` | - | Extract |
| `handleTouchMove()` | - | Extract |
| `handleTouchEnd()` | - | Extract |
| `startDrag()` | - | Extract |
| `updateDrag()` | - | Extract |
| `endDrag()` | - | Extract |
| `cancelDrag()` | - | Extract |
| `startResize()` | - | Extract |
| `updateResize()` | - | Extract |
| `endResize()` | - | Extract |
| `startProgressDrag()` | - | Extract |
| `updateProgressDrag()` | - | Extract |
| `endProgressDrag()` | - | Extract |
| `hitTest()` | - | Extract |
| `hitTestEdge()` | - | Extract |
| `hitTestConnector()` | - | Extract |
| `hitTestProgressBar()` | - | Extract |

**State to extract:**
- `isDragging: boolean`
- `dragTask: GanttTask | null`
- `dragStartX/Y: number`
- `isResizing: boolean`
- `resizeTask: GanttTask | null`
- `resizeEdge: 'left' | 'right' | null`
- `isDraggingProgress: boolean`

---

### 3. DEPENDENCY MANAGER
**Purpose:** Handle dependency CRUD, cascade calculations, and validation

| Method | Line | Action |
|--------|------|--------|
| `setDependencies()` | 614 | Keep in GanttCanvas |
| `addDependency()` | 1582 | Extract |
| `removeDependency()` | 1631 | Extract |
| `removeDependencyBetween()` | 1652 | Extract |
| `getPredecessors()` | 1662 | Extract |
| `getSuccessors()` | 1670 | Extract |
| `wouldCreateCircularDependency()` | 1478 | Extract |
| `findCircularDependencies()` | 1520 | Extract |
| `removeCircularDependencies()` | 1678 | Extract |
| `hasBrokenDependencies()` | 1716 | Extract |
| `getBrokenDependencies()` | 1724 | Extract |
| `markDependencyAsBroken()` | 1734 | Extract |
| `restoreBrokenDependency()` | 1754 | Extract |
| `restoreAllBrokenDependencies()` | 1773 | Extract |
| `cascadeDependencies()` | - | Extract |
| `calculateCascade()` | - | Extract |

**State to extract:**
- `dependencies: GanttDependency[]`
- `cascadeInProgress: boolean`
- `pendingUpdates: Map<string, Partial<GanttTask>>`

---

### 4. STATE MANAGER
**Purpose:** Manage persistence, undo/redo integration, and state coordination

| Method | Line | Action |
|--------|------|--------|
| `recordAction()` | 923 | Delegate to UndoManager |
| `undo()` | 930 | Delegate |
| `redo()` | 940 | Delegate |
| `canUndo()` | 950 | Delegate |
| `canRedo()` | 957 | Delegate |
| `exportState()` | - | Extract |
| `importState()` | - | Extract |
| `saveToLocalStorage()` | - | Extract |
| `loadFromLocalStorage()` | - | Extract |
| `getStateSnapshot()` | - | Extract |
| `restoreStateSnapshot()` | - | Extract |

**State to extract:**
- `statePersistenceEnabled: boolean`
- `statePersistenceKey: string`
- `statePersistenceDebounceMs: number`
- `statePersistenceTimeout`

---

### 5. EXPORT MANAGER
**Purpose:** Handle export, clipboard, and print operations

| Method | Line | Action |
|--------|------|--------|
| `exportToImage()` | 3853 | Extract |
| `exportToBlob()` | 3862 | Extract |
| `exportToPDF()` | 4771 | Extract |
| `exportToMSProject()` | 15860 | Extract |
| `exportToSVG()` | 15868 | Extract |
| `copyToClipboard()` | - | Extract |
| `copyGanttBibleToClipboard()` | - | Extract |
| `copyBugHunterLexiconToClipboard()` | - | Extract |
| `getPrintLayout()` | 15873 | Extract |

---

### 6. RENDER COORDINATOR
**Purpose:** Coordinate rendering, dirty flags, and frame scheduling

| Method | Line | Action |
|--------|------|--------|
| `markDirty()` | - | Extract |
| `requestRender()` | - | Extract |
| `render()` | - | Delegate to Renderer |
| `suppressRender()` | - | Extract |
| `flushRender()` | - | Extract |
| `getDirtyRegions()` | - | Extract |
| `addDirtyRegion()` | - | Extract |

**State to extract:**
- `isDirty: boolean`
- `suppressRender: boolean`
- `dirtyRegions: Rect[]`
- `animationFrameId: number`

---

### 7. FILTER MANAGER (Feature 1)
**Purpose:** Handle task filtering and search

| Method | Line | Action |
|--------|------|--------|
| `setFilters()` | 6751+ | Extract |
| `addFilter()` | - | Extract |
| `removeFilter()` | - | Extract |
| `clearFilters()` | - | Extract |
| `getFilteredTasks()` | - | Extract |
| `isTaskVisible()` | - | Extract |
| `searchTasks()` | - | Extract |

---

### 8. BASELINE MANAGER
**Purpose:** Handle baseline comparison and variance calculation

| Method | Line | Action |
|--------|------|--------|
| `setBaselineEnabled()` | 1069 | Extract |
| `toggleBaseline()` | 1077 | Extract |
| `isBaselineEnabled()` | 1085 | Extract |
| `setBaselines()` | 1093 | Extract |
| `captureBaseline()` | 1105 | Extract |
| `clearBaselines()` | 1122 | Extract |
| `getBaseline()` | 1130 | Extract |
| `getAllBaselines()` | 1137 | Extract |
| `getTaskVariance()` | 1145 | Extract |

---

### 9. CRITICAL PATH MANAGER
**Purpose:** Handle critical path calculation and visualization

| Method | Line | Action |
|--------|------|--------|
| `setCriticalPathEnabled()` | 1025 | Extract |
| `toggleCriticalPath()` | 1038 | Extract |
| `isCriticalPathEnabled()` | 1045 | Extract |
| `getCriticalPathResult()` | 1052 | Extract |
| `recalculateCriticalPath()` | 1059 | Extract |

---

### 10. CALENDAR MANAGER
**Purpose:** Handle working days, holidays, and calendar operations

| Method | Line | Action |
|--------|------|--------|
| `setWorkingDays()` | 971 | Extract |
| `addHolidays()` | 979 | Extract |
| `clearHolidays()` | 987 | Extract |
| `getCalendar()` | 995 | Extract |
| `isWorkingDay()` | - | Extract |
| `isHoliday()` | 11354 | Keep (already exists in WorkingDaysCalendar) |
| `addHoliday()` | 11344 | Keep |
| `removeHoliday()` | 11349 | Keep |

---

## Implementation Order

### Phase 1: Core Managers (Days 1-3)
1. **RenderCoordinator** - Foundational, used by everything
2. **SelectionManager** - Simple, well-defined scope
3. **InteractionManager** - Complex but isolated

### Phase 2: Logic Managers (Days 3-4)
4. **DependencyManager** - Critical cascade logic
5. **StateManager** - Persistence consolidation

### Phase 3: Feature Managers (Day 5)
6. **ExportManager** - Standalone export features
7. **FilterManager** - Feature extraction
8. **BaselineManager** - Feature extraction
9. **CriticalPathManager** - Feature extraction
10. **CalendarManager** - Consolidate with existing WorkingDaysCalendar

### Phase 4: Spatial Index (Day 4)
11. **SpatialIndex** - Performance optimization for hit testing

---

## Interface Definitions

```typescript
// Core event types
interface SelectionChangeEvent {
  selected: Set<string>;
  added: string[];
  removed: string[];
}

interface DragEvent {
  task: GanttTask;
  startDate: Date;
  endDate: Date;
  phase: 'start' | 'move' | 'end' | 'cancel';
}

interface RenderRequest {
  region?: Rect;
  priority: 'immediate' | 'normal' | 'low';
}

// Manager interfaces
interface ISelectionManager {
  add(taskId: string): void;
  remove(taskId: string): void;
  clear(): void;
  toggle(taskId: string): void;
  selectRange(fromId: string, toId: string): void;
  getSelected(): Set<string>;
  isSelected(taskId: string): boolean;
  onChange(callback: (event: SelectionChangeEvent) => void): void;
}

interface IInteractionManager {
  handleMouseDown(e: MouseEvent): void;
  handleMouseMove(e: MouseEvent): void;
  handleMouseUp(e: MouseEvent): void;
  handleTouchStart(e: TouchEvent): void;
  handleTouchMove(e: TouchEvent): void;
  handleTouchEnd(e: TouchEvent): void;
  isDragging(): boolean;
  isResizing(): boolean;
  cancel(): void;
}

interface IDependencyManager {
  add(from: string, to: string, type: DependencyType): GanttDependency;
  remove(id: string): boolean;
  getPredecessors(taskId: string): GanttDependency[];
  getSuccessors(taskId: string): GanttDependency[];
  wouldCreateCycle(from: string, to: string): boolean;
  cascade(taskId: string, delta: number): CascadeResult;
}

interface IRenderCoordinator {
  markDirty(region?: Rect): void;
  requestRender(priority?: 'immediate' | 'normal' | 'low'): void;
  suppress(callback: () => void): void;
  flush(): void;
}
```

---

## File Size Targets

| File | Target Lines | Current Location |
|------|--------------|------------------|
| GanttCanvas.ts | ~2,500 | 16,276 |
| SelectionManager.ts | ~600 | Embedded |
| InteractionManager.ts | ~1,000 | Embedded |
| DependencyManager.ts | ~800 | Embedded |
| StateManager.ts | ~500 | Embedded |
| ExportManager.ts | ~600 | Embedded |
| RenderCoordinator.ts | ~300 | Embedded |
| FilterManager.ts | ~400 | Feature 1 |
| BaselineManager.ts | ~400 | Lines 1069-1170 |
| CriticalPathManager.ts | ~300 | Lines 1025-1068 |
| CalendarManager.ts | ~400 | Lines 971-995 + 11333-11360 |
| SpatialIndex.ts | ~300 | New |

**Total Target: ~8,100 lines** (50% reduction from 16,276)

---

## Success Metrics

- [ ] No file exceeds 3,000 lines
- [ ] Each class has single responsibility
- [ ] All interfaces are well-defined
- [ ] Circular dependencies eliminated
- [ ] Unit tests for each manager
- [ ] Integration tests for cross-manager operations
