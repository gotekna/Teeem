# /p - Performance Visual Check + Fix

Run browser-based performance checks AND backend performance analysis.
**Automatically fix any slowness found.**

---

## Step 0: Ensure Chrome DevTools is Running

**MCP manages its own Chrome instance.** Just try to use MCP tools - it auto-starts Chrome if needed.

### Check if MCP Chrome is ready:
```javascript
mcp__chrome-devtools__list_pages()
```

If it works, proceed to Step 0.5 (Auto-Login).

### If MCP fails with "browser already running" error:
```bash
pkill -f "chrome-devtools-mcp"
rm -rf /Users/robertharder/.cache/chrome-devtools-mcp
```
Then try the MCP tool again.

**Note:** MCP uses a dedicated profile at `~/.cache/chrome-devtools-mcp/chrome-profile`, separate from your regular Chrome profiles.

---

## 🔴 CRITICAL REMINDERS (Don't Forget These!)

### FRC - Find Root Cause
**Before fixing ANY issue, STOP and ask: "WHY does this issue exist?"**
- Don't just add a bandaid fix - find the root cause
- Use the 5 Whys technique
- Fix the gap, not just the symptom
- Add guardrails to prevent recurrence

### Ultra - Ultrathink Design Philosophy
**Take a deep breath. Quality over speed.**
- Question assumptions - is there a simpler solution?
- Present 3 approaches before implementing
- Remove code instead of adding when possible
- Simplify ruthlessly - elegance is when there's nothing left to take away

### SSoT - Single Source of Truth
**Before adding/changing code, search for existing implementations:**
- Is this logic defined elsewhere? Search first!
- Check `lib/constants/`, `lib/table-atoms.ts`
- If duplicates found: STOP, document all locations, ask user which is SSoT
- Never create parallel implementations

### Gold - Gold Standard UI
**Use THE ONE component, not duplicates:**
- Table: `TeeemTableView` (not data-table.tsx)
- Spinner: `Spinner` from `@/components/ui/spinner`
- Modal: `Dialog` (not drawer)
- Check `lib/component-registry.ts` for approved components
- Always use Tailwind config colors (not hex)
- Always support dark mode (`dark:` classes)

---

## What This Command Does

1. **Automatic Login** - Logs in automatically (no user intervention needed)
2. **Visual Browser Check** - Opens pages via Chrome DevTools MCP, measures CLS/LCP
3. **Backend Performance Data** - Fetches slow queries, anomalies, endpoint stats
4. **Fixes Issues** - Automatically implements fixes for any slowness detected
5. **Tests Both Local AND Production** - Runs checks on both environments

## Execution Steps

### Step 0: Automatic Login (Chrome DevTools MCP)

**For Local (localhost:3000):**
1. Navigate to `http://localhost:3000/login`
2. Take snapshot to find form elements
3. Fill email field (uid for email input) with: `robert@tekna.com.au`
4. Fill password field (uid for password input) with: `Wisdom50-50`
5. Click "Sign in" button
6. Wait for redirect to `/dashboard`
7. Verify login successful by checking for dashboard content

**For Production (teeem.vercel.app):**
1. Navigate to `https://teeem.vercel.app/login`
2. Same login flow as above
3. Verify login successful

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

#### Email Flow
- `http://localhost:3000/email` (main email page)
- Measure time to load email list
- Click on a subfolder in the sidebar (e.g., "Sent", "Drafts", or any custom folder)
- Measure time to load folder contents
- Double-click on an email to open it
- Measure time to open email detail view

#### Tasks Flow
- `http://localhost:3000/tasks` (tasks list page)
- Measure time to load tasks list with groupings
- Double-click on a task row to open fullscreen view
- Measure time to open task in fullscreen mode
- Verify task details load completely (description, subtasks, comments)

### Detection Thresholds

For each navigation:
- Use `performance_start_trace` with `reload: false, autoStop: true`
- **CLS > 0.1** = Layout shift issue (WARN)
- **LCP > 2500ms** = Slow load (WARN)
- **LCP > 4000ms** = Very slow (FAIL)
- Take snapshot to verify content rendered (no persistent spinners >2s)

### Step 1.5: Content Validation (CRITICAL)

