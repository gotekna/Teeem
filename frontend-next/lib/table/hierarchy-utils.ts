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
 * Natural alphabetical compare for sorting
 */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Get display name from row for sorting
 */
function getRowName(row: { name?: unknown }): string {
  if (typeof row.name === 'string') return row.name;
  if (row.name != null) return String(row.name);
  return '';
}

/**
 * Build hierarchy rows with nesting levels for table rendering
 *
 * Sorting:
 * - Headers sorted alphabetically by name
 * - Children under each header sorted alphabetically
 * - Orphan rows (no header) grouped at end under "(No Header)"
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
  name?: unknown;
}>(rows: T[]): HierarchyRow<T>[] {
  if (rows.length === 0) return [];

  // Build header map for nesting level calculation
  const headerMap = new Map<number, T>();
  const childrenByParent = new Map<number, T[]>();

  // First pass: identify headers and build children map
  for (const row of rows) {
    if (isHeaderRow(row)) {
      headerMap.set(row.task_number, row);
      childrenByParent.set(row.task_number, []);
    }
  }

  // Second pass: assign children to parents, track orphans
  const orphanRows: T[] = [];

  for (const row of rows) {
    // Skip top-level headers (they're parents, not children)
    if (row.header_gantt === 'Header') continue;

    const parentNum = getParentTaskNumber(row);

    if (parentNum !== null && parentNum !== row.task_number && headerMap.has(parentNum)) {
      // Has a valid parent header
      childrenByParent.get(parentNum)!.push(row);
    } else if (!isHeaderRow(row)) {
      // No parent and not a header = orphan
      orphanRows.push(row);
    }
  }

  // Sort children alphabetically within each header
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => naturalCompare(getRowName(a), getRowName(b)));
  }

  // Sort orphans alphabetically
  orphanRows.sort((a, b) => naturalCompare(getRowName(a), getRowName(b)));

  // Get top-level headers (header_gantt === 'Header') and sort alphabetically
  const topLevelHeaders = rows
    .filter(r => r.header_gantt === 'Header')
    .sort((a, b) => naturalCompare(getRowName(a), getRowName(b)));

  // Build result array with proper ordering
  const result: HierarchyRow<T>[] = [];
  const processed = new Set<number>();

  // Recursive function to emit header and its children
  const emitHeaderWithChildren = (header: T, level: number) => {
    if (processed.has(header.task_number)) return;
    processed.add(header.task_number);

    const children = childrenByParent.get(header.task_number) || [];
    const hasChildren = children.length > 0;

    // Emit the header
    result.push({
      row: header,
      nestingLevel: level,
      isHeader: true,
      parentTaskNumber: getParentTaskNumber(header),
      hasChildren,
    });

    // Emit children (sorted alphabetically)
    for (const child of children) {
      if (processed.has(child.task_number)) continue;

      if (isHeaderRow(child)) {
        // Child is also a header - recurse
        emitHeaderWithChildren(child, level + 1);
      } else {
        // Regular child row
        processed.add(child.task_number);
        result.push({
          row: child,
          nestingLevel: level + 1,
          isHeader: false,
          parentTaskNumber: header.task_number,
          hasChildren: false,
        });
      }
    }
  };

  // Emit all top-level headers with their children
  for (const header of topLevelHeaders) {
    emitHeaderWithChildren(header, 0);
  }

  // Emit orphan rows at the end (no header group)
  for (const orphan of orphanRows) {
    if (processed.has(orphan.task_number)) continue;
    processed.add(orphan.task_number);
    result.push({
      row: orphan,
      nestingLevel: 0,
      isHeader: false,
      parentTaskNumber: null,
      hasChildren: false,
    });
  }

  return result;
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
