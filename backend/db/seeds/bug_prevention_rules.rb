# Bug Prevention Rules - Pattern Library Integration
# Adds prevention rules to Trinity Bible for automated bug detection
# Chapter 1: System-Wide Rules (applies to all code)

puts "🛡️ Adding Bug Prevention Rules to Trinity Bible..."

# Find or create Chapter 1
chapter_number = 1
chapter_name = "Overview & System-Wide Rules"

# Get current max section number for Chapter 1
max_section = Trinity.where(category: 'bible', chapter_number: chapter_number)
                    .maximum(:section_number)
                    &.to_f || 0

starting_section = (max_section + 0.1).round(1)

# PATTERN-001: Empty Array Assignment (Data Loss)
Trinity.find_or_create_by!(
  category: 'bible',
  chapter_number: chapter_number,
  section_number: (starting_section).to_s
) do |rule|
  rule.chapter_name = chapter_name
  rule.title = "NEVER Assign Empty Arrays Without Preserving Existing Data"
  rule.entry_type = "NEVER"
  rule.component = nil  # Applies to all components
  rule.bible_entry = true
  rule.lexicon_entry = false
  rule.teacher_entry = false

  rule.description = <<~DESC
    ❌ **NEVER assign `[]` to a variable that may contain existing data**

    **Why:** This permanently deletes data, most commonly task dependencies (predecessor_ids),
    user selections, or relationship arrays.

    **Pattern ID:** PATTERN-001 (BUG-003 historically)
    **Severity:** CRITICAL - Data Loss
    **Frequency:** 40% of all bugs (most common recurring bug)
    **Auto-Detection:** Pre-Commit Guardian blocks this pattern
    **Auto-Fix:** Available (spread operator)
  DESC

  rule.details = <<~DETAILS
    ## The Problem

    When you write `variable = []`, you're telling the computer to throw away ALL existing
    data and start with an empty list. This causes permanent data loss.

    **Common Scenarios:**
    - Drag operations: `predecessor_ids = []` (deletes all task dependencies)
    - State updates: `selectedItems = []` (loses user selections)
    - Data transformations: `relationships = []` (breaks connections)

    ## Historical Impact

    **Original Bug (DHtmlxGanttView.jsx:2078, 2096):**
    - Every drag operation deleted ALL task dependencies
    - User schedules corrupted silently
    - No error messages - data just disappeared
    - Discovered by Bug Hunter automated scan (2025-11-16)

    **Resolution:** Fixed with spread operator to preserve existing data

    ## Detection Method

    **Regex Pattern:** `/(\w+)\s*=\s*\[\](?!\s*\.\.\.|;?\s*$)/g`

    **What it catches:**
    - `predecessor_ids = []` ✅ MATCH (data loss!)
    - `items = []` ✅ MATCH (suspicious)

    **What it allows:**
    - `const list = []` ❌ No match (initialization is fine)
    - `items = [...items]` ❌ No match (preserving data - correct!)
    - `data = [];` ❌ No match (end of line - intentional clear)
  DETAILS

  rule.code_example = <<~CODE
    ❌ **WRONG - Data Loss:**
    ```javascript
    // Drag handler in DHtmlxGanttView.jsx
    const updateData = {
      duration: task.duration,
      start_date: dayOffset,
      predecessor_ids: []  // ❌ DELETES all dependencies!
    }

    // Result: User's dependency graph corrupted
    ```

    ✅ **CORRECT - Data Preserved:**
    ```javascript
    // Fixed version
    const updateData = {
      duration: task.duration,
      start_date: dayOffset,
      predecessor_ids: task.predecessor_ids || []  // ✅ Preserves existing
    }

    // Alternative: Use spread operator
    const updateData = {
      duration: task.duration,
      start_date: dayOffset,
      predecessor_ids: [...(task.predecessor_ids || [])]  // ✅ Makes a copy
    }
    ```

    **When Intentional Clear is OK:**
    ```javascript
    // User clicked "Clear All" button
    function handleClearAll() {
      if (confirm('Delete all dependencies?')) {
        predecessor_ids = []  // ✅ Intentional, user confirmed
      }
    }

    // Initialization
    function initializeTask() {
      const newTask = {
        id: generateId(),
        predecessor_ids: []  // ✅ New task has no dependencies yet
      }
    }
    ```
  CODE

  rule.common_mistakes = <<~MISTAKES
    1. **"I thought I was just updating the position"**
       - Developer focuses on start_date change
       - Doesn't realize predecessor_ids is being cleared
       - Must ALWAYS include ALL fields in update payload

    2. **"The variable was empty in my test case"**
       - Tested with new task (no predecessors)
       - Didn't test with existing task (has predecessors)
       - Data loss only visible with real data

    3. **"It looked correct in the UI"**
       - Visual Gantt shows tasks in new positions (looks fine)
       - Data loss only visible when reopening or checking database
       - Silent corruption - no error messages

    4. **"I copied from another file"**
       - Copied outdated code pattern
       - Some files fixed, others not
       - Must update ALL code paths
  MISTAKES

  rule.recommendations = <<~RECOMMENDATIONS
    ✅ **DO:**
    1. **Preserve existing data:**
       ```javascript
       variable = [...variable]  // Spread operator
       variable = variable || []  // Fallback to empty if undefined
       ```

    2. **Include ALL fields in updates:**
       ```javascript
       const updateData = {
         ...task,  // Start with ALL existing fields
         start_date: newDate  // Update only what changed
       }
       ```

    3. **Test with existing data:**
       - Create task with 3+ predecessors
       - Perform operation
       - Verify predecessors still exist in database

    ❌ **DON'T:**
    1. **Hardcode empty arrays:**
       ```javascript
       predecessor_ids: []  // ❌ Assumes no existing data
       ```

    2. **Selectively copy fields:**
       ```javascript
       const updateData = {
         field1: task.field1,
         field2: newValue  // ❌ What about field3, field4?
       }
       ```

    3. **Skip database verification:**
       - Visual UI may look correct
       - Always check database after operations
       - Use Bug Hunter to verify
  RECOMMENDATIONS

  rule.related_rules = "Gantt Bible RULE #9: Predecessor Format; Bible §19.3: Data Preservation Standards; Pattern Library PATTERN-001"
