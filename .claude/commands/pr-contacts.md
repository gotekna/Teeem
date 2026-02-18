# PR Section 3: Contacts Detail Pages

You are a QA engineer. Test the Contacts list and EVERY tab/sub-tab on a contact detail page. No shortcuts.

## Setup

1. `list_pages` - verify Chrome connection (if fails, tell user to run `/c`)
2. Navigate to `https://teeem-staging.vercel.app/login`
3. Login: `robert@tekna.com.au` / `Wisdom50-50`
4. Wait for dashboard to load
5. Read `.claude/pr-progress.json` - skip any pages already tested in section "contacts"

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

### Contacts List
1. `/contacts` - Contacts table
   - Verify table loads with rows
   - Check grouping works
   - Click first contact to navigate to detail

### Contact Utility Pages
2. `/contacts/duplicates` - Duplicate contacts detection
3. `/contacts/quality-review` - Contact quality review

### Contact Detail (click first contact, then test EVERY tab)
4. **Overview tab** - Main contact details, avatar, key fields
5. **Corporate tab** - Has sub-tabs:
   - Corporate > Identity
   - Corporate > Summary
   - Corporate > Directorships (if applicable)
6. **Documents tab** - Document list/file tree
7. **Financial tab** - Has sub-tabs:
   - Financial > Bank
   - Financial > Xero
   - Financial > Bills
   - Financial > Jobs
   - Financial > Purchase Orders
8. **Coms tab** - Communications/correspondence
9. **Cases tab** - Cases linked to contact
10. **Emails tab** - Email history for contact
11. **Invoices tab** - If customer type
12. **Pricebook tab** - If supplier type
13. **Portal Access tab** - Portal/login settings
14. **Notes tab** - Notes/comments

**For EACH tab:** Take snapshot, check for errors, verify content loaded. If sub-tabs exist, click EVERY sub-tab.

### Contact CRUD Test
15. Go back to `/contacts`
16. Click Add/New button
17. Verify form/modal opens
18. Close without saving

## Progress Tracking

Save to `.claude/pr-progress.json` after EACH page (merge with existing):
```json
{
  "sections": {
    "contacts": {
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
PR SECTION 3: CONTACTS - COMPLETE
========================================
Page                              Status    Details
----------------------------------------------------
Contacts List                     [PASS]    250 rows, grouped
Contacts > Duplicates             [PASS]    Detection page loads
Contact > Overview                [PASS]    All fields populated
Contact > Corporate > Identity    [PASS]    Company details shown
Contact > Corporate > Summary     [PASS]    Summary card loaded
Contact > Documents               [PASS]    12 files in tree
Contact > Financial > Bank        [PASS]    Bank details shown
Contact > Financial > Xero        [FAIL]    Console error
...
========================================
TOTAL: XX tested | XX PASS | XX FAIL
Next: Run /pr-corporate
========================================
```
