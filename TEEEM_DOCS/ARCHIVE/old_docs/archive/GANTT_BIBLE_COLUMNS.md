# Gantt Bible - Column Documentation

**Last Updated:** 2025-11-15
**Purpose:** Complete documentation of all Schedule Master columns with implementation details, test coverage, and Bug Hunter test guidelines

---

## 📖 Terminology

**Critical terms used consistently throughout this documentation:**

### Core Concepts

- **Schedule Master (SM)** - The entire feature
  - Settings → Schedule Master tab
  - Includes: Schedule Master Table + Gantt + settings
  - Database: `schedule_templates` table (container)

- **Schedule Master Table (SMT)** - The spreadsheet view with 24 columns
  - Top section of the UI
  - Editable table with Task Name, Duration, Predecessors, etc.
  - Each row = one task

- **Gantt View** (or **Gantt**) - The visual timeline chart (bottom section)
  - Shows tasks as horizontal bars on a calendar
  - Includes dependencies (arrows between tasks)
  - Supports drag-and-drop scheduling
  - Component: `DHtmlxGanttView.jsx`

- **Task** - A thing with a duration
  - Database: `schedule_template_rows` table
  - UI: One row in SMT + one bar in Gantt view
  - Has: name, duration, start date, predecessors (deps)
  - Example: "Foundation" (3 days), "Framing" (5 days)
  - Code: `task`, `row`, `schedule_template_row`

- **Template** - A reusable schedule pattern (e.g., "Standard House Build")
  - Database: `schedule_templates` table
  - Contains multiple tasks in sequence
  - Can be applied to multiple jobs

### Date & Time Concepts
- **Day Offset** - Integer representing days from project start (e.g., 0, 1, 2, 3...)
  - Day 0 = Project start date
  - Stored in database as `start_date` column (integer, NOT timestamp)

- **Working Day** - Monday through Friday, excluding public holidays
  - Weekends: Saturday, Sunday (always excluded)
  - Public holidays: Region-specific (loaded from `public_holidays` table)

- **Reference Date** - The date from which day offsets are calculated
  - Currently: `Date.today` (will be project start date in real implementation)

### Dependency Concepts

- **Dependencies (deps)** - Arrows connecting tasks in the Gantt view
  - Show which tasks must happen before others
  - Stored as: `predecessor_ids` JSONB array
  - Visual: Arrows from predecessor → successor

- **Predecessor** - A task that must happen before another task
  - Example: Foundation is a predecessor of Framing
  - Notation: "1FS" = Task 1 is predecessor with Finish-to-Start type

- **Dependency Type (dep type)** - How tasks relate:
  - **FS** (Finish-to-Start) - Most common: Task B starts when Task A finishes
  - **SS** (Start-to-Start) - Task B starts when Task A starts
  - **FF** (Finish-to-Finish) - Task B finishes when Task A finishes
  - **SF** (Start-to-Finish) - Rare: Task B finishes when Task A starts

- **Lag** - Delay between dependent tasks (in days)
  - Positive lag: Wait N days after predecessor
  - Negative lag: Start N days before predecessor finishes (overlap)
  - Example: "1FS+3" = Start 3 days after Task 1 finishes

### Lock Concepts
- **Lock** or **Locked Task** - Task that cannot be auto-rescheduled
  - Locked tasks ignore working day rules
  - Locked tasks are NOT cascaded TO (but can cascade FROM)

- **Lock Hierarchy** (highest to lowest priority):
  1. `supplier_confirm` - Supplier confirmed the date
  2. `confirm` - Internally confirmed
  3. `start` - Task has started
  4. `complete` - Task is complete
  5. `manually_positioned` - User manually set the date

