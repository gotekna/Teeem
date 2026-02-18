# PR Section 1: Main Navigation Pages

You are a QA engineer. Test EVERY page listed below, one at a time. No shortcuts. No batching.

## Setup

1. `list_pages` - verify Chrome connection (if fails, tell user to run `/c`)
2. Navigate to `https://teeem-staging.vercel.app/login`
3. Login: `robert@tekna.com.au` / `Wisdom50-50`
4. Wait for dashboard to load
5. Read `.claude/pr-progress.json` - skip any pages already tested in section "main"

## Test Protocol (run for EVERY page)

For each page, you MUST do ALL of these steps. No skipping. No "this looks similar to the last page."

### Step A: Navigate & Snapshot
- `navigate_page` to the URL
- Wait 3 seconds for API calls to settle
- `take_snapshot` - verify page loaded (not 404, not blank, not stuck on spinner)

### Step B: Error Check
- `list_console_messages({ types: ["error"] })` - record any console errors
- In the snapshot, search for: "Failed to", "Error", "Something went wrong", "Retry", "Unauthorized"
- **If ANY error found: status = FAIL**

### Step C: Content Validation
- Record what you SEE: number of tabs, table row counts, card counts, button labels
- If table: verify header count matches visible rows (not "0 records" with data in groups)
- If spinner visible after 3s: status = FAIL

### Step D: Tab Clicks (ALL levels)
- Find ALL tabs in the snapshot (role=tab, tab lists, navigation segments)
- Click EACH tab, take snapshot after EACH click
- For each tab: check if it has sub-tabs. Click those too. Go as deep as it goes.
- Record: tab name, what loaded, any errors

### Step E: Interaction Test
- If Add/New button visible: click it, verify modal/form opens, close without saving
- If table with rows: click first row, verify drawer/detail opens, close it
- Report what happened

### Step F: Scroll Check
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

### Step G: Record Result
After EACH page, write the result to `.claude/pr-progress.json` immediately.

## Pages to Test (in order)

Test each of these. For pages with tabs, test every tab as a sub-item.

1. `/dashboard` - Dashboard (check all widgets, cards, charts render)
2. `/tasks` - Tasks list (table with groupings, click a task to verify detail)
3. `/email` - Email (check sidebar folders, click first email to verify it opens)
4. `/calendar` - Calendar (verify calendar renders, events visible)
5. `/leads` - Leads (table, click first lead)
6. `/leads/emails` - Lead Emails
7. `/schedule-master` - Schedule Master (Gantt chart, verify it renders)
8. `/purchase-orders` - Purchase Orders (table)
9. `/estimates` - Estimates (table)
10. `/pricebook` - Pricebook (table, click first item to verify detail panel)
11. `/pricebook/health` - Pricebook Health
12. `/cases` - Cases (table)
13. `/notebooks` - Notebooks
14. `/chat` - Chat
15. `/my-docs` - My Documents

## Progress Tracking

Save to `.claude/pr-progress.json` after EACH page:
```json
{
  "lastUpdated": "2026-02-17T10:00:00",
  "sections": {
    "main": {
      "status": "in_progress",
      "tested": [
        { "url": "/dashboard", "label": "Dashboard", "status": "PASS", "tabs": 3, "tables": 0, "errors": 0, "notes": "All widgets rendered, 4 cards visible" }
      ],
      "failed": [],
      "remaining": ["/tasks", "/email", "..."]
    }
  }
}
```

## Section Summary

After all pages tested, display:

```
========================================
PR SECTION 1: MAIN NAV - COMPLETE
========================================
Page                    Status    Details
----------------------------------------
Dashboard               [PASS]    3 tabs, 4 cards, 0 errors
Tasks                   [PASS]    1 table (47 rows), detail opens OK
Email                   [PASS]    8 folders, email opens OK
Calendar                [FAIL]    Spinner stuck >3s
...
========================================
TOTAL: 15 tested | XX PASS | XX FAIL
Next: Run /pr-jobs
========================================
```

## Error Handling

| Situation | Action |
|-----------|--------|
| Page timeout (15s) | Mark FAIL, continue to next page |
| 404 | Mark FAIL, continue |
| Console error | Record text, mark WARN, continue |
| Can't click element | Try alternative selector, if stuck mark BLOCKED |
| Session expired | Re-login, continue from current page |
