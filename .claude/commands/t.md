# /t - Trinity Comprehensive Code Review

**Shortcut:** `/t` or `review` or `audit`

Performs a full codebase audit across security, SSoT compliance, code quality, and UI/UX standards.

## What This Command Does

The `/t` command runs a comprehensive code review checking 11 categories:

1. **Security Scan** - Brakeman + manual review for vulnerabilities
2. **SSoT Violations** - Duplicate definitions, conflicting sources
3. **UI/UX Compliance** - Chapter 19/20 standards adherence
4. **Code Quality** - Redundant code, bottlenecks, oversized files
5. **Database Schema Health** - Missing indexes, foreign keys
6. **Test Coverage Gaps** - Models/controllers without specs
7. **API Consistency** - Authentication, pagination, response format
8. **Performance Red Flags** - N+1 queries, missing eager loading
9. **Documentation Freshness** - Stale docs, old TODOs
10. **TeeemTableView Compliance** - foundationIdNumeric, Gold Standard column types
11. **Frontend Performance** - Lazy loading, eager fetches, redundant API calls

## Execution Protocol

### Step 1: Run Automated Scans (Parallel)

Execute these commands in parallel to gather initial data:

```bash
# Security scan
cd backend && bundle exec brakeman -q --no-pager 2>/dev/null || echo "Brakeman not available"

# Backend linting
cd backend && bundle exec rubocop --format simple 2>/dev/null || echo "Rubocop not available"

# Frontend linting
cd frontend-next && npm run lint 2>/dev/null || echo "ESLint not available"
```

### Step 2: SSoT Validation

**Foundation Schema Sync Check:**

Check that database schema columns match Foundation metadata (prevents SSoT violations):

```bash
# Check all Foundation tables for sync issues
cd backend && bin/rails foundation:check
```

**Expected Output (GOOD):**
```
✅ All Foundation columns are in sync!
```

**Problem Output:**
```
⚠️ X foundation(s) with column sync issues
  - Y orphaned columns (in DB, not in Foundation metadata)
  - Z missing columns (in Foundation metadata, not in DB)
```

**If issues found:**
- Log as SSoT violation in report
- Recommend: `rails foundation:sync` to auto-fix
- Check if caused by recent migration

**FoundationView Sync Check:**

Check that all FoundationViews are synchronized with their Foundation's columns:

```bash
# Check if any views need syncing (dry run)
cd backend && bin/rails foundation_views:check
```

**Expected Output (GOOD):**
```
✓ All foundations are in sync!
```

**Problem Output:**
```
Found X foundations that need syncing:
  Foundation Name
    Mismatched views: Y/Z
```

**If issues found:**
- Log as SSoT violation in report
- Recommend: `rails foundation_views:sync_all` to auto-fix
- This prevents "can't see all columns in View Manager" bugs
- Auto-sync now prevents this (see Column model callbacks)

**Column Type SSoT Check (31 types):**

1. Read `TEEEM_DOCS/GOLD_STANDARD_TABLE.md` - extract all 31 column types
2. Read `backend/app/models/column.rb` - extract COLUMN_SQL_TYPE_MAP (should have 31 types)
3. Read `frontend-next/lib/column-types.ts` - extract column definitions
4. Compare and flag any mismatches

**Valid Column Types (31 total):**
```
Text (6):         single_line_text, multiple_lines_text, email, phone, mobile, url
Numbers (4):      number, whole_number, currency, percentage
Dates (2):        date, date_and_time
Special (4):      gps_coordinates, color_picker, file_upload, action_buttons
Selection (2):    boolean, choice
Relationships (3):lookup, multiple_lookups, user
Computed (1):     computed
Advanced (3):     structured_data, array_of_items, searchable_text
Australian (6):   abn, acn, bsb, bank_account, postcode, tfn
```

**Duplicate Definition Check:**
- Search for constants defined in multiple files
- Search for same route defined multiple ways
- Search for duplicate environment variable usage

### Step 3: Code Quality Analysis

**Oversized Files (>500 lines):**
```bash
find backend/app -name "*.rb" -exec wc -l {} + | sort -rn | head -20
find frontend-next -name "*.tsx" -exec wc -l {} + | sort -rn | head -20
```

**Pattern Violations:**
Check for known bug patterns from code-guardian.md:
- PATTERN-001: Empty array assignment bugs
- PATTERN-002: Race conditions in async operations
- PATTERN-003: Infinite loop in data fetching
- PATTERN-004: Deprecated component usage
- PATTERN-005: setState in useEffect (cascading renders)

**ESLint Check for PATTERN-005:**
```bash
# Check for react-hooks/set-state-in-effect violations
cd frontend-next && npm run lint 2>&1 | grep "set-state-in-effect"
```

### Step 4: Frontend Performance Audit

**Check for performance anti-patterns using performance-auditor.md rules:**

**PERF-001: Loading ALL Records on Mount**
```bash
# Find pages loading all records on mount
grep -r "useEffect.*\[\]" frontend-next/app --include="*.tsx" -A 10 | grep -E "api\.(get|post).*\/api\/v1\/\w+['\"]"
```

**PERF-002: Missing Lazy Loading for Modals**
```bash
# Find modal/dialog pages without lazy loading
grep -r "Modal\|Dialog\|Popover" frontend-next/app --include="*.tsx" -l | xargs grep -l "useEffect.*\[\]"
```

**PERF-003: Detail Pages Calling "All" Endpoints**
```bash
# Check [id] pages for calls to non-ID endpoints
find frontend-next/app -path "*\[*\]*" -name "*.tsx" | xargs grep -l "api.get.*\/api\/v1\/\w\+['\"])"
```

