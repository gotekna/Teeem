# Production Ready Agent

**Purpose:** EXHAUSTIVE testing of EVERY page, tab, button, and detail view in the TEEEM app using Chrome DevTools MCP to verify production readiness.

**Target:** Staging: `https://teeem-staging.vercel.app` (backend: `https://teeem-staging-d60a657ed68a.herokuapp.com`)

**Priority:** THOROUGHNESS over speed. Click EVERYTHING. No time constraints.

## 🔴 CRITICAL: Left Navigation Systematic Testing

**Navigate the application STRICTLY via the Left Navigation Bar. Test each item completely before moving to the next.**

### Left Navigation Order (SSoT from App) - 77+ Pages

**Note:** Page count may vary as features are added/removed. Always discover from live nav.

```
1. Dashboard                          /dashboard
2. Tasks                              /tasks
3. Calendar                           /calendar
4. Email                              /email
   ├── robert@tekna.com.au            /email?account=ms365_9_6588f630
   ├── robert@teeem.au                /email?account=2
   ├── hello@coinvesthomes.com.au     /email?account=1
   ├── robert@homesofhope.org.au      /email?account=ms365_11_85f3617d
   ├── rob@100xbestlife.com           /email?account=ms365_10_798a35c1
   ├── rob@lyw.org.au                 /email?account=ms365_12_ec16e727
   ├── james@homesofhope.org.au       /email?account=ms365_11_0e80ccd6
   └── andrew@homesofhope.org.au      /email?account=ms365_11_a9258d5e
5. Contacts                           /contacts
6. Leads                              /leads
7. Jobs                               /jobs
   ├── Gantt Schedule                 /admin/system/schedule-master/gantt
   ├── Schedule Master                /admin/system/schedule-master/data-view/setup
   ├── WHS                            /whs
   ├── Purchase Orders                /purchase_orders
   ├── Quote Requests                 /quote-requests
   ├── Site Presence                  /admin/site-presence
   │   ├── Active Sessions            /site_presence_sessions
   │   ├── Live Tracking              /site-presence/live
   │   ├── Worker Profiles            /worker_profiles
   │   ├── Cost Centres               /cost_centres
   │   ├── Labour Costs               /labour_cost_entries
   │   ├── Job Budgets                /job_cost_budgets
   │   └── AI Suggestions             /ai_timesheet_suggestions
   ├── Price Book                     /pricebook
   │   └── Price Histories            /price_histories
   ├── Estimating                     /estimates
   │   └── Recipes                    /recipes
   └── Job Photos                     /jobs/photos
8. Finance                            /finance
   ├── Xero                           /settings/integrations/xero
   └── T.A.S.                         /financial/tas
9. Meetings                           /meetings
10. Warehouse                         /warehouse
11. Corporate                         /corporate
    ├── Assets                        /corporate/assets
    └── Cases                         /cases
12. Portal                            /portal
13. Settings                          /settings
    │   PERSONAL TABS:
    ├── Profile                       /settings/profile
    ├── Notifications                 /settings/notifications
    ├── Security                      /settings/security
    ├── Preferences                   /settings/preferences
    │   ORGANIZATION TABS:
    ├── Users                         /settings/users
    ├── Access Control                /settings/roles
    ├── Corporate                     /settings/corporate
    ├── Company                       /settings/company
    │   ├── Info                      /settings/company/info
    │   ├── Brand Colors              /settings/company/brand-colors
    │   ├── Documents                 /settings/company/documents
    │   │   ├── Document Types        /settings/company/documents/types
    │   │   │   ├── All               (filter)
    │   │   │   ├── Company           (filter)
    │   │   │   ├── Job               (filter)
    │   │   │   └── Contacts          (filter)
    │   │   ├── Document Templates    /settings/company/documents/templates
    │   │   ├── Bank Statements       /settings/company/documents/bank
    │   │   ├── Invoice Templates     /settings/company/documents/invoices
    │   │   ├── Email Signatures      /settings/company/documents/signatures
    │   │   └── PDF Fields            /settings/company/documents/pdf
    │   ├── Holidays                  /settings/company/holidays
    │   ├── Workflows                 /settings/company/workflows
    │   ├── Job Setup                 /settings/company/job-setup
    │   ├── Folder Config             /settings/company/folder-config
    │   └── Offline                   /settings/company/offline
    ├── Operations                    /settings/operations
    ├── Connections                   /settings/connections
    │   ├── Storage Provider          /settings/connections/provider
    │   ├── Integrations              /settings/connections/integrations
    │   ├── Migration                 /settings/connections/migration
    │   └── Cost Comparison           /settings/connections/costs
    ├── System                        /settings/system
    ├── Developer                     /settings/developer
    │   LEFT NAV SUB-ITEMS:
    ├── Support                       /support
    ├── Workflows                     /workflows/processes
    ├── SaaS Customers                /admin/saas-customers
    ├── Support Tickets               /admin/support-tickets
    └── Referrers                     /admin/referrers
14. Teeem Docs                        /my-docs
15. Missing                           /missing
    ├── Accounts                      /accounts
    ├── Agent Tasks                   /agent-tasks
    ├── Chat                          /chat
    ├── Company Groups                /company-groups
    ├── Contact Duplicates            /contacts/duplicates
    ├── Contact Quality Review        /contacts/quality-review
    ├── Data Warehouse                /data-warehouse
    ├── Design System                 /design-system
    ├── Designer                      /designer
    ├── Device                        /device
    ├── E-Signature                   /e-signature
    ├── Email Rules                   /email/rules
    ├── Email Settings                /email/settings
    ├── Financial Transactions        /financial/transactions
    ├── Financial Reports             /financial/reports
    ├── Pricebook Health              /pricebook/health
    ├── Public Holidays               /public-holidays
    ├── Schedule Templates            /schedule-templates
    ├── SharePoint                    /sharepoint
    ├── SM Tasks                      /sm_tasks
    ├── System Health                 /system-health
    ├── System Performance            /system-performance
    ├── Task Templates                /task-templates
    ├── Training                      /training
    ├── Xero (Main)                   /xero
    └── Xero Sync                     /xero/sync
```

