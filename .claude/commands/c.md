# Start Chrome for Claude DevTools

**Execute these steps immediately without asking for permission.**

Starts a NEW Chrome window with remote debugging so Claude can interact with the browser via MCP.
**Does NOT kill existing Chrome windows. Supports up to 4 simultaneous instances.**

## Execution Steps

**Step 1: Check all debug ports (run in parallel)**
```bash
lsof -i:9222 | head -2
lsof -i:9223 | head -2
lsof -i:9224 | head -2
lsof -i:9225 | head -2
```

**Step 2: Determine first available port and start Chrome**

Based on Step 1 results, use the FIRST FREE port:

| Priority | Port | Profile Directory |
|----------|------|-------------------|
| 1st | 9222 | `$HOME/.chrome-debug` |
| 2nd | 9223 | `$HOME/.chrome-debug-9223` |
| 3rd | 9224 | `$HOME/.chrome-debug-9224` |
| 4th | 9225 | `$HOME/.chrome-debug-9225` |

**Start Chrome on the first available port:**

```bash
# For port 9222 (default):
nohup /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.chrome-debug" \
  http://localhost:3000 > /dev/null 2>&1 &

# For port 9223:
nohup /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9223 \
  --user-data-dir="$HOME/.chrome-debug-9223" \
  http://localhost:3000 > /dev/null 2>&1 &

# For port 9224:
nohup /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9224 \
  --user-data-dir="$HOME/.chrome-debug-9224" \
  http://localhost:3000 > /dev/null 2>&1 &

# For port 9225:
nohup /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9225 \
  --user-data-dir="$HOME/.chrome-debug-9225" \
  http://localhost:3000 > /dev/null 2>&1 &
```

**Step 3: Update MCP config if NOT using port 9222**

If using port 9223, 9224, or 9225, create/update `/Users/robertharder/GitHub/teeem/.mcp.json`:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["@anthropic-ai/mcp-server-chrome-devtools@latest", "--port=PORT_NUMBER", "--isolated"]
    }
  }
}
```

Replace `PORT_NUMBER` with the actual port (9223, 9224, or 9225).

**Step 4: Verify Chrome started**
```bash
sleep 2
lsof -i:PORT_NUMBER | head -2
```

## Final Report Format

**If using port 9222 (default):**
```
Chrome DevTools (Instance 1/4):
- Port 9222: Running (PID: X)
- URL: http://localhost:3000
- MCP: Ready to use immediately

Use mcp__chrome-devtools__* tools directly.
```

**If using port 9223/9224/9225:**
```
Chrome DevTools (Instance N/4):
- Port 922X: Running (PID: X)
- URL: http://localhost:3000
- MCP Config: Updated .mcp.json for port 922X

⚠️  RESTART REQUIRED: Restart this Claude Code chat to use MCP tools
    Or use Chrome manually at http://localhost:3000

Ports in use:
- 9222: [In use / Free]
- 9223: [In use / Free]
- 9224: [In use / Free]
- 9225: [In use / Free]
```

**If ALL 4 ports are in use:**
```
Chrome DevTools: ALL PORTS OCCUPIED

- Port 9222: In use (PID: W)
- Port 9223: In use (PID: X)
- Port 9224: In use (PID: Y)
- Port 9225: In use (PID: Z)

Options:
1. Use an existing Chrome instance manually
2. Kill one instance: lsof -ti:9225 | xargs kill -9
3. Close a Claude Code chat that's using Chrome
```

## Port Summary Table

| Port | MCP Config Needed | Chat Restart |
|------|-------------------|--------------|
| 9222 | No (default) | No |
| 9223 | Yes (.mcp.json) | Yes |
| 9224 | Yes (.mcp.json) | Yes |
| 9225 | Yes (.mcp.json) | Yes |

## Notes
- Supports up to 4 simultaneous Chrome debug instances
- Each instance has its own profile directory (won't share cookies/state)
- Port 9222 is the only one that works without config changes
- Ports 9223-9225 require .mcp.json update + chat restart
- All instances open http://localhost:3000 by default

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
To kill all debug Chrome instances:
```bash
lsof -ti:9222 | xargs kill -9 2>/dev/null; \
lsof -ti:9223 | xargs kill -9 2>/dev/null; \
lsof -ti:9224 | xargs kill -9 2>/dev/null; \
lsof -ti:9225 | xargs kill -9 2>/dev/null; \
echo "All debug Chrome instances killed"
```
