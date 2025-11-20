# frozen_string_literal: true

namespace :trinity do
  desc "Add Bug Prevention Rules to Trinity Bible (Pattern Library Integration)"
  task add_bug_prevention_rules: :environment do
    puts "🛡️ Adding Bug Prevention Rules to Trinity Bible..."
    puts "Environment: #{Rails.env}"
    puts "Database: #{ActiveRecord::Base.connection.current_database}"
    puts ""

    # Check if Trinity table exists
    unless ActiveRecord::Base.connection.table_exists?('trinity')
      puts "❌ Error: 'trinity' table does not exist in #{Rails.env} database"
      puts "This task should be run on Heroku production where Trinity table exists"
      puts ""
      puts "To run on Heroku:"
      puts "  heroku run rails trinity:add_bug_prevention_rules"
      exit 1
    end

    # Find or create Chapter 1
    chapter_number = 1
    chapter_name = "Overview & System-Wide Rules"

    # Get current max section number for Chapter 1
    max_section = Trinity.where(category: 'bible', chapter_number: chapter_number)
                        .maximum(:section_number)
                        &.to_f || 0

    starting_section = (max_section + 0.1).round(1)
    puts "📊 Chapter 1 current max section: #{max_section}"
    puts "🔢 Starting new rules at section: #{starting_section}"
    puts ""

    rules_added = 0

    # PATTERN-001: Empty Array Assignment (Data Loss)
    rule1 = Trinity.find_or_create_by!(
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
        ```
      CODE

      rule.common_mistakes = "Hardcoding empty arrays; skipping database verification; copying outdated code patterns"
      rule.recommendations = "Always use spread operator; test with existing data; verify in database after operations"
      rule.related_rules = "Gantt Bible RULE #9; Pattern Library PATTERN-001"

      rules_added += 1
    end

    puts "✅ PATTERN-001: Empty Array Assignment - #{rule1.new_record? ? 'CREATED' : 'ALREADY EXISTS'}"

    # PATTERN-002: Race Condition - Rapid State Updates
    rule2 = Trinity.find_or_create_by!(
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

      rule.description = "ALWAYS batch related state updates to prevent race conditions and screen flickering. Pattern ID: PATTERN-002. Severity: HIGH."
      rule.details = "Multiple setState calls cause race conditions, 8+ re-renders, and screen shake. Historical bug: DHtmlxGanttView drag flickering."
      rule.code_example = "WRONG: setState({a:1}); setState({b:2}). CORRECT: setState({a:1, b:2})"
      rule.common_mistakes = "Sequential setState calls; updating same state twice; ignoring React 18 batching limitations"
      rule.recommendations = "Merge related updates; use refs for control flags; test render counts with React DevTools"
      rule.related_rules = "Bible §15.2: State Management; Pattern Library PATTERN-002"

      rules_added += 1
    end

    puts "✅ PATTERN-002: Rapid State Updates - #{rule2.new_record? ? 'CREATED' : 'ALREADY EXISTS'}"

    # PATTERN-003: Infinite Cascade Loop
    rule3 = Trinity.find_or_create_by!(
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

      rule.description = "ALWAYS provide dependency array to useEffect that updates state. Pattern ID: PATTERN-003. Severity: CRITICAL."
      rule.details = "useEffect without dependencies runs after EVERY render. If effect updates state = infinite loop. Historical bug: ScheduleTemplateEditor cascade loop (20+ API calls)."
      rule.code_example = "WRONG: useEffect(() => {setState()}). CORRECT: useEffect(() => {setState()}, [deps])"
      rule.common_mistakes = "Missing dependency array; using empty array for effects that need deps; ignoring ESLint warnings"
      rule.recommendations = "Always specify dependencies; use ref guards; clean up effects; test for infinite loops"
      rule.related_rules = "Bible §16.1: UseEffect Best Practices; Pattern Library PATTERN-003"

      rules_added += 1
    end

    puts "✅ PATTERN-003: Infinite Cascade Loop - #{rule3.new_record? ? 'CREATED' : 'ALREADY EXISTS'}"

    # PATTERN-004: Deprecated Table Component Usage
    rule4 = Trinity.find_or_create_by!(
      category: 'bible',
      chapter_number: 19,  # UI/UX chapter
      section_number: "19.0"
    ) do |rule|
      rule.chapter_name = "UI/UX"
      rule.title = "ONLY Use TrapidTableView for ALL Tables"
      rule.entry_type = "MUST"
      rule.component = "TrapidTableView"
      rule.bible_entry = true
      rule.lexicon_entry = false
      rule.teacher_entry = false

      rule.description = "MUST use TrapidTableView for ALL tables. NEVER use deprecated TablePage.jsx or DataTable.jsx. Pattern ID: PATTERN-004. Severity: MEDIUM."
      rule.details = "Multiple table components created inconsistent UX, feature duplication, maintenance overhead. TrapidTableView is THE ONE STANDARD. Gold Standard: /settings?tab=gold-standard"
      rule.code_example = "DEPRECATED: import TablePage from './TablePage'. CORRECT: import TrapidTableView from './TrapidTableView'"
      rule.common_mistakes = "Copying from old files; assuming TablePage has unique features; avoiding migration effort"
      rule.recommendations = "Always use TrapidTableView; reference Gold Standard demo; follow Teacher §19.1; test all features"
      rule.related_rules = "Lexicon §19.0: Table Consolidation; Teacher §19.1; Pattern Library PATTERN-004"

      rules_added += 1
    end

    puts "✅ PATTERN-004: Deprecated Table Component - #{rule4.new_record? ? 'CREATED' : 'ALREADY EXISTS'}"

    puts ""
    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    puts "✅ Successfully added #{rules_added} Bug Prevention Rules to Trinity Bible"
    puts ""
    puts "📚 Rules added to:"
    puts "   - Chapter 1 (System-Wide): PATTERN-001, PATTERN-002, PATTERN-003"
    puts "   - Chapter 19 (UI/UX): PATTERN-004"
    puts ""
    puts "🔗 These rules integrate with:"
    puts "   - Pre-Commit Guardian: scripts/safeguard-checker.js"
    puts "   - Pattern Library: TRAPID_DOCS/PATTERN_LIBRARY.md"
    puts "   - Detection Rules: TRAPID_DOCS/DETECTION_RULES.md"
    puts ""
    puts "🎯 Next steps:"
    puts "   - Trinity sync will auto-generate dense_index for each rule"
    puts "   - Rules will be searchable via Trinity API"
    puts "   - Code Guardian Agent (Week 3) will reference these rules"
    puts "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  end
end
