"use client";

/**
 * ActionsButtons Component
 *
 * Renders View, Edit, and Delete action buttons for table rows.
 * Respects viewOnly prop and conditional handlers.
 *
 * Preserves row-adding permission logic:
 * - Edit/Delete buttons hidden when viewOnly={true}
 * - Edit button shown only when onRowUpdate or onEdit provided
 * - Delete button shown only when onDelete provided
 */

import React, { memo } from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  return (
    <div className="flex items-center justify-center gap-1">
      {/* View button - removed */}

      {/* Edit button - hidden when viewOnly=true */}
      {!viewOnly && (onRowUpdate || onEdit) && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-gray-100"
          onClick={handleEditClick}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}

      {/* Delete button - hidden when viewOnly=true */}
      {!viewOnly && onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-gray-100 hover:text-red-600"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(entry);
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}) as <T extends { id: string | number }>(props: ActionsButtonsProps<T>) => React.ReactElement;
