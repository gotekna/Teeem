# Gantt Chart Complete Feature Inventory

This document catalogs ALL features in the current Gantt implementation.
Use as a checklist during the clean rewrite to ensure 100% feature parity.

---

## 1. LEFT SIDE (TABLE/SIDEBAR) FEATURES

### Column Types & Configuration
- [ ] **Text Columns**: Name, Supplier, PO Number, Role, Status
- [ ] **Checkbox Columns**: Started (▶), Hold (📌), Confirm (✓), Supplier Confirm (S✓), Done (✓)
- [ ] **Display-Only Columns**: Duration (Days), Dependencies, Start Date, End Date, Progress (%), Status

### Column Features
- [ ] Reorderable via drag-and-drop (dnd-kit)
- [ ] Resizable via handle on column edge
- [ ] Visibility toggle (per-column)
- [ ] Persistent configuration (saved to API `/api/v1/sm_settings`)
- [ ] Column width memory in localStorage + API
- [ ] Shorthand labels for checkbox columns (e.g., "▶" for Started)
- [ ] Name column always visible (permanent)
- [ ] Merge with defaults when loading saved config

### Row Types
- [ ] **Header Rows** (task grouping containers): Collapsible/expandable with chevron icon
  - [ ] `header_gantt === 'Header'` or `allow_header === true` detection
  - [ ] Amber background (`#fef3c7`)
  - [ ] Child count tracking
  - [ ] Collapse all / Expand all toolbar buttons
  - [ ] Sticky header when scrolled out of view (on selection)
- [ ] **Task Rows** (leaf nodes): Regular task items
  - [ ] Associated with parent header via `header_gantt` field
  - [ ] White background with hover effects

### Row Selection
- [ ] Single click selects row
- [ ] Ctrl+Click toggles multi-selection
- [ ] Shift+Click range selection
- [ ] Selection propagates to Gantt canvas
- [ ] Selected group highlights entire group (header + children)
- [ ] Row hover highlighting

### Filtering & Search
- [ ] **Name Search**: Case-insensitive text search across task names
- [ ] **View-Based Filtering**: "header" view shows only headers and their children
- [ ] **"Grouped only" filter**: Shows only grouped tasks (headers with children)
- [ ] Dynamic visibility: Hides headers with no visible children

### Inline Editing
- [ ] **Checkbox Toggle**: Started, Hold, Confirm, Supplier Confirm, Done columns
- [ ] Confirm/Supplier Confirm shows confirmation dialog with successor impact detection
- [ ] Checkbox colors match task bar colors
- [ ] **Duration Inline Edit**: Click to edit, saves on blur/enter
- [ ] Status fields editable via forms

### Sticky Header
- [ ] Shows selected group's header row when scrolled out of view
- [ ] Updates based on `sidebarScrollY` position
- [ ] Helps maintain context while scrolling

### Layout
- [ ] Row Height: 28px (consistent with canvas)
- [ ] Header Height: 49.5px (sticky)

---

## 2. RIGHT SIDE (CANVAS) FEATURES

### Task Bar Rendering
- [ ] **Status-Based Colors** (in priority order):
  1. Done (✓) → Dark gray (`rgba(31, 41, 55, 0.3)`)
  2. Supplier Confirm (S✓) → Purple (`rgba(168, 85, 247, 0.2)`)
  3. Confirm (✓) → Orange (`rgba(249, 115, 22, 0.25)`)
  4. Hold (📌) → Tan/Beige (`rgba(212, 165, 116, 0.3)`)
  5. Started (▶) → Green (`rgba(16, 185, 129, 0.25)`)
  6. Default → Gray (`#9ca3af`)

### Task Shapes
- [ ] Regular task: Rectangle bar
- [ ] Order task: Diamond with "O"
- [ ] Call task: Diamond with "C"
- [ ] Photo task: Camera icon
- [ ] Milestone: Diamond shape

