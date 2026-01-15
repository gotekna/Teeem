# /t - Code Review

**Shortcut:** `/t`

A focused code review aligned with CLAUDE.md philosophy. 7 essential checks that catch what matters.

## 🔴 FRC-First: Find Root Cause Before Fixing

**When /t finds issues, DON'T just fix the symptom. Ask WHY it exists.**

### The FRC Process for Each Issue

1. **STOP** - Don't immediately fix the violation
2. **ASK WHY** - Why does this violation exist?
   - Is there a missing guardrail (lint rule, type, CI check)?
   - Did the dev not know the pattern?
   - Is the SSoT documented but not discoverable?
3. **FIX THE GAP** - Add prevention, not just correction
   - Add lint rule? Update CLAUDE.md? Add CI check?
4. **THEN FIX** - Now fix all instances

### Example: Color Violation Found

```
❌ BANDAID: Just replace text-[#878787] with text-muted-foreground
✅ FRC:
   Why? → Dev didn't know the mapping
   Gap? → No reference table in CLAUDE.md
   Fix? → Add color mapping table to /t command AND CLAUDE.md
   Then? → Fix all 44 instances
```

### Example: TeeemTableView columns prop

```
❌ BANDAID: Just remove columns prop
✅ FRC:
   Why? → Dev copied from old pattern
   Gap? → No lint rule for columns+foundationId combo
   Fix? → Consider adding ESLint rule
   Then? → Fix all violations
```

---

## What This Checks (7 Core Categories)

| # | Category | Why It Matters |
|---|----------|----------------|
| 1 | **SSoT & Sync Risk** | Find duplicates and manual lists that will drift |
| 2 | **Standard Components** | THE ONE component per CLAUDE.md |
| 3 | **Color SSoT** | No hardcoded colors - use CSS variables |
| 4 | **TeeemTableView Pattern** | Foundation SSoT, no columns prop, proper layout |
| 5 | **Gold Standard** | 34 valid column types, searchable not NULL |
| 6 | **Security** | Brakeman scan |
| 7 | **Code Quality** | Bug patterns, dead code |

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

# Dead column type strings (types that don't exist in the database)
# Note: 'choice' alone is OK (only valid choice type), 'lookup' alone may be intentional
echo ""
echo "--- Dead column type strings (use constants or remove) ---"
echo "Backend (relation, single_select, multi_select, dropdown):"
backend_dead=$(grep -rn "'relation'\|'single_select'\|'multi_select'\|'dropdown'" backend/app --include="*.rb" 2>/dev/null | grep -v "COLUMN_TYPE\|#" | wc -l | tr -d ' ')
echo "  Found: $backend_dead instances"
[ "$backend_dead" -gt 0 ] && grep -rn "'relation'\|'single_select'\|'multi_select'\|'dropdown'" backend/app --include="*.rb" 2>/dev/null | grep -v "COLUMN_TYPE\|#" | head -3

echo "Frontend (relation, single_select, multi_select, dropdown):"
frontend_dead=$(grep -rn "'relation'\|'single_select'\|'multi_select'\|'dropdown'" frontend-next/components frontend-next/app --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "column-types.ts\|//" | wc -l | tr -d ' ')
echo "  Found: $frontend_dead instances"
[ "$frontend_dead" -gt 0 ] && grep -rn "'relation'\|'single_select'\|'multi_select'" frontend-next/components frontend-next/app --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "column-types.ts" | head -3

total_dead=$((backend_dead + frontend_dead))
if [ "$total_dead" -eq 0 ]; then
  echo "✅ No dead column type strings"
else
  echo "❌ Found $total_dead dead column type strings (these types don't exist)"
  echo "   Remove or use: isLookupColumn() / isChoiceColumn() helpers"
fi

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

### Step 3: Color SSoT Check

**Colors must use CSS variables, not hardcoded values.**

