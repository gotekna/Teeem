/**
 * Table Handlers Hook
 *
 * Provides core event handlers for table interactions:
 * - Column management (resize, hide, reorder, drag-drop)
 * - Search (input, toggle search all)
 * - Filtering (add, update, remove, clear)
 * - Sorting & Grouping (sort, group by, expand/collapse)
 * - Selection (row selection, select all, merge)
 * - Display helpers (sticky styles, auto-fit widths)
 *
 * Extracted from TeeemTableView to improve code organization and reusability.
 *
 * @see Phase 5 refactoring - Event Handler Hooks extraction
 */

import { useCallback } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import type { TableColumn, CascadeFilter, SortColumn } from '../../types';

export interface UseTableHandlersProps {
  /** All table columns */
  COLUMNS: TableColumn[];

  /** Set column widths state */
  setColumnWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>;

  /** Set visible columns state */
  setVisibleColumns: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;

  /** Set sort columns state */
  setSortColumns: React.Dispatch<React.SetStateAction<SortColumn[]>>;

  /** Set cascade filters state */
  setCascadeFilters: React.Dispatch<React.SetStateAction<CascadeFilter[]>>;

  /** Set show filters state */
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;

  /** Set filter panel open state */
  setFilterPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;

  /** Set group by columns */
  setGroupByColumns: (columns: string[]) => void;

  /** Set collapsed groups */
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Set<string>>>;

  /** Collapsed groups state */
  collapsedGroups: Set<string>;

  /** Set search value */
  setSearch: React.Dispatch<React.SetStateAction<string>>;

  /** Set search all columns */
  setSearchAllColumns: React.Dispatch<React.SetStateAction<boolean>>;

  /** Current search value */
  search: string;

  /** Search all columns flag */
  searchAllColumns: boolean;

  /** Server-side search callback (optional) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onServerSearch?: (search: string, searchAllOrMode?: any) => void;

  /** Set column order state */
  setColumnOrder: React.Dispatch<React.SetStateAction<string[]>>;

  /** Current column order */
  columnOrder: string[];

  /** Column widths */
  columnWidths: Record<string, number>;

  /** Visible columns */
  visibleColumns: Record<string, boolean>;

  /** Set selected rows */
  setSelectedRows: React.Dispatch<React.SetStateAction<Set<number | string>>>;

  /** Selected rows */
  selectedRows: Set<number | string>;

  /** All entries for selection */
  entries?: Array<{ id: number | string; [key: string]: unknown }>;

  /** Merge modal state setters (optional) */
  setShowMergeModal?: React.Dispatch<React.SetStateAction<boolean>>;
  setRowsToMerge?: React.Dispatch<React.SetStateAction<(number | string)[]>>;
}

