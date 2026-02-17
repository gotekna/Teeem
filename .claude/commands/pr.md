# Production Ready QA - Auto-Runner

You are the QA orchestrator. You automatically run the next incomplete section.
The user just runs `/pr` repeatedly - you figure out what's next.

## Step 1: Check Progress

Read `.claude/pr-progress.json` (if it exists) to see what's been tested.

## Step 2: Show Quick Status + Auto-Run Next Section

Show a brief status summary, then **immediately invoke the next section skill**.

```
PR QA: 2/7 sections done | Next: Section 3 (Contacts) | Running /pr-contacts...
```

### Section Order (run in sequence)

| # | Section | Skill to invoke | Pages |
|---|---------|----------------|-------|
| 1 | Main Nav | `pr-main` | ~15 |
| 2 | Job Detail | `pr-jobs` | ~15 |
| 3 | Contact Detail | `pr-contacts` | ~15 |
| 4 | Corporate/WHS/Financial | `pr-corporate` | ~18 |
| 5 | Settings | `pr-settings` | ~45 |
| 6 | Admin & System | `pr-admin` | ~25 |
| 7 | CRUD & Health | `pr-final` | ~5 |

### How to determine next section

Look at `pr-progress.json` → `sections` object. Find the FIRST section where `status` is NOT `"COMPLETE"`.
- If section status is `"NOT_STARTED"` or `"IN_PROGRESS"` → that's the next one
- Use the Skill tool to invoke it: e.g. `Skill(skill: "pr-main")` for section 1

### Auto-run logic

1. Read progress file
2. Find first incomplete section
3. Show one-line status: `PR QA: X/7 done | Next: Section Y (Name) | Running...`
4. **Invoke the section skill using the Skill tool** - this runs the actual QA tests
5. The section skill will update pr-progress.json when it finishes

## Step 3: If ALL Sections Complete

Don't invoke any skill. Instead, generate the final report:

```
================================================================================
PRODUCTION READY REPORT - DD/MM/YYYY
================================================================================
TOTAL: XXX pages tested | XX PASS | XX FAIL | XX BLOCKED
COVERAGE: 7/7 sections complete

FAILURES:
- /url: Error description

SECTION RESULTS:
1. Main Nav:       XX PASS, XX FAIL
2. Job Detail:     XX PASS, XX FAIL
3. Contact Detail: XX PASS, XX FAIL
4. Corporate:      XX PASS, XX FAIL
5. Settings:       XX PASS, XX FAIL
6. Admin:          XX PASS, XX FAIL
7. CRUD & Health:  XX PASS, XX FAIL
================================================================================
```

Then ask: "Fix failures?" or "Start fresh?"

## Step 4: If No Progress File Exists

Create a fresh one and start from Section 1:

```json
{
  "timestamp": "<now>",
  "status": "IN_PROGRESS",
  "sections": {
    "main": { "status": "NOT_STARTED", "pages_tested": 0 },
    "jobs": { "status": "NOT_STARTED", "pages_tested": 0 },
    "contacts": { "status": "NOT_STARTED", "pages_tested": 0 },
    "corporate": { "status": "NOT_STARTED", "pages_tested": 0 },
    "settings": { "status": "NOT_STARTED", "pages_tested": 0 },
    "admin": { "status": "NOT_STARTED", "pages_tested": 0 },
    "final": { "status": "NOT_STARTED", "pages_tested": 0 }
  },
  "summary": { "total_tested": 0, "pass": 0, "fail": 0, "blocked": 0, "warn": 0 },
  "failures": [],
  "warnings": []
}
```

Then invoke `pr-main` via the Skill tool.

## Key Principle

**The user should NEVER need to remember which command to run next.**
They just run `/pr` and it picks up where it left off.
