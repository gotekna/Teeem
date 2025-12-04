# Gantt & Schedule Master - The Bible (Development Rules)
**Version:** 2.0.0
**Last Updated:** November 15, 2025 at 4:00 PM AEST (Major restructure: Rules-only format, added RULE #0 for documentation maintenance)
**Status:** Production-ready with DHtmlx trial
**Authority Level:** ABSOLUTE - This is The Bible for all Gantt development
**File Locations:**
- Source: `/Users/rob/Projects/teeem/GANTT_SCHEDULE_RULES.md`
- Public: `/Users/rob/Projects/teeem/frontend/public/GANTT_SCHEDULE_RULES.md`

---

## 🔴 CRITICAL: Read This First

### This Document is "The Bible"
This file is the **absolute authority** for all Gantt and Schedule Master development.

**This Bible Contains RULES ONLY:**
- ✅ MUST do this
- ❌ NEVER do that
- ✅ ALWAYS check X before Y
- Configuration values that must match
- Protected code patterns

**For KNOWLEDGE (how things work, bug history, why we chose X):**
- 📕 See GANTT_BUGS_AND_FIXES.md (Bug Hunter Lexicon)

**Rules for Claude Code (CC):**
- ✅ You MUST follow every rule in this document without exception
- ✅ You MUST read this file at the start of every session
- ✅ You MUST update this file when discovering new rules
- ✅ You MUST add bug knowledge to Lexicon (GANTT_BUGS_AND_FIXES.md), NOT here
- ❌ You CANNOT change implementation approaches between sessions
- ❌ You CANNOT "optimize" or "simplify" code without explicit approval
- ❌ You CANNOT add explanations/knowledge to Bible (goes in Lexicon)

---

## RULE #0: Documentation Maintenance (READ THIS FIRST)

### The Two-Document System

This project uses exactly TWO documentation files:

1. **📖 GANTT_SCHEDULE_RULES.md** - "The Bible" (RULES ONLY)
2. **📕 GANTT_BUGS_AND_FIXES.md** - "Bug Hunter Lexicon" (KNOWLEDGE ONLY)

### RULE #0.1: Sorting Information - Bible vs Lexicon

✅ **When writing documentation, ask: "Is this a RULE or KNOWLEDGE?"**

**If it's a RULE (directive) → Goes in Bible:**
- ✅ "You MUST do X"
- ✅ "NEVER do Y"
- ✅ "ALWAYS check Z before W"
- ✅ Configuration values that must match
- ✅ Code patterns that must be followed
- ✅ Protected code that cannot be changed

**If it's KNOWLEDGE (explanation) → Goes in Lexicon:**
- ✅ "This is how X works"
- ✅ "We discovered Y after investigation"
- ✅ "Here's why we chose Z"
- ✅ Bug history and root causes
- ✅ Investigation timelines
- ✅ Architecture explanations
- ✅ Performance analysis

**Example:**
- ❌ WRONG: "The cascade service works by finding dependent tasks..." → This is KNOWLEDGE, goes in Lexicon
- ✅ RIGHT: "ALWAYS use cascade service for dependency calculations, NEVER implement in frontend" → This is a RULE, stays in Bible

### RULE #0.2: When to Update Bible

✅ **MUST update Bible when:**
1. Adding a new coding rule (MUST/NEVER/ALWAYS pattern)
2. Discovering a protected code pattern that must not be changed
3. Adding a new critical configuration value
4. Changing how Company Settings should be used
5. Adding a new "gotcha" that causes bugs if violated

❌ **DO NOT update Bible for:**
- Bug discoveries (goes in Lexicon)
- Investigation results (goes in Lexicon)
- Performance optimizations (goes in Lexicon unless it creates a new RULE)
- Architecture explanations (goes in Lexicon)

### RULE #0.3: When to Update Lexicon

✅ **MUST update Lexicon when:**
1. Discovering a new bug (create BUG-XXX entry)
2. Resolving an existing bug (update status to RESOLVED)
3. Adding architecture/background knowledge
4. Explaining WHY a rule exists
5. Documenting investigation timelines
6. Adding performance metrics (before/after)
7. Explaining how a system works (cascade, locks, etc)

### RULE #0.4: File Synchronization (CRITICAL)

When you update either Bible or Lexicon, you MUST sync to frontend/public/:

```bash
# After updating source files, ALWAYS run:
cp /Users/rob/Projects/teeem/GANTT_SCHEDULE_RULES.md \
   /Users/rob/Projects/teeem/frontend/public/GANTT_SCHEDULE_RULES.md

cp /Users/rob/Projects/teeem/GANTT_BUGS_AND_FIXES.md \
   /Users/rob/Projects/teeem/frontend/public/GANTT_BUGS_AND_FIXES.md
```

✅ **MUST sync after EVERY edit**
❌ **NEVER edit files directly in frontend/public/** (they get overwritten)

**Why:** The UI buttons read from `/frontend/public/`, not from project root.

### RULE #0.5: Version Numbers & Timestamps

✅ **ALWAYS update when editing:**

**In Bible (top of file):**
```markdown
**Version:** 2.0.0
**Last Updated:** 2025-11-15 at 4:00 PM AEST
```

**In Lexicon (top of file):**
```markdown
**Last Updated:** 2025-11-15 at 4:00 PM AEST
```

**Versioning scheme (Bible only):**
- **Major (X.0.0):** Breaking changes to rules, major restructuring
- **Minor (1.X.0):** New rules added, significant updates
- **Patch (1.0.X):** Typo fixes, clarifications, minor updates

### RULE #0.6: UI Button Configuration

The Schedule Master tab MUST have exactly 2 buttons:

**Button #1: Gantt Bible**
- **Label:** "📖 Gantt Bible"
- **Loads:** `/GANTT_SCHEDULE_RULES.md`
- **Component:** `GanttRulesModal.jsx`
- **Code location:** `frontend/src/components/schedule-master/GanttRulesModal.jsx:21`

```javascript
// MUST use this exact path:
const response = await fetch('/GANTT_SCHEDULE_RULES.md')
```

**Button #2: Bug Hunter**
- **Label:** "📕 Bug Hunter"
- **Loads:** `/GANTT_BUGS_AND_FIXES.md`
- **Component:** `GanttBugHunterModal.jsx`

```javascript
// MUST use this exact path:
const response = await fetch('/GANTT_BUGS_AND_FIXES.md')
```

❌ **NEVER point these buttons to any other files**
❌ **NEVER add a third button** (only 2 documents allowed)

### RULE #0.7: Copy to Clipboard Buttons

The "Copy Docs" dropdown MUST have exactly 2 options:

**Option #1: Copy Gantt Bible**
```javascript
const response = await fetch('/GANTT_SCHEDULE_RULES.md')
const text = await response.text()
await navigator.clipboard.writeText(text)
```

**Option #2: Copy Bug Hunter**
```javascript
const response = await fetch('/GANTT_BUGS_AND_FIXES.md')
const text = await response.text()
await navigator.clipboard.writeText(text)
```

### RULE #0.8: Testing After Updates

After updating either document, MUST verify:

```bash
# 1. Check files are synced
ls -lh /Users/rob/Projects/teeem/frontend/public/GANTT*.md

# 2. Check timestamps match
head -3 /Users/rob/Projects/teeem/GANTT_SCHEDULE_RULES.md
head -3 /Users/rob/Projects/teeem/frontend/public/GANTT_SCHEDULE_RULES.md

# 3. Test UI buttons in browser
# - Navigate to Settings → Schedule Master
# - Click "📖 Gantt Bible" → Should show updated content
# - Click "📕 Bug Hunter" → Should show updated content
# - Test "Copy Docs" dropdown → Both options should work
```

### RULE #0.9: New Bug Discovery Workflow

When a new bug is discovered:

**Step 1:** Investigate and fix the bug

**Step 2:** Determine if bug creates a new RULE
- If YES → Add RULE to Bible
- If NO → Just document in Lexicon

**Step 3:** Document in Lexicon (create BUG-XXX entry)

**Step 4:** Update timestamps and sync both files

### RULE #0.10: Quick Reference Decision Tree

```
Question: Where does this information go?

Is it a directive (MUST/NEVER/ALWAYS)?
  YES → 📖 Bible
  NO  → Continue...

Is it explaining HOW something works?
  YES → 📕 Lexicon
  NO  → Continue...

Is it a bug report or fix?
  YES → 📕 Lexicon
  NO  → Re-read the question, one of the above must apply
```

---

## 📋 How CC Must Update This File

### When to Update
CC MUST update this file when:
1. Making code changes that affect how Gantt calculations work
2. Adding new features or functionality to Gantt/Schedule
3. Fixing bugs that required changing core logic
4. Modifying performance optimizations
5. Changing data structures or API patterns
6. **Answering questions posed in The Bible** (see rule below)

### Rule: Answering Questions in The Bible
When The Bible contains questions for CC to answer (marked with sections like "CC: ANSWER THESE QUESTIONS"):

1. **CC MUST answer all questions completely**
2. **CC MUST update The Bible with the answers in the appropriate sections**
3. **CC MUST remove the question prompt after answering** (replace with "Note: Questions answered - this is now a reference")
4. **CC MUST mark the section as complete** to prevent The Bible from growing too long

**Why:** Unanswered questions make The Bible grow too large, causing "Prompt is too long" errors. Once questions are answered and documented, the prompts must be removed.

### How to Update
1. **Update the relevant rule section directly** (not just a changelog)
2. **Explain WHY the code is written that way** (prevent future "optimization" attempts)
3. **Document any performance implications**
4. **Add examples of correct vs incorrect usage**
5. **Note any dependencies or side effects**
6. **Ensure UI buttons read the updated file** (see rule below)

### Update Format
When updating a rule, use this pattern:
```
Rule X: [Rule Name]
[Description of what must be done]

✅ Correct Implementation:
[Code example]

❌ Never Do This:
[Anti-pattern example]

WHY: [Detailed explanation of why this approach is required]
CONSEQUENCES: [What breaks if this rule is violated]
```

### Critical: Gantt Rules UI Buttons & File Sync
When CC updates this Bible file, CC MUST ensure the UI buttons in Settings > Schedule Master tab work correctly:

**File Sync Process (MANDATORY):**
Every time CC modifies the source file at `/Users/rob/Projects/teeem/GANTT_SCHEDULE_RULES.md`, CC MUST:
1. **Update the version number** (increment patch: 1.0.0 → 1.0.1, minor for new features: 1.0.0 → 1.1.0, major for breaking changes: 1.0.0 → 2.0.0)
2. **Update the timestamp** to current date and time
3. **Run the sync script:** `./scripts/sync-gantt-rules.sh` OR manually copy:
   ```bash
   cp /Users/rob/Projects/teeem/GANTT_SCHEDULE_RULES.md /Users/rob/Projects/teeem/frontend/public/GANTT_SCHEDULE_RULES.md
   ```
4. **Verify sync:** Check that both files have the same version number and timestamp

**"Gantt Rules" Button:**
- Opens modal to VIEW the latest Bible content
- Must read from the updated file in project

**"Copy Gantt Rules" Button:**
- Copies the latest Bible content to clipboard
- Must read from the updated file in project

**Implementation Check:**
Both buttons dynamically read the Bible file from `/frontend/public/GANTT_SCHEDULE_RULES.md`. If CC updates the source Bible, both buttons must immediately reflect the changes after sync (no page refresh needed).

---

## 📚 Related Documentation

This Bible is part of a comprehensive documentation system for the Gantt and Schedule Master features.

### Core Documentation Files

| Document | Purpose | Location |
|----------|---------|----------|
| **GANTT_SCHEDULE_RULES.md** (This File) | The Bible - All development rules and protected patterns | `/frontend/public/GANTT_SCHEDULE_RULES.md` |
| **GANTT_BIBLE_COLUMNS.md** | Complete column documentation with implementation details | `/GANTT_BIBLE_COLUMNS.md` |
| **GANTT_BUGS_AND_FIXES.md** | Bug tracking, Bug Hunter tool, test results | `/frontend/public/GANTT_BUGS_AND_FIXES.md` |
| **GANTT_DRAG_FLICKER_FIXES.md** | Historical fixes for drag/flicker issues | `/frontend/GANTT_DRAG_FLICKER_FIXES.md` |

### Column Documentation (GANTT_BIBLE_COLUMNS.md)

**What It Contains:**
- ✅ All 33 Schedule Master table columns
- ✅ All 11 Gantt modal columns
- ✅ Active/Inactive status for each column
- ✅ Exact database field mappings
- ✅ Implementation details (file locations, services, handlers)
- ✅ Purpose and business logic for each column
- ✅ Bug Hunter test numbers for validation
- ✅ Lock hierarchy and priority system
- ✅ Test coverage map

**When to Reference:**
- Adding or modifying column functionality
- Understanding what a column does
- Finding which service/handler processes a column
- Checking test coverage for a column
- Understanding lock behavior and priority

**When to Update:**
- Column implementation changes
- New column added
- Column behavior modified
- Test coverage added/changed
- Database schema changes

### Bug Hunter Documentation (GANTT_BUGS_AND_FIXES.md)

**What It Contains:**
- All active and resolved bugs
- Bug Hunter automated diagnostic tool usage
- Test results history (10 automated tests)
- Performance benchmarks
- Investigation timelines for complex bugs

**When to Reference:**
- Debugging Gantt issues
- Running performance diagnostics
- Understanding past bug fixes
- Checking test coverage

### Quick Reference Card

**For Column Info:** → `GANTT_BIBLE_COLUMNS.md`
**For Development Rules:** → `GANTT_SCHEDULE_RULES.md` (this file)
**For Bug Investigation:** → `GANTT_BUGS_AND_FIXES.md`
## 🚨 CRITICAL: Read Before Touching Gantt Code

**This section contains NON-NEGOTIABLE information you MUST know before working on Gantt/Schedule code.**

### The #1 Killer Bug: Predecessor ID Mismatch

**THE PROBLEM:**
Predecessor IDs in the database are **1-based** (1, 2, 3...) but `sequence_order` is **0-based** (0, 1, 2...).

**WHERE THIS HAPPENS:**
- **Backend:** `schedule_cascade_service.rb:88, 100` - Converts with `+ 1`
- **Backend:** `schedule_template_rows_controller.rb:116, 122` - Uses 1-based sequences
- **Frontend:** DHtmlxGanttView.jsx - Task numbers displayed as 1-based but internally 0-based

**WHY IT EXISTS:**
Legacy decision: UI shows task #1, #2, #3 (1-based) but database sequence_order is 0, 1, 2 (0-based). Predecessors stored as 1-based IDs to match UI display.

**CONSEQUENCE OF FORGETTING:**
- Wrong tasks cascade when dependencies change
- Circular dependency detection fails
- Predecessor display shows wrong task numbers
- **HOURS OF DEBUGGING** because the bug is silent (no errors, just wrong behavior)

**THE FIX:**
Always convert when comparing:
```ruby
# Backend: Finding dependents
predecessor_id = predecessor_task.sequence_order + 1  # 0-based → 1-based

# Backend: Comparing in predecessor_ids array
pred_entry = dependent_task.predecessor_ids.find do |pred|
  (pred['id'] || pred[:id]).to_i == predecessor_id  # Compare 1-based to 1-based
end
```

```javascript
// Frontend: Display task number
const taskNumber = task.sequence_order + 1  // Show as #1, #2, #3

// Frontend: Store in predecessor_ids
{ id: taskNumber, type: "FS", lag: 0 }  // Store as 1-based
```

**TEST THIS:**
1. Create Task #1 (sequence_order: 0)
2. Create Task #2 (sequence_order: 1) with predecessor: 1FS
3. Drag Task #1 → Task #2 should cascade
4. If Task #3 cascades instead, you have the off-by-one bug!

---

### The #2 Killer Bug: Infinite Render Loops

**THE PROBLEM:**
`gantt.parse()` triggers spurious `onAfterTaskDrag` events even when no drag occurred, causing infinite update loops.

**THE CYCLE:**
1. User drags Task A → saves → updates state
2. State update → useEffect → calls `gantt.parse()`
3. `gantt.parse()` internally fires `onAfterTaskDrag` for all tasks
4. Handler thinks user dragged → saves again → repeat from step 2
5. **16+ consecutive drag events in 1 second = screen flickers**

**THE FIX (Protected Pattern 1a + 1b):**
```javascript
// Three critical useRef flags
const isDragging = useRef(false)
const isLoadingData = useRef(false)
const isSaving = useRef(false)

// In onAfterTaskDrag handler:
gantt.attachEvent('onAfterTaskDrag', (id, mode, event) => {
  // CRITICAL: Set IMMEDIATELY before auto-scheduling runs
  isDragging.current = true
  isLoadingData.current = true

  // ... handle drag ...

  // CRITICAL: Only reset isDragging, let useEffect handle isLoadingData
  isDragging.current = false
  // DO NOT reset isLoadingData here!
})

// In useEffect that loads data:
useEffect(() => {
  // CRITICAL: Skip if dragging or already loading
  if (isDragging.current) return
  if (isLoadingData.current) return

  isLoadingData.current = true
  gantt.parse({ data: tasks, links: links })

  // CRITICAL: 500ms minimum delay (tested value)
  setTimeout(() => {
    isLoadingData.current = false
  }, 500)
}, [tasks, ...])
```

**WHY 500MS:**
- Tested extensively: 100ms = loops resume, 300ms = occasional flicker, 500ms = stable
- Ensures all React state updates complete before re-enabling drag events
- DO NOT reduce below 500ms "to optimize"

**LOCATION:**
- DHtmlxGanttView.jsx lines 1357-1418 (onAfterTaskDrag)
- DHtmlxGanttView.jsx lines 3471-3502 (useEffect guard)

**CONSEQUENCE OF FORGETTING:**
- Severe UI flickering during drag
- 8-16 Gantt reloads per drag operation
- Poor user experience
- Bug Hunter Test #2 fails (Excessive Gantt Reload Detection)

---

### Critical useRef Flags (The Anti-Loop Arsenal)

**All flags in DHtmlxGanttView.jsx lines 40-47:**

| Flag | Type | Purpose | Set By | Reset By | Reset Timing |
|------|------|---------|--------|----------|--------------|
| `isDragging` | boolean | Prevent data reload during active drag | onAfterTaskDrag | onAfterTaskDrag end | Immediately after drag |
| `isLoadingData` | boolean | Suppress spurious drag events during parse | useEffect + drag handler | useEffect timeout | 500ms after parse |
| `isSaving` | boolean | Prevent infinite save loops | handleTaskUpdate | handleTaskUpdate end | After API completes |
| `suppressRender` | boolean | Anti-flicker: Block renders during completion | Drag start | Drag end | Immediately |
| `manuallyPositionedTasks` | Set | Track which tasks user manually positioned | Lock checkbox | Unlock checkbox | Per task |
| `pendingUnlocks` | Set | Prevent re-locking during reload | Unlock action | After reload | After data load |
| `lastTasksSignature` | string | Prevent unnecessary reloads | useEffect | useEffect | On data change |

**RULE:** Never reset `isLoadingData` in the drag handler's normal completion path. Only reset it:
1. In useEffect's 500ms timeout (normal path)
2. In early-exit paths (conflict, cancel, cascade modal)

**WHY:** Resetting `isLoadingData` at end of drag handler allows spurious events from ongoing `gantt.parse()` to slip through unprotected.

---

### Backend Cascade Service Critical Info

**File:** `backend/app/services/schedule_cascade_service.rb`

**What It Does:**
When a task's `start_date` or `duration` changes:
1. Finds all dependent tasks (tasks with this as predecessor)
2. Recalculates their start dates based on dependency type + lag
3. Recursively cascades to their dependents
4. Returns all affected tasks

**Critical Behavior:**
- Uses `update_column()` NOT `update()` - bypasses validations and callbacks for performance
- Skips tasks where `manually_positioned? == true` (respects user manual positioning)
- Only cascades when `start_date` or `duration` changed
- Handles 4 dependency types: FS, SS, FF, SF
- Prevents infinite loops by tracking `@affected_tasks` hash

**Integration with Controller:**
```ruby
# In schedule_template_rows_controller.rb update action:
# The cascade is triggered by after_update callback
# Results stored in Thread-local variable

after_update :cascade_to_dependents  # In model

# In controller:
affected_tasks = Thread.current[:cascade_affected_tasks] || [@row]
Thread.current[:cascade_affected_tasks] = nil  # Clear it
```

**Thread-Local Variables:**
- `Thread.current[:current_audit_user_id]` - For audit logging
- `Thread.current[:cascade_affected_tasks]` - Return all cascaded tasks to frontend

**WHY update_column:**
- Performance: Updating 50 tasks in a cascade shouldn't trigger 50 sets of validations/callbacks
- Safety: The after_update callback would cause infinite recursion if we used `update()`

---

### The Lock Hierarchy (5 Lock Types)

**Priority Order (Highest to Lowest):**

1. **`supplier_confirm`** - Supplier has committed to this date, NEVER cascade
2. **`confirm`** - Internal confirmation, NEVER cascade
3. **`start`** - Work has begun, NEVER cascade
4. **`complete`** - Work is done, NEVER cascade
5. **`manually_positioned`** - User manually dragged task, don't cascade

**Backend Check:**
```ruby
# schedule_cascade_service.rb:63
next if dependent_task.manually_positioned?

# Note: Backend only checks manually_positioned
# Frontend enforces all 5 lock types by not sending locked tasks to backend
```

**Frontend Check:**
```javascript
// DHtmlxGanttView.jsx - Determine if task is locked
const isLocked = (task) => {
  return task.supplier_confirm ||
         task.confirm ||
         task.start ||
         task.complete ||
         task.manually_positioned
}
```

**Cascade Modal Behavior:**
- Unlocked successors: Auto-selected to cascade (user can uncheck)
- Locked successors: NOT selected (would require unlocking first)
- User shown warning if dependencies will break

---

### API Pattern: Single Update + Cascade Response

**Pattern:**
```javascript
// Frontend sends ONE task update
PATCH /api/v1/schedule_templates/:id/rows/:row_id
{
  schedule_template_row: {
    start_date: 5,
    duration: 3
  }
}

// Backend returns updated task + all cascaded tasks
{
  task: { id: 1, start_date: 5, duration: 3, ... },
  cascaded_tasks: [
    { id: 2, start_date: 8, ... },
    { id: 3, start_date: 10, ... }
  ]
}
```

**Frontend Processing:**
```javascript
// DHtmlxGanttView.jsx:3366-3450
const response = await api.patch(`/api/v1/schedule_templates/${template.id}/rows/${task.id}`, { ... })

if (response.cascaded_tasks) {
  // Update all cascaded tasks in state
  response.cascaded_tasks.forEach(cascaded => {
    updateTaskInState(cascaded)
  })
}
```

**WHY THIS PATTERN:**
- ONE API call per user action (not N calls for N dependent tasks)
- Backend calculates cascade (source of truth for dependency math)
- Frontend gets all changes in one response
- Prevents race conditions from multiple simultaneous updates

---

### Diagnostic Mode & Bug Hunter

**Enable Diagnostic Logging:**
```javascript
// DHtmlxGanttView.jsx:26
const DIAGNOSTIC_MODE = true  // Set to true for detailed console logs
```

**Bug Hunter Commands (Browser Console):**
```javascript
// Generate diagnostic report
window.printBugHunterReport()

// Enable specific debug categories
window.enableGanttDebug(['drag', 'api', 'cascade'])

// Export report for bug tracking
window.exportBugHunterReport()

// Reset counters for new test
window.resetBugHunter()
```

**10 Automated Tests:**
1. Duplicate API Call Detection (target: ≤ 2 per task)
2. Excessive Gantt Reload Detection (target: ≤ 5 per drag)
3. Slow Drag Operation Detection (target: < 5000ms)
4. API Call Pattern Analysis (rapid repeated calls)
5. Cascade Event Tracking (affected task count)
6. State Update Batching (target: ≤ 3 per drag)
7. Lock State Monitoring (locks prevent cascading)
8. Performance Timing Analysis (all metrics vs targets)
9. Health Status Assessment (overall system health)
10. Actionable Recommendations (context-specific fixes)

**Bug Hunter Location:** `/frontend/src/utils/ganttDebugger.js`
**E2E Tests:** `/frontend/tests/e2e/gantt-cascade.spec.js`

---

### Performance: Debounced Render Pattern

**Protected Pattern:**
```javascript
const renderTimeout = useRef(null)

const debouncedRender = (delay = 0) => {
  if (renderTimeout.current) {
    clearTimeout(renderTimeout.current)
  }
  renderTimeout.current = setTimeout(() => {
    if (ganttReady) gantt.render()
  }, delay)
}
```

**WHY:**
- Direct `gantt.render()` causes 50-100ms lag per render
- Debounce batches multiple state changes into one render
- Reduces visual flashing during rapid updates

**DO NOT:**
- Remove the timeout mechanism
- Change to direct `gantt.render()` calls
- "Simplify" by removing renderTimeout.current check

**CONSEQUENCE:** Removing debounce causes stuttering drag operations and visual flashing.

---

### DHtmlx Gantt Configuration Critical Values

**MUST MATCH VALUES:**
```javascript
// DHtmlxGanttView.jsx:366-367
gantt.config.task_height = 40  // MUST match row_height
gantt.config.bar_height = 40   // MUST also match - DHtmlx uses for Y calculations!
gantt.config.row_height = 40   // Base row height
```

**WHY:** Mismatched heights cause:
- Task bars offset from grid rows
- Click detection issues
- Dependency lines misaligned

**Auto-Scheduling:**
```javascript
gantt.config.auto_scheduling = false  // ALWAYS false!
```

**WHY:** Backend cascade service handles ALL dependency calculations. Frontend auto-scheduling would conflict.

**Plugins:**
```javascript
gantt.plugins({
  auto_scheduling: false,  // Disabled - backend handles it
  critical_path: true,     // Enabled - visual indicator
  drag_timeline: true,     // Enabled - scroll while dragging
  tooltip: true,           // Enabled - hover info
  undo: true              // Enabled - undo/redo support
})
```

---

### Working Days & Public Holidays

**Configuration:**
```javascript
// DHtmlxGanttView.jsx:558-569
gantt.config.work_time = true
gantt.config.duration_unit = 'day'

// Set working hours (24-hour day, full business day)
gantt.setWorkTime({ hours: [0, 24] })

// Mark weekends as non-working
gantt.setWorkTime({ day: 0, hours: false }) // Sunday
gantt.setWorkTime({ day: 6, hours: false }) // Saturday

// Mark public holidays as non-working
publicHolidays.forEach(holiday => {
  gantt.setWorkTime({ date: new Date(holiday), hours: false })
})
```

**Backend Fetches Holidays:**
```javascript
// Loads from: GET /api/v1/public_holidays
```

**Duration Calculation:**
- Counts only working days
- Skips weekends automatically
- Skips public holidays
- Example: 5-day task starting Monday might end next Tuesday (skips weekend)

---

### Common Gotchas

**1. Saving With Predecessors**
```javascript
// WRONG: Omitting predecessor_ids causes them to be cleared
await api.patch(`/rows/${task.id}`, {
  schedule_template_row: {
    start_date: 5
  }
})

// CORRECT: Always include predecessor_ids
await api.patch(`/rows/${task.id}`, {
  schedule_template_row: {
    start_date: 5,
    predecessor_ids: task.predecessor_ids  // CRITICAL: Preserve!
  }
})
```

**2. Task Height Configuration**
```javascript
// WRONG: Mismatched values cause visual bugs
gantt.config.row_height = 40
gantt.config.task_height = 30  // Mismatched!

// CORRECT: All three must match
gantt.config.row_height = 40
gantt.config.task_height = 40
gantt.config.bar_height = 40
```

**3. Resetting isLoadingData Flag**
```javascript
// WRONG: Resetting at end of drag handler
gantt.attachEvent('onAfterTaskDrag', (id) => {
  isDragging.current = true
  isLoadingData.current = true

  // ... handle drag ...

  isDragging.current = false
  isLoadingData.current = false  // WRONG! Allows spurious events through
})

// CORRECT: Only useEffect resets isLoadingData
gantt.attachEvent('onAfterTaskDrag', (id) => {
  isDragging.current = true
  isLoadingData.current = true

  // ... handle drag ...

  isDragging.current = false
  // DO NOT reset isLoadingData here!
})
```

**4. Checking Lock State**
```javascript
// WRONG: Only checking one lock type
if (task.manually_positioned) { /* locked */ }