### Page Count Summary

| Section | Main | Sub-items | Total |
|---------|------|-----------|-------|
| Dashboard | 1 | 0 | 1 |
| Tasks | 1 | 0 | 1 |
| Calendar | 1 | 0 | 1 |
| Email | 1 | 8 accounts | 9 |
| Contacts | 1 | 0 | 1 |
| Leads | 1 | 0 | 1 |
| Jobs | 1 | 9 + 7 + 1 + 1 = 18 | 19 |
| Finance | 1 | 2 | 3 |
| Meetings | 1 | 0 | 1 |
| Warehouse | 1 | 0 | 1 |
| Corporate | 1 | 2 | 3 |
| Portal | 1 | 0 | 1 |
| Settings | 1 | 5 | 6 |
| Teeem Docs | 1 | 0 | 1 |
| Missing | 1 | 27 | 28 |
| **TOTAL** | **15** | **62** | **77** |

### Testing Protocol Per Nav Item

```
FOR EACH LEFT NAV ITEM:
1. Click the nav item in the left sidebar
2. Take snapshot, check for 404/errors
3. Count and click EVERY tab on the page
4. For each tab, count and click EVERY sub-tab
5. For list pages: click 2-3 rows to open details/drawers
6. Test any Add/Edit/Delete buttons (open modals)
7. Check console for errors after each action
8. REPORT STATS before moving to next nav item
```

### Stats Report Format (After Each Nav Item)

