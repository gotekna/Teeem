import { useState, useMemo, useRef, useEffect } from 'react'
import { DocumentArrowDownIcon, MagnifyingGlassIcon, PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline'

export default function NewFeaturesTab() {
  // Load initial state from localStorage
  const loadFromLocalStorage = (key, defaultValue) => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error)
      return defaultValue
    }
  }

  // Load state with localStorage persistence
  const [ccUpdates, setCcUpdates] = useState(() => loadFromLocalStorage('scheduleMaster_ccUpdates', {
    // GANTT SYSTEM-LEVEL FEATURES (Not column-specific)
    ganttTimeline: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: DHtmlxGanttView.jsx:180-195
- Timeline Range: Extended from 2 years to 10 years (3650 days)
- Date Range: Dynamically calculated from earliest task start to latest task end + buffer
- Scale Configuration: Day/week/month/quarter scales with dynamic switching

**Bug Fix (Previous Session):**
- **Issue**: Visual tests were opening blank Gantt when tasks scheduled far in future (2031)
- **Root Cause**: Tasks scheduled 2025 days in future exceeded 2-year (730-day) timeline range
- **Fix**: Extended maxDate calculation to support 10-year timeline (3650 days)
- **Code Change**: Updated timeline range from 2 years to 10 years in DHtmlxGanttView.jsx

**How It Works:**
Gantt timeline now supports tasks scheduled up to 10 years in the future. Timeline calculates range dynamically: finds earliest task start_date and latest task end_date, then adds buffer. This allows visual tests and long-term project schedules to display correctly without blank screens.

**Interdependencies:**
- Used by visual test suite to verify Gantt rendering
- Bug Hunter Tests rely on 10-year timeline for test schedule visualization
- Long-term construction projects can now be scheduled beyond 2 years

**Current Limitations:**
- Performance may degrade with extremely long timelines (>10 years)
- Scale switching logic may need optimization for very long projects
- No automatic scale adjustment based on timeline length`,

    templateSelection: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: Schedule Master settings/configuration
- Template Selector: Dropdown/modal for selecting which schedule template to load
- Data Loading: Fetches schedule_template_rows for selected template

**Bug Fix (Previous Session):**
- **Issue**: Template selection not loading correct schedule into Gantt view
- **Root Cause**: Template ID not properly passed to Gantt component OR row fetch not filtered by template
- **Fix**: Corrected template ID propagation and ensured proper data filtering
- **Verification**: Visual tests now correctly load test schedules

**How It Works:**
User selects schedule template from dropdown, system fetches all schedule_template_rows for that template ID, then loads them into Gantt view with proper timeline range. Template selection triggers full Gantt re-render with new data.

**Interdependencies:**
- Template selection drives which rows appear in Schedule Master table
- Gantt timeline adjusts based on tasks in selected template
- Bug Hunter Tests use template selection to load test schedules
- Visual tests verify correct template data loads

**Current Limitations:**
- No multi-template view (can only view one template at a time)
- Template switching requires full page re-render
- No template comparison view`,

    select: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2388-2398
- Rendering: Checkbox input, 40px width, center-aligned, order: -1 (first column)
- Event handlers:
  - onChange: \`onSelectRow(row.id)\` toggles individual row selection
  - State: Managed via \`isSelected\` prop passed from parent
  - Styling: h-4 w-4, indigo-600 color, rounded, cursor-pointer

**Backend:**
- Field: N/A (frontend-only state management)
- Type: Client-side selection tracking (Set of row IDs in parent component)

**How It Works:**
Enables multi-row selection for bulk operations. Users click checkboxes to select multiple rows, triggering bulk actions toolbar. Parent component manages selection state via Set data structure for O(1) lookup performance. Header checkbox (not in this cell) enables select-all/deselect-all functionality.

**Interdependencies:**
- Bulk operations toolbar visibility depends on selection count > 0
- Bulk update actions: Set PO Required, Enable Auto PO, Disable Auto PO, Delete Selected

**Current Limitations:**
- Selection state lost when filters/sorts applied
- No shift-click range selection
- No ctrl-click multi-select
- Selection not persisted across page reloads`,
    sequence: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2400-2405
- Rendering: Read-only text display, 40px width, center-aligned, order: 0
- Display: \`{index + 1}\` - converts 0-based index to 1-based display
- Styling: text-gray-500 dark:text-gray-400, no input (display only)

**Backend:**
- Field: schedule_template_rows.sequence_order
- Type: integer (NOT NULL, >= 0)
- Validation: Presence required (model line 14), numericality >= 0 (model line 15)
- Scope: in_sequence orders by sequence_order asc (model line 28)

**How It Works:**
Auto-generated task sequence number representing row position in template. Database stores 0-based (0, 1, 2...), frontend displays 1-based (#1, #2, #3...). Critical for predecessor dependency system which references tasks by sequence number. Updated automatically when rows reordered via move up/down buttons (lines 2734-2741).

**CRITICAL - Dependency System Integration:**
- **Storage**: sequence_order is 0-based in DB (0, 1, 2, 3, ...)
- **Display**: Frontend shows 1-based (#1, #2, #3, #4, ...)
- **Dependencies**: predecessor_ids use 1-based references (task #1 = sequence_order 0)
- **Conversion**: See Bible RULE #1 for mandatory conversion logic

**Interdependencies:**
- Predecessor Editor modal references tasks by displayed sequence number
- Move up/down actions recalculate all sequence_order values
- Sorting by sequence maintains template task order

**Current Limitations:**
- No automatic dependency update when tasks reordered
- Manual verification needed after reordering to ensure deps still valid
- No visual warning if dependencies broken by reordering
- 0-based/1-based conversion can cause confusion for developers`,
    taskName: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2407-2418
- Rendering: Text input field, 200px width, left-aligned, order: 1
- Event handlers:
  - onChange: handleTextChange('name', value) with 500ms debounce (line 2334)
  - onFocus: e.target.select() - auto-selects text on focus
  - Local state: localName tracks user input before save
- Styling: Full width, px-2 py-1, border, dark mode support

**Backend:**
- Field: schedule_template_rows.name
- Type: string (NOT NULL)
- Validation: Presence required (model line 14)

**How It Works:**
Primary identifier for each task row. User types task name which appears in schedule displays, Gantt charts, and job views. Implements debounced updates - local state tracks input immediately, API call fires 500ms after user stops typing to reduce server load. Auto-selects text on focus for quick editing.

**Interdependencies:**
- Used in predecessor display: "Task Name (FS+3)"
- Displayed in Gantt chart timeline
- Referenced in audit logs and change tracking
- Export/import uses this as primary identifier

**Current Limitations:**
- No duplicate name detection or warning
- No character limit enforced in UI (DB may have limit)
- No autocomplete or task name suggestions from previous templates
- Special characters not validated
- No rich text or formatting support`,
    supplierGroup: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2420-2447
- Rendering: Conditional dropdown - suppliers (if PO required) OR internal roles, 150px width, order: 2
- Event handlers:
  - Supplier mode: handleFieldChange('supplier_id', parseInt(value)) (line 2426)
  - Role mode: handleFieldChange('assigned_role', value) (line 2437)
  - Immediate update (no debounce)
- Conditional logic:
  - If row.po_required = true → show suppliers dropdown
  - If row.po_required = false → show assignable roles dropdown
- Roles: admin, sales, site, supervisor, builder, estimator (ASSIGNABLE_ROLES constant)

**Backend:**
- Fields: schedule_template_rows.supplier_id (FK) OR schedule_template_rows.assigned_role (string)
- Type: integer (supplier_id, nullable) OR string (assigned_role, nullable)
- Validation: Optional belongs_to :supplier, assigned_role must be in ASSIGNABLE_ROLES
- Constant: ASSIGNABLE_ROLES defined in model line 11

**How It Works:**
Smart assignment field that toggles between external suppliers (for PO tasks) and internal team roles (for company work). When PO Required enabled, dropdown shows supplier companies for procurement tasks. When PO Required disabled, dropdown shows internal roles for task assignment and routing. Enables smart PO generation and task delegation.

**Interdependencies:**
- Auto-cleared when po_required unchecked (line 2365)
- Required for create_po_on_job_start enablement
- Used in Auto PO generation service (Schedule::TemplateInstantiator)
- Filters available in bulk operations

**Current Limitations:**
- Cannot assign BOTH supplier AND internal role simultaneously
- No supplier capabilities/trade filtering (shows all suppliers)
- Role selection limited to 6 predefined roles
- No custom role creation
- Supplier list not filtered by active/inactive status`,
    predecessors: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2449-2461
- Rendering: Button showing formatted predecessor display, 100px width, order: 3
- Event handlers:
  - onClick: setShowPredecessorEditor(true) opens modal (line 2454)
  - Display: row.predecessor_display (e.g., "2FS+3, 5SS") or "None"
- Modal: PredecessorEditor component handles dependency editing
- Styling: Full width button, gray background, hover effect, cursor-pointer

**Backend:**
- Field: schedule_template_rows.predecessor_ids
- Type: jsonb array
- Format: [{id: 2, type: "FS", lag: 3}, {id: 5, type: "SS", lag: 0}]
- Helper: predecessor_display method formats as "2FS+3, 5SS" (model lines 59-62)
- Types: FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish)

**How It Works:**
Defines task dependencies using 4 relationship types plus lag days. Click button to open PredecessorEditor modal where user selects predecessor tasks, relationship type, and lag offset. Backend ScheduleCascadeService uses this to calculate start_date automatically. When predecessor moves, all dependent tasks cascade forward/backward based on relationship type.

**CRITICAL - See Bible RULE #1:**
- Predecessor IDs are 1-based (1, 2, 3, 4...)
- sequence_order is 0-based (0, 1, 2, 3...)
- MUST convert: predecessor_id = sequence_order + 1

**Interdependencies:**
- Drives ScheduleCascadeService date calculations
- Affects start_date computation (auto-calculated field)
- Lock system prevents cascade to locked tasks (5 lock types)
- See Bible RULE #4 for lock hierarchy

**Current Limitations:**
- No circular dependency detection/warning in UI
- No visual dependency graph in template editor (only in Gantt)
- Cannot bulk-edit dependencies across multiple tasks
- No dependency validation on import
- Deleting a task doesn't update dependents (orphaned refs possible)`,
    duration: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2463-2484
- Rendering: Number input field, 80px width, center-aligned, order: 4
- Event handlers:
  - onChange: handleTextChange('duration', value) with 500ms debounce (line 2469)
  - onBlur: Immediate save, clears debounce timeout (lines 2470-2477)
  - onFocus: e.target.select() - auto-selects number
  - Local state: localDuration tracks input before save
- Validation: min="0", parseInt with || 0 fallback
- Styling: Full width, px-2 py-1, placeholder "0"

**Backend:**
- Field: schedule_template_rows.duration
- Type: integer (default: 0)
- Validation: Numericality >= 0 (implied, no explicit validation in model)
- Unit: Working days (excludes weekends and public holidays)

**How It Works:**
Task duration in working days. User types number, debounced save after 500ms OR immediate save on blur. Combined with start_date, determines task end date. Backend ScheduleCascadeService uses duration to calculate dependent task start dates. Working day calendar excludes Saturday/Sunday plus public holidays defined in company settings.

**CRITICAL - See Bible RULE #3:**
- Duration ALWAYS calculated in working days
- Company Settings → Working Days defines Mon-Sun status
- Cascade service respects working day configuration

**Interdependencies:**
- Changes trigger ScheduleCascadeService cascade (Bible RULE #10)
- Affects Gantt bar length in timeline view
- Used in end_date calculation: start_date + duration (working days)
- Export/import preserves duration values

**Current Limitations:**
- No duration estimation based on historical data
- Cannot set duration in hours/weeks (days only)
- No resource-based duration adjustments
- No warning if duration seems unrealistic (e.g., 999 days)
- No fractional days support (integer only)`,
    startDate: `**Status:** Fully functional ✅ (Auto-calculated field)

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2486-2493
- Rendering: Read-only div display, 110px width, center-aligned, order: 5
- Display: calculatedStartDate variable (formatted day offset like "Day 5")
- Styling: Gray background, text-gray-700 dark:text-gray-300, border, rounded
- No input: This field is NOT user-editable (calculated by backend)

**Backend:**
- Field: schedule_template_rows.start_date
- Type: integer (day offset from project start, nullable)
- Calculation: ScheduleCascadeService.calculate_start_dates (service method)
- Logic: Based on predecessors completion + lag + working days
- Default: Tasks with no predecessors start on Day 0 (project start)

**How It Works:**
Automatically calculated by backend ScheduleCascadeService based on:
1. Predecessor task end dates
2. Relationship type (FS/SS/FF/SF)
3. Lag days (can be positive or negative)
4. Working day calendar (excludes weekends/holidays)

When user changes duration or moves tasks in Gantt, cascade service recalculates all dependent task start dates. Tasks with no predecessors default to Day 0 (project start date).

**CRITICAL - Cascade Triggers (Bible RULE #10):**
- Changes to start_date trigger cascade
- Changes to duration trigger cascade
- All other fields DO NOT trigger cascade

**Interdependencies:**
- Drives Gantt bar X position in timeline
- Updated by ScheduleCascadeService after drag operations
- Respected by lock system (5 lock types prevent cascade)
- Used in Schedule::TemplateInstantiator for job creation

**Current Limitations:**
- No manual override in templates (auto-calculated only)
- No critical path visualization in table view
- Large dependency chains can slow cascade performance
- No "what-if" analysis for date changes
- Cannot set absolute date in template (offset only)`,
    lock: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2582-2593
- Rendering: Checkbox input, 70px width, center-aligned, order: 5.5 (between Start Date and PO Required)
- Event handlers:
  - onChange: handleFieldChange('manually_positioned', checked) (line 2588)
  - Immediate update (no debounce)
- Tooltip: Dynamic - "Locked - prevents cascade updates" / "Unlocked - allows cascade updates"
- Styling: h-4 w-4 checkbox

**Backend:**
- Field: schedule_template_rows.manually_positioned
- Type: boolean (default: false)
- Validation: None (simple boolean flag)
- Service: ScheduleCascadeService respects this flag when cascading changes

**How It Works:**
Prevents automatic cascade updates when predecessor tasks change. When locked (manually_positioned=true), the task's start_date will NOT be recalculated by ScheduleCascadeService even if predecessor tasks move. Used for tasks that have been manually positioned and should stay fixed regardless of dependency changes. Unlocking allows the cascade service to recalculate the task's position based on predecessors.

**CRITICAL - Cascade Integration:**
- When manually_positioned=true: Task position is LOCKED, cascade skips this task
- When manually_positioned=false: Task position is UNLOCKED, cascade recalculates start_date
- Cascade still flows FROM locked tasks to their successors
- Only prevents cascading TO the locked task

**Interdependencies:**
- Integrated with ScheduleCascadeService (backend/app/services/schedule_cascade_service.rb)
- Matches Gantt view lock functionality (DHtmlxGanttView.jsx:604)
- Works with drag-and-drop in Gantt (auto-locks when manually moved)
- Sorting by lock status available in table view

**Current Limitations:**
- No bulk lock/unlock operations
- No visual indicator in table view beyond checkbox (no lock icon)
- Cannot set conditional locks (e.g., lock after certain date)
- No lock inheritance to dependent tasks
- No lock expiration or auto-unlock based on triggers`,
    poRequired: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2595-2605
- Rendering: Checkbox input, 80px width, center-aligned, order: 6
- Event handlers:
  - onChange: handleFieldChange('po_required', checked) (line 2501)
  - Immediate update (no debounce)
  - Triggers interdependent field updates (lines 2362-2369)
- Styling: h-4 w-4 checkbox

**Backend:**
- Field: schedule_template_rows.po_required
- Type: boolean (default: false)
- Scope: requiring_po scope for filtering (model line 29)
- Validation: None (boolean flag only)

**How It Works:**
Boolean flag indicating this task requires a purchase order. Controls whether supplier dropdown (vs role dropdown) appears in supplierGroup column. Tracks PO requirement for planning but does NOT automatically create POs - use create_po_on_job_start (autoPo) for auto-generation.

**Interdependencies:**
- When checked: supplierGroup switches to supplier dropdown, clears assigned_role (line 2368)
- When unchecked: Clears create_po_on_job_start AND supplier_id (line 2365)
- Gates create_po_on_job_start checkbox (must be checked to enable autoPo)
- Gates price_book_items button (line 2522)
- Available in bulk operations toolbar

**Current Limitations:**
- No automatic PO requirement detection based on task type/category
- No workflow enforcement (can skip PO creation)
- No PO vs quote distinction
- Cannot track PO requirement separately from auto-generation intent`,
    autoPo: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2507-2519
- Rendering: Checkbox input, 80px width, center-aligned, order: 7
- Event handlers:
  - onChange: handleFieldChange('create_po_on_job_start', checked) (line 2513)
  - Validation: Alert if no supplier selected (lines 2371-2375)
  - Immediate update (no debounce)
- Disabled states: Requires BOTH po_required=true AND supplier_id present (line 2514)
- Tooltip: Dynamic based on disabled reason (line 2516)
- Styling: h-4 w-4, disabled:opacity-30

**Backend:**
- Field: schedule_template_rows.create_po_on_job_start
- Type: boolean (default: false)
- Validation: Model validation requires supplier_id if enabled (model lines 84-87)
- Scope: auto_create_po scope for filtering (model line 30)
- Service: Schedule::TemplateInstantiator.create_auto_purchase_orders (line 203)

**How It Works:**
Automatically creates draft purchase orders when job instantiated from template. Requires three conditions: (1) po_required=true, (2) supplier_id present, (3) create_po_on_job_start=true. When all met, TemplateInstantiator service generates PO with supplier details, price book items, and critical flag. POs created in draft status for review before sending to supplier.

**Interdependencies:**
- Auto-unchecked when po_required unchecked (line 2365)
- Supplier cleared when po_required unchecked (line 2365)
- Price Items button requires this enabled (line 2522)
- Bulk operations: Enable Auto PO, Disable Auto PO (lines 1960, 1966)
- Import defaults to false for safety (line 714)

**Current Limitations:**
- POs not automatically sent to supplier (draft only, manual send required)
- No quantity calculation from job specifications
- No automatic price updates if price book changes after PO creation
- No PO template customization per supplier
- No lead time integration with schedule dates`,
    priceItems: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2521-2539
- Rendering: Button showing item count, 120px width, center-aligned, order: 8
- Event handlers:
  - onClick: setShowPriceItemsModal(true) opens modal (line 2526)
  - Conditional enable: canSelectItems = create_po_on_job_start && po_required && supplier_id (line 2522)
- Display: "{count} items" (e.g., "3 items")
- Disabled states: Multi-condition tooltip (lines 2529-2534)
- Styling: Indigo link when enabled, gray when disabled

**Backend:**
- Field: schedule_template_rows.price_book_item_ids
- Type: jsonb array of integers
- Helper: price_book_items method fetches PricebookItem records (model lines 45-48)
- Service: Used in Auto PO generation to populate line items

**How It Works:**
Links price book catalog items to task. Click button to open PriceBookItemsModal for multi-select with search. When Auto PO enabled, these items automatically populate PO line items with pricing, descriptions, supplier details. Enables standardized pricing across templates and jobs.

**Interdependencies:**
- Requires create_po_on_job_start=true to enable button (line 2522)
- Requires po_required=true to enable button
- Requires supplier_id present to enable button
- Used by Schedule::TemplateInstantiator for PO line item generation
- Price book items must belong to selected supplier (filter in modal)

**Current Limitations:**
- No quantity specification per item (defaults to 1 in PO generation)
- No automatic price updates if catalog changes after template creation
- Cannot link items from multiple suppliers per task
- No unit of measure selection
- No item substitution rules`,
    critical: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2545-2555
- Rendering: Checkbox input, 80px width, center-aligned, order: 9
- Event handlers:
  - onChange: handleFieldChange('critical_po', checked) (line 2551)
  - Immediate update (no debounce)
- Styling: h-4 w-4 checkbox

**Backend:**
- Field: schedule_template_rows.critical_po
- Type: boolean (default: false)
- Validation: None (simple boolean flag)
- Service: Copied to ProjectTask.critical_po on instantiation

**How It Works:**
Marks task/PO as critical priority requiring immediate attention. When Auto PO creates purchase order, critical flag transfers to PO record. Critical POs display with red badge/urgent styling in supplier and manager views. Used to flag time-sensitive work that could delay entire project if not prioritized.

**Interdependencies:**
- Flag copied to generated POs (Schedule::TemplateInstantiator)
- Copied to ProjectTask on job instantiation
- Export/import preserves critical status
- Available in bulk operations (though not currently implemented)

**Current Limitations:**
- No automatic escalation workflow for critical POs
- No due date enforcement based on critical status
- Cannot set criticality threshold rules (e.g., value-based auto-flagging)
- No notification system for critical task approaching
- No reporting/dashboard for all critical items`,
    tags: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2557-2568
- Rendering: Text input field, 100px width, left-aligned, order: 10
- Event handlers:
  - onChange: handleFieldChange('tags', value.split(',').map(trim).filter(Boolean)) (line 2563)
  - Immediate update (no debounce)
  - Parsing: Comma-separated string → array
- Placeholder: "tag1, tag2"
- Display: row.tags?.join(', ') - array → comma-separated string

**Backend:**
- Field: schedule_template_rows.tags
- Type: jsonb array of strings
- Helper: tag_list method returns array (model lines 49-51)
- Examples: ['electrical', 'foundation', 'inspection', 'milestone']

**How It Works:**
User enters comma-separated tags for task categorization (e.g., 'electrical, foundation, inspection'). Frontend parses CSV to array, stores as JSON. Enables filtering and grouping tasks by trade, phase, or category in schedule views. Used for generating trade-specific reports and filtering job schedules.

**Interdependencies:**
- Filter dropdown uses tags for quick filtering
- Export includes tags column
- Import parses Tags column as CSV
- Sorting by tags (alphabetical)

**Current Limitations:**
- No tag autocomplete or suggestions from existing tags
- No tag standardization or validation (typos create duplicate concepts)
- Cannot create tag taxonomies or hierarchies
- No tag color coding or icons
- No character limit on individual tags`,
    photo: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2570-2580
- Rendering: Checkbox input, 80px width, center-aligned, order: 11
- Event handlers:
  - onChange: handleFieldChange('require_photo', checked) (line 2576)
  - Immediate update (no debounce)
- Styling: h-4 w-4 checkbox

**Backend:**
- Field: schedule_template_rows.require_photo
- Type: boolean (default: false)
- Scope: with_photos scope for filtering (model line 31)
- Service: Schedule::TaskSpawner.spawn_photo_task (spawning service)
- Callback: sync_photos_category manages documentation categories (model line 23)

**How It Works:**
When parent task marked complete in job schedule, automatically spawns child photo documentation task. Photo task appears in job timeline with spawned_type='photo' and due date = parent completion date. Used for required photo documentation (council submissions, quality checks, client updates, before/after shots).

**Interdependencies:**
- Triggers TaskSpawner service on parent task completion
- Documentation categories auto-managed via callback
- Photo task inherits context from parent task
- Export/import preserves require_photo flag

**Current Limitations:**
- No photo count specification (how many photos required)
- No photo type/angle requirements (overhead, closeup, etc.)
- Cannot customize photo task name template per task type
- No automatic photo upload integration
- Photo task due date always equals parent completion (no offset like certLag)`,
    cert: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2582-2592
- Rendering: Checkbox input, 80px width, center-aligned, order: 12
- Event handlers:
  - onChange: handleFieldChange('require_certificate', checked) (line 2588)
  - Immediate update (no debounce)
  - Enables certLag field when checked
- Styling: h-4 w-4 checkbox

**Backend:**
- Field: schedule_template_rows.require_certificate
- Type: boolean (default: false)
- Scope: with_certificates scope for filtering (model line 32)
- Service: Schedule::TaskSpawner.spawn_certificate_task (spawning service)

**How It Works:**
When parent task completed, automatically spawns certificate task due X days later (see certLag). Used for regulatory certifications, compliance documents, inspections with submission deadlines after work completion (e.g., Frame task completes Jan 1 → Frame Certificate due Jan 11 with 10-day lag).

**Interdependencies:**
- Enables certLag number input (disabled if unchecked)
- Triggers TaskSpawner service on parent completion
- Certificate due date = parent completion + cert_lag_days
- Default lag: 10 days (if cert_lag_days not specified)

**Current Limitations:**
- No certificate type specification (generic "certificate" only)
- No issuing authority tracking
- Cannot link to specific regulatory requirements
- No template for certificate task name
- No reminder system as deadline approaches`,
    certLag: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2594-2605
- Rendering: Number input field, 80px width, center-aligned, order: 13
- Event handlers:
  - onChange: handleFieldChange('cert_lag_days', parseInt(value)) (line 2600)
  - Immediate update (no debounce)
- Disabled: When require_certificate=false (line 2601)
- Styling: Full width, disabled:opacity-50

**Backend:**
- Field: schedule_template_rows.cert_lag_days
- Type: integer (default: 10, range 0-999)
- Validation: Numericality >= 0, <= 999 (model line 16)
- Service: Used in TaskSpawner.spawn_certificate_task for due date calc

**How It Works:**
Specifies working days after task completion when certificate task becomes due. Allows flexibility for different certification timelines (immediate inspection vs extended review periods). Calculation: cert_due_date = parent_completion_date + cert_lag_days (working days).

**Interdependencies:**
- Only enabled when require_certificate=true
- Used by TaskSpawner service for due date calculation
- Respects working day calendar (excludes weekends/holidays)
- Default value: 10 days if not specified

**Current Limitations:**
- Fixed to days only (no hours/weeks option)
- No automatic reminders as deadline approaches
- Cannot vary lag by certificate type
- No calendar date picker (offset only)
- Maximum 999 days enforced but no business logic validation`,
    supCheck: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2607-2628
- Rendering: Checkbox + conditional button, 120px width, left-aligned, order: 14
- Event handlers:
  - Checkbox onChange: handleFieldChange('require_supervisor_check', checked) (line 2614)
  - Button onClick: handleOpenChecklistModal (line 2619)
  - Conditional display: Button only shown if require_supervisor_check=true (line 2617)
- Display: "{count} items" showing supervisor_checklist_template_ids.length
- Styling: Flex layout, gap-2, checkbox + link button

**Backend:**
- Fields:
  - schedule_template_rows.require_supervisor_check (boolean)
  - schedule_template_rows.supervisor_checklist_template_ids (jsonb array)
- Scope: supervisor_checks scope (model line 33)
- Service: TemplateInstantiator.create_checklist_items_for_task
- Target: Copied to ProjectTask.requires_supervisor_check

**How It Works:**
Requires supervisor to physically visit site and verify quality/completion using standardized checklists. Click checkbox to enable, then click items button to assign specific checklist templates. On job instantiation, checklist items created from templates. Supervisor gets notification to perform check before task can be marked complete. Ensures quality control at critical construction phases.

**Interdependencies:**
- Button only appears when checkbox enabled
- Checklist templates selected via SupervisorChecklistModal
- ChecklistTemplate records referenced by IDs
- Copied to ProjectTask on job creation

**Current Limitations:**
- No supervisor assignment/scheduling
- Cannot require multiple supervisor types (e.g., electrical + structural)
- No automatic notification to supervisors
- No check-in GPS/photo requirements
- Cannot vary checklist by job type`,
    autoComplete: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2630-2641
- Rendering: Button showing task count, 120px width, center-aligned, order: 15
- Event handlers:
  - onClick: setShowAutoCompleteModal(true) (line 2634)
  - Opens AutoCompleteTasksModal for task selection
- Display: "{count} tasks" (e.g., "3 tasks")
- Styling: Text-xs, indigo link color, hover underline, cursor-pointer

**Backend:**
- Fields:
  - schedule_template_rows.auto_complete_task_ids (jsonb array of task IDs)
  - schedule_template_rows.auto_complete_predecessors (boolean)
- Validation: None (optional feature)
- Service: Task completion logic checks this field

**How It Works:**
When THIS task completes, automatically marks specified tasks as complete. Useful for milestone tasks that signal completion of multiple other tasks. Example: "Final Inspection Passed" auto-completes "Frame Complete", "Electrical Complete", "Plumbing Complete". Click button to open modal, select which tasks should auto-complete.

**Interdependencies:**
- Modal displays all tasks in template for selection
- Task completion service checks auto_complete_task_ids
- Can create circular dependencies if misconfigured
- auto_complete_predecessors flag auto-completes all predecessor tasks

**Current Limitations:**
- No circular dependency detection/warning
- Cannot auto-complete based on percentage/partial completion
- No cascade notification to affected task assignees
- No audit trail showing which task triggered auto-completion
- Cannot conditionally auto-complete (always/never, no "if X then Y")`,
    subtasks: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2643-2654
- Rendering: Button showing subtask count, 120px width, center-aligned, order: 16
- Event handlers:
  - onClick: setShowSubtasksModal(true) (line 2647)
  - Opens SubtasksModal for subtask management
- Display: "{count} subtasks" (e.g., "3 subtasks")
- Styling: Text-xs, indigo link color, hover underline, cursor-pointer

**Backend:**
- Fields:
  - schedule_template_rows.has_subtasks (boolean)
  - schedule_template_rows.subtask_count (integer)
  - schedule_template_rows.subtask_names (jsonb array of strings)
  - schedule_template_rows.subtask_template_ids (jsonb array of integers)
- Validation: subtask_count must match subtask_names.length (model lines 88-95)
- Scope: with_subtasks scope (model line 34)
- Service: TaskSpawner.spawn_subtasks on parent task start

**How It Works:**
Auto-creates child tasks when parent task starts in job schedule. Breaks complex activities into manageable steps with individual tracking. Example: "Frame House" → ["Frame Walls", "Frame Roof", "Frame Internal"]. Each subtask can be tracked and completed independently while rolling up to parent progress. Subtasks defined by names OR template IDs.

**Interdependencies:**
- Triggers TaskSpawner service when parent task starts
- subtask_names and subtask_count must stay synchronized (validation)
- subtask_template_ids references ScheduleTemplate records
- Modal manages both name list and template selection

**Current Limitations:**
- No percentage-based parent completion from subtasks
- Cannot dynamically add/remove subtasks after instantiation
- No subtask dependency management (all independent)
- No parent-child progress rollup visualization
- Cannot nest subtasks (one level only)`,
    linkedTasks: `**Status:** Partially implemented ⚠️

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2656-2667
- Rendering: Button showing linked task count, 120px width, center-aligned, order: 17
- Event handlers:
  - onClick: setShowLinkedTasksModal(true) (line 2660)
  - Opens LinkedTasksModal (may not be fully implemented)
- Display: "{count} tasks" (e.g., "2 tasks")
- Styling: Text-xs, indigo link color, hover underline, cursor-pointer

**Backend:**
- Fields:
  - schedule_template_rows.linked_task_ids (text, JSON serialized, model line 7)
  - schedule_template_rows.linked_template_id (integer FK, optional)
- Validation: None
- Status: Database fields exist, linking/synchronization logic incomplete

**How It Works:**
INTENDED: Create relationships between tasks for grouping or cross-template dependencies. Enable task coordination across different schedule templates or job phases without formal predecessor relationships.

CURRENT STATUS: UI exists, database fields exist, but full linking logic not implemented. Modal may not function correctly. Linking behavior undefined.

**Known Issues:**
- Linking logic incomplete - unclear what happens when tasks linked
- No synchronization between linked tasks
- linked_template_id purpose unclear
- No validation of linked_task_ids references

**Current Limitations:**
- No visualization of linked task relationships
- Cannot specify link type/purpose
- No automatic notifications when linked tasks update
- Cross-template linking not functional
- May be deprecated - verify with product owner`,
    manualTask: `**Status:** Not implemented ❌

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2669-2679
- Rendering: Checkbox input, 80px width, center-aligned, order: 18
- Event handlers:
  - onChange: onUpdate({ manual_task: checked }) (line 2675)
  - Immediate update, direct to onUpdate (not handleFieldChange)
- Styling: h-4 w-4, indigo-600, rounded, cursor-pointer

**Backend:**
- Field: schedule_template_rows.manual_task
- Type: boolean (default: false)
- Status: Field exists, NO filtering logic implemented
- Service: NOT USED - tasks with this flag still auto-load on job creation

**How It Works:**
INTENDED: Manual tasks should never get automatically loaded into job schedules. Must be manually created by user. Useful for optional or conditional work items.

CURRENT STATUS: Checkbox works, value saves to database, but NO filtering in Schedule::TemplateInstantiator. Tasks with manual_task=true still auto-instantiate when job created.

**Known Issues:**
- Checkbox saves to DB but has no effect
- TemplateInstantiator doesn't check manual_task flag
- Feature appears functional but is non-functional

**Implementation Required:**
- Add filter to TemplateInstantiator: skip if manual_task=true
- Add scope: manual_tasks for filtering
- Add UI to manually create manual tasks in job schedule

**Current Limitations:**
- Feature completely non-functional (UI only)
- No conditional activation rules
- Cannot suggest manual task creation based on job attributes
- No tracking of manual task usage frequency`,
    multipleItems: `**Status:** Not implemented ❌

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2681-2691
- Rendering: Checkbox input, 80px width, center-aligned, order: 19
- Event handlers:
  - onChange: onUpdate({ allow_multiple_instances: checked }) (line 2687)
  - Immediate update, direct to onUpdate
- Styling: h-4 w-4, indigo-600, rounded, cursor-pointer

**Backend:**
- Field: schedule_template_rows.allow_multiple_instances
- Type: boolean (default: false)
- Status: Field exists, NO prompt/duplication logic implemented
- Service: NOT USED - no multi-instance creation logic

**How It Works:**
INTENDED: Upon task completion, prompt user to create additional instances with auto-incrementing names (e.g., "Frame Inspection", "Frame Inspection 2", "Frame Inspection 3"). Handles recurring work items without manual template duplication.

CURRENT STATUS: Checkbox works, value saves to database, but NO prompting or instance creation logic in ProjectTask completion handlers.

**Known Issues:**
- Checkbox saves to DB but has no effect
- No prompt triggered on task completion
- No instance numbering logic
- Feature appears functional but is non-functional

**Implementation Required:**
- Add completion hook to ProjectTask model
- Prompt user: "Create another instance of this task?"
- Auto-increment naming: append " 2", " 3", etc.
- Copy all attributes to new instance

**Current Limitations:**
- Feature completely non-functional (UI only)
- No automatic instance creation based on quantity
- Cannot pre-define instance count
- No bulk instance management`,
    orderRequired: `**Status:** Not implemented ❌

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2693-2703
- Rendering: Checkbox input, 100px width, center-aligned, order: 20
- Event handlers:
  - onChange: onUpdate({ order_required: checked }) (line 2699)
  - Immediate update, direct to onUpdate
- Styling: h-4 w-4, indigo-600, rounded, cursor-pointer
- Label: "Order Time" (column config line 107)

**Backend:**
- Field: schedule_template_rows.order_required
- Type: boolean (default: false)
- Status: Field exists, NO tracking or notification logic
- Service: NOT USED - no schedule adjustment logic

**How It Works:**
INTENDED: Flag tasks with material order lead time requirements. Tracked for planning and should automatically adjust schedule dates to account for order processing time.

CURRENT STATUS: Checkbox works, value saves to database, but NO integration with cascade service, no lead time calculations, no notifications.

**Known Issues:**
- Checkbox saves to DB but has no effect
- No schedule date adjustment for lead times
- Lead time duration not specified (boolean only, no days value)
- No integration with Auto PO timing
- Feature appears functional but is non-functional

**Implementation Required:**
- Add order_lead_time_days field (integer)
- Integrate with ScheduleCascadeService
- Adjust task start date back by lead time
- Trigger notification when order due date approaches

**Current Limitations:**
- Feature completely non-functional (UI only)
- No automatic schedule adjustment
- Lead time duration not configurable
- No integration with Auto PO
- No vendor lead time database`,
    callUpRequired: `**Status:** Not implemented ❌

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2705-2715
- Rendering: Checkbox input, 100px width, center-aligned, order: 21
- Event handlers:
  - onChange: onUpdate({ call_up_required: checked }) (line 2711)
  - Immediate update, direct to onUpdate
- Styling: h-4 w-4, indigo-600, rounded, cursor-pointer
- Label: "Call Up" (column config line 108)

**Backend:**
- Field: schedule_template_rows.call_up_required
- Type: boolean (default: false)
- Status: Field exists, NO notification or coordination logic
- Service: NOT USED - no supplier notification system

**How It Works:**
INTENDED: Flags tasks requiring supplier call-up/booking advance notice. Should trigger automatic supplier notification X days before task start to schedule delivery/service.

CURRENT STATUS: Checkbox works, value saves to database, but NO supplier notification system, no call-up timing logic, no schedule integration.

**Known Issues:**
- Checkbox saves to DB but has no effect
- No automatic supplier notification
- Call-up duration not specified (boolean only, no days value)
- No integration with schedule cascade
- Feature appears functional but is non-functional

**Implementation Required:**
- Add call_up_lead_time_days field (integer)
- Build supplier notification system
- Calculate notification date: task_start - call_up_lead_time
- Integrate with supplier contact system
- Add booking confirmation workflow

**Current Limitations:**
- Feature completely non-functional (UI only)
- No automatic supplier notification
- Call-up duration not configurable
- No supplier booking confirmation
- No integration with schedule dates`,
    planType: `**Status:** Partially implemented ⚠️

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2717-2727
- Rendering: Checkbox input, 80px width, center-aligned, order: 22
- Event handlers:
  - onChange: onUpdate({ plan_required: checked }) (line 2723)
  - Immediate update, direct to onUpdate
- Styling: h-4 w-4, indigo-600, rounded, cursor-pointer
- Label: "Plan" (column config line 109)

**Backend:**
- Field: schedule_template_rows.plan_required
- Type: boolean (default: false)
- Status: Field exists, conditional activation logic INCOMPLETE
- Plan types: PERSPECTIVE, SITE PLAN, SLAB PLAN, etc. (17 cert drawing types)

**How It Works:**
INTENDED: Task only activates in job schedule if the selected plan tab is required for the job. Conditionally activates documentation tasks based on job plan type selection during job setup.

CURRENT STATUS: UI checkbox works, value saves to database, but conditional activation logic in TemplateInstantiator incomplete. Tasks appear in job schedules regardless of job's plan requirements. Plan type selection unclear (checkbox vs dropdown mismatch).

**Known Issues:**
- UI shows checkbox but should be dropdown for plan type selection
- No plan type specification (which plan types trigger this task?)
- Boolean field but should store plan type enum/array
- Activation logic not implemented in TemplateInstantiator
- Tasks instantiate regardless of plan_required value

**Implementation Required:**
- Change to dropdown: select plan type (PERSPECTIVE, SITE PLAN, etc.)
- Change field to plan_types array (multiple selection)
- Add job.required_plan_types field
- Filter in TemplateInstantiator: skip if plan types don't match
- Add plan availability validation

**Current Limitations:**
- Incorrect UI (checkbox vs dropdown)
- No plan type specification
- Boolean only (no multi-plan-type support)
- Activation filtering not implemented
- No plan availability validation`,
    actions: `**Status:** Fully functional ✅

**Frontend Implementation:**
- Location: ScheduleTemplateEditor.jsx:2729-2748
- Rendering: Flex container with 3 buttons, 80px width, left-aligned, order: 100 (last)
- Event handlers:
  - Move Up: onMoveUp callback (line 2734), conditional render if canMoveUp
  - Move Down: onMoveDown callback (line 2739), conditional render if canMoveDown
  - Delete: onDelete callback (line 2743), always rendered
- Icons: ArrowUpIcon, ArrowDownIcon, TrashIcon (h-4 w-4)
- Styling: Flex gap-1, hover:text-indigo-600, hover:text-red-600 (delete)

**Backend:**
- Move operations: Update sequence_order, resequence all affected rows
- Delete operation: API DELETE to /schedule_templates/:id/rows/:row_id
- Cascade: Row deletion cascades to audits (dependent: :destroy)

**How It Works:**
Three action buttons for row management:
1. **Move Up (↑)**: Swaps sequence_order with previous row, resequences, refreshes display. Only shown if not first row.
2. **Move Down (↓)**: Swaps sequence_order with next row, resequences, refreshes display. Only shown if not last row.
3. **Delete (trash)**: Shows confirmation dialog, sends DELETE request, removes from display on success.

All operations trigger immediate save and re-render. Move operations update multiple rows to maintain continuous sequence numbering.

**Interdependencies:**
- canMoveUp: index > 0
- canMoveDown: index < rows.length - 1
- Delete requires confirmation (modal/alert)
- Resequencing affects all rows after moved row
- Delete may orphan predecessor references in other tasks

**Current Limitations:**
- No drag-and-drop reordering (move up/down only)
- Cannot move multiple selected rows simultaneously
- No undo/redo for delete operations
- Delete doesn't update dependent tasks (orphaned predecessor refs)
- No bulk delete (must delete one at a time)
- Move operations can be slow with many rows (resequences all)`
  }))
  const [columnComplete, setColumnComplete] = useState(() => loadFromLocalStorage('scheduleMaster_columnComplete', {}))
  const [mdInstructions, setMdInstructions] = useState(() => loadFromLocalStorage('scheduleMaster_mdInstructions', {}))
  const [searchQuery, setSearchQuery] = useState('')
  const [editingMd, setEditingMd] = useState(null) // Which column's MD is being edited
  const [editingCcUpdate, setEditingCcUpdate] = useState(null) // Which column's CC Update is being edited
  const mdTextareaRef = useRef(null)
  const ccUpdateTextareaRef = useRef(null)

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      window.localStorage.setItem('scheduleMaster_ccUpdates', JSON.stringify(ccUpdates))
    } catch (error) {
      console.error('Error saving ccUpdates to localStorage:', error)
    }
  }, [ccUpdates])

  useEffect(() => {
    try {
      window.localStorage.setItem('scheduleMaster_columnComplete', JSON.stringify(columnComplete))
    } catch (error) {
      console.error('Error saving columnComplete to localStorage:', error)
    }
  }, [columnComplete])

  useEffect(() => {
    try {
      window.localStorage.setItem('scheduleMaster_mdInstructions', JSON.stringify(mdInstructions))
    } catch (error) {
      console.error('Error saving mdInstructions to localStorage:', error)
    }
  }, [mdInstructions])

  // Complete column documentation from Schedule Template Editor
  const columnData = [
    {
      columnNumber: -1,
      name: 'select',
      label: '',
      type: 'Checkbox',
      description: 'Row selection checkbox for bulk operations. Allows users to select multiple rows for deletion or batch updates.',
      currentlyUsed: 'Yes - Enables multi-select for bulk operations on template rows',
      width: 40,
      align: 'center'
    },
    {
      columnNumber: 0,
      name: 'sequence',
      label: '#',
      type: 'Read-only Text',
      description: 'Auto-generated task sequence number showing the position/order in the schedule template.',
      currentlyUsed: 'Yes - Displays task index for reference and ordering',
      width: 40,
      align: 'center'
    },
    {
      columnNumber: 1,
      name: 'taskName',
      label: 'Task Name',
      type: 'Text Input',
      description: 'The name of the task that will appear in the schedule. Be descriptive so builders know exactly what needs to be done.',
      currentlyUsed: 'Yes - Primary identifier for tasks in the schedule',
      width: 200,
      align: 'left'
    },
    {
      columnNumber: 2,
      name: 'supplierGroup',
      label: 'Supplier / Group',
      type: 'Dropdown/Select',
      description: 'For PO tasks: select a supplier. For internal work: assign to a team (Admin, Sales, Site, Supervisor, Builder, Estimator).',
      currentlyUsed: 'Yes - Used for task assignment, supplier linkage, and smart PO generation',
      width: 150,
      align: 'left'
    },
    {
      columnNumber: 3,
      name: 'predecessors',
      label: 'Predecessors',
      type: 'Custom Component (Predecessor Editor)',
      description: 'Tasks that must be completed before this one starts. Supports FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), and SF (Start-to-Finish) dependencies with lag days.',
      currentlyUsed: 'Yes - Core dependency management for schedule cascade calculations',
      width: 100,
      align: 'left'
    },
    {
      columnNumber: 4,
      name: 'duration',
      label: 'Duration',
      type: 'Number Input',
      description: 'Number of days this task will take to complete.',
      currentlyUsed: 'Yes - Determines task length in schedule calculations',
      width: 80,
      align: 'center'
    },
    {
      columnNumber: 5,
      name: 'startDate',
      label: 'Start Date',
      type: 'Read-only Date',
      description: 'Calculated start date based on predecessors and durations. Tasks with no predecessors start on Day 0 (project start).',
      currentlyUsed: 'Yes - Computed field showing when task will begin',
      width: 110,
      align: 'center'
    },
    {
      columnNumber: 6,
      name: 'poRequired',
      label: 'PO Req',
      type: 'Checkbox',
      description: 'Check if this task requires a purchase order. This tracks whether a PO is needed, but doesn\'t automatically create one.',
      currentlyUsed: 'Yes - Boolean flag for PO requirement tracking',
      width: 80,
      align: 'center'
    },
    {
      columnNumber: 7,
      name: 'autoPo',
      label: 'Auto PO',
      type: 'Checkbox',
      description: 'Automatically create and send a purchase order to the supplier when the job starts. Requires a supplier to be selected.',
      currentlyUsed: 'Yes - Enables automatic PO generation on job start',
      width: 80,
      align: 'center'
    },
    {
      columnNumber: 8,
      name: 'priceItems',
      label: 'Price Items',
      type: 'Custom Component (Price Book Modal)',
      description: 'Link price book items to this task. These items will be included in the auto-generated purchase order.',
      currentlyUsed: 'Yes - Links to price book for PO line items',
      width: 120,
      align: 'left'
    },
    {
      columnNumber: 9,
      name: 'critical',
      label: 'Critical',
      type: 'Checkbox',
      description: 'Mark this PO as critical priority. Critical POs will be highlighted and require immediate attention.',
      currentlyUsed: 'Yes - Boolean flag for priority marking',
      width: 80,
      align: 'center'
    },
    {
      columnNumber: 10,
      name: 'tags',
      label: 'Tags',
      type: 'Multi-select/Tags Input',
      description: 'Add tags to categorize and filter tasks (e.g., \'electrical\', \'foundation\', \'inspection\'). Useful for filtering views by trade.',
      currentlyUsed: 'Yes - Array of tags for categorization and filtering',
      width: 100,
      align: 'left'
    },
    {
      columnNumber: 11,
      name: 'photo',
      label: 'Photo',
      type: 'Checkbox',
      description: 'Automatically spawn a photo task when this task is completed. Use for tasks that need photo documentation.',
      currentlyUsed: 'Yes - Boolean trigger for photo task creation',
      width: 80,
      align: 'center'
    },
    {
      columnNumber: 12,
      name: 'cert',
      label: 'Cert',
      type: 'Checkbox',
      description: 'Automatically spawn a certificate task when this task is completed. Used for regulatory certifications and compliance documents.',
      currentlyUsed: 'Yes - Boolean trigger for certificate task creation',
      width: 80,
      align: 'center'
    },
    {
      columnNumber: 13,
      name: 'certLag',
      label: 'Cert Lag',
      type: 'Number Input',
      description: 'Number of days after task completion when the certificate is due. Default is 10 days.',
      currentlyUsed: 'Yes - Integer value for cert due date offset',
      width: 80,
      align: 'center'
    },
    {
      columnNumber: 14,
      name: 'supCheck',
      label: 'Sup Check',
      type: 'Custom Component (Supervisor Checklist Modal)',
      description: 'Require a supervisor to check in on this task. Supervisor will get a prompt to visit the site and verify quality.',
      currentlyUsed: 'Yes - Links to supervisor checklist templates',
      width: 120,
      align: 'left'
    },
    {
      columnNumber: 15,
      name: 'autoComplete',
      label: 'Auto Complete',
      type: 'Custom Component (Auto Complete Modal)',
      description: 'Select specific tasks that should be automatically marked as complete when this task is completed. Useful for milestone tasks that signal the completion of multiple other tasks.',
      currentlyUsed: 'Yes - Links to predecessor tasks for auto-completion',
      width: 120,
      align: 'left'
    },
    {
      columnNumber: 16,
      name: 'subtasks',
      label: 'Subtasks',
      type: 'Custom Component (Subtasks Modal)',
      description: 'Automatically create subtasks when this task starts. Useful for breaking down complex tasks into smaller steps.',
      currentlyUsed: 'Yes - Links to subtask templates for auto-creation',
      width: 120,
      align: 'left'
    },
    {
      columnNumber: 17,
      name: 'linkedTasks',
      label: 'Linked Tasks',
      type: 'Custom Component (Linked Tasks Modal)',
      description: 'Link this task to other tasks in the schedule. Useful for grouping related tasks or creating task dependencies across templates.',
      currentlyUsed: 'Yes - Links tasks for grouping and cross-template dependencies',
      width: 120,
      align: 'left'
    },
    {
      columnNumber: 18,
      name: 'manualTask',
      label: 'Manual',
      type: 'Checkbox',
      description: 'Manual task - never gets automatically loaded or activated in the schedule. Must be manually created.',
      currentlyUsed: 'Yes - Boolean flag to exclude from automatic schedule generation',
      width: 80,
      align: 'center'
    },
    {
      columnNumber: 19,
      name: 'multipleItems',
      label: 'Multi',
      type: 'Checkbox',
      description: 'When this task is completed, user will be prompted if they need another instance (e.g., \'Frame Inspection\', \'Frame Inspection 2\', etc.).',
      currentlyUsed: 'Yes - Boolean trigger for multi-instance task prompts',
      width: 80,
      align: 'center'
    },
    {
      columnNumber: 20,
      name: 'orderRequired',
      label: 'Order Time',
      type: 'Number Input',
      description: 'Order time required from pricebook items. Tracks order placement timeline requirements.',
      currentlyUsed: 'Yes - Integer days for order lead time',
      width: 100,
      align: 'center'
    },
    {
      columnNumber: 21,
      name: 'callUpRequired',
      label: 'Call Up',
      type: 'Number Input',
      description: 'Call up time required from pricebook items. Tracks call-up/booking timeline requirements.',
      currentlyUsed: 'Yes - Integer days for call-up lead time',
      width: 100,
      align: 'center'
    },
    {
      columnNumber: 22,
      name: 'planType',
      label: 'Plan',
      type: 'Dropdown/Select',
      description: 'This task is for documents that only get activated if a plan tab is selected. Select the plan/drawing type.',
      currentlyUsed: 'Yes - Links to documentation plan types (PERSPECTIVE, SITE PLAN, ELEVATIONS, etc.)',
      width: 80,
      align: 'left'
    },
    {
      columnNumber: 100,
      name: 'actions',
      label: 'Actions',
      type: 'Action Buttons',
      description: 'Action buttons for row operations: Edit, Duplicate, Delete, Move Up/Down.',
      currentlyUsed: 'Yes - Contains inline action buttons for row management',
      width: 80,
      align: 'center'
    }
  ]

  const handleCcUpdateChange = (columnName, value) => {
    setCcUpdates({
      ...ccUpdates,
      [columnName]: value
    })
  }

  const handleColumnCompleteChange = (columnName, checked) => {
    setColumnComplete({
      ...columnComplete,
      [columnName]: checked
    })
  }

  const insertMarkdown = (prefix, suffix = '', isForCcUpdate = false) => {
    const textarea = isForCcUpdate ? ccUpdateTextareaRef.current : mdTextareaRef.current
    const editing = isForCcUpdate ? editingCcUpdate : editingMd
    if (!textarea || !editing) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = isForCcUpdate ? (ccUpdates[editing] || '') : (mdInstructions[editing] || '')
    const selectedText = text.substring(start, end)

    const newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end)

    if (isForCcUpdate) {
      setCcUpdates({ ...ccUpdates, [editing]: newText })
    } else {
      setMdInstructions({ ...mdInstructions, [editing]: newText })
    }

    // Set cursor position after the prefix
    setTimeout(() => {
      textarea.focus()
      textarea.selectionStart = textarea.selectionEnd = start + prefix.length + selectedText.length
    }, 0)
  }

  const handleClearAllData = () => {
    if (window.confirm('Are you sure you want to clear all CC Updates, MD Instructions, and Complete checkboxes? This cannot be undone.')) {
      setCcUpdates({})
      setMdInstructions({})
      setColumnComplete({})
      // Also clear from localStorage
      try {
        window.localStorage.removeItem('scheduleMaster_ccUpdates')
        window.localStorage.removeItem('scheduleMaster_mdInstructions')
        window.localStorage.removeItem('scheduleMaster_columnComplete')
      } catch (error) {
        console.error('Error clearing localStorage:', error)
      }
    }
  }

  // Filter columns based on search query
  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) {
      return columnData
    }

    const query = searchQuery.toLowerCase()
    return columnData.filter(column => {
      return (
        column.name.toLowerCase().includes(query) ||
        column.label.toLowerCase().includes(query) ||
        column.description.toLowerCase().includes(query) ||
        column.currentlyUsed.toLowerCase().includes(query) ||
        column.columnNumber.toString().includes(query)
      )
    })
  }, [searchQuery])

  const handleExport = () => {
    let exportText = '# Schedule Master Column Documentation\n\n'
    exportText += 'This document provides comprehensive information about all columns in the TEEEM Schedule Master Gantt view.\n\n'
    exportText += '## Purpose\n'
    exportText += 'Use this document with Claude (AI assistant) to help develop new features for specific columns.\n\n'
    exportText += '---\n\n'

    columnData.forEach((column) => {
      exportText += `## Column ${column.columnNumber}: ${column.label}\n\n`
      exportText += `**Internal Name:** \`${column.name}\`\n\n`
      exportText += `**Column Number:** ${column.columnNumber}\n\n`
      exportText += `**Type:** ${column.type || 'Not specified'}\n\n`
      exportText += `**Width:** ${column.width}px\n\n`
      exportText += `**Alignment:** ${column.align}\n\n`
      if (column.conditional) {
        exportText += `**Conditional Display:** ${column.conditional}\n\n`
      }
      exportText += `**Description:**\n${column.description}\n\n`
      exportText += `**Currently Used in TEEEM:**\n${column.currentlyUsed}\n\n`
      exportText += `**Column Complete:** ${columnComplete[column.name] ? 'Yes ✓' : 'No'}\n\n`

      if (ccUpdates[column.name]) {
        exportText += `**CC Update Required:**\n${ccUpdates[column.name]}\n\n`
      }

      if (mdInstructions[column.name]) {
        exportText += `**Development Instructions:**\n${mdInstructions[column.name]}\n\n`
      }

      exportText += '---\n\n'
    })

    exportText += '## Additional Context\n\n'
    exportText += '### Key Features\n'
    exportText += '- **Drag & Drop:** Tasks can be dragged to change dates, resized to change duration\n'
    exportText += '- **Link Creation:** Drag from task to task to create predecessor relationships\n'
    exportText += '- **Cascade Calculation:** Backend service recalculates all dependent task dates when a task changes\n'
    exportText += '- **Lock Position:** Prevents cascade from moving specific tasks (milestones)\n'
    exportText += '- **Public Holidays:** Automatically excluded from duration calculations\n'
    exportText += '- **Work Time:** Weekends (Saturday/Sunday) are non-working days\n\n'
    exportText += '### Gantt Configuration\n'
    exportText += '- **Auto-scheduling:** Disabled (backend cascade service handles all dependency updates)\n'
    exportText += '- **Duration Unit:** Days (working days only)\n'
    exportText += '- **Undo/Redo:** Enabled (PRO feature)\n'
    exportText += '- **Tooltip:** Enabled with 1 second delay\n\n'
    exportText += '### Integration Points\n'
    exportText += '- **Suppliers:** Linked to Contact records for smart PO generation\n'
    exportText += '- **Templates:** Tasks can be created from schedule templates\n'
    exportText += '- **Job Schedule:** Each job has its own schedule instance\n'
    exportText += '- **Bug Hunter:** Automated testing framework for schedule behavior\n\n'

    // Create download
    const blob = new Blob([exportText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `schedule-master-columns-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 sm:px-6 lg:px-8 py-6 border-b border-gray-200 dark:border-gray-700">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Schedule Master Column Documentation</h1>
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              Complete reference for all columns in the Schedule Master Gantt view. Use this to document new feature requirements for Claude AI.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <DocumentArrowDownIcon className="h-5 w-5" />
              Export to Text File
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-md border-0 py-2 pl-10 pr-3 text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:focus:ring-indigo-500 sm:text-sm sm:leading-6 bg-white dark:bg-gray-800"
            placeholder="Search columns by name, label, description, or usage..."
          />
          {searchQuery && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <button
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <span className="sr-only">Clear search</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </div>
        {searchQuery && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredColumns.length} of {columnData.length} columns
          </p>
        )}
      </div>

      {/* Scrollable Table Container */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 overflow-hidden flex flex-col">
        <div
          className="flex-1"
          style={{
            overflowX: 'scroll',
            overflowY: 'scroll',
            scrollbarWidth: 'thin',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 dark:ring-white dark:ring-opacity-10 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6" style={{ width: '50px' }}>
                      Col #
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white" style={{ width: '120px' }}>
                      Column Name
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white" style={{ width: '100px' }}>
                      Label
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white" style={{ width: '140px' }}>
                      Type
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white" style={{ width: '200px' }}>
                      Description
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white" style={{ width: '200px' }}>
                      CC Update
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-white" style={{ width: '80px' }}>
                      Complete
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-white" style={{ width: '400px' }}>
                      MD
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {filteredColumns.map((column) => (
                    <tr key={column.name} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                        {column.columnNumber}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                        <code className="rounded bg-gray-100 dark:bg-gray-800 px-2 py-1 text-xs font-mono">
                          {column.name}
                        </code>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {column.label || '(empty)'}
                        {column.conditional && (
                          <span className="ml-2 inline-flex items-centers rounded-md bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 text-xs font-medium text-yellow-800 dark:text-yellow-300">
                            Conditional
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {column.type || '-'}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-md">
                        {column.description}
                      </td>
                      <td className="px-3 py-4 text-sm">
                        <button
                          onClick={() => setEditingCcUpdate(column.name)}
                          className="w-full text-left px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[60px] flex items-center overflow-hidden"
                        >
                          <span className={`text-sm line-clamp-2 ${ccUpdates[column.name] ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                            {ccUpdates[column.name] || 'Not coded yet'}
                          </span>
                        </button>
                      </td>
                      <td className="px-3 py-4 text-sm text-center">
                        <input
                          type="checkbox"
                          checked={columnComplete[column.name] || false}
                          onChange={(e) => handleColumnCompleteChange(column.name, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-600 dark:bg-gray-700 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-4 text-sm">
                        <button
                          onClick={() => setEditingMd(column.name)}
                          className="w-full text-left px-3 py-2 rounded-md border border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors min-h-[60px] flex items-center relative overflow-hidden"
                        >
                          <span className={`text-sm line-clamp-2 ${mdInstructions[column.name] ? 'text-gray-900 dark:text-white pr-8' : 'text-gray-400 dark:text-gray-500'}`}>
                            {mdInstructions[column.name] || 'Click to add instructions...'}
                          </span>
                          {mdInstructions[column.name] && (
                            <PencilSquareIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400 absolute top-2 right-2" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* CC Update Modal (Read-only) */}
      {editingCcUpdate && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" onClick={() => setEditingCcUpdate(null)}></div>

            <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-[90vw] sm:max-w-[90vw] sm:h-[90vh] sm:max-h-[90vh] sm:p-6 flex flex-col">
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingCcUpdate(null)}
                  className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="w-full mb-4">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                    CC Update Status: {columnData.find(c => c.name === editingCcUpdate)?.label || editingCcUpdate}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Read-only view of current implementation status
                  </p>
                </div>

                <div className="flex-1 overflow-auto">
                  <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                    {ccUpdates[editingCcUpdate] ? (
                      <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900 dark:text-white">
                        {ccUpdates[editingCcUpdate]}
                      </pre>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-gray-400 dark:text-gray-500 italic text-lg">Not coded yet</p>
                        <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">This column has no implementation code at this time</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingCcUpdate(null)}
                    className="inline-flex justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MD Instructions Modal */}
      {editingMd && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" onClick={() => setEditingMd(null)}></div>

            <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-[90vw] sm:max-w-[90vw] sm:h-[90vh] sm:max-h-[90vh] sm:p-6 flex flex-col">
              <div className="absolute right-0 top-0 pr-4 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingMd(null)}
                  className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <span className="sr-only">Close</span>
                  <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>

              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="w-full">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-white mb-4">
                    Development Instructions: {columnData.find(c => c.name === editingMd)?.label || editingMd}
                  </h3>

                  {/* Formatting Toolbar */}
                  <div className="mb-2 flex flex-wrap gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
                    <button
                      onClick={() => insertMarkdown('**', '**')}
                      className="px-2 py-1 text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Bold"
                    >
                      <strong>B</strong>
                    </button>
                    <button
                      onClick={() => insertMarkdown('*', '*')}
                      className="px-2 py-1 text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Italic"
                    >
                      <em>I</em>
                    </button>
                    <button
                      onClick={() => insertMarkdown('`', '`')}
                      className="px-2 py-1 text-xs font-mono bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Code"
                    >
                      {'<>'}
                    </button>
                    <button
                      onClick={() => insertMarkdown('## ')}
                      className="px-2 py-1 text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Heading"
                    >
                      H2
                    </button>
                    <button
                      onClick={() => insertMarkdown('### ')}
                      className="px-2 py-1 text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Heading"
                    >
                      H3
                    </button>
                    <button
                      onClick={() => insertMarkdown('- ')}
                      className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Bullet List"
                    >
                      • List
                    </button>
                    <button
                      onClick={() => insertMarkdown('1. ')}
                      className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Numbered List"
                    >
                      1. List
                    </button>
                    <button
                      onClick={() => insertMarkdown('[', '](url)')}
                      className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Link"
                    >
                      Link
                    </button>
                    <button
                      onClick={() => insertMarkdown('> ')}
                      className="px-2 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Quote"
                    >
                      Quote
                    </button>
                  </div>
                </div>

                <div className="flex-1 mt-2 overflow-hidden">
                  <textarea
                    ref={mdTextareaRef}
                    value={mdInstructions[editingMd] || ''}
                    onChange={(e) => setMdInstructions({ ...mdInstructions, [editingMd]: e.target.value })}
                    placeholder="Add detailed development instructions in markdown format...&#10;&#10;Example:&#10;## Requirements&#10;- Feature 1&#10;- Feature 2&#10;&#10;## Technical Notes&#10;- Implementation detail 1&#10;- Implementation detail 2"
                    className="block w-full h-full rounded-md border-0 py-2 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:focus:ring-indigo-500 sm:text-sm sm:leading-6 bg-white dark:bg-gray-800 font-mono resize-none"
                  />
                </div>

                <div className="mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingMd(null)}
                    className="inline-flex justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingMd(null)}
                    className="inline-flex justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
