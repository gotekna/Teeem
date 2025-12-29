/**
 * Corporate Module - Column Utilities
 *
 * Single source of truth for column conversion logic used across all corporate pages.
 * Extracted from corporate/page.tsx to prevent code duplication.
 */

import type { TableColumn } from "@/components/table/types";
import {
  SYSTEM_DISPLAY_COLUMNS as _SYSTEM_DISPLAY_COLUMNS,
  SYSTEM_GENERATED_TYPES as _SYSTEM_GENERATED_TYPES,
  SYSTEM_HIDDEN_COLUMNS,
  isSystemGeneratedType,
  isVisibleSystemColumn,
} from "@/lib/constants/system-columns";

// =============================================================================
// Types
// =============================================================================

export interface ApiColumn {
  id: number;
  foundation_id?: number;
  column_name: string;
  name: string;
  column_type: string;
  description?: string;
  available_choices?: string[];
  lookup_foundation_id?: number;
  lookup_display_column?: string;
  header_align?: string;
  data_align?: string;
}

export interface ColumnTypeDefault {
  width: number;
  filterable?: boolean;
  filterType?: string;
  sortable?: boolean;
  showSum?: boolean;
  sumType?: string;
}

export type WidthOverrides = Record<string, number>;

// =============================================================================
// Constants
// =============================================================================

/**
 * Default width and behavior mappings for column types.
 * These define the baseline display properties for each column type.
 */
export const COLUMN_TYPE_DEFAULTS: Record<string, ColumnTypeDefault> = {
  'single_line_text': { width: 150, filterable: true, filterType: 'text' },
  'email': { width: 200, filterable: true, filterType: 'text' },
  'phone': { width: 150, filterable: true, filterType: 'text' },
  'mobile': { width: 150, filterable: true, filterType: 'text' },
  'url': { width: 180, sortable: false, filterable: false },
  'date': { width: 140, filterable: true, filterType: 'text' },
  'date_and_time': { width: 180, filterable: true, filterType: 'text' },
  'lookup': { width: 150, filterable: true, filterType: 'dropdown' },
  'boolean': { width: 100, filterable: true, filterType: 'boolean' },
  'percentage': { width: 120, filterable: true, filterType: 'text' },
  'choice': { width: 140, filterable: true, filterType: 'dropdown' },
  'currency': { width: 120, filterable: true, filterType: 'text', showSum: true, sumType: 'currency' },
  'number': { width: 100, filterable: true, filterType: 'text', showSum: true, sumType: 'number' },
  'whole_number': { width: 120, filterable: true, filterType: 'text', showSum: true, sumType: 'number' },
  'multiple_lines_text': { width: 300, sortable: false, filterable: true, filterType: 'text' },
  'computed': { width: 140, filterable: false, showSum: true, sumType: 'number' },
  'formula': { width: 140, filterable: false },
  'auto_number': { width: 80, filterable: true, filterType: 'text' },
  'created_time': { width: 160, filterable: true, filterType: 'date' },
  'modified_time': { width: 160, filterable: true, filterType: 'date' },
  'created_by': { width: 120, filterable: true, filterType: 'dropdown' },
  'modified_by': { width: 120, filterable: true, filterType: 'dropdown' },
  'rollup': { width: 120, filterable: false },
  'count': { width: 80, filterable: false },
  'gps_coordinates': { width: 280, sortable: false, filterable: false },
  'color_picker': { width: 120, sortable: false, filterable: false },
  'file_upload': { width: 200, sortable: false, filterable: false },
  'action_buttons': { width: 180, sortable: false, filterable: false },
  'multiple_lookups': { width: 200, sortable: false, filterable: false },
  'user': { width: 120, filterable: true, filterType: 'dropdown' },
};

/**
 * Columns that should be COMPLETELY HIDDEN (not even in column selector).
 * These are internal columns not meant for user display at all.
 *
 * NOTE: id, created_at, updated_at are NOT here - they're "system" columns
 * that are hidden by DEFAULT but can be shown via column selector.
 * See SYSTEM_DISPLAY_COLUMNS below.
 */
const HIDDEN_COLUMNS = [
  // SSoT: System hidden columns from shared constants
  ...SYSTEM_HIDDEN_COLUMNS,
  // Legacy TED columns
  'sys_type_id', 'deleted', 'drive_id', 'folder_id',
  'parent_id', 'parent$type', 'range$type', 'colour_spec$type',
  'tedmodel$type', 'pricebook$type'
];

