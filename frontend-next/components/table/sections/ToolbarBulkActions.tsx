/**
 * ToolbarBulkActions - Bulk action buttons for selected rows
 *
 * Extracted from TeeemTableView to reduce main component size.
 * Shows bulk update, inline edit, merge, Xero transfer, and delete buttons.
 */

'use client';

import React from 'react';
import { Pencil, Trash2, GitMerge, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ToolbarBulkActionsProps {
  /** Number of selected rows */
  selectedCount: number;
  /** Visible selected row IDs (filtered intersection) */
  visibleSelectedIds: (string | number)[];
  /** Whether view-only mode is enabled */
  viewOnly?: boolean;
  /** Show bulk update button */
  showBulkUpdate?: boolean;
  /** Show inline edit button */
  showInlineEdit?: boolean;
  /** Show merge button (requires 2+ selected) */
  showMerge?: boolean;
  /** Show Xero transfer button (requires exactly 2 selected) */
  showXeroTransfer?: boolean;
  /** Show delete button */
  showDelete?: boolean;
  /** Callback for bulk update */
  onBulkUpdate?: () => void;
  /** Callback for inline edit */
  onInlineEdit?: (ids: (string | number)[]) => void;
  /** Callback for merge */
  onMerge?: (ids: (string | number)[]) => void;
  /** Callback for Xero transfer */
  onXeroTransfer?: (ids: (string | number)[]) => void;
  /** Callback for delete */
  onDelete?: (ids: (string | number)[]) => void;
}

export function ToolbarBulkActions({
  selectedCount,
  visibleSelectedIds,
  viewOnly = false,
  showBulkUpdate = false,
  showInlineEdit = false,
  showMerge = false,
  showXeroTransfer = false,
  showDelete = false,
  onBulkUpdate,
  onInlineEdit,
  onMerge,
  onXeroTransfer,
  onDelete,
}: ToolbarBulkActionsProps) {
  if (selectedCount === 0) return null;

  const hasAnyAction = showBulkUpdate || showInlineEdit || showMerge || showXeroTransfer || showDelete;
  if (!hasAnyAction) return null;

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="h-4 w-px bg-border mx-1" />

      {/* Bulk Update - column-based update modal */}
      {showBulkUpdate && onBulkUpdate && (
        <Button
          variant="outline"
          size="sm"
          onClick={onBulkUpdate}
        >
          <Pencil className="h-4 w-4 mr-1" />
          Bulk Update
        </Button>
      )}

      {/* Inline Edit - edit all selected rows inline like a spreadsheet */}
      {showInlineEdit && !viewOnly && onInlineEdit && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onInlineEdit(visibleSelectedIds)}
        >
          <Pencil className="h-4 w-4 mr-1" />
          Inline Edit
        </Button>
      )}

      {/* Merge button - combine rows into one */}
      {showMerge && !viewOnly && selectedCount >= 2 && onMerge && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMerge(visibleSelectedIds)}
        >
          <GitMerge className="h-4 w-4 mr-1" />
          Merge
        </Button>
      )}

      {/* Xero Transfer button - transfer Xero link between exactly 2 contacts */}
      {showXeroTransfer && !viewOnly && selectedCount === 2 && onXeroTransfer && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onXeroTransfer(visibleSelectedIds)}
        >
          <ArrowLeftRight className="h-4 w-4 mr-1" />
          Xero
        </Button>
      )}

      {/* Delete button - bulk delete selected rows */}
      {showDelete && !viewOnly && onDelete && (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            if (visibleSelectedIds.length === 0) {
              console.warn('[Delete] No visible selected rows to delete');
              return;
            }
            onDelete(visibleSelectedIds);
          }}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      )}
    </div>
  );
}

ToolbarBulkActions.displayName = 'ToolbarBulkActions';

export default ToolbarBulkActions;
