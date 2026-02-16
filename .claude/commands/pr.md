# Production Ready QA

You are a QA engineer performing comprehensive release-readiness testing. Test EVERY page in the application by dynamically discovering navigation, tabs, and interactive elements.

**Philosophy:** Thoroughness over speed. One page at a time. Evidence required for every result.

## Anti-Skip Rules

1. **ONE page at a time.** Never batch or say "pages X-Y look similar".
2. **Mandatory evidence per page:** `take_snapshot` + `list_console_messages` + `list_network_requests` + at least one `click` + scroll check.
3. **If a page has tabs, click EVERY tab** and snapshot each.
4. **If a page has a table, click a row** to verify drawer/detail opens.
5. **Report element counts** (tabs, tables, rows, buttons) - not just "page works".
6. **If you can't access something, report BLOCKED**, not skipped.

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

## Phase 3: Discover All Pages

**Do NOT use a hardcoded URL list.** Discover pages dynamically:

1. **Left Nav Discovery:** Take a snapshot of the page. Find ALL items in the left navigation sidebar. Extract their labels and URLs. If any nav item has an expand/collapse arrow, click it to reveal children and extract those too.

2. **Settings Discovery:** Navigate to `/settings`. Take snapshot. Discover ALL settings tabs. For each settings tab that has sub-tabs (Company, Connections, Developer, Operations, System, etc.), click into it and discover all sub-tabs.

3. **Job Detail Discovery:** Navigate to `/jobs`, click the first job. Take snapshot. Discover ALL tabs in the job detail view. For tabs with sub-tabs (like Finance), discover those too. Navigate back.

4. **Build the test queue:** Combine all discovered URLs into a single ordered list. This is your test queue.

## Phase 4: Standard Test Protocol

Run this protocol for EVERY page in the test queue:

### 4.1 Navigate & Load
- `navigate_page` to the URL
- `take_snapshot` - verify page loaded (not 404, not blank, not stuck on spinner)
- Record: URL, page title from snapshot

### 4.2 Error Check
- `list_console_messages({ types: ["error"] })` - record any errors
- `list_network_requests` - scan for 4xx/5xx status codes

### 4.3 Tab Discovery & Click
- From snapshot, find ALL tab-like elements (role=tab, tab lists, navigation tabs)
- Click EACH tab, take snapshot after each to verify content changes
- For tabs with nested sub-tabs, click those too

### 4.4 Table Check
- If table found: record row count
- Click first data row - verify drawer/detail opens
- Close drawer (X button or click outside)

### 4.5 Button Check
- If Add/Create/New button found: click it, verify modal/form opens, close without saving

### 4.6 Scroll Check
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

### 4.7 Dark Mode Check
```javascript
() => {
  document.documentElement.classList.toggle('dark');
  return { isDark: document.documentElement.classList.contains('dark') };
}
```
Take snapshot to verify no white-on-white or black-on-black. Toggle back.

### 4.8 Record Result
After each page, immediately save progress (see Phase 5).

## Phase 5: Progress Tracking

After EACH page completes, save progress to `.claude/pr-progress.json`:
```json
{
  "timestamp": "2026-02-16T10:00:00",
  "tested": [
    { "url": "/dashboard", "label": "Dashboard", "status": "PASS", "tabs": 3, "tables": 0, "errors": 0, "notes": "" }
  ],
  "failed": [
    { "url": "/portal", "label": "Portal", "status": "FAIL", "error": "404 Not Found" }
  ],
  "remaining": ["/contacts", "/leads", "..."]
}
```

Show visual progress after each nav section:
```
========================================
QA PROGRESS: 5/15 nav sections complete
========================================
PASS  Dashboard          (3 tabs, 0 errors, scroll OK, dark OK)
PASS  Tasks              (1 table/47 rows, 1 drawer, 0 errors)
PASS  Email              (8 accounts tested, 0 errors)
PASS  Calendar           (renders OK, 0 errors)
PASS  Contacts           (1 table, 5 drawer tabs, 0 errors)
>>    Leads              (testing...)
      Jobs               (not started)
      Finance            (not started)
      ...
========================================
```

## Phase 6: CRUD Tests

On these specific pages, test create/delete:

| Page | Test |
|------|------|
| Tasks | Create "PR Test - DELETE ME", verify appears, delete it |
| Contacts | Create "PR Test Contact - DELETE ME", verify, delete |

## Phase 7: Final Report

After all pages tested:

1. Display summary grouped by PASS / FAIL / BLOCKED
2. For each failure: URL, error type, details
3. Navigate to `/notebooks` > "Production Ready" notebook > create dated page with full report
4. If failures found, list them clearly for the user to review

Report format:
```
========================================
PRODUCTION READY REPORT - DD/MM/YYYY
========================================
TOTAL: XX pages tested | XX PASS | XX FAIL | XX BLOCKED

FAILURES:
- /portal: 404 Not Found
- /settings/company/offline: Console error: "TypeError: Cannot read..."

PASS (by section):
- Dashboard: 3 tabs, 0 errors
- Tasks: 1 table, CRUD OK, 0 errors
- Email: 8 accounts, 0 errors
...
========================================
```

## Error Handling

| Situation | Action |
|-----------|--------|
| Page timeout (15s) | Mark FAIL, continue |
| 404 | Mark FAIL, continue |
| 500 / network error | Mark FAIL with details, continue |
| Console error | Record text, mark WARN, continue |
| Element not clickable | Try alternative selector, if still blocked mark BLOCKED |
| Context running low | Save progress to `.claude/pr-progress.json`, tell user which pages remain |

## Timeout

This command may run up to **120 minutes**. Do not stop early. If running low on context, save progress and tell user to resume with `/pr`.
