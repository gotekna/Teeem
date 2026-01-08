/**
 * Filter Pipeline
 *
 * Pure functions for filtering table rows based on cascade filters.
 * No React dependencies - can be used anywhere.
 *
 * Supports:
 * - Multiple filter groups with AND/OR logic
 * - Inter-group logic (AND/OR between groups)
 * - Various operators: =, !=, >, <, contains, is_empty, array_contains, etc.
 */

import type { CascadeFilter, FilterGroup } from "../types";

type TableRow = Record<string, unknown>;

/**
 * Parse a numeric filter value, handling percentage symbols
 */
function parseNumericFilterValue(filterValue: unknown): number {
  const str = String(filterValue).trim();
  const cleaned = str.replace(/%$/, "");
  return Number(cleaned);
}

/**
 * Compare numeric values for percentage columns
 * Handles decimal storage (0.99 = 99%) vs whole number storage (99 = 99%)
 */
function compareNumericValues(rawValue: number, filterValue: number, operator: string): boolean {
  let compareValue = filterValue;

  if (rawValue >= 0 && rawValue <= 1 && filterValue > 1) {
    compareValue = filterValue / 100;
  }

  switch (operator) {
    case ">":
      return rawValue > compareValue;
    case "<":
      return rawValue < compareValue;
    case ">=":
      return rawValue >= compareValue;
    case "<=":
      return rawValue <= compareValue;
    default:
      return false;
  }
}

/**
 * Extract display value from lookup objects
 */
export function getFilterDisplayValue(val: unknown): unknown {
  if (typeof val === "object" && val !== null) {
    const obj = val as { display?: string; name?: string; id?: number };
    return obj.display || obj.name || obj.id;
  }
  return val;
}

/**
 * Compare values with proper type coercion for booleans
 */
function compareValues(value: unknown, filterValue: unknown): boolean {
  if (typeof value === "boolean") {
    if (filterValue === "true" || filterValue === true) return value === true;
    if (filterValue === "false" || filterValue === false) return value === false;
    return false;
  }
  if (typeof filterValue === "boolean") {
    if (value === "true" || value === true) return filterValue === true;
    if (value === "false" || value === false) return filterValue === false;
    return false;
  }
  return value == filterValue;
}

/**
 * Evaluate a single filter against a row
 *
 * @param entry - The table row to evaluate
 * @param filter - The filter condition to apply
 * @returns true if the row passes the filter
 */
export function evaluateFilter(entry: TableRow, filter: CascadeFilter): boolean {
  const rawValue = entry[filter.column];
  const filterValue = filter.value;
  const value = getFilterDisplayValue(rawValue);

  const isLookupObject = typeof rawValue === "object" && rawValue !== null && "id" in rawValue;
  const filterValueIsNumeric = /^\d+$/.test(String(filterValue));

  const valueForEquality =
    isLookupObject && filterValueIsNumeric
      ? (rawValue as { id: number | string }).id
      : value;

  switch (filter.operator) {
    case "=":
      return compareValues(valueForEquality, filterValue);
    case "!=":
      return !compareValues(valueForEquality, filterValue);
    case ">":
    case "<":
    case ">=":
    case "<=":
      return compareNumericValues(
        Number(value),
        parseNumericFilterValue(filterValue),
        filter.operator
      );
    case "contains":
      return String(value ?? "")
        .toLowerCase()
        .includes(String(filterValue).toLowerCase());
    case "not_contains":
      return !String(value ?? "")
        .toLowerCase()
        .includes(String(filterValue).toLowerCase());
    case "starts_with":
      return String(value ?? "")
        .toLowerCase()
        .startsWith(String(filterValue).toLowerCase());
    case "ends_with":
      return String(value ?? "")
        .toLowerCase()
        .endsWith(String(filterValue).toLowerCase());
    case "is_empty":
      return value == null || value === "";
    case "is_not_empty":
      return value != null && value !== "";
    case "array_contains": {
      const rawArr = entry[filter.column];
      if (!rawArr) return false;

      if (Array.isArray(rawArr)) {
        const targetId = String(filterValue);
        return rawArr.some((item) => {
          if (typeof item === "object" && item !== null) {
            return String((item as { id?: number }).id) === targetId;
          }
          return String(item) === targetId;
        });
      }

      if (typeof rawArr === "string") {
        const ids = rawArr.split(",").map((s) => s.trim());
        return ids.includes(String(filterValue));
      }

      return false;
    }
    case "array_not_contains": {
      const rawArr = entry[filter.column];
      if (!rawArr) return true;

      if (Array.isArray(rawArr)) {
        const targetId = String(filterValue);
        return !rawArr.some((item) => {
          if (typeof item === "object" && item !== null) {
            return String((item as { id?: number }).id) === targetId;
          }
          return String(item) === targetId;
        });
      }

      if (typeof rawArr === "string") {
        const ids = rawArr.split(",").map((s) => s.trim());
        return !ids.includes(String(filterValue));
      }

      return true;
    }
    default:
      return true;
  }
}

/**
 * Apply cascade filters to rows
 *
 * @param rows - Array of table rows to filter
 * @param filters - Array of cascade filters
 * @param filterGroups - Filter group definitions with logic
 * @param interGroupLogic - Logic between groups ("AND" | "OR")
 * @returns Filtered array of table rows
 */
export function filterRows<TRow extends TableRow>(
  rows: TRow[],
  filters: CascadeFilter[],
  filterGroups: FilterGroup[] = [],
  interGroupLogic: "AND" | "OR" = "AND"
): TRow[] {
  if (filters.length === 0) return rows;

  // Pre-compute filter groups ONCE outside the row loop
  const filtersByGroup = filters.reduce(
    (acc, filter) => {
      const groupId = filter.groupId || "default";
      if (!acc[groupId]) acc[groupId] = [];
      acc[groupId].push(filter);
      return acc;
    },
    {} as Record<string, CascadeFilter[]>
  );

  const groupLogicMap = new Map(filterGroups.map((g) => [g.id, g.logic]));
  const groupEntries = Object.entries(filtersByGroup);

  return rows.filter((entry) => {
    const groupResults = groupEntries.map(([groupId, groupFilters]) => {
      const logic = groupLogicMap.get(groupId) || "AND";

      if (logic === "AND") {
        return groupFilters.every((filter) => evaluateFilter(entry, filter));
      } else {
        return groupFilters.some((filter) => evaluateFilter(entry, filter));
      }
    });

    if (interGroupLogic === "AND") {
      return groupResults.every(Boolean);
    } else {
      return groupResults.some(Boolean);
    }
  });
}

// Backward compatibility alias
export const applyFilters = filterRows;
