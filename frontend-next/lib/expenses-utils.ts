/**
 * Expenses Utility Functions
 *
 * Provides grouping, aggregation, and status calculation for the
 * custom Expenses Cost Control visualization.
 *
 * SSoT: This file is THE ONE place for expense tree data processing.
 */

import { formatCurrency } from "@/utils/formatters";

// Re-export formatCurrency for convenience (SSoT: @/utils/formatters)
export { formatCurrency };

// =============================================================================
// TYPES
// =============================================================================

export interface PurchaseOrderRecord {
  id: number | string;
  po_number?: string;
  // supplier can be string (legacy) or expanded lookup object
  supplier?: string | { id: number; display?: string; name?: string };
  // supplier_id from Foundation API - expanded to { id, display } object
  supplier_id?: number | { id: number; display?: string; name?: string } | null;
  budget?: number | null;
  total?: number | null;
  xero_amount_paid?: number | null;
  xero_still_to_be_paid?: number | null;
  diff_po_with_allowance_versus_budget?: number | null;
  payment_status?: string | null;
  stage_from_task?: string | number | null;
  trade_from_task?: string | number | null;
  status?: string | null;
  // Additional fields for redesigned Expenses tab
  total_billed?: number | null;
  xero_complete?: boolean | null;
  task_category?: string | null;
  // sm_task_id from Foundation API - expanded to { id, display } object
  sm_task_id?: number | { id: number; display?: string; name?: string } | null;
  sm_task?: { id: number; display?: string; name?: string } | null;
  // Budget lock status
  budget_locked_at?: string | null;
  [key: string]: unknown;
}

export interface ExpenseGroup {
  key: string;
  label: string;
  budget: number;
  spent: number;
  paid: number;
  remaining: number;
  variance: number;
  poCount: number;
  isLeafLevel: boolean;
  children: ExpenseGroup[];
  pos: PurchaseOrderRecord[];
}

export type BudgetStatus = 'underBudget' | 'warning' | 'overBudget' | 'noBudget';

// =============================================================================
// STATUS COLORS (SSoT for visual styling)
// =============================================================================

export const STATUS_COLORS = {
  underBudget: {
    bg: 'bg-green-50 dark:bg-green-950/30',
    text: 'text-green-700 dark:text-green-300',
    bar: 'bg-green-500 dark:bg-green-500',
    icon: 'text-green-600 dark:text-green-400',
    border: 'border-green-200 dark:border-green-800',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    text: 'text-yellow-700 dark:text-yellow-300',
    bar: 'bg-yellow-500 dark:bg-yellow-500',
    icon: 'text-yellow-600 dark:text-yellow-400',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  overBudget: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-300',
    bar: 'bg-red-500 dark:bg-red-500',
    icon: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
  noBudget: {
    bg: 'bg-gray-50 dark:bg-gray-800/50',
    text: 'text-gray-600 dark:text-gray-400',
    bar: 'bg-gray-400 dark:bg-gray-500',
    icon: 'text-gray-500 dark:text-gray-400',
    border: 'border-gray-200 dark:border-gray-700',
  },
} as const;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get the budget status based on spent vs budget ratio
 */
export function getBudgetStatus(spent: number, budget: number): BudgetStatus {
  if (budget === 0 || budget === null || budget === undefined) {
    return 'noBudget';
  }
  const percent = (spent / budget) * 100;
  if (percent > 100) return 'overBudget';
  if (percent > 90) return 'warning';
  return 'underBudget';
}

/**
 * Calculate percentage, capped at 100 for display purposes
 */
export function getPercentage(spent: number, budget: number, cap = false): number {
  if (budget === 0 || budget === null || budget === undefined) {
    return 0;
  }
  const percent = (spent / budget) * 100;
  return cap ? Math.min(percent, 100) : percent;
}

// formatCurrency imported from @/utils/formatters (SSoT)

/**
 * Format percentage with sign
 */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Get display value from a field that might be a lookup object
 */
function getDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    return String(obj.display || obj.name || obj.id || '');
  }
  return String(value);
}

/**
 * Safely get numeric value
 */
function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

// =============================================================================
// GROUPING FUNCTION
// =============================================================================

/**
 * Group purchase orders hierarchically by two levels (e.g., Stage → Trade)
 *
 * @param pos - Array of purchase order records
 * @param level1Key - First grouping column (e.g., 'stage_from_task')
 * @param level2Key - Second grouping column (e.g., 'trade_from_task')
 * @returns Hierarchical expense groups with aggregated totals
 */
