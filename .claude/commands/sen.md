# Sentry Error Fixer

**Shortcut:** `/sen`

Fetches unresolved Sentry errors and helps fix them in the codebase.

## Instructions

### Step 1 - Fetch Sentry Issues

Call the Sentry API directly (no backend needed - works locally):

```bash
curl -s -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/projects/teeem-pty-ltd/teeem-frontend/issues/?query=is:unresolved&sort=freq&statsPeriod=14d" \
  | python3 -c "
import sys, json
issues = json.load(sys.stdin)
for i, issue in enumerate(issues[:15]):
    level = issue.get('level', '?')
    count = issue.get('count', 0)
    title = issue.get('title', '?')[:80]
    short_id = issue.get('shortId', '?')
    last_seen = issue.get('lastSeen', '?')[:10]
    print(f'{i+1:2}. [{level:7}] {count:>5}x | {short_id:15} | {title} | last: {last_seen}')
"
```

### Step 2 - Present Issues to User

Show the list and ask: **"Which issue do you want to fix? (number or 'all' for top 3)"**

### Step 3 - Fetch Stack Trace for Selected Issue

For the chosen issue, fetch the latest event with stack trace:

```bash
ISSUE_ID="<selected_issue_id>"
curl -s -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/issues/${ISSUE_ID}/events/latest/" \
  | python3 -c "
import sys, json
event = json.load(sys.stdin)
print('=== ERROR DETAILS ===')
print(f'Title: {event.get(\"title\", \"?\")}')
print(f'Date: {event.get(\"dateCreated\", \"?\")}')

# Find exception entry
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
                # Show context lines if available
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

### Step 4 - Find and Fix the Code

Using the stack trace:

1. **Map filenames to codebase** - Sentry shows build paths, map them:
   - `app:///_next/...` → `frontend-next/...`
   - `.next/server/app/...` → find the source in `frontend-next/app/...`
   - `webpack-internal:///...` → search for the function name in codebase

2. **Read the file** at the line number from the stack trace

3. **Apply FRC process** (from CLAUDE.md):
   - STOP - understand what the error is
   - INVESTIGATE - git blame, understand intent
   - ASK WHY - 5 Whys
   - FIND THE GAP - what's missing?
   - FIX THE ROOT - not a bandaid
   - PREVENT - add guardrails

4. **Fix the bug** in the codebase

### Step 5 - Report

After fixing, show:

```
=== SENTRY FIX REPORT ===
Issue: [SHORT_ID] - [Title]
Events: [count] in last 14 days
Root Cause: [1-2 sentence explanation]
Fix: [What was changed]
Files: [list of files modified]
Prevention: [What guardrail was added]
=============================
```

### Step 6 - Ask Next Steps

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

## Notes

- This command calls Sentry API directly (no backend proxy needed)
- Works in any Claude Code session - no server required
- Issues are sorted by frequency (most common first)
- Always follow FRC process - never bandaid a Sentry error
