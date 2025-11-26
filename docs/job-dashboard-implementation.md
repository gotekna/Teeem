# Job Detail Dashboard Implementation

## Overview

Implemented a Subframe-inspired dashboard layout for the Job Detail page Overview tab, replacing the simple job details card with a comprehensive profit analysis dashboard.

## Implementation Date
November 6, 2025

## Components Created

### 1. UserAvatar Component
**File:** `/Users/jakebaird/teeem/frontend/src/components/UserAvatar.jsx`

- Displays user photo or fallback initials in a circle
- Supports multiple sizes (xs, sm, md, lg, xl)
- Auto-generates initials from name (e.g., "Jake Baird" → "JB")
- Handles image loading errors gracefully
- Dark mode support

### 2. ProfitSummaryCard Component
**File:** `/Users/jakebaird/teeem/frontend/src/components/job-detail/ProfitSummaryCard.jsx`

**Features:**
- Displays Live Profit prominently at top
- Shows profit margin percentage
- Collapsible tree view of Cost Savings (green)
- Collapsible tree view of Cost Overruns (red)
- Groups line items by category
- Shows budget vs actual variances
- Empty state when no variances exist

**Structure:**
```
┌─────────────────────────┐
│ Live Profit             │
│ $45,000 (15% margin)    │
├─────────────────────────┤
│ Cost Savings            │
│ ▼ Materials   -$2,000   │
│   • Concrete  -$2,000   │
├─────────────────────────┤
│ Cost Overruns           │
│ ▼ Labor       +$1,500   │
│   • Framing   +$1,500   │
└─────────────────────────┘
```

### 3. ProfitAnalysisPieChart Component
**File:** `/Users/jakebaird/teeem/frontend/src/components/job-detail/ProfitAnalysisPieChart.jsx`

**Features:**
- Recharts-powered donut/pie chart
- 3 sections:
  1. Costs (red) - Actual costs incurred
  2. Profit (green) - Current profit/efficiencies
  3. Pending (amber) - Uncommitted budget
- Interactive tooltips showing amounts and percentages
- Summary stats below chart
- Dark mode color variants
- Empty state when no contract value set

