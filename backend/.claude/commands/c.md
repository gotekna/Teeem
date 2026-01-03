# Start Chrome for Claude DevTools

**Execute these steps immediately without asking for permission.**

Starts a NEW Chrome window with remote debugging so Claude can interact with the browser via MCP.
**Does NOT kill existing Chrome windows.**

## Execution Steps

**Step 1: Start Chrome with debugging (new window)**
```bash
# Start a new Chrome window with remote debugging (separate profile, won't affect main Chrome)
nohup /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-debug" \
  http://localhost:3000 > /dev/null 2>&1 &
sleep 2
```

**Step 2: Verify Chrome is running**
```bash
lsof -i:9222 | head -3
```

## Final Report Format
```
Chrome DevTools:
- Port 9222: Running ✓
- URL: http://localhost:3000 (opened)
- Claude MCP: Ready to connect

Use these tools:
- mcp__chrome-devtools__list_pages
- mcp__chrome-devtools__take_snapshot
- mcp__chrome-devtools__take_screenshot
- mcp__chrome-devtools__click
- mcp__chrome-devtools__fill
```

## Notes
- This starts a separate Chrome instance (won't affect your main browser)
- Debug profile stored in ~/.chrome-debug
- Port 9222 is the Chrome DevTools Protocol port
- After running /c, ask Claude to interact with the page

## Quick Navigation
After Chrome opens, Claude can navigate to specific pages:
```javascript
// Navigate to Gantt for job 46
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'http://localhost:3000/jobs/46/schedule/gantt' })
```

## Testing Canvas-Based Features (Gantt)
Canvas interactions (like dependency creation) cannot be reliably tested with synthetic events.
For Gantt testing, Claude should:
1. Take a screenshot to verify the page loaded
2. Check console for errors: `mcp__chrome-devtools__list_console_messages`
3. Instruct user to test manually:

**Manual Dependency Creation Test:**
1. Hover over a task bar to see chevrons (< >) appear
2. Click and HOLD on a chevron
3. Drag to another task row - popup should appear IMMEDIATELY
4. Popup follows as you cross different rows
5. Release mouse over "Start" or "Finish" button
6. Edit Dependencies dialog should open