### Cascade Concepts
- **Cascade** - Auto-updating dependent tasks when a predecessor changes
  - Triggered by: Changing task `start_date` or `duration`
  - Process: Recursively updates all downstream tasks
  - Respects: Lock hierarchy (doesn't cascade TO locked tasks)

---

## 📚 Documentation Maintenance Guide

### What Goes in the Gantt Bible vs Knowledge Source

**Gantt Bible (this file) - THE RULES:**
- ✅ **How we code** - The rules and standards for Schedule Master
- ✅ **Column definitions** - Every column in Schedule Master table and Gantt modal
- ✅ **Working day rules** - How weekends/holidays MUST be handled
- ✅ **Lock hierarchy** - How locks MUST prevent cascading
- ✅ **Business rules** - WHAT the system does and WHY
- ✅ **Code standards** - Where logic belongs (frontend vs backend)
- ✅ **Test coverage requirements** - Which features MUST have Bug Hunter tests

**CLAUDE.md (Knowledge Source) - KNOWN PROBLEMS & SOLUTIONS:**
- ✅ **Problems we've solved** - List of issues encountered and how we fixed them
- ✅ **Workarounds** - Edge cases and how to handle them
- ✅ **Deployment issues** - Problems during deploy and solutions
- ✅ **Agent usage patterns** - When specific agents worked best
- ✅ **Environment quirks** - Heroku, database, API issues and fixes
- ✅ **Common mistakes** - Things that broke and how to avoid them
- ✅ **Workflows that work** - Proven patterns for common tasks
- ❌ **Detailed specs** - Those are rules, belong in Bible

### When to Update the Gantt Bible

**ALWAYS update when you:**
1. Add/remove/modify a column
2. Change how dates are calculated
3. Modify lock behavior or hierarchy
4. Add new working day rules
5. Update cascade logic
6. Add/modify Bug Hunter tests
7. Change database schema for schedule_template_rows

**How to Update:**
1. Find the relevant section (use Ctrl+F)
2. Update the **Implementation** column with new code location
3. Update **Code Location** with exact line numbers
4. Add code snippets if logic changed significantly
5. Update **Last Updated** date at top of file
6. Add examples if behavior changed

### Version Control for Documentation

Every significant change should be logged in the Version History section at the bottom of this file.

**Example entry:**
```markdown
| 2025-11-15 | 1.2 | Added "Working Days Only Rule" - tasks skip to next working day after cascade | Claude Code |
```

### Red Flags - Signs Documentation is Out of Date

🚩 **Code location points to wrong line numbers**
🚩 **Column exists in code but not in Bible**
🚩 **Bible says "TBD" or "TODO" for implemented features**
🚩 **Bug Hunter test mentioned but doesn't exist**
🚩 **Lock behavior doesn't match actual code**

### Rule of Thumb

**If you're confused about how something works, the documentation is wrong or incomplete.**

Fix it immediately so the next person (or future you) doesn't waste time.

---

## 🌍 Company Settings & Working Days

The Schedule Master uses **Company Settings** to determine working days and regional holidays:

### Timezone Configuration
- **Location:** Settings → Company tab → Timezone dropdown
- **Stored In:** `company_settings.timezone` (e.g., "Australia/Brisbane")
- **Used For:** Determining which regional public holidays to load

### Timezone → Region Mapping
When the Gantt loads, it maps the company timezone to an Australian state/region:

| Timezone | Region Code | Public Holidays |
|----------|-------------|-----------------|
| Australia/Brisbane | QLD | Queensland holidays |
| Australia/Sydney | NSW | New South Wales holidays |
| Australia/Melbourne | VIC | Victoria holidays |
| Australia/Perth | WA | Western Australia holidays |
| Australia/Adelaide | SA | South Australia holidays |
| Australia/Darwin | NT | Northern Territory holidays |
| Australia/Hobart | TAS | Tasmania holidays |
| **Default** | QLD | Used if timezone not found |

### Holiday Loading Process
1. Gantt loads company settings via `/api/v1/company_settings`
2. Maps timezone → region code using `getRegionFromTimezone()`
3. Fetches holidays via `/api/v1/public_holidays/dates?region={REGION}&year_start={CURRENT_YEAR}&year_end={CURRENT_YEAR+2}`
4. Applies holidays to working day calculations

**Code Location:** `frontend/src/components/schedule-master/DHtmlxGanttView.jsx:229-277`

### Working Day Calculation
The schedule uses three sources to determine working days:
1. **Weekends:** Saturday (day 6) and Sunday (day 0) are always non-working
2. **Public Holidays:** From the regional holiday calendar
3. **Custom Holidays:** Can be added in Settings → Public Holidays tab

**Functions:**
- `isWeekend(date)` - Checks if date is Sat/Sun
- `isPublicHoliday(dateStr)` - Checks if date is in holiday list
- `isWorkingDay(date)` - Combines both checks (returns true if NOT weekend AND NOT holiday)
- `getNextWorkingDay(date)` - Skips to next working day

### Initial View Positioning (Smart Scroll)
The Gantt timeline automatically scrolls to show relevant dates based on:

**Scroll Position = `max(today - 1 day, earliest_non_completed_task - 1 day)`**

This ensures:
- **Near-term tasks**: If tasks start soon, shows yesterday for context
- **Future tasks**: If tasks start in 3+ weeks, jumps forward to bring them into view
- **Completed tasks**: Ignored when calculating earliest task
- **Weekends/holidays**: If calculated date is non-working, skips to next working day

**Examples:**
- Today = Nov 15, Earliest task = Nov 14 → Show `max(Nov 14, Nov 13)` = **Nov 14**
- Today = Nov 15, Earliest task = Dec 5 → Show `max(Nov 14, Dec 4)` = **Dec 4** (brings future task into view!)
- Calculated date = Saturday → Skip to **Monday**

**Exception - During Drag:**
When user is actively dragging a task, auto-scroll is disabled to keep the dragged task visible on screen.

**Code Location:** `frontend/src/components/schedule-master/DHtmlxGanttView.jsx:3777-3821`

### Task Dates - Working Days Rule

**Core Rule:** Task start dates can be any day Monday-Sunday, including public holidays. Only Saturdays are excluded for unlocked tasks.

**When Applied:**
1. **After cascade** - When dependencies push a task to a Saturday
2. **After drag** - When user drags a task and drops it on a Saturday
3. **Respects lock hierarchy** - Only applies to unlocked tasks
4. **Sundays and holidays allowed** - Tasks CAN be scheduled on Sundays and public holidays

**Lock Hierarchy Check:**
Before adjusting a task to the next working day, the system checks if the task is locked:
1. `supplier_confirm` = true → SKIP (highest priority lock)
2. `confirm` = true → SKIP
3. `start` = true → SKIP
4. `complete` = true → SKIP
5. `manually_positioned` = true → SKIP (lowest priority lock)

**Adjustment Logic:**
```javascript
// After calculating new start date
// Only skip Saturdays for unlocked tasks
if (isSaturday(task.start_date) && !isTaskLocked(task)) {
  task.start_date = getNextWorkingDay(task.start_date) // Move to Sunday or Monday
}
```

**Bug Hunter Test:**
Test ID: `working-days-enforcement`
- **Type:** Backend automated test
- **What it tests:** Scans all tasks in a schedule template and verifies unlocked tasks are NOT on Saturdays
- **How to run:** Settings → Schedule Master → Bug Hunter Tests → "Working Days Enforcement" → Run Test
- **Rules sourced from:** This section (GANTT_BIBLE_COLUMNS.md) - automatically synced
- **Pass criteria:** All unlocked tasks must NOT be on Saturday (Sundays and holidays are allowed)
- **Expected violations:** Locked tasks CAN be on any day including Saturday (this is allowed)
- **Code Location:** `backend/app/controllers/api/v1/bug_hunter_tests_controller.rb:181-275`

**Examples:**
- Task calculated to start on Saturday → Moved to Sunday
- Task calculated to start on Sunday → STAYS on Sunday (allowed)
- Task calculated to start on Christmas Day → STAYS on Christmas Day (holidays allowed)
- Task with supplier_confirm=true on Saturday → STAYS on Saturday (lock overrides working day rule)

**Implementation Location:** Backend cascade service (ScheduleCascadeService)
**Reason:** Centralized logic ensures all date calculations respect working days, regardless of how tasks are created/updated

**Code Location:** `backend/app/services/schedule_cascade_service.rb:139-177`

**Implementation Details:**
```ruby
# In calculate_start_date method:
calculated_start = # ... calculate based on dependency type ...

# Skip to next working day (respects lock hierarchy)
if task_is_locked?(dependent_task)
  calculated_start  # Locked tasks can stay on weekends
else
  skip_to_next_working_day(calculated_start)
end

# Helper methods:
def task_is_locked?(task)
  task.supplier_confirm? || task.confirm? || task.start? ||
    task.complete? || task.manually_positioned?
end

def skip_to_next_working_day(day_offset)
  actual_date = @reference_date + day_offset.days
  while !working_day?(actual_date)
    actual_date += 1.day
  end
  (actual_date - @reference_date).to_i
end

def working_day?(date)
  return false if date.saturday? || date.sunday?
  # TODO: Add holiday check
  true
end
```

---

## Documentation Rules

When updating this table, follow these rules:

1. **Active Status**: Mark ✅ if actively used in schedule logic, ❌ if UI-only or unused
2. **Implementation**: Document exactly how it's coded (database field, frontend component, service usage)
3. **Purpose**: Explain what it's supposed to do in plain English
4. **Test Number**: Reference Bug Hunter test # that validates this column's functionality
5. **Update Requirement**: When code changes affect a column, update this table immediately

---

## Schedule Master Table - All Columns

| Order | Column Key | Label | Type | Active | DB Field | Implementation | Purpose | Test # |
|-------|-----------|-------|------|--------|----------|----------------|---------|--------|
| **-1** | **select** | *(checkbox)* | Boolean | ✅ | - | Frontend: `ScheduleTemplateEditor.jsx:1043-1059`<br/>State: `selectedRows` (Set)<br/>Handlers: `handleSelectRow()`, `handleSelectAll()` | **Multi-select checkbox** - Select multiple rows for bulk operations (bulk update fields, bulk delete rows). Header checkbox selects/deselects all visible rows. Used for batch editing common properties across multiple tasks. | N/A |
| **0** | **sequence** | # | Integer | ✅ | `sequence_order` | DB: `schedule_template_rows.sequence_order`<br/>Frontend: Auto-calculated display<br/>Services: Used in `Schedule::TemplateInstantiator` for task ordering | **Sequence number** - The order position of the task in the schedule (1, 2, 3...). Determines execution order and display order in both template editor and active job schedules. Critical for dependency resolution. | Test #5 (Cascade) |
| **1** | **taskName** | Task Name | String | ✅ | `name` | DB: `schedule_template_rows.name` (required)<br/>Frontend: Text input with filter support<br/>Services: Copied to `ProjectTask.name` on instantiation<br/>Validation: Must be present | **Task name** - The name of the task that appears in schedules, Gantt charts, and job views. Be descriptive so builders know exactly what work needs to be done. | Test #1 (API) |
| **2** | **supplierGroup** | Supplier / Group | Dropdown | ✅ | `supplier_id`<br/>`assigned_user_id` | DB: `schedule_template_rows.supplier_id` (foreign key to suppliers)<br/>Frontend: Dropdown with supplier list + internal roles<br/>Roles: admin, sales, site, supervisor, builder, estimator<br/>Services: Used in `TemplateInstantiator` to set `ProjectTask.supplier_name` | **Supplier or internal team** - For PO tasks: select a supplier company. For internal work: assign to a team role. Determines who is responsible for completing the task. Used for filtering, PO generation, and notifications. | Test #4 (API Pattern) |
| **3** | **predecessors** | Predecessors | Button/Modal | ✅ | `predecessor_ids` | DB: `schedule_template_rows.predecessor_ids` (JSONB array)<br/>Format: `[{id: 2, type: "FS", lag: 3}, ...]`<br/>Frontend: `PredecessorEditor.jsx` modal<br/>Types: FS, SS, FF, SF<br/>Services: `Schedule::CascadeService` processes dependencies<br/>Backend: `schedule_cascade_service.rb` | **Task dependencies** - Defines which tasks must finish (or start) before this task can begin. Supports 4 dependency types: FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish). Lag days shift the start date forward/backward. Core to automated scheduling and date calculations. | Test #5 (Cascade),<br/>Test #6 (State Batching) |
| **4** | **duration** | Duration | Integer | ✅ | `duration` | DB: `schedule_template_rows.duration` (integer, default: 0)<br/>Frontend: Number input (min: 0)<br/>Gantt: Used for bar length calculation<br/>Backend: Used in date calculations (working days only, excludes weekends/holidays) | **Task duration** - Number of working days this task will take to complete. Used to calculate end dates and schedule length. Counts only working days (excludes weekends and public holidays defined in system). | Test #3 (Drag Timing) |
| **5** | **startDate** | Start Date | Computed | ✅ | `start_date` | DB: `schedule_template_rows.start_date` (integer, days from project start)<br/>Frontend: Read-only display (calculated value)<br/>Backend: `ScheduleCascadeService.calculate_start_dates`<br/>Calculation: Based on predecessor completion + lag days | **Calculated start date** - Automatically computed based on predecessor completion dates, lag days, and working calendar. Tasks with no predecessors start on Day 0 (project start date). Updated automatically when predecessors change or are dragged in Gantt. | Test #5 (Cascade),<br/>Test #7 (Lock State) |
| **6** | **poRequired** | PO Req | Boolean | ✅ | `po_required` | DB: `schedule_template_rows.po_required` (boolean, default: false)<br/>Frontend: Checkbox<br/>Services: Tracked but doesn't trigger auto-creation<br/>Usage: UI indicator only, manual PO workflow | **PO required flag** - Indicates this task requires a purchase order to be created. This is a tracking/reminder flag only - it does NOT automatically create POs. Use "Auto PO" column for automatic PO generation. | N/A (UI only) |
| **7** | **autoPo** | Auto PO | Boolean | ✅ | `create_po_on_job_start` | DB: `schedule_template_rows.create_po_on_job_start` (boolean, default: false)<br/>Frontend: Checkbox (requires supplier)<br/>Services: `Schedule::TemplateInstantiator.create_auto_purchase_orders`<br/>Validation: Requires `supplier_id` to be set | **Auto-create PO** - When checked, automatically creates and sends a purchase order to the supplier when the job starts. Requires: (1) supplier selected, (2) price items linked. PO includes all linked price book items. | N/A (PO generation) |
| **8** | **priceItems** | Price Items | Button/Modal | ✅ | `price_book_item_ids` | DB: `schedule_template_rows.price_book_item_ids` (JSONB array of IDs)<br/>Frontend: `PriceBookItemsModal.jsx` - multi-select with search<br/>Services: Used in auto-PO generation to populate line items<br/>Display: Shows count "X items" | **Price book items** - Link price book items (materials, labor, equipment) to this task. These items are automatically included in purchase orders when "Auto PO" is enabled. Used for cost tracking and PO line item generation. | N/A (PO generation) |
| **9** | **critical** | Critical | Boolean | ✅ | `critical_po` | DB: `schedule_template_rows.critical_po` (boolean, default: false)<br/>Frontend: Checkbox<br/>Services: Copied to `ProjectTask.critical_po`<br/>UI: Critical tasks highlighted in red/urgent styling | **Critical priority flag** - Mark this task/PO as critical priority. Critical tasks are highlighted with urgent styling and appear at the top of supplier/manager views. Use for time-sensitive work that could delay the entire project. | N/A (UI priority) |
| **10** | **tags** | Tags | Input | ✅ | `tags` | DB: `schedule_template_rows.tags` (JSONB array of strings)<br/>Frontend: Comma-separated text input with filter<br/>Services: Copied to `ProjectTask.tags`<br/>Common: 'electrical', 'plumbing', 'inspection', 'milestone' | **Task tags** - Add tags to categorize and filter tasks by trade, phase, or type (e.g., 'electrical', 'foundation', 'inspection'). Used for filtering views, grouping related tasks, and generating trade-specific reports. | N/A (Categorization) |
| **11** | **photo** | Photo | Boolean | ✅ | `require_photo` | DB: `schedule_template_rows.require_photo` (boolean, default: false)<br/>Frontend: Checkbox<br/>Services: `Schedule::TaskSpawner.spawn_photo_task`<br/>Trigger: When parent task marked complete<br/>Creates: New `ProjectTask` with `spawned_type: 'photo'` | **Spawn photo task** - When parent task is marked complete, automatically spawns a child photo documentation task. Photo task appears in job schedule with due date = parent completion date. Used for required photo documentation (council submissions, quality checks, client updates). | N/A (Task spawning) |
| **12** | **cert** | Cert | Boolean | ✅ | `require_certificate` | DB: `schedule_template_rows.require_certificate` (boolean, default: false)<br/>Frontend: Checkbox<br/>Services: `Schedule::TaskSpawner.spawn_certificate_task`<br/>Trigger: When parent task marked complete<br/>Creates: New `ProjectTask` with `spawned_type: 'certificate'`<br/>Due: Parent completion + cert_lag_days | **Spawn certificate task** - When parent task is marked complete, automatically spawns a child certificate task due X days later (see Cert Lag). Used for regulatory certifications, compliance documents, and inspections that have submission deadlines after work completion. | N/A (Task spawning) |
| **13** | **certLag** | Cert Lag | Integer | ✅ | `cert_lag_days` | DB: `schedule_template_rows.cert_lag_days` (integer, default: 10)<br/>Frontend: Number input<br/>Services: Used in `TaskSpawner.spawn_certificate_task`<br/>Calculation: cert_due_date = parent_completion + cert_lag_days<br/>Validation: 0-999 days | **Certificate lag days** - Number of days after task completion when the certificate task is due. Default is 10 days. Example: Frame task completes Jan 1 → Frame Certificate due Jan 11 (with 10-day lag). Accounts for typical certification/inspection turnaround times. | N/A (Task spawning) |
| **14** | **supCheck** | Sup Check | Boolean | ✅ | `require_supervisor_check` | DB: `schedule_template_rows.require_supervisor_check` (boolean, default: false)<br/>Frontend: Checkbox<br/>Services: `TemplateInstantiator.create_checklist_items_for_task`<br/>Creates: Supervisor checklist items on task<br/>Copied to: `ProjectTask.requires_supervisor_check` | **Supervisor check required** - Requires a supervisor to physically visit the site and verify quality/completion. Supervisor gets a notification to check in. Creates checklist items from templates linked via `supervisor_checklist_template_ids`. Used for quality control and compliance verification. | N/A (Task spawning) |
| **15** | **autoComplete** | Auto Complete | Button/Modal | ✅ | `auto_complete_task_ids`<br/>`auto_complete_predecessors` | DB: `schedule_template_rows.auto_complete_task_ids` (JSONB array of task IDs)<br/>DB: `schedule_template_rows.auto_complete_predecessors` (boolean)<br/>Frontend: Modal to select tasks<br/>Services: Task completion logic checks this field<br/>Behavior: When this task completes, selected tasks auto-complete | **Auto-complete tasks** - Select specific tasks that should automatically be marked as complete when THIS task is completed. Useful for milestone tasks that signal completion of multiple other tasks. Example: "Final Inspection Passed" auto-completes "Frame Complete", "Electrical Complete", etc. | N/A (Task completion) |
| **16** | **subtasks** | Subtasks | Button/Modal | ✅ | `has_subtasks`<br/>`subtask_count`<br/>`subtask_names`<br/>`subtask_template_ids` | DB: `schedule_template_rows.has_subtasks` (boolean)<br/>DB: `schedule_template_rows.subtask_count` (integer)<br/>DB: `schedule_template_rows.subtask_names` (JSONB array)<br/>DB: `schedule_template_rows.subtask_template_ids` (JSONB array)<br/>Frontend: `SubtasksModal.jsx` with name list editor<br/>Services: `TaskSpawner.spawn_subtasks`<br/>Trigger: When parent task starts<br/>Validation: subtask_count must match subtask_names.length | **Subtasks** - Automatically create child subtasks when this task starts. Useful for breaking down complex tasks into smaller trackable steps. Example: "Frame House" → ["Frame Walls", "Frame Roof", "Frame Internal"]. Each subtask can be tracked and completed independently. | N/A (Task spawning) |
| **17** | **linkedTasks** | Linked Tasks | Button/Modal | ⚠️ | `linked_task_ids`<br/>`linked_template_id` | DB: `schedule_template_rows.linked_task_ids` (text, default: "[]")<br/>DB: `schedule_template_rows.linked_template_id` (integer FK)<br/>Frontend: Modal to select/link tasks<br/>Services: PARTIALLY IMPLEMENTED<br/>Status: Field exists but linking logic incomplete | **Linked tasks** - Link this task to other tasks in the schedule. PARTIALLY IMPLEMENTED - database fields exist but full linking/synchronization logic not yet complete. Future use: group related tasks, create dependencies across templates, synchronize linked task status. | N/A (Incomplete) |
| **18** | **manualTask** | Manual | Boolean | ❌ | `manual_task` | DB: `schedule_template_rows.manual_task` (boolean, default: false)<br/>Frontend: Checkbox<br/>Services: NOT CURRENTLY USED<br/>Status: Field exists, logic not implemented | **Manual task flag** - INTENDED: Manual tasks should never get automatically loaded into job schedules. Must be manually created by user. CURRENT STATUS: Field exists but no filtering logic implemented. Tasks with this flag still auto-load on job creation. | N/A (Not implemented) |
| **19** | **multipleItems** | Multi | Boolean | ❌ | `allow_multiple_instances` | DB: `schedule_template_rows.allow_multiple_instances` (boolean, default: false)<br/>Frontend: Checkbox<br/>Services: NOT CURRENTLY USED<br/>Status: Field exists, logic not implemented | **Multiple instances** - INTENDED: When task is completed, prompt user if they need another instance (e.g., 'Frame Inspection' → 'Frame Inspection 2'). CURRENT STATUS: Field exists but prompt/duplication logic not implemented. | N/A (Not implemented) |
| **20** | **orderRequired** | Order Time | Boolean | ❌ | `order_required` | DB: `schedule_template_rows.order_required` (boolean, default: false)<br/>Frontend: Checkbox<br/>Services: NOT CURRENTLY USED<br/>Status: Field exists, no logic | **Order time required** - INTENDED: Track tasks requiring advance order time from pricebook items. CURRENT STATUS: Field exists but no tracking/notification logic. Not used in scheduling calculations. | N/A (Not implemented) |
| **21** | **callUpRequired** | Call Up | Boolean | ❌ | `call_up_required` | DB: `schedule_template_rows.call_up_required` (boolean, default: false)<br/>Frontend: Checkbox<br/>Services: NOT CURRENTLY USED<br/>Status: Field exists, no logic | **Call-up required** - INTENDED: Track tasks requiring call-up/booking time from pricebook items. CURRENT STATUS: Field exists but no tracking/notification logic. Not used in scheduling calculations. | N/A (Not implemented) |
| **22** | **planType** | Plan | Dropdown | ⚠️ | `plan_required` | DB: `schedule_template_rows.plan_required` (boolean, default: false)<br/>Frontend: Dropdown with plan type options<br/>Options: Floor Plan, Site Plan, Slab Plan, etc. (17 cert drawing types)<br/>Services: PARTIALLY IMPLEMENTED<br/>Status: Field exists, activation logic incomplete | **Plan/drawing type** - INTENDED: Task only activates in job schedule if the selected plan tab is required for the job. CURRENT STATUS: UI selection works, but conditional activation logic not fully implemented. Tasks appear regardless of job's plan requirements. | N/A (Incomplete) |
| **50+** | **docTab_{id}** | *(category name)* | Boolean | ✅ | `documentation_category_ids` | DB: `schedule_template_rows.documentation_category_ids` (integer array)<br/>Frontend: Dynamic columns created from `DocumentationCategory` records<br/>Format: `docTab_{category_id}` (e.g., `docTab_5`)<br/>Services: Used in folder/document organization<br/>Color: Each category has custom color for visual grouping | **Documentation category tabs** - Dynamic columns for each documentation category configured in settings. Check to assign this task to that category/folder. Used for organizing tasks into documentation folders. Multiple categories can be selected per task. Color-coded for easy visual identification. | N/A (Categorization) |
| **100** | **actions** | Actions | Buttons | ✅ | - | Frontend: Delete button + up/down arrows<br/>Handlers: `handleDeleteRow()`, `handleMoveUp()`, `handleMoveDown()`<br/>Delete: API DELETE to `/schedule_templates/:id/rows/:id`<br/>Move: Updates `sequence_order` and re-sequences all rows | **Row actions** - Delete button removes task from template (with confirmation). Move up/down arrows reorder tasks by swapping sequence_order values. Reordering updates all affected tasks to maintain continuous sequence. | N/A (CRUD ops) |

