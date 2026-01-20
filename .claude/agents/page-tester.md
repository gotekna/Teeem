# Page Tester Agent

**Purpose:** EXHAUSTIVE testing of EVERY page, tab, button, and detail view in the TEEEM app using Chrome DevTools MCP.

**Target:** Staging: `https://teeem-staging.vercel.app` (backend: `https://teeem-staging-d60a657ed68a.herokuapp.com`)

**Priority:** THOROUGHNESS over speed. Click EVERYTHING. No time constraints.

## 🔴 TEST LIKE AN IMPATIENT USER

**Real users don't wait. They:**
- Click buttons 6 times when it's slow
- Navigate away before things finish loading
- Come back and expect it to still work
- Double-click everything
- Get frustrated and click randomly

**YOU MUST test these behaviors. Surface-level "page loads" testing is NOT enough.**

## CRITICAL: Test EVERYTHING

This agent must test:
1. **Every list page** - Main navigation pages
2. **Every tab on every page** - Click each tab, check for errors
3. **Detail pages** - Click into records and test all their tabs
4. **Every settings sub-page** - Navigate to each settings URL directly
5. **Every admin tab** - Click through all admin system tabs
6. **Specific features** - Plan preview, modals, photo tabs, actions

**DO NOT** just test list pages. You MUST click into detail pages and test ALL tabs.

## Login Credentials

```
Email: robert@tekna.com.au
Password: Wisdom50-50
```

## Test Methodology

For each page:
1. Navigate using `mcp__chrome-devtools__navigate_page`
2. Wait for load using `mcp__chrome-devtools__wait_for` (wait for key content)
3. Take snapshot using `mcp__chrome-devtools__take_snapshot`
4. Check network for 500 errors using `mcp__chrome-devtools__list_network_requests` with `resourceTypes: ["fetch", "xhr"]`
5. Check console for errors using `mcp__chrome-devtools__list_console_messages` with `types: ["error"]`
6. **For pages with tabs:** Click EACH tab and repeat checks
7. **For list pages:** Click into records to test detail views
8. **For detail pages:** Click EVERY tab
9. Log all errors with specific paths for fixing

## 🔴 CRITICAL: Stress Testing (Test Like Impatient Users)

**Real users don't wait. They click multiple times. They navigate away mid-load. TEST THIS.**

### Rapid Click Testing
For buttons, tabs, and interactive elements:
1. **Click 3x rapidly** - Does it break? Duplicate requests? State corruption?
2. **Click during loading** - What happens if spinner is showing?
3. **Double-click** - Does it open twice? Submit twice?

### Navigation Stress Testing
For features that load content (PDF viewer, images, modals):
1. **Load → Navigate Away → Return** - Does it still work? (PDF bug was this!)
2. **Click item → Immediately click different item** - Race condition?
3. **Open tab → Switch tabs rapidly 5x** - State corruption?
4. **Start loading → Navigate away before complete** - Memory leak? Error?

### State Persistence Testing
1. Click a plan/document to preview it
2. Navigate to a DIFFERENT tab (e.g., Overview)
3. Come BACK to the original tab
4. **Verify content still loads** - This caught the PDF CORS bug!

### Modal Stress Testing
1. Open modal → Close immediately
2. Open modal → Click backdrop to close → Reopen
3. Open modal → Submit → While saving, click X to close

### Form Stress Testing
1. Fill form → Click Save 3x rapidly
2. Fill form → Navigate away without saving (unsaved changes warning?)
3. Fill form → Clear all → Refill → Save

### Retry Testing
When errors occur:
1. Click Retry button
2. If fails again, click Retry 3x rapidly
3. Navigate away → Return → Does error state persist?

### Example Stress Test Flow (Plans Tab)
```
1. Go to /jobs/46/plans
2. Click first plan (01-PERSPECTIVE)
3. Wait for PDF to start loading (1 second)
4. IMMEDIATELY click Overview tab
5. Wait 2 seconds
6. Click Plans tab again
7. Click the SAME plan again
8. CHECK: Does PDF load? Or "Failed to fetch"?
```

### Error Patterns to Watch For
- "Failed to fetch" after navigation (CORS/state bug)
- Duplicate network requests (no debouncing)
- Console errors about "unmounted component"
- "Cannot read property of null" (race condition)
- Spinner stuck forever (promise never resolved)
- Multiple modals stacking
- Form submitted twice

## Error Detection Criteria

**FAIL conditions:**
- Network requests returning 500 status
- Console errors with "500" or "Internal Server Error"
- Page showing error message like "Failed to load"
- Empty page content when data expected
- Features not working (plan preview, modals, etc.)

**WARN conditions:**
- 404 errors for API endpoints (missing feature)
- Console warnings
- WebSocket connection failures
- Slow loading (>5 seconds)

**IGNORE:**
- `/api/v1/synced_email/unread_counts` 404 (known issue, on every page)
- WebSocket connection attempts

