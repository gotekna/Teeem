/**
 * Schema Handlers Hook
 *
 * Provides handlers for schema modification operations (CRUD on columns).
 * Extracted from TeeemTableView to improve code organization.
 *
 * @see Phase 5 refactoring - Event Handler Hooks extraction
 */

import { useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { api } from '@/lib/api';
import { invalidateColumnsCacheAtom } from '@/lib/column-state-atoms';
import { copyToClipboard } from '@/utils/formatters';
import type { TableColumn } from '../../types';

export interface UseSchemaHandlersProps {
  /** Table foundation ID for API calls (numeric ID or slug string) */
  foundationIdNumeric?: number | string | null;

  /** All table columns */
  COLUMNS: TableColumn[];

  /** Toast notification function */
  toast: (options: {
    title: string;
    description: string;
    variant?: 'default' | 'destructive';
  }) => void;

  /** Callback when data needs to be refreshed */
  onRefresh?: () => void;

  /** Callback when column is created (optional override) */
  onCreateColumn?: () => void;

  /** Callback when column is deleted (optional override) */
  onDeleteColumn?: () => void;

  /** Callback when column is updated */
  onColumnUpdate?: () => void;

  // Schema modal state setters
  setSchemaLoading: (loading: boolean) => void;
  setShowCreateColumnModal: (show: boolean) => void;
  setNewColumnName: (name: string) => void;
  setNewColumnType: (type: string) => void;
  setShowDeleteColumnModal: (show: boolean) => void;
  setSelectedColumnToDelete: (key: string) => void;
  setShowEditColumnModal: (show: boolean) => void;
  setEditingColumnKey: (key: string | null) => void;
  setEditColumnName: (name: string) => void;
  setEditColumnType: (type: string) => void;
  setColumnEditMode: React.Dispatch<React.SetStateAction<boolean>>;

  // Schema modal state values
  newColumnName: string;
  newColumnType: string;
  selectedColumnToDelete: string;
  editingColumnKey: string | null;
  editColumnName: string;
  editColumnType: string;
  columnEditMode: boolean;
}

export interface UseSchemaHandlersReturn {
  /** Create a new column */
  handleCreateColumn: () => Promise<void>;

  /** Delete a column */
  handleDeleteColumn: () => Promise<void>;

  /** Open column edit modal */
  handleOpenColumnEdit: (columnKey: string) => void;

  /** Save column changes */
  handleSaveColumnChanges: () => Promise<void>;

  /** Copy table ID to clipboard */
  handleCopyTableId: () => void;

  /** Toggle column edit mode */
  toggleColumnEditMode: () => void;
}

/**
 * Hook for managing schema modification handlers
 *
 * @param props - Schema configuration and dependencies
 * @returns Schema handler functions
 */
export function useSchemaHandlers(props: UseSchemaHandlersProps): UseSchemaHandlersReturn {
  const {
    foundationIdNumeric,
    COLUMNS,
    toast,
    onRefresh,
    onCreateColumn,
    onDeleteColumn,
    onColumnUpdate,
    setSchemaLoading,
    setShowCreateColumnModal,
    setNewColumnName,
    setNewColumnType,
    setShowDeleteColumnModal,
    setSelectedColumnToDelete,
    setShowEditColumnModal,
    setEditingColumnKey,
    setEditColumnName,
    setEditColumnType,
    setColumnEditMode,
    newColumnName,
    newColumnType,
    selectedColumnToDelete,
    editingColumnKey,
    editColumnName,
    editColumnType,
    columnEditMode,
  } = props;

  // Get cache invalidation function
  const invalidateColumnsCache = useSetAtom(invalidateColumnsCacheAtom);

  // Create new column
  const handleCreateColumn = useCallback(async () => {
    if (!newColumnName.trim()) {
      toast({ title: "Error", description: "Column name is required", variant: "destructive" });
      return;
    }

    setSchemaLoading(true);
    try {
      if (onCreateColumn) {
        onCreateColumn();
      } else if (foundationIdNumeric) {
        // Default implementation: call API
        await api.post(`/api/v1/foundations/${foundationIdNumeric}/columns`, {
          column: {
            name: newColumnName,
            column_name: newColumnName.toLowerCase().replace(/\s+/g, "_"),
            column_type: newColumnType,
          },
        });
        toast({ title: "Success", description: `Column "${newColumnName}" created` });

        // Invalidate columns cache so ViewManagerSheet shows the new column
        invalidateColumnsCache(foundationIdNumeric);

        onRefresh?.();
      }
      setShowCreateColumnModal(false);
      setNewColumnName("");
      setNewColumnType("text");
    } catch (error) {
      console.error("Failed to create column:", error);
      toast({ title: "Error", description: "Failed to create column", variant: "destructive" });
    } finally {
      setSchemaLoading(false);
    }
  }, [newColumnName, newColumnType, foundationIdNumeric, onCreateColumn, onRefresh, toast, setSchemaLoading, setShowCreateColumnModal, setNewColumnName, setNewColumnType, invalidateColumnsCache]);

  // Delete column
  const handleDeleteColumn = useCallback(async () => {
    if (!selectedColumnToDelete) {
      toast({ title: "Error", description: "Please select a column to delete", variant: "destructive" });
      return;
    }

    setSchemaLoading(true);
    try {
      if (onDeleteColumn) {
        onDeleteColumn();
      } else if (foundationIdNumeric) {
        // Find column ID
        const col = COLUMNS.find((c) => c.key === selectedColumnToDelete);
        if (col && "id" in col) {
          await api.delete(`/api/v1/foundations/${foundationIdNumeric}/columns/${(col as { id: number }).id}`);
          toast({ title: "Success", description: `Column deleted` });

          // Invalidate columns cache so ViewManagerSheet removes the deleted column
          invalidateColumnsCache(foundationIdNumeric);

          onRefresh?.();
        }
      }
      setShowDeleteColumnModal(false);
      setSelectedColumnToDelete("");
    } catch (error) {
      console.error("Failed to delete column:", error);
      toast({ title: "Error", description: "Failed to delete column", variant: "destructive" });
    } finally {
      setSchemaLoading(false);
    }
  }, [selectedColumnToDelete, foundationIdNumeric, COLUMNS, onDeleteColumn, onRefresh, toast, setSchemaLoading, setShowDeleteColumnModal, setSelectedColumnToDelete, invalidateColumnsCache]);

  // Copy table ID to clipboard
  const handleCopyTableId = useCallback(() => {
    if (foundationIdNumeric) {
      copyToClipboard(String(foundationIdNumeric));
      toast({ title: "Copied", description: `Table ID ${foundationIdNumeric} copied to clipboard` });
    }
  }, [foundationIdNumeric, toast]);

  // Open column edit modal
  const handleOpenColumnEdit = useCallback((columnKey: string) => {
    const col = COLUMNS.find((c) => c.key === columnKey);
    if (col) {
      setEditingColumnKey(columnKey);
      setEditColumnName(col.label);
      // SSoT: column_type should always be set - log error if missing (skip system columns)
      const systemColumns = ['id', 'created_at', 'updated_at'];
      if (!col.column_type && !systemColumns.includes(col.key)) {
        console.error(`[SSoT] Column "${col.key}" missing column_type - defaulting to single_line_text`);
      }
      setEditColumnType(col.column_type || "single_line_text");
      setShowEditColumnModal(true);
    }
  }, [COLUMNS, setEditingColumnKey, setEditColumnName, setEditColumnType, setShowEditColumnModal]);

  // Save column changes
  const handleSaveColumnChanges = useCallback(async () => {
    if (!editingColumnKey) return;

    setSchemaLoading(true);
    try {
      if (foundationIdNumeric) {
        // Call API to update column
        const col = COLUMNS.find((c) => c.key === editingColumnKey);
        if (col && "id" in col) {
          await api.patch(`/api/v1/foundations/${foundationIdNumeric}/columns/${(col as { id: number }).id}`, {
            column: {
              name: editColumnName,
              column_type: editColumnType,
            },
          });
          toast({ title: "Success", description: "Column updated successfully" });

          // Invalidate columns cache so ViewManagerSheet shows the updated column
          invalidateColumnsCache(foundationIdNumeric);

          // Trigger refresh callback to reload data
          onColumnUpdate?.();
          onRefresh?.();
        }
      }
      setShowEditColumnModal(false);
      setEditingColumnKey(null);
    } catch (error) {
      console.error("Failed to update column:", error);
      toast({ title: "Error", description: "Failed to update column", variant: "destructive" });
    } finally {
      setSchemaLoading(false);
    }
  }, [editingColumnKey, editColumnName, editColumnType, foundationIdNumeric, COLUMNS, onColumnUpdate, onRefresh, toast, setSchemaLoading, setShowEditColumnModal, setEditingColumnKey, invalidateColumnsCache]);

  // Toggle column edit mode
  const toggleColumnEditMode = useCallback(() => {
    setColumnEditMode((prev) => !prev);
    if (columnEditMode) {
      toast({ title: "Edit Mode Off", description: "Column editing disabled" });
    } else {
      toast({ title: "Edit Mode On", description: "Click the cog icon on any column to edit it" });
    }
  }, [columnEditMode, toast, setColumnEditMode]);

  return {
    handleCreateColumn,
    handleDeleteColumn,
    handleOpenColumnEdit,
    handleSaveColumnChanges,
    handleCopyTableId,
    toggleColumnEditMode,
  };
}
