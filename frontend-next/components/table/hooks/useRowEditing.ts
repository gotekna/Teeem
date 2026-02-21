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

import { useCallback, useMemo, useRef } from 'react';
import { useAtom } from 'jotai';
import {
  editingRowIdsAtom,
  editingDataAtom,
  legacyValidationErrorsAtom,
} from '@/lib/table-atoms';
import { validateCell as validateCellValue } from '../core/column-renderer/CellValidation';
import { api } from '@/lib/api';
import { clearCachedRecords } from '@/lib/records-cache';
import { invalidateLookupCache } from '../utils/lookup-cache';
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
  /** Whether edit mode is active (accumulate rows instead of replacing) */
  isEditMode?: boolean;
  /** Setter for auto-fetched records (for optimistic updates) */
  setRecords?: React.Dispatch<React.SetStateAction<TableRow[]>>;
  /** Callback to pre-fetch lookup options */
  fetchLookupOptions?: (column: TableColumn) => void;
  /** Current lookup options (for resolving display values in optimistic updates) */
  lookupOptions?: Record<string, Array<{ id: number | string; display: string }>>;
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
  /** IDs of rows that have been modified (have actual changes vs original) */
  dirtyRowIds: Set<string | number>;
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
    isEditMode = false,
    setRecords,
    fetchLookupOptions,
    lookupOptions,
  } = options;

  // State from atoms
  const [editingRowIds, setEditingRowIds] = useAtom(editingRowIdsAtom);
  const [editingData, setEditingData] = useAtom(editingDataAtom);
  const [validationErrors, setValidationErrors] = useAtom(legacyValidationErrorsAtom);

  // Track which fields the user explicitly modified (prevents sending untouched FK columns)
  const modifiedFieldsRef = useRef<Record<string | number, Set<string>>>({});

  // ============================================================================
  // COMPUTED STATE
  // ============================================================================

  const state = useMemo<RowEditingState>(() => {
    const errorCount = Object.values(validationErrors).reduce(
      (sum, rowErrors) => sum + Object.keys(rowErrors).length,
      0
    );

    // Compute dirty rows: rows where editingData differs from original row data
    const dirty = new Set<string | number>();
    for (const rowId of editingRowIds) {
      const originalRow = rows.find(r => r.id === rowId);
      const rowData = editingData[rowId];
      if (!originalRow || !rowData) continue;

      for (const [key, value] of Object.entries(rowData)) {
        if (key === 'id') continue;
        if (JSON.stringify(originalRow[key]) !== JSON.stringify(value)) {
          dirty.add(rowId);
          break;
        }
      }
    }

    return {
      editingRowIds,
      editingData,
      validationErrors,
      isEditing: editingRowIds.size > 0,
      editingRowCount: editingRowIds.size,
      validationErrorCount: errorCount,
      dirtyRowIds: dirty,
    };
  }, [editingRowIds, editingData, validationErrors, rows]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const startEditing = useCallback((row: TableRow) => {
    if (isEditMode) {
      // In edit mode: accumulate rows - add to existing set, preserve pending edits
      setEditingRowIds(prev => {
        if (prev.has(row.id)) return prev; // Already editing this row
        const next = new Set(prev);
        next.add(row.id);
        return next;
      });
      setEditingData(prev => {
        if (prev[row.id]) return prev; // Already have data for this row
        return { ...prev, [row.id]: { ...row } };
      });
    } else {
      // Single-row mode: replace (legacy behavior for double-click editing)
      setEditingRowIds(new Set([row.id]));
      setEditingData({ [row.id]: { ...row } });
    }

    // Pre-fetch lookup options for lookup columns
    if (fetchLookupOptions) {
      columns.forEach(col => {
        if (isLookupColumn(col.column_type) && col.lookup_foundation_id) {
          fetchLookupOptions(col);
        }
      });
    }
  }, [columns, fetchLookupOptions, isEditMode, setEditingRowIds, setEditingData]);

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
    modifiedFieldsRef.current = {};
  }, [setEditingRowIds, setEditingData, setValidationErrors]);

  const updateCell = useCallback((rowId: string | number, columnKey: string, value: unknown) => {
    // Track this field as explicitly modified by the user
    if (!modifiedFieldsRef.current[rowId]) {
      modifiedFieldsRef.current[rowId] = new Set();
    }
    modifiedFieldsRef.current[rowId].add(columnKey);

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

    // Declared outside try so catch block can reference for field-level errors
    const rowsToUpdate: Array<{ rowId: string | number; changes: Record<string, unknown> }> = [];

    try {
      // Build set of editable column keys - ONLY these get sent to the API
      // This prevents sending expanded lookup objects, display values, and computed fields
      // which would cause FK violations (e.g. supplier_id=0 from coercing {id:123,name:"..."})
      const NON_EDITABLE_KEYS = ['id', 'created_at', 'updated_at', 'select', 'actions'];
      const editableColumnKeys = new Set(
        columns
          .filter(c => {
            const isComputed = c.column_type === 'computed' || c.column_type === 'formula';
            const isSystem = NON_EDITABLE_KEYS.includes(c.key) || c.system === true;
            return c.editable !== false && !isSystem && !isComputed;
          })
          .map(c => c.key)
      );

      for (const rowId of editingRowIds) {
        const originalRow = rows.find(r => r.id === rowId);
        const rowData = editingData[rowId];
        if (!originalRow || !rowData) continue;

        const modifiedForRow = modifiedFieldsRef.current[rowId];
        const hasTracking = modifiedForRow && modifiedForRow.size > 0;
        const changes: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(rowData)) {
          // Only send fields that correspond to actual editable columns
          if (!editableColumnKeys.has(key)) continue;
          // If we have explicit tracking, only send tracked fields
          // If no tracking (fallback), send all changed editable fields
          if (hasTracking && !modifiedForRow.has(key)) continue;
          const originalValue = originalRow[key];
          if (JSON.stringify(originalValue) !== JSON.stringify(value)) {
            // Sanitize FK values: convert 0/"0"/"" to null for _id columns
            if (key.endsWith('_id') && (value === 0 || value === '0' || value === '')) {
              changes[key] = null;
            } else {
              changes[key] = value;
            }
          }
        }

        if (Object.keys(changes).length > 0) {
          rowsToUpdate.push({ rowId, changes });
        }
      }

      // Save via API
      if (foundationId && rowsToUpdate.length > 0) {
        if (rowsToUpdate.length === 1) {
          // Single row: use direct PATCH
          await api.patch(`/api/v1/foundations/${foundationId}/records/${rowsToUpdate[0].rowId}`, {
            record: rowsToUpdate[0].changes,
          });
        } else {
          // Multiple rows: batch into single request to avoid rate limiting
          await api.post(`/api/v1/foundations/${foundationId}/records/batch_update`, {
            updates: rowsToUpdate.map(({ rowId, changes }) => ({
              id: rowId,
              changes,
            })),
          });
        }

        // Clear cache (records + lookup options so downstream tables get fresh dropdowns)
        clearCachedRecords(foundationId);
        invalidateLookupCache();

        // Optimistic update: apply changes to local records immediately
        // When optimistic update succeeds, skip onRefresh to avoid component remount
        // (remount discards optimistic state and shows stale SSR data until re-fetch)
        if (isAutoFetch && setRecords) {
          setRecords(prev => prev.map(record => {
            const update = rowsToUpdate.find(r => r.rowId === record.id);
            if (update) {
              // Resolve lookup column values to {id, display} format for display
              // Without this, optimistic update overwrites {id, display} with raw ID
              const resolvedChanges = { ...update.changes };
              for (const [key, value] of Object.entries(resolvedChanges)) {
                const col = columns.find(c => c.key === key);
                if (col && isLookupColumn(col.column_type) && value != null && typeof value !== 'object') {
                  const opts = lookupOptions?.[key];
                  const match = opts?.find(o => String(o.id) === String(value));
                  if (match) {
                    resolvedChanges[key] = { id: Number(value), display: match.display };
                  }
                }
              }
              return { ...record, ...resolvedChanges };
            }
            return record;
          }));
        } else {
          // No optimistic update available - fall back to parent refresh
          onRefresh?.();
        }
      } else if (onRowUpdate) {
        // Legacy: call onRowUpdate for each field
        for (const { rowId, changes } of rowsToUpdate) {
          for (const [key, value] of Object.entries(changes)) {
            await onRowUpdate(rowId, key, value);
          }
        }
        if (foundationId) {
          clearCachedRecords(foundationId);
          invalidateLookupCache();
        }
        if (isAutoFetch && setRecords) {
          setRecords(prev => prev.map(record => {
            const update = rowsToUpdate.find(r => r.rowId === record.id);
            if (update) {
              // Resolve lookup values (same as primary path above)
              const resolvedChanges = { ...update.changes };
              for (const [key, value] of Object.entries(resolvedChanges)) {
                const col = columns.find(c => c.key === key);
                if (col && isLookupColumn(col.column_type) && value != null && typeof value !== 'object') {
                  const opts = lookupOptions?.[key];
                  const match = opts?.find(o => String(o.id) === String(value));
                  if (match) {
                    resolvedChanges[key] = { id: Number(value), display: match.display };
                  }
                }
              }
              return { ...record, ...resolvedChanges };
            }
            return record;
          }));
        }
      }

      // Clear editing state
      setEditingRowIds(new Set());
      setEditingData({});
      setValidationErrors({});
      modifiedFieldsRef.current = {};

      toast?.({
        title: "Saved",
        description: `Successfully saved ${rowsToUpdate.length} row${rowsToUpdate.length !== 1 ? "s" : ""}`,
      });
    } catch (error) {
      console.error("Failed to save:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Parse server validation errors (e.g., "Code has already been taken")
      // and attach them to the relevant field so they show inline
      if (rowsToUpdate.length === 1) {
        const rowId = rowsToUpdate[0].rowId;
        const fieldErrors: Record<string, string> = {};
        // Match "FieldName error message" pattern from Rails full_messages
        const changedKeys = Object.keys(rowsToUpdate[0].changes);
        for (const key of changedKeys) {
          const fieldLabel = key.replace(/_/g, ' ');
          if (errorMessage.toLowerCase().includes(fieldLabel.toLowerCase())) {
            fieldErrors[key] = errorMessage;
          }
        }
        if (Object.keys(fieldErrors).length > 0) {
          setValidationErrors(prev => ({ ...prev, [rowId]: { ...prev[rowId], ...fieldErrors } }));
        }
      }

      toast?.({
        title: "Save failed",
        description: errorMessage,
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
