/**
 * Column Type Constants (SSoT)
 *
 * These constants mirror the backend Column model constants.
 * Use these instead of hardcoding type strings throughout the codebase.
 *
 * Backend SSoT: app/models/column.rb
 *   - Column::CHOICE_COLUMN_TYPES
 *   - Column::LOOKUP_COLUMN_TYPES
 */

// Lookup column types - columns that reference other foundations
export const LOOKUP_COLUMN_TYPES = ['lookup', 'multiple_lookups'] as const;

// Choice column types - columns with predefined options
export const CHOICE_COLUMN_TYPES = ['choice'] as const;

// File/attachment column types
export const FILE_COLUMN_TYPES = ['file_upload', 'file', 'attachment'] as const;

// Rich text column types
export const TEXT_COLUMN_TYPES = ['rich_text', 'long_text', 'multi_line_text', 'multiple_lines_text'] as const;

// Numeric column types
export const NUMERIC_COLUMN_TYPES = ['number', 'whole_number', 'currency', 'percentage'] as const;

// Date/time column types
export const DATE_COLUMN_TYPES = ['date', 'date_and_time', 'time'] as const;

// Type helpers
export type LookupColumnType = typeof LOOKUP_COLUMN_TYPES[number];
export type ChoiceColumnType = typeof CHOICE_COLUMN_TYPES[number];
export type FileColumnType = typeof FILE_COLUMN_TYPES[number];
export type TextColumnType = typeof TEXT_COLUMN_TYPES[number];
export type NumericColumnType = typeof NUMERIC_COLUMN_TYPES[number];
export type DateColumnType = typeof DATE_COLUMN_TYPES[number];

// Helper functions
export function isLookupColumn(columnType: string | undefined | null): boolean {
  return columnType != null && (LOOKUP_COLUMN_TYPES as readonly string[]).includes(columnType);
}

export function isChoiceColumn(columnType: string | undefined | null): boolean {
  return columnType != null && (CHOICE_COLUMN_TYPES as readonly string[]).includes(columnType);
}

export function isFileColumn(columnType: string | undefined | null): boolean {
  return columnType != null && (FILE_COLUMN_TYPES as readonly string[]).includes(columnType);
}

export function isTextColumn(columnType: string | undefined | null): boolean {
  return columnType != null && (TEXT_COLUMN_TYPES as readonly string[]).includes(columnType);
}

export function isNumericColumn(columnType: string | undefined | null): boolean {
  return columnType != null && (NUMERIC_COLUMN_TYPES as readonly string[]).includes(columnType);
}

export function isDateColumn(columnType: string | undefined | null): boolean {
  return columnType != null && (DATE_COLUMN_TYPES as readonly string[]).includes(columnType);
}
