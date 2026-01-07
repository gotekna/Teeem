/**
 * Color Constants - Single Source of Truth (SSoT)
 *
 * Centralized color definitions for use in canvas rendering, charts, and
 * other contexts where Tailwind CSS classes cannot be used directly.
 *
 * These colors are mapped to Tailwind's color palette for consistency.
 * Use Tailwind classes in JSX when possible; use these constants for:
 * - Canvas 2D rendering (ctx.fillStyle, ctx.strokeStyle)
 * - SVG/Chart libraries
 * - Dynamic style calculations
 *
 * Usage:
 *   import { COLORS, STATUS_COLORS, CHART_COLORS } from '@/lib/constants/color-constants';
 */

// =============================================================================
// TAILWIND COLOR PALETTE (Hex equivalents)
// =============================================================================

/**
 * Tailwind color palette as hex values.
 * Use these when you need hex colors that match Tailwind's design system.
 */
export const TAILWIND_COLORS = {
  // Gray scale
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
    950: '#030712',
  },
  // Slate (darker gray)
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  // Blue
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  // Red
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  // Green
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  // Emerald
  emerald: {
    500: '#10b981',
    600: '#059669',
  },
  // Amber/Yellow
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
  },
  yellow: {
    400: '#facc15',
    500: '#eab308',
  },
  // Orange
  orange: {
    400: '#fb923c',
    500: '#f97316',
    600: '#ea580c',
  },
  // Purple/Violet
  purple: {
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
  },
  violet: {
    500: '#8b5cf6',
    600: '#7c3aed',
  },
  // Indigo
  indigo: {
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
  },
  // Pink
  pink: {
    400: '#f472b6',
    500: '#ec4899',
    600: '#db2777',
  },
  // Cyan/Teal
  cyan: {
    400: '#22d3ee',
    500: '#06b6d4',
  },
  teal: {
    500: '#14b8a6',
    600: '#0d9488',
  },
} as const;

// =============================================================================
// BRAND COLORS (from /brand-guidelines page)
// =============================================================================

/**
 * TEEEM brand colors from Brand Guidelines.
 * SSoT: These match the design tokens in /brand-guidelines and globals.css
 *
 * @see /brand-guidelines for visual reference
 */
export const BRAND_COLORS = {
  // Text Colors (Brand Guidelines: "Text Colors" section)
  text: {
    primary: '#1D1D1D',     // Foreground - Primary text
    secondary: '#606060',   // Descriptions, secondary text
    muted: '#878787',       // Labels, muted text
  },

  // Background Colors (Brand Guidelines: "Backgrounds" section)
  background: {
    primary: '#ffffff',           // Light mode main background
    primaryDark: '#0d0d0d',       // Dark mode main background
    secondary: '#F2F1EF',         // Light mode secondary
    secondaryDark: '#1D1D1D',     // Dark mode secondary
  },

  // Status Background Colors (Brand Guidelines: "Status Colors" section)
  // Used for Pills, Badges, and status indicators
  status: {
    success: {
      light: '#DCFCE7',    // green-100 - Completed, active
      dark: '#14532D',     // green-900
    },
    warning: {
      light: '#FEF3C7',    // amber-100 - Pending, attention
      dark: '#78350F',     // amber-900
    },
    error: {
      light: '#FEE2E2',    // red-100 - Failed, destructive
      dark: '#7F1D1D',     // red-900
    },
    info: {
      light: '#DBEAFE',    // blue-100 - Processing, info
      dark: '#1E3A8A',     // blue-900
    },
  },
} as const;

// =============================================================================
// STATUS COLORS (for canvas/chart rendering)
// =============================================================================

/**
 * Status colors for tasks, workflows, and canvas rendering.
 * These are the "solid" colors used for task bars, progress indicators, etc.
 *
 * For status BACKGROUND colors (pills, badges), use BRAND_COLORS.status
 * which provides light/dark variants per brand guidelines.
 *
 * Brand Guidelines Mapping:
 * - success (green) = Completed, Active
 * - warning (amber) = Pending, On Hold
 * - error (red) = Failed, At Risk
 * - info (blue) = Processing, In Progress
 *
 * @see /brand-guidelines "Status Colors" section
 */