---

## Gantt Chart Modal Columns

These columns appear ONLY in the DHtmlx Gantt modal (not in the main Schedule Master table):

| Order | Column Key | Column Name | Label | Type | Active | DB Field | Implementation | Purpose | Test # |
|-------|-----------|-------------|-------|------|--------|----------|----------------|---------|--------|
| **0** | taskNumber | task_number | # | Computed | ✅ | - | Frontend: `DHtmlxGanttView.jsx:2979-2988`<br/>Calculation: `tasks.findIndex(t => t.id === task.id) + 1`<br/>Display: "#1", "#2", etc. | **Visual sequence number** - Shows task position in filtered/sorted list. Updates dynamically when filters/sorts applied. Different from database sequence_order (which is persistent). | N/A |
| **1** | taskName | text | Task Name | String | ✅ | `name` | Gantt: `task.text` property<br/>Editable: Yes (inline editing enabled)<br/>Source: `schedule_template_rows.name` | **Task name in Gantt** - Same as Schedule Master table but displayed in Gantt grid. Inline editable. | Test #1 (API) |
| **2** | predecessors | predecessors | Predecessors | String | ✅ | `predecessor_ids` | Gantt: Formatted display string<br/>Format: "2FS+3, 5SS"<br/>Source: `schedule_template_rows.predecessor_ids`<br/>Editing: Via lightbox modal (not inline) | **Dependency display** - Shows formatted predecessor list. Click to open predecessor editor modal. Visual links also drawn on timeline. | Test #5 (Cascade) |
| **3** | supplier | supplier | Supplier/Group | String | ✅ | `supplier_id` | Gantt: `task.supplier` property<br/>Editable: Yes (inline editing)<br/>Source: `suppliers.name` or `assigned_user_id` | **Supplier name** - Shows supplier or internal team assignment. Inline editable. | Test #4 (API Pattern) |
| **4** | duration | duration | Duration | Integer | ✅ | `duration` | Gantt: `task.duration` property<br/>Editable: Yes (inline editing, min: 1, max: 999)<br/>Display: "X days" or "1 day"<br/>Calculation: Working days only | **Duration in Gantt** - Number of working days. Inline editable. Changes timeline bar length. Triggers cascade recalculation. | Test #3 (Drag Timing),<br/>Test #5 (Cascade) |
| **5** | confirm | confirm | Confirm | Boolean | ⚠️ | `confirm` | Gantt: Checkbox column (conditional)<br/>DB: `schedule_template_rows.confirm` (boolean)<br/>Behavior: When checked, task becomes locked (non-cascadable)<br/>Lock Priority: Lower than supplier_confirm<br/>Display: Only shown when `showCheckboxes=true` | **Confirm lock** - Lock task position to prevent cascading when predecessors change. Lower lock priority than supplier_confirm. Checked = locked, unchecked = can cascade. | Test #7 (Lock State),<br/>Test #5 (Cascade) |
| **6** | supplierConfirm | supplier_confirm | Supplier Confirm | Boolean | ⚠️ | `supplier_confirm` | Gantt: Checkbox column (conditional)<br/>DB: `schedule_template_rows.supplier_confirm` (boolean)<br/>Behavior: When checked, task becomes locked (non-cascadable)<br/>Lock Priority: HIGHEST (overrides all other locks)<br/>Display: Only shown when `showCheckboxes=true` | **Supplier confirm lock** - HIGHEST priority lock. Supplier has confirmed they can complete task on this date. Prevents cascading even when predecessors move. Used for locked-in supplier commitments. | Test #7 (Lock State),<br/>Test #5 (Cascade) |
| **7** | start | start | Start | Boolean | ⚠️ | `start` | Gantt: Checkbox column (conditional)<br/>DB: `schedule_template_rows.start` (boolean)<br/>Behavior: When checked, task becomes locked (non-cascadable)<br/>Lock Priority: Medium<br/>Display: Only shown when `showCheckboxes=true` | **Start lock** - Task has started, lock position to prevent rescheduling. Used when work has begun and date cannot change. Checked = locked. | Test #7 (Lock State),<br/>Test #5 (Cascade) |
| **8** | complete | complete | Complete | Boolean | ⚠️ | `complete` | Gantt: Checkbox column (conditional)<br/>DB: `schedule_template_rows.complete` (boolean)<br/>Behavior: When checked, task becomes locked (non-cascadable)<br/>Lock Priority: Medium<br/>Display: Only shown when `showCheckboxes=true` | **Complete lock** - Task is 100% complete, lock position. Completed tasks should not cascade/reschedule. Checked = locked. | Test #7 (Lock State),<br/>Test #5 (Cascade) |
| **9** | lock | lock_position | Lock | Boolean | ✅ | `manually_positioned` | Gantt: Checkbox column (always visible)<br/>DB: `schedule_template_rows.manually_positioned` (boolean)<br/>Behavior: Manual override lock - user has explicitly positioned this task<br/>Backend: `ScheduleCascadeService` skips locked tasks<br/>Code: `next if dependent_task.manually_positioned?` | **Manual position lock** - User has manually dragged/positioned this task and wants to prevent automatic cascading. Allows manual scheduling overrides. Most commonly used lock type. | Test #7 (Lock State),<br/>Test #5 (Cascade),<br/>Test #2 (Gantt Reload) |
| **10** | add | add | *(empty)* | Button | ✅ | - | Gantt: Action column<br/>Functionality: Add new task, row actions<br/>Always: Last column in array | **Add task column** - Column for adding new tasks or performing row actions. Always appears as the last column. | N/A |

