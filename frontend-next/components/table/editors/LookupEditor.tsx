"use client";

/**
 * LookupEditor Component - Minimal useState (UI library requirement only)
 *
 * Handles lookup/relation cell editing for:
 * - lookup
 * - relation
 *
 * Note: Radix Popover requires controlled `open` state.
 * Search uses uncontrolled pattern. Loading uses ref.
 * Records are fetched fresh each time (no local state).
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
import type { LookupEditorProps, LookupRecord } from './types';

export function LookupEditor({
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
  placeholder,
  displayField = 'name',
  multiple = false,
  records: providedRecords,
  onSearch,
}: LookupEditorProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const recordsRef = useRef<LookupRecord[]>(providedRecords || []);
  const isLoadingRef = useRef(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Radix Popover requires controlled open state (UI library requirement)
  const [open, setOpen] = useState(false);
  // Force re-render when records or loading changes
  const [, forceUpdate] = useState(0);

  // Current selection as array of IDs
  const selectedIds: number[] = useMemo(() =>
    multiple
      ? Array.isArray(value)
        ? value
        : value !== null
        ? [value]
        : []
      : value !== null
      ? [value as number]
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

  // Load records when popover opens
  useEffect(() => {
    if (open && onSearch && !isLoadingRef.current && recordsRef.current.length === 0) {
      // Initial load with empty search
      loadRecords('');
    }
     
  }, [open]);

  // Load records function
  const loadRecords = useCallback(async (searchTerm: string) => {
    if (!onSearch) return;

    isLoadingRef.current = true;
    forceUpdate(n => n + 1);

    try {
      const results = await onSearch(searchTerm);
      recordsRef.current = results;
    } catch (err) {
      console.error('Failed to search lookup records:', err);
      recordsRef.current = [];
    } finally {
      isLoadingRef.current = false;
      forceUpdate(n => n + 1);
    }
  }, [onSearch]);

  // Handle search input change (debounced)
  const handleSearchChange = useCallback((searchTerm: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      loadRecords(searchTerm);
    }, 300);
  }, [loadRecords]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

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
    (recordId: number) => {
      if (multiple) {
        const currentIds = selectedIds;
        const newIds = currentIds.includes(recordId)
          ? currentIds.filter((id) => id !== recordId)
          : [...currentIds, recordId];
        onChange(newIds);
      } else {
        onChange(recordId);
        setOpen(false);
        onBlur();
        onFocusNext();
      }
    },
    [multiple, selectedIds, onChange, onBlur, onFocusNext]
  );

  // Handle clear
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(multiple ? [] : null);
    },
    [multiple, onChange]
  );

  // Handle popover close
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) {
        onBlur();
        // Clear search input
        if (searchInputRef.current) {
          searchInputRef.current.value = '';
        }
      }
    },
    [onBlur]
  );

  // Get record by ID
  const getRecord = useCallback(
    (id: number): LookupRecord | undefined =>
      recordsRef.current.find((r) => r.id === id),
    []
  );

  // Get display value for a record
  const getDisplayValue = useCallback(
    (record: LookupRecord): string =>
      String(record[displayField] || record.display_value || record.id),
    [displayField]
  );

  // Render selected value(s)
  const renderValue = () => {
    if (selectedIds.length === 0) {
      return (
        <span className="text-muted-foreground">
          {placeholder || 'Select...'}
        </span>
      );
    }

    if (multiple) {
      return (
        <div className="flex flex-wrap gap-1">
          {selectedIds.map((id) => {
            const record = getRecord(id);
            return (
              <Badge key={id} variant="secondary" className="text-xs">
                {record ? getDisplayValue(record) : `#${id}`}
                <X
                  className="ml-1 h-3 w-3 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(id);
                  }}
                />
              </Badge>
            );
          })}
        </div>
      );
    }

    const record = getRecord(selectedIds[0]);
    return (
      <span className="truncate">
        {record ? getDisplayValue(record) : `#${selectedIds[0]}`}
      </span>
    );
  };

  const isLoading = isLoadingRef.current;
  const records = recordsRef.current;

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
              {selectedIds.length > 0 && !disabled && !isSaving && (
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

        <PopoverContent className="w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              ref={searchInputRef}
              placeholder="Search..."
              onValueChange={handleSearchChange}
            />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Spinner size={24} className="text-muted-foreground" />
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {searchInputRef.current?.value ? 'No results found.' : 'Start typing to search...'}
                  </CommandEmpty>
                  <CommandGroup>
                    {records.map((record) => {
                      const isSelected = selectedIds.includes(record.id as number);
                      return (
                        <CommandItem
                          key={record.id}
                          value={String(record.id)}
                          onSelect={() => handleSelect(record.id as number)}
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
                          <span className="truncate">{getDisplayValue(record)}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
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

export default LookupEditor;