export const STATUS_COLORS = {
  // Task/Workflow statuses (Gantt, charts)
  notStarted: TAILWIND_COLORS.gray[400],    // #9ca3af - Inactive/not started
  inProgress: TAILWIND_COLORS.blue[500],    // #3b82f6 - Info/processing
  completed: TAILWIND_COLORS.green[500],    // #22c55e - Success/completed
  onHold: TAILWIND_COLORS.amber[500],       // #f59e0b - Warning/pending
  atRisk: TAILWIND_COLORS.red[500],         // #ef4444 - Error/failed

  // Alternative status names (aliases)
  pending: TAILWIND_COLORS.amber[500],      // Warning - matches brand "Pending"
  active: TAILWIND_COLORS.green[500],       // Success - matches brand "Active"
  done: TAILWIND_COLORS.green[500],         // Success
  paused: TAILWIND_COLORS.amber[500],       // Warning
  error: TAILWIND_COLORS.red[500],          // Error
  failed: TAILWIND_COLORS.red[500],         // Error
  processing: TAILWIND_COLORS.blue[500],    // Info

  // Semantic colors (direct mapping to brand)
  success: TAILWIND_COLORS.green[500],
  warning: TAILWIND_COLORS.amber[500],
  danger: TAILWIND_COLORS.red[500],
  info: TAILWIND_COLORS.blue[500],
} as const;

// =============================================================================
// CHART/CANVAS COLORS
// =============================================================================

/**
 * Colors for charts, graphs, and canvas rendering.
 * Light and dark mode variants included.
 *
 * Uses BRAND_COLORS for consistency with brand guidelines.
 * @see /brand-guidelines
 */
export const CHART_COLORS = {
  light: {
    background: BRAND_COLORS.background.primary,        // #ffffff
    gridLines: TAILWIND_COLORS.gray[200],               // #e5e7eb
    todayMarker: STATUS_COLORS.danger,                  // #ef4444 - Error/danger
    weekendBackground: TAILWIND_COLORS.gray[50],        // #f9fafb
    headerBackground: TAILWIND_COLORS.gray[100],        // #f3f4f6
    headerText: TAILWIND_COLORS.gray[700],              // #374151
    selectedRow: '#2563eb',                             // blue-600 - solid blue
    hoverRow: TAILWIND_COLORS.gray[100],                // #f3f4f6
    borderColor: TAILWIND_COLORS.gray[200],             // #e5e7eb
    textColor: BRAND_COLORS.text.primary,               // #1D1D1D
    // Header row (summary task) background - amber to match sidebar
    headerRowBackground: TAILWIND_COLORS.amber[200],    // #fde68a - more saturated amber (header)
    childRowBackground: TAILWIND_COLORS.amber[100],     // #fef3c7 - lighter amber (children)
  },
  dark: {
    background: BRAND_COLORS.background.secondaryDark,  // #1D1D1D
    gridLines: TAILWIND_COLORS.gray[700],               // #374151
    todayMarker: STATUS_COLORS.danger,                  // #ef4444 - Error/danger
    weekendBackground: TAILWIND_COLORS.gray[900],       // #111827
    headerBackground: TAILWIND_COLORS.gray[900],        // #111827
    headerText: TAILWIND_COLORS.gray[200],              // #e5e7eb
    selectedRow: '#2563eb',                             // blue-600 - solid blue
    hoverRow: TAILWIND_COLORS.gray[700],                // #374151
    borderColor: TAILWIND_COLORS.gray[700],             // #374151
    textColor: TAILWIND_COLORS.gray[200],               // #e5e7eb
    // Header row (summary task) background - amber to match sidebar
    headerRowBackground: 'rgba(180, 83, 9, 0.3)',       // amber-900/30 to match dark:bg-amber-900/30 (header)
    childRowBackground: 'rgba(180, 83, 9, 0.2)',        // amber-900/20 to match dark:bg-amber-900/20 (children)
  },
} as const;

/**
 * Task bar colors for Gantt charts.
 * Uses STATUS_COLORS for consistency with brand guidelines.
 *
 * @see /brand-guidelines "Status Colors" section
 */
