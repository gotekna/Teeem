/**
 * Cell Validation Functions
 *
 * Validation rules for all column types.
 *
 * THE NEW WAY (SSoT):
 *   Use validateCell() which reads validation rules from ColumnTypeDefinition.
 *   The backend database is the single source of truth.
 *
 * THE OLD WAY (deprecated):
 *   Individual validateXxx() functions are kept for backward compatibility
 *   but validation patterns should come from ColumnTypeDefinition.validation_regex.
 *
 * Migration:
 *   All validation is now done through validateCell() which checks if
 *   type definitions are loaded and uses the SSoT patterns when available.
 */

import type { TableColumn } from "../../types";
import { EMAIL_REGEX } from "@/lib/email-constants";
import {
  validateCell as validateCellNew,
  type ValidationResult,
} from "@/lib/formatters/validation-formatters";
import { isTypeDefinitionsLoaded } from "@/lib/column-type-registry";

/**
 * Validate single line text (max 255 characters)
 */
export function validateSingleLineText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const text = String(value);
  if (text.length > 255) {
    return "Text must be 255 characters or less";
  }

  return null;
}

/**
 * Validate multiple lines text (unlimited)
 */
export function validateMultipleLinesText(value: unknown): string | null {
  // No length limit for multi-line text
  return null;
}

/**
 * Validate email format
 */
export function validateEmail(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const email = String(value);
  // SSoT: Use EMAIL_REGEX from email-constants.ts
  if (!EMAIL_REGEX.test(email)) {
    return "Invalid email format";
  }

  return null;
}

/**
 * Validate phone format (Australian)
 */
export function validatePhone(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const phone = String(value).replace(/\s/g, "");

  // Australian phone formats:
  // (03) 9123 4567 -> 0391234567
  // 1300 numbers -> 1300XXXXXX
  // 1800 numbers -> 1800XXXXXX

  const phoneRegex = /^(\(0[2-8]\)\d{8}|0[2-8]\d{8}|1[38]00\d{6})$/;

  if (!phoneRegex.test(phone)) {
    return "Invalid phone format (e.g., (03) 9123 4567 or 1300 numbers)";
  }

  return null;
}

/**
 * Validate mobile format (Australian)
 */
export function validateMobile(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const mobile = String(value).replace(/\s/g, "");

  // Australian mobile: 04XX XXX XXX
  const mobileRegex = /^04\d{8}$/;

  if (!mobileRegex.test(mobile)) {
    return "Invalid mobile format (must start with 04, e.g., 0407 397 541)";
  }

  return null;
}

/**
 * Validate URL format
 */
export function validateUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const url = String(value);

  try {
    new URL(url);
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return "URL must start with http:// or https://";
    }
    return null;
  } catch {
    return "Invalid URL format";
  }
}

/**
 * Validate number (decimal, up to 2 places)
 */
export function validateNumber(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const num = typeof value === "number" ? value : parseFloat(String(value));

  if (isNaN(num)) {
    return "Must be a valid number";
  }

  return null;
}

/**
 * Validate whole number (integer only)
 */
export function validateWholeNumber(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const num = typeof value === "number" ? value : parseFloat(String(value));

  if (isNaN(num)) {
    return "Must be a valid number";
  }

  if (!Number.isInteger(num)) {
    return "Must be a whole number (no decimals)";
  }

  return null;
}

/**
 * Validate currency (positive, 2 decimals)
 */
export function validateCurrency(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const num = typeof value === "number" ? value : parseFloat(String(value).replace(/[$,]/g, ""));

  if (isNaN(num)) {
    return "Must be a valid currency amount";
  }

  if (num < 0) {
    return "Currency must be positive";
  }

  return null;
}

/**
 * Validate percentage (0-100)
 */
export function validatePercentage(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const num = typeof value === "number" ? value : parseFloat(String(value).replace(/%/g, ""));

  if (isNaN(num)) {
    return "Must be a valid percentage";
  }

  if (num < 0 || num > 100) {
    return "Percentage must be between 0 and 100";
  }

  return null;
}

/**
 * Validate date format
 */
export function validateDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const date = new Date(String(value));

  if (isNaN(date.getTime())) {
    return "Invalid date format";
  }

  return null;
}

/**
 * Validate date and time format
 */
export function validateDateTime(value: unknown): string | null {
  return validateDate(value);
}

/**
 * Validate boolean (true/false only)
 */
export function validateBoolean(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "boolean") return null;

  if (value === "true" || value === "false") return null;

  return "Must be true or false";
}

/**
 * Validate choice (must be in predefined options)
 */
export function validateChoice(value: unknown, column: TableColumn): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (!column.choices || column.choices.length === 0) {
    return null; // No validation if choices not defined
  }

  const strValue = String(value);

  if (!column.choices.includes(strValue)) {
    return `Must be one of: ${column.choices.join(", ")}`;
  }

  return null;
}

/**
 * Validate GPS coordinates
 */
export function validateGpsCoordinates(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const coords = String(value);
  const gpsRegex = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;

  if (!gpsRegex.test(coords)) {
    return "Invalid GPS format (e.g., -33.8688, 151.2093)";
  }

  return null;
}

/**
 * Validate color picker (hex format)
 */
export function validateColorPicker(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const color = String(value);
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;

  if (!hexRegex.test(color)) {
    return "Invalid hex color format (e.g., #FF5733)";
  }

  return null;
}

/**
 * Validate ABN (11 digits)
 */
export function validateAbn(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const abn = String(value).replace(/\s/g, "");

  if (!/^\d{11}$/.test(abn)) {
    return "ABN must be 11 digits (e.g., 51 824 753 556)";
  }

  return null;
}

/**
 * Validate ACN (9 digits)
 */
