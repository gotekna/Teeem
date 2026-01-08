# /t - Code Review

**Shortcut:** `/t`

A focused code review aligned with CLAUDE.md philosophy. 6 essential checks that catch what matters.

## What This Checks (6 Core Categories)

| # | Category | Why It Matters |
|---|----------|----------------|
| 1 | **SSoT & Sync Risk** | Find duplicates and manual lists that will drift |
| 2 | **Standard Components** | THE ONE component per CLAUDE.md |
| 3 | **TeeemTableView Pattern** | Foundation SSoT, no columns prop, proper layout |
| 4 | **Gold Standard** | 34 valid column types, searchable not NULL |
| 5 | **Security** | Brakeman scan |
| 6 | **Code Quality** | Bug patterns, dead code |

## Automated Protection

**Weekly Compliance Job:** `GoldStandardComplianceCheckJob` runs every Monday at 6am Brisbane time:
- Audits all columns match current type definition versions
- Checks compliance score across all foundations
- Alerts if score drops below 95%

## Execution

### Step 1: SSoT & Sync Risk

**Find duplicates and manual lists that should be auto-derived.**

```bash
echo "=== SSoT & SYNC RISK CHECK ==="

# Duplicate constant definitions
echo "--- Duplicate constants ---"
grep -rn "COLUMN_TYPE" backend/app --include="*.rb" | grep -v "COLUMN_TYPE_MAP\|COLUMN_SQL_TYPE" | head -5

# Duplicate route definitions
echo ""
echo "--- Duplicate routes ---"
grep -rn "resources :" backend/config/routes.rb | sort | uniq -d

# Manual model lists (should use reflection)
echo ""
echo "--- Manual model lists (should use reflection) ---"
grep -rn "case.*model\\.name\|when.*\"Job\"\|when.*\"Contact\"" backend/app --include="*.rb" | grep -v "#" | head -5

# Hardcoded arrays that duplicate schema
echo ""
echo "--- Hardcoded model arrays (should query schema) ---"
grep -rn "%w\[.*Job.*Contact\|%w\[.*jobs.*contacts" backend/app --include="*.rb" | head -5

# Missing system columns
echo ""
echo "--- Foundations missing system columns ---"
cd backend && bin/rails runner "
  missing = Foundation.find_each.select { |f|
    existing = f.columns.where(column_name: %w[id created_at updated_at]).pluck(:column_name)
    (%w[id created_at updated_at] - existing).any?
  }
  if missing.any?
    puts \"❌ FOUND: #{missing.count} foundations missing system columns\"
    missing.first(5).each { |f| puts \"  - #{f.name} (ID: #{f.id})\" }
  else
    puts '✅ All foundations have system columns'
  end
" 2>/dev/null || echo "(Backend check skipped)"
```

**Expected:** Zero duplicates, zero manual lists

### Step 2: Standard Components

**Check files use THE ONE component per CLAUDE.md:**

```bash
echo "=== STANDARD COMPONENTS CHECK ==="

# Deprecated component imports
echo "--- Deprecated components ---"
grep -rn "from.*data-table" frontend-next/app --include="*.tsx" | head -3
grep -rn "from.*combobox['\"]" frontend-next/app --include="*.tsx" | grep -v "combobox-dropdown" | head -3
grep -rn "from.*loader" frontend-next/app --include="*.tsx" | head -3
grep -rn "from.*drawer" frontend-next/app --include="*.tsx" | head -3
grep -rn "from.*collapsible" frontend-next/app --include="*.tsx" | head -3

echo ""
if [ $(grep -rn "from.*data-table\|from.*loader\|from.*drawer" frontend-next/app --include="*.tsx" 2>/dev/null | wc -l) -eq 0 ]; then
  echo "✅ All using THE ONE components"
else
  echo "❌ Found deprecated component usage"
fi
```