export const GANTT_COLORS = {
  // Task status colors (maps to brand status semantics)
  taskStatus: {
    notStarted: STATUS_COLORS.notStarted,   // Gray - inactive
    inProgress: STATUS_COLORS.inProgress,   // Blue - info/processing
    completed: STATUS_COLORS.completed,     // Green - success
    onHold: STATUS_COLORS.onHold,           // Amber - warning/pending
    atRisk: STATUS_COLORS.atRisk,           // Red - error/danger
  },
  // Task bar rendering
  taskBar: {
    border: TAILWIND_COLORS.gray[700],
    text: '#ffffff',
    default: STATUS_COLORS.info,            // Blue - default bar color
    progress: STATUS_COLORS.info,           // Blue - progress fill
    baseline: TAILWIND_COLORS.gray[400],
    criticalPath: STATUS_COLORS.danger,     // Red - critical path
  },
  // UI elements
  ui: {
    focusRing: TAILWIND_COLORS.indigo[500],
    milestone: TAILWIND_COLORS.indigo[500],
    dependency: TAILWIND_COLORS.indigo[600],
  },
} as const;

// =============================================================================
// ENTITY/CATEGORY COLORS
// =============================================================================

/**
 * Colors for different entity types in relationship charts.
 */
export const ENTITY_COLORS = {
  person: TAILWIND_COLORS.blue[500],
  company: TAILWIND_COLORS.purple[500],
  trust: TAILWIND_COLORS.violet[500],
  job: TAILWIND_COLORS.emerald[500],
  case: TAILWIND_COLORS.amber[500],
  contact: TAILWIND_COLORS.cyan[500],
} as const;

/**
 * Category colors for charts and data visualization.
 * Use these for pie charts, bar charts, legends, etc.
 */
export const CATEGORY_COLORS = [
  TAILWIND_COLORS.blue[500],     // #3b82f6
  TAILWIND_COLORS.green[500],    // #22c55e
  TAILWIND_COLORS.amber[500],    // #f59e0b
  TAILWIND_COLORS.red[500],      // #ef4444
  TAILWIND_COLORS.purple[500],   // #a855f7
  TAILWIND_COLORS.pink[500],     // #ec4899
  TAILWIND_COLORS.indigo[500],   // #6366f1
  TAILWIND_COLORS.cyan[500],     // #06b6d4
  TAILWIND_COLORS.orange[500],   // #f97316
  TAILWIND_COLORS.teal[500],     // #14b8a6
] as const;

// =============================================================================
// UTILITY COLORS
// =============================================================================

/**
 * Common utility colors.
 */
export const COLORS = {
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',

  // Semantic shortcuts
  ...STATUS_COLORS,
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get status color by status string.
 * Maps various status names to brand-consistent colors.
 *
 * @see /brand-guidelines "Status Indicators" section
 */
export function getStatusColor(status: string): string {
  const normalizedStatus = status.toLowerCase().replace(/[_-]/g, '');
  const colorMap: Record<string, string> = {
    // Gantt/task statuses
    notstarted: STATUS_COLORS.notStarted,
    inprogress: STATUS_COLORS.inProgress,
    completed: STATUS_COLORS.completed,
    done: STATUS_COLORS.done,
    onhold: STATUS_COLORS.onHold,
    paused: STATUS_COLORS.paused,
    atrisk: STATUS_COLORS.atRisk,

    // Brand status names (from Pills)
    active: STATUS_COLORS.active,           // Success - green
    pending: STATUS_COLORS.pending,         // Warning - amber
    processing: STATUS_COLORS.processing,   // Info - blue
    failed: STATUS_COLORS.failed,           // Error - red
    error: STATUS_COLORS.error,             // Error - red
    inactive: STATUS_COLORS.notStarted,     // Gray

    // Semantic shortcuts
    success: STATUS_COLORS.success,
    warning: STATUS_COLORS.warning,
    danger: STATUS_COLORS.danger,
    info: STATUS_COLORS.info,
  };
  return colorMap[normalizedStatus] || TAILWIND_COLORS.gray[500];
}

/**
 * Get chart colors based on dark mode.
 */
export function getChartColors(darkMode: boolean) {
  return darkMode ? CHART_COLORS.dark : CHART_COLORS.light;
}
