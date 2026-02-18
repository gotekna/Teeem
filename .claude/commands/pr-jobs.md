# PR Section 2: Jobs Detail Pages

You are a QA engineer. Test the Jobs list and EVERY tab/sub-tab on a job detail page. No shortcuts.

## Setup

1. `list_pages` - verify Chrome connection (if fails, tell user to run `/c`)
2. Navigate to `https://teeem-staging.vercel.app/login`
3. Login: `robert@tekna.com.au` / `Wisdom50-50`
4. Wait for dashboard to load
5. Read `.claude/pr-progress.json` - skip any pages already tested in section "jobs"

## Test Protocol (run for EVERY page/tab)

### Step A: Navigate & Snapshot
- `navigate_page` to the URL (or click the tab)
- Wait 3 seconds for API calls to settle
- `take_snapshot` - verify content loaded

### Step B: Error Check
- `list_console_messages({ types: ["error"] })` - record console errors
- In snapshot, search for: "Failed to", "Error", "Something went wrong", "Retry", "Unauthorized"
- **If ANY error: status = FAIL**

### Step C: Content Validation
- Record what you SEE: tab count, table row counts, card counts, field values
- If table: verify header count matches rows (not "0 records" with data in groups)
- If spinner visible after 3s: status = FAIL

### Step D: Interaction Test
- If Add/New button: click, verify modal opens, close without saving
- If table with rows: click first row, verify drawer/detail opens, close
- If form fields: verify they're populated (not empty when data exists)

### Step E: Scroll Check
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

## Pages to Test

### Jobs List
1. `/jobs` - Jobs table
   - Verify table loads with rows
   - Click group headers if grouped
   - Click first job to navigate to detail

### Job Detail (click first job, then test EVERY tab)
2. **Overview tab** - Job overview/summary
3. **Schedule tab** - Gantt chart (verify chart renders, bars visible)
4. **Documents tab** - Document list (verify file tree or table loads)
5. **Finance tab** - Has sub-tabs, test EACH:
   - Finance > Invoices
   - Finance > Bills
   - Finance > Payments
   - Finance > Purchase Orders
   - Finance > Xero Invoices
   - Finance > Xero Bills
6. **Activity tab** - Activity feed/timeline
7. **Setup tab** - Has sub-tabs, test EACH:
   - Setup > Details
   - Setup > Team
   - Setup > Addresses
   - Setup > Custom Fields
8. **Resources tab** - Has sub-tabs, test EACH:
   - Resources > People
   - Resources > Equipment
   - Resources > Materials
9. **Field tab** - Has sub-tabs, test EACH:
   - Field > Diary
   - Field > Photos
   - Field > Inspections
10. **Emails tab** - Email list for this job
11. **Cases tab** - Cases linked to this job
12. **Portal tab** - Client portal settings
13. **Notes tab** - Notes/comments

**For EACH tab:** Take snapshot, check for errors, verify content loaded. If it has sub-tabs, click EVERY sub-tab and snapshot each one.

### Table CRUD Test (on Jobs list)
14. Go back to `/jobs`
15. Click Add/New button
16. Verify form/modal opens with correct fields
17. Close without saving
18. Verify list is unchanged

## Progress Tracking

Save to `.claude/pr-progress.json` after EACH page (merge with existing data):
```json
{
  "sections": {
    "jobs": {
      "status": "in_progress",
      "tested": [
        { "url": "/jobs", "label": "Jobs List", "status": "PASS", "tabs": 0, "tables": 1, "rows": 47, "errors": 0, "notes": "Table loaded, grouped by status" },
        { "url": "/jobs/[id]/overview", "label": "Job > Overview", "status": "PASS", "tabs": 0, "tables": 0, "errors": 0, "notes": "All fields populated" }
      ],
      "failed": [],
      "remaining": []
    }
  }
}
```

## Section Summary

```
========================================
PR SECTION 2: JOBS - COMPLETE
========================================
Page                         Status    Details
---------------------------------------------
Jobs List                    [PASS]    47 rows, grouped by status
Job > Overview               [PASS]    All fields populated
Job > Schedule               [PASS]    Gantt chart rendered, 12 bars
Job > Documents              [PASS]    File tree loaded, 23 files
Job > Finance > Invoices     [PASS]    Table, 5 rows
Job > Finance > Bills        [PASS]    Table, 3 rows
Job > Finance > Payments     [FAIL]    Console error: TypeError
...
========================================
TOTAL: XX tested | XX PASS | XX FAIL
Next: Run /pr-contacts
========================================
```
