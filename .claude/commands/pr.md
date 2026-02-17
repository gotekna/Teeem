# Production Ready QA - Orchestrator

You are the QA orchestrator. Your job is to track which sections have been tested and tell the user what to run next.

**DO NOT test pages yourself.** You coordinate the section commands.

## Step 1: Check Progress

Read `.claude/pr-progress.json` (if it exists) to see what's been tested.

## Step 2: Show Status Dashboard

```
================================================================================
PRODUCTION READY QA - PROGRESS TRACKER
================================================================================

Section              Pages    Status          Command
--------------------------------------------------------------------------------
1. Main Nav          ~15      [NOT STARTED]   /pr-main
2. Job Detail        ~15      [NOT STARTED]   /pr-jobs
3. Contact Detail    ~15      [NOT STARTED]   /pr-contacts
4. Corporate         ~18      [NOT STARTED]   /pr-corporate
5. Settings          ~45      [NOT STARTED]   /pr-settings
6. Admin & System    ~25      [NOT STARTED]   /pr-admin
7. CRUD & Health     ~5       [NOT STARTED]   /pr-final
--------------------------------------------------------------------------------
TOTAL: ~138 pages across 7 sections

Next: Run /pr-main to start
================================================================================
```

Update status from pr-progress.json:
- If section has all pages tested: `[COMPLETE] X PASS, Y FAIL`
- If section partially tested: `[IN PROGRESS] X/Y pages done`
- If not started: `[NOT STARTED]`

## Step 3: If ALL Sections Complete

Generate the final report:

```
================================================================================
PRODUCTION READY REPORT - DD/MM/YYYY
================================================================================
TOTAL: XXX pages tested | XX PASS | XX FAIL | XX BLOCKED
COVERAGE: XX/XX sections complete

FAILURES:
- /url: Error description
- /url: Error description

SECTION RESULTS:
1. Main Nav:      XX PASS, XX FAIL
2. Job Detail:    XX PASS, XX FAIL
3. Contact Detail: XX PASS, XX FAIL
4. Corporate:     XX PASS, XX FAIL
5. Settings:      XX PASS, XX FAIL
6. Admin:         XX PASS, XX FAIL
7. CRUD & Health: XX PASS, XX FAIL
================================================================================
```

## Step 4: Offer Actions

After showing status, ask the user:
- "Run the next section?" (suggest the next incomplete section command)
- "Start fresh?" (delete pr-progress.json)
- "Show failures only?" (filter to FAIL results)

## Section Commands Reference

| Command | What It Tests |
|---------|---------------|
| `/pr-main` | Dashboard, Tasks, Email, Calendar, Leads, Schedule Master, POs, Estimates, Pricebook |
| `/pr-jobs` | Jobs list + first job detail (all tabs, sub-tabs, table CRUD) |
| `/pr-contacts` | Contacts list + first contact detail (all tabs, sub-tabs) |
| `/pr-corporate` | Corporate section (18+ pages), WHS (7 pages), Financial (8 pages) |
| `/pr-settings` | All settings tabs and sub-tabs (45+ tabs across 3-4 levels deep) |
| `/pr-admin` | Admin pages, system pages, non-nav pages, workflows, notebooks |
| `/pr-final` | CRUD tests (create/delete), system health check, regression baseline |

**Each section runs in its own conversation to avoid context exhaustion.**
