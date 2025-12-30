# Agent Audit Report

**Generated:** 2025-12-31
**Auditor:** Claude Code
**Timeline:** 3 months to remediate

---

## Executive Summary

| Category | Count | Issues |
|----------|-------|--------|
| Agents | 18 | 0 critical ✅ |
| Commands | 25 | 0 broken ✅ |
| Skills | 1 | 0 overlap ✅ |

**Status:** Month 1 & 2 complete. Month 3 in progress.

---

## 1. CRITICAL: Missing Agent Files

Commands reference agent files that **DO NOT EXIST**:

| Command | Missing Agent | Status |
|---------|---------------|--------|
| `/backend` | `.claude/agents/backend-developer.md` | BROKEN |
| `/frontend` | `.claude/agents/frontend-developer.md` | BROKEN |
| `/plan` | `.claude/agents/planning-collaborator.md` | BROKEN |

**Action Required:** Create these 3 agent files immediately.

---

## 2. CRITICAL: Missing YAML Frontmatter

| Agent | Issue | Action |
|-------|-------|--------|
| `ssot-auditor.md` | No YAML frontmatter (starts with `#`) | Add frontmatter |

---

## 3. Potential Duplicates / Overlapping Functionality

### Code Quality Agents (3 with overlap)
| Agent | Focus | Recommendation |
|-------|-------|----------------|
| `code-guardian` | SSoT, components, SOLID, security | Keep as umbrella |
| `ui-compliance-auditor` | UI/UX, components, dark mode | Merge into code-guardian OR specialize |
| `table-guardian` | TeeemTableView compliance | Keep (table-specific) |

**Issue:** Both `code-guardian` and `ui-compliance-auditor` check "Standard Components" and "THE ONE enforced". This is SSoT violation.

**Recommendation:**
- Keep `code-guardian` as the umbrella code quality agent
- Rename `ui-compliance-auditor` to `frontend-auditor` with purely frontend focus
- OR merge UI checks into `code-guardian`

### Gold Standard Agents (2 with overlap)
| Agent | Focus | Recommendation |
|-------|-------|----------------|
| `gold-standard-sst` | Validates column type definitions sync | Keep (type validation) |
| `gold-std-table-integration` | Syncs table settings to Gold Standard | Keep (table settings) |

**Issue:** Similar names but different purposes. Names are confusing.

**Recommendation:** Rename for clarity:
- `gold-standard-sst` → `column-type-validator`
- `gold-std-table-integration` → `table-settings-sync`

### Bug Hunter Agents (2 with hierarchy)
| Agent | Focus | Recommendation |
|-------|-------|----------------|
| `production-bug-hunter` | All production bugs | Keep (general) |
| `gantt-bug-hunter` | Gantt/Schedule Master bugs | Keep (specialized) |

**Status:** OK - proper hierarchy (gantt is subset of production)

### SSoT Auditor (Agent + Skill overlap)
| Type | Name | Issue |
|------|------|-------|
| Agent | `ssot-auditor.md` | NoMethodError detection in Rails |
| Skill | `ssot-auditor/SKILL.md` | Duplicate detection & SSoT violations |

**Issue:** Same name, different purposes. Confusing.

**Recommendation:**
- Rename agent to `method-auditor` (focuses on NoMethodError)
- Keep skill as `ssot-auditor` (focuses on SSoT violations)

---

## 4. Inconsistent Formatting

### Author Field Inconsistencies
| Agent | Author Value | Standardized |
|-------|--------------|--------------|
| `gantt-bug-hunter` | "Rob" | Should be "Robert" |
| `performance-auditor` | "Rob" | Should be "Robert" |
| `ui-compliance-auditor` | "Jake" | OK (different author) |

### Category/Type Inconsistencies
| Agent | Type | Category | Issue |
|-------|------|----------|-------|
| `code-guardian` | diagnostic | development | Should category be "diagnostic"? |
| `gantt-bug-hunter` | diagnostic | diagnostic | OK |
| `foundation-sync` | diagnostic | validation | Type/category mismatch? |

---

## 5. Commands Audit

### Broken Commands (3)
- `/backend` - References missing `backend-developer.md`
- `/frontend` - References missing `frontend-developer.md`
- `/plan` - References missing `planning-collaborator.md`

