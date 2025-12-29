import { EMAIL_REGEX } from "./email-constants";

/**
 * Table Cell Validation System
 *
 * ⚠️ DEPRECATED: This file is no longer used.
 *
 * Use the new validation system instead:
 * @see components/table/core/column-renderer/CellValidation.tsx
 *
 * Migration:
 * - Old: import { validateCell } from '@/lib/table-validation'
 * - New: import { validateCell } from '@/components/table/core/column-renderer/CellValidation'
 *
 * The new system provides the same validateCell() function with identical API,
 * but is organized with the column renderer registry for better SSoT compliance.
 *
 * Provides validation rules for each column type with:
 * - Debounced validation while typing (500ms)
 * - Immediate validation on blur
 * - Graceful error handling (show error but allow navigation)
 *
 * Validation is client-side for immediate feedback.
 * Server-side validation still happens on save.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// VALIDATION TYPES
// ============================================================================

export interface ValidationRule {
  type: 'required' | 'regex' | 'min' | 'max' | 'minLength' | 'maxLength' | 'custom';
  message: string;
  // For regex type
  pattern?: RegExp;
  // For min/max/minLength/maxLength types
  value?: number;
  // For custom type
  validate?: (value: unknown) => boolean;
}

export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

// ============================================================================
// COLUMN TYPE VALIDATORS
// ============================================================================

/**
 * Validation rules by column type
 * These match the column types defined in GOLD_STANDARD_TABLE.md
 */
export const ColumnValidators: Record<string, ValidationRule[]> = {
  // Text types
  single_line_text: [],
  multiple_lines_text: [],

  // Email - must be valid email format
  // SSoT: Use EMAIL_REGEX from email-constants.ts
  email: [
    {
      type: 'regex',
      pattern: EMAIL_REGEX,
      message: 'Invalid email address',
    },
  ],

  // Phone - flexible format but must have 8+ digits
  phone: [
    {
      type: 'regex',
      pattern: /^[\d\s\-\(\)\+\.]{8,}$/,
      message: 'Invalid phone number',
    },
  ],

  // URL - must be valid URL format
  url: [
    {
      type: 'regex',
      pattern: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i,
      message: 'Invalid URL format',
    },
  ],

  // Number types
  number: [
    {
      type: 'custom',
      message: 'Must be a valid number',
      validate: (value) => {
        if (value === null || value === undefined || value === '') return true;
        return !isNaN(Number(value));
      },
    },
  ],

  currency: [
    {
      type: 'custom',
      message: 'Must be a valid currency amount',
      validate: (value) => {
        if (value === null || value === undefined || value === '') return true;
        const num = Number(String(value).replace(/[$,]/g, ''));
        return !isNaN(num);
      },
    },
  ],

  percentage: [
    {
      type: 'custom',
      message: 'Must be a valid percentage (0-100)',
      validate: (value) => {
        if (value === null || value === undefined || value === '') return true;
        const num = Number(String(value).replace(/%/g, ''));
        return !isNaN(num) && num >= 0 && num <= 100;
      },
    },
  ],

  // Australian Business Number - exactly 11 digits
  abn: [
    {
      type: 'regex',
      pattern: /^\d{11}$/,
      message: 'ABN must be exactly 11 digits',
    },
  ],

  // Date types - validated by date picker component
  date: [],
  datetime: [],

  // Boolean - no validation needed
  boolean: [],

  // Choice types - validated by component
  choice: [],
  single_select: [],
  multiple_select: [],

  // Lookup types - validated by component
  lookup: [],
  relation: [],

  // File types - validated by component
  file: [],
  image: [],

  // Computed types - read-only, no validation
  formula: [],
  computed: [],
  rollup: [],

  // Special types
  color: [
    {
      type: 'regex',
      pattern: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
      message: 'Must be a valid hex color (e.g., #FF0000)',
    },
  ],

  rating: [
    {
      type: 'custom',
      message: 'Rating must be between 1 and 5',
      validate: (value) => {
        if (value === null || value === undefined) return true;
        const num = Number(value);
        return !isNaN(num) && num >= 1 && num <= 5;
      },
    },
  ],

  duration: [
    {
      type: 'custom',
      message: 'Must be a valid duration',
      validate: (value) => {
        if (value === null || value === undefined || value === '') return true;
        // Accept formats: "1:30", "1h 30m", "90", etc.
        return true; // Duration parsing is complex, let it through
      },
    },
  ],
};

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate a single value against a set of rules
 */
