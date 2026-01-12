/**
 * TableHeaderSection Component
 *
 * Renders the table header with resizable columns, sorting, filtering, and grouping controls.
 * Extracted from TeeemTableView to improve code organization.
 *
 * @see Phase 6 refactoring - Render Functions extraction
 */

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResizableColumnHeader } from '../../components/ResizableColumnHeader';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Spinner } from "@/components/ui/spinner";
import { cn } from '@/lib/utils';
import { isLookupColumn } from '@/lib/constants/column-types';
import type { TableColumn, CascadeFilter } from '../../types';

/**
 * Xero column tooltips - explains what each Xero-related field means
 */
const XERO_COLUMN_TOOLTIPS: Record<string, string> = {
  xero_linked_count: 'Number of Xero organizations this contact is linked to',
  xero_tenant_names: 'Names of the Xero organizations this contact is linked to',
  xero_contact_types: 'Whether this contact is a Customer and/or Supplier in Xero',
  xero_invoice_count: 'Total Xero transactions (sales invoices + supplier bills) for this contact',
  sync_with_xero: 'Whether this contact is configured to sync with Xero',
  xero_contact_number: 'Unique contact identifier number in Xero',
  xero_account_number: 'Account number assigned in Xero',
  xero_id: 'Unique Xero contact ID (internal reference)',
  xero_link_summary: 'Summary of Xero links showing connected organizations',
};

const SYSTEM_COLUMN_BG = 'hsl(47, 100%, 96%)'; // Light yellow tint
// GOLD STANDARD: Sticky is position-based (select + position 2)
// This is only used for z-index calculation - actual sticky comes from getStickyColumnStyles
const STICKY_COLUMNS = ['select'];

export interface TableHeaderSectionProps {
  /** Visible columns in display order */
  visibleColumnsInOrder: TableColumn[];

  /** Column widths map */
  columnWidths: Record<string, number>;

  /** Selected rows */
  selectedRows: Set<number | string>;

  /** All filtered and sorted entries */
  filteredAndSortedEntries: Array<{ id: number | string; [key: string]: unknown }>;

  /** Sort configuration */
  sortColumns: Array<{ column: string; dir: 'asc' | 'desc' | 'custom'; customOrder?: string[] }>;

  /** Currently grouped column */
  groupByColumn: string | null;

  /** Whether column edit mode is active */
  columnEditMode: boolean;

  /** Toggle select all rows */
  toggleSelectAll: () => void;

  /** Column resize handler */
  handleColumnResize: (key: string, width: number) => void;

  /** Sort handler */
  handleSort: (columnKey: string) => void;

  /** Hide column handler */
  hideColumn: (columnKey: string) => void;

  /** Group by column handler */
  handleGroupByColumn: (columnKey: string | null) => void;

  /** Add filter for column handler */
  addFilterForColumn: (columnKey: string) => void;

  /** Open column edit modal */
  handleOpenColumnEdit: (columnKey: string) => void;

  /** Function to get sticky column styles */
  getStickyColumnStyles: (key: string, isHeader: boolean) => React.CSSProperties;

  /** Function to check if column is system-generated */
  isSystemGeneratedColumn: (column: TableColumn) => boolean;

  /** Whether to show inline column filters */
  showColumnFilters?: boolean;

  /** Current cascade filters */
  cascadeFilters?: CascadeFilter[];

  /** Update a filter */
  updateFilter?: (id: string | number, updates: Partial<CascadeFilter>) => void;

  /** Remove a filter */
  removeFilter?: (id: string | number) => void;

  /** Create a filter with a value (for inline column filters) */
  createFilterWithValue?: (columnKey: string, value: string, operator?: '=' | 'contains' | 'is_empty' | 'is_not_empty') => void;

  /** All columns (for creating new filters) */
  columns?: TableColumn[];

  /** Lookup options for dropdown filters */
  lookupOptions?: Record<string, Array<{ id: number; display: string }>>;

  /** Loading state for lookup options */
  lookupLoading?: Record<string, boolean>;

  /** Fetch lookup options for a column */
  onFetchLookupOptions?: (column: TableColumn) => void;
}

/**
 * Table header component with resizable columns and controls
 */
