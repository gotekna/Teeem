# Phase 5: ProjectTask → SmTask Migration Plan

**Status:** Phase 5a-c COMPLETE (Dual-write active)
**Last Updated:** 2025-12-22
**Estimated Effort:** 6-8 months
**Risk Level:** HIGH - Core business functionality

---

## Overview

ProjectTask is used by multiple systems that need to be migrated to SmTask. This document outlines the incremental migration strategy.

## Current ProjectTask Usage Map

| System | Files | Risk | Status |
|--------|-------|------|--------|
| **WHS Action Items** | `whs_action_item.rb` | Medium | ✅ DUAL-WRITE ACTIVE |
| **WHS Incidents** | `whs_incident.rb` | Medium | ✅ DUAL-WRITE ACTIVE |
| **WHS SWMS** | `whs_swms.rb` | Medium | ✅ DUAL-WRITE ACTIVE |
| **Meeting Actions** | `meeting_agenda_item.rb` | Low | ✅ DUAL-WRITE ACTIVE |
| **Template Instantiation** | `schedule/template_instantiator.rb` | High | ⏳ PENDING |
| **Task Spawner** | `schedule/task_spawner.rb` | High | ⏳ PENDING |
| **Task Dependencies** | `task_dependency.rb` | High | ⏳ PENDING |
| **Project Tasks Controller** | `project_tasks_controller.rb` | High | ⏳ PENDING |

## Completed Work (2025-12-22)

### Migration `20251222110000_add_sm_task_to_safety_models.rb`
Added `sm_task_id` column to:
- `whs_action_items`
- `whs_incidents`
- `whs_swms`
- `meeting_agenda_items`

### Model Updates
All four models now have:
- `belongs_to :sm_task, optional: true`
- `after_create :create_sm_task_if_needed` - Creates SmTask in parallel
- `after_save :sync_with_sm_task` - Syncs status changes
- Status mapping methods (e.g., `status_for_sm_task`)

### Backfill Rake Tasks
```bash
rails phase5:status              # Show migration status
rails phase5:backfill:all        # Backfill all models
rails phase5:backfill:whs_actions
rails phase5:backfill:whs_incidents
rails phase5:backfill:whs_swms
rails phase5:backfill:meetings
```

---

## Migration Strategy: Dual-Write Pattern

Rather than a big-bang migration, we use a dual-write pattern:

1. **Phase 5a:** Add `sm_task_id` column to WHS/Meeting models
2. **Phase 5b:** Update callbacks to create SmTask instead of ProjectTask
3. **Phase 5c:** Migrate existing data (ProjectTask → SmTask)
4. **Phase 5d:** Remove ProjectTask references
5. **Phase 5e:** Delete ProjectTask after validation

---

## Phase 5a: WHS Action Items Migration (Lowest Risk)

### Current Flow:
```ruby
# whs_action_item.rb
after_create :create_project_task_if_needed
def create_project_task_if_needed
  task = project.project_tasks.create!(
    name: "WHS: #{description}",
    task_type: "action",
    category: "WHS",
    ...
  )
  update_column(:project_task_id, task.id)
end
```

### Target Flow:
```ruby
# whs_action_item.rb
after_create :create_sm_task_if_needed
def create_sm_task_if_needed
  task = job.sm_tasks.create!(
    name: "WHS: #{description}",
    trade: "WHS",
    stage: "Action Item",
    ...
  )
  update_column(:sm_task_id, task.id)
end
```

### Migration Steps:

1. Add migration: `add_column :whs_action_items, :sm_task_id, :bigint`
2. Update model to dual-write (create both ProjectTask AND SmTask)
3. Validate SmTask creation works correctly
4. Migrate existing ProjectTask → SmTask for historical data
5. Remove ProjectTask creation
6. Remove project_task_id column after validation period

---

## Phase 5b: WHS Incidents Migration

Similar pattern to Action Items:

1. Add `sm_task_id` column
2. Dual-write both task types
3. Migrate existing data
4. Remove ProjectTask creation

---

## Phase 5c: WHS SWMS Migration

Similar pattern:

1. Add `sm_task_id` column
2. Dual-write
3. Migrate data
4. Remove ProjectTask

---

## Phase 5d: Meeting Actions Migration (Low Risk)

Meeting actions occasionally create tasks. Lower volume than WHS.

1. Add `sm_task_id` to `meeting_agenda_items`
2. Update `created_task` association to point to SmTask
3. Migrate existing linked tasks

---

## Phase 5e: Template Instantiation (HIGH RISK)

This is the core scheduling system. Careful migration required.

### Current:
```ruby
# schedule/template_instantiator.rb
task = ProjectTask.create!(
  project: project,
  schedule_template_row: row,
  ...
)
```

### Target:
Use existing `SmTemplateCopyService` instead.