export function useTableHandlers(props: UseTableHandlersProps) {
  const {
    COLUMNS,
    setColumnWidths,
    setVisibleColumns,
    setSortColumns,
    setCascadeFilters,
    setShowFilters,
    setFilterPanelOpen,
    setGroupByColumns,
    setCollapsedGroups,
    collapsedGroups,
    setSearch,
    setSearchAllColumns,
    search,
    searchAllColumns,
    onServerSearch,
    setColumnOrder,
    columnOrder,
    columnWidths,
    visibleColumns,
    setSelectedRows,
    selectedRows,
    entries = [],
    setShowMergeModal,
    setRowsToMerge,
  } = props;

  // ============================================================================
  // COLUMN MANAGEMENT
  // ============================================================================

  const getDefaultVisibleColumns = useCallback(
    () => {
      const defaults: Record<string, boolean> = {};
      COLUMNS.forEach((c) => {
        defaults[c.key] = c.defaultHidden !== true;
      });
      return defaults;
    },
    [COLUMNS]
  );

  const handleColumnResize = useCallback((key: string, width: number) => {
    setColumnWidths((prev) => ({ ...prev, [key]: width }));
     
  }, []);

  const hideColumn = useCallback((columnKey: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [columnKey]: false,
    }));
     
  }, []);

  const handleColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columnOrder.indexOf(String(active.id));
      const newIndex = columnOrder.indexOf(String(over.id));

      const newOrder = [...columnOrder];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, String(active.id));
      setColumnOrder(newOrder);
    }
  }, [columnOrder, setColumnOrder]);

  const reorderColumnToPosition = useCallback((columnKey: string, newPosition: number) => {
    const currentIndex = columnOrder.indexOf(columnKey);
    if (currentIndex === -1) return;

    const newOrder = [...columnOrder];
    newOrder.splice(currentIndex, 1);
    newOrder.splice(newPosition, 0, columnKey);
    setColumnOrder(newOrder);
  }, [columnOrder, setColumnOrder]);

  const getSortedColumnsForModal = useCallback(() => {
    const orderedColumns = columnOrder
      .map((key) => COLUMNS.find((c) => c.key === key))
      .filter(Boolean) as TableColumn[];

    const unmatchedColumns = COLUMNS.filter(
      (c) => !columnOrder.includes(c.key)
    );

    return [...orderedColumns, ...unmatchedColumns];
  }, [COLUMNS, columnOrder]);

  // ============================================================================
  // SEARCH
  // ============================================================================

  const handleSearchFromInput = useCallback(
    (value: string) => {
      setSearch(value);
      if (onServerSearch) {
        onServerSearch(value, searchAllColumns);
      }
    },
    [onServerSearch, searchAllColumns, setSearch]
  );

  const handleSearchAllChange = useCallback(
    (checked: boolean) => {
      setSearchAllColumns(checked);
      if (onServerSearch && search) {
        onServerSearch(search, checked);
      }
    },
    [onServerSearch, search, setSearchAllColumns]
  );

  // ============================================================================
  // SORTING
  // ============================================================================

  const handleSort = useCallback((columnKey: string) => {
    setSortColumns((prev) => {
      const existing = prev.find((s) => s.column === columnKey);
      if (existing) {
        if (existing.dir === "asc") {
          return prev.map((s) =>
            s.column === columnKey ? { ...s, dir: "desc" as const } : s
          );
        } else {
          return prev.filter((s) => s.column !== columnKey);
        }
      } else {
        return [...prev, { column: columnKey, dir: "asc" as const }];
      }
    });
     
  }, []);

  // ============================================================================
  // FILTERING
  // ============================================================================

  const addFilter = useCallback(() => {
    const firstColumn = COLUMNS.find(
      (c) => c.filterable !== false && c.key !== "select" && c.key !== "actions"
    );
    if (!firstColumn) return;

    setCascadeFilters((prev) => [
      ...prev,
      {
        id: `filter_${Date.now()}`,
        column: firstColumn.key,
        operator: "=",
        value: "",
        groupId: "default",
      },
    ]);
    setShowFilters(true);
     
  }, [COLUMNS]);

  const addFilterForColumn = useCallback((columnKey: string) => {
    setCascadeFilters((prev) => [
      ...prev,
      {
        id: `filter_${Date.now()}`,
        column: columnKey,
        operator: "=",
        value: "",
        groupId: "default",
      },
    ]);
    setFilterPanelOpen(true);
     
  }, []);

  const updateFilter = useCallback(
    (id: string | number, updates: Partial<CascadeFilter>) => {
      setCascadeFilters((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      );
    },
    [setCascadeFilters]
  );

  const removeFilter = useCallback((id: string | number) => {
    setCascadeFilters((prev) => prev.filter((f) => f.id !== id));
     
  }, []);

  const clearAllFilters = useCallback(() => {
    setCascadeFilters([]);
    setShowFilters(false);
     
  }, []);

  // ============================================================================
  // GROUPING
  // ============================================================================

  const handleGroupByColumn = useCallback((columnKey: string | null) => {
    setGroupByColumns(columnKey ? [columnKey] : []);
    setCollapsedGroups(new Set());
  }, [setGroupByColumns, setCollapsedGroups]);

  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
     
  }, []);

  const getAllGroupKeys = useCallback((
    groupedData: Map<string, Array<{ id: number | string; [key: string]: unknown }>>
  ) => {
    return Array.from(groupedData.keys());
  }, []);

  const expandAllGroups = useCallback(() => {
    setCollapsedGroups(new Set());
     
  }, []);

  const collapseAllGroups = useCallback(() => {
    setCollapsedGroups((prev) => {
      // This will be populated with actual group keys from the component
      return prev;
    });
     
  }, []);

  // ============================================================================
  // SELECTION
  // ============================================================================

  const toggleRowSelection = useCallback((id: number | string) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
     
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedRows.size === entries.length && entries.length > 0) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(entries.map((e) => e.id)));
    }
     
  }, [selectedRows.size, entries]);

  const handleMergeClick = useCallback((ids: (number | string)[]) => {
    setShowMergeModal?.(true);
    setRowsToMerge?.(ids);
  }, [setShowMergeModal, setRowsToMerge]);

  const handleMergeComplete = useCallback(() => {
    setShowMergeModal?.(false);
    setRowsToMerge?.([]);
    setSelectedRows(new Set());
     
  }, [setShowMergeModal, setRowsToMerge]);

  // ============================================================================
  // DISPLAY HELPERS
  // ============================================================================

  const getStickyColumnStyles = useCallback((columnKey: string, isHeader: boolean = false): React.CSSProperties => {
    if (columnKey === "select") {
      return {
        position: 'sticky',
        left: 0,
        zIndex: isHeader ? 20 : 10,
        background: isHeader ? 'hsl(40, 11%, 95%)' : 'white',
        boxShadow: '1px 0 0 #d4d4d4',
      };
    }
    if (columnKey === "actions") {
      return {
        position: 'sticky',
        right: 0,
        zIndex: isHeader ? 20 : 10,
        background: isHeader ? 'hsl(40, 11%, 95%)' : 'white',
        boxShadow: '-1px 0 0 #d4d4d4',
      };
    }
    return {};
  }, []);

  const calculateAutoFitWidths = useCallback(() => {
    const newWidths: Record<string, number> = {};
    const visibleCols = COLUMNS.filter((c) => visibleColumns[c.key]);

    visibleCols.forEach((col) => {
      // Base on column label length
      const headerLen = (col.label || col.key).length;
      // Estimate: 8px per character + padding
      const estimatedWidth = Math.max(100, Math.min(headerLen * 8 + 40, 400));
      newWidths[col.key] = estimatedWidth;
    });

    setColumnWidths((prev) => ({ ...prev, ...newWidths }));
     
  }, [COLUMNS, visibleColumns]);

  const getDisplayValue = useCallback((value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") {
      // Handle relation/lookup objects
      if ("name" in value) return String((value as { name: string }).name);
      if ("label" in value) return String((value as { label: string }).label);
      if ("display" in value) return String((value as { display: string }).display);
      // Handle arrays (multiple lookups)
      if (Array.isArray(value)) {
        return value.map((v) => {
          if (typeof v === "object" && v !== null) {
            if ("name" in v) return String((v as { name: string }).name);
            if ("label" in v) return String((v as { label: string }).label);
            if ("display" in v) return String((v as { display: string }).display);
          }
          return String(v);
        }).join(", ");
      }
      return JSON.stringify(value);
    }
    return String(value);
  }, []);

  return {
    // Column management
    getDefaultVisibleColumns,
    handleColumnResize,
    hideColumn,
    handleColumnDragEnd,
    reorderColumnToPosition,
    getSortedColumnsForModal,

    // Search
    handleSearchFromInput,
    handleSearchAllChange,

    // Sorting
    handleSort,

    // Filtering
    addFilter,
    addFilterForColumn,
    updateFilter,
    removeFilter,
    clearAllFilters,

    // Grouping
    handleGroupByColumn,
    toggleGroupCollapse,
    getAllGroupKeys,
    expandAllGroups,
    collapseAllGroups,

    // Selection
    toggleRowSelection,
    toggleSelectAll,
    handleMergeClick,
    handleMergeComplete,

    // Display helpers
    getStickyColumnStyles,
    calculateAutoFitWidths,
    getDisplayValue,
  };
}