```
========================================
📍 LEFT NAV: [Name] (/path)
========================================
✅ PAGE LOADED (or ❌ ERROR: description)

📊 COUNTERS FOR THIS SECTION:
  Tabs:          X clicked
  Sub-tabs:      X clicked
  Rows opened:   X records
  Modals:        X opened
  Drawers:       X opened
  Errors:        X found

📋 TABS TESTED:
  ✅ Tab1 (X sub-tabs)
  ✅ Tab2
  ❌ Tab3 - ERROR: description

🚨 ERRORS FOUND:
  [ERROR 1] Description...

➡️ NEXT: [Next Nav Item]
========================================
```

### Running Totals (Update After Each Section)

```
========================================
📊 RUNNING TOTALS (after Section X)
========================================
PAGES_OPENED:      X / 15 nav items
TABS_CLICKED:      X
SUB_TABS_CLICKED:  X
ROWS_OPENED:       X
MODALS_OPENED:     X
DRAWERS_OPENED:    X
ERRORS_FOUND:      X
========================================
```

## 🔴 CRITICAL: Save Results to Notebook

**ALWAYS save test results to a notebook file for comparison across runs.**

### Results File Location

```
/Users/robertharder/GitHub/teeem/TEEEM_DOCS/PR_TEST_RESULTS.md
```

### File Structure

```markdown
# Production Ready Test Results

## Run: YYYY-MM-DD HH:MM (Brisbane)
Environment: Staging | Beta | Production
Tester: Claude

### Summary
| Metric | Count |
|--------|-------|
| Nav Items Tested | X/15 |
| Tabs Clicked | X |
| Sub-tabs Clicked | X |
| Rows Opened | X |
| Modals Opened | X |
| Drawers Opened | X |
| Errors Found | X |

### Results by Navigation

#### 1. Dashboard (/dashboard)
- Status: ✅ PASS | ❌ FAIL
- Tabs: 3 (Overview ✅, Competitor Comparison ✅, Architecture ✅)
- Sub-tabs: 7 (all in Architecture)
- Errors: None

#### 2. Tasks (/tasks)
- Status: ✅ PASS
- Tabs: 0 (single view)
- Views: List ✅, Board ✅, Gantt ✅
- Records: 18 tasks displayed
- Errors: None

#### 3. Calendar (/calendar)
...

[Continue for all 15 nav items]

### Errors Log
| # | Page | Error | Status |
|---|------|-------|--------|
| 1 | /path | Description | NEW/KNOWN/FIXED |

---
## Previous Run: YYYY-MM-DD HH:MM
[Previous results for comparison]
```

### Workflow

1. **Start of /pr**: Read existing `PR_TEST_RESULTS.md` if exists
2. **During testing**: Track all metrics per nav item
3. **End of /pr**: Append new run results to the file
4. **Compare**: Show diff from previous run (new errors, fixed errors, metric changes)

### Comparison Output

```
========================================
📊 COMPARISON WITH PREVIOUS RUN
========================================
Previous: 2026-01-28 14:30
Current:  2026-01-29 05:20

| Metric | Previous | Current | Change |
|--------|----------|---------|--------|
| Tabs | 45 | 48 | +3 |
| Errors | 2 | 0 | -2 ✅ |

🆕 NEW ERRORS: None
✅ FIXED ERRORS:
  - /contacts/photo - Photo tab 500 error
  - /jobs/plans - PDF preview CORS
========================================
```

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
1. **Every page** - Open every page in the navigation
2. **Every tab on every page** - Click each tab, check for errors
3. **A row in every table** - Click one row to open its drawer/detail view
4. **Every popup/modal** - Add buttons, edit buttons, action menus
5. **Every settings sub-page** - Navigate to each settings URL directly
6. **Every admin tab** - Click through all admin system tabs
7. **A PDF/document** - Open at least one document to verify viewer works
8. **Console errors on every page** - Check for 404s, 500s, JS errors after each action

**DO NOT** just test list pages. You MUST click into a row, open drawers, test modals, and check console on EVERY page.

## 🔴 CRITICAL: Always Start with Fresh Login

