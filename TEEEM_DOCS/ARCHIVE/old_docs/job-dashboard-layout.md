# Job Detail Dashboard Layout

## Visual Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Active Jobs                                                     │
│                                                                             │
│  [Icon]  Beach House Renovation                                            │
│          Construction Job #123                                             │
│                                                                             │
│  [Overview] [Purchase Orders] [Estimates] [Activity] [Budget] ...          │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│  Stats Row (4 cards)                                                       │
├─────────────────────┬─────────────────────┬─────────────────────┬──────────┤
│ Contract Value      │ Live Profit         │ Stage               │ Status   │
│ $250,000            │ $45,000 (+18%)      │ Construction        │ Active   │
└─────────────────────┴─────────────────────┴─────────────────────┴──────────┘

OVERVIEW TAB CONTENT:

┌─────────────────┬──────────────────────────────────────────────────────────┐
│                 │                                                          │
│  PROFIT         │              PROFIT ANALYSIS                             │
│  SUMMARY        │                                                          │
│                 │         ╭─────────╮                                      │
│  Live Profit    │        ╱           ╲                                     │
│  $45,000        │       │   Donut     │                                    │
│  18% margin     │       │   Chart     │                                    │
│  ─────────────  │        ╲           ╱                                     │
│                 │         ╰─────────╯                                      │
│  Cost Savings   │                                                          │
│  $8,000         │   Costs: $200k  |  Profit: $45k  |  Pending: $5k       │
│  ▼ Materials    │                                                          │
│    • Concrete   │                                                          │
│      -$5,000    ├──────────────────────────┬───────────────────────────────┤
│    • Steel      │                          │                               │
│      -$3,000    │  RECENT ACTIVITY         │  WHAT'S COMING UP            │
│  ─────────────  │                          │                               │
│                 │  [Icon] PO #123          │  ┌─────────────────────────┐ │
│  Cost Overruns  │  Concrete Supplier       │  │ [JB] Foundation Pour    │ │
│  $3,500         │  $48,000                 │  │      [Underway]         │ │
│  ▼ Labor        │  2 hours ago             │  │      Due in 2 days      │ │
│    • Framing    │                          │  └─────────────────────────┘ │
│      +$2,000    │  [Icon] PO #124          │                               │
│    • Plumbing   │  Electrical              │  ┌─────────────────────────┐ │
│      +$1,500    │  $12,500                 │  │ [SM] Framing Complete   │ │
│                 │  5 hours ago             │  │      [Complete]         │ │
│                 │                          │  │      Completed today    │ │
│                 │  [Icon] PO #125          │  └─────────────────────────┘ │
│                 │  Roofing Materials       │                               │
│                 │  $25,000                 │  ┌─────────────────────────┐ │
│                 │  Yesterday               │  │ [KW] Electrical Rough   │ │
│                 │                          │  │      [Overdue]          │ │
│                 │                          │  │      2 days overdue     │ │
│                 │                          │  └─────────────────────────┘ │
└─────────────────┴──────────────────────────┴───────────────────────────────┘

  1/4 width         |          3/4 width (split into 2 columns)             |
  (sidebar)         |    Full width top, 2 columns bottom                   |
```

## Responsive Breakpoints

### Desktop (≥1024px)
- Left sidebar: 25% width
- Right content: 75% width
- Bottom grid: 2 columns (50/50)
- Sidebar auto-collapses

### Tablet (768px-1023px)
- Vertical stack
- All components full width
- Bottom grid: May stay 2 columns if space

### Mobile (<768px)
- Full vertical stack
- Single column
- All cards full width
- Mobile navigation

## Color Coding

### Status Badges
- **RED** (`bg-red-100 text-red-700`): Overdue
- **GREEN** (`bg-green-100 text-green-700`): Complete
- **YELLOW** (`bg-yellow-100 text-yellow-700`): Underway
- **GRAY** (`bg-gray-100 text-gray-700`): Pending

### Activity Icons
- **BLUE**: PO Created
- **GREEN**: PO Approved
- **AMBER**: PO Updated
- **RED**: PO Cancelled

### Chart Sections
- **RED** (#ef4444): Costs
- **GREEN** (#22c55e): Profit
- **AMBER** (#f59e0b): Pending

## Component Hierarchy

```
JobDetailPage
├── Stats Cards (4 cards)
│   ├── Contract Value
│   ├── Live Profit
│   ├── Stage
│   └── Status
│
└── Overview Tab
    ├── Left Column (1/4)
    │   └── ProfitSummaryCard
    │       ├── Live Profit Header
    │       ├── Cost Savings Tree
    │       └── Cost Overruns Tree
    │
    └── Right Column (3/4)
        ├── Top (Full Width)
        │   └── ProfitAnalysisPieChart
        │       ├── Donut Chart
        │       ├── Legend
        │       └── Summary Stats
        │
        └── Bottom (2 Columns)
            ├── Left (1/2)
            │   └── RecentActivityList
            │       └── Timeline Items
            │
            └── Right (1/2)
                └── UpcomingTasksGrid
                    └── Task Cards
                        ├── UserAvatar
                        ├── Task Name
                        ├── Status Badge
                        └── Due Date
```

## Spacing & Shadows

Following Tailwind/Subframe conventions:

- **Card Padding**: `p-6` (24px)
- **Gap between cards**: `gap-6` (24px)
- **Card Shadows**: `shadow-sm`
- **Card Borders**: `border border-gray-200 dark:border-gray-700`
- **Rounded Corners**: `rounded-lg` (8px)

## Typography Scale

- **Page Title**: `text-2xl font-bold`
- **Card Headings**: `text-base font-semibold`
- **Section Labels**: `text-sm font-medium`
- **Body Text**: `text-sm`
- **Small Text**: `text-xs`
- **Large Numbers**: `text-3xl font-bold`

## Accessibility

- All interactive elements keyboard accessible
- Proper ARIA labels on icons
- Sufficient color contrast (WCAG AA)
- Focus indicators on all buttons
- Semantic HTML structure
- Screen reader friendly

## Empty States

Each component has a helpful empty state:

1. **ProfitSummaryCard**: "No cost variances to display"
2. **ProfitAnalysisPieChart**: "No contract value set"
3. **RecentActivityList**: "No recent activity"
4. **UpcomingTasksGrid**: "No upcoming tasks"

All include:
- Icon (gray, size-12)
- Primary message (text-sm)
- Secondary hint (text-xs)
