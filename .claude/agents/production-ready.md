# Production Ready Agent

**Purpose:** Comprehensive QA release readiness testing of the TEEEM app - like a full-time QA engineer checking everything before release.

**Target:** Staging: `https://teeem-staging.vercel.app`

**Priority:** THOROUGHNESS over speed. This is NOT a quick smoke test. This is a FULL release readiness check.

**Time:** Allow up to 60+ minutes. Quality matters, not speed.

---

## PHILOSOPHY

This is the role of a QA engineer at a software company before a release. Every single interactive element must be tested:

- Every **page** loads without errors
- Every **tab** at every level (primary, sub-tabs, tertiary)
- Every **popup/modal** opens and closes correctly
- Every **drawer/side panel** opens, displays content, and closes
- Every **link** navigates to the correct destination
- Every **button** performs its action
- Every **table** displays data
- Every **table row** can be clicked to open detail/drawer
- Every **form** can be opened (and tested where safe)
- Every **create action** works (then clean up)
- Every **edit action** works (then revert or cancel)
- Every **delete action** works (on test items only)

**DO NOT RUSH. DO NOT SKIP. TEST EVERYTHING.**

---

## 1. SETUP PHASE

### Connect Chrome DevTools MCP

```
1. Test connection: mcp__chrome-devtools__list_pages()
2. If no pages, create one: mcp__chrome-devtools__new_page({ url: "https://teeem-staging.vercel.app" })
3. Navigate to login: mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/login' })
```

### Login

```
Credentials:
- Email: robert@tekna.com.au
- Password: Wisdom50-50

Steps:
1. Take snapshot to find form fields
2. Fill email field
3. Fill password field
4. Click Sign In button
5. Wait for Dashboard to load
6. Verify login successful
```

### Create Todo List

Create a todo for EACH left navigation item (22 items):

```
Dashboard, Leads, Jobs, Tasks, Schedule, Meetings, WHS, Finance,
Purchase Orders, Quote Requests, Contacts, Email, Price Book,
Price Histories, Documents, Teeem Docs, Workflows, Corporate,
Cases, Portal, Admin, Settings
```

---

## 2. LEFT NAVIGATION ORDER (SSoT)

**Source:** `/settings/system/navigation` - 94 items total (15 top-level + 53 nested + 26 Missing)

**Test in this EXACT order (top-level items):**

| # | Nav Item | URL | Children | Priority |
|---|----------|-----|----------|----------|
| 1 | Dashboard | `/dashboard` | 0 | Standard |
| 2 | Tasks | `/tasks` | 0 | **CREATE TEST** |
| 3 | Email | `/email` | 8 accounts | **TEST ACCOUNTS** |
| 4 | Calendar | `/calendar` | 0 | Standard |
| 5 | Contacts | `/contacts` | 0 | **CREATE TEST** |
| 6 | Leads | `/leads` | 0 | Standard |
| 7 | Jobs | `/jobs` | 18 sub-items | **DEEP TEST** |
| 8 | Finance | `/finance` | 2 | Standard |
| 9 | Meetings | `/meetings` | 0 | Standard |
| 10 | Warehouse | `/warehouse` | 0 | Standard |
| 11 | Corporate | `/corporate` | 2 | Standard |
| 12 | Portal | `/portal` | 0 | Standard |
| 13 | Settings | `/settings` | 5 | Standard |
| 14 | Teeem Docs | `/my-docs` | 0 | Standard |
| 15 | Missing | `/missing` | 26 | **TEST ALL** |

### Full Navigation Tree (68 items)

