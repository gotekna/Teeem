# Work on Feature by Chapter

Work on a specific feature by fetching the relevant documentation from the unified API.

**Before working on ANY feature:**
1. Find chapter number from Chapter Guide
2. Fetch Bible rules (MUST/NEVER/ALWAYS) via API: `?category=bible&chapter_number=X`
3. Fetch Lexicon entries (bug history) via API: `?category=lexicon&chapter_number=X`
4. Fetch Teacher entries (implementation patterns) via API: `?category=teacher&chapter_number=X`
5. Follow all rules without exception
6. Proceed with work

**API Base URL:** `https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/trinity`

**Common chapters:**
- Chapter 9: Gantt & Schedule Master
- Chapter 15: Xero Accounting
- Chapter 17: OneDrive Integration
- Chapter 20: Agent System

**Usage:** "Work on Chapter 9 (Gantt)" or "Read Chapter 15 rules"

**Note:** All documentation is now database-backed. Always fetch from the API to get real-time, up-to-date information.