# Start Chrome for Claude DevTools

Starts Chrome with remote debugging enabled, preserving cookies, login sessions, and bookmarks.
**Supports multiple simultaneous instances on different ports.**

## Step 1: Check which ports AND profiles are in use

**IMPORTANT: Chrome can only run ONE instance per profile.**

Run these checks in parallel:
```bash
# Check ports
lsof -i:9222 | head -2
lsof -i:9223 | head -2
lsof -i:9224 | head -2
lsof -i:9225 | head -2

# Check which profile directories are in use (look for lock files)
ls "/Users/robertharder/Library/Application Support/Google/Chrome/Default/lockfile" 2>/dev/null && echo "Default: IN USE"
ls "/Users/robertharder/Library/Application Support/Google/Chrome/Profile 1/lockfile" 2>/dev/null && echo "Profile 1: IN USE"
ls "/Users/robertharder/Library/Application Support/Google/Chrome/Profile 2/lockfile" 2>/dev/null && echo "Profile 2: IN USE"
ls "/Users/robertharder/Library/Application Support/Google/Chrome/Profile 3/lockfile" 2>/dev/null && echo "Profile 3: IN USE"
ls "/Users/robertharder/Library/Application Support/Google/Chrome/Profile 4/lockfile" 2>/dev/null && echo "Profile 4: IN USE"
```

## Step 2: Ask User Which Profile (only show AVAILABLE profiles)

**Only offer profiles that are NOT already running:**

| Profile Dir | Name | Email |
|-------------|------|-------|
| Default | Tekna | robert@tekna.com.au |
| Profile 1 | 100x Best Life | rob@100xbestlife.com |
| Profile 2 | Personal | rharder1972@gmail.com |
| Profile 3 | Andrew | andrew@tekna.com.au |
| Profile 4 | Rachel | rachel@tekna.com.au |

Use AskUserQuestion tool - exclude any profiles that have a lockfile.

## Step 3: Determine first available port

| Priority | Port | Notes |
|----------|------|-------|
| 1st | 9222 | Default MCP port (no config needed) |
| 2nd | 9223 | Requires .mcp.json update |
| 3rd | 9224 | Requires .mcp.json update |
| 4th | 9225 | Requires .mcp.json update |

**If ALL ports are in use, tell user to close one first.**

## Step 4: Start Chrome with selected profile on available port

```bash
nohup /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=PORT \
  --user-data-dir="/Users/robertharder/Library/Application Support/Google/Chrome" \
  --profile-directory="PROFILE_DIR" \
  http://localhost:3000 > /dev/null 2>&1 &
```

Replace:
- `PORT` with first available port (9222, 9223, 9224, or 9225)
- `PROFILE_DIR` with selected profile directory from Step 1

## Step 5: Update MCP config if NOT using port 9222

If using port 9223, 9224, or 9225, create/update `/Users/robertharder/GitHub/teeem/.mcp.json`:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["@anthropic-ai/mcp-server-chrome-devtools@latest", "--port=PORT_NUMBER"]
    }
  }
}
```

## Step 6: Verify Chrome started

```bash
sleep 3
lsof -i:PORT | head -2
```

## Final Report Format

**If using port 9222 (default):**
```
Chrome DevTools:
- Port 9222: Running (PID: X)
- Profile: [Name] ([email])
- URL: http://localhost:3000
- MCP: Ready to use immediately

Use mcp__chrome-devtools__* tools directly.
```

**If using port 9223/9224/9225:**
```
Chrome DevTools:
- Port 922X: Running (PID: X)
- Profile: [Name] ([email])
- URL: http://localhost:3000
- MCP Config: Updated .mcp.json for port 922X

⚠️  RESTART REQUIRED: Restart this Claude Code chat to use MCP tools
    Or use Chrome manually at http://localhost:3000

Active instances:
- 9222: [Profile name or "Free"]
- 9223: [Profile name or "Free"]
- 9224: [Profile name or "Free"]
- 9225: [Profile name or "Free"]
```

**If ALL 4 ports are in use:**
```
Chrome DevTools: ALL PORTS OCCUPIED

Active instances:
- 9222: [Profile] (PID: W)
- 9223: [Profile] (PID: X)
- 9224: [Profile] (PID: Y)
- 9225: [Profile] (PID: Z)

Options:
1. Use an existing Chrome instance
2. Kill one: lsof -ti:9225 | xargs kill -9
3. Close a Claude Code chat that's using Chrome
```

## Why Use Real Profiles?
- **Cookies preserved** - Already logged into localhost:3000
- **Extensions available** - Your dev tools extensions work
- **Bookmarks** - Access your saved pages
- **No re-login** - Session persists between /c runs

## Profile Reference
| Profile Dir | Name | Email |
|-------------|------|-------|
| Default | Tekna | robert@tekna.com.au |
| Profile 1 | 100x Best Life | rob@100xbestlife.com |
| Profile 2 | Personal | rharder1972@gmail.com |
| Profile 3 | Andrew | andrew@tekna.com.au |
| Profile 4 | Rachel | rachel@tekna.com.au |

## Quick Navigation
After Chrome opens, Claude can navigate:
```javascript
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'http://localhost:3000/jobs/46/schedule/gantt' })
```

## Cleanup Commands
```bash
# Kill specific port
lsof -ti:9222 | xargs kill -9

# Kill all debug Chrome instances
lsof -ti:9222 -ti:9223 -ti:9224 -ti:9225 | xargs kill -9 2>/dev/null
echo "All debug Chrome instances killed"
```

## Notes
- Supports up to 4 simultaneous Chrome instances (one per port)
- Each instance uses a real Chrome profile (preserves state)
- Port 9222 works immediately; other ports need MCP config + chat restart
- Different profiles can run on different ports simultaneously
