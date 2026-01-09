# SSoT Violation Audit Report

**Date:** 2025-12-29
**Auditor:** Claude Code
**Scope:** Foundation API bypass violations

---

## Executive Summary

| Priority | Count | Description |
|----------|-------|-------------|
| **P0 Critical** | 3 | User-visible bugs, actively breaking |
| **P1 High** | 6 | Actively used, has lookup columns |
| **P2 Medium** | 20+ | Has custom JSON, unclear impact |
| **P3 Low** | 10+ | Legacy/rarely used |

**Root Cause:** Controllers have custom `*_json` methods that duplicate Foundation API lookup expansion logic. When new lookup columns are added, they must be updated in BOTH places (SSoT violation).

---

## P0 Critical - User-Visible Bugs

### 1. `sm_schedule_master_templates_controller.rb`
- **Lines:** 360
- **Custom method:** `row_json()` at line 279
- **Issue:** Header column shows IDs instead of names
- **Frontend:** ScheduleMasterTab, GanttCanvasView, schedule-templates/[id]
- **Status:** Partially fixed (Data View tab only)
- **Remaining work:** Convert GanttCanvasView, schedule-templates/[id]

### 2. `sm_schedule_master_controller.rb`
- **Lines:** ~300
- **Custom method:** `row_json()` at line 222
- **Issue:** Same header column issue
- **Frontend:** Job schedule tabs
- **Fix:** Add header to lookup expansion OR convert to Foundation API

### 3. `contacts_controller.rb`
- **Lines:** 4,192 (!!!)
- **Issue:** Massive controller with complex custom JSON
- **Risk:** Any new lookup columns won't display correctly
- **Fix:** Long-term refactor to Foundation API

---

## P1 High - Actively Used with Lookup Columns

| Controller | Lines | Custom JSON Method | Foundation Equivalent |
|------------|-------|-------------------|----------------------|
| `sm_tasks_controller.rb` | 1,119 | Multiple task_json variants | `sm_tasks` |
| `jobs_controller.rb` | 1,099 | job_json, pipeline methods | `jobs` |
| `estimates_controller.rb` | 136 | estimate_json (line 97) | `estimates` |
| `purchase_orders_controller.rb` | 506 | Multiple custom methods | `purchase_orders` |
| `sm_resources_controller.rb` | ~200 | resource_json | `sm_resources` |
| `document_tasks_controller.rb` | ~200 | task_json (line 162) | N/A |

---

## Frontend Files Using Custom Endpoints

### Schedule Master System (sm_schedule_master)

| File | Lines | Issue |
|------|-------|-------|
| `GanttCanvasView.tsx` | 804 (GET), 869+ (PATCHes) | Fetches rows via custom endpoint |
| `schedule-templates/[id]/page.tsx` | 287 | Fetches rows for template editor |
| `ScheduleMasterTab.tsx` | 723, 1048 | Predecessor selector, Gantt tab |

### Legacy Schedule System (schedule_templates)

| File | Lines | Issue |
|------|-------|-------|
| `DHtmlxGanttView.jsx` | 2942, 3038 | Uses `/api/v1/schedule_templates/` |
| `ScheduleTemplateEditor.jsx` | 1002, 1170, 1389+ | Same legacy system |

---

## Recommended Fix Approaches

### Option A: Quick Fix (Bandaid)
Add missing lookup expansion to each custom `*_json` method.
- **Pros:** Fast, targeted
- **Cons:** Doesn't fix SSoT, technical debt grows

### Option B: Incremental Migration (Recommended)
Convert one controller at a time to use Foundation API.
- **Pros:** Proper SSoT fix, deletes code
- **Cons:** Slower, needs careful testing

### Option C: Full Rewrite
Replace all custom endpoints with Foundation API.
- **Pros:** Clean architecture
- **Cons:** High risk, long timeline

---

## Quick Wins (High Impact, Low Effort)

### 1. GanttCanvasView.tsx - Convert to autoFetchRecords
**Effort:** 2-3 hours
**Impact:** Fixes header display in Gantt preview
**Approach:** Same pattern as ScheduleMasterTab Data View fix

### 2. schedule-templates/[id]/page.tsx - Convert to autoFetchRecords
**Effort:** 2-3 hours
**Impact:** Fixes header display in template editor
**Approach:** Same pattern

### 3. Add header to sm_schedule_master_controller.rb row_json
**Effort:** 30 minutes (bandaid)
**Impact:** Fixes job schedule tabs
**Approach:** Copy header expansion from templates controller

---

## Migration Template

When converting a controller to Foundation API:

1. **Identify Foundation table:** Check if `Foundation.find_by(slug: 'xxx')` exists
2. **Map custom JSON to columns:** Document which fields need lookup expansion
3. **Update frontend:** Change from custom endpoint to `autoFetchRecords`
4. **Test thoroughly:** Verify all lookup columns display correctly
5. **Delete custom endpoint:** Remove the custom JSON method
6. **Update routes:** Remove unused routes

---

## Prevention

Add to CLAUDE.md:
```markdown
## SSoT: API Endpoints

**Foundation API is THE SSoT for all record queries.**

NEVER create custom endpoints that:
- Return records with manual lookup expansion
- Duplicate Foundation API's `expand_lookup_columns` logic
- Have `*_json` helper methods for record serialization

ALWAYS use:
- `/api/v1/foundations/{slug}/records` for queries
- `autoFetchRecords` prop in TeeemTableView
- Foundation API filters instead of custom query params
```

---

## Files Reference

### Backend Controllers with Custom JSON
```
backend/app/controllers/api/v1/
├── sm_schedule_master_templates_controller.rb  # row_json (line 279)
├── sm_schedule_master_controller.rb            # row_json (line 222)
├── estimates_controller.rb                     # estimate_json (line 97)
├── contacts_controller.rb                      # 4,192 lines (!)
├── jobs_controller.rb                          # 1,099 lines
├── sm_tasks_controller.rb                      # 1,119 lines
├── purchase_orders_controller.rb               # 506 lines
└── ... (60+ more)
```

### Frontend Custom Endpoint Usage
```
frontend-next/
├── components/gantt-canvas/GanttCanvasView.tsx
├── app/(app)/schedule-templates/[id]/page.tsx
├── app/(app)/admin/system/components/ScheduleMasterTab.tsx
├── components/schedule-master/DHtmlxGanttView.jsx
└── components/schedule-master/ScheduleTemplateEditor.jsx
```