// CORRECT: Check all 5 lock types
if (task.supplier_confirm || task.confirm || task.start ||
    task.complete || task.manually_positioned) {
  /* locked */
}
```

**5. Predecessor ID Conversion**
```javascript
// WRONG: Forgetting the +1 conversion
const predecessorId = task.sequence_order

// CORRECT: Always convert
const predecessorId = task.sequence_order + 1  // 0-based → 1-based
```

---

### File Structure Quick Reference

**Frontend Components:**
- `DHtmlxGanttView.jsx` (5276 lines) - Main Gantt component
- `ScheduleTemplateEditor.jsx` (2500+ lines) - Main schedule editor
- `CascadeDependenciesModal.jsx` - User choices for cascade
- `TaskDependencyEditor.jsx` - Predecessor editor modal
- `ganttDebugger.js` - Bug Hunter diagnostic tool

**Backend Services:**
- `schedule_cascade_service.rb` - Dependency cascade logic
- `schedule/template_instantiator.rb` - Create job schedule from template
- `schedule/task_spawner.rb` - Spawn photo/cert/subtasks

**Backend Controllers:**
- `schedule_templates_controller.rb` - Template CRUD
- `schedule_template_rows_controller.rb` - Row CRUD + cascade
- `schedule_tasks_controller.rb` - Project task management

**Backend Models:**
- `schedule_template.rb` - Template model
- `schedule_template_row.rb` - Template row (with cascade callback)
- `schedule_template_row_audit.rb` - Audit log for lock changes

**Tests:**
- `tests/e2e/gantt-cascade.spec.js` - E2E cascade tests
- `backend/test/gantt_drag_test.rb` - Backend cascade tests

---

### Before You Start Coding: Checklist

- [ ] Read this entire "Critical" section
- [ ] Read GANTT_BIBLE_COLUMNS.md for column details
- [ ] Read GANTT_BUGS_AND_FIXES.md for known issues
- [ ] Understand predecessor ID mismatch (1-based vs 0-based)
- [ ] Understand the 3 useRef anti-loop flags
- [ ] Know the 5 lock types and their priority
- [ ] Enable DIAGNOSTIC_MODE for your testing
- [ ] Run Bug Hunter after changes: `window.printBugHunterReport()`
- [ ] Test with locked and unlocked tasks
- [ ] Test cascade with 3+ levels of dependencies
- [ ] Test dragging tasks with both types of predecessors (FS, SS)
- [ ] Verify no flickering during drag operations
- [ ] Check Bug Hunter Test #2 (≤ 5 reloads per drag)

**If You Skip This Checklist:**
- You WILL introduce the predecessor ID bug (hours of debugging)
- You WILL break the anti-loop protection (screen flickers)
- You WILL cause cascade to skip locked tasks improperly
- You WILL waste time debugging issues that are already documented here

**Remember:** This code has been through 8+ iterations to fix subtle bugs. Do not "simplify" or "optimize" without understanding WHY each pattern exists.
**For Historical Context:** → `GANTT_DRAG_FLICKER_FIXES.md`

---
## 🔒 Protected Code Patterns - DO NOT MODIFY

These patterns MUST NOT be changed or "optimized" without explicit user approval. They exist for specific technical reasons.

### Protected Pattern 1: Debounced Refresh Logic
**Location:** DHtmlxGanttView.jsx, ScheduleTemplateEditor.jsx

**The Code:**
```javascript
const debouncedRender = (delay = 0) => {
  if (renderTimeout.current) {
    clearTimeout(renderTimeout.current)
  }
  renderTimeout.current = setTimeout(() => {
    if (ganttReady) gantt.render()
  }, delay)
}
```

**WHY:** Prevents UI lag and visual flashing during drag operations. Direct `gantt.render()` calls cause stuttering.

**CONSEQUENCES:** Removing debounce causes 50-100ms lag per render, visual flashing, and poor user experience.

**DO NOT:**
- Remove the timeout mechanism
- Change to direct `gantt.render()` calls
- Reduce delay below current values
- "Simplify" by removing renderTimeout.current check

### Protected Pattern 1a: Render Loop Prevention
**Location:** DHtmlxGanttView.jsx (lines 3143-3168, 3398-3404)
**Added:** November 14, 2025

**The Problem:**
Dragging a task triggers a cascade: drag → save → state update → useEffect → gantt.parse() → spurious drag events → repeat. This causes 16+ consecutive drag events and severe UI glitching/flickering.

**The Code:**
```javascript
// In useEffect that loads tasks:
useEffect(() => {
  // ... validation ...

  // CRITICAL: Prevent data reload while actively dragging
  if (isDragging.current) {
    console.log('⏸️ Skipping data reload - drag operation in progress')
    return
  }

  // CRITICAL: Prevent cascading reloads if already loading data
  if (isLoadingData.current) {
    console.log('⏸️ Skipping data reload - already loading data')
    return
  }

  // Load data...
  isLoadingData.current = true
  gantt.clearAll()
  gantt.parse({ data: ganttTasks, links: ganttLinks })

  // CRITICAL: Reset flag with sufficient delay for all state updates to settle
  setTimeout(() => {
    isLoadingData.current = false
    console.log('✅ Data loading complete - drag events re-enabled')
  }, 500) // Must be 500ms minimum, not less
}, [ganttReady, tasks, ...])
```

**WHY:**
- `gantt.parse()` internally triggers `onAfterTaskDrag` events even when no real drag occurred
- State updates from backend responses trigger useEffect which calls gantt.parse()
- Without protection, each drag creates a render loop: drag → update → reload → spurious drag → repeat
- The 500ms timeout ensures all queued React state updates complete before re-enabling drag events

**CONSEQUENCES:**
- Reducing timeout below 500ms: Render loops resume, causing flickering
- Removing `isDragging.current` check: Reloads during active drag, breaking drag UX
- Removing `isLoadingData.current` check: Cascading reloads cause infinite loops

**DO NOT:**
- Reduce the 500ms timeout (tested value - shorter causes issues)
- Remove the isDragging.current check
- Remove the isLoadingData.current check
- "Optimize" by batching differently without testing thoroughly

### Protected Pattern 1b: isDragging Flag Management
**Location:** DHtmlxGanttView.jsx (lines 1346, 1448, 1640, 1873-1894)
**Added:** November 14, 2025
**Updated:** November 14, 2025 at 12:55 PM AEST (FINAL FIX - never reset isLoadingData in normal completion)

**The Problem:**
The `isDragging.current` flag was only reset in specific code branches, causing blank screens. Additionally, resetting `isLoadingData.current` at the end of normal drag completion caused render loops to return because spurious drag events from ongoing `gantt.parse()` operations would slip through unprotected.

**The Final Solution:**
```javascript
gantt.attachEvent('onAfterTaskDrag', (id, mode, event) => {
  // ... drag handling logic ...

  // Early return cases MUST reset both flags:
  if (conflictDetected) {
    isDragging.current = false
    isLoadingData.current = false // Allow immediate next operation
    return false
  }

  if (openingCascadeModal) {
    isDragging.current = false
    isLoadingData.current = false // Allow immediate next operation
    return false
  }

  if (userCancelled) {
    isDragging.current = false
    isLoadingData.current = false // Allow immediate next operation
    return false
  }

  // ... save logic ...

  // CRITICAL: Always reset isDragging flag at the end, no matter which code path was taken
  // DO NOT reset isLoadingData here - it's managed by useEffect's 500ms timeout
  // Resetting it here caused render loops when overlapping reloads were in progress
  isDragging.current = false
  if (wasRealDrag) {
    console.log('✅ Real drag completed - isDragging cleared')
  }

  return true
})
```

**WHY:**
- `isDragging.current = true` is set in `onBeforeTaskDrag`
- `useEffect` checks both flags and skips data reload if either is true
- If `isDragging` is never reset, all future reloads are blocked → blank screen
- `isLoadingData` must ONLY be managed by useEffect's 500ms timeout for normal completions
- When a real drag completes, it triggers cascade updates → reload → `gantt.parse()`
- That `gantt.parse()` fires spurious drag events
- If we reset `isLoadingData` at normal completion (line 1891), those spurious events bypass protection
- This creates a render loop: spurious drag → slip through → trigger reload → more spurious drags

**CRITICAL - v1.0.4 Final Fix:**
- **NEVER reset `isLoadingData` at end of normal drag completion** (line 1891)
- **Only reset `isDragging`** at end of normal completion
- **`isLoadingData` is managed exclusively by:**
  1. Set to `true` when starting a reload (line 3221)
  2. Set to `false` by 500ms timeout after reload completes (line 3444)
  3. Set to `false` in early-exit cases only (conflict, cancel, cascade modal) to allow immediate next operation
  4. Set to `false` in cleanup function on unmount (line 3466)
- This ensures spurious drag events from ongoing reloads stay suppressed
- The 500ms timeout ensures all queued React state updates complete before re-enabling

**CONSEQUENCES:**
- Forgetting to reset `isDragging` in ANY code path: Blank screen after that drag
- Resetting `isLoadingData` at normal completion: Render loop returns (23+ spurious events)
- Early-exit cases NOT resetting `isLoadingData`: Next operation blocked until timeout expires
- User must refresh page to recover from blank screen

**DO NOT:**
- Remove any `isDragging.current = false` statements
- Reset `isLoadingData.current = false` at end of normal drag completion (line 1891)
- Reduce the 500ms timeout in useEffect
- Add early returns without resetting `isDragging` first
- "Simplify" by consolidating these resets (defense in depth is intentional)

### Protected Pattern 1c: Anti-Flicker During Drag
**Location:** DHtmlxGanttView.jsx (lines 216-233, 1893-1900)
**Added:** November 14, 2025 at 1:45 PM AEST

**The Problem:**
During active drag operations, render calls cause visual flickering and stuttering. The screen updates continuously as the task is being dragged, creating a poor user experience.

**The Solution:**
```javascript
// In debouncedRender function (lines 216-233):
const debouncedRender = (delay = 0) => {
  if (renderTimeout.current) {
    clearTimeout(renderTimeout.current)
  }
  renderTimeout.current = setTimeout(() => {
    // PERFORMANCE: Skip render during active drag to prevent flickering
    if (isDragging.current) {
      console.log('⏸️ Skipping render - drag in progress (reduces flicker)')
      renderTimeout.current = null
      return
    }

    if (ganttReady) {
      gantt.render()
    }
    renderTimeout.current = null
  }, delay)
}

