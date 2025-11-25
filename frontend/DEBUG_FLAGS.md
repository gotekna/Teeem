# Debug Flags Guide

## Overview

The Trapid frontend now uses conditional debug logging to reduce console verbosity while maintaining debugging capabilities when needed.

## Quick Start

### Default Behavior (Clean Console)
```bash
# Just run the app normally
npm run dev
```
✅ **Result:** Only critical logs shown (table loading, errors)

### Enable Progressive Loading Debug
```bash
# Add to .env:
VITE_DEBUG_PROGRESSIVE_LOADING=true

npm run dev
```
✅ **Result:** Shows views loading, records loading, cache hits, search focus events

### Enable Progress Sync Debug
```bash
# Add to .env:
VITE_DEBUG_PROGRESS_SYNC=true

npm run dev
```
✅ **Result:** Shows state updates, rendering phases, timer cleanup, startTransition events

### Enable All Debug Logs
```bash
# Add to .env:
VITE_DEBUG_ALL=true

npm run dev
```
✅ **Result:** Shows ALL debug logs (very verbose, use only when needed)

---

## Available Debug Loggers

| Logger | Environment Variable | What It Shows |
|--------|---------------------|---------------|
| `progressiveLoadLog()` | `VITE_DEBUG_PROGRESSIVE_LOADING` | Views loading, records loading, background loads, cache hits, search focus |
| `progressiveSyncLog()` | `VITE_DEBUG_PROGRESS_SYNC` | State updates, rendering phases, timer cleanup, duplicate load prevention |
| `preloadLog()` | `VITE_DEBUG_PROGRESSIVE_LOADING` | SessionStorage cache hits/misses, data age checks |
| `infiniteScrollLog()` | `VITE_DEBUG_PROGRESSIVE_LOADING` | Infinite scroll events, page loading |
| `loadingProgressLog()` | `VITE_DEBUG_PROGRESS_SYNC` | Download progress percentages, loading phases |
| `progressiveLoadError()` | Always enabled | Errors in progressive loading (always shown) |

---

## Usage Examples

### Normal Development (Default)
```bash
# .env (no debug flags)
VITE_API_URL=http://localhost:3000
VITE_MAPBOX_ACCESS_TOKEN=your_token_here

npm run dev
```
**Console output:**
```
[Load Table] Loading table with ID/slug: 205
[Load Table] ✅ Table loaded: Price Books
```
✅ Clean, minimal output

---

### Debugging Table Loading Issues
```bash
# .env
VITE_DEBUG_PROGRESSIVE_LOADING=true

npm run dev
# Navigate to Price Books table
```
**Console output:**
```
[Progressive Loading] 🚀 Step 1: Loading views first...
[Progressive Loading] 🎯 Loading views for table: 205
[Progressive Loading] ✅ Views loaded! 3 views
[Progressive Loading] 📊 Step 2: Loading records in background...
[Preload] ⚠️ Preloaded data expired (age: 325s), loading fresh data
[Progressive Loading] loadRecords called: { id: '205', viewMode: 'full', ... }
[Progressive Loading] Response received: { recordCount: 8450, totalCount: 8450, ... }
[Progressive Loading] ✅ Search bar focused (attempt 1)
```
✅ Detailed loading flow visible

---

### Debugging Performance/Rendering Issues
```bash
# .env
VITE_DEBUG_PROGRESS_SYNC=true

npm run dev
```
**Console output:**
```
[PROGRESS SYNC] 🔄 Loading state changed: false
[PROGRESS SYNC] 📊 Setting 8450 records in state (non-blocking)...
[PROGRESS SYNC] 📊 startTransition() call completed in 2ms (render will happen in background)
[PROGRESS SYNC] 🎉 Load complete in 1247ms
[PROGRESS SYNC] ✅ Component rendered with 8450 records
```
✅ Performance metrics visible

---

### Full Debug Mode (Troubleshooting)
```bash
# .env
VITE_DEBUG_ALL=true

npm run dev
```
**Console output:**
```
[Debug Logger] Active debug flags: ALL
[Progressive Loading] 🚀 Step 1: Loading views first...
[PROGRESS SYNC] 🧹 Cleaning up timers: { intervals: 0, timeouts: 0, ... }
[Progressive Loading] 🎯 Loading views for table: 205
[Progressive Loading] ✅ Views loaded! 3 views
[Progressive Loading] 📊 Step 2: Loading records in background...
[PROGRESS SYNC] 🔄 Loading state changed: false
[Preload] ⚠️ Preloaded data expired (age: 325s), loading fresh data
[Progressive Loading] loadRecords called: { ... }
[Progressive Loading] Response received: { ... }
[PROGRESS SYNC] 📊 Setting 8450 records in state (non-blocking)...
[PROGRESS SYNC] 📊 startTransition() call completed in 2ms
[Progressive Loading] Records state updated: { ... }
[PROGRESS SYNC] 🎉 Load complete in 1247ms
[Progressive Loading] Column conversion: { columnCount: 42, ... }
[PROGRESS SYNC] ✅ Component rendered with 8450 records
[Progressive Loading] ✅ Search bar focused (attempt 1)
[Progressive Loading] Render state: { recordsCount: 8450, ... }
```
✅ EVERYTHING visible (very verbose)

---

## Migration Summary

### What Changed
- ✅ Migrated **50+ console.log statements** to conditional debug loggers
- ✅ Preserved critical logs (table loading, errors)
- ✅ Added environment-based control via `.env` flags
- ✅ Clean console by default, verbose logging when needed

### Files Modified
1. `frontend/src/utils/debugLogger.js` - New debug logger utility
2. `frontend/src/pages/TablePage.jsx` - Migrated all verbose logs
3. `frontend/.env.example` - Added debug flag documentation

### Breaking Changes
❌ None - All changes are backward compatible

---

## Troubleshooting

### "I don't see any logs"
- ✅ Check your `.env` file has the correct flags
- ✅ Restart dev server after changing `.env`: `Ctrl+C` then `npm run dev`
- ✅ Environment variables must start with `VITE_` to work with Vite

### "I see too many logs"
- ✅ Remove or comment out debug flags in `.env`
- ✅ Restart dev server
- ✅ Use `VITE_DEBUG_PROGRESSIVE_LOADING` instead of `VITE_DEBUG_ALL`

### "Flags aren't working"
- ✅ Make sure you're editing `.env` (not `.env.example`)
- ✅ Flag values must be exactly `true` (lowercase, no quotes)
- ✅ Restart dev server after changes

---

## Best Practices

### For Daily Development
```bash
# .env - Keep it clean
# No debug flags enabled
```
✅ Fast, clean console for normal work

### When Investigating Issues
```bash
# .env - Enable specific debug category
VITE_DEBUG_PROGRESSIVE_LOADING=true
```
✅ Targeted debugging without noise

### When Sharing Bug Reports
```bash
# .env - Enable all logs
VITE_DEBUG_ALL=true

# Then copy console output for bug report
```
✅ Full context for debugging

---

## Future Enhancements

Potential additions:
- `VITE_DEBUG_API_CALLS` - Log all API requests/responses
- `VITE_DEBUG_STATE_CHANGES` - Log all React state updates
- `VITE_DEBUG_RENDER_CYCLES` - Log component render counts
- Browser extension to toggle flags without restart

---

## Related Documentation

- Console Capture System: `frontend/src/utils/consoleCapture.js`
- Error Logging: `frontend/src/utils/errorLogger.js`
- Environment Setup: `frontend/.env.example`
