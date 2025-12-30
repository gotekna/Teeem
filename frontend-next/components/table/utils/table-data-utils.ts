/**
 * Table Data Utilities
 *
 * Pure utility functions for filtering, sorting, grouping, and searching table data.
 * Extracted from TeeemTableView.tsx as part of Phase 2 refactoring.
 *
 * These are pure functions (no React hooks/state) that can be:
 * - Used in useMemo for computed values
 * - Tested independently
 * - Reused across different table implementations
 */

import { TableColumn, TableRow, CascadeFilter, FilterGroup, SortColumn } from "../types";
import { fuzzyMatch } from "./table-utils";

// ============================================================================
// FILTER UTILITIES
// ============================================================================

/**
 * Extract display value from lookup objects
 * Handles objects with display, name, or id properties
 *
 * @example
 * getFilterDisplayValue({ id: 1, name: "House" }) // => "House"
 * getFilterDisplayValue({ display: "Active" }) // => "Active"
 * getFilterDisplayValue("plain string") // => "plain string"
 */
export function getFilterDisplayValue(val: unknown): unknown {
  if (typeof val === "object" && val !== null) {
    const obj = val as { display?: string; name?: string; id?: number };
    return obj.display || obj.name || obj.id;
  }
  return val;
}

/**
 * Evaluate a single filter against an entry
 *
 * @param entry - The table row to evaluate
 * @param filter - The filter condition to apply
 * @returns true if the entry passes the filter
 */
/**
 * Compare values with proper type coercion for booleans
 * Handles: boolean true vs string "true", boolean false vs string "false"
 */
function compareValues(value: unknown, filterValue: unknown): boolean {
  // Handle boolean comparison: boolean true == "true", boolean false == "false"
  if (typeof value === 'boolean') {
    if (filterValue === 'true' || filterValue === true) return value === true;
    if (filterValue === 'false' || filterValue === false) return value === false;
    return false;
  }
  if (typeof filterValue === 'boolean') {
    if (value === 'true' || value === true) return filterValue === true;
    if (value === 'false' || value === false) return filterValue === false;
    return false;
  }
  // Default loose equality for non-boolean values
  return value == filterValue;
}

export function evaluateFilter(entry: TableRow, filter: CascadeFilter): boolean {
  const rawValue = entry[filter.column];
  const filterValue = filter.value;
  const value = getFilterDisplayValue(rawValue);

  // For equality comparisons with lookup objects, compare against ID when filter value is numeric
  // This handles initialFilters like { column: "job_id", value: "46" } where API returns { id: 46, display: "..." }
  const isLookupObject = typeof rawValue === 'object' && rawValue !== null && 'id' in rawValue;
  const filterValueIsNumeric = /^\d+$/.test(String(filterValue));

  // Use ID for comparison if: lookup object + equality operator + numeric filter value
  const valueForEquality = (isLookupObject && filterValueIsNumeric)
    ? (rawValue as { id: number | string }).id
    : value;

  switch (filter.operator) {
    case "=":
      return compareValues(valueForEquality, filterValue);
    case "!=":
      return !compareValues(valueForEquality, filterValue);
    case ">":
      return Number(value) > Number(filterValue);
    case "<":
      return Number(value) < Number(filterValue);
    case ">=":
      return Number(value) >= Number(filterValue);
    case "<=":
      return Number(value) <= Number(filterValue);
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
      // Handle array_contains operator for array columns (e.g., sm_template_ids)
      // Value could be: [1, 2, 3] array, or raw array value
      // Filter value is the ID to check for (as string or number)
      const rawArr = entry[filter.column];
      if (!rawArr) return false;

      // Handle array of IDs
      if (Array.isArray(rawArr)) {
        const targetId = String(filterValue);
        return rawArr.some(item => {
          // Item could be object {id, name} or primitive
          if (typeof item === 'object' && item !== null) {
            return String((item as { id?: number }).id) === targetId;
          }
          return String(item) === targetId;
        });
      }

      // Handle comma-separated string (legacy format)
      if (typeof rawArr === 'string') {
        const ids = rawArr.split(',').map(s => s.trim());
        return ids.includes(String(filterValue));
      }

      return false;
    }
    case "array_not_contains": {
      // Inverse of array_contains
      const rawArr = entry[filter.column];
      if (!rawArr) return true; // Empty array doesn't contain the value

      if (Array.isArray(rawArr)) {
        const targetId = String(filterValue);
        return !rawArr.some(item => {
          if (typeof item === 'object' && item !== null) {
            return String((item as { id?: number }).id) === targetId;
          }
          return String(item) === targetId;
        });
      }

      if (typeof rawArr === 'string') {
        const ids = rawArr.split(',').map(s => s.trim());
        return !ids.includes(String(filterValue));
      }

      return true;
    }
    default:
      return true;
  }
}

