/**
 * TeeemTableView State Management - ZERO useState Architecture
 *
 * This file is the SINGLE SOURCE OF TRUTH for ALL table state.
 * Every piece of state lives in Jotai atoms - no useState in components.
 *
 * Benefits:
 * - True SSoT - One source of truth, no "is this shared?" decisions
 * - Debuggable - Jotai DevTools shows ALL state
 * - Testable - Mock atoms, not component internals
 * - Predictable - State changes are explicit and traceable
 *
 * @see /Users/robertharder/.claude/plans/synthetic-rolling-ullman.md
 */

import { atom } from 'jotai';
import { TABLE_ROW_LIMIT } from './constants/pagination-constants';

// ============================================================================
// EDIT MODE STATE (from table-edit-atoms.ts)
// ============================================================================

/**
 * Global edit mode toggle
 * When true, all editable cells become interactive
 * When false, cells are read-only
 */
export const tableEditModeAtom = atom<boolean>(false);

/**
 * Global fullscreen mode for tables
 * When true, hides breadcrumbs and other overlays
 * Set by TeeemTableView when entering fullscreen
 */
export const tableFullscreenAtom = atom<boolean>(false);

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

/**
 * Pending edits before save
 * Maps cell key ("rowId:columnKey") to pending value
 */
export interface PendingEdit {
  value: unknown;
  originalValue: unknown;
  isDirty: boolean;
}

export const pendingEditsAtom = atom<Map<string, PendingEdit>>(new Map());

/**
 * Validation errors per cell
 * Maps cell key ("rowId:columnKey") to error message
 */
export const validationErrorsAtom = atom<Map<string, string>>(new Map());

/**
 * Cells currently being saved (showing spinner)
 */
export const savingCellsAtom = atom<Set<string>>(new Set<string>());

// ============================================================================
// SELECTION STATE
// ============================================================================

/**
 * Selected row IDs for bulk actions
 */
export const selectedRowsAtom = atom<Set<string | number>>(new Set<string | number>());

/**
 * Whether all rows are selected (for "Select All" checkbox)
 */
export const selectAllAtom = atom<boolean>(false);

// ============================================================================
// MODAL STATE (Registry Pattern)
// ============================================================================

/**
 * Complete modal type registry for TeeemTableView
 * null = no modal open
 *
 * SSoT ARCHITECTURE: Only ONE modal can be open at a time.
 * This structural guarantee prevents the drift that occurs with
 * individual boolean atoms (where multiple could be true simultaneously).
 *
 * Legacy boolean atoms (showMergeModalAtom, etc.) are now DERIVED from
 * this registry for backward compatibility.
 */
export type TableModalType =
  // Record operations
  | 'addRecord'
  | 'editRecord'
  | 'viewRecord'
  | 'deleteConfirm'
  // Bulk operations
  | 'bulkUpdate'
  | 'bulkDelete'
  | 'merge'
  | 'emailContacts'
  // View management
  | 'saveView'
  | 'globalViewsManager'
  // Column management
  | 'createColumn'
  | 'editColumns'
  | 'deleteColumn'
  | 'viewSchema'
  | 'editColumn'
  // Export/Import
  | 'export'
  | 'import'
  // Misc
  | 'lookup'
  | 'duplicateReview'
  | 'aiAssistant'
  | null;

/**
 * @deprecated Use TableModalType instead
 * Kept for backward compatibility
 */
export type ModalType = TableModalType;

/**
 * Currently active modal (only one at a time)
 * SSoT: All modal visibility should derive from this atom
 */
export const activeTableModalAtom = atom<TableModalType>(null);

/**
 * @deprecated Use activeTableModalAtom instead
 * Alias for backward compatibility
 */
export const activeModalAtom = activeTableModalAtom;

/**
 * Modal-specific data (row being edited, lookup options, etc.)
 * Different modals store different data here
 */