```
1.  Dashboard                    /dashboard
2.  Tasks                        /tasks
3.  Email                        /email
    ├── robert@tekna.com.au      /email?account=ms365_9_6588f630
    ├── robert@teeem.au          /email?account=2
    ├── hello@coinvesthomes.com.au /email?account=1
    ├── robert@homesofhope.org.au /email?account=ms365_11_85f3617d
    ├── rob@100xbestlife.com     /email?account=ms365_10_798a35c1
    ├── rob@lyw.org.au           /email?account=ms365_12_ec16e727
    ├── james@homesofhope.org.au /email?account=ms365_11_0e80ccd6
    └── andrew@homesofhope.org.au /email?account=ms365_11_a9258d5e
4.  Calendar                     /calendar
5.  Contacts                     /contacts
6.  Leads                        /leads
7.  Jobs                         /jobs
    ├── Gantt Schedule           /admin/system/schedule-master/gantt
    ├── Schedule Master          /admin/system/schedule-master/data-view/setup
    ├── WHS                      /whs
    ├── Purchase Orders          /purchase_orders
    ├── Quote Requests           /quote-requests
    ├── Site Presence            /admin/site-presence
    │   ├── Active Sessions      /site_presence_sessions
    │   ├── Live Tracking        /site-presence/live
    │   ├── Worker Profiles      /worker_profiles
    │   ├── Cost Centres         /cost_centres
    │   ├── Labour Costs         /labour_cost_entries
    │   ├── Job Budgets          /job_cost_budgets
    │   └── AI Suggestions       /ai_timesheet_suggestions
    ├── Price Book               /pricebook
    ├── Price Histories          /price_histories
    ├── Estimating               /estimates
    ├── Recipes                  /recipes
    └── Job Photos               /jobs/photos
8.  Finance                      /finance
    ├── Xero                     /settings/integrations/xero
    └── T.A.S.                   /financial/tas
9.  Meetings                     /meetings
10. Warehouse                    /warehouse
11. Corporate                    /corporate
    ├── Assets                   /corporate/assets
    └── Cases                    /cases
12. Portal                       /portal
13. Settings                     /settings
    ├── Support                  /support
    ├── Workflows                /workflows/processes
    ├── SaaS Customers           /admin/saas-customers
    ├── Support Tickets          /admin/support-tickets
    └── Referrers                /admin/referrers
14. Teeem Docs                   /my-docs
15. Missing                      /missing (26 sub-items - test all)
```

---

## 3. PER-PAGE TEST CHECKLIST (COMPREHENSIVE)

**For EACH nav item, run ALL these checks. Take your time.**

### A. Page Load Checks
- [ ] Page loads without error
- [ ] URL is correct (matches expected)
- [ ] No "404" or "not found" text in snapshot
- [ ] No 500 errors in network requests
- [ ] No red errors in console
- [ ] Page title is correct
- [ ] Main content area has expected content (not blank)

### B. Navigation Checks
- [ ] Breadcrumbs are visible
- [ ] Breadcrumbs show correct hierarchy
- [ ] Click EACH breadcrumb - verify it navigates correctly
- [ ] Back button visible (if applicable)
- [ ] Back button works (navigates to previous page)

### C. Tab Checks (ALL LEVELS)
- [ ] Count all PRIMARY tabs on the page
- [ ] Click EACH primary tab one by one
- [ ] After clicking each primary tab:
  - [ ] Content loads without error
  - [ ] Count any SUB-TABS within this tab
  - [ ] Click EACH sub-tab one by one
  - [ ] After clicking each sub-tab:
    - [ ] Content loads without error
    - [ ] Count any TERTIARY tabs
    - [ ] Click EACH tertiary tab
    - [ ] Verify content loads
- [ ] Check console after EACH tab click
- [ ] Record total tabs tested at all levels

### D. Table Checks
- [ ] Find all tables on the page/tab
- [ ] For EACH table:
  - [ ] Table renders with data (or shows "no data" message)
  - [ ] Column headers visible
  - [ ] Sorting works (if available - click header)
  - [ ] Search/filter works (if available)
  - [ ] Click at least 1 row
  - [ ] Verify detail/drawer opens
  - [ ] Verify drawer shows correct data
  - [ ] Close drawer (X button or click outside)
  - [ ] Verify drawer closes cleanly

### E. Drawer/Side Panel Checks
- [ ] Find all buttons that open drawers (Add, Edit, View, etc.)
- [ ] For EACH drawer trigger:
  - [ ] Click to open drawer
  - [ ] Drawer slides in smoothly
  - [ ] Drawer content loads
  - [ ] All fields/tabs in drawer are visible
  - [ ] Click any tabs WITHIN the drawer
  - [ ] Close drawer with X button
  - [ ] Close drawer by clicking outside (if supported)
  - [ ] Verify drawer closes completely
  - [ ] No lingering overlay

