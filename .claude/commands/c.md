# Start Chrome for Claude DevTools

Starts an isolated Chrome instance for this chat session.

## How It Works

**Each chat gets its own isolated Chrome** - no conflicts between multiple chats.
- Uses `--isolated` flag for temporary profile per session
- Auto-cleaned when Chrome closes
- Login required once per session (Claude auto-logs in)

## Step 1: Check if MCP Chrome is ready

Try to list pages directly - if it works, Chrome is already running:
```javascript
mcp__chrome-devtools__list_pages()
```

If it returns pages, skip to Step 3.

## Step 2: Start Chrome (if needed)

If Step 1 failed, start Chrome:
```javascript
mcp__chrome-devtools__new_page({ url: "http://localhost:3000" })
```

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
- Mode: Isolated (no conflicts with other chats)
- URL: http://localhost:3000
- Login: [Auto-logged in / Already logged in]
- MCP: Ready to use

Use mcp__chrome-devtools__* tools directly.
```

## Login Credentials
- **Email:** robert@tekna.com.au
- **Password:** Wisdom50-50

## Quick Navigation
```javascript
mcp__chrome-devtools__navigate_page({ type: 'url', url: 'http://localhost:3000/jobs/46/schedule/gantt' })
```

## Notes
- Each chat has its own isolated Chrome instance
- Multiple chats can run Chrome simultaneously without conflicts
- Chrome shows "controlled by automated test software" banner (expected)
- Login once per session, Claude can auto-login