```bash
echo "=== COLOR SSoT CHECK ==="

# Hardcoded hex colors (should use CSS variables)
# EXCLUDE: BrandGuidelinesTab.tsx and brand-guidelines (they show color swatches as examples)
echo "--- Hardcoded hex colors (use var(--*) instead) ---"
hex_count=$(grep -rn "bg-\[#\|text-\[#\|border-\[#" frontend-next/components frontend-next/app --include="*.tsx" 2>/dev/null | grep -v "BrandGuidelines\|brand-guidelines" | wc -l | tr -d ' ')
echo "Found: $hex_count instances"
[ "$hex_count" -gt 0 ] && grep -rn "bg-\[#\|text-\[#\|border-\[#" frontend-next/components frontend-next/app --include="*.tsx" 2>/dev/null | grep -v "BrandGuidelines\|brand-guidelines" | head -5

# Hardcoded Tailwind colors (should use semantic tokens)
echo ""
echo "--- Hardcoded Tailwind colors (use primary/secondary/muted) ---"
tailwind_count=$(grep -rn "bg-gray-\|text-gray-\|bg-zinc-\|text-zinc-\|bg-slate-\|text-slate-" frontend-next/components frontend-next/app --include="*.tsx" 2>/dev/null | grep -v "dark:" | wc -l | tr -d ' ')
echo "Found: $tailwind_count instances (excluding dark: variants)"
[ "$tailwind_count" -gt 0 ] && grep -rn "bg-gray-\|text-gray-\|bg-zinc-\|text-zinc-" frontend-next/components frontend-next/app --include="*.tsx" 2>/dev/null | grep -v "dark:" | head -5

# Inline style colors
echo ""
echo "--- Inline style colors ---"
inline_count=$(grep -rn "style={{.*color:\|style={{.*background" frontend-next/components frontend-next/app --include="*.tsx" 2>/dev/null | grep -v "hsl(var\|var(--" | wc -l | tr -d ' ')
echo "Found: $inline_count instances (excluding CSS variable usage)"
[ "$inline_count" -gt 0 ] && grep -rn "style={{.*color:\|style={{.*background" frontend-next/components frontend-next/app --include="*.tsx" 2>/dev/null | grep -v "hsl(var\|var(--" | head -5

echo ""
total=$((hex_count + tailwind_count + inline_count))
if [ "$total" -eq 0 ]; then
  echo "✅ All colors use CSS variables"
else
  echo "❌ Found $total color SSoT violations"
fi
```

**Expected:** Zero hardcoded colors. All colors should come from:
- CSS variables (`var(--primary)`, `hsl(var(--muted))`)
- Tailwind semantic tokens (`bg-primary`, `text-muted-foreground`)
- Company brand colors (set in Admin → Company → Brand Colors)

### Color Mapping Reference (SSoT)

When fixing color violations, use these mappings:

| Hardcoded | Semantic Class | Notes |
|-----------|---------------|-------|
| `text-[#878787]` | `text-muted-foreground` | Labels, muted text |
| `text-[#606060]` | `text-text-secondary` | Descriptions, secondary text |
| `bg-[#F2F1EF]` | `bg-secondary` | Light mode background |
| `dark:bg-[#1D1D1D]` | (remove - auto) | `bg-secondary` handles dark mode |
| `hover:bg-[#F2F1EF] dark:hover:bg-[#1D1D1D]` | `hover:bg-secondary` | Hover states (auto dark) |
| `text-gray-*` / `text-zinc-*` | `text-muted-foreground` | Use semantic tokens |
| `bg-gray-*` / `bg-zinc-*` | `bg-muted` or `bg-secondary` | Use semantic tokens |

**Key insight:** Using semantic classes like `bg-secondary` automatically handles dark mode - no need for separate `dark:` variants.

### Step 4: TeeemTableView Pattern

**CRITICAL: Foundation API is THE ONE source for columns.**

