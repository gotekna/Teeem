# Bug Report Template

**Date Discovered:** YYYY-MM-DD
**Reporter:** [Your Name]
**Status:** 🔴 Open | 🟡 Investigating | 🟢 Resolved
**Severity:** Critical | High | Medium | Low
**Component:** DHtmlxGanttView | ScheduleTemplateEditor | Backend Service | Other

---

## Bug Summary

[One-line description of the bug]

---

## Symptoms

### What Happens
[Describe the visible behavior/problem]

### Expected Behavior
[What should happen instead]

### Frequency
- [ ] Always reproducible
- [ ] Intermittent (happens sometimes)
- [ ] Rare (happened once or twice)

---

## Reproduction Steps

1. [First step]
2. [Second step]
3. [Third step]
4. [Result: bug occurs]

**Minimal Test Case:**
```javascript
// If applicable, provide minimal code that reproduces the issue
```

---

## Environment

**Browser:** [Chrome 120 / Firefox 115 / Safari 17]
**OS:** [macOS 14.2 / Windows 11 / Linux]
**App Version/Commit:** [Git commit hash or version]
**Date/Time:** [When did this occur]

---

## Diagnostic Data

### Console Logs
```
[Paste relevant console logs here]
```

### Debug Report
```json
// Export from window.exportBugHunterReport() or window.exportGanttDebugHistory()
// Attach the JSON file or paste key sections here
```

### Network Activity
- **Duplicate API calls:** Yes/No
- **Failed requests:** Yes/No
- **API call count:** [Number]

### Performance Metrics
- **Drag duration:** [ms]
- **Gantt reload count:** [Number]
- **State update count:** [Number]

---

## Screenshots/Videos

[Attach screenshots or screen recordings if applicable]

---

## Investigation Notes

### Initial Analysis
[What you think might be causing the issue]

### Files Investigated
- [ ] [file-path-1.jsx](file-path-1.jsx) - [brief note]
- [ ] [file-path-2.rb](file-path-2.rb) - [brief note]

### Hypotheses
1. **Hypothesis 1:** [Possible cause]
   - Evidence: [What supports this]
   - Ruled out: Yes/No

2. **Hypothesis 2:** [Another possible cause]
   - Evidence: [What supports this]
   - Ruled out: Yes/No

---

## Fix Attempts

### Attempt #1: [Brief description]
**Date:** YYYY-MM-DD
**Files Changed:**
- [file-path.jsx](file-path.jsx:line)

**Changes Made:**
```javascript
// Code snippet of what was changed
```

**Result:** ❌ Did not fix | ⚠️ Partially fixed | ✅ Fixed

**Notes:** [What you learned from this attempt]

---

### Attempt #2: [Brief description]
**Date:** YYYY-MM-DD
**Files Changed:**
- [file-path.jsx](file-path.jsx:line)

**Changes Made:**
```javascript
// Code snippet
```

**Result:** ❌ Did not fix | ⚠️ Partially fixed | ✅ Fixed

**Notes:** [What you learned]

---

## Root Cause

[Once identified, describe the actual root cause]

**Why it happened:**
[Explanation of why the code behaved this way]

**Contributing factors:**
- Factor 1
- Factor 2

---

## Final Solution

### Implementation
**Date Fixed:** YYYY-MM-DD
**Commit:** [Git commit hash]

**Files Changed:**
1. [file-path-1.jsx:line](file-path-1.jsx:line) - [Description]
2. [file-path-2.jsx:line](file-path-2.jsx:line) - [Description]

### Code Changes

#### File: [file-path.jsx](file-path.jsx)
```javascript
// BEFORE
const oldCode = () => {
  // problematic code
}

// AFTER
const fixedCode = () => {
  // fixed code with comments explaining why
}
```

### Why This Works
[Explain why the solution fixes the root cause]

---

## Testing & Verification

### Manual Tests
- [ ] Test case 1: [description] - ✅ Pass
- [ ] Test case 2: [description] - ✅ Pass
- [ ] Regression test: [description] - ✅ Pass

### Automated Tests
- [ ] E2E test added/updated: [test-file.spec.js](test-file.spec.js)
- [ ] Unit test added/updated: [test-file.test.js](test-file.test.js)

### Performance Metrics (Before vs After)
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| API calls per drag | 8 | 1 | 87.5% ↓ |
| Gantt reloads | 8 | 1 | 87.5% ↓ |
| Drag duration | 300ms | 150ms | 50% ↓ |

---

## Prevention

### Code Patterns to Avoid
```javascript
// AVOID: Pattern that caused this bug
badPattern()

// USE: Safer pattern
goodPattern()
```

### Guardrails Added
- [ ] Added validation/check to prevent recurrence
- [ ] Added warning/error message for related issues
- [ ] Added documentation/comments explaining why
- [ ] Added diagnostic logging for future debugging

---

## Related Issues

- **Similar bugs:** [Link to related bug reports]
- **Documentation:** [Link to updated docs]
- **Follow-up tasks:** [Any remaining work]

---

## Lessons Learned

### Key Insights
1. [Important lesson from this bug]
2. [Another important insight]

### What Worked
- [Debugging technique that helped]
- [Tool or approach that was effective]

### What Didn't Work
- [Approach that was tried but didn't help]
- [Common misconception that was wrong]

---

## References

- **Gantt Bible:** [GANTT_DRAG_FLICKER_FIXES.md](../frontend/GANTT_DRAG_FLICKER_FIXES.md)
- **Architecture Docs:** [TASK_MANAGEMENT_ARCHITECTURE.md](../TASK_MANAGEMENT_ARCHITECTURE.md)
- **External Resources:** [Links to relevant Stack Overflow, docs, etc.]

---

**Last Updated:** YYYY-MM-DD
**Next Review:** [Date to review if fix is still working]
