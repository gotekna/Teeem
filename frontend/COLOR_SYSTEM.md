# TEEEM Color System

**Authority:** Implementation Reference (supplements [TEEEM_BIBLE.md Chapter 19](../TEEEM_DOCS/TEEEM_BIBLE.md#chapter-19))

**📖 For RULES:** See [TEEEM_BIBLE.md Chapter 19](../TEEEM_DOCS/TEEEM_BIBLE.md#chapter-19) - UI/UX Standards & Patterns (ABSOLUTE authority)

**This document:** Provides implementation details and code examples for the color standards defined in Bible Chapter 19.

---

This document outlines the standardized color system used throughout the TEEEM frontend application. All color usage should follow these patterns for consistency and vibrant UI/UX.

## Philosophy

- **Vibrant and Fun**: Colors should feel energetic and engaging
- **Consistent**: Same semantic meaning = same color across the entire app
- **Accessible**: High contrast ratios for readability in both light and dark modes
- **Based on Tailwind UI**: Follows the official Tailwind UI badge/pill pattern

## Color Palette

### Standard Colors

All badges, pills, and status indicators use these exact Tailwind classes:

#### Gray (Neutral/Default)
- **Light mode**: `bg-gray-100 text-gray-600`
- **Dark mode**: `bg-gray-400/10 text-gray-400`
- **Use cases**: Draft, pending, default states, disabled

#### Red (Error/Danger/Cancelled)
- **Light mode**: `bg-red-100 text-red-700`
- **Dark mode**: `bg-red-400/10 text-red-400`
- **Use cases**: Errors, dangerous actions, cancelled states, failed operations

#### Yellow (Warning/Pending)
- **Light mode**: `bg-yellow-100 text-yellow-800`
- **Dark mode**: `bg-yellow-400/10 text-yellow-500`
- **Use cases**: Warnings, needs review, pending approval, medium risk

#### Green (Success/Active/Complete)
- **Light mode**: `bg-green-100 text-green-700`
- **Dark mode**: `bg-green-400/10 text-green-400`
- **Use cases**: Success, completed, active, verified, received, paid

#### Blue (Info/Approved)
- **Light mode**: `bg-blue-100 text-blue-700`
- **Dark mode**: `bg-blue-400/10 text-blue-400`
- **Use cases**: Information, approved states, ordered

#### Indigo (Processing/Sent)
- **Light mode**: `bg-indigo-100 text-indigo-700`
- **Dark mode**: `bg-indigo-400/10 text-indigo-400`
- **Use cases**: Sent, processing, in-transit

#### Purple (Special States)
- **Light mode**: `bg-purple-100 text-purple-700`
- **Dark mode**: `bg-purple-400/10 text-purple-400`
- **Use cases**: Invoiced, special designations

#### Pink (Custom/Accent)
- **Light mode**: `bg-pink-100 text-pink-700`
- **Dark mode**: `bg-pink-400/10 text-pink-400`
- **Use cases**: Custom categories, special highlights

## Components

### Badge Component

**Location**: `/Users/jakebaird/teeem/frontend/src/components/Badge.jsx`

The reusable Badge component is the **primary way** to add colored status indicators:

```jsx
import Badge from '../components/Badge'

// Basic usage
<Badge color="green">Success</Badge>

// With dot indicator
<Badge color="red" withDot>Error</Badge>

// All available colors
<Badge color="gray">Draft</Badge>
<Badge color="red">Cancelled</Badge>
<Badge color="yellow">Pending</Badge>
<Badge color="green">Complete</Badge>
<Badge color="blue">Approved</Badge>
<Badge color="indigo">Sent</Badge>
<Badge color="purple">Invoiced</Badge>
<Badge color="pink">Special</Badge>
```

### Alert/Message Banners

For success/error message banners:

**Success**:
```jsx
<div className="rounded-md bg-green-100 dark:bg-green-400/10 p-4">
  <div className="flex">
    <CheckCircleIcon className="h-5 w-5 text-green-700 dark:text-green-400" />
    <p className="text-sm text-green-700 dark:text-green-400">Success message</p>
  </div>
</div>
```

**Error**:
```jsx
<div className="rounded-md bg-red-100 dark:bg-red-400/10 p-4">
  <div className="flex">
    <XCircleIcon className="h-5 w-5 text-red-700 dark:text-red-400" />
    <p className="text-sm text-red-700 dark:text-red-400">Error message</p>
  </div>
</div>
```

**Warning**:
```jsx
<div className="rounded-md bg-yellow-100 dark:bg-yellow-400/10 p-4">
  <div className="flex">
    <ExclamationTriangleIcon className="h-5 w-5 text-yellow-800 dark:text-yellow-500" />
    <p className="text-sm text-yellow-800 dark:text-yellow-500">Warning message</p>
  </div>
</div>
```

### Toast Notifications

Toasts use the same color pattern. See `/Users/jakebaird/teeem/frontend/src/components/Toast.jsx`:

```jsx
<Toast message="Operation successful!" type="success" />
<Toast message="Something went wrong" type="error" />
```

## Specialized Use Cases

### Purchase Order Status

**File**: `/Users/jakebaird/teeem/frontend/src/components/purchase-orders/POStatusBadge.jsx`

- Draft → Gray
- Pending → Yellow
- Approved → Blue
- Sent → Indigo
- Received → Green
- Invoiced → Purple
- Paid → Green
- Cancelled → Red

### Payment Status

**File**: `/Users/jakebaird/teeem/frontend/src/components/purchase-orders/PaymentStatusBadge.jsx`

- Pending → Gray
- Part Payment → Yellow
- Complete → Green
- Manual Review → Red

### Supplier/Contact Verification

- Verified → Green badge with checkmark
- Needs Review → Yellow badge with icon

## Common Patterns

### Icon Containers (Dashboard Cards)

For dashboard stat cards with colored icon containers:

```jsx
<div className="h-12 w-12 bg-green-100 dark:bg-green-400/10 rounded-lg flex items-center justify-center">
  <CheckCircleIcon className="h-6 w-6 text-green-700 dark:text-green-400" />
</div>
```

**Do not use**:
- `amber` colors (use `yellow` instead)
- `emerald` colors (use `green` instead)
- `orange` colors (use `yellow` for warnings)
- Custom opacity values like `/15`, `/20` (use standard `/10` or solid colors)

### Progress Bars

Use solid color shades (500, 600) for progress bars with dark mode variants:

```jsx
className="bg-green-500 dark:bg-green-400"  // Low risk
className="bg-yellow-500 dark:bg-yellow-400"  // Medium risk
className="bg-yellow-600 dark:bg-yellow-500"  // Medium-high risk
className="bg-red-500 dark:bg-red-400"  // High risk
```

## Migration Guide

### Old Pattern (Inconsistent)
```jsx
// DON'T DO THIS
<span className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
  Status
</span>
```

### New Pattern (Standard)
```jsx
// DO THIS INSTEAD
import Badge from '../components/Badge'
<Badge color="yellow">Status</Badge>
```

### Old Alert Pattern
```jsx
// DON'T DO THIS
<div className="bg-green-50 dark:bg-green-900/10">
  <p className="text-green-800 dark:text-green-400">Message</p>
</div>
```

### New Alert Pattern
```jsx
// DO THIS INSTEAD
<div className="bg-green-100 dark:bg-green-400/10">
  <p className="text-green-700 dark:text-green-400">Message</p>
</div>
```

## Files Updated

The following files have been standardized to use the new color system:

### Components
- `/Users/jakebaird/teeem/frontend/src/components/Badge.jsx` - NEW reusable component
- `/Users/jakebaird/teeem/frontend/src/components/Toast.jsx`
- `/Users/jakebaird/teeem/frontend/src/components/imports/ImportProgress.jsx`
- `/Users/jakebaird/teeem/frontend/src/components/purchase-orders/POStatusBadge.jsx`
- `/Users/jakebaird/teeem/frontend/src/components/purchase-orders/PaymentStatusBadge.jsx`
- `/Users/jakebaird/teeem/frontend/src/components/settings/XeroConnection.jsx`
- `/Users/jakebaird/teeem/frontend/src/components/settings/OneDriveConnection.jsx`
- `/Users/jakebaird/teeem/frontend/src/components/documents/JobDocumentsTab.jsx`

### Pages
- `/Users/jakebaird/teeem/frontend/src/pages/ContactsPage.jsx`
- `/Users/jakebaird/teeem/frontend/src/pages/SuppliersPage.jsx`
- `/Users/jakebaird/teeem/frontend/src/pages/SupplierDetailPage.jsx`
- `/Users/jakebaird/teeem/frontend/src/pages/PriceBooksPage.jsx`
- `/Users/jakebaird/teeem/frontend/src/pages/PriceBookItemDetailPage.jsx`

## Best Practices

1. **Always use the Badge component** for status indicators instead of inline classes
2. **Never use amber/emerald/orange** - stick to the standard 8 colors
3. **Always include dark mode variants** - never use colors without dark: prefix
4. **Follow the semantic meaning** - red = danger/error, green = success, yellow = warning
5. **Be consistent** - same status should have same color everywhere
6. **Test in both modes** - verify colors work in light AND dark mode
7. **Use the standard opacity** - `/10` for dark mode backgrounds, solid for text

## Future Work

- Consider adding hover states to badges for interactive elements
- Explore animation/transition effects for status changes
- Create Storybook stories for all color combinations
- Add accessibility contrast ratio tests

---

**Last Updated**: 2025-11-05
**Maintained By**: Frontend Team
