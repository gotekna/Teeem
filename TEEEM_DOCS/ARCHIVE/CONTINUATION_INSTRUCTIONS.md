# TEEEM Trinity Documentation - Continuation Instructions

**Date:** 2025-11-16
**Last Updated:** 2025-11-16 09:22 AEST (Session 5: User Manual Markdown Modernization completed)
**Remaining:** 10 chapters need population

---

## 🎉 Contextual Help System + Modern Markdown Rendering - COMPLETE

**Session 5 Progress:**
- ✅ Built complete contextual help system
- ✅ FloatingHelpButton component on every page (bottom-right corner)
- ✅ ContextualHelpModal with User Manual integration
- ✅ Page-to-chapter mapping for 40+ routes
- ✅ Search functionality across help docs
- ✅ Vite configured for port 5173 (strictPort: true)
- ✅ Frontend deployed on http://localhost:5173/
- ✅ **Modernized User Manual display with rich markdown rendering**
  - Installed react-markdown, remark-gfm, rehype-raw
  - Created MarkdownRenderer component with professional styling
  - Color-coded callout blocks (tips, warnings, errors)
  - Syntax highlighted code blocks
  - External link indicators
  - Full dark mode support
  - Updated DocumentationPage and ContextualHelpModal to use MarkdownRenderer

**How the Contextual Help System Works:**
1. **Floating Button**: A question mark icon appears in the bottom-right corner of every page
2. **Auto-Detection**: Uses React Router's `useLocation()` to detect current page
3. **Smart Mapping**: Automatically shows relevant User Manual chapter based on route
   - Example: `/gantt` → Chapter 9 (Gantt & Schedule Master)
   - Example: `/contacts` → Chapter 3 (Contacts & Relationships)
   - Example: `/xero` → Chapter 15 (Xero Accounting)
4. **Modal Features**:
   - Displays chapter-specific help content in modern markdown
   - Search bar to find help across all documentation
   - "Open Full Help Center" button to view complete docs
5. **Implementation**:
   - `frontend/src/config/helpMapping.js` - Route to chapter mappings (40+ routes)
   - `frontend/src/components/FloatingHelpButton.jsx` - Floating button component
   - `frontend/src/components/ContextualHelpModal.jsx` - Help modal with search
   - `frontend/src/components/MarkdownRenderer.jsx` - Professional markdown display
   - Added to `AppLayout.jsx` - Available on all pages automatically

**System Status:**
- Backend: Database + API fully functional (port 3000)
- Frontend: Port 5173 (strict mode - always uses this port on rob branch)
- Contextual Help: Available on all pages with floating button
- Knowledge Management: 10 bugs in Chapter 3 + full CRUD UI
- Documentation Display: Modern, professional markdown rendering
- Ready for: Continuing Trinity documentation chapters

---

## Current Progress

### ✅ Completed Chapters (ALL 19 CHAPTERS COMPLETE! 🎉)

