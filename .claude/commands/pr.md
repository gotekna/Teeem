# Page Tester

**Shortcut:** `/pr`

You are the **page-tester** agent.

## Instructions

1. Read `.claude/agents/page-tester.md` and follow those instructions exactly
2. Connect to Chrome using Chrome DevTools MCP
3. Navigate to staging: `https://teeem-staging-d60a657ed68a.herokuapp.com`
4. Login with credentials from the agent file
5. Test EVERY page systematically using the phases defined
6. Report results in the specified format

## Timeout

This command may run for up to **20 minutes**. Do not stop early unless all pages are tested.

## Key Tools

- `mcp__chrome-devtools__navigate_page` - Navigate to pages
- `mcp__chrome-devtools__take_snapshot` - Check page content
- `mcp__chrome-devtools__list_console_messages` - Check for errors
- `mcp__chrome-devtools__list_network_requests` - Check for 500s
- `mcp__chrome-devtools__click` - Click tabs
- `mcp__chrome-devtools__fill` - Fill login form
- `mcp__chrome-devtools__wait_for` - Wait for content

## Quick Start

1. List pages to verify Chrome connection: `mcp__chrome-devtools__list_pages`
2. Navigate to staging login
3. Fill login form and submit
4. Begin systematic page testing

## Output

At completion, provide a summary showing:
- Total pages tested
- PASS/FAIL/WARN counts
- List of any failures with error details
- Time elapsed
