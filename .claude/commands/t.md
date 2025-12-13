# /t - Code Review

**Shortcut:** `/t`

A focused code review aligned with CLAUDE.md philosophy. Checks the things that matter.

## What This Checks (8 Categories)

| # | Category | Why It Matters |
|---|----------|----------------|
| 1 | **SSoT Violations** | The core philosophy - find duplicates |
| 2 | **Sync Risk Patterns** | Code that will get out of sync with source of truth |
| 3 | **Standard Components** | THE ONE component for each use case |
| 4 | **Gold Standard** | 31 valid column types |
| 5 | **SSoT Model Auditor** | Find NoMethodError time bombs |
| 6 | **Security** | Always important |
| 7 | **Performance** | PERF-001 to PERF-006 anti-patterns |
| 8 | **Code Quality** | Bug patterns, dead code, over-engineering |

## Execution

### Step 1: SSoT Violations

**The most important check. Find things defined in multiple places.**

```bash
# Duplicate constant definitions
grep -rn "COLUMN_TYPE" backend/app --include="*.rb" | grep -v "COLUMN_TYPE_MAP\|COLUMN_SQL_TYPE" | head -10

# Duplicate route definitions
grep -rn "resources :" backend/config/routes.rb | sort | uniq -d

# Multiple deployment methods (we fixed this!)
ls .claude/commands/ | grep -E "^(d|fd|l|lp)\.md$"
```

**Expected:**
- Only `/l` and `/lp` for deployment (SSoT)
- No duplicate constants
- No duplicate routes

### Step 2: Sync Risk Patterns (NEW - Catches Manual Lists)

**Find code that manually lists things that should be auto-derived from a source of truth.**

This catches mistakes like:
- `case model.name when "Job"... when "Contact"...` (should use Rails reflections)
- Hardcoded table lists (should query Foundation or schema)
- Manual association lists (should use `reflect_on_all_associations`)

```bash
echo "=== SYNC RISK: Manual Model/Table Lists ==="

# Pattern 1: case statements on model.name or model.class.name
# These almost always should use reflection instead
echo ""
echo "--- Case statements on model names (should use reflection) ---"
grep -rn "case.*model\\.name\|when.*\"Job\"\|when.*\"Contact\"\|when.*\"PricebookItem\"" backend/app --include="*.rb" | grep -v "#.*case" | head -10

# Pattern 2: Hardcoded arrays of table/model names
echo ""
echo "--- Hardcoded model/table arrays (should query schema) ---"
grep -rn "%w\[.*Job.*Contact\|%w\[.*jobs.*contacts\|\[.*\"Job\".*\"Contact\"" backend/app --include="*.rb" | head -10

# Pattern 3: Manual association includes (should use reflect_on_all_associations)
echo ""
echo "--- Manual includes lists (should auto-derive from model) ---"
grep -rn "includes(.*:job_type.*:job_status\|includes(.*:supplier.*:category" backend/app --include="*.rb" | head -10

# Pattern 4: Manual column lists that duplicate schema
echo ""
echo "--- Hardcoded column lists (should query model.column_names) ---"
grep -rn "select(:id.*:name.*:status\|pluck(:id.*:name" backend/app --include="*.rb" | grep -v "\.select\s*{" | head -10

# Pattern 5: system_searchable or similar manual mappings
echo ""
echo "--- Manual table-specific mappings (SSoT risk) ---"
grep -rn "\"contacts\".*=>\|\"jobs\".*=>\|\"pricebook" backend/app/controllers --include="*.rb" | head -10
```

**What to do when found:**
1. Ask: "Is there a source of truth for this data?"
2. If YES → Refactor to read from that source
3. Common sources:
   - Model associations → `Model.reflect_on_all_associations`
   - Table columns → `Model.column_names`
   - Foundation columns → `foundation.columns`
   - All tables → `Foundation.all` or `ActiveRecord::Base.connection.tables`

**Example fix (what we just did):**
```ruby
# ❌ BAD: Manual list that will get out of sync
case model.name
when "Job"
  query.includes(:job_type, :job_status)
when "Contact"
  query.includes(:corporate_group)
end

# ✅ GOOD: Auto-derive from model (SSoT)
associations = model.reflect_on_all_associations(:belongs_to).map(&:name)
query.includes(*associations)
```

**Expected:** Zero manual lists that duplicate model/schema information

