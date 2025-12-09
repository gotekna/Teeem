/**
 * useTableKeyboardNav Hook
 *
 * Handles keyboard navigation for table editing:
 * - Tab / Shift+Tab: Move between cells horizontally
 * - Arrow Up / Down: Move between rows (same column)
 * - Enter: Move down to next row
 * - Escape: Cancel editing and revert changes
 *
 * Works with the Jotai atoms in table-edit-atoms.ts
 */

import { useCallback, useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  tableEditModeAtom,
  focusedCellAtom,
  startCellEditAtom,
  revertCellAtom,
  exitEditModeAtom,
} from '@/lib/table-edit-atoms';
import type { NavigationDirection, UseTableKeyboardNavReturn } from '@/components/table/editors/types';

export interface UseTableKeyboardNavOptions {
  /** All column keys in order */
  columnKeys: string[];

  /** Columns that are editable (not readonly) */
  editableColumnKeys: string[];

  /** All row IDs in order */
  rowIds: (string | number)[];

  /** Callback when navigation would exit the table */
  onExitTable?: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

export function useTableKeyboardNav({
  editableColumnKeys,
  rowIds,
  onExitTable,
}: UseTableKeyboardNavOptions): UseTableKeyboardNavReturn {
  const isEditMode = useAtomValue(tableEditModeAtom);
  const [focusedCell, setFocusedCell] = useAtom(focusedCellAtom);
  const startEdit = useSetAtom(startCellEditAtom);
  const revertCell = useSetAtom(revertCellAtom);
  const exitEditMode = useSetAtom(exitEditModeAtom);

  /**
   * Navigate in a direction
   */
  const navigate = useCallback(
    (direction: NavigationDirection) => {
      if (!focusedCell || !isEditMode) return;

      const { rowId, columnKey } = focusedCell;
      const currentRowIndex = rowIds.indexOf(rowId);
      const currentColIndex = editableColumnKeys.indexOf(columnKey);

      let nextRowId: string | number | undefined;
      let nextColKey: string | undefined;

      switch (direction) {
        case 'next': // Tab
          if (currentColIndex < editableColumnKeys.length - 1) {
            // Next column in same row
            nextRowId = rowId;
            nextColKey = editableColumnKeys[currentColIndex + 1];
          } else if (currentRowIndex < rowIds.length - 1) {
            // First column in next row
            nextRowId = rowIds[currentRowIndex + 1];
            nextColKey = editableColumnKeys[0];
          } else {
            // Exit table right/down
            onExitTable?.('right');
            setFocusedCell(null);
            return;
          }
          break;

        case 'prev': // Shift+Tab
          if (currentColIndex > 0) {
            // Previous column in same row
            nextRowId = rowId;
            nextColKey = editableColumnKeys[currentColIndex - 1];
          } else if (currentRowIndex > 0) {
            // Last column in previous row
            nextRowId = rowIds[currentRowIndex - 1];
            nextColKey = editableColumnKeys[editableColumnKeys.length - 1];
          } else {
            // Exit table left/up
            onExitTable?.('left');
            setFocusedCell(null);
            return;
          }
          break;

        case 'up': // Arrow Up
          if (currentRowIndex > 0) {
            nextRowId = rowIds[currentRowIndex - 1];
            nextColKey = columnKey;
          } else {
            onExitTable?.('up');
            return;
          }
          break;

        case 'down': // Arrow Down / Enter
          if (currentRowIndex < rowIds.length - 1) {
            nextRowId = rowIds[currentRowIndex + 1];
            nextColKey = columnKey;
          } else {
            onExitTable?.('down');
            return;
          }
          break;
      }

      // Navigate to next cell
      if (nextRowId !== undefined && nextColKey) {
        startEdit({ rowId: nextRowId, columnKey: nextColKey, currentValue: undefined });
      }
    },
    [focusedCell, isEditMode, rowIds, editableColumnKeys, startEdit, setFocusedCell, onExitTable]
  );

  /**
   * Handle keydown events
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isEditMode) return;

      switch (event.key) {
        case 'Tab':
          event.preventDefault();
          if (event.shiftKey) {
            navigate('prev');
          } else {
            navigate('next');
          }
          break;

        case 'ArrowUp':
          // Only handle if not in a text input
          if (!isTextInput(event.target)) {
            event.preventDefault();
            navigate('up');
          }
          break;

        case 'ArrowDown':
          // Only handle if not in a text input
          if (!isTextInput(event.target)) {
            event.preventDefault();
            navigate('down');
          }
          break;

        case 'Enter':
          // Move down on Enter (unless in textarea)
          if (!isTextarea(event.target)) {
            event.preventDefault();
            navigate('down');
          }
          break;

        case 'Escape':
          event.preventDefault();
          if (focusedCell) {
            revertCell({ rowId: focusedCell.rowId, columnKey: focusedCell.columnKey });
          }
          break;
      }
    },
    [isEditMode, focusedCell, navigate, revertCell]
  );

  /**
   * Global keyboard handler for table
   */
  useEffect(() => {
    if (!isEditMode) return;

    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Handle Escape to exit edit mode entirely
      if (event.key === 'Escape' && !focusedCell) {
        exitEditMode();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isEditMode, focusedCell, exitEditMode]);

  return {
    focusedCell,
    setFocusedCell,
    navigate,
    handleKeyDown,
  };
}

/**
 * Check if target is a text input
 */
function isTextInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'textarea') return true;
  if (tagName === 'input') {
    const type = (target as HTMLInputElement).type;
    return ['text', 'email', 'tel', 'url', 'search', 'password'].includes(type);
  }
  return false;
}

/**
 * Check if target is a textarea
 */
function isTextarea(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return target.tagName.toLowerCase() === 'textarea';
}

export default useTableKeyboardNav;
