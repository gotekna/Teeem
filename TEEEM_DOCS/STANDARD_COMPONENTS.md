# Standard UI Components - Single Source of Truth

**Authority:** CLAUDE.md points here as THE reference for all UI component usage.

**Purpose:** When building any UI, check THIS file first to use THE ONE component for each use case.

**Migration Policy:** "Fix it when you touch it" - When editing code with deprecated components, update imports to THE ONE.

---

## Quick Reference - THE ONE for Each Use Case

| Need | THE ONE | When | Never Use |
|------|---------|------|-----------|
| Data Table | `TeeemTableView` | Any data table | `data-table.tsx` |
| Simple Dropdown | `Select` | **< 5 options** | - |
| Searchable Select | `ComboboxDropdown` + `searchInTrigger` | **5+ options** | `combobox.tsx` |
| Multi-Select | `MultiSelectCombobox` | Multiple selections | `multiple-selector.tsx` |
| Loading Spinner | `Spinner` | Any loading state | `loader.tsx` |
| Side Panel | `Sheet` | Detail/edit panels | `drawer.tsx` |
| Modal Dialog | `Dialog` | Confirmations, small forms | - |
| Collapsible | `Accordion` | Expandable sections | `collapsible.tsx` |
| Tooltip | `Tooltip` | Hover hints | - |
| Small Overlay | `Popover` | Rich tooltips, pickers | - |

---

## 1. Selection Components

### 1.1 Select (Simple Dropdown)

**File:** `frontend-next/components/ui/select.tsx`

**Use When:**
- **< 5 options** (Yes/No, Active/Inactive, small fixed lists)
- No search needed
- Simple value selection

**Example:**
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

<Select value={status} onValueChange={setStatus}>
  <SelectTrigger>
    <SelectValue placeholder="Select status" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="active">Active</SelectItem>
    <SelectItem value="pending">Pending</SelectItem>
    <SelectItem value="complete">Complete</SelectItem>
  </SelectContent>
</Select>
```

### 1.2 ComboboxDropdown (Searchable Select) - THE ONE

**File:** `frontend-next/components/ui/combobox-dropdown.tsx`

**Use When:**
- **5+ options** (job types, statuses, suppliers, contacts, etc.)
- User needs to find options quickly
- Single selection from medium/large list

**ALWAYS use `searchInTrigger` mode** - makes the field itself searchable (no separate search box).

**Example:**
```tsx
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown"

<ComboboxDropdown
  items={jobTypes.map(t => ({ id: t.id.toString(), label: t.name }))}
  selectedItem={selectedType ? { id: selectedType.id.toString(), label: selectedType.name } : undefined}
  onSelect={(item) => setSelectedTypeId(parseInt(item.id))}
  placeholder="Search job types..."
  searchInTrigger
/>
```

**Props:**
- `items`: Array of `{ id: string, label: string }`
- `selectedItem`: Current selection (same shape as items)
- `onSelect`: Called with selected item
- `placeholder`: Shown when no selection / as search hint
- `searchInTrigger`: **REQUIRED** - makes field itself searchable

**Deprecated:** `combobox.tsx` - Use `combobox-dropdown.tsx` instead

### 1.3 MultiSelectCombobox (Multi-Select) - THE ONE

**File:** `frontend-next/components/ui/multi-select-combobox.tsx` (192 lines)

**Use When:**
- Multiple values can be selected
- Tags/chips display for selections
- Search within options

**Example:**
```tsx
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"

<MultiSelectCombobox
  options={[{ value: "1", label: "Item 1" }, { value: "2", label: "Item 2" }]}
  selected={selectedValues}
  onChange={setSelectedValues}
  placeholder="Select items..."
/>
```

**Deprecated:** `multiple-selector.tsx` - Overly complex for most use cases

---

## 2. Data Display Components

### 2.1 TeeemTableView - THE ONE Data Table

**File:** `frontend-next/components/table/TeeemTableView.tsx` (3000+ lines)

**Use When:**
- ANY data table display
- Editable cells needed
- Sorting, filtering, pagination
- Column customization

**Features:**
- All 31 column types supported
- Inline editing
- Row selection
- Column resizing
- Custom cell renderers
- Export functionality

**Example:**
```tsx
import TeeemTableView from "@/components/table/TeeemTableView"

