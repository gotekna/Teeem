# Production Ready Agent

**Purpose:** Comprehensive QA testing - click through EVERY left nav item, EVERY tab, EVERY page.

**Target:** Staging: `https://teeem-staging.vercel.app`

**Time:** 60+ minutes. THOROUGHNESS over speed.

---

## CRITICAL: EXECUTION RULES

1. **CLICK THE NAV BAR** - Don't just navigate to URLs, actually click the left nav items
2. **ONE NAV ITEM AT A TIME** - Complete all testing for one nav item before moving to next
3. **SHOW PROGRESS AFTER EACH NAV ITEM** - Display the progress block
4. **DO NOT SKIP** - Every nav item, every sub-item, every tab must be tested
5. **ACTUALLY DO IT** - Don't describe what you would do, execute the actions
6. **VERIFY CORRECT PAGE** - After each navigation, check URL matches expected
7. **USE FALLBACK URL** - If clicking nav doesn't work, navigate directly to URL

---

## MASTER URL LIST - ALL PAGES TO TEST (94 total)

**You MUST open and test EVERY URL in this list. Check them off as you go.**

### Top-Level Nav Items (15)
| # | Nav Item | URL | Status |
|---|----------|-----|--------|
| 1 | Dashboard | `/dashboard` | ⬜ |
| 2 | Tasks | `/tasks` | ⬜ |
| 3 | Email | `/email` | ⬜ |
| 4 | Calendar | `/calendar` | ⬜ |
| 5 | Contacts | `/contacts` | ⬜ |
| 6 | Leads | `/leads` | ⬜ |
| 7 | Jobs | `/jobs` | ⬜ |
| 8 | Finance | `/finance` | ⬜ |
| 9 | Meetings | `/meetings` | ⬜ |
| 10 | Warehouse | `/warehouse` | ⬜ |
| 11 | Corporate | `/corporate` | ⬜ |
| 12 | Portal | `/portal` | ⬜ |
| 13 | Settings | `/settings` | ⬜ |
| 14 | Teeem Docs | `/my-docs` | ⬜ |
| 15 | Missing | `/missing` | ⬜ |

### Email Accounts (8)
| # | Account | URL | Status |
|---|---------|-----|--------|
| 3.1 | robert@tekna.com.au | `/email?account=ms365_9_6588f630` | ⬜ |
| 3.2 | robert@teeem.au | `/email?account=2` | ⬜ |
| 3.3 | hello@coinvesthomes.com.au | `/email?account=1` | ⬜ |
| 3.4 | robert@homesofhope.org.au | `/email?account=ms365_11_85f3617d` | ⬜ |
| 3.5 | rob@100xbestlife.com | `/email?account=ms365_10_798a35c1` | ⬜ |
| 3.6 | rob@lyw.org.au | `/email?account=ms365_12_ec16e727` | ⬜ |
| 3.7 | james@homesofhope.org.au | `/email?account=ms365_11_0e80ccd6` | ⬜ |
| 3.8 | andrew@homesofhope.org.au | `/email?account=ms365_11_a9258d5e` | ⬜ |

### Jobs Sub-Items (18)
| # | Page | URL | Status |
|---|------|-----|--------|
| 7.1 | Gantt Schedule | `/admin/system/schedule-master/gantt` | ⬜ |
| 7.2 | Schedule Master | `/admin/system/schedule-master/data-view/setup` | ⬜ |
| 7.3 | WHS | `/whs` | ⬜ |
| 7.4 | Purchase Orders | `/purchase_orders` | ⬜ |
| 7.5 | Quote Requests | `/quote-requests` | ⬜ |
| 7.6 | Site Presence | `/admin/site-presence` | ⬜ |
| 7.6.1 | Active Sessions | `/site_presence_sessions` | ⬜ |
| 7.6.2 | Live Tracking | `/site-presence/live` | ⬜ |
| 7.6.3 | Worker Profiles | `/worker_profiles` | ⬜ |
| 7.6.4 | Cost Centres | `/cost_centres` | ⬜ |
| 7.6.5 | Labour Costs | `/labour_cost_entries` | ⬜ |
| 7.6.6 | Job Budgets | `/job_cost_budgets` | ⬜ |
| 7.6.7 | AI Suggestions | `/ai_timesheet_suggestions` | ⬜ |
| 7.7 | Price Book | `/pricebook` | ⬜ |
| 7.8 | Price Histories | `/price_histories` | ⬜ |
| 7.9 | Estimating | `/estimates` | ⬜ |
| 7.10 | Recipes | `/recipes` | ⬜ |
| 7.11 | Job Photos | `/jobs/photos` | ⬜ |

### Finance Sub-Items (2)
| # | Page | URL | Status |
|---|------|-----|--------|
| 8.1 | Xero | `/settings/integrations/xero` | ⬜ |
| 8.2 | T.A.S. | `/financial/tas` | ⬜ |

### Corporate Sub-Items (2)
| # | Page | URL | Status |
|---|------|-----|--------|
| 11.1 | Assets | `/corporate/assets` | ⬜ |
| 11.2 | Cases | `/cases` | ⬜ |

