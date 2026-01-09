/**
 * Table Data Utilities
 *
 * BACKWARD COMPATIBILITY LAYER
 * ============================
 * This file re-exports from the headless core at lib/table-core/
 * for backward compatibility with existing imports.
 *
 * SSoT: lib/table-core/pipeline/ contains the canonical implementations.
 *
 * New code should import directly from '@/lib/table-core':
 * ```typescript
 * import { filterRows, sortRows, searchRows, groupRows } from '@/lib/table-core';
 * ```
 */

// Re-export everything from the headless core
export {
  // Filter
  filterRows,
  applyFilters,
  evaluateFilter,
  getFilterDisplayValue,
  // Sort
  sortRows,
  applySorting,
  // Search
  searchRows,
  applySearch,
  // Group
  groupRows,
  buildGroupedEntries,
  getAllGroupKeys,
  getVisibleRowIdsFromGroups,
  getGroupDisplayValue,
} from "@/lib/table-core";

// Re-export types
export type {
  SearchMode,
  NestedGroup,
  GroupedEntries,
} from "@/lib/table-core";

// Legacy type alias for backward compatibility
export type { NestedGroup as NestedGroupLegacy } from "@/lib/table-core";