// In onAfterTaskDrag handler (lines 1893-1900):
isDragging.current = false
if (wasRealDrag) {
  console.log('✅ Real drag completed - isDragging cleared')

  // PERFORMANCE: Add 500ms delay before refreshing display to reduce flickering
  // This allows the drag animation to complete smoothly before we update dependencies
  setTimeout(() => {
    if (ganttReady && gantt && typeof gantt.render === 'function') {
      console.log('🎨 Delayed render after drag - reducing flicker')
      gantt.render()
    }
  }, 500)
}
```

**WHY:**
- During drag, `isDragging.current = true` blocks all render calls from debouncedRender
- This prevents visual updates while the user is actively dragging
- After drag completes, we wait 500ms before refreshing the display
- This allows DHtmlx's internal drag animation to finish smoothly
- The delay also lets all state updates settle before visual refresh

**CONSEQUENCES:**
- Removing isDragging check: Flickering returns during drag operations
- Reducing 500ms delay: Visual stuttering may occur as state updates conflict with render
- Removing delayed render: Dependency arrows may not update after drag completes

**DO NOT:**
- Remove the isDragging check from debouncedRender
- Remove the 500ms delayed render after drag completes
- Reduce the 500ms timeout (tested value for smooth animation)
- Add immediate render calls during active drag operations

### Protected Pattern 2: Debounced localStorage Writes
**Location:** All components with user preferences

**The Code:**
```javascript
import { createDebouncedStorageSetter } from '../../utils/debounce'

const debouncedSaveToStorage = useMemo(() =>
  createDebouncedStorageSetter(500), []
)

useEffect(() => {
  debouncedSaveToStorage('dhtmlxGanttColumns', visibleColumns)
}, [visibleColumns, debouncedSaveToStorage])
```

**WHY:** Direct localStorage writes during user interactions (column resize, reorder) block the main thread and cause UI freezing.

**CONSEQUENCES:** Removing debounce causes 20-50ms UI lag per interaction, making drag operations feel sluggish.

**DO NOT:**
- Use direct `localStorage.setItem()` calls
- Reduce debounce delay below 500ms
- Remove the useMemo wrapper
- "Optimize" by batching differently

### Protected Pattern 3: API Delete 204 Handling
**Location:** api.js delete method

**The Code:**
```javascript
async delete(endpoint, options = {}) {
  // ... fetch logic ...

  // Handle 204 No Content responses
  if (response.status === 204) {
    return null
  }

  // Try to parse JSON, return null if empty
  const text = await response.text()
  return text ? JSON.parse(text) : null
}
```

**WHY:** Backend returns 204 No Content for successful deletes. Attempting to parse empty response as JSON throws "Unexpected end of JSON input" error.

**CONSEQUENCES:** Application crashes on template/task deletion.

**DO NOT:**
- Remove 204 status check
- Always expect JSON response
- Remove text parsing fallback
- "Simplify" error handling

---

### Protected Pattern 4: Backend Cascade Service
**Location:** backend/app/services/schedule_cascade_service.rb, backend/app/models/schedule_template_row.rb:24, backend/app/controllers/api/v1/schedule_template_rows_controller.rb:46-62
**Added:** November 14, 2025 at 4:30 PM AEST

**The Problem:**
When dragging a task with dependencies in the Gantt chart, the screen shakes/flickers and multiple reloads occur. This was caused by:
1. **No backend cascade logic** - Backend didn't recalculate dependent task dates
2. **Frontend trying to compensate** - DHtmlx auto-scheduling plugin tried to cascade updates itself
3. **Infinite loop** - Each `gantt.render()` fired `onAfterTaskUpdate` for ALL tasks, causing unnecessary API calls
4. **Multiple reloads** - Frontend made separate API calls for each cascaded task, causing multiple state updates

**Root Cause Found by Bug-Hunter:**
- `handleTaskUpdate` was making API calls even when data hadn't changed
- `gantt.render()` triggered `onAfterTaskUpdate` events for ALL tasks in the chart
- Each event triggered an API call → state update → reload cycle
- Result: 8+ Gantt reloads per drag operation = visible screen shake

**The Solution:**

#### 1. Backend Cascade Service (schedule_cascade_service.rb)
```ruby
class ScheduleCascadeService
  def self.cascade_changes(task, changed_attributes = [])
    new(task, changed_attributes).cascade
  end

  def cascade
    return [@task] unless cascade_needed?

    # Add original task to affected list
    @affected_tasks[@task.id] = @task

    # Recursively cascade to dependents
    cascade_to_dependents(@task)

    # Return all affected tasks
    @affected_tasks.values
  end

  private

  def cascade_to_dependents(predecessor_task)
    dependent_tasks = find_dependent_tasks(predecessor_task)

    dependent_tasks.each do |dependent_task|
      next if @affected_tasks.key?(dependent_task.id)
      next if dependent_task.manually_positioned?

      # Calculate new start date based on predecessor
      new_start_date = calculate_start_date(dependent_task, predecessor_task)

      if new_start_date && dependent_task.start_date != new_start_date
        dependent_task.update_column(:start_date, new_start_date)
        dependent_task.reload

        @affected_tasks[dependent_task.id] = dependent_task

        # Recursively cascade to this task's dependents
        cascade_to_dependents(dependent_task)
      end
    end
  end

  def find_dependent_tasks(predecessor_task)
    # NOTE: predecessor_ids are 1-based (1, 2, 3...)
    # while sequence_order is 0-based (0, 1, 2...)
    predecessor_id = predecessor_task.sequence_order + 1

    @template.schedule_template_rows.select do |row|
      next false if row.predecessor_ids.blank?
      row.predecessor_ids.any? { |pred| pred['id'].to_i == predecessor_id }
    end
  end

  def calculate_start_date(dependent_task, predecessor_task)
    # Supports FS, SS, FF, SF dependency types with lag values
    # Returns calculated start date based on predecessor end date
  end
end
```

#### 2. Model Callback (schedule_template_row.rb:190-203)
```ruby
after_update :cascade_to_dependents

def cascade_to_dependents
  # Only cascade if start_date or duration changed
  # NOTE: We cascade FROM any task (even manually positioned ones)
  # The cascade service will skip cascading TO manually positioned tasks
  return unless saved_change_to_start_date? || saved_change_to_duration?

  changed_attrs = []
  changed_attrs << :start_date if saved_change_to_start_date?
  changed_attrs << :duration if saved_change_to_duration?

  ScheduleCascadeService.cascade_changes(self, changed_attrs)
end
```

#### 3. Controller Returns All Affected Tasks (schedule_template_rows_controller.rb:46-62)
```ruby
# Track which attributes are changing for cascade detection
changed_attrs = []
[:start_date, :duration].each do |attr|
  changed_attrs << attr if row_params.key?(attr) && row_params[attr] != @row.send(attr)
end

if @row.update(row_params)
  @row.reload

  # Cascade changes to dependent tasks if start_date or duration changed
  affected_tasks = if changed_attrs.any?
    ScheduleCascadeService.cascade_changes(@row, changed_attrs)
  else
    [@row]
  end

  # Return all affected tasks (original + cascaded)
  response_json = if affected_tasks.length > 1
    {
      task: row_json(@row),
      cascaded_tasks: affected_tasks.reject { |t| t.id == @row.id }.map { |t| row_json(t) }
    }
  else
    row_json(@row)
  end

  render json: response_json
end
```

#### 4. Frontend Handles Bulk Update (ScheduleTemplateEditor.jsx:758-782)
```javascript
const response = await api.patch(
  `/api/v1/schedule_templates/${selectedTemplate.id}/rows/${rowId}`,
  { schedule_template_row: updates }
)