### Settings Pages (29)
| # | Page | URL | Status |
|---|------|-----|--------|
| 13.1 | Profile | `/settings/profile` | ⬜ |
| 13.2 | Notifications | `/settings/notifications` | ⬜ |
| 13.3 | Security | `/settings/security` | ⬜ |
| 13.4 | Preferences | `/settings/preferences` | ⬜ |
| 13.5 | Users | `/settings/users` | ⬜ |
| 13.6 | Access Control | `/settings/roles` | ⬜ |
| 13.7 | Corporate | `/settings/corporate` | ⬜ |
| 13.8 | Company | `/settings/company` | ⬜ |
| 13.9 | Company - Info | `/settings/company/info` | ⬜ |
| 13.10 | Company - Brand Colors | `/settings/company/brand-colors` | ⬜ |
| 13.11 | Company - Documents | `/settings/company/documents` | ⬜ |
| 13.12 | Company - Holidays | `/settings/company/holidays` | ⬜ |
| 13.13 | Company - Workflows | `/settings/company/workflows` | ⬜ |
| 13.14 | Company - Job Setup | `/settings/company/job-setup` | ⬜ |
| 13.15 | Company - Warehouse Config | `/settings/company/warehouse-config` | ⬜ |
| 13.16 | Company - Offline | `/settings/company/offline` | ⬜ |
| 13.17 | Operations | `/settings/operations` | ⬜ |
| 13.18 | Connections | `/settings/connections` | ⬜ |
| 13.19 | Connections - Provider | `/settings/connections/provider` | ⬜ |
| 13.20 | Connections - Integrations | `/settings/connections/integrations` | ⬜ |
| 13.21 | Connections - Migration | `/settings/connections/migration` | ⬜ |
| 13.22 | Connections - Costs | `/settings/connections/costs` | ⬜ |
| 13.23 | System | `/settings/system` | ⬜ |
| 13.24 | Developer | `/settings/developer` | ⬜ |
| 13.25 | Developer - Components | `/settings/developer/components` | ⬜ |
| 13.26 | Developer - Tools | `/settings/developer/tools` | ⬜ |
| 13.27 | Developer - Brand Guidelines | `/settings/developer/brand-guidelines` | ⬜ |
| 13.28 | Developer - Unreal | `/settings/developer/unreal` | ⬜ |

### Settings Sub-Items in Nav (5)
| # | Page | URL | Status |
|---|------|-----|--------|
| 13.S1 | Support | `/support` | ⬜ |
| 13.S2 | Workflows | `/workflows/processes` | ⬜ |
| 13.S3 | SaaS Customers | `/admin/saas-customers` | ⬜ |
| 13.S4 | Support Tickets | `/admin/support-tickets` | ⬜ |
| 13.S5 | Referrers | `/admin/referrers` | ⬜ |

### Missing Sub-Items (~26)
Navigate to `/missing` and test each sub-item found there.

---

## PHASE 1: SETUP

### Step 1: Connect Chrome
```
mcp__chrome-devtools__list_pages()
```
If fails → Tell user to run `/c` first, then STOP

### Step 2: Navigate to Staging
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/login' })
```

### Step 3: Login
```
mcp__chrome-devtools__take_snapshot()
```
Find email field, password field, sign in button:
```
mcp__chrome-devtools__fill({ uid: "[EMAIL_UID]", value: "robert@tekna.com.au" })
mcp__chrome-devtools__fill({ uid: "[PASSWORD_UID]", value: "Wisdom50-50" })
mcp__chrome-devtools__click({ uid: "[SIGN_IN_UID]" })
```

### Step 4: Wait for Dashboard
```
mcp__chrome-devtools__wait_for({ text: "Dashboard", timeout: 15000 })
mcp__chrome-devtools__take_snapshot()
```
Verify you see the left navigation bar.

---

## PHASE 2: LEFT NAVIGATION TESTING

**Work through the left navigation bar from TOP to BOTTOM.**

For EACH nav item:
1. Take snapshot to find the nav item in the sidebar
2. Click the nav item
3. Wait for page to load
4. Take snapshot of the page
5. Test all tabs, tables, drawers on that page
6. If nav item has children, expand and test each child
7. Show progress block
8. Move to next nav item

---

## LEFT NAV ITEM 1: Dashboard
**EXPECTED URL:** `https://teeem-staging.vercel.app/dashboard`

### Step 1.1: Click Dashboard in Left Nav
```
mcp__chrome-devtools__take_snapshot()
```
Find "Dashboard" in the left navigation sidebar → get its UID
```
mcp__chrome-devtools__click({ uid: "[DASHBOARD_NAV_UID]" })
```

### Step 1.2: Verify Dashboard Loads - MUST CHECK URL
```
mcp__chrome-devtools__take_snapshot()
```
**VERIFY:** The snapshot shows URL contains `/dashboard`
**IF WRONG URL:** Navigate directly:
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/dashboard' })
```

### Step 1.3: Click ALL Tabs on Dashboard
Find tabs in snapshot. Expected tabs: **Overview, Competitor Analysis, Architecture**

**Tab 1: Overview**
- Find "Overview" tab → click it
- Take snapshot → verify content

**Tab 2: Competitor Analysis**
- Find "Competitor Analysis" tab → click it
- Take snapshot → verify content

**Tab 3: Architecture**
- Find "Architecture" tab → click it
- Take snapshot → verify content

### Step 1.4: Check for Errors
```
mcp__chrome-devtools__list_console_messages({ types: ["error"] })
```

### Step 1.5: Record and Show Progress
```
════════════════════════════════════════════════════════════════════════════════
LEFT NAV PROGRESS: 1/15 COMPLETE
════════════════════════════════════════════════════════════════════════════════
✅ 1. Dashboard        3 tabs clicked | 0 tables | 0 errors
⬜ 2. Tasks
⬜ 3. Email            (8 sub-items)
⬜ 4. Calendar
⬜ 5. Contacts
⬜ 6. Leads
⬜ 7. Jobs             (18 sub-items)
⬜ 8. Finance          (2 sub-items)
⬜ 9. Meetings
⬜ 10. Warehouse
⬜ 11. Corporate       (2 sub-items)
⬜ 12. Portal
⬜ 13. Settings        (72 tabs total)
⬜ 14. Teeem Docs
⬜ 15. Missing         (26 sub-items)
────────────────────────────────────────────────────────────────────────────────
TOTALS: Tabs: 3 | Tables: 0 | Rows: 0 | Drawers: 0 | Errors: 0
════════════════════════════════════════════════════════════════════════════════
```

---

## LEFT NAV ITEM 2: Tasks
**EXPECTED URL:** `https://teeem-staging.vercel.app/tasks`