### Task Bar Details
- [ ] Progress Indicator: Percentage bar overlay (draggable endpoint)
- [ ] Labels: Task name, duration, supplier name, PO number (conditional)
- [ ] Resize Handles: 8px left/right edges for drag-to-resize
- [ ] Lock Indicators: Visual cue for locked tasks
  - [ ] `locked === 'supplierConfirmed'`
  - [ ] `locked === 'started'`
  - [ ] `locked === 'manuallyPositioned'`

### Task Bar Interactions
- [ ] **Drag to Move**: Horizontal drag changes start date, cascades to unlocked successors
  - [ ] Shows cascade dialog when successors will be affected
  - [ ] Respects locked successor constraints (confirm/supplier_confirm)
  - [ ] Snap-to-working-day support
- [ ] **Resize**: Drag left/right edge to change start/end date
  - [ ] Preserves duration or allows freeform resize
  - [ ] Hit detection within 8px of edge
- [ ] **Progress Drag**: Drag progress bar endpoint to change completion %
- [ ] **Double-Click**: Opens task editor panel
- [ ] **Right-Click**: Context menu with actions
- [ ] **Hover Highlight**: Selected task group highlighted in amber

### Selection System
- [ ] Single Selection: Click task to select
- [ ] Multi-Selection: Ctrl+Click to toggle, Shift+Click for range
- [ ] Marquee Selection: Click+drag box to select multiple tasks
- [ ] Visual Feedback: Selected tasks highlighted, border accentuated
- [ ] Group Selection: Selecting header or child highlights entire group

### Dependency Features
- [ ] **Dependency Types**: FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish)
- [ ] **Visual Display**:
  - [ ] Bezier curve lines connecting task bars
  - [ ] Predecessor line (gold/amber dashed)
  - [ ] Successor line (blue dashed)
  - [ ] Broken dependencies (purple with checkerboard pattern)
- [ ] **Dependency Creation**: Drag from task connector (5px radius) to another task
  - [ ] Connector position on start or end edge of bar
  - [ ] Popup appears near target: "Start" and "Finish" buttons for type selection
  - [ ] Circular dependency prevention
  - [ ] Lag/offset support
- [ ] **Dependency Editor Dialog**: Full predecessor/successor management
  - [ ] List of predecessors with type and lag
  - [ ] List of successors
  - [ ] Add/edit/remove links
  - [ ] Circular dependency detection
- [ ] **Visibility Toggle**: Button to show/hide all dependency lines
- [ ] **Dependency Highlighting**: Flash animation when task selected

### Timeline Features
- [ ] **Today Marker**: Red vertical line at current date
  - [ ] Position synced with company timezone
  - [ ] Button to scroll to today
- [ ] **Grid Lines**: Day columns with weekend shading (light gray)
- [ ] **Holiday Shading**: Light pink background for holidays
  - [ ] Uses Australian holidays by default
  - [ ] Customizable via `addHolidays()`, `setWorkingDays()`
- [ ] **Date Range**: Automatically expands based on task dates
  - [ ] Adds 1 week before earliest task
  - [ ] Adds 2 weeks after latest task
- [ ] **Working Days Calendar**: Accounts for weekends and holidays

### Zoom Features
- [ ] Zoom Levels: Day, Week, Month, Custom
- [ ] **Zoom Controls**:
  - [ ] In/Out buttons (20% increments)
  - [ ] Zoom to Fit (all tasks visible)
  - [ ] Zoom to Day/Week/Month presets
  - [ ] Cycle through presets
- [ ] Zoom Range: 10-100px per day
- [ ] Default: 25px per day
- [ ] Mouse Wheel: Ctrl+Scroll to zoom

### Scroll & Navigation
- [ ] Vertical Scroll: Synced with sidebar table
- [ ] Horizontal Scroll: Pan timeline left/right
- [ ] **Scroll to Date**: Button + API to navigate to specific date
- [ ] **Scroll to Task**: Programmatic API to focus task
  - [ ] Vertical: Center task in viewport
  - [ ] Horizontal: Show task with 1/3 left padding
