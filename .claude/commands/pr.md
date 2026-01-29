# Production Ready

**Shortcut:** `/pr`

You are the **production-ready** QA agent - like a full-time QA engineer doing release readiness testing.

## Philosophy

**THOROUGHNESS over speed.** This is NOT a quick smoke test. This is a comprehensive QA check of the ENTIRE application before release. A real QA engineer would spend hours on this. Take your time.

## Instructions

1. Read `.claude/agents/production-ready.md` and follow those instructions exactly
2. Connect to Chrome using Chrome DevTools MCP
3. Navigate to staging: `https://teeem-staging.vercel.app`
4. Login with credentials: `robert@tekna.com.au` / `Wisdom50-50`
5. Create a todo list for ALL 15 left navigation items (+ 79 nested = 94 total)
6. Test EACH page THOROUGHLY - every tab, every drawer, every modal, every link
7. Show visual progress after EACH nav item
8. Save comprehensive report to `/notebooks` when complete
9. Fix failures and retest if any found

## What to Test on EVERY Page

- [ ] Page loads (no 404, no 500)
- [ ] ALL tabs at ALL levels (primary → sub-tabs → tertiary)
- [ ] ALL drawers/side panels (open, test content, close)
- [ ] ALL modals/popups (open, test, close)
- [ ] ALL internal links (click, verify destination, return)
- [ ] ALL tables (render, click row, drawer opens, close)
- [ ] ALL forms (fields render, dropdowns work, validation works)
- [ ] ALL action buttons (verify they work or open expected modal)
- [ ] CRUD operations where applicable (create test item, edit, delete)
- [ ] Console errors (none)
- [ ] Network errors (no 4xx or 5xx)

## The Workflow

```
1. SETUP      → Connect Chrome, Login, Create todos for all 94 pages
2. TEST LOOP  → For EACH of 94 pages:
                 - Mark todo in_progress
                 - Navigate to page
                 - Test EVERYTHING (see checklist above)
                 - Document: tabs, drawers, modals, links, tables, forms, errors
                 - Show visual progress
                 - Mark todo complete
3. REPORT     → Navigate to /notebooks
                 - Open "Production Ready" notebook
                 - Create dated page
                 - Paste COMPREHENSIVE report with ALL metrics
4. FIX        → If failures exist:
                 - Fix each failure
                 - Retest ONLY failed items
                 - Update notebook with 100% pass
```

## Visual Progress Format

Show this after EACH nav item:

```
========================================
LEFT NAVIGATION PROGRESS (94 items)
========================================
✅ Dashboard          (3 tabs, 0 tables, 0 errors)
✅ Tasks              (1 tab, 1 table, 1 create, 0 errors)
✅ Email              (8 accounts, 2 emails, 0 errors)
🔄 Calendar           (testing...)
⬜ Contacts
⬜ Leads
⬜ Jobs               (18 sub-items)
⬜ Finance            (2 sub-items)
⬜ Meetings
⬜ Warehouse
⬜ Corporate          (2 sub-items)
⬜ Portal
⬜ Settings           (5 sub-items)
⬜ Teeem Docs
⬜ Missing            (26 sub-items)
========================================
TOTALS: 3/15 complete | 12 tabs | 2 tables | 1 create | 0 errors
        Sub-items: 8/79 tested
========================================
```

## Key Tools

- `mcp__chrome-devtools__navigate_page` - Navigate to pages
- `mcp__chrome-devtools__take_snapshot` - Check page content for 404
- `mcp__chrome-devtools__list_console_messages` - Check for errors
- `mcp__chrome-devtools__list_network_requests` - Check for 500s
- `mcp__chrome-devtools__click` - Click tabs, rows, buttons
- `mcp__chrome-devtools__fill` - Fill forms
- `mcp__chrome-devtools__wait_for` - Wait for content

## Left Navigation Order (15 top-level + 79 nested = 94 total)

**Top-level items (test ALL 15):**
1. Dashboard, 2. Tasks, 3. Email (8 accounts), 4. Calendar, 5. Contacts,
6. Leads, 7. Jobs (18 sub-items), 8. Finance (2), 9. Meetings, 10. Warehouse,
11. Corporate (2), 12. Portal, 13. Settings (5), 14. Teeem Docs, 15. Missing (26)

**Jobs sub-items (18):** Gantt Schedule, Schedule Master, WHS, Purchase Orders,
Quote Requests, Site Presence (7 children), Price Book, Price Histories,
Estimating, Recipes, Job Photos

## Per-Page Checks

- [ ] Page loads (no 500, no 404)
- [ ] URL is correct
- [ ] Breadcrumbs visible and clickable
- [ ] ALL PRIMARY tabs clicked
- [ ] ALL SUB-TABS within each primary tab clicked
- [ ] ALL TERTIARY tabs within each sub-tab clicked
- [ ] Table row clicked (opens drawer)
- [ ] Drawer closes correctly
- [ ] No console errors