### Step 2.1: Click Tasks in Left Nav
```
mcp__chrome-devtools__take_snapshot()
```
Find "Tasks" in the left navigation sidebar → click it
```
mcp__chrome-devtools__click({ uid: "[TASKS_NAV_UID]" })
```

### Step 2.2: Verify Tasks Page Loads - MUST CHECK URL
```
mcp__chrome-devtools__take_snapshot()
```
**VERIFY:** URL contains `/tasks`
**IF WRONG URL:** Navigate directly:
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/tasks' })
```

### Step 2.3: Test Table
- Find table rows in snapshot
- Click first row → verify drawer opens
- Close drawer (click X or outside)

### Step 2.4: Test Create (CRUD)
1. Find "Add" or "+" button → click it
2. Fill title: "PR Test Task - DELETE ME"
3. Save
4. Verify task appears
5. Delete the test task

### Step 2.5: Check Errors
```
mcp__chrome-devtools__list_console_messages({ types: ["error"] })
```

### Step 2.6: Show Progress
```
════════════════════════════════════════════════════════════════════════════════
LEFT NAV PROGRESS: 2/15 COMPLETE
════════════════════════════════════════════════════════════════════════════════
✅ 1. Dashboard        3 tabs | 0 tables | 0 errors
✅ 2. Tasks            0 tabs | 1 table | 1 row | 1 drawer | CREATE ✓ | 0 errors
⬜ 3. Email            (8 sub-items)
⬜ 4. Calendar
⬜ 5. Contacts
⬜ 6. Leads
⬜ 7. Jobs             (18 sub-items)
⬜ 8. Finance          (2 sub-items)
⬜ 9. Meetings
⬜ 10. Warehouse
⬜ 11. Corporate       (2 sub-items)
⬜ 12. Portal
⬜ 13. Settings        (72 tabs total)
⬜ 14. Teeem Docs
⬜ 15. Missing         (26 sub-items)
────────────────────────────────────────────────────────────────────────────────
TOTALS: Tabs: 3 | Tables: 1 | Rows: 1 | Drawers: 1 | Creates: 1 | Errors: 0
════════════════════════════════════════════════════════════════════════════════
```

---

## LEFT NAV ITEM 3: Email (HAS 8 SUB-ITEMS)
**EXPECTED URL:** `https://teeem-staging.vercel.app/email`
**SUB-ITEM URLS:**
- Account 1: `/email?account=ms365_9_6588f630` (robert@tekna.com.au)
- Account 2: `/email?account=2` (robert@teeem.au)
- Account 3: `/email?account=1` (hello@coinvesthomes.com.au)
- Account 4: `/email?account=ms365_11_85f3617d` (robert@homesofhope.org.au)
- Account 5: `/email?account=ms365_10_798a35c1` (rob@100xbestlife.com)
- Account 6: `/email?account=ms365_12_ec16e727` (rob@lyw.org.au)
- Account 7: `/email?account=ms365_11_0e80ccd6` (james@homesofhope.org.au)
- Account 8: `/email?account=ms365_11_a9258d5e` (andrew@homesofhope.org.au)

### Step 3.1: Click Email in Left Nav
```
mcp__chrome-devtools__take_snapshot()
```
Find "Email" in left nav → click it
```
mcp__chrome-devtools__click({ uid: "[EMAIL_NAV_UID]" })
```

### Step 3.2: Verify Email Page Loads - MUST CHECK URL
```
mcp__chrome-devtools__take_snapshot()
```
**VERIFY:** URL contains `/email`
**IF WRONG URL:** Navigate directly:
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/email' })
```

### Step 3.3: Test Main Email Page
- Verify email list renders
- Click one email to open it
- Verify email content displays
- Close email

### Step 3.4: Test ALL 8 Email Account Sub-Items
The Email nav item should expand to show 8 email accounts. Click EACH one:

**Sub-item 3.1: robert@tekna.com.au**
- Find this account in nav or account selector → click
- Verify emails load for this account
- Take snapshot

**Sub-item 3.2: robert@teeem.au**
- Click this account
- Verify emails load
- Take snapshot

**Sub-item 3.3: hello@coinvesthomes.com.au**
- Click → verify → snapshot

**Sub-item 3.4: robert@homesofhope.org.au**
- Click → verify → snapshot

**Sub-item 3.5: rob@100xbestlife.com**
- Click → verify → snapshot

**Sub-item 3.6: rob@lyw.org.au**
- Click → verify → snapshot

**Sub-item 3.7: james@homesofhope.org.au**
- Click → verify → snapshot

**Sub-item 3.8: andrew@homesofhope.org.au**
- Click → verify → snapshot

### Step 3.5: Check Errors
```
mcp__chrome-devtools__list_console_messages({ types: ["error"] })
```

### Step 3.6: Show Progress
```
════════════════════════════════════════════════════════════════════════════════
LEFT NAV PROGRESS: 3/15 COMPLETE
════════════════════════════════════════════════════════════════════════════════
✅ 1. Dashboard        3 tabs | 0 tables | 0 errors
✅ 2. Tasks            0 tabs | 1 table | 1 row | 1 drawer | CREATE ✓ | 0 errors
✅ 3. Email            8 accounts tested | 1 email opened | 0 errors
⬜ 4. Calendar
⬜ 5. Contacts
⬜ 6. Leads
⬜ 7. Jobs             (18 sub-items)
⬜ 8. Finance          (2 sub-items)
⬜ 9. Meetings
⬜ 10. Warehouse
⬜ 11. Corporate       (2 sub-items)
⬜ 12. Portal
⬜ 13. Settings        (72 tabs total)
⬜ 14. Teeem Docs
⬜ 15. Missing         (26 sub-items)
────────────────────────────────────────────────────────────────────────────────
TOTALS: Tabs: 3 | Tables: 1 | Accounts: 8 | Emails: 1 | Errors: 0
════════════════════════════════════════════════════════════════════════════════
```

---

## LEFT NAV ITEM 4: Calendar
**EXPECTED URL:** `https://teeem-staging.vercel.app/calendar`

