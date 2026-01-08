/**
 * ActiveFiltersIndicator - Shows active cascade filters with ability to remove
 *
 * Extracted from TeeemTableView to reduce main component size.
 * Shows user-clearable filters (not base/locked filters) with badges.
 */

'use client';

import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FILTER_OPERATOR_LABELS } from '../utils/table-utils';

export interface CascadeFilter {
  id: string | number;
  column: string;
  operator: string;
  value: string | number | boolean | null;
  label?: string;
  locked?: boolean;
  source?: string;
}

export interface ColumnDefinition {
  key: string;
  label?: string;
}

export interface ActiveFiltersIndicatorProps {
  /** Whether column filters are shown */
  showColumnFilters: boolean;
  /** Whether there are user-clearable filters */
  hasUserFilters: boolean;
  /** All merged filters */
  filters: CascadeFilter[];
  /** Column definitions for looking up labels */
  columns: ColumnDefinition[];
  /** Callback when filter is removed */
  onRemoveFilter?: (filterId: string | number) => void;
  /** Callback when "Clear all" is clicked */
  onClearAllFilters?: () => void;
  /** Callback when filter badge is clicked (opens filter editor) */
  onEditFilters?: () => void;
}

export function ActiveFiltersIndicator({
  showColumnFilters,
  hasUserFilters,
  filters,
  columns,
  onRemoveFilter,
  onClearAllFilters,
  onEditFilters,
}: ActiveFiltersIndicatorProps) {
  // Only show when column filters enabled and there are user filters
  if (!showColumnFilters || !hasUserFilters) {
    return null;
  }

  // Get user-clearable filters (not base/locked)
  const userFilters = filters.filter((f) => !f.locked && f.source !== 'base');

  if (userFilters.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap px-4">
      <span className="text-[11px] text-muted-foreground">Active filters:</span>
      {userFilters.map((filter) => {
        const col = columns.find((c) => c.key === filter.column);
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
                onRemoveFilter?.(filter.id);
              }}
            />
          </Badge>
        );
      })}
      {/* Only show "Clear all" if there are user-clearable filters */}
      {hasUserFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAllFilters}
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
