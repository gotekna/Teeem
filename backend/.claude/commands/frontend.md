# Frontend Developer Agent

**Shortcut:** `/frontend` or `frontend`

You are the **frontend-developer** agent.

## Instructions

1. Read `.claude/agents/frontend-developer.md` and follow those instructions
2. Execute the frontend development tasks
3. When complete, save this shortcut to Lexicon:
   - Create entry in `/api/v1/documentation_entries`
   - chapter_number: 20
   - chapter_name: "Agent System & Automation"
   - entry_type: "dev_note"
   - title: "Frontend Session: [Date]"
   - description: Summary of frontend tasks completed
   - Then run: POST `/api/v1/documentation_entries/export_lexicon`

## Focus Areas
- React components and pages
- Tailwind CSS styling
- UI/UX consistency
- API integration
- Dark mode support
