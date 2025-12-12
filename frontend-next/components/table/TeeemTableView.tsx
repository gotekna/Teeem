 
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

// Note: Lookup cache has been moved to utils/lookup-cache.ts
// View caching has been moved to Jotai atoms (viewsCacheAtom in view-state-atoms.ts)
// This eliminates the dual state management issue and provides better cache invalidation

import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  memo,
} from "react";
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DOMPurify from "isomorphic-dompurify";
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
  ExternalLink,
  Copy,
  Table2,
  FileSpreadsheet,
  RefreshCw,
  Paperclip,
  CalendarIcon,
  GitMerge,
  UserPlus,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getColumnPriority, COLUMN_PRIORITY_CONFIG } from "@/lib/column-priority";
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
  DropdownMenuLabel,
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
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import dynamic from "next/dynamic";

// Dynamic import to avoid SSR issues with TipTap
const InlineRichTextEditor = dynamic(
  () => import("@/components/common/RichTextEditor").then(mod => mod.InlineRichTextEditor),
  { ssr: false, loading: () => <div className="h-[60px] bg-muted/50 animate-pulse rounded" /> }
);

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
import { getColumnTypeEmoji, getColumnTypeSqlType, getColumnTypeLabel, getColumnTypeValidationRules, COLUMN_TYPES } from "@/lib/column-types";
import { DataHealthWidget, HealthIndicatorButton } from "./DataHealthWidget";
import { ColumnEditorModal } from "./ColumnEditorModal";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import { MergeModal } from "./MergeModal";
import { EmailToContactsModal } from "../emails/EmailToContactsModal";
import { ViewManagerSheet } from "./views";
import { sortColumnsForModal } from "./column-utils";
import { EditModeToggle } from "./EditModeToggle";

// Extracted components (Phase 1 refactoring)
import { SearchInput } from "./components/SearchInput";
import { ResizableColumnHeader } from "./components/ResizableColumnHeader";
import { SortableColumnRow } from "./components/SortableColumnRow";
import { CascadeFilterItem } from "./core/filtering/CascadeFilterItem";

// Cell components (Phase 4 refactoring)
import { SelectCheckbox, ActionsButtons, EditingActionsButtons } from "./core/cell-components";
import { RowEditingCell } from "./core/cell-components/RowEditingCell";

// Column renderer registry (Phase 4 refactoring)
import { renderCell as renderCellWithRegistry } from "./core/column-renderer/ColumnRenderer";
import { validateCell as validateCellWithRegistry } from "./core/column-renderer/CellValidation";

// Table sections (Phase 6 refactoring)
import { TableHeaderSection, TableFooterSection } from "./core/table-sections";

// Modals (Phase 7 refactoring)
import { ExportModal } from "./modals/ExportModal";
import { BulkUpdateModal } from "./modals/BulkUpdateModal";
import { SaveViewModal } from "./modals/SaveViewModal";
import { SchemaModals } from "./modals/SchemaModals";
import { EditColumnsModal } from "./modals/EditColumnsModal";

// Handler hooks (Phase 5 refactoring)
import { useExportHandlers } from "./core/hooks/useExportHandlers";
import { useSchemaHandlers } from "./core/hooks/useSchemaHandlers";
import { useTableHandlers } from "./core/hooks/useTableHandlers";

// Extracted utilities (Phase 1 refactoring)
import { extractSelectedIds, formatCellValue, truncateText, fuzzyMatch } from "./utils/table-utils";
import { getLookupOptions, fetchLookupOptionsForTable, invalidateLookupCache, lookupCache, lookupFetchPromises } from "./utils/lookup-cache";

// Jotai atoms for centralized state management (SSoT)
import { useAtom, useSetAtom, useAtomValue } from 'jotai';

// All table state atoms from consolidated table-atoms (SSoT)
import {
  // Core edit mode
  tableEditModeAtom,
  selectedRowsAtom,
  selectAllAtom,
  toggleRowSelectionAtom,
  selectAllRowsAtom,
  clearSelectionAtom,
  searchQueryAtom,
  hoveredRowAtom,
  // Modal registry
  activeModalAtom,
  modalDataAtom,
  openModalAtom,
  closeModalAtom,
  type ModalType,
  // Panel/UI state
  showFiltersAtom,
  healthPanelOpenAtom,
  filterPanelOpenAtom,
  rowLimitAtom,
  showAllRowsAtom,
  groupViewModeAtom,
  columnEditModeAtom,
  searchAllColumnsAtom,
  // Editing row state
  editingRowIdsAtom,
  editingDataAtom,
  legacyValidationErrorsAtom,
  // Lookup state
  lookupOptionsAtom,
  lookupLoadingAtom,
  // Merge modal
  showMergeModalAtom,
  mergeSelectedIdsAtom,
  // Bulk update modal
  showBulkUpdateModalAtom,
  bulkUpdateColumnAtom,
  bulkUpdateValueAtom,
  bulkUpdateSavingAtom,
  // Save view modal
  showSaveViewModalAtom,
  newViewNameAtom,
  saveAsGlobalAtom,
  savingViewAtom,
  // Column management modals
  showCreateColumnModalAtom,
  showEditColumnsModalAtom,
  showDeleteColumnModalAtom,
  showViewSchemaModalAtom,
  showEditColumnModalAtom,
  newColumnNameAtom,
  newColumnTypeAtom,
  selectedColumnToDeleteAtom,
  schemaLoadingAtom,
  editingColumnKeyAtom,
  editColumnNameAtom,
  editColumnTypeAtom,
  // Export modal
  showExportModalAtom,
  exportScopeAtom,
  exportFormatAtom,
  // Global views manager
  showGlobalViewsManagerAtom,
} from '@/lib/table-atoms';

// View state atoms (keep separate for now - already in use)
import {
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
  currentSmartFitAtom,
  currentShowTotalsAtom,
  collapsedGroupsAtom,
  foundationViewsAtom,
  viewsLoadingAtom,
  applyViewAtom,
  loadFoundationViewsAtom,
  invalidateViewsCacheAtom,
} from '@/lib/view-state-atoms';
import { selectDefaultView } from '@/lib/view-loading-utils';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Column types that are system-generated/computed (user cannot manually enter)
const SYSTEM_GENERATED_TYPES = [
  "computed",
  "formula",
  "auto_number",
  "created_time",
  "modified_time",
  "created_by",
  "modified_by",
  "rollup",
  "count",
];

// Check if a column is system-generated (non-editable, auto-computed)
const isSystemGeneratedColumn = (column: TableColumn): boolean => {
  const NON_EDITABLE_COLUMNS = ['id', 'created_at', 'updated_at'];
  return (
    column.editable === false ||
    column.system === true ||
    NON_EDITABLE_COLUMNS.includes(column.key) ||
    NON_EDITABLE_COLUMNS.includes(column.key?.toLowerCase()) ||
    SYSTEM_GENERATED_TYPES.includes(column.column_type || "")
  );
};

// Background color for system-generated columns
const SYSTEM_COLUMN_BG = '#fee2e2'; // red-100

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

// Note: Inline components have been extracted to separate files (Phase 1 refactoring):
// - SearchInput -> components/SearchInput.tsx
// - ResizableColumnHeader -> components/ResizableColumnHeader.tsx
// - SortableColumnRow -> components/SortableColumnRow.tsx
// - CascadeFilterItem -> core/filtering/CascadeFilterItem.tsx

