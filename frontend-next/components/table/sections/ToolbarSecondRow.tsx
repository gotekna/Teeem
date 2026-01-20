/**
 * ToolbarSecondRow - Second toolbar row with views, editing, and group controls
 *
 * Extracted from TeeemTableView to reduce main component size.
 * Contains:
 * - Expand/Collapse all button for grouped tables
 * - Editing controls when rows are being edited
 * - Selection controls for grouped tables
 * - Saved view buttons
 *
 * Migration Note (Phase 6.4):
 * This component now reads from TableContext when available for:
 * - savedViews, activeView, grouping state, selection state
 * Editing-related props and callbacks remain as props.
 */

'use client';

import React, { useMemo } from 'react';
import { ChevronDown, X, Check, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useTableMaybe } from '../context';

export interface SavedView {
  id: number | string;
  name: string;
  is_global?: boolean;
  foundation_id?: number;
}

export interface ToolbarSecondRowProps {
  /** Whether saved views are disabled */
  disableSavedViews?: boolean;
  /** @deprecated Use TableContext instead. List of saved views */
  savedViews?: SavedView[];
  /** @deprecated Use TableContext instead. Currently active view ID */
  activeViewId?: number | string | null;
  /** @deprecated Use TableContext instead. Current group by column (if grouped) */
  groupByColumn?: string | null;
  /** @deprecated Use TableContext instead. Number of collapsed groups */
  collapsedGroupsCount?: number;
  /** Number of rows being edited (not in context yet) */
  editingRowCount?: number;
  /** Number of validation errors (not in context yet) */
  validationErrorCount?: number;
  /** @deprecated Use TableContext instead. Selected row IDs */
  selectedRowIds?: Set<string | number>;
  /** @deprecated Use TableContext instead. Total filtered rows count */
  filteredRowsCount?: number;
  /** @deprecated Use TableContext instead. All row IDs (for select all) */
  allRowIds?: (string | number)[];

  // Callbacks
  /** Callback to collapse all groups */
  onCollapseAll?: () => void;
  /** Callback to expand all groups */
  onExpandAll?: () => void;
  /** Callback to cancel editing */
  onCancelEditing?: () => void;
  /** Callback to save editing */
  onSaveEditing?: () => void;
  /** Callback to toggle select all */
  onToggleSelectAll?: () => void;
  /** @deprecated Use TableContext instead. Callback to select all */
  onSelectAll?: (ids: (string | number)[]) => void;
  /** @deprecated Use TableContext instead. Callback to clear selection */
  onClearSelection?: () => void;
  /** @deprecated Use TableContext instead. Callback to load a view */
  onLoadView?: (view: SavedView) => void;
}