```bash
echo "=== TEEEMTABLEVIEW PATTERN CHECK ==="

# SSoT VIOLATION: columns prop directly on TeeemTableView with foundationIdNumeric
# EXCLUDE: GoldStandardTab.tsx (it's the demo/reference for TeeemTableView)
# NOTE: columns= passed to OTHER components (SchemaTab, CreateRecordDialog) is OK
echo "--- SSoT VIOLATION: TeeemTableView with columns + foundationIdNumeric ---"
violations=0
for file in $(grep -rl "TeeemTableView" frontend-next/app --include="*.tsx" 2>/dev/null); do
  # Skip demo/documentation files
  if [[ "$file" == *"GoldStandardTab"* ]] || [[ "$file" == *"design-system"* ]]; then
    continue
  fi
  # Check for columns prop DIRECTLY on TeeemTableView (not other components)
  if grep -q "foundationIdNumeric" "$file" && grep -E "TeeemTableView.*columns=|columns=.*TeeemTableView" "$file" > /dev/null 2>&1; then
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

### Step 5: Gold Standard Column Types

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

### Step 6: Security Scan

```bash
echo "=== SECURITY SCAN ==="
cd backend && bundle exec brakeman -q --no-pager -w2 2>/dev/null | head -20 || echo "Brakeman not available"
```

### Step 7: Code Quality

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
3. Color SSoT:           [PASS/X issues]
4. TeeemTableView:       [PASS/X issues]
5. Gold Standard:        [PASS/X issues]
6. Security:             [PASS/X issues]
7. Code Quality:         [PASS/X issues]

────────────────────────────────────────
Total: X issues to fix
════════════════════════════════════════

[DETAILS IF ISSUES FOUND]
```

## Quick Options

| Command | Scope | Time |
|---------|-------|------|
| `/t` | Full review (7 checks) | ~2-3 min |
| `/t ssot` | SSoT & Sync Risk only | ~15 sec |
| `/t comp` | Standard components only | ~10 sec |
| `/t colors` | Color SSoT check only | ~10 sec |
| `/t ttv` | TeeemTableView pattern only | ~15 sec |
| `/t gold` | Gold Standard column types | ~10 sec |
| `/t sec` | Security only | ~10 sec |
| `/t code` | Code quality only | ~15 sec |
| `/t perf` | **Performance Audit** (optional, detailed) | ~5-10 min |
| `/t speed` | **Speed Test** - Live browser timing via Chrome DevTools | ~3 min |
| `/t deep` | **Code Guardian** - Full agent review | ~20 min |
| `/t refactor` | **TTV Refactor** - Continue TeeemTableView refactoring | ~10-30 min |
| `/t tables` | **Table Guardian** - Audit all table implementations | ~10 min |
| `/t dup` | **SSoT Audit** - Backend + Frontend duplicate detection | ~5 min |
| `/t all` | **All Agents** - Run ALL specialized agents comprehensively | ~30-60 min |

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

## Optional: Table Guardian (`/t tables`)

**Spawns Table Guardian agent to audit all table implementations.**

| # | Check | What It Catches |
|---|-------|-----------------|
| 1 | TeeemTableView Standard | Pages not using THE ONE table component |
| 1b | Add Button SSoT | Custom Add buttons instead of `onAddRow` prop |
| 2 | State Coverage | Missing loading/empty/error states |
| 3 | Table Speed | Slow opens (>500ms target) |
| 4 | Performance | Multi-fetch, missing pagination, N+1 |
| 5 | Accessibility | Missing ARIA + keyboard nav |
| 6 | Dark Mode | Theme compliance |

**What the agent does:**
1. Scans all pages using TeeemTableView
2. Checks for SSoT violations (custom columns, duplicate Add buttons)
3. Validates proper layout (`-mx-4`, `h-full`)
4. Checks for deprecated patterns
5. Reports compliance score

**When to use:**
- After adding a new table page
- When table performance issues arise
- Before major UI releases

## Philosophy

This command embodies **"Find Root Cause, then Simplify ruthlessly."**

