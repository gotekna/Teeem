# TEEEM Standard UI Components (SSoT)

> **Quick Reference in CLAUDE.md** - This document provides detailed usage examples.
> For the quick lookup table, see `.claude/CLAUDE.md` section "Standard UI Components".

---

## Component Decisions

| Category | THE ONE | Deprecated | Migration |
|----------|---------|------------|-----------|
| Data Table | `TeeemTableView` | `data-table.tsx` | Replace on touch |
| Simple Dropdown | `Select` | - | - |
| Searchable Select | `ComboboxDropdown` | `combobox.tsx` | Replace on touch |
| Multi-Select | `MultiSelectCombobox` | `multiple-selector.tsx` | Replace on touch |
| Loading | `Spinner` | `loader.tsx` | Replace on touch |
| Side Panel | `Sheet` | `drawer.tsx` | Replace on touch |
| Modal | `Dialog` | - | - |
| Collapsible | `Accordion` | `collapsible.tsx` | Replace on touch |
| Tooltip | `Tooltip` | - | - |
| Small Overlay | `Popover` | - | - |

---

## 1. TeeemTableView (Data Tables)

**Location:** `components/table/TeeemTableView.tsx`

**When to use:** ANY data table in the app. No exceptions.

```tsx
import TeeemTableView from "@/components/table/TeeemTableView";

<TeeemTableView
  tableId={1}
  title="Contacts"
  description="All contacts"
  showSearch={true}
  showFilters={true}
  showColumnToggle={true}
  onRowClick={(row) => router.push(`/contacts/${row.id}`)}
/>
```

**Features:**
- Server-side pagination, sorting, filtering
- Column visibility toggle
- Export to CSV
- Inline editing
- Custom cell renderers
- Foundation view support

---

## 2. Select (Simple Dropdown)

**Location:** `components/ui/select.tsx`

**When to use:** Simple dropdown with static options, no search needed.

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

<Select value={status} onValueChange={setStatus}>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select status" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="active">Active</SelectItem>
    <SelectItem value="inactive">Inactive</SelectItem>
    <SelectItem value="pending">Pending</SelectItem>
  </SelectContent>
</Select>
```

---

## 3. ComboboxDropdown (Searchable Select)

**Location:** `components/ui/combobox-dropdown.tsx`

**When to use:** Dropdown with search/filter capability, single selection.

```tsx
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";

const options = [
  { value: "aus", label: "Australia" },
  { value: "nz", label: "New Zealand" },
  { value: "uk", label: "United Kingdom" },
];

<ComboboxDropdown
  options={options}
  value={country}
  onValueChange={setCountry}
  placeholder="Select country..."
  searchPlaceholder="Search countries..."
  searchInTrigger={true}  // Shows search in trigger button
  emptyText="No countries found"
/>
```

**Props:**
- `searchInTrigger={true}` - Search box appears in trigger (recommended)
- `searchInTrigger={false}` - Search box in dropdown content

---

## 4. MultiSelectCombobox (Multi-Select)

**Location:** `components/ui/multi-select-combobox.tsx`

**When to use:** Select multiple items from a list.

```tsx
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";

const roles = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "user", label: "User" },
];

<MultiSelectCombobox
  options={roles}
  selected={selectedRoles}
  onChange={setSelectedRoles}
  placeholder="Select roles..."
/>
```

---

## 5. Spinner (Loading)

**Location:** `components/ui/spinner.tsx`

**When to use:** Loading states, async operations.

```tsx
import { Spinner } from "@/components/ui/spinner";

// Default size
<Spinner />

// With size
<Spinner className="h-8 w-8" />

// In a loading state
{loading ? (
  <div className="flex items-center justify-center py-8">
    <Spinner />
  </div>
) : (
  <Content />
)}
```

---

## 6. Sheet (Side Panel)

**Location:** `components/ui/sheet.tsx`

**When to use:** Side panel overlays, detail views, forms.

```tsx
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

<Sheet open={open} onOpenChange={setOpen}>
  <SheetTrigger asChild>
    <Button>Open Panel</Button>
  </SheetTrigger>
  <SheetContent side="right" className="w-[400px] sm:w-[540px]">
    <SheetHeader>
      <SheetTitle>Edit Contact</SheetTitle>
      <SheetDescription>
        Make changes to the contact details.
      </SheetDescription>
    </SheetHeader>
    <div className="py-4">
      {/* Form content */}
    </div>
  </SheetContent>
</Sheet>
```

**Props:**
- `side="right"` | `"left"` | `"top"` | `"bottom"`

---

## 7. Dialog (Modal)

**Location:** `components/ui/dialog.tsx`

**When to use:** Modal dialogs, confirmations, focused tasks.

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger asChild>
    <Button>Delete</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Are you sure?</DialogTitle>
      <DialogDescription>
        This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={handleDelete}>
        Delete
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 8. Accordion (Collapsible)

**Location:** `components/ui/accordion.tsx`

**When to use:** Collapsible content sections.

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

<Accordion type="single" collapsible>
  <AccordionItem value="item-1">
    <AccordionTrigger>Section 1</AccordionTrigger>
    <AccordionContent>
      Content for section 1
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>Section 2</AccordionTrigger>
    <AccordionContent>
      Content for section 2
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

**Props:**
- `type="single"` - Only one open at a time
- `type="multiple"` - Multiple can be open
- `collapsible` - Allows closing all

---

## 9. Tooltip

**Location:** `components/ui/tooltip.tsx`

**When to use:** Hover hints, icon explanations.

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon">
        <HelpCircle className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>This is helpful information</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## 10. Popover (Small Overlay)

**Location:** `components/ui/popover.tsx`

**When to use:** Small overlays with interactive content.

```tsx
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">Open</Button>
  </PopoverTrigger>
  <PopoverContent className="w-80">
    <div className="space-y-2">
      <h4 className="font-medium">Settings</h4>
      <p className="text-sm text-muted-foreground">
        Configure your preferences.
      </p>
    </div>
  </PopoverContent>
</Popover>
```

---

## Migration Policy

**"Fix it when you touch it"**

When editing a file that uses a deprecated component:

1. Update the import to THE ONE
2. Adjust props if needed (usually minimal)
3. Test the functionality
4. Commit with message: `refactor: Migrate [old] to [new] in [file]`

---

## Deprecated Components (DO NOT USE)

| Component | Reason | Replace With |
|-----------|--------|--------------|
| `data-table.tsx` | Use TeeemTableView for consistency | `TeeemTableView` |
| `combobox.tsx` | Less features than dropdown variant | `ComboboxDropdown` |
| `multiple-selector.tsx` | Overcomplicated, 624 lines | `MultiSelectCombobox` |
| `loader.tsx` | Spinner is simpler and sufficient | `Spinner` |
| `drawer.tsx` | Sheet is the standard | `Sheet` |
| `collapsible.tsx` | Accordion is more featured | `Accordion` |

---

## Design Tokens

Always use Tailwind config values, not hardcoded colors:

```tsx
// GOOD
className="text-indigo-600 dark:text-indigo-400"
className="bg-background text-foreground"

// BAD
className="text-[#4F46E5]"
style={{ color: '#4F46E5' }}
```

---

*Last updated: 2025-12-13*
