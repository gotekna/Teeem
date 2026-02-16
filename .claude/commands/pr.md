# Production Ready QA + Performance

You are a QA engineer performing comprehensive release-readiness testing. Test EVERY page, tab, sub-tab, and sub-sub-tab in the application. Discover dynamically AND cross-reference with `route-paths.ts` to ensure nothing is missed.

**Philosophy:** Thoroughness over speed. One page at a time. Evidence required for every result.

## Anti-Skip Rules

1. **ONE page at a time.** Never batch or say "pages X-Y look similar".
2. **Mandatory evidence per page:** `take_snapshot` + `list_console_messages` + `list_network_requests` + at least one `click` + scroll check + performance trace.
3. **If a page has tabs, click EVERY tab** and snapshot each.
4. **If a tab has sub-tabs, click EVERY sub-tab.** If a sub-tab has sub-sub-tabs, click those too. Go as deep as the UI goes.
5. **Report element counts** (tabs, tables, rows, buttons) - not just "page works".
6. **If you can't access something, report BLOCKED**, not skipped.
7. **A fast broken page is worse than a slow working page.** Always validate content, not just metrics.

## Phase 1: Setup

1. `list_pages` - verify Chrome connection (if fails, tell user to run `/c`)
2. Navigate to `https://teeem-staging.vercel.app/login`
3. Login: `robert@tekna.com.au` / `Wisdom50-50`
4. Wait for dashboard to load

## Phase 2: Resume Check

Check if `.claude/pr-progress.json` exists (Read tool). If it does:
- Show what was already tested and what remains
- Ask user: "Resume from where you left off, or start fresh?"
- If resume: skip tested pages, continue from first untested
- If fresh: delete the file and start over

## Phase 3: Build Complete Test Queue

Use TWO discovery methods to ensure 100% coverage:

### 3.1 Dynamic Discovery (primary)
1. **Left Nav:** Take snapshot. Find ALL nav items + their URLs. Expand any collapsed sections.
2. **Settings:** Navigate to `/settings`. Click each top-level tab. For each tab, click every sub-tab. For sub-tabs with their own sub-tabs, click those too (3-4 levels deep).
3. **Job Detail:** Navigate to `/jobs`, click first job. Click every tab. For tabs with sub-tabs (Finance, Setup, Resources, Field, etc.), click those too.
4. **Contact Detail:** Navigate to `/contacts`, click first contact. Click every tab. For tabs with sub-tabs (Corporate, Financial, etc.), click those too.
5. **Corporate:** Navigate to `/corporate`. Click every tab and sub-page.
6. **Financial:** Navigate to `/financial`. Click every tab.
7. **Admin:** Navigate to `/admin`. Click every section and sub-tab.

### 3.2 Route Verification (catch what discovery missed)
Read `frontend-next/lib/constants/route-paths.ts` (the SSoT for all routes). Cross-reference discovered URLs against this file. Add any routes NOT yet in the queue. Skip:
- Dynamic routes needing specific IDs (like `/jobs/[id]` - already tested via discovery)
- Redirect routes (marked with "Redirects to" comments)
- Public/auth routes (/login, /signup, /forgot-password)

### 3.3 Known Deep Pages (easy to miss)
Ensure these sections are fully expanded in the queue:

**Settings (3-4 levels deep):**
- `/settings/company/documents` has sub-tabs: Document Types, Templates, PDF Fields
- `/settings/company/job-setup` has sub-tabs: Types, Statuses, Stages, Suburbs, Workflow
- `/settings/company/warehouse-config` has sub-tabs: Warehouse Folders, Document Types, Corporate, Jobs, Contacts, Email Config, Config Sync
- `/settings/connections` has sub-tabs: Provider, Integrations, Migration, Costs, Backups
- `/settings/operations` has sub-tabs: Schedule Master, SM Tasks, Contact Types, Meeting Types, Supervisor Checklist, Cost, PO Templates
- `/settings/roles` has sub-tabs: Permissions, User Roles, Groups
- `/settings/developer` has sub-tabs: Components Lab, Developer Tools, Brand Guidelines, Unreal Engine
- `/settings/system` has sub-tabs: Navigation, AI Agents, Scheduled Jobs, Email Accounts, AI Processing, Config Sync, System Health
- `/settings/email-reseller` has sub-tabs: Subscriptions, Migrations, Reports, Settings