### Step 4.1: Click Calendar in Left Nav OR Navigate Directly
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/calendar' })
```

### Step 4.2: Verify Calendar Loads - MUST CHECK URL
```
mcp__chrome-devtools__take_snapshot()
```
**VERIFY:** URL contains `/calendar`

### Step 4.3: Test Calendar Features
- Verify calendar view loads
- Try clicking a date if possible
- Check for any tabs

### Step 4.4: Check Errors & Show Progress
```
════════════════════════════════════════════════════════════════════════════════
LEFT NAV PROGRESS: 4/15 COMPLETE
════════════════════════════════════════════════════════════════════════════════
✅ 1. Dashboard        3 tabs | 0 errors
✅ 2. Tasks            1 table | 1 drawer | CREATE ✓ | 0 errors
✅ 3. Email            8 accounts | 0 errors
✅ 4. Calendar         0 tabs | calendar renders | 0 errors
⬜ 5. Contacts
⬜ 6. Leads
⬜ 7. Jobs             (18 sub-items)
⬜ 8. Finance          (2 sub-items)
⬜ 9. Meetings
⬜ 10. Warehouse
⬜ 11. Corporate       (2 sub-items)
⬜ 12. Portal
⬜ 13. Settings        (72 tabs total)
⬜ 14. Teeem Docs
⬜ 15. Missing         (26 sub-items)
════════════════════════════════════════════════════════════════════════════════
```

---

## LEFT NAV ITEM 5: Contacts
**EXPECTED URL:** `https://teeem-staging.vercel.app/contacts`

### Step 5.1: Navigate to Contacts
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/contacts' })
```

### Step 5.2: Verify Contacts Page Loads - MUST CHECK URL
```
mcp__chrome-devtools__take_snapshot()
```
**VERIFY:** URL contains `/contacts`

### Step 5.3: Test Table
- Find table rows
- Click first contact row → drawer opens

### Step 5.4: Test Drawer Tabs (5 tabs expected)
Inside the contact drawer, click ALL tabs:
1. **Overview** → click → verify
2. **Documents** → click → verify
3. **Communication** → click → verify
4. **Billing** → click → verify
5. **Notes** → click → verify

Close drawer

### Step 5.5: Test Create
1. Find Add button → click
2. Fill name: "PR Test Contact - DELETE ME"
3. Save
4. Delete the test contact

### Step 5.6: Show Progress
```
════════════════════════════════════════════════════════════════════════════════
LEFT NAV PROGRESS: 5/15 COMPLETE
════════════════════════════════════════════════════════════════════════════════
✅ 1. Dashboard        3 tabs | 0 errors
✅ 2. Tasks            1 table | 1 drawer | CREATE ✓ | 0 errors
✅ 3. Email            8 accounts | 0 errors
✅ 4. Calendar         calendar renders | 0 errors
✅ 5. Contacts         1 table | 1 drawer | 5 drawer tabs | CREATE ✓ | 0 errors
⬜ 6. Leads
⬜ 7. Jobs             (18 sub-items)
⬜ 8. Finance          (2 sub-items)
⬜ 9. Meetings
⬜ 10. Warehouse
⬜ 11. Corporate       (2 sub-items)
⬜ 12. Portal
⬜ 13. Settings        (72 tabs total)
⬜ 14. Teeem Docs
⬜ 15. Missing         (26 sub-items)
════════════════════════════════════════════════════════════════════════════════
```

---

## LEFT NAV ITEM 6: Leads
**EXPECTED URL:** `https://teeem-staging.vercel.app/leads`

