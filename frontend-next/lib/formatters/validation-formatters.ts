/**
 * Validation Formatters - Generic validators that read configuration from ColumnTypeDefinition
 *
 * This is NOT the SSoT - it consumes the SSoT (ColumnTypeDefinition from backend).
 * These are generic validators that can handle any column type based on its configuration.
 *
 * The validation_regex field in ColumnTypeDefinition provides the pattern.
 * The validation_message field provides the error message.
 * Length/value constraints come from default_min/max_length and default_min/max_value.
 *
 * Usage:
 *   import { validateValue, validateCell } from '@/lib/formatters/validation-formatters';
 *   const result = validateCell(value, 'abn');  // Uses type definition config
 */

import { getTypeDefinition, type ColumnTypeDefinition } from "../column-type-registry";
import type { TableColumn } from "@/components/table/types";
import { EMAIL_REGEX } from "../email-constants";

/**
 * Validation result returned by validators
 */
export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

/**
 * Check if value is considered empty
 */
function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

// ============================================================================
// GENERIC VALIDATORS
// Each reads configuration from the type definition
// ============================================================================

type ValidatorConfig = Partial<ColumnTypeDefinition> & { choices?: string[] };
type ValidatorFn = (value: unknown, config: ValidatorConfig) => string | null;

const VALIDATORS: Record<string, ValidatorFn> = {
  /**
   * Text validator - checks length constraints
   */
  text: (value, config) => {
    if (isEmpty(value)) return null;

    const text = String(value);
    const maxLength = config.default_max_length;
    const minLength = config.default_min_length;

    if (maxLength && text.length > maxLength) {
      return `Text must be ${maxLength} characters or less`;
    }

    if (minLength && text.length < minLength) {
      return `Text must be at least ${minLength} characters`;
    }

    return null;
  },

  /**
   * Number validator - checks if valid number and value constraints
   */
  number: (value, config) => {
    if (isEmpty(value)) return null;

    const num = typeof value === "number" ? value : parseFloat(String(value));

    if (isNaN(num)) {
      return config.validation_message || "Must be a valid number";
    }

    const min = config.default_min_value;
    const max = config.default_max_value;

    if (min !== null && min !== undefined && num < min) {
      return `Value must be at least ${min}`;
    }

    if (max !== null && max !== undefined && num > max) {
      return `Value must be at most ${max}`;
    }

    return null;
  },

  /**
   * Whole number validator - must be integer
   */
  whole_number: (value, config) => {
    if (isEmpty(value)) return null;

    const num = typeof value === "number" ? value : parseFloat(String(value));

    if (isNaN(num)) {
      return "Must be a valid number";
    }

    if (!Number.isInteger(num)) {
      return "Must be a whole number (no decimals)";
    }

    const min = config.default_min_value;
    const max = config.default_max_value;

    if (min !== null && min !== undefined && num < min) {
      return `Value must be at least ${min}`;
    }

    if (max !== null && max !== undefined && num > max) {
      return `Value must be at most ${max}`;
    }

    return null;
  },

  /**
   * Currency validator - non-negative number
   */
  currency: (value, config) => {
    if (isEmpty(value)) return null;

    // Remove currency symbols and commas before parsing
    const cleanValue = String(value).replace(/[$,]/g, "");
    const num = parseFloat(cleanValue);

    if (isNaN(num)) {
      return config.validation_message || "Must be a valid currency amount";
    }

    // Currency is typically non-negative unless explicitly allowed
    const min = config.default_min_value ?? 0;
    if (num < min) {
      return `Currency must be at least ${min}`;
    }

    return null;
  },

  /**
   * Percentage validator - typically 0-100
   */
  percentage: (value, config) => {
    if (isEmpty(value)) return null;

    const cleanValue = String(value).replace(/%/g, "");
    const num = parseFloat(cleanValue);

    if (isNaN(num)) {
      return config.validation_message || "Must be a valid percentage";
    }

    const min = config.default_min_value ?? 0;
    const max = config.default_max_value ?? 100;

    if (num < min || num > max) {
      return `Percentage must be between ${min} and ${max}`;
    }

    return null;
  },

  /**
   * Date validator - valid date format
   */
  date: (value, _config) => {
    if (isEmpty(value)) return null;

    const date = new Date(String(value));

    if (isNaN(date.getTime())) {
      return "Invalid date format";
    }

    return null;
  },

  /**
   * Boolean validator
   */
  boolean: (value, _config) => {
    if (value === null || value === undefined) return null;

    if (typeof value === "boolean") return null;
    if (value === "true" || value === "false") return null;
    if (value === 1 || value === 0) return null;

    return "Must be true or false";
  },

  /**
   * Choice validator - must be in choices list
   */
  choice: (value, config) => {
    if (isEmpty(value)) return null;

    const choices = config.choices;
    if (!choices || choices.length === 0) {
      return null; // No validation if choices not defined
    }

    const strValue = String(value);
    if (!choices.includes(strValue)) {
      return `Must be one of: ${choices.join(", ")}`;
    }

    return null;
  },

  /**
   * URL validator - must be valid URL
   */
  url: (value, config) => {
    if (isEmpty(value)) return null;

    const url = String(value);

    try {
      new URL(url);
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        return config.validation_message || "URL must start with http:// or https://";
      }
      return null;
    } catch {
      return config.validation_message || "Invalid URL format";
    }
  },

  /**
   * Regex validator - uses validation_regex from type definition
   * This is the generic validator that handles ABN, ACN, BSB, TFN, email, phone, etc.
   */
  regex: (value, config) => {
    if (isEmpty(value)) return null;

    const pattern = config.validation_regex;
    if (!pattern) return null;

    // Clean the value - remove spaces/dashes for numeric patterns
    let cleanValue = String(value);
    // If pattern is for digits only, strip non-digits
    if (pattern.includes("\\d")) {
      cleanValue = cleanValue.replace(/[\s-]/g, "");
    }

    try {
      const regex = new RegExp(pattern);
      if (!regex.test(cleanValue)) {
        return config.validation_message || "Invalid format";
      }
      return null;
    } catch {
      console.error(`[ValidationFormatters] Invalid regex pattern: ${pattern}`);
      return null;
    }
  },

  /**
   * Color validator - hex format
   */
  color: (value, config) => {
    if (isEmpty(value)) return null;

    const color = String(value);
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;

    if (!hexRegex.test(color)) {
      return config.validation_message || "Invalid hex color format (e.g., #FF5733)";
    }

    return null;
  },

  /**
   * GPS validator - coordinate format
   */
  gps: (value, config) => {
    if (isEmpty(value)) return null;

    const coords = String(value);
    const gpsRegex = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;

    if (!gpsRegex.test(coords)) {
      return config.validation_message || "Invalid GPS format (e.g., -33.8688, 151.2093)";
    }

    return null;
  },

  /**
   * JSON validator - must be valid JSON
   */
  json: (value, _config) => {
    if (isEmpty(value)) return null;

    if (typeof value === "object") {
      return null; // Already an object
    }

    try {
      JSON.parse(String(value));
      return null;
    } catch {
      return "Must be valid JSON";
    }
  },

  /**
   * Array validator - must be an array
   */
  array: (value, _config) => {
    if (value === null || value === undefined) return null;

    if (!Array.isArray(value)) {
      return "Must be an array";
    }

    return null;
  },

  /**
   * Lookup validator - validation done server-side
   */
  lookup: (_value, _config) => {
    return null;
  },

  /**
   * Read-only validator - no validation needed
   */
  readonly: (_value, _config) => {
    return null;
  },
};

