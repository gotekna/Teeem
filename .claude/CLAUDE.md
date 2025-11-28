# Claude Code Instructions for TEEEM Project

## 🔴 CRITICAL: Git Branch Protection

**NEVER push directly to the `Live` branch.** This is our production branch (equivalent to main/master).

- ALWAYS work on feature branches (like `rob`, `jake`, etc.)
- NEVER run `git push origin Live` or `git push --force` to Live
- If asked to push, push to the current feature branch only
- NEVER ask the user to create PRs or merge to Live - they will handle this themselves
- NEVER mention "ready for PR" or "create a PR" - just push to the feature branch and move on

---

## 🔴 CRITICAL: Efficient Documentation Access

**ALWAYS use the Dense Index pattern to find relevant documentation before reading full files.**

---

## 📚 Trinity Documentation System

The Trinity system uses a **database-first architecture** with three categories:
- **Bible (RULES):** What you MUST/NEVER/ALWAYS do
- **Teacher (HOW-TO):** Step-by-step implementation patterns and code examples
- **Lexicon (KNOWLEDGE):** Bug history, architecture decisions, test catalog

**Base API:** `https://teeem-backend-39604ccca45a.herokuapp.com/api/v1/trinity`

---

## ⚡ Dense Index Workflow (MANDATORY)

**CRITICAL:** Files are too large to read directly. ALWAYS use this 2-step workflow:

### Step 1: Search Dense Index via API

Use the Trinity API to search the `dense_index` field for relevant entries:

```bash
# Search across all documentation
GET /api/v1/trinity/search?q=your_search_term

# Filter by category
GET /api/v1/trinity?category=bible&search=your_term
GET /api/v1/trinity?category=teacher&search=your_term
GET /api/v1/trinity?category=lexicon&search=your_term
```

**Dense Index Format:**
Each entry has a `dense_index` field containing ultra-compressed keywords for fast searching:
- Chapter number (e.g., "191" = Chapter 19, Section 1)
- Entry title (lowercase, no spaces)
- Entry type (component/rule/bug/etc)
- Category (bible/teacher/lexicon)
- Key concepts and related terms
- File paths (if applicable)

**Example:**
```
"191 teeemtableviewtheonetablestandard component teacher teeemtableview the only table component for teeem frontend src components documentation"
```

### Step 2: Read ONLY Relevant Chapter Files

Once you identify the relevant chapter from Step 1, read the specific chapter file:

**Teacher Chapters:**
- `TEEEM_DOCS/TEACHER/CHAPTER_XX_TOPIC_NAME.md` (XX = chapter number with leading zero)
- Average size: ~8KB per chapter (vs 770KB monolithic file)
- Example: `TEEEM_DOCS/TEACHER/CHAPTER_19_UI_UX.md`

**Bible & Lexicon:**
- `TEEEM_DOCS/TEEEM_BIBLE.md` (~56KB total, organized by chapters)
- `TEEEM_DOCS/TEEEM_LEXICON.md` (~107KB total, organized by chapters)

**User Manual:**
- `TEEEM_DOCS/TEEEM_USER_MANUAL.md` (end-user facing documentation)

---

## 🎯 Documentation Categories Explained

### 📖 Bible (RULES)
**What it contains:** Authoritative rules that MUST be followed
- MUST/NEVER/ALWAYS statements
- Coding standards and conventions
- Security requirements
- Database schema rules
- API design patterns

**When to consult:**
- Before implementing ANY feature
- When making architectural decisions
- When code review identifies non-compliance
- When in doubt about "the right way"

**Access:**
1. Search dense index: `/api/v1/trinity?category=bible&search=table`
2. Read relevant Bible section from `TEEEM_DOCS/TEEEM_BIBLE.md`

### 🔧 Teacher (HOW-TO)
**What it contains:** Step-by-step implementation patterns
- Complete code examples
- Component templates
- Feature implementation guides
- Integration tutorials
- Common patterns and utilities