**Corporate (many sub-pages):**
- `/corporate/groups`, `/corporate/directors`, `/corporate/people`, `/corporate/memberships`
- `/corporate/shareholders`, `/corporate/beneficiaries`, `/corporate/charity-members`
- `/corporate/structure`, `/corporate/companies`, `/corporate/assets`, `/corporate/assets/reports`
- `/corporate/compliance-calendar`, `/corporate/consolidation`, `/corporate/minute-templates`
- `/corporate/document-types`, `/corporate/asic-logins`, `/corporate/health`

**WHS (7 pages):**
- `/whs`, `/whs/dashboard`, `/whs/swms`, `/whs/inspections`
- `/whs/incidents`, `/whs/inductions`, `/whs/action-items`

**Financial:**
- `/financial`, `/financial/reports`, `/financial/transactions`, `/financial/tas`
- `/finance`, `/finance/bills`, `/finance/payments`, `/finance/settings`

**Workflows:**
- `/workflows` (with tabs), `/workflows/processes` (with tabs), `/workflows/designer`

**Admin:**
- `/admin/tenants`, `/admin/saas-customers`, `/admin/referrers`, `/admin/support-tickets`
- `/admin/site-presence`, `/admin/system/schedule-master` (with gantt tab)
- `/admin/system/warehouse-config` (with scope tabs)
- TEEEM Office Suite: `/admin/system/teeem-xl`, `teeem-word`, `teeem-powerpoint`, `teeem-pdf`

**Non-Nav Pages (not in left sidebar):**
- `/agent-tasks`, `/system-performance`, `/pricebook/health`, `/contacts/duplicates`
- `/contacts/quality-review`, `/design-system`, `/designer`, `/e-signature`
- `/my-docs`, `/recipes`, `/data-warehouse`, `/warehouse`
- `/feature-requests`, `/chat`, `/notebooks`, `/device`
- `/public-holidays`, `/schedule-templates`, `/company-groups`
- `/xero`, `/xero/sync`, `/email/rules`, `/email/settings`
- `/cases`, `/leads/emails`, `/docsort`

### 3.4 Build Final Queue
Combine all discovered + verified URLs. Remove duplicates. Order by nav section. This is your test queue. **Expected: 150-250 unique testable pages.**

## Phase 4: Standard Test Protocol

Run this protocol for EVERY page in the test queue:

### 4.1 Navigate & Load
- `navigate_page` to the URL
- `take_snapshot` - verify page loaded (not 404, not blank, not stuck on spinner)
- Record: URL, page title from snapshot

### 4.2 Performance Trace
- Run `performance_start_trace` with `reload: true, autoStop: true`
- Record **LCP** and **CLS** from trace results
- Thresholds:
  - **CLS > 0.1** = WARN (layout shift)
  - **LCP > 2500ms** = WARN (slow)
  - **LCP > 4000ms** = FAIL (very slow)

### 4.3 Error & Content Validation
After trace completes, wait 3 seconds then:
- `list_console_messages({ types: ["error"] })` - record any errors
- `list_network_requests` - scan for 4xx/5xx status codes
- `take_snapshot` and check for:
  - Error text: "Failed to", "Error", "Something went wrong", "Unexpected error"
  - Retry buttons: "Retry", "Try again", "Reload"
  - Auth failures: "Unauthorized", "Forbidden", "Access denied"
  - Empty content: "0 records" when groups show counts, spinner stuck >3s
  - **If ANY error found: Mark FAIL regardless of LCP/CLS scores**

### 4.4 Tab Discovery & Click (ALL LEVELS)
- From snapshot, find ALL tab-like elements (role=tab, tab lists, navigation tabs)
- Click EACH tab, take snapshot after each to verify content changes
- **For each tab: check if it has sub-tabs. Click every sub-tab.**
- **For each sub-tab: check if it has sub-sub-tabs. Click every sub-sub-tab.**
- **Keep going until there are no more nested tabs.**
- Example depth: Settings > Company > Documents > Templates (4 levels)