- [ ] Scroll Limits: Prevent scrolling beyond data bounds

### Tooltips
- [ ] Trigger: Hover over task bar
- [ ] Content: Task name, Start/End dates, Duration, Progress %, Supplier name, Status, Dependencies
- [ ] Positioning: Auto-adjust to stay in viewport
- [ ] Delay: Configurable (default 300ms)

### Right-Click Context Menu
- [ ] Delete task
- [ ] Edit task
- [ ] Lock/Unlock task
- [ ] Hold task (with reason selection)
- [ ] Copy task
- [ ] Paste task
- [ ] Undo/Redo
- [ ] Keyboard shortcuts shown in menu

### Minimap
- [ ] Visibility Toggle: Button in toolbar
- [ ] Shows: Overview of all tasks and viewport position
- [ ] Interaction: Drag viewport rectangle to pan timeline
- [ ] Location: Top-right corner (default)
- [ ] Persistence: State remembered

### Critical Path
- [ ] Toggle: Button in toolbar
- [ ] Calculation: Automatic when enabled
- [ ] Visualization: Red highlight on critical tasks
- [ ] Slack/Float: Calculated for each task
- [ ] Invalidation: Auto-recalculate on data changes

### Baseline Comparison
- [ ] Capture: `captureBaseline()` creates snapshot
- [ ] Visualization: Variance display (start, end, duration)
- [ ] Colors: Show ahead vs behind schedule

### Performance Features
- [ ] RequestAnimationFrame: 60fps render loop
- [ ] Dirty Flag: Intelligent re-render triggering
- [ ] Spatial Index: Grid-based hit testing (50px cells)
- [ ] Object Pool: Recycle render objects to reduce GC
- [ ] Anti-Flicker: Suppress renders during drag operations
- [ ] Undo/Redo: Command history (configurable depth)

---

## 3. TOOLBAR FEATURES

### Left Group
- [ ] **Zoom In** (ZoomIn icon): 20% zoom increase
- [ ] **Zoom Out** (ZoomOut icon): 20% zoom decrease
- [ ] Divider
- [ ] **Scroll to Today** (Calendar icon): Center today in view
- [ ] **Zoom to Fit** (Maximize2 icon): Show all tasks
- [ ] Divider
- [ ] **Refresh** (RefreshCw icon): Reload data from API (template mode only)
- [ ] **Toggle Sidebar** (PanelLeft/PanelLeftClose): Show/hide table
- [ ] **Toggle Grouped Only** (Layers icon): Show only grouped tasks
- [ ] **Collapse All** (ChevronsDownUp icon): Collapse all header groups
- [ ] **Expand All** (ChevronsUpDown icon): Expand all header groups
- [ ] **Fullscreen** (Expand/Minimize2 icon): Toggle fullscreen mode

### Middle Group
- [ ] **Column Visibility** (Eye icon): Dropdown menu
  - [ ] Drag to reorder columns
  - [ ] Checkbox to toggle visibility
  - [ ] Permanent columns marked "(always)"
- [ ] **Legend** (Info icon): Popover showing color legend
  - [ ] Task bar colors by checkbox status
  - [ ] Background shading (weekends, holidays, groups)
  - [ ] Task shapes (order, call, photo)
  - [ ] Dependency line colors
- [ ] **Dependencies Toggle** (GitBranch icon): Show/hide dependency lines
- [ ] **Photo Panel** (Camera icon): Show/hide job photos (job mode only)

### Right Group
- [ ] **Template Selector** (Select dropdown): Choose data template
  - [ ] Shows template name and row count
  - [ ] Triggers `onTemplateChange()` callback
- [ ] **View Badge**: Shows active Foundation view filter
  - [ ] Displays view name
  - [ ] X button to clear filter
- [ ] **Task Count**: Display total visible tasks

---

## 4. DATA FLOW

