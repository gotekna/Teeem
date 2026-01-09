# Phase 6: Deprecated Code Deletion Audit

**Created:** 2025-12-22
**Status:** ALL TIERS COMPLETE - SmTask is THE ONE task system

---

## DELETION PRIORITY

### ✅ Tier 1: ScheduleTask System - DELETED (2025-12-22)
**Reason:** Frontend fully migrated to SmTask, no active usage

| Type | File | Status |
|------|------|--------|
| Model | `app/models/schedule_task.rb` | ✅ DELETED |
| Model | `app/models/schedule_task_checklist_item.rb` | ✅ DELETED |
| Controller | `app/controllers/api/v1/schedule_tasks_controller.rb` | ✅ DELETED |
| Controller | `app/controllers/api/v1/schedule_task_checklist_items_controller.rb` | ✅ DELETED |
| Routes | `schedule_tasks` routes | ✅ REMOVED |
| Tables | `schedule_tasks`, `schedule_task_checklist_items` | ✅ DROPPED |

**Migration:** `20251222110001_remove_schedule_task_tables.rb`
**Also Updated:** `purchase_orders_controller.rb` (ScheduleTask → SmTask)

---

### ✅ Tier 2: ScheduleTemplate System - DELETED (2025-12-22)
**Reason:** Frontend migrated to SmTemplate, ScheduleMasterTab uses `/api/v1/sm_templates`

| Type | File | Status |
|------|------|--------|
| Model | `app/models/schedule_template.rb` | ✅ DELETED |
| Model | `app/models/schedule_template_row.rb` | ✅ DELETED |
| Model | `app/models/schedule_template_row_audit.rb` | ✅ DELETED |
| Controller | `app/controllers/api/v1/schedule_templates_controller.rb` | ✅ DELETED |
| Controller | `app/controllers/api/v1/schedule_template_rows_controller.rb` | ✅ DELETED |
| Routes | `schedule_templates` routes + `sync_schedule_templates` | ✅ REMOVED |
| Tables | `schedule_templates`, `schedule_template_rows`, `schedule_template_row_audits` | ✅ DROPPED |

**Migration:** `20251222110002_remove_schedule_template_tables.rb`
**Also Updated:**
- `sm_task.rb` - Removed deprecated `template_row` association
- `sm_setting.rb` - Removed `default_template` association
- `sm_settings_controller.rb` - Updated to use SmTemplate
- `sm_tasks_controller.rb` - Updated to use SmScheduleMaster
- `jobs_controller.rb` - Updated to use SmTemplateCopyService
- `setup_controller.rb` - Removed sync_schedule_templates method
- `user.rb` - Removed `schedule_template_row_audits` association
- `bug_hunter_tests_controller.rb` - Updated to use SmTemplate

---

### ✅ Tier 3: Schedule Services - DELETED (2025-12-22)
**Reason:** Only used by old ScheduleTask/ProjectTask system

| Type | File | Status |
|------|------|--------|
| Service | `app/services/schedule/template_instantiator.rb` | ✅ DELETED |
| Service | `app/services/schedule/task_spawner.rb` | ✅ DELETED |
| Service | `app/services/schedule/generator_service.rb` | ✅ DELETED |
| Service | `app/services/schedule_cascade_service.rb` | ✅ DELETED |
| Spec | `spec/services/schedule_cascade_service_spec.rb` | ✅ DELETED |
| Directory | `app/services/schedule/` | ✅ DELETED |

**Replacements (already exist):**
- `template_instantiator.rb` → `SmTemplateCopyService`
- `task_spawner.rb` → `SmTaskCompletionService`
- `generator_service.rb` → SmTask + SmDependency system
- `schedule_cascade_service.rb` → `SmCascadeService`

---

### ✅ Tier 4: ProjectTask System - DELETED (2025-12-22)
**Reason:** WHS/Meetings migrated to SmTask via dual-write pattern

