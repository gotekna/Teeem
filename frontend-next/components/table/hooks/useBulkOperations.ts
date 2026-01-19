/**
 * Bulk Operations Hook
 *
 * Handles bulk update, delete, and merge operations for table rows.
 * Extracted from TeeemTableView to reduce main component size.
 *
 * Features:
 * - Bulk update with type conversion
 * - Optimistic updates for auto-fetch mode
 * - Cache invalidation
 * - Error handling with validation feedback
 *
 * @example
 * const bulk = useBulkOperations({
 *   foundationId: 'jobs',
 *   selectedIds: selection.state.selectedArray,
 *   columns,
 *   onSuccess: () => selection.actions.clear(),
 * });
 *
 * bulk.actions.openUpdateModal();
 * bulk.actions.setColumn('status');
 * bulk.actions.setValue('completed');
 * await bulk.actions.executeUpdate();
 */

import { useState, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { clearCachedRecords } from '@/lib/records-cache';
import { isLookupColumn } from '@/lib/constants/column-types';
import type { TableColumn, TableRow } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface BulkOperationsState {
  /** Whether bulk update modal is open */
  isUpdateModalOpen: boolean;
  /** Selected column for bulk update */
  updateColumn: string;
  /** Value to set for bulk update */
  updateValue: string;
  /** Whether bulk update is in progress */
  isSaving: boolean;
  /** Whether merge modal is open */
  isMergeModalOpen: boolean;
  /** IDs selected for merge */
  mergeIds: (number | string)[];
}

export interface BulkOperationsActions {
  /** Open bulk update modal */
  openUpdateModal: () => void;
  /** Close bulk update modal */
  closeUpdateModal: () => void;
  /** Set the column for bulk update */
  setColumn: (column: string) => void;
  /** Set the value for bulk update */
  setValue: (value: string) => void;
  /** Execute the bulk update */
  executeUpdate: () => Promise<boolean>;
  /** Open merge modal with selected IDs */
  openMergeModal: (ids: (number | string)[]) => void;
  /** Close merge modal */
  closeMergeModal: () => void;
  /** Handle merge completion (mark IDs as deleted) */
  handleMergeComplete: (deletedIds: (number | string)[]) => void;
  /** Reset all state */
  reset: () => void;
}

export interface UseBulkOperationsProps {
  /** Foundation ID (slug or numeric) */
  foundationId?: string | number | null;
  /** Currently selected row IDs */
  selectedIds: (number | string)[];
  /** Ref to visible entries (filtered/sorted) - accessed at execution time */
  visibleEntriesRef?: React.RefObject<Record<string, unknown>[]>;
  /** Column definitions for type conversion */
  columns: TableColumn[];
  /** Callback when update succeeds */
  onSuccess?: () => void;
  /** Callback when error occurs */
  onError?: (message: string) => void;
  /** Callback when merge completes */
  onMergeComplete?: (deletedIds: (number | string)[]) => void;
  /** Fallback row update handler (when no foundationId) */
  onRowUpdate?: (rowId: number | string, field: string, value: unknown) => Promise<void>;
  /** Callback for optimistic update of local data */
  onOptimisticUpdate?: (ids: (number | string)[], column: string, value: unknown) => void;
  /** Parent refresh callback */
  onRefresh?: () => void;
  /** Callback to fetch lookup options when column changes */
  onColumnChange?: (column: TableColumn) => void;
}

export interface UseBulkOperationsReturn {
  state: BulkOperationsState;
  actions: BulkOperationsActions;
}

// ============================================================================
// VALUE CONVERSION HELPERS
// ============================================================================

/**
 * Convert string value to appropriate type based on column definition
 */
function convertValueForColumn(
  value: string,
  column: TableColumn | undefined
): string | number | number[] | boolean {
  if (!column || !value) return value;

  const colType = column.column_type;

  // Multiple lookups: convert comma-separated string to array of integers
  if (colType === 'multiple_lookups') {
    return value.split(',').filter(Boolean).map(id => parseInt(id, 10));
  }

  // Single lookup: convert to integer (use helper for the general check, but exclude multiple_lookups)
  if ((isLookupColumn(colType) && colType !== 'multiple_lookups') || column.lookup_foundation_id) {
    return parseInt(value, 10);
  }

  // Integer: convert to integer
  if (colType === 'integer' || colType === 'whole_number') {
    return parseInt(value, 10);
  }

  // Number/currency/percentage: convert to float
  if (colType === 'number' || colType === 'currency' || colType === 'percentage') {
    return parseFloat(value);
  }

  // Boolean: convert to boolean
  if (colType === 'boolean') {
    return value === 'true';
  }

  return value;
}

// ============================================================================
// HOOK
// ============================================================================

export function useBulkOperations(props: UseBulkOperationsProps): UseBulkOperationsReturn {
  const {
    foundationId,
    selectedIds,
    visibleEntriesRef,
    columns,
    onSuccess,
    onError,
    onMergeComplete,
    onRowUpdate,
    onOptimisticUpdate,
    onRefresh,
    onColumnChange,
  } = props;

  // State
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateColumn, setUpdateColumn] = useState('');
  const [updateValue, setUpdateValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeIds, setMergeIds] = useState<(number | string)[]>([]);

  // Helper to compute visible selected IDs at execution time (matches inline behavior)
  const getVisibleSelectedIds = useCallback(() => {
    if (!visibleEntriesRef?.current) return selectedIds;
    const visibleIds = new Set(visibleEntriesRef.current.map(e => e.id as number | string));
    return selectedIds.filter(id => visibleIds.has(id));
  }, [selectedIds, visibleEntriesRef]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const openUpdateModal = useCallback(() => {
    setIsUpdateModalOpen(true);
  }, []);

  const closeUpdateModal = useCallback(() => {
    setIsUpdateModalOpen(false);
    setUpdateColumn('');
    setUpdateValue('');
  }, []);

  const setColumn = useCallback((column: string) => {
    setUpdateColumn(column);
    setUpdateValue(''); // Reset value when column changes

    // Fetch lookup options if needed
    if (column && onColumnChange) {
      const selectedCol = columns.find(c => c.key === column);
      if (selectedCol) {
        const isLookup = isLookupColumn(selectedCol.column_type) || !!selectedCol.lookup_foundation_id;
        if (isLookup) {
          onColumnChange(selectedCol);
        }
      }
    }
  }, [columns, onColumnChange]);

  const setValue = useCallback((value: string) => {
    setUpdateValue(value);
  }, []);

  const executeUpdate = useCallback(async (): Promise<boolean> => {
    // Compute visible selected IDs at execution time (SSoT: matches inline behavior)
    const visibleSelectedIds = getVisibleSelectedIds();

    console.log('[useBulkOperations] Starting bulk update...');
    console.log('[useBulkOperations] Column:', updateColumn);
    console.log('[useBulkOperations] Value:', updateValue);
    console.log('[useBulkOperations] Total selected:', selectedIds.length);
    console.log('[useBulkOperations] Visible selected IDs:', visibleSelectedIds.length);

    if (!updateColumn || visibleSelectedIds.length === 0) {
      console.warn('[useBulkOperations] Aborted - missing column or no visible rows selected');
      return false;
    }

    setIsSaving(true);

    try {
      const selectedCol = columns.find(c => c.key === updateColumn);
      const valueToSend = convertValueForColumn(updateValue, selectedCol);

      console.log('[useBulkOperations] Converted value:', updateValue, '→', valueToSend);

      if (foundationId) {
        // Use bulk_update API endpoint
        const payload = {
          record_ids: visibleSelectedIds,
          updates: { [updateColumn]: valueToSend },
        };

        console.log('[useBulkOperations] Using bulk_update API');

        const response = await api.post<{
          success: boolean;
          updated_count: number;
          total_requested: number;
          errors?: Array<{ id: number; errors: string[] }>;
        }>(`/api/v1/foundations/${foundationId}/records/bulk_update`, payload);

        console.log('[useBulkOperations] API response:', response);

        // Check for errors
        if (!response || !response.success || response.updated_count === 0) {
          console.error('[useBulkOperations] Update failed');
          console.error('[useBulkOperations] Updated count:', response?.updated_count);
          console.error('[useBulkOperations] Errors:', response?.errors);

          // Check if this is an entity_type validation error
          const hasEntityTypeErrors = response?.errors && response.errors.some(err =>
            err.errors && err.errors.some(msg =>
              msg.toLowerCase().includes('first name') ||
              msg.toLowerCase().includes('full name') ||
              msg.toLowerCase().includes('entity')
            )
          );

          // Build error message
          let errorMessage = `Bulk update failed. ${response?.updated_count || 0} of ${response?.total_requested || visibleSelectedIds.length} records updated.`;

          if (response?.errors && response.errors.length > 0) {
            errorMessage += '\n\nValidation errors:\n';
            response.errors.slice(0, 3).forEach(err => {
              errorMessage += `\n• Record ${err.id}: ${err.errors.join(', ')}`;
            });
            if (response.errors.length > 3) {
              errorMessage += `\n... and ${response.errors.length - 3} more errors`;
            }
          }

          // If entity_type validation errors, automatically open health report
          if (hasEntityTypeErrors && foundationId) {
            console.log('[useBulkOperations] Detected entity_type errors, opening health report...');
            errorMessage += '\n\n⚠️ Some records have data quality issues that must be fixed first.';
            errorMessage += '\n\nOpening Health Report to show which records need fixing...';

            onError?.(errorMessage);

            // Open health report in new tab
            const healthUrl = `/system-health?foundation=${foundationId}`;
            window.open(healthUrl, '_blank');
            return false;
          }

          onError?.(errorMessage);
          return false;
        }

        console.log('[useBulkOperations] Success! Updated', response.updated_count, 'records');
      } else if (onRowUpdate) {
        // Fallback to individual updates
        console.log('[useBulkOperations] Using fallback individual updates');
        for (const id of visibleSelectedIds) {
          await onRowUpdate(id, updateColumn, valueToSend);
        }
        console.log('[useBulkOperations] Individual updates completed');
      } else {
        console.error('[useBulkOperations] No update mechanism available');
        return false;
      }

      // Success - clean up
      closeUpdateModal();

      // Clear cache
      if (foundationId) {
        clearCachedRecords(foundationId);
      }

      // Optimistic update
      if (onOptimisticUpdate) {
        onOptimisticUpdate(visibleSelectedIds, updateColumn, valueToSend);
      }

      // Notify success
      onSuccess?.();
      onRefresh?.();

      console.log('[useBulkOperations] Complete!');
      return true;

    } catch (error) {
      console.error('[useBulkOperations] ERROR:', error);
      onError?.(`Bulk update failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    updateColumn,
    updateValue,
    getVisibleSelectedIds,
    selectedIds,
    columns,
    foundationId,
    onRowUpdate,
    onOptimisticUpdate,
    onSuccess,
    onError,
    onRefresh,
    closeUpdateModal,
  ]);

  const openMergeModal = useCallback((ids: (number | string)[]) => {
    setMergeIds(ids);
    setIsMergeModalOpen(true);
  }, []);

  const closeMergeModal = useCallback(() => {
    setIsMergeModalOpen(false);
    setMergeIds([]);
  }, []);

  const handleMergeComplete = useCallback((deletedIds: (number | string)[]) => {
    console.log('[useBulkOperations] Merge completed, deleted IDs:', deletedIds);

    // Clear cache
    if (foundationId) {
      clearCachedRecords(foundationId);
    }

    // Close modal
    closeMergeModal();

    // Notify parent
    onMergeComplete?.(deletedIds);
    onSuccess?.();
    onRefresh?.();
  }, [foundationId, closeMergeModal, onMergeComplete, onSuccess, onRefresh]);

  const reset = useCallback(() => {
    setIsUpdateModalOpen(false);
    setUpdateColumn('');
    setUpdateValue('');
    setIsSaving(false);
    setIsMergeModalOpen(false);
    setMergeIds([]);
  }, []);

  // ============================================================================
  // RETURN
  // ============================================================================

  const state = useMemo<BulkOperationsState>(() => ({
    isUpdateModalOpen,
    updateColumn,
    updateValue,
    isSaving,
    isMergeModalOpen,
    mergeIds,
  }), [isUpdateModalOpen, updateColumn, updateValue, isSaving, isMergeModalOpen, mergeIds]);

  const actions = useMemo<BulkOperationsActions>(() => ({
    openUpdateModal,
    closeUpdateModal,
    setColumn,
    setValue,
    executeUpdate,
    openMergeModal,
    closeMergeModal,
    handleMergeComplete,
    reset,
  }), [
    openUpdateModal,
    closeUpdateModal,
    setColumn,
    setValue,
    executeUpdate,
    openMergeModal,
    closeMergeModal,
    handleMergeComplete,
    reset,
  ]);

  return { state, actions };
}

export default useBulkOperations;
