 
"use client";

/**
 * ChoiceEditor Component - Minimal useState (UI library requirement only)
 *
 * Handles choice/select cell editing for:
 * - choice
 * - single_select
 * - multiple_select (with multiple prop)
 *
 * Note: Radix Popover requires controlled `open` state.
 * This is a UI library requirement, not application state.
 * Search uses uncontrolled input pattern.
 */

import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, X } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from "@/components/ui/spinner";
import type { ChoiceEditorProps, ChoiceOption } from './types';

export function ChoiceEditor({
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
  options = [],
  multiple = false,
  creatable = false,
  onCreateOption,
}: ChoiceEditorProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Radix Popover requires controlled open state (UI library requirement)
  const [open, setOpen] = useState(false);

  // Get options from column or props
  const allOptions: ChoiceOption[] = useMemo(() =>
    options.length > 0
      ? options
      : (column.options?.choices || []).map((c: { label: string; value: string; color?: string }) => ({
          label: c.label,
          value: c.value,
          color: c.color,
        })),
    [options, column.options?.choices]
  );

  // Current selection as array
  const selectedValues: string[] = useMemo(() =>
    multiple
      ? Array.isArray(value)
        ? value
        : value
        ? [value]
        : []
      : value
      ? [value as string]
      : [],
    [multiple, value]
  );

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
      }
    },
    [onBlur, onFocusNext, onFocusPrev, onCancel]
  );

  // Handle selection
  const handleSelect = useCallback(
    (optionValue: string) => {
      if (multiple) {
        const currentValues = selectedValues;
        const newValues = currentValues.includes(optionValue)
          ? currentValues.filter((v) => v !== optionValue)
          : [...currentValues, optionValue];
        onChange(newValues);
      } else {
        onChange(optionValue);
        setOpen(false);
        onBlur();
        onFocusNext();
      }
    },
    [multiple, selectedValues, onChange, onBlur, onFocusNext]
  );

  // Handle clear
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(multiple ? [] : '');
    },
    [multiple, onChange]
  );

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

  // Get option by value
  const getOption = useCallback(
    (val: string): ChoiceOption | undefined =>
      allOptions.find((opt) => opt.value === val),
    [allOptions]
  );

  // Handle create option
  const handleCreateOption = useCallback(
    (searchValue: string) => {
      onCreateOption?.(searchValue);
      handleSelect(searchValue);
      // Clear search input via ref
      if (searchInputRef.current) {
        searchInputRef.current.value = '';
      }
    },
    [onCreateOption, handleSelect]
  );

  // Render selected value(s)
  const renderValue = () => {
    if (selectedValues.length === 0) {
      return (
        <span className="text-muted-foreground">
          {placeholder || 'Select...'}
        </span>
      );
    }

    if (multiple) {
      return (
        <div className="flex flex-wrap gap-1">
          {selectedValues.map((val) => {
            const opt = getOption(val);
            return (
              <Badge
                key={val}
                variant="secondary"
                style={{
                  backgroundColor: opt?.color ? `${opt.color}20` : undefined,
                  borderColor: opt?.color,
                }}
                className="text-xs"
              >
                {opt?.label || val}
                <X
                  className="ml-1 h-3 w-3 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(val);
                  }}
                />
              </Badge>
            );
          })}
        </div>
      );
    }

    const opt = getOption(selectedValues[0]);
    return (
      <Badge
        variant="secondary"
        style={{
          backgroundColor: opt?.color ? `${opt.color}20` : undefined,
          borderColor: opt?.color,
        }}
      >
        {opt?.label || selectedValues[0]}
      </Badge>
    );
  };

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
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isSaving}
            className={cn(
              'w-full h-full justify-between px-2 font-normal border-0 rounded-none hover:bg-muted/50',
              isSaving && 'opacity-50'
            )}
          >
            <div className="flex-1 text-left truncate">{renderValue()}</div>
            <div className="flex items-center gap-1 ml-2">
              {selectedValues.length > 0 && !disabled && !isSaving && (
                <X
                  className="h-4 w-4 opacity-50 hover:opacity-100"
                  onClick={handleClear}
                />
              )}
              {isSaving ? (
                <Spinner size={16} />
              ) : (
                <ChevronDown className="h-4 w-4 opacity-50" />
              )}
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[200px] p-0" align="start">
          <Command shouldFilter={true}>
            <CommandInput
              ref={searchInputRef}
              placeholder="Search..."
            />
            <CommandList>
              <CommandEmpty>
                {creatable ? (
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => {
                      const searchValue = searchInputRef.current?.value || '';
                      if (searchValue) {
                        handleCreateOption(searchValue);
                      }
                    }}
                  >
                    Create new option
                  </Button>
                ) : (
                  'No options found.'
                )}
              </CommandEmpty>
              <CommandGroup>
                {allOptions.map((option) => {
                  const isSelected = selectedValues.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => handleSelect(option.value)}
                    >
                      <div
                        className={cn(
                          'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
                          isSelected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'opacity-50'
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      {option.color && (
                        <div
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: option.color }}
                        />
                      )}
                      {option.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
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

export default ChoiceEditor;