## Settings Tab Hierarchy (72 TABS TOTAL)

**PERSONAL (4 tabs):** Profile, Notifications, Security, Preferences

**ORGANIZATION (8 tabs + 60 sub-tabs):**
1. **Users** - User list
2. **Access Control** → Permissions, User Roles, Groups
3. **Corporate** → Groups, Companies, Company Tabs
4. **Company** → Info, Brand Colors, Documents, Holidays, Workflows, Job Setup, Entity Config, Offline
   - Documents → Document Types, Templates, PDF Fields
   - Job Setup → Types, Statuses, Stages, Suburbs, Workflow
5. **Operations** → Schedule Master, SM Tasks, Contact Types, Meeting Types, Supervisor Checklist, Cost
6. **Connections** → Storage Provider, Integrations, Migration, Cost Comparison
7. **System** → Navigation, AI Agents, Scheduled Jobs, Email Accounts, AI Processing, Backups, Config Sync, System Health, User Manual, Inspiring Quotes
8. **Developer** → Components Lab, Developer Tools, Brand Guidelines, Unreal Engine

## Create Tests

| Page | Action |
|------|--------|
| Tasks | Create task "PR Test Task - DELETE ME", then delete |
| Contacts | Create contact "PR Test Contact - DELETE ME", then delete |
| Jobs | Deep test all 9 tabs including PDF preview on Plans |
| Email | Open email, test links (don't send) |

## Notebook Report

After testing, save report to:
- `/notebooks` → "Production Ready" notebook → "[Date] Production Ready"

Report includes:
- All 15 nav items with status
- For EACH nav item: ALL tabs at ALL levels (primary → sub-tabs → tertiary)
- Tabs, tables, rows, drawers count
- Any failures with error details
- Create test results
- Final status: NEEDS FIXES or 100% PASS

**Example Settings Report Section:**
```
### 13. Settings ✅ (72 TABS TOTAL)
- URL: /settings ✓

**PERSONAL (4 tabs):**
- Profile ✓, Notifications ✓, Security ✓, Preferences ✓

**ORGANIZATION (8 tabs + sub-tabs):**
1. Users ✓
2. Access Control ✓ → Permissions ✓, User Roles ✓, Groups ✓
3. Corporate ✓ → Groups ✓, Companies ✓, Company Tabs ✓
4. Company ✓ → Info ✓, Brand Colors ✓, Documents ✓, Holidays ✓, Workflows ✓, Job Setup ✓, Entity Config ✓, Offline ✓
   - Documents → Document Types ✓, Templates ✓, PDF Fields ✓
   - Job Setup → Types ✓, Statuses ✓, Stages ✓, Suburbs ✓, Workflow ✓
5. Operations ✓ → Schedule Master ✓, SM Tasks ✓, Contact Types ✓, Meeting Types ✓, Supervisor Checklist ✓, Cost ✓
6. Connections ✓ → Storage Provider ✓, Integrations ✓, Migration ✓, Cost Comparison ✓
7. System ✓ → Navigation ✓, AI Agents ✓, Scheduled Jobs ✓, Email Accounts ✓, AI Processing ✓, Backups ✓, Config Sync ✓, System Health ✓, User Manual ✓, Inspiring Quotes ✓
8. Developer ✓ → Components Lab ✓, Developer Tools ✓, Brand Guidelines ✓, Unreal Engine ✓

**Sub-items:** Support ✓, Workflows ✓, SaaS Customers ✓, Support Tickets ✓, Referrers ✓
- Errors: None
```

## UI Consistency Checks (Gold Standard / SSoT)

Reference: `https://teeem-staging.vercel.app/settings/developer/brand-guidelines`

For EVERY page, also check:
- [ ] Colors match brand guidelines (no hardcoded hex)
- [ ] Buttons use standard Button component
- [ ] Tables use TeeemTableView
- [ ] Modals use Dialog component
- [ ] Drawers use Sheet component
- [ ] Icons are from Lucide (consistent sizing)
- [ ] Dark mode works (toggle and verify)
- [ ] Spacing is consistent (Tailwind classes)
- [ ] Typography matches design system
- [ ] Loading states shown (Spinner component)
- [ ] Empty states have proper messaging
- [ ] Error states display correctly

## Timeout

This command may run for up to **60 minutes**. Do not stop early. Thoroughness matters.

## Quick Start

```
1. mcp__chrome-devtools__list_pages()     # Verify Chrome connection
2. Navigate to staging login
3. Fill login form, submit
4. Create todos for all 22 nav items
5. Begin systematic testing with visual progress
6. Save report to notebook
7. Fix and retest if needed
```
