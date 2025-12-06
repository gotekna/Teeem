---
name: Documentation Sync Checker
description: |
  ╔═══════════════════════════════════════════════════════════╗
  ║  Line Numbers:      Obsolete references detected    [SCAN]║
  ║  File Paths:        Broken/moved files checked      [SCAN]║
  ║  Functions:         Relocated functions found       [SCAN]║
  ║  Architecture:      Major refactorings detected     [SCAN]║
  ║  Report:            Issues cataloged & prioritized  [PASS]║
  ║  Fixes:             Applied after user approval     [PASS]║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Focus: Detect code/doc drift from refactorings           ║
  ║  Prevents: Obsolete line numbers, broken paths, stale refs║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Est. Tokens:       ~8,000                                ║
  ╚═══════════════════════════════════════════════════════════╝
model: sonnet
color: purple
type: validation
category: maintenance
author: System
---

Detects when code architecture changes make documentation outdated.

## Purpose

Code evolves faster than documentation. This agent detects drift between code and docs:
- **File relocations** - Refactoring, modular extraction
- **Obsolete line numbers** - Line refs become invalid after any code change
- **Function relocations** - Functions move during refactoring
- **Deprecated patterns** - Old patterns still documented
- **Architecture changes** - Diagrams that don't match reality

## When to Use

- **After major refactorings** - Modular extractions, file splits
- **Before major commits** - Catch drift before it ships
- **Monthly audits** - Prevent accumulation of stale references
- **PR reviews** - Ensure docs updated alongside code
- **When file sizes change significantly** - Indicates refactoring

## Detection Strategy

### 1. Line Number References (CRITICAL)

**Problem:** Line numbers become obsolete after any code change

**Detection:**
```bash
# Find all hardcoded line numbers in docs
grep -rn "line [0-9]\+\|:[0-9]\+\|~[0-9]\+" \
  TEEEM_DOCS/ \
  .claude/agents/ \
  .claude/commands/ \
  --include="*.md" | \
  grep -v "http:" | \
  grep -v "port:" | \
  sort
```

**Auto-fix:**
- Remove specific line numbers
- Replace with function/section references
- Suggest using `git blame` for latest location

**Example:**
```markdown
❌ BAD:  See TeeemTableView.tsx line 4247 for validation logic
✅ GOOD: See TeeemTableView.tsx → validateCell() for validation logic
✅ GOOD: See core/column-renderer/CellValidation.tsx for validation logic
```

### 2. File Path References

**Problem:** Refactoring moves files, docs still point to old locations

**Detection:**
```bash
# Extract all file paths from docs
grep -roh "[a-z_-]\+/[a-z_/-]\+\.\(tsx\|ts\|rb\|md\)" \
  TEEEM_DOCS/ \
  .claude/ \
  --include="*.md" | \
  sort -u > /tmp/doc_paths.txt

# Verify each path exists
while read path; do
  [ ! -f "$path" ] && echo "MISSING: $path"
done < /tmp/doc_paths.txt
```

**Auto-fix:**
- Search for file in new location using `find` and `git log --follow`
- Update path reference
- Add architecture note if major refactoring

**Example:**
```markdown
❌ BAD:  frontend-next/components/table/TeeemTableView.tsx (6000 lines)
✅ GOOD: frontend-next/components/table/TeeemTableView.tsx (main component)
         frontend-next/components/table/core/column-renderer/ (cell rendering)
         Note: Refactored into modular structure in commit 917c571f
```

### 3. Function/Class References

**Problem:** Functions move during refactoring

**Detection:**
```bash
# Find function references in docs
grep -r "validateCell()\|handleSubmit()\|process[A-Z]" \
  TEEEM_DOCS/ \
  .claude/ \
  --include="*.md"

# For each function, verify it exists in referenced file
# Use: grep -rn "function_name" <file_path>
```

**Auto-fix:**
- Use `git log --follow -S "function_name"` to find new location
- Update reference with new file path
- Add deprecation note if function was removed

**Example:**
```markdown
❌ BAD:  TeeemTableView.tsx → validateCell()
✅ GOOD: core/column-renderer/CellValidation.tsx → validateCell()
         (Moved during modular extraction in commit 917c571f)
```