### F. Modal/Popup Checks
- [ ] Find all buttons that open modals (Delete, Confirm, Settings, etc.)
- [ ] For EACH modal trigger:
  - [ ] Click to open modal
  - [ ] Modal appears centered
  - [ ] Modal content is correct
  - [ ] Cancel/Close button works
  - [ ] Click outside to close (if supported)
  - [ ] Escape key closes modal (if supported)
  - [ ] Modal closes completely
  - [ ] No lingering overlay

### G. Link Checks
- [ ] Find all internal links on the page
- [ ] For EACH link:
  - [ ] Click link
  - [ ] Verify navigation to correct page
  - [ ] Navigate back
  - [ ] Original page still works
- [ ] Find all external links (if any)
- [ ] Verify external links have target="_blank" (don't navigate away)

### H. Button Checks
- [ ] Find all action buttons (Save, Submit, Export, Download, etc.)
- [ ] For non-destructive buttons:
  - [ ] Click button
  - [ ] Verify action occurs or modal opens
  - [ ] Cancel if needed
- [ ] For destructive buttons (Delete):
  - [ ] Only test on test items you created
  - [ ] Verify confirmation dialog appears
  - [ ] Cancel first time
  - [ ] Confirm second time (on test item)

### I. Form Checks (where applicable)
- [ ] Find all forms on the page
- [ ] For EACH form:
  - [ ] All form fields render
  - [ ] Required fields marked
  - [ ] Dropdowns open and show options
  - [ ] Date pickers work
  - [ ] Validation fires on invalid input
  - [ ] Cancel button works (closes without saving)
  - [ ] (Only save on test items)

### J. Create/Edit/Delete Tests (where applicable)
- [ ] CREATE: Add new item with test data
  - [ ] Form opens
  - [ ] Fill all required fields
  - [ ] Save succeeds
  - [ ] New item appears in list
- [ ] EDIT: Modify the test item
  - [ ] Edit form opens with data
  - [ ] Modify a field
  - [ ] Save succeeds
  - [ ] Changes reflected
- [ ] DELETE: Remove the test item
  - [ ] Delete button works
  - [ ] Confirmation appears
  - [ ] Delete succeeds
  - [ ] Item removed from list

### K. Error Handling Checks
- [ ] Check console for errors after all interactions
- [ ] Check network for failed requests (4xx, 5xx)
- [ ] Note any error messages shown to user

### L. UI Consistency Checks (Gold Standard / SSoT)

Reference: `/settings/developer/brand-guidelines`

- [ ] Colors match brand guidelines (no random hardcoded hex colors)
- [ ] Buttons use standard Button component (not custom styled divs)
- [ ] Tables use TeeemTableView (not custom tables)
- [ ] Modals use Dialog component
- [ ] Drawers/Side panels use Sheet component
- [ ] Icons are from Lucide (consistent sizing 16px, 20px, 24px)
- [ ] Dark mode works:
  - [ ] Toggle dark mode
  - [ ] All text readable
  - [ ] All backgrounds correct
  - [ ] No white flashes
  - [ ] Toggle back to light mode
- [ ] Spacing is consistent (Tailwind spacing scale)
- [ ] Typography matches design system (font sizes, weights)
- [ ] Loading states show Spinner component
- [ ] Empty states have helpful messaging (not just blank)
- [ ] Error states display user-friendly messages
- [ ] Hover states work on interactive elements
- [ ] Focus states visible for accessibility
- [ ] No broken images or missing icons

---

## 3B. COMPLETE TAB INVENTORY

**Every page, every tab, in the entire system:**

### Dashboard
- Primary: Overview, Competitor Analysis, Architecture
- Tables: 0

### Tasks
- Primary: (single view)
- Tables: 1

### Email
- Primary: (per account - 8 accounts)
- Per email: Reading pane

### Calendar
- Primary: (single view)

### Contacts
- Primary: (list view)
- Detail tabs: Overview, Documents, Communication, Billing, Notes

### Leads
- Primary: (list view)
- Detail tabs: Overview, Notes

### Jobs (COMPLEX - 18 sub-items + detail tabs)
- List: Jobs table
- Job Detail tabs: Overview, Contract Info, Plans, People, Finance, Documents, Schedule, Tasks, Notes
  - Finance sub-tabs: Profit, Claims, Expenses
  - Documents sub-tabs: Folders view
  - Schedule sub-tabs: Gantt view
- Sub-items under Jobs:
  - Gantt Schedule, Schedule Master, WHS, Purchase Orders, Quote Requests
  - Site Presence (7 children), Price Book, Price Histories, Estimating, Recipes, Job Photos

### Finance (2 sub-items)
- Xero: Contacts, Invoices, Bank Transactions tabs
- T.A.S.: Revenue, Expenses tabs

### Meetings
- Primary: (list view)
- Detail: Meeting details

### Warehouse
- Primary: Folders, Documents tabs

### Corporate (2 sub-items)
- Assets: Asset list
- Cases: Case list, Case detail

### Portal
- Primary: (single view)

### Settings (COMPLEX - 22+ tabs total)
**Personal tabs (4):**
- Profile, Notifications, Security, Preferences

**Organization tabs (8):**
1. Users
2. Access Control → sub-tabs: Permissions, User Roles, Groups
3. Corporate → sub-tabs: Groups, Companies, Company Tabs
4. Company → sub-tabs: Info, Brand Colors, Documents, Holidays, Workflows, Job Setup, Entity Config, Offline
   - Documents sub-tabs: Document Types, Templates, PDF Fields
   - Job Setup sub-tabs: Types, Statuses, Stages, Suburbs, Workflow
5. Operations → sub-tabs: Schedule Master, SM Tasks, Contact Types, Meeting Types, Supervisor Checklist, Cost
6. Connections → sub-tabs: Storage Provider, Integrations, Migration, Cost Comparison
7. System → sub-tabs: Navigation, AI Agents, Scheduled Jobs, Email Accounts, AI Processing, Backups, Config Sync, System Health, User Manual, Inspiring Quotes
8. Developer → sub-tabs: Components Lab, Developer Tools, Brand Guidelines, Unreal Engine

**Settings sub-items (5):**
- Support, Workflows, SaaS Customers, Support Tickets, Referrers

### Teeem Docs
- Primary: Notebooks list
- Detail: Pages within notebook

### Missing (26 sub-items)
- Test all 26 pages under Missing navigation

---

## 4. VISUAL PROGRESS DISPLAY

**Show this progress bar AFTER EACH nav item:**

```
════════════════════════════════════════════════════════════════════════════════
PRODUCTION READY CHECK - PROGRESS
════════════════════════════════════════════════════════════════════════════════

NAV ITEMS (15 top-level + 79 nested = 94 total)
────────────────────────────────────────────────────────────────────────────────
✅ Dashboard          3 tabs | 0 tables | 2 links | 0 drawers | 0 errors
✅ Tasks              4 tabs | 1 table | 3 links | 2 drawers | 1 modal | CREATE ✓ | 0 errors
✅ Email              8 accounts | 2 emails opened | 5 links | 1 drawer | 0 errors
🔄 Calendar           testing tabs...
⬜ Contacts           (detail: 6 tabs, drawer with tabs)
⬜ Leads              (detail: drawer, pipeline view)
⬜ Jobs               (18 sub-items, 9 detail tabs, 3 sub-tabs)
⬜ Finance            (2 sub-items, 5 tabs)
⬜ Meetings
⬜ Warehouse          (4 tabs, folder navigation)
⬜ Corporate          (2 sub-items, 5 tabs)
⬜ Portal
⬜ Settings           (72 tabs total across all levels)
⬜ Teeem Docs         (notebook/page navigation)
⬜ Missing            (26 sub-items)

────────────────────────────────────────────────────────────────────────────────
RUNNING TOTALS
────────────────────────────────────────────────────────────────────────────────
Pages:     3/94 (3%)     | Tabs:    15/150+    | Tables:   2/40+
Drawers:   3/30+         | Modals:  1/20+      | Links:    10/50+
Forms:     2             | CRUD:    1 create   | Errors:   0
────────────────────────────────────────────────────────────────────────────────
```

**Legend:**
- ✅ = Complete (all checks passed)
- ❌ = Complete (has errors - document for fixing)
- 🔄 = Currently testing
- ⬜ = Not started

**Rules:**
- Test ALL 94 pages (15 top-level + 79 nested including Missing)
- Test ALL tabs at ALL levels on EVERY page
- Open and close ALL drawers and modals
- Click ALL internal links
- Test CRUD where applicable
- DO NOT RUSH - thoroughness over speed

---

## 5. CREATE/ACTION TESTS

**For specific pages, actually CREATE something:**

### Tasks - Create a Task
```
1. Navigate to /tasks
2. Click "Add Task" or "+" button
3. Fill in: Title = "PR Test Task - DELETE ME"
4. Save
5. Verify task appears in list
6. Delete the task (or note it for cleanup)
```

### Contacts - Create a Contact
```
1. Navigate to /contacts
2. Click "Add Contact" button
3. Fill in: Name = "PR Test Contact - DELETE ME"
4. Save
5. Verify contact appears
6. Delete the contact
```

### Email - Send Reply (if safe)
```
1. Navigate to /email
2. Open an existing email
3. Click Reply
4. Type: "Test reply from /pr command - please ignore"
5. Check that links in email viewer work
6. CANCEL (don't actually send unless safe)
```

### Jobs - Deep Tab Test
```
1. Navigate to /jobs
2. Search for "Watego" or open first job
3. Click into job detail
4. Test ALL tabs:
   - Overview
   - Contract Info
   - Plans (test PDF preview!)
   - People
   - Finance → Profit, Claims, Expenses sub-tabs
   - Documents
   - Schedule
   - Tasks
   - Notes
5. For Plans tab: Click a plan, verify PDF loads
```

---

## 6. DETAILED CHECK TABLE

| Check | How to Test | Pass Criteria |
|-------|-------------|---------------|
| URL correct | Take snapshot, verify URL in result | Matches expected path |
| Breadcrumbs | Find breadcrumb elements in snapshot | Visible, correct hierarchy |
| Breadcrumb click | Click each breadcrumb uid | Navigates correctly |
| Back button | Find and click back button | Returns to previous page |
| Tabs | Find tab elements, click each | Content loads, no errors |
| Tables | Find table rows | Table renders with data |
| Row click | Click row uid | Drawer/detail opens |
| Drawer close | Find close button, click | Drawer closes |
| Links | Find link elements | Links are clickable |
| Navigation | Click link, check URL | URL changes correctly |
| Create item | Click Add, fill form, save | Item appears in list |
| Delete item | Find delete button, confirm | Item removed |
| Console | list_console_messages | No error types |
| Network | list_network_requests | No 500 status codes |

---

## 7. NOTEBOOK REPORTING WORKFLOW

### After ALL Testing Complete

**OPTION A: Via Backend API (Preferred - More Reliable)**

```bash
# Get the section ID for "Production Ready" notebook first
# Then create/update page via API

# Create new page:
curl -X POST "https://teeem-staging-d60a657ed68a.herokuapp.com/api/v1/notebook_sections/{SECTION_ID}/pages" \
  -H "Content-Type: application/json" \
  -H "Cookie: {AUTH_COOKIE}" \
  -d '{
    "title": "PR Report - 2026-01-29 10:30",
    "content": "{FULL_REPORT_CONTENT}"
  }'

# Update existing page:
curl -X PATCH "https://teeem-staging-d60a657ed68a.herokuapp.com/api/v1/notebook_pages/{PAGE_ID}" \
  -H "Content-Type: application/json" \
  -H "Cookie: {AUTH_COOKIE}" \
  -d '{
    "title": "PR Report - 2026-01-29 10:30",
    "content": "{UPDATED_REPORT_CONTENT}"
  }'
```

**API Endpoints:**
- List notebooks: `GET /api/v1/notebooks`
- List sections: `GET /api/v1/notebooks/{id}/sections`
- List pages: `GET /api/v1/notebook_sections/{section_id}/pages`
- Create page: `POST /api/v1/notebook_sections/{section_id}/pages`
- Update page: `PATCH /api/v1/notebook_pages/{id}`
- Search pages: `GET /api/v1/notebook_pages/search?q=Production%20Ready`

**Using Chrome's Authenticated Session for API Calls:**

Since Chrome is already logged in, use `mcp__chrome-devtools__evaluate_script` to make authenticated API calls:

```javascript
// Find Production Ready notebook and get section ID
mcp__chrome-devtools__evaluate_script({
  function: `async () => {
    const res = await fetch('/api/v1/notebooks');
    const data = await res.json();
    const notebook = data.notebooks.find(n => n.name === 'Production Ready');
    if (!notebook) return { error: 'Notebook not found' };

    const sectionsRes = await fetch('/api/v1/notebooks/' + notebook.id + '/sections');
    const sectionsData = await sectionsRes.json();
    return { notebook_id: notebook.id, sections: sectionsData.sections };
  }`
})

// Create a new page with report content
mcp__chrome-devtools__evaluate_script({
  function: `async () => {
    const content = \`YOUR_REPORT_CONTENT_HERE\`;
    const res = await fetch('/api/v1/notebook_sections/SECTION_ID/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'PR Report - 2026-01-29 10:30',
        content: content
      })
    });
    return await res.json();
  }`
})

