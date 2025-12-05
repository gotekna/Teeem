"use client";

/**
 * NumberEditor Component
 *
 * Handles numeric cell editing for:
 * - number
 * - currency
 * - percentage
 *
 * Features:
 * - Numeric input with validation
 * - Precision control (decimal places)
 * - Min/max bounds
 * - Currency/percentage formatting
 * - Arrow key increment/decrement
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import type { NumberEditorProps } from './types';

export function NumberEditor({
  value,
  onChange,
  column,
  isFocused,
  isSaving,
  error,
  onBlur,
  onFocusNext,
  onFocusPrev,
  onCancel,
  disabled,
  className,
  placeholder,
  precision = 2,
  min,
  max,
  step = 1,
  prefix,
  suffix,
}: NumberEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Track internal string value for editing (allows partial input like "12.")
  const [internalValue, setInternalValue] = useState<string>(() => {
    if (value === null || value === undefined) return '';
    return String(value);
  });

  // Sync internal value when external value changes
  useEffect(() => {
    if (value === null || value === undefined) {
      setInternalValue('');
    } else if (Number(internalValue) !== value) {
      setInternalValue(String(value));
    }
  }, [value, internalValue]);

  // Auto-focus when cell becomes focused
  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isFocused]);

  // Parse string to number
  const parseValue = useCallback(
    (str: string): number | null => {
      if (str === '' || str === '-') return null;

      // Remove prefix/suffix and common formatting
      let cleaned = str;
      if (prefix) cleaned = cleaned.replace(prefix, '');
      if (suffix) cleaned = cleaned.replace(suffix, '');
      cleaned = cleaned.replace(/[$,]/g, '').trim();

      const num = parseFloat(cleaned);
      if (isNaN(num)) return null;

      // Apply precision
      const rounded = Number(num.toFixed(precision));

      // Apply bounds
      if (min !== undefined && rounded < min) return min;
      if (max !== undefined && rounded > max) return max;

      return rounded;
    },
    [prefix, suffix, precision, min, max]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          onBlur();
          if (e.shiftKey) {
            onFocusPrev();
          } else {
            onFocusNext();
          }
          break;

        case 'Escape':
          e.preventDefault();
          onCancel();
          break;

        case 'Enter':
          e.preventDefault();
          onBlur();
          onFocusNext();
          break;

        case 'ArrowUp':
          e.preventDefault();
          {
            const current = value ?? 0;
            const newVal = current + step;
            if (max === undefined || newVal <= max) {
              onChange(Number(newVal.toFixed(precision)));
              setInternalValue(String(newVal.toFixed(precision)));
            }
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          {
            const current = value ?? 0;
            const newVal = current - step;
            if (min === undefined || newVal >= min) {
              onChange(Number(newVal.toFixed(precision)));
              setInternalValue(String(newVal.toFixed(precision)));
            }
          }
          break;
      }
    },
    [onBlur, onFocusNext, onFocusPrev, onCancel, value, step, min, max, precision, onChange]
  );

  // Handle value change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const str = e.target.value;

      // Allow empty, negative sign, decimal point for partial input
      if (str === '' || str === '-' || str === '.' || str === '-.') {
        setInternalValue(str);
        if (str === '') {
          onChange(null);
        }
        return;
      }

      // Validate numeric format (allow partial decimals like "12.")
      if (!/^-?\d*\.?\d*$/.test(str)) {
        return; // Reject invalid characters
      }

      setInternalValue(str);

      // Only update external value if it's a complete number
      if (!str.endsWith('.') && str !== '-') {
        const parsed = parseValue(str);
        onChange(parsed);
      }
    },
    [onChange, parseValue]
  );

  // Handle blur - finalize the value
  const handleBlur = useCallback(() => {
    // Finalize the internal value
    const parsed = parseValue(internalValue);
    if (parsed !== null) {
      setInternalValue(String(parsed));
      onChange(parsed);
    } else {
      setInternalValue('');
      onChange(null);
    }
    onBlur();
  }, [internalValue, parseValue, onChange, onBlur]);

  // Format display value
  const displayValue = (() => {
    if (isFocused) {
      return internalValue;
    }

    if (value === null || value === undefined) {
      return '';
    }

    let formatted = value.toFixed(precision);

    // Add prefix (currency symbol)
    if (prefix) {
      formatted = prefix + formatted;
    }

    // Add suffix (percentage)
    if (suffix) {
      formatted = formatted + suffix;
    }

    return formatted;
  })();

  return (
    <div className="relative w-full h-full">
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled || isSaving}
        placeholder={placeholder}
        className={cn(
          'w-full h-full border-0 focus:ring-2 focus:ring-blue-500 rounded-none text-right',
          error && 'ring-2 ring-red-500 focus:ring-red-500',
          isSaving && 'opacity-50',
          className
        )}
      />

      {/* Saving indicator */}
      {isSaving && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error message tooltip */}
      {error && !isSaving && (
        <div className="absolute left-0 -bottom-6 z-10 px-2 py-1 text-xs text-white bg-red-500 rounded shadow-lg whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}

export default NumberEditor;
