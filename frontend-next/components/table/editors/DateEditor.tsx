 
"use client";

/**
 * DateEditor Component - Minimal useState (UI library requirement only)
 *
 * Handles date/datetime cell editing for:
 * - date
 * - datetime
 *
 * Note: Radix Popover requires controlled `open` state.
 * Manual input uses uncontrolled pattern with ref.
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { format, parse, isValid } from 'date-fns';
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Spinner } from "@/components/ui/spinner";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const lastValueRef = useRef<Date | undefined>(undefined);

  // Radix Popover requires controlled open state (UI library requirement)
  const [open, setOpen] = useState(false);

  // Parse value to Date
  const dateValue = useMemo(() => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    const parsed = new Date(value as string);
    return isValid(parsed) ? parsed : undefined;
  }, [value]);

  // Format for display
  const displayFormat = includeTime ? `${dateFormat} HH:mm` : dateFormat;

  // Format date for input
  const formatDateForInput = useCallback(
    (date: Date | undefined): string => {
      if (!date) return '';
      return format(date, displayFormat);
    },
    [displayFormat]
  );

  // Update input value when date changes externally
  useEffect(() => {
    if (inputRef.current && dateValue !== lastValueRef.current) {
      inputRef.current.value = formatDateForInput(dateValue);
      lastValueRef.current = dateValue;
    }
  }, [dateValue, formatDateForInput]);

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
        lastValueRef.current = date;
        if (inputRef.current) {
          inputRef.current.value = format(date, displayFormat);
        }
      } else {
        onChange(null);
        lastValueRef.current = undefined;
        if (inputRef.current) {
          inputRef.current.value = '';
        }
      }

      if (!includeTime) {
        setOpen(false);
        onBlur();
        onFocusNext();
      }
    },
    [includeTime, dateValue, displayFormat, onChange, onBlur, onFocusNext]
  );

  // Handle manual input blur - validate and save
  const handleInputBlur = useCallback(() => {
    if (!inputRef.current) return;

    const inputValue = inputRef.current.value;

    try {
      const parsed = parse(inputValue, displayFormat, new Date());
      if (isValid(parsed)) {
        onChange(parsed.toISOString());
        inputRef.current.value = format(parsed, displayFormat);
        lastValueRef.current = parsed;
      } else if (inputValue === '') {
        onChange(null);
        lastValueRef.current = undefined;
      } else {
        // Invalid - revert to last valid value
        inputRef.current.value = formatDateForInput(dateValue);
      }
    } catch {
      // Revert to last valid value
      inputRef.current.value = formatDateForInput(dateValue);
    }
  }, [displayFormat, dateValue, onChange, formatDateForInput]);

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
      lastValueRef.current = undefined;
      if (inputRef.current) {
        inputRef.current.value = '';
      }
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
              <Spinner size={16} className="ml-auto" />
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-2 border-b">
            <Input
              ref={inputRef}
              defaultValue={formatDateForInput(dateValue)}
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
