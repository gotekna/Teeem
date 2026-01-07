# Gantt Chart Business Rules

This document catalogs ALL business rules in the current Gantt implementation.
These rules MUST be preserved in the rewrite - they define how the system behaves.

---

## 1. CASCADE RULES

### Rule: When a Task Moves, Find All Successors Recursively
- Finds entire dependency tree to the end
- Not just direct successors, but grandchildren, great-grandchildren, etc.

### Rule: Categorize Successors into Two Groups
| Group | Condition | Default Action |
|-------|-----------|----------------|
| **Locked** | confirm OR supplier_confirm OR finance_approved OR is_completed | "break" (stay in place) |
| **Unlocked** | None of the above | "cascade" (move with predecessor) |

### Rule: Cascade Dialog Allows Manual Override
- User can change "break" to "cascade" or vice versa
- Each successor can have different decision
- Shows downstream impact before confirming

### Rule: Locked Tasks Block Cascade Propagation
- If locked task set to "break", its children also break
- Cascade chain stops at broken tasks

### Rule: Lag Handling
| Type | Calculation |
|------|-------------|
| FS (Finish-to-Start) | Successor starts 1 working day AFTER predecessor ends + lag |
| SS (Start-to-Start) | Successor starts same day as predecessor + lag |
| FF (Finish-to-Finish) | Calculated backwards from end + lag |
| SF (Start-to-Finish) | Calculated backwards from end + lag |

**Lag is always in WORKING DAYS** (skips weekends and holidays)

---

## 2. LOCK RULES

### Rule: What Makes a Task Locked
A task is locked if ANY of these are true:
- [ ] `confirm = true` (supervisor confirms)
- [ ] `supplier_confirm = true` (supplier confirms)
- [ ] `finance_approved = true` (finance approves)
- [ ] `is_completed = true` (task is done)

### Rule: Locked Tasks Cannot Be Modified
| Action | Locked? | Allowed? |
|--------|---------|----------|
| Drag to new date | Yes | NO |
| Resize duration | Yes | NO |
| Change duration field | Yes | NO |
| Delete | Yes | NO |
| Toggle lock status | Yes | YES |
| View dependencies | Yes | YES |

### Rule: "Fully Locked" State
When BOTH `supplier_confirm` AND `confirm` are true:
- Task is "fully locked"
- Dependencies are automatically cleared
- `dependency_broken` flag set to true
- Task stays pinned at current position

### Rule: Lock Priority
All lock types have equal priority - ANY one triggers lock:
1. `confirm` (supervisor)
2. `supplier_confirm` (supplier) - purple UI
3. `finance_approved` (finance)
4. `started` (work begun)
5. `is_completed` (done)

---

## 3. DEPENDENCY RULES

### Rule: Circular Dependency Prevention
- When adding dependency A → B, check if B can reach A
- Uses DFS (Depth-First Search) algorithm
- If cycle detected, reject the dependency

### Rule: Valid Dependency Types
| Type | Meaning | Usage |
|------|---------|-------|
| FS | Finish-to-Start | Most common (default) |
| SS | Start-to-Start | Parallel work |
| FF | Finish-to-Finish | Must end together |
| SF | Start-to-Finish | Rare |

### Rule: Dependency Validation
| Type | Validation |
|------|------------|
| FS | Successor must start ON/AFTER predecessor ends + lag |
| SS | Successor must start ON/AFTER predecessor starts + lag |
| FF | Successor must finish ON/AFTER predecessor finishes + lag |
| SF | Successor must finish ON/AFTER predecessor starts + lag |

### Rule: Broken Dependency Detection
A dependency becomes "broken" when:
1. Task has BOTH `confirm` AND `supplier_confirm` = true
2. Task had dependencies before becoming fully locked
3. Dependencies are cleared, `dependency_broken` = true
4. Visual indicator shows broken state

---

## 4. DATE CALCULATION RULES

### Rule: Working Days Skip Weekends and Holidays
**Weekends:** Saturday (6) and Sunday (0) always skipped

**Australian Public Holidays (Queensland):**
- Fixed: Jan 1, Jan 26, Apr 25, Dec 25, Dec 26
- Variable: Good Friday, Easter Saturday, Easter Monday
- Queen's Birthday: First Monday of October

### Rule: Duration is INCLUSIVE of Both Dates
```
Monday to Wednesday = 3 working days (Mon, Tue, Wed)
NOT 2 days
```

