# /t - Trinity Comprehensive Code Review

**Shortcut:** `/t` or `review` or `audit`

Performs a full codebase audit across security, SSoT compliance, code quality, and UI/UX standards.

## What This Command Does

The `/t` command runs a comprehensive code review checking 10 categories:

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

### Step 4: UI/UX Compliance

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

### Step 5: Database Schema Health

```bash
# Check for tables without indexes on foreign keys
cd backend && bin/rails runner "puts 'Checking foreign key indexes...'"

# Check for pending migrations
cd backend && bin/rails db:migrate:status
```

### Step 6: Test Coverage

```bash
# Find models without specs
cd backend && for model in app/models/*.rb; do spec="spec/models/$(basename $model .rb)_spec.rb"; [ ! -f "$spec" ] && echo "Missing: $spec"; done 2>/dev/null

# Find controllers without specs
cd backend && for ctrl in app/controllers/api/v1/*.rb; do spec="spec/requests/api/v1/$(basename $ctrl .rb | sed 's/_controller//')_spec.rb"; [ ! -f "$spec" ] && echo "Missing: $spec"; done 2>/dev/null
```

### Step 7: Generate Report

Compile all findings into standardized format:

```
════════════════════════════════════════════════════════════════
                    TEEEM CODE REVIEW REPORT
                    [Brisbane Time]
════════════════════════════════════════════════════════════════

SUMMARY (10 Categories)
───────────────────────
[PASS/WARN/FAIL] 1. Security:           X issues
[PASS/WARN/FAIL] 2. SSoT:               X issues
[PASS/WARN/FAIL] 3. UI/UX:              X issues
[PASS/WARN/FAIL] 4. Code Quality:       X issues
[PASS/WARN/FAIL] 5. DB Schema:          X issues
[PASS/WARN/FAIL] 6. Test Coverage:      X issues
[PASS/WARN/FAIL] 7. API Consistency:    X issues
[PASS/WARN/FAIL] 8. Performance:        X issues
[PASS/WARN/FAIL] 9. Documentation:      X issues
[PASS/WARN/FAIL] 10. TeeemTableView:    X issues

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
- `gold-standard-sst.md` - Column type SSoT (31 types)
- `code-guardian.md` - Pattern detection
- `architecture-guardian.md` - SOLID principles
- `ui-compliance-auditor.md` - Frontend standards
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
