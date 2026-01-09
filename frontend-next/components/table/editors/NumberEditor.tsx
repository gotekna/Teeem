"use client";

/**
 * NumberEditor Component - ZERO useState
 *
 * Handles numeric cell editing for:
 * - number
 * - currency
 * - percentage
 *
 * Uses uncontrolled input pattern (ref-based) for SSoT compliance.
 * No useState - all state flows through atoms or refs.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Spinner } from "@/components/ui/spinner";

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
  // Track last external value to detect external changes
  const lastExternalValueRef = useRef<number | null>(value);

  // Convert value to display string
  const valueToString = useCallback((val: number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    return String(val);
  }, []);

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

  // Auto-focus when cell becomes focused
  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isFocused]);

  // Sync input value when external value changes (not from user typing)
  useEffect(() => {
    if (inputRef.current && value !== lastExternalValueRef.current) {
      // External value changed - update input
      inputRef.current.value = valueToString(value);
      lastExternalValueRef.current = value;
    }
  }, [value, valueToString]);

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
          // Revert input to last known value
          if (inputRef.current) {
            inputRef.current.value = valueToString(value);
          }
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
              const finalVal = Number(newVal.toFixed(precision));
              onChange(finalVal);
              if (inputRef.current) {
                inputRef.current.value = String(finalVal);
              }
              lastExternalValueRef.current = finalVal;
            }
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          {
            const current = value ?? 0;
            const newVal = current - step;
            if (min === undefined || newVal >= min) {
              const finalVal = Number(newVal.toFixed(precision));
              onChange(finalVal);
              if (inputRef.current) {
                inputRef.current.value = String(finalVal);
              }
              lastExternalValueRef.current = finalVal;
            }
          }
          break;
      }
    },
    [onBlur, onFocusNext, onFocusPrev, onCancel, value, step, min, max, precision, onChange, valueToString]
  );

  // Handle input change - validate but don't update atom until blur
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const str = e.target.value;

      // Allow empty, negative sign, decimal point for partial input
      if (str === '' || str === '-' || str === '.' || str === '-.') {
        return; // Allow typing, will validate on blur
      }

      // Validate numeric format (allow partial decimals like "12.")
      if (!/^-?\d*\.?\d*$/.test(str)) {
        // Reject invalid characters - revert to last valid
        e.target.value = valueToString(value);
        return;
      }

      // Allow the input to update (uncontrolled)
      // We'll parse and update the atom on blur
    },
    [value, valueToString]
  );

  // Handle blur - finalize the value and update atom
  const handleBlur = useCallback(() => {
    if (!inputRef.current) {
      onBlur();
      return;
    }

    const inputValue = inputRef.current.value;
    const parsed = parseValue(inputValue);

    if (parsed !== null) {
      // Valid number - update input with normalized value and call onChange
      inputRef.current.value = String(parsed);
      lastExternalValueRef.current = parsed;
      onChange(parsed);
    } else if (inputValue === '' || inputValue === '-') {
      // Empty input - null value
      inputRef.current.value = '';
      lastExternalValueRef.current = null;
      onChange(null);
    } else {
      // Invalid input - revert to last known value
      inputRef.current.value = valueToString(value);
    }

    onBlur();
  }, [parseValue, onChange, onBlur, value, valueToString]);

  // Initial value for uncontrolled input
  const initialValue = valueToString(value);

  return (
    <div className="relative w-full h-full">
      <Input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        defaultValue={initialValue}
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
          <Spinner size={16} className="text-muted-foreground" />
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
