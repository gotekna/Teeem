"use client";

/**
 * TeeemTableView - The One Table Standard
 *
 * A comprehensive, feature-rich table component for TEEEM.
 * Ported from the React version (frontend/src/components/documentation/TeeemTableView.jsx)
 *
 * Features:
 * - Column sorting (single and multi-column)
 * - Column filtering (cascade filters with AND/OR logic)
 * - Column visibility and reordering
 * - Column resizing
 * - Row selection and bulk actions
 * - Saved views
 * - Inline editing
 * - Grouping
 * - Server-side search support
 * - Export/Import
 */

import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  memo,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  X,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Filter,
  Eye,
  EyeOff,
  GripVertical,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Check,
  MoreVertical,
  Upload,
  Download,
  Columns,
  Settings,
  Play,
  PlusCircle,
  MinusCircle,
  Loader2,
  Save,
  RotateCcw,
  Plus,
  Minus,
  AlertTriangle,
  Layers,
  Globe,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

import {
  type TableColumn,
  type TableRow as TableRowType,
  type SortColumn,
  type CascadeFilter,
  type FilterGroup,
  type SavedView,
  type TeeemTableViewProps,
  type VisibleColumnsState,
  type ColumnWidthsState,
  getSortDirectionLabel,
  STATUS_COLORS,
  SEVERITY_COLORS,
} from "./types";
import { getColumnTypeEmoji } from "@/lib/column-types";
import { DataHealthWidget } from "./DataHealthWidget";

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

// Isolated search input component - prevents parent re-renders on every keystroke
const SearchInput = memo(function SearchInput({
  onSearch,
  onSearchAllChange,
  searchAllColumns,
  serverSearchLoading,
  hasServerSearch,
}: {
  onSearch: (value: string) => void;
  onSearchAllChange: (checked: boolean) => void;
  searchAllColumns: boolean;
  serverSearchLoading: boolean;
  hasServerSearch: boolean;
}) {
  const [localValue, setLocalValue] = useState("");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalValue(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        onSearch(value);
      }, 300);
    },
    [onSearch]
  );

  const handleClear = useCallback(() => {
    setLocalValue("");
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    onSearch("");
  }, [onSearch]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="relative flex-1 max-w-md">
        {serverSearchLoading ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
        <Input
          type="text"
          value={localValue}
          onChange={handleChange}
          placeholder={
            hasServerSearch ? "Search all records..." : "Search across all fields..."
          }
          className="pl-9 pr-9"
        />
        {localValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {hasServerSearch && (
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-muted-foreground">
          <Checkbox
            checked={searchAllColumns}
            onCheckedChange={(checked) => onSearchAllChange(checked === true)}
          />
          <span className="whitespace-nowrap">Search all columns</span>
        </label>
      )}
    </div>
  );
});

// Column header with resize handle and dropdown menu
const ResizableColumnHeader = memo(function ResizableColumnHeader({
  column,
  width,
  onResize,
  onSort,
  onHide,
  onGroupBy,
  onAddFilter,
  sortInfo,
  isGroupedBy,
  children,
}: {
  column: TableColumn;
  width: number;
  onResize: (key: string, width: number) => void;
  onSort: (key: string) => void;
  onHide: (key: string) => void;
  onGroupBy: (key: string | null) => void;
  onAddFilter: (key: string) => void;
  sortInfo?: SortColumn;
  isGroupedBy: boolean;
  children: React.ReactNode;
}) {
  const [isResizing, setIsResizing] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;
    },
    [width]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(50, startWidthRef.current + diff);
      onResize(column.key, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, column.key, onResize]);

  // Determine sort direction labels based on column type
  const getSortLabel = (dir: "asc" | "desc") => {
    const numericTypes = ["number", "whole_number", "currency", "percentage", "computed"];
    if (column.column_type && numericTypes.includes(column.column_type)) {
      return dir === "asc" ? "Sort 1 → 9" : "Sort 9 → 1";
    }
    const dateTypes = ["date", "date_and_time"];
    if (column.column_type && dateTypes.includes(column.column_type)) {
      return dir === "asc" ? "Sort Old → New" : "Sort New → Old";
    }
    if (column.column_type === "boolean") {
      return dir === "asc" ? "Sort ☐ → ☑" : "Sort ☑ → ☐";
    }
    return dir === "asc" ? "Sort A → Z" : "Sort Z → A";
  };

  return (
    <div
      className="flex items-center justify-between group relative"
      style={{ width }}
    >
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-1 flex-1 min-w-0 cursor-pointer hover:text-foreground",
              sortInfo && "text-primary"
            )}
          >
            {children}
            {sortInfo && (
              sortInfo.dir === "asc" ? (
                <ArrowUp className="h-3 w-3 shrink-0 text-primary" />
              ) : (
                <ArrowDown className="h-3 w-3 shrink-0 text-primary" />
              )
            )}
            {isGroupedBy && (
              <Layers className="h-3 w-3 shrink-0 text-purple-500" />
            )}
            <ChevronDown className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {/* Sort options */}
          {column.sortable !== false && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  onSort(column.key);
                  setDropdownOpen(false);
                }}
                className={cn(sortInfo?.dir === "asc" && "bg-muted")}
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                {getSortLabel("asc")}
                {sortInfo?.dir === "asc" && <Check className="h-4 w-4 ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  // If already asc, click again to go desc
                  if (sortInfo?.dir === "asc") {
                    onSort(column.key);
                  } else if (!sortInfo) {
                    // Sort asc first, then desc
                    onSort(column.key);
                    onSort(column.key);
                  }
                  setDropdownOpen(false);
                }}
                className={cn(sortInfo?.dir === "desc" && "bg-muted")}
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                {getSortLabel("desc")}
                {sortInfo?.dir === "desc" && <Check className="h-4 w-4 ml-auto" />}
              </DropdownMenuItem>
              {sortInfo && (
                <DropdownMenuItem
                  onClick={() => {
                    // Clear sort by clicking until removed
                    if (sortInfo.dir === "asc") {
                      onSort(column.key); // asc -> desc
                      onSort(column.key); // desc -> removed
                    } else {
                      onSort(column.key); // desc -> removed
                    }
                    setDropdownOpen(false);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear Sort
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}

          {/* Filter option */}
          {column.filterable !== false && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  onAddFilter(column.key);
                  setDropdownOpen(false);
                }}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filter by this column
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}

          {/* Group by option */}
          <DropdownMenuItem
            onClick={() => {
              onGroupBy(isGroupedBy ? null : column.key);
              setDropdownOpen(false);
            }}
            className={cn(isGroupedBy && "bg-muted")}
          >
            <Layers className="h-4 w-4 mr-2" />
            {isGroupedBy ? "Remove Grouping" : "Group by this column"}
            {isGroupedBy && <Check className="h-4 w-4 ml-auto" />}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Hide column */}
          <DropdownMenuItem
            onClick={() => {
              onHide(column.key);
              setDropdownOpen(false);
            }}
          >
            <EyeOff className="h-4 w-4 mr-2" />
            Hide column
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {column.resizable !== false && (
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize opacity-0 group-hover:opacity-100 bg-border hover:bg-primary transition-opacity",
            isResizing && "opacity-100 bg-primary"
          )}
          onMouseDown={handleMouseDown}
        />
      )}
    </div>
  );
});

