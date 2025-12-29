/**
 * SSoT: System Column Constants
 *
 * Per GOLD_STANDARD_TABLE.md:
 * - System columns are auto-generated and should NEVER be edited by users
 * - System columns MUST be visible with yellow highlight (hsl(47, 100%, 96%))
 * - Only deleted_at should be hidden (soft-delete implementation detail)
 */

// =============================================================================
// System Column NAMES (by column_name field)
// =============================================================================

/**
 * System columns that are visible but non-editable (yellow highlight in UI)
 * These appear in tables but cannot be modified by users
 */
export const SYSTEM_VISIBLE_COLUMNS = ['id', 'created_at', 'updated_at'] as const;

/**
 * Alias for backward compatibility with existing code
 * @deprecated Use SYSTEM_VISIBLE_COLUMNS instead
 */
export const SYSTEM_DISPLAY_COLUMNS = SYSTEM_VISIBLE_COLUMNS;

/**
 * System columns that are completely hidden from table views
 * These are implementation details users shouldn't see
 */
export const SYSTEM_HIDDEN_COLUMNS = ['deleted_at'] as const;

/**
 * All system columns (union of visible + hidden)
 * Used for validation and filtering purposes
 */
export const ALL_SYSTEM_COLUMNS = [
  ...SYSTEM_VISIBLE_COLUMNS,
  ...SYSTEM_HIDDEN_COLUMNS,
] as const;

// =============================================================================
// System Column TYPES (by column_type field)
// =============================================================================

/**
 * Column types that are system-generated and cannot be edited by users
 * Used to filter out non-editable fields in create/edit forms
 */
export const SYSTEM_GENERATED_TYPES = [
  'computed',
  'formula',
  'auto_number',
  'created_time',
  'modified_time',
  'created_by',
  'modified_by',
  'rollup',
  'count',
  // NOTE: 'lookup' is NOT here - lookup columns ARE editable (via dropdown)
] as const;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a column name is a system column (visible or hidden)
 */
export function isSystemColumn(columnName: string): boolean {
  return (ALL_SYSTEM_COLUMNS as readonly string[]).includes(columnName);
}

/**
 * Check if a column should be hidden from table views
 */
export function isHiddenSystemColumn(columnName: string): boolean {
  return (SYSTEM_HIDDEN_COLUMNS as readonly string[]).includes(columnName);
}

/**
 * Check if a column should be visible but non-editable (yellow highlight)
 */
export function isVisibleSystemColumn(columnName: string): boolean {
  return (SYSTEM_VISIBLE_COLUMNS as readonly string[]).includes(columnName);
}

/**
 * Check if a column type is system-generated (non-editable)
 */
export function isSystemGeneratedType(columnType: string): boolean {
  return (SYSTEM_GENERATED_TYPES as readonly string[]).includes(columnType);
}