| duration_days | Result |
|---------------|--------|
| 1 | Same day (startDate = endDate) |
| 2 | Spans 2 working days |
| 0 | Treated as 1 |

### Rule: Start Date Calculation Priority
1. **If LOCKED with hold_date:** Use hold_date (skip to working day)
2. **If has PREDECESSORS and NOT locked:** Calculate from predecessors
3. **If NO PREDECESSORS:** Use project start date (today)

### Rule: hold_date Overrides Predecessors
- When task is locked, hold_date ALWAYS wins
- Dependencies are ignored
- Position is pinned
- If hold_date is weekend/holiday, move to next working day

---

## 5. CONFIRMATION RULES

### Rule: confirm Toggle (Supervisor)
| Action | Result |
|--------|--------|
| Check confirm | Task locked, position saved to hold_date |
| Uncheck confirm | Task unlocked, dates recalculate from predecessors |

**No dialog shown** - direct toggle

### Rule: supplier_confirm Toggle
| Action | Result |
|--------|--------|
| Check supplier_confirm | Dialog shows affected successors, then lock |
| Uncheck supplier_confirm | Task unlocked, dates recalculate |

**Dialog shows direct successors** (first 5, then "... and X more")

### Rule: Auto-set confirm When Locked + Has Dependencies
If task is locked (supplier_confirm) AND has predecessors:
- Automatically also set `confirm = true`
- Makes task "fully locked"
- Dependencies cleared and marked broken

### Rule: Toggling Saves hold_date
When confirming (locking) a task:
- Current position saved to `hold_date`
- Prevents cascade from ever moving it

---

## 6. HEADER/GROUP RULES

### Rule: Header Detection
A row is a HEADER if:
- `header_gantt === 'Header'` (string value), OR
- `allow_header === true` (explicit flag)

A row is a CHILD if:
- `header_gantt` is a number (parent task_number), OR
- `header_gantt` is `{id, display}` object, OR
- `header_gantt` is string that parses to number

### Rule: Header Date Calculation
```
Header.startDate = MIN(all children startDates)
Header.endDate = MAX(all children endDates)
```

### Rule: Header Dependencies Shift Children
If header has dependencies:
1. Calculate header's required start from predecessors
2. If required start > children's min start
3. SHIFT ALL children forward by the difference
4. Header spans the shifted children

### Rule: Update taskDateMap After Header Calculation
After calculating header dates, update the date map so subsequent headers depending on this one use correct dates.

### Rule: Headers Always Visible
Headers remain visible even if they have no children.

---

## 7. TASK TYPE RULES

### Rule: Task Shape Detection
| Shape | Detection | Visual |
|-------|-----------|--------|
| order | Name starts with "Order " | Diamond + order icon |
| call | Name starts with "Call " | Diamond + phone icon |
| photo | Name starts with "Photo " | Camera icon |
| milestone | duration_days <= 1 | Diamond (currently disabled) |
| task | Default | Rectangle bar |

### Rule: Shape Based on Name Prefix Only
Shape is determined by name prefix, NOT duration.
Duration affects date calculation, not shape.

---

## 8. VALIDATION RULES

### Rule: Task Overdue Detection
Task is overdue if ALL of these are true:
- `endDate < today`
- `status !== 'completed'`
- `status !== 'in-progress'`

Started and completed tasks are NEVER overdue.

### Rule: Required Fields
| Field | Required | Default |
|-------|----------|---------|
| task_number | Yes | - |
| name | Yes | - |
| duration_days | Yes | 1 |
| sequence_order | Yes | - |

---

## Summary: Rules by Category

| Category | Rule Count |
|----------|------------|
| CASCADE | 5 rules |
| LOCK | 4 rules |
| DEPENDENCY | 4 rules |
| DATES | 5 rules |
| CONFIRMATION | 4 rules |
| HEADER/GROUP | 5 rules |
| TASK TYPE | 2 rules |
| VALIDATION | 2 rules |
| **TOTAL** | **31 rules** |

---

## Critical Rules (Must Not Break)

These rules are fundamental to the scheduling logic:

1. **Locked tasks NEVER move from cascade** - Core lock protection
2. **hold_date overrides all calculations** - Manual positioning works
3. **Circular dependencies prevented** - No infinite loops
4. **Working days skip weekends/holidays** - Accurate scheduling
5. **Header spans children dates** - Visual grouping correct
6. **Duration is INCLUSIVE** - 3 days = 3 days, not 2
7. **Fully locked = dependencies cleared** - Clean break from chain

---

*Generated from codebase exploration on 2026-01-02*
