# Production Ready Agent

**Purpose:** EXHAUSTIVE testing of EVERY page, tab, button, and detail view in the TEEEM app using Chrome DevTools MCP to verify production readiness.

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

## 🔴 CRITICAL: Interaction Counter

**You MUST track ALL interactions throughout testing.**

Maintain running counters:
```
PAGES_OPENED: 0      # Full page navigations (URL changes)
TABS_CLICKED: 0      # Tabs within pages (Overview, Plans, Finance, etc.)
SUB_TABS_CLICKED: 0  # Sub-tabs (Finance → Profit/Claims/Expenses)
LINKS_CLICKED: 0     # Links to detail views (clicking into a job/contact)
MODALS_OPENED: 0     # Popups/dialogs (Add, Edit, Confirm, etc.)
DRAWERS_OPENED: 0    # Side panels/sheets
BUTTONS_CLICKED: 0   # Action buttons (Save, Delete, Export, etc.)
```

**Increment the appropriate counter for EVERY interaction.**

At the end, report:
```
========================================
📊 INTERACTION METRICS
========================================
Pages Opened:      XX
Tabs Clicked:      XX
Sub-tabs Clicked:  XX
Links Clicked:     XX
Modals Opened:     XX
Drawers Opened:    XX
Buttons Clicked:   XX
────────────────────────────────────────
TOTAL INTERACTIONS: XXX
========================================
```

**Minimum requirements:**
- Pages: 80+ opened
- Tabs: 50+ clicked
- Modals/Drawers: 10+ tested

## 🔴 CRITICAL: 404 Detection (MANDATORY)

**A Next.js 404 page will:**
- ✅ Navigate "successfully"
- ✅ Make API calls that return 200
- ✅ Show no console errors
- ❌ But display "404" in the page content

**You MUST take a snapshot on EVERY page and check for 404:**

```
After EVERY navigation:
1. Take snapshot
2. Search snapshot for "404" or "not found" or "page could not be found"
3. If found → Mark as FAIL (missing route)
```

**This is NOT optional.** Checking only network requests will miss 404 pages.

## Test Methodology

For each page:
1. Navigate using `mcp__chrome-devtools__navigate_page`
2. **🔴 IMMEDIATELY take snapshot** using `mcp__chrome-devtools__take_snapshot`
3. **🔴 Check snapshot for "404"** - If found, mark FAIL and continue
4. Wait for load using `mcp__chrome-devtools__wait_for` (wait for key content)
5. Check network for 500 errors using `mcp__chrome-devtools__list_network_requests` with `resourceTypes: ["fetch", "xhr"]`
6. Check console for errors using `mcp__chrome-devtools__list_console_messages` with `types: ["error"]`
7. **For pages with tabs:** Click EACH tab and repeat checks
8. **For list pages:** Click into records to test detail views
9. **For detail pages:** Click EVERY tab
10. **Increment PAGES_OPENED counter**
11. Log all errors with specific paths for fixing

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
PRODUCTION READY CHECK - STAGING
========================================
URL: https://teeem-staging.vercel.app
Test Completed: YYYY-MM-DD HH:MM

========================================
📊 COVERAGE METRICS
========================================
Pages Opened:    XX
Pages Required:  100+
Coverage:        XX%
Status:          [PASS if >=80% / FAIL if <80%]

========================================
📋 RESULTS SUMMARY
========================================
PASS: XX
FAIL: XX (500 errors, 404 pages, broken features)
WARN: XX

========================================
❌ FAILURES (must fix)
========================================
[ERROR 1] /path - Type (500/404/broken)
  - What: Description of error
  - Fix: What needs to be done

[ERROR 2] /path - Type
  - What: Description
  - Fix: Action needed

========================================
⚠️ WARNINGS (should review)
========================================
[WARN 1] /path - Description

========================================
📄 PAGES BY SECTION
========================================

PHASE 1 - JOBS (Deep Test)
Pages: X | Tabs: X | Sub-tabs: X | Links: X | Modals: X | Drawers: X
  [PASS] /jobs (list)
  [PASS] /jobs/46 (detail)
    → Tabs: Overview ✓, Contract Info ✓, Plans ✓, People ✓, Finance ✓, Documents ✓, Schedule ✓
    → Sub-tabs: Finance → Profit ✓, Claims ✓, Expenses ✓
    → Modals: Add Contact ✓, Edit Job ✓
    → Drawers: Job Details ✓
  [FAIL] /jobs/46/documents - 500
  Missing: /jobs/46/tasks, /jobs/46/notes

PHASE 2 - CONTACTS (Deep Test)
Pages: X | Tabs: X | Sub-tabs: X | Links: X | Modals: X | Drawers: X
  [PASS] /contacts (list)
  [PASS] /contacts/1331 (detail)
    → Tabs: Overview ✓, Photo ✓, Jobs ✓, Emails ✓
    → Modals: Edit Contact ✓, Add Relationship ✓
  [FAIL] /contacts/1331/documents - 500
  Missing: /contacts/1331/activity, /contacts/1331/notes

