# Gantt Chart Usability Inventory

This document catalogs ALL usability patterns in the current Gantt implementation.
Use as a checklist during the clean rewrite to ensure UX parity.

---

## 1. USER WORKFLOWS

### Primary Workflow: Schedule a Job
1. [ ] **Open Schedule Page** → Click "Open Gantt" button
2. [ ] **Validation Phase** (automatic):
   - API runs `sm_tasks/validate_dates` to fix past dates
   - Toast notification: "Schedule Updated - X tasks moved forward"
3. [ ] **View & Edit Tasks**:
   - Gantt loads with tasks visible
   - User drags tasks to new dates
4. [ ] **Handle Dependencies**: If task has successors → cascade dialog appears
5. [ ] **Save Changes**: Drag operation auto-saves to API

### Secondary Workflows
- [ ] **Edit Dependencies**: Click dependencies column → opens modal dialog
- [ ] **Toggle Task States**: Checkboxes for confirm/supplier_confirm/hold/complete
- [ ] **View Photos**: Click camera icon → side panel with job photos
- [ ] **Change Template**: Dropdown to switch between schedule templates
- [ ] **Navigate Timeline**: Zoom buttons, "Today" button, "Fit" button

---

## 2. VISUAL FEEDBACK

### Hover States
- [ ] Column headers show drag cursor (`cursor: grab` → `cursor: grabbing`)
- [ ] Dragged columns show blue background with ring and shadow
- [ ] Sidebar rows highlight on hover (`hover:bg-gray-100`)
- [ ] Task checkboxes show hover background (`hover:bg-muted/50`)
- [ ] Resize handles highlight on hover (`bg-primary/50`)

### Dragging Feedback
- [ ] Task bar turns blue with ring during drag (opacity-80)
- [ ] Cursor changes to "grabbing" hand
- [ ] Touch support: `touchAction: 'none'` for proper mobile drag
- [ ] Resize handle shows `cursor-col-resize`

### Selection Feedback
- [ ] Task selection syncs between sidebar and canvas
- [ ] Multi-select with Shift+click for range selection
- [ ] Group headers highlighted in amber when child selected
- [ ] Last selected task tracked for keyboard navigation

### Task Status Colors (Visual Encoding)
- [ ] Started: Emerald green (`rgba(16, 185, 129, 0.25)`)
- [ ] Hold: Tan/beige (`rgba(212, 165, 116, 0.3)`)
- [ ] Confirm: Orange (`rgba(249, 115, 22, 0.25)`)
- [ ] Supplier Confirm: Purple (`rgba(168, 85, 247, 0.2)`)
- [ ] Complete: Dark gray (`rgba(31, 41, 55, 0.3)`)

### Loading States
- [ ] Spinner + "Loading Gantt chart..." message
- [ ] Photo loading shows spinner with size variants
- [ ] Silent refresh (no spinner) for background data reloads

### Toast Notifications
- [ ] Success: "Schedule Updated - X tasks moved forward"
- [ ] Error: "Failed to load Gantt data" (destructive variant)
- [ ] Info: Photo loading, dependency changes
- [ ] All mutations trigger toasts

---

## 3. DISCOVERABILITY

### Toolbar Tooltips
- [ ] All buttons have `title` attribute for native browser tooltips
- [ ] Icons are self-documenting (ZoomIn, ZoomOut, Calendar, etc.)

### Sidebar Cell Tooltips
- [ ] Task name shows full text on hover (via `title`)
- [ ] Supplier name shows full text on hover
- [ ] PO number shows full text on hover
- [ ] Prevents data loss when truncated

### Dependency Editor Help Panel
- [ ] Large left sidebar (w-64) with visual onboarding
- [ ] Animated diagram showing A→B→C flow
- [ ] Color legend: amber dashed = predecessor, blue dashed = successor
- [ ] Dependency types explained: FS, SS, FF, SF
- [ ] Lag explanation: "+3 = wait 3 days", "-2 = overlap 2 days"

### Hidden Features (Need Better Discoverability)
- [ ] Right-click context menu (not documented)
- [ ] Shift+click range selection (not documented)
- [ ] Ctrl+Z undo (not visible in UI)
- [ ] Escape to exit fullscreen (not visible)

---

## 4. ERROR PREVENTION & RECOVERY

### Cascade Dialog (Key Usability Feature)
- [ ] Shows ALL affected tasks before action
- [ ] Per-task choice: "Break" (red) vs "Cascade" (green)
- [ ] Visual hierarchy: Direct successors vs downstream children
- [ ] Faded state shows "Not affected" tasks
- [ ] Disabled state for completed tasks (cannot cascade)
- [ ] User sees exact consequences before confirming

### Confirm/Supplier Confirm Dialog
- [ ] Shows what will happen (green/purple info box)
- [ ] "Task becomes locked - won't move during cascade"
- [ ] Warning about affected successors (yellow box)
- [ ] Lists all affected tasks
- [ ] Removal info when un-confirming (blue box)

### Undo History
- [ ] Per-task session undo (saves before drag/resize/duration change)
- [ ] Ctrl+Z restores previous state
- [ ] **Limitation**: Session-only (lost on page reload)
- [ ] **Limitation**: Per-task only (not global)
- [ ] **Limitation**: Not discoverable (no UI hint)

### Error Recovery
- [ ] Network error shows message + "Retry" button
- [ ] Silent fallback for holidays (uses Australian QLD holidays)
- [ ] Toast notifications for all errors

---

## 5. ACCESSIBILITY

