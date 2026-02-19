# /rqaf — Run QA Auto Fix (FRC + Ultra)

**Fix bugs from qa-prd.json findings using FRC methodology. No bandaids. No quick fixes. Fail fast.**

## Step 1: Read Findings

```
Read TEEEM_DOCS/qa-prd.json
```

- Parse the `findings` array
- Filter to `"status": "open"` findings only
- If no open findings, report "All findings resolved" and stop
- Sort by severity: critical > major > minor
- Present the list to the user:

```
========================================
OPEN QA FINDINGS: [count]
========================================
[severity] finding-001: [description] ([page])
[severity] finding-002: [description] ([page])
...
========================================
```

Ask the user: **"Which finding(s) should I fix? (all / finding-XXX / comma-separated IDs)"**

## Step 2: FRC Investigation (Per Finding)

**For EACH selected finding, follow the FRC process. Do NOT skip steps.**

### 2a. STOP — Don't Touch Code Yet

Read the finding carefully:
- What page? What element? What's the expected vs actual behavior?
- Navigate to the page in browser using Chrome DevTools MCP if available
- Reproduce the bug visually (take_snapshot / take_screenshot)

### 2b. INVESTIGATE — 5 Whys

Apply the 5 Whys technique. Write them out explicitly:

```
Finding: [description]

Why 1: [immediate cause]
Why 2: [why does that happen?]
Why 3: [why does THAT happen?]
Why 4: [deeper architectural reason]
Why 5: [root cause / missing guardrail]

ROOT CAUSE: [one sentence]
```

### 2c. Search for Similar Patterns

- `grep` / `Glob` for the same pattern elsewhere in the codebase
- Are there OTHER places with the same bug class?
- List ALL affected locations (not just the one the finding mentions)

### 2d. Check SSoT

- Is there an SSoT violation? (duplicate logic, hardcoded values, wrong component)
- Check `lib/constants/`, `lib/component-registry.ts`, `CLAUDE.md` for THE ONE
- If SSoT violation found: flag it, fix ALL locations

## Step 3: Ultra Think — 3 Approaches

**Present exactly 3 approaches. Never just pick one silently.**

```
========================================
FINDING: [id] — [description]
ROOT CAUSE: [one sentence]
========================================

APPROACH 1: [Name]
- What: [description]
- Files: [list]
- Effort: [low/medium/high]
- Risk: [what could break]
- Pros: [why this is good]
- Cons: [why this might not be ideal]

APPROACH 2: [Name]
- What: [description]
- Files: [list]
- Effort: [low/medium/high]
- Risk: [what could break]
- Pros: [why this is good]
- Cons: [why this might not be ideal]

APPROACH 3: [Name]
- What: [description]
- Files: [list]
- Effort: [low/medium/high]
- Risk: [what could break]
- Pros: [why this is good]
- Cons: [why this might not be ideal]

RECOMMENDED: Approach [N] because [reason]
========================================
```

Ask the user: **"Which approach? (1/2/3)"**

## Step 4: Implement the Fix

### Rules — HARD ENFORCED

| Rule | Enforcement |
|------|-------------|
| **No bandaids** | Fix the ROOT CAUSE, not the symptom. If you're adding a one-off override, STOP. |
| **No quick fixes** | If the "fix" is a CSS hack, a try/catch that swallows errors, or a null check without understanding WHY it's null — STOP and go back to Step 2. |
| **Fail fast** | If the fix would silently hide errors, REJECT it. Errors should be loud and visible. Use assertions, throw errors, validate inputs. |
| **Fix ALL instances** | If the bug exists in 5 places, fix all 5. Not just the one the finding mentions. |
| **SSoT or nothing** | If the fix creates a second way to do something, STOP. Consolidate to THE ONE way. |
| **LIM check** | Can existing code handle this? Search `lib/` first. Delete > Add. Reuse > Create. |

### Implementation Checklist

- [ ] Root cause fix implemented (not a bandaid)
- [ ] ALL similar instances fixed (not just the reported one)
- [ ] No SSoT violations introduced
- [ ] Dark mode verified (if UI change)
- [ ] No new dead code or unused imports
- [ ] Fail-fast: errors are loud, not swallowed

## Step 5: Verify the Fix

- If Chrome DevTools MCP is available: navigate to the affected page, take a snapshot/screenshot, verify the fix visually
- If not: explain what the user should verify manually
- Check that the fix didn't break adjacent functionality

## Step 6: Update qa-prd.json

For each fixed finding, update its status:

```json
{
  "status": "fixed",
  "fixed_at": "[current ISO timestamp]",
  "root_cause": "[one sentence from 5 Whys]",
  "fix_approach": "[which approach was used]",
  "files_changed": ["file1.tsx", "file2.rb"]
}
```

## Step 7: Summary Report

```
========================================
QA AUTO FIX COMPLETE
========================================
Fixed: [count] findings
Skipped: [count] (with reasons)

PER FINDING:
  [finding-XXX] [severity]
    Root Cause: [one sentence]
    Fix: [one sentence]
    Files: [list]
    Similar instances also fixed: [count]

REMAINING OPEN: [count] findings
========================================
```

## Fail-Safe Gates

**STOP and ask the user if ANY of these are true:**

1. The fix requires a database migration
2. The fix changes shared infrastructure (auth, middleware, API format)
3. The fix modifies more than 5 files
4. You're unsure about the root cause after 5 Whys
5. Two approaches seem equally valid
6. The fix might break other pages/features

**Remember: A rushed fix that ships a new bug is worse than no fix at all.**
