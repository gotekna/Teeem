"use client";

/**
 * ActionsButtons Component
 *
 * Renders a three-dot menu with View, Edit, and Delete actions for table rows.
 * Respects viewOnly prop and conditional handlers.
 *
 * Preserves row-adding permission logic:
 * - Edit/Delete options hidden when viewOnly={true}
 * - Edit option shown only when onRowUpdate or onEdit provided
 * - Delete option shown only when onDelete provided
 */

import React, { memo } from 'react';
import { Eye, Pencil, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface ActionsButtonsProps<T = unknown> {
  /** The row entry */
  entry: T;

  /** Whether the table is in view-only mode (disables edit/delete) */
  viewOnly?: boolean;

  /** Callback to view the row */
  onView?: (entry: T) => void;

  /** Callback to edit the row (custom edit handler) */
  onEdit?: (entry: T) => void;

  /** Callback to update the row (inline editing) */
  onRowUpdate?: (rowId: number | string, field: string, value: unknown) => void;

  /** Callback to delete the row */
  onDelete?: (entry: T) => void;

  /** Callback to start inline editing for this row */
  onStartEditing?: (entry: T) => void;

  /** Number of currently selected rows */
  selectedRowsCount?: number;
}

export const ActionsButtons = memo(function ActionsButtons<T extends { id: string | number }>({
  entry,
  viewOnly,
  onView,
  onEdit,
  onRowUpdate,
  onDelete,
  onStartEditing,
  selectedRowsCount = 0,
}: ActionsButtonsProps<T>) {
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If multiple rows selected, use custom edit handler (bulk edit)
    if (selectedRowsCount > 1) {
      onEdit?.(entry);
    } else {
      // Single row or no selection: inline edit if available
      if (onRowUpdate && onStartEditing) {
        onStartEditing(entry);
      } else {
        onEdit?.(entry);
      }
    }
  };

  const hasAnyAction = onView || (!viewOnly && (onRowUpdate || onEdit)) || (!viewOnly && onDelete);

  if (!hasAnyAction) {
    return null;
  }

  return (
    <div className="flex items-center justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-muted"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          {/* View option */}
          {onView && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onView(entry);
              }}
            >
              <Eye className="h-4 w-4 mr-2" />
              View
            </DropdownMenuItem>
          )}

          {/* Edit option - hidden when viewOnly=true */}
          {!viewOnly && (onRowUpdate || onEdit) && (
            <DropdownMenuItem onClick={handleEditClick}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
          )}

          {/* Delete option - hidden when viewOnly=true */}
          {!viewOnly && onDelete && (
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete(entry);
              }}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}) as <T extends { id: string | number }>(props: ActionsButtonsProps<T>) => React.ReactElement;
