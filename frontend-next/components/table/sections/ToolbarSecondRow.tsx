/**
 * ToolbarSecondRow - Second toolbar row with views, editing, and group controls
 *
 * Extracted from TeeemTableView to reduce main component size.
 * Contains:
 * - Expand/Collapse all button for grouped tables
 * - Editing controls when rows are being edited
 * - Selection controls for grouped tables
 * - Saved view buttons
 */

'use client';

import React from 'react';
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

export interface SavedView {
  id: number | string;
  name: string;
  is_global?: boolean;
  foundation_id?: number;
}

export interface ToolbarSecondRowProps {
  /** Whether saved views are disabled */
  disableSavedViews?: boolean;
  /** List of saved views */
  savedViews: SavedView[];
  /** Currently active view ID */
  activeViewId?: number | string | null;
  /** Current group by column (if grouped) */
  groupByColumn?: string | null;
  /** Number of collapsed groups */
  collapsedGroupsCount: number;
  /** Number of rows being edited */
  editingRowCount: number;
  /** Number of validation errors */
  validationErrorCount: number;
  /** Selected row IDs */
  selectedRowIds: Set<string | number>;
  /** Total filtered rows count */
  filteredRowsCount: number;
  /** All row IDs (for select all) */
  allRowIds: (string | number)[];

  // Callbacks
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
  onCancelEditing?: () => void;
  onSaveEditing?: () => void;
  onToggleSelectAll?: () => void;
  onSelectAll?: (ids: (string | number)[]) => void;
  onClearSelection?: () => void;
  onLoadView?: (view: SavedView) => void;
}

export function ToolbarSecondRow({
  disableSavedViews = false,
  savedViews,
  activeViewId,
  groupByColumn,
  collapsedGroupsCount,
  editingRowCount,
  validationErrorCount,
  selectedRowIds,
  filteredRowsCount,
  allRowIds,
  onCollapseAll,
  onExpandAll,
  onCancelEditing,
  onSaveEditing,
  onToggleSelectAll,
  onSelectAll,
  onClearSelection,
  onLoadView,
}: ToolbarSecondRowProps) {
  // Don't render if no views and not grouped
  if ((disableSavedViews || savedViews.length === 0) && !groupByColumn) {
    return null;
  }

  const hasSelection = selectedRowIds.size > 0;
  const isAllSelected = filteredRowsCount > 0 &&
    allRowIds.every(id => selectedRowIds.has(id));

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 px-4">
      {/* Expand/Collapse all button - always visible when grouped to prevent layout shift */}
      {groupByColumn && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (collapsedGroupsCount === 0) {
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
              collapsedGroupsCount === 0 ? "rotate-0" : "-rotate-90"
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
              <span className="ml-2 text-red-600">
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
                ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
            )}
            disabled={validationErrorCount > 0}
          >
            <Check className="h-4 w-4 mr-1" />
            Save All
          </Button>
        </>
      ) : groupByColumn && hasSelection ? (
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
              <DropdownMenuItem onClick={() => onSelectAll?.(allRowIds)}>
                Select All ({filteredRowsCount})
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onClearSelection}>
                Clear Selection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Selection count and clear - bulk action buttons are in the first toolbar row (SSoT) */}
          <span className="text-[11px] font-medium ml-auto">{selectedRowIds.size} selected</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            className="h-7 px-2 text-xs"
          >
            Clear
          </Button>
        </>
      ) : (
        <>
          {/* Show all views as individual buttons */}
          {/* Uses native title attributes to avoid compose-refs issues during view switching */}
          {savedViews.map((view) => (
            <Button
              key={view.id}
              variant={activeViewId === view.id ? "default" : "outline"}
              size="sm"
              onClick={() => onLoadView?.(view)}
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