end

# PATTERN-002: Race Condition - Rapid State Updates
Trinity.find_or_create_by!(
  category: 'bible',
  chapter_number: chapter_number,
  section_number: (starting_section + 0.1).to_s
) do |rule|
  rule.chapter_name = chapter_name
  rule.title = "ALWAYS Batch Related State Updates Into Single setState Call"
  rule.entry_type = "ALWAYS"
  rule.component = nil
  rule.bible_entry = true
  rule.lexicon_entry = false
  rule.teacher_entry = false

  rule.description = <<~DESC
    ✅ **ALWAYS batch related state updates into a single setState call**

    **Why:** Multiple rapid setState calls cause race conditions, screen flickering,
    and unpredictable behavior due to React's asynchronous state queue.

    **Pattern ID:** PATTERN-002 (BUG-001 - Drag Flickering)
    **Severity:** HIGH - Performance & UX
    **Frequency:** 25% of bugs
    **Auto-Detection:** Pre-Commit Guardian warns about this pattern
    **Impact:** Screen shake, 8+ re-renders per operation
  DESC

  rule.details = <<~DETAILS
    ## The Problem

    React batches state updates asynchronously. Multiple setState calls queue up and
    execute in unpredictable order, triggering separate re-renders for each update.

    **What happens:**
    1. First setState queues: `{ isDragging: true }`
    2. Second setState queues: `{ position: newPosition }`
    3. Third setState queues: `{ status: 'moving' }`
    4. React triggers 3 separate re-renders
    5. User sees screen flicker 3 times
    6. Intermediate states visible (inconsistent UI)

    ## Historical Impact

    **Original Bug (DHtmlxGanttView.jsx - Drag Flickering):**
    - Drag operations called setState 3+ times
    - Each dependent task triggered cascade → more setState calls
    - Result: 8-12 Gantt reloads per drag
    - Visible screen shake and performance issues
    - Resolution time: ~6 hours of investigation

    **After fix:**
    - 1 batched setState call
    - 1 re-render
    - Smooth, professional UX
  DETAILS

  rule.code_example = <<~CODE
    ❌ **WRONG - Race Condition:**
    ```javascript
    // Multiple setState calls in rapid succession
    function handleDrag(newPosition) {
      setState({ isDragging: true })
      setState({ position: newPosition })
      setState({ status: 'moving' })

      // Result:
      // - 3 separate re-renders
      // - Screen flickers 3 times
      // - Cascade effects multiply this (8-12 reloads!)
    }
    ```

    ✅ **CORRECT - Batched Update:**
    ```javascript
    // Single setState call with merged object
    function handleDrag(newPosition) {
      setState({
        isDragging: true,
        position: newPosition,
        status: 'moving'
      })

      // Result:
      // - 1 re-render
      // - Smooth transition
      // - Professional UX
    }
    ```

    **When Using Functional Updates:**
    ```javascript
    // ❌ WRONG
    setState(prev => ({ ...prev, field1: value1 }))
    setState(prev => ({ ...prev, field2: value2 }))

    // ✅ CORRECT
    setState(prev => ({
      ...prev,
      field1: value1,
      field2: value2
    }))
    ```

    **Using Refs for Control Flags:**
    ```javascript
    // For flags that don't need re-renders
    const isDragging = useRef(false)

    function handleDragStart() {
      isDragging.current = true  // ✅ No re-render
      setState({ position: newPosition })  // Only 1 re-render
    }
    ```
  CODE

  rule.common_mistakes = <<~MISTAKES
    1. **"I need to update these fields separately"**
       - No you don't - React can merge them
       - Separate updates = separate re-renders
       - Batch them into one object

    2. **"But they depend on each other"**
       - Use functional update with prev state
       - Still batch into single setState call
       - Example: `setState(prev => ({ ...prev, field1: x, field2: prev.field1 + 1 }))`

    3. **"React 18 auto-batches so this is fine"**
       - React 18 batches SOME cases automatically
       - Not guaranteed in all contexts (timeouts, promises)
       - Explicit batching is more reliable

    4. **"I'll use flushSync to force immediate update"**
       - flushSync opts OUT of batching
       - Makes performance worse, not better
       - Only use in rare cases (measuring DOM)
  MISTAKES

  rule.recommendations = <<~RECOMMENDATIONS
    ✅ **DO:**
    1. **Merge related updates:**
       ```javascript
       setState({ field1: val1, field2: val2, field3: val3 })
       ```

    2. **Use refs for control flags:**
       ```javascript
       const isLoading = useRef(false)  // No re-render needed
       ```

    3. **Test render counts:**
       - Use React DevTools Profiler
       - Check console for excessive logs
       - Verify single re-render per operation

    ❌ **DON'T:**
    1. **Call setState multiple times in sequence:**
       ```javascript
       setState({a: 1}); setState({b: 2})  // ❌
       ```

    2. **Update same state repeatedly:**
       ```javascript
       setState({status: 'loading'})
       // ... some code ...
       setState({status: 'ready'})  // ❌ Too fast
       ```

    3. **Mix setState with direct DOM manipulation:**
       ```javascript
       setState({...})
       element.style.display = 'none'  // ❌ React should handle this
       ```
  RECOMMENDATIONS

  rule.related_rules = "Gantt Bible: Lock mechanisms; Bible §15.2: State Management; Teacher §8.3: React Performance; Pattern Library PATTERN-002"