### Step 3: Standard Component Usage

**Check files use THE ONE component per CLAUDE.md:**

| Need | THE ONE | Never Use |
|------|---------|-----------|
| Data Table | `TeeemTableView` | `data-table.tsx` |
| Searchable Select | `ComboboxDropdown` | `combobox.tsx` |
| Multi-Select | `MultipleSelector` | `multi-select-combobox.tsx` |
| Loading | `Spinner` | `loader.tsx` |
| Side Panel | `Sheet` | `drawer.tsx` |
| Collapsible | `Accordion` | `collapsible.tsx` |

```bash
# Check for deprecated component imports
grep -rn "from.*data-table" frontend-next/app --include="*.tsx" | head -5
grep -rn "from.*combobox['\"]" frontend-next/app --include="*.tsx" | grep -v "combobox-dropdown" | head -5
grep -rn "from.*multi-select-combobox" frontend-next/app --include="*.tsx" | head -5
grep -rn "from.*loader" frontend-next/app --include="*.tsx" | head -5
grep -rn "from.*drawer" frontend-next/app --include="*.tsx" | head -5
grep -rn "from.*collapsible" frontend-next/app --include="*.tsx" | head -5
```

**Expected:** Zero matches (all using THE ONE)

### Step 4: Gold Standard Column Types

**Validate all columns use one of the 31 valid types:**

```bash
# Check for invalid column types
cd backend && bin/rails runner "
  valid_types = Column::COLUMN_TYPE_MAP.keys
  invalid = Column.where.not(column_type: valid_types)
  if invalid.any?
    puts 'INVALID COLUMN TYPES:'
    invalid.group(:column_type).count.each { |t, c| puts \"  #{t}: #{c} columns\" }
  else
    puts 'All columns use valid Gold Standard types'
  end
"
```

### Step 5: SSoT Model Auditor

**Find NoMethodError time bombs - method calls on models that don't exist:**

```bash
# Run the SSoT Model Auditor
cd backend && bin/rails ssot:audit
```

**What it checks:**
- Scans controllers, services, jobs, models, mailers
- Finds method calls like `job.title` when the method is actually `job.name`
- Suggests similar methods that likely match intent
- Prevents runtime NoMethodError crashes

**Expected:** 0 issues found

### Step 6: Security Scan

```bash
# Quick security check
cd backend && bundle exec brakeman -q --no-pager -w2 2>/dev/null | head -30 || echo "Brakeman not available"
```

### Step 7: Performance Auditor (Masterpiece Level)

**CRITICAL: Slow UI = bad product. Take whatever time needed to guarantee great performance.**

This is a comprehensive audit covering frontend, backend, and network performance.

---

#### PART A: Frontend Performance

##### A1. Page Load Analysis - The 5 Main Tables

**The 5 Core Tables:** Jobs, Contacts, Pricebook, Price Histories, Corporate Companies

For EACH page in this list, analyze what loads on mount:

```bash
# The 5 main table pages to audit
PAGES=(
  "frontend-next/app/(app)/jobs/page.tsx"
  "frontend-next/app/(app)/contacts/page.tsx"
  "frontend-next/app/(app)/pricebook/page.tsx"
  "frontend-next/app/(app)/pricebook/price-history/page.tsx"
  "frontend-next/app/(app)/corporate/companies/page.tsx"
)

for page in "${PAGES[@]}"; do
  echo "=== Analyzing: $page ==="
  if [ -f "$page" ]; then
    # Count useEffect hooks
    echo "useEffect count: $(grep -c 'useEffect' $page 2>/dev/null || echo 0)"
    # Show what loads on mount
    echo "On-mount fetches:"
    grep -A 15 "useEffect" $page 2>/dev/null | grep -E "fetch|api\.|\.get\(|\.post\(" | head -5
    echo ""
  fi
done
```

##### A2. Modal/Dialog Lazy Loading Audit

