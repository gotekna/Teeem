# Debugging - Token-Efficient Workflow

## Rule: Never Read Raw Logs

| Approach | Tokens | Use It |
|----------|--------|--------|
| `cat development.log` | ~40,000 | NEVER |
| Sentry API | ~500 | ALWAYS first |
| Targeted grep | ~200 | Local dev only |

## Priority Order

### 1. Sentry First (Production Errors)
Sentry gives you structured data, user context, breadcrumbs, and stack traces already parsed.

```bash
# Check Sentry dashboard or use API
# https://sentry.io/organizations/YOUR_ORG/issues/
```

### 2. Targeted Grep (Local Development)
```bash
# Last 20 errors, no SQL noise
grep "ERROR\|Exception" backend/log/development.log | grep -v "SELECT\|INSERT\|UPDATE" | tail -20

# Find specific error pattern with context
grep -A 5 -B 3 "ERROR_PATTERN" backend/log/development.log | tail -30

# Tail recent activity
tail -n 50 backend/log/development.log
```

### 3. Frontend Console Capture
```javascript
// In browser DevTools:
window.exportLogs()  // Copies to clipboard

// Filter errors only:
window.consoleHistory.filter(e => e.type === 'error')
```

## Never Do This
- Read entire log files
- Include SQL queries in context
- Parse Rails framework stack traces
- Read middleware internals
- Read duplicate logs (root + backend have same content)

## Always Do This
- Check Sentry first
- Use grep with line limits (`| tail -20`)
- Filter out framework noise
- Focus on app code stack traces only

## Error Investigation Flow

```
Error Reported
     |
     +-> Production? -> Check Sentry first
     |
     +-> Frontend? -> Browser DevTools + console capture
     |
     +-> Backend local? -> Targeted grep
            |
            +-> Still stuck? -> Ask user for more context
```

## What to Gather (Minimal Context)

1. Error message (what went wrong)
2. Stack trace (first 3-5 lines from APP code only)
3. Request context (endpoint, user_id, params)
4. Reproduction steps

## Token Savings Example

**Scenario:** 500 error on `/api/v1/constructions`

| Old Way | New Way |
|---------|---------|
| Read full log: 40,000 tokens | Sentry API: 200 tokens |
| Parse SQL: 5,000 tokens | Get structured error: 300 tokens |
| Middleware traces: 2,000 tokens | - |
| **Total: ~47,000 tokens** | **Total: ~500 tokens** |

**99% savings.**

## Keyword: `slow`

If user types `slow`, Claude is wasting tokens on logs. Immediately:
1. Stop reading log files
2. Switch to Sentry or targeted grep
3. Ask user for specific error message if needed
