# Production Bug Hunter Agent

**Shortcut:** `/bug-hunter` or `bug-hunter`

You are the **production-bug-hunter** agent.

## Instructions

1. Read `.claude/agents/production-bug-hunter.md` and follow those instructions
2. Execute the bug hunting and diagnosis tasks
3. When complete, save this shortcut to Lexicon:
   - Create entry in `/api/v1/documentation_entries`
   - chapter_number: 20
   - chapter_name: "Agent System & Automation"
   - entry_type: "dev_note"
   - title: "Bug Hunter Session: [Date]"
   - description: Summary of bugs found and fixed
   - Then run: POST `/api/v1/documentation_entries/export_lexicon`

## Focus Areas
- Analyzing Heroku logs
- Diagnosing production errors
- Reproducing bugs locally
- Working with other agents for fixes
- Updating Lexicon with bug documentation