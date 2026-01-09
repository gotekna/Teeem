"use client";

/**
 * EditableCell Component
 *
 * Wrapper component that orchestrates cell editing:
 * - Manages edit mode state integration with Jotai atoms
 * - Handles validation (debounced + on blur)
 * - Orchestrates auto-save on blur
 * - Provides keyboard navigation callbacks
 * - Shows appropriate editor based on column type
 *
 * This is the main component used by TeeemTableView to render editable cells.
 */

import React, { useCallback, useMemo } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { cn } from '@/lib/utils';
import {
  tableEditModeAtom,
  focusedCellAtom,
  getCellKey,
  startCellEditAtom,
  updateCellValueAtom,
  setCellErrorAtom,
  setCellSavingAtom,
  clearPendingEditAtom,
  revertCellAtom,
  pendingEditsAtom,
  validationErrorsAtom,
  savingCellsAtom,
} from '@/lib/table-edit-atoms';
import { validateCell } from '@/components/table/core/column-renderer/CellValidation';
import { getEditor, getEditorProps, isEditableColumnType } from './index';
import type { EditorColumn, CellPosition } from './types';

export interface EditableCellProps {
  /** Row identifier */
  rowId: string | number;

  /** Column definition */
  column: EditorColumn;

  /** Current cell value */
  value: unknown;

  /** Callback to save the cell value */
  onSave: (rowId: string | number, columnKey: string, value: unknown) => Promise<boolean>;

  /** All columns for keyboard navigation */
  allColumns: EditorColumn[];

  /** All row IDs for keyboard navigation */
  allRowIds: (string | number)[];

  /** Render function for display mode (when not editing) */
  renderDisplay?: (value: unknown) => React.ReactNode;

  /** Optional className */
  className?: string;
}