export function ToolbarSecondRow({
  disableSavedViews = false,
  savedViews: propSavedViews,
  activeViewId: propActiveViewId,
  groupByColumn: propGroupByColumn,
  collapsedGroupsCount: propCollapsedGroupsCount,
  editingRowCount = 0,
  validationErrorCount = 0,
  selectedRowIds: propSelectedRowIds,
  filteredRowsCount: propFilteredRowsCount,
  allRowIds: propAllRowIds,
  onCollapseAll,
  onExpandAll,
  onCancelEditing,
  onSaveEditing,
  onToggleSelectAll,
  onSelectAll: propOnSelectAll,
  onClearSelection: propOnClearSelection,
  onLoadView: propOnLoadView,
}: ToolbarSecondRowProps) {
  // Try to get values from context first
  const table = useTableMaybe();

  // Resolve values: context first, props as fallback
  const effectiveSavedViews = table ? table.savedViews : (propSavedViews ?? []);
  const effectiveActiveViewId = table ? table.activeView?.id : propActiveViewId;
  const effectiveGroupByColumn = table ? table.grouping.state.groupByColumn : propGroupByColumn;
  const effectiveCollapsedGroupsCount = table
    ? table.grouping.state.collapsedGroups.size
    : (propCollapsedGroupsCount ?? 0);

  // Selection state from context
  const effectiveSelectedRowIds = table
    ? table.selection.state.selectedIds
    : (propSelectedRowIds ?? new Set<string | number>());
  const effectiveFilteredRowsCount = table
    ? table.processedData.counts.filtered
    : (propFilteredRowsCount ?? 0);
  const effectiveAllRowIds = table
    ? table.processedData.visibleRowIds
    : (propAllRowIds ?? []);

  // Actions: context first, props as fallback
  const handleSelectAll = useMemo(() => {
    if (table) {
      return (ids: (string | number)[]) => table.selection.actions.selectAll(ids);
    }
    return propOnSelectAll;
  }, [table, propOnSelectAll]);

  const handleClearSelection = useMemo(() => {
    if (table) {
      return () => table.selection.actions.clear();
    }
    return propOnClearSelection;
  }, [table, propOnClearSelection]);

  const handleLoadView = useMemo(() => {
    if (table) {
      return (view: SavedView) => table.loadView(view as any);
    }
    return propOnLoadView;
  }, [table, propOnLoadView]);

  // Don't render if no views and not grouped
  if ((disableSavedViews || effectiveSavedViews.length === 0) && !effectiveGroupByColumn) {
    return null;
  }

  const hasSelection = effectiveSelectedRowIds.size > 0;
  const isAllSelected = effectiveFilteredRowsCount > 0 &&
    effectiveAllRowIds.every(id => effectiveSelectedRowIds.has(id));

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 px-4">
      {/* Expand/Collapse all button - always visible when grouped to prevent layout shift */}
      {effectiveGroupByColumn && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (effectiveCollapsedGroupsCount === 0) {
              onCollapseAll?.();
            } else {
              onExpandAll?.();
            }
          }}
          className="h-7 w-7 p-0 shrink-0"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform",
              effectiveCollapsedGroupsCount === 0 ? "rotate-0" : "-rotate-90"
            )}
          />
        </Button>
      )}

      {/* When editing rows, show editing controls instead of saved views */}
      {editingRowCount > 0 ? (
        <>
          <span className={cn(
            "text-[11px] font-medium",
            validationErrorCount > 0 ? "text-red-700 dark:text-red-300" : "text-blue-700 dark:text-blue-300"
          )}>
            Editing {editingRowCount} row{editingRowCount !== 1 ? "s" : ""}
            {validationErrorCount > 0 && (
              <span className="ml-2 text-red-600 dark:text-red-400">
                ({validationErrorCount} error{validationErrorCount !== 1 ? "s" : ""})
              </span>
            )}
          </span>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={onCancelEditing}
            className="h-7 px-2"
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onSaveEditing}
            className={cn(
              "h-7 px-2",
              validationErrorCount > 0
                ? "bg-muted-foreground hover:bg-muted-foreground cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
            )}
            disabled={validationErrorCount > 0}
          >
            <Check className="h-4 w-4 mr-1" />
            Save All
          </Button>
        </>
      ) : effectiveGroupByColumn && hasSelection ? (
        <>
          {/* Selection dropdown for grouped tables */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center cursor-pointer">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={onToggleSelectAll}
                />
                <ChevronDown className="h-3 w-3 ml-1 text-muted-foreground" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleSelectAll?.(effectiveAllRowIds)}>
                Select All ({effectiveFilteredRowsCount})
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleClearSelection}>
                Clear Selection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Selection count and clear - bulk action buttons are in the first toolbar row (SSoT) */}
          <span className="text-[11px] font-medium ml-auto">{effectiveSelectedRowIds.size} selected</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearSelection}
            className="h-7 px-2 text-xs"
          >
            Clear
          </Button>
        </>
      ) : (
        <>
          {/* Show all views as individual buttons */}
          {/* Uses native title attributes to avoid compose-refs issues during view switching */}
          {effectiveSavedViews.map((view) => (
            <Button
              key={view.id}
              variant={String(effectiveActiveViewId) === String(view.id) ? "default" : "outline"}
              size="sm"
              onClick={() => handleLoadView?.(view)}
              title={view.is_global ? `Global view: ${view.name}` : `Personal view: ${view.name}`}
              className={cn(
                "shrink-0 max-w-[140px]",
                view.is_global && "border-blue-300 dark:border-blue-700"
              )}
            >
              {view.is_global && (
                <Globe className="h-3 w-3 mr-1 flex-shrink-0" />
              )}
              <span className="truncate">{view.name}</span>
            </Button>
          ))}
        </>
      )}
    </div>
  );
}

ToolbarSecondRow.displayName = 'ToolbarSecondRow';

export default ToolbarSecondRow;