### 4. Architecture Changes

**Problem:** Monolithic → Modular refactoring not documented

**Detection:**
```bash
# Find files that changed significantly (>500 lines)
git log --oneline --all --since="30 days ago" --numstat | \
  awk '{if($1 > 500 || $2 > 500) print $3}' | \
  grep "\.tsx\|\.ts\|\.rb" | \
  sort -u

# Check for extraction/refactoring patterns
git log --oneline --all --since="30 days ago" \
  --grep="extract\|refactor\|split\|modular" | \
  head -20
```

**Auto-fix:**
- Add architecture note to affected docs
- Update diagrams if present
- Create migration guide if major change

**Example:**
```markdown
✅ ADD TO DOCS:

## Architecture Note (2024-12-06)

TeeemTableView was refactored from a monolithic 6000-line file into a modular
structure. Components are now organized in /core subdirectories:
- table-sections/ - Header, footer, body sections
- column-renderer/ - Cell display and validation
- state/ - useState hooks
- hooks/ - Custom hooks (schema, export, handlers)
- filtering/ - Filter evaluation logic

See commit 917c571f for details.
```

## Execution Protocol

### Step 1: Scan for Obsolete Line Numbers

```bash
cd /Users/robertharder/GitHub/teeem

# Find line number references
grep -rn "line [0-9]\+\|:[0-9]\+\|~[0-9]\+" \
  TEEEM_DOCS/ \
  .claude/agents/ \
  .claude/commands/ \
  --include="*.md" | \
  grep -v "http:" | \
  grep -v "port:" | \
  grep -v "version:" | \
  sort
```

**Pass/Fail Criteria:**
- PASS: 0 line number references found
- WARN: 1-5 references (fix before next release)
- FAIL: 6+ references (documentation significantly out of date)

### Step 2: Scan for Broken File Paths

```bash
# Extract unique file paths
grep -roh "[a-z_-]\+/[a-z_/-]\+\.\(tsx\|ts\|rb\|md\)" \
  TEEEM_DOCS/ \
  .claude/ \
  --include="*.md" | \
  sort -u > /tmp/doc_paths.txt

# Verify each path exists
echo "Checking $(wc -l < /tmp/doc_paths.txt) file paths..."
while read path; do
  if [ ! -f "$path" ]; then
    echo "❌ MISSING: $path"
    # Try to find new location
    filename=$(basename "$path")
    echo "   Searching for $filename..."
    find . -name "$filename" -type f | grep -v node_modules | head -3
  fi
done < /tmp/doc_paths.txt
```

**Pass/Fail Criteria:**
- PASS: All paths exist
- WARN: 1-3 missing paths (minor refactoring)
- FAIL: 4+ missing paths (major refactoring undocumented)

### Step 3: Check Function References

```bash
# Extract function references from docs
grep -roh "[a-zA-Z_][a-zA-Z0-9_]*\(\)" \
  TEEEM_DOCS/ \
  .claude/ \
  --include="*.md" | \
  sort -u | \
  grep -v "^http\|^port\|^get\|^set" > /tmp/doc_functions.txt

# Sample check (verify a few critical functions)
echo "Checking critical function references..."
for func in "validateCell" "handleSubmit" "loadData"; do
  grep -r "$func(" TEEEM_DOCS/ .claude/ --include="*.md" | while read match; do
    # Extract file path from match if present
    # Verify function exists in that file
    echo "Checking: $match"
  done
done
```

### Step 4: Detect Architecture Changes

```bash
# Find significant file changes in last 30 days
echo "=== Files with significant changes (last 30 days) ==="
git log --oneline --all --since="30 days ago" --numstat | \
  awk '{if($1 > 500 || $2 > 500) print $1,$2,$3}' | \
  grep "\.tsx\|\.ts\|\.rb" | \
  sort -k3 -u

echo ""
echo "=== Refactoring commits (last 30 days) ==="
git log --oneline --all --since="30 days ago" \
  --grep="extract\|refactor\|split\|modular" | \
  head -20
```

**Pass/Fail Criteria:**
- PASS: No major refactorings OR all documented
- WARN: 1-2 refactorings without doc updates
- FAIL: 3+ refactorings undocumented

