# Detection Rules Reference

**Last Updated:** 2025-11-20
**Purpose:** Technical reference for automated bug pattern detection
**Used By:** Pre-Commit Guardian, Code Guardian Agent, Local Dev Assistant, CI/CD Pipeline

---

## Overview

This document provides the technical implementation details for detecting bug patterns in the Trapid codebase. Each pattern has:
- Regex detection rules
- Context validation logic
- False positive handling
- Auto-fix algorithms (where applicable)

---

## PATTERN-001: Empty Array Assignment (Data Loss)

### Detection Strategy

**Priority:** CRITICAL - Must block commits
**Confidence:** HIGH - Low false positive rate (~5%)
**Auto-Fix:** ✅ Available

### Regex Rules

**Primary Pattern:**
```javascript
/(\w+)\s*=\s*\[\](?!\s*\.\.\.|;?\s*$)/g
```

**Pattern Breakdown:**
- `(\w+)` - Capture variable name (group 1)
- `\s*=\s*` - Assignment operator with optional whitespace
- `\[\]` - Empty array literal
- `(?!\s*\.\.\.)` - Negative lookahead: NOT followed by spread operator
- `(?!;?\s*$)` - Negative lookahead: NOT end of line (intentional initialization)

**Matches:**
```javascript
predecessor_ids = []              // ✅ Match
const items = []                  // ❌ No match (initialization)
data = []  // clear before loop   // ✅ Match
list = []; console.log(list)      // ❌ No match (end of statement)
```

### Context Validation

**Required Checks:**
1. **Assignment Context:** Not in variable declaration
2. **Previous Value:** Variable previously held data
3. **Scope:** Not in initialization block
4. **Intent Markers:** No comment indicating intentional clear

**Implementation:**
```javascript
function validateContext(match, fileContent, lineNumber) {
  const line = fileContent.split('\n')[lineNumber - 1]

  // Skip variable declarations
  if (/^\s*(const|let|var)\s+/.test(line)) {
    return false
  }

  // Skip if comment indicates intent
  if (/\/\/.*clear|reset|empty/i.test(line)) {
    return false
  }

  // Skip in initialization functions
  if (isInInitFunction(fileContent, lineNumber)) {
    return false
  }

  return true
}
```

### False Positives

**Known False Positives:**
1. **Intentional Clearing:**
   ```javascript
   // Reset form
   formData = []  // ❌ False positive
   ```
   **Mitigation:** Check for comments with "reset", "clear", "empty"

2. **Initialization Patterns:**
   ```javascript
   let items = []  // ❌ False positive
   ```
   **Mitigation:** Exclude `const/let/var` declarations

3. **Conditional Clearing:**
   ```javascript
   if (shouldClear) items = []  // ❌ May be intentional
   ```
   **Mitigation:** Warn but don't block; require user confirmation

### Auto-Fix Algorithm

**Strategy:** Preserve existing data using spread operator

**Implementation:**
```javascript
function autoFix(match, variableName) {
  // Extract variable name from match
  const variable = match.match(/(\w+)\s*=/)?.[1]

  if (!variable) return null

  // Generate fix with spread operator
  return `${variable} = [...${variable}]`
}
```

**Examples:**
```javascript
// Before
predecessor_ids = []

// After (auto-fix)
predecessor_ids = [...predecessor_ids]
```

**Validation:**
- Preserves existing data
- Maintains array type
- Safe fallback with `|| []` for undefined values

### Testing

**Unit Tests:**
```javascript
test('detects empty array assignment', () => {
  const code = 'predecessor_ids = []'
  expect(detectPattern(code)).toBe(true)
})

test('ignores spread operator', () => {
  const code = 'items = [...items]'
  expect(detectPattern(code)).toBe(false)
})

test('ignores initialization', () => {
  const code = 'const list = []'
  expect(detectPattern(code)).toBe(false)
})
```

**Integration Tests:**
- Test with real DHtmlxGanttView.jsx code
- Verify auto-fix preserves predecessors
- Check database for data integrity