**THE ONE Table:**
| Need | THE ONE | Never Use |
|------|---------|-----------|
| Data Table | `TeeemTableView` | `data-table.tsx` |
| Searchable Select | `ComboboxDropdown` | `combobox.tsx` |
| Loading | `Spinner` | `loader.tsx` |
| Side Panel | `Sheet` | `drawer.tsx` |
| Collapsible | `Accordion` | `collapsible.tsx` |

### Step 3: TeeemTableView Pattern

**CRITICAL: Foundation API is THE ONE source for columns.**

```bash
echo "=== TEEEMTABLEVIEW PATTERN CHECK ==="

# SSoT VIOLATION: columns prop with foundationIdNumeric
echo "--- SSoT VIOLATION: columns prop with foundationIdNumeric ---"
violations=0
for file in $(grep -rl "TeeemTableView" frontend-next/app --include="*.tsx" 2>/dev/null); do
  if grep -q "foundationIdNumeric" "$file" && grep -q "columns=" "$file"; then
    echo "  ❌ $file"
    violations=$((violations + 1))
  fi
done
[ $violations -eq 0 ] && echo "  ✅ No SSoT violations"

# Hardcoded column arrays (likely dead code)
echo ""
echo "--- Hardcoded column arrays (dead code?) ---"
grep -rn "const.*_COLUMNS.*=.*\[" frontend-next/app --include="*.tsx" | head -5

# Duplicate headers (<h1> + TeeemTableView)
echo ""
echo "--- Duplicate headers ---"
for file in $(grep -rl "TeeemTableView" frontend-next/app --include="*.tsx" 2>/dev/null); do
  if grep -q "<h1" "$file"; then
    echo "  ⚠️  $file - has both <h1> AND TeeemTableView"
  fi
done

# Missing -mx-4 (edge-to-edge layout)
echo ""
echo "--- Missing -mx-4 layout ---"
for file in $(grep -rl "TeeemTableView" frontend-next/app --include="*.tsx" 2>/dev/null); do
  if ! grep -q "\-mx-4" "$file"; then
    echo "  ⚠️  $file"
  fi
done | head -5

# Dark mode variants
echo ""
echo "--- Missing dark: variants ---"
grep -rn "className=" frontend-next/app --include="*.tsx" | grep -E "bg-white|bg-gray-100" | grep -v "dark:" | head -5

# TabsContent scroll classes
echo ""
echo "--- TabsContent missing scroll classes ---"
grep -rn "<TabsContent" frontend-next/app --include="*.tsx" | grep -v "overflow-auto\|min-h-0" | head -5
```

**Expected:**
- Zero pages with `columns` prop when `foundationIdNumeric` is set
- Zero hardcoded `*_COLUMNS` arrays in page files
- Zero pages with both `<h1>` AND `TeeemTableView`
- All table pages have `-mx-4` for edge-to-edge layout

### Step 4: Gold Standard Column Types

**Validate column types and searchable values:**

```bash
echo "=== GOLD STANDARD CHECK ==="

cd backend && bin/rails runner "
# Check invalid column types
valid_types = Column::COLUMN_TYPE_MAP.keys
invalid = Column.where.not(column_type: valid_types)
if invalid.any?
  puts '❌ Invalid column types:'
  invalid.group(:column_type).count.each { |t, c| puts \"  #{t}: #{c} columns\" }
else
  puts '✅ All columns use valid types'
end

# Check for NULL searchable (SSoT violation)
null_searchable = Column.where(searchable: nil).count
if null_searchable > 0
  puts \"❌ #{null_searchable} columns have NULL searchable (should be true/false)\"
else
  puts '✅ All columns have searchable set'
end
" 2>/dev/null || echo "(Backend check skipped)"
```

### Step 5: Security Scan

```bash
echo "=== SECURITY SCAN ==="
cd backend && bundle exec brakeman -q --no-pager -w2 2>/dev/null | head -20 || echo "Brakeman not available"
```

