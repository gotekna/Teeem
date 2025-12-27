/**
 * Filter Evaluator
 *
 * Extracts the complex filter evaluation logic from TeeemTableView.
 * Handles:
 * - 12 filter operators (=, !=, >, <, >=, <=, contains, not_contains, starts_with, ends_with, is_empty, is_not_empty)
 * - Filter groups with AND/OR logic within groups
 * - Inter-group logic (AND/OR between groups)
 * - Client-side search filtering
 *
 * Performance optimized:
 * - Pre-computes filter groups outside the row loop
 * - Uses Map for O(1) group logic lookup
 */

import type { TableRow } from '../../types';

export interface CascadeFilter {
  id: string | number;
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'is_empty' | 'is_not_empty';
  value: unknown;
  groupId?: string | number;
}

export interface FilterGroup {
  id: string | number;
  name: string;
  filters: CascadeFilter[];
  logic: 'AND' | 'OR';
}

/**
 * Extract display value from lookup objects for filtering
 *
 * Handles objects like { id: 1, name: "House" } -> "House"
 *
 * @param val - Raw value from table row
 * @returns Displayable value for filtering
 */
function getFilterDisplayValue(val: unknown): unknown {
  if (typeof val === 'object' && val !== null) {
    const obj = val as { display?: string; name?: string; id?: number };
    return obj.display || obj.name || obj.id;
  }
  return val;
}

/**
 * Evaluate a single filter against a table row
 *
 * Supports 12 operators with proper type coercion and case-insensitive string matching.
 *
 * @param entry - Table row to evaluate
 * @param filter - Filter to apply
 * @returns True if row matches filter
 */
export function evaluateSingleFilter(entry: TableRow, filter: CascadeFilter): boolean {
  const rawValue = entry[filter.column];
  const filterValue = filter.value;
  const value = getFilterDisplayValue(rawValue);

  switch (filter.operator) {
    case '=':
      return value == filterValue;

    case '!=':
      return value != filterValue;

    case '>':
      return Number(value) > Number(filterValue);

    case '<':
      return Number(value) < Number(filterValue);

    case '>=':
      return Number(value) >= Number(filterValue);

    case '<=':
      return Number(value) <= Number(filterValue);

    case 'contains':
      return String(value ?? '')
        .toLowerCase()
        .includes(String(filterValue).toLowerCase());

    case 'not_contains':
      return !String(value ?? '')
        .toLowerCase()
        .includes(String(filterValue).toLowerCase());

    case 'starts_with':
      return String(value ?? '')
        .toLowerCase()
        .startsWith(String(filterValue).toLowerCase());

    case 'ends_with':
      return String(value ?? '')
        .toLowerCase()
        .endsWith(String(filterValue).toLowerCase());

    case 'is_empty':
      return value == null || value === '';

    case 'is_not_empty':
      return value != null && value !== '';

    default:
      return true;
  }
}

/**
 * Evaluate a filter group against a table row
 *
 * Applies AND/OR logic within the group.
 *
 * @param entry - Table row to evaluate
 * @param filters - Filters in this group
 * @param logic - AND or OR logic
 * @returns True if row matches group
 */
export function evaluateFilterGroup(
  entry: TableRow,
  filters: CascadeFilter[],
  logic: 'AND' | 'OR'
): boolean {
  if (filters.length === 0) return true;

  if (logic === 'AND') {
    return filters.every((filter) => evaluateSingleFilter(entry, filter));
  } else {
    return filters.some((filter) => evaluateSingleFilter(entry, filter));
  }
}

/**
 * Evaluate all filter groups against a table row
 *
 * Performance optimized:
 * - Pre-computes filter groups by groupId
 * - Pre-computes group logic map for O(1) lookup
 * - Short-circuits on first failed AND or first successful OR
 *
 * @param entry - Table row to evaluate
 * @param filters - All filters (with optional groupId)
 * @param filterGroups - Filter group definitions
 * @param interGroupLogic - AND or OR logic between groups
 * @returns True if row matches all filter criteria
 */
export function evaluateAllFilters(
  entry: TableRow,
  filters: CascadeFilter[],
  filterGroups: FilterGroup[],
  interGroupLogic: 'AND' | 'OR'
): boolean {
  if (filters.length === 0) return true;

  // Group filters by groupId (performance optimization - done once per filtering operation)
  const filtersByGroup = filters.reduce((acc, filter) => {
    const groupId = filter.groupId || 'default';
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(filter);
    return acc;
  }, {} as Record<string, CascadeFilter[]>);

  // Create group logic map for O(1) lookup
  const groupLogicMap = new Map(filterGroups.map((g) => [g.id, g.logic]));

  // Evaluate each group
  const groupEntries = Object.entries(filtersByGroup);
  const groupResults = groupEntries.map(([groupId, groupFilters]) => {
    const logic = groupLogicMap.get(groupId) || 'AND';
    return evaluateFilterGroup(entry, groupFilters, logic);
  });

  // Combine group results with inter-group logic
  if (interGroupLogic === 'AND') {
    return groupResults.every(Boolean);
  } else {
    return groupResults.some(Boolean);
  }
}

// NOTE: Search filtering is handled by TeeemTableView directly with full search mode support
// (contains, exact, starts_with, fuzzy, regex). See TeeemTableView.tsx filteredAndSortedEntries.
//
// The cascade filter functions above (evaluateSingleFilter, evaluateFilterGroup, evaluateAllFilters)
// are still used by TeeemTableView for applying cascade filters.