// Check if backend returned cascaded tasks (new format)
const hasCascadedTasks = response.cascaded_tasks && response.cascaded_tasks.length > 0
const mainTask = response.task || response

if (hasCascadedTasks) {
  // Backend handled cascading - apply ALL tasks in one batch
  console.log(`🔄 Backend cascaded to ${response.cascaded_tasks.length} dependent tasks`)

  const allAffectedTasks = [mainTask, ...response.cascaded_tasks]

  // Update all affected tasks in a single state update (no flicker!)
  setRows(prevRows => {
    const updatedRows = [...prevRows]
    allAffectedTasks.forEach(task => {
      const index = updatedRows.findIndex(r => r && r.id === task.id)
      if (index !== -1) {
        updatedRows[index] = task
      }
    })
    return updatedRows
  })

  console.log('✅ Applied batch update for', allAffectedTasks.length, 'tasks')

  return mainTask
}
```

#### 5. Data Change Detection (DHtmlxGanttView.jsx:3312-3329)
```javascript
// CRITICAL: Check if data actually changed before making API call
// Prevents infinite loop from gantt.render() firing onAfterTaskUpdate for all tasks
const startDateStr = startDate ? startDate.toISOString().split('T')[0] : null
const originalStartDateStr = originalTask.start_date ?
  (typeof originalTask.start_date === 'string' ? originalTask.start_date :
   new Date(originalTask.start_date).toISOString().split('T')[0]) :
  null

const dataChanged =
  originalTask.duration !== duration ||
  originalStartDateStr !== startDateStr ||
  originalTask.supplier !== supplier ||
  JSON.stringify(originalTask.predecessor_ids || []) !== JSON.stringify(task.predecessor_ids || [])

if (!dataChanged) {
  console.log('⏸️ Skipping update - no data changed for task', task.id)
  return
}

console.log('✏️ Data changed for task', task.id, '- saving to backend')
```

**HOW IT WORKS:**
```
USER DRAGS TASK 1 (day 4 → day 9)
    ↓
BACKEND CASCADE SERVICE:
  ✅ Task 1 updated: day 4 → 9
  ✅ Task 2 cascaded: day 6 → 11 (depends on Task 1, FS+0)
  ✅ Task 3 cascaded: day 6 → 11 (depends on Task 1, FS+0)
    ↓
API RETURNS: {task: Task1, cascaded_tasks: [Task2, Task3]}
    ↓
FRONTEND: Single state update → Single Gantt reload → NO FLICKER!
```

**WHY:**
- **Backend responsibility**: Backend knows the business logic for cascading, not frontend
- **Single API call**: One drag = one API call, not one per affected task
- **Single state update**: All affected tasks updated in one batch
- **Single reload**: One state change = one Gantt reload
- **Data change detection**: Prevents unnecessary API calls from `gantt.render()` events
- **Prevents infinite loops**: Frontend only makes API calls when data actually changes

**CRITICAL IMPLEMENTATION NOTES:**
1. **Predecessor IDs are 1-based** (1, 2, 3...) while **sequence_order is 0-based** (0, 1, 2...)
   - Always convert: `predecessor_id = task.sequence_order + 1`
2. **Cascade FROM any task** (even manually positioned ones)
   - Skip cascading TO manually positioned tasks only
3. **Support all dependency types**: FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish)
4. **Handle lag values**: Can be positive (delay) or negative (lead time)
5. **Avoid infinite loops**: Track processed tasks in `@affected_tasks` hash

**CONSEQUENCES:**
- **Removing backend cascade**: Screen shake returns, infinite loops occur, multiple API calls per drag
- **Removing data change detection**: Infinite loop from `gantt.render()` events
- **Not returning cascaded_tasks**: Frontend makes separate API calls for each task
- **Multiple state updates**: Each update triggers Gantt reload = visible flicker

**DO NOT:**
- Move cascade logic back to frontend
- Remove data change detection from `handleTaskUpdate`
- Split cascaded tasks into separate API responses
- Remove `after_update :cascade_to_dependents` callback
- Change predecessor ID calculation (1-based vs 0-based)
- Skip manually positioned check (would override user-set dates)

**TEST VERIFICATION:**
Backend test must pass:
```bash
cd backend && rails runner test/gantt_drag_test.rb
```

Expected output:
```
✅ Task 2 cascaded correctly (11)
✅ Task 3 cascaded correctly (11)
✅ TEST PASSED: Cascade logic works correctly
```

---

### Protected Pattern 5: Bug-Hunter Automated Testing
**Location:** test/bug_hunter_test.sh, frontend/tests/e2e/gantt-cascade.spec.js, frontend/playwright.config.js
**Added:** November 14, 2025 at 4:30 PM AEST

**The Problem:**
Testing Gantt cascade manually is time-consuming, error-prone, and requires screenshot sharing and console log analysis. Need automated verification that:
1. Backend cascade logic works correctly
2. Frontend integration has no flicker
3. No infinite loops occur
4. Single batch updates work as expected

**The Solution:**

#### 1. Bug-Hunter Test Runner (test/bug_hunter_test.sh)
```bash
#!/bin/bash
# Main entry point for bug-hunter automated verification

./test/run_gantt_tests.sh
exit_code=$?

if [ $exit_code -eq 0 ]; then
  echo "✅ BUG-HUNTER VERIFICATION: ALL TESTS PASSED"
  echo "🎉 FIX CONFIRMED!"
else
  echo "❌ BUG-HUNTER VERIFICATION: TESTS FAILED"
fi

exit $exit_code
```

#### 2. Comprehensive Test Suite (test/run_gantt_tests.sh)
```bash
# Test 1: Backend Cascade Logic
cd backend && rails runner test/gantt_drag_test.rb

# Test 2: Frontend E2E Test (Playwright)
if frontend_server_running; then
  cd frontend && npm run test:gantt
fi
```

#### 3. Playwright E2E Test with Diagnostics (frontend/tests/e2e/gantt-cascade.spec.js)

**Diagnostic Monitoring Features:**
- ✅ **Injects monitoring script** into browser before test runs
- ✅ **Tracks API calls per task** - Detects duplicate calls (infinite loop indicator)
- ✅ **Monitors state update batches** - Should be 1 batch, not 8+
- ✅ **Counts Gantt reloads** - Should be 1 or 0, not multiple
- ✅ **Timing analysis** - Measures drag duration and total test time
- ✅ **Console log analysis** - Captures cascade and batch update messages

**Monitoring Script Injection (lines 97-185):**
```javascript
await page.evaluate(() => {
  window.ganttTestMonitor = {
    startTime: performance.now(),
    apiCalls: [],
    stateUpdates: [],
    ganttReloads: [],
    dragStartTime: null,
    dragEndTime: null
  };

  // Monitor fetch/API calls
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    if (url.includes('/api/v1/schedule_templates') && url.includes('/rows/')) {
      window.ganttTestMonitor.apiCalls.push({
        timestamp: performance.now() - window.ganttTestMonitor.startTime,
        method: args[1]?.method || 'GET',
        taskId: url.match(/\/rows\/(\d+)/)?.[1] || 'unknown'
      });
    }
    return originalFetch.apply(window, args);
  };

  // Monitor console logs for cascade patterns
  // ... (tracks drag start/end, state updates, reloads)
});
```

**Diagnostic Report Generation (lines 212-278):**
```javascript
const monitorData = await page.evaluate(() => {
  const monitor = window.ganttTestMonitor;

  // Group API calls by task
  const callsByTask = {};
  monitor.apiCalls.forEach(call => {
    if (!callsByTask[call.taskId]) {
      callsByTask[call.taskId] = [];
    }
    callsByTask[call.taskId].push(call);
  });

  // Check for duplicates (infinite loop indicator)
  const hasDuplicates = Object.values(callsByTask).some(calls => calls.length > 1);

  return {
    totalDuration: (performance.now() - monitor.startTime).toFixed(2),
    dragDuration: monitor.dragEndTime && monitor.dragStartTime
      ? (monitor.dragEndTime - monitor.dragStartTime).toFixed(2)
      : 'N/A',
    apiCalls: monitor.apiCalls,
    callsByTask: callsByTask,
    stateUpdates: monitor.stateUpdates,
    ganttReloads: monitor.ganttReloads,
    hasDuplicates: hasDuplicates
  };
});

// Print detailed diagnostic report
console.log('🔬 DETAILED DIAGNOSTIC REPORT');
console.log(`Drag duration: ${monitorData.dragDuration}ms`);
console.log(`API Calls: ${monitorData.apiCalls.length} total`);
console.log(`State Updates: ${monitorData.stateUpdates.length}`);
console.log(`Gantt Reloads: ${monitorData.ganttReloads.length}`);
```

**Expected Diagnostic Output (PASS):**
```
🔬 DETAILED DIAGNOSTIC REPORT
======================================================================

⏱️  Timing:
   Drag duration: 1234.56ms
   Total test time: 5678.90ms

🌐 API Calls: 1 total
   Task 299: 1 call

📦 State Updates (Batches): 1
   #1 at 1234.56ms

🔄 Gantt Reloads: 1
   #1 at 1234.56ms

======================================================================
✅ TEST PASSED: No infinite loop, backend cascade working!
```

**Failed Test Output (FAIL):**
```
🔬 DETAILED DIAGNOSTIC REPORT
======================================================================

🌐 API Calls: 15 total
   Task 299: 8 calls  ⚠️ DUPLICATE CALLS DETECTED!
   Task 300: 4 calls  ⚠️ DUPLICATE CALLS DETECTED!
   Task 301: 3 calls  ⚠️ DUPLICATE CALLS DETECTED!

📦 State Updates (Batches): 8
🔄 Gantt Reloads: 8

======================================================================
❌ TEST FAILED: Infinite loop detected
   ❌ Duplicate API calls found
   ❌ Multiple Gantt reloads (8)
```

**WHY:**
- **Automated verification**: Bug-hunter can verify fixes without manual testing
- **Detailed diagnostics**: Pinpoints exact issues (duplicate calls, multiple reloads)
- **Timing analysis**: Shows when things happen and how long they take
- **Permanent feature**: Always available for regression testing
- **Exit codes**: Allows CI/CD integration (0 = pass, 1 = fail)

**HOW BUG-HUNTER USES IT:**
```bash
# Single command - full verification
./test/bug_hunter_test.sh

# Backend only
cd backend && rails runner test/gantt_drag_test.rb

# Frontend only (requires dev server running)
cd frontend && npm run test:gantt
```

**NPM Scripts Added:**
```json
{
  "test:gantt": "playwright test gantt-cascade",
  "test:e2e": "playwright test",
  "test:e2e:headed": "playwright test --headed",
  "test:e2e:debug": "playwright test --debug"
}
```

**CONSEQUENCES:**
- **Removing monitoring script**: Lose detailed diagnostics, harder to debug issues
- **Skipping automated tests**: Manual testing required, slower iteration
- **Not checking for duplicates**: Infinite loops may go undetected
- **Removing timing analysis**: Can't measure performance improvements

**DO NOT:**
- Remove the monitoring script injection (lines 97-185)
- Remove the diagnostic report generation (lines 212-278)
- Skip running tests before declaring fixes complete
- Remove exit code handling (breaks CI/CD integration)
- Simplify the test to just check pass/fail (lose valuable diagnostics)

**TEST COMMANDS:**
```bash
# Run all tests (backend + frontend)
./test/bug_hunter_test.sh

# Backend test only
cd backend && rails runner test/gantt_drag_test.rb

# Frontend test with visible browser (for debugging)
cd frontend && npm run test:e2e:headed

# Frontend test in debug mode (pauses at each step)
cd frontend && npm run test:e2e:debug
```

**DOCUMENTATION:**
- Comprehensive guide: `test/README.md`
- Setup instructions: `AUTOMATED_TESTING_SETUP.md`
- Test configuration: `frontend/playwright.config.js`

---

## 📋 Table of Contents
- [Architecture Overview](#architecture-overview)
- [Schedule Master Table - Column Definitions](#schedule-master-table---column-definitions)
- [Implementation Rules](#implementation-rules)
- [Performance Requirements](#performance-requirements)
- [Sorting & Display Logic](#sorting--display-logic)
- [Data Flow & State Management](#data-flow--state-management)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)
- [Validation Workflow with Claude.ai](#validation-workflow-with-claudeai)

---

## Schedule Master Table - Column Definitions

This section documents EXACTLY what each column in the Schedule Master table does, how it should behave, and the rules that govern it.

**Table Location:** `http://localhost:5173/settings?tab=schedule-master`
**Component:** `ScheduleTemplateEditor.jsx`
**Database Table:** `schedule_template_rows`

---

### Core Task Columns

#### Column: # (Sequence)
**UI Label:** `#`
**Column Key:** `sequence`
**Database Field:** `sequence_order` (Integer, NOT NULL)
**Display Value:** `index + 1` (1-based row number)
**Type:** Auto-generated display number

**Purpose:**
Shows the task number in the current display order. This is purely a UI element that shows row position in the table.

**Behavior:**
- **Read-only** - Cannot be edited by user
- Displays row position (1, 2, 3, etc.)
- Changes dynamically when rows are reordered with Move Up/Down buttons
- **NOT sortable** - This column doesn't have sort functionality

**Rules:**
- `sequence_order` in database determines physical row order
- Display number is calculated as `index + 1` where index is array position
- When rows are moved, `sequence_order` values are recalculated

**Affects:**
- Row display order in table
- Predecessor references (predecessors use task numbers from this column)
- Gantt chart task order

**Database Details:**
```ruby
t.integer "sequence_order", null: false
validates :sequence_order, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
```

---

#### Column: Task Name
**UI Label:** `Task Name`
**Column Key:** `taskName`
**Database Field:** `name` (String, NOT NULL)
**Display Value:** Text input showing `row.name`
**Type:** User-editable text field

**Purpose:**
The primary identifier and description of the task (e.g., "Site Preparation", "Foundation Pour", "Frame Erection").

**Behavior:**
- **Editable** - User can type directly in table cell
- Changes are **debounced** (500ms delay before saving to prevent excessive API calls)
- Input selects all text on focus for easy replacement
- Searchable/filterable column
- Sortable alphabetically

**Rules:**
- **Required** - Cannot be empty (validated on backend)
- Maximum length not explicitly limited
- Trimmed of whitespace before saving
- Changes trigger API PATCH to `/api/v1/schedule_template_rows/:id`

**Affects:**
- Task identification throughout the system
- Search and filter results
- Gantt chart task labels
- Predecessor display (when showing task names vs numbers)
- Export outputs

**Database Details:**
```ruby
t.string "name", null: false
validates :name, presence: true
```

**Implementation:**
```javascript
// Local state for debouncing
const [localName, setLocalName] = useState(row.name)

// Debounced update (500ms)
const handleTextChange = (field, value) => {
  setLocalName(value)
  clearTimeout(updateTimeoutRef.current)
  updateTimeoutRef.current = setTimeout(() => {
    if (value && value.trim()) {
      onUpdate({ [field]: value })
    }
  }, 500)
}
```

---

#### Column: Supplier / Group
**UI Label:** `Supplier / Group`
**Column Key:** `supplierGroup`
**Database Fields:**
- `supplier_id` (BigInt, Foreign Key to suppliers table, optional)
- `assigned_role` (String, optional)

**Display Value:**
- Dropdown showing **Supplier** names when `po_required` is checked
- Dropdown showing **Internal Roles** when `po_required` is NOT checked

**Type:** Conditional select dropdown

**Purpose:**
Assigns the task to either an external supplier (if PO required) or an internal role/group (if no PO needed).