### Step 6.1: Navigate to Leads
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/leads' })
```

### Step 6.2: Verify and Test - MUST CHECK URL
```
mcp__chrome-devtools__take_snapshot()
```
**VERIFY:** URL contains `/leads`
- Click first row → drawer opens
- Test drawer tabs: **Overview, Notes**
- Close drawer

### Step 6.3: Show Progress
```
════════════════════════════════════════════════════════════════════════════════
LEFT NAV PROGRESS: 6/15 COMPLETE
════════════════════════════════════════════════════════════════════════════════
✅ 1. Dashboard        3 tabs | 0 errors
✅ 2. Tasks            1 table | CREATE ✓ | 0 errors
✅ 3. Email            8 accounts | 0 errors
✅ 4. Calendar         0 errors
✅ 5. Contacts         5 drawer tabs | CREATE ✓ | 0 errors
✅ 6. Leads            1 table | 2 drawer tabs | 0 errors
⬜ 7. Jobs             (18 sub-items)
⬜ 8. Finance          (2 sub-items)
⬜ 9. Meetings
⬜ 10. Warehouse
⬜ 11. Corporate       (2 sub-items)
⬜ 12. Portal
⬜ 13. Settings        (72 tabs total)
⬜ 14. Teeem Docs
⬜ 15. Missing         (26 sub-items)
════════════════════════════════════════════════════════════════════════════════
```

---

## LEFT NAV ITEM 7: Jobs (HAS 18 SUB-ITEMS - MOST COMPLEX)
**EXPECTED URL:** `https://teeem-staging.vercel.app/jobs`
**ALL SUB-ITEM URLS (must navigate to each):**
- Gantt Schedule: `/admin/system/schedule-master/gantt`
- Schedule Master: `/admin/system/schedule-master/data-view/setup`
- WHS: `/whs`
- Purchase Orders: `/purchase_orders`
- Quote Requests: `/quote-requests`
- Site Presence: `/admin/site-presence`
- Active Sessions: `/site_presence_sessions`
- Live Tracking: `/site-presence/live`
- Worker Profiles: `/worker_profiles`
- Cost Centres: `/cost_centres`
- Labour Costs: `/labour_cost_entries`
- Job Budgets: `/job_cost_budgets`
- AI Suggestions: `/ai_timesheet_suggestions`
- Price Book: `/pricebook`
- Price Histories: `/price_histories`
- Estimating: `/estimates`
- Recipes: `/recipes`
- Job Photos: `/jobs/photos`

### Step 7.1: Navigate to Jobs
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/jobs' })
```

### Step 7.2: Test Jobs List Page - MUST CHECK URL
```
mcp__chrome-devtools__take_snapshot()
```
**VERIFY:** URL contains `/jobs`
- Click first job row → opens job detail page

### Step 7.3: Test ALL 9 Job Detail Tabs
**Tab 1: Overview** → click → verify
**Tab 2: Contract Info** → click → verify
**Tab 3: Plans** → click → verify → if plans exist, click one to test PDF preview
**Tab 4: People** → click → verify
**Tab 5: Finance** → click → verify
  - **Sub-tab: Profit** → click → verify
  - **Sub-tab: Claims** → click → verify
  - **Sub-tab: Expenses** → click → verify
**Tab 6: Documents** → click → verify folder view
**Tab 7: Schedule** → click → verify Gantt/schedule
**Tab 8: Tasks** → click → verify task list
**Tab 9: Notes** → click → verify

Navigate back to Jobs list

### Step 7.4: Test ALL 18 Jobs Sub-Items - NAVIGATE TO EACH URL

**Sub-item 7.1: Gantt Schedule**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/admin/system/schedule-master/gantt' })
```
Take snapshot, verify Gantt loads

**Sub-item 7.2: Schedule Master**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/admin/system/schedule-master/data-view/setup' })
```
Take snapshot, verify loads

**Sub-item 7.3: WHS**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/whs' })
```
Take snapshot, test any tabs

**Sub-item 7.4: Purchase Orders**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/purchase_orders' })
```
Take snapshot, click table row if exists

**Sub-item 7.5: Quote Requests**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/quote-requests' })
```
Take snapshot, verify loads

**Sub-item 7.6: Site Presence**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/admin/site-presence' })
```
Take snapshot, verify loads

**Child 7.6.1: Active Sessions**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/site_presence_sessions' })
```
Take snapshot, verify loads

**Child 7.6.2: Live Tracking**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/site-presence/live' })
```
Take snapshot, verify loads

**Child 7.6.3: Worker Profiles**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/worker_profiles' })
```
Take snapshot, verify loads

**Child 7.6.4: Cost Centres**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/cost_centres' })
```
Take snapshot, verify loads

**Child 7.6.5: Labour Costs**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/labour_cost_entries' })
```
Take snapshot, verify loads

**Child 7.6.6: Job Budgets**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/job_cost_budgets' })
```
Take snapshot, verify loads

**Child 7.6.7: AI Suggestions**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/ai_timesheet_suggestions' })
```
Take snapshot, verify loads

**Sub-item 7.7: Price Book**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/pricebook' })
```
Take snapshot, verify loads

**Sub-item 7.8: Price Histories**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/price_histories' })
```
Take snapshot, verify loads

**Sub-item 7.9: Estimating**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/estimates' })
```
Take snapshot, verify loads

**Sub-item 7.10: Recipes**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/recipes' })
```
Take snapshot, verify loads

**Sub-item 7.11: Job Photos**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/jobs/photos' })
```
Take snapshot, verify loads

### Step 7.5: Show Progress
```
════════════════════════════════════════════════════════════════════════════════
LEFT NAV PROGRESS: 7/15 COMPLETE
════════════════════════════════════════════════════════════════════════════════
✅ 1. Dashboard        3 tabs | 0 errors
✅ 2. Tasks            1 table | CREATE ✓ | 0 errors
✅ 3. Email            8 accounts | 0 errors
✅ 4. Calendar         0 errors
✅ 5. Contacts         5 drawer tabs | CREATE ✓ | 0 errors
✅ 6. Leads            2 drawer tabs | 0 errors
✅ 7. Jobs             9 detail tabs | 3 sub-tabs | 18 sub-items | 7 site presence children | 0 errors
⬜ 8. Finance          (2 sub-items)
⬜ 9. Meetings
⬜ 10. Warehouse
⬜ 11. Corporate       (2 sub-items)
⬜ 12. Portal
⬜ 13. Settings        (72 tabs total)
⬜ 14. Teeem Docs
⬜ 15. Missing         (26 sub-items)
────────────────────────────────────────────────────────────────────────────────
JOBS SUB-ITEMS TESTED:
  ✅ Gantt Schedule    ✅ Schedule Master   ✅ WHS
  ✅ Purchase Orders   ✅ Quote Requests    ✅ Site Presence (7 children)
  ✅ Price Book        ✅ Price Histories   ✅ Estimating
  ✅ Recipes           ✅ Job Photos