**CLS metrics don't catch functional bugs!** After each performance trace, take a snapshot and validate:

#### Table Content Checks
For any page with TeeemTableView:
1. **Record count mismatch**: Header shows "0 records" but groups have counts = **FAIL**
2. **Empty table with groups**: Groups visible with (N) counts but no records loaded = **FAIL**
3. **Loading state stuck**: Spinner visible for >3 seconds = **FAIL**
4. **SSR data ignored**: Page shows skeleton when SSR data was passed = **FAIL**

#### How to Detect
```
After performance_start_trace completes:
1. take_snapshot
2. Search snapshot for:
   - "0 records" text when groups show counts
   - Spinner/loading indicators still present
   - Empty table body with populated group headers
3. If found: Mark as [FAIL - Content Bug] not just CLS warning
```

#### Example: The "0 Records" Bug (2025-01-09)
```
WRONG ASSESSMENT:
  Pricebook: LCP 974ms, CLS 0.12 [WARN - borderline]

CORRECT ASSESSMENT:
  Pricebook: LCP 974ms, CLS 0.12 [FAIL - shows "0 records" but groups have 1000+ items]
```

**Root cause was:** Header used `filteredAndSortedEntries.length` (0 on SSR) instead of `serverTotalRecords` (correct count from SSR group data).

### Step 2: System Health Performance Dashboard

Navigate to the Performance Observatory page and analyze:

**URL:** `http://localhost:3000/system-health/performance`

#### What to Check

1. **Summary Metrics**
   - Total Requests & req/min rate
   - Avg Response Time (target: <100ms)
   - P95 Latency (target: <200ms)
   - P99 Latency (target: <500ms)
   - Error Rate (target: <1%)

2. **Active Anomalies** (CRITICAL)
   - Any "Slow Query Surge" alerts = investigate immediately
   - Check which table is affected and expected vs actual count
   - Example: "email_warehouses had 75 slow queries (expected: 11)" = **FIX REQUIRED**

3. **Performance Budget Compliance**
   - Target: 100% Compliant
   - Check "Top Budget Violations" section for specific endpoints
   - Common violations:
     - p99 exceeds target → Check for N+1 queries, missing indexes
     - error_rate exceeds target → Check for unhandled exceptions

4. **Slowest Endpoints (by P95)**
   - Any endpoint >500ms P95 = investigate
   - Any endpoint >1000ms P95 = **FIX REQUIRED**
   - Look for patterns: Foundation endpoints, specific tables

5. **Tables with Slow Queries**
   - Tables with >100 slow queries = **FIX REQUIRED**
   - Check avg duration - anything >500ms needs index optimization
   - Common culprits: email_warehouses, jobs, contacts

6. **Service Level Objectives (SLOs)**
   - API P95 Latency: ≤500ms
   - API Error Rate: ≤1%
   - LCP: ≤2500ms
   - CLS: ≤0.1
   - INP: ≤200ms
   - Any "Violated" status = **FIX REQUIRED**

#### Detection Thresholds

| Metric | Pass | Warn | Fail |
|--------|------|------|------|
| P95 Latency | <200ms | 200-500ms | >500ms |
| P99 Latency | <500ms | 500-1000ms | >1000ms |
| Error Rate | <0.5% | 0.5-1% | >1% |
| Slow Queries (per table) | <50 | 50-100 | >100 |
| Budget Compliance | >95% | 80-95% | <80% |

### Step 2.5: Backend Performance API (Optional)

If more detail needed, fetch from API directly:

1. `GET http://localhost:3001/api/v1/performance` - Overview metrics
2. `GET http://localhost:3001/api/v1/performance/slow_queries` - Slow DB queries
3. `GET http://localhost:3001/api/v1/performance/anomalies?status=open` - Active anomalies
4. `GET http://localhost:3001/api/v1/performance/endpoints` - Per-endpoint p95/p99

### Step 2.8: Anti-Pattern Pre-Scan

Before implementing fixes, scan for EXISTING violations of known anti-patterns:

