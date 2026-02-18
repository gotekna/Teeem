# PR Section 6: Admin, System & Miscellaneous Pages

You are a QA engineer. Test all admin pages, system pages, and non-navigation pages. No shortcuts.

## Setup

1. `list_pages` - verify Chrome connection (if fails, tell user to run `/c`)
2. Navigate to `https://teeem-staging.vercel.app/login`
3. Login: `robert@tekna.com.au` / `Wisdom50-50`
4. Wait for dashboard to load
5. Read `.claude/pr-progress.json` - skip any pages already tested in section "admin"

## Test Protocol (run for EVERY page)

### Step A: Navigate & Snapshot
- `navigate_page` to the URL
- Wait 3 seconds for API calls to settle
- `take_snapshot` - verify content loaded

### Step B: Error Check
- `list_console_messages({ types: ["error"] })` - record console errors
- In snapshot, search for: "Failed to", "Error", "Something went wrong", "Retry"
- **If ANY error: status = FAIL**

### Step C: Content Validation
- Record what you SEE: tab count, table row counts, card counts
- If table: verify it has rows
- If spinner visible after 3s: status = FAIL

### Step D: Interaction Test
- If table with rows: click first row, verify detail opens, close
- If tabs: click each tab, snapshot each

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

### Admin Section
1. `/admin/tenants` - Tenants management
2. `/admin/saas-customers` - SaaS customers
3. `/admin/referrers` - Referrers
4. `/admin/support-tickets` - Support tickets
5. `/admin/site-presence` - Site presence
6. `/admin/system/schedule-master` - Admin Schedule Master (check gantt tab)
7. `/admin/system/warehouse-config` - Admin Warehouse Config (check scope tabs)
8. `/admin/system/teeem-xl` - TEEEM XL
9. `/admin/system/teeem-word` - TEEEM Word
10. `/admin/system/teeem-powerpoint` - TEEEM PowerPoint
11. `/admin/system/teeem-pdf` - TEEEM PDF

### Workflow Pages
12. `/workflows` - Workflows (check all tabs)
13. `/workflows/processes` - Workflow Processes (check all tabs)
14. `/workflows/designer` - Workflow Designer

### System/Utility Pages
15. `/agent-tasks` - Agent tasks list
16. `/system-performance` - System performance dashboard
17. `/data-warehouse` - Data warehouse
18. `/warehouse` - Warehouse browser
19. `/design-system` - Design system showcase
20. `/designer` - Designer tool
21. `/e-signature` - E-Signature
22. `/device` - Device info

### Feature Pages
23. `/feature-requests` - Feature requests
24. `/recipes` - Recipes
25. `/public-holidays` - Public holidays
26. `/schedule-templates` - Schedule templates
27. `/company-groups` - Company groups
28. `/docsort` - Document sorting

### Email Config Pages
29. `/email/rules` - Email rules
30. `/email/settings` - Email settings

## Progress Tracking

Save to `.claude/pr-progress.json` after EACH page (merge with existing):
```json
{
  "sections": {
    "admin": {
      "status": "in_progress",
      "tested": [...],
      "failed": [],
      "remaining": []
    }
  }
}
```

## Section Summary

```
========================================
PR SECTION 6: ADMIN & MISC - COMPLETE
========================================
Page                              Status    Details
----------------------------------------------------
Admin > Tenants                   [PASS]    Table, 3 tenants
Admin > SaaS Customers            [PASS]    Table, 12 customers
Admin > TEEEM XL                  [PASS]    Spreadsheet loaded
Workflows                         [PASS]    3 tabs, all render
Agent Tasks                       [PASS]    Table, 25 tasks
System Performance                [PASS]    Dashboard, 6 charts
...
========================================
TOTAL: 30 tested | XX PASS | XX FAIL
Next: Run /pr-final
========================================
```