════════════════════════════════════════════════════════════════════════════════
```

---

## LEFT NAV ITEM 8: Finance (HAS 2 SUB-ITEMS)
**EXPECTED URL:** `https://teeem-staging.vercel.app/finance`
**SUB-ITEM URLS:**
- Xero: `/settings/integrations/xero`
- T.A.S.: `/financial/tas`

### Step 8.1: Navigate to Finance
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/finance' })
```
Take snapshot, verify loads

### Step 8.2: Test Finance Sub-Items - NAVIGATE TO EACH

**Sub-item 8.1: Xero**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/integrations/xero' })
```
Take snapshot, test tabs: **Contacts, Invoices, Bank Transactions** (click all 3)

**Sub-item 8.2: T.A.S.**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/financial/tas' })
```
Take snapshot, test tabs: **Revenue, Expenses** (click both)

### Step 8.3: Show Progress
```
════════════════════════════════════════════════════════════════════════════════
LEFT NAV PROGRESS: 8/15 COMPLETE
════════════════════════════════════════════════════════════════════════════════
✅ 1. Dashboard        3 tabs | 0 errors
✅ 2. Tasks            CREATE ✓ | 0 errors
✅ 3. Email            8 accounts | 0 errors
✅ 4. Calendar         0 errors
✅ 5. Contacts         5 drawer tabs | CREATE ✓ | 0 errors
✅ 6. Leads            2 drawer tabs | 0 errors
✅ 7. Jobs             9 tabs | 18 sub-items | 0 errors
✅ 8. Finance          2 sub-items | Xero: 3 tabs | TAS: 2 tabs | 0 errors
⬜ 9. Meetings
⬜ 10. Warehouse
⬜ 11. Corporate       (2 sub-items)
⬜ 12. Portal
⬜ 13. Settings        (72 tabs total)
⬜ 14. Teeem Docs
⬜ 15. Missing         (26 sub-items)
════════════════════════════════════════════════════════════════════════════════
```

---

## LEFT NAV ITEM 9: Meetings
**EXPECTED URL:** `https://teeem-staging.vercel.app/meetings`

### Step 9.1: Navigate to Meetings
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/meetings' })
```

### Step 9.2: Test - VERIFY URL
```
mcp__chrome-devtools__take_snapshot()
```
**VERIFY:** URL contains `/meetings`
- Click table row if exists → drawer opens
- Close drawer

### Step 9.3: Show Progress
```
════════════════════════════════════════════════════════════════════════════════
LEFT NAV PROGRESS: 9/15 COMPLETE
════════════════════════════════════════════════════════════════════════════════
✅ 1-8. [Previous items]
✅ 9. Meetings         1 table | 1 row | 0 errors
⬜ 10. Warehouse
⬜ 11. Corporate       (2 sub-items)
⬜ 12. Portal
⬜ 13. Settings        (72 tabs total)
⬜ 14. Teeem Docs
⬜ 15. Missing         (26 sub-items)
════════════════════════════════════════════════════════════════════════════════
```

---

## LEFT NAV ITEM 10: Warehouse
**EXPECTED URL:** `https://teeem-staging.vercel.app/warehouse`

### Step 10.1: Navigate to Warehouse
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/warehouse' })
```

### Step 10.2: Test - VERIFY URL
```
mcp__chrome-devtools__take_snapshot()
```
**VERIFY:** URL contains `/warehouse`
- Test tabs: **Folders, Documents** (click both)
- Test folder navigation if possible

### Step 10.3: Show Progress
```
════════════════════════════════════════════════════════════════════════════════
LEFT NAV PROGRESS: 10/15 COMPLETE
════════════════════════════════════════════════════════════════════════════════
✅ 1-9. [Previous items]
✅ 10. Warehouse       2 tabs | 0 errors
⬜ 11. Corporate       (2 sub-items)
⬜ 12. Portal
⬜ 13. Settings        (72 tabs total)
⬜ 14. Teeem Docs
⬜ 15. Missing         (26 sub-items)
════════════════════════════════════════════════════════════════════════════════
```

---

## LEFT NAV ITEM 11: Corporate (HAS 2 SUB-ITEMS)
**EXPECTED URL:** `https://teeem-staging.vercel.app/corporate`
**SUB-ITEM URLS:**
- Assets: `/corporate/assets`
- Cases: `/cases`

### Step 11.1: Navigate to Corporate
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/corporate' })
```
Take snapshot, verify loads

### Step 11.2: Test Sub-Items - NAVIGATE TO EACH

**Sub-item 11.1: Assets**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/corporate/assets' })
```
Take snapshot, click table row if exists