```bash
# Find ALL files with modals
echo "=== Files with Modals/Dialogs ==="
MODAL_FILES=$(grep -rln "Modal\|Dialog\|Sheet\|Popover" frontend-next/app/\(app\) --include="*.tsx")

for file in $MODAL_FILES; do
  echo ""
  echo "--- $file ---"

  # Check if data loads on mount that should be lazy
  HAS_MOUNT_EFFECT=$(grep -c "useEffect.*\[\s*\]" $file 2>/dev/null || echo 0)
  HAS_LAZY_GUARD=$(grep -c "modalOpen\|isOpen\|dialogOpen" $file 2>/dev/null || echo 0)

  if [ "$HAS_MOUNT_EFFECT" -gt 0 ] && [ "$HAS_LAZY_GUARD" -eq 0 ]; then
    echo "⚠️  WARNING: Has mount effect but no modal state guard"
    echo "   Likely loading modal data on page mount instead of when opened"
  elif [ "$HAS_MOUNT_EFFECT" -gt 0 ]; then
    echo "   Has $HAS_MOUNT_EFFECT mount effects - verify they're necessary"
  else
    echo "   ✅ No suspicious mount effects"
  fi
done
```

##### A3. useEffect Dependency Audit

```bash
# Find ALL useEffect hooks and categorize them
echo "=== useEffect Audit ==="

# Empty deps (run once on mount) - REVIEW EACH
echo ""
echo "--- Empty deps [] (run on mount) ---"
grep -rn "useEffect.*\[\s*\]" frontend-next/app/\(app\) --include="*.tsx" | head -30

# Missing deps (potential infinite loops)
echo ""
echo "--- Potential missing deps (useEffect without array) ---"
grep -rn "useEffect.*=>" frontend-next/app/\(app\) --include="*.tsx" | grep -v "\[" | head -20
```

##### A4. Bundle/Import Analysis

```bash
# Find heavy imports that might bloat bundle
echo "=== Heavy Imports Check ==="

# Large libraries that should be lazy loaded
grep -rn "import.*from.*lodash['\"]" frontend-next/app --include="*.tsx" | head -10
grep -rn "import.*from.*moment['\"]" frontend-next/app --include="*.tsx" | head -10
grep -rn "import.*from.*date-fns['\"]" frontend-next/app --include="*.tsx" | head -10

# Check for barrel imports (slow)
echo ""
echo "--- Barrel imports (import from index) ---"
grep -rn "from ['\"]@/components['\"]" frontend-next/app --include="*.tsx" | head -10
grep -rn "from ['\"]@/lib['\"]" frontend-next/app --include="*.tsx" | head -10
```

---

#### PART B: Backend Performance

##### B1. N+1 Query Detection

```bash
cd backend && bin/rails runner "
puts '=== N+1 Query Risk Analysis ==='
puts ''

# Check controllers for includes/preload usage
controllers = Dir.glob('app/controllers/**/*.rb')
controllers.each do |file|
  content = File.read(file)

  # Find .all or .where without includes
  if content.match?(/\\.all(?!.*includes)/) || content.match?(/\\.where(?!.*includes)/)
    has_includes = content.include?('.includes(') || content.include?('.preload(')
    has_iteration = content.include?('.each') || content.include?('.map')

    if has_iteration && !has_includes
      puts \"⚠️  #{file}\"
      puts '   Has iteration without eager loading - potential N+1'
    end
  end
end

puts ''
puts '=== The 5 Main Tables - Eager Loading Check ==='
# The 5 core tables: Jobs, Contacts, Pricebook, Price Histories, Corporate
%w[jobs contacts pricebook_items price_histories corporate_companies].each do |resource|
  controller = \"app/controllers/api/v1/#{resource}_controller.rb\"
  if File.exist?(controller)
    content = File.read(controller)
    has_includes = content.include?('.includes(')
    puts \"#{resource}: #{has_includes ? '✅ Has includes' : '⚠️  No includes found'}\"
  else
    puts \"#{resource}: ⚠️  Controller not found\"
  end
end
"
```

##### B2. Missing Database Indexes

```bash
cd backend && bin/rails runner "
puts '=== Missing Index Analysis ==='
puts ''

# Check for foreign keys without indexes
ActiveRecord::Base.connection.tables.each do |table|
  next if %w[schema_migrations ar_internal_metadata].include?(table)

  columns = ActiveRecord::Base.connection.columns(table)
  indexes = ActiveRecord::Base.connection.indexes(table).map(&:columns).flatten

  fk_columns = columns.select { |c| c.name.end_with?('_id') }
  missing = fk_columns.reject { |c| indexes.include?(c.name) }

  if missing.any?
    puts \"#{table}:\"
    missing.each { |c| puts \"  ⚠️  #{c.name} - no index\" }
  end
end
"
```