**Every /pr run MUST start with a fresh login to ensure clean session state.**

### Login Steps (MANDATORY FIRST ACTION)

```
1. Navigate to: https://teeem-staging.vercel.app/login
2. Clear any existing session (if logged in, log out first)
3. Fill credentials:
   - Email: robert@tekna.com.au
   - Password: Wisdom50-50
4. Click Sign In
5. Wait for Dashboard to load
6. Verify login successful (user name visible in header)
7. THEN begin left navigation testing
```

### Login Credentials

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

**Minimum requirements for 100% coverage:**
- Pages: ALL discovered routes (120+)
- Tabs: 80+ clicked (every tab on every page)
- Sub-tabs: 30+ clicked
- Modals: 30+ opened
- Drawers: 20+ opened
- Action Menus: 15+ tested

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

## 🔴 CRITICAL: Chrome DevTools MCP Required - NO FALLBACK

**This agent REQUIRES Chrome DevTools MCP tools to function. There is NO acceptable fallback.**

### Before Starting: Verify & Connect Chrome DevTools MCP

1. **Test the connection** by calling `mcp__chrome-devtools__list_pages()`
   - If it returns pages → Chrome is running, proceed
   - If it fails → Chrome is not running, **start it yourself** (Step 2)

2. **If Chrome is NOT running, start it yourself:**
   ```
   mcp__chrome-devtools__new_page({ url: "https://teeem-staging.vercel.app" })
   ```
   Then navigate and auto-login:
   ```
   mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app' })
   ```
   If on login page, fill credentials:
   - Email: `robert@tekna.com.au`
   - Password: `Wisdom50-50`
   ```
   mcp__chrome-devtools__fill_form({ elements: [
     { uid: "EMAIL_FIELD_UID", value: "robert@tekna.com.au" },
     { uid: "PASSWORD_FIELD_UID", value: "Wisdom50-50" }
   ]})
   mcp__chrome-devtools__click({ uid: "SIGNIN_BUTTON_UID" })
   ```

3. **If tools are lost mid-session** (context compaction, reconnection issues):
   - **STOP IMMEDIATELY** - Do not switch to curl testing
   - **Reconnect yourself** - repeat Step 1 and 2 above
   - If reconnection fails after 2 attempts, tell the user: "Chrome DevTools MCP won't connect. Please run `/c` and restart `/pr`."
   - **NEVER fall back to curl/API-only testing** - it misses real bugs

4. **Required tools** - you MUST have access to ALL of these before proceeding:
   - `mcp__chrome-devtools__navigate_page`
   - `mcp__chrome-devtools__take_snapshot`
   - `mcp__chrome-devtools__click`
   - `mcp__chrome-devtools__wait_for`
   - `mcp__chrome-devtools__list_network_requests`
   - `mcp__chrome-devtools__list_console_messages`

### Why This Matters

Curl/API testing ONLY catches backend 500s on known endpoints. It CANNOT:
- Navigate actual pages and see what the user sees
- Click tabs and discover frontend-initiated API calls that 404
- Open row drawers and test detail views
- See console errors from the browser
- Find deleted controllers that routes still point to
- Test modals, popups, PDF viewers, or any interactive UI

**A /pr that only does curl testing is WORTHLESS. It gives false confidence while real bugs (like entire deleted controllers) go undetected.**

## Test Methodology

For each page:
1. Navigate using `mcp__chrome-devtools__navigate_page`
2. **🔴 IMMEDIATELY take snapshot** using `mcp__chrome-devtools__take_snapshot`
3. **🔴 Check snapshot for "404"** - If found, mark FAIL and continue
4. Wait for load using `mcp__chrome-devtools__wait_for` (wait for key content)
5. Check network for 500 errors using `mcp__chrome-devtools__list_network_requests` with `resourceTypes: ["fetch", "xhr"]`
6. Check console for errors using `mcp__chrome-devtools__list_console_messages` with `types: ["error"]`
7. **For pages with tabs:** Click EACH tab and repeat checks
8. **For list pages:** Click a row to open the drawer/detail view, check for errors
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