---

## Lock Hierarchy

When multiple lock columns are checked, priority is:

1. **supplier_confirm** (HIGHEST) - Supplier commitment, never cascade
2. **confirm** - Internal confirmation, never cascade
3. **start** - Work begun, never cascade
4. **complete** - Work finished, never cascade
5. **lock_position** (manually_positioned) - User override, never cascade

**Backend Logic:** `ScheduleCascadeService.rb:63`
```ruby
next if dependent_task.manually_positioned?
```

**Lock Check:** Task is locked if ANY of these are true:
- `supplier_confirm == true`
- `confirm == true`
- `start == true`
- `complete == true`
- `manually_positioned == true`

---

## Test Coverage Map

| Test # | Test Name | What It Tests | Related Columns |
|--------|-----------|---------------|-----------------|
| **Test #1** | Duplicate API Call Detection | Tracks API calls by task ID, catches infinite loops | taskName, all editable fields |
| **Test #2** | Excessive Gantt Reload Detection | Counts Gantt reloads per drag operation | lock_position (triggers reload on change) |
| **Test #3** | Slow Drag Operation Detection | Measures drag performance (target: < 5s) | duration, start_date (recalculated on drag) |
| **Test #4** | API Call Pattern Analysis | Detects rapid repeated API calls (race conditions) | supplier, all real-time editable fields |
| **Test #5** | Cascade Event Tracking | Monitors dependency cascade propagation | predecessors, start_date, duration, all lock columns |
| **Test #6** | State Update Batching | Ensures state updates are batched (target: ≤ 3 per drag) | All columns that trigger state updates |
| **Test #7** | Lock State Monitoring | Verifies locks prevent cascading correctly | confirm, supplier_confirm, start, complete, lock_position |
| **Test #8** | Performance Timing Analysis | Measures all operation timings against targets | All columns (drag, edit, cascade operations) |
| **Test #9** | Health Status Assessment | Overall system health check | All columns (aggregate health) |
| **Test #10** | Actionable Recommendations | Suggests fixes for detected issues | All columns (context-specific recommendations) |

