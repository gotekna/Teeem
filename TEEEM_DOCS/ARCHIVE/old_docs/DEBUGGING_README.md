# Gantt Debugging System - Quick Start

**Purpose:** This is your entry point for debugging Gantt chart issues in the TEEEM application.

---

## 🚀 Quick Start (30 seconds)

### If You're Experiencing a Bug:

1. **Open browser console** (F12)
2. **Enable debug mode:**
   ```javascript
   window.enableGanttDebug(['all'])
   ```
3. **Reproduce the bug**
4. **Generate report:**
   ```javascript
   window.printBugHunterReport()
   ```
5. **Export data:**
   ```javascript
   window.exportBugHunterReport()
   window.exportGanttDebugHistory()
   ```
6. **Create bug report** using [BUG_REPORT_TEMPLATE.md](BUG_REPORT_TEMPLATE.md)

---

## 📚 Documentation Map

### 🔴 For Reporting/Fixing Bugs

1. **[BUG_REPORT_TEMPLATE.md](BUG_REPORT_TEMPLATE.md)** - Start here to create a bug report
2. **[GANTT_BUGS_AND_FIXES.md](GANTT_BUGS_AND_FIXES.md)** - Knowledge base of all bugs and fixes
3. **[GANTT_DRAG_FLICKER_FIXES.md](../frontend/GANTT_DRAG_FLICKER_FIXES.md)** - The "Gantt Bible" with resolved drag flickering bug

### 🟡 For Development/Integration

4. **[INTEGRATION_GUIDE.md](../frontend/src/components/schedule-master/INTEGRATION_GUIDE.md)** - How to add debugging to your code
5. **[ganttDebugger.js](../frontend/src/utils/ganttDebugger.js)** - The actual debugger code (reference)

### 🟢 For Understanding the System

6. **[TASK_MANAGEMENT_ARCHITECTURE.md](../TASK_MANAGEMENT_ARCHITECTURE.md)** - Complete system architecture
7. **[GANTT_SCHEDULE_RULES.md](../GANTT_SCHEDULE_RULES.md)** - Business logic and calculation rules

---

## 🛠️ Tools Available

### 1. Gantt Debugger
**What:** Category-based debug logging with timestamps and performance tracking

**When to use:** When you need detailed step-by-step logs of what's happening

**Commands:**
```javascript
// Enable specific categories
window.enableGanttDebug(['drag', 'api', 'cascade'])

// Enable everything
window.enableGanttDebug(['all'])

// Disable
window.disableGanttDebug()

// View summary
window.printGanttDebugSummary()

// Export logs
window.exportGanttDebugHistory()
```

**Categories:**
- `drag` - Drag operations
- `api` - API calls
- `cascade` - Cascade updates
- `lock` - Lock state changes
- `render` - Render operations
- `performance` - Performance metrics
- `error` - Errors
- `all` - Everything

---

### 2. Bug Hunter
**What:** Automatic issue detection with diagnostic reports

**When to use:** When you want to know if the system is healthy or has issues

**Commands:**
```javascript
// Generate diagnostic report
window.printBugHunterReport()

// Export report to JSON
window.exportBugHunterReport()

// Reset for new session
window.resetBugHunter()

// Access directly
window.ganttBugHunter
```

**What it detects:**
- ✅ **Healthy:** Everything working correctly
- ⚠️ **Warning:** Potential issues detected
- 🚨 **Critical:** Serious issues (infinite loops, excessive reloads)
- ❌ **Error:** Errors occurred

---

## 🔍 Common Debugging Scenarios

### Scenario 1: "Dragging tasks is laggy/slow"

```javascript
// Enable performance tracking
window.enableGanttDebug(['drag', 'performance', 'api'])

// Drag a task

// Check report
window.printBugHunterReport()

// Look for:
// - Drag duration > 5000ms (slow drag warning)
// - Multiple API calls for same task (duplicate calls)
// - Excessive Gantt reloads
```

---

### Scenario 2: "Tasks aren't updating correctly"

```javascript
// Enable API and cascade tracking
window.enableGanttDebug(['api', 'cascade', 'state'])

// Perform the update operation

// Check what APIs were called
window.printBugHunterReport()

// Look for:
// - Failed API calls
// - Missing cascade events
// - State update issues
```

---

### Scenario 3: "Screen is flickering during operations"

```javascript
// Enable render and reload tracking
window.enableGanttDebug(['render', 'api'])

// Perform the operation that causes flicker

// Check report
window.printBugHunterReport()

// Look for:
// - Excessive Gantt reloads (should be ≤ 1)
// - Multiple rapid render operations
// - Lock state issues
```

---

### Scenario 4: "Infinite loop / Application frozen"

```javascript
// If you can still access console:
window.printBugHunterReport()

// Look for:
// - 🚨 CRITICAL: Duplicate API calls warning
// - Same task ID appearing many times
// - API calls within milliseconds of each other

// If frozen, check existing history:
window.getGanttDebugHistory()
```

---

## 📊 Health Check (Run Anytime)

Quick check to see if system is healthy:

```javascript
// 1. Reset bug hunter
window.resetBugHunter()

// 2. Perform 2-3 drag operations

// 3. Check health
window.printBugHunterReport()

// Expected results:
// ✅ Status: healthy
// ✅ API calls: 2-6 (depends on operations)
// ✅ Gantt reloads: ≤ 3
// ✅ No critical warnings
// ✅ No duplicate call warnings
```

---

## 🐛 Bug Reporting Workflow