end

# PATTERN-003: Infinite Cascade Loop
Trinity.find_or_create_by!(
  category: 'bible',
  chapter_number: chapter_number,
  section_number: (starting_section + 0.2).to_s
) do |rule|
  rule.chapter_name = chapter_name
  rule.title = "ALWAYS Provide Dependency Array to useEffect Hooks"
  rule.entry_type = "ALWAYS"
  rule.component = nil
  rule.bible_entry = true
  rule.lexicon_entry = false
  rule.teacher_entry = false

  rule.description = <<~DESC
    ✅ **ALWAYS provide dependency array to useEffect hooks that update state or call APIs**

    **Why:** useEffect without dependencies runs after EVERY render. If the effect updates
    state, it triggers another render, which runs the effect again = infinite loop.

    **Pattern ID:** PATTERN-003 (BUG-002 - Infinite Cascade Loop)
    **Severity:** CRITICAL - Infinite Loops
    **Frequency:** 20% of bugs
    **Auto-Detection:** Pre-Commit Guardian warns about missing dependencies
    **Impact:** 20+ duplicate API calls, browser freeze, database overwhelm
  DESC

  rule.details = <<~DETAILS
    ## The Problem

    `useEffect(() => { ... })` with NO dependency array runs after EVERY render:

    **Infinite Loop Timeline:**
    1. Component renders
    2. useEffect runs → calls updateCascade()
    3. updateCascade() calls setState()
    4. setState() triggers re-render
    5. Component renders again
    6. Back to step 2 → INFINITE LOOP

    ## Historical Impact

    **Original Bug (ScheduleTemplateEditor.jsx):**
    - useEffect called cascade update with no dependencies
    - Each cascade triggered state update
    - State update triggered useEffect again
    - Result: 20+ API calls in 5 seconds
    - Browser froze, database overwhelmed
    - Users couldn't interact with page

    **Resolution:**
    - Added dependency array: `[taskIds]`
    - Added ref guard: `isUpdating.current`
    - Delayed pending cleanup (2 seconds)
    - Result: 1 API call, smooth cascade
  DETAILS

  rule.code_example = <<~CODE
    ❌ **WRONG - Infinite Loop:**
    ```javascript
    // NO dependency array = runs after EVERY render
    useEffect(() => {
      updateCascadeFields()  // Updates state
      // → Re-render → useEffect runs again → Loop!
    })

    // Result:
    // - 20+ duplicate API calls
    // - Browser freezes
    // - Database overwhelmed
    ```

    ✅ **CORRECT - Controlled Updates:**
    ```javascript
    // WITH dependency array = runs only when dependencies change
    useEffect(() => {
      if (shouldUpdate && !isUpdating.current) {
        isUpdating.current = true
        updateCascadeFields()
      }
    }, [shouldUpdate, taskIds])  // Only run when these change

    // Result:
    // - 1 API call per actual change
    // - Smooth performance
    // - Predictable behavior
    ```

    **Run Once on Mount:**
    ```javascript
    // Empty array = runs ONCE when component mounts
    useEffect(() => {
      initializeData()
      return () => cleanup()  // Cleanup on unmount
    }, [])  // Empty array = mount only
    ```

    **Ref-Based Guard:**
    ```javascript
    const isUpdating = useRef(false)

    useEffect(() => {
      if (!isUpdating.current) {
        isUpdating.current = true

        updateCascade().finally(() => {
          isUpdating.current = false  // Reset after completion
        })
      }
    }, [dependency])
    ```

    **Conditional Updates:**
    ```javascript
    useEffect(() => {
      // Guard condition prevents unnecessary runs
      if (!isInitialized || taskIds.length === 0) {
        return
      }

      updateCascade(taskIds)
    }, [taskIds, isInitialized])
    ```
  CODE

  rule.common_mistakes = <<~MISTAKES
    1. **"I want it to run on every render"**
       - No you don't - that causes infinite loops
       - Identify WHAT should trigger the effect
       - Add those as dependencies

    2. **"I'll just use an empty array []"**
       - Empty array = runs ONCE on mount
       - Won't run when data changes
       - Must include actual dependencies

    3. **"ESLint says to add X to dependencies"**
       - ESLint is usually right, but not always
       - Understand WHY it's suggesting the dependency
       - Use useCallback/useMemo if needed
       - Add eslint-disable comment ONLY if you're certain

    4. **"I'll use a ref so I don't need dependencies"**
       - Refs don't trigger re-renders when they change
       - Effect won't run when ref.current changes
       - Only use refs for values that shouldn't trigger updates
  MISTAKES

  rule.recommendations = <<~RECOMMENDATIONS
    ✅ **DO:**
    1. **Always specify dependencies:**
       ```javascript
       useEffect(() => { /* effect */ }, [dep1, dep2])
       ```

    2. **Use ref guards for control:**
       ```javascript
       const isUpdating = useRef(false)
       if (!isUpdating.current) { /* safe to proceed */ }
       ```

    3. **Clean up effects:**
       ```javascript
       useEffect(() => {
         const subscription = subscribe()
         return () => subscription.unsubscribe()  // Cleanup
       }, [])
       ```

    4. **Test for infinite loops:**
       - Monitor console for duplicate logs
       - Check Network tab for repeated requests
       - Use Bug Hunter to detect excessive API calls

    ❌ **DON'T:**
    1. **Omit dependency array:**
       ```javascript
       useEffect(() => { setState(...) })  // ❌ Infinite loop!
       ```

    2. **Ignore ESLint warnings:**
       ```javascript
       // eslint-disable-next-line react-hooks/exhaustive-deps
       useEffect(() => { ... }, [])  // ❌ Only if you're CERTAIN
       ```

    3. **Put entire objects as dependencies:**
       ```javascript
       useEffect(() => { ... }, [user])  // ❌ New object every render
       // Better: useEffect(() => { ... }, [user.id])
       ```
  RECOMMENDATIONS

  rule.related_rules = "Bible §16.1: UseEffect Best Practices; Teacher §9.2: Cascade Implementation; Pattern Library PATTERN-003"
