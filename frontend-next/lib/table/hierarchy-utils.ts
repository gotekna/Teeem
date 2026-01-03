/**
 * Hierarchy Utilities for Table View
 *
 * Provides hierarchical sorting and nesting level calculation for
 * the "Header Hierarchy" display mode in TeeemTableView.
 *
 * Re-exports and extends the Gantt hierarchy logic for table use.
 */

import { sortRowsHierarchically, isHeaderRow } from '@/lib/gantt/types';

// Re-export for convenience
export { sortRowsHierarchically, isHeaderRow };

/**
 * Row with hierarchy metadata for rendering
 */
export interface HierarchyRow<T = Record<string, unknown>> {
  row: T;
  nestingLevel: number;
  isHeader: boolean;
  parentTaskNumber: number | null;
  hasChildren: boolean;
}

/**
 * Extract parent task_number from header_gantt field
 */
export function getParentTaskNumber(row: {
  header_gantt: string | number | { id: number; display?: string } | null;
  task_number?: number;
}): number | null {
  // Only top-level headers have no parent (header_gantt === 'Header')
  if (row.header_gantt === 'Header') return null;
  if (typeof row.header_gantt === 'number') return row.header_gantt;
  if (typeof row.header_gantt === 'object' && row.header_gantt?.id) return row.header_gantt.id;
  if (typeof row.header_gantt === 'string') {
    const parsed = parseInt(row.header_gantt, 10);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Calculate nesting level for a single row based on header_gantt chain
 * Level 0: Top-level headers (header_gantt === 'Header')
 * Level 1: Direct children of headers
 * Level 2+: Nested children (children of sub-headers)
 */
export function calculateNestingLevel<T extends {
  task_number: number;
  header_gantt: string | number | { id: number } | null;
  allow_header?: boolean;
}>(
  row: T,
  headerMap: Map<number, T>,
  visited: Set<number> = new Set()
): number {
  // Top-level headers are level 0
  if (row.header_gantt === 'Header') return 0;

  // Get parent
  const parentTaskNum = getParentTaskNumber(row);

  // No parent = level 0 (orphan or standalone)
  if (parentTaskNum === null) return 0;

  // Prevent infinite loops
  if (visited.has(row.task_number)) return 0;
  visited.add(row.task_number);

  // Find parent header
  const parent = headerMap.get(parentTaskNum);
  if (!parent) return 0; // Parent not found, treat as level 0

  // Level = parent level + 1
  return calculateNestingLevel(parent, headerMap, visited) + 1;
}

/**
 * Build hierarchy rows with nesting levels for table rendering
 *
 * @param rows - Array of rows with task_number, header_gantt, sequence_order, allow_header
 * @returns Array of HierarchyRow objects with nesting metadata
 */
export function buildHierarchyRows<T extends {
  id: number | string;
  task_number: number;
  sequence_order: number;
  header_gantt: string | number | { id: number } | null;
  allow_header?: boolean;
}>(rows: T[]): HierarchyRow<T>[] {
  if (rows.length === 0) return [];

  // Build header map for nesting level calculation
  const headerMap = new Map<number, T>();
  const childrenCount = new Map<number, number>();

  // First pass: identify headers
  for (const row of rows) {
    if (isHeaderRow(row)) {
      headerMap.set(row.task_number, row);
      childrenCount.set(row.task_number, 0);
    }
  }

  // Second pass: count children for each header
  for (const row of rows) {
    const parentNum = getParentTaskNumber(row);
    if (parentNum !== null && parentNum !== row.task_number && headerMap.has(parentNum)) {
      childrenCount.set(parentNum, (childrenCount.get(parentNum) || 0) + 1);
    }
  }

  // Sort hierarchically
  const sortedRows = sortRowsHierarchically(rows);

  // Build result with nesting metadata
  return sortedRows.map(row => ({
    row,
    nestingLevel: calculateNestingLevel(row, headerMap),
    isHeader: isHeaderRow(row),
    parentTaskNumber: getParentTaskNumber(row),
    hasChildren: childrenCount.get(row.task_number) !== undefined &&
                 (childrenCount.get(row.task_number) || 0) > 0,
  }));
}

/**
 * Get collapse state key for a header row
 */
export function getCollapseKey(row: { task_number: number }): string {
  return `hierarchy-${row.task_number}`;
}

/**
 * Filter rows based on collapsed headers
 *
 * @param hierarchyRows - Array of HierarchyRow objects
 * @param collapsedHeaders - Set of collapsed header task_numbers
 * @returns Filtered array with collapsed children hidden
 */
export function filterCollapsedRows<T extends {
  task_number: number;
  header_gantt: string | number | { id: number } | null;
}>(
  hierarchyRows: HierarchyRow<T>[],
  collapsedHeaders: Set<number>
): HierarchyRow<T>[] {
  const result: HierarchyRow<T>[] = [];

  for (const hr of hierarchyRows) {
    // Check if any ancestor is collapsed
    let isHidden = false;
    let checkParent = hr.parentTaskNumber;

    while (checkParent !== null) {
      if (collapsedHeaders.has(checkParent)) {
        isHidden = true;
        break;
      }
      // Find parent's parent
      const parent = hierarchyRows.find(h => h.row.task_number === checkParent);
      checkParent = parent?.parentTaskNumber ?? null;
    }

    if (!isHidden) {
      result.push(hr);
    }
  }

  return result;
}
