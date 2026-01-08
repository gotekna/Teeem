/**
 * ActiveFiltersIndicator - Shows active cascade filters with ability to remove
 *
 * Extracted from TeeemTableView to reduce main component size.
 * Shows user-clearable filters (not base/locked filters) with badges.
 *
 * Migration Note (Phase 6.2):
 * This component now reads from TableContext when available.
 * Props are kept for backward compatibility but marked as deprecated.
 */

'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FILTER_OPERATOR_LABELS } from '../utils/table-utils';
import { useTableMaybe } from '../context';
import type { CascadeFilter } from '../types';

export interface ColumnDefinition {
  key: string;
  label?: string;
}

export interface ActiveFiltersIndicatorProps {
  /** Whether column filters are shown (UI toggle) */
  showColumnFilters?: boolean;
  /** @deprecated Use TableContext instead. Whether there are user-clearable filters */
  hasUserFilters?: boolean;
  /** @deprecated Use TableContext instead. All merged filters */
  filters?: CascadeFilter[];
  /** @deprecated Use TableContext instead. Column definitions for looking up labels */
  columns?: ColumnDefinition[];
  /** @deprecated Use TableContext instead. Callback when filter is removed */
  onRemoveFilter?: (filterId: string | number) => void;
  /** @deprecated Use TableContext instead. Callback when "Clear all" is clicked */
  onClearAllFilters?: () => void;
  /** Callback when filter badge is clicked (opens filter editor) */
  onEditFilters?: () => void;
}

export function ActiveFiltersIndicator({
  showColumnFilters: propShowColumnFilters,
  hasUserFilters: propHasUserFilters,
  filters: propFilters,
  columns: propColumns,
  onRemoveFilter: propOnRemoveFilter,
  onClearAllFilters: propOnClearAllFilters,
  onEditFilters,
}: ActiveFiltersIndicatorProps) {
  // Try to get values from context first
  const table = useTableMaybe();

  // Resolve values: context first, props as fallback
  const effectiveShowColumnFilters = propShowColumnFilters ?? table?.filtering.state.showFilters ?? false;
  const effectiveHasUserFilters = table ? table.filtering.state.hasUserFilters : (propHasUserFilters ?? false);
  const effectiveFilters = table ? table.filtering.state.filters : (propFilters ?? []);
  const effectiveColumns = table ? table.columns : (propColumns ?? []);

  // Actions: context first, props as fallback
  const handleRemoveFilter = (id: string | number) => {
    if (table) {
      table.filtering.actions.removeFilter(id);
    }
    propOnRemoveFilter?.(id);
  };

  const handleClearAllFilters = () => {
    if (table) {
      table.filtering.actions.clearAllUserFilters();
    }
    propOnClearAllFilters?.();
  };

  // Only show when column filters enabled and there are user filters
  if (!effectiveShowColumnFilters || !effectiveHasUserFilters) {
    return null;
  }

  // Get user-clearable filters (not base/locked)
  const userFilters = effectiveFilters.filter((f) => !f.locked && f.source !== 'base');

  if (userFilters.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap px-4">
      <span className="text-[11px] text-muted-foreground">Active filters:</span>
      {userFilters.map((filter) => {
        const col = effectiveColumns.find((c) => c.key === filter.column);
        return (
          <Badge
            key={filter.id}
            variant="secondary"
            className="gap-1 cursor-pointer hover:bg-secondary/80"
            onClick={onEditFilters}
            title="Click to edit filters"
          >
            {/* Use friendly label if provided, otherwise show raw filter details */}
            {filter.label ? (
              filter.label
            ) : (
              <>
                {col?.label || filter.column}{" "}
                {FILTER_OPERATOR_LABELS[filter.operator] || filter.operator}{" "}
                {!["is_empty", "is_not_empty"].includes(filter.operator) &&
                  `"${filter.value}"`}
              </>
            )}
            <X
              className="h-3 w-3 text-muted-foreground hover:text-foreground ml-1"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveFilter(filter.id);
              }}
            />
          </Badge>
        );
      })}
      {/* Only show "Clear all" if there are user-clearable filters */}
      {effectiveHasUserFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAllFilters}
          className="h-6 px-2 text-muted-foreground"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}

ActiveFiltersIndicator.displayName = 'ActiveFiltersIndicator';

export default ActiveFiltersIndicator;
