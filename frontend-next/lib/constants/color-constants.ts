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
// BRAND COLORS
// =============================================================================

/**
 * TEEEM brand colors from Brand Guidelines.
 * These match the CSS variables defined in globals.css
 */
export const BRAND_COLORS = {
  // Primary text colors
  textPrimary: '#1D1D1D',
  textSecondary: '#606060',
  textMuted: '#878787',

  // Background colors
  background: '#F2F1EF',
  backgroundWhite: '#ffffff',
  backgroundDark: '#1f2937',

  // Accent colors
  accentBlue: '#3b82f6',
  accentToday: '#ffe4e6', // Light pink for today highlighting
} as const;

// =============================================================================
// STATUS COLORS
// =============================================================================

/**
 * Status colors for tasks, workflows, and entities.
 * Consistent across Gantt charts, tables, badges, etc.
 */
export const STATUS_COLORS = {
  // Task/Workflow statuses
  notStarted: TAILWIND_COLORS.gray[400],    // #9ca3af
  inProgress: TAILWIND_COLORS.blue[500],    // #3b82f6
  completed: TAILWIND_COLORS.green[500],    // #22c55e
  onHold: TAILWIND_COLORS.amber[500],       // #f59e0b
  atRisk: TAILWIND_COLORS.red[500],         // #ef4444

  // Alternative status names
  pending: TAILWIND_COLORS.gray[400],
  active: TAILWIND_COLORS.blue[500],
  done: TAILWIND_COLORS.green[500],
  paused: TAILWIND_COLORS.amber[500],
  error: TAILWIND_COLORS.red[500],

  // Success/Warning/Error semantic colors
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
 */
export const CHART_COLORS = {
  light: {
    background: '#ffffff',
    gridLines: TAILWIND_COLORS.gray[200],     // #e5e7eb
    todayMarker: TAILWIND_COLORS.red[500],    // #ef4444
    weekendBackground: TAILWIND_COLORS.gray[50], // #f9fafb
    headerBackground: TAILWIND_COLORS.gray[100], // #f3f4f6
    headerText: TAILWIND_COLORS.gray[700],    // #374151
    selectedRow: TAILWIND_COLORS.blue[100],   // #dbeafe
    hoverRow: TAILWIND_COLORS.gray[100],      // #f3f4f6
    borderColor: TAILWIND_COLORS.gray[200],   // #e5e7eb
    textColor: TAILWIND_COLORS.gray[800],     // #1f2937
  },
  dark: {
    background: TAILWIND_COLORS.gray[800],    // #1f2937
    gridLines: TAILWIND_COLORS.gray[700],     // #374151
    todayMarker: TAILWIND_COLORS.red[500],    // #ef4444
    weekendBackground: TAILWIND_COLORS.gray[900], // #111827
    headerBackground: TAILWIND_COLORS.gray[900], // #111827
    headerText: TAILWIND_COLORS.gray[200],    // #e5e7eb
    selectedRow: '#1e3a5f',                   // Custom dark blue
    hoverRow: TAILWIND_COLORS.gray[700],      // #374151
    borderColor: TAILWIND_COLORS.gray[700],   // #374151
    textColor: TAILWIND_COLORS.gray[200],     // #e5e7eb
  },
} as const;

/**
 * Task bar colors for Gantt charts.
 */
export const GANTT_COLORS = {
  taskStatus: {
    notStarted: TAILWIND_COLORS.gray[400],
    inProgress: TAILWIND_COLORS.blue[500],
    completed: TAILWIND_COLORS.green[500],
    onHold: TAILWIND_COLORS.amber[500],
    atRisk: TAILWIND_COLORS.red[500],
  },
  taskBar: {
    border: TAILWIND_COLORS.gray[700],
    text: '#ffffff',
    default: TAILWIND_COLORS.blue[500],
    progress: TAILWIND_COLORS.blue[500],
    baseline: TAILWIND_COLORS.gray[400],
    criticalPath: TAILWIND_COLORS.red[500],
  },
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
 */
export function getStatusColor(status: string): string {
  const normalizedStatus = status.toLowerCase().replace(/[_-]/g, '');
  const colorMap: Record<string, string> = {
    notstarted: STATUS_COLORS.notStarted,
    inprogress: STATUS_COLORS.inProgress,
    completed: STATUS_COLORS.completed,
    done: STATUS_COLORS.done,
    onhold: STATUS_COLORS.onHold,
    paused: STATUS_COLORS.paused,
    atrisk: STATUS_COLORS.atRisk,
    error: STATUS_COLORS.error,
    pending: STATUS_COLORS.pending,
    active: STATUS_COLORS.active,
  };
  return colorMap[normalizedStatus] || TAILWIND_COLORS.gray[500];
}

/**
 * Get chart colors based on dark mode.
 */
export function getChartColors(darkMode: boolean) {
  return darkMode ? CHART_COLORS.dark : CHART_COLORS.light;
}