export const tableModalDataAtom = atom<Record<string, unknown>>({});

/**
 * @deprecated Use tableModalDataAtom instead
 */
export const modalDataAtom = tableModalDataAtom;

/**
 * Helper to open a modal with data
 * Atomically sets both the modal type and its data
 */
export const openTableModalAtom = atom(
  null,
  (get, set, params: { modal: TableModalType; data?: Record<string, unknown> }) => {
    set(activeTableModalAtom, params.modal);
    set(tableModalDataAtom, params.data || {});
  }
);

/**
 * @deprecated Use openTableModalAtom instead
 */
export const openModalAtom = atom(
  null,
  (get, set, params: { modal: TableModalType; data?: Record<string, unknown> }) => {
    set(activeTableModalAtom, params.modal);
    if (params.data) {
      set(tableModalDataAtom, params.data);
    }
  }
);

/**
 * Helper to close the current modal
 * Clears both the modal type and data
 */
export const closeTableModalAtom = atom(null, (get, set) => {
  set(activeTableModalAtom, null);
  set(tableModalDataAtom, {});
});

/**
 * @deprecated Use closeTableModalAtom instead
 */
export const closeModalAtom = closeTableModalAtom;

// ============================================================================
// UI STATE
// ============================================================================

/**
 * Currently hovered row ID
 */
export const hoveredRowAtom = atom<string | number | null>(null);

/**
 * Expanded row IDs (for nested/detail rows)
 */
export const expandedRowsAtom = atom<Set<string | number>>(new Set<string | number>());

/**
 * Context menu state
 */
export const contextMenuAtom = atom<{
  position: { x: number; y: number };
  rowId: string | number;
  columnKey?: string;
} | null>(null);

/**
 * Search input value (debounced to atom)
 */
export const searchQueryAtom = atom<string>('');

/**
 * Whether search input is focused
 */
export const searchFocusedAtom = atom<boolean>(false);

/**
 * Loading state for table data
 */
export const tableLoadingAtom = atom<boolean>(false);

/**
 * Error state for table operations
 */
export const tableErrorAtom = atom<string | null>(null);

// ============================================================================
// COLUMN CONFIGURATION
// ============================================================================

/**
 * Column widths (key: column key, value: width in pixels)
 */
export const columnWidthsAtom = atom<Record<string, number>>({});

/**
 * Column order (array of column keys)
 */
export const columnOrderAtom = atom<string[]>([]);

/**
 * Hidden columns (set of column keys)
 */
export const hiddenColumnsAtom = atom<Set<string>>(new Set<string>());

/**
 * Column being resized (for live resize preview)
 */
export const resizingColumnAtom = atom<{
  columnKey: string;
  startWidth: number;
  startX: number;
} | null>(null);

/**
 * Column being dragged for reorder
 */
export const draggingColumnAtom = atom<string | null>(null);

// ============================================================================
// SCROLL & VIRTUALIZATION STATE
// ============================================================================

/**
 * Current scroll position (for virtualization)
 */
export const scrollPositionAtom = atom<{ top: number; left: number }>({ top: 0, left: 0 });

/**
 * Visible row range (for virtualization)
 */
export const visibleRowRangeAtom = atom<{ start: number; end: number }>({ start: 0, end: 50 });

