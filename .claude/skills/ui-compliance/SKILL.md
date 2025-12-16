---
name: ui-compliance
description: Verifies UI code uses correct components, dark mode, and design system. Use when creating or modifying any frontend component, page, or UI element.
---

# UI Compliance Checker

## When Claude Should Use This
- Creating any new React component
- Modifying existing UI
- Adding styles or Tailwind classes
- Building forms, tables, modals, or any user-facing element

## Pre-Flight Checklist

Before writing ANY UI code, verify:

### 1. Component Selection
Check `TEEEM_DOCS/COMPONENTS.md` for THE ONE component:

| Need | Use | Never Use |
|------|-----|-----------|
| Data Table | `TeeemTableView` | `data-table.tsx` |
| Dropdown | `Select` | |
| Searchable | `ComboboxDropdown` | `combobox.tsx` |
| Multi-Select | `MultipleSelector` | |
| Loading | `Spinner` | `loader.tsx` |
| Side Panel | `Sheet` | `drawer.tsx` |
| Modal | `Dialog` | |

### 2. Dark Mode
Every `className` with colors MUST have `dark:` variant:
```tsx
// Correct
className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white"

// Wrong - missing dark mode
className="bg-white text-gray-900"
```

### 3. Tailwind Config Colors
Use config tokens, not hex:
```tsx
// Correct
className="text-indigo-600"

// Wrong
className="text-[#4F46E5]"
```

### 4. Responsive Design
Include breakpoint variants for layout changes:
```tsx
// Correct
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
```

## Post-Flight Verification

After writing UI code, run:
```bash
# Check for banned components
grep -r "data-table\|combobox\|loader\|drawer" frontend-next/app --include="*.tsx" | grep -v node_modules

# Check for missing dark mode (sample)
grep -r "className=" frontend-next/app --include="*.tsx" | grep "bg-\|text-" | grep -v "dark:" | head -5

# Check for hex colors
grep -r "text-\[#\|bg-\[#" frontend-next/app --include="*.tsx" | head -5
```

All three should return empty. If not, fix before committing.

## Accessibility Minimums
- Buttons: `aria-label` if icon-only
- Forms: `<label>` for every input
- Images: `alt` text
- Interactive elements: Keyboard navigable (test with Tab)

## When Uncertain
Read the source of THE ONE component to see patterns:
```bash
head -100 frontend-next/components/table/TeeemTableView.tsx
```