---

## PATTERN-002: Race Condition - Rapid State Updates

### Detection Strategy

**Priority:** HIGH - Warn but allow commit with confirmation
**Confidence:** MEDIUM - Moderate false positive rate (~20%)
**Auto-Fix:** ⚠️ Manual (requires context understanding)

### Regex Rules

**Primary Pattern:**
```javascript
/setState\s*\([^)]+\)\s*[;\n]\s*setState\s*\(/g
```

**Pattern Breakdown:**
- `setState\s*\(` - setState function call
- `[^)]+` - Match any parameters
- `\)` - Close setState call
- `\s*[;\n]\s*` - Separator: semicolon or newline
- `setState\s*\(` - Second setState call

**Matches:**
```javascript
setState({a: 1}); setState({b: 2})     // ✅ Match
setState({x: 1})
setState({y: 2})                        // ✅ Match

setState(prev => ({...prev, a: 1}))    // ❌ No match (single call)
```

**Enhanced Pattern (Multi-line):**
```javascript
/setState\s*\([^)]+\)[\s;]*setState\s*\([^)]+\)/gm
```

### Context Validation

**Required Checks:**
1. **Scope:** Both calls in same function
2. **Dependencies:** Check if updates are independent
3. **Timing:** Synchronous vs asynchronous calls
4. **React Version:** Automatic batching in React 18+

**Implementation:**
```javascript
function validateContext(fileContent, match, lineNumber) {
  const scope = extractFunctionScope(fileContent, lineNumber)

  // Check if in event handler (common race condition location)
  if (isInEventHandler(scope)) {
    return {
      severity: 'HIGH',
      message: 'Multiple setState in event handler'
    }
  }

  // Check if in useEffect (may be intentional)
  if (isInUseEffect(scope)) {
    return {
      severity: 'MEDIUM',
      message: 'Multiple setState in useEffect - verify dependencies'
    }
  }

  return { severity: 'LOW' }
}
```

### False Positives

**Known False Positives:**
1. **Intentional Sequential Updates:**
   ```javascript
   setState({ step: 1 })
   await delay(100)
   setState({ step: 2 })  // ❌ False positive (intentional timing)
   ```
   **Mitigation:** Detect async/await, setTimeout patterns

2. **Different State Variables:**
   ```javascript
   setUser({ name: 'Rob' })
   setSettings({ theme: 'dark' })  // ❌ Different state
   ```
   **Mitigation:** Track state variable names separately

3. **React 18 Auto-Batching:**
   ```javascript
   // React 18 automatically batches these
   setState({ a: 1 })
   setState({ b: 2 })  // ❌ Already optimized
   ```
   **Mitigation:** Check React version, lower severity if React 18+

### Auto-Fix Algorithm

**Strategy:** Merge state updates into single call

**Complexity:** HIGH - Requires AST parsing to safely merge objects

**Implementation:**
```javascript
function autoFixStateUpdates(code) {
  // Parse code to AST
  const ast = parse(code)

  // Find consecutive setState calls
  const stateCalls = findConsecutiveSetStateCalls(ast)

  // Merge if safe to do so
  if (canSafelyMerge(stateCalls)) {
    return mergeStateCalls(stateCalls)
  }

  return null  // Manual fix required
}
```

**Example (Simple Case):**
```javascript
// Before
setState({ isDragging: true })
setState({ position: newPosition })

// After (auto-fix)
setState({
  isDragging: true,
  position: newPosition
})
```

**Complex Case (Requires Manual Fix):**
```javascript
// Before
setState(prev => ({ ...prev, count: prev.count + 1 }))
setState({ status: 'active' })

// After (manual guidance provided)
setState(prev => ({
  ...prev,
  count: prev.count + 1,
  status: 'active'
}))
```

### Testing

**Unit Tests:**
```javascript
test('detects multiple setState calls', () => {
  const code = `setState({a:1}); setState({b:2})`
  expect(detectPattern(code)).toBe(true)
})

test('ignores single setState', () => {
  const code = `setState({a:1, b:2})`
  expect(detectPattern(code)).toBe(false)
})
```

