/**
 * Table Edit Mode State Management using Jotai Atoms
 *
 * This file provides centralized state for the unified edit mode in TeeemTableView.
 * Replaces the dual editing paradigm (row-level vs cell-level) with a single
 * "Edit Mode" toggle that enables editing across all cells.
 *
 * Benefits:
 * - Single source of truth for edit state
 * - Consistent editing experience across all column types
 * - Auto-save on blur with validation
 * - Keyboard navigation (Tab between cells)
 */

import { atom } from 'jotai';

// ============================================================================
// EDIT MODE STATE
// ============================================================================

/**
 * Global edit mode toggle
 * When true, all editable cells become interactive
 * When false, cells are read-only
 */
export const tableEditModeAtom = atom<boolean>(false);

/**
 * Currently focused cell (for keyboard navigation)
 * Tracks which cell has focus for Tab/Shift+Tab navigation
 */
export const focusedCellAtom = atom<{
  rowId: string | number;
  columnKey: string;
} | null>(null);

/**
 * Cell key helper - creates consistent keys for maps/sets
 */
export function getCellKey(rowId: string | number, columnKey: string): string {
  return `${rowId}:${columnKey}`;
}

// ============================================================================
// PENDING EDITS STATE
// ============================================================================

/**
 * Pending edits before save
 * Maps cell key ("rowId:columnKey") to pending value
 * Used for tracking unsaved changes and reverting on Escape
 */
export interface PendingEdit {
  value: unknown;
  originalValue: unknown;
  isDirty: boolean;
}

export const pendingEditsAtom = atom<Map<string, PendingEdit>>(new Map());

/**
 * Check if a specific cell has unsaved changes
 */
export const cellHasPendingEditAtom = atom(
  (get) => (rowId: string | number, columnKey: string): boolean => {
    const pending = get(pendingEditsAtom);
    const key = getCellKey(rowId, columnKey);
    const edit = pending.get(key);
    return edit?.isDirty ?? false;
  }
);

// ============================================================================
// VALIDATION STATE
// ============================================================================

/**
 * Validation errors per cell
 * Maps cell key ("rowId:columnKey") to error message
 * Cells with errors show red border but allow navigation
 */
export const validationErrorsAtom = atom<Map<string, string>>(new Map());

/**
 * Check if a specific cell has a validation error
 */
export const cellHasErrorAtom = atom(
  (get) => (rowId: string | number, columnKey: string): string | null => {
    const errors = get(validationErrorsAtom);
    const key = getCellKey(rowId, columnKey);
    return errors.get(key) ?? null;
  }
);

/**
 * Check if any cells have validation errors
 * Useful for showing warning before exiting edit mode
 */
export const hasAnyValidationErrorsAtom = atom((get) => {
  const errors = get(validationErrorsAtom);
  return errors.size > 0;
});

// ============================================================================
// SAVING STATE
// ============================================================================

/**
 * Cells currently being saved (showing spinner)
 * Set of cell keys ("rowId:columnKey")
 */
export const savingCellsAtom = atom<Set<string>>(new Set<string>());

/**
 * Check if a specific cell is currently saving
 */
export const cellIsSavingAtom = atom(
  (get) => (rowId: string | number, columnKey: string): boolean => {
    const saving = get(savingCellsAtom);
    const key = getCellKey(rowId, columnKey);
    return saving.has(key);
  }
);

// ============================================================================
// ATOMIC ACTIONS
// ============================================================================

/**
 * Start editing a cell - sets focus and initializes pending edit
 */
export const startCellEditAtom = atom(
  null,
  (get, set, params: { rowId: string | number; columnKey: string; currentValue: unknown }) => {
    const { rowId, columnKey, currentValue } = params;
    const key = getCellKey(rowId, columnKey);

    // Set focus
    set(focusedCellAtom, { rowId, columnKey });

    // Initialize pending edit if not exists
    const pending = get(pendingEditsAtom);
    if (!pending.has(key)) {
      const newPending = new Map(pending);
      newPending.set(key, {
        value: currentValue,
        originalValue: currentValue,
        isDirty: false,
      });
      set(pendingEditsAtom, newPending);
    }
  }
);

/**
 * Update a cell's pending value
 */
export const updateCellValueAtom = atom(
  null,
  (get, set, params: { rowId: string | number; columnKey: string; value: unknown }) => {
    const { rowId, columnKey, value } = params;
    const key = getCellKey(rowId, columnKey);

    const pending = get(pendingEditsAtom);
    const existing = pending.get(key);

    const newPending = new Map(pending);
    newPending.set(key, {
      value,
      originalValue: existing?.originalValue ?? value,
      isDirty: value !== existing?.originalValue,
    });
    set(pendingEditsAtom, newPending);
  }
);

/**
 * Set validation error for a cell
 */
export const setCellErrorAtom = atom(
  null,
  (get, set, params: { rowId: string | number; columnKey: string; error: string | null }) => {
    const { rowId, columnKey, error } = params;
    const key = getCellKey(rowId, columnKey);

    const errors = get(validationErrorsAtom);
    const newErrors = new Map(errors);

    if (error) {
      newErrors.set(key, error);
    } else {
      newErrors.delete(key);
    }

    set(validationErrorsAtom, newErrors);
  }
);

/**
 * Mark a cell as saving
 */
export const setCellSavingAtom = atom(
  null,
  (get, set, params: { rowId: string | number; columnKey: string; saving: boolean }) => {
    const { rowId, columnKey, saving } = params;
    const key = getCellKey(rowId, columnKey);

    const savingCells = get(savingCellsAtom);
    const newSaving = new Set(savingCells);

    if (saving) {
      newSaving.add(key);
    } else {
      newSaving.delete(key);
    }

    set(savingCellsAtom, newSaving);
  }
);

/**
 * Clear pending edit after successful save
 */
export const clearPendingEditAtom = atom(
  null,
  (get, set, params: { rowId: string | number; columnKey: string }) => {
    const { rowId, columnKey } = params;
    const key = getCellKey(rowId, columnKey);

    const pending = get(pendingEditsAtom);
    const newPending = new Map(pending);
    newPending.delete(key);
    set(pendingEditsAtom, newPending);
  }
);

/**
 * Revert a cell to its original value (on Escape)
 */
export const revertCellAtom = atom(
  null,
  (get, set, params: { rowId: string | number; columnKey: string }) => {
    const { rowId, columnKey } = params;
    const key = getCellKey(rowId, columnKey);

    // Clear pending edit
    const pending = get(pendingEditsAtom);
    const newPending = new Map(pending);
    newPending.delete(key);
    set(pendingEditsAtom, newPending);

    // Clear any validation error
    const errors = get(validationErrorsAtom);
    const newErrors = new Map(errors);
    newErrors.delete(key);
    set(validationErrorsAtom, newErrors);

    // Clear focus
    set(focusedCellAtom, null);
  }
);

/**
 * Exit edit mode - clears all pending edits and errors
 */
export const exitEditModeAtom = atom(null, (get, set) => {
  set(tableEditModeAtom, false);
  set(focusedCellAtom, null);
  set(pendingEditsAtom, new Map());
  set(validationErrorsAtom, new Map());
  set(savingCellsAtom, new Set());
});

/**
 * Enter edit mode
 */
export const enterEditModeAtom = atom(null, (get, set) => {
  set(tableEditModeAtom, true);
});
