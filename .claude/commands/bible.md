# Read Bible Chapter

Fetch rules from the live Bible API (database-backed) to understand the rules for that feature.

**Usage:** After running this command, specify which chapter you want to read.

**Common chapters:**
- Chapter 0: Core Principles & Meta-Rules
- Chapter 9: Gantt & Schedule Master
- Chapter 15: Xero Accounting Integration
- Chapter 20: Agent System & Automation

**API Endpoint:** `https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/trinity?category=bible&chapter_number=X`

**Example:** "Read Bible Chapter 9 for Gantt rules"

**Note:** The Bible is now database-backed. Always fetch from the API to get the latest rules, NOT from `TEEEM_BIBLE.md` (which is an auto-generated export).