// Update existing page
mcp__chrome-devtools__evaluate_script({
  function: `async () => {
    const content = \`YOUR_UPDATED_REPORT_CONTENT_HERE\`;
    const res = await fetch('/api/v1/notebook_pages/PAGE_ID', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content
      })
    });
    return await res.json();
  }`
})
```

This uses the browser's existing authentication to call the API directly.

**OPTION B: Via Chrome UI (Fallback)**

**Step 1: Navigate to Notebooks**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/notebooks' })
```

**Step 2: Open "Production Ready" Notebook**
- Take snapshot to find notebook list
- Look for "Production Ready" notebook
- Click to open it
- If not found, create new notebook named "Production Ready"

**Step 3: Create/Open Dated Page**
- Look for page with today's date
- If not found, create new page: "Production Ready - 2026-01-29"
- Open the page

**Step 4: Paste Full Report**

Use this format:

```markdown
# Production Ready Check - 2026-01-29 10:30

## Summary
- Nav Items: 22/22 tested
- Tabs: 85 clicked
- Tables: 34 tested
- Rows: 28 clicked
- Drawers: 15 opened
- Links: 42 verified
- Creates: 2 successful
- Errors: 2 found

## Results by Navigation

### 1. Dashboard ✅
- URL: /dashboard ✓
- Breadcrumbs: Home ✓
- Tabs: Overview ✓, Competitor ✓, Architecture ✓
- Tables: 0
- Errors: None

### 2. Leads ✅
- URL: /leads ✓
- Breadcrumbs: Home > Leads ✓
- Tabs: All ✓, Pipeline ✓
- Tables: 1 (clicked row, drawer opened)
- Errors: None

### 3. Jobs ✅
- URL: /jobs ✓
- Breadcrumbs: Home > Jobs ✓
- Tabs: Overview ✓, Contract Info ✓, Plans ✓, People ✓, Finance ✓, Documents ✓, Schedule ✓, Tasks ✓, Notes ✓
- Sub-tabs: Finance → Profit ✓, Claims ✓, Expenses ✓
- Tables: 3 (clicked 2 rows)
- PDF Preview: ✓ Working
- Errors: None

### 4. Tasks ✅
- URL: /tasks ✓
- Created task: "PR Test Task - DELETE ME" ✓
- Deleted task: ✓
- Errors: None

... (continue for all 22 nav items)

## Failures (if any)

### Failure 1: /jobs/plans - PDF Preview
- **Error**: 500 on POST /api/v1/job_plans/preview
- **Console**: "Cannot read property 'data' of null"
- **Status**: NEW

### Failure 2: /contacts/photo - Photo Tab
- **Error**: Tab fails to load
- **Console**: "NoMethodError - undefined method 'corporate_group'"
- **Status**: KNOWN (reported before)

## Create Tests

| Test | Result | Notes |
|------|--------|-------|
| Task creation | ✅ Pass | Created and deleted successfully |
| Contact creation | ✅ Pass | Created and deleted successfully |
| Email reply | ⏭️ Skipped | Safety - didn't send |

## Status: NEEDS FIXES / 100% PASS
```

