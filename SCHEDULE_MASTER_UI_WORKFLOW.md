# Schedule Master - High-Level UI Workflow
## User Journey & Screen Designs

**Version:** 1.0
**Date:** 2025-11-25
**Purpose:** Visual guide to Schedule Master user experience

---

## Table of Contents

1. [Overview & User Journey](#1-overview--user-journey)
2. [Screen 1: Template Library](#2-screen-1-template-library)
3. [Screen 2: Apply Template to Job](#3-screen-2-apply-template-to-job)
4. [Screen 3: Job Schedule View (Gantt)](#4-screen-3-job-schedule-view-gantt)
5. [Screen 4: Task List & PO Matching](#5-screen-4-task-list--po-matching)
6. [Screen 5: Cascade Modal](#6-screen-5-cascade-modal)
7. [Admin: Template Editor](#7-admin-template-editor)

---

## 1. Overview & User Journey

### 1.1 The Three Main Workflows

```
┌─────────────────────────────────────────────────────────────────┐
│                   SCHEDULE MASTER WORKFLOWS                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WORKFLOW A: SETUP TEMPLATES (Admin, One-Time)                  │
│  ┌────────────┐      ┌──────────────┐      ┌────────────────┐  │
│  │ Create     │  →   │ Add Tasks    │  →   │ Set            │  │
│  │ Template   │      │ (50 rows)    │      │ Dependencies   │  │
│  └────────────┘      └──────────────┘      └────────────────┘  │
│       ↓                                                          │
│  "Residential NDIS Template" is now ready to use                │
│                                                                  │
│  ───────────────────────────────────────────────────────────── │
│                                                                  │
│  WORKFLOW B: APPLY TEMPLATE TO JOB (Estimator/PM, Per Job)     │
│  ┌────────────┐      ┌──────────────┐      ┌────────────────┐  │
│  │ Create     │  →   │ Select       │  →   │ System Spawns  │  │
│  │ New Job    │      │ Template     │      │ 50 Tasks       │  │
│  └────────────┘      └──────────────┘      └────────────────┘  │
│       ↓                                                          │
│  Job now has 50 tasks, ready to schedule                        │
│                                                                  │
│  ───────────────────────────────────────────────────────────── │
│                                                                  │
│  WORKFLOW C: MANAGE SCHEDULE (Site Super, Daily)               │
│  ┌────────────┐      ┌──────────────┐      ┌────────────────┐  │
│  │ View       │  →   │ Match Tasks  │  →   │ Update Dates/  │  │
│  │ Gantt      │      │ to POs       │      │ Mark Complete  │  │
│  └────────────┘      └──────────────┘      └────────────────┘  │
│       ↓                                                          │
│  Schedule stays current, cascades automatically                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Step-by-Step User Journey

```
ADMIN (One-Time Setup)
  ↓
1. Navigate to "System Admin" → "Schedule Templates"
  ↓
2. Click "Create New Template" → Name: "Residential NDIS Build"
  ↓
3. Add 50 tasks (Foundation, Framing, Electrical, etc.)
  ↓
4. Set dependencies: "Task 5 depends on Task 3 (FS+2)"
  ↓
5. Mark template as "Default"

────────────────────────────────────────────────────────────

PROJECT MANAGER (Per Job)
  ↓
1. Navigate to "Jobs" → "Create New Job"
  ↓
2. Fill in job details: "123 Smith St, Brisbane"
  ↓
3. Select template: "Residential NDIS Build"
  ↓
4. Click "Create Job"
  ↓
5. System spawns 50 tasks from template
  ↓
6. Navigate to Job → "Schedule Master" tab

────────────────────────────────────────────────────────────

SITE SUPERVISOR (Daily Use)
  ↓
1. Open Job → "Schedule Master" tab
  ↓
2. View Gantt chart showing all 50 tasks
  ↓
3. Click "Match" next to "Foundation" task
  ↓
4. Select PO-000123 (ABC Concrete) from modal
  ↓
5. Task turns green, shows "PO-000123" badge
  ↓
6. Drag "Framing" task to new date (Jun 20)
  ↓
7. Cascade modal appears: "10 tasks affected"
  ↓
8. Review Kanban view: 8 will move, 2 are locked
  ↓
9. Click "Apply Cascade"
  ↓
10. Gantt refreshes, 8 tasks moved automatically
  ↓
11. Mark "Foundation" as "Completed"
  ↓
12. System auto-unlocks dependent tasks
```

---

## 2. Screen 1: Template Library

**Path:** System Admin → Schedule Templates
**User:** Admin, Estimator
**Purpose:** Browse and manage schedule templates

### 2.1 Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│  TRAPID                                    [User Menu ▼]       │
├────────────────────────────────────────────────────────────────┤
│  Schedule Templates                    [+ New Template]        │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ Search templates...                             🔍      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ⭐ Residential NDIS Build                    [Default]  │  │
│  │     50 tasks · Last updated: Nov 20, 2025              │  │
│  │     Foundation → Framing → Roofing → Finishes          │  │
│  │                                                          │  │
│  │     [View] [Edit] [Duplicate] [Apply to Job]           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Commercial Office Fitout                                │  │
│  │     35 tasks · Last updated: Oct 15, 2025              │  │
│  │     Demo → Partitions → M&E → Finishes                  │  │
│  │                                                          │  │
│  │     [View] [Edit] [Duplicate] [Apply to Job]           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Granny Flat - Standard                                  │  │
│  │     28 tasks · Last updated: Sep 5, 2025               │  │
│  │     Slab → Frame → Roof → Services                      │  │
│  │                                                          │  │
│  │     [View] [Edit] [Duplicate] [Apply to Job]           │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Features

- **Search/Filter:** Find templates by name, task count, or category
- **Default Badge:** Shows which template is used for new jobs
- **Preview:** Quick view of task sequence
- **Actions:**
  - **View:** See full task list in read-only mode
  - **Edit:** Modify template (affects future jobs only)
  - **Duplicate:** Create a copy for customization
  - **Apply to Job:** Select existing job to apply template

---

## 3. Screen 2: Apply Template to Job

**Path:** Jobs → Create New Job OR Job Detail → Apply Template
**User:** Project Manager, Estimator
**Purpose:** Apply a schedule template to a job

### 3.1 Wireframe (Modal)

```
┌────────────────────────────────────────────────────────────────┐
│  Apply Schedule Template                           [✕ Close]  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Job: 123 Smith St, Brisbane                                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Select Template                                  [▼]   │  │
│  └─────────────────────────────────────────────────────────┘  │
│      └─► Residential NDIS Build (50 tasks)                    │
│          Commercial Office Fitout (35 tasks)                   │
│          Granny Flat - Standard (28 tasks)                     │
│                                                                 │
│  ────────────────────────────────────────────────────────────  │
│                                                                 │
│  ✓ Selected: Residential NDIS Build                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Template Preview                                        │  │
│  │                                                          │  │
│  │  Total Tasks: 50                                         │  │
│  │  Estimated Duration: 18 weeks                            │  │
│  │                                                          │  │
│  │  Task Breakdown:                                         │  │
│  │    • Foundation & Slab (5 tasks, 2 weeks)               │  │
│  │    • Framing & Structure (8 tasks, 3 weeks)             │  │
│  │    • Roofing & Gutters (4 tasks, 1 week)                │  │
│  │    • Services (12 tasks, 4 weeks)                        │  │
│  │    • Internal Finishes (15 tasks, 6 weeks)              │  │
│  │    • External Finishes (6 tasks, 2 weeks)               │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Job Start Date                                          │  │
│  │  ┌──────────────────┐                                   │  │
│  │  │ Dec 1, 2025   📅 │                                   │  │
│  │  └──────────────────┘                                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ⚠️ This will create 50 tasks. Existing tasks will remain.    │
│                                                                 │
│                          [Cancel]  [Apply Template ➜]          │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 What Happens When User Clicks "Apply Template"

```
1. System validation
   ├─ Check if job already has tasks
   ├─ Confirm start date is valid
   └─ Verify template exists

2. Task spawning (in transaction)
   ├─ Copy 50 ScheduleTemplateRows → 50 SmTasks
   ├─ Set job_id = current job
   ├─ Set template_row_id = source row ID
   ├─ Calculate start_date based on job start + dependencies
   ├─ Copy all fields (name, duration, trade, supplier, etc.)
   └─ Create SmDependencies from template predecessors

3. Success notification
   ├─ Toast: "50 tasks created successfully"
   ├─ Redirect to Job → Schedule Master tab
   └─ Show Gantt chart with all tasks
```

---

## 4. Screen 3: Job Schedule View (Gantt)

**Path:** Job Detail → Schedule Master Tab
**User:** Site Supervisor, Project Manager
**Purpose:** View and manage job schedule

### 4.1 Wireframe (Gantt View)

```
┌────────────────────────────────────────────────────────────────┐
│  Job: 123 Smith St, Brisbane                                   │
│  [Details] [POs] [Documents] [Schedule Master ⭐] [Contacts]   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  📊 Schedule Stats                                        │ │
│  │                                                           │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │ │
│  │  │ Total   │  │ Matched │  │ Started │  │ Complete│    │ │
│  │  │   50    │  │   35    │  │   12    │  │    5    │    │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │ │
│  │                                                           │ │
│  │  Progress: ████████████░░░░░░░░░░ 70%                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  [List View] [Gantt View ⭐] [Calendar]    [+ Add Task] │ │
│  │                                                           │ │
│  │  View: [Day] [Week ⭐] [Month]    Zoom: [- ◆◆◆◆◆ +]     │ │
│  │                                                           │ │
│  │  Filters: [All Trades ▼] [All Status ▼] 🔍 Search...    │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  GANTT CHART                                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Task Name          Dec 1  Dec 8  Dec 15  Dec 22  Dec 29 │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ #1 Site Prep      [████░░]                              │ │
│  │    ABC Earthworks  ✓PO-001                               │ │
│  │                                                           │ │
│  │ #2 Foundation     [░░██████]                             │ │
│  │    XYZ Concrete    ✓PO-002                               │ │
│  │                                                           │ │
│  │ #3 Frame Walls           [████████░░░░]                  │ │
│  │    Not matched     [Match]                               │ │
│  │                                                           │ │
│  │ #4 Roof Trusses              [░░░██████]                 │ │
│  │    🔒 Supplier confirmed      ✓PO-015                    │ │
│  │                                                           │ │
│  │ #5 Electrical                     [░░░░████]             │ │
│  │    Sparky Co       ✓PO-008                               │ │
│  │                                                           │ │
│  │ ⋮ (45 more tasks)                                        │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Legend:                                                        │
│  ████ Completed   ████ Started   ░░░░ Not Started   🔒 Locked │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 Gantt Interactions

**Click on Task Bar:**
```
→ Opens task detail panel (right side)
  Shows: Name, Duration, Dates, Supplier, PO, Dependencies
  Actions: [Edit] [Match PO] [Mark Complete] [Delete]
```

**Drag Task Bar:**
```
→ Move to new date
→ Cascade modal appears if has successors
→ User resolves conflicts
→ Dates update + cascade
```

**Right-Click Task:**
```
Context Menu:
  ├─ Edit Task
  ├─ Match to PO
  ├─ Add Dependency
  ├─ Mark as Started
  ├─ Mark as Complete
  ├─ Delete Task
  └─ View History
```

**Zoom Controls:**
```
Day View:   Each column = 1 day
Week View:  Each column = 1 week (default)
Month View: Each column = 1 month
```

---

## 5. Screen 4: Task List & PO Matching

**Path:** Job Detail → Schedule Master → List View
**User:** Site Supervisor, Estimator
**Purpose:** Match tasks to purchase orders

### 5.1 Wireframe (List View)

```
┌────────────────────────────────────────────────────────────────┐
│  [List View ⭐] [Gantt View] [Calendar]        [+ Add Task]   │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ # │ Task Name      │ Supplier Cat │ Start  │ Dur │ Status│ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ 1 │ Site Prep      │ Earthworks   │ Dec 1  │ 3d  │ ✓ PO  │ │
│  │   │                │              │        │     │ -001  │ │
│  │   │                │              │        │[Unmatch]     │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ 2 │ Foundation     │ Concrete     │ Dec 4  │ 5d  │ ✓ PO  │ │
│  │   │                │              │        │     │ -002  │ │
│  │   │                │              │        │[Unmatch]     │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ 3 │ Frame Walls    │ Carpentry    │ Dec 11 │ 7d  │ ⚠️ Not│ │
│  │   │                │              │        │     │matched│ │
│  │   │                │              │        │ [Match]      │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ 4 │ Roof Trusses   │ Carpentry    │ Dec 20 │ 4d  │ 🔒 PO │ │
│  │   │ (confirmed)    │              │        │     │ -015  │ │
│  │   │                │              │        │[Unmatch]     │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ ⋮ │ (46 more)      │              │        │     │       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Showing 50 tasks · 35 matched (70%)                           │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

### 5.2 Match PO Modal

**Triggered by:** Click [Match] button on unmatched task

```
┌────────────────────────────────────────────────────────────────┐
│  Match Task to Purchase Order                      [✕ Close]  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Task: #3 Frame Walls                                          │
│  Supplier Category: Carpentry                                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Search POs...                                     🔍     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ✨ SUGGESTED MATCHES (same supplier category)                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ○ PO-000012 - ABC Carpentry Ltd                         │ │
│  │     Category: Carpentry                                   │ │
│  │     Amount: $45,000 · Status: Approved                    │ │
│  │     Items: Framing timber, Wall plates, Studs            │ │
│  │                                            [Select ➜]     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ○ PO-000018 - XYZ Frames Inc                            │ │
│  │     Category: Carpentry                                   │ │
│  │     Amount: $38,500 · Status: Sent                        │ │
│  │     Items: Pre-cut frames, Bracing                       │ │
│  │                                            [Select ➜]     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  OTHER PURCHASE ORDERS                                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ○ PO-000005 - Big Box Hardware                          │ │
│  │     Category: Materials                                   │ │
│  │     Amount: $12,000 · Status: Approved                    │ │
│  │                                            [Select ➜]     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ○ PO-000008 - Sparky Co Electrical                      │ │
│  │     Category: Electrical                                  │ │
│  │     Amount: $28,000 · Status: Pending                     │ │
│  │                                            [Select ➜]     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [+ Create New PO for this task]                               │
│                                                                 │
│                                         [Cancel] [Confirm]     │
└────────────────────────────────────────────────────────────────┘
```

### 5.3 Match Flow

```
User clicks [Match] on Task #3
  ↓
Modal opens
  ↓
System finds suggested POs:
  ├─ WHERE supplier_category = 'Carpentry'
  ├─ WHERE job_id = current_job
  └─ ORDER BY created_at DESC
  ↓
User selects PO-000012
  ↓
Clicks [Confirm]
  ↓
System updates:
  ├─ task.purchase_order_id = 12
  ├─ task.matched_to_po = true
  └─ task.supplier_id = PO.supplier_id
  ↓
Task row updates:
  ├─ Shows green "✓ PO-000012" badge
  ├─ [Match] button → [Unmatch] button
  └─ Stats update: 36 of 50 matched (72%)
  ↓
Gantt refreshes with green task bar
```

---

## 6. Screen 5: Cascade Modal

**Path:** Triggered when moving a task that has successors
**User:** Site Supervisor, Project Manager
**Purpose:** Resolve cascade conflicts

### 6.1 Kanban View (Default)

```
┌────────────────────────────────────────────────────────────────┐
│  Cascade Changes                                   [✕ Close]  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  You moved: #3 Frame Walls from Dec 11 → Dec 18 (+7 days)     │
│                                                                 │
│  [Kanban View ⭐] [Classic View]                               │
│                                                                 │
│  ┌──────────────┬──────────────┬──────────────┬─────────────┐ │
│  │ WILL CASCADE │ WILL BREAK   │  LOCKED      │  ACTIONS    │ │
│  │ (move with)  │ (stay put)   │  (can't move)│             │ │
│  ├──────────────┼──────────────┼──────────────┼─────────────┤ │
│  │              │              │              │             │ │
│  │ ┌──────────┐ │              │ ┌──────────┐ │ Legend:     │ │
│  │ │ #4       │ │              │ │ #7       │ │             │ │
│  │ │ Windows  │ │              │ │ Plumbing │ │ 🔒 Supplier │ │
│  │ │          │ │              │ │ Rough-in │ │ Confirmed   │ │
│  │ │ FS+2     │ │              │ │          │ │             │ │
│  │ │ → Dec 20 │ │              │ │ 🔒 Supp  │ │ ▶️ Started  │ │
│  │ └──────────┘ │              │ │ Confirm  │ │             │ │
│  │   [Drag me]  │              │ │          │ │ ✅ Complete │ │
│  │              │              │ │ [Unlock] │ │             │ │
│  │ ┌──────────┐ │              │ └──────────┘ │             │ │
│  │ │ #5       │ │              │              │             │ │
│  │ │ Roof     │ │              │              │             │ │
│  │ │ Trusses  │ │              │              │             │ │
│  │ │          │ │              │              │             │ │
│  │ │ FS       │ │              │              │             │ │
│  │ │ → Dec 25 │ │              │              │             │ │
│  │ └──────────┘ │              │              │             │ │
│  │              │              │              │             │ │
│  │ ┌──────────┐ │              │              │             │ │
│  │ │ #6       │ │              │              │             │ │
│  │ │ Roofing  │ │              │              │             │ │
│  │ │          │ │              │              │             │ │
│  │ │ FS+1     │ │              │              │             │ │
│  │ │ → Dec 26 │ │              │              │             │ │
│  │ └──────────┘ │              │              │             │ │
│  │              │              │              │             │ │
│  └──────────────┴──────────────┴──────────────┴─────────────┘ │
│                                                                 │
│  ⚠️ Warning: #7 Plumbing Rough-in is locked (supplier          │
│     confirmed). Move it to "Will Break" or click [Unlock].     │
│                                                                 │
│  Summary: 3 tasks will cascade, 0 will break, 1 locked        │
│                                                                 │
│                                    [Cancel] [Apply Changes]    │
└────────────────────────────────────────────────────────────────┘
```

### 6.2 Classic Tree View (Alternative)

```
┌────────────────────────────────────────────────────────────────┐
│  Cascade Changes                                   [✕ Close]  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  You moved: #3 Frame Walls from Dec 11 → Dec 18 (+7 days)     │
│                                                                 │
│  [Kanban View] [Classic View ⭐]                               │
│                                                                 │
│  AFFECTED DEPENDENCIES                                         │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                           │ │
│  │  ├── [Moved] #3 Frame Walls → Dec 18                     │ │
│  │  │                                                        │ │
│  │  │   ├── #4 Windows (FS+2)                               │ │
│  │  │   │   ✓ Will cascade to Dec 20                        │ │
│  │  │   │                                                    │ │
│  │  │   ├── #5 Roof Trusses (FS)                            │ │
│  │  │   │   ✓ Will cascade to Dec 25                        │ │
│  │  │   │                                                    │ │
│  │  │   │   └── #6 Roofing (FS+1)                           │ │
│  │  │   │       ✓ Will cascade to Dec 26                    │ │
│  │  │   │                                                    │ │
│  │  │   └── #7 Plumbing Rough-in (SS) 🔒 Supplier Confirmed │ │
│  │  │       ☐ Keep dependency (will conflict)               │ │
│  │  │       ☐ Break dependency                              │ │
│  │  │       [Unlock] Remove supplier confirmation           │ │
│  │                                                           │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ───────────────────────────────────────────────────────────  │
│  Summary: 3 tasks will cascade, 0 will break, 1 needs action  │
│                                                                 │
│                                    [Cancel] [Apply Changes]    │
└────────────────────────────────────────────────────────────────┘
```

### 6.3 Cascade Decision Matrix

```
When user moves Task A that has successors:

┌─────────────────────────────────────────────────────────────┐
│  Successor Status         │  Default Action  │  User Options │
├──────────────────────────┼──────────────────┼───────────────┤
│  Not locked               │  CASCADE ✅      │  • Move       │
│                           │                  │  • Break dep  │
├──────────────────────────┼──────────────────┼───────────────┤
│  Supplier confirmed 🔒    │  LOCKED ⚠️       │  • Unlock     │
│                           │                  │  • Break dep  │
├──────────────────────────┼──────────────────┼───────────────┤
│  Manually positioned 📌   │  LOCKED ⚠️       │  • Unlock     │
│                           │                  │  • Break dep  │
├──────────────────────────┼──────────────────┼───────────────┤
│  Started ▶️               │  LOCKED ❌       │  • Break dep  │
│                           │                  │  (can't unlock)
├──────────────────────────┼──────────────────┼───────────────┤
│  Completed ✅             │  LOCKED ❌       │  • Break dep  │
│                           │                  │  (can't unlock)
└─────────────────────────────────────────────────────────────┘
```

### 6.4 User Actions in Cascade Modal

**1. Drag task between columns (Kanban view):**
```
Drag #4 from "Will Cascade" → "Will Break"
  ↓
Task dependency will be marked inactive
  ↓
#4 stays at original date (Dec 13)
  ↓
Summary updates: "2 tasks will cascade, 1 will break"
```

**2. Click [Unlock] on locked task:**
```
Click [Unlock] on #7 Plumbing Rough-in
  ↓
Confirmation dialog:
  "Remove supplier confirmation for Plumbing Rough-in?
   This will notify the supplier of the date change."
  ↓
If confirmed:
  ├─ task.supplier_confirm = false
  ├─ task.confirm_status = 'moved_after_confirm'
  ├─ Task moves to "Will Cascade" column
  └─ Email sent to supplier
```

**3. Click [Apply Changes]:**
```
System performs in transaction:
  ├─ Update all tasks in "Will Cascade" column
  ├─ Mark dependencies inactive for "Will Break" column
  ├─ Create SmRolloverLog entries for audit
  ├─ Trigger cascade for nested successors
  └─ Return updated task list
  ↓
Modal closes
  ↓
Gantt refreshes with new dates
  ↓
Toast: "Updated 3 tasks, broke 1 dependency"
```

---

## 7. Admin: Template Editor

**Path:** System Admin → Schedule Templates → [Edit Template]
**User:** Admin, Estimator
**Purpose:** Create and edit schedule templates

### 7.1 Wireframe

```
┌────────────────────────────────────────────────────────────────┐
│  Edit Template: Residential NDIS Build                         │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Template Name                                            │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │ Residential NDIS Build                             │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │  Description                                               │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │ Standard residential build with NDIS modifications │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  │  ☑ Set as default template                                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Template Tasks                         [+ Add Task]     │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ # │ Task Name   │ Trade  │ Dur │ Depends On │ Actions  │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ 1 │ Site Prep   │ Earth  │ 3d  │ -          │ [↕][✎][✕]│ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ 2 │ Foundation  │ Conc   │ 5d  │ #1 (FS+1)  │ [↕][✎][✕]│ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ 3 │ Frame Walls │ Carp   │ 7d  │ #2 (FS)    │ [↕][✎][✕]│ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ 4 │ Windows     │ Carp   │ 2d  │ #3 (FS+2)  │ [↕][✎][✕]│ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ ⋮ │ (46 more)   │        │     │            │          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Duplicate Template] [Delete Template]    [Cancel] [Save]    │
└────────────────────────────────────────────────────────────────┘
```

### 7.2 Edit Task Row Modal

**Triggered by:** Click [✎] next to task row

```
┌────────────────────────────────────────────────────────────────┐
│  Edit Task: #3 Frame Walls                        [✕ Close]  │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Task Name *                                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Frame Walls                                               │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Trade / Category *                                             │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Carpentry                                          [▼]   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Duration (working days) *                                      │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 7                                                         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Default Supplier (optional)                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ ABC Carpentry Ltd                                  [▼]   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Dependencies                                                   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  ✓ #2 Foundation (FS - Finish to Start)                  │ │
│  │    Lag: 0 days                               [Remove]    │ │
│  │                                                           │ │
│  │  [+ Add Dependency]                                      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Flags                                                          │
│  ☑ PO Required                                                 │
│  ☑ Auto-create PO when job starts                             │
│  ☐ Require photo upload before completion                     │
│  ☐ Require certificate/compliance doc                         │
│  ☐ Supervisor check required                                  │
│                                                                 │
│                                         [Cancel] [Save Task]   │
└────────────────────────────────────────────────────────────────┘
```

---

## 8. Key User Flows Summary

### 8.1 Create Template (Admin - One Time)

```
1. Admin → System Admin → Schedule Templates
2. Click [+ New Template]
3. Enter name: "Residential NDIS Build"
4. Click [+ Add Task] 50 times
   OR
   Import from Excel (TBD feature)
5. For each task, set:
   ├─ Name
   ├─ Trade
   ├─ Duration
   ├─ Dependencies (#3 depends on #2, FS)
   └─ Flags (PO required, etc.)
6. Click [Save Template]
7. Set as default
```

### 8.2 Apply Template to Job (PM - Per Job)

```
1. Jobs → Create New Job
2. Fill in job details
3. Select template: "Residential NDIS Build"
4. Set start date: Dec 1, 2025
5. Click [Create Job]
6. System spawns 50 SmTasks
7. Redirect to Job → Schedule Master tab
```

### 8.3 Match Tasks to POs (Site Super - Weekly)

```
1. Open Job → Schedule Master tab
2. Click [List View]
3. See 50 tasks, 15 matched, 35 unmatched
4. Click [Match] on "Foundation" task
5. Modal shows suggested POs (filtered by "Concrete")
6. Select PO-000002 (XYZ Concrete)
7. Click [Confirm]
8. Task turns green, shows "✓ PO-000002"
9. Repeat for remaining 34 unmatched tasks
```

### 8.4 Move Task & Cascade (Site Super - Daily)

```
1. Open Job → Schedule Master → Gantt View
2. Drag "Frame Walls" from Dec 11 to Dec 18
3. Cascade modal opens (Kanban view)
4. See 3 tasks in "Will Cascade" column
5. See 1 task in "Locked" column (supplier confirmed)
6. Options:
   a) Click [Unlock] on locked task → Moves to cascade
   b) Drag locked task to "Will Break" → Breaks dependency
7. Click [Apply Changes]
8. System updates 3 tasks, emails supplier
9. Gantt refreshes with new dates
10. Toast: "Updated 3 tasks successfully"
```

### 8.5 Mark Task Complete (Site Super - Daily)

```
1. Open Job → Schedule Master → List View
2. Click on "Foundation" task row
3. Task detail panel opens (right side)
4. Click [Mark as Complete]
5. If pass/fail enabled:
   └─ Select "Pass" or "Fail"
   └─ If fail → spawn retry task
6. System updates:
   ├─ task.status = 'completed'
   ├─ task.completed_at = now
   └─ Unlock successor dependencies
7. Task row turns green
8. Stats update: 6 of 50 completed (12%)
```

---

## 9. Mobile Responsive Views

### 9.1 Mobile Gantt (Tabs)

```
┌──────────────────────────────┐
│  123 Smith St                │
│  [Schedule Master ⭐]        │
├──────────────────────────────┤
│                               │
│  [Tasks] [Gantt ⭐] [Stats]  │
│                               │
│  ┌──────────────────────────┐│
│  │ Week View        [▼]     ││
│  └──────────────────────────┘│
│                               │
│  Swipe left/right to scroll  │
│  ┌──────────────────────────┐│
│  │ Dec 1    Dec 8    Dec 15 ││
│  │                           ││
│  │ #1 Site   [███░░]        ││
│  │ #2 Found    [██████]     ││
│  │ #3 Frame      [████]     ││
│  │                           ││
│  │ ⋮                         ││
│  └──────────────────────────┘│
│                               │
│  Tap task for details         │
│                               │
└──────────────────────────────┘
```

### 9.2 Mobile Task List

```
┌──────────────────────────────┐
│  [Tasks ⭐] [Gantt] [Stats]  │
├──────────────────────────────┤
│                               │
│  ┌──────────────────────────┐│
│  │ 🔍 Search tasks...       ││
│  └──────────────────────────┘│
│                               │
│  ┌──────────────────────────┐│
│  │ #1 Site Prep             ││
│  │ ✓ PO-001 · 3d · Dec 1    ││
│  │ Earthworks               ││
│  │                    [···] ││
│  └──────────────────────────┘│
│                               │
│  ┌──────────────────────────┐│
│  │ #2 Foundation            ││
│  │ ✓ PO-002 · 5d · Dec 4    ││
│  │ Concrete                 ││
│  │                    [···] ││
│  └──────────────────────────┘│
│                               │
│  ┌──────────────────────────┐│
│  │ #3 Frame Walls           ││
│  │ ⚠️ Not matched · 7d      ││
│  │ Carpentry                ││
│  │ [Match]            [···] ││
│  └──────────────────────────┘│
│                               │
└──────────────────────────────┘
```

---

## 10. Data Copy/Import Flows

### 10.1 Import Template from Excel

**Feature:** Import 50 tasks from Excel file

```
User Flow:
1. Admin → Schedule Templates → [+ New Template]
2. Click [Import from Excel]
3. Upload file: "NDIS Template.xlsx"
4. System parses Excel:
   ├─ Column A: Task Name
   ├─ Column B: Trade/Category
   ├─ Column C: Duration (days)
   ├─ Column D: Predecessors (e.g., "2FS+1")
   └─ Column E: Flags (PO required, etc.)
5. Preview import (50 rows)
6. Click [Confirm Import]
7. System creates 50 ScheduleTemplateRows
8. Success: "Imported 50 tasks"
```

**Excel Format:**
```
| Task Name     | Trade      | Duration | Predecessors | PO Required |
|---------------|------------|----------|--------------|-------------|
| Site Prep     | Earthworks | 3        | -            | Yes         |
| Foundation    | Concrete   | 5        | 1FS+1        | Yes         |
| Frame Walls   | Carpentry  | 7        | 2FS          | Yes         |
| Windows       | Carpentry  | 2        | 3FS+2        | Yes         |
| ...           | ...        | ...      | ...          | ...         |
```

### 10.2 Copy Template

**Use Case:** User wants to create a variation of existing template

```
User Flow:
1. Admin → Schedule Templates
2. Find "Residential NDIS Build"
3. Click [Duplicate]
4. Modal opens:
   ┌────────────────────────────────────┐
   │ Duplicate Template                 │
   ├────────────────────────────────────┤
   │ New Template Name:                 │
   │ ┌────────────────────────────────┐ │
   │ │ Residential NDIS Build - Copy  │ │
   │ └────────────────────────────────┘ │
   │                                    │
   │ ☑ Include all tasks (50)           │
   │ ☑ Include dependencies             │
   │ ☐ Set as default                   │
   │                                    │
   │          [Cancel] [Create Copy]    │
   └────────────────────────────────────┘
5. Click [Create Copy]
6. System creates:
   ├─ New ScheduleTemplate record
   └─ 50 new ScheduleTemplateRow records (duplicated)
7. Redirect to edit new template
8. User modifies tasks as needed
```

### 10.3 Apply Template (Copy to Job)

**This is the CORE workflow:**

```
┌─────────────────────────────────────────────────────────────┐
│                  TEMPLATE → JOB COPY FLOW                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  BEFORE (Template)                                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ScheduleTemplate: "Residential NDIS Build"           │  │
│  │                                                       │  │
│  │ ScheduleTemplateRows:                                │  │
│  │   #1: Site Prep       (3d, Earthworks)               │  │
│  │   #2: Foundation      (5d, Concrete, depends on #1)  │  │
│  │   #3: Frame Walls     (7d, Carpentry, depends on #2) │  │
│  │   ... (47 more)                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│                           ↓                                  │
│                  USER CLICKS "APPLY TEMPLATE"                │
│                           ↓                                  │
│                                                              │
│  AFTER (Job)                                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Job: "123 Smith St, Brisbane"                        │  │
│  │                                                       │  │
│  │ SmTasks: (COPIED from template)                      │  │
│  │   #1: Site Prep                                       │  │
│  │       - job_id = 123                                  │  │
│  │       - template_row_id = 1 (link back)              │  │
│  │       - name = "Site Prep" (COPIED)                  │  │
│  │       - duration_days = 3 (COPIED)                   │  │
│  │       - trade = "Earthworks" (COPIED)                │  │
│  │       - start_date = Dec 1 (CALCULATED)              │  │
│  │       - end_date = Dec 3 (CALCULATED)                │  │
│  │       - status = "not_started" (DEFAULT)             │  │
│  │       - purchase_order_id = null (DEFAULT)           │  │
│  │                                                       │  │
│  │   #2: Foundation                                      │  │
│  │       - job_id = 123                                  │  │
│  │       - template_row_id = 2                          │  │
│  │       - name = "Foundation" (COPIED)                 │  │
│  │       - duration_days = 5 (COPIED)                   │  │
│  │       - start_date = Dec 4 (CALCULATED from dep)     │  │
│  │       ...                                             │  │
│  │                                                       │  │
│  │   SmDependencies: (COPIED from template)             │  │
│  │     #2 depends on #1 (FS+1)                          │  │
│  │     #3 depends on #2 (FS)                            │  │
│  │     ...                                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  KEY POINTS:                                                 │
│  ✓ Each job gets its OWN copy of tasks                      │
│  ✓ Tasks can be modified per job                            │
│  ✓ Template changes DON'T affect existing jobs              │
│  ✓ Link back via template_row_id preserved                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Summary: The Copy Pattern

### The Key Concept

**Schedule Master uses a "Copy Template" pattern:**

1. **Templates are blueprints** (like cookie cutters)
2. **Jobs get copies** (like cookies made from the cutter)
3. **Each job is independent** (decorating one cookie doesn't affect others)
4. **Link back for reference** (can see which cutter made it)

### What Gets Copied

```
From ScheduleTemplateRow → SmTask:

✓ name               (e.g., "Foundation")
✓ duration_days      (e.g., 5)
✓ trade              (e.g., "Concrete")
✓ supplier_id        (e.g., 42)
✓ po_required        (e.g., true)
✓ require_photo      (e.g., false)
✓ ... (all template fields)

What's NOT copied (job-specific):
✗ start_date         (calculated based on job start)
✗ end_date           (calculated from start + duration)
✗ status             (defaults to "not_started")
✗ purchase_order_id  (user matches later)
✗ manually_positioned (defaults to false)
```

### Visual Analogy

```
TEMPLATE = COOKIE CUTTER
┌─────────────────────────┐
│  ⭐ NDIS Build Template │
│                         │
│  [Shape/Structure]      │
│  - 50 tasks             │
│  - Dependencies         │
│  - Durations            │
│  - Trades               │
└─────────────────────────┘
         │
         │ APPLY TO JOB
         ↓
┌─────────────────────────┐
│  JOB: 123 Smith St      │
│                         │
│  [Copy of structure]    │
│  + Job-specific data:   │
│    - Actual dates       │
│    - PO links           │
│    - Status tracking    │
│    - Custom changes     │
└─────────────────────────┘
```

---

## Final Notes

- **Performance:** All screens load <100ms (queries optimized with indexes)
- **Mobile:** All views responsive, touch-friendly
- **Dark Mode:** All components support dark mode
- **Accessibility:** WCAG 2.1 AA compliant
- **Real-time:** WebSocket updates for multi-user (Phase 2)

**Questions? Ready to implement specific screens?** 🚀
