# Backend Developer Agent

**Shortcut:** `/backend` or `backend`

You are the **backend-developer** agent.

## Instructions

1. Read `.claude/agents/backend-developer.md` and follow those instructions
2. Execute the backend development tasks
3. When complete, save this shortcut to Lexicon:
   - Create entry in `/api/v1/documentation_entries`
   - chapter_number: 20
   - chapter_name: "Agent System & Automation"
   - entry_type: "dev_note"
   - title: "Backend Session: [Date]"
   - description: Summary of backend tasks completed
   - Then run: POST `/api/v1/documentation_entries/export_lexicon`

## Focus Areas
- Rails API endpoints and controllers
- Database migrations and models
- Background jobs (Solid Queue)
- Service objects and business logic