##### B3. API Response Size Analysis

```bash
cd backend && bin/rails runner "
puts '=== API Payload Size Analysis ==='
puts ''
puts 'The 5 Main Tables - checking payload sizes...'
puts ''

# The 5 core tables with their max column limits
models = {
  'Job' => { max_list: 15, max_detail: 50 },
  'Contact' => { max_list: 12, max_detail: 40 },
  'PricebookItem' => { max_list: 12, max_detail: 35 },
  'PriceHistory' => { max_list: 10, max_detail: 25 },
  'CorporateCompany' => { max_list: 12, max_detail: 30 }
}

models.each do |model_name, limits|
  klass = model_name.constantize rescue nil
  next unless klass

  record = klass.first
  next unless record

  cols = record.as_json.keys
  col_count = cols.count

  # Estimate payload size (rough: 50 bytes per column average)
  estimated_bytes = col_count * 50

  status = col_count > limits[:max_list] ? '⚠️  BLOATED for list view' : '✅'

  puts \"#{model_name}:\"
  puts \"  Columns: #{col_count} (list max: #{limits[:max_list]}, detail max: #{limits[:max_detail]})\"
  puts \"  Est. size per record: ~#{estimated_bytes} bytes\"
  puts \"  Status: #{status}\"

  if col_count > limits[:max_list]
    puts \"  Columns returned: #{cols.sort.join(', ')}\"
  end
  puts ''
end
"
```

##### B4. Slow Query Log Check

```bash
# Check for slow queries in recent logs
echo "=== Recent Slow Queries (>100ms) ==="
if [ -f "backend/log/development.log" ]; then
  grep -E "([0-9]{3,}ms)" backend/log/development.log | tail -20
else
  echo "No development log found"
fi
```

---

#### PART C: Network Performance

##### C1. API Call Count Per Page

```bash
echo "=== API Calls Per Page ==="

# For each major page, count distinct API endpoints called
for page in frontend-next/app/\(app\)/*/page.tsx; do
  if [ -f "$page" ]; then
    name=$(dirname $page | xargs basename)
    api_calls=$(grep -oE "api\.(get|post|put|delete|patch)\(['\"][^'\"]+['\"]" $page 2>/dev/null | sort -u | wc -l | tr -d ' ')
    fetch_calls=$(grep -oE "fetch\(['\"][^'\"]+['\"]" $page 2>/dev/null | sort -u | wc -l | tr -d ' ')
    total=$((api_calls + fetch_calls))

    status="✅"
    if [ "$total" -gt 5 ]; then
      status="⚠️  HIGH"
    elif [ "$total" -gt 3 ]; then
      status="🟡 MEDIUM"
    fi

    echo "$name: $total API calls $status"
  fi
done
```

##### C2. Foundation API Optimization Check

```bash
echo "=== Foundation API Optimization ==="
echo ""

# Check that eager loading is being used (SSoT approach)
echo "--- Backend: Auto eager loading check ---"
grep -rn "apply_eager_loading\|reflect_on_all_associations" backend/app/controllers --include="*.rb" | head -5

echo ""
echo "--- Foundation API usage ---"
grep -rn "useFoundationBySlug\|/api/v1/foundations" frontend-next/app --include="*.tsx" | head -10
```

##### C3. Caching Analysis

```bash
echo "=== Caching Patterns ==="

# Check for React Query / SWR usage
echo "--- Data fetching library usage ---"
grep -rn "useQuery\|useSWR\|useInfiniteQuery" frontend-next/app --include="*.tsx" | wc -l | xargs echo "Query hooks found:"

# Check for manual caching
echo ""
echo "--- Manual cache patterns ---"
grep -rn "useRef.*cache\|localStorage\|sessionStorage" frontend-next/app --include="*.tsx" | head -10
```

---

#### PART D: Real Performance Measurements

##### D1. API Response Time Test