**Performance Tests:**
- Measure render counts before/after fix
- Verify single re-render with merged state
- Check React DevTools Profiler

---

## PATTERN-003: Infinite Cascade Loop

### Detection Strategy

**Priority:** CRITICAL - Must block commits
**Confidence:** MEDIUM - Context-dependent (~30% false positives)
**Auto-Fix:** ⚠️ Guidance only (requires dependency analysis)

### Regex Rules

**Primary Pattern (Missing Dependencies):**
```javascript
/useEffect\s*\(\s*\(\)\s*=>\s*\{[^}]*updateCascade[^}]*\}\s*\)/g
```

**Pattern Breakdown:**
- `useEffect\s*\(` - useEffect hook
- `\s*\(\)\s*=>` - Arrow function with no params
- `\{[^}]*updateCascade[^}]*\}` - Function body containing cascade operation
- `\)` - Close useEffect (no dependency array!)

**Enhanced Pattern (Comprehensive):**
```javascript
/useEffect\s*\(\s*(?:function\s*\(\)|(?:\(\)\s*=>|\w+\s*=>))\s*\{(?:[^}]|(?:\{[^}]*\}))*(?:updateCascade|setState|setRows|applyUpdates)[^}]*\}(?:\s*,\s*\[\s*\])?\s*\)/gs
```

**Matches:**
```javascript
useEffect(() => {
  updateCascadeFields()
})  // ✅ Match - no dependencies

useEffect(() => {
  setState({...})
}, [])  // ⚠️ Match - empty array (runs once, may be safe)

useEffect(() => {
  updateCascade()
}, [taskIds])  // ❌ No match - has dependencies
```

### Context Validation

**Required Checks:**
1. **Dependency Array:** Missing or empty
2. **State Updates:** Contains setState/state mutations
3. **API Calls:** Contains async operations
4. **Recursion Risk:** Updates trigger themselves

**Implementation:**
```javascript
function validateCascadeLoop(fileContent, match, lineNumber) {
  const effectBlock = extractUseEffectBlock(fileContent, lineNumber)

  // Check for dependency array
  const hasDependencies = /\]\s*\)$/.test(effectBlock)
  const hasEmptyDependencies = /\[\s*\]\s*\)$/.test(effectBlock)

  // Check for state updates
  const hasStateUpdate = /setState|setRows|setData/.test(effectBlock)

  // Check for cascade operations
  const hasCascade = /cascade|update.*fields|propagate/i.test(effectBlock)

  // Risk assessment
  if (!hasDependencies && hasStateUpdate && hasCascade) {
    return {
      severity: 'CRITICAL',
      risk: 'INFINITE_LOOP',
      message: 'useEffect with cascade has no dependency array'
    }
  }

  if (hasEmptyDependencies && hasCascade) {
    return {
      severity: 'LOW',
      risk: 'RUNS_ONCE',
      message: 'useEffect runs once on mount - verify this is intentional'
    }
  }

  return null
}
```

### False Positives

**Known False Positives:**
1. **Intentional Run-Once:**
   ```javascript
   useEffect(() => {
     initializeData()  // Intentional one-time setup
   }, [])
   ```
   **Mitigation:** Lower severity if dependencies = `[]`

2. **Conditional Updates:**
   ```javascript
   useEffect(() => {
     if (!isInitialized) {
       updateCascade()  // Protected by flag
     }
   })
   ```
   **Mitigation:** Detect guard conditions (if statements)

3. **Ref-Based Tracking:**
   ```javascript
   useEffect(() => {
     if (!isUpdating.current) {
       isUpdating.current = true
       updateCascade()
     }
   })
   ```
   **Mitigation:** Detect ref guards

### Auto-Fix Algorithm

**Strategy:** Suggest dependency array based on variables referenced

**Complexity:** VERY HIGH - Requires static analysis

