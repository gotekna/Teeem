# SM Gantt Developer Guide

> Schedule Master Gantt System - Complete Technical Documentation

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Phase 1: Core Gantt](#phase-1-core-gantt)
4. [Phase 2: Resource Allocation & Timesheet](#phase-2-resource-allocation--timesheet)
5. [Phase 3: Mobile & Field](#phase-3-mobile--field)
6. [Phase 3: Collaboration](#phase-3-collaboration)
7. [Advanced Analytics](#advanced-analytics)
8. [AI Enhancements](#ai-enhancements)
9. [Integrations](#integrations)
10. [API Reference](#api-reference)
11. [Database Schema](#database-schema)
12. [Frontend Components](#frontend-components)

---

## Overview

SM Gantt is a comprehensive construction scheduling system built into TRAPID. It provides:

- Interactive Gantt chart visualization
- Task management with dependencies
- Resource allocation and timesheet tracking
- Mobile field worker interface with offline support
- Activity feeds and collaboration tools
- Advanced analytics (Critical Path, EVM, Baselines)
- AI-powered scheduling suggestions
- MS Project import/export
- Calendar sync and notifications

---

## Architecture

### Backend (Ruby on Rails)

```
app/
├── models/
│   ├── sm_task.rb                    # Core task model
│   ├── sm_dependency.rb              # Task dependencies
│   ├── sm_resource.rb                # Resources (labor, equipment, materials)
│   ├── sm_resource_allocation.rb     # Resource-to-task assignments
│   ├── sm_time_entry.rb              # Timesheet entries
│   ├── sm_task_photo.rb              # Task photos
│   ├── sm_site_checkin.rb            # GPS check-ins
│   ├── sm_voice_note.rb              # Voice recordings
│   ├── sm_activity.rb                # Activity feed
│   ├── sm_comment.rb                 # Task comments
│   ├── sm_comment_mention.rb         # @mentions
│   ├── sm_baseline.rb                # Schedule baselines
│   ├── sm_baseline_task.rb           # Baseline task snapshots
│   ├── sm_notification_setting.rb    # User notification prefs
│   └── sm_supplier_access.rb         # Supplier portal tokens
│
├── controllers/api/v1/
│   ├── sm_tasks_controller.rb
│   ├── sm_dependencies_controller.rb
│   ├── sm_resources_controller.rb
│   ├── sm_resource_allocations_controller.rb
│   ├── sm_time_entries_controller.rb
│   ├── sm_field_controller.rb
│   ├── sm_activities_controller.rb
│   ├── sm_comments_controller.rb
│   ├── sm_analytics_controller.rb
│   ├── sm_ai_controller.rb
│   ├── sm_integrations_controller.rb
│   └── portal/sm_tasks_controller.rb
│
├── services/
│   ├── sm_dashboard_service.rb       # Dashboard aggregations
│   ├── sm_timesheet_service.rb       # Timesheet calculations
│   ├── sm_activity_service.rb        # Activity tracking
│   ├── sm_critical_path_service.rb   # CPM calculations
│   ├── sm_evm_service.rb             # Earned Value Management
│   ├── sm_ai_service.rb              # AI suggestions/predictions
│   └── sm_ms_project_service.rb      # MS Project import/export
│
└── mailers/
    └── sm_notification_mailer.rb     # Email notifications
```

### Frontend (React)

```
src/
├── pages/
│   ├── SmGanttPage.jsx               # Main Gantt view
│   ├── SmSetupPage.jsx               # Admin setup
│   ├── SmResourcesPage.jsx           # Resource management
│   ├── SmDashboardPage.jsx           # Reports dashboard
│   ├── SmFieldPage.jsx               # Mobile field interface
│   ├── SmAnalyticsPage.jsx           # Analytics & AI
│   └── portal/
│       └── PortalSchedule.jsx        # Supplier schedule view
│
├── components/sm-gantt/
│   ├── SmGanttChart.jsx              # Gantt chart component
│   ├── SmResourceGantt.jsx           # Resource Gantt view
│   ├── SmTimesheet.jsx               # Timesheet component
│   ├── SmTaskModal.jsx               # Task edit modal
│   ├── SmDependencyModal.jsx         # Dependency editor
│   ├── SmCascadeModal.jsx            # Cascade changes
│   ├── SmDashboardCharts.jsx         # Dashboard charts
│   ├── SmFieldComponents.jsx         # Mobile components
│   ├── SmCollaborationComponents.jsx # Activity/Comments
│   ├── SmAnalyticsComponents.jsx     # Analytics/AI components
│   └── index.js                      # Exports
│
└── services/
    ├── api.js                        # Main API client
    └── portalApi.js                  # Portal API client
```

---

## Phase 1: Core Gantt

### Models

#### SmTask
Core task model with the following key fields:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Task name |
| `start_date` | date | Planned start |
| `end_date` | date | Planned end |
| `duration_days` | integer | Duration in days |
| `status` | enum | `not_started`, `started`, `completed` |
| `trade` | string | Trade/category |
| `task_number` | integer | Display order |
| `parent_task_id` | integer | Parent for subtasks |
| `supplier_id` | integer | Assigned supplier (Contact) |
| `wbs_code` | string | Work breakdown structure |

#### SmDependency
Task relationships:

| Field | Type | Description |
|-------|------|-------------|
| `predecessor_task_id` | integer | Predecessor task |
| `successor_task_id` | integer | Successor task |
| `dependency_type` | string | `finish_to_start`, `start_to_start`, etc. |
| `lag_days` | integer | Lag/lead time |

### Key Endpoints

```
GET    /api/v1/constructions/:id/sm_tasks          # List tasks
POST   /api/v1/constructions/:id/sm_tasks          # Create task
GET    /api/v1/sm_tasks/:id                        # Get task
PATCH  /api/v1/sm_tasks/:id                        # Update task
DELETE /api/v1/sm_tasks/:id                        # Delete task
POST   /api/v1/sm_tasks/:id/start                  # Start task
POST   /api/v1/sm_tasks/:id/complete               # Complete task
POST   /api/v1/sm_tasks/:id/move                   # Move task dates
POST   /api/v1/sm_tasks/:id/cascade_preview        # Preview cascade
POST   /api/v1/sm_tasks/:id/cascade_execute        # Execute cascade
```

---

## Phase 2: Resource Allocation & Timesheet

### Models

#### SmResource
Resources that can be assigned to tasks:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Resource name |
| `resource_type` | enum | `labor`, `equipment`, `material` |
| `trade` | string | Trade specialty |
| `hourly_rate` | decimal | Cost per hour |
| `daily_capacity_hours` | decimal | Hours available per day |
| `contact_id` | integer | Linked contact |
| `user_id` | integer | Linked user |

#### SmResourceAllocation
Assigns resources to tasks:

| Field | Type | Description |
|-------|------|-------------|
| `sm_task_id` | integer | Task |
| `sm_resource_id` | integer | Resource |
| `allocated_hours` | decimal | Planned hours |
| `status` | enum | `pending`, `confirmed`, `started`, `completed` |

#### SmTimeEntry
Actual time logged:

| Field | Type | Description |
|-------|------|-------------|
| `sm_task_id` | integer | Task |
| `sm_resource_id` | integer | Resource |
| `work_date` | date | Date worked |
| `hours` | decimal | Hours worked |
| `status` | enum | `draft`, `submitted`, `approved` |
| `notes` | text | Work notes |

### Key Endpoints

```
# Resources
GET    /api/v1/sm_resources                        # List resources
POST   /api/v1/sm_resources                        # Create resource
GET    /api/v1/sm_resources/:id/schedule           # Resource schedule
GET    /api/v1/sm_resources/availability           # Check availability
GET    /api/v1/sm_resources/utilization            # Utilization report

# Allocations
GET    /api/v1/sm_tasks/:id/resource_allocations   # Task allocations
POST   /api/v1/sm_tasks/:id/resource_allocations   # Assign resource
POST   /api/v1/sm_resource_allocations/:id/confirm # Confirm allocation

# Time Entries
GET    /api/v1/sm_time_entries/timesheet           # Timesheet view
POST   /api/v1/sm_time_entries/log_time            # Log time
POST   /api/v1/sm_time_entries/:id/approve         # Approve entry
GET    /api/v1/sm_time_entries/export_payroll      # Export for payroll
```

### Services

#### SmTimesheetService
```ruby
SmTimesheetService.resource_timesheet(resource, start_date, end_date)
SmTimesheetService.weekly_summary(resource, week_start)
SmTimesheetService.pending_approvals(construction)
SmTimesheetService.export_payroll(construction, date_range)
```

---

## Phase 3: Mobile & Field

### Models

#### SmTaskPhoto
Photos attached to tasks:

| Field | Type | Description |
|-------|------|-------------|
| `sm_task_id` | integer | Task |
| `photo_url` | string | Cloudinary URL |
| `photo_type` | enum | `completion`, `progress`, `issue`, `before`, `after` |
| `caption` | text | Photo description |
| `latitude/longitude` | decimal | GPS coordinates |
| `uploaded_by_id` | integer | User who uploaded |

#### SmSiteCheckin
GPS check-ins for site attendance:

| Field | Type | Description |
|-------|------|-------------|
| `construction_id` | integer | Job site |
| `resource_id` | integer | Resource checking in |
| `checkin_type` | enum | `arrival`, `departure` |
| `latitude/longitude` | decimal | GPS coordinates |
| `distance_from_site` | decimal | Calculated distance |

#### SmVoiceNote
Audio recordings:

| Field | Type | Description |
|-------|------|-------------|
| `sm_task_id` | integer | Task |
| `audio_url` | string | Cloudinary URL |
| `duration_seconds` | integer | Recording length |
| `transcription` | text | AI transcription |

### Key Endpoints

```
# Photos
POST   /api/v1/sm_field/upload_photo               # Upload photo
GET    /api/v1/sm_tasks/:id/photos                 # Task photos
DELETE /api/v1/sm_field/photos/:id                 # Delete photo

# Check-ins
POST   /api/v1/sm_field/checkin                    # GPS check-in
GET    /api/v1/sm_field/checkins                   # List check-ins
GET    /api/v1/sm_field/site_status/:id            # Who's on site

# Voice Notes
POST   /api/v1/sm_field/record_voice_note          # Upload voice note
GET    /api/v1/sm_tasks/:id/voice_notes            # Task voice notes
POST   /api/v1/sm_field/voice_notes/:id/transcribe # Transcribe

# Offline Sync
POST   /api/v1/sm_field/sync                       # Batch sync offline data
```

### Frontend Components

#### SmFieldPage
Mobile-optimized page at `/jobs/:constructionId/field`

Features:
- Task list view
- Photo capture with camera
- GPS check-in with distance from site
- Voice note recording
- Offline queue with localStorage
- Auto-sync when online

#### PWA Support
- Service worker at `/public/sw.js`
- Manifest at `/public/manifest.json`
- Cache-first for static assets
- Network-first for API with offline fallback

---

## Phase 3: Collaboration

### Models

#### SmActivity
Activity feed tracking:

| Field | Type | Description |
|-------|------|-------------|
| `activity_type` | enum | See types below |
| `construction_id` | integer | Job |
| `user_id` | integer | Actor |
| `sm_task_id` | integer | Related task |
| `trackable` | polymorphic | Changed object |
| `metadata` | json | Activity details |

Activity types:
- `task_created`, `task_updated`, `task_status_changed`, `task_deleted`
- `resource_assigned`, `resource_removed`
- `photo_uploaded`, `voice_note_added`
- `checkin_arrival`, `checkin_departure`
- `comment_added`, `milestone_reached`

#### SmComment
Task discussions with threading:

| Field | Type | Description |
|-------|------|-------------|
| `sm_task_id` | integer | Task |
| `author_id` | integer | User |
| `body` | text | Comment text |
| `parent_id` | integer | Parent for replies |

#### SmCommentMention
Tracks @mentions:

| Field | Type | Description |
|-------|------|-------------|
| `sm_comment_id` | integer | Comment |
| `user_id` | integer | Mentioned user |
| `read_at` | datetime | When read |

### Key Endpoints

```
# Activities
GET    /api/v1/constructions/:id/sm_activities     # Activity feed
GET    /api/v1/sm_tasks/:id/activities             # Task activities
GET    /api/v1/sm_activities/summary               # Activity summary

# Comments
GET    /api/v1/sm_tasks/:id/comments               # List comments
POST   /api/v1/sm_tasks/:id/comments               # Add comment
POST   /api/v1/sm_comments/:id/reply               # Reply to comment
GET    /api/v1/sm_comments/mentions                # My mentions
POST   /api/v1/sm_comments/mentions/read_all       # Mark all read
```

### Services

#### SmActivityService
```ruby
SmActivityService.task_created(task, user: current_user)
SmActivityService.task_updated(task, user: current_user, changes: task.changes)
SmActivityService.photo_uploaded(photo, user: current_user)
SmActivityService.checkin(checkin, user: current_user)
SmActivityService.feed(construction_id: id, filters: { today: true })
```

### Supplier Portal

Suppliers access their tasks at `/portal/schedule`:

```
GET    /api/v1/portal/sm_tasks                     # Supplier's tasks
GET    /api/v1/portal/sm_tasks/:id                 # Task detail
PATCH  /api/v1/portal/sm_tasks/:id                 # Confirm schedule
POST   /api/v1/portal/sm_tasks/:id/add_comment     # Add comment
POST   /api/v1/portal/sm_tasks/:id/upload_photo    # Upload photo
```

---

## Advanced Analytics

### Critical Path Method (CPM)

#### SmCriticalPathService
Calculates critical path using forward/backward pass:

```ruby
result = SmCriticalPathService.calculate(construction)
# Returns:
{
  critical_path: [{ id: 1, name: "Task", duration: 5 }, ...],
  project_duration: 120,
  tasks: {
    1 => { es: 0, ef: 5, ls: 0, lf: 5, float: 0, is_critical: true }
  },
  summary: {
    total_tasks: 50,
    critical_tasks: 12,
    average_float: 3.5
  }
}

# What-if analysis
SmCriticalPathService.delay_impact(construction, task_id, delay_days)
```

### Earned Value Management (EVM)

#### SmEvmService
Full EVM calculations:

```ruby
result = SmEvmService.calculate(construction, as_of_date: Date.current)
# Returns:
{
  core_values: { pv: 100000, ev: 85000, ac: 90000, bac: 150000 },
  variances: { sv: -15000, cv: -5000 },
  indices: { spi: 0.85, cpi: 0.94 },
  forecasts: { eac: 159574, etc: 69574, vac: -9574 },
  progress: { percent_complete: 56.7, schedule_status: "behind" },
  health: "fair"
}

# S-curve data for charts
SmEvmService.s_curve(construction)
```

### Baselines

#### SmBaseline
Schedule snapshots for variance tracking:

```ruby
# Create baseline
baseline = SmBaseline.create_snapshot(
  construction,
  name: "Original Schedule",
  created_by: current_user
)

# Compare to current
comparison = baseline.compare_to_current
# Returns variance for each task
```

### Key Endpoints

```
GET    /api/v1/constructions/:id/sm_analytics/critical_path
GET    /api/v1/constructions/:id/sm_analytics/delay_impact
GET    /api/v1/constructions/:id/sm_analytics/evm
GET    /api/v1/constructions/:id/sm_analytics/s_curve
GET    /api/v1/constructions/:id/sm_analytics/baselines
POST   /api/v1/constructions/:id/sm_analytics/baselines
GET    /api/v1/constructions/:id/sm_analytics/baselines/:id/compare
GET    /api/v1/constructions/:id/sm_analytics/variance
GET    /api/v1/constructions/:id/sm_analytics/summary
```

---

## AI Enhancements

### SmAiService

#### Scheduling Suggestions
```ruby
suggestions = SmAiService.suggestions(construction)
# Types: parallel_opportunity, resource_conflict, crash_opportunity,
#        fast_track, bottleneck
```

#### Delay Predictions
```ruby
predictions = SmAiService.predictions(construction)
# Returns risk_score (0-1), risk_level, factors, recommended_actions
```

#### Resource Optimization
```ruby
optimization = SmAiService.optimize_resources(construction)
# Detects: overallocation, underutilization, unassigned tasks
```

#### Duration Estimation
```ruby
SmAiService.estimate_duration(task_name: "Framing", trade: "carpentry")
# Returns estimate based on historical data
```

### Key Endpoints

```
GET    /api/v1/constructions/:id/sm_ai/suggestions
GET    /api/v1/constructions/:id/sm_ai/predictions
GET    /api/v1/constructions/:id/sm_ai/resource_optimization
GET    /api/v1/constructions/:id/sm_ai/summary
POST   /api/v1/sm_ai/estimate_duration
```

---

## Integrations

### MS Project Import/Export

#### SmMsProjectService
```ruby
# Import from MS Project XML
result = SmMsProjectService.import(construction, xml_content)
# Creates tasks and dependencies from XML

# Export to MS Project XML
xml = SmMsProjectService.export(construction)
# Generates compatible XML file
```

### Calendar Sync

Endpoints for Google/Outlook calendar sync (OAuth required):

```
POST   /api/v1/sm_integrations/sync_calendar
GET    /api/v1/sm_integrations/calendar_events
```

### Notifications

#### SmNotificationMailer
Email templates for:
- `task_reminder` - Upcoming task reminder
- `schedule_update` - Task date changed
- `delay_alert` - Task at risk
- `completion_notice` - Task completed
- `daily_digest` - Daily summary

#### Settings
```
GET    /api/v1/sm_integrations/notification_settings
PATCH  /api/v1/sm_integrations/notification_settings
```

---

## API Reference

### Authentication
All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

Portal endpoints use separate portal authentication.

### Common Response Format
```json
{
  "success": true,
  "data": { ... },
  "errors": []
}
```

### Pagination
List endpoints support:
- `page` - Page number (default: 1)
- `per_page` - Items per page (default: 25)
- `limit` - Max items

### Filtering
Most list endpoints support query params for filtering:
- `status` - Filter by status
- `trade` - Filter by trade
- `resource_id` - Filter by resource
- `date` / `start_date` / `end_date` - Date filters

---

## Database Schema

### Migrations Required

```ruby
# Core tables
create_table :sm_tasks
create_table :sm_dependencies
create_table :sm_resources
create_table :sm_resource_allocations
create_table :sm_time_entries

# Field tables
create_table :sm_task_photos
create_table :sm_site_checkins
create_table :sm_voice_notes

# Collaboration tables
create_table :sm_activities
create_table :sm_comments
create_table :sm_comment_mentions

# Analytics tables
create_table :sm_baselines
create_table :sm_baseline_tasks

# Settings tables
create_table :sm_notification_settings
create_table :sm_supplier_accesses
```

### Key Indexes

```ruby
add_index :sm_tasks, :construction_id
add_index :sm_tasks, :start_date
add_index :sm_tasks, :status
add_index :sm_tasks, :supplier_id
add_index :sm_dependencies, [:predecessor_task_id, :successor_task_id]
add_index :sm_resource_allocations, [:sm_task_id, :sm_resource_id]
add_index :sm_time_entries, [:sm_resource_id, :work_date]
add_index :sm_activities, [:construction_id, :created_at]
```

---

## Frontend Components

### Main Components

| Component | Location | Description |
|-----------|----------|-------------|
| `SmGanttChart` | `SmGanttChart.jsx` | Interactive Gantt chart |
| `SmResourceGantt` | `SmResourceGantt.jsx` | Resource-centric Gantt |
| `SmTimesheet` | `SmTimesheet.jsx` | Timesheet grid |
| `SmTaskModal` | `SmTaskModal.jsx` | Task create/edit modal |

### Dashboard Components

| Component | Description |
|-----------|-------------|
| `ProgressRing` | Circular progress indicator |
| `StatCard` | Metric display card |
| `TrendChart` | Line chart for trends |
| `DonutChart` | Pie/donut chart |
| `UtilizationHeatmap` | Resource utilization grid |

### Field Components

| Component | Description |
|-----------|-------------|
| `PhotoCapture` | Camera access and photo grid |
| `GpsCheckin` | Geolocation check-in |
| `VoiceNotes` | Audio recording |

### Collaboration Components

| Component | Description |
|-----------|-------------|
| `ActivityFeed` | Real-time activity stream |
| `CommentThread` | Threaded comments with replies |
| `MentionsBadge` | Unread mention indicator |

### Analytics Components

| Component | Description |
|-----------|-------------|
| `CriticalPathView` | Critical path visualization |
| `EvmDashboard` | EVM metrics display |
| `AiSuggestionsPanel` | AI suggestions/predictions |
| `BaselineComparison` | Baseline variance view |
| `ImportExportPanel` | MS Project import/export |

---

## Routes Summary

### Frontend Routes

| Route | Page | Description |
|-------|------|-------------|
| `/jobs/:id/sm-gantt` | SmGanttPage | Main Gantt view |
| `/jobs/:id/resources` | SmResourcesPage | Resource management |
| `/jobs/:id/sm-dashboard` | SmDashboardPage | Reports dashboard |
| `/jobs/:id/sm-analytics` | SmAnalyticsPage | Analytics & AI |
| `/jobs/:constructionId/field` | SmFieldPage | Mobile field (no nav) |
| `/admin/sm-setup` | SmSetupPage | Admin settings |
| `/portal/schedule` | PortalSchedule | Supplier view |

---

## Environment Variables

```bash
# Required for voice transcription
OPENAI_API_KEY=sk-...

# Required for photo/audio storage
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Optional for calendar sync
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...

# Optional for push notifications
FCM_SERVER_KEY=...
```

---

## Getting Started

1. Run migrations for all SM tables
2. Seed `SmHoldReason` defaults
3. Create `SmTemplate` with rows
4. Create `SmResource` entries for your team
5. Navigate to `/jobs/:id/sm-gantt` to start scheduling

---

## Support

For questions about SM Gantt implementation, refer to:
- This document
- Code comments in service files
- API response examples in controllers

---

*Generated for TRAPID SM Gantt System*
