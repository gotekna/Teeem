# Sentry Error Fixer

**Shortcut:** `/sen`

Fetches unresolved Sentry errors and fixes them with FRC discipline.

## Instructions

### Step 1 - Fetch Sentry Issues (Fail Fast)

**Try backend first, then frontend.** If the API returns 401/404, STOP and tell the user the token is invalid or the project slug is wrong. Do NOT proceed with empty data.

```bash
# Backend errors
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/projects/teeem-pty-ltd/teeem-backend/issues/?query=is:unresolved&sort=freq&statsPeriod=14d" \
  | python3 -c "
import sys
lines = sys.stdin.read().strip().split('\n')
http_code = lines[-1] if lines else '0'
body = '\n'.join(lines[:-1])

if http_code != '200':
    print(f'FAIL: Sentry API returned HTTP {http_code}')
    if http_code in ('401', '403'):
        print('Token invalid or expired. Check \$SENTRY_AUTH_TOKEN')
    elif http_code == '404':
        print('Project not found. Check org/project slug.')
    else:
        print(f'Response: {body[:200]}')
    sys.exit(1)

import json
issues = json.loads(body)
if not issues:
    print('No unresolved backend issues in last 14 days.')
else:
    print(f'=== BACKEND ERRORS ({len(issues[:15])} of {len(issues)}) ===')
    for i, issue in enumerate(issues[:15]):
        level = issue.get('level', '?')
        count = issue.get('count', 0)
        title = issue.get('title', '?')[:80]
        short_id = issue.get('shortId', '?')
        last_seen = issue.get('lastSeen', '?')[:10]
        print(f'{i+1:2}. [{level:7}] {count:>5}x | {short_id:15} | {title} | last: {last_seen}')
"
```

Then repeat for frontend (`teeem-frontend` project).

**Fail fast rules:**
- HTTP 401/403 → STOP, tell user token is bad
- HTTP 404 → STOP, tell user project slug is wrong
- Empty response / JSON parse error → STOP, show raw response
- No issues found → Tell user, don't pretend there are errors to fix

### Step 2 - Present Issues to User

Show the list and ask: **"Which issue do you want to fix? (number or 'all' for top critical)"**

Categorise issues before presenting:
- **Critical**: Crashes, data corruption, security (PG::ForeignKeyViolation, NoMethodError on save, tenant leakage)
- **High**: Broken features (undefined method, nil reference in controller)
- **Medium**: N+1 queries, performance (skip unless user asks)
- **Low**: Warnings, deprecations (skip unless user asks)

### Step 3 - Fetch Stack Trace for Selected Issue

For the chosen issue, fetch the latest event with stack trace:

```bash
ISSUE_ID="<selected_issue_id>"
curl -s -w "\n%{http_code}" -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/issues/${ISSUE_ID}/events/latest/" \
  | python3 -c "
import sys
lines = sys.stdin.read().strip().split('\n')
http_code = lines[-1] if lines else '0'
body = '\n'.join(lines[:-1])

if http_code != '200':
    print(f'FAIL: Could not fetch event (HTTP {http_code})')
    sys.exit(1)

import json
event = json.loads(body)
print('=== ERROR DETAILS ===')
print(f'Title: {event.get(\"title\", \"?\")}')
print(f'Date: {event.get(\"dateCreated\", \"?\")}')

for entry in event.get('entries', []):
    if entry.get('type') == 'exception':
        for val in entry.get('data', {}).get('values', []):
            print(f'Type: {val.get(\"type\", \"?\")}')
            print(f'Value: {val.get(\"value\", \"?\")}')
            frames = val.get('stacktrace', {}).get('frames', [])
            app_frames = [f for f in frames if f.get('inApp')]
            print(f'\n=== STACK TRACE ({len(app_frames)} app frames) ===')
            for f in reversed(app_frames):
                fn = f.get('filename', '?')
                func = f.get('function', '?')
                line = f.get('lineNo', '?')
                print(f'  {fn}:{line} in {func}')
                for ctx in (f.get('context') or []):
                    if ctx[0] == line:
                        print(f'    >>> {ctx[1].strip()}')
    if entry.get('type') == 'breadcrumbs':
        crumbs = entry.get('data', {}).get('values', [])[-5:]
        if crumbs:
            print(f'\n=== BREADCRUMBS (last {len(crumbs)}) ===')
            for c in crumbs:
                cat = c.get('category', '?')
                msg = (c.get('message') or '')[:100]
                print(f'  [{cat}] {msg}')
"
```

### Step 4 - Map Filenames to Codebase

