# Start Chrome for Claude DevTools

Starts Chrome with remote debugging for Claude to control via MCP.

## How It Works

**The MCP server manages its own Chrome instance** with a dedicated profile at:
`~/.cache/chrome-devtools-mcp/chrome-profile`

This is separate from your regular Chrome profiles (Tekna, Personal, etc.) so they don't conflict.

**Tradeoff:** The MCP profile doesn't have your saved cookies/logins, but Claude can auto-login.

## Step 1: Check if MCP Chrome is ready

Try to list pages directly - if it works, Chrome is already running:
```javascript
mcp__chrome-devtools__list_pages()
```

If it returns pages, skip to Step 3.

## Step 2: Start Chrome (if needed)

If Step 1 failed or returned empty, Chrome may need to start. The MCP will auto-start Chrome when you first call a tool. Try:
```javascript
mcp__chrome-devtools__new_page({ url: "http://localhost:3000" })
```

If that fails with "browser already running" error:
```bash
rm -rf /Users/robertharder/.cache/chrome-devtools-mcp
```
Then try again.

## Step 3: Navigate and Auto-Login

Navigate to localhost:
```javascript
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'http://localhost:3000' })
```

If on login page, auto-login:
```javascript
mcp__chrome-devtools__fill_form({ elements: [
  { uid: "EMAIL_FIELD_UID", value: "robert@tekna.com.au" },
  { uid: "PASSWORD_FIELD_UID", value: "Wisdom50-50" }
]})
mcp__chrome-devtools__click({ uid: "SIGNIN_BUTTON_UID" })
```

## Final Report Format
```
Chrome DevTools:
- Port: 9222 (MCP managed)
- Profile: MCP dedicated profile
- URL: http://localhost:3000
- Login: [Auto-logged in / Already logged in]
- MCP: Ready to use

Use mcp__chrome-devtools__* tools directly.
```

## Why MCP Uses Its Own Profile

Your regular Chrome profiles (Tekna, Personal) are for daily work. MCP needs:
- Remote debugging enabled (requires Chrome restart)
- Exclusive access (can't share with another Chrome window)

So MCP runs a separate Chrome instance with its own profile.

## Login Credentials
- **Email:** robert@tekna.com.au
- **Password:** Wisdom50-50

## Quick Navigation
```javascript
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'http://localhost:3000/jobs/46/schedule/gantt' })
```

## Shutdown MCP Chrome (when needed)

If you need to restart or reset MCP Chrome:
```bash
# Kill MCP Chrome and clear profile
pkill -f "chrome-devtools-mcp"
rm -rf /Users/robertharder/.cache/chrome-devtools-mcp
```

MCP will auto-start a fresh Chrome on next tool call.

## Notes
- MCP auto-starts Chrome when needed
- Chrome will show "controlled by automated test software" banner
- Login is required once per session (Claude can auto-login)
- Your regular Chrome profiles remain untouched
