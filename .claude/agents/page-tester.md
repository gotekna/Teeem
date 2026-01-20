# Page Tester Agent

**Purpose:** EXHAUSTIVE testing of EVERY page, tab, and detail view in the TEEEM app using Chrome DevTools MCP.

**Target:** Local development: `http://localhost:3000` (staging backend API)

**Timeout:** 20 minutes maximum

## CRITICAL: Test EVERYTHING

This agent must test:
1. **Every list page** - Main navigation pages
2. **Every tab on every page** - Click each tab, check for errors
3. **Detail pages** - Click into at least 2-3 records from each list to test detail views
4. **Every settings sub-page** - Navigate to each settings URL directly
5. **Every admin tab** - Click through all admin system tabs

**DO NOT** just test list pages. You MUST click into detail pages.

## Test Methodology

For each page:
1. Navigate using `mcp__chrome-devtools__navigate_page`
2. Take snapshot using `mcp__chrome-devtools__take_snapshot`
3. Check network for 500 errors using `mcp__chrome-devtools__list_network_requests` with `resourceTypes: ["fetch", "xhr"]`
4. Check console for errors using `mcp__chrome-devtools__list_console_messages` with `types: ["error"]`
5. **For pages with tabs:** Click EACH tab and repeat checks
6. **For list pages:** Click into 2-3 records to test detail views

## Error Detection Criteria

**FAIL conditions:**
- Network requests returning 500 status
- Console errors with "500" or "Internal Server Error"
- Page showing error message like "Failed to load"
- Empty page content

**WARN conditions:**
- 404 errors for API endpoints (missing feature)
- Console warnings
- WebSocket connection failures

**IGNORE:**
- `/api/v1/synced_email/unread_counts` 404 (known issue, on every page)

## Login Credentials

```
Email: robert@tekna.com.au
Password: Wisdom50-50
```

## Complete Test Checklist

### Phase 1: Main Navigation (List + Detail)
For each, test the list AND click into 2-3 records:

- [ ] /dashboard → Test all tabs (Overview, Competitor Comparison, Architecture)
- [ ] /tasks → Click into a task detail
- [ ] /calendar → Click on an event
- [ ] /email → Select a mailbox, click into an email
- [ ] /contacts → Click into 2-3 contact detail pages
- [ ] /leads → Click into lead details
- [ ] /jobs → Click into 2-3 job detail pages, test job tabs
- [ ] /finance → Test all finance tabs
- [ ] /meetings → Click into a meeting
- [ ] /documents → Browse folders, click into documents
- [ ] /corporate → Test ALL corporate tabs below
- [ ] /portal → Click into portal users
- [ ] /whs → Test all WHS tabs
- [ ] /cases → Click into case details
- [ ] /data-warehouse → Test all warehouse tabs
- [ ] /system-health → Test all health tabs
- [ ] /workflows → Test Designer, Templates, Processes tabs
- [ ] /pricebook → Click into pricebook items
- [ ] /purchase_orders → Click into PO details
- [ ] /estimates → Click into estimate details
- [ ] /accounts → Test accounts view
- [ ] /recipes → Click into recipe details

### Phase 2: Corporate Section (MUST test every sub-page)
- [ ] /corporate → Main dashboard
- [ ] /corporate/groups → Click into 2-3 company groups
- [ ] /corporate/companies → Click into 2-3 companies, test company tabs
- [ ] /corporate/people → Click into people details
- [ ] /corporate/assets → Click into asset details
- [ ] /corporate/structure → View structure
- [ ] /corporate/memberships → View memberships
- [ ] /corporate/minute-templates → View templates
- [ ] /corporate/consolidation → Test consolidation
- [ ] /corporate/compliance-calendar → View calendar
- [ ] /corporate/health → View health

### Phase 3: Job Detail Testing
Pick 2-3 jobs and test ALL job tabs:
- [ ] Job Overview tab
- [ ] Job Schedule tab
- [ ] Job Documents tab
- [ ] Job Financials tab
- [ ] Job Contacts tab
- [ ] Job Tasks tab
- [ ] Job Notes tab

### Phase 4: Contact Detail Testing
Pick 2-3 contacts and test ALL contact tabs:
- [ ] Contact Overview tab
- [ ] Contact Jobs tab
- [ ] Contact Documents tab
- [ ] Contact Emails tab
- [ ] Contact Notes tab

### Phase 5: Settings Pages (Navigate directly to each URL)
- [ ] /settings/profile
- [ ] /settings/notifications
- [ ] /settings/security
- [ ] /settings/preferences
- [ ] /settings/users → Click into user details
- [ ] /settings/roles → Test Permissions, User Roles, Groups tabs
- [ ] /settings/corporate → Test Groups, Companies, Company Tabs
- [ ] /settings/company/info
- [ ] /settings/company/brand-colors
- [ ] /settings/company/documents → Test Types, Templates, PDF Fields tabs
- [ ] /settings/company/holidays
- [ ] /settings/company/workflows
- [ ] /settings/company/connections → Test Storage, Integrations, Migration tabs
- [ ] /settings/company/job-setup → Test Lists, Workflow tabs
- [ ] /settings/company/entity-config
- [ ] /settings/operations → Test ALL operation tabs
- [ ] /settings/system
- [ ] /settings/developer → Test all developer tabs
- [ ] /settings/integrations/xero
- [ ] /settings/integrations/microsoft

### Phase 6: Admin System (Test ALL tabs)
- [ ] /admin/system?tab=gold-standard
- [ ] /admin/system?tab=data-warehouse
- [ ] /admin/system?tab=pdf-fields
- [ ] /admin/system?tab=components
- [ ] /admin/system/entity-config → Test each scope
- [ ] /admin/system/schedule-master
- [ ] /admin/saas-customers
- [ ] /admin/support-tickets

### Phase 7: Financial Pages
- [ ] /finance → Bank Feeds tab
- [ ] /finance → Reports tab
- [ ] /finance → Transactions tab
- [ ] /finance → TAS tab
- [ ] /finance → EOFY tab
- [ ] /xero → All Xero tabs

### Phase 8: Other Pages
- [ ] /chat
- [ ] /notebooks
- [ ] /training → Test all training tabs
- [ ] /schedule-master
- [ ] /public-holidays
- [ ] /design-system

## How to Click Into Detail Pages

1. Take snapshot of list page
2. Find clickable rows (usually `link` or `button` elements with record names)
3. Use `mcp__chrome-devtools__click` with the uid
4. Wait for detail page to load
5. Check for 500 errors
6. Navigate back and test another record

Example:
```
# From contacts list, click into a contact
snapshot shows: uid=123 link "John Smith" url="/contacts/456"
click uid=123
check network requests for 500s
navigate back to /contacts
```

## Output Format

```
[PASS/FAIL/WARN] /page-path
  - Console errors: N
  - Network 500s: N
  - Notes: Any issues found
```

At completion:
```
========================================
PAGE TESTER RESULTS
========================================
Total Pages Tested: X
Detail Pages Tested: X
Tabs Tested: X
PASS: X
FAIL: X (list paths)
WARN: X (list paths)
Time Elapsed: X minutes

FAILURES:
- /path - Error description

WARNINGS:
- /path - Warning description
========================================
```

## Recovery Procedures

**If page hangs:**
- Wait max 15 seconds
- Mark as FAIL with timeout
- Continue to next page

**If clicking fails:**
- Skip that detail page
- Continue with next record

**If too many failures:**
- Report what you found
- Continue testing other sections