### Current Implementation (Limited)
- [ ] Dialogs have ARIA built-in via shadcn
- [ ] Buttons are keyboard accessible by default
- [ ] Inputs are standard form controls

### Missing ARIA (Needs Improvement)
- [ ] No `aria-label` on icon buttons (only title tooltips)
- [ ] No `aria-describedby` for help text
- [ ] No `role="region"` for main Gantt canvas
- [ ] No `aria-live` for status updates
- [ ] Color-only visual encoding (no icons/text fallback)

### Keyboard Navigation
- [ ] Auto-focus on hover (`e.currentTarget.focus()`)
- [ ] Enter/Escape for editing (save/cancel)
- [ ] Escape for fullscreen exit
- [ ] Shift+Click for range selection

### Color Contrast
- [ ] Tinted backgrounds with 0.2-0.3 opacity
- [ ] Explicit text colors (`text-muted-foreground`, `text-blue-800`)
- [ ] Full dark mode support (`dark:bg-blue-950/30`)

---

## 6. RESPONSIVE DESIGN

### Mobile Considerations
- [ ] Touch support via `touchAction: 'none'`
- [ ] Full height container (`flex flex-col h-full`)
- [ ] Scrollable sidebar
- [ ] Canvas fills remaining space

### Viewport Management
- [ ] Sidebar scroll synced with canvas scroll
- [ ] Canvas adjusts to container size
- [ ] No explicit mobile breakpoints (relies on flexible layout)

### Responsive Dialog Sizes
- [ ] Dialogs use `max-w-6xl max-h-[90vh]`
- [ ] `showSidebar` toggle hides sidebar for more canvas space

---

## 7. PERFORMANCE UX

### Perceived Performance
- [ ] Silent refresh (no spinner) for background reloads after edits
- [ ] Spinner only shown on initial load
- [ ] Immediate visual feedback on drag/resize

### Optimistic Updates
- [ ] Update local state immediately on drag
- [ ] API call happens in background
- [ ] Toast shows error if API fails (but UI already updated)

### Batch Updates
- [ ] Cascade dialog collects all updates before sending
- [ ] Executes updates in order (not all at once)
- [ ] **Missing**: No skeleton screens (spinner-based only)

---

## 8. COGNITIVE LOAD

### Information Hierarchy - Sidebar (Left to Right)
1. [ ] **Row #** - Visual anchor (1-based)
2. [ ] **Name** - Main task identifier (truncated with tooltip)
3. [ ] **Status Checkboxes** - Started, Hold, Confirm, Supplier, Complete
4. [ ] **Duration** - Days (compact format)
5. [ ] **Supplier** - PO-related info (muted text)
6. [ ] **PO #** - Reference link
7. [ ] **Role** - Assigned role
8. [ ] **Dependencies** - Interaction point

### Progressive Disclosure
- [ ] Basic view: Task names + status checkboxes
- [ ] Advanced: Click name → dependency editor modal
- [ ] Photos: Hidden by default → revealed via toolbar icon
- [ ] Column toggle: Users can hide/reorder non-essential columns

### Visual Grouping
- [ ] Header rows: Amber background (`rgba(251, 191, 36, 0.15)`)
- [ ] Child rows: Lighter amber (`rgba(251, 191, 36, 0.08)`)
- [ ] Alternate row colors for readability

### Legends and Guides
- [ ] Dependency editor: Visual legend with color-coded lines
- [ ] Cascade dialog: Green = cascade, Red = break
- [ ] Consistent terminology across UI

### Consistent Terminology
- [ ] **Confirm** - Supervisor approval (orange)
- [ ] **Supplier Confirm** - Supplier approval (purple)
- [ ] **Hold** - Task pinned to date (tan)
- [ ] **Started** - Task has begun (emerald)
- [ ] **Complete/Done** - Task finished (dark gray)

---

## 9. USABILITY STRENGTHS (Must Preserve)

| Strength | Description |
|----------|-------------|
| Clear Visual Feedback | Drag states, hover effects, loading indicators |
| Explicit Dialogs | Cascade/confirm dialogs show consequences before action |
| Helpful Sidebars | Dependency editor has detailed help panel with diagrams |
| Tooltips Everywhere | Buttons, columns, task cells all have title attributes |
| Safe Undo | Per-task session history |
| Error Recovery | Retry button for network errors, fallback holidays |
| Dark Mode | Full support with color adjustments |
| Column Management | Users can customize what they see |

---

## 10. USABILITY GAPS (Must Fix in Rewrite)

| Gap | Current State | Target State |
|-----|---------------|--------------|
| Hidden Keyboard Shortcuts | Ctrl+Z, Escape not visible | Add keyboard hints in UI |
| Accessibility | Limited ARIA attributes | Full ARIA support |
| Mobile Touch | No gesture support | Pinch-to-zoom, swipe |
| Session Loss | Undo history lost on reload | Persist to localStorage |
| No Onboarding | First-time users must discover | Guided tour or hints |
| Discoverability | Right-click, range select hidden | Document in UI |
| Color-Only Encoding | Status relies on color | Add icons/text fallback |
| Silent Failures | Holiday loading failure is silent | Show warning |

---

## Usability Checklist Summary

| Category | Items |
|----------|-------|
| User Workflows | 7 |
| Visual Feedback | 18 |
| Discoverability | 12 |
| Error Prevention | 15 |
| Accessibility | 12 |
| Responsive Design | 8 |
| Performance UX | 7 |
| Cognitive Load | 16 |
| **TOTAL** | **~95** |

---

*Generated from codebase exploration on 2026-01-02*