// ============================================================================
// VALIDATOR TYPE MAPPING
// Maps display_formatter to validation logic
// ============================================================================

/**
 * Get the validator type based on the display_formatter
 * Some formatters share validation logic
 */
function getValidatorType(displayFormatter: string, typeKey: string): string {
  // Types that use regex validation (from validation_regex field)
  const regexTypes = [
    "abn", "acn", "bsb", "bank_account", "postcode", "tfn",
    "email", "phone", "mobile"
  ];

  if (regexTypes.includes(typeKey)) {
    return "regex";
  }

  // Types that use australian_spaced formatter but need regex validation
  if (displayFormatter === "australian_spaced" || displayFormatter === "australian_dashed") {
    return "regex";
  }

  // Map display formatters to validators
  const formatterToValidator: Record<string, string> = {
    text: "text",
    multiline: "text",
    number: "number",
    currency: "currency",
    percentage: "percentage",
    date: "date",
    boolean: "boolean",
    choice: "choice",
    lookup: "lookup",
    multiple_lookups: "array",
    color: "color",
    json: "json",
    array: "array",
    file: "text",
    gps: "gps",
    masked: "regex",
    postcode: "regex",
  };

  return formatterToValidator[displayFormatter] || "text";
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Validate a value using the type definition from the registry
 * This is the main entry point for validating cell values
 *
 * @param value - The raw value to validate
 * @param typeKey - The column type key (e.g., 'abn', 'currency', 'email')
 * @returns Validation result with isValid boolean and error message
 */
export function validateValue(value: unknown, typeKey: string): ValidationResult {
  const typeDef = getTypeDefinition(typeKey);

  // If no type definition, assume valid
  if (!typeDef) {
    return { isValid: true, error: null };
  }

  // Determine which validator to use
  const validatorType = getValidatorType(typeDef.display_formatter, typeKey);
  const validator = VALIDATORS[validatorType] || VALIDATORS.text;

  // Run validation
  const error = validator(value, typeDef);

  return {
    isValid: error === null,
    error,
  };
}

/**
 * Validate a cell value with column context
 * This maintains backward compatibility with the existing validateCell API
 *
 * @param value - Value to validate
 * @param columnType - Type of column
 * @param column - Optional full column object for choice validation
 * @returns Validation result
 */
export function validateCell(
  value: unknown,
  columnType: string,
  column?: TableColumn
): ValidationResult {
  const typeDef = getTypeDefinition(columnType);

  // If we have a type definition, use the new system
  if (typeDef) {
    const validatorType = getValidatorType(typeDef.display_formatter, columnType);
    const validator = VALIDATORS[validatorType] || VALIDATORS.text;

    // For choice validation, merge column choices with config
    const config: ValidatorConfig = {
      ...typeDef,
      choices: column?.choices || typeDef.example_values?.split(", "),
    };

    const error = validator(value, config);
    return { isValid: error === null, error };
  }

  // Fallback for types not in registry
  return validateFallback(value, columnType, column);
}

/**
 * Fallback validation for when type definitions aren't loaded
 * This provides basic validation using hardcoded patterns
 */
function validateFallback(
  value: unknown,
  columnType: string,
  column?: TableColumn
): ValidationResult {
  if (isEmpty(value)) {
    return { isValid: true, error: null };
  }

  let error: string | null = null;

  // Basic fallback patterns for common types
  switch (columnType) {
    case "email": {
      // SSoT: Use EMAIL_REGEX from email-constants.ts
      if (!EMAIL_REGEX.test(String(value))) {
        error = "Invalid email format";
      }
      break;
    }
    case "abn": {
      const digits = String(value).replace(/\D/g, "");
      if (digits.length !== 11) {
        error = "ABN must be 11 digits";
      }
      break;
    }
    case "acn": {
      const digits = String(value).replace(/\D/g, "");
      if (digits.length !== 9) {
        error = "ACN must be 9 digits";
      }
      break;
    }
    case "bsb": {
      const digits = String(value).replace(/\D/g, "");
      if (digits.length !== 6) {
        error = "BSB must be 6 digits";
      }
      break;
    }
    case "tfn": {
      const digits = String(value).replace(/\D/g, "");
      if (digits.length !== 9) {
        error = "TFN must be 9 digits";
      }
      break;
    }
    case "postcode": {
      if (!/^\d{4}$/.test(String(value))) {
        error = "Postcode must be 4 digits";
      }
      break;
    }
    case "number":
    case "currency": {
      const num = parseFloat(String(value).replace(/[$,]/g, ""));
      if (isNaN(num)) {
        error = "Must be a valid number";
      }
      break;
    }
    case "whole_number": {
      const num = parseFloat(String(value));
      if (isNaN(num) || !Number.isInteger(num)) {
        error = "Must be a whole number";
      }
      break;
    }
    case "percentage": {
      const num = parseFloat(String(value).replace(/%/g, ""));
      if (isNaN(num) || num < 0 || num > 100) {
        error = "Percentage must be between 0 and 100";
      }
      break;
    }
    case "date":
    case "date_and_time": {
      const date = new Date(String(value));
      if (isNaN(date.getTime())) {
        error = "Invalid date format";
      }
      break;
    }
    case "choice": {
      if (column?.choices && column.choices.length > 0) {
        if (!column.choices.includes(String(value))) {
          error = `Must be one of: ${column.choices.join(", ")}`;
        }
      }
      break;
    }
    case "url": {
      try {
        new URL(String(value));
      } catch {
        error = "Invalid URL format";
      }
      break;
    }
    case "color_picker": {
      if (!/^#[0-9A-Fa-f]{6}$/.test(String(value))) {
        error = "Invalid hex color format";
      }
      break;
    }
  }

  return { isValid: error === null, error };
}

/**
 * Check if a value passes required validation
 */
export function validateRequired(value: unknown, isRequired: boolean): ValidationResult {
  if (!isRequired) {
    return { isValid: true, error: null };
  }

  if (isEmpty(value)) {
    return { isValid: false, error: "This field is required" };
  }

  return { isValid: true, error: null };
}

/**
 * Combine multiple validation results
 */
export function combineValidations(...results: ValidationResult[]): ValidationResult {
  for (const result of results) {
    if (!result.isValid) {
      return result;
    }
  }
  return { isValid: true, error: null };
}