// ============================================================================
// RE-EXPORTS FROM VIEW-STATE-ATOMS (SSoT - do not duplicate!)
// ============================================================================
// The view-related atoms are defined in view-state-atoms.ts
// Re-export them here for convenience but SSoT is view-state-atoms.ts
export {
  // Core view state atoms
  activeViewIdAtom,
  currentFiltersAtom,
  currentFilterGroupsAtom,
  currentInterGroupLogicAtom,
  currentVisibleColumnsAtom,
  currentColumnOrderAtom,
  currentColumnWidthsAtom,
  currentSortColumnsAtom,
  currentGroupByColumnsAtom,
  currentAutoFitColumnsAtom,
  currentShowTotalsAtom,
  collapsedGroupsAtom,
  // Column config atomic actions (SSoT)
  type ColumnConfigUpdate,
  updateColumnConfigAtom,
  resetColumnConfigAtom,
  // View collection state
  viewsCacheAtom,
  VIEWS_CACHE_TTL,
  foundationViewsAtom,
  viewsLoadingAtom,
  viewSavingAtom,
  // Cache management
  invalidateViewsCacheAtom,
  // Derived view atoms
  currentViewAtom,
  hasUnsavedChangesAtom,
  // Lookup cache
  lookupCacheAtom,
  pendingLookupFetchesAtom,
  LOOKUP_CACHE_TTL,
  type LookupOption,
  getCachedLookupAtom,
  setLookupCacheAtom,
  invalidateLookupCacheAtom,
  // ULTRA Solution: Sourced filter atoms
  type FilterSource,
  type SourcedCascadeFilter,
  type SourcedFilterState,
  baseFiltersAtom,
  viewFiltersAtom,
  userFiltersAtom,
  searchFiltersAtom,
  quickFilterAtom,
  filterGroupsAtom,
  interGroupLogicAtom,
  mergedFiltersAtom,
  apiFiltersAtom,
  hasUserFiltersAtom,
  filterStateBySourceAtom,
  setBaseFiltersAtom,
  setViewFiltersAtom,
  addUserFilterAtom,
  setUserFiltersAtom,
  setSearchFiltersAtom,
  setQuickFiltersAtom,
  removeFilterAtom,
  clearFiltersAtom,
  clearAllUserFiltersAtom,
  resetFilterGroupsAtom,
  resetAllFiltersAtom,
} from './view-state-atoms';

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
 */
export const hasAnyValidationErrorsAtom = atom((get) => {
  const errors = get(validationErrorsAtom);
  return errors.size > 0;
});

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

/**
 * Get selected row count
 */
export const selectedCountAtom = atom((get) => {
  return get(selectedRowsAtom).size;
});

/**
 * Check if a row is selected
 */
export const isRowSelectedAtom = atom(
  (get) => (rowId: string | number): boolean => {
    return get(selectedRowsAtom).has(rowId);
  }
);

// ============================================================================
// ATOMIC ACTIONS
// ============================================================================

/**
 * Start editing a cell
 */
export const startCellEditAtom = atom(
  null,
  (get, set, params: { rowId: string | number; columnKey: string; currentValue: unknown }) => {
    const { rowId, columnKey, currentValue } = params;
    const key = getCellKey(rowId, columnKey);

    set(focusedCellAtom, { rowId, columnKey });

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

    const pending = get(pendingEditsAtom);
    const newPending = new Map(pending);
    newPending.delete(key);
    set(pendingEditsAtom, newPending);

    const errors = get(validationErrorsAtom);
    const newErrors = new Map(errors);
    newErrors.delete(key);
    set(validationErrorsAtom, newErrors);

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
  set(savingCellsAtom, new Set<string>());
});

/**
 * Enter edit mode
 */
export const enterEditModeAtom = atom(null, (get, set) => {
  set(tableEditModeAtom, true);
});

/**
 * Toggle row selection
 */
export const toggleRowSelectionAtom = atom(
  null,
  (get, set, rowId: string | number) => {
    const selected = get(selectedRowsAtom);
    const newSelected = new Set(selected);

    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }

    set(selectedRowsAtom, newSelected);
  }
);

/**
 * Select all rows
 */
export const selectAllRowsAtom = atom(
  null,
  (get, set, rowIds: (string | number)[]) => {
    set(selectedRowsAtom, new Set(rowIds));
    set(selectAllAtom, true);
  }
);

/**
 * Clear all selections
 */
export const clearSelectionAtom = atom(null, (get, set) => {
  set(selectedRowsAtom, new Set<string | number>());
  set(selectAllAtom, false);
});