// Cascade filter item
const CascadeFilterItem = memo(function CascadeFilterItem({
  filter,
  columns,
  onUpdate,
  onRemove,
}: {
  filter: CascadeFilter;
  columns: TableColumn[];
  onUpdate: (id: string | number, updates: Partial<CascadeFilter>) => void;
  onRemove: (id: string | number) => void;
}) {
  const column = columns.find((c) => c.key === filter.column);

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <Select
        value={filter.column}
        onValueChange={(value) => onUpdate(filter.id, { column: value })}
      >
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue placeholder="Column" />
        </SelectTrigger>
        <SelectContent>
          {columns
            .filter((c) => c.filterable !== false && c.key !== "select" && c.key !== "actions")
            .map((col) => (
              <SelectItem key={col.key} value={col.key}>
                {col.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Select
        value={filter.operator}
        onValueChange={(value) => onUpdate(filter.id, { operator: value as CascadeFilter["operator"] })}
      >
        <SelectTrigger className="w-[100px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="=">equals</SelectItem>
          <SelectItem value="!=">not equals</SelectItem>
          <SelectItem value="contains">contains</SelectItem>
          <SelectItem value="not_contains">not contains</SelectItem>
          <SelectItem value="starts_with">starts with</SelectItem>
          <SelectItem value="ends_with">ends with</SelectItem>
          <SelectItem value="is_empty">is empty</SelectItem>
          <SelectItem value="is_not_empty">is not empty</SelectItem>
          {column?.column_type && ["number", "currency", "percentage", "date"].includes(column.column_type) && (
            <>
              <SelectItem value=">">greater than</SelectItem>
              <SelectItem value="<">less than</SelectItem>
              <SelectItem value=">=">greater or equal</SelectItem>
              <SelectItem value="<=">less or equal</SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      {!["is_empty", "is_not_empty"].includes(filter.operator) && (
        <Input
          className="flex-1 h-8"
          value={String(filter.value || "")}
          onChange={(e) => onUpdate(filter.id, { value: e.target.value })}
          placeholder="Value..."
        />
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onRemove(filter.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
});

// Default columns for generic tables
const DEFAULT_COLUMNS: TableColumn[] = [
  { key: "select", label: "", resizable: false, sortable: false, filterable: false, width: 40 },
  { key: "id", label: "ID", resizable: true, sortable: true, filterable: true, width: 80 },
  { key: "actions", label: "Actions", resizable: false, sortable: false, filterable: false, width: 100 },
];

// Filter operators for display
const FILTER_OPERATOR_LABELS: Record<string, string> = {
  "=": "equals",
  "!=": "not equals",
  ">": ">",
  "<": "<",
  ">=": ">=",
  "<=": "<=",
  "contains": "contains",
  "not_contains": "not contains",
  "starts_with": "starts with",
  "ends_with": "ends with",
  "is_empty": "is empty",
  "is_not_empty": "is not empty",
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TeeemTableView({
  entries = [],
  columns = null,
  foundationId = "default",
  foundationIdNumeric = null,
  tableName = "Table",
  onEdit,
  onDelete,
  onBulkDelete,
  onView,
  onRowDoubleClick,
  onRowUpdate,
  onColumnUpdate,
  onEditRelationships,
  onRefresh,
  enableImport = false,
  enableExport = false,
  onImport,
  onExport,
  enableSchemaEditor = false,
  customActions,
  customCellRenderer,
  extraRowProps,
  viewOnly = false,
  preloadedViews = null,
  hideUpdateViewButton = false,
  initialGroupByColumn = null,
  onServerSearch,
  serverSearchLoading = false,
  onViewApiParamsChange,
  loadingMore = false,
  showDataHealth = false,
  onDataHealthIssueClick,
  stats,
  category,
}: TeeemTableViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Use custom columns if provided, otherwise use defaults
  const COLUMNS = useMemo(() => columns || DEFAULT_COLUMNS, [columns]);

  // Initialize default column state
  const DEFAULT_COLUMN_WIDTHS = useMemo(
    () =>
      COLUMNS.reduce((acc, col) => {
        acc[col.key] = col.width || 150;
        return acc;
      }, {} as ColumnWidthsState),
    [COLUMNS]
  );

  const DEFAULT_COLUMN_ORDER = useMemo(() => COLUMNS.map((c) => c.key), [COLUMNS]);

  const getDefaultVisibleColumns = useCallback(
    () =>
      COLUMNS.reduce((acc, col) => {
        acc[col.key] = true;
        return acc;
      }, {} as VisibleColumnsState),
    [COLUMNS]
  );

  // ============================================================================
  // STATE
  // ============================================================================

  const [search, setSearch] = useState("");
  const [searchAllColumns, setSearchAllColumns] = useState(false);
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const [columnWidths, setColumnWidths] = useState<ColumnWidthsState>(DEFAULT_COLUMN_WIDTHS);
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumnsState>(getDefaultVisibleColumns);
  const [selectedRows, setSelectedRows] = useState<Set<number | string>>(new Set());
  const [cascadeFilters, setCascadeFilters] = useState<CascadeFilter[]>([]);
  // Defensive: ensure cascadeFilters is always an array for .map/.length calls
  const safeFilters = useMemo(() => Array.isArray(cascadeFilters) ? cascadeFilters : [], [cascadeFilters]);
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([{ id: "default", logic: "AND" }]);
  const [interGroupLogic, setInterGroupLogic] = useState<"AND" | "OR">("OR");
  const [showFilters, setShowFilters] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<number | string | null>(null);
  const [groupByColumn, setGroupByColumn] = useState<string | null>(initialGroupByColumn);
  const [groupByColumns, setGroupByColumns] = useState<string[]>(
    initialGroupByColumn ? [initialGroupByColumn] : []
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [editingRowId, setEditingRowId] = useState<number | string | null>(null);
  const [editingData, setEditingData] = useState<Record<string, unknown>>({});

  // Filter panel state
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Bulk update modal state
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdateColumn, setBulkUpdateColumn] = useState("");
  const [bulkUpdateValue, setBulkUpdateValue] = useState("");
  const [bulkUpdateSaving, setBulkUpdateSaving] = useState(false);

  // Save view modal state
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [saveAsGlobal, setSaveAsGlobal] = useState(false);
  const [savingView, setSavingView] = useState(false);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  // Search handler
  const handleSearchFromInput = useCallback(
    (value: string) => {
      setSearch(value);
      if (onServerSearch) {
        onServerSearch(value, searchAllColumns);
      }
    },
    [onServerSearch, searchAllColumns]
  );

  const handleSearchAllChange = useCallback(
    (checked: boolean) => {
      setSearchAllColumns(checked);
      if (onServerSearch && search) {
        onServerSearch(search, checked);
      }
    },
    [onServerSearch, search]
  );

  // Column resize handler
  const handleColumnResize = useCallback((key: string, width: number) => {
    setColumnWidths((prev) => ({ ...prev, [key]: width }));
  }, []);

  // Sort handler
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

  // Filter handlers
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
  }, [COLUMNS]);

  // Add filter for specific column (from column header dropdown)
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
    setFilterPanelOpen(true); // Open the filter panel so user can set the value
  }, []);

  // Hide a column
  const hideColumn = useCallback((columnKey: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [columnKey]: false,
    }));
  }, []);

  // Set group by column
  const handleGroupByColumn = useCallback((columnKey: string | null) => {
    setGroupByColumn(columnKey);
    setGroupByColumns(columnKey ? [columnKey] : []);
  }, []);

  const updateFilter = useCallback(
    (id: string | number, updates: Partial<CascadeFilter>) => {
      setCascadeFilters((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
      );
    },
    []
  );

  const removeFilter = useCallback((id: string | number) => {
    setCascadeFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const clearAllFilters = useCallback(() => {
    setCascadeFilters([]);
    setActiveViewId(null);
  }, []);

  // Row selection handlers
  const toggleRowSelection = useCallback((id: number | string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedRows.size === filteredAndSortedEntries.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredAndSortedEntries.map((e) => e.id)));
    }
  }, [selectedRows.size]);

  // Group handlers
  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  // Inline editing handlers
  const startEditing = useCallback((row: TableRowType) => {
    setEditingRowId(row.id);
    setEditingData({ ...row });
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingRowId(null);
    setEditingData({});
  }, []);

  const saveEditing = useCallback(async () => {
    if (!editingRowId || !onRowUpdate) return;

    try {
      // Call onRowUpdate for each changed field
      const originalRow = entries.find((e) => e.id === editingRowId);
      if (!originalRow) return;

      for (const [key, value] of Object.entries(editingData)) {
        if (originalRow[key] !== value) {
          await onRowUpdate(editingRowId, key, value);
        }
      }

      setEditingRowId(null);
      setEditingData({});
    } catch (error) {
      console.error("Failed to save:", error);
    }
  }, [editingRowId, editingData, entries, onRowUpdate]);

  // Bulk update handler
  const handleBulkUpdate = useCallback(async () => {
    if (!bulkUpdateColumn || selectedRows.size === 0) return;

    setBulkUpdateSaving(true);
    try {
      const ids = Array.from(selectedRows);
      if (onRowUpdate) {
        for (const id of ids) {
          await onRowUpdate(id, bulkUpdateColumn, bulkUpdateValue);
        }
      }

      setShowBulkUpdateModal(false);
      setBulkUpdateColumn("");
      setBulkUpdateValue("");
      setSelectedRows(new Set());
      onRefresh?.();
    } catch (error) {
      console.error("Bulk update failed:", error);
    } finally {
      setBulkUpdateSaving(false);
    }
  }, [bulkUpdateColumn, bulkUpdateValue, selectedRows, onRowUpdate, onRefresh]);

  // ============================================================================
  // SAVED VIEWS
  // ============================================================================

  // Load saved views
  useEffect(() => {
    const loadSavedViews = async () => {
      if (!foundationIdNumeric) return;

      try {
        let data;
        if (preloadedViews && preloadedViews.length > 0) {
          const firstViewTableId = preloadedViews[0]?.foundation_id;
          if (firstViewTableId === foundationIdNumeric) {
            data = { success: true, views: preloadedViews };
          } else {
            data = await api.get<{ success: boolean; views: SavedView[] }>(
              `/api/v1/foundation_views`,
              { params: { foundation_id: foundationIdNumeric } }
            );
          }
        } else {
          data = await api.get<{ success: boolean; views: SavedView[] }>(
            `/api/v1/foundation_views`,
            { params: { foundation_id: foundationIdNumeric } }
          );
        }

        if (data.success && data.views) {
          setSavedViews(data.views);

          // Auto-apply default view - prioritize global views, then display_order
          // Views are already sorted from API: global first, then by display_order
          if (!activeViewId && data.views.length > 0) {
            // Find the best default: first check for explicit isDefault, then first global, then first by display_order
            const defaultView =
              data.views.find((v: SavedView) => v.isDefault && v.is_global) ||
              data.views.find((v: SavedView) => v.isDefault) ||
              data.views.find((v: SavedView) => v.is_global && v.display_order === 0) ||
              data.views.find((v: SavedView) => v.display_order === 0) ||
              data.views[0]; // Fallback to first view

            if (defaultView) {
              loadViewState(defaultView);
            }
          }
        }
      } catch (error) {
        console.error("Error loading saved views:", error);
      }
    };

    loadSavedViews();
  }, [foundationIdNumeric, preloadedViews]);

  // Load view state helper
  const loadViewState = useCallback(
    (view: SavedView) => {
      // Helper to ensure filters have unique ids
      const ensureFilterIds = (filters: CascadeFilter[]) =>
        filters.map((f, idx) => ({
          ...f,
          id: f.id || `filter_${Date.now()}_${idx}`,
        }));

      // Handle filters - may be array (legacy) or object with cascadeFilters (current)
      if (view.filters) {
        if (Array.isArray(view.filters)) {
          setCascadeFilters(ensureFilterIds(view.filters));
        } else if (typeof view.filters === 'object' && view.filters !== null) {
          // New format: filters is an object containing cascadeFilters
          const filtersObj = view.filters as { cascadeFilters?: CascadeFilter[]; filterGroups?: FilterGroup[]; interGroupLogic?: "AND" | "OR" };
          if (Array.isArray(filtersObj.cascadeFilters)) {
            setCascadeFilters(ensureFilterIds(filtersObj.cascadeFilters));
          }
          if (Array.isArray(filtersObj.filterGroups)) {
            setFilterGroups(filtersObj.filterGroups);
          }
          if (filtersObj.interGroupLogic) {
            setInterGroupLogic(filtersObj.interGroupLogic);
          }
        }
      }
      // Legacy support for separate filterGroups field
      if (view.filterGroups) {
        setFilterGroups(view.filterGroups);
      }
      if (view.interGroupLogic) {
        setInterGroupLogic(view.interGroupLogic);
      }
      if (view.visibleColumns) {
        setVisibleColumns(view.visibleColumns);
      }
      if (view.columnOrder) {
        setColumnOrder(view.columnOrder);
      }
      if (view.columnWidths) {
        setColumnWidths((prev) => ({ ...prev, ...view.columnWidths }));
      }
      if (view.sortColumns) {
        setSortColumns(view.sortColumns);
      }
      if (view.groupByColumns) {
        setGroupByColumns(view.groupByColumns);
        setGroupByColumn(view.groupByColumns[0] || null);
      } else if (view.groupByColumn) {
        setGroupByColumn(view.groupByColumn);
        setGroupByColumns(view.groupByColumn ? [view.groupByColumn] : []);
      }
      if (view.showFilters !== undefined) {
        setShowFilters(view.showFilters);
      }
      if (view.id) {
        setActiveViewId(view.id);
      }

      // Handle apiParams for server-side filtering
      if (view.filters && onViewApiParamsChange) {
        onViewApiParamsChange(null);
      }
    },
    [onViewApiParamsChange]
  );

  // Save current state as new view
  const saveNewView = useCallback(async () => {
    if (!newViewName.trim() || !foundationIdNumeric) return;

    setSavingView(true);
    try {
      const viewData = {
        name: newViewName.trim(),
        foundation_id: foundationIdNumeric,
        filters: {
          cascadeFilters,
          filterGroups,
          interGroupLogic,
        },
        columns: {
          visible: visibleColumns,
          order: columnOrder,
          widths: columnWidths,
        },
        sort_order: sortColumns,
        group_by_columns: groupByColumns,
      };

      let response;
      if (saveAsGlobal) {
        // Use the global save endpoint
        response = await api.post<{ success: boolean; view: SavedView }>(
          "/api/v1/foundation_views/save_global",
          viewData
        );
      } else {
        // Regular personal view save
        response = await api.post<{ success: boolean; view: SavedView }>(
          "/api/v1/foundation_views",
          viewData
        );
      }

      if (response?.success && response.view) {
        // Insert global views at the beginning, personal views at the end
        if (saveAsGlobal) {
          setSavedViews((prev) => [response.view, ...prev]);
        } else {
          setSavedViews((prev) => [...prev, response.view]);
        }
        setActiveViewId(response.view.id);
        setNewViewName("");
        setSaveAsGlobal(false);
        setShowSaveViewModal(false);
      }
    } catch (error) {
      console.error("Failed to save view:", error);
    } finally {
      setSavingView(false);
    }
  }, [
    newViewName,
    foundationIdNumeric,
    cascadeFilters,
    filterGroups,
    interGroupLogic,
    visibleColumns,
    columnOrder,
    columnWidths,
    sortColumns,
    groupByColumns,
    saveAsGlobal,
  ]);

  // ============================================================================
  // FILTERING & SORTING
  // ============================================================================

  // Evaluate a single filter against an entry
  const evaluateFilter = useCallback(
    (entry: TableRowType, filter: CascadeFilter): boolean => {
      const value = entry[filter.column];
      const filterValue = filter.value;

      switch (filter.operator) {
        case "=":
          return value == filterValue;
        case "!=":
          return value != filterValue;
        case ">":
          return Number(value) > Number(filterValue);
        case "<":
          return Number(value) < Number(filterValue);
        case ">=":
          return Number(value) >= Number(filterValue);
        case "<=":
          return Number(value) <= Number(filterValue);
        case "contains":
          return String(value ?? "")
            .toLowerCase()
            .includes(String(filterValue).toLowerCase());
        case "not_contains":
          return !String(value ?? "")
            .toLowerCase()
            .includes(String(filterValue).toLowerCase());
        case "starts_with":
          return String(value ?? "")
            .toLowerCase()
            .startsWith(String(filterValue).toLowerCase());
        case "ends_with":
          return String(value ?? "")
            .toLowerCase()
            .endsWith(String(filterValue).toLowerCase());
        case "is_empty":
          return value == null || value === "";
        case "is_not_empty":
          return value != null && value !== "";
        default:
          return true;
      }
    },
    []
  );

  // Filter and sort entries
  const filteredAndSortedEntries = useMemo(() => {
    let result = [...entries];

    // Apply search filter (client-side if no server search)
    if (search && !onServerSearch) {
      const searchLower = search.toLowerCase();
      result = result.filter((entry) => {
        return COLUMNS.some((col) => {
          if (col.key === "select" || col.key === "actions") return false;
          const value = entry[col.key];
          if (value == null) return false;
          return String(value).toLowerCase().includes(searchLower);
        });
      });
    }

    // Apply cascade filters
    if (safeFilters.length > 0) {
      result = result.filter((entry) => {
        // Group filters by groupId
        const filtersByGroup = safeFilters.reduce((acc, filter) => {
          const groupId = filter.groupId || "default";
          if (!acc[groupId]) acc[groupId] = [];
          acc[groupId].push(filter);
          return acc;
        }, {} as Record<string, CascadeFilter[]>);

        // Evaluate each group
        const groupResults = Object.entries(filtersByGroup).map(
          ([groupId, filters]) => {
            const group = filterGroups.find((g) => g.id === groupId) || {
              logic: "AND",
            };

            if (group.logic === "AND") {
              return filters.every((filter) => evaluateFilter(entry, filter));
            } else {
              return filters.some((filter) => evaluateFilter(entry, filter));
            }
          }
        );

        // Combine group results
        if (interGroupLogic === "AND") {
          return groupResults.every(Boolean);
        } else {
          return groupResults.some(Boolean);
        }
      });
    }

    // Apply sorting
    if (sortColumns.length > 0) {
      result.sort((a, b) => {
        for (const { column, dir } of sortColumns) {
          const aVal = a[column];
          const bVal = b[column];

          if (aVal == null && bVal == null) continue;
          if (aVal == null) return dir === "asc" ? 1 : -1;
          if (bVal == null) return dir === "asc" ? -1 : 1;

          let comparison = 0;
          if (typeof aVal === "number" && typeof bVal === "number") {
            comparison = aVal - bVal;
          } else {
            comparison = String(aVal).localeCompare(String(bVal));
          }

          if (comparison !== 0) {
            return dir === "asc" ? comparison : -comparison;
          }
        }
        return 0;
      });
    }

    return result;
  }, [
    entries,
    search,
    onServerSearch,
    COLUMNS,
    cascadeFilters,
    filterGroups,
    interGroupLogic,
    sortColumns,
    evaluateFilter,
  ]);

  // Group entries if grouping is enabled
  const groupedEntries = useMemo(() => {
    if (!groupByColumn || groupByColumns.length === 0) {
      return null;
    }

    const groups: Record<string, TableRowType[]> = {};
    for (const entry of filteredAndSortedEntries) {
      const groupKey = String(entry[groupByColumn] ?? "No Value");
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(entry);
    }

    return groups;
  }, [filteredAndSortedEntries, groupByColumn, groupByColumns]);

  // Get visible columns in order
  const visibleColumnsInOrder = useMemo(() => {
    return columnOrder
      .filter((key) => visibleColumns[key] === true)
      .map((key) => COLUMNS.find((c) => c.key === key))
      .filter((col): col is TableColumn => col !== undefined);
  }, [columnOrder, visibleColumns, COLUMNS]);

  // ============================================================================
  // CELL RENDERING
  // ============================================================================

  const renderCellValue = useCallback(
    (entry: TableRowType, column: TableColumn) => {
      // Check for custom renderer first
      if (customCellRenderer) {
        const custom = customCellRenderer(entry, column.key);
        if (custom !== null) return custom;
      }

      const value = entry[column.key];
      const isEditing = editingRowId === entry.id;

      // Handle special column types
      switch (column.key) {
        case "select":
          return (
            <Checkbox
              checked={selectedRows.has(entry.id)}
              onCheckedChange={() => toggleRowSelection(entry.id)}
            />
          );

        case "actions":
          if (isEditing) {
            return (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={saveEditing}>
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button variant="ghost" size="sm" onClick={cancelEditing}>
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            );
          }
          return (
            <div className="flex items-center gap-1">
              {onView && (
                <Button variant="ghost" size="sm" onClick={() => onView(entry)}>
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              {!viewOnly && onEdit && (
                <Button variant="ghost" size="sm" onClick={() => onEdit(entry)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {!viewOnly && onRowUpdate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEditing(entry)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
              {!viewOnly && onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(entry)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
      }

      // Inline editing mode
      if (isEditing && column.key !== "id") {
        return (
          <Input
            className="h-7 text-sm"
            value={String(editingData[column.key] ?? "")}
            onChange={(e) =>
              setEditingData((prev) => ({
                ...prev,
                [column.key]: e.target.value,
              }))
            }
          />
        );
      }

      // Handle null/undefined
      if (value == null) {
        return <span className="text-muted-foreground">-</span>;
      }

      // Handle boolean
      if (typeof value === "boolean") {
        return value ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground" />
        );
      }

      // Handle currency
      if (column.column_type === "currency" && typeof value === "number") {
        return `$${value.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`;
      }

      // Handle percentage
      if (column.column_type === "percentage" && typeof value === "number") {
        return `${value}%`;
      }

      // Handle date
      if (column.column_type === "date" && value) {
        try {
          const date = new Date(value as string);
          return date.toLocaleDateString("en-AU");
        } catch {
          return String(value);
        }
      }

      // Handle date_and_time
      if (column.column_type === "date_and_time" && value) {
        try {
          const date = new Date(value as string);
          return date.toLocaleString("en-AU");
        } catch {
          return String(value);
        }
      }

      // Handle choice/status with badge
      if (
        column.column_type === "choice" ||
        column.key === "status" ||
        column.key === "stage" ||
        column.key === "job_status" ||
        column.key === "job_type"
      ) {
        const colorClass =
          STATUS_COLORS[String(value).toLowerCase()] ||
          SEVERITY_COLORS[String(value).toLowerCase()] ||
          "bg-secondary text-secondary-foreground";
        return (
          <Badge variant="secondary" className={cn(colorClass)}>
            {String(value)}
          </Badge>
        );
      }

      // Default: render as string (truncated if too long)
      const strValue = String(value);
      if (strValue.length > 100) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate block max-w-[200px]">
                  {strValue.slice(0, 100)}...
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-md">
                <p className="whitespace-pre-wrap">{strValue}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }
      return strValue;
    },
    [
      customCellRenderer,
      editingRowId,
      editingData,
      selectedRows,
      toggleRowSelection,
      onView,
      onEdit,
      onDelete,
      onRowUpdate,
      viewOnly,
      startEditing,
      saveEditing,
      cancelEditing,
    ]
  );

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================

  // Render table header
  const renderTableHeader = () => (
    <TableHeader>
      <TableRow>
        {visibleColumnsInOrder.map((column) => (
          <TableHead
            key={column.key}
            style={{ width: columnWidths[column.key], minWidth: column.minWidth || 50 }}
            className="relative"
          >
            {column.key === "select" ? (
              <Checkbox
                checked={
                  selectedRows.size === filteredAndSortedEntries.length &&
                  filteredAndSortedEntries.length > 0
                }
                onCheckedChange={toggleSelectAll}
              />
            ) : column.key === "actions" ? (
              <span className="truncate">{column.label}</span>
            ) : (
              <ResizableColumnHeader
                column={column}
                width={columnWidths[column.key]}
                onResize={handleColumnResize}
                onSort={handleSort}
                onHide={hideColumn}
                onGroupBy={handleGroupByColumn}
                onAddFilter={addFilterForColumn}
                sortInfo={sortColumns.find((s) => s.column === column.key)}
                isGroupedBy={groupByColumn === column.key}
              >
                <span className="truncate">{column.label}</span>
              </ResizableColumnHeader>
            )}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );

  // Render grouped table
  const renderGroupedTable = () => {
    if (!groupedEntries) return null;

    return (
      <div className="space-y-2">
        {Object.entries(groupedEntries).map(([groupKey, groupRows]) => {
          const isCollapsed = collapsedGroups.has(groupKey);
          const groupColumn = COLUMNS.find((c) => c.key === groupByColumn);

          return (
            <div key={groupKey} className="border rounded-lg overflow-hidden">
              <button
                onClick={() => toggleGroupCollapse(groupKey)}
                className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span className="font-medium">
                    {groupColumn?.label || groupByColumn}: {groupKey}
                  </span>
                  <Badge variant="secondary">{groupRows.length} rows</Badge>
                </div>
              </button>

              {!isCollapsed && (
                <Table>
                  {renderTableHeader()}
                  <TableBody>
                    {groupRows.map((row) => (
                      <TableRow
                        key={row.id}
                        className={cn(
                          selectedRows.has(row.id) && "bg-muted/50",
                          "hover:bg-muted/30 cursor-pointer"
                        )}
                        onDoubleClick={() => onRowDoubleClick?.(row)}
                      >
                        {visibleColumnsInOrder.map((column) => (
                          <TableCell
                            key={column.key}
                            style={{ width: columnWidths[column.key] }}
                          >
                            {renderCellValue(row, column)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render flat table
  const renderFlatTable = () => (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        {renderTableHeader()}
        <TableBody>
          {filteredAndSortedEntries.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={visibleColumnsInOrder.length}
                className="h-24 text-center text-muted-foreground"
              >
                No records found.
              </TableCell>
            </TableRow>
          ) : (
            filteredAndSortedEntries.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  selectedRows.has(row.id) && "bg-muted/50",
                  editingRowId === row.id && "bg-blue-50 dark:bg-blue-950/20",
                  "hover:bg-muted/30 cursor-pointer"
                )}
                onDoubleClick={() =>
                  editingRowId !== row.id && onRowDoubleClick?.(row)
                }
              >
                {visibleColumnsInOrder.map((column) => (
                  <TableCell
                    key={column.key}
                    style={{ width: columnWidths[column.key] }}
                  >
                    {renderCellValue(row, column)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  // Get active view name
  const activeView = savedViews.find((v) => v.id === activeViewId);

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Data Health Widget */}
      {showDataHealth && foundationIdNumeric && (
        <DataHealthWidget
          foundationId={foundationIdNumeric}
          compact
          onIssueClick={onDataHealthIssueClick}
          onDataChanged={onRefresh}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Search */}
        <SearchInput
          onSearch={handleSearchFromInput}
          onSearchAllChange={handleSearchAllChange}
          searchAllColumns={searchAllColumns}
          serverSearchLoading={serverSearchLoading}
          hasServerSearch={!!onServerSearch}
        />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Custom actions */}
          {customActions}

          {/* Saved Views */}
          {savedViews.length > 0 && (
            <div className="flex items-center gap-1">
              {savedViews.slice(0, 5).map((view) => (
                <TooltipProvider key={view.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={activeViewId === view.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => loadViewState(view)}
                        className={cn(
                          view.is_global && "border-blue-300 dark:border-blue-700"
                        )}
                      >
                        {view.is_global && (
                          <Globe className="h-3 w-3 mr-1 text-blue-500" />
                        )}
                        {view.name}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {view.is_global ? "Global view (visible to all users)" : "Personal view"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          )}

          {/* Filter button */}
          <Sheet open={filterPanelOpen} onOpenChange={setFilterPanelOpen} modal={false}>
            <SheetTrigger asChild>
              <Button
                variant={safeFilters.length > 0 ? "default" : "outline"}
                size="sm"
              >
                <Filter className="h-4 w-4 mr-1" />
                Filters
                {safeFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {safeFilters.length}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
                <SheetDescription>
                  Add filters to narrow down your results
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {safeFilters.map((filter) => (
                  <CascadeFilterItem
                    key={filter.id}
                    filter={filter}
                    columns={COLUMNS}
                    onUpdate={updateFilter}
                    onRemove={removeFilter}
                  />
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={addFilter}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Filter
                </Button>

                {safeFilters.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllFilters}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Clear All
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setShowSaveViewModal(true)}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save as View
                      </Button>
                    </div>
                  </>
                )}

                {/* Group By */}
                <Separator />
                <div className="space-y-2">
                  <Label>Group By</Label>
                  <Select
                    value={groupByColumn || "none"}
                    onValueChange={(value) => {
                      if (value === "none") {
                        setGroupByColumn(null);
                        setGroupByColumns([]);
                      } else {
                        setGroupByColumn(value);
                        setGroupByColumns([value]);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No grouping" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No grouping</SelectItem>
                      {COLUMNS.filter(
                        (c) =>
                          c.key !== "select" &&
                          c.key !== "actions" &&
                          c.key !== "id"
                      ).map((col) => (
                        <SelectItem key={col.key} value={col.key}>
                          {col.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Columns dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns className="h-4 w-4 mr-1" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 max-h-80 overflow-auto"
            >
              {COLUMNS.filter(
                (col) => col.key !== "select" && col.key !== "actions"
              ).map((column) => (
                <DropdownMenuItem
                  key={column.key}
                  onClick={() =>
                    setVisibleColumns((prev) => ({
                      ...prev,
                      [column.key]: !prev[column.key],
                    }))
                  }
                >
                  <Checkbox
                    checked={visibleColumns[column.key] === true}
                    className="mr-2"
                  />
                  {column.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {enableExport && (
                <DropdownMenuItem onClick={onExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </DropdownMenuItem>
              )}
              {enableImport && (
                <DropdownMenuItem onClick={onImport}>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </DropdownMenuItem>
              )}
              {(enableExport || enableImport) && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={onRefresh}>
                <Play className="h-4 w-4 mr-2" />
                Refresh
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Active filters display */}
      {safeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Filters:</span>
          {safeFilters.map((filter) => {
            const col = COLUMNS.find((c) => c.key === filter.column);
            return (
              <Badge
                key={filter.id}
                variant="secondary"
                className="gap-1 pl-2"
              >
                {col?.label || filter.column}{" "}
                {FILTER_OPERATOR_LABELS[filter.operator] || filter.operator}{" "}
                {!["is_empty", "is_not_empty"].includes(filter.operator) &&
                  `"${filter.value}"`}
                <button
                  onClick={() => removeFilter(filter.id)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-6 px-2"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Bulk actions */}
      {selectedRows.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
          <span className="text-sm font-medium">
            {selectedRows.size} row{selectedRows.size !== 1 ? "s" : ""} selected
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedRows(new Set())}
          >
            Clear selection
          </Button>
          {onRowUpdate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowBulkUpdateModal(true)}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Bulk Update
            </Button>
          )}
          {onBulkDelete && !viewOnly && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onBulkDelete(Array.from(selectedRows))}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete selected
            </Button>
          )}
        </div>
      )}

      {/* Group/Sort controls */}
      {(groupByColumn || sortColumns.length > 0) && (
        <div className="flex items-center gap-4 text-sm">
          {groupByColumn && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Grouped by:</span>
              <Badge variant="secondary">{groupByColumn}</Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => {
                  setGroupByColumn(null);
                  setGroupByColumns([]);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {sortColumns.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Sorted by:</span>
              {sortColumns.map((s, i) => (
                <Badge key={s.column} variant="secondary" className="gap-1">
                  {s.column} {s.dir === "asc" ? "↑" : "↓"}
                  <button
                    onClick={() =>
                      setSortColumns((prev) =>
                        prev.filter((_, idx) => idx !== i)
                      )
                    }
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading indicator */}
      {loadingMore && (
        <div className="flex items-center justify-center p-2">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">
            Loading more records...
          </span>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {groupedEntries ? renderGroupedTable() : renderFlatTable()}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredAndSortedEntries.length} of {entries.length} records
        </span>
        <div className="flex items-center gap-4">
          {activeView && (
            <span>
              View: <strong>{activeView.name}</strong>
            </span>
          )}
          {selectedRows.size > 0 && <span>{selectedRows.size} selected</span>}
        </div>
      </div>

      {/* Bulk Update Modal */}
      <Dialog open={showBulkUpdateModal} onOpenChange={setShowBulkUpdateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Update</DialogTitle>
            <DialogDescription>
              Update {selectedRows.size} selected row(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Column to update</Label>
              <Select
                value={bulkUpdateColumn}
                onValueChange={setBulkUpdateColumn}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {COLUMNS.filter(
                    (c) =>
                      c.key !== "select" &&
                      c.key !== "actions" &&
                      c.key !== "id"
                  ).map((col) => (
                    <SelectItem key={col.key} value={col.key}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>New value</Label>
              <Input
                value={bulkUpdateValue}
                onChange={(e) => setBulkUpdateValue(e.target.value)}
                placeholder="Enter new value..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowBulkUpdateModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkUpdate}
              disabled={!bulkUpdateColumn || bulkUpdateSaving}
            >
              {bulkUpdateSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Update {selectedRows.size} rows
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save View Modal */}
      <Dialog open={showSaveViewModal} onOpenChange={(open) => {
        setShowSaveViewModal(open);
        if (!open) {
          setSaveAsGlobal(false);
          setNewViewName("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save View</DialogTitle>
            <DialogDescription>
              Save the current filters and settings as a named view
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>View name</Label>
              <Input
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g., Active Jobs, Pending Orders..."
              />
            </div>

            {/* Global vs Personal toggle */}
            <div className="space-y-2">
              <Label>View type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={!saveAsGlobal ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setSaveAsGlobal(false)}
                >
                  <User className="h-4 w-4 mr-2" />
                  Personal
                </Button>
                <Button
                  type="button"
                  variant={saveAsGlobal ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setSaveAsGlobal(true)}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Global (All Users)
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {saveAsGlobal
                  ? "Global views are visible to all users and appear first in the view list."
                  : "Personal views are only visible to you."}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveViewModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={saveNewView}
              disabled={!newViewName.trim() || savingView}
            >
              {savingView ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : saveAsGlobal ? (
                <Globe className="h-4 w-4 mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              {saveAsGlobal ? "Save Global View" : "Save View"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