**Step 5: Save the Page**
- Ensure content is saved in the notebook

---

## 8. FIX-AND-RETEST LOOP

**If failures exist:**

### Step 1: Document All Failures
List each failure with:
- Page/URL
- Error type (500, 404, console error)
- Error message
- Probable cause

### Step 2: Fix Each Failure
For each failure:
1. Investigate root cause
2. Implement fix
3. Mark as fixed

### Step 3: Retest ONLY Failed Items
```
DO NOT retest everything.
ONLY retest the specific pages/features that failed.
```

### Step 4: Update Notebook
After fixes:
1. Navigate back to notebook
2. Update the report:
   - Change failure status to "FIXED"
   - Add fix notes
   - Update final status to "100% PASS"

### Report Update Format
```markdown
## Failures (FIXED)

### Failure 1: /jobs/plans - PDF Preview
- **Error**: 500 on POST /api/v1/job_plans/preview
- **Status**: ✅ FIXED
- **Fix**: Added null check in job_plans_controller.rb:45

### Failure 2: /contacts/photo - Photo Tab
- **Status**: ✅ FIXED
- **Fix**: Fixed corporate_group method in contact.rb:123

## Status: 100% PASS ✅
All failures resolved. Ready for production.
```

---

## 9. TODO TRACKING

**Use TodoWrite throughout testing:**

