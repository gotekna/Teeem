# Phase 6: Deprecated Code Deletion Audit

**Created:** 2025-12-22
**Status:** TIER 1 COMPLETE - Tier 2-4 pending validation

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

### Tier 2: ScheduleTemplate System (Safe to Delete)
**Reason:** Frontend migrated to SmTemplate, ScheduleMasterTab uses `/api/v1/sm_templates`

| Type | File | Lines | Notes |
|------|------|-------|-------|
| Model | `app/models/schedule_template.rb` | ~150 | DEPRECATED marker present |
| Model | `app/models/schedule_template_row.rb` | ~200 | Child of ScheduleTemplate |
| Controller | `app/controllers/api/v1/schedule_templates_controller.rb` | ~300 | Old CRUD |
| Controller | `app/controllers/api/v1/schedule_template_rows_controller.rb` | ~200 | Nested controller |

**Routes to remove:**
```ruby
# backend/config/routes.rb lines 1083-1098
resources :schedule_templates
```

**Database tables to drop (migration needed):**
- `schedule_templates`
- `schedule_template_rows`

---

### Tier 3: Schedule Services (Delete After Tiers 1-2)
**Reason:** Only used by old ScheduleTask/ProjectTask system

| Type | File | Lines | Notes |
|------|------|-------|-------|
| Service | `app/services/schedule/template_instantiator.rb` | 280 | Creates ProjectTask from ScheduleTemplate |
| Service | `app/services/schedule/task_spawner.rb` | 156 | Spawns ProjectTask children |
| Service | `app/services/schedule/generator_service.rb` | ~300 | Schedule generation |

**Replacements (already exist):**
- `template_instantiator.rb` → `SmTemplateCopyService`
- `task_spawner.rb` → `SmTaskCompletionService`
- `generator_service.rb` → SmTask + SmDependency system

---

### Tier 4: ProjectTask System (Delete LAST - After Full Validation)
**Reason:** Still used by WHS/Meetings in dual-write mode

| Type | File | Lines | Notes |
|------|------|-------|-------|
| Model | `app/models/project_task.rb` | ~250 | WHS/Meeting still create these |
| Model | `app/models/project_task_checklist_item.rb` | ~50 | Child model |
| Model | `app/models/task_dependency.rb` | 73 | Old dependency system |
| Model | `app/models/task_update.rb` | ~50 | Task history |
| Controller | `app/controllers/api/v1/project_tasks_controller.rb` | ~400 | CRUD + gantt |

**BLOCKING DEPENDENCIES (must resolve first):**
1. `whs_action_item.rb` - has `belongs_to :project_task`
2. `whs_incident.rb` - creates project_tasks via callback
3. `whs_swms.rb` - creates project_tasks via callback
4. `meeting_agenda_item.rb` - has `belongs_to :created_task` (ProjectTask)

**Pre-deletion steps:**
1. Stop dual-write (remove old callbacks)
2. Remove `project_task_id` from WHS models
3. Remove `created_task_id` from MeetingAgendaItem
4. Run migration to drop columns

**Routes to remove:**
```ruby
# backend/config/routes.rb line 411
resources :tasks, controller: "project_tasks"
```

**Database tables to drop:**
- `project_tasks`
- `project_task_checklist_items`
- `task_dependencies`
- `task_updates`

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

## MIGRATION SCRIPT (Phase 6)

```ruby
# db/migrate/XXXXXX_remove_deprecated_schedule_tables.rb
class RemoveDeprecatedScheduleTables < ActiveRecord::Migration[8.0]
  def change
    # Tier 1: ScheduleTask
    drop_table :schedule_task_checklist_items, if_exists: true
    drop_table :schedule_tasks, if_exists: true

    # Tier 2: ScheduleTemplate
    drop_table :schedule_template_rows, if_exists: true
    drop_table :schedule_templates, if_exists: true
  end
end

# db/migrate/XXXXXX_remove_project_task_system.rb (LATER)
class RemoveProjectTaskSystem < ActiveRecord::Migration[8.0]
  def change
    # Remove FKs first
    remove_column :whs_action_items, :project_task_id, if_exists: true
    remove_column :meeting_agenda_items, :created_task_id, if_exists: true

    # Then drop tables
    drop_table :task_updates, if_exists: true
    drop_table :task_dependencies, if_exists: true
    drop_table :project_task_checklist_items, if_exists: true
    drop_table :project_tasks, if_exists: true
  end
end
```

---

## ROUTES CLEANUP

```ruby
# Remove from backend/config/routes.rb:

# Lines 293-297 (schedule_tasks nested)
# Lines 390-408 (schedule_tasks resources)
# Line 411 (project_tasks as tasks)
# Line 974 (sync_schedule_templates)
# Lines 1083-1098 (schedule_templates resources)
```

---

## SUMMARY

| Tier | Files | Tables | Status |
|------|-------|--------|--------|
| 1: ScheduleTask | 4 | 2 | ✅ COMPLETE (2025-12-22) |
| 2: ScheduleTemplate | 4 | 2 | ⏳ Ready to delete |
| 3: Services | 3 | 0 | ⏳ After Tier 2 |
| 4: ProjectTask | 5 | 4 | ⏳ After WHS validation |

**Deleted:** 4 files, 2 tables
**Remaining:** 12 files, 6 tables

---

## VALIDATION CHECKLIST (Before Each Tier)

- [ ] Run `rails phase5:status` - confirm no active usage
- [ ] Check Sentry for errors related to deprecated endpoints
- [ ] Verify frontend doesn't call old APIs
- [ ] Create database backup
- [ ] Test in staging first