**Bug Hunter Location:** `/frontend/src/utils/ganttDebugger.js`
**E2E Test Suite:** `/frontend/tests/e2e/gantt-cascade.spec.js`
**Bug Tracking Doc:** `/frontend/public/GANTT_BUGS_AND_FIXES.md`

---

## Bug Hunter Test Suite - When to Run

> **⚠️ IMPORTANT FOR DEVELOPERS:** Keep this section updated when you add new tests or modify cascade logic. Future developers need accurate testing guidelines!

### 🎯 When to Run Bug Hunter Tests

**ALWAYS run before committing changes to these files:**

1. **Schedule Cascade Logic**
   - `backend/app/services/schedule_cascade_service.rb` - Core cascade calculation engine
   - Any model callback that affects task scheduling

2. **Gantt Drag/Drop**
   - `frontend/src/components/schedule-master/DHtmlxGanttView.jsx` - Gantt chart component
   - `frontend/src/components/schedule-master/ScheduleTemplateEditor.jsx` - Main editor
   - Any drag handler modifications

3. **Task Dependencies**
   - `backend/app/models/schedule_template_row.rb` - Task model with predecessor logic
   - `frontend/src/components/schedule-master/PredecessorEditor.jsx` - Predecessor editor
   - Any dependency type changes (FS, SS, FF, SF)