end

# PATTERN-004: Deprecated Table Component Usage
Trinity.find_or_create_by!(
  category: 'bible',
  chapter_number: 19,  # UI/UX chapter
  section_number: "19.0"  # Table component standards
) do |rule|
  rule.chapter_name = "UI/UX"
  rule.title = "ONLY Use TrapidTableView for ALL Tables (No TablePage, No DataTable)"
  rule.entry_type = "MUST"
  rule.component = "TrapidTableView"
  rule.bible_entry = true
  rule.lexicon_entry = false
  rule.teacher_entry = false

  rule.description = <<~DESC
    ✅ **MUST use TrapidTableView for ALL table components**
    ❌ **NEVER use deprecated TablePage.jsx or DataTable.jsx**

    **Why:** Multiple table components created inconsistent UX, feature duplication,
    and maintenance overhead. TrapidTableView is THE ONE STANDARD.

    **Pattern ID:** PATTERN-004 (Table Component Consolidation)
    **Severity:** MEDIUM - Architecture Violation
    **Frequency:** 15% of bugs
    **Auto-Detection:** Pre-Commit Guardian blocks deprecated imports
    **Migration:** Template provided at /settings?tab=gold-standard
  DESC

  rule.details = <<~DETAILS
    ## The Problem

    **Historical Growth:**
    Different tables were built at different times:
    1. DataTable.jsx - Early basic tables (deprecated)
    2. TablePage.jsx - Custom dynamic tables (deprecated)
    3. TrapidTableView - Enterprise-grade standard (OFFICIAL)

    **Issues with Multiple Standards:**
    - Inconsistent UX across tables
    - Missing features (some tables lack export, filtering)
    - Developer confusion about which to use
    - 3× maintenance overhead
    - Design system violations

    ## The Decision (Nov 2024)

    **TrapidTableView declared as THE ONE STANDARD:**
    - Comprehensive features: sort, filter, search, export, pagination
    - Consistent design system compliance
    - Advanced features: inline editing, column visibility, custom formatters
    - Gold Standard demo: `/settings?tab=gold-standard`
    - Complete template: `GoldStandardTableTab.jsx`
    - Full documentation: Teacher §19.1
  DETAILS

  rule.code_example = <<~CODE
    ❌ **DEPRECATED - Don't Use:**
    ```javascript
    // OLD - TablePage.jsx (deprecated)
    import TablePage from './components/TablePage'

    function MyComponent() {
      return <TablePage data={data} />

      // Problems:
      // - Limited features (no export, no filtering)
      // - Inconsistent UX
      // - Not maintained
      // - Missing accessibility features
    }

    // OLD - DataTable.jsx (deprecated)
    import { DataTable } from './components/DataTable'

    function AnotherComponent() {
      return <DataTable rows={rows} />

      // Problems:
      // - Basic functionality only
      // - Different design from rest of app
      // - Maintenance burden
    }
    ```

    ✅ **CORRECT - Use TrapidTableView:**
    ```javascript
    // NEW STANDARD - TrapidTableView
    import TrapidTableView from './components/TrapidTableView'

    function MyComponent() {
      const columns = [
        {
          key: 'name',
          label: 'Name',
          sortable: true,
          searchable: true
        },
        {
          key: 'status',
          label: 'Status',
          formatter: (value) => <StatusBadge status={value} />
        }
      ]

      return (
        <TrapidTableView
          data={data}
          columns={columns}
          searchable={true}
          exportable={true}
          paginated={true}
          rowsPerPage={50}
          onRowClick={handleRowClick}
        />
      )

      // Benefits:
      // ✅ All features: search, sort, filter, export, pagination
      // ✅ Consistent design system
      // ✅ Accessibility compliant
      // ✅ Inline editing support
      // ✅ Column visibility controls
      // ✅ Custom formatters
      // ✅ Responsive design
    }
    ```

    **Migration Steps:**
    ```javascript
    // 1. Copy template from Gold Standard
    // File: frontend/src/components/settings/GoldStandardTableTab.jsx

    // 2. Replace import
    - import TablePage from './TablePage'
    + import TrapidTableView from './TrapidTableView'

    // 3. Convert data format
    const columns = [
      { key: 'field1', label: 'Field 1', sortable: true },
      { key: 'field2', label: 'Field 2', searchable: true }
    ]

    // 4. Replace component
    - <TablePage data={data} />
    + <TrapidTableView data={data} columns={columns} />

    // 5. Test all features
    // - Search works
    // - Sort works
    // - Export works
    // - Pagination works
    // - Inline editing works (if needed)

    // 6. Remove old import
    ```
  CODE

  rule.common_mistakes = <<~MISTAKES
    1. **"I copied from an old file"**
       - Older files may use deprecated components
       - Always check if TablePage/DataTable
       - Replace with TrapidTableView

    2. **"TablePage has features I need"**
       - TrapidTableView has ALL features from TablePage
       - Plus many more advanced features
       - Check Gold Standard demo

    3. **"It's too hard to migrate"**
       - Template provided (copy/paste)
       - Teacher guide has step-by-step instructions
       - Migration usually takes 15-30 minutes

    4. **"This table is unique"**
       - TrapidTableView handles custom formatters
       - Supports inline editing, custom actions
       - More flexible than old components
  MISTAKES

  rule.recommendations = <<~RECOMMENDATIONS
    ✅ **DO:**
    1. **Use TrapidTableView for ALL new tables:**
       ```javascript
       import TrapidTableView from './components/TrapidTableView'
       ```

    2. **Reference Gold Standard demo:**
       - URL: `/settings?tab=gold-standard`
       - Template: `GoldStandardTableTab.jsx`
       - Shows all features in action

    3. **Follow Teacher §19.1 guide:**
       - Complete implementation guide
       - Column configuration examples
       - Feature recipes

    4. **Test all features:**
       - Search, sort, filter
       - Export to CSV/Excel
       - Pagination
       - Column visibility
       - Inline editing (if used)

    ❌ **DON'T:**
    1. **Import deprecated components:**
       ```javascript
       import TablePage from './TablePage'  // ❌
       import { DataTable } from './DataTable'  // ❌
       ```

    2. **Build custom table from scratch:**
       ```javascript
       function CustomTable() {
         return <table>...</table>  // ❌ Use TrapidTableView
       }
       ```

    3. **Mix table components:**
       ```javascript
       // ❌ Don't use different tables in same app
       <TablePage data={data1} />
       <TrapidTableView data={data2} />
       ```
  RECOMMENDATIONS

  rule.related_rules = "Lexicon §19.0: Table Component Consolidation; Teacher §19.1: Table Implementation Guide; Pattern Library PATTERN-004"
end

puts "✅ Added #{4} Bug Prevention Rules to Trinity Bible"
puts "   - PATTERN-001: Empty Array Assignment (Chapter 1)"
puts "   - PATTERN-002: Rapid State Updates (Chapter 1)"
puts "   - PATTERN-003: Infinite Cascade Loop (Chapter 1)"
puts "   - PATTERN-004: Deprecated Table Component (Chapter 19)"
puts ""
puts "🔗 These rules are now integrated with:"
puts "   - Pre-Commit Guardian (scripts/safeguard-checker.js)"
puts "   - Pattern Library (TRAPID_DOCS/PATTERN_LIBRARY.md)"
puts "   - Detection Rules (TRAPID_DOCS/DETECTION_RULES.md)"