export function validateAcn(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const acn = String(value).replace(/\s/g, "");

  if (!/^\d{9}$/.test(acn)) {
    return "ACN must be 9 digits (e.g., 004 085 616)";
  }

  return null;
}

/**
 * Validate BSB (6 digits)
 */
export function validateBsb(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const bsb = String(value).replace(/[-\s]/g, "");

  if (!/^\d{6}$/.test(bsb)) {
    return "BSB must be 6 digits (e.g., 063-000)";
  }

  return null;
}

/**
 * Validate bank account (up to 9 digits)
 */
export function validateBankAccount(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const account = String(value).replace(/\s/g, "");

  if (!/^\d{1,9}$/.test(account)) {
    return "Bank account must be 1-9 digits";
  }

  return null;
}

/**
 * Validate postcode (exactly 4 digits)
 */
export function validatePostcode(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const postcode = String(value);

  if (!/^\d{4}$/.test(postcode)) {
    return "Postcode must be exactly 4 digits (e.g., 3000)";
  }

  return null;
}

/**
 * Validate TFN (9 digits)
 */
export function validateTfn(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  const tfn = String(value).replace(/\s/g, "");

  if (!/^\d{9}$/.test(tfn)) {
    return "TFN must be 9 digits (e.g., 123 456 789)";
  }

  return null;
}

/**
 * Validate lookup (must reference valid ID)
 */
export function validateLookup(value: unknown): string | null {
  // Lookup validation is typically done server-side
  // Just check it's not empty if required
  return null;
}

/**
 * Validate multiple lookups (array of IDs)
 */
export function validateMultipleLookups(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (!Array.isArray(value)) {
    return "Multiple lookups must be an array";
  }

  return null;
}

/**
 * Validate structured data (must be valid JSON)
 */
export function validateStructuredData(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "object") {
    return null; // Already an object
  }

  try {
    JSON.parse(String(value));
    return null;
  } catch {
    return "Must be valid JSON";
  }
}

/**
 * Validate array of items
 */
export function validateArrayOfItems(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (!Array.isArray(value)) {
    return "Must be an array";
  }

  return null;
}

/**
 * Computed fields are read-only - no validation needed
 */
export function validateComputed(): string | null {
  return null; // Read-only
}

/**
 * Searchable text is read-only - no validation needed
 */
export function validateSearchableText(): string | null {
  return null; // Read-only
}

/**
 * Default validation (permissive)
 */
export function validateDefault(): string | null {
  return null;
}

/**
 * Main validation function - uses SSoT when available
 *
 * This is the main entry point used by EditableCell and other components.
 * Returns a ValidationResult object with isValid and error fields.
 *
 * If type definitions are loaded from the backend, uses the SSoT patterns.
 * Otherwise, falls back to the legacy hardcoded patterns.
 *
 * @param value - Value to validate
 * @param columnType - Type of column
 * @param column - Optional full column object for advanced validation
 * @returns Validation result with isValid boolean and error message
 */
export function validateCell(
  value: unknown,
  columnType: string,
  column?: TableColumn
): { isValid: boolean; error: string | null } {
  // Use SSoT-based validation when type definitions are loaded
  if (isTypeDefinitionsLoaded()) {
    return validateCellNew(value, columnType, column);
  }

  // Fallback to legacy validation
  return validateCellLegacy(value, columnType, column);
}

/**
 * Legacy validation function - uses hardcoded patterns
 * @deprecated Patterns should come from ColumnTypeDefinition.validation_regex
 */
function validateCellLegacy(
  value: unknown,
  columnType: string,
  column?: TableColumn
): { isValid: boolean; error: string | null } {
  let error: string | null = null;

  // Route to appropriate validator based on column type
  switch (columnType) {
    case 'single_line_text':
      error = validateSingleLineText(value);
      break;
    case 'multiple_lines_text':
      error = validateMultipleLinesText(value);
      break;
    case 'email':
      error = validateEmail(value);
      break;
    case 'phone':
      error = validatePhone(value);
      break;
    case 'mobile':
      error = validateMobile(value);
      break;
    case 'url':
      error = validateUrl(value);
      break;
    case 'number':
      error = validateNumber(value);
      break;
    case 'whole_number':
      error = validateWholeNumber(value);
      break;
    case 'currency':
      error = validateCurrency(value);
      break;
    case 'percentage':
      error = validatePercentage(value);
      break;
    case 'date':
      error = validateDate(value);
      break;
    case 'date_and_time':
      error = validateDateTime(value);
      break;
    case 'boolean':
      error = validateBoolean(value);
      break;
    case 'choice':
      error = column ? validateChoice(value, column) : null;
      break;
    case 'gps_coordinates':
      error = validateGpsCoordinates(value);
      break;
    case 'color_picker':
      error = validateColorPicker(value);
      break;
    case 'abn':
      error = validateAbn(value);
      break;
    case 'acn':
      error = validateAcn(value);
      break;
    case 'bsb':
      error = validateBsb(value);
      break;
    case 'bank_account':
      error = validateBankAccount(value);
      break;
    case 'postcode':
      error = validatePostcode(value);
      break;
    case 'tfn':
      error = validateTfn(value);
      break;
    case 'lookup':
    case 'user':
      error = validateLookup(value);
      break;
    case 'multiple_lookups':
      error = validateMultipleLookups(value);
      break;
    case 'structured_data':
      error = validateStructuredData(value);
      break;
    case 'array_of_items':
      error = validateArrayOfItems(value);
      break;
    case 'computed':
      error = validateComputed();
      break;
    case 'searchable_text':
      error = validateSearchableText();
      break;
    default:
      error = validateDefault();
  }

  return {
    isValid: error === null,
    error,
  };
}

// Re-export the ValidationResult type for consumers
export type { ValidationResult };
