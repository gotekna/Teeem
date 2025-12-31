# /p - Performance Visual Check + Fix

Run browser-based performance checks AND backend performance analysis.
**Automatically fix any slowness found.**

## What This Command Does

1. **Visual Browser Check** - Opens pages via Chrome DevTools MCP, measures CLS/LCP
2. **Backend Performance Data** - Fetches slow queries, anomalies, endpoint stats
3. **Fixes Issues** - Automatically implements fixes for any slowness detected

## Execution Steps

### Step 1: Visual Browser Check (Chrome DevTools MCP)

Navigate to each page and run performance traces:

#### Jobs Flow
- `http://localhost:3000/jobs` (list page)
- Click first job, then check each tab:
  - Overview
  - Schedule (Gantt)
  - Documents
  - Financials
  - Activity
  - Settings

#### Contacts Flow
- `http://localhost:3000/contacts` (list page)
- Click first contact, then check ALL tabs:
  - Overview (main contact details)
  - Corporate (with subtabs: Identity, Summary)
  - Documents
  - Financial (with subtabs: Bank, Xero, Bills, Jobs, POs)
  - Coms (Communications)
  - Cases
  - Emails
  - Invoices (if customer)
  - Pricebook (if supplier)
  - Portal Access
  - Directorships (if person with directorships)

#### Pricebook Flow
- `http://localhost:3000/pricebook` (list page)
- Click first item, verify all sections render:
  - Pricing Information
  - Item Details
  - Price History table
  - Data Quality Settings
  - Images
  - Supplier
  - Risk Analysis

### Detection Thresholds

For each navigation:
- Use `performance_start_trace` with `reload: false, autoStop: true`
- **CLS > 0.1** = Layout shift issue (WARN)
- **LCP > 2500ms** = Slow load (WARN)
- **LCP > 4000ms** = Very slow (FAIL)
- Take snapshot to verify content rendered (no persistent spinners >2s)

### Step 2: Backend Performance Data

Fetch from API and analyze:

1. `GET http://localhost:3001/api/v1/performance` - Overview metrics
2. `GET http://localhost:3001/api/v1/performance/slow_queries` - Slow DB queries
3. `GET http://localhost:3001/api/v1/performance/anomalies?status=open` - Active anomalies
4. `GET http://localhost:3001/api/v1/performance/endpoints` - Per-endpoint p95/p99

### Step 3: Fix Issues Found

For each issue detected, implement the appropriate fix:

| Issue Type | Fix |
|------------|-----|
| Slow query on table X | Check for missing index, add migration if needed |
| N+1 pattern | Add `.includes()` to Rails query |
| High CLS on page | Add SSR data pre-loading, skeleton, or proper loading state |
| High LCP | Optimize lazy loading, add caching, or reduce component complexity |
| Anomaly detected | Investigate and fix root cause |

### Output Format

Display summary table:

```
================================================================================
                       PERFORMANCE CHECK RESULTS
================================================================================
Page                        LCP        CLS      Status
--------------------------------------------------------------------------------
Jobs List                   800ms      0.02     [PASS]
Jobs > Overview             600ms      0.00     [PASS]
Jobs > Schedule            1200ms      0.15     [WARN] High CLS
Jobs > Documents            500ms      0.00     [PASS]
Jobs > Financials           700ms      0.00     [PASS]
Jobs > Activity             450ms      0.00     [PASS]
Jobs > Settings             400ms      0.00     [PASS]
Contacts List               900ms      0.05     [PASS]
Contacts > Overview         550ms      0.00     [PASS]
Contacts > Corporate        600ms      0.00     [PASS]
Contacts > Documents        500ms      0.00     [PASS]
Contacts > Financial        650ms      0.00     [PASS]
Contacts > Coms             400ms      0.00     [PASS]
Contacts > Cases            500ms      0.00     [PASS]
Contacts > Emails           700ms      0.00     [PASS]
Pricebook List              600ms      0.00     [PASS]
Pricebook > Item            550ms      0.00     [PASS]
================================================================================

BACKEND PERFORMANCE:
- p95 Response Time: 234ms
- Slow Queries: 2 detected
- Open Anomalies: 1

ISSUES FOUND & FIXED:
1. Jobs > Schedule: High CLS (0.15) - Added SSR pre-loading for view config
2. Slow query: contacts table - Added index on display_name column

================================================================================
```

## Chrome DevTools MCP Tools Used

- `navigate_page` - Go to each URL
- `performance_start_trace` - Start performance recording
- `performance_stop_trace` - Get CLS/LCP results
- `take_snapshot` - Check for loading states / content
- `click` - Navigate to tabs/items
- `wait_for` - Wait for content to appear

## Notes

- Backend API runs on port 3001
- Frontend runs on port 3000
- Check both local and production if needed
- For production checks, use `https://teeemlive.vercel.app`
