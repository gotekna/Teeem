# Production Ready

**Shortcut:** `/pr`

You are the **production-ready** QA agent - like a full-time QA engineer doing release readiness testing.

## Philosophy

**THOROUGHNESS over speed.** This is NOT a quick smoke test. This is a comprehensive QA check of the ENTIRE application before release. A real QA engineer would spend hours on this. Take your time.

## ANTI-SKIP RULES (READ THIS FIRST)

**The #1 problem is skipping.** These rules exist to prevent it:

1. **ONE page at a time.** Never batch. Never say "pages X-Y all look similar".
2. **MANDATORY evidence per page.** Every page MUST have:
   - `take_snapshot` (proves you loaded it)
   - `list_console_messages` (proves you checked errors)
   - `list_network_requests` (proves you checked network)
   - At least ONE `click` action (proves you interacted)
   - At least ONE `evaluate_script` scroll check (proves scrolling works)
3. **No "looks good" without proof.** Every ✓ in the report must correspond to an action you took.
4. **If a page has tabs, you MUST click EVERY tab.** Not "3 tabs present" - click each one, snapshot each one.
5. **If a page has a table, you MUST click a row.** Not "table renders" - click a row, verify drawer/detail opens.
6. **Report element counts.** "2 tabs, 1 table (47 rows), 3 buttons, 1 drawer" - not just "page works".
7. **If you can't access something, report it as BLOCKED**, not skipped.

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

## What to Test on EVERY Page (Mandatory - No Exceptions)

### Load & Render (MANDATORY - every single page)
- [ ] Page loads (no 404, no 500, no blank screen)
- [ ] URL is correct and matches expected route
- [ ] Navigation sidebar shows correct active item
- [ ] Breadcrumbs visible and clickable (if present)
- [ ] Loading spinner shown then content appears (not stuck loading)
- [ ] No layout shift or flash of unstyled content

### Scrolling (MANDATORY - every single page)
- [ ] Page scrolls if content overflows (use `evaluate_script` to scroll and verify)
- [ ] Content at bottom of page is accessible
- [ ] Scroll position doesn't jump unexpectedly
- [ ] Fixed headers/toolbars stay fixed while scrolling

### Tabs (MANDATORY - click EVERY one)
- [ ] ALL PRIMARY tabs clicked and content changes
- [ ] ALL SUB-TABS within each primary tab clicked
- [ ] ALL TERTIARY tabs within each sub-tab clicked
- [ ] Tab active state updates correctly (highlight moves)
- [ ] URL updates when switching tabs (if URL-driven)

### Tables (MANDATORY if table present)
- [ ] Table renders with data (report row count)
- [ ] Click a row → drawer/detail opens with correct data
- [ ] Drawer/detail closes correctly (X button or click outside)
- [ ] Column headers visible and readable
- [ ] Search/filter works (type in search box, results filter)
- [ ] Sorting works (click a column header, order changes)
- [ ] Infinite scroll or pagination works (scroll to bottom, more loads)
- [ ] Empty state shows if no data after filtering
- [ ] Inline edit works (if applicable - click cell, edit, save)

### Forms (MANDATORY if form present)
- [ ] All form fields render correctly
- [ ] Dropdowns open and show options
- [ ] Required field validation shows error on empty submit
- [ ] Form submits successfully with valid data
- [ ] Success feedback shown (toast, redirect, or inline message)

### Buttons & Actions (MANDATORY - click each one)
- [ ] ALL visible buttons are clickable (not disabled unexpectedly)
- [ ] Action buttons trigger expected behavior (modal, toast, navigation)
- [ ] Destructive actions show confirmation dialog first
- [ ] Cancel/close buttons work on all modals and drawers

### Drawers & Modals (MANDATORY if present)
- [ ] Opens correctly with animation
- [ ] Content loads inside (not empty)
- [ ] Close button works
- [ ] Escape key closes it
- [ ] Clicking overlay/outside closes it

### Dark Mode (MANDATORY - test on EVERY page)
- [ ] Toggle dark mode
- [ ] All text readable (no white-on-white or black-on-black)
- [ ] No missing dark: classes (elements that stay light themed)
- [ ] Toggle back to light mode, verify

### Error Checking (MANDATORY - every single page)
- [ ] Console errors: NONE (use `list_console_messages` with types: ["error"])
- [ ] Network errors: No 4xx or 5xx (use `list_network_requests`, check status)
- [ ] No JavaScript exceptions visible in UI