/**
 * Toggle expanded state for a row
 */
export const toggleRowExpandedAtom = atom(
  null,
  (get, set, rowId: string | number) => {
    const expanded = get(expandedRowsAtom);
    const newExpanded = new Set(expanded);

    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }

    set(expandedRowsAtom, newExpanded);
  }
);

/**
 * Show context menu
 */
export const showContextMenuAtom = atom(
  null,
  (get, set, params: { x: number; y: number; rowId: string | number; columnKey?: string }) => {
    set(contextMenuAtom, {
      position: { x: params.x, y: params.y },
      rowId: params.rowId,
      columnKey: params.columnKey,
    });
  }
);

/**
 * Hide context menu
 */
export const hideContextMenuAtom = atom(null, (get, set) => {
  set(contextMenuAtom, null);
});

// NOTE: invalidateViewsCacheAtom, getCachedLookupAtom, setLookupCacheAtom,
// and invalidateLookupCacheAtom are re-exported from view-state-atoms.ts above
// (SSoT - do not duplicate!)

// ============================================================================
// PANEL/UI STATE (replaces useState in TeeemTableView)
// ============================================================================

// ============================================================================
// FILTER UI MODE (Exclusive Mode Pattern)
// ============================================================================

/**
 * Filter UI mode - only ONE can be active at a time
 *
 * SSoT ARCHITECTURE: This is the source of truth for filter UI visibility.
 * Using a mode enum instead of separate booleans prevents the drift where
 * both filterPanelOpen and showColumnFilters could be true simultaneously.
 *
 * - 'none': No filter UI visible
 * - 'inline': Column filter row visible under headers
 * - 'panel': ViewManagerSheet side panel open
 */
export type FilterUIMode = 'none' | 'inline' | 'panel';

/**
 * SSoT for filter UI visibility
 * Only ONE filter UI mode can be active at a time
 */
export const filterUIModeAtom = atom<FilterUIMode>('none');

/**
 * @deprecated Use filterUIModeAtom === 'none' instead
 * Legacy atom kept for backward compatibility - was never used
 */
export const showFiltersAtom = atom<boolean>(false);

/**
 * Whether the health check panel is open
 */
export const healthPanelOpenAtom = atom<boolean>(false);

/**
 * Whether the filter panel (sheet) is open
 * DERIVED from filterUIModeAtom for backward compatibility
 *
 * Read: true when mode is 'panel'
 * Write: sets mode to 'panel' (true) or 'none' (false)
 *
 * Supports both direct value and functional update pattern for
 * compatibility with React.Dispatch<SetStateAction<boolean>>
 */
export const filterPanelOpenAtom = atom(
  (get) => get(filterUIModeAtom) === 'panel',
  (get, set, value: boolean | ((prev: boolean) => boolean)) => {
    const currentValue = get(filterUIModeAtom) === 'panel';
    const newValue = typeof value === 'function' ? value(currentValue) : value;
    set(filterUIModeAtom, newValue ? 'panel' : 'none');
  }
);

/**
 * Whether inline column filters row is visible
 * Shows a row of filter inputs directly under each column header
 * DERIVED from filterUIModeAtom for backward compatibility
 *
 * Read: true when mode is 'inline'
 * Write: sets mode to 'inline' (true) or 'none' (false)
 *
 * Supports both direct value and functional update pattern for
 * compatibility with React.Dispatch<SetStateAction<boolean>>
 */
export const showColumnFiltersAtom = atom(
  (get) => get(filterUIModeAtom) === 'inline',
  (get, set, value: boolean | ((prev: boolean) => boolean)) => {
    const currentValue = get(filterUIModeAtom) === 'inline';
    const newValue = typeof value === 'function' ? value(currentValue) : value;
    set(filterUIModeAtom, newValue ? 'inline' : 'none');
  }
);

