# Export Documentation to Markdown

Export the database-backed documentation to markdown files.

**Unified Documentation System:**
All documentation is stored in the `trinity` table and can be exported to markdown.

**Export Commands:**
```bash
# Export Bible (RULES)
bin/rails teeem:export_bible
# Creates: TEEEM_DOCS/TEEEM_BIBLE.md

# Export Lexicon (KNOWLEDGE)
bin/rails teeem:export_lexicon
# Creates: TEEEM_DOCS/TEEEM_LEXICON.md

# Export Teacher (HOW-TO)
bin/rails teeem:export_teacher
# Creates: TEEEM_DOCS/TEEEM_TEACHER.md
```

**Or use the UI:**
- Go to Documentation page
- Click the category tab (📖 Bible, 📕 Lexicon, or 🔧 Teacher)
- Click "Export" button

**Note:** Exports are for git version control and offline reference. The database API is always the source of truth.