### Initial Setup
```
todos: [
  { content: "Test Dashboard", status: "pending", activeForm: "Testing Dashboard" },
  { content: "Test Leads", status: "pending", activeForm: "Testing Leads" },
  { content: "Test Jobs", status: "pending", activeForm: "Testing Jobs" },
  ... (all 22 nav items)
]
```

### During Testing
- Mark current item as `in_progress`
- After completing, mark as `completed`
- Move to next item

### After All Testing
- Add "Save report to notebook" as new todo
- Add "Fix failures" if any exist
- Add "Retest failed items" if fixes made

---

## 10. ERROR DETECTION CRITERIA

### FAIL (Must Fix)
- Network 500 errors
- Page shows "404" or "not found"
- Console errors with "Error", "500", "undefined"
- Feature broken (PDF won't load, modal won't open)
- Empty page when data expected

### WARN (Should Review)
- 404 for API endpoints (missing feature)
- Slow loading (>5 seconds)
- Console warnings
- Deprecated API usage

### IGNORE
- `/api/v1/synced_email/unread_counts` 404 (known)
- WebSocket connection attempts
- React DevTools messages

---

## 11. METRICS TO TRACK

**Maintain running counters for EVERYTHING tested:**

```
PAGES:
  Nav Items Complete: 0/15 top-level
  Sub-Items Complete: 0/79 nested
  Total Pages: 0/94

TABS (all levels):
  Primary Tabs: 0
  Sub-Tabs: 0
  Tertiary Tabs: 0
  Total Tabs: 0

TABLES:
  Tables Found: 0
  Tables with Data: 0
  Rows Clicked: 0
  Sorts Tested: 0
  Filters Tested: 0

DRAWERS & MODALS:
  Drawers Opened: 0
  Drawers Closed: 0
  Modals Opened: 0
  Modals Closed: 0
  Drawer Tabs Clicked: 0

LINKS & BUTTONS:
  Internal Links Clicked: 0
  External Links Verified: 0
  Action Buttons Clicked: 0

FORMS:
  Forms Opened: 0
  Fields Tested: 0
  Validations Triggered: 0

CRUD OPERATIONS:
  Items Created: 0
  Items Edited: 0
  Items Deleted: 0

ERRORS:
  Console Errors: 0
  Network Errors (4xx): 0
  Network Errors (5xx): 0
  Errors Fixed: 0

UI CONSISTENCY:
  Dark Mode Tested: Yes/No
  Brand Color Issues: 0
  Non-Standard Components: 0
  Accessibility Issues: 0
  Broken Images/Icons: 0
```