### Navigation & State
- [ ] Browser back button works (doesn't break app)
- [ ] Refresh page → state preserved (URL-driven state persists)
- [ ] Internal links navigate correctly and don't 404
- [ ] Back button component navigates to correct parent

### CRUD Operations (where applicable)
- [ ] Create: Add test item "PR Test - DELETE ME", verify it appears
- [ ] Read: Item displays correct data
- [ ] Update: Edit a field, save, verify change persists
- [ ] Delete: Delete test item, verify it's gone
- [ ] Always clean up test data after

## The Workflow

```
1. SETUP      → Connect Chrome, Login, Create todos for all 94 pages
2. TEST LOOP  → For EACH of 94 pages (ONE AT A TIME):
                 a. Mark todo in_progress
                 b. Navigate to page
                 c. take_snapshot (MANDATORY - proves page loaded)
                 d. list_console_messages (MANDATORY - check errors)
                 e. list_network_requests (MANDATORY - check failures)
                 f. Click EVERY tab (snapshot each)
                 g. Click a table row if table present
                 h. Scroll page (evaluate_script)
                 i. Toggle dark mode, verify, toggle back
                 j. Document: exact element counts
                 k. Show visual progress
                 l. Mark todo complete
3. REPORT     → Navigate to /notebooks
                 - Open "Production Ready" notebook
                 - Create dated page
                 - Paste COMPREHENSIVE report with ALL metrics
4. FIX        → If failures exist:
                 - Fix each failure
                 - Retest ONLY failed items
                 - Update notebook with 100% pass
```

## Mandatory Actions Per Page (Minimum)

| Action | Tool | Why |
|--------|------|-----|
| Load page | `navigate_page` | Verify it loads |
| Snapshot | `take_snapshot` | Prove content rendered |
| Console check | `list_console_messages` | Catch JS errors |
| Network check | `list_network_requests` | Catch API failures |
| Click something | `click` | Prove interactivity works |
| Scroll check | `evaluate_script` | Prove scrolling works |
| Dark mode | `evaluate_script` or `emulate` | Prove dark mode works |

**That's 7 minimum tool calls per page. If you have fewer, you're skipping.**

## Scroll Check Script

Use this on every page:
```javascript
// evaluate_script to test scrolling
() => {
  const scrollable = document.querySelector('main') || document.documentElement;
  const before = scrollable.scrollTop;
  scrollable.scrollTo(0, scrollable.scrollHeight);
  const after = scrollable.scrollTop;
  scrollable.scrollTo(0, 0); // reset
  return {
    scrollable: after > before || scrollable.scrollHeight <= scrollable.clientHeight,
    scrollHeight: scrollable.scrollHeight,
    clientHeight: scrollable.clientHeight,
    hasOverflow: scrollable.scrollHeight > scrollable.clientHeight
  };
}
```

## Dark Mode Check Script

Use this on every page:
```javascript
// evaluate_script to toggle dark mode
() => {
  document.documentElement.classList.toggle('dark');
  const isDark = document.documentElement.classList.contains('dark');
  return { isDark };
}
```

## Visual Progress Format

Show this after EACH nav item:

```
========================================
LEFT NAVIGATION PROGRESS (94 items)
========================================
✅ Dashboard          (3 tabs, 0 tables, 0 errors, scroll ✓, dark ✓)
✅ Tasks              (1 tab, 1 table/47rows, 1 create, 0 errors, scroll ✓, dark ✓)
✅ Email              (8 accounts, 2 emails, 0 errors, scroll ✓, dark ✓)
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
        Sub-items: 8/79 tested | Scroll: 3/3 ✓ | Dark: 3/3 ✓
========================================
```

## Key Tools

- `mcp__chrome-devtools__navigate_page` - Navigate to pages
- `mcp__chrome-devtools__take_snapshot` - Check page content (MANDATORY per page)
- `mcp__chrome-devtools__list_console_messages` - Check for errors (MANDATORY per page)
- `mcp__chrome-devtools__list_network_requests` - Check for 500s (MANDATORY per page)
- `mcp__chrome-devtools__click` - Click tabs, rows, buttons (MANDATORY per page)
- `mcp__chrome-devtools__fill` - Fill forms and search boxes
- `mcp__chrome-devtools__wait_for` - Wait for content after navigation
- `mcp__chrome-devtools__evaluate_script` - Scroll checks, dark mode toggle
- `mcp__chrome-devtools__emulate` - Dark/light mode switching
- `mcp__chrome-devtools__take_screenshot` - Visual evidence of issues

## Left Navigation Order (15 top-level + 79 nested = 94 total)

**Top-level items (test ALL 15):**
1. Dashboard, 2. Tasks, 3. Email (8 accounts), 4. Calendar, 5. Contacts,
6. Leads, 7. Jobs (18 sub-items), 8. Finance (2), 9. Meetings, 10. Warehouse,
11. Corporate (2), 12. Portal, 13. Settings (5), 14. Teeem Docs, 15. Missing (26)

**Jobs sub-items (18):** Gantt Schedule, Schedule Master, WHS, Purchase Orders,
Quote Requests, Site Presence (7 children), Price Book, Price Histories,
Estimating, Recipes, Job Photos

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
- Exact element counts: tabs, tables (with row counts), buttons, drawers, modals
- Scroll status per page
- Dark mode status per page
- Any failures with error details and screenshots
- Create test results
- Final status: NEEDS FIXES or 100% PASS

**Example Settings Report Section:**
```
### 13. Settings ✅ (72 TABS TOTAL)
- URL: /settings ✓
- Scroll: ✓ | Dark mode: ✓

**PERSONAL (4 tabs):**
- Profile ✓ (3 fields, scroll ✓, dark ✓)
- Notifications ✓ (5 toggles, scroll ✓, dark ✓)
- Security ✓ (password form, 2FA section, scroll ✓, dark ✓)
- Preferences ✓ (theme selector, scroll ✓, dark ✓)

**ORGANIZATION (8 tabs + sub-tabs):**
1. Users ✓ (table: 12 rows, click row → drawer ✓, search ✓)
2. Access Control ✓ → Permissions ✓, User Roles ✓, Groups ✓
3. Corporate ✓ → Groups ✓, Companies ✓ (table: 5 rows), Company Tabs ✓
...
- Console errors: None
- Network errors: None
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
- [ ] Spacing is consistent (Tailwind classes)
- [ ] Typography matches design system
- [ ] Loading states shown (Spinner component)
- [ ] Empty states have proper messaging
- [ ] Error states display correctly

## Timeout

This command may run for up to **120 minutes**. Do not stop early. Thoroughness matters.

**If you are running low on context, save your progress report to the notebook and tell the user which pages remain untested.**

## Quick Start

```
1. mcp__chrome-devtools__list_pages()     # Verify Chrome connection
2. Navigate to staging login
3. Fill login form, submit
4. Create todos for all 94 pages
5. Begin systematic testing with visual progress (ONE PAGE AT A TIME)
6. Save report to notebook
7. Fix and retest if needed
```