### 🔴 Phase 0: Route Discovery (MANDATORY FIRST STEP)

**Before testing any pages, you MUST discover ALL routes in the application.**

1. **Get navigation structure from API:**
   ```
   Navigate to staging and check: GET /api/v1/navigation
   This returns the full nav structure with all available routes
   ```

2. **Scan the app router for all pages:**
   ```
   frontend-next/app/
   ├── (dashboard)/     # Main app pages
   ├── (auth)/          # Auth pages
   ├── admin/           # Admin pages
   └── settings/        # Settings pages
   ```

3. **Build comprehensive route list:**
   - Parse navigation API response
   - Add any routes not in the checklist below
   - Count total unique routes

4. **Track discovery:**
   ```
   ROUTES_DISCOVERED: 0    # From API + app router scan
   ROUTES_IN_CHECKLIST: XX # From phases below
   ROUTES_ADDED: 0         # New routes found not in checklist
   ```

**Expected route count: 120+ unique pages (not including dynamic /[id] variants)**

**If you discover routes NOT in the checklist below, ADD THEM to your test list.**

---

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
| `/reports` | Test all report tabs, generate sample reports |
| `/help` | Test help documentation, search |
| `/search` | Global search functionality |
| `/notifications` | Notification list, mark as read |
| `/inbox` | If separate from email, test inbox |
| `/activity` | Activity feed/log |
| `/timesheets` | If exists, test timesheet entry |
| `/invoices` | Test invoice list, open invoice details |
| `/bills` | Test bill list, open bill details |
| `/quotes` | Test quotes list, open quote details |

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
- [ ] `/corporate/documents` - Corporate document library
- [ ] `/corporate/accounts` - Corporate accounts/banking
- [ ] `/corporate/trusts` - Trust entities
- [ ] `/corporate/shareholders` - Shareholder register
- [ ] `/corporate/directors` - Director registry
- [ ] `/corporate/secretaries` - Secretary registry
- [ ] `/corporate/registers` - All corporate registers

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
- [ ] `/settings/company/job-setup` - Test Lists, Workflow tabs
- [ ] `/settings/company/entity-config`
- [ ] `/settings/company/offline` - Offline mode settings

**Connections Settings (test ALL sub-tabs):**
- [ ] `/settings/connections` - Main connections page
- [ ] `/settings/connections/provider` - Storage Provider (SharePoint, S3/Wasabi, MinIO)
- [ ] `/settings/connections/integrations` - Xero, Cloudflare integrations
- [ ] `/settings/connections/migration` - Email migration, document migration
- [ ] `/settings/connections/costs` - Storage cost comparison

**Operations Settings:**
- [ ] `/settings/operations` - Test ALL operation tabs: Schedule Master, SM Tasks, Contact Types, Meeting Types, Supervisor Checklist, Cost

**Other Settings:**
- [ ] `/settings/system`
- [ ] `/settings/developer` - Test Components Lab, Developer Tools, Brand Guidelines, Unreal Engine
- [ ] `/settings/integrations/xero`
- [ ] `/settings/integrations/microsoft`

### Phase 6: Admin System (Test ALL tabs)

**Admin System Tabs:**
- [ ] `/admin/system?tab=gold-standard`
- [ ] `/admin/system?tab=data-warehouse`
- [ ] `/admin/system?tab=pdf-fields`
- [ ] `/admin/system?tab=components` - Components Lab
- [ ] `/admin/system?tab=routes` - Route listing (if exists)
- [ ] `/admin/system?tab=foundations` - Foundation configuration
- [ ] `/admin/system?tab=columns` - Column configuration
- [ ] `/admin/system/entity-config` - Test each scope dropdown
- [ ] `/admin/system/schedule-master`

