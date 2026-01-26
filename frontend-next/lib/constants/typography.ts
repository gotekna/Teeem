/**
 * Typography Constants (SSoT)
 *
 * Based on TEEEM Brand Guidelines: /brand-guidelines
 *
 * OFFICIAL FONT SIZE SCALE:
 * | Size  | Tailwind              | Use Case                    |
 * |-------|----------------------|------------------------------|
 * | 32px  | text-[32px]          | Large headings               |
 * | 21px  | text-[21px]          | Document titles, totals      |
 * | 14px  | text-sm              | Body text (DEFAULT)          |
 * | 12px  | text-xs              | Small text, badges           |
 * | 11px  | text-[11px]          | Labels, table cells          |
 * | 10px  | text-[10px]          | Small pills, tags            |
 *
 * TEXT COLORS:
 * - foreground: Primary text
 * - text-muted-foreground / #878787: Labels, muted text
 * - text-[#606060]: Descriptions, secondary
 */

export const TYPOGRAPHY = {
  // ============================================
  // HEADINGS (from brand guidelines)
  // ============================================

  /** Large heading - 32px */
  h1: "text-[32px] font-medium",

  /** Document title - 21px */
  h2: "text-[21px] font-medium",

  /** Section heading - 14px medium */
  h3: "text-sm font-medium",

  /** Subsection heading - 14px medium muted */
  h4: "text-sm font-medium text-muted-foreground",

  // ============================================
  // SECTION HEADERS (panels, dialogs)
  // ============================================

  /** Main section header (collapsible panels) - "Attachments", "Details" */
  sectionHeader: "text-sm font-medium text-muted-foreground",

  /** Subsection header (inside panels) - "Emails", "Documents" */
  subsectionHeader: "text-sm font-medium text-muted-foreground",

  /** Card/dialog title - 14px medium */
  cardTitle: "text-sm font-medium",

  /** Page title - 21px */
  pageTitle: "text-[21px] font-medium tracking-tight",

  // ============================================
  // BODY TEXT
  // ============================================

  /** Default body text - 14px */
  body: "text-sm",

  /** Body text muted - 14px #606060 */
  bodyMuted: "text-sm text-[#606060]",

  /** Small body text - 12px (badges, small text) */
  bodySmall: "text-xs",

  /** Table cells, labels - 11px */
  bodyXs: "text-[11px]",

  /** Pills, tags - 10px */
  bodyXxs: "text-[10px]",

  // ============================================
  // LABELS & CAPTIONS
  // ============================================

  /** Form labels - 11px muted above inputs */
  label: "text-[11px] text-muted-foreground",

  /** Field descriptions - 11px #606060 */
  description: "text-[11px] text-[#606060]",

  /** Badge text - 12px */
  badge: "text-xs",

  /** Pill text - 12px */
  pill: "text-xs",

  // ============================================
  // TABLE (from brand guidelines)
  // ============================================

  /** Table header - 14px uppercase medium */
  tableHeader: "text-sm uppercase font-medium tracking-[0.05em]",

  /** Table cascading header - 13px bold */
  tableCascadingHeader: "text-[13px] font-bold",

  /** Table cell - 13px */
  tableCell: "text-[13px]",

  /** Table cell mono (IDs, amounts) - 13px mono */
  tableCellMono: "text-[13px] font-mono",

  // ============================================
  // SPECIAL
  // ============================================

  /** Empty state message */
  emptyState: "text-sm text-muted-foreground text-center",

  /** Error message */
  error: "text-sm text-destructive",

  /** Success message */
  success: "text-sm text-green-600 dark:text-green-400",

  /** Muted helper text */
  muted: "text-muted-foreground",

  // ============================================
  // DOCUMENT TYPOGRAPHY (invoices, POs)
  // ============================================

  /** Document title - 21px medium */
  docTitle: "text-[21px] font-medium",

  /** Document labels - 11px #878787 */
  docLabel: "text-[11px] text-muted-foreground",

  /** Document body - 11px */
  docBody: "text-[11px]",

  /** Document amounts - 11px mono */
  docAmount: "text-[11px] font-mono",

  /** Document total - 21px mono medium */
  docTotal: "text-[21px] font-mono font-medium",

  // ============================================
  // ICONS (paired with text)
  // ============================================

  /** Icon in section/subsection header */
  headerIcon: "h-4 w-4 text-muted-foreground",

  /** Icon in body text */
  bodyIcon: "h-4 w-4",

  /** Small icon (badges, inline) */
  smallIcon: "h-3 w-3",
} as const;

// Type for autocompletion
export type TypographyKey = keyof typeof TYPOGRAPHY;