/**
 * Row limit for pagination
 * SSoT: Uses TABLE_ROW_LIMIT from pagination-constants.ts
 */
export const rowLimitAtom = atom<number>(TABLE_ROW_LIMIT);

/**
 * Whether to show all rows (disable pagination)
 */
export const showAllRowsAtom = atom<boolean>(false);

/**
 * Group view mode - inline (groups as rows) or panel (groups above header)
 */
export const groupViewModeAtom = atom<'inline' | 'panel'>('inline');

/**
 * Whether column edit mode is enabled
 */
export const columnEditModeAtom = atom<boolean>(false);

/**
 * Search all columns toggle (table-instance specific)
 */
export const searchAllColumnsAtom = atom<boolean>(false);

/**
 * Search mode (contains, exact, starts_with, fuzzy, regex)
 */
export const searchModeAtom = atom<'contains' | 'exact' | 'starts_with' | 'fuzzy' | 'regex'>('contains');

/**
 * Searchable columns map (which columns to include in search)
 */
export const searchableColumnsAtom = atom<Record<string, boolean>>({});

// ============================================================================
// EDITING ROW STATE (legacy multi-row editing)
// ============================================================================

/**
 * Row IDs currently being edited (multi-row editing mode)
 */
export const editingRowIdsAtom = atom<Set<number | string>>(new Set<number | string>());

/**
 * Editing data keyed by row ID
 */
export const editingDataAtom = atom<Record<string | number, Record<string, unknown>>>({});

/**
 * Legacy single cell editing state
 */
export const editingCellAtom = atom<{ rowId: number | string; columnKey: string } | null>(null);

/**
 * Legacy cell value being edited
 */
export const editingCellValueAtom = atom<unknown>(null);

/**
 * Legacy validation errors (by row)
 */
export const legacyValidationErrorsAtom = atom<Record<string, Record<string, string>>>({});

// ============================================================================
// LOOKUP STATE
// ============================================================================

/**
 * Lookup options loaded for dropdowns (keyed by column)
 */
export const lookupOptionsAtom = atom<Record<string, Array<{ id: number; display: string }>>>({});

/**
 * Loading state for lookup fetches
 */
export const lookupLoadingAtom = atom<Record<string, boolean>>({});

// ============================================================================
// MERGE MODAL STATE
// ============================================================================

/**
 * Whether the merge modal is open
 */
export const showMergeModalAtom = atom<boolean>(false);

/**
 * Selected row IDs for merging
 */
export const mergeSelectedIdsAtom = atom<(string | number)[]>([]);

// ============================================================================
// BULK UPDATE MODAL STATE
// ============================================================================

/**
 * Whether the bulk update modal is open
 */
export const showBulkUpdateModalAtom = atom<boolean>(false);

/**
 * Column selected for bulk update
 */
export const bulkUpdateColumnAtom = atom<string>('');

/**
 * Value for bulk update
 */
export const bulkUpdateValueAtom = atom<string>('');

/**
 * Whether bulk update is currently saving
 */
export const bulkUpdateSavingAtom = atom<boolean>(false);

// ============================================================================
// SAVE VIEW MODAL STATE
// ============================================================================

/**
 * Whether the save view modal is open
 */
export const showSaveViewModalAtom = atom<boolean>(false);

/**
 * New view name input
 */
export const newViewNameAtom = atom<string>('');

/**
 * Whether to save as global view
 */
export const saveAsGlobalAtom = atom<boolean>(false);

/**
 * Whether view is currently saving
 */
export const savingViewAtom = atom<boolean>(false);

// ============================================================================
// COLUMN MANAGEMENT MODALS STATE
// ============================================================================

/**
 * Whether the create column modal is open
 */
export const showCreateColumnModalAtom = atom<boolean>(false);

/**
 * Whether the edit columns modal is open
 */
export const showEditColumnsModalAtom = atom<boolean>(false);