**Admin Pages:**
- [ ] `/admin/saas-customers` - SaaS customer management
- [ ] `/admin/support-tickets` - Support ticket queue
- [ ] `/admin/logs` - System logs viewer
- [ ] `/admin/jobs` - Background jobs queue
- [ ] `/admin/migrations` - Data migration status
- [ ] `/admin/cache` - Cache management
- [ ] `/admin/health` - System health dashboard
- [ ] `/admin/audit` - Audit log viewer

### Phase 7: Financial Pages (Deep)

- [ ] `/finance` - Bank Feeds tab
- [ ] `/finance` - Reports tab (click into reports)
- [ ] `/finance` - Transactions tab
- [ ] `/finance` - TAS tab
- [ ] `/finance` - EOFY tab
- [ ] `/xero` - All Xero tabs

### Phase 8: Other Pages

**Core Features:**
- [ ] `/chat` - Chat interface
- [ ] `/notebooks` - Notebook editor
- [ ] `/training` - Test all training tabs
- [ ] `/schedule-master` - Test Gantt chart, resource allocation
- [ ] `/public-holidays` - Holiday calendar
- [ ] `/design-system` - Component showcase

**System Health:**
- [ ] `/system-health` - Test all health tabs
- [ ] `/system-health?tab=api` - API health
- [ ] `/system-health?tab=database` - Database health
- [ ] `/system-health?tab=storage` - Storage health
- [ ] `/system-health?tab=integrations` - Integration health

**Specialized Views:**
- [ ] `/map` - Map view (if exists)
- [ ] `/timeline` - Timeline view
- [ ] `/kanban` - Kanban board (if exists)
- [ ] `/print` - Print preview/templates
- [ ] `/export` - Export functionality
- [ ] `/import` - Import functionality

**Auth/Onboarding (test logged-out flow):**
- [ ] `/login` - Login page
- [ ] `/signup` - Signup page (if public)
- [ ] `/forgot-password` - Password reset
- [ ] `/onboarding` - Onboarding flow

---

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

## 🔴 Systematic Modal & Drawer Discovery

**For EVERY page visited, you MUST check for and test these interactive elements:**

### Modal Discovery Checklist

