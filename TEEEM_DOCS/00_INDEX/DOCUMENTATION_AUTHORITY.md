# TEEEM Documentation - Authority Hierarchy

**Purpose:** Define which document overrides which when conflicts arise

**Last Updated:** 2025-11-16

---

## 🔑 Core Principle

**Single Source of Truth Per Domain**

Each document type has absolute authority within its domain. When documents conflict, follow the hierarchy below.

---

## 📖 For Claude Code / AI Agents

### Authority Order (Highest to Lowest):

**1. TEEEM_BIBLE.md** - ABSOLUTE AUTHORITY
- **Scope:** Protected features covered by Bible chapters
- **Content:** RULES (MUST/NEVER/ALWAYS)
- **When it wins:** ALWAYS for covered features
- **Example:** "Chapter 9 says NEVER use sequence_order directly" → This rule CANNOT be broken

**2. TEEEM_LEXICON.md** - KNOWLEDGE REFERENCE
- **Scope:** Bug history, architecture explanations, supplementary context
- **Content:** How things work, why we chose X, past bugs
- **When it wins:** NEVER (reference only, doesn't override)
- **Purpose:** Supplements Bible with context
- **Example:** "BUG-001 explains drag flicker history" → Helpful context, not a rule

### Decision Tree for AI:

```
Question: Should I do X?

1. Is there a Bible chapter for this feature?
   YES → Read Bible chapter → Follow ALL rules
   NO  → Continue to #2

2. Is there relevant Lexicon knowledge?
   ALWAYS check for context and past bugs

3. Use best judgment based on Bible patterns and Lexicon lessons

```

---

## 👨‍💻 For Human Developers

### Authority Order (Highest to Lowest):

**1. TEEEM_BIBLE.md** - TECHNICAL RULES
- **Scope:** Protected code patterns, critical business rules
- **When to consult:** Before modifying any feature with a Bible chapter
- **Binding:** YES - these rules prevent bugs
- **Example:** "Gantt cascade rules in Ch 9" → Must follow

**2. CONTRIBUTING.md** - DEVELOPMENT WORKFLOW
- **Scope:** Git workflow, PR process, commit style, branch strategy
- **When to consult:** When contributing code, creating PRs
- **Binding:** YES - for workflow consistency
- **Example:** "Create PR from `rob` branch" → Must follow

**3. Feature-Specific Docs** - DEEP DIVES
- **Scope:** Implementation details for specific features
- **When to consult:** When working on that specific feature
- **Binding:** Advisory (best practices)
- **Example:** "Gantt Developer Setup" → Helpful guide

**4. TEEEM_LEXICON.md** - BUG HISTORY
- **Scope:** Known issues, past fixes, lessons learned
- **When to consult:** When encountering bugs or investigating issues
- **Binding:** NO (reference only)
- **Example:** "BUG-001 drag flicker history" → Learn from past

### Decision Tree for Developers:

```
Question: How should I implement X?

1. Does X have a Bible chapter?
   YES → Read Bible chapter → Follow all rules → Check Lexicon for gotchas
   NO  → Continue to #2

2. Is this a Git/PR workflow question?
   YES → Follow CONTRIBUTING.md
   NO  → Continue to #3

3. Does X have feature-specific docs?
   YES → Read those docs for guidance
   NO  → Use best judgment + code review

4. Check Lexicon for related bugs
   ALWAYS check to avoid repeating past mistakes
```

---

## 👤 For End Users

### Authority Order:

**1. TEEEM_USER_MANUAL.md** - PRIMARY GUIDE
- **Scope:** How to use all TEEEM features
- **When to use:** Learning features, step-by-step guides
- **Authority:** ABSOLUTE for user-facing workflows

**2. FAQ / Troubleshooting** (TBD)
- **Scope:** Common questions, quick fixes
- **When to use:** Quick answers, common issues

**3. In-App Help** (TBD)
- **Scope:** Context-aware help within TEEEM
- **When to use:** While using the app

---

## ⚖️ Conflict Resolution Examples

### Example 1: Bible vs Lexicon Conflict

**Scenario:** Bible Ch 9 says "NEVER call gantt.render() directly". Lexicon explains why this rule exists.

**Resolution:**
- **Bible wins** - Must use debounced render
- **Lexicon provides context** - Explains performance impact
- **Action:** Follow Bible rule, read Lexicon to understand why

---

### Example 2: Lexicon vs Bible Conflict

**Scenario:** Lexicon suggests one approach based on past bugs. Bible Ch 9 has explicit RULE requiring different approach.

**Resolution:**
- **Bible wins** - Rules are absolute
- **Lexicon provides context** - Explains why rule exists or past attempts
- **Action:** Follow Bible rule, use Lexicon to understand context

---

### Example 3: Bible vs CONTRIBUTING.md Conflict

**Scenario:** Bible says "Deploy from `rob` branch to staging". CONTRIBUTING.md says "Only `main` deploys to production".

**Resolution:**
- **No conflict** - Staging vs production
- **Both apply** - Different environments
- **Action:** Follow both (staging from `rob`, production from `main`)

---

### Example 4: Old Gantt Bible vs New Trinity Bible

**Scenario:** Old `/GANTT_BIBLE.md` says one thing. New `TEEEM_BIBLE.md` Chapter 9 says something different.

**Resolution:**
- **New Bible wins** - TEEEM_BIBLE.md is the new source of truth
- **Old Bible archived** - Moved to `/ARCHIVE/`
- **Action:** Follow TEEEM_BIBLE.md Chapter 9

---

## 📋 When Documents Should Be Updated

### Update Bible When:
- ✅ Discovering a new rule (MUST/NEVER/ALWAYS)
- ✅ Finding a protected code pattern
- ✅ Adding a critical configuration value
- ✅ Discovering a bug-causing violation

### Update Lexicon When:
- ✅ Fixing a bug
- ✅ Discovering a new edge case
- ✅ Learning why something works a certain way
- ✅ Documenting investigation results

### Update User Manual When:
- ✅ Adding a new user-facing feature
- ✅ Changing how a feature works
- ✅ Improving a workflow
- ✅ Adding tutorials/examples

### Update CONTRIBUTING.md When:
- ✅ Changing Git workflow
- ✅ Modifying PR process
- ✅ Updating branch strategy
- ✅ Adding deployment rules

---

## 🚨 Special Cases

### What if Bible doesn't cover my feature yet?

**Answer:** Use best judgment, but:
1. Check Lexicon for related knowledge
2. Check CONTRIBUTING.md for general patterns
3. Create a Bible chapter if you discover critical rules
4. Document your decisions

### What if I find a conflict between docs?

**Answer:**
1. Note the conflict in team chat
2. File an issue to resolve it
3. Follow the higher-authority document (per hierarchy above)
4. Update the lower-authority document once conflict is resolved

### What if Bible rule seems wrong?

**Answer:**
1. **DO NOT ignore the rule**
2. Discuss with team
3. If rule needs changing, update Bible + version number
4. Document why rule changed in Lexicon

---

## 📊 Authority Matrix

| Document | AI Agents | Developers | Users | Scope |
|----------|-----------|------------|-------|-------|
| **TEEEM_BIBLE.md** | ABSOLUTE | ABSOLUTE | N/A | Feature rules (MUST/NEVER/ALWAYS) |
| **TEEEM_LEXICON.md** | Reference | Reference | N/A | Bug history, architecture decisions |
| **TEEEM_USER_MANUAL.md** | N/A | N/A | ABSOLUTE | User guides |
| **CONTRIBUTING.md** | Advisory | ABSOLUTE | N/A | Dev workflow |

---

## ✅ Summary

**Remember:**
- Bible = RULES (can't break)
- Lexicon = KNOWLEDGE (learn from)
- User Manual = GUIDES (follow for UX)
- CONTRIBUTING.md = WORKFLOW (follow for consistency)

**When in doubt:**
- Bible wins for feature rules
- CONTRIBUTING wins for workflow
- User Manual wins for UX
- Lexicon provides context (doesn't override)

---

**Last Updated:** 2025-11-16
**Maintained By:** Development Team
**Questions?** Ask in team chat
