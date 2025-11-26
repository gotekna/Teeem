# Archive - Deprecated Documentation

This folder contains **DEPRECATED** documentation that has been superseded by the **TEEEM_DOCS Trinity system**.

## Archived Files

### GANTT_BIBLE.md (Archived: 2025-11-16)
**Replaced by:** `TEEEM_DOCS/TEEEM_BIBLE.md` Chapter 9

The original Gantt Bible has been migrated into the unified TEEEM_BIBLE as Chapter 9. All 12 rules, protected code patterns, and glossary terms have been preserved and expanded.

**Why archived:**
- Content fully migrated to Trinity system
- Chapter 9 now canonical source for Gantt rules
- Prevents confusion with duplicate documentation

### GANTT_BUG_HUNTER_LEXICON.md (Archived: 2025-11-16)
**Replaced by:** `TEEEM_DOCS/TEEEM_LEXICON.md` Chapter 9

The original Gantt Bug Hunter Lexicon has been migrated into the unified TEEEM_LEXICON as Chapter 9. All 3 resolved bugs, test catalog, and performance benchmarks have been preserved.

**Why archived:**
- Content fully migrated to Trinity system
- Chapter 9 now canonical source for Gantt bug history
- Prevents confusion with duplicate documentation

---

## Trinity System Structure

The new documentation system organizes ALL features (not just Gantt) into aligned chapters:

```
TEEEM_DOCS/
├── 00_INDEX/
│   ├── README.md                      # Master navigation
│   ├── CHAPTER_GUIDE.md               # Feature → chapter mapping
│   ├── DOCUMENTATION_AUTHORITY.md     # Conflict resolution
│   └── PROGRESS_TRACKER.md            # Build progress
├── TEEEM_BIBLE.md                    # 📖 RULES for developers
├── TEEEM_LEXICON.md                  # 📕 KNOWLEDGE (bugs, architecture)
└── TEEEM_USER_MANUAL.md              # 📘 HOW-TO for end users
```

**Mirrored Chapters:** Same feature = same chapter number across all three docs.

Example:
- Chapter 9 (Gantt) in Bible = Chapter 9 (Gantt) in Lexicon = Chapter 9 (Gantt) in User Manual

---

## How to Use Archived Files

**For Reference Only:** These files are kept for historical reference but are **NOT AUTHORITATIVE**.

**If you need Gantt documentation:**
1. ✅ **Use:** `TEEEM_DOCS/TEEEM_BIBLE.md` Chapter 9 (for rules)
2. ✅ **Use:** `TEEEM_DOCS/TEEEM_LEXICON.md` Chapter 9 (for bug history)
3. ✅ **Use:** `TEEEM_DOCS/TEEEM_USER_MANUAL.md` Chapter 9 (for user guide)
4. ❌ **Don't use:** Files in ARCHIVE/ (outdated)

---

## Restoration

If you need to restore these files (e.g., found missing content):

```bash
# View archived file
cat ARCHIVE/GANTT_BIBLE.md

# Compare with current
diff ARCHIVE/GANTT_BIBLE.md TEEEM_DOCS/TEEEM_BIBLE.md

# If missing content found, add to current Trinity docs
# DO NOT restore archived files to active use
```

---

**Last Updated:** 2025-11-16
**Archived By:** Claude Code (TEEEM_DOCS Trinity migration)
