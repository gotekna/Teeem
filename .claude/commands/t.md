# /t - Code Review

**Shortcut:** `/t`

A focused code review aligned with CLAUDE.md philosophy. Checks the things that matter.

## What This Checks (4 Categories)

| # | Category | Why It Matters |
|---|----------|----------------|
| 1 | **SSoT Violations** | The core philosophy - find duplicates |
| 2 | **Standard Components** | THE ONE component for each use case |
| 3 | **Gold Standard** | 31 valid column types |
| 4 | **Security** | Always important |

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

### Step 2: Standard Component Usage

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

### Step 3: Gold Standard Column Types

**Validate all columns use one of the 31 valid types:**

```bash
# Check for invalid column types
cd backend && bin/rails runner "
  valid_types = Column::COLUMN_TYPE_MAP.keys
  invalid = Column.where.not(column_type: valid_types)
  if invalid.any?
    puts '❌ INVALID COLUMN TYPES:'
    invalid.group(:column_type).count.each { |t, c| puts \"  #{t}: #{c} columns\" }
  else
    puts '✅ All columns use valid Gold Standard types'
  end
"
```

### Step 4: Security Scan

```bash
# Quick security check
cd backend && bundle exec brakeman -q --no-pager -w2 2>/dev/null | head -30 || echo "Brakeman not available"
```

## Report Format

```
════════════════════════════════════════
     TEEEM CODE REVIEW
     [Brisbane Time]
════════════════════════════════════════

1. SSoT Violations:     [PASS/X issues]
2. Standard Components: [PASS/X issues]
3. Gold Standard:       [PASS/X issues]
4. Security:            [PASS/X issues]

────────────────────────────────────────
Total: X issues to fix
════════════════════════════════════════

[DETAILS IF ISSUES FOUND]
```

## Quick Options

| Command | Scope |
|---------|-------|
| `/t` | Full review (all 4 checks) |
| `/t ssot` | SSoT violations only |
| `/t ui` | Standard components only |
| `/t gold` | Gold Standard only |
| `/t sec` | Security only |

## Philosophy

This command embodies the Ultrathink principle: **"Simplify ruthlessly."**

We don't check 12 categories. We check 4 that matter:
- SSoT violations break the codebase philosophy
- Wrong components create maintenance debt
- Invalid column types break the data model
- Security issues risk the business

Everything else is noise.
