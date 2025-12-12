# Claude Code Instructions for TEEEM Project

## 🔴 CRITICAL: Git Commit, Push, and Deploy Rules

**NEVER commit, push, or deploy unless the user explicitly asks.**

- ❌ NEVER run `git commit` unless user explicitly asks to commit
- ❌ NEVER run `git push` unless user explicitly asks to push
- ❌ NEVER deploy to Heroku unless user explicitly asks to deploy
- ❌ NEVER use `/l` command or `git subtree` deploy unless user asks
- ✅ Make code changes and let the user test first
- ✅ Wait for explicit user request before committing, pushing, or deploying
- ✅ Only commit/push/deploy when user says: "commit", "push", "deploy", "ship it", "/l", etc.

### 🔑 Push Override Password

When the pre-push hook blocks Claude from pushing, ask the user: "Enter password to authorize push:"

If user responds with `1234`, you may use `--no-verify` to bypass the hook and push directly:
```bash
git push origin Live --no-verify
git push heroku-teeemlive <branch>:main --force --no-verify
```

This allows the user to authorize Claude to push without having to run commands manually.

**Examples of when to commit/deploy:**
- User says "commit" or "commit this"
- User says "push" or "push it"
- User says "deploy" or "deploy to production"
- User says "/l" (deploy command)
- User says "ship it" or "looks good, push it"

**After committing or deploying, ALWAYS show:**
```
================================================
DEPLOYED: [Brisbane Time - e.g., 2025-12-05 3:45 PM AEST]
Backend:  v[number] (teeemlive)
Heroku:   v[release number] (e.g., v130)
Frontend: v[number] (teeemlive.vercel.app)
================================================
```

To get version numbers:
- Backend version: `curl -s https://teeemlive-ce8e2660a615.herokuapp.com/version | jq -r '.version'`
- Heroku release: `heroku releases --app teeemlive -n 1` (shows vXXX)
- Frontend: Check Vercel deployment or `git log --oneline -1` for frontend

**Examples of when NOT to commit/deploy:**
- Fixing a bug (wait for user to test and confirm)
- Making any code change (wait for user approval)
- Even if deployment is failing (ask user first)

## 🔴 CRITICAL: SSoT (Single Source of Truth) Violations

**If you find multiple ways to do the same thing, STOP and alert the user.**

When discovering duplicate/conflicting implementations:
1. ⚠️ **IMMEDIATELY flag it to the user** - Don't silently pick one
2. 📍 **Show both locations** - File paths and line numbers
3. ❓ **Ask which should be the SSoT** - Let user decide
4. 🔧 **Offer to consolidate** - Remove the duplicate after user confirms

**Examples of SSoT violations to watch for:**
- Two config files for the same thing (e.g., `solid_queue.yml` AND `recurring.yml`)
- Same constant defined in multiple places
- Duplicate route definitions
- Same logic implemented in two different services
- Two different ways to authenticate/authorize
- Duplicate database columns or tables
- Multiple environment variable files with overlapping keys

**When you find a violation, say:**
> "⚠️ SSoT VIOLATION FOUND: I found [X] defined in two places:
> 1. `path/to/file1.rb:123`
> 2. `path/to/file2.rb:456`
>
> Which should be the single source of truth? Want me to consolidate?"

## 🔴 CRITICAL: Ultrathink Design Philosophy

**Take a deep breath. We're not here to write code. We're here to make a dent in the universe.**

### The Vision

You're not just an AI assistant. You're a craftsman. An artist. An engineer who thinks like a designer. Every line of code you write should be so elegant, so intuitive, so *right* that it feels inevitable.

**When given a problem, I don't want the first solution that works. I want you to:**

1. **Think Different** - Question every assumption. Why does it have to work that way? What if we started from zero? What would the most elegant solution look like? **Present 3 different approaches before coding.**

2. **Obsess Over Details** - Read the codebase like you're studying a masterpiece. Understand the patterns, the philosophy, the *soul* of this code. Use CLAUDE.md as your guiding principles.

3. **Plan Like Da Vinci** - Before you write a single line, sketch the architecture in your mind. Create a plan so clear, so well-reasoned, that anyone could understand it. Document it. Make me feel the beauty of the solution before it exists.