PHASE 3 - MAIN PAGES
Pages: X | Tabs: X | Sub-tabs: X | Links: X | Modals: X | Drawers: X
  [PASS] /dashboard
    → Tabs: Overview ✓, Competitor Comparison ✓, Architecture ✓
  [PASS] /tasks
    → Links: Clicked into 2 tasks
    → Tabs: Details ✓, Comments ✓
  [PASS] /calendar
    → Modals: Event modal ✓
  [PASS] /email
    → Tabs: Inbox ✓, Sent ✓
    → Links: Clicked into 2 emails
  [PASS] /finance
    → Tabs: Bank Feeds ✓, Reports ✓, Transactions ✓, TAS ✓, EOFY ✓
  Missing: /meetings, /portal, /pricebook, /documents, /workflows

PHASE 4 - CORPORATE
Pages: X | Tabs: X | Sub-tabs: X | Links: X | Modals: X | Drawers: X
  [PASS] /corporate
  [FAIL] /corporate/companies - 404 (missing route)
  [PASS] /corporate/groups
    → Links: Clicked into 2 company groups
    → Tabs: Overview ✓, Companies ✓, People ✓
  [PASS] /corporate/people
    → Links: Clicked into 2 people
  Missing: /corporate/assets, /corporate/structure, /corporate/memberships

PHASE 5 - SETTINGS
Pages: X | Tabs: X | Sub-tabs: X | Links: X | Modals: X | Drawers: X
  [PASS] /settings/profile
  [PASS] /settings/users
    → Links: Clicked into 2 user details
    → Modals: Edit user ✓
  [PASS] /settings/roles
    → Tabs: Permissions ✓, User Roles ✓, Groups ✓
  [PASS] /settings/company/info
  [PASS] /settings/company/connections
    → Sub-tabs: Storage ✓, Integrations ✓, Migration ✓
  Missing: /settings/notifications, /settings/security, /settings/company/documents

PHASE 6 - ADMIN
Pages: X | Tabs: X | Sub-tabs: X | Links: X | Modals: X | Drawers: X
  [PASS] /admin/system?tab=gold-standard
  [PASS] /admin/system?tab=components
    → Buttons: Component interactions ✓
  [PASS] /admin/system/entity-config
    → Tabs: Each scope dropdown tested ✓
  Missing: /admin/saas-customers, /admin/support-tickets

PHASE 7 - FINANCE (Deep Test)
Pages: X | Tabs: X | Sub-tabs: X | Links: X | Modals: X | Drawers: X
  [PASS] /finance
    → Tabs: Bank Feeds ✓, Reports ✓, Transactions ✓, TAS ✓, EOFY ✓
    → Links: Clicked into reports
  [PASS] /xero
    → Tabs: All Xero tabs ✓
  Missing: Finance report details

PHASE 8 - OTHER PAGES
Pages: X | Tabs: X | Sub-tabs: X | Links: X | Modals: X | Drawers: X
  [PASS] /chat
  [PASS] /whs
    → Tabs: All WHS tabs ✓
  [PASS] /schedule-master
    → Modals: Task details ✓
    → Drawers: Resource panel ✓
  [PASS] /data-warehouse
    → Tabs: All warehouse tabs ✓
  Missing: /notebooks, /training, /design-system

========================================
📊 SECTION SUMMARY
========================================
| Section      | Pages | Tabs | Sub-tabs | Links | Modals | Drawers |
|--------------|-------|------|----------|-------|--------|---------|
| Jobs         | X     | X    | X        | X     | X      | X       |
| Contacts     | X     | X    | X        | X     | X      | X       |
| Main Pages   | X     | X    | X        | X     | X      | X       |
| Corporate    | X     | X    | X        | X     | X      | X       |
| Settings     | X     | X    | X        | X     | X      | X       |
| Admin        | X     | X    | X        | X     | X      | X       |
| Finance      | X     | X    | X        | X     | X      | X       |
| Other        | X     | X    | X        | X     | X      | X       |
|--------------|-------|------|----------|-------|--------|---------|
| TOTAL        | XX    | XX   | XX       | XX    | XX     | XX      |
| Required     | 80+   | 50+  | 20+      | 30+   | 10+    | 5+      |
| Status       | ✓/✗   | ✓/✗  | ✓/✗      | ✓/✗   | ✓/✗    | ✓/✗     |

========================================
📊 TOTAL INTERACTIONS
========================================
Pages + Tabs + Sub-tabs + Links + Modals + Drawers + Buttons = XXX

Minimum Required: 200+
Status: [PASS/FAIL]
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