## Complete Test Checklist

### Phase 1: Jobs (DEEP TEST - Priority)

**This is the most important section. Test thoroughly.**

1. Navigate to `/jobs`
2. Search for "Watego" using the search box
3. Click into the Watego job to open detail view
4. Click EVERY job tab and verify it loads:
   - [ ] Overview tab
   - [ ] Contract Info tab
   - [ ] Plans tab - **TEST PLAN PREVIEW** (reported not working)
   - [ ] People tab
   - [ ] Finance tab → Click sub-tabs: Profit, Claims, Expenses
   - [ ] Documents tab
   - [ ] Schedule tab
   - [ ] Tasks tab
   - [ ] Notes tab
5. Test any action buttons/modals on the job
6. Navigate back to job list, test another job

**🔴 STRESS TEST: Plans Tab (MUST DO)**
```
a. Click Plans tab
b. Click first plan in list to load PDF preview
c. IMMEDIATELY (within 1 sec) click Overview tab
d. Wait 2 seconds
e. Click Plans tab again
f. Click SAME plan again
g. VERIFY: PDF loads correctly? Or shows "Failed to load"?
h. If error, click Retry button 3x rapidly
i. Check console for CORS errors or "Failed to fetch"
```

### Phase 2: Contacts (DEEP TEST)

1. Navigate to `/contacts`
2. Click into 3+ different contacts
3. For each contact, click EVERY tab:
   - [ ] Overview tab
   - [ ] Photo tab - **REPORTED ISSUE** - verify it works
   - [ ] Jobs tab
   - [ ] Documents tab
   - [ ] Emails tab
   - [ ] Notes tab
   - [ ] Activity tab
4. Test contact action buttons

### Phase 3: All Main Pages (List + Detail)

For each page, test the list AND click into 2-3 records:

| Page | Test Actions |
|------|--------------|
| `/dashboard` | Test tabs: Overview, Competitor Comparison, Architecture |
| `/tasks` | Open 2+ tasks, check all tabs |
| `/calendar` | Click events, check event modals |
| `/email` | Select mailbox, open 2+ emails, check email viewer |
| `/leads` | Open leads, test all lead tabs |
| `/finance` | Test ALL tabs: Bank Feeds, Reports, Transactions, TAS, EOFY |
| `/meetings` | Open meetings, test meeting details |
| `/documents` | Browse folders, open documents, test viewer |
| `/portal` | Open portal users |
| `/whs` | Test all WHS tabs |
| `/cases` | Open cases, test all case tabs |
| `/data-warehouse` | Test all warehouse tabs |
| `/workflows` | Test Designer, Templates, Processes tabs |
| `/pricebook` | Open pricebook items |
| `/purchase_orders` | Open PO details, test all PO tabs |
| `/estimates` | Open estimates, test all estimate tabs |
| `/accounts` | Test accounts view |
| `/recipes` | Open recipe details |

### Phase 4: Corporate Section (MUST test every sub-page)

- [ ] `/corporate` - Main dashboard
- [ ] `/corporate/groups` - Click into 2-3 company groups, test group tabs
- [ ] `/corporate/companies` - Click into 2-3 companies, test ALL company tabs
- [ ] `/corporate/people` - Click into people details
- [ ] `/corporate/assets` - Click into asset details
- [ ] `/corporate/structure` - View structure
- [ ] `/corporate/memberships` - View memberships
- [ ] `/corporate/minute-templates` - View templates
- [ ] `/corporate/consolidation` - Test consolidation
- [ ] `/corporate/compliance-calendar` - View calendar
- [ ] `/corporate/health` - View health

### Phase 5: Settings Pages (Navigate directly to each URL)

**Personal Settings:**
- [ ] `/settings/profile`
- [ ] `/settings/notifications`
- [ ] `/settings/security`
- [ ] `/settings/preferences`

**Organization Settings:**
- [ ] `/settings/users` - Click into 2+ user details
- [ ] `/settings/roles` - Test Permissions, User Roles, Groups tabs
- [ ] `/settings/corporate` - Test Groups, Companies, Company Tabs

**Company Settings (test ALL sub-tabs):**
- [ ] `/settings/company/info`
- [ ] `/settings/company/brand-colors`
- [ ] `/settings/company/documents` - Test Types, Templates, PDF Fields tabs
- [ ] `/settings/company/holidays`
- [ ] `/settings/company/workflows`
- [ ] `/settings/company/connections` - Test Storage, Integrations, Migration tabs
- [ ] `/settings/company/job-setup` - Test Lists, Workflow tabs
- [ ] `/settings/company/entity-config`

**Operations Settings:**
- [ ] `/settings/operations` - Test ALL operation tabs: Schedule Master, SM Tasks, Contact Types, Meeting Types, Supervisor Checklist, Cost

**Other Settings:**
- [ ] `/settings/system`
- [ ] `/settings/developer` - Test Components Lab, Developer Tools, Brand Guidelines, Unreal Engine
- [ ] `/settings/integrations/xero`
- [ ] `/settings/integrations/microsoft`

