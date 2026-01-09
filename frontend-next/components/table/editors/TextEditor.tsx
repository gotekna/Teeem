"use client";

/**
 * TextEditor Component
 *
 * Handles text-based cell editing for:
 * - single_line_text
 * - email
 * - phone
 * - url
 * - multiple_lines_text (multiline mode)
 *
 * Features:
 * - Auto-focus on mount
 * - Tab/Shift+Tab for navigation
 * - Escape to cancel
 * - Enter to save (single line) or new line (multiline)
 * - Debounced validation while typing
 * - Error display with red border
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from "@/components/ui/spinner";

import type { TextEditorProps } from './types';

export function TextEditor({
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
  inputType = 'text',
  maxLength,
  multiline = false,
  rows = 3,
}: TextEditorProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Auto-focus when cell becomes focused
  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
      // Select all text for easy replacement
      inputRef.current.select();
    }
  }, [isFocused]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          onBlur(); // Save first
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
          if (!multiline) {
            e.preventDefault();
            onBlur();
            onFocusNext();
          }
          // In multiline mode, Enter creates a new line
          break;
      }
    },
    [onBlur, onFocusNext, onFocusPrev, onCancel, multiline]
  );

  // Handle value change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      let newValue = e.target.value;

      // Enforce maxLength if specified
      if (maxLength && newValue.length > maxLength) {
        newValue = newValue.slice(0, maxLength);
      }

      onChange(newValue);
    },
    [onChange, maxLength]
  );

  // Handle blur (auto-save)
  const handleBlur = useCallback(() => {
    onBlur();
  }, [onBlur]);

  // Common props for both Input and Textarea
  const commonProps = {
    value: value ?? '',
    onChange: handleChange,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    disabled: disabled || isSaving,
    placeholder: placeholder || column.options?.placeholder,
    maxLength,
    className: cn(
      'w-full h-full border-0 focus:ring-2 focus:ring-blue-500 rounded-none',
      error && 'ring-2 ring-red-500 focus:ring-red-500',
      isSaving && 'opacity-50',
      className
    ),
  };

  return (
    <div className="relative w-full h-full">
      {multiline ? (
        <Textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          rows={rows}
          {...commonProps}
        />
      ) : (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={inputType}
          {...commonProps}
        />
      )}

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

export default TextEditor;
