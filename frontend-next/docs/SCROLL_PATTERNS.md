# Scroll Patterns Guide

Standard scroll patterns for frontend-next. Use these utility classes for consistent behavior.

## Quick Reference

| Pattern | Class | Use When |
|---------|-------|----------|
| Page content | `.scroll-page` | Full-page scrollable areas |
| Data tables | `.scroll-table` | Tables with many columns/rows |
| Modal body | `.scroll-modal` | Dialog content that may overflow |
| Horizontal | `.scroll-horizontal` | Tab lists, pipelines, carousels |

## Decision Tree

1. Is it page-level content? → `.scroll-page`
2. Is it a data table? → `.scroll-table`
3. Is it in a modal/dialog? → `.scroll-modal`
4. Is it horizontal-only? → `.scroll-horizontal`
5. Is it a fixed-height list? → `max-h-[Xpx] overflow-y-auto` or `<ScrollArea>`

## Pattern Details

### Page Content (.scroll-page)

For full-page scrollable areas within the app layout:

```tsx
<div className="scroll-page">
  <Header />
  <Content />
</div>
```

### Data Tables (.scroll-table)

For tables that need both horizontal and vertical scrolling:

```tsx
<div className="scroll-table">
  <table style={{ minWidth: `${totalWidth}px` }}>...</table>
</div>
```

### Modal with Header/Footer

For dialogs with fixed header/footer and scrollable body:

```tsx
<DialogContent className="max-h-[85vh] flex flex-col overflow-hidden">
  <DialogHeader className="flex-shrink-0" />
  <div className="scroll-modal p-6">
    {/* Scrollable content */}
  </div>
  <DialogFooter className="flex-shrink-0" />
</DialogContent>
```

### Fixed-Height Lists

For bounded-height containers like sidebars or dropdown lists:

```tsx
// Option A: ScrollArea (Radix) - for complex interactions
<ScrollArea className="h-[400px]">
  {items.map(...)}
</ScrollArea>

// Option B: Raw Tailwind - simpler, less wrapper
<div className="max-h-64 overflow-y-auto">
  {items.map(...)}
</div>
```

### Horizontal Scroll (.scroll-horizontal)

For tab lists, pipelines, or carousels (hides scrollbar):

```tsx
<div className="scroll-horizontal">
  <div className="flex gap-4 min-w-max">{items.map(...)}</div>
</div>
```

## When to Use ScrollArea vs Raw Overflow

| Use ScrollArea | Use Raw overflow |
|----------------|-----------------|
| Need custom scrollbar beyond global CSS | Simple lists |
| Complex scroll interactions | Performance-sensitive areas |
| Matching existing Radix patterns | Quick prototyping |

## Common Mistakes

| Mistake | Problem | Fix |
|---------|---------|-----|
| `overflow-hidden overflow-y-auto` | Contradictory - hidden wins | Remove `overflow-hidden` |
| `overflow-scroll` | Always shows scrollbar | Use `overflow-auto` instead |
| Missing `min-h-0` on flex child | Content won't scroll | Add `min-h-0` |
| Missing `flex-shrink-0` on headers | Headers scroll away | Add `flex-shrink-0` |

## Parent Requirements

For scroll containers to work, parent must provide height constraint:

```
h-screen or h-full on ancestor
          ↓
  flex flex-col layout
          ↓
flex-1 min-h-0 on scrollable child (or use utility class)
```

## Global Configuration

All scrollbars in the app are styled consistently via `globals.css`:
- Width: 6px (thin)
- Corners: square (0 radius)
- Colors: muted foreground with opacity
- Firefox: thin scrollbar-width

The utility classes (`.scroll-page`, `.scroll-table`, etc.) inherit this styling automatically.