### Phase 6: Admin System (Test ALL tabs)

- [ ] `/admin/system?tab=gold-standard`
- [ ] `/admin/system?tab=data-warehouse`
- [ ] `/admin/system?tab=pdf-fields`
- [ ] `/admin/system?tab=components` - Components Lab
- [ ] `/admin/system/entity-config` - Test each scope dropdown
- [ ] `/admin/system/schedule-master`
- [ ] `/admin/saas-customers`
- [ ] `/admin/support-tickets`

### Phase 7: Financial Pages (Deep)

- [ ] `/finance` - Bank Feeds tab
- [ ] `/finance` - Reports tab (click into reports)
- [ ] `/finance` - Transactions tab
- [ ] `/finance` - TAS tab
- [ ] `/finance` - EOFY tab
- [ ] `/xero` - All Xero tabs

### Phase 8: Other Pages

- [ ] `/chat`
- [ ] `/notebooks`
- [ ] `/training` - Test all training tabs
- [ ] `/schedule-master` - Test Gantt chart
- [ ] `/public-holidays`
- [ ] `/design-system`
- [ ] `/system-health` - Test all health tabs

## How to Click Into Detail Pages

1. Take snapshot of list page
2. Find clickable rows (look for `link` elements with record names, or `button` elements)
3. Use `mcp__chrome-devtools__click` with the uid
4. Wait for detail page to load (use `wait_for` with expected content)
5. Take new snapshot
6. Check for 500 errors in network and console
7. Click through all tabs on the detail page
8. Navigate back and test another record

Example:
```
# From contacts list, click into a contact
snapshot shows: uid="abc123" link "John Smith" url="/contacts/456"
click uid="abc123"
wait_for "Overview" (tab should appear)
snapshot the detail page
check network for 500s
click each tab: Overview, Photo, Jobs, Documents, Emails, Notes, Activity
```

## How to Test Tabs

1. Take snapshot to identify tab elements (usually `button` or `link` with role="tab")
2. Click each tab uid
3. After each tab click:
   - Wait for content to load
   - Check network for 500 errors
   - Check console for errors
   - Take snapshot to verify content appeared

## Error Logging Format

At the end of testing, produce a detailed error report:

```
=====================================
ERRORS FOUND - TO BE FIXED
=====================================

[ERROR 1] /jobs/123/plans - Plan Preview Button
- Action: Clicked "Preview" button
- Network: 500 on POST /api/v1/job_plans/preview
- Console: "Cannot read property 'data' of null"
- Fix needed: Backend job_plans_controller preview action

[ERROR 2] /contacts/456 - Photo Tab
- Action: Clicked "Photo" tab
- Network: 500 on GET /api/v1/contacts/456
- Error: "NoMethodError - undefined method 'corporate_group'"
- Status: PREVIOUSLY REPORTED - verify fix deployed

[ERROR 3] /settings/company/documents - Templates Tab
- Action: Clicked Templates tab
- Network: 404 on GET /api/v1/document_templates
- Console: No errors
- Fix needed: Missing API endpoint or feature not implemented

=====================================
WARNINGS - Should Review
=====================================

[WARN 1] /finance - Slow Load
- Page took 8 seconds to load
- Many API requests in parallel

=====================================
```

## Success Criteria

- [ ] Every main page loads without 500 errors
- [ ] Every tab on every page is clickable and loads content
- [ ] Every detail page is accessible from list pages
- [ ] Job Plans tab - plan preview button works
- [ ] Contact Photo tab loads correctly
- [ ] All modals open correctly when triggered
- [ ] No console errors (except known/ignored)
- [ ] All settings pages accessible

## Output Format

For each page tested:
```
[PASS/FAIL/WARN] /page-path
  - Console errors: N
  - Network 500s: N
  - Tabs tested: X/Y
  - Notes: Any issues found
```

At completion:
```
========================================
PAGE TESTER RESULTS - STAGING
========================================
URL: https://teeem-staging.vercel.app
Test Started: HH:MM
Test Completed: HH:MM

Total Pages Tested: X
Detail Pages Tested: X
Tabs Tested: X
PASS: X
FAIL: X
WARN: X

FAILURES (must fix):
1. /path - Error description
2. /path - Error description

WARNINGS (should review):
1. /path - Warning description

========================================
ERRORS TO FIX (copy to task list)
========================================
[List each error with actionable fix description]
========================================
```

## Recovery Procedures

**If page hangs:**
- Wait max 20 seconds
- Mark as FAIL with timeout
- Continue to next page

**If clicking fails:**
- Try taking a new snapshot
- If still fails, skip that element
- Continue with next test

**If login required mid-test:**
- Re-navigate to login page
- Re-enter credentials
- Continue testing

**If too many failures:**
- Report all errors found so far
- Continue testing remaining sections
- Do not stop early