**PERF-004: Missing Fetch Guards**
```bash
# Find useEffect with modal deps but no guards
grep -r "useEffect.*modalOpen\|dialogOpen\|showDialog" frontend-next/app --include="*.tsx" -A 5 | grep -v "length.*0\|\.current"
```

**High-Priority Pages to Audit:**
- `app/(app)/jobs/[id]/page.tsx`
- `app/(app)/contacts/[id]/page.tsx`
- `app/(app)/corporate/companies/[id]/page.tsx`
- `app/(app)/pricebook/[code]/page.tsx`
- `app/(app)/chat/page.tsx`
- `app/(app)/dashboard/page.tsx`

### Step 5: UI/UX Compliance

**TeeemTableView Check:**
- Find tables with `foundationId` but missing `foundationIdNumeric`
- Tables without `foundationIdNumeric` don't get: Import/Export, Schema Editor, Filters, GlobalViewsManager

```bash
# Find potential violations
grep -r 'foundationId=' frontend-next --include="*.tsx" | grep -v 'foundationIdNumeric'
```

**Column Type Validation:**
- Check all columns in database use one of the 31 valid Gold Standard types
- Flag any columns with invalid/undocumented types:
```bash
# Quick check via Rails runner
cd backend && bin/rails runner "invalid = Column.where.not(column_type: Column::COLUMN_TYPE_MAP.keys); puts invalid.any? ? 'INVALID TYPES FOUND: ' + invalid.pluck(:column_type).uniq.join(', ') : 'All columns valid'"
```

### Step 6: Database Schema Health

```bash
# Check for tables without indexes on foreign keys
cd backend && bin/rails runner "puts 'Checking foreign key indexes...'"

# Check for pending migrations
cd backend && bin/rails db:migrate:status
```

### Step 7: Test Coverage

```bash
# Find models without specs
cd backend && for model in app/models/*.rb; do spec="spec/models/$(basename $model .rb)_spec.rb"; [ ! -f "$spec" ] && echo "Missing: $spec"; done 2>/dev/null

# Find controllers without specs
cd backend && for ctrl in app/controllers/api/v1/*.rb; do spec="spec/requests/api/v1/$(basename $ctrl .rb | sed 's/_controller//')_spec.rb"; [ ! -f "$spec" ] && echo "Missing: $spec"; done 2>/dev/null
```

### Step 8: Generate Report

Compile all findings into standardized format:

```
════════════════════════════════════════════════════════════════
                    TEEEM CODE REVIEW REPORT
                    [Brisbane Time]
════════════════════════════════════════════════════════════════

SUMMARY (11 Categories)
───────────────────────
[PASS/WARN/FAIL] 1. Security:            X issues
[PASS/WARN/FAIL] 2. SSoT:                X issues
[PASS/WARN/FAIL] 3. UI/UX:               X issues
[PASS/WARN/FAIL] 4. Code Quality:        X issues
[PASS/WARN/FAIL] 5. DB Schema:           X issues
[PASS/WARN/FAIL] 6. Test Coverage:       X issues
[PASS/WARN/FAIL] 7. API Consistency:     X issues
[PASS/WARN/FAIL] 8. Backend Performance: X issues
[PASS/WARN/FAIL] 9. Documentation:       X issues
[PASS/WARN/FAIL] 10. TeeemTableView:     X issues
[PASS/WARN/FAIL] 11. Frontend Perf:      X issues (PERF-001 to 005)

Total: X issues (Y critical, Z warnings)

[DETAILED FINDINGS BY CATEGORY...]

PRIORITY FIXES
──────────────
1. [Highest priority item]
2. [Second priority item]
...

════════════════════════════════════════════════════════════════
```

## Arguments (Optional)

| Command | Scope |
|---------|-------|
| `/t` | Full codebase review |
| `/t backend` | Backend only |
| `/t frontend` | Frontend only |
| `/t security` | Security scan only |
| `/t ssot` | SSoT validation only |
| `/t quick` | Summary only, skip details |

## Performance Target

**Full Review:** ~60-90 seconds
- Parallel scans: ~10s
- SSoT validation: ~15s
- Code quality: ~20s
- UI/UX checks: ~15s
- Report generation: ~5s

## Related Agents

This command leverages checks from:
- `foundation-schema-sync.md` - Database ↔ Foundation metadata sync validation
- `foundation-view-sync.md` - FoundationView ↔ Foundation columns sync validation (NEW)
- `gold-standard-sst.md` - Column type SSoT (31 types)
- `code-guardian.md` - Pattern detection (5 patterns)
- `performance-auditor.md` - Frontend performance (PERF-001 to 005)
- `ui-table-auditor.md` - Table compliance (including foundationIdNumeric)
- `ui-compliance-auditor.md` - Frontend standards
- `architecture-guardian.md` - SOLID principles
- `ssot-agent.md` - SSoT validation

## Important Notes

- Does NOT auto-fix issues (report only)
- Does NOT log to Lexicon automatically
- Run `/t` before major commits for quality gate
- Use specific arguments for faster targeted reviews

## Post-Review: Updating Agents

If new patterns are discovered during review:

1. Ask: "Found X new patterns. Update agents? [Y/N]"
2. If Y, update relevant agent files with:
   - Pattern name and description
   - Detection method (grep pattern or manual check)
   - Severity level (critical/warning/info)
   - Suggested fix template
3. Add to `TEEEM_DOCS/DETECTION_RULES.md` for centralized tracking
