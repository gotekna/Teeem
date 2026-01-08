/**
 * Group Pipeline
 *
 * Pure functions for grouping table rows hierarchically.
 * No React dependencies - can be used anywhere.
 *
 * Supports:
 * - Multiple levels of grouping (nested)
 * - Custom sort order for groups
 * - Server-provided group counts for lazy loading
 * - Special handling for Company/Role views
 */

import type { SortColumn, NestedGroup, GroupedEntries, ServerGroupCount } from "../types";

type TableRow = Record<string, unknown>;

/**
 * Extract display value from a cell for grouping
 */
export function getGroupDisplayValue(value: unknown): string {
  if (value === null || value === undefined) return "(Empty)";

  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return value.map((item) => String(item)).join(", ");
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    // Use ID as key to match server group counts
    if (obj.id !== undefined) {
      return String(obj.id);
    }
    return String(obj.display || obj.display_value || obj.name || "(Empty)");
  }

  return String(value);
}

/**
 * Build grouped entries structure (hierarchical)
 *
 * @param rows - Array of table rows to group
 * @param groupByColumns - Column keys to group by (in order)
 * @param sortColumns - Sort configurations for custom group ordering
 * @param serverGroupCounts - Optional server-provided group counts
 * @param search - Current search term (skip server group merging during search)
 * @returns Grouped entries structure or null if no grouping
 */
export function groupRows<TRow extends TableRow>(
  rows: TRow[],
  groupByColumns: string[],
  sortColumns: SortColumn[] = [],
  serverGroupCounts: ServerGroupCount[] = [],
  search: string = ""
): GroupedEntries<TRow> | null {
  if (groupByColumns.length === 0) {
    return null;
  }

  const getCustomOrderForColumn = (columnName: string): string[] | undefined => {
    const sortConfig = sortColumns.find((s) => s.column === columnName);
    return sortConfig?.customOrder;
  };

  const sortGroupKeys = (keys: string[], customOrder: string[] | undefined): string[] => {
    if (!customOrder || customOrder.length === 0) {
      return keys;
    }
    return [...keys].sort((a, b) => {
      const aIndex = customOrder.indexOf(a);
      const bIndex = customOrder.indexOf(b);
      const aPos = aIndex === -1 ? customOrder.length + keys.indexOf(a) : aIndex;
      const bPos = bIndex === -1 ? customOrder.length + keys.indexOf(b) : bIndex;
      return aPos - bPos;
    });
  };

  const buildNestedGroups = (
    groupEntries: TRow[],
    columns: string[],
    depth: number = 0
  ): Record<string, NestedGroup<TRow>> => {
    if (columns.length === 0 || depth >= columns.length) {
      return {};
    }

    const currentCol = columns[depth];
    const unsortedGroups: Record<string, NestedGroup<TRow>> = {};

    // Special handling for Company/Role views
    const isGroupingByCompany = currentCol.includes("company") || currentCol.includes("employer");
    const companiesInData: TRow[] = [];

    for (const entry of groupEntries) {
      if (isGroupingByCompany && entry.entity_type === "company") {
        companiesInData.push(entry);
        continue;
      }

      // Handle employer_ids array for multi-employer support
      if (
        isGroupingByCompany &&
        Array.isArray(entry.employer_ids) &&
        (entry.employer_ids as unknown[]).length > 0
      ) {
        for (const employerId of entry.employer_ids as (string | number)[]) {
          const groupKey = String(employerId);
          if (!unsortedGroups[groupKey]) {
            unsortedGroups[groupKey] = { rows: [] };
          }
          unsortedGroups[groupKey].rows.push(entry);
        }
        continue;
      }

      const groupKey = getGroupDisplayValue(entry[currentCol]);
      if (!unsortedGroups[groupKey]) {
        unsortedGroups[groupKey] = { rows: [] };
      }
      unsortedGroups[groupKey].rows.push(entry);
    }

    // Handle companies without employees
    if (isGroupingByCompany && companiesInData.length > 0) {
      for (const company of companiesInData) {
        const companyId = String(company.id);
        if (unsortedGroups[companyId]) {
          continue; // Company is a group header via its employees
        }
        const noValueKey = "(Empty)";
        if (!unsortedGroups[noValueKey]) {
          unsortedGroups[noValueKey] = { rows: [] };
        }
        unsortedGroups[noValueKey].rows.push(company);
      }
    }

    // Sort group keys
    const customOrder = getCustomOrderForColumn(currentCol);
    const sortedKeys = sortGroupKeys(Object.keys(unsortedGroups), customOrder);

    const groups: Record<string, NestedGroup<TRow>> = {};
    for (const key of sortedKeys) {
      groups[key] = unsortedGroups[key];
    }

    // Recursively build subgroups
    if (depth < columns.length - 1) {
      for (const [key, group] of Object.entries(groups)) {
        group.subgroups = buildNestedGroups(group.rows, columns, depth + 1);
      }
    }

    return groups;
  };

  const result = buildNestedGroups(rows, groupByColumns, 0);

  // Merge in server groups for lazy loading (skip during search)
  if (serverGroupCounts.length > 0 && groupByColumns.length > 0 && !search) {
    for (const serverGroup of serverGroupCounts) {
      const key = serverGroup.key === null ? "(Empty)" : String(serverGroup.key);
      if (!result[key]) {
        result[key] = { rows: [] };
      }
    }
  }

  return result as GroupedEntries<TRow>;
}

/**
 * Get all group keys from a grouped entries structure (flattened)
 */
export function getAllGroupKeys<TRow extends TableRow>(
  groups: GroupedEntries<TRow>,
  parentKey: string = ""
): string[] {
  const keys: string[] = [];

  for (const [groupKey, group] of Object.entries(groups)) {
    const fullKey = parentKey ? `${parentKey}›${groupKey}` : groupKey;
    keys.push(fullKey);

    if (group.subgroups && Object.keys(group.subgroups).length > 0) {
      keys.push(...getAllGroupKeys(group.subgroups as GroupedEntries<TRow>, fullKey));
    }
  }

  return keys;
}

/**
 * Get visible row IDs from grouped entries (respecting collapsed state)
 */
export function getVisibleRowIdsFromGroups<TRow extends TableRow & { id: string | number }>(
  groups: GroupedEntries<TRow>,
  collapsedGroups: Set<string>,
  parentKey: string = ""
): (number | string)[] {
  const visibleRowIds: (number | string)[] = [];

  for (const [groupKey, group] of Object.entries(groups)) {
    const fullKey = parentKey ? `${parentKey}›${groupKey}` : groupKey;
    const isCollapsed = collapsedGroups.has(fullKey);

    if (!isCollapsed) {
      if (group.subgroups && Object.keys(group.subgroups).length > 0) {
        visibleRowIds.push(
          ...getVisibleRowIdsFromGroups(
            group.subgroups as GroupedEntries<TRow>,
            collapsedGroups,
            fullKey
          )
        );
      } else {
        visibleRowIds.push(...group.rows.map((r) => r.id));
      }
    }
  }

  return visibleRowIds;
}

// Backward compatibility alias
export const buildGroupedEntries = groupRows;