### FRC-First Mindset

**Every issue found by /t is a gift - it reveals a gap in the system.**

| Issue Type | Bandaid (❌) | FRC Fix (✅) |
|------------|-------------|--------------|
| Hardcoded color | Replace with class | Add mapping table + lint rule idea |
| Wrong component | Swap component | Update docs, grep for similar |
| SSoT violation | Delete duplicate | Ask why it was created, add guard |
| Security issue | Fix single file | Search for pattern, fix all |

**7 quick checks that catch 90% of issues:**
1. SSoT violations break the architecture
2. Wrong components create debt
3. Hardcoded colors break brand customization
4. TeeemTableView pattern ensures UX consistency
5. Invalid column types break data
6. Security issues risk the business
7. Code quality catches bugs early

**After fixing issues:**
- ✅ All instances fixed (not just the first one)
- ✅ Root cause documented (commit message or CLAUDE.md update)
- ✅ Prevention added if pattern will recur (lint rule, CI check, docs)

**Performance and deep analysis are OPTIONAL** - run when needed, not every review.

## Keyword Triggers

If user types these keywords, Claude should immediately respond:

| Keyword | Meaning | Action |
|---------|---------|--------|
| `ssot` | Duplicate found | Search for both locations, ask which is SSoT |
| `ultra` | Lazy solution | Present 3 approaches, pick simplest |
| `gold` | Wrong component | Check CLAUDE.md component table |
| `frc` | Bandaid fix | STOP, investigate root cause, fix the gap not symptom |
| `slow` | Wasting tokens | Stop reading logs, use Sentry |

## Optional: SSoT Audit (`/t dup`)

**Comprehensive SSoT violation detection across backend and frontend.**

### What It Checks

| # | Check | What It Catches |
|---|-------|-----------------|
| 1 | **Duplicate Columns** | Same column name in multiple tables (like `root_path`) |
| 2 | **Config in Wrong Table** | Storage config in credential tables, etc. |
| 3 | **Hardcoded Constants** | Timezone, email domains, model names hardcoded |
| 4 | **AI Model Duplication** | Services not using `AnthropicClient` concern |
| 5 | **UI Component Duplication** | Lucide loaders, router.back(), custom spinners |
| 6 | **Unregistered Components** | UI components not in component-registry.ts |

### Backend Data Model Checks

```bash
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║           BACKEND SSoT AUDIT                                      ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

# 1. Columns that appear in multiple tables (THE root_path problem)
echo ""
echo "=== DUPLICATE COLUMN PATTERNS ==="
for col in root_path site_id drive_id client_id tenant_id; do
  count=$(grep -c "\"$col\"" backend/db/schema.rb 2>/dev/null || echo 0)
  if [ "$count" -gt 1 ]; then
    echo "⚠️  WARNING: $col appears $count times:"
    grep -n "\"$col\"" backend/db/schema.rb | head -5
  fi
done
echo "(empty = good)"

# 2. Hardcoded timezone (should use CorporateCompanySetting)
echo ""
echo "=== HARDCODED TIMEZONE ==="
grep -rn "Australia/Brisbane" backend/app --include="*.rb" 2>/dev/null | grep -v "CorporateCompanySetting\|#" | head -5
echo "(empty = good)"

# 3. Hardcoded email domains (should use CorporateCompanySetting)
echo ""
echo "=== HARDCODED EMAIL DOMAINS ==="
grep -rn "tekna\.com\.au" backend/app --include="*.rb" 2>/dev/null | grep -v "CorporateCompanySetting\|#\|\.example" | head -5
echo "(empty = good)"

# 4. AI services not using AnthropicClient concern
echo ""
echo "=== AI SERVICES WITHOUT ANTHROPIC_CLIENT ==="
for file in $(grep -rl "Anthropic::Client" backend/app/services --include="*.rb" 2>/dev/null); do
  if ! grep -q "include AnthropicClient" "$file" 2>/dev/null; then
    echo "⚠️  $file - uses Anthropic but doesn't include AnthropicClient"
  fi
done
echo "(empty = good)"

# 5. Deprecated StorageConfiguration patterns
echo ""
echo "=== DEPRECATED STORAGE PATTERNS ==="
grep -rn "credential\.sharepoint_site_id\|credential\.sharepoint_drive_id\|credential\.drive_id" backend/app --include="*.rb" 2>/dev/null | head -5
echo "(empty = good)"
```

