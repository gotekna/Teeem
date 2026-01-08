/**
 * ToolbarBulkActions - Bulk action buttons for selected rows
 *
 * Extracted from TeeemTableView to reduce main component size.
 * Shows bulk update, inline edit, merge, Xero transfer, and delete buttons.
 *
 * Migration Note (Phase 6.3):
 * This component now reads selection state from TableContext when available.
 * Feature flags and callbacks remain as props since they're TeeemTableView-specific.
 */

'use client';

import React, { useMemo } from 'react';
import { Pencil, Trash2, GitMerge, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTableMaybe } from '../context';

export interface ToolbarBulkActionsProps {
  /** @deprecated Use TableContext instead. Number of selected rows */
  selectedCount?: number;
  /** @deprecated Use TableContext instead. Visible selected row IDs (filtered intersection) */
  visibleSelectedIds?: (string | number)[];
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
  selectedCount: propSelectedCount,
  visibleSelectedIds: propVisibleSelectedIds,
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
  // Try to get values from context first
  const table = useTableMaybe();

  // Compute visible selected IDs from context if available
  const contextVisibleSelectedIds = useMemo(() => {
    if (!table) return [];
    const visibleIdSet = new Set(table.processedData.visibleRowIds.map(id => String(id)));
    // selectedIds is a Set, convert to array for filtering
    return Array.from(table.selection.state.selectedIds).filter(id => visibleIdSet.has(String(id)));
  }, [table]);

  // Effective values: context first, props as fallback
  const effectiveSelectedCount = table
    ? table.selection.state.selectedIds.size
    : (propSelectedCount ?? 0);
  const effectiveVisibleSelectedIds = table
    ? contextVisibleSelectedIds
    : (propVisibleSelectedIds ?? []);

  if (effectiveSelectedCount === 0) return null;

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
          onClick={() => onInlineEdit(effectiveVisibleSelectedIds)}
        >
          <Pencil className="h-4 w-4 mr-1" />
          Inline Edit
        </Button>
      )}

      {/* Merge button - combine rows into one */}
      {showMerge && !viewOnly && effectiveSelectedCount >= 2 && onMerge && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMerge(effectiveVisibleSelectedIds)}
        >
          <GitMerge className="h-4 w-4 mr-1" />
          Merge
        </Button>
      )}

      {/* Xero Transfer button - transfer Xero link between exactly 2 contacts */}
      {showXeroTransfer && !viewOnly && effectiveSelectedCount === 2 && onXeroTransfer && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onXeroTransfer(effectiveVisibleSelectedIds)}
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
            if (effectiveVisibleSelectedIds.length === 0) {
              console.warn('[Delete] No visible selected rows to delete');
              return;
            }
            onDelete(effectiveVisibleSelectedIds);
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
