---
name: product-planner
description: Helps plan new features with proper scoping, approach options, and implementation strategy. Use when user says "new feature", "build", "implement", or describes a product requirement.
---

# Product Planner

## When Claude Should Use This
- User describes a new feature request
- User says "build", "implement", "create", "add"
- Planning work before coding begins
- Scoping a task that seems non-trivial

## Process

### Step 1: Clarify the Problem (Don't Assume)
Before anything, ask:
- What's the user-facing outcome?
- Who uses this? (Rob, Sam, customers, all?)
- Is there existing functionality to extend?

### Step 2: Search for Related Code
```bash
# Find related implementations
grep -ri "RELATED_TERM" backend/ frontend-next/ --include="*.rb" --include="*.tsx" | head -15
```

### Step 3: Present 3 Approaches
Always give options with tradeoffs:

```markdown
## Approaches

### A) Minimal - Extend Existing
- Modify [existing component/service]
- Low risk
- Tradeoff: May not cover edge case X

### B) Moderate - New Component
- Create dedicated [component/service]
- Medium risk
- Tradeoff: More code to maintain

### C) Comprehensive - Full System
- Build [complete subsystem]
- Higher risk
- Tradeoff: Overkill if requirements don't grow

**Recommendation:** [A/B/C] because [reason]
```

### Step 4: Wait for User Input
Do NOT start coding until user picks an approach or gives feedback.

### Step 5: Break Into Tasks
Once approach is confirmed:
```markdown
## Implementation Plan

1. [ ] [First task - should be testable alone]
2. [ ] [Second task]
3. [ ] [Third task]

Starting with #1. Will check in after each.
```

## Anti-Hallucination Rules
- Don't invent requirements user didn't mention
- Don't assume integrations exist
- Don't guess at business logic
- If unclear, ask before coding

## Output Format
Always structure planning output as:
1. **Understanding** (1-2 sentences of what you heard)
2. **Questions** (if any gaps)
3. **Approaches** (3 options with tradeoffs)
4. **Recommendation** (which and why)
5. **Next step** (wait for approval)