Sentry shows build/deploy paths. Map them:
- `app:///_next/...` → `frontend-next/...`
- `.next/server/app/...` → find source in `frontend-next/app/...`
- `webpack-internal:///...` → search for the function name in codebase
- `app/controllers/...` → `backend/app/controllers/...`
- `app/services/...` → `backend/app/services/...`
- `app/models/...` → `backend/app/models/...`

### Step 5 - FRC Investigation (MANDATORY - Do NOT Skip)

**Before touching ANY code, complete ALL of these:**

#### 5a. Read the Code
Read the file at the stack trace line number. Understand what it's doing.

#### 5b. 5 Whys (Write These Out)
```
Bug: [exact error message]
Why 1: [immediate cause]
Why 2: [why did that happen]
Why 3: [why was that possible]
Why 4: [what design gap allowed it]
Why 5: [what systemic issue enabled that gap]
Root Cause: [1 sentence]
```

**Show the 5 Whys to the user before proceeding.**

#### 5c. SSoT Search - Find ALL Instances
**MANDATORY:** Search the codebase for the same bug pattern. The error you see is usually NOT the only instance.

```
Grep for:
- The exact method/column name that's wrong
- Similar patterns in other files (e.g., if tenant_id is confused with xero_tenant_id, search ALL files for this confusion)
- The same anti-pattern in other models/controllers/services
```

**List ALL locations where the same bug exists.** Fix them ALL, not just the one Sentry caught.

#### 5d. Bandaid Check
Before writing the fix, ask yourself:

| Red Flag | Action |
|----------|--------|
| "Just add a nil check" | WHY is it nil? Should it be? Fix the source. |
| "Just add a try/catch" | WHAT error? WHY does it throw? Fix the cause. |
| "Just add a condition" | WHY wasn't it there? Design gap? |
| "Just alias/rename" | WHY was it wrong? Is there a naming convention gap? |
| "Just add a fallback" | WHY is the primary value missing? Fix the data flow. |

**If your fix is ONLY at the crash site, you're probably bandaiding.** The fix should be where the BAD DATA or BAD CALL originates, not where it crashes.

### Step 6 - Fix the Code

Now fix ALL instances found in 5c. For each fix:
1. Fix the root cause (where the bad data/call originates)
2. Add a guardrail to prevent recurrence (validation, type check, test)
3. Fix ALL similar instances across the codebase

### Step 7 - Report

After fixing, show:

```
=== SENTRY FIX REPORT ===
Issue: [SHORT_ID] - [Title]
Events: [count] in last 14 days

Root Cause (5 Whys):
  Why 1: [...]
  Why 2: [...]
  Why 3: [...]
  Why 4: [...]
  Why 5: [...]
  Root: [1 sentence]

SSoT Search: [N] similar instances found
Fix: [What was changed and WHERE - all locations]
Files Modified: [list]
Guardrail Added: [validation/type/test that prevents recurrence]
Similar Bugs Fixed: [other instances of same pattern]
=============================
```

### Step 8 - Ask Next Steps

Ask: **"Want me to: (1) Fix the next issue, (2) Resolve this in Sentry, (3) Deploy the fixes?"**

- If (1): Go back to Step 2 with the next issue
- If (2): Mark resolved via Sentry API:
  ```bash
  curl -s -X PUT -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status":"resolved"}' \
    "https://sentry.io/api/0/issues/${ISSUE_ID}/"
  ```
- If (3): User runs `/s` or `/sa` to deploy

## Fail Fast Checklist

Before proceeding past ANY step, verify:

| Check | Fail Fast Action |
|-------|-----------------|
| Sentry API returns non-200 | STOP, show HTTP code + body, tell user what's wrong |
| No `$SENTRY_AUTH_TOKEN` set | STOP, tell user to set the env var |
| Stack trace has 0 app frames | STOP, tell user - error is in framework/library code |
| Can't find file in codebase | STOP, tell user - code may have been refactored |
| 5 Whys leads to "I don't know" | STOP, ask user for context before guessing |
| SSoT search finds 0 similar | Proceed (but note it's a one-off) |
| SSoT search finds 2+ similar | FIX ALL OF THEM, not just the Sentry one |

## Notes

- This command calls Sentry API directly (no backend proxy needed)
- Works in any Claude Code session - no server required
- Issues sorted by frequency (most common first)
- **NEVER bandaid a Sentry error** - find root cause or ask user for help
- **ALWAYS search for similar patterns** - the bug Sentry caught is rarely the only one
- **ALWAYS show 5 Whys** before writing any fix
