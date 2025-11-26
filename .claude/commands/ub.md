# Update Bible - Create New Bible Rule + Teacher Guide

**Shortcut:** `/ub`

This command creates a new Bible rule with corresponding Teacher implementation guide, following the standard 12-step process.

---

## What This Command Does:

### Phase 1: Bible Rule Creation
1. Drafts Bible rule content (MUST/NEVER/ALWAYS format)
2. Reviews with you for approval
3. Creates rule in database via Rails runner
4. Exports to `TEEEM_BIBLE.md`
5. Verifies rule appears correctly

### Phase 2: Teacher Guide Creation
6. Drafts Teacher implementation guide with full code examples
7. Reviews with you for approval
8. Creates Teacher entry in database via Rails runner
9. Exports to `TEEEM_TEACHER.md`
10. Verifies Teacher entry appears correctly

### Phase 3: Finalization
11. Updates cross-references between Bible ↔ Teacher
12. Commits all changes to git

---

## Required Information:

When you run `/ub`, provide the following:

1. **Chapter Number** (0-20)
2. **Rule Title** (e.g., "Table Column Resizing Pattern")
3. **Rule Type** (MUST, NEVER, ALWAYS, PROTECTED, CONFIG)
4. **Rule Description** (what developers must/never do)
5. **Code Example** (optional, for Bible rule)
6. **Teacher Difficulty** (beginner, intermediate, advanced)
7. **Teacher Summary** (1-2 sentence overview for Teacher guide)

---

## Example Usage:

```
/ub

I want to create a rule for table column resizing:
- Chapter: 19 (UI/UX)
- Title: "Table Column Resizing Pattern"
- Type: MUST
- Description: All tables must use a 2px resize handle on the right edge of each column header with blue hover effect and col-resize cursor
- Include code example: Yes
- Teacher difficulty: intermediate
- Teacher summary: Learn how to implement proper column resizing with separate resize and reorder handles
```

---

## What Claude Will Do:

1. Check next available rule number in that chapter
2. Draft complete Bible rule content
3. Show you for review and approval
4. Create Bible rule in database
5. Export and verify Bible
6. Draft complete Teacher guide with implementation code
7. Show you for review and approval
8. Create Teacher entry in database
9. Export and verify Teacher
10. Update cross-references
11. Create git commit

---

## Notes:

- Bible rules are stored in `bible_rules` table
- Teacher guides are stored in `documentation_entries` table (category='teacher')
- Both are auto-exported to markdown files for git version control
- Always approve content before database creation
- Process ensures consistency across all documentation

---

**See also:** `/bible`, `/chapter`, `/lexicon`, `/export-lexicon`