**Chapter 0:** Overview & System-Wide Rules (Bible - ✅ COMPLETED THIS SESSION - commit 6304238)
1. **Chapter 1:** Authentication & Users (Bible + Lexicon + User Manual - completed in previous session)
2. **Chapter 2:** System Administration (Bible + Lexicon + User Manual - ✅ COMPLETED THIS SESSION - commit 7d4a026)
3. **Chapter 3:** Contacts & Relationships (Bible + Lexicon + User Manual - completed in previous session)
4. **Chapter 4:** Price Books & Suppliers (Bible + Lexicon + User Manual - completed in previous session)
5. **Chapter 5:** Jobs & Construction Management (Bible + Lexicon + User Manual - completed in previous session)
6. **Chapter 6:** Estimates & Quoting (Bible + Lexicon + User Manual - completed in previous session)
7. **Chapter 7:** AI Plan Review (Bible + Lexicon + User Manual - ✅ COMPLETED THIS SESSION - commit c51a9e5)
8. **Chapter 8:** Purchase Orders (Bible + Lexicon + User Manual - completed in previous session)
9. **Chapter 9:** Gantt & Schedule Master (Bible + Lexicon + User Manual - completed in previous session)
10. **Chapter 10:** Project Tasks & Checklists (Bible + Lexicon + User Manual - ✅ COMPLETED THIS SESSION - commit 866b7aa)
11. **Chapter 11:** Weather & Public Holidays (Bible + Lexicon + User Manual - ✅ COMPLETED THIS SESSION - commit ae7406f)
12. **Chapter 12:** OneDrive Integration (Bible + Lexicon + User Manual - completed in previous session)
13. **Chapter 13:** Outlook/Email Integration (Bible + Lexicon + User Manual - ✅ COMPLETED THIS SESSION - commit d835630)
14. **Chapter 14:** Chat & Communications (Bible + Lexicon + User Manual - ✅ COMPLETED THIS SESSION - commit f370350)
15. **Chapter 15:** Xero Accounting Integration (Bible + Lexicon + User Manual - completed in previous session)
16. **Chapter 16:** Payments & Financials (Bible + Lexicon + User Manual - ✅ COMPLETED THIS SESSION - commit 192d321)
17. **Chapter 17:** Workflows & Automation (Bible + Lexicon + User Manual - ✅ COMPLETED THIS SESSION - commit 1e0d969)
18. **Chapter 18:** Custom Tables & Formulas (Bible + Lexicon + User Manual - ✅ COMPLETED THIS SESSION - commit b6da955)
19. **Chapter 19:** UI/UX Standards & Patterns (Bible + Lexicon + User Manual - ✅ COMPLETED THIS SESSION - commit e63833c)

### 🎯 Trinity Documentation System: 100% COMPLETE!

**🎉 ALL 19 CHAPTERS NOW HAVE COMPLETE TRINITY (Bible + Lexicon + User Manual)!**

**Chapter 19 Completion (this session):**
- Added RULE #0 to Bible: "Trinity Completion Rule" (prevents incomplete chapters)
- Completed Lexicon Chapter 19: 7 UI/UX issues, 10 architecture decisions, tests, gaps
- Completed User Manual Chapter 19: User guide for UI/UX patterns
- Commit: e63833c

---

## Documentation Approach (Per User Feedback)