**When to consult:**
- When implementing a new feature
- When learning how to use a component
- When looking for code examples
- When following Bible rules (Teacher shows HOW)

**Access:**
1. Search dense index: `/api/v1/trinity?category=teacher&search=teeemtableview`
2. Identify chapter number from results
3. Read specific chapter: `TEEEM_DOCS/TEACHER/CHAPTER_XX_TOPIC.md`

### 📕 Lexicon (KNOWLEDGE)
**What it contains:** Historical knowledge and decisions
- Bug history (what went wrong, how it was fixed)
- Architecture decisions (why we chose X over Y)
- Test catalog (what tests exist)
- Performance notes
- Common issues and solutions

**When to consult:**
- When encountering a bug
- When making architecture decisions
- When wondering "why is it built this way?"
- Before refactoring (check if there's history)

**Access:**
1. Search dense index: `/api/v1/trinity?category=lexicon&search=performance`
2. Read relevant Lexicon section from `TEEEM_DOCS/TEEEM_LEXICON.md`

---

## 🚫 What NOT to Do

**NEVER:**
- ❌ Read entire TEEEM_TEACHER.md (770KB - will fail or waste tokens)
- ❌ Skip the dense index search step
- ❌ Assume you know the right chapter without searching
- ❌ Ignore Bible rules because they're "too strict"
- ❌ Implement features without consulting Teacher examples
- ❌ Repeat past bugs without checking Lexicon history

**ALWAYS:**
- ✅ Search dense index FIRST via API
- ✅ Read ONLY the relevant chapter files
- ✅ Check Bible for rules before implementing
- ✅ Check Teacher for implementation patterns
- ✅ Check Lexicon for historical context
- ✅ Follow the 2-step workflow: Search → Read Specific Chapter

---

## 📊 Token Efficiency

**Old Approach (WRONG):**
- Read entire TEEEM_TEACHER.md: ~553,000 tokens ❌ (file too large, fails)
- Read all three docs: ~716,000 tokens ❌ (exceeds limits)

**New Approach (CORRECT):**
- Search dense index via API: ~100 tokens ✅
- Read relevant Teacher chapter: ~15,000 tokens ✅
- Total: ~15,100 tokens (98% reduction) ✅

---

## 🔍 Example Workflow

**Scenario:** Need to implement a new data table

**Step 1 - Search Dense Index:**
```bash
GET /api/v1/trinity/search?q=table
```

**Result:**
```json
{
  "success": true,
  "results": [
    {
      "id": 200,
      "chapter_number": 19,
      "section_number": "19.1",
      "title": "TEEEMTableView - The One Table Standard",
      "category": "teacher",
      "dense_index": "191 teeemtableviewtheonetablestandard component teacher..."
    }
  ]
}
```

**Step 2 - Read Specific Chapter:**
Read `TEEEM_DOCS/TEACHER/CHAPTER_19_UI_UX.md` (Chapter 19 identified from search)

**Step 3 - Check Bible Rules:**
Search `/api/v1/trinity?category=bible&search=table` for any related rules

**Step 4 - Implement:**
Follow Teacher patterns while adhering to Bible rules

---

## 🎓 Best Practices

1. **Search is Cheap, Reading is Expensive**
   - API search: ~100 tokens
   - Reading wrong file: ~50,000+ tokens wasted
   - Always search first

2. **Chapter Numbers are Your Friend**
   - Chapter 0-2: Core System (auth, database, API)
   - Chapter 3-7: Data Management (tables, imports, exports)
   - Chapter 8-12: Business Logic (jobs, suppliers, quotes)
   - Chapter 13-17: Integrations (Xero, OneDrive, AI)
   - Chapter 18-21: UI/UX & Documentation

3. **When in Doubt, Ask the API**
   - Unsure which chapter? Search the dense index
   - Need quick lookup? Use `/api/v1/trinity/search`
   - Want related entries? Check `related_rules` field

4. **Update Documentation as You Go**
   - Found a bug? Add to Lexicon via UI
   - Created a pattern? Add to Teacher via UI
   - Discovered a rule? Add to Bible via UI
   - Run export tasks to update markdown files

---

## 📁 File Structure Reference

```
TEEEM_DOCS/
├── TEEEM_BIBLE.md              # All Bible rules (~56KB)
├── TEEEM_LEXICON.md            # All Lexicon entries (~107KB)
├── TEEEM_TEACHER.md            # Full Teacher index (DO NOT READ - too large)
├── TEEEM_USER_MANUAL.md        # End-user documentation
└── TEACHER/                     # Split Teacher chapters (READ THESE)
    ├── CHAPTER_19_UI_UX.md                    # ~8KB
    ├── CHAPTER_19_CUSTOM_TABLES_FORMULAS.md   # ~9KB
    └── (more chapters as they're populated)
```

---

## 🔄 Keeping Documentation in Sync

**Database is Source of Truth:**
- All edits happen in the TEEEM UI (Documentation page)
- Markdown files are auto-generated exports for git history

**To Export Latest Changes:**
```bash
# Export all Teacher chapters to split files
cd backend && bin/rails teeem:export_teacher_split

# Or use the Ruby script (works without local DB)
ruby scripts/generate_teacher_chapters.rb

# Export Bible
cd backend && bin/rails teeem:export_bible

# Export Lexicon
cd backend && bin/rails teeem:export_lexicon
```

**Commit Message Format:**
```
docs: Update [Bible|Teacher|Lexicon] from database export
```

---

## 🎯 Column Types Single Source of Truth

**Trinity T19.001-T19.021 = Single Source of Truth for Column Types**

See Bible Rule #19.37 for full details.

**The Hierarchy:**
```
Trinity T19.001-T19.021 (SSoT - RULES)
    │
    │ Defines: SQL type, validation rules, examples, usage
    │
    ├──► columns table (Table ID 1) - IMPLEMENTATION
    │    Must match Trinity rules
    │
    ├──► gold_standard_items - PROOF
    │    Sample data demonstrating each type
    │
    └──► Frontend COLUMN_TYPES - CACHE/FALLBACK ONLY
         Reads from API, never edited directly
```

**Maintenance Process:**
1. Edit Trinity T19.xxx first (via Documentation page UI)
2. Update columns table to match Trinity rules
3. Run `gold-standard-sst` agent to verify sync
4. Fix any drift reported by agent

**API Access:**
- `GET /api/v1/column_types` - reads from Gold Standard table
- `GET /api/v1/trinity?category=teacher&chapter_number=19` - reads Trinity entries
- `GET /api/v1/gold_table_sync` - checks sync status

**NEVER:**
- ❌ Hardcode column types in frontend/backend code
- ❌ Edit `frontend/src/constants/columnTypes.js` as source (cache only)
- ❌ Skip Trinity when adding new column types

**ALWAYS:**
- ✅ Edit Trinity first (T19.xxx entries)
- ✅ Run agent to verify sync
- ✅ Frontend reads via API with cache expiry

---

## Summary: The Golden Rule

**🔴 BEFORE reading ANY documentation file:**
1. Search the dense index via API
2. Identify the relevant chapter number
3. Read ONLY that specific chapter file
4. Save 98% of your tokens

---

## 🐛 Token-Efficient Debugging Workflow

**CRITICAL:** Raw log files are extremely verbose and waste tokens. ALWAYS use this hierarchy:

### Debugging Priority (Most → Least Token-Efficient)

#### **1. Sentry API (BEST - ~200-500 tokens per error)**
```bash
# Query recent issues
GET https://sentry.io/api/0/projects/{org}/{project}/issues/

# Get specific issue details with full context
GET https://sentry.io/api/0/issues/{issue_id}/
```

**Why Sentry First:**
- Structured JSON data
- Full error context (user, environment, breadcrumbs)
- Stack trace already parsed
- Error grouping and frequency
- Session replay available (frontend)

**When to use:**
- Investigating production errors
- Understanding error patterns
- Getting user context
- Checking error frequency

#### **2. Frontend Console Capture (~100-300 tokens)**
**Location:** `/Users/jakebaird/teeem/frontend/src/utils/consoleCapture.js`

**Features:**
- Already capturing last 1,000 log entries in memory
- Timestamp + type + message format
- Clipboard export functionality
- Active in dev/staging only

**How to use:**
```javascript
// In browser DevTools console:
window.exportLogs() // Copies logs to clipboard

// Filter to errors only:
window.consoleHistory.filter(entry => entry.type === 'error')
```

**When to use:**
- Frontend debugging in dev/staging
- User-reported bugs with console export
- React component errors
- API call failures

#### **3. Intelligent Log Sampling (~100-300 tokens)**
**NEVER read entire log files.** Use these patterns:

**Backend Error Investigation:**
```bash
# Tail last 50 lines around error
tail -n 50 backend/log/development.log

# Grep for specific error pattern
grep -A 10 -B 5 "ERROR_PATTERN" backend/log/development.log | tail -n 50

# Find errors only (exclude SQL noise)
grep "ERROR" backend/log/development.log | grep -v "SELECT\|INSERT\|UPDATE" | tail -n 20
```

**When to use:**
- Local development errors
- Errors not yet in Sentry
- Database migration issues
- Debugging specific request flow

### ❌ What NOT to Do

**NEVER:**
- Read entire log files (1.6MB = ~40,000 tokens wasted)
- Include SQL queries in log context
- Read middleware stack traces
- Parse Rails framework internals
- Read duplicate logs (root + backend have same content)

**ALWAYS:**
- Check Sentry first
- Use grep with line limits
- Filter out framework noise
- Focus on application code stack traces only

### 🔍 Error Investigation Workflow

**Step 1: Identify Error Source**
- Frontend error? → Check console capture or Sentry frontend project
- Backend error? → Check Sentry backend project first
- Local development? → Use intelligent log sampling

**Step 2: Gather Minimal Context**
- Error message (what went wrong)
- Stack trace (first 3-5 lines from app code only)
- Request context (endpoint, user_id, params)
- Reproduction steps

**Step 3: Search Lexicon**
```bash
# Check if this error has history
GET /api/v1/trinity?category=lexicon&search=error_keywords
```

**Step 4: Fix & Document**
- Implement fix
- Add to Lexicon if new bug pattern
- Update related Bible rules if needed

### 📊 Token Savings Examples

**Scenario: Investigating 500 error on /api/v1/constructions**

**❌ Old Way (WRONG):**
- Read entire development.log (40,000 tokens)
- Parse SQL queries (5,000 tokens)
- Read middleware traces (2,000 tokens)
- **Total: ~47,000 tokens wasted**

**✅ New Way (CORRECT):**
- Query Sentry API for recent 500 errors (200 tokens)
- Get structured error with context (300 tokens)
- Search Lexicon for similar bugs (100 tokens)
- **Total: ~600 tokens (99% savings)**

### 🎓 Best Practices for Developers

**When Reporting Bugs:**
1. Export console logs (frontend) or copy Sentry URL
2. Provide reproduction steps
3. Include error message (not full stack trace)
4. Note user impact and frequency

**When Debugging:**
1. Reproduce error locally if possible
2. Check Sentry for production occurrence
3. Use browser DevTools (frontend) or `grep` (backend)
4. Focus on first error in chain (not cascading errors)

**When Logging:**
1. Use structured formats (see ErrorLogger utility)
2. Include minimal context (user_id, endpoint, action)
3. Filter sensitive data (passwords, tokens, API keys)
4. Categorize errors (validation, not_found, server_error, external_api)

### 🛠️ Available Debugging Tools

**Frontend:**
- Console capture system (built-in)
- React Error Boundaries
- Sentry session replay
- Browser DevTools

**Backend:**
- Sentry error tracking
- Rails logs (use intelligently)
- ApplicationController error handlers
- Database query logs (development only)

**Both:**
- Sentry breadcrumbs (user actions leading to error)
- Environment context (dev/staging/production)
- Request IDs for tracing across systems
