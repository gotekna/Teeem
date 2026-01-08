# Start Chrome for Claude DevTools

**Execute these steps immediately without asking for permission.**

Starts Chrome with your **Tekna profile** (robert@tekna.com.au) and remote debugging enabled.
This preserves your cookies, login sessions, and bookmarks.

## Execution Steps

**Step 1: Check if Chrome debug port is available**
```bash
lsof -i:9222 | head -2
```

**Step 2: Kill any existing Chrome on debug port (if needed)**
If port 9222 is in use:
```bash
lsof -ti:9222 | xargs kill -9 2>/dev/null || true
sleep 1
```

**Step 3: Close existing Chrome and start with debugging**

Chrome can only run one instance per profile. Check if Chrome is running and close it gracefully:
```bash
# Check if Chrome is running
pgrep -x "Google Chrome" > /dev/null && echo "Chrome is running - will close and restart with debugging" || echo "Chrome not running"

# Close Chrome gracefully (saves state)
osascript -e 'tell application "Google Chrome" to quit' 2>/dev/null || true
sleep 2
```

**Step 4: Start Chrome with Tekna profile + remote debugging**
```bash
nohup /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="/Users/robertharder/Library/Application Support/Google/Chrome" \
  --profile-directory="Default" \
  http://localhost:3000 > /dev/null 2>&1 &
```

**Step 5: Verify Chrome started**
```bash
sleep 3
lsof -i:9222 | head -2
```

## Final Report Format
```
Chrome DevTools (Tekna Profile):
- Port 9222: Running (PID: X)
- Profile: Tekna (robert@tekna.com.au)
- URL: http://localhost:3000
- Login: Already authenticated (cookies preserved)
- MCP: Ready to use immediately

Use mcp__chrome-devtools__* tools directly.
```

## Why Use Real Profile?
- **Cookies preserved** - Already logged into localhost:3000
- **Extensions available** - Your dev tools extensions work
- **Bookmarks** - Access your saved pages
- **No re-login** - Session persists between /c runs

## Profile Reference
| Profile | Name | Email | Use Case |
|---------|------|-------|----------|
| Default | Tekna | robert@tekna.com.au | Work (default for /c) |
| Profile 1 | 100x Best Life | rob@100xbestlife.com | Personal business |
| Profile 2 | Personal | rharder1972@gmail.com | Personal |
| Profile 3 | Your Chrome | andrew@tekna.com.au | Andrew |
| Profile 4 | Rachel - Tekna | rachel@tekna.com.au | Rachel |

## Quick Navigation
After Chrome opens, Claude can navigate to specific pages:
```javascript
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'http://localhost:3000/jobs/46/schedule/gantt' })
```

## Testing Canvas-Based Features (Gantt)
Canvas interactions cannot be reliably tested with synthetic events.
For Gantt testing, Claude should:
1. Take a screenshot to verify the page loaded
2. Check console for errors: `mcp__chrome-devtools__list_console_messages`
3. Instruct user to test manually

## Cleanup Command
To stop Chrome debugging:
```bash
lsof -ti:9222 | xargs kill -9 2>/dev/null
echo "Chrome debug instance killed"
```

## Notes
- Uses your real Tekna Chrome profile (preserves cookies/login)
- Closes existing Chrome to enable debugging (Chrome limitation)
- Your Chrome state is saved before closing
- Only port 9222 is used (no multi-instance needed with real profile)
