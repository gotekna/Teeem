/**
 * Column Renderer Registry
 *
 * Central registry pattern for handling all 34 column types in TeeemTableView.
 * This replaces the massive 1,488-line renderCellValue function with a clean,
 * modular architecture where each column type has its own handler.
 *
 * Architecture:
 * - Each column type has a ColumnTypeHandler with validate/display/editor functions
 * - COLUMN_TYPE_REGISTRY maps type names to their handlers
 * - renderCell() is the main entry point (replaces renderCellValue)
 *
 * Source: TEEEM_DOCS/GOLD_STANDARD_TABLE.md (34 column types defined)
 * SSoT: backend/app/models/column.rb → COLUMN_SQL_TYPE_MAP
 */

import React from "react";
import type { TableColumn, TableRow } from "../../types";
import * as Display from "./CellDisplay";
import * as Validation from "./CellValidation";

/**
 * Column Type Handler Interface
 *
 * Each of the 34 column types implements this interface.
 * Separates validation, display, and editing concerns.
 */
export interface ColumnTypeHandler {
  /**
   * Validate a value for this column type
   * @returns Error message if invalid, null if valid
   */
  validate: (value: unknown, column: TableColumn) => string | null;

  /**
   * Render the display (read-only) version of a value
   */
  display: (value: unknown, column: TableColumn, row?: TableRow) => React.ReactNode;

  /**
   * React component for editing this column type
   * Returns null for read-only types (computed, searchable_text, etc.)
   */
  editor: React.ComponentType<CellEditorProps> | null;
}

/**
 * Props passed to all cell editor components
 */
export interface CellEditorProps {
  value: unknown;
  column: TableColumn;
  row: TableRow;
  onChange: (newValue: unknown) => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
}

/**
 * Fallback handler for unknown column types
 */
const fallbackHandler: ColumnTypeHandler = {
  validate: () => null,
  display: (value) => {
    if (value === null || value === undefined || value === "") return "";
    return String(value);
  },
  editor: null,
};

/**
 * Column Type Registry
 *
 * Maps each of the 34 column types to its handler.
 * Display and validation are fully implemented.
 * Editors are null for now (existing renderCellValue handles editing).
 *
 * Column types from GOLD_STANDARD_TABLE.md:
 * - Text Types (6): single_line_text, multiple_lines_text, email, phone, mobile, url
 * - Number Types (4): number, whole_number, currency, percentage
 * - Date & Time (2): date, date_and_time
 * - Special (4): gps_coordinates, color_picker, file_upload, action_buttons
 * - Selection (2): boolean, choice
 * - Relationship (3): lookup, multiple_lookups, user
 * - Computed (1): computed
 * - Advanced (3): structured_data, array_of_items, searchable_text
 * - Australian (6): abn, acn, bsb, bank_account, postcode, tfn
 */
