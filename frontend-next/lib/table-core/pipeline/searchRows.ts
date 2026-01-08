/**
 * Search Pipeline
 *
 * Pure functions for searching/filtering table rows by text.
 * No React dependencies - can be used anywhere.
 *
 * Supports:
 * - contains: substring match
 * - exact: exact match
 * - starts_with: prefix match
 * - fuzzy: trigram similarity match
 * - regex: regular expression match
 */

import type { SearchMode, SearchOptions } from "../types";

type TableRow = Record<string, unknown>;

/**
 * Simple fuzzy match implementation
 * Checks if all characters in needle appear in haystack in order
 */
function fuzzyMatch(needle: string, haystack: string): boolean {
  const needleLower = needle.toLowerCase();
  const haystackLower = haystack.toLowerCase();

  let needleIdx = 0;
  for (let i = 0; i < haystackLower.length && needleIdx < needleLower.length; i++) {
    if (haystackLower[i] === needleLower[needleIdx]) {
      needleIdx++;
    }
  }

  return needleIdx === needleLower.length;
}

/**
 * Extract searchable text from a cell value
 * Handles lookup objects by extracting display_value, display, name, etc.
 */
function getSearchableText(value: unknown): string {
  if (value == null) return "";

  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const displayValue = obj.display_value || obj.display || obj.name || obj.label || obj.id;
    return String(displayValue ?? "");
  }

  if (Array.isArray(value)) {
    return value.map((item) => getSearchableText(item)).join(" ");
  }

  return String(value);
}

/**
 * Search rows by text query
 *
 * @param rows - Array of table rows to search
 * @param options - Search configuration
 * @returns Filtered array of table rows
 */
export function searchRows<TRow extends TableRow>(
  rows: TRow[],
  options: SearchOptions
): TRow[] {
  const { search, searchMode, columns, searchableColumns, searchAllColumns } = options;

  if (!search) return rows;

  return rows.filter((entry) => {
    return columns.some((col) => {
      if (col.key === "select" || col.key === "actions") return false;
      if (!searchAllColumns && !searchableColumns[col.key]) return false;

      const value = entry[col.key];
      if (value == null) return false;

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

// Backward compatibility alias
export const applySearch = searchRows;

// Export search mode type
export type { SearchMode };