<TeeemTableView
  tableId={123}
  tableName="suppliers"
  onRowClick={(row) => router.push(`/suppliers/${row.id}`)}
/>
```

**Deprecated:** `data-table.tsx` - Use `TeeemTableView` instead

---

## 3. Feedback Components

### 3.1 Spinner - THE ONE Loading Indicator

**File:** `frontend-next/components/ui/spinner.tsx` (36 lines)

**Use When:**
- Loading states
- Async operations
- Button loading states

**Example:**
```tsx
import { Spinner } from "@/components/ui/spinner"

{isLoading ? <Spinner size="sm" /> : "Save"}
```

**Deprecated:** `loader.tsx` - Use `spinner.tsx` instead

### 3.2 Button

**File:** `frontend-next/components/ui/button.tsx`

**Variants:**
- `default` - Primary action
- `destructive` - Delete/danger actions
- `outline` - Secondary actions
- `secondary` - Tertiary actions
- `ghost` - Minimal visual weight
- `link` - Link-style button

**Example:**
```tsx
import { Button } from "@/components/ui/button"

<Button variant="default">Save</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
```

### 3.3 Badge / Pill

**Files:**
- `frontend-next/components/ui/badge.tsx`
- `frontend-next/components/ui/pill.tsx`

**Use Badge When:** Status indicators, counts, labels
**Use Pill When:** Removable tags, filter chips

### 3.4 Toast

**File:** `frontend-next/components/ui/toast.tsx` + `use-toast.ts`

**Use When:**
- Success/error notifications
- Non-blocking feedback
- Auto-dismiss messages

**Example:**
```tsx
import { useToast } from "@/components/ui/use-toast"

const { toast } = useToast()
toast({ title: "Success", description: "Record saved" })
```

### 3.5 Alert

**File:** `frontend-next/components/ui/alert.tsx`

**Use When:**
- Inline messages
- Persistent warnings
- Information blocks

### 3.6 Progress

**File:** `frontend-next/components/ui/progress.tsx`

**Use When:**
- Upload progress
- Multi-step processes
- Loading with percentage

### 3.7 Skeleton

**File:** `frontend-next/components/ui/skeleton.tsx`

**Use When:**
- Content loading placeholders
- Prevents layout shift
- Better UX than spinners for content areas

---

## 4. Overlay Components

### 4.1 Dialog - THE ONE Modal

**File:** `frontend-next/components/ui/dialog.tsx`

**Use When:**
- Confirmation prompts
- Small forms
- Important decisions
- Blocking interactions

**Example:**
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Delete</DialogTitle>
    </DialogHeader>
    <p>Are you sure you want to delete this item?</p>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button variant="destructive" onClick={handleDelete}>Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 4.2 Sheet - THE ONE Side Panel

**File:** `frontend-next/components/ui/sheet.tsx`

**Use When:**
- Detail views
- Edit forms
- Navigation panels
- Filters panel

**Example:**
```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="right" className="w-[400px]">
    <SheetHeader>
      <SheetTitle>Edit Supplier</SheetTitle>
    </SheetHeader>
    {/* Form content */}
  </SheetContent>
</Sheet>
```

**Deprecated:** `drawer.tsx` - Use `sheet.tsx` instead

### 4.3 Popover - Small Overlay

**File:** `frontend-next/components/ui/popover.tsx`

**Use When:**
- Rich tooltips
- Small forms (date picker, color picker)
- Contextual menus

### 4.4 Tooltip - Hover Hints

**File:** `frontend-next/components/ui/tooltip.tsx`

**Use When:**
- Icon explanations
- Truncated text preview
- Keyboard shortcut hints

**Example:**
```tsx
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon"><InfoIcon /></Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>More information here</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## 5. Collapse Components

### 5.1 Accordion - THE ONE Collapsible

**File:** `frontend-next/components/ui/accordion.tsx`

**Use When:**
- Multiple collapsible sections
- FAQ patterns
- Settings groups
- Single or multiple open sections