/**
 * Whether the delete column modal is open
 */
export const showDeleteColumnModalAtom = atom<boolean>(false);

/**
 * Whether the view schema modal is open
 */
export const showViewSchemaModalAtom = atom<boolean>(false);

/**
 * Whether the edit single column modal is open
 */
export const showEditColumnModalAtom = atom<boolean>(false);

/**
 * New column name input
 */
export const newColumnNameAtom = atom<string>('');

/**
 * New column type selection
 */
export const newColumnTypeAtom = atom<string>('text');

/**
 * Column selected for deletion
 */
export const selectedColumnToDeleteAtom = atom<string>('');

/**
 * Whether schema is loading
 */
export const schemaLoadingAtom = atom<boolean>(false);

/**
 * Column key being edited
 */
export const editingColumnKeyAtom = atom<string | null>(null);

/**
 * Column name being edited
 */
export const editColumnNameAtom = atom<string>('');

/**
 * Column type being edited
 */
export const editColumnTypeAtom = atom<string>('');

// ============================================================================
// EXPORT MODAL STATE
// ============================================================================

/**
 * Whether the export modal is open
 */
export const showExportModalAtom = atom<boolean>(false);

/**
 * Export scope - visible columns or all
 */
export const exportScopeAtom = atom<'visible' | 'all'>('visible');

/**
 * Export format
 */
export const exportFormatAtom = atom<'csv' | 'excel' | 'pdf'>('csv');

// ============================================================================
// GLOBAL VIEWS MANAGER STATE
// ============================================================================

/**
 * Whether the global views manager is open
 */
export const showGlobalViewsManagerAtom = atom<boolean>(false);

// ============================================================================
// ACTION ATOMS FOR MODAL MANAGEMENT
// ============================================================================

/**
 * Reset all modal-related state
 */
export const resetModalStateAtom = atom(null, (get, set) => {
  // Bulk update
  set(showBulkUpdateModalAtom, false);
  set(bulkUpdateColumnAtom, '');
  set(bulkUpdateValueAtom, '');
  set(bulkUpdateSavingAtom, false);

  // Save view
  set(showSaveViewModalAtom, false);
  set(newViewNameAtom, '');
  set(saveAsGlobalAtom, false);
  set(savingViewAtom, false);

  // Column management
  set(showCreateColumnModalAtom, false);
  set(showEditColumnsModalAtom, false);
  set(showDeleteColumnModalAtom, false);
  set(showViewSchemaModalAtom, false);
  set(showEditColumnModalAtom, false);
  set(newColumnNameAtom, '');
  set(newColumnTypeAtom, 'text');
  set(selectedColumnToDeleteAtom, '');
  set(editingColumnKeyAtom, null);
  set(editColumnNameAtom, '');
  set(editColumnTypeAtom, '');

  // Export
  set(showExportModalAtom, false);
  set(exportScopeAtom, 'visible');
  set(exportFormatAtom, 'csv');

  // Merge
  set(showMergeModalAtom, false);
  set(mergeSelectedIdsAtom, []);

  // Global views
  set(showGlobalViewsManagerAtom, false);
});

/**
 * Open bulk update modal with selected rows
 */
export const openBulkUpdateModalAtom = atom(null, (get, set) => {
  set(showBulkUpdateModalAtom, true);
  set(bulkUpdateColumnAtom, '');
  set(bulkUpdateValueAtom, '');
});

/**
 * Open merge modal with selected rows
 */
export const openMergeModalAtom = atom(null, (get, set) => {
  const selectedRows = get(selectedRowsAtom);
  set(mergeSelectedIdsAtom, Array.from(selectedRows));
  set(showMergeModalAtom, true);
});

/**
 * Close merge modal and clear selection
 */
export const closeMergeModalAtom = atom(null, (get, set) => {
  set(showMergeModalAtom, false);
  set(mergeSelectedIdsAtom, []);
});
