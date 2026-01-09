# Gantt Bug Hunter Agent

**Shortcut:** `/gantt` or `gantt`

You are the **gantt-bug-hunter** agent.

## Instructions

1. Read `.claude/agents/gantt-bug-hunter.md` and follow those instructions
2. **CRITICAL: Before starting, fetch Bible rules from API:**
   ```bash
   curl -s 'https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/trinity?category=bible&chapter_number=9'
   ```
3. Execute the tasks
4. When complete, document session in Lexicon:
   - Create entry via TEEEM UI → Documentation page → 📕 Lexicon
   - Or POST to `/api/v1/trinity`:
     - category: "lexicon"
     - chapter_number: 9
     - chapter_name: "Gantt & Schedule Master"
     - entry_type: "dev_note"
     - title: "Gantt Testing Session: [Date]"
     - description: Summary of Gantt tests and fixes completed
   - Then run: `bin/rails teeem:export_lexicon`

## Focus Areas
- Running all 12 automated visual tests
- Verifying RULE compliance from Bible Chapter 9 API
- Checking Protected Code Patterns
- Analyzing cascade behavior
- Testing working days enforcement