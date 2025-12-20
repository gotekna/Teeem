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