```bash
echo "=== API Response Times (Local) ==="

# Test key endpoints (requires local server running)
ENDPOINTS=(
  "/api/v1/jobs"
  "/api/v1/contacts"
  "/api/v1/purchase_orders"
  "/api/v1/corporate_companies"
)

for endpoint in "${ENDPOINTS[@]}"; do
  echo -n "$endpoint: "
  time_ms=$(curl -s -o /dev/null -w "%{time_total}" "http://localhost:3001$endpoint" 2>/dev/null | awk '{printf "%.0f", $1 * 1000}')

  if [ -n "$time_ms" ]; then
    if [ "$time_ms" -gt 1000 ]; then
      echo "${time_ms}ms ⚠️  SLOW (>1s)"
    elif [ "$time_ms" -gt 500 ]; then
      echo "${time_ms}ms 🟡 MEDIUM (>500ms)"
    else
      echo "${time_ms}ms ✅"
    fi
  else
    echo "Server not running"
    break
  fi
done
```

##### D2. Payload Size Test

```bash
echo "=== Actual Payload Sizes ==="

for endpoint in "/api/v1/jobs" "/api/v1/contacts" "/api/v1/purchase_orders"; do
  echo -n "$endpoint: "
  size=$(curl -s "http://localhost:3001$endpoint" 2>/dev/null | wc -c | tr -d ' ')

  if [ -n "$size" ] && [ "$size" -gt 0 ]; then
    size_kb=$((size / 1024))
    if [ "$size_kb" -gt 100 ]; then
      echo "${size_kb}KB ⚠️  LARGE (>100KB)"
    elif [ "$size_kb" -gt 50 ]; then
      echo "${size_kb}KB 🟡 MEDIUM (>50KB)"
    else
      echo "${size_kb}KB ✅"
    fi
  else
    echo "Server not running"
    break
  fi
done
```

---

#### PERFORMANCE AUDIT SUMMARY

After running all checks, provide:

```
╔════════════════════════════════════════════════════════════════════╗
║              PERFORMANCE AUDIT - MASTERPIECE CHECK                  ║
╠════════════════════════════════════════════════════════════════════╣
║  PART A: Frontend                                                   ║
║    A1. Page Load Analysis:        [X pages reviewed]       [STATUS] ║
║    A2. Modal Lazy Loading:        [X/Y properly lazy]      [STATUS] ║
║    A3. useEffect Dependencies:    [X issues found]         [STATUS] ║
║    A4. Bundle/Import Analysis:    [X heavy imports]        [STATUS] ║
╠════════════════════════════════════════════════════════════════════╣
║  PART B: Backend                                                    ║
║    B1. N+1 Query Risk:            [X controllers flagged]  [STATUS] ║
║    B2. Missing Indexes:           [X missing]              [STATUS] ║
║    B3. API Payload Sizes:         [X bloated endpoints]    [STATUS] ║
║    B4. Slow Queries:              [X found in logs]        [STATUS] ║
╠════════════════════════════════════════════════════════════════════╣
║  PART C: Network                                                    ║
║    C1. API Calls Per Page:        [max X calls]            [STATUS] ║
║    C2. Foundation Optimization:   [fields=minimal usage]   [STATUS] ║
║    C3. Caching Patterns:          [query hooks count]      [STATUS] ║
╠════════════════════════════════════════════════════════════════════╣
║  PART D: Measurements                                               ║
║    D1. API Response Times:        [slowest: Xms]           [STATUS] ║
║    D2. Payload Sizes:             [largest: XKB]           [STATUS] ║
╠════════════════════════════════════════════════════════════════════╣
║  OVERALL: [MASTERPIECE / NEEDS WORK]                                ║
║  Priority Fixes: [List top 3 issues]                                ║
╚════════════════════════════════════════════════════════════════════╝
```

**Masterpiece Criteria (ALL must pass):**
- ✅ Every high-traffic page loads <3 API calls on mount
- ✅ All modals lazy load their data
- ✅ No useEffect hooks with missing/wrong dependencies
- ✅ No N+1 queries in controllers (auto eager loading via SSoT)
- ✅ All foreign keys have indexes
- ✅ Associations auto-derived from model reflections (not manual lists)
- ✅ API response times <500ms
- ✅ Payload sizes <50KB for list views

### Step 8: Code Quality (Bug Patterns, Dead Code, Over-Engineering)

**Quick automated checks from Code Guardian:**

| Pattern | What It Catches |
|---------|-----------------|
| BUG-001 | Empty array assignment (data loss) |
| BUG-002 | useEffect without deps (infinite loops) |
| BUG-003 | setState in useEffect (cascading renders) |
| DEAD-001 | Commented-out code blocks |
| DEAD-002 | Unused imports |
| OVER-001 | God objects (files > 500 lines) |

