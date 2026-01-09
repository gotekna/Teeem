# UI Components - Single Source of Truth

**STOP. Before creating ANY component, check this table.**

## THE ONE Component for Each Use Case

| Need | Use This | Location | NEVER Use |
|------|----------|----------|-----------|
| Data Table | `TeeemTableView` | `components/table/TeeemTableView.tsx` | `data-table.tsx` |
| Dropdown | `Select` | `components/ui/select.tsx` | |
| Searchable Select | `ComboboxDropdown` | `components/ui/combobox-dropdown.tsx` | `combobox.tsx` |
| Multi-Select | `MultipleSelector` | `components/ui/multiple-selector.tsx` | `multi-select-combobox.tsx` |
| Loading | `Spinner` | `components/ui/spinner.tsx` | `loader.tsx` |
| Side Panel | `Sheet` | `components/ui/sheet.tsx` | `drawer.tsx` |
| Modal | `Dialog` | `components/ui/dialog.tsx` | |
| Collapsible | `Accordion` | `components/ui/accordion.tsx` | `collapsible.tsx` |
| Tooltip | `Tooltip` | `components/ui/tooltip.tsx` | |
| Small Overlay | `Popover` | `components/ui/popover.tsx` | |

## Table Page Pattern (SSoT)

**ALL pages with tables MUST use this structure:**

```tsx
return (
  <div className="flex flex-col h-full -mx-4">
    <TeeemTableView
      tableName="Page Title"
      foundationId="slug"
      foundationIdNumeric={id}
      entries={records}
      leftActions={<Button>Action</Button>}
      hideFooter={true}
    />
  </div>
);
```

**Rules:**
- NO custom `<h1>` headers - TeeemTableView renders the header
- Action buttons go in `leftActions`
- Edge-to-edge layout with `-mx-4`
- Full height with `h-full` and `flex flex-col`

## Verification

Before committing UI changes:
```bash
# Confirm you used the right component - these should return NOTHING
grep -r "data-table\|combobox\|loader\|drawer\|collapsible" frontend-next/app --include="*.tsx" | grep -v node_modules | head -5
```

If results appear, you used the wrong component. Fix it.

## Dark Mode

ALL components must have `dark:` variants. No exceptions.

Check your work:
```bash
# Find components missing dark mode
grep -r "className=" frontend-next/app --include="*.tsx" | grep -v "dark:" | head -10
```

## Design System References

| Resource | Location | Use For |
|----------|----------|---------|
| Tailwind Config | `frontend-next/tailwind.config.ts` | Colors, spacing, typography |
| Gold Standard Table | `TEEEM_DOCS/GOLD_STANDARD_TABLE.md` | Column types, validation |

## Non-Negotiables

- Dark mode: `dark:` classes on everything
- Responsive: Use `sm:`, `md:`, `lg:`, `xl:`, `2xl:` breakpoints
- Accessibility: ARIA labels, keyboard nav, focus states
- Colors: Use config tokens (`text-indigo-600`), never hex (`text-[#4F46E5]`)

## Migration Policy

"Fix it when you touch it" - When editing a file with deprecated components, update to THE ONE.
