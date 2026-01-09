"use client";

/**
 * BooleanEditor Component
 *
 * Handles boolean cell editing with a switch/checkbox.
 *
 * Features:
 * - Toggle on click or Space/Enter
 * - Immediate save on change
 * - Tab navigation
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Spinner } from "@/components/ui/spinner";

import type { BooleanEditorProps } from './types';

export function BooleanEditor({
  value,
  onChange,
  isFocused,
  isSaving,
  error,
  onBlur,
  onFocusNext,
  onFocusPrev,
  onCancel,
  disabled,
  className,
  label,
}: BooleanEditorProps) {
  const switchRef = useRef<HTMLButtonElement>(null);

  // Auto-focus when cell becomes focused
  useEffect(() => {
    if (isFocused && switchRef.current) {
      switchRef.current.focus();
    }
  }, [isFocused]);

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

        case ' ':
        case 'Enter':
          // Let the switch handle these for toggling
          break;
      }
    },
    [onBlur, onFocusNext, onFocusPrev, onCancel]
  );

  // Handle toggle - immediately save
  const handleChange = useCallback(
    (checked: boolean) => {
      onChange(checked);
      // Boolean changes save immediately
      setTimeout(() => onBlur(), 0);
    },
    [onChange, onBlur]
  );

  return (
    <div
      className={cn(
        'flex items-center justify-center w-full h-full px-2',
        error && 'ring-2 ring-red-500',
        className
      )}
    >
      <Switch
        ref={switchRef}
        checked={value ?? false}
        onCheckedChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled || isSaving}
        className={cn(
          'data-[state=checked]:bg-green-500',
          isSaving && 'opacity-50'
        )}
      />

      {label && (
        <span className="ml-2 text-sm text-muted-foreground">{label}</span>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="ml-2">
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

export default BooleanEditor;