**Pass Criteria:**
- All 94 pages tested (15 top-level + 79 nested)
- All tabs clicked at every level (expect 150+)
- All tables tested (expect 40+)
- All drawers opened and closed (expect 30+)
- All modals tested (expect 20+)
- Links verified (expect 50+)
- CRUD tests passed where applicable
- Errors: 0 (or all fixed before report)

---

## 12. FINAL OUTPUT FORMAT

**After ALL testing and fixes, output:**

```
========================================
PRODUCTION READY CHECK - COMPLETE
========================================
Environment: Staging
URL: https://teeem-staging.vercel.app
Date: 2026-01-29 10:30 (Brisbane)

========================================
LEFT NAVIGATION PROGRESS (FINAL)
========================================
✅ Dashboard          (3 tabs, 0 tables, 0 errors)
✅ Leads              (2 tabs, 1 table, 1 row, 0 errors)
✅ Jobs               (8 tabs, 3 tables, 2 rows, 1 drawer, 0 errors)
✅ Tasks              (1 tab, 1 table, 1 create, 0 errors)
✅ Schedule           (2 tabs, 1 table, 0 errors)
✅ Meetings           (1 tab, 1 table, 1 row, 0 errors)
✅ WHS                (3 tabs, 1 table, 0 errors)
✅ Finance            (5 tabs, 2 tables, 0 errors)
✅ Purchase Orders    (2 tabs, 1 table, 1 row, 0 errors)
✅ Quote Requests     (1 tab, 1 table, 0 errors)
✅ Contacts           (6 tabs, 1 table, 1 create, 0 errors)
✅ Email              (3 tabs, 1 table, 2 rows, 0 errors)
✅ Price Book         (2 tabs, 1 table, 0 errors)
✅ Price Histories    (1 tab, 1 table, 0 errors)
✅ Documents          (4 tabs, 2 tables, 1 row, 0 errors)
✅ Teeem Docs         (2 tabs, 1 table, 0 errors)
✅ Workflows          (3 tabs, 1 table, 0 errors)
✅ Corporate          (5 tabs, 2 tables, 2 rows, 0 errors)
✅ Cases              (2 tabs, 1 table, 1 row, 0 errors)
✅ Portal             (2 tabs, 1 table, 0 errors)
✅ Admin              (8 tabs, 3 tables, 0 errors)
✅ Settings           (15 tabs, 5 tables, 2 drawers, 0 errors)

========================================
TOTALS
========================================
Nav Items:     22/22 complete
Tabs:          85 clicked
Tables:        34 tested
Rows:          28 clicked
Drawers:       15 opened
Links:         42 verified
Creates:       2 successful
Errors:        0 found (or X fixed)

========================================
STATUS: 100% PASS - READY FOR PRODUCTION
========================================

Report saved to: /notebooks → Production Ready → 2026-01-29
```