### 4.5 Table Check
- If table found: record row count
- Verify header count matches actual rows (not "0 records" with data in groups)
- Click first data row - verify drawer/detail opens
- Close drawer (X button or click outside)

### 4.6 Button Check
- If Add/Create/New button found: click it, verify modal/form opens, close without saving

### 4.7 Scroll Check
```javascript
() => {
  const el = document.querySelector('[class*="main-scroll"]') || document.querySelector('main') || document.documentElement;
  const before = el.scrollTop;
  el.scrollTo(0, el.scrollHeight);
  const after = el.scrollTop;
  el.scrollTo(0, 0);
  return { scrollable: after > before || el.scrollHeight <= el.clientHeight, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight };
}
```

### 4.8 Dark Mode Check
```javascript
() => {
  document.documentElement.classList.toggle('dark');
  return { isDark: document.documentElement.classList.contains('dark') };
}
```
Take snapshot to verify no white-on-white or black-on-black. Toggle back.

### 4.9 Record Result
After each page, immediately save progress (see Phase 5).

## Phase 5: Progress Tracking

After EACH page completes, save progress to `.claude/pr-progress.json`:
```json
{
  "timestamp": "2026-02-16T10:00:00",
  "tested": [
    { "url": "/dashboard", "label": "Dashboard", "status": "PASS", "tabs": 3, "tables": 0, "errors": 0, "lcp": 800, "cls": 0.02, "content": "OK", "notes": "" }
  ],
  "failed": [
    { "url": "/portal", "label": "Portal", "status": "FAIL", "error": "404 Not Found", "lcp": null, "cls": null }
  ],
  "remaining": ["/contacts", "/leads", "..."],
  "systemHealth": {}
}
```

Show visual progress after each nav section:
```
========================================
QA PROGRESS: 5/22 sections complete (87/250 pages)
========================================
PASS  Dashboard          (3 tabs, LCP 800ms, CLS 0.02, 0 errors)
PASS  Tasks              (1 table/47 rows, LCP 650ms, CLS 0.01, 0 errors)
PASS  Email              (8 accounts, LCP 750ms, CLS 0.03, 0 errors)
FAIL  Calendar           (LCP 4200ms [SLOW], 0 errors)
PASS  Contacts           (1 table, 5 tabs, 12 sub-tabs, LCP 900ms, 0 errors)
>>    Corporate          (testing... 3/15 sub-pages done)
      WHS                (not started - 7 pages)
      Financial          (not started - 8 pages)
      Settings           (not started - 40+ tabs)
      Admin              (not started - 12 pages)
      ...
========================================
```

## Phase 6: CRUD Tests

On these specific pages, test create/delete:

| Page | Test |
|------|------|
| Tasks | Create "PR Test - DELETE ME", verify appears, delete it |
| Contacts | Create "PR Test Contact - DELETE ME", verify, delete |

## Phase 7: System Health Performance Check

Navigate to `/system-health/performance` and analyze:

### 7.1 Summary Metrics
| Metric | Pass | Warn | Fail |
|--------|------|------|------|
| Avg Response Time | <100ms | 100-200ms | >200ms |
| P95 Latency | <200ms | 200-500ms | >500ms |
| P99 Latency | <500ms | 500-1000ms | >1000ms |
| Error Rate | <0.5% | 0.5-1% | >1% |
| Budget Compliance | >95% | 80-95% | <80% |

### 7.2 Check For
- **Active Anomalies** - Any "Slow Query Surge" = record which table and count
- **Budget Violations** - Endpoints exceeding p99 target
- **Slowest Endpoints** - Any >500ms P95 = record, >1000ms P95 = FAIL
- **Tables with Slow Queries** - Any >100 slow queries = record
- **SLO Compliance** - Any "Violated" status = record