| Element Type | How to Find | Test Action |
|--------------|-------------|-------------|
| **Add buttons** | Look for buttons with "Add", "New", "Create", "+" | Click → Verify modal opens → Check for errors → Close |
| **Edit buttons** | Look for pencil icons, "Edit" buttons on rows | Click → Verify edit form loads → Close |
| **Delete buttons** | Look for trash icons, "Delete" buttons | Click → Verify confirmation modal → Cancel (don't delete!) |
| **Action menus** | Look for "..." or kebab menu icons | Click → Verify dropdown appears → Test each option |
| **Settings modals** | Look for gear icons, "Settings", "Configure" | Click → Verify settings load → Close |

### Drawer/Panel Discovery Checklist

| Element Type | How to Find | Test Action |
|--------------|-------------|-------------|
| **Row click** | Click on table rows | Verify detail drawer opens (if applicable) |
| **Detail panels** | Look for expandable sections | Click → Verify panel expands → Test content |
| **Filter panels** | Look for "Filter", funnel icons | Click → Verify filter UI opens → Test filters |
| **Column settings** | Look for column configuration icons | Click → Verify column picker opens |
| **Side sheets** | Look for "View Details", "More Info" | Click → Verify side panel opens |

### Track Modal/Drawer Interactions Separately

```
MODALS_OPENED: 0
  - Add modals: X
  - Edit modals: X
  - Delete confirmations: X
  - Action menus: X
  - Settings modals: X

DRAWERS_OPENED: 0
  - Detail drawers: X
  - Filter panels: X
  - Column pickers: X
  - Side sheets: X

ACTION_MENUS_TESTED: 0
  - Per-row actions: X
  - Bulk actions: X
  - Header actions: X
```

### Example Modal/Drawer Test Flow

```
1. Navigate to /contacts
2. SCAN for interactive elements:
   - "Add Contact" button → Click → Modal opens → Close
   - First row "..." menu → Click → Menu appears → Test "Edit" option → Close
   - Click row → Detail drawer opens → Test drawer tabs → Close
   - "Filter" button → Click → Filter panel opens → Test filter → Clear
   - Column settings icon → Click → Column picker opens → Close
3. Increment counters for each interaction
4. Log any errors found
```

**Minimum Modal/Drawer Requirements:**
- Modals Opened: 30+
- Drawers Opened: 20+
- Action Menus Tested: 15+

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
Routes Discovered:    XXX  (from Phase 0 route discovery)
Pages Tested:         XXX
Coverage:             XX%  (Pages Tested / Routes Discovered × 100)
Status:               [100% = PASS | 90-99% = ACCEPTABLE | <90% = FAIL]

Modal/Drawer Coverage:
  Modals Opened:      XX/30+ required
  Drawers Opened:     XX/20+ required
  Action Menus:       XX/15+ required
  Coverage Status:    [PASS/FAIL]

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
| Required     | 120+  | 80+  | 30+      | 50+   | 30+    | 20+     |
| Status       | ✓/✗   | ✓/✗  | ✓/✗      | ✓/✗   | ✓/✗    | ✓/✗     |

========================================
📊 TOTAL INTERACTIONS
========================================
Pages + Tabs + Sub-tabs + Links + Modals + Drawers + Buttons = XXX

Minimum Required: 350+ (for 100% coverage)
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

## 🔴 CRITICAL: Complete ALL Phases - NO STOPPING EARLY

**You MUST NOT stop testing until ALL of the following are complete:**

### Completion Checklist

- [ ] **Phase 0:** Route discovery completed, all routes documented
- [ ] **Phase 1:** Jobs - ALL pages, tabs, modals, drawers tested
- [ ] **Phase 2:** Contacts - ALL pages, tabs, modals, drawers tested
- [ ] **Phase 3:** Main Pages - ALL pages in table tested
- [ ] **Phase 4:** Corporate - ALL corporate sub-pages tested
- [ ] **Phase 5:** Settings - ALL settings pages and sub-tabs tested
- [ ] **Phase 6:** Admin - ALL admin pages and tabs tested
- [ ] **Phase 7:** Finance - ALL finance tabs and features tested
- [ ] **Phase 8:** Other Pages - ALL remaining pages tested
- [ ] **Modal/Drawer Discovery:** Systematic check completed on each page
- [ ] **Coverage:** Shows 100% (or documents why specific pages were skipped)

### What "Complete" Means

```
✅ COMPLETE = Every checkbox in every phase is checked
✅ COMPLETE = Modal/drawer minimums met (30+ modals, 20+ drawers, 15+ menus)
✅ COMPLETE = Coverage calculation shows 100%
✅ COMPLETE = All errors documented with fix instructions

❌ INCOMPLETE = Any phase not finished
❌ INCOMPLETE = Coverage below 100% without documented reason
❌ INCOMPLETE = Modal/drawer minimums not met
```

### If Running Out of Context

If you're approaching context limits before completing all phases:

1. **DO NOT STOP** without outputting progress
2. Output a partial report with:
   ```
   ⚠️ INCOMPLETE - CONTEXT LIMIT APPROACHING

   Completed Phases: 1, 2, 3, 4
   Remaining Phases: 5, 6, 7, 8

   Current Coverage: 65%
   Pages Tested So Far: 78
   Routes Remaining: 42

   RESUME INSTRUCTIONS:
   - Start from Phase 5: Settings
   - First page to test: /settings/profile
   ```
3. The user can then resume testing in a new session

### The Goal: 100% Coverage

**Every single route in the application must be visited and tested.**

- No skipping pages because they "probably work"
- No assuming similar pages are all fine
- No stopping at 80% because "that's good enough"

**100% coverage or documented blockers. No exceptions.**
