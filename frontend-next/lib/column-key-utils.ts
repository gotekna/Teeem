/**
 * Column Key Normalization Utilities
 *
 * Handles the mismatch between API format (column_name) and frontend format (key)
 * for column identifiers in TeeemTableView.
 *
 * Problem: ViewManagerSheet uses `column_name` (from API) but TeeemTableView uses `key`
 * Solution: Normalize at API boundaries to maintain consistent property naming
 */

import type { SavedView } from '@/components/table/types';

/**
 * Normalize column identifiers from API format (column_name) to internal format (key)
 *
 * @param columns - Array of column objects with column_name property
 * @returns Array of column keys
 */
export function normalizeColumnKeys(columns: { column_name: string }[]): string[] {
  return columns.map(c => c.column_name);
}

/**
 * Convert saved view from API format to internal format
 * Ensures visibleColumns and columnOrder use 'key' format consistently
 *
 * @param view - SavedView from API (may use column_name)
 * @param columns - Column metadata with both column_name and key properties
 * @returns Normalized SavedView with consistent key property usage
 */
export function normalizeSavedView(
  view: SavedView,
  columns: { column_name: string; key: string }[]
): SavedView {
  // Create mapping from column_name to key
  const nameToKey = new Map(columns.map(c => [c.column_name, c.key]));

  // Remap visibleColumns keys from column_name to key
  const normalizedVisibleColumns: Record<string, boolean> = {};
  if (view.visibleColumns) {
    Object.entries(view.visibleColumns).forEach(([columnName, visible]) => {
      const key = nameToKey.get(columnName) || columnName;
      normalizedVisibleColumns[key] = visible;
    });
  }

  // Remap columnOrder from column_name to key
  const normalizedColumnOrder = view.columnOrder?.map(columnName =>
    nameToKey.get(columnName) || columnName
  ) || [];

  // Remap columnWidths keys from column_name to key
  const normalizedColumnWidths: Record<string, number> = {};
  if (view.columnWidths) {
    Object.entries(view.columnWidths).forEach(([columnName, width]) => {
      const key = nameToKey.get(columnName) || columnName;
      normalizedColumnWidths[key] = width;
    });
  }

  return {
    ...view,
    visibleColumns: normalizedVisibleColumns,
    columnOrder: normalizedColumnOrder,
    columnWidths: normalizedColumnWidths,
  };
}

/**
 * Convert from internal format (key) back to API format (column_name)
 * Used when saving views to the backend
 *
 * @param view - SavedView using key format
 * @param columns - Column metadata with both key and column_name properties
 * @returns SavedView with column_name format for API
 */
export function denormalizeSavedView(
  view: Partial<SavedView>,
  columns: { key: string; column_name: string }[]
): Partial<SavedView> {
  // Create mapping from key to column_name
  const keyToName = new Map(columns.map(c => [c.key, c.column_name]));

  // Remap visibleColumns keys from key to column_name
  const denormalizedVisibleColumns: Record<string, boolean> = {};
  if (view.visibleColumns) {
    Object.entries(view.visibleColumns).forEach(([key, visible]) => {
      const columnName = keyToName.get(key) || key;
      denormalizedVisibleColumns[columnName] = visible;
    });
  }

  // Remap columnOrder from key to column_name
  const denormalizedColumnOrder = view.columnOrder?.map(key =>
    keyToName.get(key) || key
  ) || [];

  // Remap columnWidths keys from key to column_name
  const denormalizedColumnWidths: Record<string, number> = {};
  if (view.columnWidths) {
    Object.entries(view.columnWidths).forEach(([key, width]) => {
      const columnName = keyToName.get(key) || key;
      denormalizedColumnWidths[columnName] = width;
    });
  }

  return {
    ...view,
    visibleColumns: denormalizedVisibleColumns,
    columnOrder: denormalizedColumnOrder,
    columnWidths: denormalizedColumnWidths,
  };
}

/**
 * Check if a column identifier is in column_name format or key format
 *
 * @param identifier - Column identifier to check
 * @param columns - Column metadata
 * @returns 'column_name' | 'key' | 'unknown'
 */
export function detectColumnKeyFormat(
  identifier: string,
  columns: { column_name: string; key: string }[]
): 'column_name' | 'key' | 'unknown' {
  const hasColumnName = columns.some(c => c.column_name === identifier);
  const hasKey = columns.some(c => c.key === identifier);

  if (hasColumnName && !hasKey) return 'column_name';
  if (hasKey && !hasColumnName) return 'key';
  if (hasColumnName && hasKey) return 'key'; // If both match, prefer key format
  return 'unknown';
}
