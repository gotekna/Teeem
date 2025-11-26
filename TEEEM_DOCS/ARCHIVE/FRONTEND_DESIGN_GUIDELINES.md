# Frontend Design Guidelines

**⚠️ DEPRECATED - Archived 2025-11-16**

**This document has been superseded by:**
- **[TEEEM_BIBLE.md Chapter 19](../TEEEM_BIBLE.md#chapter-19)** - UI/UX Standards & Patterns (ABSOLUTE authority)
- **[COLOR_SYSTEM.md](../../frontend/COLOR_SYSTEM.md)** - Color implementation reference

**Why Deprecated:**
This file predates the Trinity documentation system. All RULES have been consolidated into Bible Chapter 19 to establish a single source of truth for UI/UX standards.

**Historical Content Below (Reference Only):**

---

## Overview

TEEEM uses a **dual-source template strategy** to balance consistency with flexibility. This document provides comprehensive guidance on when and how to use each template source.

---

## Template Sources

### Primary: Tailwind UI

**Website:** https://tailwindui.com
**License:** Tailwind CSS Pro
**Best For:**
- Core application patterns (tables, forms, modals, navigation)
- Standard CRUD interfaces
- Dashboard layouts
- Settings pages
- Authentication flows
- Component patterns that need to feel "official" and production-ready

**Characteristics:**
- Clean, professional, corporate aesthetic
- Extensive accessibility built-in
- Well-tested across browsers
- Excellent documentation
- React + Headless UI integration
- Consistent with Tailwind's design philosophy

**When to Check First:**
Always check Tailwind UI first when building:
- Data tables and lists
- Form layouts
- Modal dialogs
- Dropdown menus
- Navigation patterns
- Empty states
- Loading states

### Secondary: Subframe

**Website:** https://subframe.com
**Best For:**
- Rapid prototyping
- Complex component compositions
- Components with interesting interactions
- Design explorations
- Components not well-covered by Tailwind UI
- Marketing/landing page elements

**Characteristics:**
- Modern, sometimes more playful aesthetic
- Generated React components
- Uses Tailwind CSS (compatible with our config)
- Can be more opinionated in design choices
- Good for unique, standout interfaces

**When to Use:**
- Tailwind UI doesn't have the component you need
- You need something more visually distinctive
- Prototyping a new feature quickly
- Building customer-facing pages (quote portal, etc.)
- Creating unique data visualizations or dashboards

---

## Decision Framework

### Step 1: Identify the Component Need

Ask yourself:
- Is this a standard CRUD pattern? → **Tailwind UI**
- Is this internal admin UI? → **Tailwind UI**
- Is this customer-facing? → **Consider both**
- Is this a unique interaction? → **Consider both**
- Do I need to move fast? → **Whichever is faster**

### Step 2: Check Tailwind UI First

Before considering Subframe:
1. Search Tailwind UI for the pattern
2. Check if it can be customized to meet your needs
3. If it's 80% there, use it and customize

### Step 3: When Multiple Options Exist

**Agent Workflow:**
```markdown
I see two good approaches for this [component type]:

**Option A: Tailwind UI Approach**
- Uses: [specific Tailwind UI pattern]
- Pros: [list benefits]
- Cons: [list limitations]
- Visual: [description or code snippet]

**Option B: Subframe Approach**
- Uses: [specific Subframe component]
- Pros: [list benefits]
- Cons: [list limitations]
- Visual: [description or code snippet]

Which would you prefer?
```

**User decides** based on:
- Visual preference
- Maintenance complexity
- Time constraints
- Feature requirements

---

## Maintaining Consistency

### Non-Negotiables

**Always use from TEEEM's Tailwind config:**
- Color palette (gray, indigo, red, yellow, green, blue, purple, pink)
- Spacing system (Tailwind's default scale)
- Typography (defined font families and sizes)
- Border radius (rounded-md, rounded-lg, etc.)
- Shadow utilities (shadow-sm, shadow, shadow-lg)

### Acceptable Variations

**It's OK to have differences in:**
- Button styles (Tailwind UI vs Subframe can look different)
- Card patterns (as long as padding/spacing is consistent)
- Animation/transition styles
- Icon usage (Heroicons vs other icon sets)
- Layout patterns

### Unacceptable Variations

**Never vary:**
- Color meanings (green = success, red = error, yellow = warning, etc.)
- Dark mode support (every component MUST support dark mode)
- Responsive breakpoints (use Tailwind's sm, md, lg, xl, 2xl)
- Accessibility patterns (keyboard navigation, ARIA labels, focus states)

---

## Component-Specific Guidelines

### Tables and Data Grids

**Use:** DataTable component (see TABLE STANDARDS in CLAUDE.md)
- Don't use Tailwind UI tables directly
- Don't use Subframe tables
- Use our standardized DataTable for consistency
- Exception: Inline-editing grids (use TablePage.jsx pattern)

### Forms

**Prefer:** Tailwind UI form patterns
- Form layouts
- Input fields
- Select dropdowns
- Radio/checkbox groups
- Validation states

**Consider Subframe for:**
- Multi-step wizards
- Complex conditional forms
- Forms with rich interactions

### Modals and Dialogs

**Prefer:** Tailwind UI + Headless UI
- Standard modal patterns
- Confirmation dialogs
- Slide-overs

**Consider Subframe for:**
- Full-screen takeovers
- Complex wizards in modals
- Animated transitions

### Buttons

**Both are acceptable:**
- Tailwind UI: Classic, professional buttons
- Subframe: Can be more modern/playful

**Rule:** Pick one style per feature area and stick with it within that context.

### Navigation

**Prefer:** Tailwind UI
- Sidebars
- Top navigation
- Breadcrumbs
- Tabs

**Why:** Navigation should feel stable and familiar, not experimental.

### Badges and Pills

**Always use:** Our standardized badge pattern (see CLAUDE.md)
```jsx
<span className="inline-flex items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-400/10 dark:text-green-400">
  Active
</span>
```

Don't deviate from this pattern, regardless of source.

### Cards

**Both are acceptable:**
- Tailwind UI: Clean, minimal borders
- Subframe: Can be more styled

**Rule:** Use consistent card pattern within a single page/feature.

### Empty States

**Prefer:** Tailwind UI patterns
- Standard illustrations
- Clear messaging
- Action buttons

**Consider Subframe for:**
- Marketing/onboarding empty states
- Customer-facing empty states

---

## Code Quality Standards

### All Components Must Have

1. **Dark Mode Support**
   ```jsx
   // Good
   className="bg-white dark:bg-gray-800"

   // Bad
   className="bg-white"
   ```

2. **Responsive Design**
   ```jsx
   // Good
   className="text-sm md:text-base"

   // Bad - hardcoded for desktop
   className="text-base"
   ```

3. **Accessibility**
   ```jsx
   // Good
   <button aria-label="Close modal">
     <XMarkIcon className="h-5 w-5" />
   </button>

   // Bad
   <button>
     <XMarkIcon className="h-5 w-5" />
   </button>
   ```

4. **Proper TypeScript (if used)**
   - Type props interfaces
   - Use generic types where appropriate

5. **Clean Component Structure**
   ```jsx
   // Good - props destructured, clear return
   export default function MyComponent({ title, description, onAction }) {
     return (
       <div className="...">
         {/* component content */}
       </div>
     )
   }

   // Bad - unclear props, messy structure
   export default function MyComponent(props) {
     // lots of logic here
     return <div>...</div>
   }
   ```

### Integration with Tailwind Config

Both Tailwind UI and Subframe components should reference our config:

**tailwind.config.js location:** `/Users/jakebaird/teeem/frontend/tailwind.config.js`

**Our customizations:**
- Extended color palette
- Custom font families
- Extended spacing (if any)
- Custom animations (if any)

**Always:**
- Use color names from config, not hex values
- Use spacing utilities, not arbitrary values
- Use configured breakpoints, not custom ones

---

## Real-World Examples

### Example 1: Building a New Job Creation Modal

**Analysis:**
- Standard form with multiple steps
- Internal admin interface
- Needs to be reliable and familiar

**Decision:** Use Tailwind UI multi-step form pattern
**Rationale:** This is core CRUD functionality that benefits from Tailwind UI's proven patterns.

### Example 2: Customer Quote Portal

**Analysis:**
- Customer-facing
- Needs to feel modern and trustworthy
- Has unique interactions (accept quote, request callback)

**Decision:** Present both options
- Tailwind UI: Professional, corporate feel
- Subframe: More modern, friendly feel

**User picks based on brand positioning.**

### Example 3: Price Book Import Modal

**Analysis:**
- Admin interface
- Standard file upload pattern
- Already exists in app

**Decision:** Use Tailwind UI pattern (already implemented)
**Rationale:** Consistency with existing modals, no need to change.

### Example 4: Master Schedule Gantt Chart

**Analysis:**
- Highly specialized component
- Uses dhtmlxGantt library
- Neither source provides this

**Decision:** Custom implementation
**Rationale:** Some components are too specialized for template libraries.

---

## Migration and Refactoring

### When to Refactor Existing Components

**Consider refactoring IF:**
- Component doesn't follow dark mode standards
- Component isn't responsive
- Component has accessibility issues
- Component violates our design system (colors, spacing)
- Component is hard to maintain

**Don't refactor IF:**
- Component works well and meets standards
- Refactoring would break existing functionality
- Component is highly specialized (Gantt chart, inline-editing grid)

### Migration Process

1. **Audit current component** against standards
2. **Check if DataTable can replace it** (for tables)
3. **Find equivalent in Tailwind UI or Subframe**
4. **Compare:**
   - Current vs proposed implementation
   - Functionality coverage
   - Accessibility
   - Maintenance burden
5. **Propose migration** to user with comparison
6. **Get approval before refactoring**

---

## Anti-Patterns to Avoid

### ❌ Don't Mix Styles Within Same Component

```jsx
// Bad - mixing Tailwind UI modal with Subframe buttons
<TailwindUIModal>
  <SubframeButton />
</TailwindUIModal>
```

### ❌ Don't Override Source Styles Excessively

```jsx
// Bad - if you need this many overrides, pick different source
<SubframeCard className="!bg-white !p-4 !rounded-lg !border-gray-200">
```

### ❌ Don't Ignore Dark Mode

```jsx
// Bad - only works in light mode
<div className="bg-white text-gray-900">
```

### ❌ Don't Use Arbitrary Values When Config Has It

```jsx
// Bad
className="text-[#4F46E5]"

// Good - uses indigo-600 from config
className="text-indigo-600"
```

### ❌ Don't Copy-Paste Without Understanding

- Understand what the component does
- Understand the styling approach
- Adapt to TEEEM's patterns, don't blindly copy

---

## Testing New Components

### Checklist for All Components

- [ ] Works in light mode
- [ ] Works in dark mode
- [ ] Responsive on mobile (test at 375px width)
- [ ] Responsive on tablet (test at 768px width)
- [ ] Responsive on desktop (test at 1280px+ width)
- [ ] Keyboard accessible (tab through all interactive elements)
- [ ] Screen reader friendly (test with VoiceOver/NVDA)
- [ ] All interactive elements have focus states
- [ ] All icons have proper aria-labels or are decorative
- [ ] Colors meet WCAG contrast requirements
- [ ] Loading states handled gracefully
- [ ] Error states handled gracefully
- [ ] Empty states handled gracefully

### Browser Testing

Test in:
- Chrome (primary)
- Safari (macOS/iOS)
- Firefox
- Edge

---

## Quick Reference

### "Which source should I use?"

| Component Type | First Choice | Second Choice |
|---------------|--------------|---------------|
| Data Table | DataTable component | Neither |
| Form | Tailwind UI | Subframe |
| Modal | Tailwind UI | Subframe |
| Button | Either | - |
| Navigation | Tailwind UI | - |
| Card | Either | - |
| Badge/Pill | Custom standard | Neither |
| Empty State | Tailwind UI | Subframe |
| Loading State | Tailwind UI | Subframe |
| Dashboard | Tailwind UI | Subframe |
| Customer Portal | Both (decide) | - |

### "When should the agent show me both options?"

- New feature with no established pattern
- Customer-facing components
- Components where aesthetics matter significantly
- Complex interactions with multiple valid approaches
- When you specifically ask for options

### "When should the agent just pick one?"

- Standard CRUD operations
- Internal admin interfaces
- Patterns already established in codebase
- Minor variations of existing components
- When speed is critical and pattern is obvious

---

## Questions?

When in doubt:
1. Check Tailwind UI first
2. If not there or not quite right, consider Subframe
3. Present both options if unclear
4. Let user decide
5. Document the decision for future consistency

Remember: **Consistency within a feature area matters more than perfect uniformity across the entire app.**

The goal is to build fast while maintaining quality, not to achieve perfect design system purity.