```bash
# Check for multiple fetch triggers (anti-pattern #1)
grep -r "setAutoFetchRefreshKey" frontend-next/ --include="*.tsx" | wc -l
# If >1 location: SSoT violation

# Check for path-based view switching (anti-pattern #3)
grep -r "router.push.*view/" frontend-next/ --include="*.tsx"
# If found: Cache wipe risk

# Check for short cache TTL (anti-pattern #6)
grep -r "CACHE_TTL" frontend-next/lib/ --include="*.ts"
# If <30 min: Too aggressive
```

**If existing violations found:** Fix these FIRST before addressing new issues.

### Step 2.9: Root Cause Analysis (MANDATORY)

**🔴 DO NOT PROCEED to fixes until this step is complete.**

For EACH issue found in Steps 1-2 that needs fixing, complete the 5 Whys:

#### FRC Analysis Table

| # | Issue | Why 1 | Why 2 | Why 3 | Root Cause | Prevention |
|---|-------|-------|-------|-------|------------|------------|
| 1 | [Issue from check] | [What's happening?] | [Why is that?] | [What's the gap?] | [Real problem] | [Guardrail] |

**Format per issue:**
```
Issue: [What was detected - e.g., "Jobs Schedule LCP 4000ms"]
Why 1: [First level - what's happening? e.g., "Page slow to load"]
Why 2: [Second level - why? e.g., "Gantt chart is heavy"]
Why 3: [Third level - what's the actual gap? e.g., "No lazy loading"]
Root Cause: [The real problem e.g., "Missing dynamic() import"]
Prevention: [How to stop this class of bug e.g., "Add to dynamic import checklist"]
```

**Example - The "0 Records" Bug:**
```
Issue: Pricebook shows "0 records" but groups have 1000+ items
Why 1: Header shows wrong count
Why 2: Using filteredAndSortedEntries.length (client-side)
Why 3: SSR provides serverTotalRecords but it's not being used
Root Cause: Header reads from client state before SSR data applied
Prevention: Add to anti-patterns section, use serverTotalRecords for header
```

**GATE CHECK before proceeding:**
- [ ] All WARN/FAIL issues have FRC analysis
- [ ] Root causes identified (not symptoms)
- [ ] Prevention steps defined for each

✅ **FRC complete. Proceeding to fixes.**

### Step 3: Fix Issues Found

**🔴 VERIFY FRC TABLE COMPLETE (Step 2.9) BEFORE PROCEEDING**

Reference your FRC Analysis Table when implementing each fix:
- Use the identified **ROOT CAUSE** (not symptom)
- Implement the **PREVENTION** step after each fix
- Update anti-patterns section if new pattern discovered

**SSoT/Ultra/Gold checks:**
- **SSoT** - Is there existing code that should be used/extended?
- **Ultra** - Is there a simpler solution? Can we remove code instead of add?
- **Gold** - Use approved components from `lib/component-registry.ts`

For each issue detected, implement the appropriate fix:

| Issue Type | Fix |
|------------|-----|
| Slow query on table X | Check for missing index, add migration if needed |
| N+1 pattern | Add `.includes()` to Rails query |
| High CLS on page | Add SSR data pre-loading, skeleton, or proper loading state |
| High LCP | Optimize lazy loading, add caching, or reduce component complexity |
| Anomaly detected | Investigate and fix root cause |

**After fixing, verify:**
- Root cause addressed (not bandaid)
- No duplicate implementations created
- Uses SSoT components/patterns
- Dark mode supported if UI change

### Step 3.5: Prevention Guardrail

After implementing each fix, add a guardrail to prevent this class of bug:

| Prevention Type | When to Add | How |
|----------------|-------------|-----|
| Unit test | Logic bug | Add to `__tests__/` with the exact failing case |
| Performance budget | Metric violation | Update SLO targets in performance config |
| Anti-pattern doc | New pattern discovered | Add to anti-patterns section below |
| TypeScript guard | Type error | Add stricter types to catch at compile time |
| Code comment | Non-obvious fix | Add `// ⚠️ DO NOT SIMPLIFY` with explanation |

**Example:**
```
Fixed: SSR data ignored due to missing ref check
Prevention:
1. Added to anti-patterns section (#4)
2. Added code comment explaining why ref is needed
3. Added test case for "0 records" scenario
```

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
Email List                  750ms      0.03     [PASS]
Email > Subfolder           400ms      0.00     [PASS]
Email > Detail              500ms      0.02     [PASS]
Tasks List                  650ms      0.01     [PASS]
Tasks > Fullscreen          450ms      0.00     [PASS]
================================================================================

