# PR Section 4: Corporate, WHS & Financial Pages

You are a QA engineer. Test every page in Corporate, WHS, and Financial sections. No shortcuts.

## Setup

1. `list_pages` - verify Chrome connection (if fails, tell user to run `/c`)
2. Navigate to `https://teeem-staging.vercel.app/login`
3. Login: `robert@tekna.com.au` / `Wisdom50-50`
4. Wait for dashboard to load
5. Read `.claude/pr-progress.json` - skip any pages already tested in section "corporate"

## Test Protocol (run for EVERY page)

### Step A: Navigate & Snapshot
- `navigate_page` to the URL
- Wait 3 seconds for API calls to settle
- `take_snapshot` - verify content loaded

### Step B: Error Check
- `list_console_messages({ types: ["error"] })` - record console errors
- In snapshot, search for: "Failed to", "Error", "Something went wrong", "Retry", "Unauthorized"
- **If ANY error: status = FAIL**

### Step C: Content Validation
- Record what you SEE: tab count, table row counts, card counts
- If table: verify header count matches rows
- If spinner visible after 3s: status = FAIL

### Step D: Interaction Test
- If Add/New button: click, verify modal opens, close without saving
- If table with rows: click first row, verify drawer/detail opens, close

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

### Corporate Section (18 pages)
1. `/corporate` - Corporate landing/overview
2. `/corporate/groups` - Corporate groups
3. `/corporate/directors` - Directors list
4. `/corporate/people` - People list
5. `/corporate/memberships` - Memberships
6. `/corporate/shareholders` - Shareholders
7. `/corporate/beneficiaries` - Beneficiaries
8. `/corporate/charity-members` - Charity members
9. `/corporate/structure` - Corporate structure visualization
10. `/corporate/companies` - Companies list
11. `/corporate/assets` - Assets list
12. `/corporate/assets/reports` - Asset reports
13. `/corporate/compliance-calendar` - Compliance calendar
14. `/corporate/consolidation` - Consolidation
15. `/corporate/minute-templates` - Minute templates
16. `/corporate/document-types` - Document types
17. `/corporate/asic-logins` - ASIC logins
18. `/corporate/health` - Corporate data health

### WHS Section (7 pages)
19. `/whs` - WHS landing
20. `/whs/dashboard` - WHS dashboard
21. `/whs/swms` - Safe Work Method Statements
22. `/whs/inspections` - Inspections
23. `/whs/incidents` - Incidents
24. `/whs/inductions` - Inductions
25. `/whs/action-items` - Action items

### Financial Section (8 pages)
26. `/financial` - Financial landing
27. `/financial/reports` - Financial reports
28. `/financial/transactions` - Transactions
29. `/financial/tas` - Tax agent statements
30. `/finance` - Finance landing
31. `/finance/bills` - Bills
32. `/finance/payments` - Payments
33. `/finance/settings` - Finance settings

### Xero Pages
34. `/xero` - Xero overview
35. `/xero/sync` - Xero sync status

## Progress Tracking

Save to `.claude/pr-progress.json` after EACH page (merge with existing):
```json
{
  "sections": {
    "corporate": {
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
PR SECTION 4: CORPORATE/WHS/FINANCIAL - COMPLETE
========================================
Page                              Status    Details
----------------------------------------------------
Corporate Landing                 [PASS]    Overview rendered
Corporate > Groups                [PASS]    Table, 5 groups
Corporate > Directors             [PASS]    Table, 12 directors
...
WHS Dashboard                     [PASS]    4 cards, chart rendered
WHS > SWMS                        [PASS]    Table, 8 rows
...
Financial > Reports               [PASS]    3 report types
Financial > Transactions          [FAIL]    Empty page, no data
...
========================================
TOTAL: 35 tested | XX PASS | XX FAIL
Next: Run /pr-settings
========================================
```