**Behavior:**
- **Editable** - User selects from dropdown
- **Conditional display:**
  - When `po_required = true` → Shows suppliers dropdown
  - When `po_required = false` → Shows internal roles dropdown
- Changes are **immediate** (no debounce)
- Searchable/filterable column

**Options - Suppliers:**
Loaded from `/api/v1/suppliers` - all active supplier companies

**Options - Internal Roles:**
```javascript
const ASSIGNABLE_ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'sales', label: 'Sales' },
  { value: 'site', label: 'Site' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'builder', label: 'Builder' },
  { value: 'estimator', label: 'Estimator' }
]
```

**Rules:**
- **Mutually exclusive:** A task can have EITHER `supplier_id` OR `assigned_role`, never both
- When `po_required` is checked, `assigned_role` is cleared and `supplier_id` can be set
- When `po_required` is unchecked, `supplier_id` is cleared and `assigned_role` can be set
- **Validation:** If `create_po_on_job_start` is true, `supplier_id` MUST be present

**Affects:**
- Task assignment and responsibility
- Auto PO creation (requires supplier)
- Price Items selection (requires supplier)
- Task filtering and reporting
- Gantt chart display

**Database Details:**
```ruby
t.bigint "supplier_id"
t.string "assigned_user_id"
belongs_to :supplier, optional: true

validate :supplier_required_if_po_required

private
def supplier_required_if_po_required
  if create_po_on_job_start? && supplier_id.blank?
    errors.add(:supplier_id, "must be present when Auto PO is enabled")
  end
end
```

**Implementation:**
```javascript
{row.po_required ? (
  <select
    value={row.supplier_id || ''}
    onChange={(e) => handleFieldChange('supplier_id', e.target.value ? parseInt(e.target.value) : null)}
  >
    <option value="">Select supplier...</option>
    {suppliers.map(s => (
      <option key={s.id} value={s.id}>{s.name}</option>
    ))}
  </select>
) : (
  <select
    value={row.assigned_role || ''}
    onChange={(e) => handleFieldChange('assigned_role', e.target.value || null)}
  >
    <option value="">Assign to group...</option>
    {ASSIGNABLE_ROLES.map(role => (
      <option key={role.value} value={role.value}>{role.label}</option>
    ))}
  </select>
)}
```

---

#### Column: Predecessors
**UI Label:** `Predecessors`
**Column Key:** `predecessors`
**Database Field:** `predecessor_ids` (JSONB Array, default: [])
**Display Value:** Formatted string like "2FS+3, 5SS" or "None"
**Type:** Modal-based editor (click to open PredecessorEditor modal)

**Purpose:**
Defines task dependencies - which tasks must complete (or start) before this task can begin.

**Behavior:**
- **Editable** - Click button to open PredecessorEditor modal
- Displays formatted predecessor string (e.g., "2FS+3, 5SS-1")
- Format: `[TaskNumber][LinkType][+/-Lag]`
- Backend calculates `predecessor_display` for consistent formatting
- Used by Gantt chart to draw dependency arrows
- Used to auto-calculate `start_date`

**Link Types:**
- **FS** (Finish-to-Start) - Most common. This task starts after predecessor finishes.
- **SS** (Start-to-Start) - This task starts when predecessor starts.
- **FF** (Finish-to-Finish) - This task finishes when predecessor finishes.
- **SF** (Start-to-Finish) - This task finishes when predecessor starts. (Rare)

**Lag (Days):**
- Positive lag (+3) = delay (wait 3 days after predecessor)
- Negative lag (-2) = lead (start 2 days before predecessor finishes)
- Zero lag (no suffix) = immediate (start same day predecessor ends)

**Data Structure:**
```javascript
predecessor_ids: [
  { id: 2, type: 'FS', lag: 3 },   // Task 2, Finish-to-Start, 3 day delay
  { id: 5, type: 'SS', lag: 0 },   // Task 5, Start-to-Start, no delay
  { id: 8, type: 'FF', lag: -2 }   // Task 8, Finish-to-Finish, 2 day lead
]
```

**Display Format:**
```
"2FS+3, 5SS, 8FF-2"
```

**Rules:**
- Can have multiple predecessors (array of objects)
- Task numbers refer to `sequence_order` position (1-based)
- Invalid predecessors (non-existent task IDs) are skipped in display
- Circular dependencies should be avoided (not enforced in template editor but causes issues in Gantt)
- Changing predecessors triggers `start_date` recalculation (unless task is manually positioned)

**Affects:**
- **Start Date** - Auto-calculated based on predecessor completion + lag
- **Gantt Chart** - Draws dependency arrows between tasks
- **Critical Path** - Used to determine critical path in Gantt view
- **Auto-scheduling** - DHtmlx Gantt uses this for auto-scheduling feature

**Backend Helper Methods:**
```ruby
def predecessor_display
  return "None" if predecessor_task_ids.empty?
  predecessor_task_ids.map { |pred| format_predecessor(pred) }.compact.join(", ")
end

def format_predecessor(pred_data)
  # pred_data: { id: 2, type: "FS", lag: 3 }
  task_id = pred_data['id'] || pred_data[:id]
  dep_type = pred_data['type'] || pred_data[:type] || 'FS'
  lag = (pred_data['lag'] || pred_data[:lag] || 0).to_i

  result = "#{task_id}#{dep_type}"
  result += lag >= 0 ? "+#{lag}" : lag.to_s if lag != 0
  result
end
```

**Implementation:**
```javascript
// Display button with formatted value
<button
  onClick={() => setShowPredecessorEditor(true)}
  className="w-full px-2 py-1 border rounded bg-gray-50 hover:bg-gray-100 cursor-pointer"
>
  {row.predecessor_display || 'None'}
</button>

// Modal for editing
{showPredecessorEditor && (
  <PredecessorEditor
    isOpen={true}
    onClose={() => setShowPredecessorEditor(false)}
    currentPredecessors={row.predecessor_ids || []}
    allRows={allRows}
    currentRowIndex={index}
    onSave={(newPredecessors) => {
      onUpdate({ predecessor_ids: newPredecessors })
      setShowPredecessorEditor(false)
    }}
  />
)}
```

---

#### Column: Duration
**UI Label:** `Duration`
**Column Key:** `duration`
**Database Field:** `duration` (Integer, default: 0, NOT NULL)
**Display Value:** Number input showing business days
**Type:** User-editable number field

**Purpose:**
Specifies how many business days the task will take to complete.

**Behavior:**
- **Editable** - User types number directly
- **Debounced** - 500ms delay before saving (except on blur, which saves immediately)
- Minimum value: 0
- Input selects all on focus for easy replacement
- Auto-calculates dependent task start dates when changed

**Rules:**
- Must be non-negative integer
- 0 duration = milestone task (instant completion)
- Changing duration affects:
  - End date of this task (`start_date + duration`)
  - Start dates of dependent tasks (if they have this task as predecessor)
- Changes trigger backend recalculation cascade

**Affects:**
- Task end date calculation
- Successor task start dates (via predecessor relationships)
- Gantt chart bar length
- Project total duration
- Critical path calculation

**Database Details:**
```ruby
t.integer "duration", default: 0, null: false
```

**Implementation:**
```javascript
// Local state for smooth UX
const [localDuration, setLocalDuration] = useState(row.duration || 0)

// Debounced change
const handleTextChange = (field, value) => {
  const numValue = parseInt(value) || 0
  setLocalDuration(numValue)

  clearTimeout(updateTimeoutRef.current)
  updateTimeoutRef.current = setTimeout(() => {
    onUpdate({ duration: numValue })
  }, 500)
}

// Immediate save on blur
<input
  type="number"
  value={localDuration}
  onChange={(e) => handleTextChange('duration', e.target.value)}
  onBlur={(e) => {
    // Clear debounce and save immediately
    const numValue = parseInt(e.target.value) || 0
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current)
    }
    onUpdate({ duration: numValue })
  }}
  min="0"
/>
```

---

#### Column: Start Date
**UI Label:** `Start Date`
**Column Key:** `startDate`
**Database Field:** `start_date` (Integer, default: 0, NOT NULL)
**Display Value:** Integer representing business days from project start (Day 0)
**Type:** **Read-only** calculated field

**Purpose:**
Shows when the task should start, measured in business days from project start date (Day 0 = project start).

**Behavior:**
- **NOT editable** - Auto-calculated based on predecessors and duration
- Displays as integer: 0, 5, 12, etc.
- Recalculates automatically when:
  - Predecessors change
  - Predecessor durations change
  - Dependency lag values change
- Can be overridden by setting `manually_positioned = true` (via Gantt drag)

**Calculation Logic:**
```javascript
const calculateStartDate = () => {
  if (!row.predecessor_ids || row.predecessor_ids.length === 0) {
    return 0 // No predecessors = start at project start (Day 0)
  }

  // Find the latest end date of all predecessors
  let latestEnd = 0
  row.predecessor_ids.forEach(pred => {
    const predData = typeof pred === 'object' ? pred : { id: pred, type: 'FS', lag: 0 }
    const predTask = allRows[predData.id - 1] // Task numbers are 1-indexed

    if (predTask) {
      const predStart = predTask.start_date || 0
      const predDuration = predTask.duration || 0
      const predEnd = predStart + predDuration

      // For FS (Finish-to-Start), task starts after predecessor finishes
      if (predData.type === 'FS' || !predData.type) {
        const taskStart = predEnd + (predData.lag || 0)
        if (taskStart > latestEnd) {
          latestEnd = taskStart
        }
      }
    }
  })

  return latestEnd
}
```

**Rules:**
- Always non-negative integer
- 0 = starts on project start date
- **Auto-calculation is skipped** if `manually_positioned = true`
- Calculation uses **latest** predecessor end date (takes maximum of all predecessors)
- Updates are debounced (100ms) to prevent API spam during bulk changes

**Affects:**
- Task scheduling in project timeline
- Gantt chart horizontal position
- Successor task calculations
- Critical path determination
- Project completion date

**Database Details:**
```ruby
t.integer "start_date", default: 0, null: false
```

**Manual Positioning:**
When user drags task in Gantt chart:
```javascript
// User drags task in Gantt → sets manually_positioned = true
onUpdate({
  start_date: newStartDate,
  manually_positioned: true
})

// Task no longer auto-calculates start_date
// Remains at manually set position even if predecessors change
```

**Implementation:**
```javascript
// Auto-update start_date when calculation changes
useEffect(() => {
  if (row.manually_positioned) {
    // Skip auto-calculation for manually positioned tasks
    return
  }

  if (calculatedStartDate !== row.start_date) {
    // Debounce to avoid excessive API calls
    const timer = setTimeout(() => {
      onUpdate({ start_date: calculatedStartDate })
    }, 100)
    return () => clearTimeout(timer)
  }
}, [calculatedStartDate, row.start_date, row.manually_positioned, onUpdate])

// Display (read-only)
<div className="px-2 py-1 bg-gray-50 rounded border">
  {calculatedStartDate}
</div>
```

---

### Purchase Order Columns

#### Column: PO Req
**UI Label:** `PO Req`
**Column Key:** `poRequired`
**Database Field:** `po_required` (Boolean, default: false, NOT NULL)
**Display Value:** Checkbox
**Type:** Boolean checkbox

**Purpose:**
Indicates whether this task requires a Purchase Order to be created.

**Behavior:**
- **Editable** - User can check/uncheck
- Changes are **immediate** (no debounce)
- **Has cascading effects** on other fields when changed