export function groupExpensesByHierarchy(
  pos: PurchaseOrderRecord[],
  level1Key: 'stage_from_task' | 'trade_from_task',
  level2Key: 'stage_from_task' | 'trade_from_task'
): ExpenseGroup[] {
  // Group by level 1
  const level1Map = new Map<string, PurchaseOrderRecord[]>();

  for (const po of pos) {
    const level1Value = getDisplayValue(po[level1Key]);
    const key = level1Value || '(Unassigned)';

    if (!level1Map.has(key)) {
      level1Map.set(key, []);
    }
    level1Map.get(key)!.push(po);
  }

  // Build hierarchical structure
  const result: ExpenseGroup[] = [];

  for (const [level1Label, level1Pos] of level1Map) {
    // Group level 1's POs by level 2
    const level2Map = new Map<string, PurchaseOrderRecord[]>();

    for (const po of level1Pos) {
      const level2Value = getDisplayValue(po[level2Key]);
      const key = level2Value || '(Unassigned)';

      if (!level2Map.has(key)) {
        level2Map.set(key, []);
      }
      level2Map.get(key)!.push(po);
    }

    // Build level 2 children
    const level2Children: ExpenseGroup[] = [];

    for (const [level2Label, level2Pos] of level2Map) {
      const level2Group: ExpenseGroup = {
        key: `${level1Label}:${level2Label}`,
        label: level2Label,
        budget: level2Pos.reduce((sum, po) => sum + toNumber(po.budget), 0),
        spent: level2Pos.reduce((sum, po) => sum + toNumber(po.total), 0),
        paid: level2Pos.reduce((sum, po) => sum + toNumber(po.xero_amount_paid), 0),
        remaining: level2Pos.reduce((sum, po) => sum + toNumber(po.xero_still_to_be_paid), 0),
        variance: level2Pos.reduce((sum, po) => sum + toNumber(po.diff_po_with_allowance_versus_budget), 0),
        poCount: level2Pos.length,
        isLeafLevel: true,
        children: [],
        pos: level2Pos,
      };
      level2Children.push(level2Group);
    }

    // Sort level 2 by label
    level2Children.sort((a, b) => a.label.localeCompare(b.label));

    // Build level 1 group
    const level1Group: ExpenseGroup = {
      key: level1Label,
      label: level1Label,
      budget: level2Children.reduce((sum, g) => sum + g.budget, 0),
      spent: level2Children.reduce((sum, g) => sum + g.spent, 0),
      paid: level2Children.reduce((sum, g) => sum + g.paid, 0),
      remaining: level2Children.reduce((sum, g) => sum + g.remaining, 0),
      variance: level2Children.reduce((sum, g) => sum + g.variance, 0),
      poCount: level1Pos.length,
      isLeafLevel: false,
      children: level2Children,
      pos: [],
    };
    result.push(level1Group);
  }

  // Sort level 1 by label
  result.sort((a, b) => a.label.localeCompare(b.label));

  return result;
}

/**
 * Calculate job-level totals from grouped expenses
 */
export function calculateJobTotals(groups: ExpenseGroup[]): {
  totalBudget: number;
  totalSpent: number;
  totalPaid: number;
  totalRemaining: number;
  totalVariance: number;
  poCount: number;
} {
  return {
    totalBudget: groups.reduce((sum, g) => sum + g.budget, 0),
    totalSpent: groups.reduce((sum, g) => sum + g.spent, 0),
    totalPaid: groups.reduce((sum, g) => sum + g.paid, 0),
    totalRemaining: groups.reduce((sum, g) => sum + g.remaining, 0),
    totalVariance: groups.reduce((sum, g) => sum + g.variance, 0),
    poCount: groups.reduce((sum, g) => sum + g.poCount, 0),
  };
}

/**
 * Get supplier display name from PO record
 * SSoT: Foundation API returns supplier_id as { id, display } object
 */
export function getSupplierName(po: PurchaseOrderRecord): string {
  // Check supplier_id first (Foundation API format)
  const supplierId = po.supplier_id as unknown;
  if (supplierId && typeof supplierId === 'object') {
    const obj = supplierId as { id?: number; display?: string; name?: string };
    if (obj.display || obj.name) {
      return obj.display || obj.name || `Supplier #${obj.id}`;
    }
  }

  // Fallback to supplier field (PO detail API format)
  if (!po.supplier) return '(No Supplier)';
  if (typeof po.supplier === 'string') return po.supplier;
  if (typeof po.supplier === 'object') {
    return po.supplier.display || po.supplier.name || `Supplier #${po.supplier.id}`;
  }
  return '(No Supplier)';
}

/**
 * Get task display name from PO record
 * SSoT: Foundation API returns sm_task_id as { id, display } object
 */
export function getTaskName(po: PurchaseOrderRecord): string {
  if (po.task_category) return String(po.task_category);

  // Check sm_task_id first (Foundation API format)
  const smTaskId = po.sm_task_id as unknown;
  if (smTaskId && typeof smTaskId === 'object') {
    const obj = smTaskId as { id?: number; display?: string; name?: string };
    if (obj.display || obj.name) {
      return obj.display || obj.name || `Task #${obj.id}`;
    }
  }

  // Fallback to sm_task field (PO detail API format)
  if (po.sm_task) {
    if (typeof po.sm_task === 'object') {
      return po.sm_task.display || po.sm_task.name || `Task #${po.sm_task.id}`;
    }
  }
  return '-';
}

/**
 * Format overrun value (negative = over budget, positive = under budget)
 */
export function formatOverrun(value: number | null | undefined): string {
  if (value == null) return '-';
  const num = Number(value);
  if (num === 0) return '-';
  // Display absolute value with sign indicator
  return formatCurrency(num);
}

/**
 * Check if PO is over-billed (billed more than PO total)
 */
export function isOverBilled(po: PurchaseOrderRecord): boolean {
  const billed = Number(po.total_billed) || 0;
  const total = Number(po.total) || 0;
  return billed > total && total > 0;
}

/**
 * Calculate cost to complete (PO total minus what's been paid)
 */
export function getCostToComplete(po: PurchaseOrderRecord): number {
  const total = Number(po.total) || 0;
  const paid = Number(po.xero_amount_paid) || 0;
  return Math.max(0, total - paid);
}