```bash
# BUG-001: Empty array assignment (data loss risk)
grep -rn "= \[\]" frontend-next/app --include="*.tsx" | grep -v "useState\|const.*=.*\[\].*||" | head -5

# BUG-002: useEffect with empty function body or missing return
grep -rn "useEffect.*=>" frontend-next/app --include="*.tsx" | grep -v "cleanup\|return" | head -5

# DEAD-001: Large commented blocks (3+ consecutive // lines)
grep -rn "^[[:space:]]*//.*$" frontend-next/app --include="*.tsx" -A2 | grep -E "^[^:]+:[0-9]+-[[:space:]]*//|^--$" | head -10

# OVER-001: God objects (files > 500 lines)
find frontend-next/app -name "*.tsx" -exec wc -l {} \; | awk '$1 > 500 {print $1, $2}' | sort -rn | head -5
find backend/app -name "*.rb" -exec wc -l {} \; | awk '$1 > 500 {print $1, $2}' | sort -rn | head -5
```

**Expected:** No data-loss patterns, no god objects over 500 lines

## Report Format

```
════════════════════════════════════════
     TEEEM CODE REVIEW
     [Brisbane Time]
════════════════════════════════════════

1. SSoT Violations:     [PASS/X issues]
2. Sync Risk Patterns:  [PASS/X issues]  ← NEW: Catches manual lists
3. Standard Components: [PASS/X issues]
4. Gold Standard:       [PASS/X issues]
5. Model Auditor:       [PASS/X issues]
6. Security:            [PASS/X issues]
7. Performance:         [PASS/X issues]
8. Code Quality:        [PASS/X issues]

────────────────────────────────────────
Total: X issues to fix
════════════════════════════════════════

[DETAILS IF ISSUES FOUND]
```

## Quick Options

| Command | Scope | Time |
|---------|-------|------|
| `/t` | Full review (all 8 checks) | ~10-15 min |
| `/t ssot` | SSoT violations only | ~10 sec |
| `/t sync` | **Sync Risk Patterns** - catches manual lists that should be auto-derived | ~15 sec |
| `/t ui` | Standard components only | ~10 sec |
| `/t gold` | Gold Standard only | ~10 sec |
| `/t model` | Model Auditor only | ~15 sec |
| `/t sec` | Security only | ~10 sec |
| `/t perf` | **Performance Masterpiece Audit** (4 parts, 13 checks) | ~5-10 min |
| `/t code` | Code Quality only (bug patterns, dead code) | ~30 sec |
| `/t deep` | **Code Guardian** - Deep dive with manual review | ~20-30 min |

### `/t deep` - Code Guardian (Ultrathink Mode)

When you want to ensure code is **masterpiece quality**, run `/t deep`. This spawns the Code Guardian agent which does a thorough 8-point audit:

| # | Check | What It Catches |
|---|-------|-----------------|
| 1 | SSoT Violations | Duplicates, multiple ways to do same thing |
| 2 | Standard Components | Wrong component usage per CLAUDE.md |
| 3 | Clean Architecture | SOLID principles, god objects, circular deps |
| 4 | Bug Patterns | Empty arrays, race conditions, infinite loops |
| 5 | Over-Engineering | Features not requested, premature abstractions |
| 6 | Dead Code | Unused vars, commented code, backwards-compat hacks |
| 7 | Performance | N+1 queries, unnecessary fetches |
| 8 | Security | OWASP top 10 vulnerabilities |

**When to use `/t deep`:**
- Before major releases
- After large features land
- Weekly codebase health check
- When something "feels" messy

## Philosophy

This command embodies the Ultrathink principle: **"Simplify ruthlessly."**

**Standard mode (`/t`)** - 8 checks that matter:
1. SSoT violations break the codebase philosophy
2. Sync risk patterns create future bugs (manual lists that should be auto-derived)
3. Wrong components create maintenance debt
4. Invalid column types break the data model
5. Missing model methods cause runtime crashes
6. Security issues risk the business
7. Performance anti-patterns slow users down
8. Code quality catches bugs before production

**Deep mode (`/t deep`)** - Full Code Guardian:
- When you need to verify code is a **masterpiece**
- Manual review of architecture and patterns
- "Elegance is achieved not when there's nothing left to add, but when there's nothing left to take away"