4. **Schedule Template Rows**
   - `backend/app/controllers/api/v1/schedule_template_rows_controller.rb` - API endpoints
   - Any changes to task CRUD operations

### 🔧 Additional Triggers

Run tests when:
- Upgrading DHtmlx Gantt library
- Upgrading React or Rails versions
- Debugging screen flicker, infinite loops, or cascade issues
- Before production deployments
- After major feature additions affecting scheduling

### 📋 How to Run

```bash
# Full test suite (backend + E2E)
./test/bug_hunter_test.sh

# Backend only (faster, no browser needed)
cd backend && rails runner test/gantt_drag_test.rb

# E2E only (requires dev servers running)
cd frontend && npm run test:gantt
```

### 🚨 Exit Codes

- **0** - All tests passed ✅
- **1** - Backend test failed (cascade logic broken)
- **2** - Frontend E2E test failed (UI integration broken)
- **3** - Frontend dev server not running
- **4** - PostgreSQL not running

### 🎯 Test Data Template

All tests use **"Bug Hunter Schedule Master"** (template ID: 4) with these tasks:
- **Task 1 (ID 311)** - Root task with no predecessors
- **Task 2 (ID 313)** - Depends on Task 1 (FS dependency)
- **Task 3 (ID 312)** - Depends on Task 1 (FS dependency)
- **Task 4 (ID 314)** - Depends on Task 3
- **Task 5 (ID 310)** - Depends on Task 4

