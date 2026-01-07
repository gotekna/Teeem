# Add UI Debugging Visualization

Add visual debugging markup to UI components to help identify layout issues.

## What This Command Does

Adds color-coded borders, backgrounds, and numbered labels to UI sections to make layout structure visible:

1. **BLUE** - Main container/card
2. **GREEN** - Flex/grid containers
3. **PURPLE** - Left/primary content areas
4. **ORANGE** - Absolutely positioned elements (sidebars, overlays)
5. **YELLOW/RED** - Sections that should NOT be overlapped

## Instructions

When the user runs `/ui`, you should:

1. Ask which file they want to debug (or detect from context)
2. Add visual debugging to the component:
   - Numbered labels `[1]`, `[2]`, `[3]`, etc.
   - Color-coded borders (2px or 4px)
   - Background colors with transparency
   - Labels describing positioning (e.g., "absolute right-0", "pr-[25rem]")

### Example Pattern

```tsx
{/* [1] Main Container */}
<Card className="border-blue-500 border-2">
  <CardHeader className="bg-blue-100 dark:bg-blue-900/20">
    <CardTitle className="text-blue-600">[1] Main Container (BLUE)</CardTitle>
  </CardHeader>
  <CardContent>
    {/* [2] Flex Container */}
    <div className="flex gap-6 border-2 border-green-500 bg-green-50 dark:bg-green-900/10 p-2">
      <div className="absolute top-0 left-0 bg-green-600 text-white px-2 py-1 text-xs font-bold">
        [2] FLEX CONTAINER (GREEN)
      </div>

      {/* [3] Left Content */}
      <div className="flex-1 border-2 border-purple-500 bg-purple-50 dark:bg-purple-900/10 p-2">
        <div className="bg-purple-600 text-white px-2 py-1 text-xs font-bold inline-block">
          [3] LEFT SIDE (PURPLE)
        </div>
        {/* content */}
      </div>

      {/* [4] Absolutely Positioned Element */}
      <div className="absolute right-0 top-0 border-4 border-orange-500">
        <div className="bg-orange-600 text-white px-2 py-1 text-xs font-bold">
          [4] SIDEBAR (ORANGE) - absolute right-0
        </div>
        <div className="bg-orange-100 dark:bg-orange-950/50">
          {/* sidebar content */}
        </div>
      </div>
    </div>

    {/* [5] Section That Shouldn't Be Overlapped */}
    <div className="border-t border-red-500 bg-yellow-100 dark:bg-yellow-900/20">
      <div className="bg-red-600 text-white px-2 py-1 text-xs font-bold inline-block mb-2">
        [5] CONTENT (YELLOW/RED) - Should NOT be overlapped
      </div>
      {/* content */}
    </div>
  </CardContent>
</Card>
```

## Color Code Guide

- **BLUE** (`border-blue-500`, `bg-blue-100`) - Main containers, top-level cards
- **GREEN** (`border-green-500`, `bg-green-50`) - Flex/grid containers, layout wrappers
- **PURPLE** (`border-purple-500`, `bg-purple-50`) - Primary content areas with padding
- **ORANGE** (`border-orange-500`, `bg-orange-100`) - Absolutely positioned elements
- **YELLOW/RED** (`border-red-500`, `bg-yellow-100`) - Problem areas or areas to protect from overlap

## Label Format

Each section should have:
1. A number in square brackets: `[1]`, `[2]`, etc.
2. A descriptive name: "Main Container", "Flex Container", "Sidebar"
3. The color in parentheses: "(BLUE)", "(GREEN)", "(ORANGE)"
4. Optional: CSS classes being debugged: "absolute right-0", "pr-[25rem]"

Example: `[4] SIDEBAR (ORANGE) - absolute right-0 top-0`

## When to Use

- Layout overlap issues
- Absolute positioning problems
- Flex/grid alignment debugging
- Identifying which element is causing visual issues
- Understanding component structure

## After Debugging

Once the issue is identified and fixed, remove all debugging markup before committing.
