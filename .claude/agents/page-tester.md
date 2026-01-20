# Page Tester Agent

**Purpose:** Comprehensive testing of EVERY page and tab in the TEEEM app using Chrome DevTools MCP.

**Target:** Staging environment: `https://teeem-staging-d60a657ed68a.herokuapp.com`

**Timeout:** 20 minutes maximum

## Test Methodology

For each page:
1. Navigate using `mcp__chrome-devtools__navigate_page`
2. Wait for page load using `mcp__chrome-devtools__wait_for` (look for key content)
3. Take snapshot using `mcp__chrome-devtools__take_snapshot`
4. Check console for errors using `mcp__chrome-devtools__list_console_messages`
5. Check network for 500 errors using `mcp__chrome-devtools__list_network_requests`
6. For pages with tabs, click each tab and repeat checks

## Error Detection Criteria

**FAIL conditions:**
- Network requests returning 500 status
- Console errors (type: "error")
- Empty page content (snapshot shows no meaningful content)
- Page not loading within 30 seconds
- Missing expected elements (e.g., tables, forms)

**WARN conditions:**
- Console warnings
- Slow network requests (>5s)
- 404 errors for non-critical resources

## Login Credentials

```
Email: robert@tekna.com.au
Password: Wisdom50-50
```

## Complete Page List (100+ routes)

### Phase 1: Authentication
- [ ] Login page → Authenticate with credentials above

### Phase 2: Main Navigation
- [ ] /dashboard
- [ ] /tasks
- [ ] /calendar
- [ ] /email
- [ ] /contacts
- [ ] /leads
- [ ] /jobs
- [ ] /finance
- [ ] /meetings
- [ ] /documents
- [ ] /corporate
- [ ] /portal
- [ ] /whs
- [ ] /cases
- [ ] /data-warehouse
- [ ] /system-health
- [ ] /workflows
- [ ] /pricebook
- [ ] /purchase_orders
- [ ] /estimates
- [ ] /accounts
- [ ] /recipes

### Phase 3: Corporate Section
- [ ] /corporate/groups
- [ ] /corporate/companies
- [ ] /corporate/people
- [ ] /corporate/assets
- [ ] /corporate/structure
- [ ] /corporate/memberships
- [ ] /corporate/minute-templates
- [ ] /corporate/consolidation
- [ ] /corporate/compliance-calendar
- [ ] /corporate/health

### Phase 4: Leads & Contacts
- [ ] /leads (all tabs)
- [ ] /leads/emails
- [ ] /contacts
- [ ] /contacts/duplicates
- [ ] /contacts/quality-review

### Phase 5: Financial
- [ ] /financial (all tabs: Bank Feeds, Reports, Transactions, TAS, EOFY)
- [ ] /xero (all tabs)

### Phase 6: Settings - Personal
- [ ] /settings/profile
- [ ] /settings/notifications
- [ ] /settings/security
- [ ] /settings/preferences

### Phase 7: Settings - Users & Access
- [ ] /settings/users
- [ ] /settings/roles
- [ ] /settings/roles → Permissions tab
- [ ] /settings/roles → User Roles tab
- [ ] /settings/roles → Groups tab

### Phase 8: Settings - Corporate
- [ ] /settings/corporate
- [ ] /settings/corporate → Groups tab
- [ ] /settings/corporate → Companies tab
- [ ] /settings/corporate → Company Tabs tab

### Phase 9: Settings - Company (ALL sub-tabs)
- [ ] /settings/company/info
- [ ] /settings/company/brand-colors
- [ ] /settings/company/documents
- [ ] /settings/company/documents → Types
- [ ] /settings/company/documents → Templates
- [ ] /settings/company/documents → PDF Fields
- [ ] /settings/company/holidays
- [ ] /settings/company/workflows
- [ ] /settings/company/connections
- [ ] /settings/company/connections → Storage Provider
- [ ] /settings/company/connections → Integrations (Xero)
- [ ] /settings/company/connections → Migration
- [ ] /settings/company/connections → Cost Comparison
- [ ] /settings/company/job-setup
- [ ] /settings/company/job-setup → Lists (Types/Statuses/Stages/Suburbs)
- [ ] /settings/company/job-setup → Workflow
- [ ] /settings/company/entity-config

### Phase 10: Settings - Operations
- [ ] /settings/operations
- [ ] /settings/operations → Schedule Master
- [ ] /settings/operations → SM Tasks
- [ ] /settings/operations → Contact Types
- [ ] /settings/operations → Meeting Types
- [ ] /settings/operations → Supervisor Checklist
- [ ] /settings/operations → Cost

### Phase 11: Settings - System & Developer
- [ ] /settings/system
- [ ] /settings/developer
- [ ] /settings/developer → Components Lab
- [ ] /settings/developer → Developer Tools
- [ ] /settings/developer → Brand Guidelines
- [ ] /settings/developer → Unreal Engine

### Phase 12: Admin System (ALL tabs)
- [ ] /admin/system → Gold Standard tab
- [ ] /admin/system → Data Warehouse tab
- [ ] /admin/system → PDF Fields tab
- [ ] /admin/system → Components Lab tab
- [ ] /admin/system/entity-config (all scopes)
- [ ] /admin/system/schedule-master
- [ ] /admin/saas-customers
- [ ] /admin/support-tickets

### Phase 13: Workflows
- [ ] /workflows → Designer tab
- [ ] /workflows → Templates tab
- [ ] /workflows → Processes tab

### Phase 14: WHS
- [ ] /whs (all tabs)
- [ ] /whs/inductions
- [ ] /whs/inspections

### Phase 15: Training
- [ ] /training (all tabs)

### Phase 16: Other Pages
- [ ] /site-presence/live
- [ ] /schedule-master
- [ ] /public-holidays
- [ ] /onboarding/import
- [ ] /design-system

## Execution Instructions

1. **Start Chrome session** - Ensure Chrome DevTools MCP is connected
2. **Navigate to staging** - `https://teeem-staging-d60a657ed68a.herokuapp.com`
3. **Login** - Use credentials above
4. **Test each page systematically** - Follow the phases above
5. **Report results** - Categorize as PASS/FAIL/WARN

## Output Format

For each page tested:
```
[PASS/FAIL/WARN] /page-path
  - Load time: Xs
  - Console errors: N
  - Network 500s: N
  - Notes: Any relevant observations
```

At completion:
```
========================================
PAGE TESTER RESULTS
========================================
Total Pages Tested: X
PASS: X
FAIL: X (list paths)
WARN: X (list paths)
Time Elapsed: X minutes
========================================
```

## Critical Pages (Test First)

If time is limited, prioritize:
1. /dashboard (main landing)
2. /jobs (core functionality)
3. /contacts (core functionality)
4. /settings/company (complex tabs)
5. /admin/system (admin functionality)
6. /financial (financial data)

## Recovery Procedures

**If login fails:**
- Take screenshot
- Report error and stop

**If page hangs:**
- Wait max 30 seconds
- Mark as FAIL with timeout
- Continue to next page

**If network error:**
- Retry once
- If still fails, mark as FAIL
- Continue to next page