**Sub-item 11.2: Cases**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/cases' })
```
Take snapshot, click table row if exists → drawer opens, close drawer

### Step 11.3: Show Progress
```
════════════════════════════════════════════════════════════════════════════════
LEFT NAV PROGRESS: 11/15 COMPLETE
════════════════════════════════════════════════════════════════════════════════
✅ 1-10. [Previous items]
✅ 11. Corporate       2 sub-items | Assets ✓ | Cases ✓ | 0 errors
⬜ 12. Portal
⬜ 13. Settings        (72 tabs total)
⬜ 14. Teeem Docs
⬜ 15. Missing         (26 sub-items)
════════════════════════════════════════════════════════════════════════════════
```

---

## LEFT NAV ITEM 12: Portal
**EXPECTED URL:** `https://teeem-staging.vercel.app/portal`

### Step 12.1: Navigate to Portal
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/portal' })
```

### Step 12.2: Verify and Test - CHECK URL
```
mcp__chrome-devtools__take_snapshot()
```
**VERIFY:** URL contains `/portal`
- Test any available features

### Step 12.3: Show Progress
```
════════════════════════════════════════════════════════════════════════════════
LEFT NAV PROGRESS: 12/15 COMPLETE
════════════════════════════════════════════════════════════════════════════════
✅ 1-11. [Previous items]
✅ 12. Portal          page loads | 0 errors
⬜ 13. Settings        (72 tabs total)
⬜ 14. Teeem Docs
⬜ 15. Missing         (26 sub-items)
════════════════════════════════════════════════════════════════════════════════
```

---

## LEFT NAV ITEM 13: Settings (72 TABS TOTAL - VERY COMPLEX)
**EXPECTED URL:** `https://teeem-staging.vercel.app/settings`
**ALL SETTINGS URLS - NAVIGATE TO EACH:**
- Profile: `/settings/profile`
- Notifications: `/settings/notifications`
- Security: `/settings/security`
- Preferences: `/settings/preferences`
- Users: `/settings/users`
- Access Control: `/settings/roles`
- Corporate: `/settings/corporate`
- Company: `/settings/company`
- Company Info: `/settings/company/info`
- Brand Colors: `/settings/company/brand-colors`
- Documents: `/settings/company/documents`
- Holidays: `/settings/company/holidays`
- Workflows: `/settings/company/workflows`
- Job Setup: `/settings/company/job-setup`
- Warehouse Config: `/settings/company/warehouse-config`
- Offline: `/settings/company/offline`
- Operations: `/settings/operations`
- Connections: `/settings/connections`
- Storage Provider: `/settings/connections/provider`
- Integrations: `/settings/connections/integrations`
- Migration: `/settings/connections/migration`
- Costs: `/settings/connections/costs`
- System: `/settings/system`
- Developer: `/settings/developer`
- Components: `/settings/developer/components`
- Tools: `/settings/developer/tools`
- Brand Guidelines: `/settings/developer/brand-guidelines`
- Unreal: `/settings/developer/unreal`

### Step 13.1: Navigate to Settings Main
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings' })
```
Take snapshot, verify loads

### Step 13.2: Test PERSONAL Tabs (4 pages) - NAVIGATE TO EACH
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/profile' })
```
Take snapshot, verify loads

```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/notifications' })
```
Take snapshot, verify loads

```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/security' })
```
Take snapshot, verify loads

```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/preferences' })
```
Take snapshot, verify loads

### Step 13.3: Test ORGANIZATION Pages - NAVIGATE TO EACH

**Users**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/users' })
```
Take snapshot, verify user list

**Access Control**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/roles' })
```
Take snapshot, click sub-tabs: **Permissions, User Roles, Groups**

**Corporate**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/corporate' })
```
Take snapshot, click sub-tabs: **Groups, Companies, Company Tabs**

**Company**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/company' })
```
Take snapshot, then navigate to each sub-page:

```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/company/info' })
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/company/brand-colors' })
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/company/documents' })
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/company/holidays' })
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/company/workflows' })
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/company/job-setup' })
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/company/warehouse-config' })
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/company/offline' })
```
Take snapshot after each, verify loads

**Operations**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/operations' })
```
Take snapshot, click sub-tabs: **Schedule Master, SM Tasks, Contact Types, Meeting Types, Supervisor Checklist, Cost**

**Connections**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/connections' })
```
Take snapshot, then navigate to each sub-page:
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/connections/provider' })
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/connections/integrations' })
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/connections/migration' })
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/connections/costs' })
```
Take snapshot after each, verify loads

**System**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/system' })
```
Take snapshot, click sub-tabs: **Navigation, AI Agents, Scheduled Jobs, Email Accounts, AI Processing, Backups, Config Sync, System Health, User Manual, Inspiring Quotes**

**Developer**
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/developer' })
```
Take snapshot, then navigate to each sub-page:
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/developer/components' })
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/developer/tools' })
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/developer/brand-guidelines' })
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/settings/developer/unreal' })
```
Take snapshot after each, verify loads