**Chart Colors:**
- Costs: Red (#ef4444 / #f87171 dark)
- Profit: Green (#22c55e / #4ade80 dark)
- Pending: Amber (#f59e0b / #fbbf24 dark)

### 4. RecentActivityList Component
**File:** `/Users/jakebaird/teeem/frontend/src/components/job-detail/RecentActivityList.jsx`

**Features:**
- Timeline-style activity feed
- Color-coded activity types:
  - PO Created: Blue
  - PO Approved: Green
  - PO Updated: Amber
  - PO Cancelled: Red
- Shows relative timestamps (e.g., "2h ago", "3d ago")
- Displays activity description and amounts
- Empty state with helpful message

### 5. UpcomingTasksGrid Component
**File:** `/Users/jakebaird/teeem/frontend/src/components/job-detail/UpcomingTasksGrid.jsx`

**Features:**
- Grid of task cards (2 columns on desktop, 1 on mobile)
- Each card shows:
  - User avatar (photo or initials)
  - Task/milestone name
  - Optional description (2 line clamp)
  - Status badge with TEEEM's vibrant colors:
    - RED = Overdue
    - GREEN = Complete
    - YELLOW = Underway
    - GRAY = Pending
- Due date display (e.g., "Due in 3 days", "2 days overdue")
- Empty state when no tasks

## Page Updates

### JobDetailPage.jsx
**File:** `/Users/jakebaird/teeem/frontend/src/pages/JobDetailPage.jsx`

**Changes:**
1. Added imports for all new dashboard components
2. Added state for dashboard data:
   - `costLineItems` - Budget vs actual line items
   - `recentActivity` - Recent POs and changes
   - `upcomingTasks` - Tasks and milestones
   - `isDarkMode` - Dark mode detection
3. Added `loadDashboardData()` function to fetch:
   - Cost line items (currently mock data - TODO backend)
   - Recent activity from POs
   - Upcoming tasks (currently mock data - TODO backend)
4. Replaced entire Overview tab with new dashboard layout

**Layout Structure:**
```
┌──────────────────────────────────────────────────────┐
│ Stats Cards (Contract, Profit, Stage, Status)       │
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│ Profit   │  Profit Analysis Pie Chart                │
│ Summary  │                                           │
│          ├───────────────────┬───────────────────────┤
│          │ Recent Activity   │ Upcoming Tasks        │
│          │                   │                       │
└──────────┴───────────────────┴───────────────────────┘
```

**Grid Layout:**
- Left sidebar: 1/4 width (Profit Summary)
- Right content: 3/4 width
  - Top: Full width (Pie Chart)
  - Bottom: 2 columns (Activity + Tasks)
- Mobile: Stacks vertically

### AppLayout.jsx
**File:** `/Users/jakebaird/teeem/frontend/src/components/layout/AppLayout.jsx`

**Changes:**
- Added auto-collapse sidebar logic for job detail pages
- Detects `/jobs/:id` route pattern
- Automatically minimizes sidebar when viewing job details
- User can manually expand if needed

## Dependencies Added

### Recharts
**Version:** 3.3.0

Added to `package.json` via:
```bash
npm install recharts
```

Used for the Profit Analysis pie/donut chart with interactive tooltips and legends.

## Responsive Behavior

### Desktop (≥1024px)
- 4-column grid layout
- Sidebar 1 column, content 3 columns
- Activity/Tasks side-by-side
- Sidebar auto-collapses

### Tablet (768px-1023px)
- Stacks vertically
- Activity/Tasks still side-by-side if space allows
- Sidebar can be toggled

### Mobile (<768px)
- Full vertical stack
- Single column layout
- All cards full width
- Mobile sidebar (overlay)

## Dark Mode Support

All components fully support dark mode:
- Background colors: `bg-white dark:bg-gray-800`
- Text colors: `text-gray-900 dark:text-white`
- Border colors: `border-gray-200 dark:border-gray-700`
- Chart colors: Separate light/dark palettes
- Proper contrast ratios maintained

## Data Flow

### Current Implementation
1. Job data loaded from `/api/v1/constructions/:id`
2. Recent activity derived from POs via `/api/v1/purchase_orders`
3. Cost line items: **Mock data** (empty array)
4. Upcoming tasks: **Mock data** (empty array)

### Backend TODOs
The following endpoints/data need to be added:

#### 1. Cost Line Items API
```ruby
# Endpoint: GET /api/v1/constructions/:id/cost_line_items
# Response:
[
  {
    id: 1,
    name: "Concrete Foundation",
    category: "Materials",
    budget: 50000,
    actual: 48000
  },
  {
    id: 2,
    name: "Framing Labor",
    category: "Labor",
    budget: 30000,
    actual: 32000
  }
]
```

#### 2. Upcoming Tasks API
```ruby
# Endpoint: GET /api/v1/constructions/:id/upcoming_tasks
# Response:
[
  {
    id: 1,
    name: "Foundation Pour",
    description: "Pour concrete for foundation",
    status: "underway", # overdue | complete | underway | pending
    due_date: "2025-11-10",
    assigned_to: {
      id: 5,
      name: "John Smith",
      photo_url: "https://...",
      avatar_url: "https://..."
    }
  }
]
```

Could be sourced from:
- Schedule Master tasks
- Estimates with due dates
- Custom milestone system
- Integration with project management tools

## Testing Instructions

### 1. Local Development
```bash
cd /Users/jakebaird/teeem/frontend
npm install  # Installs Recharts
npm run dev  # Starts dev server on :5173
```

### 2. Navigate to Job Detail
- Go to Active Jobs page
- Click any job to view details
- **Observe:** Sidebar auto-collapses
- Switch to Overview tab

### 3. Test Dashboard Components

#### Test Profit Summary Card
- Should show Live Profit prominently
- Test with positive/negative profit
- Test with no cost variances (empty state)

#### Test Profit Analysis Chart
- Verify pie chart renders with 3 sections
- Hover over sections for tooltips
- Test with no contract value (empty state)
- Check dark mode color variants

#### Test Recent Activity
- Should show recent POs as activity items
- Verify color coding (blue/green/amber/red)
- Test relative timestamps
- Test empty state

#### Test Upcoming Tasks
- Currently shows empty state
- Once backend implemented, verify:
  - Avatar displays (photo or initials)
  - Status badges show correct colors
  - Due dates calculate correctly

### 4. Responsive Testing
```
- Desktop (1440px): 4-column grid
- Tablet (768px): Stacked layout
- Mobile (375px): Single column
```

### 5. Dark Mode Testing
- Toggle system dark mode
- Verify all text is readable
- Check chart color variants
- Verify badge colors maintain contrast

## Future Enhancements

### Phase 2 - Backend Integration
1. Create cost line items endpoint
2. Create upcoming tasks endpoint
3. Add real-time updates via websockets
4. Add activity filtering/search

### Phase 3 - Interactivity
1. Click activity items to navigate
2. Click tasks to view/edit details
3. Inline editing of contract value
4. Export dashboard as PDF

### Phase 4 - Advanced Analytics
1. Trend charts (profit over time)
2. Comparison to similar jobs
3. Risk indicators
4. Predictive insights

## Files Created/Modified

### Created Files (6)
1. `/Users/jakebaird/teeem/frontend/src/components/UserAvatar.jsx`
2. `/Users/jakebaird/teeem/frontend/src/components/job-detail/ProfitSummaryCard.jsx`
3. `/Users/jakebaird/teeem/frontend/src/components/job-detail/ProfitAnalysisPieChart.jsx`
4. `/Users/jakebaird/teeem/frontend/src/components/job-detail/RecentActivityList.jsx`
5. `/Users/jakebaird/teeem/frontend/src/components/job-detail/UpcomingTasksGrid.jsx`
6. `/Users/jakebaird/teeem/docs/job-dashboard-implementation.md` (this file)

### Modified Files (3)
1. `/Users/jakebaird/teeem/frontend/src/pages/JobDetailPage.jsx`
   - Added dashboard component imports
   - Added dashboard state and data loading
   - Replaced Overview tab content
2. `/Users/jakebaird/teeem/frontend/src/components/layout/AppLayout.jsx`
   - Added auto-collapse sidebar for job detail routes
3. `/Users/jakebaird/teeem/frontend/package.json`
   - Added `recharts: ^3.3.0` dependency

## Build Status

Build successful:
```
✓ built in 13.80s
dist/index.html                     0.71 kB │ gzip:   0.40 kB
dist/assets/index-DV1n41JM.css     91.05 kB │ gzip:  14.18 kB
dist/assets/index-BnKQoane.js   1,421.99 kB │ gzip: 362.79 kB
```

Note: Bundle size increased due to Recharts library. Consider code-splitting in future if needed.

## Next Steps

1. **Deploy to Vercel:**
   ```bash
   cd /Users/jakebaird/teeem/frontend
   vercel --prod
   ```

2. **Backend Developer:**
   - Implement cost line items endpoint
   - Implement upcoming tasks endpoint
   - Add activity tracking for more event types

3. **Test in Production:**
   - Verify with real job data
   - Test with various profit scenarios
   - Collect user feedback

4. **Iterate:**
   - Add requested features
   - Optimize performance
   - Enhance visualizations

## Design Philosophy

This dashboard follows TEEEM's design principles:
- Clean, professional aesthetic inspired by Airtable/Google Sheets
- Tailwind CSS utility-first styling
- Headless UI for accessibility
- Mobile-first responsive design
- Dark mode throughout
- Vibrant, construction-themed status colors
- Clear information hierarchy
- Generous spacing (Subframe-inspired)

The layout prioritizes profit visibility while providing actionable insights through the activity feed and task grid.
