# GANTT & SCHEDULE MASTER - Complete Implementation Guide

**Version:** 1.0
**Created:** 2025-12-21
**Status:** IN PROGRESS - Ready for Final Implementation
**Priority:** Next Major Feature

---

## EXECUTIVE SUMMARY

The Gantt/Schedule Master system is a **construction-specific scheduling solution** that enables:
- Interactive Gantt chart visualization with dependencies
- Task management with cascade updates
- Hold system for job-wide blocks (WHS incidents, weather, etc.)
- Resource allocation and timesheet tracking (Phase 2)
- Mobile field worker interface (Phase 3)
- AI-powered scheduling suggestions (Phase 4)

### Current Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| **Database Schema** | ✅ Complete | 22 `sm_*` models created |
| **Backend Models** | ✅ Complete | SmTask, SmDependency, etc. |
| **Gantt UI Components** | ✅ Complete | 17 components in `frontend-next/components/ui/gantt/` |
| **API Endpoints** | 🟡 Partial | Basic CRUD exists, cascade/rollover TBD |
| **Cascade Modal** | ✅ Complete | Kanban + Classic views |
| **Hold System** | 🟡 Partial | Model ready, UI TBD |
| **Rollover Job** | ❌ Not Started | Midnight automation |
| **Resource Allocation** | ❌ Not Started | Phase 2 |
| **Mobile/Field** | ❌ Not Started | Phase 3 |
| **AI Suggestions** | ❌ Not Started | Phase 4 |

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema](#2-database-schema)
3. [Current Implementation](#3-current-implementation)
4. [Remaining Work](#4-remaining-work)
5. [Phase 1: Core Gantt](#5-phase-1-core-gantt)
6. [Phase 2: Resource Allocation](#6-phase-2-resource-allocation)
7. [Phase 3: Mobile & Field](#7-phase-3-mobile--field)
8. [Phase 4: AI & Analytics](#8-phase-4-ai--analytics)
9. [UI/UX Specifications](#9-uiux-specifications)
10. [API Reference](#10-api-reference)
11. [Implementation Checklist](#11-implementation-checklist)

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 Design Philosophy

**"Full Copy Architecture"** - When a job is created:
1. User selects a `ScheduleTemplate` (e.g., "Residential NDIS Build")
2. System copies all template rows to `SmTask` records
3. Each job gets its own independent copy of tasks
4. Template changes don't affect existing jobs

**Why this approach:**
- Fast queries (O(1) per job)
- Full per-job customization
- Simple cascade logic
- Proven at scale (1M+ tasks)

### 1.2 Key Concepts

| Concept | Description |
|---------|-------------|
| **SmTask** | Job-specific task instance with actual dates |
| **SmDependency** | Relationship between tasks (FS, SS, FF, SF + lag) |
| **Cascade** | Automatic date updates when predecessor moves |
| **Hold Task** | Master blocker that freezes entire job |
| **Rollover** | Midnight job that moves past-due tasks forward |
| **Lock Types** | Prevent cascade (supplier_confirm, confirm, started, completed, manually_positioned) |

### 1.3 Component Architecture

```
Frontend (React/Next.js)
├── GanttChart (main component)
│   ├── GanttControls (view toggle, fullscreen, filters)
│   ├── GanttHeader (date headers)
│   ├── GanttSidebar (task list)
│   ├── GanttTimeline (chart area)
│   │   ├── GanttFeatureItem (task bars)
│   │   ├── GanttDependencies (SVG arrows)
│   │   └── GanttToday (today marker)
│   ├── GanttTableView (list view)
│   └── CascadePreviewModal (Kanban + Classic views)

Backend (Ruby on Rails)
├── Models: SmTask, SmDependency, SmHoldReason, etc.
├── Controllers: SmTasksController, SmDependenciesController
├── Services: SmCascadeService, SmRolloverService
└── Jobs: SmRolloverJob (Solid Queue)
```

---

## 2. DATABASE SCHEMA

### 2.1 Core Tables (Implemented)

#### sm_tasks (via `tasks` table)
Main task instances for each job.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `job_id` | bigint | FK to jobs (construction) |
| `template_row_id` | bigint | FK to schedule_template_rows (optional) |
| `parent_task_id` | bigint | Self-reference for hierarchy |
| `name` | varchar(255) | Task name |
| `task_number` | integer | Display order number |
| `sequence_order` | decimal | Sort order (allows insertions) |
| `start_date` | date | Planned start |
| `end_date` | date | Planned end |
| `duration_days` | integer | Duration in working days |
| `status` | enum | not_started, started, completed |
| `confirm` | boolean | Internal confirmation lock |
| `supplier_confirm` | boolean | Supplier confirmation lock |
| `manually_positioned` | boolean | User locked position |
| `is_hold_task` | boolean | Master hold task flag |
| `hold_reason_id` | bigint | FK to sm_hold_reasons |
| `trade` | varchar | Trade/category |
| `supplier_id` | bigint | FK to contacts |
| `purchase_order_id` | bigint | FK to purchase_orders |

#### sm_dependencies
Task relationships with dependency types.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `predecessor_task_id` | bigint | FK to sm_tasks |
| `successor_task_id` | bigint | FK to sm_tasks |
| `dependency_type` | varchar | FS, SS, FF, SF |
| `lag_days` | integer | Lag (positive) or lead (negative) |
| `active` | boolean | Soft delete flag |

#### sm_hold_reasons
Configurable dropdown for hold reasons.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `name` | varchar | Reason name |
| `color` | varchar | UI color |
| `icon` | varchar | Icon name |
| `sequence_order` | integer | Sort order |

**Default reasons:** WHS Incident, Weather, Permit Delay, Client Request, Material Shortage, Subcontractor Issue, Design Change, Other

### 2.2 Supporting Tables (Implemented)

| Table | Purpose |
|-------|---------|
| `sm_rollover_logs` | Audit trail for overnight rollover |
| `sm_spawn_logs` | Task spawning audit |
| `sm_hold_logs` | Hold activation/release audit |
| `sm_working_drawing_pages` | AI document categorization |
| `sm_settings` | System configuration |
| `sm_templates` | Schedule templates |
| `sm_schedule_master` | Template task definitions (formerly sm_template_rows) |

#### sm_schedule_master - Template Configuration Columns

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `auto_include` | boolean | true | If false, task is manually added only |
| `allow_duplicates` | boolean | false | Can add same task multiple times with numbering |
| `ai_select` | boolean | false | AI auto-selection for task |
| `plan_type_ids` | jsonb | [] | Plan types to attach to PO |
| `start_entity_tab_ids` | jsonb | [] | EntityTabs for docs sent on START |
| `complete_entity_tab_ids` | jsonb | [] | EntityTabs for docs received on COMPLETE |
| `photo_entity_tab_id` | bigint | null | EntityTab for photo storage |
| `linked_po_task_id` | integer | null | Parent task for PO hierarchy |
| `cost_centre` | string | null | BOQ category for PO filtering |
| `require_supplier_confirm` | boolean | false | Task needs supplier confirmation |
| `is_master` | boolean | false | Completing this auto-completes prior tasks |

### 2.3 Phase 2 Tables (Implemented but not in use)

| Table | Purpose |
|-------|---------|
| `sm_resources` | Labor, equipment, materials |
| `sm_resource_allocations` | Task assignments |
| `sm_time_entries` | Timesheet data |
| `sm_baselines` | Schedule snapshots |
| `sm_baseline_tasks` | Baseline task copies |

### 2.4 Phase 3 Tables (Implemented but not in use)

| Table | Purpose |
|-------|---------|
| `sm_task_photos` | Task photos with GPS |
| `sm_site_checkins` | GPS check-in/out |
| `sm_voice_notes` | Audio recordings |
| `sm_activities` | Activity feed |
| `sm_comments` | Task discussions |
| `sm_comment_mentions` | @mentions |
| `sm_notification_settings` | User notification prefs |

---

## 3. CURRENT IMPLEMENTATION

### 3.1 Frontend Components (Complete)

Located in `frontend-next/components/ui/gantt/`:

| File | Description |
|------|-------------|
| `index.tsx` | Main GanttChart component with exports |
| `context.tsx` | React context for Gantt state |
| `gantt-header.tsx` | Date/week/month headers |
| `gantt-sidebar.tsx` | Task list with grouping |
| `gantt-timeline.tsx` | Chart area with rows |
| `gantt-feature.tsx` | Task bar component |
| `gantt-dependencies.tsx` | SVG dependency arrows |
| `gantt-dependency-connector.tsx` | Drag to create dependencies |
| `gantt-today.tsx` | Today marker line |
| `gantt-marker.tsx` | Milestone markers |
| `gantt-controls.tsx` | Toolbar (zoom, fullscreen, view toggle) |
| `gantt-table-view.tsx` | List/table view |
| `gantt-cascade-modal.tsx` | Cascade resolution modal |
| `gantt-context-menu.tsx` | Right-click menu |
| `gantt-filter-panel.tsx` | Filter UI |
| `gantt-view-selector.tsx` | Group by options |
| `gantt-column-config.tsx` | Column visibility |

### 3.2 Pages (Complete)

| Route | File | Description |
|-------|------|-------------|
| `/gantt` | `app/(app)/gantt/page.tsx` | Standalone Gantt demo |
| `/jobs/[id]/gantt` | `app/(app)/jobs/[id]/gantt/page.tsx` | Job-specific Gantt |

### 3.3 Backend Models (Complete)

22 models in `backend/app/models/sm_*.rb`:
- SmTask, SmDependency, SmHoldReason, SmHoldLog
- SmRolloverLog, SmSpawnLog, SmWorkingDrawingPage
- SmResource, SmResourceAllocation, SmTimeEntry
- SmBaseline, SmBaselineTask
- SmTaskPhoto, SmSiteCheckin, SmVoiceNote
- SmActivity, SmComment, SmCommentMention
- SmNotificationSetting, SmSetting
- SmTemplate, SmScheduleMaster

### 3.4 What's Working

1. **Gantt Chart Rendering** - Visual chart with task bars
2. **Drag & Drop** - Move task bars to reschedule
3. **Dependency Lines** - SVG arrows between tasks
4. **Cascade Preview** - Modal shows affected tasks
5. **Table View** - Alternative list view
6. **Fullscreen Mode** - Expand to full screen
7. **Zoom Controls** - Day/Week/Month views

---

## 4. REMAINING WORK

### 4.1 Phase 1 Priorities (Core Gantt)

| Task | Effort | Priority |
|------|--------|----------|
| **API: Task CRUD** | 4h | HIGH |
| **API: Dependency CRUD** | 3h | HIGH |
| **SmCascadeService** | 6h | HIGH |
| **API: Cascade preview/execute** | 4h | HIGH |
| **Hold System UI** | 4h | HIGH |
| **SmRolloverJob** | 4h | MEDIUM |
| **Template Spawning** | 4h | MEDIUM |
| **PO Matching UI** | 3h | MEDIUM |

**Total Phase 1: ~32 hours**

### 4.2 Phase 2 (Resource Allocation)

| Task | Effort |
|------|--------|
| Resource CRUD API | 4h |
| Allocation API | 4h |
| Time Entry API | 4h |
| Resource Gantt UI | 8h |
| Timesheet UI | 6h |
| Dashboard/Reports | 6h |

**Total Phase 2: ~32 hours**

### 4.3 Phase 3 (Mobile & Field)

| Task | Effort |
|------|--------|
| Photo upload API | 4h |
| GPS check-in API | 3h |
| Voice notes API | 4h |
| Mobile field page | 8h |
| Offline sync | 6h |
| PWA setup | 4h |

**Total Phase 3: ~29 hours**

### 4.4 Phase 4 (AI & Analytics)

| Task | Effort |
|------|--------|
| Critical Path Service | 4h |
| EVM Calculations | 6h |
| AI Suggestions Service | 8h |
| Baseline Management | 4h |
| Analytics Dashboard | 6h |
| MS Project Import/Export | 8h |

**Total Phase 4: ~36 hours**

---

## 5. PHASE 1: CORE GANTT

### 5.1 API Endpoints Needed

```ruby
# Tasks
GET    /api/v1/jobs/:job_id/sm_tasks
POST   /api/v1/jobs/:job_id/sm_tasks
GET    /api/v1/sm_tasks/:id
PATCH  /api/v1/sm_tasks/:id
DELETE /api/v1/sm_tasks/:id
POST   /api/v1/sm_tasks/:id/start
POST   /api/v1/sm_tasks/:id/complete
POST   /api/v1/sm_tasks/:id/move

# Dependencies
GET    /api/v1/sm_tasks/:id/dependencies
POST   /api/v1/sm_tasks/:id/dependencies
DELETE /api/v1/sm_dependencies/:id

# Cascade
POST   /api/v1/sm_tasks/:id/cascade_preview
POST   /api/v1/sm_tasks/:id/cascade_execute

# Hold
POST   /api/v1/jobs/:job_id/sm_tasks/hold
POST   /api/v1/sm_tasks/:id/release_hold
```

### 5.2 SmCascadeService

Core logic for dependency cascade:

```ruby
class SmCascadeService
  LOCK_PRIORITY = {
    'supplier_confirm' => 1,
    'confirm' => 2,
    'started' => 3,
    'completed' => 4,
    'manually_positioned' => 5
  }.freeze

  def initialize(task, options = {})
    @task = task
    @calendar = WorkingDaysCalendar.new(task.job.company_setting)
  end

  def preview(new_start_date)
    {
      unlocked_successors: find_unlocked_successors,
      blocked_successors: find_blocked_successors
    }
  end

  def execute(resolutions)
    # Apply cascade based on user resolutions from modal
  end
end
```

### 5.3 SmRolloverJob

Nightly job to move past-due tasks:

```ruby
class SmRolloverJob < ApplicationJob
  queue_as :critical

  def perform
    settings = SmSetting.first
    return unless settings.rollover_enabled

    batch_id = SecureRandom.uuid

    # Find all past-due, incomplete tasks
    SmTask.past_due.find_each do |task|
      roll_task_forward(task, batch_id)
    end
  end

  private

  def roll_task_forward(task, batch_id)
    # Move to next working day
    # Log in sm_rollover_logs
    # Trigger cascade
  end
end
```

### 5.4 Confirmation Workflow

**Automatic for all PO tasks** (`po_required = true`):
1. **Unsure State** - Task dragged to date not following dependencies (yellow)
2. **Confirm** - User confirms date → notifies supplier (blue)
3. **Supplier Confirm** - Supplier confirms via email/text/UI (green)

**If supplier confirmed → skip ordering** (already arranged)

**Template Setting:** `require_supplier_confirm = true` enables supplier confirmation for task type

### 5.5 Master Task Cascade

When a task with `is_master = true` is completed:
1. Auto-complete all tasks BEFORE it in sequence
2. EXCEPT: Photo/scan tasks already in progress
3. Example: Scan signed contract → auto-completes "Customer Require Quote"

This allows milestone tasks to cascade completion backwards (things no longer needed).

### 5.6 Hold System

When activating hold:
1. Create Hold Task at position 1
2. Make all other tasks depend on Hold Task
3. Hold Task rolls forward daily
4. Notify suppliers with confirmed dates

When releasing hold:
1. Clear all dependencies on Hold Task
2. Clear all supplier confirms
3. Recalculate cascade from today
4. Mark Hold Task as completed

---

## 6. PHASE 2: RESOURCE ALLOCATION

### 6.1 Resource Types

| Type | Examples | Tracking |
|------|----------|----------|
| Labor | Carpenters, Electricians | Hours, rates |
| Equipment | Cranes, Scaffolding | Daily rates |
| Materials | Concrete, Timber | Quantities, costs |

### 6.2 Resource Gantt View

Separate view showing:
- Y-axis: Resources (not tasks)
- X-axis: Timeline
- Bars: When resource is allocated to which task

### 6.3 Timesheet Integration

- Daily time entry by resource
- Link to task being worked on
- Approval workflow
- Export to payroll

---

## 7. PHASE 3: MOBILE & FIELD

### 7.1 Field Worker Interface

Mobile-optimized page at `/jobs/:id/field`:
- Task list view
- Photo capture with camera
- GPS check-in with distance from site
- Voice note recording
- Offline queue with localStorage

### 7.2 PWA Features

- Service worker for offline
- Cache-first for static assets
- Network-first for API with fallback
- Push notifications

---

## 8. PHASE 4: AI & ANALYTICS

### 8.1 Critical Path Method (CPM)

Calculate longest path through project:
- Forward pass: earliest start/finish
- Backward pass: latest start/finish
- Float: slack time per task
- Critical tasks: zero float

### 8.2 Earned Value Management (EVM)

Core metrics:
- PV (Planned Value): Budgeted cost of work scheduled
- EV (Earned Value): Budgeted cost of work performed
- AC (Actual Cost): Actual cost of work performed

Derived metrics:
- SV (Schedule Variance) = EV - PV
- CV (Cost Variance) = EV - AC
- SPI (Schedule Performance Index) = EV / PV
- CPI (Cost Performance Index) = EV / AC

### 8.3 AI Suggestions

- Parallel opportunity detection
- Resource conflict detection
- Crash opportunity (compress duration)
- Fast-tracking suggestions
- Bottleneck identification
- Duration estimation from history

---

## 9. UI/UX SPECIFICATIONS

### 9.1 Lock Types & Visual Indicators

| Lock Type | Icon | Color | Unlock Option |
|-----------|------|-------|---------------|
| Supplier Confirmed | 🔒✓ | Green border | Clear supplier confirm |
| Confirmed | 🔒 | Blue border | Clear confirm |
| Started | ▶️ | Blue fill | Cannot unlock |
| Completed | ✓ | Green fill | Cannot unlock |
| Manually Positioned | 📌 | Gray border | Clear manual position |

### 9.2 Cascade Modal

Two views (user-toggleable):

**Kanban View:**
- Three columns: WILL CASCADE | WILL BREAK | LOCKED
- Drag tasks between columns
- Visual cards with dependency info

**Classic View:**
- Tree hierarchy showing dependency chain
- Checkboxes for cascade decisions
- Expandable nested structure

### 9.3 Task States

| State | Color | Behavior |
|-------|-------|----------|
| Not Started | Gray | Normal cascade |
| Started | Blue | Drops predecessor deps |
| Completed | Green (hidden by default) | Drops all deps |
| Confirm Requested | Orange | Awaiting supplier |
| Moved After Confirm | Checkered | Visual indicator |

---

## 10. API REFERENCE

### 10.1 Response Format

```json
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": "Error message"
}
```

### 10.2 Task Response

```json
{
  "id": 123,
  "job_id": 45,
  "name": "Frame Walls",
  "start_date": "2025-06-15",
  "end_date": "2025-06-20",
  "duration_days": 5,
  "status": "not_started",
  "confirm": false,
  "supplier_confirm": false,
  "manually_positioned": false,
  "trade": "carpenter",
  "supplier": { "id": 10, "name": "ABC Carpentry" },
  "dependencies": [
    { "id": 1, "predecessor_id": 122, "type": "FS", "lag": 0 }
  ]
}
```

### 10.3 Cascade Preview Response

```json
{
  "success": true,
  "data": {
    "source_task": { ... },
    "unlocked_successors": [
      { "id": 124, "name": "Windows", "current_start": "...", "new_start": "..." }
    ],
    "blocked_successors": [
      { "id": 125, "name": "Roof", "lock_type": "supplier_confirm" }
    ]
  }
}
```

---

## 11. IMPLEMENTATION CHECKLIST

### Phase 1: Core Gantt (Priority: NOW)

#### Backend
- [ ] Create `SmTasksController` with full CRUD
- [ ] Create `SmDependenciesController`
- [ ] Implement `SmCascadeService`
- [ ] Add cascade preview/execute endpoints
- [ ] Create `SmHoldService`
- [ ] Add hold/release endpoints
- [ ] Implement `SmRolloverJob`
- [ ] Add to Solid Queue recurring.yml
- [ ] Create template spawning service

#### Frontend
- [ ] Connect GanttChart to API (replace mock data)
- [ ] Implement task create/edit modal
- [ ] Add PO matching UI
- [ ] Add hold button and modal
- [ ] Add release hold modal
- [ ] Show hold status in controls

### Phase 2: Resources (Next)

- [ ] SmResourcesController
- [ ] SmResourceAllocationsController
- [ ] SmTimeEntriesController
- [ ] Resource Gantt view component
- [ ] Timesheet page
- [ ] Dashboard stats cards

### Phase 3: Mobile (Later)

- [ ] SmFieldController
- [ ] Photo upload with Cloudinary
- [ ] GPS check-in logic
- [ ] Voice note upload
- [ ] Mobile field page
- [ ] Offline sync logic
- [ ] PWA manifest and service worker

### Phase 4: AI & Analytics (Future)

- [ ] SmCriticalPathService
- [ ] SmEvmService
- [ ] SmAiService
- [ ] SmMsProjectService
- [ ] Analytics dashboard page
- [ ] Baseline management UI

---

## QUICK START

### To Continue Development

1. **Read this document** - You now have full context
2. **Check existing code:**
   - Models: `backend/app/models/sm_*.rb`
   - Components: `frontend-next/components/ui/gantt/`
   - Pages: `frontend-next/app/(app)/gantt/`, `frontend-next/app/(app)/jobs/[id]/gantt/`
3. **Start with Phase 1 Backend** - API endpoints are the critical path
4. **Use existing patterns** - Follow TEEEM conventions from CLAUDE.md

### Key Files to Reference

| File | Purpose |
|------|---------|
| `backend/app/models/sm_task.rb` | Task model with all associations |
| `frontend-next/components/ui/gantt/index.tsx` | Main Gantt component |
| `frontend-next/components/ui/gantt/gantt-cascade-modal.tsx` | Cascade resolution |
| `TEEEM_DOCS/GOLD_STANDARD_TABLE.md` | Column types for tables |

---

## NOTES

- **SSoT:** This document supersedes archived docs
- **Bible Rules:** Trinity Chapter 9 contains Gantt-specific rules
- **Testing:** Use `/gantt` bug hunter agent for diagnostics
- **Dependencies:** dnd-kit for drag-and-drop, date-fns for dates

---

*Generated: 2025-12-21 | Last Updated: 2025-12-21*