| Type | File | Status |
|------|------|--------|
| Model | `app/models/project_task.rb` | ✅ DELETED |
| Model | `app/models/project_task_checklist_item.rb` | ✅ DELETED |
| Model | `app/models/task_dependency.rb` | ✅ DELETED |
| Model | `app/models/task_update.rb` | ✅ DELETED |
| Controller | `app/controllers/api/v1/project_tasks_controller.rb` | ✅ DELETED |
| Routes | `resources :tasks, controller: "project_tasks"` (nested under projects) | ✅ REMOVED |
| Tables | `project_tasks`, `project_task_checklist_items`, `task_dependencies`, `task_updates` | ✅ DROPPED |

**Migration:** `20251222110003_remove_project_task_tables.rb`

**Also Updated:**
- `whs_action_item.rb` - Removed `project_task` association, now uses SmTask only
- `whs_incident.rb` - Removed ProjectTask callbacks, now uses SmTask only
- `whs_swms.rb` - Removed ProjectTask callbacks, now uses SmTask only
- `meeting_agenda_item.rb` - Removed `created_task` association, now uses SmTask only
- `purchase_order.rb` - Removed `project_tasks` and `schedule_tasks` associations, uses SmTask
- `project.rb` - Removed `project_tasks` association, helper methods now use SmTask via job
- `task_template.rb` - Removed `project_tasks` association
- `job.rb` - Removed `schedule_tasks` association
- `projects_controller.rb` - Updated gantt action to use SmTask
- `purchase_orders_controller.rb` - Updated includes to use SmTask
- `whs_action_items_controller.rb` - Updated includes and params to use SmTask
- `schema_controller.rb` - Updated table icon mapping

---

## FRONTEND CLEANUP

### Already Deleted (Phase 1)
- ✅ `frontend-next/app/(app)/master-schedule/page.tsx`
- ✅ `frontend-next/app/(app)/gantt/page.tsx`
- ✅ `frontend-next/components/sm-gantt/` directory
- ✅ `frontend-next/app/(app)/admin/system/components/SMGanttTab.tsx`

### To Clean Up (Low Priority)
| File | Issue | Action |
|------|-------|--------|
| `PerformanceTab.tsx:101` | Mock reference to `/api/v1/schedule_tasks` | Update mock data |

---

## SUMMARY

| Tier | Files | Tables | Status |
|------|-------|--------|--------|
| 1: ScheduleTask | 4 | 2 | ✅ COMPLETE (2025-12-22) |
| 2: ScheduleTemplate | 5 | 3 | ✅ COMPLETE (2025-12-22) |
| 3: Services | 5 | 0 | ✅ COMPLETE (2025-12-22) |
| 4: ProjectTask | 5 | 4 | ✅ COMPLETE (2025-12-22) |

**Total Deleted:** 19 files, 9 tables
**Remaining:** 0 files, 0 tables

---

## MIGRATIONS CREATED

```ruby
# Tier 1
db/migrate/20251222110001_remove_schedule_task_tables.rb

# Tier 2
db/migrate/20251222110002_remove_schedule_template_tables.rb

# Tier 4
db/migrate/20251222110003_remove_project_task_tables.rb
```

---

## POST-CLEANUP NOTES

### SmTask is THE ONE Task System (SSoT)

All task functionality now uses the SmTask ecosystem:

| Old System | New System (SSoT) |
|------------|-------------------|
| `ProjectTask` | `SmTask` |
| `ScheduleTask` | `SmTask` |
| `TaskDependency` | `SmDependency` |
| `ScheduleTemplate` | `SmTemplate` |
| `ScheduleTemplateRow` | `SmScheduleMaster` |
| `schedule_cascade_service.rb` | `SmCascadeService` |
| `schedule/task_spawner.rb` | `SmTaskCompletionService` |
| `schedule/template_instantiator.rb` | `SmTemplateCopyService` |

### WHS/Meeting Integration

All WHS and Meeting models now create SmTask via callbacks:
- `WHSActionItem` → creates SmTask on create
- `WHSIncident` → creates SmTask on create
- `WHSSWMS` → creates SmTask on create
- `MeetingAgendaItem` → creates SmTask via `create_action_item!`

Status changes sync bidirectionally between source record and SmTask.