### Step 6: Code Quality

**Bug patterns and dead code:**

```bash
echo "=== CODE QUALITY CHECK ==="

# BUG-001: Empty array assignment (data loss risk)
echo "--- Data loss patterns ---"
grep -rn "= \[\]" frontend-next/app --include="*.tsx" | grep -v "useState\|const.*=.*\[\].*||" | head -3

# BUG-002: useEffect without deps
echo ""
echo "--- useEffect missing deps array ---"
grep -rn "useEffect.*=>" frontend-next/app --include="*.tsx" | grep -v "\[" | head -3

# DEAD-001: God objects (files > 500 lines)
echo ""
echo "--- Large files (>500 lines) ---"
find frontend-next/app -name "*.tsx" -exec wc -l {} \; 2>/dev/null | awk '$1 > 500 {print $1, $2}' | sort -rn | head -3
find backend/app -name "*.rb" -exec wc -l {} \; 2>/dev/null | awk '$1 > 500 {print $1, $2}' | sort -rn | head -3
```

## Report Format

```
════════════════════════════════════════
     TEEEM CODE REVIEW
     [Brisbane Time]
════════════════════════════════════════

1. SSoT & Sync Risk:     [PASS/X issues]
2. Standard Components:  [PASS/X issues]
3. TeeemTableView:       [PASS/X issues]
4. Gold Standard:        [PASS/X issues]
5. Security:             [PASS/X issues]
6. Code Quality:         [PASS/X issues]

────────────────────────────────────────
Total: X issues to fix
════════════════════════════════════════

[DETAILS IF ISSUES FOUND]
```

## Quick Options

| Command | Scope | Time |
|---------|-------|------|
| `/t` | Full review (6 checks) | ~2-3 min |
| `/t ssot` | SSoT & Sync Risk only | ~15 sec |
| `/t comp` | Standard components only | ~10 sec |
| `/t ttv` | TeeemTableView pattern only | ~15 sec |
| `/t gold` | Gold Standard column types | ~10 sec |
| `/t sec` | Security only | ~10 sec |
| `/t code` | Code quality only | ~15 sec |
| `/t perf` | **Performance Audit** (optional, detailed) | ~5-10 min |
| `/t speed` | **Speed Test** - Live browser timing via Chrome DevTools | ~3 min |
| `/t deep` | **Code Guardian** - Full agent review | ~20 min |
| `/t refactor` | **TTV Refactor** - Continue TeeemTableView refactoring | ~10-30 min |

## Optional: Performance Audit (`/t perf`)

**Only run when investigating performance issues.** This is comprehensive:

### Frontend Performance
- Page load analysis (5 main tables)
- Modal lazy loading audit
- useEffect dependency check
- Bundle/import analysis

### Backend Performance
```bash
# N+1 detection
cd backend && bin/rails runner "
  controllers = Dir.glob('app/controllers/**/*.rb')
  controllers.each do |file|
    content = File.read(file)
    has_iteration = content.include?('.each') || content.include?('.map')
    has_includes = content.include?('.includes(') || content.include?('.preload(')
    if has_iteration && !has_includes && content.match?(/\\.all|\\.where/)
      puts \"⚠️  #{file} - Potential N+1\"
    end
  end
"

# Missing indexes
cd backend && bin/rails runner "
  ActiveRecord::Base.connection.tables.each do |table|
    next if %w[schema_migrations ar_internal_metadata].include?(table)
    columns = ActiveRecord::Base.connection.columns(table)
    indexes = ActiveRecord::Base.connection.indexes(table).map(&:columns).flatten
    fk_columns = columns.select { |c| c.name.end_with?('_id') }
    missing = fk_columns.reject { |c| indexes.include?(c.name) }
    missing.each { |c| puts \"#{table}.#{c.name} - no index\" } if missing.any?
  end
"
```