/**
 * Apply cascade filters to entries
 *
 * Filters support:
 * - Multiple filter groups with AND/OR logic within each group
 * - Inter-group logic (AND/OR between groups)
 *
 * @param entries - Array of table rows to filter
 * @param filters - Array of cascade filters
 * @param filterGroups - Filter group definitions with logic (AND/OR)
 * @param interGroupLogic - Logic between groups ("AND" | "OR")
 * @returns Filtered array of table rows
 */
export function applyFilters(
  entries: TableRow[],
  filters: CascadeFilter[],
  filterGroups: FilterGroup[],
  interGroupLogic: "AND" | "OR"
): TableRow[] {
  if (filters.length === 0) return entries;

  // Pre-compute filter groups ONCE outside the row loop (performance optimization)
  const filtersByGroup = filters.reduce((acc, filter) => {
    const groupId = filter.groupId || "default";
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(filter);
    return acc;
  }, {} as Record<string, CascadeFilter[]>);

  // Pre-compute group logic map for O(1) lookup
  const groupLogicMap = new Map(filterGroups.map((g) => [g.id, g.logic]));
  const groupEntries = Object.entries(filtersByGroup);

  return entries.filter((entry) => {
    // Evaluate each group
    const groupResults = groupEntries.map(([groupId, groupFilters]) => {
      const logic = groupLogicMap.get(groupId) || "AND";

      if (logic === "AND") {
        return groupFilters.every((filter) => evaluateFilter(entry, filter));
      } else {
        return groupFilters.some((filter) => evaluateFilter(entry, filter));
      }
    });

    // Combine group results
    if (interGroupLogic === "AND") {
      return groupResults.every(Boolean);
    } else {
      return groupResults.some(Boolean);
    }
  });
}

// ============================================================================
// SEARCH UTILITIES
// ============================================================================

export type SearchMode = "contains" | "exact" | "starts_with" | "fuzzy" | "regex";

interface SearchOptions {
  search: string;
  searchMode: SearchMode;
  columns: TableColumn[];
  searchableColumns: Record<string, boolean>;
  searchAllColumns: boolean;
}

/**
 * Extract searchable text from a cell value
 * Handles lookup objects by extracting display_value, display, name, etc.
 */
function getSearchableText(value: unknown): string {
  if (value == null) return "";

  // Handle lookup objects (from expanded relationships like linked_company)
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    // Try common display fields in priority order
    const displayValue = obj.display_value || obj.display || obj.name || obj.label || obj.id;
    return String(displayValue ?? "");
  }

  // Handle arrays (multi-select lookups)
  if (Array.isArray(value)) {
    return value.map((item) => getSearchableText(item)).join(" ");
  }

  return String(value);
}

/**
 * Apply search to entries (client-side filtering)
 *
 * Supports multiple search modes:
 * - contains: substring match
 * - exact: exact match
 * - starts_with: prefix match
 * - fuzzy: trigram similarity match
 * - regex: regular expression match
 *
 * @param entries - Array of table rows to search
 * @param options - Search configuration
 * @returns Filtered array of table rows
 */
export function applySearch(entries: TableRow[], options: SearchOptions): TableRow[] {
  const { search, searchMode, columns, searchableColumns, searchAllColumns } = options;

  if (!search) return entries;

  return entries.filter((entry) => {
    return columns.some((col) => {
      if (col.key === "select" || col.key === "actions") return false;
      // If not "search all columns", only search columns marked as searchable
      if (!searchAllColumns && !searchableColumns[col.key]) return false;

      const value = entry[col.key];
      if (value == null) return false;

      // Use helper to extract searchable text from lookup objects
      const strValue = getSearchableText(value).toLowerCase();
      if (!strValue) return false;

      const searchLower = search.toLowerCase();

      switch (searchMode) {
        case "contains":
          return strValue.includes(searchLower);
        case "exact":
          return strValue === searchLower;
        case "starts_with":
          return strValue.startsWith(searchLower);
        case "fuzzy":
          return fuzzyMatch(search, getSearchableText(value));
        case "regex":
          try {
            const regex = new RegExp(search, "i");
            return regex.test(strValue);
          } catch {
            return strValue.includes(searchLower);
          }
        default:
          return strValue.includes(searchLower);
      }
    });
  });
}

// ============================================================================
// SORTING UTILITIES
// ============================================================================

/**
 * Get display value from a cell value (handles lookup objects)
 */