### Migration:
1. Create feature flag for new vs old instantiation
2. Test SmTemplateCopyService thoroughly
3. Switch to SmTemplateCopyService
4. Deprecate template_instantiator.rb

---

## Phase 5f: Task Spawner (HIGH RISK)

The task spawner creates photo/cert/subtasks when tasks complete.

### Current:
```ruby
# schedule/task_spawner.rb
task = ProjectTask.create!(spawned_type: "photo", ...)
```

### Target:
Create SmTaskSpawnerService that creates SmTask records.

### Migration:
1. Create SmTaskSpawnerService mirroring ProjectTask spawner
2. SmTask already has spawn_type, spawn_on fields
3. Update SmTaskCompletionService to use new spawner
4. Test thoroughly
5. Deprecate old task_spawner.rb

---

## Phase 5g: Task Dependencies

### Current:
`TaskDependency` model points to ProjectTask.

### Target:
Already done - `SmDependency` model points to SmTask.

### Migration:
No migration needed for new tasks. For historical data:
1. For each TaskDependency with both tasks migrated to SmTask
2. Create corresponding SmDependency record
3. Mark TaskDependency as migrated

---

## Database Changes Required

```ruby
# Migration 1: Add sm_task references
add_column :whs_action_items, :sm_task_id, :bigint
add_column :whs_incidents, :sm_task_id, :bigint
add_column :whs_swms, :sm_task_id, :bigint
add_column :meeting_agenda_items, :sm_task_id, :bigint

add_foreign_key :whs_action_items, :tasks, column: :sm_task_id
add_foreign_key :whs_incidents, :tasks, column: :sm_task_id
add_foreign_key :whs_swms, :tasks, column: :sm_task_id
add_foreign_key :meeting_agenda_items, :tasks, column: :sm_task_id
```

---

## Feature Flags

Use feature flags to control rollout:

```ruby
# config/features.yml
whs_uses_sm_task: false      # Phase 5a-c
meetings_use_sm_task: false   # Phase 5d
templates_use_sm_task: false  # Phase 5e
spawner_uses_sm_task: false   # Phase 5f
```

---

## Rollback Strategy

Each phase should be independently rollbackable:

1. Feature flag to disable new behavior
2. Dual-write means old system still works
3. Can delete SmTask records if rollback needed
4. ProjectTask remains untouched until final cleanup

---

## Success Criteria

### Per-Phase:
- [ ] All new records created as SmTask
- [ ] Existing ProjectTask still works (dual-write)
- [ ] Frontend displays correctly
- [ ] No data loss

### Final:
- [ ] ProjectTask model deprecated
- [ ] TaskDependency model deprecated
- [ ] All WHS/Meeting tasks are SmTasks
- [ ] Template instantiation uses SmTemplateCopyService
- [ ] Task spawning uses SmTaskSpawnerService

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 5a: WHS Action Items | 2 weeks | None |
| 5b: WHS Incidents | 1 week | 5a complete |
| 5c: WHS SWMS | 1 week | 5b complete |
| 5d: Meeting Actions | 1 week | None |
| 5e: Template Instantiation | 4 weeks | SmTemplateCopyService |
| 5f: Task Spawner | 3 weeks | 5e complete |
| 5g: Dependencies | 2 weeks | 5f complete |
| Testing & Validation | 4 weeks | All phases |
| Cleanup | 2 weeks | Validation complete |

**Total: ~20 weeks (5 months)**

---

## Files to Modify

### WHS Migration:
- `app/models/whs_action_item.rb`
- `app/models/whs_incident.rb`
- `app/models/whs_swms.rb`
- `app/controllers/api/v1/whs_action_items_controller.rb`
- `app/controllers/api/v1/whs_incidents_controller.rb`
- `app/controllers/api/v1/whs_swms_controller.rb`

### Meeting Migration:
- `app/models/meeting_agenda_item.rb`
- `app/controllers/api/v1/meeting_agenda_items_controller.rb`

### Template/Spawner Migration:
- `app/services/schedule/template_instantiator.rb` → deprecate
- `app/services/schedule/task_spawner.rb` → deprecate
- `app/services/sm_template_copy_service.rb` → enhance
- Create: `app/services/sm_task_spawner_service.rb`

### Final Cleanup:
- `app/models/project_task.rb` → delete
- `app/models/task_dependency.rb` → delete
- `app/controllers/api/v1/project_tasks_controller.rb` → delete

---

## Next Steps

1. [ ] Start with Phase 5a: WHS Action Items
2. [ ] Create migration for sm_task_id column
3. [ ] Update whs_action_item.rb with dual-write
4. [ ] Test in development
5. [ ] Deploy with feature flag off
6. [ ] Enable feature flag in staging
7. [ ] Validate and enable in production