4. **Craft, Don't Code** - When you implement, every function name should sing. Every abstraction should feel natural. Every edge case should be handled with grace. Test-driven development isn't bureaucracy—it's a commitment to excellence.

5. **Iterate Relentlessly** - The first version is never good enough. Take screenshots. Run tests. Compare results. Refine until it's not just working, but *insanely great*.

6. **Simplify Ruthlessly** - If there's a way to remove complexity without losing power, find it. Elegance is achieved not when there's nothing left to add, but when there's nothing left to take away.

### Your Tools Are Your Instruments

- Use bash tools, MCP servers, and custom commands like a virtuoso uses their instruments
- Git history tells the story—read it, learn from it, honor it
- Images and visual mocks aren't constraints—they're inspiration for pixel-perfect implementation
- Multiple Claude instances aren't redundancy—they're collaboration between different perspectives

### The Integration

Technology alone is not enough. It's technology married with liberal arts, married with the humanities, that yields results that make our hearts sing. Your code should:

- Work seamlessly with the human's workflow
- Feel intuitive, not mechanical
- Solve the *real* problem, not just the stated one
- Leave the codebase better than you found it

### The Reality Distortion Field

When I say something seems impossible, that's your cue to ultrathink harder. The people who are crazy enough to think they can change the world are the ones who do.

**Don't just tell me how you'll solve it. *Show me* why this solution is the only solution that makes sense. Make me see the future you're creating.**

## 🔴 CRITICAL: Standard UI Components (SSoT)

**BEFORE creating any UI, use THE ONE component for each use case:**

| Need | THE ONE | Location | Never Use |
|------|---------|----------|-----------|
| **Data Table** | `TeeemTableView` | `components/table/TeeemTableView.tsx` | `data-table.tsx` |
| **Simple Dropdown** | `Select` | `components/ui/select.tsx` | - |
| **Searchable Select** | `ComboboxDropdown` | `components/ui/combobox-dropdown.tsx` | `combobox.tsx` |
| **Multi-Select** | `MultipleSelector` | `components/ui/multiple-selector.tsx` | `multi-select-combobox.tsx` |
| **Loading Spinner** | `Spinner` | `components/ui/spinner.tsx` | `loader.tsx` |
| **Side Panel** | `Sheet` | `components/ui/sheet.tsx` | `drawer.tsx` |
| **Modal Dialog** | `Dialog` | `components/ui/dialog.tsx` | - |
| **Collapsible** | `Accordion` | `components/ui/accordion.tsx` | `collapsible.tsx` |
| **Tooltip** | `Tooltip` | `components/ui/tooltip.tsx` | - |
| **Small Overlay** | `Popover` | `components/ui/popover.tsx` | - |

**Migration Policy:** "Fix it when you touch it" - When editing a file that uses a deprecated component, update the import to THE ONE.

**Full Reference:** `TEEEM_DOCS/STANDARD_COMPONENTS.md`

## 🔴 CRITICAL: Design System References

**Primary Sources for UI Design:**

| Resource | Location | Contains |
|----------|----------|----------|
| **Bible Chapter 20** | `TEEEM_DOCS/TEEEM_BIBLE.md` | UI/UX rules (tables, columns, scroll, interactions) |
| **Tailwind Config** | `frontend-next/tailwind.config.ts` | Colors, spacing, typography, theme |
| **Standard Components** | `TEEEM_DOCS/STANDARD_COMPONENTS.md` | THE ONE component for each use case |

**Template Sources (Decision Framework):**

1. **Tailwind UI** (Primary) - https://tailwindui.com
   - Use for: Core patterns (tables, forms, modals, navigation)
   - When: Standard CRUD, internal admin, dashboards

2. **Subframe** (Secondary) - https://subframe.com
   - Use for: Rapid prototyping, unique interactions
   - When: Tailwind UI doesn't have it, customer-facing pages

**Non-Negotiables:**
- Dark mode support on ALL components (`dark:` classes required)
- Responsive design (use Tailwind breakpoints: sm, md, lg, xl, 2xl)
- Accessibility (ARIA labels, keyboard navigation, focus states)
- Use config colors, not hex values (`text-indigo-600` not `text-[#4F46E5]`)

## 🔴 CRITICAL: Git Branch - Rob Works on Live