export const COLUMN_TYPE_REGISTRY: Record<string, ColumnTypeHandler> = {
  // Text Types (6)
  single_line_text: {
    validate: Validation.validateSingleLineText,
    display: Display.displaySingleLineText,
    editor: null,
  },
  multiple_lines_text: {
    validate: Validation.validateMultipleLinesText,
    display: Display.displayMultipleLinesText,
    editor: null,
  },
  email: {
    validate: Validation.validateEmail,
    display: Display.displayEmail,
    editor: null,
  },
  phone: {
    validate: Validation.validatePhone,
    display: Display.displayPhone,
    editor: null,
  },
  mobile: {
    validate: Validation.validateMobile,
    display: Display.displayMobile,
    editor: null,
  },
  url: {
    validate: Validation.validateUrl,
    display: Display.displayUrl,
    editor: null,
  },
  website: {
    // Alias for url
    validate: Validation.validateUrl,
    display: Display.displayUrl,
    editor: null,
  },

  // Number Types (4)
  number: {
    validate: Validation.validateNumber,
    display: Display.displayNumber,
    editor: null,
  },
  whole_number: {
    validate: Validation.validateWholeNumber,
    display: Display.displayWholeNumber,
    editor: null,
  },
  currency: {
    validate: Validation.validateCurrency,
    display: Display.displayCurrency,
    editor: null,
  },
  percentage: {
    validate: Validation.validatePercentage,
    display: Display.displayPercentage,
    editor: null,
  },

  // Date & Time (2)
  date: {
    validate: Validation.validateDate,
    display: Display.displayDate,
    editor: null,
  },
  date_and_time: {
    validate: Validation.validateDateTime,
    display: Display.displayDateTime,
    editor: null,
  },

  // Special (4)
  gps_coordinates: {
    validate: Validation.validateGpsCoordinates,
    display: Display.displayGpsCoordinates,
    editor: null,
  },
  color_picker: {
    validate: Validation.validateColorPicker,
    display: Display.displayColorPicker,
    editor: null,
  },
  file_upload: {
    validate: Validation.validateDefault,
    display: Display.displayFileUpload,
    editor: null,
  },
  action_buttons: {
    validate: Validation.validateDefault,
    display: Display.displayActionButtons,
    editor: null,
  },

  // Selection (2)
  boolean: {
    validate: Validation.validateBoolean,
    display: Display.displayBoolean,
    editor: null,
  },
  choice: {
    validate: Validation.validateChoice,
    display: Display.displayChoice,
    editor: null,
  },

  // Relationship (3)
  lookup: {
    validate: Validation.validateLookup,
    display: Display.displayLookup,
    editor: null,
  },
  multiple_lookups: {
    validate: Validation.validateMultipleLookups,
    display: Display.displayMultipleLookups,
    editor: null,
  },
  user: {
    validate: Validation.validateLookup, // Same as lookup
    display: Display.displayLookup,
    editor: null,
  },

  // Computed (1)
  computed: {
    validate: Validation.validateComputed,
    display: Display.displayComputed,
    editor: null, // Read-only
  },
  formula: {
    // Alias for computed
    validate: Validation.validateComputed,
    display: Display.displayComputed,
    editor: null, // Read-only
  },

  // Advanced (3)
  structured_data: {
    validate: Validation.validateStructuredData,
    display: Display.displayStructuredData,
    editor: null,
  },
  array_of_items: {
    validate: Validation.validateArrayOfItems,
    display: Display.displayArrayOfItems,
    editor: null,
  },
  searchable_text: {
    validate: Validation.validateSearchableText,
    display: Display.displaySearchableText,
    editor: null, // Read-only
  },

  // Australian (6)
  abn: {
    validate: Validation.validateAbn,
    display: Display.displayAbn,
    editor: null,
  },
  acn: {
    validate: Validation.validateAcn,
    display: Display.displayAcn,
    editor: null,
  },
  bsb: {
    validate: Validation.validateBsb,
    display: Display.displayBsb,
    editor: null,
  },
  bank_account: {
    validate: Validation.validateBankAccount,
    display: Display.displayBankAccount,
    editor: null,
  },
  postcode: {
    validate: Validation.validatePostcode,
    display: Display.displayPostcode,
    editor: null,
  },
  tfn: {
    validate: Validation.validateTfn,
    display: Display.displayTfn,
    editor: null,
  },

  // System Types (timestamps, auto-generated)
  created_time: {
    validate: Validation.validateDateTime,
    display: Display.displayDateTime,
    editor: null, // Read-only
  },
  modified_time: {
    validate: Validation.validateDateTime,
    display: Display.displayDateTime,
    editor: null, // Read-only
  },
  auto_number: {
    validate: Validation.validateNumber,
    display: Display.displayNumber,
    editor: null, // Read-only
  },

  // Relation type (alias for lookup)
  relation: {
    validate: Validation.validateLookup,
    display: Display.displayLookup,
    editor: null,
  },
};

/**
 * Main render function - replaces the 1,488-line renderCellValue
 *
 * @param value - The cell value to render
 * @param column - Column definition
 * @param row - Full row data
 * @param mode - Display (read-only) or edit mode
 * @param editorProps - Additional props for editor component
 * @returns React node to render
 */
export function renderCell(
  value: unknown,
  column: TableColumn,
  row: TableRow,
  mode: "display" | "edit",
  editorProps?: Partial<CellEditorProps>
): React.ReactNode {
  // Special handling for xero_linked_count column (uses custom popover display)
  if (column.key === "xero_linked_count" && mode === "display") {
    return Display.displayXeroLinks(value, column, row);
  }

  // Get handler for this column type
  const handler = COLUMN_TYPE_REGISTRY[column.column_type || "single_line_text"] || fallbackHandler;

  // Display mode - render read-only
  if (mode === "display") {
    return handler.display(value, column, row);
  }

  // Edit mode - render editor component
  if (handler.editor) {
    const Editor = handler.editor;
    return (
      <Editor
        value={value}
        column={column}
        row={row}
        onChange={editorProps?.onChange || (() => {})}
        onSave={editorProps?.onSave || (async () => {})}
        onCancel={editorProps?.onCancel || (() => {})}
      />
    );
  }

  // No editor available (read-only types like computed, searchable_text)
  return handler.display(value, column, row);
}

/**
 * Validate a cell value
 *
 * @param value - Value to validate
 * @param column - Column definition
 * @returns Error message if invalid, null if valid
 */
export function validateCell(value: unknown, column: TableColumn): string | null {
  const handler = COLUMN_TYPE_REGISTRY[column.column_type || "single_line_text"] || fallbackHandler;
  return handler.validate(value, column);
}

/**
 * Check if a column type is editable
 *
 * @param columnType - Type of column
 * @returns True if column type has an editor
 */
export function isColumnTypeEditable(columnType: string): boolean {
  const handler = COLUMN_TYPE_REGISTRY[columnType];
  return handler ? handler.editor !== null : true;
}

/**
 * Get all registered column types
 *
 * @returns Array of registered column type names
 */
export function getRegisteredColumnTypes(): string[] {
  return Object.keys(COLUMN_TYPE_REGISTRY);
}

/**
 * Register a custom column type handler
 *
 * Allows extending the registry with custom types without modifying this file.
 *
 * @param typeName - Name of the column type
 * @param handler - Handler implementation
 */
export function registerColumnType(typeName: string, handler: ColumnTypeHandler): void {
  COLUMN_TYPE_REGISTRY[typeName] = handler;
}