/**
 * System columns that ARE in the column list but hidden by DEFAULT.
 * Users can toggle these on via the column selector.
 * SSoT: @/lib/constants/system-columns.ts
 */
// Cast to readonly string[] to allow .includes() with string parameters
export const SYSTEM_DISPLAY_COLUMNS: readonly string[] = _SYSTEM_DISPLAY_COLUMNS;

// NOTE: We no longer hide _id columns. If a column is in a Foundation, it should be visible.
// If it shouldn't be visible, it shouldn't be in the Foundation at all.

/**
 * System-generated column types that users cannot edit.
 * SSoT: @/lib/constants/system-columns.ts
 */
// Cast to readonly string[] to allow .includes() with string parameters
export const SYSTEM_GENERATED_TYPES: readonly string[] = _SYSTEM_GENERATED_TYPES;

// =============================================================================
// Functions
// =============================================================================

/**
 * Check if a column is a system column that should be hidden.
 *
 * @param columnName - The name of the column to check
 * @returns true if the column should be hidden
 */
export function isSystemOrHiddenColumn(columnName: string): boolean {
  // Check completely hidden columns (not even in column selector)
  if (HIDDEN_COLUMNS.includes(columnName)) return true;

  // Hide $type suffix columns (used for polymorphic associations)
  if (columnName.endsWith('$type')) return true;

  // NOTE: We no longer hide _id columns. If a column is in a Foundation,
  // it should be visible. If it shouldn't be visible, remove it from the Foundation.

  // NOTE: id, created_at, updated_at are NOT filtered here
  // They're in SYSTEM_DISPLAY_COLUMNS and should be hidden by DEFAULT
  // but available in the column selector

  return false;
}

/**
 * Convert API column format to TeeemTableView column format.
 *
 * @param apiColumns - Array of columns from the API
 * @param foundationId - The foundation ID for this table
 * @param widthOverrides - Optional custom width overrides per column name
 * @returns Array of TableColumn objects ready for TeeemTableView
 */
export function convertColumnsToTEEEMFormat(
  apiColumns: ApiColumn[],
  foundationId: number | string | null,
  widthOverrides: WidthOverrides = {}
): TableColumn[] {
  // Start with select column for bulk actions
  const columns: TableColumn[] = [
    {
      key: 'select',
      label: '',
      resizable: false,
      sortable: false,
      filterable: false,
      width: 32,
      tooltip: 'Select rows for bulk actions'
    }
  ];

  apiColumns.forEach(col => {
    // Skip system/hidden columns
    if (isSystemOrHiddenColumn(col.column_name)) return;

    const defaults = COLUMN_TYPE_DEFAULTS[col.column_type] || { width: 150 };

    // Apply width: custom override > column-specific default > type default
    let width = widthOverrides[col.column_name] ?? defaults.width;

    // Apply common column name overrides if no custom override provided
    if (!widthOverrides[col.column_name]) {
      if (col.column_name === 'id') width = 60;
      if (col.column_name === 'name') width = 250;
      if (col.column_name === 'code') width = 80;
    }

    // Check if this is a system-generated column (read-only)
    const isSystemColumn = isVisibleSystemColumn(col.column_name) ||
                           isSystemGeneratedType(col.column_type);

    // Resolve foundation_id: prefer column's value, fall back to passed ID (only if numeric)
    const resolvedFoundationId = col.foundation_id ?? (typeof foundationId === 'number' ? foundationId : undefined);

    columns.push({
      id: col.id,
      foundation_id: resolvedFoundationId,
      key: col.column_name,
      label: col.name,
      column_type: col.column_type,
      resizable: true,
      sortable: defaults.sortable !== false,
      filterable: defaults.filterable || false,
      filterType: defaults.filterType as "text" | "dropdown" | "number" | "date" | "boolean" | undefined,
      width: width,
      showSum: defaults.showSum,
      sumType: defaults.sumType as "currency" | "number" | "percentage" | undefined,
      tooltip: col.description || `${col.column_type} column`,
      choices: col.available_choices,
      editable: !isSystemColumn,
      system: isSystemColumn,
      // SSoT: Lookup configuration from Foundation API
      lookup_foundation_id: col.lookup_foundation_id,
      lookup_display_column: col.lookup_display_column,
      // Header alignment from Foundation
      headerAlign: col.header_align as "left" | "center" | "right" | undefined,
      dataAlign: col.data_align as "left" | "center" | "right" | undefined,
    });
  });

  return columns;
}