### Bible (TEEEM_BIBLE.md) - COMPREHENSIVE
**Purpose:** Developer rules (MUST/NEVER/ALWAYS patterns)
**Quality Level:** HIGH - These are stable and critical
**Format:**
- Clear RULE numbers (e.g., RULE #X.1, RULE #X.2)
- Code examples showing correct patterns
- Explanation of WHY the rule exists
- File references

**Example:**
```markdown
## RULE #4.1: Supplier Default Categories

**Categories MUST have a default supplier.**

✅ **MUST:**
- Set default_supplier_id for each category
- Use in smart PO lookup (priority #2)

❌ **NEVER:**
- Leave default_supplier_id NULL for active categories

**Implementation:**
[code example]

**Files:**
- app/models/category.rb
```

---

### Lexicon (TEEEM_LEXICON.md) - DATABASE-DRIVEN, AUTO-GENERATED

**🔴 CRITICAL: Lexicon is now DATABASE-PRIMARY (as of 2025-11-16)**

**Single Source of Truth:** `documented_bugs` database table
**Markdown File:** Auto-generated export (Git snapshot only)

**How to Update Lexicon:**
1. **Edit in UI:** Go to Documentation page → Click "📕 TEEEM Lexicon" → Add/edit/delete entries
2. **Export to markdown:** Run `rake teeem:export_lexicon` in backend
3. **Commit both:** Commit database changes AND markdown file together

**Why Database-Primary?**
- ✅ Live editing via UI (no manual markdown editing)
- ✅ Filtering by chapter, type, status, severity
- ✅ CRUD operations (create, update, delete)
- ✅ Searchable and queryable
- ✅ Structured data with JSONB metadata
- 📄 Markdown exists for Git version control only

**Export Command:**
```bash
cd backend
bin/rails teeem:export_lexicon
```

**Files:**
- Database table: `documented_bugs` (primary)
- Export script: `backend/lib/tasks/lexicon.rake`
- Markdown file: `TEEEM_DOCS/TEEEM_LEXICON.md` (generated)

---

### Lexicon Format - COMPREHENSIVE
**Purpose:** Bug history, architecture decisions, knowledge
**Quality Level:** HIGH - This is valuable institutional knowledge
**Format:**
- Bug Hunter section with known issues
- Architecture & Implementation explanations
- Test catalog
- Performance benchmarks
- Development notes
- Common issues & solutions

**Example:**
```markdown
## 🐛 Bug Hunter: Price Books

### Known Issues & Solutions

#### Issue: Duplicate Item Names Cause Confusion
**Status:** ⚠️ BY DESIGN
**Last Reported:** 2025-09-15

[explanation, solution, workaround]

---

## 🏗️ Architecture & Implementation

### Smart Lookup Algorithm
[detailed explanation with code]

---

## 📊 Test Catalog
[automated and manual tests]
```

---

### User Manual (TEEEM_USER_MANUAL.md) - **HIGH-LEVEL ONLY**
**Purpose:** User-friendly guides for end users
**Quality Level:** BRIEF - Will change as UI evolves
**Format:**
- **What is it?** (1-2 paragraphs)
- **Quick Start** (3-5 steps)
- **Key Features** (bullet list)
- **Common Tasks** (brief workflows)
- **Troubleshooting** (2-3 common issues)

**❌ DO NOT:**
- Write detailed step-by-step guides (UI will change)
- Include screenshots (will become outdated)
- Write lengthy explanations

**✅ DO:**
- Keep it simple and high-level
- Focus on "what you can do" not "how to click"
- Link to related chapters

**Example:**
```markdown
## What are Price Books?

Price books store your material costs, supplier information, and categories. They're used for:
- Smart PO generation (auto-fills supplier and prices)
- Estimate creation (quickly add items)
- Price drift tracking (compare PO prices to pricebook)

## Quick Start

1. Navigate to Settings → Price Books
2. Click "+ New Item"
3. Enter item details (name, price, supplier, category)
4. Click "Save"

## Key Features

- **Categories:** Group items (Framing, Electrical, Plumbing)
- **Suppliers:** Assign default suppliers per category
- **Smart Lookup:** Auto-match estimate items to pricebook
- **Price Drift:** Track price changes over time

## Common Tasks

**Adding bulk items:**
1. Import CSV (Settings → Price Books → Import)
2. Map columns
3. Review and save

**Updating prices:**
1. Search for item
2. Click "Edit"
3. Update price
4. Save (affects future POs only)

## Troubleshooting

**"Item not found in smart lookup"**
- Check spelling
- Verify category match
- Add to pricebook manually

---

## Related Topics
- Chapter 8: Purchase Orders (smart lookup usage)
- Chapter 6: Estimates (adding pricebook items)
```

---

## Research & Writing Workflow

### Step 1: Research the Feature

Use Task tool with Explore agent (Haiku model for efficiency):

```markdown
Task prompt:
"Research [FEATURE NAME] in this Rails codebase comprehensively.

I need detailed information about:
1. Models and key fields
2. Controllers and API endpoints
3. Business logic and services
4. Validations and security
5. Related features and dependencies

Search in:
- app/models/[feature].rb
- app/controllers/**/[feature]_controller.rb
- app/services/**/*[feature]*.rb
- Database schema

Return comprehensive findings organized by sections."
```

**Expected output:** 8-12 sections with code snippets, file paths, business logic explanations.

---

### Step 2: Write Bible (Comprehensive)

1. Read current chapter in TEEEM_BIBLE.md to see structure
2. Identify 5-8 key RULES based on research
3. Write each rule with:
   - Clear directive (MUST/NEVER/ALWAYS)
   - Code example
   - Why it exists
   - File references

**Time estimate:** 15-20 minutes per chapter

---

### Step 3: Write Lexicon (Database-Driven)

**🔴 CRITICAL: Add entries via Documentation page UI, NOT markdown file**

1. **Go to Documentation page:** http://localhost:5173/documentation
2. **Click "📕 TEEEM Lexicon"** to open database view
3. **Add new entries using the UI:**
   - Click "+ Add Entry" button
   - Fill in fields (chapter, title, description, etc.)
   - Select knowledge_type: bug / architecture / test / performance / dev_note / common_issue
   - Set status: active / resolved / monitoring / by_design
   - Click "Save"
4. **Export to markdown:** Run `rake teeem:export_lexicon` in backend
5. **Commit both:** Database migration AND markdown file

**Entry Types to Add:**
- Known bugs/issues from research (or infer potential issues)
- Architecture decisions (why this approach?)
- Test catalog (from spec files if exist)
- Performance notes
- Development workflow

**Time estimate:** 15-20 minutes per chapter (UI + export)

---

### Step 4: Write User Manual (HIGH-LEVEL ONLY)

1. Read current chapter in TEEEM_USER_MANUAL.md to see structure
2. Write brief sections:
   - What is it? (2 paragraphs max)
   - Quick start (5 steps max)
   - Key features (bullet list)
   - Common tasks (2-3 workflows, brief)
   - Troubleshooting (2-3 issues)
   - Related topics

**Time estimate:** 5-10 minutes per chapter

---

## Chapter Priority Order

**Recommended order** (based on feature importance):

### Tier 1: Core Features (Complete First)
1. **Chapter 5:** Jobs & Construction Management
2. **Chapter 6:** Estimates & Quoting
3. **Chapter 4:** Price Books & Suppliers
4. **Chapter 3:** Contacts & Relationships

### Tier 2: Supporting Features
5. **Chapter 7:** AI Plan Review
6. **Chapter 11:** Weather & Public Holidays
7. **Chapter 10:** Project Tasks & Checklists
8. **Chapter 16:** Payments & Financials

### Tier 3: Integration Features
9. **Chapter 13:** Outlook/Email Integration
10. **Chapter 14:** Chat & Communications
11. **Chapter 17:** Workflows & Automation
12. **Chapter 18:** Custom Tables & Formulas

### Tier 4: Admin
13. **Chapter 2:** System Administration
14. **Chapter 0:** Overview (update at end with cross-references)

---

## File Locations

**Bible:**
```
/Users/rob/Projects/teeem/TEEEM_DOCS/TEEEM_BIBLE.md
```

**Lexicon:**
```
/Users/rob/Projects/teeem/TEEEM_DOCS/TEEEM_LEXICON.md
```

**User Manual:**
```
/Users/rob/Projects/teeem/TEEEM_DOCS/TEEEM_USER_MANUAL.md
```

---

## Finding Chapter Locations

Use Grep to find chapter numbers:

```bash
grep -n "^# Chapter X:" /Users/rob/Projects/teeem/TEEEM_DOCS/TEEEM_BIBLE.md
```

Then use Read tool with offset to view the chapter content.

---

## Commit Strategy

**Commit after every 2-3 chapters:**

```bash
git add TEEEM_DOCS/TEEEM_BIBLE.md TEEEM_DOCS/TEEEM_LEXICON.md TEEEM_DOCS/TEEEM_USER_MANUAL.md

git commit -m "docs: Complete Chapter X, Y, Z across Trinity documentation

- Chapter X: [Feature Name]
  - Bible: X rules covering [topics]
  - Lexicon: Bug history, architecture, test catalog
  - User Manual: High-level guide

- Chapter Y: [Feature Name]
  [same format]

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Push to GitHub regularly:**
```bash
git push origin rob
```

---

## Quality Checklist

Before committing each chapter:

### Bible
- [ ] Has 5-8 clear RULES with numbers
- [ ] Each rule has ✅ MUST/❌ NEVER directives
- [ ] Code examples provided
- [ ] File references included
- [ ] Explains WHY rule exists

### Lexicon
- [ ] Bug Hunter section with 2-4 issues
- [ ] Architecture section explaining design decisions
- [ ] Test catalog (or note if tests don't exist)
- [ ] Performance benchmarks (or note if not measured)
- [ ] Development notes for future changes

### User Manual
- [ ] Brief "What is it?" section (2 paragraphs max)
- [ ] Quick start (5 steps or less)
- [ ] Key features (bullet list)
- [ ] 2-3 common tasks (brief)
- [ ] 2-3 troubleshooting items
- [ ] Related topics cross-references

---

## Token Budget Management

**Session 2 used:** ~54k / 200k tokens (27%) - Chapter 4 only (Chapters 5 & 6 completed in previous session)

**Estimated per chapter:**
- Research: 4-5k tokens
- Bible writing: 8-10k tokens
- Lexicon writing: 8-10k tokens
- User Manual writing: 3-4k tokens

**Total per chapter:** ~25-30k tokens

**Chapters remaining:** 11
**Estimated tokens needed:** 275-330k tokens

**Strategy:**
- Complete 3-4 chapters per session (75-120k tokens)
- Requires 3-4 more sessions to complete all remaining chapters
- Update continuation file after each session

---

## Example Chapter Template

### Bible Template
```markdown
# Chapter X: [Feature Name]

┌─────────────────────────────────────────────────┐
│ 📕 LEXICON (BUGS):    Chapter X                │
│ 📘 USER MANUAL (HOW): Chapter X                │
└─────────────────────────────────────────────────┘

**Last Updated:** 2025-11-16

## Overview
[Brief description of feature and what it covers]

---

## RULE #X.1: [Rule Title]

**[Brief rule statement]**

✅ **MUST:**
- [Directive 1]
- [Directive 2]

❌ **NEVER:**
- [Anti-pattern 1]
- [Anti-pattern 2]

**Implementation:**
```ruby
[code example]
```

**Files:**
- [file path 1]
- [file path 2]

---

## RULE #X.2: [Next Rule]
[same format]

---

## API Endpoints Reference
[list of endpoints]
```

### Lexicon Template
```markdown
# Chapter X: [Feature Name]

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):     Chapter X                │
│ 📘 USER MANUAL (HOW): Chapter X                │
└─────────────────────────────────────────────────┘