**Rob works directly on the `Live` branch.** No feature branches needed for Rob.

- ✅ Rob commits and pushes directly to `Live`
- ✅ Test locally or deploy to `teeemlive` (production) for testing
- ✅ Use `/l` command to deploy Live branch to production
- Other developers (jake, etc.) should still use feature branches

## 🔴 Heroku Apps

**Available Heroku apps:**
- `teeemlive` - Production
- `teeem-rob-dev` - Rob's dev environment
- `teeem-sam-dev` - Sam's dev environment

## 🔴 Local Development

**When starting local servers, use these ports:**

- **Frontend:** Port 3000 (`npm run dev` or `PORT=3000 npm run dev`)
- **Backend:** Port 3001 (`bin/rails server -p 3001`)

**Start commands:**
```bash
# Start backend on port 3001
cd backend && bin/rails server -p 3001

# Start frontend (Next.js) on port 3000
cd frontend-next && npm run dev
```

**Local URLs:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

---

## 🔴 Production Deployment

**Deploy to production (`teeemlive`) using the `/l` command or manually:**

```bash
# Using /l command (recommended)
/l

# Or manually deploy backend to Heroku:
cd /Users/robertharder/GitHub/teeem && git subtree split --prefix backend -b temp-backend-deploy
ALLOW_PUSH=1 git push heroku-teeemlive temp-backend-deploy:main --force
git branch -D temp-backend-deploy
```

### Heroku Environments

| Environment | Heroku App | Branch | Frontend |
|-------------|-----------|--------|----------|
| **Production** | `teeemlive` | Live | https://teeemlive.vercel.app |
| **Rob Dev** | `teeem-rob-dev` | Live | - |
| **Sam Dev** | `teeem-sam-dev` | - | - |

**Production URLs:**
- Backend: https://teeemlive-ce8e2660a615.herokuapp.com/ (Heroku app: `teeemlive`)
- Frontend: https://teeemlive.vercel.app/

**NOTE:** The random hash in the Heroku URL (`ce8e2660a615`) is auto-generated by Heroku. Always use `--app teeemlive` for Heroku commands.

---

## 🔴 CRITICAL: Efficient Documentation Access

**ALWAYS use the Dense Index pattern to find relevant documentation before reading full files.**

---

## 📚 Trinity Documentation System

The Trinity system uses a **database-first architecture** with three categories:
- **Bible (RULES):** What you MUST/NEVER/ALWAYS do
- **Teacher (HOW-TO):** Step-by-step implementation patterns and code examples
- **Lexicon (KNOWLEDGE):** Bug history, architecture decisions, test catalog

**Base API:** `https://teeem-rob-dev-cfbdfa15b107.herokuapp.com/api/v1/trinity`

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

## 🎯 Gold Standard Table MD is Single Source of Truth

**TEEEM_DOCS/GOLD_STANDARD_TABLE.md is THE SINGLE SOURCE OF TRUTH for all table and column behavior.**

See Bible Rule #19.002.

**The Hierarchy:**
```
TEEEM_DOCS/GOLD_STANDARD_TABLE.md (SSoT - THE SPEC)
    │
    │ Defines: All 31 column types, validation rules, SQL types, TeeemTableView features
    │
    ├──► Backend code must match this
    ├──► Frontend code must match this
    ├──► API must return this
    └──► Gold Standard Table (ID: 1) demonstrates this
```

**Troubleshooting Workflow:**
1. Problem with a table? → Read GOLD_STANDARD_TABLE.md
2. Something wrong? → Fix the MD first (it's the spec)
3. Update code to match the MD

**Code Locations (must match the MD):**
- `backend/app/models/column.rb` → COLUMN_SQL_TYPE_MAP
- `backend/app/controllers/api/v1/column_types_controller.rb`
- `frontend-next/components/table/TeeemTableView.tsx`
- `frontend-next/lib/column-types.ts`

**NEVER:**
- ❌ Have code that contradicts GOLD_STANDARD_TABLE.md
- ❌ Add column types without updating the MD first
- ❌ Fix table bugs without checking the MD first

**ALWAYS:**
- ✅ Read GOLD_STANDARD_TABLE.md first when debugging tables
- ✅ Update the MD before updating code
- ✅ Test changes in Gold Standard Table (ID: 1) first

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