export function TableHeaderSection({
  visibleColumnsInOrder,
  columnWidths,
  selectedRows,
  filteredAndSortedEntries,
  sortColumns,
  groupByColumn,
  columnEditMode,
  toggleSelectAll,
  handleColumnResize,
  handleSort,
  hideColumn,
  handleGroupByColumn,
  addFilterForColumn,
  handleOpenColumnEdit,
  getStickyColumnStyles,
  isSystemGeneratedColumn,
  showColumnFilters = false,
  cascadeFilters = [],
  updateFilter,
  removeFilter,
  createFilterWithValue,
  columns = [],
  lookupOptions = {},
  lookupLoading = {},
  onFetchLookupOptions,
}: TableHeaderSectionProps) {
  // Local state for filter input values (debounced updates to cascade filters)
  const [localFilterValues, setLocalFilterValues] = useState<Record<string, string>>({});

  // GOLD STANDARD: Sticky is position-based
  // Position 1 (select), Position 2 (first data column), and actions are sticky
  const isStickyColumn = (key: string, index: number) =>
    key === 'select' || index === 1 || key === 'actions';

  // Pre-fetch lookup options for visible lookup columns when filters are shown
  useEffect(() => {
    if (!showColumnFilters || !onFetchLookupOptions) return;

    visibleColumnsInOrder.forEach(column => {
      // BUG FIX: Was missing 'multiple_lookups' - now uses SSoT constant
      if (isLookupColumn(column.column_type) && column.lookup_foundation_id && !lookupOptions[column.key]) {
        onFetchLookupOptions(column);
      }
    });
  }, [showColumnFilters, visibleColumnsInOrder, lookupOptions, onFetchLookupOptions]);

  // Get column metadata from columns array
  const getColumnMeta = useCallback((columnKey: string): TableColumn | undefined => {
    return columns.find(c => c.key === columnKey) || visibleColumnsInOrder.find(c => c.key === columnKey);
  }, [columns, visibleColumnsInOrder]);

  // Get the filter for a specific column (if any)
  const getColumnFilter = useCallback((columnKey: string): CascadeFilter | undefined => {
    return cascadeFilters.find(f => f.column === columnKey);
  }, [cascadeFilters]);

  // Handle filter input change (for text inputs)
  const handleFilterChange = useCallback((columnKey: string, value: string) => {
    setLocalFilterValues(prev => ({ ...prev, [columnKey]: value }));

    const existingFilter = cascadeFilters.find(f => f.column === columnKey && f.operator === 'contains');

    if (value.trim() === '') {
      // Remove filter if value is empty
      if (existingFilter && removeFilter) {
        removeFilter(existingFilter.id);
      }
    } else if (existingFilter && updateFilter) {
      // Update existing filter
      updateFilter(existingFilter.id, { value });
    } else if (createFilterWithValue) {
      // Create new filter with value (inline - doesn't open panel)
      createFilterWithValue(columnKey, value);
    }
  }, [cascadeFilters, updateFilter, removeFilter, createFilterWithValue]);

  // Special filter values for is_empty/is_not_empty operators
  const FILTER_EMPTY = '__empty__';
  const FILTER_NOT_EMPTY = '__not_empty__';

  // Handle dropdown filter change (boolean, lookup, choice)
  const handleDropdownFilterChange = useCallback((columnKey: string, value: string, operator: '=' | 'contains' | 'is_empty' | 'is_not_empty' = '=') => {
    const existingFilter = cascadeFilters.find(f => f.column === columnKey);

    if (value === '' || value === 'all') {
      // Remove filter if "All" is selected
      if (existingFilter && removeFilter) {
        removeFilter(existingFilter.id);
      }
    } else if (value === FILTER_EMPTY || value === FILTER_NOT_EMPTY) {
      // Handle special empty/not-empty filters
      const specialOperator = value === FILTER_EMPTY ? 'is_empty' : 'is_not_empty';
      if (existingFilter && updateFilter) {
        updateFilter(existingFilter.id, { value: '', operator: specialOperator });
      } else if (createFilterWithValue) {
        createFilterWithValue(columnKey, '', specialOperator);
      }
    } else if (existingFilter && updateFilter) {
      // Update existing filter with new value and operator
      updateFilter(existingFilter.id, { value, operator });
    } else if (createFilterWithValue) {
      // Create new filter with the specified operator
      createFilterWithValue(columnKey, value, operator);
    }
  }, [cascadeFilters, updateFilter, removeFilter, createFilterWithValue]);

  // Clear filter for a column
  const clearFilter = useCallback((columnKey: string) => {
    setLocalFilterValues(prev => {
      const updated = { ...prev };
      delete updated[columnKey];
      return updated;
    });

    const existingFilter = cascadeFilters.find(f => f.column === columnKey);
    if (existingFilter && removeFilter) {
      removeFilter(existingFilter.id);
    }
  }, [cascadeFilters, removeFilter]);

  // Get display value for filter input
  const getFilterDisplayValue = useCallback((columnKey: string): string => {
    // First check local state (for immediate typing feedback)
    if (localFilterValues[columnKey] !== undefined) {
      return localFilterValues[columnKey];
    }
    // Fall back to cascade filter value
    const filter = cascadeFilters.find(f => f.column === columnKey);
    // Handle special operators (is_empty, is_not_empty)
    if (filter?.operator === 'is_empty') return FILTER_EMPTY;
    if (filter?.operator === 'is_not_empty') return FILTER_NOT_EMPTY;
    return filter?.value?.toString() || '';
  }, [localFilterValues, cascadeFilters]);

  return (
    <TableHeader>
      <TableRow>
        {visibleColumnsInOrder.map((column, colIndex) => {
          const stickyStyles = getStickyColumnStyles(column.key, true);
          const isSticky = isStickyColumn(column.key, colIndex);
          const isSystemGen = isSystemGeneratedColumn(column);

          // Determine background color - system columns get yellow, others get muted
          const bgColor = isSystemGen && column.key !== "select" && column.key !== "actions"
            ? SYSTEM_COLUMN_BG
            : 'hsl(var(--muted))'; // Match bg-muted for solid sticky background

          return (
            <TableHead
              key={`${column.key}-${colIndex}`}
              style={{
                width: columnWidths[column.key] || column.width,
                minWidth: columnWidths[column.key] || column.width || 50,
                backgroundColor: bgColor,
                ...stickyStyles,
                ...(column.key === "select" && {
                  textAlign: 'center',
                  verticalAlign: 'middle',
                }),
              }}
              className={cn(
                "sticky top-0",
                isSticky ? "z-30" : "z-20",
                column.key === "select" && "!border-r-0 !p-0 !h-full",
                column.key === "actions" && "!border-l-0"
              )}
            >
              {column.key === "select" ? (
                <div className="flex items-center justify-center w-full h-full">
                  <Checkbox
                    checked={
                      selectedRows.size === filteredAndSortedEntries.length &&
                      filteredAndSortedEntries.length > 0
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </div>
              ) : column.key === "actions" ? (
                <span className="truncate">{column.label}</span>
              ) : (
                <ResizableColumnHeader
                  column={column}
                  width={columnWidths[column.key] || column.width || 150}
                  onResize={handleColumnResize}
                  onSort={handleSort}
                  onHide={hideColumn}
                  onGroupBy={handleGroupByColumn}
                  onAddFilter={addFilterForColumn}
                  onEdit={handleOpenColumnEdit}
                  sortInfo={sortColumns.find((s) => s.column === column.key)}
                  isGroupedBy={groupByColumn === column.key}
                  isEditMode={columnEditMode}
                >
                  {XERO_COLUMN_TOOLTIPS[column.key] ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="truncate cursor-help border-b border-dashed border-border dark:border-border">
                            {column.label}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                          <p>{XERO_COLUMN_TOOLTIPS[column.key]}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="truncate">{column.label}</span>
                  )}
                </ResizableColumnHeader>
              )}
            </TableHead>
          );
        })}
      </TableRow>

      {/* Inline Column Filters Row */}
      {showColumnFilters && (
        <TableRow className="bg-muted/30 dark:bg-muted/10">
          {visibleColumnsInOrder.map((column, colIndex) => {
            const stickyStyles = getStickyColumnStyles(column.key, true);
            const isSticky = isStickyColumn(column.key, colIndex);
            const filterValue = getFilterDisplayValue(column.key);
            const hasFilter = filterValue.length > 0;

            // Get column metadata for type detection
            const colMeta = getColumnMeta(column.key) || column;
            const colType = colMeta.column_type || '';
            const isBoolean = colType === 'boolean';
            const isLookup = isLookupColumn(colType);
            const isChoice = colType === 'choice';
            const hasChoices = colMeta.choices && colMeta.choices.length > 0;
            const options = lookupOptions[column.key] || [];
            const isLoading = lookupLoading[column.key] || false;

            // Skip filter inputs for select and actions columns
            if (column.key === "select" || column.key === "actions") {
              return (
                <TableHead
                  key={`filter-${column.key}-${colIndex}`}
                  style={{
                    width: columnWidths[column.key] || column.width,
                    minWidth: columnWidths[column.key] || column.width || 50,
                    backgroundColor: 'hsl(var(--muted) / 0.3)',
                    ...stickyStyles,
                  }}
                  className={cn(
                    "sticky top-[28px] py-1 px-1",
                    isSticky ? "z-30" : "z-20",
                    column.key === "select" && "!border-r-0",
                    column.key === "actions" && "!border-l-0"
                  )}
                />
              );
            }

            // Render the appropriate filter input based on column type
            const renderFilterInput = () => {
              // Boolean column - Yes/No dropdown
              if (isBoolean) {
                return (
                  <Select
                    value={filterValue || 'all'}
                    onValueChange={(value) => handleDropdownFilterChange(column.key, value, '=')}
                  >
                    <SelectTrigger className={cn("h-7 text-xs", hasFilter && "border-primary")}>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                      <SelectSeparator />
                      <SelectItem value={FILTER_EMPTY} className="text-muted-foreground italic">Empty</SelectItem>
                      <SelectItem value={FILTER_NOT_EMPTY} className="text-muted-foreground italic">Not Empty</SelectItem>
                    </SelectContent>
                  </Select>
                );
              }

              // Lookup column - dropdown with lookup values
              if (isLookup && colMeta.lookup_foundation_id) {
                if (isLoading) {
                  return (
                    <div className="h-7 flex items-center justify-center text-muted-foreground">
                      <Spinner size={12} />
                    </div>
                  );
                }

                if (options.length > 0) {
                  return (
                    <Select
                      value={filterValue || 'all'}
                      onValueChange={(value) => handleDropdownFilterChange(column.key, value, '=')}
                    >
                      <SelectTrigger className={cn("h-7 text-xs", hasFilter && "border-primary")}>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value={FILTER_EMPTY} className="text-muted-foreground italic">Empty</SelectItem>
                        <SelectItem value={FILTER_NOT_EMPTY} className="text-muted-foreground italic">Not Empty</SelectItem>
                        <SelectSeparator />
                        {/* Filter out options with empty display values - use display for filtering since data contains display values */}
                        {options.filter(opt => opt.display != null && String(opt.display) !== '').map((opt) => (
                          <SelectItem key={opt.id} value={String(opt.display)}>
                            {opt.display}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }
              }

              // Choice column - dropdown with choices
              if ((isChoice || hasChoices) && colMeta.choices && colMeta.choices.length > 0) {
                return (
                  <Select
                    value={filterValue || 'all'}
                    onValueChange={(value) => handleDropdownFilterChange(column.key, value, '=')}
                  >
                    <SelectTrigger className={cn("h-7 text-xs", hasFilter && "border-primary")}>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value={FILTER_EMPTY} className="text-muted-foreground italic">Empty</SelectItem>
                      <SelectItem value={FILTER_NOT_EMPTY} className="text-muted-foreground italic">Not Empty</SelectItem>
                      <SelectSeparator />
                      {/* Filter out empty strings - Select.Item cannot have empty string value */}
                      {colMeta.choices.filter(c => c && c !== '').map((choice) => (
                        <SelectItem key={choice} value={choice}>
                          {choice}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              }

              // Default: text input
              return (
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Filter..."
                    value={filterValue}
                    onChange={(e) => handleFilterChange(column.key, e.target.value)}
                    className={cn(
                      "h-7 text-xs pr-6",
                      hasFilter && "border-primary"
                    )}
                  />
                  {hasFilter && (
                    <button
                      onClick={() => clearFilter(column.key)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            };

            return (
              <TableHead
                key={`filter-${column.key}-${colIndex}`}
                style={{
                  width: columnWidths[column.key] || column.width,
                  minWidth: columnWidths[column.key] || column.width || 50,
                  backgroundColor: 'hsl(var(--muted) / 0.3)',
                  ...stickyStyles,
                }}
                className={cn(
                  "sticky top-[28px] py-1 px-1",
                  isSticky ? "z-30" : "z-20"
                )}
              >
                {renderFilterInput()}
              </TableHead>
            );
          })}
        </TableRow>
      )}
    </TableHeader>
  );
}