**Last Updated:** 2025-11-16

## 🐛 Bug Hunter: [Feature Name]

### Known Issues & Solutions

#### Issue: [Bug Title]
**Status:** [⚠️ STATUS]
**Severity:** [Level]

**Scenario:**
[description]

**Root Cause:**
[explanation]

**Solution:**
[fix or workaround]

---

## 🏗️ Architecture & Implementation

### [Architectural Topic]
[detailed explanation]

---

## 📊 Test Catalog
[automated and manual tests]

---

## 🔍 Common Issues & Solutions
[practical problems and fixes]

---

## 📈 Performance Benchmarks
[response times, query counts]

---

## 🎓 Development Notes
[guidance for future developers]

---

## 🔗 Related Chapters
[cross-references]
```

### User Manual Template (BRIEF!)
```markdown
# Chapter X: [Feature Name for Users]

┌─────────────────────────────────────────────────┐
│ 📖 BIBLE (RULES):      Chapter X (Developers)  │
│ 📕 LEXICON (BUGS):     Chapter X (Developers)  │
└─────────────────────────────────────────────────┘

**Last Updated:** 2025-11-16

## What is [Feature]?

[1-2 paragraph explanation]

---

## Quick Start

1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [Step 4]
5. [Step 5]

---

## Key Features

