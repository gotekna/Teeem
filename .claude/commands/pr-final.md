# PR Section 7: CRUD Tests, System Health & Final Report

You are a QA engineer. Run CRUD tests, check system health, and generate the final production-ready report.

## Setup

1. `list_pages` - verify Chrome connection (if fails, tell user to run `/c`)
2. Navigate to `https://teeem-staging.vercel.app/login`
3. Login: `robert@tekna.com.au` / `Wisdom50-50`
4. Wait for dashboard to load
5. Read `.claude/pr-progress.json` - load all previous section results

## Phase 1: CRUD Tests

Test create and delete on key pages. **Clean up after yourself.**

### Test 1: Tasks CRUD
1. Navigate to `/tasks`
2. Click Add/New button
3. Create task: name = "PR Test - DELETE ME"
4. Verify task appears in list
5. Click the task, find delete option
6. Delete the task
7. Verify it's removed from list
8. **Record:** Create worked? Delete worked? Any errors?

### Test 2: Contacts CRUD
1. Navigate to `/contacts`
2. Click Add/New button
3. Create contact: name = "PR Test Contact - DELETE ME"
4. Verify contact appears in list
5. Find and delete the contact
6. Verify removal
7. **Record:** Create worked? Delete worked? Any errors?

### Test 3: Table Inline Edit (on any Foundation table)
1. Navigate to `/tasks` (or `/jobs`)
2. Double-click a cell to enter edit mode
3. Verify cell becomes editable
4. Press Escape to cancel (don't save)
5. **Record:** Inline edit activated? Cancel worked?

## Phase 2: System Health Performance Check

### 2.1 Navigate to Performance Dashboard
Navigate to `/system-health/performance`
Take snapshot, record all visible metrics.

### 2.2 Check Summary Metrics
| Metric | Pass | Warn | Fail |
|--------|------|------|------|
| Avg Response Time | <100ms | 100-200ms | >200ms |
| P95 Latency | <200ms | 200-500ms | >500ms |
| P99 Latency | <500ms | 500-1000ms | >1000ms |
| Error Rate | <0.5% | 0.5-1% | >1% |
| Budget Compliance | >95% | 80-95% | <80% |

### 2.3 Check For
- **Active Anomalies** - Any "Slow Query Surge" = record which table and count
- **Budget Violations** - Endpoints exceeding p99 target
- **Slowest Endpoints** - Any >500ms P95 = record, >1000ms P95 = FAIL
- **Tables with Slow Queries** - Any >100 slow queries = record
- **SLO Compliance** - Any "Violated" status = record

## Phase 3: Regression Check

Read `.claude/perf-baseline.json` (if exists).
- Compare current system health against baseline
- Flag any metric 20%+ worse as regression
- If no baseline exists, save current as baseline

## Phase 4: Generate Final Report

Read ALL results from `.claude/pr-progress.json` across all sections.

### Count totals from all sections:
- Total pages tested (sum all sections)
- Total PASS / FAIL / BLOCKED
- Which sections are complete vs incomplete

### Display Final Report:

```
================================================================================
PRODUCTION READY REPORT - DD/MM/YYYY
================================================================================
TOTAL: XXX pages tested | XX PASS | XX FAIL | XX BLOCKED

INCOMPLETE SECTIONS (if any):
- [section name]: XX/YY pages tested - run /pr-[section] to complete

FAILURES:
1. /url - Error description
2. /url - Error description
3. /url - Error description

CRUD RESULTS:
- Tasks: Create [PASS/FAIL] | Delete [PASS/FAIL] | Inline Edit [PASS/FAIL]
- Contacts: Create [PASS/FAIL] | Delete [PASS/FAIL]

SYSTEM HEALTH:
Metric                  Value      Target     Status
--------------------------------------------------------------------------------
Avg Response Time       XXms       <100ms     [PASS/WARN/FAIL]
P95 Latency             XXms       <200ms     [PASS/WARN/FAIL]
P99 Latency             XXms       <500ms     [PASS/WARN/FAIL]
Error Rate              X.X%       <0.5%      [PASS/WARN/FAIL]
Budget Compliance       XX%        >95%       [PASS/WARN/FAIL]
Active Anomalies        X          0          [PASS/FAIL]

SECTION BREAKDOWN:
Section              Tested    Pass    Fail    Blocked
------------------------------------------------------
1. Main Nav          15        14      1       0
2. Job Detail        15        15      0       0
3. Contact Detail    15        13      2       0
4. Corporate/WHS     35        33      1       1
5. Settings          64        60      4       0
6. Admin & Misc      30        28      2       0
7. CRUD & Health     5         4       1       0
------------------------------------------------------
TOTAL                179       167     11      1

VERDICT: [READY FOR PRODUCTION / NOT READY - X FAILURES TO FIX]
================================================================================
```

### Save Final Report
Save to `.claude/pr-progress.json` with `finalReport` key.

### Ask User
- "Update performance baseline with current values?"
- "Should I fix any of the failures found?"
- "Ready to deploy? Run /p to deploy to production"