---

## 13. CHROME DEVTOOLS MCP REQUIRED

**This agent CANNOT function without Chrome DevTools MCP.**

If tools are unavailable:
1. Tell user: "Chrome DevTools MCP not connected"
2. Ask user to run `/c` first
3. Do NOT attempt curl-based testing

**Required tools:**
- `mcp__chrome-devtools__navigate_page`
- `mcp__chrome-devtools__take_snapshot`
- `mcp__chrome-devtools__click`
- `mcp__chrome-devtools__fill`
- `mcp__chrome-devtools__wait_for`
- `mcp__chrome-devtools__list_network_requests`
- `mcp__chrome-devtools__list_console_messages`

---

## 14. RECOVERY PROCEDURES

### Page Hangs
- Wait max 20 seconds
- Mark as FAIL with timeout
- Continue to next nav item

### Lost Chrome Connection
- Try `mcp__chrome-devtools__list_pages()`
- If fails, tell user to restart with `/c`
- Resume from last incomplete nav item

### Login Expired
- Re-navigate to login
- Re-enter credentials
- Continue testing

### Too Many Failures
- Don't stop - complete all nav items
- Document all failures
- Fix-and-retest at the end

---

## 15. QUICK REFERENCE

**Start:** Connect Chrome → Login → Create todos → Begin testing

**Per Item:** Navigate → Snapshot → Check 404 → Tabs → Tables → Rows → Drawers → Update progress

**End:** Navigate to notebooks → Create report → Save → Fix failures → Retest → Update report

**Output:** Visual progress → Final summary → Notebook saved
