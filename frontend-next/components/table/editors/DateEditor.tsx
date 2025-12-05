"use client";

/**
 * DateEditor Component
 *
 * Handles date/datetime cell editing for:
 * - date
 * - datetime
 *
 * Features:
 * - Calendar picker
 * - Optional time picker
 * - Keyboard navigation
 * - Date format display
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { format, parse, isValid } from 'date-fns';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import type { DateEditorProps } from './types';

export function DateEditor({
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
  dateFormat = 'dd/MM/yyyy',
  includeTime = false,
  minDate,
  maxDate,
}: DateEditorProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Parse value to Date
  const dateValue = (() => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    const parsed = new Date(value as string);
    return isValid(parsed) ? parsed : undefined;
  })();

  // Format for display
  const displayFormat = includeTime ? `${dateFormat} HH:mm` : dateFormat;

  // Update input value when date changes
  useEffect(() => {
    if (dateValue) {
      setInputValue(format(dateValue, displayFormat));
    } else {
      setInputValue('');
    }
  }, [dateValue, displayFormat]);

  // Auto-focus and open when cell becomes focused
  useEffect(() => {
    if (isFocused && triggerRef.current) {
      triggerRef.current.focus();
      setOpen(true);
    }
  }, [isFocused]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          setOpen(false);
          onBlur();
          if (e.shiftKey) {
            onFocusPrev();
          } else {
            onFocusNext();
          }
          break;

        case 'Escape':
          e.preventDefault();
          setOpen(false);
          onCancel();
          break;

        case 'Enter':
          if (!open) {
            setOpen(true);
          }
          break;
      }
    },
    [open, onBlur, onFocusNext, onFocusPrev, onCancel]
  );

  // Handle calendar selection
  const handleSelect = useCallback(
    (date: Date | undefined) => {
      if (date) {
        // If includeTime and we have an existing time, preserve it
        if (includeTime && dateValue) {
          date.setHours(dateValue.getHours());
          date.setMinutes(dateValue.getMinutes());
        }
        onChange(date.toISOString());
        setInputValue(format(date, displayFormat));
      } else {
        onChange(null);
        setInputValue('');
      }

      if (!includeTime) {
        setOpen(false);
        onBlur();
        onFocusNext();
      }
    },
    [includeTime, dateValue, displayFormat, onChange, onBlur, onFocusNext]
  );

  // Handle manual input
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputValue(val);

      // Try to parse the input
      try {
        const parsed = parse(val, displayFormat, new Date());
        if (isValid(parsed)) {
          onChange(parsed.toISOString());
        }
      } catch {
        // Invalid format, keep the input value for user to correct
      }
    },
    [displayFormat, onChange]
  );

  // Handle input blur
  const handleInputBlur = useCallback(() => {
    // Try to parse one more time
    try {
      const parsed = parse(inputValue, displayFormat, new Date());
      if (isValid(parsed)) {
        onChange(parsed.toISOString());
        setInputValue(format(parsed, displayFormat));
      } else if (inputValue === '') {
        onChange(null);
      }
    } catch {
      // Revert to last valid value
      if (dateValue) {
        setInputValue(format(dateValue, displayFormat));
      } else {
        setInputValue('');
      }
    }
  }, [inputValue, displayFormat, dateValue, onChange]);

  // Handle popover close
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        onBlur();
      }
    },
    [onBlur]
  );

  // Handle clear
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      setInputValue('');
    },
    [onChange]
  );

  return (
    <div
      className={cn(
        'relative w-full h-full',
        error && 'ring-2 ring-red-500',
        className
      )}
      onKeyDown={handleKeyDown}
    >
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            disabled={disabled || isSaving}
            className={cn(
              'w-full h-full justify-start px-2 font-normal border-0 rounded-none hover:bg-muted/50',
              !dateValue && 'text-muted-foreground',
              isSaving && 'opacity-50'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateValue ? (
              format(dateValue, displayFormat)
            ) : (
              <span>{placeholder || 'Pick a date'}</span>
            )}
            {isSaving && (
              <Loader2 className="ml-auto h-4 w-4 animate-spin" />
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-2 border-b">
            <Input
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              placeholder={displayFormat.toLowerCase()}
              className="h-8"
            />
          </div>
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelect}
            disabled={(date) => {
              if (minDate && date < minDate) return true;
              if (maxDate && date > maxDate) return true;
              return false;
            }}
            initialFocus
          />
          {dateValue && (
            <div className="p-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={handleClear}
              >
                Clear
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Error message tooltip */}
      {error && !isSaving && (
        <div className="absolute left-0 -bottom-6 z-10 px-2 py-1 text-xs text-white bg-red-500 rounded shadow-lg whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}

export default DateEditor;