- **[Feature 1]:** [Brief description]
- **[Feature 2]:** [Brief description]
- **[Feature 3]:** [Brief description]

---

## Common Tasks

### [Task 1 Title]
1. [Step]
2. [Step]
3. [Step]

### [Task 2 Title]
1. [Step]
2. [Step]

---

## Troubleshooting

### [Issue 1]
**Problem:** [description]
**Solution:** [fix]

### [Issue 2]
**Problem:** [description]
**Solution:** [fix]

---

## Related Topics
- **Chapter X:** [Related feature]
- **Chapter Y:** [Related feature]
```

---

## Final Checklist (When All 18 Chapters Complete)

- [ ] All 18 chapters have content in Bible
- [ ] All 18 chapters have content in Lexicon
- [ ] All 18 chapters have content in User Manual
- [ ] Chapter 0 (Overview) updated with cross-references
- [ ] All code examples tested (if possible)
- [ ] All file paths verified
- [ ] Committed to Git
- [ ] Pushed to GitHub
- [ ] Delete this CONTINUATION_INSTRUCTIONS.md file

---

## Contact & Questions

If you have questions about this continuation:
1. Read examples in Chapter 1, 8, 9, 12, 15 for reference
2. Follow the template structure above
3. Prioritize quality in Bible and Lexicon
4. Keep User Manual brief and high-level

**Good luck!** 🚀
