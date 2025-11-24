# 🏗️ TRAPID SM GANTT - COMPREHENSIVE ARCHITECTURE PLAN

**Version:** 2.0
**Date:** 2025-11-22
**Status:** Ready for Implementation
**Estimated Timeline:** 14 weeks (Phase 1) + Phase 2 (Resource Allocation)

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Core Requirements](#1-core-requirements-summary)
3. [Database Schema](#2-database-schema)
4. [Hold Task System](#3-hold-task-system)
5. [API Design](#4-api-design)
6. [Frontend Architecture](#5-frontend-architecture)
7. [Cascade & Dependency Engine](#6-cascade--dependency-engine)
8. [Cascade Modal System](#7-cascade-modal-system)
9. [Rollover Automation System](#8-rollover-automation-system)
10. [Supplier Workflow Integration](#9-supplier-workflow-integration)
11. [Task Spawning System](#10-task-spawning-system)
12. [Working Drawings AI System](#11-working-drawings-ai-system)
13. [System Integrations](#12-system-integrations)
14. [Navigation & Setup](#13-navigation--setup)
15. [Reusable Services](#14-reusable-services)
16. [Implementation Roadmap - Phase 1](#15-implementation-roadmap---phase-1)
17. [Phase 2: Resource Allocation & Timesheet](#16-phase-2-resource-allocation--timesheet)
18. [Technology Stack](#17-technology-stack)
19. [Key Design Decisions](#18-key-design-decisions)

---

## EXECUTIVE SUMMARY

This architecture plan defines a **completely new** construction-specific Gantt chart system (SM Gantt) that runs **alongside** the existing DHTMLX implementation. The system uses isolated `sm_` prefixed tables and is built with React + Tailwind for full customization.

### Key Differentiators from Existing System

| Aspect | Existing (DHTMLX) | New (SM Gantt) |
|--------|-------------------|----------------|
| Tables | `schedule_tasks`, `schedule_template_rows` | `sm_tasks`, `sm_dependencies`, etc. |
| Dependencies | JSONB `predecessor_ids` array | Separate `sm_dependencies` table |
| Dates | Day offsets (integer) | Actual DATE type |
| Frontend | DHTMLX library | React + custom Tailwind components |
| Cascade Modal | Existing Kanban/Classic | Enhanced Kanban + Classic toggle |

### Key Capabilities

- **Unlimited task hierarchy** with 4 dependency types (FS, SS, FF, SF) + lag time
- **Hold Task System** - Master blocker with audit trail
- **Supplier confirmation workflow** with cascade conflict resolution
- **Automated midnight rollover** preventing past-due tasks
- **Cross-job dependencies** and filtered multi-job views
- **Comprehensive Cascade Modal** - Kanban + Classic views with 5 lock types
- **Task spawning** (photos, scans, inspections, office tasks)
- **AI-powered working drawings** page separation
- **Resource Allocation Gantt** (Phase 2) - People, Equipment, Materials
- **Integrated Timesheet System** (Phase 2)
- **Mobile-responsive** with touch drag and photo capture

### Project Goals

1. **Isolation:** Completely separate from existing system for safe development
2. **Flexibility:** React + Tailwind for full UI control
3. **Construction-Specific:** Workflows tailored to residential building
4. **Scalability:** Handle 100-500 tasks per job, multiple jobs
5. **Future-Ready:** Schema designed for Phase 2 Resource Allocation

---

## 1. CORE REQUIREMENTS SUMMARY

### 1.1 Use Cases

**Primary Use Case:**
Manage actual job schedules (sm_tasks) for residential properties with real calendar dates.

**Secondary Use Case:**
Template management with default SM template accessible from sidebar.

### 1.2 Task Hierarchy

- **Unlimited nesting:** Parent → Child → Grandchild → ...
- **Independent rollover:** Each task rolls independently based on own dates
- **Organizational only:** Hierarchy for display, not cascade constraints

### 1.3 Dependency Types

| Type | Name | Calculation | Example |
|------|------|-------------|---------|
| **FS** | Finish-to-Start | Task 2 starts when Task 1 finishes | Pour concrete → Remove formwork |
| **SS** | Start-to-Start | Task 2 starts when Task 1 starts | Electrical rough-in ‖ Plumbing rough-in |
| **FF** | Finish-to-Finish | Task 2 finishes when Task 1 finishes | Final cleanup ‖ Final inspection |
| **SF** | Start-to-Finish | Task 2 finishes when Task 1 starts | (Rare in construction) |

**Lag Time:**
- **Positive lag:** Task 2 starts X working days AFTER Task 1 (FS+3)
- **Negative lag (lead):** Task 2 starts X working days BEFORE Task 1 (FS-3)
- **Always working days:** Respects company calendar (weekends, holidays)

### 1.4 Cross-Job Dependencies

- Tasks in Job A can depend on tasks in Job B
- Cascade propagates across job boundaries
- **Automated rollover:** Cascades across jobs automatically
- **Manual cascade:** User confirmation required before crossing jobs

### 1.5 Working Days & Calendar

**Company Settings (Reuse existing):**
- Configurable working days (Monday-Sunday checkboxes)
- Company timezone for rollover timing
- Regional public holidays (3-year range)

**Duration Calculation:**
- Duration = X working days (skips weekends & holidays)
- Example: Duration 5 days, Mon start, Thu holiday → ends Tue (7 calendar days)

### 1.6 Task Types

#### Schedule Master Tasks
- From template (applied to construction)
- Start WITH dependencies
- Auto-cascade
- Rollover active

#### Manual / Requisition Tasks
- User creates ad-hoc
- Start WITHOUT dependencies
- CAN add dependencies later
- Rollover active
- Example: "Req Pay for damaged fence"

#### Hold Task (Special)
- Master blocker at position 1
- All other tasks depend on it
- See Section 3 for full details

### 1.7 Task States & Lock Hierarchy

| State | Behavior | Visual | Cascade | Lock Priority |
|-------|----------|--------|---------|---------------|
| **Not Started** | Scheduled, not begun | Normal color | Cascades normally | - |
| **Started** | Work in progress | Blue/active | Drops predecessor deps, keeps successor deps | 3 |
| **Completed** | Finished | Green (hidden by default) | Drops ALL dependencies | 4 |
| **Confirmed** | Internal confirmation | Different color | BLOCKS cascade | 2 |
| **Supplier Confirmed** | Supplier committed | Green border | BLOCKS cascade (highest) | 1 |
| **Manually Positioned** | User locked position | Lock icon | Cascade clears status | 5 |
| **Confirm Requested** | Awaiting supplier | Orange | Cascade moves + marks checkered | - |
| **Moved After Confirm** | Was confirmed but moved | Checkered pattern | N/A (visual indicator) | - |

**Lock Hierarchy (highest to lowest):**
1. `supplier_confirm` - Strongest lock
2. `confirm` - Internal confirmation
3. `start` - Task started
4. `complete` - Task completed
5. `manually_positioned` - User locked

### 1.8 Data Scale

- **Typical:** 100-500 tasks per job
- **Jobs:** Multiple jobs per construction
- **Views:** Filtered multi-job views
- **Performance:** Virtualization/lazy loading required

---

## 2. DATABASE SCHEMA

### 2.1 sm_tasks (Job Task Instances)

```sql
CREATE TABLE sm_tasks (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Foreign Keys
  construction_id BIGINT NOT NULL REFERENCES constructions(id) ON DELETE CASCADE,
  template_row_id BIGINT REFERENCES schedule_template_rows(id) ON DELETE SET NULL,
  parent_task_id BIGINT REFERENCES sm_tasks(id) ON DELETE SET NULL,

  -- Identification
  task_number INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Hierarchy & Ordering
  sequence_order DECIMAL(10,2) NOT NULL,

  -- Scheduling (ACTUAL DATES - not offsets)
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_days INTEGER NOT NULL,

  -- Status & Workflow
  status VARCHAR(50) NOT NULL DEFAULT 'not_started',
  -- Enum: 'not_started', 'started', 'completed'
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  passed BOOLEAN,
  -- For pass/fail inspections (nullable)

  -- Lock Fields (cascade blockers)
  confirm BOOLEAN DEFAULT FALSE,
  supplier_confirm BOOLEAN DEFAULT FALSE,
  manually_positioned BOOLEAN DEFAULT FALSE,
  manually_positioned_at TIMESTAMP,

  -- Supplier Workflow
  confirm_status VARCHAR(50),
  -- Enum: NULL, 'confirm_requested', 'supplier_confirmed', 'moved_after_confirm'
  confirm_requested_at TIMESTAMP,
  supplier_confirmed_at TIMESTAMP,
  supplier_confirmed_by BIGINT REFERENCES users(id),

  -- Hold Task Fields (see Section 3)
  is_hold_task BOOLEAN DEFAULT FALSE,
  hold_reason_id BIGINT REFERENCES sm_hold_reasons(id),
  hold_started_at TIMESTAMP,
  hold_started_by BIGINT REFERENCES users(id),
  hold_released_at TIMESTAMP,
  hold_released_by BIGINT REFERENCES users(id),
  hold_release_reason TEXT,

  -- Cost & Resources
  purchase_order_id BIGINT REFERENCES purchase_orders(id) ON DELETE SET NULL,
  assigned_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  supplier_id BIGINT REFERENCES contacts(id) ON DELETE SET NULL,
  trade VARCHAR(100),
  stage VARCHAR(100),

  -- Documentation Integration
  documentation_category_ids INTEGER[] DEFAULT '{}',
  show_in_docs_tab BOOLEAN DEFAULT FALSE,

  -- Linked Requirements
  linked_task_ids JSONB DEFAULT '[]'::jsonb,

  -- Task Spawning Configuration
  spawn_photo_task BOOLEAN DEFAULT FALSE,
  spawn_scan_task BOOLEAN DEFAULT FALSE,
  spawn_office_tasks JSONB DEFAULT '[]'::jsonb,
  pass_fail_enabled BOOLEAN DEFAULT FALSE,
  checklist_id BIGINT REFERENCES supervisor_checklist_templates(id) ON DELETE SET NULL,

  -- Reminders
  order_time_days INTEGER,
  call_time_days INTEGER,
  order_reminder_sent BOOLEAN DEFAULT FALSE,
  call_reminder_sent BOOLEAN DEFAULT FALSE,

  -- Requirements Flags
  require_photo BOOLEAN DEFAULT FALSE,
  require_certificate BOOLEAN DEFAULT FALSE,
  require_supervisor_check BOOLEAN DEFAULT FALSE,
  po_required BOOLEAN DEFAULT FALSE,
  critical_po BOOLEAN DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by BIGINT REFERENCES users(id),
  updated_by BIGINT REFERENCES users(id),

  CONSTRAINT sm_tasks_pkey PRIMARY KEY (id)
);

-- Indexes
CREATE INDEX idx_sm_tasks_construction_id ON sm_tasks(construction_id);
CREATE INDEX idx_sm_tasks_status ON sm_tasks(status);
CREATE INDEX idx_sm_tasks_start_date ON sm_tasks(start_date);
CREATE INDEX idx_sm_tasks_parent_task ON sm_tasks(parent_task_id);
CREATE INDEX idx_sm_tasks_sequence_order ON sm_tasks(sequence_order);
CREATE INDEX idx_sm_tasks_trade ON sm_tasks(trade);
CREATE INDEX idx_sm_tasks_confirm_status ON sm_tasks(confirm_status);
CREATE INDEX idx_sm_tasks_po ON sm_tasks(purchase_order_id);
CREATE INDEX idx_sm_tasks_is_hold ON sm_tasks(is_hold_task) WHERE is_hold_task = TRUE;
CREATE INDEX idx_sm_tasks_supplier ON sm_tasks(supplier_id);
```

### 2.2 sm_dependencies (Separate Table)

```sql
CREATE TABLE sm_dependencies (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Foreign Keys
  predecessor_task_id BIGINT NOT NULL REFERENCES sm_tasks(id) ON DELETE CASCADE,
  successor_task_id BIGINT NOT NULL REFERENCES sm_tasks(id) ON DELETE CASCADE,

  -- Dependency Configuration
  dependency_type VARCHAR(10) NOT NULL,
  -- Enum: 'FS', 'SS', 'FF', 'SF'
  lag_days INTEGER NOT NULL DEFAULT 0,
  -- Can be negative for lead time

  -- Lifecycle Tracking
  active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMP,
  deleted_by_rollover BOOLEAN DEFAULT FALSE,
  deleted_reason VARCHAR(100),
  -- Enum: 'rollover', 'user_manual', 'cascade_conflict', 'task_started', 'task_completed', 'hold_released'

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by BIGINT REFERENCES users(id),
  deleted_by BIGINT REFERENCES users(id),

  -- Constraints
  CONSTRAINT sm_dependencies_pkey PRIMARY KEY (id),
  CONSTRAINT no_self_dependency CHECK (predecessor_task_id != successor_task_id)
);

-- Indexes
CREATE INDEX idx_sm_dependencies_predecessor ON sm_dependencies(predecessor_task_id) WHERE active = TRUE;
CREATE INDEX idx_sm_dependencies_successor ON sm_dependencies(successor_task_id) WHERE active = TRUE;
CREATE INDEX idx_sm_dependencies_active ON sm_dependencies(active);
CREATE UNIQUE INDEX idx_sm_dependencies_unique_active ON sm_dependencies(predecessor_task_id, successor_task_id) WHERE active = TRUE;
```

### 2.3 sm_rollover_logs

```sql
CREATE TABLE sm_rollover_logs (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Batch Identification
  rollover_batch_id UUID NOT NULL,
  rollover_timestamp TIMESTAMP NOT NULL,

  -- Task Changes
  task_id BIGINT NOT NULL REFERENCES sm_tasks(id) ON DELETE CASCADE,
  old_start_date DATE,
  new_start_date DATE,
  old_end_date DATE,
  new_end_date DATE,

  -- Dependency Deletions
  deleted_dependencies JSONB DEFAULT '[]'::jsonb,

  -- Status Changes
  confirm_status_change VARCHAR(255),
  hold_cleared BOOLEAN DEFAULT FALSE,
  supplier_confirms_cleared INTEGER DEFAULT 0,

  -- Metadata
  construction_id BIGINT NOT NULL REFERENCES constructions(id) ON DELETE CASCADE,
  cascade_depth INTEGER,
  cross_job_cascade BOOLEAN DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sm_rollover_logs_batch ON sm_rollover_logs(rollover_batch_id);
CREATE INDEX idx_sm_rollover_logs_task ON sm_rollover_logs(task_id);
CREATE INDEX idx_sm_rollover_logs_construction ON sm_rollover_logs(construction_id);
CREATE INDEX idx_sm_rollover_logs_timestamp ON sm_rollover_logs(rollover_timestamp);
```

### 2.4 sm_spawn_logs

```sql
CREATE TABLE sm_spawn_logs (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Foreign Keys
  parent_task_id BIGINT NOT NULL REFERENCES sm_tasks(id) ON DELETE CASCADE,
  spawned_task_id BIGINT NOT NULL REFERENCES sm_tasks(id) ON DELETE CASCADE,

  -- Spawn Configuration
  spawn_type VARCHAR(50) NOT NULL,
  -- Enum: 'photo', 'scan', 'office', 'inspection_retry'
  spawn_trigger VARCHAR(50) NOT NULL,
  -- Enum: 'parent_complete', 'inspection_fail'

  -- Audit
  spawned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  spawned_by BIGINT REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_sm_spawn_logs_parent ON sm_spawn_logs(parent_task_id);
CREATE INDEX idx_sm_spawn_logs_spawned ON sm_spawn_logs(spawned_task_id);
CREATE INDEX idx_sm_spawn_logs_type ON sm_spawn_logs(spawn_type);
```

### 2.5 sm_hold_reasons (Configurable Dropdown)

```sql
CREATE TABLE sm_hold_reasons (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Configuration
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(20) DEFAULT '#EF4444',
  icon VARCHAR(50) DEFAULT 'pause',
  sequence_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT sm_hold_reasons_name_unique UNIQUE (name)
);

-- Seed default reasons
INSERT INTO sm_hold_reasons (name, description, sequence_order) VALUES
  ('WHS Incident', 'Workplace health and safety incident on site', 1),
  ('Weather', 'Adverse weather conditions preventing work', 2),
  ('Permit Delay', 'Waiting for council or building permits', 3),
  ('Client Request', 'Client requested hold on works', 4),
  ('Material Shortage', 'Critical materials unavailable', 5),
  ('Subcontractor Issue', 'Subcontractor unable to proceed', 6),
  ('Design Change', 'Awaiting design changes or approvals', 7),
  ('Other', 'Other reason (specify in release notes)', 8);
```

### 2.6 sm_hold_logs (Audit Trail)

```sql
CREATE TABLE sm_hold_logs (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Foreign Keys
  construction_id BIGINT NOT NULL REFERENCES constructions(id) ON DELETE CASCADE,
  hold_task_id BIGINT NOT NULL REFERENCES sm_tasks(id) ON DELETE CASCADE,
  hold_reason_id BIGINT REFERENCES sm_hold_reasons(id),

  -- Hold Event
  event_type VARCHAR(20) NOT NULL,
  -- Enum: 'hold_started', 'hold_released'

  -- Hold Start Details
  hold_started_at TIMESTAMP,
  hold_started_by BIGINT REFERENCES users(id),

  -- Hold Release Details
  hold_released_at TIMESTAMP,
  hold_released_by BIGINT REFERENCES users(id),
  hold_release_reason TEXT,

  -- Impact Tracking
  supplier_confirms_cleared INTEGER DEFAULT 0,
  dependencies_cleared INTEGER DEFAULT 0,
  tasks_affected INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sm_hold_logs_construction ON sm_hold_logs(construction_id);
CREATE INDEX idx_sm_hold_logs_task ON sm_hold_logs(hold_task_id);
CREATE INDEX idx_sm_hold_logs_event ON sm_hold_logs(event_type);
```

### 2.7 sm_working_drawing_pages

```sql
CREATE TABLE sm_working_drawing_pages (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Foreign Keys
  task_id BIGINT NOT NULL REFERENCES sm_tasks(id) ON DELETE CASCADE,

  -- Page Information
  page_number INTEGER NOT NULL,
  image_url TEXT NOT NULL,

  -- AI Categorization
  category VARCHAR(100) NOT NULL,
  ai_confidence DECIMAL(5,4),

  -- Manual Override
  category_overridden BOOLEAN DEFAULT FALSE,
  manual_category VARCHAR(100),

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sm_working_drawing_pages_task ON sm_working_drawing_pages(task_id);
CREATE INDEX idx_sm_working_drawing_pages_category ON sm_working_drawing_pages(category);
```

### 2.8 sm_settings (System Admin Configuration)

```sql
CREATE TABLE sm_settings (
  -- Primary Key
  id BIGSERIAL PRIMARY KEY,

  -- Rollover Settings
  rollover_time TIME NOT NULL DEFAULT '00:00:00',
  rollover_timezone VARCHAR(50) NOT NULL DEFAULT 'Australia/Brisbane',
  rollover_enabled BOOLEAN DEFAULT TRUE,

  -- Notification Settings
  notify_on_hold BOOLEAN DEFAULT TRUE,
  notify_on_supplier_confirm BOOLEAN DEFAULT TRUE,
  notify_on_rollover BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Singleton pattern - only one row
INSERT INTO sm_settings (id) VALUES (1);
```

### 2.9 Phase 2 Tables (Resource Allocation - Schema Only)

```sql
-- Resources (People, Equipment, Materials)
CREATE TABLE sm_resources (
  id BIGSERIAL PRIMARY KEY,

  -- Type
  resource_type VARCHAR(20) NOT NULL,
  -- Enum: 'person', 'equipment', 'material'

  -- Identity
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,

  -- For People
  user_id BIGINT REFERENCES users(id),
  contact_id BIGINT REFERENCES contacts(id),
  trade VARCHAR(100),
  hourly_rate DECIMAL(10,2),

  -- For Equipment
  asset_id BIGINT REFERENCES assets(id),
  daily_rate DECIMAL(10,2),

  -- For Materials
  unit VARCHAR(50),
  unit_cost DECIMAL(10,2),

  -- Availability
  is_active BOOLEAN DEFAULT TRUE,
  availability_hours_per_day DECIMAL(4,2) DEFAULT 8.0,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Resource Allocations (linking resources to tasks)
CREATE TABLE sm_resource_allocations (
  id BIGSERIAL PRIMARY KEY,

  -- Foreign Keys
  task_id BIGINT NOT NULL REFERENCES sm_tasks(id) ON DELETE CASCADE,
  resource_id BIGINT NOT NULL REFERENCES sm_resources(id) ON DELETE CASCADE,

  -- Allocation Details
  allocated_hours DECIMAL(10,2),
  allocated_quantity DECIMAL(10,2),
  allocation_date DATE,

  -- Status
  status VARCHAR(20) DEFAULT 'planned',
  -- Enum: 'planned', 'confirmed', 'in_progress', 'completed'

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Time Entries (actual time tracking)
CREATE TABLE sm_time_entries (
  id BIGSERIAL PRIMARY KEY,

  -- Foreign Keys
  task_id BIGINT NOT NULL REFERENCES sm_tasks(id) ON DELETE CASCADE,
  resource_id BIGINT NOT NULL REFERENCES sm_resources(id) ON DELETE CASCADE,
  allocation_id BIGINT REFERENCES sm_resource_allocations(id),

  -- Time Details
  entry_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  break_minutes INTEGER DEFAULT 0,
  total_hours DECIMAL(10,2) NOT NULL,

  -- Classification
  entry_type VARCHAR(20) DEFAULT 'regular',
  -- Enum: 'regular', 'overtime', 'travel', 'standby'

  -- Notes
  description TEXT,

  -- Approval
  approved_by BIGINT REFERENCES users(id),
  approved_at TIMESTAMP,

  -- Audit
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for Phase 2 tables
CREATE INDEX idx_sm_resources_type ON sm_resources(resource_type);
CREATE INDEX idx_sm_resources_user ON sm_resources(user_id);
CREATE INDEX idx_sm_resource_allocations_task ON sm_resource_allocations(task_id);
CREATE INDEX idx_sm_resource_allocations_resource ON sm_resource_allocations(resource_id);
CREATE INDEX idx_sm_time_entries_task ON sm_time_entries(task_id);
CREATE INDEX idx_sm_time_entries_resource ON sm_time_entries(resource_id);
CREATE INDEX idx_sm_time_entries_date ON sm_time_entries(entry_date);
```

---

## 3. HOLD TASK SYSTEM

### 3.1 Overview

The Hold Task is a **master blocker** that freezes the entire job schedule. When activated:

1. **Auto-inserts at position 1** - becomes the first task
2. **All other tasks become successors** - everything depends on Hold Task
3. **Rollover continues** - Hold Task moves forward daily like any other task
4. **Supplier notifications sent** - suppliers with confirmed tasks are notified
5. **Manual tasks allowed** - user can still create ad-hoc tasks during hold

### 3.2 Hold Activation Flow

```
User clicks "Hold Job" button
         ↓
Select Hold Reason (dropdown)
         ↓
System creates Hold Task at position 1
         ↓
All non-completed tasks become successors of Hold Task
         ↓
Notifications sent to confirmed suppliers
         ↓
Hold Task rolls forward daily via rollover
         ↓
All other tasks cascade from Hold Task date
```

### 3.3 Hold Release Flow

```
User clicks "Release Hold" button
         ↓
Dependencies on Hold Task are cleared
         ↓
All Supplier Confirms are cleared
         ↓
All task holds are cleared
         ↓
Tasks fall back to today (since Hold was rolling forward)
         ↓
Cascade recalculates all dates
         ↓
Hold release logged with free-text reason
         ↓
Hold Task marked as completed
```

### 3.4 Hold Task API

#### POST /api/v1/constructions/:id/sm_tasks/hold

**Description:** Activate job hold

**Request Body:**
```json
{
  "hold_reason_id": 1,
  "notify_suppliers": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hold_task": { "id": 1, "name": "JOB ON HOLD - WHS Incident", ... },
    "tasks_affected": 45,
    "suppliers_notified": 3
  }
}
```

#### POST /api/v1/sm_tasks/:id/release_hold

**Description:** Release job hold

**Request Body:**
```json
{
  "release_reason": "WHS investigation completed, site cleared for work"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hold_task": { "id": 1, "status": "completed", ... },
    "supplier_confirms_cleared": 5,
    "dependencies_cleared": 45,
    "cascade_result": { ... }
  }
}
```

---

## 4. API DESIGN

### 4.1 Core Task Endpoints

#### GET /api/v1/constructions/:construction_id/sm_tasks

**Description:** Fetch all SM tasks for a construction

**Query Parameters:**
- `include_completed` (boolean, default: false)
- `trade` (string)
- `status` (string)
- `view_mode` (string) - hierarchy | supplier | trade | flat

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "construction_id": 45,
      "name": "Frame Walls",
      "start_date": "2025-06-15",
      "end_date": "2025-06-20",
      "duration_days": 5,
      "status": "not_started",
      "confirm": false,
      "supplier_confirm": false,
      "manually_positioned": false,
      "confirm_status": null,
      "trade": "carpenter",
      "supplier": { "id": 10, "name": "ABC Carpentry" },
      "assigned_user": { "id": 10, "name": "John Smith" },
      "dependencies": [
        { "id": 1, "predecessor_id": 122, "type": "FS", "lag": 0 }
      ],
      "children": [],
      "is_hold_task": false
    }
  ],
  "hold_active": false,
  "hold_task": null
}
```

#### POST /api/v1/constructions/:construction_id/sm_tasks

**Description:** Create new SM task

**Request Body:**
```json
{
  "name": "Req Pay for damaged fence",
  "start_date": "2025-06-15",
  "duration_days": 1,
  "trade": "office",
  "is_manual": true
}
```

#### PATCH /api/v1/sm_tasks/:id

**Description:** Update SM task

**Request Body:**
```json
{
  "start_date": "2025-06-20",
  "trigger_cascade": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "task": { "id": 123, "start_date": "2025-06-20", ... },
    "cascade_preview": {
      "affected_tasks": 5,
      "unlocked_successors": [...],
      "blocked_successors": [...]
    }
  }
}
```

### 4.2 Dependency Endpoints

#### GET /api/v1/sm_tasks/:id/dependencies

#### POST /api/v1/sm_tasks/:id/dependencies

**Request Body:**
```json
{
  "predecessor_id": 122,
  "dependency_type": "FS",
  "lag_days": 2
}
```

#### DELETE /api/v1/sm_dependencies/:id

### 4.3 Cascade Endpoints

#### POST /api/v1/sm_tasks/:id/cascade

**Description:** Execute cascade with conflict resolutions

**Request Body:**
```json
{
  "tasks_to_cascade": [124, 125, 126],
  "tasks_to_break": [127],
  "tasks_to_unlock": [128]
}
```

### 4.4 Supplier Workflow Endpoints

#### POST /api/v1/sm_tasks/:id/request_confirm
#### POST /api/v1/sm_tasks/:id/supplier_confirm
#### POST /api/v1/sm_tasks/:id/clear_supplier_confirm

### 4.5 Task Completion Endpoints

#### POST /api/v1/sm_tasks/:id/start
#### POST /api/v1/sm_tasks/:id/complete

### 4.6 Rollover Endpoints

#### POST /api/v1/sm_rollover/execute
#### GET /api/v1/sm_rollover/audit

### 4.7 Settings Endpoints

#### GET /api/v1/sm_settings
#### PATCH /api/v1/sm_settings
#### GET /api/v1/sm_hold_reasons
#### POST /api/v1/sm_hold_reasons
#### PATCH /api/v1/sm_hold_reasons/:id
#### DELETE /api/v1/sm_hold_reasons/:id

---

## 5. FRONTEND ARCHITECTURE

### 5.1 Component Structure

```
src/components/sm-gantt/
├── SMGanttView.jsx                  # Main container
├── SMGanttToolbar.jsx               # View toggles, filters, hold button
├── SMGanttGrid.jsx                  # Task list (left side)
│   ├── SMGanttRow.jsx               # Single task row
│   ├── SMGanttCell.jsx              # Individual cells (inline edit)
│   └── SMGanttCheckbox.jsx          # Lock checkboxes
├── SMGanttTimeline.jsx              # Chart area (right side)
│   ├── SMGanttBar.jsx               # Task bars (Tailwind styled)
│   ├── SMDependencyLine.jsx         # Dependency arrows (SVG)
│   └── SMGanttTooltip.jsx           # Hover tooltips
├── modals/
│   ├── SMCascadeModal.jsx           # Main cascade modal container
│   ├── SMCascadeKanban.jsx          # Kanban view (3 zones)
│   ├── SMCascadeClassic.jsx         # Classic tree view
│   ├── SMTaskCardNode.jsx           # Draggable task card
│   ├── SMHoldModal.jsx              # Hold activation modal
│   ├── SMReleaseHoldModal.jsx       # Hold release modal
│   ├── SMTaskEditModal.jsx          # Full task editor
│   ├── SMDependencyEditor.jsx       # Add/edit dependencies
│   └── SMCompleteTaskModal.jsx      # Task completion
├── panels/
│   ├── SMFilterPanel.jsx            # Search & filter UI
│   ├── SMColumnConfig.jsx           # Show/hide columns
│   └── SMViewSelector.jsx           # Hierarchy / Supplier / Trade / Flat
├── hooks/
│   ├── useSMGanttData.js            # Data fetching & caching
│   ├── useSMCascade.js              # Cascade calculation logic
│   ├── useSMRollover.js             # Rollover status & triggers
│   ├── useSMWorkingDays.js          # Calendar calculations
│   └── useSMHold.js                 # Hold task management
└── stores/
    └── smGanttStore.js              # Zustand state management
```

### 5.2 State Management (Zustand)

```javascript
// src/stores/smGanttStore.js

import { create } from 'zustand'

export const useSMGanttStore = create((set, get) => ({
  // Data
  tasks: new Map(),
  dependencies: new Map(),
  holdTask: null,
  holdActive: false,

  // UI State
  viewMode: 'hierarchy', // 'hierarchy' | 'supplier' | 'trade' | 'flat'
  cascadeModalView: 'kanban', // 'kanban' | 'classic'
  filters: {
    trade: null,
    status: null,
    search: ''
  },
  visibleColumns: {
    taskNumber: true,
    taskName: true,
    predecessors: true,
    supplier: true,
    duration: true,
    confirm: true,
    supplierConfirm: true,
    start: true,
    complete: true,
    lock: true
  },
  selection: new Set(),

  // Undo/Redo
  undoStack: [],
  redoStack: [],

  // Actions
  setTasks: (tasks) => set({ tasks: new Map(tasks.map(t => [t.id, t])) }),

  updateTask: (taskId, updates) => set(state => {
    const oldTask = state.tasks.get(taskId)
    const newUndoStack = [...state.undoStack, { type: 'update', task: { ...oldTask } }]
    const newTasks = new Map(state.tasks)
    newTasks.set(taskId, { ...oldTask, ...updates })
    return { tasks: newTasks, undoStack: newUndoStack, redoStack: [] }
  }),

  undo: () => set(state => {
    if (state.undoStack.length === 0) return state
    const action = state.undoStack[state.undoStack.length - 1]
    const newUndoStack = state.undoStack.slice(0, -1)
    const newRedoStack = [...state.redoStack, action]
    const newTasks = new Map(state.tasks)
    if (action.type === 'update') {
      newTasks.set(action.task.id, action.task)
    }
    return { tasks: newTasks, undoStack: newUndoStack, redoStack: newRedoStack }
  }),

  setViewMode: (mode) => set({ viewMode: mode }),
  setCascadeModalView: (view) => set({ cascadeModalView: view }),
  setFilters: (filters) => set({ filters }),
  toggleColumn: (column) => set(state => ({
    visibleColumns: { ...state.visibleColumns, [column]: !state.visibleColumns[column] }
  })),

  // Hold actions
  setHoldActive: (active, holdTask) => set({ holdActive: active, holdTask }),
}))
```

### 5.3 Mobile Responsive Strategy

**Breakpoints:**
- Desktop: ≥ 1920px (Grid 40%, Timeline 60%)
- Laptop: ≥ 1366px (Grid 35%, Timeline 65%)
- Tablet: ≥ 768px (Grid 30%, Timeline 70%)
- Mobile: < 768px (Tabs: [Grid] [Timeline])

**Touch Interactions:**
- Touch drag: Move task bars
- Long press: Edit menu
- Double tap: Open task modal
- Pinch zoom: Zoom timeline
- Swipe: Navigate timeline

---

## 6. CASCADE & DEPENDENCY ENGINE

### 6.1 SMCascadeService (New Service)

```ruby
# backend/app/services/sm_cascade_service.rb

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
    @construction = task.construction
    @options = options
    @calendar = WorkingDaysCalendar.new(@construction.company_setting)
  end

  def preview(new_start_date)
    # Returns categorized successors without modifying anything
    {
      unlocked_successors: find_unlocked_successors,
      blocked_successors: find_blocked_successors
    }
  end

  def execute(cascade_params)
    results = {
      updated_tasks: [],
      broken_dependencies: [],
      unlocked_tasks: []
    }

    ActiveRecord::Base.transaction do
      # 1. Process tasks to cascade
      cascade_params[:tasks_to_cascade].each do |task_id|
        task = SmTask.find(task_id)
        new_dates = calculate_dates_from_dependencies(task)
        task.update!(start_date: new_dates[:start], end_date: new_dates[:end])
        results[:updated_tasks] << task
      end

      # 2. Process tasks to break
      cascade_params[:tasks_to_break].each do |task_id|
        dep = SmDependency.find_by(successor_task_id: task_id, predecessor_task_id: @task.id, active: true)
        dep&.update!(active: false, deleted_at: Time.current, deleted_reason: 'cascade_conflict')
        results[:broken_dependencies] << dep
      end

      # 3. Process tasks to unlock
      cascade_params[:tasks_to_unlock].each do |task_id|
        task = SmTask.find(task_id)
        task.update!(supplier_confirm: false, confirm: false, manually_positioned: false)
        results[:unlocked_tasks] << task
      end
    end

    results
  end

  private

  def find_unlocked_successors
    direct_successors.reject { |s| locked?(s[:task]) }
  end

  def find_blocked_successors
    direct_successors.select { |s| locked?(s[:task]) }.map do |s|
      {
        task: s[:task],
        lock_type: get_lock_type(s[:task]),
        nested_successors: find_nested_locked_successors(s[:task])
      }
    end
  end

  def locked?(task)
    task.supplier_confirm || task.confirm ||
    task.status.in?(['started', 'completed']) ||
    task.manually_positioned
  end

  def get_lock_type(task)
    return 'supplier_confirm' if task.supplier_confirm
    return 'confirm' if task.confirm
    return 'started' if task.status == 'started'
    return 'completed' if task.status == 'completed'
    return 'manually_positioned' if task.manually_positioned
    nil
  end

  def calculate_dates_from_dependencies(task)
    # Implementation matching existing ScheduleCascadeService logic
    # but using sm_dependencies table and actual DATE values
  end
end
```

---

## 7. CASCADE MODAL SYSTEM

### 7.1 Overview

The cascade modal has **two views** (user-toggleable):

1. **Kanban View** - Three swim lanes with drag-and-drop
2. **Classic View** - Hierarchical tree with checkboxes

### 7.2 Kanban View Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Toggle: Kanban / Classic]                    [Cancel] [Apply] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ WILL CASCADE│  │ WILL BREAK  │  │   LOCKED    │         │
│  │ (Move with  │  │ (Stay in    │  │  (Cannot    │         │
│  │  parent)    │  │  place)     │  │   move)     │         │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤         │
│  │             │  │             │  │             │         │
│  │ [Task Card] │  │ [Task Card] │  │ [Task Card] │         │
│  │  FS+2       │  │  SS         │  │  🔒 Supplier│         │
│  │  → Jun 20   │  │             │  │   Confirmed │         │
│  │             │  │             │  │  [Unlock]   │         │
│  │ [Task Card] │  │             │  │             │         │
│  │  FS         │  │             │  │ [Task Card] │         │
│  │  → Jun 22   │  │             │  │  🔒 Started │         │
│  │             │  │             │  │             │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ⚠️ Conflict: Task #125 has locked successors              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Classic View Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Toggle: Kanban / Classic]                    [Cancel] [Apply] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  AFFECTED DEPENDENCIES                                      │
│                                                             │
│  ├── [Moved Task] #123 "Frame Walls" MOVED TO Jun 20       │
│  │   │                                                      │
│  │   ├── #124 "Install Windows" FS+2                       │
│  │   │   [✓] Cascade to Jun 22                             │
│  │   │   │                                                  │
│  │   │   └── #126 "Paint Frames" 🔒 Supplier Confirmed     │
│  │   │       [ ] Keep dependency (will conflict)           │
│  │   │       [Unlock] Remove supplier confirm              │
│  │   │                                                      │
│  │   └── #125 "Roof Trusses" SS                            │
│  │       [✓] Cascade to Jun 20                             │
│  │                                                          │
│  └── #127 "Electrical Rough-in" 🔒 Started                 │
│      Cannot cascade (task already started)                  │
│      Dependency will be broken                              │
│                                                             │
│  ────────────────────────────────────────────────────────── │
│  Summary: 2 tasks will cascade, 1 will break, 1 blocked    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 Lock Types & Visual Indicators

| Lock Type | Icon | Color | Unlock Option |
|-----------|------|-------|---------------|
| Supplier Confirmed | 🔒✓ | Green border | Clear supplier confirm |
| Confirmed | 🔒 | Blue border | Clear confirm |
| Started | ▶️ | Blue fill | Cannot unlock |
| Completed | ✓ | Green fill | Cannot unlock |
| Manually Positioned | 📌 | Gray border | Clear manual position |

### 7.5 Conflict Detection

Conflicts occur when:
1. User tries to cascade a task that has locked successors
2. Cascading would move a supplier-confirmed task

Resolution options:
1. Move parent to "WILL BREAK" zone (breaks dependency)
2. Unlock the locked successor
3. Cancel the cascade

---

## 8. ROLLOVER AUTOMATION SYSTEM

### 8.1 SmRolloverJob

```ruby
# backend/app/jobs/sm_rollover_job.rb

class SmRolloverJob < ApplicationJob
  queue_as :critical

  def perform
    settings = SmSetting.first
    return unless settings.rollover_enabled

    batch_id = SecureRandom.uuid
    rollover_time = Time.current.in_time_zone(settings.rollover_timezone)

    Rails.logger.info("=== SM Rollover Starting: #{rollover_time} ===")

    # Get all constructions with past SM tasks
    constructions = Construction.joins(:sm_tasks)
      .where("sm_tasks.start_date < ? AND sm_tasks.status != 'completed'", Date.current)
      .distinct

    constructions.each do |construction|
      rollover_construction(construction, batch_id, rollover_time)
    end

    Rails.logger.info("=== SM Rollover Complete ===")
  end

  private

  def rollover_construction(construction, batch_id, rollover_time)
    # Skip if job is on hold - Hold Task handles rollover
    hold_task = construction.sm_tasks.find_by(is_hold_task: true, status: 'not_started')

    past_tasks = construction.sm_tasks
      .where("start_date < ?", Date.current)
      .where.not(status: 'completed')
      .order(:sequence_order)

    past_tasks.each do |task|
      roll_task_forward(task, batch_id, rollover_time)
    end
  end

  def roll_task_forward(task, batch_id, rollover_time)
    calendar = WorkingDaysCalendar.new(task.construction.company_setting)
    new_start = calendar.next_working_day(Date.current)

    old_start = task.start_date
    old_end = task.end_date

    task.update!(
      start_date: new_start,
      end_date: calendar.add_working_days(new_start, task.duration_days - 1)
    )

    # Auto-cascade with dependency deletion
    cascade_result = SmCascadeService.new(task, rollover_mode: true).execute_rollover

    # Log
    SmRolloverLog.create!(
      rollover_batch_id: batch_id,
      rollover_timestamp: rollover_time,
      task_id: task.id,
      construction_id: task.construction_id,
      old_start_date: old_start,
      new_start_date: new_start,
      old_end_date: old_end,
      new_end_date: task.end_date,
      deleted_dependencies: cascade_result[:deleted_dependencies].to_json,
      supplier_confirms_cleared: cascade_result[:supplier_confirms_cleared]
    )
  end
end
```

---

## 9. SUPPLIER WORKFLOW INTEGRATION

(Same as original but using sm_ tables and new cascade modal)

---

## 10. TASK SPAWNING SYSTEM

(Same as original but using sm_ tables)

---

## 11. WORKING DRAWINGS AI SYSTEM

(Same as original but using sm_working_drawing_pages table)

---

## 12. SYSTEM INTEGRATIONS

### 12.1 Documentation Tabs Integration

The SM Gantt integrates with `construction_documentation_tabs`:

```ruby
# Each SM task can link to documentation categories
class SmTask < ApplicationRecord
  def documentation_categories
    ConstructionDocumentationTab.where(
      construction_id: construction_id,
      id: documentation_category_ids
    )
  end
end
```

**Frontend:** Show documentation tab badges on task rows, link to docs when clicked.

### 12.2 WHS Inspections Integration

SM tasks can trigger or be blocked by WHS inspections:

```ruby
class SmTask < ApplicationRecord
  has_many :whs_inspections, foreign_key: :sm_task_id

  def pending_inspections?
    whs_inspections.where(status: 'pending').exists?
  end
end
```

### 12.3 Meetings Integration

Meetings can be linked to SM tasks as milestones:

```ruby
class Meeting < ApplicationRecord
  belongs_to :sm_task, optional: true
end
```

### 12.4 Checklists Integration

SM tasks use existing checklist systems:

- `schedule_task_checklist_items` - Per-task checklists
- `supervisor_checklist_templates` - Template-based checklists
- `project_task_checklist_items` - Project-level checklists

### 12.5 Purchase Orders Integration

```ruby
class SmTask < ApplicationRecord
  belongs_to :purchase_order, optional: true

  def suggested_purchase_orders
    PurchaseOrder.where(construction_id: construction_id)
      .where(supplier_id: supplier_id)
      .where.not(id: purchase_order_id)
  end
end
```

### 12.6 Permissions Integration

Uses existing `view_gantt` permission plus new SM-specific permissions:

```ruby
# Add to permissions table
Permission.create!(name: 'view_sm_gantt', category: 'schedule')
Permission.create!(name: 'edit_sm_gantt', category: 'schedule')
Permission.create!(name: 'manage_sm_hold', category: 'schedule')
Permission.create!(name: 'manage_sm_settings', category: 'admin')
```

---

## 13. NAVIGATION & SETUP

### 13.1 Left Sidebar - "SM Gantt" Link

Add new menu item to left sidebar:

```jsx
// In AppLayout.jsx or sidebar component
{
  name: 'SM Gantt',
  href: '/sm-gantt',
  icon: CalendarIcon,
  permission: 'view_sm_gantt'
}
```

**Behavior:** Opens the default SM Schedule template for testing/editing.

### 13.2 Construction View - "Open SM Gantt" Button

Within a construction's schedule tab, add button:

```jsx
<Button onClick={() => navigate(`/constructions/${constructionId}/sm-gantt`)}>
  Open SM Gantt
</Button>
```

### 13.3 System Admin - SM Setup

New settings page at `/settings/sm-setup`:

**Sections:**

1. **Hold Reasons**
   - List of configurable reasons
   - Add/edit/delete/reorder
   - Color and icon picker

2. **Rollover Settings**
   - Rollover time (default: midnight)
   - Timezone selector
   - Enable/disable toggle

3. **Default Template**
   - Select which SM template is default
   - This template opens when clicking sidebar "SM Gantt" link

```jsx
// Route
<Route path="/settings/sm-setup" element={<SMSetupPage />} />

// SMSetupPage.jsx
export function SMSetupPage() {
  return (
    <div>
      <h1>SM Gantt Setup</h1>

      <section>
        <h2>Hold Reasons</h2>
        <HoldReasonsManager />
      </section>

      <section>
        <h2>Rollover Settings</h2>
        <RolloverSettingsForm />
      </section>

      <section>
        <h2>Default Template</h2>
        <DefaultTemplateSelector />
      </section>
    </div>
  )
}
```

---

## 14. REUSABLE SERVICES

### 14.1 Services to REUSE (Existing)

| Service | Location | Purpose |
|---------|----------|---------|
| `CompanySetting` | `app/models/company_setting.rb` | Timezone, working days config |
| `PublicHoliday` | `app/models/public_holiday.rb` | Holiday calendar (QLD seeded) |
| `WorkingDaysCalendar` | Needs extraction | Business day calculations |
| `CloudinaryService` | `app/services/cloudinary_service.rb` | File uploads |

### 14.2 Services to BUILD NEW

| Service | Purpose |
|---------|---------|
| `SmCascadeService` | New cascade engine for sm_ tables |
| `SmRolloverService` | Rollover logic for sm_tasks |
| `SmHoldService` | Hold task management |
| `SmTaskCompletionService` | Task completion + spawning |
| `SmWorkingDrawingsService` | AI document processing |

### 14.3 Shared Working Days Utility

Extract working days logic to shared module:

```ruby
# app/services/working_days_calculator.rb

class WorkingDaysCalculator
  def initialize(company_setting)
    @working_days = company_setting.working_days
    @timezone = company_setting.timezone
    @holidays = PublicHoliday.for_company(company_setting).pluck(:date).to_set
  end

  def add_working_days(date, days)
    # ... existing logic
  end

  def next_working_day(date)
    # ... existing logic
  end

  def is_working_day?(date)
    # ... existing logic
  end
end
```

---

## 15. IMPLEMENTATION ROADMAP - PHASE 1

### Phase 1.1: Foundation (Weeks 1-2)
**Goal:** Database + Basic API

**Tasks:**
- [ ] Create all sm_ table migrations
- [ ] Create SmTask, SmDependency, SmHoldReason models
- [ ] Create SmSetting model with seed data
- [ ] Basic CRUD API endpoints
- [ ] WorkingDaysCalculator extraction

**Deliverable:** API ready for frontend

---

### Phase 1.2: Core Frontend (Weeks 3-4)
**Goal:** Basic SM Gantt UI

**Tasks:**
- [ ] SMGanttView container component
- [ ] SMGanttGrid (task list) with Tailwind
- [ ] SMGanttTimeline (chart area)
- [ ] SMGanttBar (task bars)
- [ ] Basic drag-to-move (no cascade yet)
- [ ] Column configuration

**Deliverable:** Can view and manually move tasks

---

### Phase 1.3: Dependencies & Cascade (Weeks 5-6)
**Goal:** Full dependency engine

**Tasks:**
- [ ] SmCascadeService implementation
- [ ] Dependency CRUD API
- [ ] Cascade preview endpoint
- [ ] SMCascadeModal (both views)
- [ ] SMCascadeKanban with drag-and-drop
- [ ] SMCascadeClassic with tree view
- [ ] View toggle persistence

**Deliverable:** Full cascade with modal resolution

---

### Phase 1.4: Hold System (Week 7)
**Goal:** Master hold functionality

**Tasks:**
- [ ] SmHoldService implementation
- [ ] Hold activation API
- [ ] Hold release API
- [ ] SMHoldModal component
- [ ] SMReleaseHoldModal component
- [ ] Hold task visual styling
- [ ] Supplier notification on hold

**Deliverable:** Can hold/release entire job

---

### Phase 1.5: Rollover & Supplier (Weeks 8-9)
**Goal:** Automated rollover + supplier workflow

**Tasks:**
- [ ] SmRolloverJob implementation
- [ ] Cron scheduling
- [ ] Rollover audit logging
- [ ] Supplier confirm workflow
- [ ] Supplier notifications
- [ ] Checkered status visual

**Deliverable:** Automated overnight rollover

---

### Phase 1.6: Task Spawning & AI (Weeks 10-11)
**Goal:** Advanced features

**Tasks:**
- [ ] SmTaskCompletionService
- [ ] Task spawning logic
- [ ] Pass/fail inspection retry
- [ ] Working drawings AI integration
- [ ] Document categorization

**Deliverable:** Task spawning + AI features

---

### Phase 1.7: Navigation & Polish (Weeks 12-14)
**Goal:** Production ready

**Tasks:**
- [ ] SM Gantt sidebar link
- [ ] SM Setup in System Admin
- [ ] Hold reasons management UI
- [ ] Rollover settings UI
- [ ] Default template selector
- [ ] Mobile responsive
- [ ] Performance optimization
- [ ] Testing & bug fixes

**Deliverable:** Production-ready SM Gantt

---

## 16. PHASE 2: RESOURCE ALLOCATION & TIMESHEET

### 16.1 Overview

Phase 2 adds resource management on top of SM Gantt:

- **Resource Gantt** - Separate view showing resource allocation
- **Time Tracking** - Log hours against tasks/resources
- **Capacity Planning** - See resource utilization

### 16.2 Resource Types

| Type | Examples | Tracking |
|------|----------|----------|
| **People** | Carpenters, Electricians | Hours, rates |
| **Equipment** | Cranes, Scaffolding | Daily rates, availability |
| **Materials** | Concrete, Timber | Quantities, costs |

### 16.3 Resource Gantt View

Two linked views:
1. **Task Gantt** - Shows tasks (existing SM Gantt)
2. **Resource Gantt** - Shows resource allocations per task

Toggle between views or show side-by-side.

### 16.4 Timesheet Integration

- Daily time entry by resource
- Link to task being worked on
- Approval workflow
- Export to payroll systems

### 16.5 Phase 2 Timeline

- **Weeks 15-16:** Resource models + API
- **Weeks 17-18:** Resource Gantt UI
- **Weeks 19-20:** Timesheet UI
- **Weeks 21-22:** Reports + Integration
- **Weeks 23-24:** Polish + Testing

---

## 17. TECHNOLOGY STACK

### Backend
- **Framework:** Ruby on Rails 7.x (existing)
- **Database:** PostgreSQL 14+ (existing)
- **Background Jobs:** Solid Queue (existing)
- **File Storage:** Cloudinary (existing)
- **AI Services:** OpenAI API (GPT-4 Vision)

### Frontend
- **Framework:** React 18.x (existing)
- **State Management:** Zustand
- **Styling:** Tailwind CSS 3.x (existing)
- **Data Fetching:** TanStack Query (existing)
- **Drag & Drop:** @dnd-kit/core
- **Date Utilities:** date-fns

### New Dependencies
```json
{
  "@dnd-kit/core": "^6.0.0",
  "@dnd-kit/sortable": "^7.0.0",
  "zustand": "^4.4.0"
}
```

---

## 18. KEY DESIGN DECISIONS

### 18.1 Completely Separate Tables
**Decision:** New sm_ prefixed tables, not modifications to existing

**Rationale:**
- Zero risk to existing DHTMLX system
- Clean slate for proper architecture
- Can run both systems in parallel
- Easy to compare and choose winner

### 18.2 Actual Dates (Not Offsets)
**Decision:** Store actual DATE values, not day offsets

**Rationale:**
- Simpler queries: `WHERE start_date < CURRENT_DATE`
- Clearer data model
- Easier supplier communication
- Better for rollover logic

### 18.3 Separate Dependencies Table
**Decision:** sm_dependencies table, not JSONB array

**Rationale:**
- Indexed queries for cascade
- Audit trail (who created, when deleted)
- Soft delete support
- Easier to query inverse relationships

### 18.4 React + Tailwind (No Library)
**Decision:** Build custom with Tailwind, not use Gantt library

**Rationale:**
- Full UI control
- Consistent with Trapid design system
- No license costs
- Can optimize for specific use cases

### 18.5 Kanban + Classic Modal Toggle
**Decision:** Support both cascade modal views

**Rationale:**
- Different users prefer different UX
- Kanban is visual and intuitive
- Classic shows full hierarchy
- Toggle respects user preference

### 18.6 One Master Hold Per Job
**Decision:** Only one Hold Task can exist at a time

**Rationale:**
- Simplifies logic (clear master blocker)
- Avoids conflicting holds
- Clear audit trail
- Easy to understand and explain

### 18.7 Phase 2 Schema Now
**Decision:** Design resource tables in Phase 1, build UI in Phase 2

**Rationale:**
- Avoid schema changes later
- Foreign keys ready from start
- Can reference in Phase 1 if needed
- Clean upgrade path

---

## NEXT STEPS

1. **Review & Approval:** Get stakeholder sign-off on this plan
2. **Phase 1.1 Kickoff:** Create migrations and models
3. **Weekly Reviews:** Check progress, adjust as needed
4. **Documentation:** Update Trinity as we build

---

**Questions? Changes? Let's discuss before starting Phase 1.1!**