### 7.3 Backend API (if dashboard unavailable)
```
GET /api/v1/performance              - Overview metrics
GET /api/v1/performance/slow_queries - Slow DB queries
GET /api/v1/performance/anomalies?status=open - Active anomalies
GET /api/v1/performance/endpoints    - Per-endpoint p95/p99
```

## Phase 8: Final Report

After all pages tested:

1. Display summary grouped by PASS / FAIL / BLOCKED
2. For each failure: URL, error type, details, LCP/CLS if available
3. Navigate to `/notebooks` > "Production Ready" notebook > create dated page with full report
4. If failures found, list them clearly for the user to review

Report format:
```
================================================================================
PRODUCTION READY REPORT - DD/MM/YYYY
================================================================================
TOTAL: XXX pages tested | XX PASS | XX FAIL | XX BLOCKED
COVERAGE: XX/XX routes from route-paths.ts verified

FAILURES:
- /portal: 404 Not Found
- /settings/company/offline: Console error: "TypeError: Cannot read..."
- /calendar: LCP 4200ms (target <2500ms)
- /whs/swms: BROKEN PAGE - "Failed to load" with Retry button

PERFORMANCE SUMMARY:
Page                    LCP      CLS    Content    Status
--------------------------------------------------------------------------------
Dashboard               800ms    0.02   OK         [PASS]
Tasks                   650ms    0.01   OK         [PASS]
Jobs > Schedule        1200ms    0.15   OK         [WARN] High CLS
Email                   750ms    0.03   OK         [PASS]
...

SYSTEM HEALTH:
Metric                  Value      Target     Status
--------------------------------------------------------------------------------
P95 Latency             80ms       <200ms     [PASS]
P99 Latency             392ms      <500ms     [PASS]
Error Rate              0.5%       <1%        [PASS]
Active Anomalies        0          0          [PASS]

PASS (by section):
- Dashboard: 3 tabs, LCP 800ms, 0 errors
- Tasks: 1 table, CRUD OK, LCP 650ms, 0 errors
- Corporate: 15 sub-pages, all PASS, 0 errors
- Settings: 40 tabs/sub-tabs, all PASS, 0 errors
...
================================================================================
```

## Phase 9: Regression Check (if baseline exists)

Compare against `.claude/perf-baseline.json`:
- **First run:** Save results as baseline
- **Subsequent runs:** Flag any metric 20%+ worse as regression
- After check, ask user: "Update baseline with new values?"

Baseline format:
```json
{
  "timestamp": "2026-02-16T10:00:00Z",
  "pages": {
    "/dashboard": { "lcp": 800, "cls": 0.02 },
    "/jobs": { "lcp": 900, "cls": 0.05 }
  },
  "backend": { "p95": 80, "p99": 392, "error_rate": 0.5 }
}
```

## Error Handling

| Situation | Action |
|-----------|--------|
| Page timeout (15s) | Mark FAIL, continue |
| 404 | Mark FAIL, continue |
| 500 / network error | Mark FAIL with details, continue |
| Console error | Record text, mark WARN, continue |
| Error state with good LCP/CLS | Mark FAIL (content broken), continue |
| Element not clickable | Try alternative selector, if still blocked mark BLOCKED |
| Context running low | Save progress to `.claude/pr-progress.json`, tell user which pages remain |

## Performance Anti-Patterns Reference

When investigating performance issues found during this run, avoid these known traps:

| # | Anti-Pattern | What Goes Wrong |
|---|-------------|-----------------|
| 1 | Multiple fetch triggers | Two places call `setAutoFetchRefreshKey` = double load |
| 2 | Volatile useEffect deps | `baseFiltersKey` changes during init = extra fetches |
| 3 | Path-based view switching | `router.push('/path')` unmounts component = cache wiped |
| 4 | SSR data ignored | Client state read before SSR applied = "0 records" |
| 5 | Refs as bandaids | Hiding double-render instead of fixing root cause |
| 6 | Short cache TTL | Reducing TTL "for safety" when mutations already clear cache |
| 7 | Metrics-only checks | Fast LCP on broken page = false PASS |

## Timeout

This command may run up to **120 minutes**. Do not stop early. If running low on context, save progress and tell user to resume with `/pr`.