### Network Performance
- API calls per page (target: <3 on mount)
- Payload sizes (target: <50KB for list views)
- Response times (target: <500ms)

### Live Measurements
```bash
# Test local API response times
for endpoint in "/api/v1/jobs" "/api/v1/contacts" "/api/v1/purchase_orders"; do
  echo -n "$endpoint: "
  time_ms=$(curl -s -o /dev/null -w "%{time_total}" "http://localhost:3001$endpoint" 2>/dev/null | awk '{printf "%.0f", $1 * 1000}')
  [ -n "$time_ms" ] && echo "${time_ms}ms" || echo "Server not running"
done
```

## Optional: Speed Test (`/t speed`)

**Spawns Performance Auditor agent for live browser testing.**

Requires Chrome DevTools (`/c` first). Tests:
1. Jobs, Contacts, Pricebook page loads
2. Heaviest job detail page
3. Schedule Master, Finance

Measures from server-timing header:
- `x-runtime` (API time)
- `sql.active_record` (SQL time)
- `content-length` (payload size)

Thresholds:
- ✅ FAST: API <250ms, SQL <50ms, Payload <100KB
- 🟡 MEDIUM: API 250-500ms, SQL 50-100ms, Payload 100-500KB
- ❌ SLOW: API >500ms, SQL >100ms, Payload >500KB

## Optional: TTV Refactor (`/t refactor`)

**Spawns TTV Refactor agent to continue TeeemTableView refactoring.**

Current Status (as of 2025-12-29):
- TeeemTableView.tsx: 5,211 lines (target: <4,500 for Milestone 4)
- 711 lines remaining to hit milestone

**What the agent does:**
1. Reviews current extraction status
2. Identifies next high-value extraction opportunity
3. Extracts pure utility functions to `table-data-utils.ts` or similar
4. Updates TeeemTableView.tsx to use extracted utilities
5. Runs TypeScript check to ensure no errors

**Extraction priorities:**
| Priority | Target | Lines | Value |
|----------|--------|-------|-------|
| 1 | Cell editing logic | ~200 | High |
| 2 | Keyboard navigation | ~150 | Medium |
| 3 | Selection logic | ~100 | Medium |
| 4 | Render functions | ~300 | Low (coupled) |

**When to use:**
- Dedicated refactoring sessions
- After completing a feature in TeeemTableView
- When line count has crept back up

## Optional: Code Guardian (`/t deep`)

**Spawns Code Guardian agent for thorough 8-point audit:**

| # | Check | What It Catches |
|---|-------|-----------------|
| 1 | SSoT Violations | Duplicates across codebase |
| 2 | Standard Components | Wrong component usage |
| 3 | Clean Architecture | SOLID principles, god objects |
| 4 | Bug Patterns | Empty arrays, race conditions |
| 5 | Over-Engineering | Features not requested |
| 6 | Dead Code | Unused vars, commented code |
| 7 | Performance | N+1 queries, unnecessary fetches |
| 8 | Security | OWASP top 10 |

**When to use:**
- Before major releases
- After large features land
- Weekly codebase health check

## Philosophy

This command embodies **"Simplify ruthlessly."**

**6 quick checks that catch 90% of issues:**
1. SSoT violations break the architecture
2. Wrong components create debt
3. TeeemTableView pattern ensures UX consistency
4. Invalid column types break data
5. Security issues risk the business
6. Code quality catches bugs early

**Performance and deep analysis are OPTIONAL** - run when needed, not every review.

## Keyword Triggers

If user types these keywords, Claude should immediately respond:

| Keyword | Meaning | Action |
|---------|---------|--------|
| `ssot` | Duplicate found | Search for both locations, ask which is SSoT |
| `ultra` | Lazy solution | Present 3 approaches, pick simplest |
| `gold` | Wrong component | Check CLAUDE.md component table |
| `slow` | Wasting tokens | Stop reading logs, use Sentry |