### Frontend SSoT Checks

```bash
echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║           FRONTEND SSoT AUDIT                                     ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

# 1. Lucide Loader violations (should use Spinner)
echo ""
echo "=== LUCIDE LOADER VIOLATIONS ==="
grep -rn "Loader.*from.*lucide-react\|from.*lucide-react.*Loader" frontend-next/app frontend-next/components --include="*.tsx" 2>/dev/null | grep -v "spinner.tsx" || echo "✅ None found"

# 2. router.back() violations (should use BackButton)
echo ""
echo "=== ROUTER.BACK() VIOLATIONS ==="
grep -rn "router\.back()" frontend-next/app frontend-next/components --include="*.tsx" 2>/dev/null | grep -v "back-button.tsx" || echo "✅ None found"

# 3. Custom spinner patterns (should use Spinner)
echo ""
echo "=== CUSTOM ANIMATE-SPIN ==="
grep -rn "animate-spin" frontend-next/app frontend-next/components --include="*.tsx" 2>/dev/null | grep -v "spinner.tsx" | head -10 || echo "✅ None found"

# 4. Deprecated imports
echo ""
echo "=== DEPRECATED IMPORTS ==="
grep -rn "from.*@/components/ui/combobox['\"]" frontend-next --include="*.tsx" 2>/dev/null | grep -v "combobox-dropdown" | head -5
grep -rn "from.*@/components/ui/loader" frontend-next --include="*.tsx" 2>/dev/null | head -5
grep -rn "from.*@/components/ui/drawer" frontend-next --include="*.tsx" 2>/dev/null | head -5
echo "(empty = good)"

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║           SSoT AUDIT COMPLETE                                     ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
```

**When to use:**
- Before adding any new database column
- Before adding constants or config values
- After large refactoring sessions
- Weekly as part of code health

## Optional: All Agents (`/t all`)

**Runs ALL code quality agents for comprehensive codebase review.**

This is different from `/all-agents` which focuses on health/status checks. `/t all` focuses specifically on code quality and compliance.

### Agents Spawned (in parallel)

| Agent | What It Does | Focus Area |
|-------|--------------|------------|
| **Code Guardian** | 8-point audit | SSoT violations, architecture, bugs, security |
| **Table Guardian** | Table compliance | TeeemTableView patterns, Add button SSoT |
| **Foundation Validator** | Column type sync | Schema ↔ Foundation metadata (34 types) |
| **Method Auditor** | NoMethodError prevention | Model method validation |
| **Frontend Auditor** | UI compliance | Component standards, dark mode |
| **UI Consistency Scanner** | Visual patterns | Mixed components, spacing, colors |

### Comparison: `/t all` vs `/all-agents`

| Command | Focus | Agents |
|---------|-------|--------|
| `/t all` | **Code Quality** | Code Guardian, Table Guardian, Foundation Validator, Method Auditor, Frontend Auditor, UI Scanner |
| `/all-agents` | **Health/Status** | Backend Dev, Frontend Dev, Bug Hunter, Deploy Manager, Planning, Gantt |

### Execution

This spawns multiple Task agents in parallel. Each produces a focused report, combined into a summary.

**When to use:**
- Before major releases (code quality gate)
- After large features land (compliance check)
- Weekly/monthly codebase health check
- Before deploying critical changes

**What you get:**
- Compliance score per category
- Prioritized issues by severity
- File:line references for each issue
- Specific fix recommendations
