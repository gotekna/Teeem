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
// RICH TEXT EDITOR COLORS
// =============================================================================

/**
 * Color palettes for rich text editor (TipTap).
 * These arrays are used for color pickers in the editor toolbar.
 */
export const RICH_TEXT_COLORS = {
  /** Text color palette - quick access colors for text */
  textColors: [
    COLORS.black,              // #000000
    TAILWIND_COLORS.red[500],  // #ef4444
    TAILWIND_COLORS.orange[500], // #f97316
    TAILWIND_COLORS.yellow[500], // #eab308
    TAILWIND_COLORS.green[500], // #22c55e
    TAILWIND_COLORS.blue[500],  // #3b82f6
    TAILWIND_COLORS.violet[500], // #8b5cf6
    TAILWIND_COLORS.pink[500],  // #ec4899
  ] as const,

  /** Grayscale palette - 10 shades from black to white */
  grayscale: [
    '#000000', '#424242', '#666666', '#808080',
    '#999999', '#b3b3b3', '#cccccc', '#e0e0e0',
    '#f0f0f0', COLORS.white,
  ] as const,

  /** Full color palette - organized by hue with 10 shades each */
  fullPalette: {
    red: ['#7f1d1d', '#991b1b', '#b91c1c', '#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2', '#fef2f2'],
    orange: ['#7c2d12', '#9a3412', '#c2410c', '#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5', '#fff7ed'],
    yellow: ['#713f12', '#854d0e', '#a16207', '#ca8a04', '#eab308', '#facc15', '#fde047', '#fef08a', '#fef9c3', '#fefce8'],
    green: ['#14532d', '#166534', '#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0', '#dcfce7', '#f0fdf4'],
    blue: ['#1e3a8a', '#1e40af', '#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe', '#eff6ff'],
    purple: ['#4c1d95', '#5b21b6', '#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f5f3ff'],
    pink: ['#831843', '#9d174d', '#be185d', '#db2777', '#ec4899', '#f472b6', '#f9a8d4', '#fbcfe8', '#fce7f3', '#fdf2f8'],
  } as const,

  /** Highlight color palettes - for text background highlighting */
  highlightPalettes: {
    light: ['#fef2f2', '#fff7ed', '#fefce8', '#f0fdf4', '#eff6ff', '#f5f3ff'] as const,
    lighter: ['#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7', '#dbeafe', '#ede9fe'] as const,
    medium: ['#fecaca', '#fed7aa', '#fef08a', '#bbf7d0', '#bfdbfe', '#ddd6fe'] as const,
    mediumDark: ['#fca5a5', '#fdba74', '#fde047', '#86efac', '#93c5fd', '#c4b5fd'] as const,
    dark: ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa'] as const,
    pink: ['#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#e5e5e5', '#d4d4d4'] as const,
  } as const,

  /** Default colors */
  defaults: {
    textColor: COLORS.black,        // #000000
    highlightColor: '#fef08a',      // yellow-200 - default highlight
  } as const,

  /** Drawing tool colors with sizes */
  drawingTools: [
    { color: COLORS.black, size: 2 },              // #000000
    { color: TAILWIND_COLORS.red[500], size: 2 },  // #ef4444
    { color: TAILWIND_COLORS.blue[500], size: 2 }, // #3b82f6
    { color: TAILWIND_COLORS.green[500], size: 4 }, // #22c55e
    { color: TAILWIND_COLORS.yellow[500], size: 8, opacity: 0.4 }, // #eab308
  ] as const,
} as const;

// =============================================================================
// CANVAS/SVG SPECIFIC COLORS
// =============================================================================

/**
 * Colors used in canvas/SVG rendering contexts.
 * Organized semantically by purpose.
 */
export const CANVAS_COLORS = {
  /** Corporate structure chart edge colors */
  edges: {
    hierarchy: TAILWIND_COLORS.gray[500],      // #6b7280 - company hierarchy
    ownership: TAILWIND_COLORS.emerald[500],   // #10b981 - company owns company
    personOwnership: TAILWIND_COLORS.amber[500], // #f59e0b - person owns company
  } as const,

  /** MiniMap node colors (corporate chart) */
  minimap: {
    trust: '#fda4af',      // rose-300 - trust entities
    trustee: '#a5b4fc',    // indigo-300 - trustee companies
    company: '#93c5fd',    // blue-300 - regular companies
  } as const,

  /** Gantt overlay checkbox colors (hex fallbacks for inline styles) */
  checkboxes: {
    started: TAILWIND_COLORS.emerald[500],    // #10b981
    hold: TAILWIND_COLORS.amber[500],         // #f59e0b
    confirm: TAILWIND_COLORS.orange[500],     // #f97316
    supplierConfirm: TAILWIND_COLORS.purple[500], // #a855f7
    completed: TAILWIND_COLORS.gray[700],     // #374151
  } as const,

  /** Dependency line colors */
  dependency: {
    default: TAILWIND_COLORS.gray[400],       // #9ca3af
    striped: COLORS.black,                    // #000000 - stripe color
    amber: TAILWIND_COLORS.amber[400],        // #fbbf24 - warning dep
    blue: TAILWIND_COLORS.blue[400],          // #60a5fa - normal dep
  } as const,

  /** Task bar status colors */
  taskStatus: {
    done: TAILWIND_COLORS.gray[800],          // #1f2937 - dark gray
    supplierConfirm: TAILWIND_COLORS.purple[500], // #a855f7
    supervisorConfirm: TAILWIND_COLORS.orange[500], // #f97316
    hold: '#D4A574',                          // Tan - custom brand color
    started: TAILWIND_COLORS.emerald[500],    // #10b981
  } as const,

  /** Odd/even row alternating colors */
  rows: {
    light: {
      odd: '#fafafa',   // Very light gray
      even: COLORS.white,
    },
    dark: {
      odd: '#263040',   // Dark blue-gray
      even: TAILWIND_COLORS.gray[800], // #1f2937
    },
  } as const,

  /** Generic UI colors */
  ui: {
    focusRing: TAILWIND_COLORS.blue[500],     // #3b82f6
    clickableText: TAILWIND_COLORS.blue[500], // #3b82f6
  } as const,
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