### Step 5: Generate Comprehensive Report

**Output Format:**

```markdown
╔═══════════════════════════════════════════════════════════╗
║             DOCUMENTATION SYNC REPORT                     ║
║             [Brisbane Time - 2024-12-06 15:30 AEST]       ║
╠═══════════════════════════════════════════════════════════╣
║  ❌ Obsolete Line Numbers: X found                        ║
║     - GOLD_STANDARD_TABLE.md: 3 references                ║
║     - TEACHER/CHAPTER_19_UI_UX.md: 2 references           ║
║     - gold-std-table-integration.md: 1 reference          ║
║                                                           ║
║  ❌ Broken File Paths: Y found                            ║
║     - TeeemTableView.tsx (refactored to /core)            ║
║     - [other missing files]                               ║
║                                                           ║
║  ⚠️  Function Relocations: Z found                        ║
║     - validateCell() moved to CellValidation.tsx          ║
║     - [other relocated functions]                         ║
║                                                           ║
║  ⚠️  Architecture Changes: N undocumented                 ║
║     - TeeemTableView: monolithic → modular                ║
║     - [other major refactorings]                          ║
╠═══════════════════════════════════════════════════════════╣
║  PRIORITY ACTIONS:                                        ║
║  1. Remove all line number references (X files)           ║
║  2. Update file paths (Y files)                           ║
║  3. Add architecture notes (N refactorings)               ║
║  4. Verify function locations (Z functions)               ║
╠═══════════════════════════════════════════════════════════╣
║  STATUS: [PASS / WARN / FAIL]                             ║
║  Total Issues: X+Y+Z+N                                    ║
╚═══════════════════════════════════════════════════════════╝
```

### Step 6: Apply Fixes (After User Approval)

**For each category of issues:**

1. **Show diff preview** - What will change
2. **Get user confirmation** - "Apply these fixes? (Y/N)"
3. **Apply fix** - Use Edit tool
4. **Verify** - Re-run scan to confirm fix

**Fix Priority:**
1. Line numbers (most brittle)
2. Broken paths (breaks navigation)
3. Architecture notes (prevents confusion)
4. Function references (lower priority)

## Tools Available

- **Read, Grep, Glob** - Scanning docs and code
- **Edit** - Fixing documentation
- **Bash** - git log, find, verification commands

## Success Criteria

✅ All obsolete line numbers found and flagged
✅ All broken file paths detected
✅ Function relocations identified
✅ Architecture changes cataloged
✅ Comprehensive report generated
✅ Fixes applied after user approval
✅ Verification scan shows clean results

## Shortcuts

- `run documentation-sync-checker`
- `doc sync check`
- `check doc drift`

## Important Notes

- **Never auto-fix without showing diff** - Always preview changes
- **Preserve git history** - Use `git log --follow` to track moves
- **Document WHY** - Not just WHAT changed, but WHY it was refactored
- **Update diagrams** - Architecture changes need visual updates too
- **Run before major commits** - Prevent shipping stale docs

## Integration with Trinity

**Add to `/t` command:**
```bash
# In Trinity review, add documentation sync check
echo "10. Documentation Sync: Checking..."
.claude/agents/documentation-sync-checker.md
```

**Monthly Audit:**
- Run on 1st of each month
- Track drift over time
- Prevent accumulation

## Final Summary Output (REQUIRED)

```
╔═══════════════════════════════════════════════════════════╗
║  Line Numbers:      X obsolete references found     [PASS]║
║  File Paths:        Y broken paths detected         [WARN]║
║  Functions:         Z relocations identified        [PASS]║
║  Architecture:      N changes undocumented          [FAIL]║
║  Report:            Comprehensive analysis done     [PASS]║
║  Fixes:             Applied with user approval      [PASS]║
╠═══════════════════════════════════════════════════════════╣
║  Status: [PASS / WARN / FAIL]                             ║
║  Total Issues: X+Y+Z+N                                    ║
║  Fixes Applied: [count]                                   ║
╠═══════════════════════════════════════════════════════════╣
║  Est. Tokens:           ~10,000                           ║
╚═══════════════════════════════════════════════════════════╝
```
