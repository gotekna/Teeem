/**
 * Sort Pipeline
 *
 * Pure functions for sorting table rows.
 * No React dependencies - can be used anywhere.
 *
 * Supports:
 * - Multiple sort columns with priority
 * - Ascending/descending direction
 * - Custom sort order
 * - Australian identifier types (ABN, ACN, BSB, TFN, Postcode)
 */

import type { SortColumn } from "../types";

type TableRow = Record<string, unknown>;
type TableColumn = { key: string; column_type?: string };

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
 * Sort rows by multiple columns
 *
 * @param rows - Array of table rows to sort
 * @param sortColumns - Array of sort column configurations
 * @param columns - Column metadata for type information
 * @returns Sorted array (new array, does not mutate input)
 */
export function sortRows<TRow extends TableRow>(
  rows: TRow[],
  sortColumns: SortColumn[],
  columns: TableColumn[] = []
): TRow[] {
  if (sortColumns.length === 0) return rows;

  return [...rows].sort((a, b) => {
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
        const aPos = aIndex === -1 ? customOrder.length : aIndex;
        const bPos = bIndex === -1 ? customOrder.length : bIndex;
        comparison = aPos - bPos;
      } else {
        // Check if column is an Australian identifier type
        const columnMeta = columns.find((c) => c.key === column);
        const australianIdTypes = ["abn", "acn", "bsb", "tfn", "postcode"];

        if (columnMeta && australianIdTypes.includes(columnMeta.column_type || "")) {
          // Strip non-digits and compare numerically
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

// Backward compatibility alias
export const applySorting = sortRows;