### Redundant Commands
| Command | Shortcut | Potential Overlap |
|---------|----------|-------------------|
| `/l` | Deploy this chat | Similar to `/deploy` |
| `/lp` | Deploy all changes | Similar to `/deploy` |
| `/deploy` | Deploy to staging | Base deploy command |

**Status:** OK - different scopes (this chat vs all vs staging)

### Single-Letter Commands (need documentation)
| Command | Purpose | Mnemonic |
|---------|---------|----------|
| `/c` | Chrome DevTools | C = Chrome |
| `/h` | Heroku DB pull | H = Heroku |
| `/l` | Live deploy (this chat) | L = Live |
| `/m` | Merge Live to rob | M = Merge |
| `/r` | Reboot servers | R = Reboot |
| `/s` | Sam merge | S = Sam |
| `/t` | Code review | T = Test/Review |

---

## 6. Skills Audit

| Skill | Overlap With | Recommendation |
|-------|--------------|----------------|
| `product-planner` | `product-planner` agent | DUPLICATE - merge or remove |
| `ssot-auditor` | `ssot-auditor` agent | Different purpose - rename agent |
| `ui-compliance` | `ui-compliance-auditor` agent | DUPLICATE - merge or remove |

---

## 7. Remediation Plan (3 Months)

### Month 1: Critical Fixes ✅ COMPLETE
- [x] Create `backend-developer.md` agent
- [x] Create `frontend-developer.md` agent
- [x] Create `planning-collaborator.md` agent
- [x] Add frontmatter to `ssot-auditor.md` (renamed to method-auditor)
- [ ] Standardize author names to "Robert" (deferred - minor)

### Month 2: Consolidation ✅ COMPLETE
- [x] Rename `ui-compliance-auditor` to `frontend-auditor`
- [x] Rename `gold-standard-sst` to `column-type-validator`
- [x] Rename `gold-std-table-integration` to `table-settings-sync`
- [x] Rename agent `ssot-auditor` to `method-auditor`
- [x] Remove duplicate skills (product-planner, ui-compliance)
- [x] Rename ssot-auditor skill to duplicate-detector

### Month 3: Enhancement 🚧 IN PROGRESS
- [ ] Add health check status to each agent
- [ ] Add "last verified working" date
- [ ] Create agent dependency graph
- [ ] Add automated testing for agents
- [ ] Update all agents to use Trinity API for rules

---

## 8. Agent Health Status (Proposed)

Add to admin page:

| Status | Meaning | Color |
|--------|---------|-------|
| Healthy | All references valid, recently run | Green |
| Warning | No runs in 30 days | Yellow |
| Broken | Missing references | Red |
| Deprecated | Scheduled for removal | Gray |

---

## 9. Best Practices Violations

### Not Using Trinity API
Several agents hardcode rules instead of fetching from Trinity API:
- Should use: `GET /api/v1/trinity?chapter=9` for rules
- Currently: Hardcoded rule lists in agent files

### Not Using SSoT Constants
Some agents reference hardcoded values:
- Should use: `lib/constants/` for shared values
- Currently: Inline definitions

### Missing "When NOT to Use"
Most agents have "When to Use" but lack "When NOT to Use":
- Helps prevent wrong agent selection
- Should be required section

---

## 10. Files Summary

### Agents (15 files, need 3 more)
```
.claude/agents/
├── README.md
├── agent-creator.md
├── code-guardian.md
├── data-warehouse-health.md
├── deploy-manager.md
├── foundation-sync.md
├── gantt-bug-hunter.md
├── gold-standard-sst.md
├── gold-std-table-integration.md
├── performance-auditor.md
├── product-planner.md
├── production-bug-hunter.md
├── ssot-auditor.md (NEEDS FRONTMATTER)
├── table-guardian.md
├── ttv-refactor.md
├── ui-compliance-auditor.md
├── backend-developer.md (MISSING - CREATE)
├── frontend-developer.md (MISSING - CREATE)
└── planning-collaborator.md (MISSING - CREATE)
```

### Commands (25 files)
All present, 3 reference missing agents.

### Skills (3 files)
All present, 2 overlap with agents.
