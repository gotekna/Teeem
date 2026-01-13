/**
 * Row Editing Hook for TeeemTableView
 *
 * Manages inline row editing with:
 * - Single and multi-row editing
 * - Cell-level validation
 * - Batch save with optimistic updates
 * - Lookup options pre-fetching
 *
 * Phase 9 of TeeemTableView refactoring.
 *
 * @example
 * const editing = useRowEditing({
 *   columns: COLUMNS,
 *   rows: effectiveEntries,
 *   foundationId: effectiveFoundationId,
 *   onSave: handleSave,
 *   onRefresh: triggerRefresh,
 * });
 *
 * // Use in component
 * editing.actions.startEditing(row);
 * editing.actions.saveEditing();
 */

import { useCallback, useMemo } from 'react';
import { useAtom } from 'jotai';
import {
  editingRowIdsAtom,
  editingDataAtom,
  legacyValidationErrorsAtom,
} from '@/lib/table-atoms';
import { validateCell as validateCellValue } from '../core/column-renderer/CellValidation';
import { api } from '@/lib/api';
import { clearCachedRecords } from '@/lib/records-cache';
import { isLookupColumn } from '@/lib/constants/column-types';
import type { TableColumn } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface TableRow {
  id: string | number;
  [key: string]: unknown;
}