**Rules:**
- **When checked (true):**
  - Enables `supplier_id` dropdown (must select supplier)
  - Clears `assigned_role` (can't be both supplier and internal)
  - Enables "Auto PO" checkbox
  - Enables "Price Items" selection

- **When unchecked (false):**
  - Clears `supplier_id` (set to null)
  - Forces `create_po_on_job_start` to false
  - Enables `assigned_role` dropdown (internal assignment)
  - Disables "Price Items" selection

**Affects:**
- Supplier/Group column behavior (switches between supplier/internal)
- Auto PO checkbox enabled state
- Price Items selection availability
- PO generation during project instantiation

**Database Details:**
```ruby
t.boolean "po_required", default: false, null: false
```

**Implementation:**
```javascript
const handleFieldChange = (field, value) => {
  if (field === 'po_required') {
    if (!value) {
      // If unchecking po_required, also uncheck create_po_on_job_start and clear supplier
      onUpdate({
        po_required: false,
        create_po_on_job_start: false,
        supplier_id: null
      })
    } else {
      // If checking po_required, clear assigned_role
      onUpdate({
        po_required: true,
        assigned_role: null
      })
    }
  }
}

<input
  type="checkbox"
  checked={row.po_required}
  onChange={(e) => handleFieldChange('po_required', e.target.checked)}
  className="h-4 w-4"
/>
```

---

#### Column: Auto PO
**UI Label:** `Auto PO`
**Column Key:** `autoPo`
**Database Field:** `create_po_on_job_start` (Boolean, default: false, NOT NULL)
**Display Value:** Checkbox (grayed out if disabled)
**Type:** Boolean checkbox (conditional enable)

**Purpose:**
When enabled, automatically creates a Purchase Order for this task when a new project/job is created from this template.

**Behavior:**
- **Editable** - User can check/uncheck (if enabled)
- **Conditionally enabled:**
  - **Enabled** only if BOTH `po_required = true` AND `supplier_id` is selected
  - **Disabled** otherwise (grayed out, shows tooltip)
- Changes are **immediate** (no debounce)
- Alert shown if user tries to enable without supplier selected

**Rules:**
- **Cannot be enabled unless:**
  1. `po_required = true` (PO Req is checked)
  2. `supplier_id` is not null (Supplier is selected)

- **Validation:** Backend validates `supplier_id` must exist if this is true
- If `po_required` is unchecked, this field is automatically set to false

**Affects:**
- Price Items selection (must have Auto PO enabled to select items)
- Automatic PO generation when project is instantiated from template
- Supplier requirement (forces supplier selection)

**Database Details:**
```ruby
t.boolean "create_po_on_job_start", default: false, null: false

validate :supplier_required_if_po_required

private
def supplier_required_if_po_required
  if create_po_on_job_start? && supplier_id.blank?
    errors.add(:supplier_id, "must be present when Auto PO is enabled")
  end
end
```

**Implementation:**
```javascript
const handleFieldChange = (field, value) => {
  if (field === 'create_po_on_job_start') {
    if (value && !row.supplier_id) {
      // Show error if trying to enable without supplier
      alert('Please select a supplier first before enabling Auto PO')
      return
    } else {
      onUpdate({ [field]: value })
    }
  }
}

<input
  type="checkbox"
  checked={row.create_po_on_job_start}
  onChange={(e) => handleFieldChange('create_po_on_job_start', e.target.checked)}
  disabled={!row.po_required || !row.supplier_id}
  className="h-4 w-4 disabled:opacity-30"
  title={
    !row.po_required ? "Enable 'PO Required' first" :
    !row.supplier_id ? "Select a supplier first" :
    "Automatically create PO when job starts"
  }
/>
```

---

#### Column: Price Items
**UI Label:** `Price Items`
**Column Key:** `priceItems`
**Database Field:** `price_book_item_ids` (JSONB Array, default: [])
**Display Value:** Clickable button showing "X items"
**Type:** Modal-based selector (click to open PriceBookItemsModal)

**Purpose:**
Specifies which items from the supplier's price book should be included in the auto-generated PO.

**Behavior:**
- **Editable** - Click to open modal selector (if enabled)
- **Conditionally enabled:**
  - Enabled only if `create_po_on_job_start = true` AND `po_required = true` AND `supplier_id` exists
  - Disabled otherwise (grayed text, not clickable)
- Displays count: "3 items", "0 items"
- Modal filters price book items by selected supplier

**Rules:**
- **Cannot select items unless:**
  1. `po_required = true`
  2. `supplier_id` is selected
  3. `create_po_on_job_start = true` (Auto PO enabled)

- Stores array of price_book_item IDs
- When PO is auto-created, these items are added to the PO

**Affects:**
- Auto-generated PO line items
- PO total cost estimation
- Supplier ordering

**Database Details:**
```ruby
t.jsonb "price_book_item_ids", default: [], null: false

def price_book_items
  return [] if price_book_item_ids.blank?
  PricebookItem.where(id: price_book_item_ids)
end
```

**Implementation:**
```javascript
const canSelectItems = row.create_po_on_job_start && row.po_required && row.supplier_id

<button
  onClick={() => canSelectItems && setShowPriceItemsModal(true)}
  disabled={!canSelectItems}
  className={`text-xs font-medium ${
    canSelectItems
      ? 'text-indigo-600 hover:underline cursor-pointer'
      : 'text-gray-400 cursor-not-allowed'
  }`}
  title={
    !row.po_required ? "Enable 'PO Required' first" :
    !row.supplier_id ? "Select a supplier first" :
    !row.create_po_on_job_start ? "Enable 'Auto PO' first" :
    "Click to select price book items"
  }
>
  {row.price_book_item_ids?.length || 0} items
</button>

{showPriceItemsModal && (
  <PriceBookItemsModal
    isOpen={true}
    onClose={() => setShowPriceItemsModal(false)}
    selectedItems={row.price_book_item_ids || []}
    supplierId={row.supplier_id}
    onSave={(itemIds) => {
      onUpdate({ price_book_item_ids: itemIds })
      setShowPriceItemsModal(false)
    }}
  />
)}
```

---

#### Column: Critical
**UI Label:** `Critical`
**Column Key:** `critical`
**Database Field:** `critical_po` (Boolean, default: false, NOT NULL)
**Display Value:** Checkbox
**Type:** Boolean checkbox

**Purpose:**
Marks this PO as critical/urgent, requiring expedited processing or special attention.

**Behavior:**
- **Editable** - User can check/uncheck
- Changes are **immediate** (no debounce)
- No dependencies on other fields (can be set independently)

**Rules:**
- Independent flag (doesn't affect other fields)
- Can be checked regardless of `po_required` status
- Typically used in conjunction with PO-required tasks but not enforced

**Affects:**
- PO priority/urgency indicators
- Reporting and filtering
- Visual highlighting in PO lists
- May trigger notifications/workflows

**Database Details:**
```ruby
t.boolean "critical_po", default: false, null: false
```

**Implementation:**
```javascript
<input
  type="checkbox"
  checked={row.critical_po}
  onChange={(e) => handleFieldChange('critical_po', e.target.checked)}
  className="h-4 w-4"
/>
```

---

#### Column: Order Time
**UI Label:** `Order Time`
**Column Key:** `orderRequired`
**Database Field:** `order_required` (Boolean, default: false, NOT NULL)
**Display Value:** Checkbox
**Type:** Boolean checkbox

**Purpose:**
Indicates that this task requires materials/items to be ordered at a specific time (requires manual order timing).

**Behavior:**
- **Editable** - User can check/uncheck
- Changes are **immediate** (no debounce)
- Independent flag

**Rules:**
- Used for tasks that need timed ordering (not automated)
- May be used alongside or instead of Auto PO
- No validation dependencies

**Affects:**
- Task workflow requirements
- Manual ordering reminders
- Project planning and lead time management

**Database Details:**
```ruby
t.boolean "order_required", default: false, null: false
```

**Implementation:**
```javascript
<input
  type="checkbox"
  checked={row.order_required || false}
  onChange={(e) => onUpdate({ order_required: e.target.checked })}
  className="h-4 w-4"
/>
```

---

#### Column: Call Up
**UI Label:** `Call Up`
**Column Key:** `callUpRequired`
**Database Field:** `call_up_required` (Boolean, default: false, NOT NULL)
**Display Value:** Checkbox
**Type:** Boolean checkbox

**Purpose:**
Indicates that supplier/subcontractor needs to be called to schedule or confirm before task can proceed.

**Behavior:**
- **Editable** - User can check/uncheck
- Changes are **immediate** (no debounce)
- Independent flag

**Rules:**
- Independent of other PO fields
- Used for tasks requiring phone call coordination
- No validation dependencies

**Affects:**
- Task workflow and prerequisites
- Scheduling coordination requirements
- Reminder/notification systems

**Database Details:**
```ruby
t.boolean "call_up_required", default: false, null: false
```

**Implementation:**
```javascript
<input
  type="checkbox"
  checked={row.call_up_required || false}
  onChange={(e) => onUpdate({ call_up_required: e.target.checked })}
  className="h-4 w-4"
/>
```

---

### Documentation & Compliance Columns

#### Column: Photo
**UI Label:** `Photo`
**Column Key:** `photo`
**Database Field:** `require_photo` (Boolean, default: false, NOT NULL)
**Display Value:** Checkbox
**Type:** Boolean checkbox

**Purpose:**
Requires photo documentation when this task is completed.

**Behavior:**
- **Editable** - User can check/uncheck
- Changes are **immediate** (no debounce)
- **Special:** When changed, automatically adds/removes "Photos" documentation category

**Rules:**
- When checked: Automatically adds "Photos" to `documentation_category_ids`
- When unchecked: Automatically removes "Photos" from `documentation_category_ids`
- This maintains consistency between photo flag and documentation categories

**Affects:**
- Documentation category association (auto-syncs with Photos category)
- Task completion requirements
- Compliance workflows

**Database Details:**
```ruby
t.boolean "require_photo", default: false, null: false

# Callback to sync Photos category
before_save :sync_photos_category

def sync_photos_category
  return unless require_photo_changed?

  photos_category = DocumentationCategory.find_or_create_by(name: 'Photos') do |category|
    category.color = '#10b981' # emerald green
    category.description = 'Photo documentation required'
  end

  self.documentation_category_ids ||= []

  if require_photo?
    self.documentation_category_ids |= [photos_category.id]
  else
    self.documentation_category_ids -= [photos_category.id]
  end
end
```

**Implementation:**
```javascript
<input
  type="checkbox"
  checked={row.require_photo}
  onChange={(e) => handleFieldChange('require_photo', e.target.checked)}
  className="h-4 w-4"
/>
```

---

#### Column: Cert
**UI Label:** `Cert`
**Column Key:** `cert`
**Database Field:** `require_certificate` (Boolean, default: false, NOT NULL)
**Display Value:** Checkbox
**Type:** Boolean checkbox

**Purpose:**
Requires certification/compliance certificate to be uploaded for this task.

**Behavior:**
- **Editable** - User can check/uncheck
- Changes are **immediate** (no debounce)
- **Affects Cert Lag:** When checked, enables the Cert Lag field

**Rules:**
- When checked: Enables Cert Lag field (default 10 days)
- When unchecked: Cert Lag field is disabled (grayed out)

**Affects:**
- Cert Lag field enabled state
- Task completion requirements
- Compliance documentation
- Certificate upload requirements

**Database Details:**
```ruby
t.boolean "require_certificate", default: false, null: false
```

**Implementation:**
```javascript
<input
  type="checkbox"
  checked={row.require_certificate}
  onChange={(e) => handleFieldChange('require_certificate', e.target.checked)}
  className="h-4 w-4"
/>
```

---

#### Column: Cert Lag
**UI Label:** `Cert Lag`
**Column Key:** `certLag`
**Database Field:** `cert_lag_days` (Integer, default: 10, NOT NULL)
**Display Value:** Number input (days)
**Type:** Number input (conditionally enabled)

**Purpose:**
Specifies how many days after task completion the certificate is expected/required.

**Behavior:**
- **Editable** - User can type number (if enabled)
- **Conditionally enabled:** Only enabled when `require_certificate = true`
- Changes are **immediate** (no debounce)
- When disabled, field is grayed out

**Rules:**
- Must be non-negative integer
- Default value is 10 days
- Minimum: 0, Maximum: 999 (enforced by validation)
- Only relevant when certificates are required

**Affects:**
- Certificate due date calculation
- Compliance deadline tracking
- Task completion timeline

**Database Details:**
```ruby
t.integer "cert_lag_days", default: 10, null: false
validates :cert_lag_days, numericality: {
  only_integer: true,
  greater_than_or_equal_to: 0,
  less_than_or_equal_to: 999
}
```

**Implementation:**
```javascript
<input
  type="number"
  value={row.cert_lag_days}
  onChange={(e) => handleFieldChange('cert_lag_days', parseInt(e.target.value))}
  disabled={!row.require_certificate}
  className="w-full px-2 py-1 border rounded disabled:opacity-50"
/>
```

---

#### Column: Sup Check
**UI Label:** `Sup Check`
**Column Key:** `supCheck`
**Database Field:** `require_supervisor_check` (Boolean, default: false, NOT NULL)
**Related Field:** `supervisor_checklist_template_ids` (Array of integers, default: [])
**Display Value:** Checkbox + clickable "X items" link (when checked)
**Type:** Boolean checkbox with conditional modal link

**Purpose:**
Requires supervisor inspection/checklist to be completed for this task.

**Behavior:**
- **Editable** - User can check/uncheck
- Changes are **immediate** (no debounce)
- **When checked:** Shows clickable link "X items" to open SupervisorChecklistModal
- **When unchecked:** Only shows checkbox

**Rules:**
- When checked: Shows checklist item selector
- Checklist items are templates that get instantiated on project creation

**Affects:**
- Supervisor checklist assignment
- Task completion requirements
- Inspection workflow

**Database Details:**
```ruby
t.boolean "require_supervisor_check", default: false, null: false
t.integer "supervisor_checklist_template_ids", default: [], array: true
```

**Implementation:**
```javascript
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    checked={row.require_supervisor_check}
    onChange={(e) => handleFieldChange('require_supervisor_check', e.target.checked)}
    className="h-4 w-4"
  />
  {row.require_supervisor_check && (
    <button
      onClick={() => setShowChecklistModal(true)}
      className="text-xs font-medium text-indigo-600 hover:underline cursor-pointer"
      title="Click to assign checklist items"
    >
      {row.supervisor_checklist_template_ids?.length || 0} items
    </button>
  )}
</div>

{showChecklistModal && (
  <SupervisorChecklistModal
    isOpen={true}
    onClose={() => setShowChecklistModal(false)}
    selectedTemplateIds={row.supervisor_checklist_template_ids || []}
    onSave={(templateIds) => {
      onUpdate({ supervisor_checklist_template_ids: templateIds })
      setShowChecklistModal(false)
    }}
  />
)}
```

---

#### Column: Plan
**UI Label:** `Plan`
**Column Key:** `planType`
**Database Field:** `plan_required` (Boolean, default: false, NOT NULL)
**Display Value:** Checkbox
**Type:** Boolean checkbox

**Purpose:**
Indicates that building plans/drawings are required for this task (e.g., site plan, floor plan, elevation).

**Behavior:**
- **Editable** - User can check/uncheck
- Changes are **immediate** (no debounce)
- Generic flag for plan requirement

**Note:** This is a boolean flag. Specific plan types are managed separately in the system (not in this column).

**Rules:**
- Independent flag
- Indicates any type of plan is required

**Affects:**
- Task completion requirements
- Plan documentation workflow
- Drawing availability checks

**Database Details:**
```ruby
t.boolean "plan_required", default: false, null: false
```

**Implementation:**
```javascript
<input
  type="checkbox"
  checked={row.plan_required || false}
  onChange={(e) => onUpdate({ plan_required: e.target.checked })}
  className="h-4 w-4"
/>
```

---

#### Column: Documentation Categories (Dynamic Columns)
**UI Label:** Category name (e.g., "Photos", "Certificates", "Inspections")
**Column Key:** `docTab_[categoryId]` (e.g., `docTab_5`, `docTab_12`)
**Database Field:** `documentation_category_ids` (Array of integers, default: [])
**Display Value:** Checkbox (with colored background)
**Type:** Dynamic boolean checkboxes (one column per category)

**Purpose:**
Allows tagging tasks with specific documentation categories that will be required/tracked.

**Behavior:**
- **Dynamically created:** One column per documentation category in the system
- **Editable** - User can check/uncheck
- Changes are **immediate** (no debounce)
- Background color tinted with category color
- Columns are created at runtime based on `/api/v1/documentation_categories`

**Column Creation:**
```javascript
// Columns are auto-generated from documentationCategories
documentationCategories.forEach((category, index) => {
  const key = `docTab_${category.id}`
  columnConfig[key] = {
    visible: true,
    width: 80,
    label: category.name,  // e.g., "Photos", "Certs"
    order: 50 + index,      // After planType, before actions
    categoryId: category.id,
    categoryColor: category.color,  // e.g., "#10b981"
    isDocTabColumn: true
  }
})
```

**Rules:**
- Each checkbox represents membership in that category
- Checking adds category ID to `documentation_category_ids` array
- Unchecking removes category ID from array
- Array can contain multiple category IDs (task can have multiple categories)
- **Special:** "Photos" category is auto-synced with `require_photo` field

**Affects:**
- Documentation requirements for task
- Folder/document organization in projects
- Compliance tracking

**Database Details:**
```ruby
t.integer "documentation_category_ids", default: [], array: true
index ["documentation_category_ids"], using: :gin
```

**Implementation:**
```javascript
// In renderCell switch default case:
if (key.startsWith('docTab_')) {
  const categoryId = config.categoryId
  const isChecked = row.documentation_category_ids?.includes(categoryId) || false

  return (
    <td
      key={key}
      style={{
        width: `${cellWidth}px`,
        minWidth: `${cellWidth}px`,
        backgroundColor: config.categoryColor ? `${config.categoryColor}10` : undefined
      }}
      className="px-3 py-3 border-r text-center"
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => {
          const currentIds = row.documentation_category_ids || []
          const newIds = e.target.checked
            ? [...currentIds, categoryId]
            : currentIds.filter(id => id !== categoryId)
          onUpdate({ documentation_category_ids: newIds })
        }}
        className="h-4 w-4"
        title={`Toggle ${config.label}`}
      />
    </td>
  )
}
```

---

### Task Management Columns

#### Column: Tags
**UI Label:** `Tags`
**Column Key:** `tags`
**Database Field:** `tags` (JSONB Array, default: [])
**Display Value:** Text input showing comma-separated tags
**Type:** Text input with array serialization

**Purpose:**
Allows adding custom tags to tasks for categorization, filtering, and organization.

**Behavior:**
- **Editable** - User types comma-separated values
- Changes are **immediate** (no debounce)
- Input format: `tag1, tag2, tag3`
- Automatically split on commas and trimmed
- Empty tags are filtered out
- Searchable/filterable column

**Rules:**
- Stored as JSON array: `["tag1", "tag2", "tag3"]`
- Displayed as comma-separated string: `"tag1, tag2, tag3"`
- Whitespace is trimmed from each tag
- Empty strings are removed

**Affects:**
- Task filtering and search
- Task categorization
- Reporting and analytics
- Bulk operations

**Database Details:**
```ruby
t.jsonb "tags", default: [], null: false

def tag_list
  tags || []
end
```

**Implementation:**
```javascript
<input
  type="text"
  value={row.tags?.join(', ') || ''}
  onChange={(e) => {
    // Split on commas, trim whitespace, filter empty strings
    const tagArray = e.target.value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
    handleFieldChange('tags', tagArray)
  }}
  placeholder="tag1, tag2"
  className="w-full px-2 py-1 border rounded"
/>
```

---

#### Column: Auto Complete
**UI Label:** `Auto Complete`
**Column Key:** `autoComplete`
**Database Field:** `auto_complete_task_ids` (JSONB Array, default: [])
**Display Value:** Clickable button showing "X tasks"
**Type:** Modal-based selector

**Purpose:**
Specifies which other tasks should be automatically marked as complete when this task is completed.

**Behavior:**
- **Editable** - Click to open AutoCompleteTasksModal
- Displays count: "3 tasks", "0 tasks"
- Modal allows selecting other tasks in template

**Rules:**
- Stores array of task IDs to auto-complete
- Can select multiple tasks
- Used during project task completion workflow

**Affects:**
- Automated task completion cascade
- Workflow efficiency
- Dependent task completion

**Database Details:**
```ruby
t.jsonb "auto_complete_task_ids", default: [], null: false
```

**Implementation:**
```javascript
<button
  onClick={() => setShowAutoCompleteModal(true)}
  className="text-xs font-medium text-indigo-600 hover:underline cursor-pointer"
  title="Click to select tasks to auto-complete"
>
  {row.auto_complete_task_ids?.length || 0} tasks
</button>

{showAutoCompleteModal && (
  <AutoCompleteTasksModal
    isOpen={true}
    onClose={() => setShowAutoCompleteModal(false)}
    selectedTaskIds={row.auto_complete_task_ids || []}
    allRows={allRows}
    currentRowId={row.id}
    onSave={(taskIds) => {
      onUpdate({ auto_complete_task_ids: taskIds })
      setShowAutoCompleteModal(false)
    }}
  />
)}
```

---

#### Column: Subtasks
**UI Label:** `Subtasks`
**Column Key:** `subtasks`
**Database Fields:**
- `has_subtasks` (Boolean, default: false)
- `subtask_count` (Integer, optional)
- `subtask_names` (JSONB Array, default: [])
- `subtask_template_ids` (JSONB Array, default: [])

**Display Value:** Clickable button showing "X subtasks"
**Type:** Modal-based editor

**Purpose:**
Allows defining subtasks that will be created under this task when project is instantiated.

**Behavior:**
- **Editable** - Click to open SubtasksModal
- Displays count of subtask templates
- Modal allows selecting subtask templates or defining custom subtasks

**Rules:**
- Can reference predefined subtask templates
- Subtasks are instantiated as child tasks when project is created
- `subtask_names` must match `subtask_count` (validated)

**Affects:**
- Task breakdown structure
- Project task creation
- Work organization

**Database Details:**
```ruby
t.boolean "has_subtasks", default: false, null: false
t.integer "subtask_count"
t.jsonb "subtask_names", default: [], null: false
t.jsonb "subtask_template_ids", default: [], null: false

validates :subtask_count, numericality: { only_integer: true, greater_than_or_equal_to: 1 }, if: :has_subtasks?

validate :subtask_names_match_count

def subtask_names_match_count
  return unless has_subtasks?
  if subtask_count.present? && subtask_names.present?
    if subtask_names.length != subtask_count
      errors.add(:subtask_names, "count must match subtask_count")
    end
  end
end
```

**Implementation:**
```javascript
<button
  onClick={() => setShowSubtasksModal(true)}
  className="text-xs font-medium text-indigo-600 hover:underline cursor-pointer"
  title="Click to select subtasks"
>
  {row.subtask_template_ids?.length || 0} subtasks
</button>

{showSubtasksModal && (
  <SubtasksModal
    isOpen={true}
    onClose={() => setShowSubtasksModal(false)}
    currentSubtasks={row.subtask_template_ids || []}
    onSave={(subtaskData) => {
      onUpdate({
        subtask_template_ids: subtaskData.templateIds,
        has_subtasks: subtaskData.templateIds.length > 0,
        subtask_count: subtaskData.templateIds.length
      })
      setShowSubtasksModal(false)
    }}
  />
)}
```

---

#### Column: Linked Tasks
**UI Label:** `Linked Tasks`
**Column Key:** `linkedTasks`
**Database Field:** `linked_task_ids` (Text/JSON, default: "[]")
**Display Value:** Clickable button showing "X tasks"
**Type:** Modal-based selector

**Purpose:**
Links this task to other tasks in the template for relationship tracking (different from predecessors - this is informational linking).

**Behavior:**
- **Editable** - Click to open LinkedTasksModal
- Displays count of linked tasks
- Modal allows selecting other tasks in template

**Rules:**
- Stored as JSON array serialized to text
- Can link to multiple tasks
- Different from predecessors (no scheduling impact)

**Affects:**
- Task relationship visualization
- Related work tracking
- Information organization

**Database Details:**
```ruby
t.text "linked_task_ids", default: "[]"
serialize :linked_task_ids, coder: JSON

def linked_task_list
  linked_task_ids || []
end

def linked_tasks_display
  return "None" if linked_task_list.empty?
  linked_task_list.join(", ")
end
```

**Implementation:**
```javascript
<button
  onClick={() => setShowLinkedTasksModal(true)}
  className="text-xs font-medium text-indigo-600 hover:underline cursor-pointer"
  title="Click to select linked tasks"
>
  {row.linked_task_ids?.length || 0} tasks
</button>

{showLinkedTasksModal && (
  <LinkedTasksModal
    isOpen={true}
    onClose={() => setShowLinkedTasksModal(false)}
    selectedTaskIds={row.linked_task_ids || []}
    allRows={allRows}
    currentRowId={row.id}
    onSave={(taskIds) => {
      onUpdate({ linked_task_ids: taskIds })
      setShowLinkedTasksModal(false)
    }}
  />
)}
```

---

#### Column: Manual
**UI Label:** `Manual`
**Column Key:** `manualTask`
**Database Field:** `manual_task` (Boolean, default: false, NOT NULL)
**Display Value:** Checkbox
**Type:** Boolean checkbox

**Purpose:**
Marks this task as manually managed (not auto-scheduled or auto-completed).

**Behavior:**
- **Editable** - User can check/uncheck
- Changes are **immediate** (no debounce)
- Independent flag

**Rules:**
- When checked: Task may require manual intervention
- May affect auto-scheduling behavior
- May skip certain automation workflows

**Affects:**
- Task automation behavior
- Scheduling rules
- Completion workflows

**Database Details:**
```ruby
t.boolean "manual_task", default: false, null: false
```

**Implementation:**
```javascript
<input
  type="checkbox"
  checked={row.manual_task || false}
  onChange={(e) => onUpdate({ manual_task: e.target.checked })}
  className="h-4 w-4"
/>
```

---

#### Column: Multi
**UI Label:** `Multi`
**Column Key:** `multipleItems`
**Database Field:** `allow_multiple_instances` (Boolean, default: false, NOT NULL)
**Display Value:** Checkbox
**Type:** Boolean checkbox

**Purpose:**
Allows multiple instances of this task to be created in a single project (e.g., multiple inspection tasks).

**Behavior:**
- **Editable** - User can check/uncheck
- Changes are **immediate** (no debounce)
- Independent flag

**Rules:**
- When checked: Multiple instances of this task can exist in project
- When unchecked: Only one instance allowed per project

**Affects:**
- Task instantiation logic
- Duplicate task creation
- Project task count

**Database Details:**
```ruby
t.boolean "allow_multiple_instances", default: false, null: false
```

**Implementation:**
```javascript
<input
  type="checkbox"
  checked={row.allow_multiple_instances || false}
  onChange={(e) => onUpdate({ allow_multiple_instances: e.target.checked })}
  className="h-4 w-4"
/>
```

---

### Status/Tracking Columns (Backend Only - Not in UI)

These fields exist in the database for project task instances but are NOT displayed in the template editor. They track actual project progress.

#### Field: Confirm
**Database Field:** `confirm` (Boolean, default: false, NOT NULL)
**Purpose:** Tracks whether task has been confirmed/acknowledged
**Audited:** Yes (creates audit log entry on change)

#### Field: Supplier Confirm
**Database Field:** `supplier_confirm` (Boolean, default: false, NOT NULL)
**Purpose:** Tracks whether supplier has confirmed the task
**Audited:** Yes (creates audit log entry on change)

#### Field: Start
**Database Field:** `start` (Boolean, default: false, NOT NULL)
**Purpose:** Tracks whether task has been started
**Audited:** Yes (creates audit log entry on change)

#### Field: Complete
**Database Field:** `complete` (Boolean, default: false, NOT NULL)
**Purpose:** Tracks whether task has been completed
**Audited:** Yes (creates audit log entry on change)

#### Field: Dependencies Broken
**Database Field:** `dependencies_broken` (Boolean, default: false, NOT NULL)
**Related Field:** `broken_predecessor_ids` (JSONB Array, default: [])
**Purpose:** Tracks when task dependencies are broken (predecessor skipped/completed out of order)

#### Field: Manually Positioned
**Database Field:** `manually_positioned` (Boolean, default: false, NOT NULL)
**Purpose:** When true, task `start_date` is manually set (not auto-calculated from predecessors)
**Set When:** User drags task in Gantt chart to new date

**Backend Audit Tracking:**
```ruby
after_update :create_audit_logs

def create_audit_logs
  audit_fields = %w[confirm supplier_confirm start complete]

  audit_fields.each do |field|
    if saved_change_to_attribute?(field)
      old_value, new_value = saved_change_to_attribute(field)
      user_id = Thread.current[:current_audit_user_id] || 1

      audits.create!(
        user_id: user_id,
        field_name: field,
        old_value: old_value,
        new_value: new_value,
        changed_at: Time.current
      )
    end
  end
end
```

---

### Relationship Fields (Backend - Not Direct Columns)

#### Field: Linked Template
**Database Field:** `linked_template_id` (Integer, Foreign Key)
**Purpose:** Links this task to another schedule template (for template chaining/nesting)
**Type:** References another ScheduleTemplate

```ruby
belongs_to :linked_template, class_name: 'ScheduleTemplate', optional: true

def linked_template_name
  linked_template&.name
end
```

#### Field: Auto Complete Predecessors
**Database Field:** `auto_complete_predecessors` (Boolean, default: false, NOT NULL)
**Purpose:** When true, automatically completes all predecessor tasks when this task completes
**Use Case:** Milestone tasks that trigger cascade completion

---

## Architecture Overview

### Single Gantt Library: DHtmlx Only
**Decision:** Use DHtmlx Gantt exclusively across entire application.

**Rationale:**
- ✅ Superior performance (smart rendering, static background)
- ✅ Professional features (undo/redo, critical path, auto-scheduling)
- ✅ Consistent UX across all pages
- ✅ Better performance with large datasets (100+ tasks)
- ✅ Trial period for evaluation (~$2,140 AUD for 5 devs)

**Removed Libraries:**
- ❌ SVAR Gantt (React-based, poor performance)
- ❌ Frappe Gantt (limited features)
- ❌ Custom Gantt components (no virtualization)

### File Locations
```
frontend/src/
├── components/
│   └── schedule-master/
│       ├── DHtmlxGanttView.jsx          # Main Gantt component
│       ├── ScheduleTemplateEditor.jsx   # Template editing UI
│       ├── ScheduleMasterTab.jsx        # Schedule task matching
│       └── TaskDependencyEditor.jsx     # Dependency management
├── pages/
│   └── MasterSchedulePage.jsx           # Project schedule view
└── utils/
    └── debounce.js                      # Performance utilities
```

---

## Implementation Rules

### Rule 1: DHtmlx Gantt Usage
Always use `DHtmlxGanttView` component for all Gantt visualizations.

✅ **Correct Usage:**
```jsx
import DHtmlxGanttView from '../components/schedule-master/DHtmlxGanttView'

<DHtmlxGanttView
  isOpen={showGanttView}
  onClose={() => setShowGanttView(false)}
  tasks={rows}
  onUpdateTask={async (taskId, updates) => {
    // Handle task updates
  }}
/>
```

❌ **Never Do This:**
- Don't import or use `GanttView` (SVAR - removed)
- Don't import or use `ScheduleGanttChart` (Frappe - removed)
- Don't create custom Gantt components

**WHY:** DHtmlx is the only library that provides required performance and features. Other libraries were tested and removed due to performance issues.

---

### Rule 2: Performance - Debounced localStorage
Always use debounced writes for localStorage to prevent UI lag.

✅ **Correct Pattern:**
```javascript
import { createDebouncedStorageSetter } from '../../utils/debounce'

// In component:
const debouncedSaveToStorage = useMemo(() =>
  createDebouncedStorageSetter(500), []
)

useEffect(() => {
  debouncedSaveToStorage('dhtmlxGanttColumns', visibleColumns)
}, [visibleColumns, debouncedSaveToStorage])
```

❌ **Never Do This:**
```javascript
// Direct localStorage writes cause lag!
useEffect(() => {
  localStorage.setItem('dhtmlxGanttColumns', JSON.stringify(visibleColumns))
}, [visibleColumns])
```

**WHY:** See Protected Pattern 2 above.

---

### Rule 3: API Delete Responses
Always handle 204 No Content responses from DELETE endpoints.

**Pattern (already implemented in api.js):**
```javascript
async delete(endpoint, options = {}) {
  // ... fetch logic ...

  // Handle 204 No Content responses
  if (response.status === 204) {
    return null
  }

  // Try to parse JSON, return null if empty
  const text = await response.text()
  return text ? JSON.parse(text) : null
}
```

**WHY:** See Protected Pattern 3 above.

---

### Rule 4: Template Deletion Safety
Templates must have deletion safeguards:
- ✅ Cannot delete the default template
- ✅ Show confirmation dialog with clear warning
- ✅ Cascade delete all associated rows
- ✅ Auto-select another template after deletion

**Implementation:**
```javascript
const handleDeleteTemplate = async () => {
  if (selectedTemplate.is_default) {
    showToast('Cannot delete the default template...', 'error')
    return
  }

  if (!confirm(`Are you sure you want to delete "${selectedTemplate.name}"?\n\nThis will permanently delete...`)) {
    return
  }

  await api.delete(`/api/v1/schedule_templates/${selectedTemplate.id}`)
  // Reload and select first template
}
```

**WHY:** Prevents accidental data loss and ensures application always has a valid template selected.

---

## Performance Requirements

### Mandatory Optimizations

**1. Smart Rendering (DHtmlx config)**
```javascript
gantt.config.smart_rendering = true
gantt.config.static_background = true
gantt.config.show_errors = false
```

**2. Debounced Render Function**
```javascript
const debouncedRender = (delay = 0) => {
  if (renderTimeout.current) {
    clearTimeout(renderTimeout.current)
  }
  renderTimeout.current = setTimeout(() => {
    if (ganttReady) gantt.render()
  }, delay)
}
```

**3. Debounced localStorage (500ms delay)**
- All user preference changes must be debounced
- Column widths, visibility, order, zoom level, etc.

### Performance Targets
| Operation | Target | Current |
|-----------|--------|---------|
| Task drag | < 20ms | ✅ 10-20ms |
| localStorage write | < 10ms | ✅ ~5ms (debounced) |
| Render 100+ tasks | < 100ms | ✅ 50-100ms |
| No visual flashing | 0 | ✅ 0 |

---

## Sorting & Display Logic

### Rule: Default Sort by Start Date
Schedule templates should default to `startDate` sorting for timeline view.

```javascript
// ✅ Correct default
const [sortBy, setSortBy] = useState('startDate')
const [sortDirection, setSortDirection] = useState('asc')
```

**Rationale:**
- Gantt charts show chronological timeline of work
- Users need to see "what happens next" in date order
- Tasks appear in execution sequence

**Display Order Example:**
1. Task 2 (Day 0) → Earliest start
2. Task 4 (Day 2)
3. Task 5 (Day 4)
4. Task 1 (Day 6)
5. Task 3 (Day 8) → Latest start

### Sorting Options Available
Users can click column headers to sort by:
- **#** - Sequence number (original order) - NOT SORTABLE
- **Task Name** - Alphabetical
- **Start Date** - Timeline order (default)
- **Duration** - Longest to shortest
- **Supplier/Group** - Alphabetical
- **Predecessors** - Dependency order

---

## Data Flow & State Management

### Task Data Structure
```typescript
interface ScheduleTask {
  id: number
  name: string
  duration: number
  start_date: number              // Business days from project start
  supplier_id?: number            // Foreign key to suppliers
  supplier_name?: string          // Loaded via join
  assigned_role?: string          // Internal role (admin, sales, etc.)
  predecessor_ids: Array<{
    id: number                    // Task number (1-based)
    type: 'FS' | 'SS' | 'FF' | 'SF'
    lag: number                   // Days offset
  }>
  predecessor_display?: string    // Formatted: "2FS+3, 5SS"
  manually_positioned?: boolean   // Locked position
  po_required?: boolean
  create_po_on_job_start?: boolean
  price_book_item_ids?: number[]
  critical_po?: boolean
  tags?: string[]
  require_photo?: boolean
  require_certificate?: boolean
  cert_lag_days?: number
  require_supervisor_check?: boolean
  supervisor_checklist_template_ids?: number[]
  auto_complete_task_ids?: any[]
  subtask_template_ids?: any[]
  linked_task_ids?: any[]
  manual_task?: boolean
  allow_multiple_instances?: boolean
  order_required?: boolean
  call_up_required?: boolean
  plan_required?: boolean
  documentation_category_ids?: number[]
  // Status fields (backend only, not in template editor)
  confirm?: boolean
  supplier_confirm?: boolean
  start?: boolean
  complete?: boolean
  dependencies_broken?: boolean
  broken_predecessor_ids?: any[]
}
```

### State Flow
```
User Action (drag/edit)
  ↓
DHtmlxGanttView event handler
  ↓
onUpdateTask callback
  ↓
ScheduleTemplateEditor.handleUpdateRow()
  ↓
API call (PATCH /api/v1/schedule_template_rows/:id)
  ↓
Backend validation & calculation
  ↓
Response → Update local state
  ↓
Gantt re-renders with new data
```

### Critical Callbacks
```jsx
<DHtmlxGanttView
  onUpdateTask={async (taskId, updates, options) => {
    // options.skipReload - prevent infinite loops
    await handleUpdateRow(taskId, updates, options)
  }}
/>
```

---

## Common Patterns

### Pattern 1: Opening Gantt Modal
```javascript
const [showGanttView, setShowGanttView] = useState(false)

<button onClick={() => setShowGanttView(true)}>
  📊 View Gantt Chart
</button>

{showGanttView && (
  <DHtmlxGanttView
    isOpen={true}
    onClose={() => setShowGanttView(false)}
    tasks={tasks}
    onUpdateTask={handleTaskUpdate}
  />
)}
```

### Pattern 2: Task Update with Validation
```javascript
const handleUpdateTask = async (taskId, updates, options) => {
  // Find task
  const rowIndex = rows.findIndex(r => r.id === taskId)
  if (rowIndex === -1) return

  try {
    // Optimistic update
    setRows(prev => prev.map(r =>
      r.id === taskId ? { ...r, ...updates } : r
    ))

    // API call
    const response = await api.patch(
      `/api/v1/schedule_template_rows/${taskId}`,
      { schedule_template_row: updates }
    )

    // Sync with server response
    if (!options?.skipReload) {
      setRows(prev => prev.map(r =>
        r.id === taskId ? response : r
      ))
    }
  } catch (err) {
    // Rollback on error
    await loadTemplateRows(selectedTemplate.id)
    showToast(err.message, 'error')
  }
}
```

### Pattern 3: Conditional Toolbar Buttons
```jsx
{selectedTemplate && (
  <>
    {/* Always visible */}
    <button>
      📊 View Gantt
    </button>

    {/* Only for non-default templates */}
    {!selectedTemplate.is_default && (
      <>
        <button>
          ✏️ Rename
        </button>
        <button>
          🗑️ Delete
        </button>
      </>
    )}
  </>
)}
```

---

## Troubleshooting

### Issue: Tasks Not Showing in Gantt
**Symptoms:** Gantt opens but shows no tasks or blank timeline

**Causes & Fixes:**
- ✅ Check `tasks` prop is populated
- ✅ Verify tasks have `id`, `name`, `duration`, `start_date`
- ✅ Check console for DHtmlx errors
- ✅ Ensure `isOpen={true}` when modal should display

### Issue: Lag When Dragging Tasks
**Symptoms:** UI stutters or freezes during drag operations

**Causes & Fixes:**
- ✅ Check if localStorage writes are debounced (should be)
- ✅ Verify `smart_rendering` and `static_background` enabled
- ✅ Check for console errors during drag
- ✅ Ensure no unnecessary re-renders in parent component

### Issue: Visual Flashing
**Symptoms:** Gantt chart flickers or flashes during updates

**Causes & Fixes:**
- ✅ Use `debouncedRender()` instead of direct `gantt.render()`
- ✅ Check for multiple render calls in rapid succession
- ✅ Verify renderTimeout is being cleared properly

### Issue: API Delete Errors
**Symptoms:** "Unexpected end of JSON input" when deleting templates

**Fix:** Already handled in api.js - handle 204 No Content responses:
```javascript
if (response.status === 204) return null
const text = await response.text()
return text ? JSON.parse(text) : null
```

### Issue: Tasks Appear Out of Order
**Expected:** Tasks sorted by start date (timeline order)

**If Sorting Wrong:** Check `sortBy` default is `'startDate'`
```javascript
// Should be:
const [sortBy, setSortBy] = useState('startDate')
// NOT:
const [sortBy, setSortBy] = useState('sequence')
```

---

## Validation Workflow with Claude.ai

### How This File Gets Updated and Validated

**Step 1: CC Makes Code Changes**
- CC updates code that affects Gantt functionality
- CC updates this MD file in the relevant rule sections
- CC documents WHY the change was made

**Step 2: User Copies to Claude.ai**
- User clicks "Gantt Rules" button in app settings
- User clicks "Copy All" button
- User pastes entire MD file to Claude.ai

**Step 3: Claude.ai Reviews**
- Claude.ai reviews changes against retained knowledge
- Claude.ai identifies potential issues or breaking changes
- Claude.ai discusses concerns with user

**Step 4: Validation & Corrections**
- User and Claude.ai discuss any problems
- Claude.ai provides corrected/validated version
- Claude.ai explains what was changed and why

**Step 5: CC Receives Validated Version**
- User pastes validated MD back to CC
- CC automatically accepts it as the new Bible
- CC follows updated rules in all future sessions

### What CC Should Do When Receiving Updated File
```
1. Read entire file carefully
2. Note any new Protected Code Patterns
3. Check for conflicts with current code
4. If conflicts exist:
   - Ask user which version is correct
   - Explain the difference
   - Wait for approval before changing code
5. Update code to match new rules if needed
6. Confirm changes to user
```

---

## Development Checklist

When working on Gantt/Schedule features, always:

- [ ] Use `DHtmlxGanttView` component (never SVAR/Frappe/custom)
- [ ] Debounce all localStorage writes (500ms delay)
- [ ] Handle 204 No Content for DELETE requests
- [ ] Default sort to `startDate` for timeline view
- [ ] Add confirmation dialogs for destructive actions
- [ ] Prevent deleting default templates
- [ ] Test with 100+ tasks for performance
- [ ] Check for console errors during drag operations
- [ ] Verify no visual flashing when updating
- [ ] Test undo/redo functionality
- [ ] Update this Bible file if making changes that affect future sessions
- [ ] Document WHY code is written a certain way

---

## Future Considerations

### DHtmlx Trial Decision
**Trial expires:** ~30 days from initial setup
**Cost:** ~$2,140 AUD for 5 developers

**Decision Criteria:**
- Does auto-scheduling save significant time?
- Is critical path visualization valuable?
- Does performance meet requirements with real data?
- Is export functionality (PDF/Excel) needed?

**Alternative:** Check Syncfusion Community License eligibility (free if revenue < $1M USD)

### Potential Enhancements
- [ ] Resource allocation view
- [ ] Baseline comparison (planned vs actual)
- [ ] Bulk task editing
- [ ] Template versioning
- [ ] Advanced filtering (by supplier, tags, status)
- [ ] Export to MS Project format

---

## Contact & Support

**DHtmlx Documentation:** https://docs.dhtmlx.com/gantt/
**DHtmlx Support:** support@dhtmlx.com
**Trial Info:** https://dhtmlx.com/docs/products/dhtmlxGantt/

**Internal Questions:**
1. Check this document first
2. Review `DHtmlxGanttView.jsx` implementation
3. Check console logs for DHtmlx messages
4. Test in isolation with minimal task data

---

## Document History

**Version 1.0.5 - November 14, 2025 at 1:45 PM AEST:**
- **ANTI-FLICKER ENHANCEMENT:** Eliminated visual flickering during task drag operations
- Added Protected Pattern 1c: Anti-Flicker During Drag
- **Problem:** Screen flickered continuously while dragging tasks due to render calls
- **Solution 1:** Modified `debouncedRender()` to skip all render calls while `isDragging.current = true`
- **Solution 2:** Added 500ms delayed render after drag completes to let animation finish smoothly
- **Result:** Smooth drag experience with no visual stuttering or flickering
- User reported issue: "when im in a gant the screen is very flockery"
- Implemented user's suggestion: delay display update by half a second after drag
- **Location:** DHtmlxGanttView.jsx lines 216-233 (debouncedRender), 1893-1900 (delayed render)

**Version 1.0.4 - November 14, 2025 at 12:55 PM AEST:**
- **FINAL FIX - PRODUCTION READY:** Render loop issue completely resolved
- Fixed render loop returning with 23+ spurious drag events after each drag
- Root cause: Resetting `isLoadingData.current = false` at end of normal drag completion (line 1891)
- When real drag completes → triggers cascade updates → reload → `gantt.parse()` fires spurious events
- If we reset `isLoadingData` too early, those spurious events bypass protection → render loop
- **Solution:** NEVER reset `isLoadingData` at end of normal drag completion
- Only reset `isDragging` at end of handler; `isLoadingData` managed exclusively by useEffect's 500ms timeout
- Early-exit cases (conflict, cancel, cascade modal) still reset both flags to allow immediate next operation
- **Result:** Only 1 spurious event (properly handled), down from 23+. No render loop.
- Updated Protected Pattern 1b with final implementation and detailed explanation
- **Location:** DHtmlxGanttView.jsx lines 1886-1894

**Version 1.0.3 - November 14, 2025 at 12:27 PM AEST:**
- **CRITICAL FIX:** Corrected Protected Pattern 1b - Removed `isLoadingData.current` reset from end of drag handler
- Fixed render loop returning after second drag (10+ spurious drag events)
- Root cause: Resetting `isLoadingData.current = false` at line 1871 interfered with ongoing `gantt.parse()` operations
- When `gantt.parse()` fires spurious drag events, those events reached line 1871 and reset the flag
- This allowed subsequent spurious events to bypass the protection at line 1269
- Solution: Only reset `isDragging.current` at end of handler; `isLoadingData.current` managed by useEffect's 500ms timeout
- Only reset `isLoadingData.current` in early-exit code paths (conflict, cancel, cascade modal) to allow immediate next operation
- **Location:** DHtmlxGanttView.jsx line 1871 (removed `isLoadingData.current = false`)

**Version 1.0.2 - November 14, 2025 at 12:20 PM AEST:**
- **CRITICAL FIX:** Added Protected Pattern 1b - isDragging Flag Management
- Fixed blank screen after dragging tasks
- Root cause: `isDragging.current` flag never reset in some code paths (conflict, cascade modal, early returns)
- When flag stays `true`, useEffect skips all future data reloads → blank screen
- Solution: Added `isDragging.current = false` in all early return cases + final safety net at handler end
- **Locations:** DHtmlxGanttView.jsx lines 1346, 1638, 1860

**Version 1.0.1 - November 14, 2025 at 11:53 AM AEST:**
- **CRITICAL FIX:** Added Protected Pattern 1a - Render Loop Prevention
- Fixed severe UI glitching/flickering when dragging tasks in Gantt
- Root cause: `gantt.parse()` triggers spurious `onAfterTaskDrag` events causing render loops
- Solution: Added `isDragging.current` and `isLoadingData.current` checks in useEffect
- Increased `isLoadingData` timeout from 50ms to 500ms to allow state updates to settle
- Documented the fix as a Protected Pattern to prevent future "optimization" attempts
- **Location:** DHtmlxGanttView.jsx lines 3143-3168, 3398-3404

**Version 1.0.0 - November 14, 2025 at 11:07 AM AEST:**
- **Added version control** (semantic versioning: MAJOR.MINOR.PATCH)
- **Created sync script** (`scripts/sync-gantt-rules.sh`) for foolproof file syncing
- **Added file location tracking** in document header
- **Updated sync process rules** with mandatory steps for CC to follow
- Added comprehensive column definitions section
- Documented all 25+ columns with database fields, behavior, rules
- Added dynamic documentation category columns
- Documented backend-only status fields
- Added detailed data structures and validation rules
- Expanded implementation examples
- Clarified relationship between UI columns and database fields
- Added rules for answering questions and removing prompts (prevents file bloat)
- Added rules for ensuring Gantt Rules UI buttons work correctly

**This document should be updated whenever:**
- Architectural decisions change
- Implementation patterns change
- New Protected Code Patterns are identified
- Performance requirements change
- Bug fixes require rule updates
- Database schema changes affecting columns

**Update Process:**
1. CC updates relevant sections when making code changes
2. User validates changes with Claude.ai
3. Validated version becomes new Bible
4. All future sessions follow updated rules
**Version 1.2.0 - November 14, 2025 at 11:30 PM AEST:**
- **Added Related Documentation section** linking to GANTT_BIBLE_COLUMNS.md
- Created comprehensive column documentation (33 Schedule Master + 11 Gantt columns)
- Documented active status, implementation details, and test coverage for all columns
- Added quick reference card for navigation between documentation files
- Improved documentation discoverability and organization

**Version 1.3.0 - November 15, 2025 at 12:20 AM AEST:**
- **🚨 ADDED CRITICAL SECTION: "Read Before Touching Gantt Code"**
- Documented #1 Killer Bug: Predecessor ID Mismatch (1-based vs 0-based)
- Documented #2 Killer Bug: Infinite Render Loops (gantt.parse spurious events)
- Added comprehensive useRef flags documentation (isDragging, isLoadingData, isSaving)
- Documented Backend Cascade Service critical behavior
- Added Lock Hierarchy (5 lock types with priorities)
- Documented API Pattern: Single Update + Cascade Response
- Added Diagnostic Mode & Bug Hunter integration guide
- Documented Performance: Debounced Render Pattern
- Added DHtmlx Gantt Configuration critical values
- Documented Working Days & Public Holidays setup
- Added Common Gotchas section (5 most frequent mistakes)
- Added File Structure Quick Reference
- Created "Before You Start Coding" checklist
- **Purpose:** Prevent developers from introducing known bugs that took 8+ iterations to fix