function getSortDisplayValue(val: unknown): string {
  if (typeof val === "object" && val !== null) {
    const obj = val as { display?: string; name?: string; id?: number };
    return obj.display || obj.name || String(obj.id || "");
  }
  return String(val);
}

/**
 * Apply sorting to entries
 *
 * Supports:
 * - Multiple sort columns with priority
 * - Ascending/descending direction
 * - Custom sort order
 * - Australian identifier types (ABN, ACN, BSB, TFN, Postcode)
 *
 * @param entries - Array of table rows to sort
 * @param sortColumns - Array of sort column configurations
 * @param columns - Column metadata for type information
 * @returns Sorted array of table rows (new array, does not mutate input)
 */
export function applySorting(
  entries: TableRow[],
  sortColumns: SortColumn[],
  columns: TableColumn[]
): TableRow[] {
  if (sortColumns.length === 0) return entries;

  return [...entries].sort((a, b) => {
    for (const { column, dir, customOrder } of sortColumns) {
      const aVal = a[column];
      const bVal = b[column];

      if (aVal == null && bVal == null) continue;
      if (aVal == null) return dir === "asc" ? 1 : -1;
      if (bVal == null) return dir === "asc" ? -1 : 1;

      const aDisplay = getSortDisplayValue(aVal);
      const bDisplay = getSortDisplayValue(bVal);

      let comparison = 0;

      if (dir === "custom" && customOrder && customOrder.length > 0) {
        // Custom sort order - use position in customOrder array
        const aIndex = customOrder.indexOf(aDisplay);
        const bIndex = customOrder.indexOf(bDisplay);
        // Items not in custom order go to the end
        const aPos = aIndex === -1 ? customOrder.length : aIndex;
        const bPos = bIndex === -1 ? customOrder.length : bIndex;
        comparison = aPos - bPos;
      } else {
        // Check if column is an Australian identifier type that needs numeric sorting
        const columnMeta = columns.find((c) => c.key === column);
        const australianIdTypes = ["abn", "acn", "bsb", "tfn", "postcode"];

        if (columnMeta && australianIdTypes.includes(columnMeta.column_type || "")) {
          // Strip non-digits and compare numerically for Australian identifiers
          const aNum = parseInt(String(aVal).replace(/\D/g, ""), 10);
          const bNum = parseInt(String(bVal).replace(/\D/g, ""), 10);
          comparison = aNum - bNum;
        } else if (typeof aVal === "number" && typeof bVal === "number") {
          comparison = aVal - bVal;
        } else {
          comparison = aDisplay.localeCompare(bDisplay);
        }
      }

      if (comparison !== 0) {
        return dir === "desc" ? -comparison : comparison;
      }
    }
    return 0;
  });
}

// ============================================================================
// GROUPING UTILITIES
// ============================================================================

/**
 * Nested group structure type
 */
export interface NestedGroup {
  rows: TableRow[];
  subgroups?: Record<string, NestedGroup>;
}

export type GroupedEntries = Record<string, NestedGroup>;

interface ServerGroupCount {
  key: string | null;
  count: number;
}

/**
 * Extract display value from a cell for grouping
 */
export function getGroupDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "No Value";
  // Handle arrays - join as comma-separated string
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value.map((item) => String(item)).join(", ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // IMPORTANT: For lookup objects, use ID as key to match server group counts
    // The display name is shown via serverDisplayMap in the UI
    // This ensures groups from data match groups from server (both keyed by ID)
    if (obj.id !== undefined) {
      return String(obj.id);
    }
    return String(obj.display || obj.display_value || obj.name || "No Value");
  }
  return String(value);
}

/**
 * Build grouped entries structure (hierarchical)
 *
 * Supports:
 * - Multiple levels of grouping (nested)
 * - Custom sort order for groups
 * - Server-provided group counts for lazy loading
 *
 * @param entries - Array of table rows to group
 * @param groupByColumns - Column keys to group by (in order)
 * @param sortColumns - Sort configurations for custom group ordering
 * @param serverGroupCounts - Optional server-provided group counts
 * @param search - Current search term (used to skip server group merging during search)
 * @returns Grouped entries structure or null if no grouping
 */