export function validateValue(
  value: unknown,
  rules: ValidationRule[]
): ValidationResult {
  for (const rule of rules) {
    const isEmpty = value === null || value === undefined || value === '';

    switch (rule.type) {
      case 'required':
        if (isEmpty) {
          return { isValid: false, error: rule.message };
        }
        break;

      case 'regex':
        if (!isEmpty && rule.pattern) {
          const strValue = String(value);
          if (!rule.pattern.test(strValue)) {
            return { isValid: false, error: rule.message };
          }
        }
        break;

      case 'min':
        if (!isEmpty && rule.value !== undefined) {
          const numValue = Number(value);
          if (numValue < rule.value) {
            return { isValid: false, error: rule.message };
          }
        }
        break;

      case 'max':
        if (!isEmpty && rule.value !== undefined) {
          const numValue = Number(value);
          if (numValue > rule.value) {
            return { isValid: false, error: rule.message };
          }
        }
        break;

      case 'minLength':
        if (!isEmpty && rule.value !== undefined) {
          const strValue = String(value);
          if (strValue.length < rule.value) {
            return { isValid: false, error: rule.message };
          }
        }
        break;

      case 'maxLength':
        if (!isEmpty && rule.value !== undefined) {
          const strValue = String(value);
          if (strValue.length > rule.value) {
            return { isValid: false, error: rule.message };
          }
        }
        break;

      case 'custom':
        if (rule.validate && !rule.validate(value)) {
          return { isValid: false, error: rule.message };
        }
        break;
    }
  }

  return { isValid: true, error: null };
}

/**
 * Validate a cell value by column type
 */
export function validateCell(
  value: unknown,
  columnType: string,
  additionalRules?: ValidationRule[]
): ValidationResult {
  const typeRules = ColumnValidators[columnType] || [];
  const allRules = additionalRules
    ? [...typeRules, ...additionalRules]
    : typeRules;

  return validateValue(value, allRules);
}

// ============================================================================
// VALIDATION HOOKS
// ============================================================================

/**
 * Hook for debounced validation
 * Validates 500ms after typing stops + on blur
 *
 * @param value - Current cell value
 * @param columnType - Type of column for validation rules
 * @param delay - Debounce delay in ms (default 500)
 * @returns { error, validate, clearError }
 */
export function useDebouncedValidation(
  value: unknown,
  columnType: string,
  additionalRules?: ValidationRule[],
  delay = 500
) {
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastValueRef = useRef<unknown>(value);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Debounced validation on value change
  useEffect(() => {
    // Skip if value hasn't changed
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for debounced validation
    timeoutRef.current = setTimeout(() => {
      const result = validateCell(value, columnType, additionalRules);
      setError(result.error);
    }, delay);
  }, [value, columnType, additionalRules, delay]);

  // Immediate validation (for blur)
  const validate = useCallback((): ValidationResult => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const result = validateCell(value, columnType, additionalRules);
    setError(result.error);
    return result;
  }, [value, columnType, additionalRules]);

  // Clear error manually
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { error, validate, clearError };
}

/**
 * Hook for cell validation state management
 * Combines validation with pending edit tracking
 */
export function useCellValidation(
  rowId: string | number,
  columnKey: string,
  columnType: string,
  initialValue: unknown,
  additionalRules?: ValidationRule[]
) {
  const [value, setValue] = useState(initialValue);
  const [isDirty, setIsDirty] = useState(false);
  const { error, validate, clearError } = useDebouncedValidation(
    value,
    columnType,
    additionalRules
  );

  // Update value and mark as dirty
  const updateValue = useCallback(
    (newValue: unknown) => {
      setValue(newValue);
      if (newValue !== initialValue) {
        setIsDirty(true);
      }
    },
    [initialValue]
  );

  // Reset to initial value
  const reset = useCallback(() => {
    setValue(initialValue);
    setIsDirty(false);
    clearError();
  }, [initialValue, clearError]);

  // Validate on blur
  const validateOnBlur = useCallback(() => {
    return validate();
  }, [validate]);

  return {
    value,
    updateValue,
    isDirty,
    error,
    validate: validateOnBlur,
    reset,
    cellKey: `${rowId}:${columnKey}`,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get validation rules for a column type
 */
export function getValidationRules(columnType: string): ValidationRule[] {
  return ColumnValidators[columnType] || [];
}

/**
 * Create a required rule with custom message
 */
export function requiredRule(message = 'This field is required'): ValidationRule {
  return { type: 'required', message };
}

/**
 * Create a min length rule
 */
export function minLengthRule(length: number, message?: string): ValidationRule {
  return {
    type: 'minLength',
    value: length,
    message: message || `Must be at least ${length} characters`,
  };
}

/**
 * Create a max length rule
 */
export function maxLengthRule(length: number, message?: string): ValidationRule {
  return {
    type: 'maxLength',
    value: length,
    message: message || `Must be no more than ${length} characters`,
  };
}

/**
 * Create a regex rule
 */
export function regexRule(pattern: RegExp, message: string): ValidationRule {
  return { type: 'regex', pattern, message };
}

/**
 * Create a custom validation rule
 */
export function customRule(
  validate: (value: unknown) => boolean,
  message: string
): ValidationRule {
  return { type: 'custom', validate, message };
}