SYSTEM HEALTH PERFORMANCE DASHBOARD:
--------------------------------------------------------------------------------
Metric                      Value      Target     Status
--------------------------------------------------------------------------------
Avg Response Time           26ms       <100ms     [PASS]
P95 Latency                 80ms       <200ms     [PASS]
P99 Latency                 392ms      <500ms     [PASS]
Error Rate                  1.17%      <1%        [FAIL]
Budget Compliance           87%        >95%       [WARN]
Active Anomalies            2          0          [FAIL]
================================================================================

SLO COMPLIANCE:
--------------------------------------------------------------------------------
API P95 Latency             —          ≤500ms     [NO DATA]
API Error Rate              0.30%      ≤1%        [VIOLATED] 99.7% compliance
LCP                         2848ms     ≤2500ms    [VIOLATED] 68.6% compliance
CLS                         0.090      ≤0.1       [VIOLATED] 80.6% compliance
INP                         128ms      ≤200ms     [VIOLATED] 85.9% compliance
================================================================================

TOP ISSUES TO FIX:
1. /api/v1/sm_tasks: p99 3362ms (target 1000ms), error_rate 7% (target 1%)
2. email_warehouses: 839 slow queries, avg 276ms
3. job_address_searches: 205 slow queries, avg 213ms
================================================================================

ISSUES FOUND & FIXED:
1. Jobs > Schedule: High CLS (0.15) - Added SSR pre-loading for view config
2. Slow query: contacts table - Added index on display_name column

================================================================================
```

### Step 4: Regression Check (Baseline Comparison)

Compare current results against baseline stored in `.claude/perf-baseline.json`:

1. **First run:** Save results as baseline
2. **Subsequent runs:** Compare against baseline
3. **Flag regressions:** Any metric 20%+ worse = ⚠️ WARN

**Output format:**
```
REGRESSION CHECK:
--------------------------------------------------------------------------------
Page                    Metric    Now      Baseline   Delta
--------------------------------------------------------------------------------
Jobs List               LCP       800ms    750ms      +6.7%
Jobs > Schedule         CLS       0.15     0.10       +50% ⚠️
Contacts List           LCP       900ms    950ms      -5.3% ✓
--------------------------------------------------------------------------------
```

**After check, ask user:** "Update baseline with new values? (y/n)"

**Baseline file format (.claude/perf-baseline.json):**
```json
{
  "timestamp": "2026-01-15T10:30:00Z",
  "pages": {
    "Jobs List": { "lcp": 750, "cls": 0.02 },
    "Jobs > Schedule": { "lcp": 1100, "cls": 0.10 }
  },
  "backend": {
    "p95": 80,
    "p99": 392,
    "error_rate": 1.0
  }
}
```

## Chrome DevTools MCP Tools Used

- `navigate_page` - Go to each URL
- `performance_start_trace` - Start performance recording
- `performance_stop_trace` - Get CLS/LCP results
- `take_snapshot` - Check for loading states / content
- `click` - Navigate to tabs/items
- `wait_for` - Wait for content to appear

## Environments to Test

| Environment | Frontend URL | Backend API |
|-------------|--------------|-------------|
| Local | http://localhost:3000 | http://localhost:3001 |
| Production | https://teeem.vercel.app | https://teeemlive-ce8e2660a615.herokuapp.com |

**Run checks on BOTH environments** and compare results.

## Login Credentials

- **Email:** robert@tekna.com.au
- **Password:** Wisdom50-50

## Notes

- Always login first before checking pages
- If login fails, report error and stop
- Compare local vs production performance to catch deployment regressions

---

## 🔴 ANTI-PATTERNS: What NOT To Do When Fixing Performance

**Lessons learned from past sessions. DO NOT repeat these mistakes.**

### 1. DON'T Add Multiple Fetch Triggers (SSoT Violation)

```typescript
// ❌ BAD: Two places trigger data fetch
if (condition1) setAutoFetchRefreshKey(prev => prev + 1);
// ... later in code ...
if (condition2) setAutoFetchRefreshKey(prev => prev + 1);

