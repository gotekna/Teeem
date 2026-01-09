/**
 * Table Edit Mode State Management
 *
 * DEPRECATED: This file re-exports from the consolidated table-atoms.ts
 * All table state is now in lib/table-atoms.ts for SSoT compliance.
 *
 * @see /Users/robertharder/GitHub/teeem/frontend-next/lib/table-atoms.ts
 */

// Re-export everything from the consolidated atoms file
export {
  // Edit mode
  tableEditModeAtom,
  focusedCellAtom,
  getCellKey,
  pendingEditsAtom,
  validationErrorsAtom,
  savingCellsAtom,

  // Derived atoms
  cellHasPendingEditAtom,
  cellHasErrorAtom,
  hasAnyValidationErrorsAtom,
  cellIsSavingAtom,

  // Action atoms
  startCellEditAtom,
  updateCellValueAtom,
  setCellErrorAtom,
  setCellSavingAtom,
  clearPendingEditAtom,
  revertCellAtom,
  exitEditModeAtom,
  enterEditModeAtom,

  // Types
  type PendingEdit,
} from './table-atoms';
