# Schedule Master Components

This directory contains all components for the Schedule Master feature, which allows users to import project schedules, match tasks to purchase orders, and visualize timelines in a Gantt chart.

## Components

### ScheduleMasterTab
**Main container component** - Orchestrates the entire schedule master workflow.

**Props:**
- `constructionId` (required) - The ID of the construction/job

**Features:**
- Loads schedule tasks from API
- Manages state for all child components
- Handles import, match, and unmatch operations
- Shows toast notifications for user feedback

**Usage:**
```jsx
<ScheduleMasterTab constructionId={jobId} />
```

---

### ScheduleImporter
**File upload component** - Handles Excel/CSV schedule file uploads.

**Props:**
- `constructionId` (required) - The ID of the construction/job
- `onImportSuccess` (required) - Callback function when import succeeds
- `compact` (optional) - If true, shows as a button instead of full upload area

**Features:**
- Drag-and-drop file upload
- Validates file type (CSV, XLS, XLSX only)
- Validates file size (50MB max)
- Shows upload progress
- Two modes: full upload area or compact button

**Usage:**
```jsx
// Full upload area (empty state)
<ScheduleImporter
  constructionId={jobId}
  onImportSuccess={handleSuccess}
/>

// Compact button (for re-import)
<ScheduleImporter
  constructionId={jobId}
  onImportSuccess={handleSuccess}
  compact
/>
```

---

### ScheduleStats
**Statistics display component** - Shows overview of schedule matching progress.

**Props:**
- `matchedCount` (required) - Number of tasks matched to POs
- `unmatchedCount` (required) - Number of unmatched tasks
- `totalCount` (required) - Total number of tasks

**Features:**
- Three stat cards: Total, Matched, Unmatched
- Progress bar showing matching completion
- Color-coded cards (green for matched, yellow for unmatched)

**Usage:**
```jsx
<ScheduleStats
  matchedCount={45}
  unmatchedCount={109}
  totalCount={154}
/>
```

---

### ScheduleTaskList
**Task list component** - Displays all schedule tasks in a table with match/unmatch actions.

**Props:**
- `tasks` (required) - Array of schedule task objects
- `loading` (optional) - Shows loading spinner if true
- `onMatchTask` (required) - Callback when user clicks "Match" button
- `onUnmatch` (required) - Callback when user clicks "Unmatch" button

**Features:**
- Uses DataTable component for consistent styling
- Sortable columns
- Status badges with color coding
- Match button for unmatched tasks
- Unmatch button for matched tasks
- Shows PO number for matched tasks

**Usage:**
```jsx
<ScheduleTaskList
  tasks={scheduleTasks}
  loading={isLoading}
  onMatchTask={(task) => console.log('Match', task)}
  onUnmatch={(taskId) => console.log('Unmatch', taskId)}
/>
```

---

### TaskMatchModal
**Matching modal component** - Modal for selecting which PO to match to a task.

**Props:**
- `isOpen` (required) - Controls modal visibility
- `onClose` (required) - Callback to close modal
- `onConfirm` (required) - Callback with selected PO ID when confirmed
- `task` (required) - The task object being matched
- `constructionId` (required) - The ID of the construction/job

**Features:**
- Shows suggested POs based on supplier category
- Search/filter POs by number, supplier, or category
- Two sections: "Suggested Matches" and "Other Purchase Orders"
- Displays PO details: number, supplier, category, amount, status
- Status badges for PO state

**Usage:**
```jsx
<TaskMatchModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onConfirm={(poId) => handleMatch(poId)}
  task={selectedTask}
  constructionId={jobId}
/>
```

---

### ScheduleGanttChart
**Gantt chart component** - Visualizes matched tasks in a timeline view using frappe-gantt.

**Props:**
- `ganttData` (required) - Object containing gantt_tasks array

**Features:**
- Interactive Gantt chart with drag-to-edit support
- Three view modes: Day, Week, Month
- Color-coded bars by status (gray=not started, blue=in progress, green=completed)
- Task dependencies/predecessors visualization
- Click to view task details
- Custom popup with task information
- Dark mode support
- Legend showing status colors
- Selected task details panel

**Usage:**
```jsx
<ScheduleGanttChart
  ganttData={{
    gantt_tasks: [
      {
        id: 1,
        title: "Task 1",
        start_date: "2025-01-01",
        end_date: "2025-01-15",
        duration_days: 14,
        status: "In Progress",
        progress: 50,
        predecessors: [],
        supplier_category: "Concrete",
        supplier_name: "ABC Concrete",
        purchase_order_number: "PO-001"
      }
    ]
  }}
/>
```

---

## API Integration

All components interact with these backend endpoints:

### Import Schedule
```
POST /api/v1/constructions/:construction_id/schedule_tasks/import
Content-Type: multipart/form-data
Body: file (Excel/CSV)
```

### List Tasks
```
GET /api/v1/constructions/:construction_id/schedule_tasks
Returns: {
  schedule_tasks: [...],
  matched_count: 45,
  unmatched_count: 109,
  total_count: 154
}
```

### Get Gantt Data
```
GET /api/v1/constructions/:construction_id/schedule_tasks/gantt_data
Returns: {
  gantt_tasks: [...]
}
```

### Match Task to PO
```
PATCH /api/v1/schedule_tasks/:id/match_po
Body: { purchase_order_id: 123 }
```

### Unmatch Task
```
DELETE /api/v1/schedule_tasks/:id/unmatch_po
```

---

## File Structure

```
schedule-master/
├── ScheduleMasterTab.jsx        # Main container
├── ScheduleImporter.jsx          # File upload
├── ScheduleStats.jsx             # Stats summary
├── ScheduleTaskList.jsx          # Task table
├── TaskMatchModal.jsx            # Matching modal
├── ScheduleGanttChart.jsx        # Gantt visualization
└── README.md                     # This file
```

---

## User Flow

1. User opens Active Job detail page
2. Clicks "Schedule Master" tab
3. Sees empty state with import prompt
4. Uploads Excel/CSV schedule file
5. System imports tasks and shows list
6. User clicks "Match" on a task
7. Modal opens with suggested and all POs
8. User selects a PO and confirms
9. Task updates to show matched status
10. Progress bar updates
11. When tasks are matched, Gantt chart appears
12. User can view timeline and dependencies

---

## Styling

All components follow TEEEM design patterns:
- Tailwind CSS utility classes
- Dark mode support throughout
- Badge component for status indicators
- DataTable component for consistent tables
- Headless UI for modals
- Heroicons for icons

---

## Dependencies

- **frappe-gantt**: Lightweight Gantt chart library
- **@headlessui/react**: Accessible UI components (Dialog)
- **@heroicons/react**: Icon library
- **react**: UI framework
- **api.js**: Fetch wrapper for backend calls

---

## Future Enhancements

- Real-time progress updates in Gantt chart
- Critical path highlighting
- Export schedule to PDF
- Bulk matching operations
- Task dependencies editor
- Resource allocation view
- Calendar integration

---

## Notes

- Gantt chart CSS is inlined to avoid build issues with frappe-gantt package exports
- Task matching is based on supplier category for suggestions
- Only matched tasks appear in Gantt chart
- File size limit is 50MB for schedule uploads
- Supported file formats: CSV, XLS, XLSX