// ✅ GOOD: Single SSoT for fetch trigger
} finally {
  if (!hasAppliedInitialRecordsRef.current) {
    setAutoFetchRefreshKey(prev => prev + 1);
  }
}
```

**Why:** Multiple triggers = data reloads unexpectedly, defeating caching.

### 2. DON'T Add Volatile Dependencies to useEffect

```typescript
// ❌ BAD: baseFiltersKey changes during initialization
useEffect(() => {
  fetchData();
}, [foundationId, baseFiltersKey]); // baseFiltersKey changes = double fetch!

// ✅ GOOD: Check if already loaded before fetching
useEffect(() => {
  if (hasAppliedInitialRecordsRef.current && records.length > 0) {
    return; // Skip duplicate fetch
  }
  fetchData();
}, [foundationId, baseFiltersKey]);
```

**Why:** Dependencies that change during initialization cause duplicate fetches.

### 3. DON'T Use Path-Based Navigation for View Switching

```typescript
// ❌ BAD: Full page reload, wipes cached data
router.push('/contacts/view/company_role');

// ✅ GOOD: Query param navigation, keeps component mounted
router.push('/contacts?view=company_role', { scroll: false });
```

**Why:** Path-based navigation unmounts component → SSR reload → cache wiped.

### 4. DON'T Forget to Check if SSR Data Already Applied

```typescript
// ❌ BAD: Always fetches, ignores SSR data
useEffect(() => {
  fetchRecords();
}, []);

// ✅ GOOD: Skip fetch if SSR/cache data already applied
useEffect(() => {
  if (hasAppliedInitialRecordsRef.current && autoFetchedRecords.length > 0) {
    console.log('[TeeemTableView] SSR data already applied, skipping fetch');
    return;
  }
  fetchRecords();
}, []);
```

**Why:** SSR pre-loads data. Fetching again = slow + flash of loading state.

### 5. DON'T Add Refs Without Understanding WHY

Adding refs like `hasAppliedInitialRecordsRef` is often a bandaid. Ask:
- Why is the effect running multiple times?
- Is there a dependency that shouldn't be there?
- Can we restructure to avoid needing the ref?

### 6. DON'T Decrease Cache TTL "For Safety"

```typescript
// ❌ BAD: Short cache = frequent reloads
export const CACHE_TTL_RECORDS = 5 * 60 * 1000; // 5 minutes

// ✅ GOOD: Longer cache, rely on invalidation after mutations
export const CACHE_TTL_RECORDS = 30 * 60 * 1000; // 30 minutes
```

**Why:** Mutations already call `clearCachedRecords()`. Short TTL = bad UX.

### Summary: Performance Fix Checklist

Before implementing ANY performance fix, verify:

| Check | Question |
|-------|----------|
| SSoT | Is there already a mechanism for this? Search first! |
| Dependencies | Will this change cause effects to re-run? |
| Navigation | Will this cause a full page reload? |
| Cache | Am I working WITH the cache or fighting it? |
| Refs | Am I adding a ref as a bandaid for a design issue? |

---

### How Each Anti-Pattern Was Discovered (FRC History)

**Learn from past FRC analysis to recognize patterns faster:**

| # | Anti-Pattern | Issue Found | 5 Whys Summary | Date |
|---|--------------|-------------|----------------|------|
| 1 | Multiple fetch triggers | Jobs page loaded twice | → Two places called `setAutoFetchRefreshKey` → SSoT violation | 2025-12 |
| 2 | Volatile useEffect deps | Contacts fetched 3x on load | → `baseFiltersKey` changed during init → dependency too broad | 2025-12 |
| 3 | Path-based view switch | Cache wiped on view change | → `router.push` unmounts → cache cleared → used path not query | 2026-01 |
| 4 | SSR data ignored | "0 records" displayed | → Client state read before SSR applied → wrong variable | 2025-01-09 |
| 5 | Refs as bandaids | Added ref but bug returned | → Ref hid the real issue → effect still ran twice | 2025-12 |
| 6 | Short cache TTL | Constant reloading | → Reduced TTL "for safety" → but mutations already clear cache | 2025-12 |

**Use this table to:**
1. Recognize if your current issue matches a known pattern
2. Learn the 5 Whys process from past bugs
3. Add new patterns when discovered during `/p` runs