### Step 1: Gather Data
```javascript
// Enable full debugging
window.enableGanttDebug(['all'])
window.resetBugHunter()

// Reproduce the bug

// Generate reports
window.printBugHunterReport()
window.exportBugHunterReport()  // Downloads JSON file
window.exportGanttDebugHistory()  // Downloads JSON file
```

### Step 2: Take Screenshots/Video
- Screen recording of the bug happening
- Screenshot of browser console with errors
- Screenshot of bug hunter report

### Step 3: Create Bug Report
- Copy [BUG_REPORT_TEMPLATE.md](BUG_REPORT_TEMPLATE.md)
- Fill in all sections
- Attach exported reports
- Attach screenshots/video

### Step 4: Add to Knowledge Base
- Add to "Active Issues" in [GANTT_BUGS_AND_FIXES.md](GANTT_BUGS_AND_FIXES.md)
- Include link to bug report
- Track investigation progress

### Step 5: Once Fixed
- Update bug report with solution
- Move to "Resolved Issues" in knowledge base
- Update Gantt Bible if needed
- Add prevention measures

---

## 🎓 Learning Resources

### Essential Reading (Required)
1. **[GANTT_DRAG_FLICKER_FIXES.md](../frontend/GANTT_DRAG_FLICKER_FIXES.md)** - Must read! Shows complete investigation and resolution of major bug

### Reference Documentation
2. **[GANTT_BUGS_AND_FIXES.md](GANTT_BUGS_AND_FIXES.md)** - All known issues and solutions
3. **[TASK_MANAGEMENT_ARCHITECTURE.md](../TASK_MANAGEMENT_ARCHITECTURE.md)** - How the system works

### Practical Guides
4. **[INTEGRATION_GUIDE.md](../frontend/src/components/schedule-master/INTEGRATION_GUIDE.md)** - How to add debugging to code
5. **[BUG_REPORT_TEMPLATE.md](BUG_REPORT_TEMPLATE.md)** - How to document bugs properly

---

## 🚦 System Status

### Current Status: ✅ HEALTHY

Last verified: 2025-11-14

**Known Resolved Issues:**
- ✅ BUG-001: Drag Flickering / Screen Shake (RESOLVED)

**Active Issues:**
- None

**Performance Benchmarks:**
- API calls per drag: 1 ✅
- Gantt reloads per drag: 1 ✅
- Drag operation duration: < 200ms ✅

---

## 💡 Pro Tips

### Tip 1: Use Specific Categories
Instead of enabling all categories, use only what you need:
```javascript
// Better performance
window.enableGanttDebug(['drag', 'api'])

// vs enabling everything
window.enableGanttDebug(['all'])  // Can be overwhelming
```

### Tip 2: Reset Between Sessions
```javascript
// Clean slate for each test
window.resetBugHunter()
```

### Tip 3: Export Data Before Closing Browser
```javascript
// Don't lose your debugging data!
window.exportBugHunterReport()
window.exportGanttDebugHistory()
```

### Tip 4: Check Lock States
If operations are being blocked, check lock states:
```javascript
// In browser console
window.ganttBugHunter

// Look at recent warnings - they'll tell you which locks are blocking
```

### Tip 5: Use E2E Tests
Run automated tests to catch regressions:
```bash
cd frontend
npm run test:e2e
```

---

## ❓ FAQ

**Q: How much does debugging slow down the app?**
A: Minimal impact. Debug mode adds ~5-10ms overhead. Only enable during development.

**Q: Should I leave debug mode on in production?**
A: No. Debug mode is for development only.

**Q: What if I find a bug not in the knowledge base?**
A: Great! Create a bug report and add it to the knowledge base.

**Q: Can I customize Bug Hunter thresholds?**
A: Yes!
```javascript
window.ganttBugHunter.thresholds.maxApiCallsPerTask = 5
window.ganttBugHunter.thresholds.maxDragDuration = 10000
```

**Q: How do I see all available commands?**
A: Check browser console when page loads. All commands are listed.

---

## 🆘 Need Help?

1. **Check the knowledge base:** [GANTT_BUGS_AND_FIXES.md](GANTT_BUGS_AND_FIXES.md)
2. **Read the Gantt Bible:** [GANTT_DRAG_FLICKER_FIXES.md](../frontend/GANTT_DRAG_FLICKER_FIXES.md)
3. **Review architecture docs:** [TASK_MANAGEMENT_ARCHITECTURE.md](../TASK_MANAGEMENT_ARCHITECTURE.md)
4. **Create a bug report:** [BUG_REPORT_TEMPLATE.md](BUG_REPORT_TEMPLATE.md)

---

## 🔄 Last Updated

**Date:** 2025-11-14
**Version:** 1.0
**Maintained by:** Development Team
**Next Review:** 2025-12-14

---

**Quick Access:**
- 🔴 Bug Report: [BUG_REPORT_TEMPLATE.md](BUG_REPORT_TEMPLATE.md)
- 📚 Knowledge Base: [GANTT_BUGS_AND_FIXES.md](GANTT_BUGS_AND_FIXES.md)
- 📖 Gantt Bible: [GANTT_DRAG_FLICKER_FIXES.md](../frontend/GANTT_DRAG_FLICKER_FIXES.md)
- 🔧 Integration: [INTEGRATION_GUIDE.md](../frontend/src/components/schedule-master/INTEGRATION_GUIDE.md)
- 💻 Debugger Code: [ganttDebugger.js](../frontend/src/utils/ganttDebugger.js)