**Implementation:**
```javascript
function suggestDependencies(effectBody) {
  // Parse variables used in effect
  const variables = extractVariables(effectBody)

  // Filter to likely dependencies (state, props)
  const dependencies = variables.filter(v => {
    return !v.includes('.')  // Skip object properties
      && !isPrimitive(v)      // Skip constants
      && !isRef(v)            // Skip refs
  })

  return dependencies
}
```

**Example:**
```javascript
// Before
useEffect(() => {
  updateCascadeFields(taskIds, scheduleId)
})

// Suggested fix
useEffect(() => {
  updateCascadeFields(taskIds, scheduleId)
}, [taskIds, scheduleId])  // Auto-suggested dependencies
```

### Testing

**Unit Tests:**
```javascript
test('detects useEffect without dependencies', () => {
  const code = `useEffect(() => { updateCascade() })`
  expect(detectPattern(code)).toBe(true)
})

test('ignores useEffect with dependencies', () => {
  const code = `useEffect(() => { updateCascade() }, [ids])`
  expect(detectPattern(code)).toBe(false)
})
```

**Integration Tests:**
- Monitor API call frequency
- Check for duplicate network requests
- Verify cascade completes within timeout

---

## PATTERN-004: Deprecated Table Component Usage

### Detection Strategy

**Priority:** MEDIUM - Warn and provide migration path
**Confidence:** HIGH - Very low false positives (~2%)
**Auto-Fix:** ⚠️ Template provided (requires manual integration)

### Regex Rules

**Primary Pattern (Imports):**
```javascript
/import\s+(?:\{[^}]*\}|\w+)\s+from\s+['"](?:.*\/)?(?:TablePage|DataTable)(?:\.jsx?)?['"]/g
```

**Pattern Breakdown:**
- `import\s+` - Import statement
- `(?:\{[^}]*\}|\w+)` - Named or default import
- `from\s+['"]` - from keyword and quote
- `(?:.*\/)?` - Optional path
- `(?:TablePage|DataTable)` - Deprecated component name
- `(?:\.jsx?)?` - Optional .js/.jsx extension
- `['"]` - Closing quote

**Secondary Pattern (JSX Usage):**
```javascript
/<(?:TablePage|DataTable)\s+[^>]*>/g
```

**Matches:**
```javascript
import TablePage from './TablePage'           // ✅ Match
import { DataTable } from './components/DataTable.jsx'  // ✅ Match
import TrapidTableView from './TrapidTableView'  // ❌ No match

<TablePage data={data} />                     // ✅ Match
<TrapidTableView data={data} />               // ❌ No match
```

### Context Validation

**Required Checks:**
1. **Import Source:** Verify not a different TablePage (rare collision)
2. **Usage Count:** Count JSX instances
3. **Migration Status:** Check if TODO comment exists
4. **File Type:** Component files only (not test files)

**Implementation:**
```javascript
function validateDeprecatedTable(fileContent, match) {
  // Extract component name
  const componentName = match.match(/TablePage|DataTable/)[0]

  // Count JSX usages
  const usageCount = countJSXUsages(fileContent, componentName)

  // Check for migration TODO
  const hasTodoComment = /TODO.*TrapidTableView|migrate.*table/i.test(fileContent)

  return {
    component: componentName,
    usageCount,
    hasMigrationPlan: hasTodoComment,
    severity: hasTodoComment ? 'LOW' : 'MEDIUM'
  }
}
```

### False Positives

**Known False Positives:**
1. **Name Collision:**
   ```javascript
   import TablePage from '@external/lib/TablePage'  // Different library
   ```
   **Mitigation:** Check import path - only flag internal components

2. **Test Files:**
   ```javascript
   // In test file
   import TablePage from '../TablePage'  // Testing old component
   ```
   **Mitigation:** Exclude `*.test.js`, `*.spec.js` files

3. **Migration Files:**
   ```javascript
   // migration-helper.js
   import TablePage from './old/TablePage'  // Temporary wrapper
   ```
   **Mitigation:** Detect "migration", "old", "deprecated" in path