### API Endpoints
- [ ] `GET /api/v1/sm_schedules/{template_id}/gantt_data` - Fetch tasks and dependencies
- [ ] `GET /api/v1/sm_settings` - Load column config and settings
- [ ] `PATCH /api/v1/sm_settings` - Save column config
- [ ] `GET /api/v1/sm_settings/assignable_roles` - Fetch role options (SSoT)
- [ ] `POST/PATCH /api/v1/sm_schedule_master/{task_id}` - Save task changes
- [ ] `GET /api/v1/files?q=...` - Fetch job photos (SharePoint)

### Data Updates Flow
- [ ] Task Move (Drag) → Save to API → Sync canvas
- [ ] Task Resize → Save to API → Sync canvas
- [ ] Checkbox Toggle → Save to API → Cascade logic
- [ ] Duration Edit → Save to API → Sync canvas
- [ ] Dependency Create → Save to API → Sync canvas
- [ ] Dependency Remove → Save to API → Sync canvas

---

## 5. SYNC MECHANISMS (TO BE ELIMINATED IN REWRITE)

### Current (Problematic)
- [ ] Vertical scroll sync (RequestAnimationFrame)
- [ ] Selection sync (sidebar ↔ canvas)
- [ ] Group highlighting sync
- [ ] Task update sync

### New (Unified Canvas)
- [ ] Single scroll context (canvas owns)
- [ ] Single selection state
- [ ] Single render loop
- [ ] Overlays positioned by canvas coordinates

---

## 6. MANAGERS TO PRESERVE/REUSE

| Manager | Purpose | Reuse? |
|---------|---------|--------|
| SelectionManager | Single/multi/range selection | ✅ Yes |
| InteractionManager | Drag, resize, progress | ✅ Yes |
| DependencyManager | CRUD + validation | ✅ Yes |
| RenderCoordinator | Batching, dirty flags | ✅ Yes |
| ExportManager | PNG, PDF, CSV, JSON | ✅ Yes |
| FilterManager | Status, date, progress filters | ✅ Yes |
| BaselineManager | Snapshots, variance | ✅ Yes |
| CriticalPathManager | Calculation, tracking | ✅ Yes |
| CalendarManager | Working days, holidays | ✅ Yes |

---

## 7. DIALOGS & MODALS

- [ ] Confirm/Supplier Confirm Dialog (shows successor impact)
- [ ] Cascade Dialog (shows locked vs unlocked successors)
- [ ] Dependency Editor Dialog (full predecessor/successor management)
- [ ] Image Lightbox (job photos)
- [ ] Context Menu
- [ ] Loading State
- [ ] Error State
- [ ] Empty State (no data)

---

## 8. KEYBOARD SHORTCUTS

- [ ] Ctrl+Z: Undo
- [ ] Ctrl+Y / Ctrl+Shift+Z: Redo
- [ ] Escape: Exit fullscreen, close dialogs
- [ ] Ctrl+Scroll: Zoom in/out
- [ ] Left/Right Arrow: Pan timeline
- [ ] Up/Down Arrow: Navigate tasks
- [ ] Ctrl+A: Select all visible tasks
- [ ] Delete: Delete selected task

---

## 9. EDGE CASES & VALIDATION

- [ ] Circular dependency prevention
- [ ] Broken dependency handling
- [ ] Locked task cascade constraints
- [ ] Confirm/Supplier Confirm lock behavior
- [ ] Manual positioning lock
- [ ] Today constraint (no tasks in past)
- [ ] Invalid date ranges
- [ ] Missing predecessor/successor
- [ ] Header with no children
- [ ] Ungrouped tasks in "header" view
- [ ] Column config merge with defaults
- [ ] Stale column config (add new columns)

---

## Feature Count Summary

| Category | Count |
|----------|-------|
| Table/Sidebar Features | ~35 |
| Canvas Features | ~45 |
| Toolbar Features | ~20 |
| Data Flow | ~10 |
| Managers | ~10 |
| Dialogs | ~8 |
| Keyboard Shortcuts | ~8 |
| Edge Cases | ~12 |
| **TOTAL** | **~148** |

---

*Generated from codebase exploration on 2026-01-02*