### 💡 Best Practice

Create a **git pre-push hook** to run tests automatically:

```bash
# .git/hooks/pre-push
#!/bin/bash
echo "🔍 Running Bug Hunter tests before push..."
./test/bug_hunter_test.sh
```

This ensures cascade logic is always verified before pushing changes!

---

## Active vs Inactive Column Summary

### ✅ Actively Used (24 columns)
- **Core:** select, sequence, taskName, supplierGroup, predecessors, duration, startDate
- **PO System:** poRequired, autoPo, priceItems, critical
- **Metadata:** tags
- **Spawning:** photo, cert, certLag, supCheck, autoComplete, subtasks
- **Gantt Locks:** confirm, supplier_confirm, start, complete, lock_position (manually_positioned)
- **Documentation:** docTab_{id} (dynamic, multiple)
- **Actions:** actions

### ⚠️ Partially Implemented (2 columns)
- **linkedTasks** - Database fields exist, linking logic incomplete
- **planType** - UI selection works, activation logic incomplete

### ❌ Not Implemented (3 columns)
- **manualTask** - Field exists, no filtering logic
- **multipleItems** - Field exists, no prompt/duplication logic
- **orderRequired** - Field exists, no tracking logic
- **callUpRequired** - Field exists, no tracking logic

---

## Version History

| Date | Version | Changes | Updated By |
|------|---------|---------|------------|
| 2025-11-15 | 1.1 | Added "Bug Hunter Test Suite - When to Run" section with testing guidelines for developers | Claude Code |
| 2025-11-14 | 1.0 | Initial Gantt Bible Column Documentation created | Claude Code |

---

## Related Documentation

- **Architecture:** [GANTT_DRAG_FLICKER_FIXES.md](/frontend/GANTT_DRAG_FLICKER_FIXES.md)
- **Business Rules:** [GANTT_SCHEDULE_RULES.md](/GANTT_SCHEDULE_RULES.md)
- **Bug Tracking:** [GANTT_BUGS_AND_FIXES.md](/frontend/public/GANTT_BUGS_AND_FIXES.md)
- **Component README:** [schedule-master/README.md](/frontend/src/components/schedule-master/README.md)
