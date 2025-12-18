/**
 * Shared column utilities for TeeemTableView and GlobalViewsManager
 * Single source of truth for column sorting logic
 */

export interface SortableColumn {
  key?: string;
  column_name?: string;
  label?: string;
  name?: string;
}

/**
 * Get the display name for a column (handles both TeeemTableView and GlobalViewsManager column formats)
 */
export function getColumnDisplayName<T extends SortableColumn>(column: T): string {
  return column.label || column.name || column.key || column.column_name || '';
}

/**
 * Get the column key/identifier (handles both formats)
 */
export function getColumnKey<T extends SortableColumn>(column: T): string {
  return column.key || column.column_name || '';
}

/**
 * Sort columns for modal display:
 * - Visible columns: sorted by their order position
 * - Hidden columns: sorted alphabetically by display name
 *
 * @param columns - All columns
 * @param visibleColumns - Record of column key -> boolean (true = visible)
 * @param columnOrder - Array of column keys in order
 * @returns Sorted array with visible columns first (by order), then hidden columns (alphabetically)
 */
export function sortColumnsForModal<T extends SortableColumn>(
  columns: T[],
  visibleColumns: Record<string, boolean>,
  columnOrder: string[]
): T[] {
  // Safety: ensure columns is an array to prevent .sort() errors
  if (!Array.isArray(columns)) return [];
  const safeColumnOrder = Array.isArray(columnOrder) ? columnOrder : [];
  const orderMap = new Map(safeColumnOrder.map((key, idx) => [key, idx]));

  // Separate visible and hidden columns
  const visibleCols = columns.filter(c => visibleColumns[getColumnKey(c)] === true);
  const hiddenCols = columns.filter(c => visibleColumns[getColumnKey(c)] !== true);

  // Sort visible columns by their order position
  visibleCols.sort((a, b) => {
    const aIdx = orderMap.get(getColumnKey(a)) ?? 999;
    const bIdx = orderMap.get(getColumnKey(b)) ?? 999;
    return aIdx - bIdx;
  });

  // Sort hidden columns alphabetically by display name
  hiddenCols.sort((a, b) =>
    getColumnDisplayName(a).localeCompare(getColumnDisplayName(b))
  );

  // Return visible first, then hidden
  return [...visibleCols, ...hiddenCols];
}

/**
 * Sort only hidden columns alphabetically
 * Use this when you already have filtered hidden columns
 */
export function sortHiddenColumnsAlphabetically<T extends SortableColumn>(columns: T[]): T[] {
  // Safety: ensure columns is an array to prevent .sort() errors
  if (!Array.isArray(columns)) return [];
  return [...columns].sort((a, b) =>
    getColumnDisplayName(a).localeCompare(getColumnDisplayName(b))
  );
}