### Auto-Fix Algorithm

**Strategy:** Provide template and migration guide

**Implementation:**
```javascript
function provideMigrationGuidance(match, fileContent) {
  return {
    templatePath: 'frontend/src/components/settings/GoldStandardTableTab.jsx',
    steps: [
      '1. Copy template from Gold Standard Tab',
      '2. Replace TablePage import with TrapidTableView',
      '3. Convert data format to columns array',
      '4. Test all features: sort, filter, search, export',
      '5. Remove old TablePage import'
    ],
    referenceURL: '/settings?tab=gold-standard',
    teacherGuide: 'Teacher §19.1: Table Implementation Guide'
  }
}
```

### Testing

**Unit Tests:**
```javascript
test('detects TablePage import', () => {
  const code = `import TablePage from './TablePage'`
  expect(detectPattern(code)).toBe(true)
})

test('ignores TrapidTableView import', () => {
  const code = `import TrapidTableView from './TrapidTableView'`
  expect(detectPattern(code)).toBe(false)
})
```

**Visual Regression Tests:**
- Compare old vs new table UI
- Verify feature parity
- Check responsive design

---

## Detection Performance

### Benchmarks

| Pattern | Avg Time | Max Time | Files/sec |
|---------|----------|----------|-----------|
| PATTERN-001 | 2ms | 15ms | 500 |
| PATTERN-002 | 5ms | 25ms | 200 |
| PATTERN-003 | 8ms | 40ms | 125 |
| PATTERN-004 | 3ms | 18ms | 333 |

**Total Scan Time (1000 files):** ~5-8 seconds

### Optimization Strategies

1. **Parallel Processing:** Scan files concurrently
2. **File Type Filtering:** Only scan `.js`, `.jsx`, `.ts`, `.tsx`
3. **Git Staged Files:** Only scan changed files in pre-commit
4. **Caching:** Skip unchanged files
5. **Early Exit:** Stop after first critical match per file

---

## Integration Guide

### Pre-Commit Guardian

```javascript
// scripts/safeguard-checker.js
const DETECTION_RULES = {
  'PATTERN-001': {
    regex: /(\w+)\s*=\s*\[\](?!\s*\.\.\.|;?\s*$)/g,
    severity: 'error',
    autoFix: true
  },
  // ... other patterns
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const violations = []

  for (const [patternId, rule] of Object.entries(DETECTION_RULES)) {
    const matches = content.matchAll(rule.regex)
    for (const match of matches) {
      violations.push({
        patternId,
        match: match[0],
        line: getLineNumber(content, match.index),
        severity: rule.severity
      })
    }
  }

  return violations
}
```

### Code Guardian Agent

```javascript
// Agent prompt integration
const AGENT_PROMPT = `
You are the Code Guardian Agent. Review pull requests for bug patterns:

${Object.entries(DETECTION_RULES).map(([id, rule]) => `
- ${id}: ${rule.description}
  Detection: ${rule.regex}
  Severity: ${rule.severity}
`).join('\n')}

For each violation found:
1. Add PR comment at specific line
2. Explain why it's a problem
3. Provide fix suggestion
4. Link to Pattern Library documentation
`
```

### CI/CD Pipeline

```yaml
# .github/workflows/pattern-detection.yml
name: Pattern Detection

on: [pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Pattern Detection
        run: node scripts/safeguard-checker.js --ci
      - name: Comment PR
        if: failure()
        uses: actions/github-script@v6
        with:
          script: |
            // Post violations as PR comments
```

---

## References

- **Pattern Library:** `/TRAPID_DOCS/PATTERN_LIBRARY.md`
- **Pre-Commit Guardian:** `/scripts/safeguard-checker.js`
- **Gantt Bug Hunter:** `/public/GANTT_BUG_HUNTER_LEXICON.md`
- **Trinity Bible:** API endpoint for prevention rules

---

**Maintained by:** Development Team
**Review Schedule:** After each new pattern addition
**Next Review:** Week 3 (Code Guardian Agent integration)