export function buildGroupedEntries(
  entries: TableRow[],
  groupByColumns: string[],
  sortColumns: SortColumn[],
  serverGroupCounts: ServerGroupCount[] = [],
  search: string = ""
): GroupedEntries | null {
  if (groupByColumns.length === 0) {
    return null;
  }

  // Helper to get customOrder for a column from sortColumns
  const getCustomOrderForColumn = (columnName: string): string[] | undefined => {
    const sortConfig = sortColumns.find((s) => s.column === columnName);
    return sortConfig?.customOrder;
  };

  // Helper to sort group keys by customOrder
  const sortGroupKeys = (keys: string[], customOrder: string[] | undefined): string[] => {
    if (!customOrder || customOrder.length === 0) {
      return keys; // No custom order, keep insertion order
    }
    return [...keys].sort((a, b) => {
      const aIndex = customOrder.indexOf(a);
      const bIndex = customOrder.indexOf(b);
      // Items not in customOrder go to the end
      const aPos = aIndex === -1 ? customOrder.length + keys.indexOf(a) : aIndex;
      const bPos = bIndex === -1 ? customOrder.length + keys.indexOf(b) : bIndex;
      return aPos - bPos;
    });
  };

  const buildNestedGroups = (
    groupEntries: TableRow[],
    columns: string[],
    depth: number = 0
  ): Record<string, NestedGroup> => {
    if (columns.length === 0 || depth >= columns.length) {
      return {};
    }

    const currentCol = columns[depth];
    const unsortedGroups: Record<string, NestedGroup> = {};

    for (const entry of groupEntries) {
      const groupKey = getGroupDisplayValue(entry[currentCol]);
      if (!unsortedGroups[groupKey]) {
        unsortedGroups[groupKey] = { rows: [] };
      }
      unsortedGroups[groupKey].rows.push(entry);
    }

    // Sort group keys by customOrder if available for this column
    const customOrder = getCustomOrderForColumn(currentCol);
    const sortedKeys = sortGroupKeys(Object.keys(unsortedGroups), customOrder);

    // Rebuild groups object with sorted keys (maintains order)
    const groups: Record<string, NestedGroup> = {};
    for (const key of sortedKeys) {
      groups[key] = unsortedGroups[key];
    }

    // If there are more columns, recursively build subgroups
    if (depth < columns.length - 1) {
      for (const [key, group] of Object.entries(groups)) {
        group.subgroups = buildNestedGroups(group.rows, columns, depth + 1);
      }
    }

    return groups;
  };

  const result = buildNestedGroups(entries, groupByColumns, 0);

  // IMPORTANT: Merge in server groups that aren't in loaded data
  // This ensures ALL groups appear in the UI, even if their records haven't been loaded yet
  // Only applies to first-level grouping (depth 0)
  // SKIP when searching - server counts don't include search term, so only show client-filtered results
  if (serverGroupCounts.length > 0 && groupByColumns.length > 0 && !search) {
    for (const serverGroup of serverGroupCounts) {
      const key = serverGroup.key === null ? "(Empty)" : String(serverGroup.key);
      if (!result[key]) {
        // Add empty group placeholder - rows will be lazy-loaded when expanded
        result[key] = { rows: [] };
      }
    }
  }

  return result;
}

/**
 * Get all group keys from a grouped entries structure (flattened)
 *
 * @param groups - Grouped entries structure
 * @param parentKey - Parent key prefix for nested groups
 * @returns Array of all group keys (e.g., ["Status: Active", "Status: Active›Priority: High"])
 */
export function getAllGroupKeys(groups: GroupedEntries, parentKey: string = ""): string[] {
  const keys: string[] = [];

  for (const [groupKey, group] of Object.entries(groups)) {
    const fullKey = parentKey ? `${parentKey}›${groupKey}` : groupKey;
    keys.push(fullKey);

    if (group.subgroups && Object.keys(group.subgroups).length > 0) {
      keys.push(...getAllGroupKeys(group.subgroups, fullKey));
    }
  }

  return keys;
}

/**
 * Get visible row IDs from grouped entries (respecting collapsed state)
 *
 * @param groups - Grouped entries structure
 * @param collapsedGroups - Set of collapsed group keys
 * @param parentKey - Parent key prefix for nested groups
 * @returns Array of visible row IDs
 */
export function getVisibleRowIdsFromGroups(
  groups: GroupedEntries,
  collapsedGroups: Set<string>,
  parentKey: string = ""
): (number | string)[] {
  const visibleRowIds: (number | string)[] = [];

  for (const [groupKey, group] of Object.entries(groups)) {
    const fullKey = parentKey ? `${parentKey}›${groupKey}` : groupKey;
    const isCollapsed = collapsedGroups.has(fullKey);

    if (!isCollapsed) {
      if (group.subgroups && Object.keys(group.subgroups).length > 0) {
        visibleRowIds.push(...getVisibleRowIdsFromGroups(group.subgroups, collapsedGroups, fullKey));
      } else {
        visibleRowIds.push(...group.rows.map((r) => r.id));
      }
    }
  }

  return visibleRowIds;
}
