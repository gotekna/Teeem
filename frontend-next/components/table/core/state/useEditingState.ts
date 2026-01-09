/**
 * Editing State Hook
 *
 * Consolidates all editing-related state management:
 * - Edit mode toggle (bulk edit mode on/off)
 * - Row editing (which rows are being edited)
 * - Editing data (pending changes before save)
 * - Validation errors
 * - Cell editing (inline single-cell edit)
 * - Lookup options for dropdowns
 *
 * Wraps Jotai atoms for cleaner component code.
 */

import { useAtom, useAtomValue } from 'jotai';
import {
  tableEditModeAtom,
  editingRowIdsAtom,
  editingDataAtom,
  legacyValidationErrorsAtom,
  editingCellAtom,
  editingCellValueAtom,
  lookupOptionsAtom,
  lookupLoadingAtom,
} from '@/lib/table-atoms';

export interface EditingState {
  // Edit mode (read-only via useAtomValue)
  isEditMode: boolean;

  // Row editing
  editingRowIds: Set<number | string>;
  setEditingRowIds: (value: Set<number | string>) => void;

  // Editing data
  editingData: Record<number | string, Record<string, unknown>>;
  setEditingData: (value: Record<number | string, Record<string, unknown>>) => void;

  // Validation errors
  validationErrors: Record<number | string, Record<string, string>>;
  setValidationErrors: (value: Record<number | string, Record<string, string>>) => void;

  // Cell editing (inline edit)
  editingCell: { rowId: number | string; columnKey: string } | null;
  setEditingCell: (value: { rowId: number | string; columnKey: string } | null) => void;

  editingCellValue: unknown;
  setEditingCellValue: (value: unknown) => void;

  // Lookup options
  lookupOptions: Record<string, Array<{ id: number; display: string }>>;
  setLookupOptions: (value: Record<string, Array<{ id: number; display: string }>>) => void;

  lookupLoading: Record<string, boolean>;
  setLookupLoading: (value: Record<string, boolean>) => void;
}

/**
 * Hook for managing editing state
 *
 * @returns Editing state and setters
 */
export function useEditingState(): EditingState {
  const isEditMode = useAtomValue(tableEditModeAtom);
  const [editingRowIds, setEditingRowIds] = useAtom(editingRowIdsAtom);
  const [editingData, setEditingData] = useAtom(editingDataAtom);
  const [validationErrors, setValidationErrors] = useAtom(legacyValidationErrorsAtom);
  const [editingCell, setEditingCell] = useAtom(editingCellAtom);
  const [editingCellValue, setEditingCellValue] = useAtom(editingCellValueAtom);
  const [lookupOptions, setLookupOptions] = useAtom(lookupOptionsAtom);
  const [lookupLoading, setLookupLoading] = useAtom(lookupLoadingAtom);

  return {
    isEditMode,
    editingRowIds,
    setEditingRowIds,
    editingData,
    setEditingData,
    validationErrors,
    setValidationErrors,
    editingCell,
    setEditingCell,
    editingCellValue,
    setEditingCellValue,
    lookupOptions,
    setLookupOptions,
    lookupLoading,
    setLookupLoading,
  };
}