// Default columns for generic tables
const DEFAULT_COLUMNS: TableColumn[] = [
  { key: "select", label: "", resizable: false, sortable: false, filterable: false, width: 40 },
  { key: "id", label: "ID", resizable: true, sortable: true, filterable: true, width: 50 },
  { key: "actions", label: "Actions", resizable: false, sortable: false, filterable: false, width: 180 },
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
// VIRTUALIZED GROUP TABLE COMPONENT
// ============================================================================

interface VirtualizedGroupTableProps {
  fullKey: string;
  depth: number;
  rows: any[];
  selectedRows: Set<number | string>;
  visibleColumnsInOrder: any[];
  columnWidths: Record<string, number>;
  rowIdToGlobalIndex: Map<number | string, number>;  // Pre-computed map for O(1) lookup
  getStickyColumnStyles: (key: string, isHeader: boolean) => React.CSSProperties;
  isSystemGeneratedColumn: (column: any) => boolean;
  SYSTEM_COLUMN_BG: string;
  getToggleCallback: (id: number | string) => () => void;
  handleSelectMouseDown: (rowId: number | string, rowIndex: number, e: React.MouseEvent) => void;
  handleRowMouseEnter: (rowId: number | string, rowIndex: number) => void;
  onRowClick?: (row: any) => void;
  onRowDoubleClick?: (row: any) => void;
  renderCellValue: (row: any, column: any) => React.ReactNode;
  renderTableHeader: () => React.ReactNode;
  isEditMode: boolean;
}

const VirtualizedGroupTable = memo(function VirtualizedGroupTable({
  fullKey,
  depth,
  rows,
  selectedRows,
  visibleColumnsInOrder,
  columnWidths,
  rowIdToGlobalIndex,
  getStickyColumnStyles,
  isSystemGeneratedColumn,
  SYSTEM_COLUMN_BG,
  getToggleCallback,
  handleSelectMouseDown,
  handleRowMouseEnter,
  onRowClick,
  onRowDoubleClick,
  renderCellValue,
  renderTableHeader,
  isEditMode,
}: VirtualizedGroupTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 33, // Estimated row height in pixels
    overscan: 5, // Render 5 extra rows above/below viewport for smooth scrolling
  });

  return (
    <div
      key={`data-${fullKey}`}
      className="mb-4"
      style={{ marginLeft: `${(depth + 1) * 24}px`, marginRight: '16px' }}
    >
      <Table className="w-full border-t border-b" style={{ tableLayout: 'auto' }}>
        {renderTableHeader()}
        <TableBody>
          <tr>
            <td colSpan={visibleColumnsInOrder.length} style={{ padding: 0 }}>
              <div
                ref={parentRef}
                style={{
                  height: `${Math.min(rows.length * 33, 500)}px`, // Max 500px tall
                  overflow: 'auto',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    const rowIndex = virtualRow.index;
                    const globalIndex = rowIdToGlobalIndex.get(row.id) ?? rowIndex;

                    return (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <table style={{ width: '100%', tableLayout: 'auto' }}>
                          <tbody>
                            <TableRow
                              className={cn(
                                selectedRows.has(row.id) && "bg-muted/50",
                                "hover:bg-muted/30 cursor-pointer"
                              )}
                              onClick={() => !isEditMode && onRowClick?.(row)}
                              onDoubleClick={() => !isEditMode && onRowDoubleClick?.(row)}
                              onMouseEnter={() => handleRowMouseEnter(row.id, globalIndex)}
                            >
                              {visibleColumnsInOrder.map((column, colIndex) => {
                                const stickyStyles = getStickyColumnStyles(column.key, false);
                                const isSystemGen = isSystemGeneratedColumn(column);
                                return (
                                  <TableCell
                                    key={`${column.key}-${colIndex}`}
                                    style={{
                                      width: columnWidths[column.key],
                                      minWidth: columnWidths[column.key],
                                      ...stickyStyles,
                                      ...(isSystemGen && column.key !== "select" && column.key !== "actions" && {
                                        backgroundColor: SYSTEM_COLUMN_BG,
                                      })
                                    }}
                                    className={cn(
                                      column.key === "select" && "!border-r-0 !p-0 !h-full !bg-white",
                                      column.key === "actions" && "!border-l-0 !bg-white"
                                    )}
                                    onClick={(e) => {
                                      if (column.key === "select") {
                                        e.stopPropagation();
                                      }
                                    }}
                                  >
                                    {column.key === "select" ? (
                                      <div
                                        data-column="select"
                                        onMouseDown={(e) => handleSelectMouseDown(row.id, globalIndex, e)}
                                      >
                                        <SelectCheckbox
                                          checked={selectedRows.has(row.id)}
                                          onCheckedChange={getToggleCallback(row.id)}
                                        />
                                      </div>
                                    ) : (
                                      renderCellValue(row, column)
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              </div>
            </td>
          </tr>
        </TableBody>
      </Table>
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TeeemTableView({
  entries = [],
  columns = null,
  foundationId = "default",
  foundationIdNumeric = null,
  tableName = "Table",
  onAddRow,
  onEdit,
  onDelete,
  onBulkDelete,
  onBulkEdit,
  onBulkMerge,
  enableMerge,
  mergeDisplayColumn = "name",
  mergeSecondaryColumns = [],
  onView,
  onRowDoubleClick,
  onRowClick,
  onRowUpdate,
  onColumnUpdate,
  onEditRelationships,
  onRefresh,
  onViewChange,
  enableImport = false,
  enableExport = false,
  onImport,
  onExport,
  enableSchemaEditor = false,
  onCreateColumn,
  onEditColumns,
  onDeleteColumn,
  onEditIndividual,
  onViewSchema,
  customActions,
  leftActions,
  customBulkActions,
  customCellRenderer,
  extraRowProps,
  viewOnly = false,
  preloadedViews = null,
  hideUpdateViewButton = false,
  initialGroupByColumn = null,
  onLoadViewReady,
  onServerSearch,
  serverSearchLoading = false,
  onViewApiParamsChange,
  loadingMore = false,
  showDataHealth = false,
  onDataHealthIssueClick,
  initialShowTotals = true,
  stats,
  category,
}: TeeemTableViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  // ============================================================================
  // AUTO-ENABLE FEATURES WHEN foundationIdNumeric IS SET
  // Source: TEEEM_DOCS/GOLD_STANDARD_TABLE.md
  // ============================================================================
  // When a table has foundationIdNumeric, it should automatically get:
  // - Import/Export in menu
  // - Schema Editor (Create/Edit/Delete columns)
  // - Filters button visible
  const shouldAutoEnable = !!foundationIdNumeric;

  const effectiveEnableImport = enableImport || shouldAutoEnable;
  const effectiveEnableExport = enableExport || shouldAutoEnable;
  const effectiveEnableSchemaEditor = enableSchemaEditor || shouldAutoEnable;

  // Use custom columns if provided, otherwise use defaults
  const COLUMNS = useMemo(() => {
    if (!columns) return DEFAULT_COLUMNS;
    // Ensure select and actions columns are included
    const hasSelect = columns.some(c => c.key === 'select');
    const hasActions = columns.some(c => c.key === 'actions');
    const result = [...columns];
    if (!hasSelect) {
      result.unshift({ key: "select", label: "", resizable: false, sortable: false, filterable: false, width: 40 });
    }
    if (!hasActions) {
      result.push({ key: "actions", label: "Actions", resizable: false, sortable: false, filterable: false, width: 180 });
    }
    return result;
  }, [columns]);

  // Detect if table has email columns for Email to Contacts extraction feature
  // Check both column definitions AND actual data structure
  const hasEmailColumns = useMemo(() => {
    // Check if any column is explicitly marked as email type or has "email" in key
    const hasEmailColumn = COLUMNS.some(col =>
      col.column_type === 'email' ||
      col.key?.toLowerCase().includes('email')
    );

    if (hasEmailColumn) return true;

    // Check if any entry has email-related fields in the data
    if (entries && entries.length > 0) {
      const firstEntry = entries[0];
      const hasEmailFields =
        'from_email' in firstEntry ||
        'to_emails' in firstEntry ||
        'cc_emails' in firstEntry ||
        'email' in firstEntry;

      if (hasEmailFields) return true;
    }

    return false;
  }, [COLUMNS, entries]);

  // Sticky columns configuration - columns that stay fixed on horizontal scroll
  // Order matters: select first (leftmost), then id, then name
  const STICKY_COLUMNS = useMemo(() => ['select', 'id', 'name'], []);

  // Initialize default column state
  const DEFAULT_COLUMN_WIDTHS = useMemo(
    () =>
      COLUMNS.reduce((acc, col) => {
        acc[col.key] = col.width || 50;
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
  // STATE - Migrating to atoms for SSoT compliance
  // ============================================================================

  // Search state managed by atom (SSoT)
  const [search, setSearch] = useAtom(searchQueryAtom);
  // searchAllColumns managed by atom (SSoT)
  const [searchAllColumns, setSearchAllColumns] = useAtom(searchAllColumnsAtom);

  // View-related state now managed by Jotai atoms (SSoT)
  const [sortColumns, setSortColumns] = useAtom(currentSortColumnsAtom);
  const [columnWidths, setColumnWidths] = useAtom(currentColumnWidthsAtom);
  const [columnOrder, setColumnOrder] = useAtom(currentColumnOrderAtom);
  const [visibleColumns, setVisibleColumns] = useAtom(currentVisibleColumnsAtom);

  // Sync column order and visibility when COLUMNS changes (e.g., select/actions added)
  useEffect(() => {
    setColumnOrder((prev) => {
      const newKeys = COLUMNS.map(c => c.key);
      // Add any missing keys (like select) to the beginning or end
      const missingKeys = newKeys.filter(k => !prev.includes(k));
      if (missingKeys.length === 0) return prev;
      // Put select at start, actions at end, others in order
      const selectKey = missingKeys.find(k => k === 'select');
      const actionsKey = missingKeys.find(k => k === 'actions');
      const otherKeys = missingKeys.filter(k => k !== 'select' && k !== 'actions');
      let result = [...prev];
      if (selectKey) result = [selectKey, ...result];
      if (otherKeys.length > 0) result = [...result, ...otherKeys];
      if (actionsKey) result = [...result, actionsKey];
      return result;
    });
    setVisibleColumns((prev) => {
      const newKeys = COLUMNS.map(c => c.key);
      const updates: VisibleColumnsState = { ...prev };
      newKeys.forEach(k => {
        if (!(k in updates)) updates[k] = true;
      });
      return updates;
    });
     
  }, [COLUMNS]);
  // Selection state managed by atom (SSoT)
  const [selectedRows, setSelectedRows] = useAtom(selectedRowsAtom);

  // Filter state managed by atoms
  const [cascadeFilters, setCascadeFilters] = useAtom(currentFiltersAtom);
  // Defensive: ensure cascadeFilters is always an array for .map/.length calls
  const safeFilters = useMemo(() => Array.isArray(cascadeFilters) ? cascadeFilters : [], [cascadeFilters]);
  const [filterGroups, setFilterGroups] = useAtom(currentFilterGroupsAtom);
  const [interGroupLogic, setInterGroupLogic] = useAtom(currentInterGroupLogicAtom);
  // showFilters managed by atom (SSoT)
  const [showFilters, setShowFilters] = useAtom(showFiltersAtom);

  // View collection state managed by atoms
  const [savedViews, setSavedViews] = useAtom(foundationViewsAtom);
  const [activeViewId, setActiveViewId] = useAtom(activeViewIdAtom);
  const viewsLoadingRef = useRef(false); // Prevent duplicate view fetches
  const initialViewLoadedRef = useRef(false); // Prevent re-loading views after initial load

  // Row rendering limit for performance (render 100 rows initially, load more on demand)
  const INITIAL_ROW_LIMIT = 100;
  // rowLimit and showAllRows managed by atoms (SSoT)
  const [rowLimit, setRowLimit] = useAtom(rowLimitAtom);
  const [showAllRows, setShowAllRows] = useAtom(showAllRowsAtom);

  // Group by state managed by atoms (SSoT)
  const [groupByColumns, setGroupByColumns] = useAtom(currentGroupByColumnsAtom);
  // Derive groupByColumn from atom - NOT a separate state (SSoT compliance)
  const groupByColumn = groupByColumns.length > 0 ? groupByColumns[0] : (initialGroupByColumn || null);
  // Collapsed groups managed by atom (persists with saved views)
  const [collapsedGroups, setCollapsedGroups] = useAtom(collapsedGroupsAtom);
  // groupViewMode managed by atom (SSoT)
  const [groupViewMode, setGroupViewMode] = useAtom(groupViewModeAtom);

  // Display options managed by atoms
  const [showTotals, setShowTotals] = useAtom(currentShowTotalsAtom);
  const [autoFitColumns, setAutoFitColumns] = useAtom(currentAutoFitColumnsAtom);
  const [smartFit, setSmartFit] = useAtom(currentSmartFitAtom);
  // healthPanelOpen managed by atom (SSoT)
  const [healthPanelOpen, setHealthPanelOpen] = useAtom(healthPanelOpenAtom);

  // Auto-open health panel when ?health=open query param is present
  useEffect(() => {
    if (searchParams.get('health') === 'open') {
      setHealthPanelOpen(true);
    }
  }, [searchParams, setHealthPanelOpen]);

  // NEW: Edit Mode state (unified editing approach)
  // When true, all editable cells become interactive with auto-save on blur
  const isEditMode = useAtomValue(tableEditModeAtom);
  // Editing state managed by atoms (SSoT)
  const [editingRowIds, setEditingRowIds] = useAtom(editingRowIdsAtom);
  const [editingData, setEditingData] = useAtom(editingDataAtom);
  const [validationErrors, setValidationErrors] = useAtom(legacyValidationErrorsAtom);
  const [lookupOptions, setLookupOptions] = useAtom(lookupOptionsAtom);
  const [lookupLoading, setLookupLoading] = useAtom(lookupLoadingAtom);

  // Merge modal state managed by atoms (SSoT)
  const [showMergeModal, setShowMergeModal] = useAtom(showMergeModalAtom);
  const [mergeSelectedIds, setMergeSelectedIds] = useAtom(mergeSelectedIdsAtom);

  // Filter panel state managed by atom (SSoT)
  const [filterPanelOpen, setFilterPanelOpen] = useAtom(filterPanelOpenAtom);

  // Bulk update modal state managed by atoms (SSoT)
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useAtom(showBulkUpdateModalAtom);
  const [bulkUpdateColumn, setBulkUpdateColumn] = useAtom(bulkUpdateColumnAtom);
  const [bulkUpdateValue, setBulkUpdateValue] = useAtom(bulkUpdateValueAtom);
  const [bulkUpdateSaving, setBulkUpdateSaving] = useAtom(bulkUpdateSavingAtom);

  // Save view modal state managed by atoms (SSoT)
  const [showSaveViewModal, setShowSaveViewModal] = useAtom(showSaveViewModalAtom);
  const [newViewName, setNewViewName] = useAtom(newViewNameAtom);
  const [saveAsGlobal, setSaveAsGlobal] = useAtom(saveAsGlobalAtom);
  const [savingView, setSavingView] = useAtom(savingViewAtom);

  // Schema editor modal states managed by atoms (SSoT)
  const [showCreateColumnModal, setShowCreateColumnModal] = useAtom(showCreateColumnModalAtom);
  const [showEditColumnsModal, setShowEditColumnsModal] = useAtom(showEditColumnsModalAtom);
  const [showDeleteColumnModal, setShowDeleteColumnModal] = useAtom(showDeleteColumnModalAtom);
  const [showViewSchemaModal, setShowViewSchemaModal] = useAtom(showViewSchemaModalAtom);
  const [showEditColumnModal, setShowEditColumnModal] = useAtom(showEditColumnModalAtom);
  const [newColumnName, setNewColumnName] = useAtom(newColumnNameAtom);
  const [newColumnType, setNewColumnType] = useAtom(newColumnTypeAtom);
  const [selectedColumnToDelete, setSelectedColumnToDelete] = useAtom(selectedColumnToDeleteAtom);
  const [schemaLoading, setSchemaLoading] = useAtom(schemaLoadingAtom);
  const [columnEditMode, setColumnEditMode] = useAtom(columnEditModeAtom);
  const [editingColumnKey, setEditingColumnKey] = useAtom(editingColumnKeyAtom);
  const [editColumnName, setEditColumnName] = useAtom(editColumnNameAtom);
  const [editColumnType, setEditColumnType] = useAtom(editColumnTypeAtom);

  // Export modal state managed by atoms (SSoT)
  const [showExportModal, setShowExportModal] = useAtom(showExportModalAtom);
  const [exportScope, setExportScope] = useAtom(exportScopeAtom);
  const [exportFormat, setExportFormat] = useAtom(exportFormatAtom);

  // Email to Contacts modal state (local state)
  const [showEmailToContactsModal, setShowEmailToContactsModal] = useState(false);

  // Drag-to-select state (using refs to avoid re-renders)
  const dragStateRef = useRef<{
    isDragging: boolean;
    startRowId: number | string | null;
    startRowIndex: number | null;
    currentRowId?: number | string; // Track the end of the drag range
    startX: number;
    startY: number;
  } | null>(null);

  // Ref for table container
  const tableContainerRef = useRef<HTMLDivElement>(null);


  // Global Views Manager state managed by atom (SSoT)
  const [showGlobalViewsManager, setShowGlobalViewsManager] = useAtom(showGlobalViewsManagerAtom);

  // DnD sensors for column reordering
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Handle column drag end for reordering
  const handleColumnDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setColumnOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      return arrayMove(prev, oldIndex, newIndex);
    });
     
  }, []);

  // Reorder a column to a specific position (1-based index)
  const reorderColumnToPosition = useCallback((columnKey: string, newPosition: number) => {
    setColumnOrder((prev) => {
      // Get only visible columns in current order
      const visibleInOrder = prev.filter(key => visibleColumns[key] === true);
      const currentIndex = visibleInOrder.indexOf(columnKey);
      if (currentIndex === -1) return prev;

      // Convert to 0-based index and clamp
      const targetIndex = Math.max(0, Math.min(newPosition - 1, visibleInOrder.length - 1));
      if (currentIndex === targetIndex) return prev;

      // Reorder within visible columns
      const newVisibleOrder = [...visibleInOrder];
      const [moved] = newVisibleOrder.splice(currentIndex, 1);
      newVisibleOrder.splice(targetIndex, 0, moved);

      // Rebuild full order: visible columns first, then hidden
      const hiddenColumns = prev.filter(key => visibleColumns[key] !== true);
      return [...newVisibleOrder, ...hiddenColumns];
    });
     
  }, [visibleColumns]);

  // Get columns sorted by current columnOrder for the modal
  // Uses shared utility: visible columns by order first, then hidden columns alphabetically
  const getSortedColumnsForModal = useCallback(() => {
    const dataColumns = COLUMNS.filter(c => c.key !== "select" && c.key !== "actions");
    return sortColumnsForModal(dataColumns, visibleColumns, columnOrder);
  }, [COLUMNS, columnOrder, visibleColumns]);

  // ============================================================================
  // PERFORMANCE DEBUGGING (removed - use React DevTools Profiler for detailed analysis)
  // ============================================================================

  // ============================================================================
  // DEVELOPER WARNINGS
  // ============================================================================

  // Warn developers when foundationIdNumeric is missing but features require it
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && !foundationIdNumeric) {
      const warnings: string[] = [];

      if (enableSchemaEditor) {
        warnings.push('enableSchemaEditor is true but foundationIdNumeric is missing - column operations will not work');
      }
      if (preloadedViews === null && !viewOnly) {
        warnings.push('No preloadedViews and no foundationIdNumeric - saved views feature is disabled');
      }

      if (warnings.length > 0) {
        console.warn(
          `[TeeemTableView] "${tableName}" (foundationId="${foundationId}"):\n` +
          warnings.map(w => `  - ${w}`).join('\n') +
          '\n  To fix: Pass foundationIdNumeric={tableId} prop'
        );
      }
    }
  }, [foundationIdNumeric, enableSchemaEditor, preloadedViews, viewOnly, tableName, foundationId]);

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
    setShowFilters(true); // Show filter editor rows
     
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

  // Set group by column (updates atom - groupByColumn is derived from it)
  const handleGroupByColumn = useCallback((columnKey: string | null) => {
    setGroupByColumns(columnKey ? [columnKey] : []);
    // Clear collapsed groups when changing group column
    setCollapsedGroups(new Set());
  }, [setGroupByColumns, setCollapsedGroups]);

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

  // PERFORMANCE OPTIMIZATION: Memoize toggle callbacks per row ID
  // This prevents creating new functions on every render, which breaks React.memo
  const toggleCallbacksRef = React.useRef<Map<number | string, () => void>>(new Map());
  const getToggleCallback = useCallback((id: number | string) => {
    if (!toggleCallbacksRef.current.has(id)) {
      toggleCallbacksRef.current.set(id, () => toggleRowSelection(id));
    }
    return toggleCallbacksRef.current.get(id)!;
  }, [toggleRowSelection]);

  // Clear callback cache when rows change to prevent memory leaks
  React.useEffect(() => {
    const currentIds = new Set(entries.map(e => e.id));
    const cachedIds = Array.from(toggleCallbacksRef.current.keys());
    cachedIds.forEach(id => {
      if (!currentIds.has(id)) {
        toggleCallbacksRef.current.delete(id);
      }
    });
  }, [entries]);

  const toggleSelectAll = useCallback(() => {
    // In grouped view, select only visible/expanded rows
    if (groupedEntries) {
      const visibleRows: TableRowType[] = [];
      const collectRows = (
        groups: Record<string, { rows: TableRowType[]; subgroups?: Record<string, { rows: TableRowType[]; subgroups?: Record<string, unknown> }> }>,
        parentKey: string = ""
      ) => {
        Object.entries(groups).forEach(([groupKey, group]) => {
          const fullKey = parentKey ? `${parentKey}›${groupKey}` : groupKey;
          const isCollapsed = collapsedGroups.has(fullKey);
          if (!isCollapsed) {
            if (group.subgroups && Object.keys(group.subgroups).length > 0) {
              collectRows(group.subgroups as typeof groups, fullKey);
            } else {
              visibleRows.push(...group.rows);
            }
          }
        });
      };
      collectRows(groupedEntries);

      // Check if all visible rows are selected
      const visibleIds = visibleRows.map(r => r.id);
      const allVisibleSelected = visibleIds.every(id => selectedRows.has(id));

      if (allVisibleSelected && visibleIds.length > 0) {
        // Deselect all visible rows
        const newSelection = new Set(selectedRows);
        visibleIds.forEach(id => newSelection.delete(id));
        setSelectedRows(newSelection);
      } else {
        // Select all visible rows
        const newSelection = new Set(selectedRows);
        visibleIds.forEach(id => newSelection.add(id));
        setSelectedRows(newSelection);
      }
    } else {
      // Flat view: select all filtered entries
      if (selectedRows.size === filteredAndSortedEntries.length) {
        setSelectedRows(new Set<string | number>());
      } else {
        setSelectedRows(new Set(filteredAndSortedEntries.map((e) => e.id)));
      }
    }
     
  }, [selectedRows.size]);

  // Merge handler - opens the shared merge modal
  const handleMergeClick = useCallback((ids: (number | string)[]) => {
    // If onBulkMerge is provided, use that (backward compatibility)
    if (onBulkMerge) {
      onBulkMerge(ids);
      return;
    }
    // Otherwise, use built-in merge modal if enabled
    if (enableMerge !== false && foundationIdNumeric) {
      setMergeSelectedIds(ids);
      setShowMergeModal(true);
    }
  }, [onBulkMerge, enableMerge, foundationIdNumeric]);

  // Called when merge completes successfully
  const handleMergeComplete = useCallback(() => {
    setMergeSelectedIds([]);
    setSelectedRows(new Set<string | number>());
    // Refresh data
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh]);

  // Group handlers
  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, [setCollapsedGroups]);

  // Collect all group keys for expand/collapse all
  const getAllGroupKeys = useCallback((
    groups: Record<string, { rows: unknown[]; subgroups?: Record<string, unknown> }>,
    parentKey: string = ""
  ): string[] => {
    const keys: string[] = [];
    for (const [groupKey, group] of Object.entries(groups)) {
      const fullKey = parentKey ? `${parentKey}›${groupKey}` : groupKey;
      keys.push(fullKey);
      if (group.subgroups && typeof group.subgroups === 'object') {
        keys.push(...getAllGroupKeys(group.subgroups as typeof groups, fullKey));
      }
    }
    return keys;
  }, []);

  // Fetch lookup options for a column (uses module-level cache)
  const fetchLookupOptions = useCallback(async (column: TableColumn) => {
    const targetTableId = column.lookup_foundation_id;
    const cacheKey = `${column.key}_${targetTableId}`;

    if (!targetTableId) return;

    // Check module-level cache first (survives component remounts)
    if (lookupCache[cacheKey]) {
      setLookupOptions(prev => ({ ...prev, [column.key]: lookupCache[cacheKey] }));
      return;
    }

    // If there's already a fetch in progress, wait for it
    if (lookupFetchPromises[cacheKey]) {
      try {
        const options = await lookupFetchPromises[cacheKey];
        setLookupOptions(prev => ({ ...prev, [column.key]: options }));
      } catch {
        // Error already logged by original fetch
      }
      return;
    }

    setLookupLoading(prev => ({ ...prev, [column.key]: true }));

    // Create and store the fetch promise
    lookupFetchPromises[cacheKey] = (async () => {
      const response = await api.get(`/api/v1/foundations/${targetTableId}/records`);

      // Handle various response structures
      let records: Record<string, unknown>[] = [];
      if (Array.isArray(response)) {
        records = response;
      } else if (response && typeof response === 'object') {
        const resp = response as { records?: Record<string, unknown>[]; data?: Record<string, unknown>[] | { records?: Record<string, unknown>[] } };
        if (Array.isArray(resp.records)) {
          records = resp.records;
        } else if (resp.data) {
          if (Array.isArray(resp.data)) {
            records = resp.data;
          } else if (Array.isArray((resp.data as { records?: Record<string, unknown>[] }).records)) {
            records = (resp.data as { records: Record<string, unknown>[] }).records;
          }
        }
      }

      const displayColumn = column.lookup_display_column || 'name';
      return records.map((record) => ({
        id: record.id as number,
        display: String(record[displayColumn] || record.name || record.title || record.id),
      }));
    })();

    try {
      const options = await lookupFetchPromises[cacheKey]!;
      lookupCache[cacheKey] = options; // Store in module-level cache
      setLookupOptions(prev => ({ ...prev, [column.key]: options }));
    } catch (error) {
      console.error('Failed to fetch lookup options:', error);
      setLookupOptions(prev => ({ ...prev, [column.key]: [] }));
      delete lookupFetchPromises[cacheKey]; // Allow retry on error
    } finally {
      setLookupLoading(prev => ({ ...prev, [column.key]: false }));
    }
  }, []); // No dependencies needed - uses module-level cache

  // Inline editing handlers - supports single or multiple rows
  const startEditing = useCallback((row: TableRowType) => {
    setEditingRowIds(new Set([row.id]));
    setEditingData({ [row.id]: { ...row } });

    // Pre-fetch lookup options for lookup columns (including multiple_lookups)
    COLUMNS.forEach(col => {
      if ((col.column_type === 'lookup' || col.column_type === 'relation' || col.column_type === 'multiple_lookups') &&
          col.lookup_foundation_id) {
        fetchLookupOptions(col);
      }
    });
  }, [COLUMNS, fetchLookupOptions]);

  // Start editing multiple rows at once
  const startMultiEditing = useCallback((rowIds: (number | string)[]) => {
    const newEditingData: Record<string | number, Record<string, unknown>> = {};
    rowIds.forEach(id => {
      const row = entries.find(e => e.id === id);
      if (row) {
        newEditingData[id] = { ...row };
      }
    });
    setEditingRowIds(new Set(rowIds));
    setEditingData(newEditingData);

    // Pre-fetch lookup options for lookup columns (including multiple_lookups)
    COLUMNS.forEach(col => {
      if (col.column_type === 'lookup' || col.column_type === 'relation' || col.column_type === 'multiple_lookups') {
        if (col.lookup_foundation_id) {
          fetchLookupOptions(col);
        }
      }
    });
  }, [COLUMNS, entries, fetchLookupOptions]);

  const cancelEditing = useCallback(() => {
    setEditingRowIds(new Set());
    setEditingData({});
    setValidationErrors({});
  }, []);

  // Validate a cell and update validation errors state
  const handleCellBlur = useCallback((rowId: number | string, columnKey: string, value: unknown, columnType?: string) => {
    // Use imported validateCell from CellValidation.tsx (SSoT)
    const result = validateCellWithRegistry(value, columnType || 'single_line_text');
    const error = result.error;

    setValidationErrors(prev => {
      const rowErrors: Record<string, string> = prev[rowId] ? { ...prev[rowId] } : {};

      if (error) {
        rowErrors[columnKey] = error;
      } else {
        delete rowErrors[columnKey];
      }

      // If no errors for this row, remove the row entry
      if (Object.keys(rowErrors).length === 0) {
        const { [rowId]: _, ...rest } = prev;
        return rest;
      }

      return { ...prev, [rowId]: rowErrors };
    });
  }, []);

  const saveEditing = useCallback(async () => {
    const startTime = performance.now();

    if (editingRowIds.size === 0 || !onRowUpdate) return;

    // Check for validation errors before saving
    const errorCount = Object.values(validationErrors).reduce(
      (count, rowErrors) => count + Object.keys(rowErrors).length,
      0
    );
    if (errorCount > 0) {
      toast({
        title: "Cannot save",
        description: `Please fix ${errorCount} validation error${errorCount !== 1 ? "s" : ""} first`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Collect all changes for batch update
      const rowsToUpdate: Array<{ rowId: number | string; changes: Record<string, unknown> }> = [];

      for (const rowId of editingRowIds) {
        const originalRow = entries.find((e) => e.id === rowId);
        const rowData = editingData[rowId];
        if (!originalRow || !rowData) continue;

        const changes: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(rowData)) {
          // Compare values - handle objects/arrays properly
          const originalValue = originalRow[key];
          const valuesMatch = JSON.stringify(originalValue) === JSON.stringify(value);
          if (!valuesMatch) {
            changes[key] = value;
          }
        }

        if (Object.keys(changes).length > 0) {
          rowsToUpdate.push({ rowId, changes });
        }
      }

      // Use bulk_update API if foundationIdNumeric is available (single API call)
      if (foundationIdNumeric && rowsToUpdate.length > 0) {
        // Group by changes to minimize API calls
        // For now, update each row with all its changes in one call
        const apiStartTime = performance.now();
        for (const { rowId, changes } of rowsToUpdate) {
          await api.patch(`/api/v1/foundations/${foundationIdNumeric}/records/${rowId}`, {
            record: changes
          });
        }

        // Only refresh once after all updates
        const refreshStartTime = performance.now();
        onRefresh?.();
      } else {
        // Fallback: call onRowUpdate for each field (triggers refresh per field - slow)
        for (const { rowId, changes } of rowsToUpdate) {
          for (const [key, value] of Object.entries(changes)) {
            await onRowUpdate(rowId, key, value);
          }
        }
      }

      setEditingRowIds(new Set());
      setEditingData({});
      setValidationErrors({});
      toast({
        title: "Saved",
        description: `Successfully saved ${editingRowIds.size} row${editingRowIds.size !== 1 ? "s" : ""}`,
      });
    } catch (error) {
      console.error("Failed to save:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Save failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [editingRowIds, editingData, entries, foundationIdNumeric, onRowUpdate, onRefresh, toast, validationErrors]);

  // Bulk update handler
  const handleBulkUpdate = useCallback(async () => {
    console.log('[Bulk Update] Starting bulk update...');
    console.log('[Bulk Update] Column:', bulkUpdateColumn);
    console.log('[Bulk Update] Value:', bulkUpdateValue);
    console.log('[Bulk Update] Selected rows count:', selectedRows.size);
    console.log('[Bulk Update] Selected row IDs:', Array.from(selectedRows));

    if (!bulkUpdateColumn || selectedRows.size === 0) {
      console.warn('[Bulk Update] Aborted - missing column or no rows selected');
      return;
    }

    setBulkUpdateSaving(true);
    try {
      const ids = Array.from(selectedRows);
      const selectedCol = COLUMNS.find(c => c.key === bulkUpdateColumn);
      console.log('[Bulk Update] Selected column config:', selectedCol);

      // For multiple_lookups, convert comma-separated string to array of integers
      let valueToSend: string | number[] = bulkUpdateValue;
      if (selectedCol?.column_type === 'multiple_lookups' && bulkUpdateValue) {
        valueToSend = bulkUpdateValue.split(',').filter(Boolean).map(id => parseInt(id, 10));
        console.log('[Bulk Update] Converted multiple_lookups value:', bulkUpdateValue, '→', valueToSend);
      }

      if (foundationIdNumeric) {
        // Use bulk_update API endpoint if foundationIdNumeric is available (much faster)
        // Skip if we need field mapping (handled above)
        const payload = {
          record_ids: ids,
          updates: { [bulkUpdateColumn]: valueToSend }
        };
        console.log('[Bulk Update] Using bulk_update API endpoint');
        console.log('[Bulk Update] Foundation ID:', foundationIdNumeric);
        console.log('[Bulk Update] Payload:', JSON.stringify(payload, null, 2));

        const response = await api.post<{
          success: boolean;
          updated_count: number;
          total_requested: number;
          errors?: Array<{ id: number; errors: string[] }>;
        }>(`/api/v1/foundations/${foundationIdNumeric}/records/bulk_update`, payload);
        console.log('[Bulk Update] API response:', response);

        // Check if the update was actually successful
        if (!response || !response.success || response.updated_count === 0) {
          console.error('[Bulk Update] Update FAILED - no records were updated');
          console.error('[Bulk Update] Updated count:', response?.updated_count);
          console.error('[Bulk Update] Errors:', response?.errors);

          // Check if this is an entity_type validation error
          const hasEntityTypeErrors = response?.errors && response.errors.some((err: any) =>
            err.errors && err.errors.some((msg: string) =>
              msg.toLowerCase().includes('first name') ||
              msg.toLowerCase().includes('full name') ||
              msg.toLowerCase().includes('entity')
            )
          );
          console.log('[Bulk Update] hasEntityTypeErrors:', hasEntityTypeErrors);
          console.log('[Bulk Update] foundationIdNumeric:', foundationIdNumeric);

          // Show error message to user
          let errorMessage = `Bulk update failed. ${response?.updated_count || 0} of ${response?.total_requested || ids.length} records updated.`;

          if (response?.errors && response.errors.length > 0) {
            errorMessage += '\n\nValidation errors:\n';
            response.errors.slice(0, 3).forEach((err: any) => {
              errorMessage += `\n• Record ${err.id}: ${err.errors.join(', ')}`;
            });
            if (response.errors.length > 3) {
              errorMessage += `\n... and ${response.errors.length - 3} more errors`;
            }
          }

          // If entity_type validation errors, automatically open health report
          if (hasEntityTypeErrors && foundationIdNumeric) {
            console.log('[Bulk Update] Detected entity_type errors, opening health report...');
            errorMessage += '\n\n⚠️ Some records have data quality issues that must be fixed first.';
            errorMessage += '\n\nOpening Health Report to show which records need fixing...';

            alert(errorMessage);
            console.log('[Bulk Update] Alert shown, now opening window...');

            // Open health report in new tab so they can fix the data
            const healthUrl = `/system-health?foundation=${foundationIdNumeric}`;
            console.log('[Bulk Update] Opening health report:', healthUrl);
            window.open(healthUrl, '_blank');
            console.log('[Bulk Update] window.open called');
            return;
          } else {
            alert(errorMessage);
          }

          return; // Don't close modal or clear selection on failure
        }

        console.log('[Bulk Update] Success! Updated', response?.updated_count, 'records');
      } else if (onRowUpdate) {
        console.log('[Bulk Update] Using fallback individual updates (no foundationIdNumeric)');
        // Fallback to individual updates
        for (const id of ids) {
          console.log(`[Bulk Update] Updating row ${id}...`);
          await onRowUpdate(id, bulkUpdateColumn, valueToSend);
        }
        console.log('[Bulk Update] Individual updates completed');
      } else {
        console.error('[Bulk Update] No update mechanism available (no foundationIdNumeric and no onRowUpdate)');
      }

      console.log('[Bulk Update] Cleaning up...');
      setShowBulkUpdateModal(false);
      setBulkUpdateColumn("");
      setBulkUpdateValue("");
      setSelectedRows(new Set<string | number>());
      console.log('[Bulk Update] Calling onRefresh...');
      onRefresh?.();
      console.log('[Bulk Update] Complete!');
    } catch (error) {
      console.error("[Bulk Update] ERROR:", error);
      console.error("[Bulk Update] Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      });
    } finally {
      setBulkUpdateSaving(false);
      console.log('[Bulk Update] Saving state reset');
    }
  }, [bulkUpdateColumn, bulkUpdateValue, selectedRows, foundationIdNumeric, onRowUpdate, onRefresh, COLUMNS]);

  // Fetch lookup options when bulk update column changes to a lookup column
  useEffect(() => {
    if (!bulkUpdateColumn) return;

    const selectedCol = COLUMNS.find(c => c.key === bulkUpdateColumn);
    if (!selectedCol) return;

    const isLookup = selectedCol.column_type === 'lookup' || selectedCol.column_type === 'multiple_lookups' || !!selectedCol.lookup_foundation_id;
    if (isLookup && !lookupOptions[bulkUpdateColumn] && !lookupLoading[bulkUpdateColumn]) {
      fetchLookupOptions(selectedCol);
    }
  }, [bulkUpdateColumn, COLUMNS, lookupOptions, lookupLoading, fetchLookupOptions]);

  // ============================================================================
  // CELL-LEVEL INLINE EDITING
  // ============================================================================

  // Check if a column type should use single-click (dropdown-style) editing
  const isDropdownColumn = useCallback((column: TableColumn): boolean => {
    const colType = column.column_type || '';
    const hasChoices = column.choices && column.choices.length > 0;
    const isLookup = colType === 'lookup' || colType === 'relation' || colType === 'multiple_lookups' || !!column.lookup_foundation_id;
    const isChoice = colType === 'choice' || colType === 'single_select' || colType === 'multi_select';
    const isBoolean = colType === 'boolean';
    return hasChoices || isLookup || isChoice || isBoolean;
  }, []);

  // ============================================================================
  // SAVED VIEWS
  // ============================================================================

  // Atom actions
  const loadViews = useSetAtom(loadFoundationViewsAtom);
  const applyView = useSetAtom(applyViewAtom);
  const invalidateCache = useSetAtom(invalidateViewsCacheAtom);

  // Load view state helper - applies saved view configuration to current state
  // skipUrlUpdate: set to true when loading from URL to avoid redundant URL updates that can cause loops
  // NOTE: This function is now simplified - atoms handle the atomic state updates
  const loadViewState = useCallback(
    (view: SavedView, skipUrlUpdate = false) => {
      // Apply view state atomically via Jotai atom
      // This replaces 100+ lines of individual setters with a single atomic update
      // groupByColumns and collapsedGroups are now managed by atoms (SSoT)
      applyView(view);

      // Hide filter editor when loading a saved view
      setShowFilters(false);

      // URL update with numeric ID (skip if loading from URL to avoid loops)
      // Using numeric ID for: speed (O(1) lookup), stability (rename-safe), clarity (no slug conflicts)
      if (view.id && !skipUrlUpdate) {
        const currentUrlViewId = searchParams.get('view');
        const newViewId = String(view.id);
        if (currentUrlViewId !== newViewId) {
          const currentParams = new URLSearchParams(searchParams.toString());
          currentParams.set('view', newViewId);
          const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
          router.replace(newUrl, { scroll: false });
        }
      }

      // Handle apiParams for server-side filtering
      if (view.filters && onViewApiParamsChange) {
        onViewApiParamsChange(null);
      }
    },
    [applyView, onViewApiParamsChange, searchParams, router]
  );

  // Load saved views (simplified using atoms)
  // IMPORTANT: Only trigger on foundationIdNumeric change to prevent excessive re-runs
  // searchParams is read inside the effect, not as a dependency
  useEffect(() => {
    const loadSavedViews = async () => {
      if (!foundationIdNumeric) return;

      // Prevent re-loading views after initial load (avoid loops from state changes)
      if (initialViewLoadedRef.current) {
        return;
      }

      // Prevent duplicate concurrent fetches (React StrictMode double-mount)
      if (viewsLoadingRef.current) {
        return;
      }
      viewsLoadingRef.current = true;

      const startTime = performance.now();

      try {
        // Load views using atom (handles caching, mapping, sorting automatically)
        const result = await loadViews(foundationIdNumeric);

        if (!result.success) {
          console.error('[loadSavedViews] Failed to load views:', result.error);
          return;
        }

        const filteredViews = result.views || [];

        // Auto-apply default view using consolidated utility
        // Read URL param here (not as effect dependency) to avoid re-triggering on URL changes
        const urlViewParam = searchParams.get('view');
        // Parse as numeric ID (new format) - non-numeric values are ignored
        const urlViewId = urlViewParam ? parseInt(urlViewParam, 10) : null;
        const validViewId = urlViewId && !isNaN(urlViewId) ? urlViewId : null;

        const defaultView = selectDefaultView(filteredViews, {
          urlViewId: validViewId,
          preferGlobal: true,
        });

        if (defaultView) {
          // Skip URL update if loading from URL (avoid redundant updates)
          const skipUrlUpdate = !!validViewId;
          loadViewState(defaultView, skipUrlUpdate);
          initialViewLoadedRef.current = true;
        }
      } catch (error) {
        console.error("Error loading saved views:", error);
      } finally {
        // Reset loading flag to allow future loads (e.g., on foundation change)
        viewsLoadingRef.current = false;
      }
    };

    loadSavedViews();
     
  }, [foundationIdNumeric, preloadedViews]);

  // Expose loadViewState to parent via callback
  useEffect(() => {
    if (onLoadViewReady) {
      onLoadViewReady(loadViewState);
    }
  }, [onLoadViewReady, loadViewState]);

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
        // Invalidate the views cache so next load gets fresh data
        if (foundationIdNumeric) {
          invalidateCache(foundationIdNumeric);
        }
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

  // Extract display value from lookup objects (e.g., { id: 1, name: "House" } -> "House")
  // Memoized outside evaluateFilter for performance
  const getFilterDisplayValue = useCallback((val: unknown): unknown => {
    if (typeof val === 'object' && val !== null) {
      const obj = val as { display?: string; name?: string; id?: number };
      return obj.display || obj.name || obj.id;
    }
    return val;
  }, []);

  // Evaluate a single filter against an entry
  const evaluateFilter = useCallback(
    (entry: TableRowType, filter: CascadeFilter): boolean => {
      const rawValue = entry[filter.column];
      const filterValue = filter.value;
      const value = getFilterDisplayValue(rawValue);

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
    [getFilterDisplayValue]
  );

  // Filter and sort entries
  const filteredAndSortedEntries = useMemo(() => {
    const startTime = performance.now();
    let result = [...entries];

    // Apply search filter (client-side if no server search)
    // Uses fuzzy matching to handle typos like "coasal" -> "coastal"
    if (search && !onServerSearch) {
      result = result.filter((entry) => {
        return COLUMNS.some((col) => {
          if (col.key === "select" || col.key === "actions") return false;
          const value = entry[col.key];
          if (value == null) return false;
          // Use fuzzy match for typo tolerance
          return fuzzyMatch(search, String(value));
        });
      });
    }

    // Apply cascade filters
    if (safeFilters.length > 0) {
      // Pre-compute filter groups ONCE outside the row loop (performance optimization)
      const filtersByGroup = safeFilters.reduce((acc, filter) => {
        const groupId = filter.groupId || "default";
        if (!acc[groupId]) acc[groupId] = [];
        acc[groupId].push(filter);
        return acc;
      }, {} as Record<string, CascadeFilter[]>);

      // Pre-compute group logic map for O(1) lookup
      const groupLogicMap = new Map(filterGroups.map(g => [g.id, g.logic]));
      const groupEntries = Object.entries(filtersByGroup);

      result = result.filter((entry) => {
        // Evaluate each group
        const groupResults = groupEntries.map(
          ([groupId, filters]) => {
            const logic = groupLogicMap.get(groupId) || "AND";

            if (logic === "AND") {
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
        for (const { column, dir, customOrder } of sortColumns) {
          const aVal = a[column];
          const bVal = b[column];

          if (aVal == null && bVal == null) continue;
          if (aVal == null) return dir === "asc" ? 1 : -1;
          if (bVal == null) return dir === "asc" ? -1 : 1;

          // Get display values (handle lookup objects)
          const getDisplayVal = (val: unknown): string => {
            if (typeof val === 'object' && val !== null) {
              const obj = val as { display?: string; name?: string; id?: number };
              return obj.display || obj.name || String(obj.id || '');
            }
            return String(val);
          };

          const aDisplay = getDisplayVal(aVal);
          const bDisplay = getDisplayVal(bVal);

          let comparison = 0;

          if (dir === "custom" && customOrder && customOrder.length > 0) {
            // Custom sort order - use position in customOrder array
            const aIndex = customOrder.indexOf(aDisplay);
            const bIndex = customOrder.indexOf(bDisplay);
            // Items not in custom order go to the end
            const aPos = aIndex === -1 ? customOrder.length : aIndex;
            const bPos = bIndex === -1 ? customOrder.length : bIndex;
            comparison = aPos - bPos;
          } else if (typeof aVal === "number" && typeof bVal === "number") {
            comparison = aVal - bVal;
          } else {
            comparison = aDisplay.localeCompare(bDisplay);
          }

          if (comparison !== 0) {
            return dir === "desc" ? -comparison : comparison;
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

  // Limit displayed rows for performance (initial render shows INITIAL_ROW_LIMIT rows)
  const displayedRows = useMemo(() => {
    if (showAllRows || filteredAndSortedEntries.length <= INITIAL_ROW_LIMIT) {
      return filteredAndSortedEntries;
    }
    return filteredAndSortedEntries.slice(0, rowLimit);
  }, [filteredAndSortedEntries, rowLimit, showAllRows, INITIAL_ROW_LIMIT]);

  // Reset row limit when filters/sort change
  useEffect(() => {
    setRowLimit(INITIAL_ROW_LIMIT);
    setShowAllRows(false);
  }, [cascadeFilters, sortColumns, search, INITIAL_ROW_LIMIT]);

  // Drag-to-select handlers (must be after filteredAndSortedEntries)
  const handleSelectMouseDown = useCallback((rowId: number | string, rowIndex: number, e: React.MouseEvent) => {
    // Don't start drag immediately - wait to see if mouse moves
    // This allows single clicks to work normally
    dragStateRef.current = {
      isDragging: false, // Will become true only if mouse moves
      startRowId: rowId,
      startRowIndex: rowIndex,
      currentRowId: rowId,
      startX: e.clientX,
      startY: e.clientY,
    };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStateRef.current || dragStateRef.current.isDragging) return;

    // Check if mouse has moved enough to start dragging
    const deltaX = Math.abs(e.clientX - dragStateRef.current.startX);
    const deltaY = Math.abs(e.clientY - dragStateRef.current.startY);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Start dragging if moved more than 5 pixels
    if (distance > 5) {
      dragStateRef.current.isDragging = true;
    }
  }, []);

  // Store reference to the actual handler that will be set up later
  const handleRowMouseEnterRef = useRef<((rowId: number | string, rowIndex: number) => void) | null>(null);

  const handleRowMouseEnter = useCallback((rowId: number | string, rowIndex: number) => {
    if (handleRowMouseEnterRef.current) {
      handleRowMouseEnterRef.current(rowId, rowIndex);
    }
  }, []);

  // Store getVisibleRowIds function in a ref so handleMouseUp can access it
  const getVisibleRowIdsRef = useRef<(() => (number | string)[]) | null>(null);

  const handleMouseUp = useCallback(() => {
    if (!dragStateRef.current?.isDragging) {
      dragStateRef.current = null;
      return;
    }

    // Process the drag selection now that drag is complete
    const { startRowId, currentRowId } = dragStateRef.current;

    if (startRowId && currentRowId && getVisibleRowIdsRef.current) {
      const visibleRowIds = getVisibleRowIdsRef.current();
      const startIndex = visibleRowIds.indexOf(startRowId);
      const endIndex = visibleRowIds.indexOf(currentRowId);

      if (startIndex !== -1 && endIndex !== -1) {
        // Select ALL rows in the range
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);
        const rowsInRange = visibleRowIds.slice(minIndex, maxIndex + 1);

        setSelectedRows((prev) => {
          const next = new Set(prev);
          rowsInRange.forEach((id) => next.add(id));
          return next;
        });
      }
    }

    dragStateRef.current = null;
  }, []);

  // Attach global mouse listeners for drag
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Helper to extract display value from a cell (handles objects with display/name properties)
  const getDisplayValue = useCallback((value: unknown): string => {
    if (value === null || value === undefined) return "No Value";
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      return String(obj.display || obj.display_value || obj.name || obj.id || "No Value");
    }
    return String(value);
  }, []);

  // Nested group structure type
  type NestedGroup = {
    rows: TableRowType[];
    subgroups?: Record<string, NestedGroup>;
  };

  // Group entries hierarchically if grouping is enabled (supports nested group columns)
  const groupedEntries = useMemo((): Record<string, NestedGroup> | null => {
    if (groupByColumns.length === 0) {
      return null;
    }

    const startTime = performance.now();

    const buildNestedGroups = (
      entries: TableRowType[],
      columns: string[],
      depth: number = 0
    ): Record<string, NestedGroup> => {
      if (columns.length === 0 || depth >= columns.length) {
        return {};
      }

      const currentCol = columns[depth];
      const groups: Record<string, NestedGroup> = {};

      for (const entry of entries) {
        const groupKey = getDisplayValue(entry[currentCol]);
        if (!groups[groupKey]) {
          groups[groupKey] = { rows: [] };
        }
        groups[groupKey].rows.push(entry);
      }

      // If there are more columns, recursively build subgroups
      if (depth < columns.length - 1) {
        for (const [key, group] of Object.entries(groups)) {
          group.subgroups = buildNestedGroups(group.rows, columns, depth + 1);
        }
      }

      return groups;
    };

    const result = buildNestedGroups(filteredAndSortedEntries, groupByColumns, 0);
    return result;
  }, [filteredAndSortedEntries, groupByColumns, getDisplayValue]);

  // Expand/collapse all group handlers (must be after groupedEntries)
  const expandAllGroups = useCallback(() => {
    if (groupedEntries && collapsedGroups.size > 0) {
      // Get all group keys
      const allKeys = getAllGroupKeys(groupedEntries);
      const firstKey = allKeys[0];

      // Expand first group immediately for instant feedback
      const newCollapsed = new Set(collapsedGroups);
      newCollapsed.delete(firstKey);
      setCollapsedGroups(newCollapsed);

      // Then expand the rest off-screen
      requestAnimationFrame(() => {
        setCollapsedGroups(new Set());
      });
    } else {
      // Already expanded, just clear
      setCollapsedGroups(new Set());
    }
     
  }, [groupedEntries, collapsedGroups, getAllGroupKeys]);

  const collapseAllGroups = useCallback(() => {
    if (groupedEntries) {
      const allKeys = getAllGroupKeys(groupedEntries);
      setCollapsedGroups(new Set(allKeys));
    }
     
  }, [groupedEntries, getAllGroupKeys]);

  // Helper to get visible (non-collapsed) row IDs in grouped tables
  const getVisibleRowIds = useCallback(() => {
    const visibleRowIds: (number | string)[] = [];

    if (groupedEntries) {
      const collectVisibleRows = (
        groups: Record<string, { rows: any[]; subgroups?: any }>,
        parentKey: string = ""
      ) => {
        Object.entries(groups).forEach(([groupKey, group]) => {
          const fullKey = parentKey ? `${parentKey}›${groupKey}` : groupKey;
          const isCollapsed = collapsedGroups.has(fullKey);

          if (!isCollapsed) {
            if (group.subgroups && Object.keys(group.subgroups).length > 0) {
              collectVisibleRows(group.subgroups, fullKey);
            } else {
              visibleRowIds.push(...group.rows.map(r => r.id));
            }
          }
        });
      };
      collectVisibleRows(groupedEntries);
    } else {
      visibleRowIds.push(...filteredAndSortedEntries.map(r => r.id));
    }

    return visibleRowIds;
  }, [groupedEntries, collapsedGroups, filteredAndSortedEntries]);

  // Set up the drag-to-select handlers now that getVisibleRowIds is available
  useEffect(() => {
    // Store the getVisibleRowIds function so handleMouseUp can access it
    getVisibleRowIdsRef.current = getVisibleRowIds;

    // Set up the mouse enter handler
    handleRowMouseEnterRef.current = (rowId: number | string, _rowIndex: number) => {
      if (!dragStateRef.current?.isDragging) return;

      // Just store the current row ID - don't update selection state yet
      // This prevents multiple expensive re-renders during drag
      dragStateRef.current.currentRowId = rowId;
    };
  }, [getVisibleRowIds]);

  // Auto-expand all groups when searching/filtering
  useEffect(() => {
    if (search.trim() && groupedEntries) {
      // Expand all groups when there's a search term
      setCollapsedGroups(new Set());
    }
     
  }, [search, groupedEntries]);

  // Handle pending collapse-all when groupedEntries is ready
  useEffect(() => {
    if (groupedEntries && collapsedGroups.has('__collapse_all_pending__')) {
      const allKeys = getAllGroupKeys(groupedEntries);
      setCollapsedGroups(new Set(allKeys));
    }
     
  }, [groupedEntries, collapsedGroups, getAllGroupKeys]);

  // Get visible columns in order
  const visibleColumnsInOrder = useMemo(() => {
    const startTime = performance.now();
    console.log('[visibleColumnsInOrder] columnOrder:', columnOrder);
    console.log('[visibleColumnsInOrder] visibleColumns:', visibleColumns);
    // Start with columns from columnOrder that are visible
    const orderedVisible = columnOrder
      .filter((key) => visibleColumns[key] === true)
      .map((key) => COLUMNS.find((c) => c.key === key))
      .filter((col): col is TableColumn => col !== undefined);
    console.log('[visibleColumnsInOrder] result:', orderedVisible.map(c => c.key));

    // Ensure select is always first if it exists in COLUMNS
    const selectCol = COLUMNS.find(c => c.key === 'select');
    const hasSelectInOrder = orderedVisible.some(c => c.key === 'select');
    if (selectCol && !hasSelectInOrder) {
      orderedVisible.unshift(selectCol);
    }

    // Ensure actions is always last if it exists in COLUMNS
    const actionsCol = COLUMNS.find(c => c.key === 'actions');
    const hasActionsInOrder = orderedVisible.some(c => c.key === 'actions');
    if (actionsCol && !hasActionsInOrder) {
      orderedVisible.push(actionsCol);
    }

    return orderedVisible;
  }, [columnOrder, visibleColumns, COLUMNS]);

  // Calculate total table width based on column widths
  const totalTableWidth = useMemo(() => {
    return visibleColumnsInOrder.reduce((sum, col) => {
      return sum + (columnWidths[col.key] || col.width || 50);
    }, 0);
  }, [visibleColumnsInOrder, columnWidths]);

  // Get all data columns (excluding select and actions)
  const allDataColumns = useMemo(() => {
    return COLUMNS.filter((c) => c.key !== "select" && c.key !== "actions");
  }, [COLUMNS]);

  // Calculate optimal column widths based on content using actual text measurement
  const calculateAutoFitWidths = useCallback(() => {
    const newWidths: ColumnWidthsState = {};
    const HEADER_PADDING = 28; // Sort icon + some breathing room
    const CELL_PADDING = 24; // px-3 on each side = 24px total
    const MIN_WIDTH = 40;
    const MAX_WIDTH = 500;

    // Create a hidden canvas for measuring text width
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      // Fallback to character-based estimation if canvas not available
      visibleColumnsInOrder.forEach(col => {
        newWidths[col.key] = col.width || 150;
      });
      return newWidths;
    }

    // Set fonts matching our table styles
    const headerFont = '600 14px ui-sans-serif, system-ui, sans-serif'; // semibold header
    const cellFont = '14px ui-sans-serif, system-ui, sans-serif'; // normal cell

    visibleColumnsInOrder.forEach(col => {
      // Skip select and actions columns - they have fixed widths
      if (col.key === 'select') {
        newWidths[col.key] = 40;
        return;
      }
      if (col.key === 'actions') {
        newWidths[col.key] = 60;
        return;
      }

      // Measure header width
      ctx.font = headerFont;
      const headerText = col.label || col.key;
      let maxWidth = ctx.measureText(headerText).width + HEADER_PADDING;

      // Measure content widths from first 100 rows (for performance)
      ctx.font = cellFont;
      const sampleRows = filteredAndSortedEntries.slice(0, 100);
      sampleRows.forEach(row => {
        const value = row[col.key];
        let displayText = '';

        if (value === null || value === undefined) {
          displayText = '-';
        } else if (typeof value === 'object') {
          // Handle lookup objects
          const obj = value as { display?: string; name?: string };
          displayText = obj.display || obj.name || String(value);
        } else {
          displayText = String(value);
        }

        // Format currency/percentage for width calculation
        if (col.column_type === 'currency' && typeof value === 'number') {
          displayText = `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        } else if (col.column_type === 'percentage' && typeof value === 'number') {
          displayText = `${value.toFixed(1)}%`;
        }

        const contentWidth = ctx.measureText(displayText).width + CELL_PADDING;
        maxWidth = Math.max(maxWidth, contentWidth);
      });

      // Clamp to min/max
      newWidths[col.key] = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.ceil(maxWidth)));
    });

    return newWidths;
  }, [visibleColumnsInOrder, filteredAndSortedEntries]);

  // Calculate TEEEM Smart widths based on column priority
  const calculateSmartFitWidths = useCallback(() => {
    const newWidths: ColumnWidthsState = {};
    const HEADER_PADDING = 28;
    const CELL_PADDING = 24;

    // Create canvas for measurement (only for essential columns)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const headerFont = '600 14px ui-sans-serif, system-ui, sans-serif';
    const cellFont = '14px ui-sans-serif, system-ui, sans-serif';

    // Helper function to get type-based default width
    const getTypeBasedWidth = (col: TableColumn): number => {
      const type = col.column_type?.toLowerCase() || 'text';
      switch (type) {
        case 'id': return 60;
        case 'boolean': return 80;
        case 'date': return 100;
        case 'date_time':
        case 'datetime': return 150;
        case 'currency':
        case 'percentage':
        case 'number':
        case 'decimal':
        case 'whole_number': return 100;
        case 'phone':
        case 'mobile': return 120;
        case 'email':
        case 'url': return 200;
        case 'choice':
        case 'lookup':
        case 'relation': return 150;
        case 'multiple_lookups': return 200;
        case 'text':
        case 'single_line_text': return 150;
        case 'multiple_lines_text':
        case 'textarea': return 250;
        default: return 150;
      }
    };

    // Helper to measure column width using canvas
    const measureColumnWidth = (col: TableColumn): number => {
      if (!ctx) return getTypeBasedWidth(col);

      ctx.font = headerFont;
      const headerText = col.label || col.key;
      let maxWidth = ctx.measureText(headerText).width + HEADER_PADDING;

      ctx.font = cellFont;
      const sampleRows = filteredAndSortedEntries.slice(0, 100);
      sampleRows.forEach(row => {
        const value = row[col.key];
        let displayText = '';

        if (value === null || value === undefined) {
          displayText = '-';
        } else if (typeof value === 'object') {
          const obj = value as { display?: string; name?: string };
          displayText = obj.display || obj.name || String(value);
        } else {
          displayText = String(value);
        }

        if (col.column_type === 'currency' && typeof value === 'number') {
          displayText = `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        } else if (col.column_type === 'percentage' && typeof value === 'number') {
          displayText = `${value.toFixed(1)}%`;
        }

        const contentWidth = ctx.measureText(displayText).width + CELL_PADDING;
        maxWidth = Math.max(maxWidth, contentWidth);
      });

      return Math.ceil(maxWidth);
    };

    visibleColumnsInOrder.forEach(col => {
      // Get priority tier for this column
      const priority = getColumnPriority(col.key, col.column_type);
      const config = COLUMN_PRIORITY_CONFIG[priority];

      // Skip hidden columns
      if (priority === 'hidden') return;

      // Special handling for select/actions
      if (col.key === 'select') {
        newWidths[col.key] = 40;
        return;
      }
      if (col.key === 'actions') {
        newWidths[col.key] = 60;
        return;
      }

      // For essential: use full auto-fit calculation (canvas measurement)
      if (priority === 'essential') {
        const measuredWidth = measureColumnWidth(col);
        newWidths[col.key] = Math.max(config.minWidth, Math.min(config.maxWidth, measuredWidth));
        return;
      }

      // For technical: use minimal width (will truncate and show on hover)
      if (priority === 'technical') {
        newWidths[col.key] = config.minWidth;
        return;
      }

      // For supporting: use type-based optimal width
      if (priority === 'supporting') {
        const typeWidth = getTypeBasedWidth(col);
        newWidths[col.key] = Math.max(config.minWidth, Math.min(config.maxWidth, typeWidth));
        return;
      }
    });

    // Calculate total width of all columns
    const totalColumnsWidth = Object.values(newWidths).reduce((sum, width) => sum + width, 0);

    // Get available table width (subtract scrollbar width ~17px)
    const tableWidth = tableContainerRef.current?.clientWidth || 0;
    const availableWidth = tableWidth - 17; // Account for scrollbar

    // If columns don't fill the page, expand them proportionally
    if (totalColumnsWidth > 0 && availableWidth > totalColumnsWidth) {
      const expansionRatio = availableWidth / totalColumnsWidth;

      // Expand all columns proportionally to fill the page
      Object.keys(newWidths).forEach(key => {
        newWidths[key] = Math.floor(newWidths[key] * expansionRatio);
      });
    }

    return newWidths;
  }, [visibleColumnsInOrder, filteredAndSortedEntries]);

  // Apply smart-fit or auto-fit widths when enabled
  useEffect(() => {
    if (smartFit && filteredAndSortedEntries.length > 0) {
      // TEEEM Smart: priority-based intelligent widths
      const smartWidths = calculateSmartFitWidths();
      setColumnWidths(smartWidths);
    } else if (autoFitColumns && filteredAndSortedEntries.length > 0) {
      // Auto-fit: content-based widths (all columns treated equally)
      const autoWidths = calculateAutoFitWidths();
      setColumnWidths(autoWidths);
    }

  }, [smartFit, autoFitColumns, calculateSmartFitWidths, calculateAutoFitWidths, visibleColumnsInOrder]);

  // Watch for container resize and recalculate widths when TEEEM Smart is enabled
  useEffect(() => {
    if (!smartFit || !tableContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (filteredAndSortedEntries.length > 0) {
        const smartWidths = calculateSmartFitWidths();
        setColumnWidths(smartWidths);
      }
    });

    resizeObserver.observe(tableContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [smartFit, calculateSmartFitWidths, filteredAndSortedEntries]);

  // Get visible data columns (excluding select and actions)
  const visibleDataColumns = useMemo(() => {
    return visibleColumnsInOrder.filter((c) => c.key !== "select" && c.key !== "actions");
  }, [visibleColumnsInOrder]);

  // Calculate column totals for numeric columns
  const columnTotals = useMemo(() => {
    const numericTypes = ['number', 'whole_number', 'currency', 'percentage', 'computed'];
    const skipColumns = ['id', 'select', 'actions', 'latitude', 'longitude', 'lat', 'lng', 'long', 'design_id', 'user_id']; // Never show totals for these
    const totals: Record<string, { value: number; type: string; label: string; isAverage: boolean }> = {};

    visibleDataColumns.forEach(col => {
      if (col.column_type && numericTypes.includes(col.column_type) && !skipColumns.includes(col.key)) {
        let count = 0;
        const sum = filteredAndSortedEntries.reduce((acc, row) => {
          const val = row[col.key];
          const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
          if (!isNaN(num)) {
            count++;
            return acc + num;
          }
          return acc;
        }, 0);

        // Percentages show average, others show sum
        const isAverage = col.column_type === 'percentage';
        const value = isAverage && count > 0 ? sum / count : sum;

        totals[col.key] = {
          value,
          type: col.column_type,
          label: col.label || col.key,
          isAverage,
        };
      }
    });

    return totals;
  }, [visibleDataColumns, filteredAndSortedEntries]);

  // Format total value based on column type
  const formatTotal = (key: string): string | null => {
    const total = columnTotals[key];
    if (!total) return null;

    switch (total.type) {
      case 'currency':
        return `$${total.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'percentage':
        return `${total.value.toFixed(1)}% avg`;
      case 'whole_number':
        return total.value.toLocaleString(undefined, { maximumFractionDigits: 0 });
      default:
        return total.value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
  };

  // ============================================================================
  // TABLE HANDLERS (Phase 5 refactoring - extracted to useTableHandlers hook)
  // ============================================================================

  const tableHandlers = useTableHandlers({
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
    entries,
    setShowMergeModal,
  });

  // Destructure table handlers
  const {
    getDefaultVisibleColumns: getDefaultVisibleColumnsFromHook,
    handleColumnResize: handleColumnResizeFromHook,
    hideColumn: hideColumnFromHook,
    handleColumnDragEnd: handleColumnDragEndFromHook,
    reorderColumnToPosition: reorderColumnToPositionFromHook,
    getSortedColumnsForModal: getSortedColumnsForModalFromHook,
    handleSearchFromInput: handleSearchFromInputFromHook,
    handleSearchAllChange: handleSearchAllChangeFromHook,
    handleSort: handleSortFromHook,
    addFilter: addFilterFromHook,
    addFilterForColumn: addFilterForColumnFromHook,
    updateFilter: updateFilterFromHook,
    removeFilter: removeFilterFromHook,
    clearAllFilters: clearAllFiltersFromHook,
    handleGroupByColumn: handleGroupByColumnFromHook,
    toggleGroupCollapse: toggleGroupCollapseFromHook,
    getAllGroupKeys: getAllGroupKeysFromHook,
    expandAllGroups: expandAllGroupsFromHook,
    collapseAllGroups: collapseAllGroupsFromHook,
    toggleRowSelection: toggleRowSelectionFromHook,
    toggleSelectAll: toggleSelectAllFromHook,
    handleMergeClick: handleMergeClickFromHook,
    handleMergeComplete: handleMergeCompleteFromHook,
    getStickyColumnStyles: getStickyColumnStylesFromHook,
    calculateAutoFitWidths: calculateAutoFitWidthsFromHook,
    getDisplayValue: getDisplayValueFromHook,
  } = tableHandlers;

  // ============================================================================
  // EXPORT HANDLERS (Phase 5 refactoring - extracted to useExportHandlers hook)
  // ============================================================================

  const exportHandlers = useExportHandlers({
    exportScope,
    visibleDataColumns,
    allDataColumns,
    filteredAndSortedEntries,
    tableName,
    toast,
    onExportComplete: () => setShowExportModal(false),
  });

  const { handleExportCSV, handleExportExcel, handleExportPDF } = exportHandlers;

  // Master export handler that routes to the correct format
  const handleExport = useCallback(() => {
    exportHandlers.handleExport(exportFormat);
  }, [exportFormat, exportHandlers]);

  // ============================================================================
  // SCHEMA HANDLERS (Phase 5 refactoring - extracted to useSchemaHandlers hook)
  // ============================================================================

  const schemaHandlers = useSchemaHandlers({
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
  });

  const {
    handleCreateColumn,
    handleDeleteColumn,
    handleOpenColumnEdit,
    handleSaveColumnChanges,
    handleCopyTableId,
    toggleColumnEditMode,
  } = schemaHandlers;

  // ============================================================================
  // CELL RENDERING
  // ============================================================================

  /**
   * Main cell renderer - routes to appropriate component based on column type
   * Uses ColumnRenderer registry for display mode (SSoT pattern)
   * Not memoized to ensure select column always has latest selectedRows state
   */
  const renderCellValue = (entry: TableRowType, column: TableColumn) => {
      // Check for custom renderer first
      if (customCellRenderer) {
        const custom = customCellRenderer(entry, column.key);
        if (custom !== null) return custom;
      }

      const value = entry[column.key];
      const isEditing = editingRowIds.has(entry.id);
      const rowEditingData = editingData[entry.id] || {};

      // Handle special column types
      // Note: "select" column is now rendered inline in TableCell, not through this function
      switch (column.key) {
        case "actions":
          if (isEditing) {
            return (
              <EditingActionsButtons
                onSave={saveEditing}
                onCancel={cancelEditing}
              />
            );
          }
          return (
            <ActionsButtons
              entry={entry}
              viewOnly={viewOnly}
              onView={onView}
              onEdit={onEdit}
              onRowUpdate={onRowUpdate}
              onDelete={onDelete}
              onStartEditing={startEditing}
              selectedRowsCount={selectedRows.size}
            />
          );
      }

      // Inline editing mode - with column type-specific editors
      // System columns that are NEVER editable
      const NON_EDITABLE_COLUMNS = ['id', 'created_at', 'updated_at', 'select', 'actions'];
      const isComputed = column.column_type === 'computed' || column.column_type === 'formula';
      const isSystemColumn = NON_EDITABLE_COLUMNS.includes(column.key) || column.system === true;
      const isColumnEditable = column.editable !== false && !isSystemColumn && !isComputed;

      // Row-level editing (pencil icon clicked) - show editor for entire row
      if (isEditing && isColumnEditable) {
        return (
          <RowEditingCell
            entry={entry}
            column={column}
            rowEditingData={rowEditingData}
            setEditingData={setEditingData}
            validationError={validationErrors[entry.id]?.[column.key]}
            handleCellBlur={handleCellBlur}
            lookupOptions={lookupOptions}
            lookupLoading={lookupLoading}
          />
        );
      }

      // Show read-only indicator for non-editable columns when in row edit mode
      if (isEditing && !isColumnEditable) {
        // Don't show indicator for select/actions columns
        if (column.key === 'select' || column.key === 'actions') {
          // Fall through to normal rendering
        } else {
          // Show the value with a subtle indicator it's not editable
          // Use getDisplayValue to handle objects (e.g., lookup values)
          const displayValue = value == null || value === "" ? "-" : getDisplayValue(value);
          return (
            <span className="text-muted-foreground italic text-[11px]" title={isComputed ? "Computed column" : "System column - not editable"}>
              {displayValue}
            </span>
          );
        }
      }

      // Global edit mode - show clickable cells that start row editing on click
      // Cells stay as lightweight text until clicked
      if (isEditMode && isColumnEditable) {
        // Use getDisplayValue to handle objects (e.g., lookup values)
        const displayValue = value == null || value === "" ? "-" : getDisplayValue(value);
        return (
          <div
            className="cursor-text hover:bg-blue-50 dark:hover:bg-blue-950/20 px-1 py-0.5 -mx-1 -my-0.5 rounded min-h-[24px] text-[11px]"
            onClick={(e) => {
              e.stopPropagation();
              // Start editing this row when cell is clicked
              startEditing(entry);
            }}
            title="Click to edit"
          >
            {displayValue}
          </div>
        );
      }

      // Handle searchable_text - read-only search terms display
      if (column.column_type === "searchable_text" && value) {
        return (
          <span className="font-mono text-xs text-muted-foreground italic">
            🔍 {String(value).slice(0, 30)}...
          </span>
        );
      }

      // Handle action_buttons - render configured buttons
      if (column.column_type === "action_buttons" && value) {
        try {
          const config = typeof value === 'string' ? JSON.parse(value) : value;
          const buttons = config.buttons || [];
          return (
            <div className="flex gap-1">
              {buttons.slice(0, 3).map((btn: { label: string; action: string }, idx: number) => (
                <Button key={idx} variant="outline" size="sm" className="h-6 text-xs px-2">
                  {btn.label}
                </Button>
              ))}
            </div>
          );
        } catch {
          return <span className="text-muted-foreground">-</span>;
        }
      }

      // Handle Australian types with formatted display
      // ABN: XX XXX XXX XXX (11 digits)
      if (column.column_type === "abn" && value) {
        const digits = String(value).replace(/\D/g, '');
        const formatted = digits.length === 11
          ? `${digits.slice(0,2)} ${digits.slice(2,5)} ${digits.slice(5,8)} ${digits.slice(8,11)}`
          : String(value);
        return <span className="font-mono text-[11px]">{formatted}</span>;
      }

      // ACN: XXX XXX XXX (9 digits)
      if (column.column_type === "acn" && value) {
        const digits = String(value).replace(/\D/g, '');
        const formatted = digits.length === 9
          ? `${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6,9)}`
          : String(value);
        return <span className="font-mono text-[11px]">{formatted}</span>;
      }

      // BSB: XXX-XXX (6 digits)
      if (column.column_type === "bsb" && value) {
        const digits = String(value).replace(/\D/g, '');
        const formatted = digits.length === 6
          ? `${digits.slice(0,3)}-${digits.slice(3,6)}`
          : String(value);
        return <span className="font-mono text-[11px]">{formatted}</span>;
      }

      // Bank Account: up to 9 digits
      if (column.column_type === "bank_account" && value) {
        return <span className="font-mono text-[11px]">{String(value)}</span>;
      }

      // Postcode: 4 digits
      if (column.column_type === "postcode" && value) {
        return <span className="font-mono text-[11px]">{String(value).padStart(4, '0').slice(0,4)}</span>;
      }

      // TFN: XXX XXX XXX (9 digits) - show masked for security
      if (column.column_type === "tfn" && value) {
        const digits = String(value).replace(/\D/g, '');
        // Show masked: XXX XXX XXX -> *** *** XXX
        const masked = digits.length === 9
          ? `*** *** ${digits.slice(6,9)}`
          : '*** *** ***';
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-mono text-muted-foreground cursor-help text-[11px]">{masked}</span>
              </TooltipTrigger>
              <TooltipContent>
                <span className="text-[11px]">TFN hidden for security</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      // Email: clickable mailto link
      if (column.column_type === "email" && value) {
        return (
          <a
            href={`mailto:${value}`}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline text-[11px]"
            onClick={(e) => e.stopPropagation()}
            title={`Send email to ${value}`}
          >
            {String(value)}
          </a>
        );
      }

      // Phone/Mobile: clickable tel link
      if ((column.column_type === "phone" || column.column_type === "mobile") && value) {
        // Remove non-numeric characters for tel: link
        const phoneNumber = String(value).replace(/[^\d+]/g, '');
        return (
          <a
            href={`tel:${phoneNumber}`}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline text-[11px]"
            onClick={(e) => e.stopPropagation()}
            title={`Call ${value}`}
          >
            {String(value)}
          </a>
        );
      }

      // URL/Website: clickable external link
      if ((column.column_type === "url" || column.column_type === "website") && value) {
        const url = String(value);
        // Add https:// if no protocol specified
        const href = url.match(/^https?:\/\//) ? url : `https://${url}`;
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline inline-flex items-center gap-1 text-[11px]"
            onClick={(e) => e.stopPropagation()}
            title={`Open ${url}`}
          >
            {url}
            <ExternalLink className="h-3 w-3" />
          </a>
        );
      }

      // Default: render as string with priority-based truncation
      // Handle null/undefined values - show empty string instead of "null"/"undefined"
      if (value == null || value === "") {
        return <span className="text-muted-foreground text-[11px]">—</span>;
      }

      // Extract display value (handles objects like lookup values)
      // For objects like {id: 123, name: "Company"}, this extracts "Company"
      const strValue = getDisplayValue(value);

      // Get priority for smart truncation
      const priority = getColumnPriority(column.key, column.column_type);
      const config = COLUMN_PRIORITY_CONFIG[priority];

      // Apply priority-based truncation
      if (config.truncateAt !== null && strValue.length > config.truncateAt) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate block text-[11px]">
                  {strValue.slice(0, config.truncateAt)}...
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-md">
                <p className="whitespace-pre-wrap text-[11px]">{strValue}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      // For essential/supporting: show full text with CSS truncation if needed
      return <span className="truncate block text-[11px]">{strValue}</span>;
    };

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================

  // Helper function to compute sticky column styles
  // Returns position:sticky and left offset based on cumulative widths of previous sticky columns
  const getStickyColumnStyles = useCallback((columnKey: string, isHeader: boolean = false): React.CSSProperties => {
    const stickyIndex = STICKY_COLUMNS.indexOf(columnKey);

    // Actions column - sticky to right
    if (columnKey === 'actions') {
      return {
        position: 'sticky',
        right: 0,
        zIndex: isHeader ? 50 : 20,
        background: isHeader ? 'hsl(40, 11%, 89%)' : 'hsl(40, 11%, 95%)',
        boxShadow: '-2px 0 4px rgba(0,0,0,0.1)',
      };
    }

    // Not a sticky column
    if (stickyIndex === -1) {
      return {};
    }

    // Calculate left position based on cumulative widths of previous sticky columns
    let leftPosition = 0;
    for (let i = 0; i < stickyIndex; i++) {
      const prevColumnKey = STICKY_COLUMNS[i];
      // Check if previous sticky column is actually visible
      if (visibleColumnsInOrder.some(c => c.key === prevColumnKey)) {
        leftPosition += columnWidths[prevColumnKey] || (prevColumnKey === 'select' ? 40 : 100);
      }
    }

    // Determine if this is the last visible sticky column (for shadow effect)
    const visibleStickyColumns = STICKY_COLUMNS.filter(key =>
      visibleColumnsInOrder.some(c => c.key === key)
    );
    const isLastSticky = visibleStickyColumns[visibleStickyColumns.length - 1] === columnKey;

    return {
      position: 'sticky',
      left: leftPosition,
      zIndex: isHeader ? 30 : 10,
      background: isHeader ? 'hsl(40, 11%, 89%)' : 'hsl(40, 11%, 95%)',
      boxShadow: isLastSticky ? '2px 0 4px rgba(0,0,0,0.1)' : undefined,
    };
  }, [STICKY_COLUMNS, visibleColumnsInOrder, columnWidths]);

  // Render table header
  // Table header render (Phase 6 refactoring - extracted to TableHeaderSection component)
  const renderTableHeader = () => (
    <TableHeaderSection
      visibleColumnsInOrder={visibleColumnsInOrder}
      columnWidths={columnWidths}
      selectedRows={selectedRows}
      filteredAndSortedEntries={filteredAndSortedEntries}
      sortColumns={sortColumns}
      groupByColumn={groupByColumn}
      columnEditMode={columnEditMode}
      toggleSelectAll={toggleSelectAll}
      handleColumnResize={handleColumnResize}
      handleSort={handleSort}
      hideColumn={hideColumn}
      handleGroupByColumn={handleGroupByColumn}
      addFilterForColumn={addFilterForColumn}
      handleOpenColumnEdit={handleOpenColumnEdit}
      getStickyColumnStyles={getStickyColumnStyles}
      isSystemGeneratedColumn={isSystemGeneratedColumn}
    />
  );

  // Table footer render (Phase 6 refactoring - extracted to TableFooterSection component)
  const renderTableFooter = (rows: TableRowType[] = filteredAndSortedEntries) => (
    <TableFooterSection
      visibleColumnsInOrder={visibleColumnsInOrder}
      columnWidths={columnWidths}
      rows={rows}
      getStickyColumnStyles={getStickyColumnStyles}
    />
  );

  // Pre-compute row ID to global index map for O(1) lookups (avoids expensive findIndex calls)
  const rowIdToGlobalIndex = useMemo(() => {
    const map = new Map<number | string, number>();
    filteredAndSortedEntries.forEach((entry, index) => {
      map.set(entry.id, index);
    });
    return map;
  }, [filteredAndSortedEntries]);

  // Render group navigation with nested data tables (Panel mode)
  const renderGroupNavigation = (
    groups: Record<string, { rows: TableRowType[]; subgroups?: Record<string, { rows: TableRowType[]; subgroups?: Record<string, unknown> }> }>,
    depth: number = 0,
    parentKey: string = ""
  ): React.ReactNode[] => {
    const currentColKey = groupByColumns[depth];
    const currentColLabel = COLUMNS.find((c) => c.key === currentColKey)?.label || currentColKey;
    const result: React.ReactNode[] = [];

    Object.entries(groups).forEach(([groupKey, group]) => {
      const fullKey = parentKey ? `${parentKey}›${groupKey}` : groupKey;
      const isCollapsed = collapsedGroups.has(fullKey);
      const rowCount = group.rows.length;
      const hasSubgroups = group.subgroups && Object.keys(group.subgroups).length > 0;

      // Group header
      result.push(
        <div
          key={`nav-${fullKey}`}
          className="cursor-pointer hover:opacity-80 py-2 px-4 border rounded-md mb-2"
          style={{
            paddingLeft: `${16 + depth * 24}px`,
            backgroundColor: `rgba(242, 241, 239, ${Math.max(0.15, 0.95 - depth * 0.30)})` // Brand secondary #F2F1EF: dramatic contrast between levels
          }}
          onClick={() => toggleGroupCollapse(fullKey)}
        >
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <span className="font-bold text-[13px]">
              {groupKey}
            </span>
            <span className="text-xs bg-white px-2 py-0.5 rounded">({rowCount})</span>
          </div>
        </div>
      );

      // If not collapsed, render content
      if (!isCollapsed) {
        if (hasSubgroups) {
          // Render subgroups recursively
          result.push(...renderGroupNavigation(group.subgroups as typeof groups, depth + 1, fullKey));
        } else {
          // Render data table for this group's rows with virtualization
          result.push(
            <VirtualizedGroupTable
              key={`data-${fullKey}`}
              fullKey={fullKey}
              depth={depth}
              rows={group.rows}
              selectedRows={selectedRows}
              visibleColumnsInOrder={visibleColumnsInOrder}
              columnWidths={columnWidths}
              rowIdToGlobalIndex={rowIdToGlobalIndex}
              getStickyColumnStyles={getStickyColumnStyles}
              isSystemGeneratedColumn={isSystemGeneratedColumn}
              SYSTEM_COLUMN_BG={SYSTEM_COLUMN_BG}
              getToggleCallback={getToggleCallback}
              handleSelectMouseDown={handleSelectMouseDown}
              handleRowMouseEnter={handleRowMouseEnter}
              onRowClick={onRowClick}
              onRowDoubleClick={onRowDoubleClick}
              renderCellValue={renderCellValue}
              renderTableHeader={renderTableHeader}
              isEditMode={isEditMode}
            />
          );
        }
      }
    });

    return result;
  };

  // Get the rows that should be visible based on currently expanded groups
  const getVisibleRows = useCallback((): TableRowType[] => {
    if (!groupedEntries) return [];

    const visibleRows: TableRowType[] = [];

    const collectRows = (
      groups: Record<string, { rows: TableRowType[]; subgroups?: Record<string, { rows: TableRowType[]; subgroups?: Record<string, unknown> }> }>,
      parentKey: string = ""
    ) => {
      Object.entries(groups).forEach(([groupKey, group]) => {
        const fullKey = parentKey ? `${parentKey}›${groupKey}` : groupKey;
        const isCollapsed = collapsedGroups.has(fullKey);

        if (!isCollapsed) {
          if (group.subgroups && Object.keys(group.subgroups).length > 0) {
            collectRows(group.subgroups as typeof groups, fullKey);
          } else {
            visibleRows.push(...group.rows);
          }
        }
      });
    };

    collectRows(groupedEntries);
    return visibleRows;
  }, [groupedEntries, collapsedGroups]);

  // Render data rows for the table body
  const renderDataRows = () => {
    const rows = getVisibleRows();

    if (rows.length === 0) {
      return (
        <TableRow>
          <TableCell
            colSpan={visibleColumnsInOrder.length}
            className="h-24 text-center text-muted-foreground"
          >
            Expand a group above to see data
          </TableCell>
        </TableRow>
      );
    }

    return rows.map((row, rowIndex) => {
      const globalIndex = filteredAndSortedEntries.findIndex(e => e.id === row.id);
      return (
      <TableRow
        key={`row-${row.id}-${rowIndex}`}
        className={cn(
          selectedRows.has(row.id) && "bg-muted/50",
          "hover:bg-muted/30 cursor-pointer"
        )}
        onClick={() => !isEditMode && onRowClick?.(row)}
        onDoubleClick={() => !isEditMode && onRowDoubleClick?.(row)}
        onMouseEnter={() => handleRowMouseEnter(row.id, globalIndex)}
      >
        {visibleColumnsInOrder.map((column, colIndex) => {
          const stickyStyles = getStickyColumnStyles(column.key, false);
          const isSystemGen = isSystemGeneratedColumn(column);
          return (
            <TableCell
              key={`${column.key}-${colIndex}`}
              style={{
                width: columnWidths[column.key],
                minWidth: columnWidths[column.key],
                ...stickyStyles,
                ...(column.key === "select" && {
                  textAlign: 'center',
                  verticalAlign: 'middle',
                }),
                ...(isSystemGen && column.key !== "select" && column.key !== "actions" && {
                  backgroundColor: SYSTEM_COLUMN_BG,
                }),
              }}
              className={cn(
                column.key === "select" && "!border-r-0 !p-0 !h-full !bg-white",
                column.key === "actions" && "!border-l-0 !bg-white"
              )}
              onClick={(e) => {
                if (column.key === "select") {
                  e.stopPropagation();
                }
              }}
            >
              {column.key === "select" ? (
                <div
                  data-column="select"
                  onMouseDown={(e) => handleSelectMouseDown(row.id, globalIndex, e)}
                >
                  <SelectCheckbox
                    checked={selectedRows.has(row.id)}
                    onCheckedChange={getToggleCallback(row.id)}
                  />
                </div>
              ) : (
                renderCellValue(row, column)
              )}
            </TableCell>
          );
        })}
      </TableRow>
      );
    });
  };

  // Render inline group rows (old style - groups mixed with data in table body)
  const renderInlineGroupRows = (
    groups: Record<string, { rows: TableRowType[]; subgroups?: Record<string, { rows: TableRowType[]; subgroups?: Record<string, unknown> }> }>,
    depth: number = 0,
    parentKey: string = ""
  ): React.ReactNode[] => {
    const currentColKey = groupByColumns[depth];
    const currentColLabel = COLUMNS.find((c) => c.key === currentColKey)?.label || currentColKey;
    const result: React.ReactNode[] = [];

    Object.entries(groups).forEach(([groupKey, group]) => {
      const fullKey = parentKey ? `${parentKey}›${groupKey}` : groupKey;
      const isCollapsed = collapsedGroups.has(fullKey);
      const rowCount = group.rows.length;

      // Add group header row
      result.push(
        <TableRow
          key={`group-${fullKey}`}
          className="cursor-pointer hover:opacity-80"
          style={{
            backgroundColor: `rgba(242, 241, 239, ${Math.max(0.15, 0.95 - depth * 0.30)})` // Brand secondary #F2F1EF: dramatic contrast between levels
          }}
          onClick={() => toggleGroupCollapse(fullKey)}
        >
          <TableCell
            colSpan={visibleColumnsInOrder.length}
            className="py-2"
            style={{ paddingLeft: `${16 + depth * 24}px` }}
          >
            <div className="flex items-center gap-2">
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              <span className="font-bold text-[13px]">
                {groupKey}
              </span>
              <span className="text-xs bg-white px-2 py-0.5 rounded">({rowCount})</span>
            </div>
          </TableCell>
        </TableRow>
      );

      // If not collapsed, add content
      if (!isCollapsed) {
        if (group.subgroups && Object.keys(group.subgroups).length > 0) {
          // Render subgroups recursively
          result.push(...renderInlineGroupRows(group.subgroups as typeof groups, depth + 1, fullKey));
        } else {
          // Render actual data rows
          group.rows.forEach((row, rowIndex) => {
            const globalIndex = filteredAndSortedEntries.findIndex(e => e.id === row.id);
            result.push(
              <TableRow
                key={`${fullKey}-row-${row.id}-${rowIndex}`}
                className={cn(
                  selectedRows.has(row.id) && "bg-muted/50",
                  "hover:bg-muted/30 cursor-pointer"
                )}
                onClick={() => !isEditMode && onRowClick?.(row)}
                onDoubleClick={() => !isEditMode && onRowDoubleClick?.(row)}
                onMouseEnter={() => handleRowMouseEnter(row.id, globalIndex)}
              >
                {visibleColumnsInOrder.map((column, colIndex) => {
                  const isSystemGen = isSystemGeneratedColumn(column);
                  return (
                  <TableCell
                    key={`${column.key}-${colIndex}`}
                    style={{
                      width: columnWidths[column.key],
                      minWidth: columnWidths[column.key],
                      ...(column.key === "select" && {
                        position: 'sticky',
                        left: 0,
                        zIndex: 10,
                        background: 'hsl(40, 11%, 95%)',
                        boxShadow: '1px 0 0 #d4d4d4',
                      }),
                      ...(column.key === "actions" && {
                        position: 'sticky',
                        right: 0,
                        zIndex: 10,
                        background: 'hsl(40, 11%, 95%)',
                        boxShadow: '-1px 0 0 #d4d4d4',
                      }),
                      ...(isSystemGen && column.key !== "select" && column.key !== "actions" && {
                        backgroundColor: SYSTEM_COLUMN_BG,
                      })
                    }}
                    className={cn(
                      column.key === "select" && "!border-r-0 !p-0 !h-full !bg-white",
                      column.key === "actions" && "!border-l-0 !bg-white"
                    )}
                    onClick={(e) => {
                      if (column.key === "select") {
                        e.stopPropagation();
                      }
                    }}
                  >
                    {column.key === "select" ? (
                      <div
                        data-column="select"
                        onMouseDown={(e) => handleSelectMouseDown(row.id, globalIndex, e)}
                      >
                        <SelectCheckbox
                          checked={selectedRows.has(row.id)}
                          onCheckedChange={getToggleCallback(row.id)}
                        />
                      </div>
                    ) : (
                      renderCellValue(row, column)
                    )}
                  </TableCell>
                  );
                })}
              </TableRow>
            );
          });
        }
      }
    });

    return result;
  };

  // Render grouped table with choice of inline or panel mode
  const renderGroupedTable = () => {
    if (!groupedEntries) return null;

    // Don't render full table while waiting for collapse-all to complete
    // This prevents rendering all rows expanded on first render
    if (collapsedGroups.has('__collapse_all_pending__')) {
      return (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          Loading grouped view...
        </div>
      );
    }

    const allKeys = getAllGroupKeys(groupedEntries);
    const allCollapsed = allKeys.length > 0 && allKeys.every(k => collapsedGroups.has(k));
    const allExpanded = collapsedGroups.size === 0;
    const visibleRows = getVisibleRows();

    return (
      <div className="w-full">
        {/* Selection controls moved to saved views row in toolbar (lines 3467-3560) */}

        {groupViewMode === "inline" ? (
          /* Inline mode (default) - groups as rows in table body */
          <Table className="w-full" style={{ tableLayout: 'auto' }}>
            {renderTableHeader()}
            <TableBody>
              {renderInlineGroupRows(groupedEntries)}
            </TableBody>
          </Table>
        ) : (
          /* Panel mode - Groups with nested data tables inside each expanded group */
          <div className="space-y-0">
            {renderGroupNavigation(groupedEntries)}
          </div>
        )}
      </div>
    );
  };

  // Render flat table
  const renderFlatTable = () => {
    return (
    <Table className="w-full" style={{ tableLayout: 'auto' }}>
        <colgroup>
          {visibleColumnsInOrder.map((column) => (
            <col
              key={column.key}
              style={{ minWidth: column.key === "select" ? 40 : (columnWidths[column.key] || column.width || 50) }}
            />
          ))}
        </colgroup>
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
            <>
              {displayedRows.map((row, rowIndex) => {
                const globalIndex = filteredAndSortedEntries.findIndex(e => e.id === row.id);
                return (
                <TableRow
                  key={`${row.id}-${rowIndex}`}
                  className={cn(
                    selectedRows.has(row.id) && "bg-muted/50",
                    editingRowIds.has(row.id) && "bg-blue-50 dark:bg-blue-950/20",
                    "hover:bg-muted/30 cursor-pointer"
                  )}
                  onClick={(e) => {
                    if (!isEditMode && !editingRowIds.has(row.id) && onRowClick) {
                      onRowClick(row);
                    }
                  }}
                  onDoubleClick={() =>
                    !isEditMode && !editingRowIds.has(row.id) && onRowDoubleClick?.(row)
                  }
                  onMouseEnter={() => handleRowMouseEnter(row.id, globalIndex)}
                >
                  {visibleColumnsInOrder.map((column, colIndex) => {
                    const isSystemGen = isSystemGeneratedColumn(column);
                    return (
                    <TableCell
                      key={`${column.key}-${colIndex}`}
                      style={{
                        width: columnWidths[column.key] || column.width,
                        minWidth: columnWidths[column.key] || column.width,
                        ...(column.key === "select" && {
                          position: 'sticky',
                          left: 0,
                          zIndex: 10,
                          background: 'hsl(40, 11%, 95%)', // Light tint - between white and muted
                          boxShadow: '1px 0 0 #d4d4d4', // Right border
                          textAlign: 'center',
                          verticalAlign: 'middle'
                        }),
                        ...(column.key === "actions" && {
                          position: 'sticky',
                          right: 0,
                          zIndex: 10,
                          background: 'hsl(40, 11%, 95%)', // Light tint - between white and muted
                          boxShadow: '-1px 0 0 #d4d4d4', // Left border
                        }),
                        ...(isSystemGen && column.key !== "select" && column.key !== "actions" && {
                          backgroundColor: SYSTEM_COLUMN_BG,
                        })
                      }}
                      className={cn(
                        column.key === "select" && "!border-r-0 !p-0 !h-full !bg-white",
                        column.key === "actions" && "!border-l-0 !bg-white"
                      )}
                      onClick={(e) => {
                        if (column.key === "select") {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {column.key === "select" ? (
                        <div
                          data-column="select"
                          onMouseDown={(e) => handleSelectMouseDown(row.id, globalIndex, e)}
                        >
                          <SelectCheckbox
                            checked={selectedRows.has(row.id)}
                            onCheckedChange={getToggleCallback(row.id)}
                          />
                        </div>
                      ) : (
                        renderCellValue(row, column)
                      )}
                    </TableCell>
                  );
                  })}
                </TableRow>
                );
              })}
              {/* Show "Load More" row if there are more rows to display */}
              {!showAllRows && displayedRows.length < filteredAndSortedEntries.length && (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumnsInOrder.length}
                    className="h-12 text-center"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRowLimit(prev => prev + INITIAL_ROW_LIMIT)}
                    >
                      Load more ({filteredAndSortedEntries.length - displayedRows.length} remaining)
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2"
                      onClick={() => setShowAllRows(true)}
                    >
                      Show all {filteredAndSortedEntries.length}
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </>
          )}
        </TableBody>
      </Table>
    );
  };

  // Get active view name
  const activeView = savedViews.find((v) => v.id === activeViewId);

  // Notify parent when active view changes
  React.useEffect(() => {
    if (onViewChange) {
      onViewChange(activeView || null);
    }
  }, [activeView, onViewChange]);

  // ============================================================================
  // MAIN RENDER
  // ============================================================================


  return (
    <div className="flex flex-col h-full gap-4">
      {/* Data Health Widget - shown when button clicked or showDataHealth prop is true */}
      {(healthPanelOpen || showDataHealth) && foundationIdNumeric && (
        <DataHealthWidget
          foundationId={foundationIdNumeric}
          compact={!healthPanelOpen}
          forceShow={healthPanelOpen}
          onIssueClick={onDataHealthIssueClick}
          onDataChanged={onRefresh}
        />
      )}

      {/* Toolbar - First row: Search and main actions */}
      <div className="flex items-center justify-between gap-4">
          {/* Left section: Add button + leftActions + Search */}
          <div className="toolbar-left flex items-center gap-2 flex-shrink-0">
            {/* Add Row button - auto-shown when onAddRow is provided */}
            {onAddRow && (
              <Button
                variant="default"
                size="sm"
                onClick={onAddRow}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Record
              </Button>
            )}
            {/* Edit Mode Toggle - enables inline cell editing */}
            <EditModeToggle />
            {leftActions}
            {/* Health Indicator Button - shows if table has health checks */}
            {foundationIdNumeric && (
              <HealthIndicatorButton
                foundationId={foundationIdNumeric}
                onClick={() => setHealthPanelOpen(!healthPanelOpen)}
              />
            )}
            <SearchInput
            value={search}
            onSearch={handleSearchFromInput}
            onSearchAllChange={handleSearchAllChange}
            searchAllColumns={searchAllColumns}
            serverSearchLoading={serverSearchLoading}
            hasServerSearch={!!onServerSearch}
          />
          </div>

          {/* View mode toggle - only show when grouped */}
          {groupByColumn && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-medium text-muted-foreground">View:</span>
              <div className="flex rounded-md border overflow-hidden">
                <Button
                  variant={groupViewMode === "inline" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setGroupViewMode("inline")}
                  className="h-7 px-3 text-xs rounded-none border-r"
                >
                  Inline
                </Button>
                <Button
                  variant={groupViewMode === "panel" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setGroupViewMode("panel")}
                  className="h-7 px-3 text-xs rounded-none"
                >
                  Panel
                </Button>
              </div>
            </div>
          )}

          {/* Bulk action buttons - show when rows selected (flat table only, grouped has inline) */}
          {selectedRows.size > 0 && !groupByColumn && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-4 w-px bg-border mx-1" />
              {/* Bulk Update - column-based update modal */}
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
              {/* Inline Edit - edit all selected rows inline like a spreadsheet */}
              {onRowUpdate && !viewOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startMultiEditing(Array.from(selectedRows))}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Inline Edit
                </Button>
              )}
              {/* Merge button - combine rows into one */}
              {(onBulkMerge || (enableMerge !== false && foundationIdNumeric)) && !viewOnly && selectedRows.size >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMergeClick(Array.from(selectedRows))}
                >
                  <GitMerge className="h-4 w-4 mr-1" />
                  Merge
                </Button>
              )}
            </div>
          )}

          {/* Actions - right side with buttons */}
          <div className="toolbar-right flex items-center gap-2 shrink-0">
            {/* Custom actions */}
            {customActions && <div className="shrink-0">{customActions}</div>}

          {/* Filters button - auto-enabled when foundationIdNumeric is set */}
          {/* Opens GlobalViewsManager for managing saved views, filters, sorting, columns */}
          {foundationIdNumeric && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGlobalViewsManager(true)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {safeFilters.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {safeFilters.length}
                </Badge>
              )}
            </Button>
          )}

          {/* More actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setShowEditColumnsModal(true)}>
                <Columns className="h-4 w-4 mr-2" />
                Columns
              </DropdownMenuItem>

              {/* Schema Section - auto-enabled when foundationIdNumeric is set */}
              {effectiveEnableSchemaEditor && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                    SCHEMA
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setShowCreateColumnModal(true)}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create New Column
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEditColumns ? onEditColumns() : setShowEditColumnsModal(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Columns
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowDeleteColumnModal(true)}>
                    <MinusCircle className="h-4 w-4 mr-2" />
                    Delete Column
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={toggleColumnEditMode}>
                    <Settings className="h-4 w-4 mr-2" />
                    {columnEditMode ? "Exit Edit Mode" : "Edit Individual"}
                    {columnEditMode && (
                      <Badge variant="secondary" className="ml-2 text-xs">ON</Badge>
                    )}
                  </DropdownMenuItem>
                </>
              )}

              {/* Data Section - auto-enabled when foundationIdNumeric is set */}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                DATA
              </DropdownMenuLabel>
              {effectiveEnableImport && (
                <DropdownMenuItem onClick={onImport}>
                  <Download className="h-4 w-4 mr-2" />
                  Import
                </DropdownMenuItem>
              )}
              {effectiveEnableExport && (
                <DropdownMenuItem onClick={() => setShowExportModal(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Export
                </DropdownMenuItem>
              )}

              {/* Email to Contacts Section - auto-enabled when table has email columns */}
              {hasEmailColumns && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                    CONTACTS
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setShowEmailToContactsModal(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Extract Contacts from Emails
                  </DropdownMenuItem>
                </>
              )}

              {/* Table Info Section */}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                TABLE INFO
              </DropdownMenuLabel>

              {foundationIdNumeric && (
                <div className="px-2 py-1.5 flex items-center justify-between">
                  <span className="text-[11px]">
                    Table ID: <span className="font-mono font-medium">{foundationIdNumeric}</span>
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={handleCopyTableId}
                  >
                    Copy
                  </Button>
                </div>
              )}

            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Second row: Saved Views OR Selection Controls (for grouped tables) */}
      {savedViews.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto mt-3 pb-2">
          {/* Expand/Collapse all button - always visible when grouped to prevent layout shift */}
          {groupByColumn && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (collapsedGroups.size === 0) {
                  collapseAllGroups();
                } else {
                  expandAllGroups();
                }
              }}
              className="h-7 w-7 p-0 shrink-0"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  collapsedGroups.size === 0 ? "rotate-0" : "-rotate-90"
                )}
              />
            </Button>
          )}

          {/* When editing rows, show editing controls instead of saved views */}
          {editingRowIds.size > 0 ? (
            (() => {
              const errorCount = Object.values(validationErrors).reduce(
                (count, rowErrors) => count + Object.keys(rowErrors).length,
                0
              );
              return (
                <>
                  <span className={cn(
                    "text-[11px] font-medium",
                    errorCount > 0 ? "text-red-700 dark:text-red-300" : "text-blue-700 dark:text-blue-300"
                  )}>
                    Editing {editingRowIds.size} row{editingRowIds.size !== 1 ? "s" : ""}
                    {errorCount > 0 && (
                      <span className="ml-2 text-red-600">
                        ({errorCount} error{errorCount !== 1 ? "s" : ""})
                      </span>
                    )}
                  </span>
                  <div className="flex-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEditing}
                    className="h-7 px-2"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={saveEditing}
                    className={cn(
                      "h-7 px-2",
                      errorCount > 0
                        ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                    )}
                    disabled={errorCount > 0}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Save All
                  </Button>
                </>
              );
            })()
          ) : groupByColumn && selectedRows.size > 0 ? (
            <>

              {/* Selection dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center cursor-pointer">
                    <Checkbox
                      checked={
                        filteredAndSortedEntries.length > 0 &&
                        filteredAndSortedEntries.every(row => selectedRows.has(row.id))
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                    <ChevronDown className="h-3 w-3 ml-1 text-muted-foreground" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setSelectedRows(new Set(filteredAndSortedEntries.map(r => r.id)))}>
                    Select All ({filteredAndSortedEntries.length})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSelectedRows(new Set<string | number>())}>
                    Clear Selection
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Bulk action buttons */}
              {onRowUpdate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkUpdateModal(true)}
                  className="h-7 px-2 text-xs"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Bulk Update
                </Button>
              )}
              {onRowUpdate && !viewOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => startMultiEditing(Array.from(selectedRows))}
                  className="h-7 px-2 text-xs"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Inline Edit
                </Button>
              )}
              {(onBulkMerge || (enableMerge !== false && foundationIdNumeric)) && !viewOnly && selectedRows.size >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleMergeClick(Array.from(selectedRows))}
                  className="h-7 px-2 text-xs"
                >
                  <GitMerge className="h-3 w-3 mr-1" />
                  Merge
                </Button>
              )}

              {/* Selection count and clear */}
              <span className="text-[11px] font-medium ml-auto">{selectedRows.size} selected</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRows(new Set<string | number>())}
                className="h-7 px-2 text-xs"
              >
                Clear
              </Button>
            </>
          ) : (
            <>
              {/* Show all views as individual buttons */}
              {savedViews.map((view) => (
                <TooltipProvider key={view.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={activeViewId === view.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => loadViewState(view)}
                        className={cn(
                          "shrink-0 max-w-[140px]",
                          view.is_global && "border-blue-300 dark:border-blue-700"
                        )}
                      >
                        {view.is_global && (
                          <Globe className="h-3 w-3 mr-1 flex-shrink-0" />
                        )}
                        <span className="truncate">{view.name}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {view.is_global ? `Global view: ${view.name}` : `Personal view: ${view.name}`}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </>
          )}
        </div>
      )}

      {/* Active filters indicator - only show when NO saved view is active (view buttons already indicate active view) */}
      {safeFilters.length > 0 && !activeViewId && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-muted-foreground">Active filters:</span>
          {safeFilters.map((filter) => {
            const col = COLUMNS.find((c) => c.key === filter.column);
            return (
              <Badge
                key={filter.id}
                variant="secondary"
                className="gap-1 cursor-pointer hover:bg-secondary/80"
                onClick={() => setShowGlobalViewsManager(true)}
              >
                {col?.label || filter.column}{" "}
                {FILTER_OPERATOR_LABELS[filter.operator] || filter.operator}{" "}
                {!["is_empty", "is_not_empty"].includes(filter.operator) &&
                  `"${filter.value}"`}
              </Badge>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-6 px-2 text-muted-foreground"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Bulk actions - HIDDEN - now shown inline in toolbar */}
      {false && selectedRows.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
          {/* Only show selection count/clear when NOT in grouped view (grouped view has it inline) */}
          {!groupByColumn && (
            <>
              <span className="text-[11px] font-medium">
                {selectedRows.size} row{selectedRows.size !== 1 ? "s" : ""} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRows(new Set<string | number>())}
              >
                Clear selection
              </Button>
            </>
          )}
          {/* Bulk Edit button - for editing multiple rows */}
          {onBulkEdit && !viewOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkEdit?.(Array.from(selectedRows))}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
          )}
          {/* Bulk Update - column-based update modal */}
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
          {/* Inline Edit - edit all selected rows inline like a spreadsheet */}
          {onRowUpdate && !viewOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => startMultiEditing(Array.from(selectedRows))}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Inline Edit
            </Button>
          )}
          {/* Merge button - combine rows into one */}
          {/* Shows when: onBulkMerge provided OR enableMerge with foundationIdNumeric */}
          {(onBulkMerge || (enableMerge !== false && foundationIdNumeric)) && !viewOnly && selectedRows.size >= 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMergeClick(Array.from(selectedRows))}
            >
              <GitMerge className="h-4 w-4 mr-1" />
              Merge
            </Button>
          )}
          {/* Delete button */}
          {onBulkDelete && !viewOnly && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onBulkDelete?.(Array.from(selectedRows))}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
          {/* Custom bulk actions - rendered via callback */}
          {customBulkActions?.(
            Array.from(selectedRows),
            () => setSelectedRows(new Set<string | number>())
          )}
        </div>
      )}


      {/* Sort controls - indicators hidden but functionality preserved */}
      {false && sortColumns.length > 0 && (
        <div className="flex items-center gap-4 text-[11px]">
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
          <span className="text-[11px] text-muted-foreground">
            Loading more records...
          </span>
        </div>
      )}

      {/* Table - scrollable container with max height so scrollbar stays visible */}
      {/* Account for: nav(64) + page header(80) + data health(60 collapsed/40vh expanded) + toolbar(50) + footer(30) */}
      <div
        ref={tableContainerRef}
        className="flex-1 min-h-[200px] max-h-[calc(100vh-420px)] w-full overflow-auto relative border-t border-b"
      >
        {groupedEntries ? renderGroupedTable() : renderFlatTable()}
      </div>

      {/* Footer - compact */}
      <div className="flex items-center justify-between text-xs text-muted-foreground shrink-0 py-1 border-t">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Column totals */}
          {showTotals && Object.keys(columnTotals).length > 0 && (
            <>
              {Object.entries(columnTotals).map(([key, data]) => (
                <span key={key} className="bg-muted px-1.5 py-0.5 rounded text-[11px]">
                  {data.label}: <span className="font-mono">{formatTotal(key)}</span>
                </span>
              ))}
            </>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          {selectedRows.size > 0 && <span>{selectedRows.size} selected</span>}
          <span>
            Showing {filteredAndSortedEntries.length} of {entries.length} records
          </span>
        </div>
      </div>

      {/* Bulk Update Modal */}
      <BulkUpdateModal
        open={showBulkUpdateModal}
        onOpenChange={setShowBulkUpdateModal}
        selectedRowsCount={selectedRows.size}
        COLUMNS={COLUMNS}
        bulkUpdateColumn={bulkUpdateColumn}
        setBulkUpdateColumn={setBulkUpdateColumn}
        bulkUpdateValue={bulkUpdateValue}
        setBulkUpdateValue={setBulkUpdateValue}
        bulkUpdateSaving={bulkUpdateSaving}
        lookupOptions={lookupOptions}
        lookupLoading={lookupLoading}
        handleBulkUpdate={handleBulkUpdate}
      />

      {/* Save View Modal */}
      <SaveViewModal
        open={showSaveViewModal}
        onOpenChange={setShowSaveViewModal}
        newViewName={newViewName}
        setNewViewName={setNewViewName}
        saveAsGlobal={saveAsGlobal}
        setSaveAsGlobal={setSaveAsGlobal}
        savingView={savingView}
        saveNewView={saveNewView}
      />

      {/* Schema Modals (Create, Delete, View Schema) */}
      <SchemaModals
        COLUMNS={COLUMNS}
        tableName={tableName}
        COLUMN_TYPES={COLUMN_TYPES}
        schemaLoading={schemaLoading}
        showCreateColumnModal={showCreateColumnModal}
        setShowCreateColumnModal={setShowCreateColumnModal}
        newColumnName={newColumnName}
        setNewColumnName={setNewColumnName}
        newColumnType={newColumnType}
        setNewColumnType={setNewColumnType}
        handleCreateColumn={handleCreateColumn}
        showDeleteColumnModal={showDeleteColumnModal}
        setShowDeleteColumnModal={setShowDeleteColumnModal}
        selectedColumnToDelete={selectedColumnToDelete}
        setSelectedColumnToDelete={setSelectedColumnToDelete}
        handleDeleteColumn={handleDeleteColumn}
        showViewSchemaModal={showViewSchemaModal}
        setShowViewSchemaModal={setShowViewSchemaModal}
        getColumnTypeEmoji={getColumnTypeEmoji}
        getColumnTypeLabel={getColumnTypeLabel}
        getColumnTypeSqlType={getColumnTypeSqlType}
      />

      {/* Edit Single Column Modal - Full featured editor */}
      <ColumnEditorModal
        isOpen={showEditColumnModal}
        column={editingColumnKey ? COLUMNS.find((c) => c.key === editingColumnKey) || null : null}
        foundationId={foundationIdNumeric || null}
        allColumns={COLUMNS.filter((c) => c.key !== "select" && c.key !== "actions")}
        onClose={() => {
          setShowEditColumnModal(false);
          setEditingColumnKey(null);
        }}
        onUpdate={() => {
          onColumnUpdate?.();
          onRefresh?.();
        }}
      />

      {/* Edit Columns Modal - Gold Standard style table with drag-and-drop */}
      <EditColumnsModal
        open={showEditColumnsModal}
        onOpenChange={setShowEditColumnsModal}
        COLUMNS={COLUMNS}
        visibleColumns={visibleColumns}
        setVisibleColumns={setVisibleColumns}
        columnWidths={columnWidths}
        setColumnWidths={setColumnWidths}
        getSortedColumnsForModal={getSortedColumnsForModal}
        reorderColumnToPosition={reorderColumnToPosition}
        getDefaultVisibleColumns={getDefaultVisibleColumns}
        getColumnTypeEmoji={getColumnTypeEmoji}
        getColumnTypeSqlType={getColumnTypeSqlType}
        getColumnTypeLabel={getColumnTypeLabel}
        getColumnTypeValidationRules={getColumnTypeValidationRules}
        dndSensors={dndSensors}
        handleColumnDragEnd={handleColumnDragEnd}
      />

      {/* Export Modal */}
      <ExportModal
        open={showExportModal}
        onOpenChange={setShowExportModal}
        exportFormat={exportFormat}
        setExportFormat={setExportFormat}
        exportScope={exportScope}
        setExportScope={setExportScope}
        visibleDataColumns={visibleDataColumns}
        allDataColumns={allDataColumns}
        filteredAndSortedEntries={filteredAndSortedEntries}
        handleExport={handleExport}
      />

      {/* Shared Merge Modal - used by all tables when enableMerge is true */}
      {foundationIdNumeric && enableMerge !== false && (
        <MergeModal
          open={showMergeModal}
          onOpenChange={setShowMergeModal}
          selectedIds={mergeSelectedIds}
          foundationId={foundationIdNumeric}
          records={entries}
          displayColumn={mergeDisplayColumn}
          secondaryColumns={mergeSecondaryColumns}
          entityName={tableName?.replace(/s$/, '') || "Record"}
          onMergeComplete={handleMergeComplete}
        />
      )}

      {/* Email to Contacts Modal - auto-enabled when table has email columns */}
      {hasEmailColumns && (
        <EmailToContactsModal
          open={showEmailToContactsModal}
          onOpenChange={setShowEmailToContactsModal}
          emailData={filteredAndSortedEntries}
          onComplete={() => {
            onRefresh?.();
            setShowEmailToContactsModal(false);
          }}
        />
      )}

      {/* View Manager Sheet - auto-enabled when foundationIdNumeric is set */}
      {/* Per GOLD_STANDARD_TABLE.md: Tables with foundationIdNumeric get Filters button + ViewManagerSheet */}
      {foundationIdNumeric && (
        <ViewManagerSheet
          open={showGlobalViewsManager}
          onOpenChange={setShowGlobalViewsManager}
          foundationId={foundationIdNumeric}
          columns={COLUMNS
            .filter(col => col.key !== 'select' && col.key !== 'actions')
            .map((col, index) => ({
              id: col.id || index,
              column_name: col.key,
              name: col.label,
              column_type: col.column_type || 'single_line_text',
              position: index,
              lookup_foundation_id: col.lookup_foundation_id,
              lookup_display_column: col.lookup_display_column,
              available_choices: col.choices,
            }))}
          onViewsChange={onRefresh}
          onApplyView={loadViewState as (view: unknown) => void}
          onAutoFitChange={setAutoFitColumns}
          onShowTotalsChange={setShowTotals}
          onRefresh={onRefresh}
          rows={entries as Record<string, unknown>[]}
        />
      )}
    </div>
  );
}
