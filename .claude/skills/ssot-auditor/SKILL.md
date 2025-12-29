---
name: ssot-auditor
description: Detects duplicate implementations and SSoT violations. Use before any code change that adds new logic, config, or constants.
---

# SSoT Auditor

## When Claude Should Use This
- Adding a new constant or config value
- Implementing business logic
- Creating a new component or service
- Adding environment variables
- Defining routes or endpoints
- **Adding UI features** (fullscreen, loading states, modals)
- **Before writing any new code** - check if pattern exists

## Process

### Step 1: Check Component Registry FIRST
```bash
# Always check if component/pattern exists in registry
grep -i "FEATURE_NAME" frontend-next/lib/component-registry.ts
```

### Step 2: Search for Existing Implementations
```bash
# Search both frontend and backend
grep -ri "SEARCH_TERM" backend/ frontend-next/ --include="*.rb" --include="*.ts" --include="*.tsx" --include="*.yml" --include="*.json" | grep -v node_modules | head -20
```

### Step 3: If Found in Multiple Places
1. List all locations with file:line
2. Show the user both implementations
3. Ask: "Which is the source of truth?"
4. Wait for user response
5. Consolidate to one location after user confirms

### Step 4: If Not Found
- Proceed with implementation
- Add to SSoT component if it's a reusable pattern
- Register in component-registry.ts if new component

---

## UI Component SSoT Checks

### Run These Before ANY UI Work

#### 1. Lucide Loader Violations (Should use Spinner)
```bash
echo "=== LUCIDE LOADER VIOLATIONS ==="
grep -rn "Loader.*from.*lucide-react\|from.*lucide-react.*Loader" frontend-next/app frontend-next/components --include="*.tsx" | grep -v "spinner.tsx"
```
**Fix:** Replace with `import { Spinner } from "@/components/ui/spinner"`

#### 2. router.back() Violations (Should use BackButton)
```bash
echo "=== ROUTER.BACK() VIOLATIONS ==="
grep -rn "router\.back()" frontend-next/app frontend-next/components --include="*.tsx" | grep -v "back-button.tsx"
```
**Fix:** Replace with `<BackButton fallbackHref="/parent-route" />`

#### 3. Custom Spinner Patterns (Should use Spinner)
```bash
echo "=== CUSTOM SPINNER PATTERNS ==="
grep -rn "animate-spin" frontend-next/app frontend-next/components --include="*.tsx" | grep -v "spinner.tsx" | head -20
```
**Fix:** Replace with `<Spinner />` component

#### 4. Fullscreen Pattern Duplication
```bash
echo "=== FULLSCREEN DUPLICATIONS ==="
grep -rn "Fullscreen\|setFullscreen\|isFullscreen" frontend-next/app frontend-next/components --include="*.tsx" | grep -v "component-registry"
```
**SSoT:** TeeemTableView has `enableFullscreen` prop for tables

#### 5. Escape Key Handler Duplication
```bash
echo "=== ESCAPE HANDLER DUPLICATIONS ==="
grep -rn "Escape.*=>\|key.*Escape" frontend-next/app frontend-next/components --include="*.tsx" | head -20
```
**Check:** Should escape handling be in a shared component?

#### 6. Unregistered Components
```bash
echo "=== UNREGISTERED COMPONENTS ==="
for file in frontend-next/components/ui/*.tsx; do
  component=$(basename "$file" .tsx)
  if ! grep -q "\"$component\"" frontend-next/lib/component-registry.ts 2>/dev/null; then
    count=$(grep -r "from.*ui/$component" frontend-next --include="*.tsx" 2>/dev/null | wc -l)
    if [ "$count" -gt 0 ]; then
      echo "NOT REGISTERED: $component (used $count times)"
    fi
  fi
done
```

---

## Full Audit Command

Run this to check all SSoT violations at once:

```bash
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║           SSoT COMPONENT AUDITOR                                 ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

echo ""
echo "=== 1. LUCIDE LOADER VIOLATIONS (use Spinner) ==="
grep -rn "Loader.*from.*lucide-react\|from.*lucide-react.*Loader" frontend-next/app frontend-next/components --include="*.tsx" 2>/dev/null | grep -v "spinner.tsx" || echo "None found"

echo ""
echo "=== 2. ROUTER.BACK() VIOLATIONS (use BackButton) ==="
grep -rn "router\.back()" frontend-next/app frontend-next/components --include="*.tsx" 2>/dev/null | grep -v "back-button.tsx" || echo "None found"

echo ""
echo "=== 3. CUSTOM ANIMATE-SPIN (use Spinner) ==="
grep -rn "animate-spin" frontend-next/app frontend-next/components --include="*.tsx" 2>/dev/null | grep -v "spinner.tsx" | head -10 || echo "None found"

echo ""
echo "=== 4. DEPRECATED IMPORTS ==="
grep -rn "from.*@/components/ui/combobox['\"]" frontend-next --include="*.tsx" 2>/dev/null | grep -v "combobox-dropdown" | head -5
grep -rn "from.*@/components/ui/loader" frontend-next --include="*.tsx" 2>/dev/null | head -5
grep -rn "from.*@/components/ui/drawer" frontend-next --include="*.tsx" 2>/dev/null | head -5
echo "(empty = good)"

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║           AUDIT COMPLETE                                         ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
```

---

## Red Flags to Watch For

### Constants & Logic
- Same constant defined in multiple files
- Same validation logic in frontend AND backend (pick one)
- Config in both `.env` and `config/*.yml`
- Two services doing the same transformation
- Duplicate route definitions
- Same helper method in multiple places

### UI Patterns (NEW)
- Fullscreen toggle implemented outside TeeemTableView
- Loading spinners using Lucide icons instead of Spinner
- Back navigation using router.back() instead of BackButton
- Custom escape key handlers (should be in component)
- Modal patterns not using Dialog/Sheet
- Table implementations not using TeeemTableView

---

## Example SSoT Violation Report

```
SSoT VIOLATION FOUND

I found fullscreen toggle implemented in 3 places:

1. frontend-next/app/(app)/admin/system/components/ScheduleMasterTab.tsx:328
   const [dataViewFullscreen, setDataViewFullscreen] = useState(false);

2. frontend-next/components/corporate/CorporateStructureTab.tsx:156
   const [isFullscreen, setIsFullscreen] = useState(false);

3. TeeemTableView.tsx - HAS enableFullscreen PROP (THE SSOT)

RECOMMENDATION:
- Use TeeemTableView's enableFullscreen prop
- Remove duplicate implementations
- Tables should not implement their own fullscreen

Want me to consolidate?
```

---

## Common SSoT Locations in TEEEM

| Thing | SSoT Location |
|-------|---------------|
| Column types | `TEEEM_DOCS/GOLD_STANDARD_TABLE.md` |
| UI components | `frontend-next/lib/component-registry.ts` |
| API format | Backend controllers |
| Validation rules | Backend models |
| Timezone | `CompanySetting` |
| Loading indicator | `Spinner` from `@/components/ui/spinner` |
| Back navigation | `BackButton` from `@/components/ui/back-button` |
| Searchable select | `ComboboxDropdown` from `@/components/ui/combobox-dropdown` |
| Data tables | `TeeemTableView` from `@/components/table/TeeemTableView` |
| Side panels | `Sheet` from `@/components/ui/sheet` |
| Modals | `Dialog` from `@/components/ui/dialog` |
| Table fullscreen | `TeeemTableView` with `enableFullscreen` prop |