export interface UseRowEditingOptions {
  /** Column definitions for validation */
  columns: TableColumn[];
  /** Current rows (for finding original values) */
  rows: TableRow[];
  /** Foundation ID for API calls */
  foundationId?: string | number | null;
  /** Toast function for notifications */
  toast?: (props: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
  /** Callback after successful save */
  onRefresh?: () => void;
  /** Callback for individual field updates (legacy) */
  onRowUpdate?: (rowId: string | number, field: string, value: unknown) => void | Promise<void>;
  /** Whether in auto-fetch mode */
  isAutoFetch?: boolean;
  /** Setter for auto-fetched records (for optimistic updates) */
  setRecords?: React.Dispatch<React.SetStateAction<TableRow[]>>;
  /** Callback to pre-fetch lookup options */
  fetchLookupOptions?: (column: TableColumn) => void;
}

export interface RowEditingState {
  /** IDs of rows currently being edited */
  editingRowIds: Set<string | number>;
  /** Current editing data keyed by row ID */
  editingData: Record<string | number, Record<string, unknown>>;
  /** Validation errors keyed by row ID then column key */
  validationErrors: Record<string | number, Record<string, string>>;
  /** Whether any rows are being edited */
  isEditing: boolean;
  /** Number of rows being edited */
  editingRowCount: number;
  /** Total validation error count */
  validationErrorCount: number;
}

export interface RowEditingActions {
  /** Start editing a single row */
  startEditing: (row: TableRow) => void;
  /** Start editing multiple rows */
  startMultiEditing: (rowIds: (string | number)[]) => void;
  /** Cancel editing and discard changes */
  cancelEditing: () => void;
  /** Save all editing changes */
  saveEditing: () => Promise<void>;
  /** Update a cell value while editing */
  updateCell: (rowId: string | number, columnKey: string, value: unknown) => void;
  /** Validate a cell on blur */
  validateCell: (rowId: string | number, columnKey: string, value: unknown, columnType?: string) => void;
}

export interface UseRowEditingReturn {
  state: RowEditingState;
  actions: RowEditingActions;
}

// ============================================================================
// HOOK
// ============================================================================

export function useRowEditing(options: UseRowEditingOptions): UseRowEditingReturn {
  const {
    columns,
    rows,
    foundationId,
    toast,
    onRefresh,
    onRowUpdate,
    isAutoFetch = false,
    setRecords,
    fetchLookupOptions,
  } = options;

  // State from atoms
  const [editingRowIds, setEditingRowIds] = useAtom(editingRowIdsAtom);
  const [editingData, setEditingData] = useAtom(editingDataAtom);
  const [validationErrors, setValidationErrors] = useAtom(legacyValidationErrorsAtom);

  // ============================================================================
  // COMPUTED STATE
  // ============================================================================

  const state = useMemo<RowEditingState>(() => {
    const errorCount = Object.values(validationErrors).reduce(
      (sum, rowErrors) => sum + Object.keys(rowErrors).length,
      0
    );

    return {
      editingRowIds,
      editingData,
      validationErrors,
      isEditing: editingRowIds.size > 0,
      editingRowCount: editingRowIds.size,
      validationErrorCount: errorCount,
    };
  }, [editingRowIds, editingData, validationErrors]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const startEditing = useCallback((row: TableRow) => {
    setEditingRowIds(new Set([row.id]));
    setEditingData({ [row.id]: { ...row } });

    // Pre-fetch lookup options for lookup columns
    if (fetchLookupOptions) {
      columns.forEach(col => {
        if (isLookupColumn(col.column_type) && col.lookup_foundation_id) {
          fetchLookupOptions(col);
        }
      });
    }
  }, [columns, fetchLookupOptions, setEditingRowIds, setEditingData]);

  const startMultiEditing = useCallback((rowIds: (string | number)[]) => {
    const newEditingData: Record<string | number, Record<string, unknown>> = {};
    rowIds.forEach(id => {
      const row = rows.find(r => r.id === id);
      if (row) {
        newEditingData[id] = { ...row };
      }
    });
    setEditingRowIds(new Set(rowIds));
    setEditingData(newEditingData);

    // Pre-fetch lookup options
    if (fetchLookupOptions) {
      columns.forEach(col => {
        if (isLookupColumn(col.column_type) && col.lookup_foundation_id) {
          fetchLookupOptions(col);
        }
      });
    }
  }, [columns, rows, fetchLookupOptions, setEditingRowIds, setEditingData]);

  const cancelEditing = useCallback(() => {
    setEditingRowIds(new Set());
    setEditingData({});
    setValidationErrors({});
  }, [setEditingRowIds, setEditingData, setValidationErrors]);

  const updateCell = useCallback((rowId: string | number, columnKey: string, value: unknown) => {
    setEditingData(prev => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [columnKey]: value,
      },
    }));
  }, [setEditingData]);

  const validateCell = useCallback((
    rowId: string | number,
    columnKey: string,
    value: unknown,
    columnType?: string
  ) => {
    // SSoT: column_type should always be provided - log error if missing
    if (!columnType) {
      console.error(`[SSoT] validateCell called without columnType for column "${columnKey}"`);
    }
    const result = validateCellValue(value, columnType || 'single_line_text');
    const error = result.error;

    setValidationErrors(prev => {
      const rowErrors: Record<string, string> = prev[rowId] ? { ...prev[rowId] } : {};

      if (error) {
        rowErrors[columnKey] = error;
      } else {
        delete rowErrors[columnKey];
      }

      if (Object.keys(rowErrors).length === 0) {
        const { [rowId]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [rowId]: rowErrors };
    });
  }, [setValidationErrors]);

  const saveEditing = useCallback(async () => {
    if (editingRowIds.size === 0) return;

    // Validate all cells before saving
    const newErrors: Record<string | number, Record<string, string>> = {};
    let totalErrorCount = 0;

    for (const rowId of editingRowIds) {
      const rowData = editingData[rowId];
      if (!rowData) continue;

      const rowErrors: Record<string, string> = {};
      for (const [columnKey, value] of Object.entries(rowData)) {
        const column = columns.find(c => c.key === columnKey);
        if (!column) continue;

        // SSoT: column_type should always be set - log error if missing (skip system columns)
        const systemColumns = ['id', 'created_at', 'updated_at'];
        if (!column.column_type && !systemColumns.includes(columnKey)) {
          console.error(`[SSoT] Column "${columnKey}" missing column_type`);
        }
        const result = validateCellValue(value, column.column_type || 'single_line_text');
        if (result.error) {
          rowErrors[columnKey] = result.error;
          totalErrorCount++;
        }
      }

      if (Object.keys(rowErrors).length > 0) {
        newErrors[rowId] = rowErrors;
      }
    }

    if (totalErrorCount > 0) {
      setValidationErrors(newErrors);
      toast?.({
        title: "Cannot save",
        description: `Fix ${totalErrorCount} error${totalErrorCount !== 1 ? "s" : ""} or cancel to discard`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Collect changes
      const rowsToUpdate: Array<{ rowId: string | number; changes: Record<string, unknown> }> = [];

      for (const rowId of editingRowIds) {
        const originalRow = rows.find(r => r.id === rowId);
        const rowData = editingData[rowId];
        if (!originalRow || !rowData) continue;

        const changes: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(rowData)) {
          const originalValue = originalRow[key];
          if (JSON.stringify(originalValue) !== JSON.stringify(value)) {
            changes[key] = value;
          }
        }

        if (Object.keys(changes).length > 0) {
          rowsToUpdate.push({ rowId, changes });
        }
      }

      // Save via API
      if (foundationId && rowsToUpdate.length > 0) {
        for (const { rowId, changes } of rowsToUpdate) {
          await api.patch(`/api/v1/foundations/${foundationId}/records/${rowId}`, {
            record: changes,
          });
        }

        // Clear cache
        clearCachedRecords(foundationId);

        // Optimistic update
        if (isAutoFetch && setRecords) {
          setRecords(prev => prev.map(record => {
            const update = rowsToUpdate.find(r => r.rowId === record.id);
            if (update) {
              return { ...record, ...update.changes };
            }
            return record;
          }));
        }

        onRefresh?.();
      } else if (onRowUpdate) {
        // Legacy: call onRowUpdate for each field
        for (const { rowId, changes } of rowsToUpdate) {
          for (const [key, value] of Object.entries(changes)) {
            await onRowUpdate(rowId, key, value);
          }
        }
        if (foundationId) {
          clearCachedRecords(foundationId);
        }
        if (isAutoFetch && setRecords) {
          setRecords(prev => prev.map(record => {
            const update = rowsToUpdate.find(r => r.rowId === record.id);
            if (update) {
              return { ...record, ...update.changes };
            }
            return record;
          }));
        }
      }

      // Clear editing state
      setEditingRowIds(new Set());
      setEditingData({});
      setValidationErrors({});

      toast?.({
        title: "Saved",
        description: `Successfully saved ${editingRowIds.size} row${editingRowIds.size !== 1 ? "s" : ""}`,
      });
    } catch (error) {
      console.error("Failed to save:", error);
      toast?.({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [
    editingRowIds,
    editingData,
    columns,
    rows,
    foundationId,
    toast,
    onRefresh,
    onRowUpdate,
    isAutoFetch,
    setRecords,
    setEditingRowIds,
    setEditingData,
    setValidationErrors,
  ]);

  // ============================================================================
  // RETURN
  // ============================================================================

  const actions = useMemo<RowEditingActions>(() => ({
    startEditing,
    startMultiEditing,
    cancelEditing,
    saveEditing,
    updateCell,
    validateCell,
  }), [startEditing, startMultiEditing, cancelEditing, saveEditing, updateCell, validateCell]);

  return {
    state,
    actions,
  };
}