### Step 13.4: Test Settings Sub-Items in Left Nav (5 pages) - NAVIGATE TO EACH
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/support' })
```
Take snapshot, verify loads

```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/workflows/processes' })
```
Take snapshot, verify loads

```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/admin/saas-customers' })
```
Take snapshot, verify loads

```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/admin/support-tickets' })
```
Take snapshot, verify loads

```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/admin/referrers' })
```
Take snapshot, verify loads

### Step 13.5: Show Progress
```
════════════════════════════════════════════════════════════════════════════════
LEFT NAV PROGRESS: 13/15 COMPLETE
════════════════════════════════════════════════════════════════════════════════
✅ 1-12. [Previous items]
✅ 13. Settings        72 TABS TOTAL | 0 errors
────────────────────────────────────────────────────────────────────────────────
SETTINGS TABS TESTED:
  PERSONAL (4): Profile ✓, Notifications ✓, Security ✓, Preferences ✓
  ORGANIZATION:
    Users ✓
    Access Control ✓ → Permissions ✓, User Roles ✓, Groups ✓
    Corporate ✓ → Groups ✓, Companies ✓, Company Tabs ✓
    Company ✓ → Info ✓, Brand Colors ✓, Documents ✓ (3 sub), Holidays ✓,
                Workflows ✓, Job Setup ✓ (5 sub), Entity Config ✓, Offline ✓
    Operations ✓ → 6 sub-tabs ✓
    Connections ✓ → 4 sub-tabs ✓
    System ✓ → 10 sub-tabs ✓
    Developer ✓ → 4 sub-tabs ✓
  SUB-ITEMS (5): Support ✓, Workflows ✓, SaaS Customers ✓,
                 Support Tickets ✓, Referrers ✓
────────────────────────────────────────────────────────────────────────────────
⬜ 14. Teeem Docs
⬜ 15. Missing         (26 sub-items)
════════════════════════════════════════════════════════════════════════════════
```

---

## LEFT NAV ITEM 14: Teeem Docs
**EXPECTED URL:** `https://teeem-staging.vercel.app/my-docs`

### Step 14.1: Navigate to Teeem Docs
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/my-docs' })
```

### Step 14.2: Verify and Test - CHECK URL
```
mcp__chrome-devtools__take_snapshot()
```
**VERIFY:** URL contains `/my-docs`
- Click a notebook if exists
- Click a page if exists
- Verify content renders

### Step 14.3: Show Progress
```
════════════════════════════════════════════════════════════════════════════════
LEFT NAV PROGRESS: 14/15 COMPLETE
════════════════════════════════════════════════════════════════════════════════
✅ 1-13. [Previous items]
✅ 14. Teeem Docs      notebooks render | 0 errors
⬜ 15. Missing         (26 sub-items)
════════════════════════════════════════════════════════════════════════════════
```

---

## LEFT NAV ITEM 15: Missing (26 SUB-ITEMS)
**EXPECTED URL:** `https://teeem-staging.vercel.app/missing`

### Step 15.1: Navigate to Missing
```
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/missing' })
```

### Step 15.2: Take Snapshot to Find All Sub-Items
```
mcp__chrome-devtools__take_snapshot()
```
**VERIFY:** URL contains `/missing`
List all sub-items visible under Missing in the left nav

### Step 15.3: Test EACH Sub-Item (expect ~26) - NAVIGATE TO EACH
For each sub-item found:
1. Get the sub-item's URL from the nav
2. Navigate directly to that URL:
   ```
   mcp__chrome-devtools__navigate_page({ type: 'url', url: 'https://teeem-staging.vercel.app/[SUB_ITEM_PATH]' })
   ```
3. Take snapshot
4. Verify page loads (not 404)
5. Record result

### Step 15.4: Show Final Progress
```
════════════════════════════════════════════════════════════════════════════════
LEFT NAV PROGRESS: 15/15 COMPLETE - ALL DONE!
════════════════════════════════════════════════════════════════════════════════
✅ 1. Dashboard        3 tabs | 0 errors
✅ 2. Tasks            1 table | CREATE ✓ | 0 errors
✅ 3. Email            8 accounts | 0 errors
✅ 4. Calendar         0 errors
✅ 5. Contacts         5 drawer tabs | CREATE ✓ | 0 errors
✅ 6. Leads            2 drawer tabs | 0 errors
✅ 7. Jobs             9 tabs + 3 sub-tabs | 18 sub-items | 0 errors
✅ 8. Finance          2 sub-items | 5 tabs | 0 errors
✅ 9. Meetings         1 table | 0 errors
✅ 10. Warehouse       2 tabs | 0 errors
✅ 11. Corporate       2 sub-items | 0 errors
✅ 12. Portal          0 errors
✅ 13. Settings        72 tabs | 5 sub-items | 0 errors
✅ 14. Teeem Docs      0 errors
✅ 15. Missing         26 sub-items tested | [X] errors
────────────────────────────────────────────────────────────────────────────────
FINAL TOTALS:
  Nav Items:    15/15 complete
  Sub-Items:    60+ tested
  Tabs:         100+ clicked
  Tables:       15+ tested
  Rows:         20+ clicked
  Drawers:      10+ opened
  Creates:      2 (Tasks, Contacts)
  Errors:       [TOTAL]
════════════════════════════════════════════════════════════════════════════════
```

---

## PHASE 3: SAVE REPORT TO NOTEBOOK

After completing all 15 nav items:

1. Navigate to `/notebooks`
2. Find or create "Production Ready" notebook
3. Create new page with today's date
4. Paste comprehensive report including:
   - All 15 nav items with status
   - All sub-items tested
   - All tabs clicked
   - All errors found
   - Final PASS/FAIL status

---

## ERROR HANDLING

- **Page timeout**: Wait 15 sec max, mark FAIL, continue
- **404 error**: Mark FAIL, continue
- **500 error**: Note error, mark FAIL, continue
- **Console error**: Record text, mark WARN, continue

---

## MINIMUM ACCEPTANCE CRITERIA

**NOT complete until:**
- [ ] All 15 left nav items clicked and tested
- [ ] All sub-items (60+) tested
- [ ] All tabs (100+) clicked
- [ ] All tables tested with row clicks
- [ ] All drawers opened and closed
- [ ] Create tests passed (Tasks, Contacts)
- [ ] Report saved to notebook

**DO NOT STOP EARLY.**