export function EditableCell({
  rowId,
  column,
  value: initialValue,
  onSave,
  allColumns,
  allRowIds,
  renderDisplay,
  className,
}: EditableCellProps) {
  // Edit mode state
  const isEditMode = useAtomValue(tableEditModeAtom);
  const [focusedCell, setFocusedCell] = useAtom(focusedCellAtom);
  const pendingEdits = useAtomValue(pendingEditsAtom);
  const validationErrors = useAtomValue(validationErrorsAtom);
  const savingCells = useAtomValue(savingCellsAtom);

  // Actions
  const startEdit = useSetAtom(startCellEditAtom);
  const updateValue = useSetAtom(updateCellValueAtom);
  const setError = useSetAtom(setCellErrorAtom);
  const setSaving = useSetAtom(setCellSavingAtom);
  const clearPending = useSetAtom(clearPendingEditAtom);
  const revertCell = useSetAtom(revertCellAtom);

  // Derived state
  const cellKey = getCellKey(rowId, column.key);
  const isFocused = focusedCell?.rowId === rowId && focusedCell?.columnKey === column.key;
  const isSaving = savingCells.has(cellKey);
  const error = validationErrors.get(cellKey) || null;
  const pendingEdit = pendingEdits.get(cellKey);
  const currentValue = pendingEdit?.value ?? initialValue;
  const isReadOnly = column.is_readonly || !isEditableColumnType(column.column_type);

  // Get the appropriate editor
  const Editor = useMemo(() => getEditor(column.column_type), [column.column_type]);
  const editorProps = useMemo(() => getEditorProps(column.column_type), [column.column_type]);

  // Get editable columns for navigation
  const editableColumns = useMemo(
    () => allColumns.filter((c) => !c.is_readonly && isEditableColumnType(c.column_type)),
    [allColumns]
  );

  // Handle cell click to start editing
  const handleClick = useCallback(() => {
    if (!isEditMode || isReadOnly || isFocused) return;
    startEdit({ rowId, columnKey: column.key, currentValue: initialValue });
  }, [isEditMode, isReadOnly, isFocused, rowId, column.key, initialValue, startEdit]);

  // Handle value change
  const handleChange = useCallback(
    (newValue: unknown) => {
      updateValue({ rowId, columnKey: column.key, value: newValue });

      // Validate immediately (debounced validation is in the editor)
      const result = validateCell(newValue, column.column_type);
      setError({ rowId, columnKey: column.key, error: result.error });
    },
    [rowId, column.key, column.column_type, updateValue, setError]
  );

  // Handle blur (auto-save)
  const handleBlur = useCallback(async () => {
    // Get current pending value
    const pending = pendingEdits.get(cellKey);
    if (!pending || !pending.isDirty) {
      // No changes, just clear focus
      return;
    }

    // Validate
    const result = validateCell(pending.value, column.column_type);
    setError({ rowId, columnKey: column.key, error: result.error });

    // If invalid, keep the error displayed but don't block navigation
    if (!result.isValid) {
      return;
    }

    // Save
    setSaving({ rowId, columnKey: column.key, saving: true });

    try {
      const success = await onSave(rowId, column.key, pending.value);
      if (success) {
        clearPending({ rowId, columnKey: column.key });
      }
    } catch (err) {
      console.error('Failed to save cell:', err);
      setError({
        rowId,
        columnKey: column.key,
        error: 'Failed to save',
      });
    } finally {
      setSaving({ rowId, columnKey: column.key, saving: false });
    }
  }, [
    cellKey,
    pendingEdits,
    column.column_type,
    column.key,
    rowId,
    setError,
    setSaving,
    onSave,
    clearPending,
  ]);

  // Navigate to next cell
  const handleFocusNext = useCallback(() => {
    const currentColIndex = editableColumns.findIndex((c) => c.key === column.key);
    const currentRowIndex = allRowIds.indexOf(rowId);

    if (currentColIndex < editableColumns.length - 1) {
      // Move to next column in same row
      const nextColumn = editableColumns[currentColIndex + 1];
      startEdit({ rowId, columnKey: nextColumn.key, currentValue: undefined });
    } else if (currentRowIndex < allRowIds.length - 1) {
      // Move to first column in next row
      const nextRowId = allRowIds[currentRowIndex + 1];
      const firstColumn = editableColumns[0];
      if (firstColumn) {
        startEdit({ rowId: nextRowId, columnKey: firstColumn.key, currentValue: undefined });
      }
    } else {
      // At end of table, clear focus
      setFocusedCell(null);
    }
  }, [editableColumns, column.key, allRowIds, rowId, startEdit, setFocusedCell]);

  // Navigate to previous cell
  const handleFocusPrev = useCallback(() => {
    const currentColIndex = editableColumns.findIndex((c) => c.key === column.key);
    const currentRowIndex = allRowIds.indexOf(rowId);

    if (currentColIndex > 0) {
      // Move to previous column in same row
      const prevColumn = editableColumns[currentColIndex - 1];
      startEdit({ rowId, columnKey: prevColumn.key, currentValue: undefined });
    } else if (currentRowIndex > 0) {
      // Move to last column in previous row
      const prevRowId = allRowIds[currentRowIndex - 1];
      const lastColumn = editableColumns[editableColumns.length - 1];
      if (lastColumn) {
        startEdit({ rowId: prevRowId, columnKey: lastColumn.key, currentValue: undefined });
      }
    } else {
      // At start of table, clear focus
      setFocusedCell(null);
    }
  }, [editableColumns, column.key, allRowIds, rowId, startEdit, setFocusedCell]);

  // Handle cancel (Escape)
  const handleCancel = useCallback(() => {
    revertCell({ rowId, columnKey: column.key });
  }, [rowId, column.key, revertCell]);

  // Render display mode
  if (!isEditMode || isReadOnly) {
    return (
      <div
        className={cn(
          'w-full h-full px-2 py-1 flex items-center',
          isReadOnly && 'bg-muted/30',
          className
        )}
      >
        {renderDisplay ? renderDisplay(initialValue) : String(initialValue ?? '')}
      </div>
    );
  }

  // Render edit mode
  return (
    <div
      className={cn(
        'w-full h-full cursor-pointer',
        isFocused && 'ring-2 ring-blue-500 ring-inset',
        error && 'ring-2 ring-red-500 ring-inset',
        className
      )}
      onClick={handleClick}
    >
      {isFocused ? (
        <Editor
          value={currentValue}
          onChange={handleChange}
          column={column}
          rowId={rowId}
          isFocused={isFocused}
          isSaving={isSaving}
          error={error}
          onBlur={handleBlur}
          onFocusNext={handleFocusNext}
          onFocusPrev={handleFocusPrev}
          onCancel={handleCancel}
          {...editorProps}
        />
      ) : (
        <div className="w-full h-full px-2 py-1 flex items-center hover:bg-muted/50">
          {renderDisplay ? renderDisplay(currentValue) : String(currentValue ?? '')}
        </div>
      )}
    </div>
  );
}

export default EditableCell;