**Example:**
```tsx
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

<Accordion type="single" collapsible>
  <AccordionItem value="section-1">
    <AccordionTrigger>Section 1</AccordionTrigger>
    <AccordionContent>Content here...</AccordionContent>
  </AccordionItem>
</Accordion>
```

**Deprecated:** `collapsible.tsx` - Use `accordion.tsx` instead

---

## 6. Form Components

### 6.1 Input

**File:** `frontend-next/components/ui/input.tsx`

**Use When:** Single-line text input

### 6.2 Textarea

**File:** `frontend-next/components/ui/textarea.tsx`

**Use When:** Multi-line text input

### 6.3 Checkbox

**File:** `frontend-next/components/ui/checkbox.tsx`

**Use When:** Boolean toggles, multiple selections from list

### 6.4 Switch

**File:** `frontend-next/components/ui/switch.tsx`

**Use When:** On/off toggles with immediate effect

### 6.5 Radio Group

**File:** `frontend-next/components/ui/radio-group.tsx`

**Use When:** Single selection from visible options

### 6.6 Currency Input

**File:** `frontend-next/components/ui/currency-input.tsx`

**Use When:** Dollar amount entry with formatting

### 6.7 Quantity Input

**File:** `frontend-next/components/ui/quantity-input.tsx`

**Use When:** Numeric input with +/- buttons

### 6.8 Date Picker / Date Range Picker

**Files:**
- `frontend-next/components/ui/calendar.tsx`
- `frontend-next/components/ui/date-range-picker.tsx`

**Use When:** Date selection, date range filtering

---

## 7. Navigation Components

### 7.1 Tabs

**File:** `frontend-next/components/ui/tabs.tsx`

**Use When:** Content sections on same page

### 7.2 Dropdown Menu

**File:** `frontend-next/components/ui/dropdown-menu.tsx`

**Use When:** Action menus, options menus

### 7.3 Context Menu

**File:** `frontend-next/components/ui/context-menu.tsx`

**Use When:** Right-click menus

### 7.4 Navigation Menu

**File:** `frontend-next/components/ui/navigation-menu.tsx`

**Use When:** Main app navigation

### 7.5 Sidebar

**File:** `frontend-next/components/ui/sidebar.tsx`

**Use When:** App-level navigation panel

---

## 8. Domain-Specific Components

These are TEEEM-specific components for business features:

| Component | File | Use When |
|-----------|------|----------|
| Gantt Chart | `components/gantt/gantt-chart.tsx` | Project scheduling |
| Invoice | `components/documents/invoice.tsx` | Invoice display |
| Purchase Order | `components/documents/purchase-order.tsx` | PO display |
| PDF Viewer | `components/ui/pdf-viewer.tsx` | Document preview |
| SharePoint Browser | `components/sharepoint/sharepoint-folder-browser.tsx` | File management |

---

## Deprecated Components Summary

**DO NOT USE these components. Use THE ONE instead:**

| Deprecated | Replace With | Reason |
|------------|--------------|--------|
| `combobox.tsx` | `combobox-dropdown.tsx` | Older, less features |
| `multiple-selector.tsx` | `multi-select-combobox.tsx` | Overly complex for most cases |
| `loader.tsx` | `spinner.tsx` | Redundant |
| `data-table.tsx` | `TeeemTableView` | Not TEEEM integrated |
| `drawer.tsx` | `sheet.tsx` | Redundant functionality |
| `collapsible.tsx` | `accordion.tsx` | Less features, deprecated |

---

## Migration Checklist

When updating a file with deprecated components:

1. [ ] Find all imports of deprecated component
2. [ ] Replace import with THE ONE
3. [ ] Update component usage to match new API
4. [ ] Test functionality
5. [ ] Remove unused imports

**Example Migration:**
```tsx
// Before
import { Combobox } from "@/components/ui/combobox"

// After
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown"
```

---

## Adding New Components

Before adding any new UI component:

1. Check if THE ONE already exists for this use case
2. If not, add to this document FIRST
3. Get approval before implementing
4. Update CLAUDE.md quick reference if it's a major component

---

**Last Updated:** 2025-12-13
