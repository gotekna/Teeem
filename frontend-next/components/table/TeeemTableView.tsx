 
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
  ArrowLeftRight,
  Pin,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { getColumnPriority, COLUMN_PRIORITY_CONFIG, type ColumnPriority } from "@/lib/column-priority";
import { measureText, TABLE_FONTS, TABLE_PADDING } from "@/lib/column-measurement";
import { convertColumnsToTEEEMFormat, SYSTEM_DISPLAY_COLUMNS, type ApiColumn } from "@/lib/corporate/column-utils";
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
// NOTE: Tooltip imports removed - using native HTML title attributes instead
// to avoid compose-refs infinite loop issues during rapid re-renders (view switching)
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
  type GroupEntry,
  type GroupedEntries,
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
import { SearchInput, type SearchMode } from "./components/SearchInput";
import { ResizableColumnHeader } from "./components/ResizableColumnHeader";
import { SortableColumnRow } from "./components/SortableColumnRow";
import { CascadeFilterItem } from "./core/filtering/CascadeFilterItem";

// Cell components (Phase 4 refactoring)
import { SelectCheckbox, ActionsButtons, EditingActionsButtons } from "./core/cell-components";
import { RowEditingCell } from "./core/cell-components/RowEditingCell";
import { HighlightedText } from "./components/HighlightedText";
import { EmptyState, getEmptyStateVariant } from "./components/EmptyState";
import { TableSkeleton } from "./components/TableSkeleton";

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

// Record CRUD Modals (Phase 8 refactoring)
import { CreateRecordDialog } from "./CreateRecordDialog";
import { EditRecordModal } from "./modals/EditRecordModal";
import { ViewRecordModal } from "./modals/ViewRecordModal";

// Handler hooks (Phase 5 refactoring)
import { useExportHandlers } from "./core/hooks/useExportHandlers";
import { useSchemaHandlers } from "./core/hooks/useSchemaHandlers";
import { useTableHandlers } from "./core/hooks/useTableHandlers";
import { useGroupCounts } from "@/hooks/useGroupCounts";
import { useTableKeyboardNavigation } from "@/hooks/useTableKeyboardNavigation";
import { useTableSessionStorage } from "@/hooks/useTableSessionStorage";

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
  showColumnFiltersAtom,
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
  currentTotalsColumnsAtom,
  currentStickyActionsAtom,
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

// Helper to get plain text for cell tooltip (handles objects, arrays, etc.)
const getCellTooltip = (value: unknown): string | undefined => {
  if (value == null) return undefined;
  if (typeof value === "string") return value || undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    // Handle lookup/relation objects
    if ("display" in value) return String((value as { display: string }).display) || undefined;
    if ("name" in value) return String((value as { name: string }).name) || undefined;
    if ("label" in value) return String((value as { label: string }).label) || undefined;
    // Handle arrays (multi-select)
    if (Array.isArray(value) && value.length > 0) {
      const text = value.map(v => {
        if (typeof v === "object" && v !== null) {
          if ("display" in v) return (v as { display: string }).display;
          if ("name" in v) return (v as { name: string }).name;
          return JSON.stringify(v);
        }
        return String(v);
      }).join(", ");
      return text || undefined;
    }
  }
  return undefined;
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
  { key: "actions", label: "", resizable: false, sortable: false, filterable: false, width: 50 },
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
  rows: TableRowType[];
  selectedRows: Set<number | string>;
  visibleColumnsInOrder: TableColumn[];
  columnWidths: Record<string, number>;
  rowIdToGlobalIndex: Map<number | string, number>;  // Pre-computed map for O(1) lookup
  getStickyColumnStyles: (key: string, isHeader: boolean) => React.CSSProperties;
  isSystemGeneratedColumn: (column: TableColumn) => boolean;
  SYSTEM_COLUMN_BG: string;
  getToggleCallback: (id: number | string) => () => void;
  handleSelectMouseDown: (rowId: number | string, rowIndex: number, e: React.MouseEvent) => void;
  handleRowMouseEnter: (rowId: number | string, rowIndex: number) => void;
  isRowInDragRange: (rowId: number | string) => boolean;
  onRowClick?: (row: TableRowType) => void;
  onRowDoubleClick?: (row: TableRowType) => void;
  renderCellValue: (row: TableRowType, column: TableColumn) => React.ReactNode;
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
  isRowInDragRange,
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
    estimateSize: () => 28, // Row height in pixels (matches h-7 = 1.75rem = 28px)
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
                  height: `${Math.min(rows.length * 28, 500)}px`, // Max 500px tall (28px matches h-7)
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
                              data-row-id={row.id}
                              className={cn(
                                selectedRows.has(row.id) && "bg-muted/50",
                                isRowInDragRange(row.id) && !selectedRows.has(row.id) && "bg-blue-100 dark:bg-blue-900/30",
                                "hover:bg-muted/30 cursor-pointer"
                              )}
                              onClick={() => {
                                console.log("🟣 TeeemTableView row clicked, isEditMode:", isEditMode, "hasOnRowClick:", !!onRowClick);
                                if (!isEditMode && onRowClick) {
                                  console.log("🟣 Calling onRowClick with row:", row.id);
                                  onRowClick(row);
                                }
                              }}
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
                                      column.key === "select" && "!border-r-0 !p-0 !h-full",
                                      column.key === "actions" && "!border-l-0"
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
// VIRTUALIZED FLAT TABLE (for non-grouped views with many rows)
// ============================================================================
interface VirtualizedFlatTableProps {
  rows: TableRowType[];
  selectedRows: Set<number | string>;
  visibleColumnsInOrder: TableColumn[];
  columnWidths: Record<string, number>;
  editingRowIds: Set<number | string>;
  getStickyColumnStyles: (key: string, isHeader: boolean) => React.CSSProperties;
  isSystemGeneratedColumn: (column: TableColumn) => boolean;
  SYSTEM_COLUMN_BG: string;
  getToggleCallback: (id: number | string) => () => void;
  handleSelectMouseDown: (rowId: number | string, rowIndex: number, e: React.MouseEvent) => void;
  handleRowMouseEnter: (rowId: number | string, rowIndex: number) => void;
  isRowInDragRange: (rowId: number | string) => boolean;
  onRowClick?: (row: TableRowType) => void;
  onRowDoubleClick?: (row: TableRowType) => void;
  renderCellValue: (row: TableRowType, column: TableColumn) => React.ReactNode;
  renderTableHeader: () => React.ReactNode;
  renderTableFooter?: () => React.ReactNode;
  isEditMode: boolean;
  showTotals: boolean;
  tableHeight?: number; // Default 600px
  // Keyboard navigation props
  focusedRowIndex?: number;
  onFocusRow?: (index: number) => void;
  tableHasFocus?: boolean;
}

/**
 * VirtualizedFlatTable - High-performance table for large datasets
 *
 * Uses @tanstack/react-virtual to render only visible rows.
 * Achieves 60fps scrolling with 100K+ rows.
 *
 * Performance targets:
 * - 100 rows: <10ms render
 * - 10,000 rows: <10ms render
 * - 100,000 rows: <10ms render (same as 100!)
 */
const VirtualizedFlatTable = memo(function VirtualizedFlatTable({
  rows,
  selectedRows,
  visibleColumnsInOrder,
  columnWidths,
  editingRowIds,
  getStickyColumnStyles,
  isSystemGeneratedColumn,
  SYSTEM_COLUMN_BG,
  getToggleCallback,
  handleSelectMouseDown,
  handleRowMouseEnter,
  isRowInDragRange,
  onRowClick,
  onRowDoubleClick,
  renderCellValue,
  renderTableHeader,
  renderTableFooter,
  isEditMode,
  showTotals,
  tableHeight = 600,
  // Keyboard navigation props
  focusedRowIndex = -1,
  onFocusRow,
  tableHasFocus = false,
}: VirtualizedFlatTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  // Detect scrollbar width when body content changes
  useEffect(() => {
    if (parentRef.current) {
      const width = parentRef.current.offsetWidth - parentRef.current.clientWidth;
      setScrollbarWidth(width);
    }
  }, [rows.length]);

  // Sync horizontal scroll between body and header
  const handleBodyScroll = useCallback(() => {
    if (parentRef.current && headerRef.current) {
      headerRef.current.scrollLeft = parentRef.current.scrollLeft;
    }
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 28, // Row height in pixels (matches h-7 = 1.75rem = 28px)
    overscan: 10, // Render 10 extra rows for smoother scrolling
  });

  // Calculate total table width for proper scrolling
  const totalWidth = useMemo(() => {
    return visibleColumnsInOrder.reduce((sum, col) => {
      // Match colgroup width calculation: select is always 40px
      return sum + (col.key === "select" ? 40 : (columnWidths[col.key] || col.width || 150));
    }, 0);
  }, [visibleColumnsInOrder, columnWidths]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed header - scrolls horizontally in sync with body, with scrollbar width compensation */}
      <div ref={headerRef} className="overflow-x-hidden shrink-0" style={{ paddingRight: scrollbarWidth }}>
        <Table className="w-full" style={{ tableLayout: 'fixed', minWidth: totalWidth }}>
          <colgroup>
            {visibleColumnsInOrder.map((column) => (
              <col
                key={column.key}
                style={{ width: column.key === "select" ? 40 : (columnWidths[column.key] || column.width || 150) }}
              />
            ))}
          </colgroup>
          {renderTableHeader()}
        </Table>
      </div>

      {/* Virtualized scrollable body - fills remaining flex space */}
      <div
        ref={parentRef}
        className="overflow-auto flex-1 min-h-0"
        onScroll={handleBodyScroll}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
            minWidth: totalWidth,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            const rowIndex = virtualRow.index;

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <Table style={{ tableLayout: 'fixed', width: '100%', minWidth: totalWidth }}>
                  <colgroup>
                    {visibleColumnsInOrder.map((column) => (
                      <col
                        key={column.key}
                        style={{ width: column.key === "select" ? 40 : (columnWidths[column.key] || column.width || 150) }}
                      />
                    ))}
                  </colgroup>
                  <tbody>
                    <TableRow
                      data-row-id={row.id}
                      className={cn(
                        selectedRows.has(row.id) && "bg-muted/50",
                        isRowInDragRange(row.id) && !selectedRows.has(row.id) && "bg-blue-100 dark:bg-blue-900/30",
                        editingRowIds.has(row.id) && "bg-blue-50 dark:bg-blue-950/20",
                        focusedRowIndex === rowIndex && tableHasFocus && "ring-2 ring-inset ring-primary/50 bg-primary/5",
                        "hover:bg-muted/30 cursor-pointer"
                      )}
                      onClick={(e) => {
                        if (!isEditMode && !editingRowIds.has(row.id) && onRowClick) {
                          onRowClick(row);
                        }
                        onFocusRow?.(rowIndex);
                      }}
                      onDoubleClick={() =>
                        !isEditMode && !editingRowIds.has(row.id) && onRowDoubleClick?.(row)
                      }
                      onMouseEnter={() => handleRowMouseEnter(row.id, rowIndex)}
                    >
                      {visibleColumnsInOrder.map((column, colIndex) => {
                        const isSystemGen = isSystemGeneratedColumn(column);
                        const stickyStyles = getStickyColumnStyles(column.key, false);
                        return (
                          <TableCell
                            key={`${column.key}-${colIndex}`}
                            title={column.key !== "select" && column.key !== "actions" ? getCellTooltip(row[column.key]) : undefined}
                            style={{
                              width: columnWidths[column.key] || column.width,
                              minWidth: columnWidths[column.key] || column.width,
                              ...stickyStyles,
                              ...(column.key === "select" && {
                                textAlign: 'center',
                                verticalAlign: 'middle'
                              }),
                              ...(isSystemGen && column.key !== "select" && column.key !== "actions" && {
                                backgroundColor: SYSTEM_COLUMN_BG,
                              })
                            }}
                            className={cn(
                              column.key === "select" && "!border-r-0 !p-0 !h-full",
                              column.key === "actions" && "!border-l-0"
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
                                onMouseDown={(e) => handleSelectMouseDown(row.id, rowIndex, e)}
                              >
                                <SelectCheckbox
                                  checked={selectedRows.has(row.id)}
                                  onCheckedChange={getToggleCallback(row.id)}
                                />
                              </div>
                            ) : column.key === "actions" ? (
                              renderCellValue(row, column)
                            ) : (
                              <div
                                className="truncate"
                                title={getCellTooltip(row[column.key])}
                              >
                                {renderCellValue(row, column)}
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </tbody>
                </Table>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed footer (totals) */}
      {showTotals && renderTableFooter && (
        <div className="overflow-x-auto border-t">
          <Table className="w-full" style={{ tableLayout: 'fixed', minWidth: totalWidth }}>
            <colgroup>
              {visibleColumnsInOrder.map((column) => (
                <col
                  key={column.key}
                  style={{ width: column.key === "select" ? 40 : (columnWidths[column.key] || column.width || 150) }}
                />
              ))}
            </colgroup>
            {renderTableFooter()}
          </Table>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TeeemTableView({
  entries = [],
  columns = null,
  totalCount = null,
  foundationId = "default",
  foundationIdNumeric = null,
  tableName = "Table",
  onAddRow,
  onEdit,
  onDelete,
  onBulkDelete,
  onBulkEdit,
  onBulkMerge,
  onXeroTransfer,
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
  extraColumns,
  viewOnly = false,
  preloadedViews = null,
  disableSavedViews = false,
  defaultViewId,
  hideUpdateViewButton = false,
  initialGroupByColumn = null,
  onLoadViewReady,
  inheritViewsFrom,
  onServerSearch,
  serverSearchLoading = false,
  searchMode: propSearchMode,
  onSearchModeChange,
  onViewApiParamsChange,
  loadingMore = false,
  onLoadMore,
  onLoadAll,
  hasMore: serverHasMore = false,
  autoFetchRecords = false,
  showDataHealth = false,
  onDataHealthIssueClick,
  initialShowTotals = true,
  hideFooter = false,
  alwaysVisibleColumns = [],
  stats,
  category,
  showHeader = true,
}: TeeemTableViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Debug mode - add ?debug=grid to URL to show layout visualization
  const debugGrid = searchParams.get("debug") === "grid";
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

  // Auto-enabled bulk delete when foundationIdNumeric is available
  // Pages don't need to wire this up manually - it just works
  const defaultBulkDelete = useCallback(async (ids: (number | string)[]) => {
    if (!foundationIdNumeric) return;
    try {
      await api.post(`/api/v1/foundations/${foundationIdNumeric}/records/bulk_delete`, {
        ids: ids.map(id => Number(id))
      });
      onRefresh?.();
    } catch (err) {
      console.error("Failed to bulk delete:", err);
      throw err;
    }
  }, [foundationIdNumeric, onRefresh]);

  const effectiveBulkDelete = onBulkDelete || (shouldAutoEnable ? defaultBulkDelete : undefined);

  // ============================================================================
  // AUTO-ENABLE RECORD CRUD MODALS (Phase 8)
  // When foundationIdNumeric is set, tables automatically get Add/Edit/View dialogs
  // ============================================================================
  const defaultOnAddRow = useCallback(() => {
    setShowAddRecordModal(true);
  }, []);

  const defaultOnEdit = useCallback((row: TableRowType) => {
    setSelectedRecordForModal(row);
    setShowEditRecordModal(true);
  }, []);

  const defaultOnView = useCallback((row: TableRowType) => {
    setSelectedRecordForModal(row);
    setShowViewRecordModal(true);
  }, []);

  // Use provided callbacks or fall back to auto-enabled defaults
  const effectiveOnAddRow = onAddRow || (shouldAutoEnable ? defaultOnAddRow : undefined);
  const effectiveOnEdit = onEdit || (shouldAutoEnable ? defaultOnEdit : undefined);
  const effectiveOnView = onView || (shouldAutoEnable ? defaultOnView : undefined);

  // Auto-enable search options menu when foundationIdNumeric is set
  // This shows the three-dot menu next to search (search modes, search all columns)
  // SSoT: When foundationIdNumeric is set, tables automatically get Gold Standard features
  const showSearchOptionsMenu = !!onServerSearch || shouldAutoEnable;

  // ============================================================================
  // SESSION STORAGE CACHE - Persists view state across page navigation
  // ============================================================================
  const {
    isInitialized: cacheInitialized,
    cachedState,
    saveColumnWidths: cacheColumnWidths,
    saveCollapsedGroups: cacheCollapsedGroups,
    saveSearch: cacheSearch,
    saveScrollPosition: cacheScrollPosition,
    saveRowLimit: cacheRowLimit,
  } = useTableSessionStorage(foundationIdNumeric);

  // Track if we've restored from cache (only restore once)
  const hasRestoredFromCacheRef = useRef(false);

  // ============================================================================
  // AUTO-FETCH COLUMNS FROM FOUNDATION API (SSoT ENFORCEMENT)
  // When foundationIdNumeric is set, columns MUST come from Foundation API
  // This makes it IMPOSSIBLE to be out of sync with Foundation schema
  // ============================================================================
  const [foundationColumns, setFoundationColumns] = useState<TableColumn[] | null>(null);
  const [columnsLoading, setColumnsLoading] = useState(false);

  // ============================================================================
  // AUTO-FETCH RECORDS WITH INFINITE SCROLL (GOLD STANDARD)
  // When foundationIdNumeric is set AND entries prop is empty/not provided,
  // TeeemTableView manages its own data fetching with cursor-based pagination
  // ============================================================================
  const [autoFetchedRecords, setAutoFetchedRecords] = useState<TableRowType[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // CRITICAL: Auto-fetch must be EXPLICITLY enabled via prop
  // Previously this used a heuristic based on entries.length which broke when entries was empty during loading
  // Now pages must explicitly set autoFetchRecords={true} if they want TeeemTableView to fetch its own records
  const useAutoFetch = autoFetchRecords && !!foundationIdNumeric;

  // Auto-fetch columns when foundationIdNumeric is set
  useEffect(() => {
    if (!foundationIdNumeric) {
      setFoundationColumns(null);
      return;
    }

    const fetchColumns = async () => {
      setColumnsLoading(true);
      try {
        const response = await api.get<{ foundation: { columns: ApiColumn[] } }>(
          `/api/v1/foundations/${foundationIdNumeric}`
        );
        const dbColumns = response?.foundation?.columns || [];
        const teeemColumns = convertColumnsToTEEEMFormat(dbColumns, foundationIdNumeric);
        setFoundationColumns(teeemColumns);

        // SSoT VIOLATION: Alert if parent passed hardcoded columns when Foundation exists
        // In development: throw error to force fix
        // In production: log to console and use Foundation columns (SSoT)
        if (columns && columns.length > 0 && teeemColumns.length > 0) {
          const propKeys = columns.filter(c => !['select', 'actions'].includes(c.key)).map(c => c.key);
          const foundationKeys = teeemColumns.filter(c => !['select', 'actions'].includes(c.key)).map(c => c.key);

          if (propKeys.length !== foundationKeys.length) {
            const inPropsNotFoundation = propKeys.filter(k => !foundationKeys.includes(k));
            const inFoundationNotProps = foundationKeys.filter(k => !propKeys.includes(k));

            const errorMessage =
              `[TeeemTableView] SSoT VIOLATION: columns prop has ${propKeys.length} columns, ` +
              `but Foundation #${foundationIdNumeric} has ${foundationKeys.length} columns.\n` +
              `In PROPS but not Foundation: ${inPropsNotFoundation.join(', ') || 'none'}\n` +
              `In FOUNDATION but not Props: ${inFoundationNotProps.join(', ') || 'none'}\n` +
              `FIX: Remove the columns prop - TeeemTableView auto-fetches from Foundation API (SSoT)`;

            if (process.env.NODE_ENV === 'development') {
              // In dev mode, throw error to force immediate fix
              throw new Error(errorMessage);
            } else {
              // In production, log warning and continue with Foundation columns
              console.error(errorMessage);
            }
          }
        }
      } catch (error) {
        console.error(`[TeeemTableView] Failed to fetch columns for Foundation #${foundationIdNumeric}:`, error);

        // If 404 (foundation deleted), clean up stale cache entries
        const apiError = error as { status?: number };
        if (apiError?.status === 404) {
          console.warn(`[TeeemTableView] Foundation #${foundationIdNumeric} not found - cleaning up stale cache`);

          // Clean up localStorage views cache
          try {
            const viewsCacheKey = 'teeem_views_cache';
            const viewsCache = localStorage.getItem(viewsCacheKey);
            if (viewsCache) {
              const parsed = JSON.parse(viewsCache);
              if (parsed[foundationIdNumeric]) {
                delete parsed[foundationIdNumeric];
                localStorage.setItem(viewsCacheKey, JSON.stringify(parsed));
              }
            }
          } catch {
            // Ignore cache cleanup errors
          }

          // Clean up sessionStorage table state
          try {
            const sessionKey = `teeem-table-state-v1-${foundationIdNumeric}`;
            sessionStorage.removeItem(sessionKey);
          } catch {
            // Ignore cache cleanup errors
          }
        }

        // Fall back to props if fetch fails
        setFoundationColumns(null);
      } finally {
        setColumnsLoading(false);
      }
    };

    fetchColumns();
  }, [foundationIdNumeric, columns]);

  // Auto-fetch records when foundationIdNumeric is set AND entries not provided
  useEffect(() => {
    if (!useAutoFetch) return;

    const fetchInitialRecords = async () => {
      setIsLoadingMore(true);
      try {
        const response = await api.get<{ records: TableRowType[], has_more: boolean }>(
          `/api/v1/foundations/${foundationIdNumeric}/records`,
          { params: { limit: 100 } }
        );
        setAutoFetchedRecords(response.records || []);
        setHasMore(response.has_more ?? true);
      } catch (error) {
        console.error(`[TeeemTableView] Failed to fetch records for Foundation #${foundationIdNumeric}:`, error);
      } finally {
        setIsLoadingMore(false);
      }
    };

    fetchInitialRecords();
  }, [useAutoFetch, foundationIdNumeric]);

  // Auto-load more records in background after initial render
  useEffect(() => {
    if (!useAutoFetch || !hasMore || isLoadingMore || autoFetchedRecords.length === 0) return;

    const timer = setTimeout(async () => {
      if (!hasMore || isLoadingMore) return;

      const lastRecord = autoFetchedRecords[autoFetchedRecords.length - 1];
      const cursor = lastRecord?.id;

      setIsLoadingMore(true);
      try {
        const response = await api.get<{ records: TableRowType[], has_more: boolean }>(
          `/api/v1/foundations/${foundationIdNumeric}/records`,
          { params: { cursor, limit: 100 } }
        );
        setAutoFetchedRecords(prev => [...prev, ...(response.records || [])]);
        setHasMore(response.has_more ?? false);
      } catch (error) {
        console.error(`[TeeemTableView] Failed to load more records:`, error);
      } finally {
        setIsLoadingMore(false);
      }
    }, 2000); // Wait 2 seconds before auto-loading more

    return () => clearTimeout(timer);
  }, [useAutoFetch, hasMore, isLoadingMore, autoFetchedRecords.length, foundationIdNumeric]);

  // Server-side search for auto-fetch mode
  // Supports all search modes: contains (default), exact, starts_with, fuzzy, regex
  const handleAutoFetchSearch = useCallback(async (searchTerm: string, mode?: SearchMode) => {
    if (!useAutoFetch) return;

    setIsSearching(true);
    try {
      const params: Record<string, string | number> = {
        search: searchTerm,
        limit: 100,
      };
      // Pass search mode to backend if specified (backend defaults to 'contains')
      if (mode) {
        params.search_mode = mode;
      }
      const response = await api.get<{ records: TableRowType[], has_more: boolean }>(
        `/api/v1/foundations/${foundationIdNumeric}/records`,
        { params }
      );
      setAutoFetchedRecords(response.records || []);
      setHasMore(response.has_more ?? false);
    } catch (error) {
      console.error(`[TeeemTableView] Search failed:`, error);
    } finally {
      setIsSearching(false);
    }
  }, [useAutoFetch, foundationIdNumeric]);

  // Use Foundation columns when available (SSoT), otherwise fall back to props
  // Merge with extraColumns if provided (for dynamic/computed columns like company presence)
  const baseColumns = foundationIdNumeric && foundationColumns ? foundationColumns : columns;
  const effectiveColumns = useMemo(() => {
    if (!baseColumns) return extraColumns || null;
    if (!extraColumns || extraColumns.length === 0) return baseColumns;
    // Insert extraColumns before the 'actions' column if it exists
    const actionsIndex = baseColumns.findIndex(c => c.key === 'actions');
    if (actionsIndex >= 0) {
      return [...baseColumns.slice(0, actionsIndex), ...extraColumns, ...baseColumns.slice(actionsIndex)];
    }
    return [...baseColumns, ...extraColumns];
  }, [baseColumns, extraColumns]);

  // Use auto-fetched records when in auto-fetch mode, otherwise use entries prop
  const effectiveEntries = useAutoFetch ? autoFetchedRecords : entries;

  // Use auto-fetch search handler when in auto-fetch mode, otherwise use provided handler
  const effectiveOnServerSearch = useAutoFetch ? handleAutoFetchSearch : onServerSearch;
  const effectiveServerSearchLoading = useAutoFetch ? isSearching : serverSearchLoading;
  const effectiveLoadingMore = useAutoFetch ? isLoadingMore : loadingMore;

  // Use custom columns if provided, otherwise use defaults
  const COLUMNS = useMemo(() => {
    if (!effectiveColumns) return DEFAULT_COLUMNS;
    // Ensure select and actions columns are included
    const hasSelect = effectiveColumns.some(c => c.key === 'select');
    const hasActions = effectiveColumns.some(c => c.key === 'actions');
    const result = [...effectiveColumns];
    if (!hasSelect) {
      result.unshift({ key: "select", label: "", resizable: false, sortable: false, filterable: false, width: 40 });
    }
    if (!hasActions) {
      result.push({ key: "actions", label: "", resizable: false, sortable: false, filterable: false, width: 50 });
    }
    return result;
  }, [effectiveColumns]);

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
    if (effectiveEntries && effectiveEntries.length > 0) {
      const firstEntry = effectiveEntries[0];
      const hasEmailFields =
        'from_email' in firstEntry ||
        'to_emails' in firstEntry ||
        'cc_emails' in firstEntry ||
        'email' in firstEntry;

      if (hasEmailFields) return true;
    }

    return false;
  }, [COLUMNS, effectiveEntries]);

  // GOLD STANDARD: Sticky columns are now position-based, not name-based
  // Position 1 (select) and Position 2 (first data column) are always sticky
  // This constant is kept for backwards compatibility with TableHeaderSection
  const STICKY_COLUMNS = useMemo(() => ['select'], []);

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

  // Get default searchable columns from foundation schema (SSoT)
  // Text-based columns are searchable by default; backend can override with explicit `searchable: false`
  const TEXT_SEARCHABLE_TYPES = new Set([
    'single_line_text', 'email', 'phone', 'mobile', 'url', 'multiple_lines_text',
    'searchable_text', 'abn', 'acn', 'bsb', 'postcode', 'choice'
  ]);
  const getDefaultSearchableColumns = useCallback(
    () =>
      COLUMNS.reduce((acc, col) => {
        // If explicit searchable flag is set, use it (SSoT: backend controls)
        if (col.searchable !== undefined && col.searchable !== null) {
          acc[col.key] = col.searchable;
        } else {
          // Default: text-based columns AND 'name' columns are searchable
          const isTextType = TEXT_SEARCHABLE_TYPES.has(col.column_type || '');
          const isNameColumn = col.key === 'name';
          acc[col.key] = isTextType || isNameColumn;
        }
        return acc;
      }, {} as Record<string, boolean>),
    [COLUMNS]
  );

  // ============================================================================
  // STATE - Migrating to atoms for SSoT compliance
  // ============================================================================

  // Search state managed by atom (SSoT)
  const [search, setSearch] = useAtom(searchQueryAtom);
  // searchAllColumns managed by atom (SSoT)
  const [searchAllColumns, setSearchAllColumns] = useAtom(searchAllColumnsAtom);
  // Search mode for client-side filtering
  const [currentSearchMode, setCurrentSearchMode] = useState<SearchMode>(propSearchMode || "contains");

  // Re-trigger server search on mount if there's a persisted search term
  // This handles browser back navigation where atom state is preserved but data isn't
  const hasRestoredSearchRef = useRef(false);
  useEffect(() => {
    if (search && effectiveOnServerSearch && !hasRestoredSearchRef.current) {
      hasRestoredSearchRef.current = true;
      // Re-execute the search to restore filtered results
      effectiveOnServerSearch(search, propSearchMode);
    }
  }, [search, effectiveOnServerSearch, propSearchMode]);

  // View-related state now managed by Jotai atoms (SSoT)
  const [sortColumns, setSortColumns] = useAtom(currentSortColumnsAtom);
  const [columnWidths, setColumnWidths] = useAtom(currentColumnWidthsAtom);
  const [columnOrder, setColumnOrder] = useAtom(currentColumnOrderAtom);
  const [visibleColumns, setVisibleColumns] = useAtom(currentVisibleColumnsAtom);

  // Searchable columns state - controls which columns are included in search for this view
  const [searchableColumns, setSearchableColumns] = useState<Record<string, boolean>>(() => getDefaultSearchableColumns());

  // Sync searchable columns when COLUMNS changes (foundation schema is SSoT)
  useEffect(() => {
    setSearchableColumns(getDefaultSearchableColumns());
  }, [getDefaultSearchableColumns]);

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
        if (!(k in updates)) {
          // System display columns (id, created_at, updated_at) are hidden by default
          // but can be shown via column selector
          updates[k] = !SYSTEM_DISPLAY_COLUMNS.includes(k);
        }
      });
      return updates;
    });
     
  }, [COLUMNS]);
  // Selection state managed by atom (SSoT)
  const [selectedRows, setSelectedRows] = useAtom(selectedRowsAtom);

  // SSoT FIX: Sync selectedRows with entries - remove stale IDs that no longer exist
  // This prevents "ghost selection" where IDs remain selected after records are deleted/merged
  // Only runs when entries change (not when selectedRows changes, to avoid infinite loop)
  const entriesRef = useRef(entries);
  // Ref to hold current filteredAndSortedEntries for use in callbacks before useMemo is defined
  const filteredAndSortedEntriesRef = useRef<Record<string, unknown>[]>([]);
  useEffect(() => {
    // Skip if entries haven't actually changed (same reference)
    if (entriesRef.current === entries) return;
    entriesRef.current = entries;

    setSelectedRows(prev => {
      if (prev.size === 0) return prev;

      const validIds = new Set(entries.map(e => e.id));
      const staleIds = Array.from(prev).filter(id => !validIds.has(id));

      if (staleIds.length > 0) {
        console.warn(`[TeeemTableView] Removing ${staleIds.length} stale selection IDs:`, staleIds);
        const updated = new Set(prev);
        staleIds.forEach(id => updated.delete(id));
        return updated;
      }
      return prev;
    });
  }, [entries, setSelectedRows]);

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

  // Validate groupByColumn against actual Foundation columns (database columns only)
  // Computed columns (like tabs_display) don't exist in the database and will cause API errors
  // effectiveColumns comes from Foundation API which only has database columns
  const validGroupByColumnForApi = useMemo(() => {
    if (!groupByColumn) return null;
    // Check if the column exists in effectiveColumns (Foundation columns = database columns)
    // Ignore system columns like 'select' and 'actions' which are UI-only
    const isValidDbColumn = effectiveColumns?.some(
      (col) => col.key === groupByColumn && col.key !== 'select' && col.key !== 'actions'
    );
    if (!isValidDbColumn) {
      // Don't log for every render, just when the value changes
      console.debug(`[TeeemTableView] groupByColumn "${groupByColumn}" is not a database column, skipping API call`);
      return null;
    }
    return groupByColumn;
  }, [groupByColumn, effectiveColumns]);

  // Server-side group counts for accurate totals (not limited by pagination)
  // This fetches GROUP BY counts from the database for the current groupByColumn
  // IMPORTANT: Pass safeFilters so group counts respect saved views and cascade filters
  // Use validGroupByColumnForApi to prevent API errors from computed columns
  const {
    groups: serverGroupCounts,
    totalRecords: serverTotalRecords,
    loading: groupCountsLoading,
    hasFetched: groupCountsHasFetched,
  } = useGroupCounts(
    foundationIdNumeric,
    validGroupByColumnForApi, // Only pass valid database columns to API
    safeFilters, // Pass cascade filters so counts reflect filtered data
    groupByColumns.length > 0 && !!validGroupByColumnForApi // enabled when grouping is active AND column is valid
  );

  // Build a map of group key -> server count for quick lookup
  const serverCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const group of serverGroupCounts) {
      const key = group.key === null ? "(Empty)" : String(group.key);
      map.set(key, group.count);
    }
    return map;
  }, [serverGroupCounts]);

  // Lazy loading state for groups - fetch all records when expanding
  // Tracks which groups are currently being loaded from server
  const [groupLoadingState, setGroupLoadingState] = useState<Set<string>>(new Set());
  // Stores fully loaded records for each group (Map<groupKey, records[]>)
  const [lazyLoadedGroups, setLazyLoadedGroups] = useState<Map<string, TableRowType[]>>(new Map());

  // Clear lazy-loaded group data when groupByColumn, filters, or search change
  // This ensures lazy-loaded data stays in sync with saved views, cascade filters, and search
  const filtersKey = useMemo(() => JSON.stringify(safeFilters), [safeFilters]);
  useEffect(() => {
    setLazyLoadedGroups(new Map());
    setGroupLoadingState(new Set());
  }, [groupByColumn, filtersKey, search]);

  // Display options managed by atoms
  const [showTotals, setShowTotals] = useAtom(currentShowTotalsAtom);
  const totalsColumns = useAtomValue(currentTotalsColumnsAtom); // Which columns show totals (empty = all)
  const [autoFitColumns, setAutoFitColumns] = useAtom(currentAutoFitColumnsAtom);
  const [smartFit, setSmartFit] = useAtom(currentSmartFitAtom);
  // GOLD STANDARD: Position-based sticky actions toggle
  const [stickyActions, setStickyActions] = useAtom(currentStickyActionsAtom);
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

  // Optimistic delete IDs - for instant UI feedback after merge
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string | number>>(new Set());

  // Filter panel state managed by atom (SSoT)
  const [filterPanelOpen, setFilterPanelOpen] = useAtom(filterPanelOpenAtom);

  // Inline column filters visibility (SSoT)
  const [showColumnFilters, setShowColumnFilters] = useAtom(showColumnFiltersAtom);

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

  // Record CRUD modal state (Phase 8) - auto-enabled when foundationIdNumeric is set
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);
  const [showEditRecordModal, setShowEditRecordModal] = useState(false);
  const [showViewRecordModal, setShowViewRecordModal] = useState(false);
  const [selectedRecordForModal, setSelectedRecordForModal] = useState<TableRowType | null>(null);

  // ABN search state
  const [isFindingAbns, setIsFindingAbns] = useState(false);

  // Drag-to-select state (using refs to avoid re-renders during mouse tracking)
  const dragStateRef = useRef<{
    isDragging: boolean;
    startRowId: number | string | null;
    startRowIndex: number | null;
    currentRowId?: number | string; // Track the end of the drag range
    startX: number;
    startY: number;
  } | null>(null);

  // Drag range state for visual feedback (triggers re-renders to show highlight)
  const [dragRange, setDragRange] = useState<{
    startId: number | string;
    endId: number | string;
  } | null>(null);

  // Ref for table container
  const tableContainerRef = useRef<HTMLDivElement>(null);
  // Ref for search input (keyboard shortcut "/" focuses it)
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Refs for auto-saving column widths
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingWidthsRef = useRef<Record<string, number> | null>(null);

  // ============================================================================
  // INFINITE SCROLL - Detect when user scrolls near bottom and trigger onLoadMore
  // ============================================================================
  useEffect(() => {
    if (!onLoadMore || loadingMore) return;

    const container = tableContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Trigger when within 300px of bottom
      const nearBottom = scrollTop + clientHeight >= scrollHeight - 300;

      if (nearBottom && !loadingMore) {
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [onLoadMore, loadingMore]);

  // ============================================================================
  // SCROLL POSITION CACHE - Save/restore scroll position from session storage
  // ============================================================================
  // Restore scroll position when cache is initialized
  useEffect(() => {
    if (!cacheInitialized || hasRestoredFromCacheRef.current) return;
    if (!cachedState?.scrollTop || !tableContainerRef.current) return;

    // Restore scroll position
    tableContainerRef.current.scrollTop = cachedState.scrollTop;
    hasRestoredFromCacheRef.current = true;
  }, [cacheInitialized, cachedState]);

  // Save scroll position on scroll (debounced)
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      // Debounce to avoid excessive saves
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        cacheScrollPosition(container.scrollTop);
      }, 300);
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [cacheScrollPosition]);

  // Global Views Manager state managed by atom (SSoT)
  const [showGlobalViewsManager, setShowGlobalViewsManager] = useAtom(showGlobalViewsManagerAtom);

  // DnD sensors for column reordering
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Handle Find Missing ABNs button click
  const handleFindMissingAbns = useCallback(async () => {
    setIsFindingAbns(true);
    try {
      const response = await api.post("/api/v1/contacts/find_missing_abns") as { data: { found?: number; not_found?: number; multiple_matches?: number } };
      toast({
        title: "ABN Search Started",
        description: `Searching for missing ABNs in the background. Found: ${response.data.found || 0}, Not found: ${response.data.not_found || 0}, Multiple matches: ${response.data.multiple_matches || 0}`,
      });
      // Refresh the table to show updated ABNs
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      toast({
        title: "ABN Search Failed",
        description: error.response?.data?.error || "Failed to start ABN search",
        variant: "destructive",
      });
    } finally {
      setIsFindingAbns(false);
    }
  }, [toast, onRefresh]);

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
  // Note: foundationIdNumeric === 0 means "no Foundation by design" (e.g., Assets, Companies)
  // Only warn when it's truly undefined/missing
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && foundationIdNumeric === undefined) {
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
          '\n  To fix: Pass foundationIdNumeric={tableId} prop (use 0 for non-Foundation tables)'
        );
      }
    }
  }, [foundationIdNumeric, enableSchemaEditor, preloadedViews, viewOnly, tableName, foundationId]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  // Search handler
  const handleSearchFromInput = useCallback(
    (value: string, mode?: SearchMode) => {
      setSearch(value);
      if (mode) {
        setCurrentSearchMode(mode);
      }
      if (effectiveOnServerSearch) {
        effectiveOnServerSearch(value, mode);
      }
    },
    [effectiveOnServerSearch]
  );

  const handleSearchAllChange = useCallback(
    (checked: boolean) => {
      setSearchAllColumns(checked);
      if (effectiveOnServerSearch && search && onServerSearch) {
        onServerSearch(search, checked);
      }
    },
    [onServerSearch, search, effectiveOnServerSearch]
  );

  // Refs to track current state for auto-save (avoids stale closure issues)
  const currentStateRef = useRef({
    visibleColumns,
    columnOrder,
    autoFitColumns,
    smartFit,
    showTotals,
    stickyActions,
  });

  // Keep refs updated
  useEffect(() => {
    currentStateRef.current = {
      visibleColumns,
      columnOrder,
      autoFitColumns,
      smartFit,
      showTotals,
      stickyActions,
    };
  }, [visibleColumns, columnOrder, autoFitColumns, smartFit, showTotals, stickyActions]);

  // Auto-save column widths to view (debounced)
  // Uses refs to always get current state values
  const autoSaveColumnWidths = useCallback(async (widths: Record<string, number>) => {
    if (!activeViewId || (typeof activeViewId === 'string' && activeViewId.startsWith('new_'))) {
      console.log('[TeeemTableView] Skipping auto-save - no active view');
      return;
    }
    if (!foundationIdNumeric) {
      console.log('[TeeemTableView] Skipping auto-save - no foundation ID');
      return;
    }

    const state = currentStateRef.current;

    try {
      // IMPORTANT: Merge with existing columns data to prevent corruption
      const payload = {
        foundation_view: {
          columns: {
            visible: state.visibleColumns,
            order: state.columnOrder,
            widths: widths,
            autoFitColumns: state.autoFitColumns,
            smartFit: state.smartFit,
            showTotals: state.showTotals,
            stickyActions: state.stickyActions,
          }
        }
      };
      console.log('[TeeemTableView] Saving column widths:', { viewId: activeViewId, widths });

      await api.patch(`/api/v1/foundation_views/${activeViewId}`, payload);
      console.log('[TeeemTableView] Auto-saved column widths for view', activeViewId);
    } catch (error) {
      console.error('[TeeemTableView] Failed to auto-save column widths:', error);
    }
  }, [activeViewId, foundationIdNumeric]);

  // Column resize handler with auto-save
  const handleColumnResize = useCallback((key: string, width: number) => {
    setColumnWidths((prev) => {
      const next = { ...prev, [key]: width };
      // Save to session storage cache
      cacheColumnWidths(next);

      // Queue auto-save (debounced - saves 1 second after last resize)
      pendingWidthsRef.current = next;
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      autoSaveTimeoutRef.current = setTimeout(() => {
        if (pendingWidthsRef.current) {
          autoSaveColumnWidths(pendingWidthsRef.current);
          pendingWidthsRef.current = null;
        }
      }, 1000);

      return next;
    });
  }, [cacheColumnWidths, autoSaveColumnWidths]);

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

  // Create filter with value (for inline column filters - doesn't open panel)
  const createFilterWithValue = useCallback((columnKey: string, value: string, operator: '=' | 'contains' = 'contains') => {
    setCascadeFilters((prev) => [
      ...prev,
      {
        id: `filter_${Date.now()}`,
        column: columnKey,
        operator,
        value,
        groupId: "default",
      },
    ]);
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
    const currentIds = new Set(effectiveEntries.map(e => e.id));
    const cachedIds = Array.from(toggleCallbacksRef.current.keys());
    cachedIds.forEach(id => {
      if (!currentIds.has(id)) {
        toggleCallbacksRef.current.delete(id);
      }
    });
  }, [entries]);

  // Clear pending deletes when entries refresh (the deleted rows are now gone from server)
  React.useEffect(() => {
    if (pendingDeleteIds.size > 0) {
      setPendingDeleteIds(new Set());
    }
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

  // Called when merge completes successfully - optimistically hides merged rows
  const handleMergeComplete = useCallback((deletedIds: (string | number)[]) => {
    // Optimistically hide deleted rows immediately (no full refresh needed!)
    // This keeps the table open and preserves group expansion state
    setPendingDeleteIds(new Set(deletedIds));

    // Clear selections
    setMergeSelectedIds([]);
    setSelectedRows(new Set<string | number>());

    // NOTE: We intentionally do NOT call onRefresh() here anymore.
    // The optimistic hide via pendingDeleteIds provides instant feedback.
    // A full refresh would reset grouped views, scroll position, and cause flicker.
    // Data will naturally sync on the next user-triggered refresh or navigation.
  }, []);

  // Group handlers
  // Lazy load all records for a group when expanding (server-side grouping)
  // IMPORTANT: Respects cascade filters from saved views - combines group filter with existing filters
  const loadGroupRecords = useCallback(async (groupKey: string) => {
    // Skip if no foundation or groupBy column
    if (!foundationIdNumeric || !groupByColumn) return;

    // Skip if already loaded or loading
    if (lazyLoadedGroups.has(groupKey) || groupLoadingState.has(groupKey)) return;

    // Mark as loading
    setGroupLoadingState(prev => new Set(prev).add(groupKey));

    try {
      // Handle "(Empty)" key - server expects null
      const filterValue = groupKey === "(Empty)" ? null : groupKey;

      // Build filters: start with existing cascade filters (from saved views)
      // then add the group filter on top
      const groupFilter = {
        column: groupByColumn,
        operator: filterValue === null ? "is_null" : "=",
        value: filterValue
      };

      // Combine cascade filters with group filter
      // This ensures lazy loading respects saved view filters
      const combinedFilters = [...safeFilters, groupFilter];

      // Build params with sort to maintain consistent ordering
      const params: Record<string, string | number> = {
        filters: JSON.stringify(combinedFilters),
        limit: 10000 // Get all records for the group
      };

      // SSoT: Apply current sort order to lazy-loaded records
      if (sortColumns.length > 0) {
        params.sort_order = JSON.stringify(sortColumns);
      }

      // SSoT: Apply search term to lazy-loaded records (fixes search + grouping bug)
      if (search) {
        params.search = search;
        if (propSearchMode) {
          params.search_mode = propSearchMode;
        }
      }

      const response = await api.get<{
        success: boolean;
        records: TableRowType[];
        total?: number;
      }>(`/api/v1/foundations/${foundationIdNumeric}/records`, { params });

      // Safety: verify response.records is an array to prevent .sort() errors
      if (response.success && Array.isArray(response.records)) {
        // SSoT: Apply client-side sorting to match current sort order
        let sortedRecords = response.records;
        if (sortColumns.length > 0) {
          sortedRecords = [...response.records].sort((a, b) => {
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
                const aIndex = customOrder.indexOf(aDisplay);
                const bIndex = customOrder.indexOf(bDisplay);
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
        setLazyLoadedGroups(prev => new Map(prev).set(groupKey, sortedRecords));
      }
    } catch (error) {
      console.error(`[TeeemTableView] Failed to load group records for "${groupKey}":`, error);
    } finally {
      setGroupLoadingState(prev => {
        const next = new Set(prev);
        next.delete(groupKey);
        return next;
      });
    }
  }, [foundationIdNumeric, groupByColumn, lazyLoadedGroups, groupLoadingState, safeFilters, sortColumns, search, propSearchMode]);

  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups((prev: Set<string>) => {
      const next = new Set(prev);
      const isExpanding = next.has(groupKey);

      if (isExpanding) {
        next.delete(groupKey);
        // When expanding, check if we need to lazy load records
        // Only for first-level groups (no "›" in key) that have partial data
        if (!groupKey.includes("›")) {
          const serverCount = serverCountMap.get(groupKey);
          const hasFullData = lazyLoadedGroups.has(groupKey);
          // Trigger lazy load if server shows more records than we have
          if (serverCount && !hasFullData) {
            loadGroupRecords(groupKey);
          }
        }
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, [setCollapsedGroups, serverCountMap, lazyLoadedGroups, loadGroupRecords]);

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
      const row = effectiveEntries.find(e => e.id === id);
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
        const originalRow = effectiveEntries.find((e) => e.id === rowId);
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

    // SSoT FIX: Only update VISIBLE selected rows (intersection of selected + filtered)
    // This prevents accidentally updating rows hidden by filters
    // Use ref to access current filtered entries (avoids dependency order issues)
    const visibleIds = new Set(filteredAndSortedEntriesRef.current.map(e => e.id));
    const visibleSelectedIds = Array.from(selectedRows).filter(id => visibleIds.has(id));

    console.log('[Bulk Update] Total selected rows:', selectedRows.size);
    console.log('[Bulk Update] Visible selected rows:', visibleSelectedIds.length);
    console.log('[Bulk Update] Visible selected IDs:', visibleSelectedIds);

    if (!bulkUpdateColumn || visibleSelectedIds.length === 0) {
      console.warn('[Bulk Update] Aborted - missing column or no visible rows selected');
      return;
    }

    setBulkUpdateSaving(true);
    try {
      const ids = visibleSelectedIds;
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
          const hasEntityTypeErrors = response?.errors && response.errors.some((err: { id: number | string; errors: string[] }) =>
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
            response.errors.slice(0, 3).forEach((err: { id: number | string; errors: string[] }) => {
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
      if (disableSavedViews) {
        // Clear any cached views when disabled (prevents stale views from other tables)
        setSavedViews([]);
        setActiveViewId(null);
        return;
      }

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
        // Pass inheritViewsFrom to include global views from related foundations
        const result = await loadViews(foundationIdNumeric, inheritViewsFrom);

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

        // Only use URL view ID if it exists in THIS foundation's views
        // Otherwise URL params from other tables would override defaultViewId
        const urlViewExistsForFoundation = validViewId && filteredViews.some(v => v.id === validViewId);
        const effectiveViewId = urlViewExistsForFoundation ? validViewId : defaultViewId;

        const defaultView = selectDefaultView(filteredViews, {
          urlViewId: effectiveViewId,
          preferGlobal: true,
        });

        if (defaultView) {
          // Skip URL update if loading from URL view that exists for this foundation
          const skipUrlUpdate = !!urlViewExistsForFoundation;
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

  }, [foundationIdNumeric, preloadedViews, disableSavedViews, inheritViewsFrom]);

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
          autoFitColumns,
          smartFit,
          showTotals,
          stickyActions,
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
  // IMPORTANT: Use effectiveEntries (not raw entries) to support auto-fetch mode
  const filteredAndSortedEntries = useMemo(() => {
    const startTime = performance.now();
    let result = [...effectiveEntries];

    // Optimistically hide pending deletes (merged records)
    if (pendingDeleteIds.size > 0) {
      result = result.filter((entry) => !pendingDeleteIds.has(entry.id as string | number));
    }

    // Apply search filter (client-side)
    // ONLY filter client-side when there's NO server search - SSoT: backend handles filtering
    // When effectiveOnServerSearch exists, server already filtered with SQL ILIKE
    const hasServerSearch = !!effectiveOnServerSearch;

    // DEBUG: Log search state
    if (search) {
      console.log('[TeeemTableView Search Debug]', {
        search,
        hasServerSearch,
        effectiveOnServerSearch: !!effectiveOnServerSearch,
        searchAllColumns,
        searchableColumnsKeys: Object.keys(searchableColumns),
        resultCount: result.length,
        columnsCount: COLUMNS.length,
        firstEntry: result[0] ? Object.keys(result[0]).slice(0, 5) : 'no entries'
      });
    }

    if (search && !hasServerSearch) {
      // DEBUG: Check first entry's name field
      if (result.length > 0) {
        const firstEntry = result[0];
        console.log('[TeeemTableView Search] First entry fields:', {
          name: firstEntry.name,
          id: firstEntry.id,
          allKeys: Object.keys(firstEntry).slice(0, 10),
          nameInSearchable: searchableColumns['name'],
          columnsWithName: COLUMNS.filter(c => c.key === 'name').map(c => ({ key: c.key, label: c.label }))
        });
      }

      result = result.filter((entry) => {
        const matches = COLUMNS.some((col) => {
          if (col.key === "select" || col.key === "actions") return false;
          // If not "search all columns", only search columns marked as searchable
          if (!searchAllColumns && !searchableColumns[col.key]) return false;
          const value = entry[col.key];
          if (value == null) return false;

          // Apply search based on current search mode
          const strValue = String(value).toLowerCase();
          const searchLower = search.toLowerCase();
          let matched = false;

          switch (currentSearchMode) {
            case "contains":
              matched = strValue.includes(searchLower);
              break;
            case "exact":
              matched = strValue === searchLower;
              break;
            case "starts_with":
              matched = strValue.startsWith(searchLower);
              break;
            case "fuzzy":
              matched = fuzzyMatch(search, String(value));
              break;
            case "regex":
              try {
                const regex = new RegExp(search, "i");
                matched = regex.test(strValue);
              } catch {
                matched = strValue.includes(searchLower);
              }
              break;
            default:
              matched = strValue.includes(searchLower);
          }

          return matched;
        });
        return matches;
      });

      // DEBUG: Log after filtering
      console.log('[TeeemTableView Search Result]', {
        filteredCount: result.length,
        search
      });
    }

    // Apply cascade filters (skip if server search is active - SSoT: backend handles filtering)
    // When server search is active (onServerSearch exists AND search term present),
    // the backend applies both filters + search in a single SQL query
    const skipClientFilters = onServerSearch && search;
    if (safeFilters.length > 0 && !skipClientFilters) {
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
          } else {
            // Check if column is an Australian identifier type that needs numeric sorting
            const columnMeta = COLUMNS.find(c => c.key === column);
            const australianIdTypes = ['abn', 'acn', 'bsb', 'tfn', 'postcode'];

            if (columnMeta && australianIdTypes.includes(columnMeta.column_type || '')) {
              // Strip non-digits and compare numerically for Australian identifiers
              const aNum = parseInt(String(aVal).replace(/\D/g, ''), 10);
              const bNum = parseInt(String(bVal).replace(/\D/g, ''), 10);
              comparison = aNum - bNum;
            } else if (typeof aVal === "number" && typeof bVal === "number") {
              comparison = aVal - bVal;
            } else {
              comparison = aDisplay.localeCompare(bDisplay);
            }
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
    effectiveEntries,
    search,
    currentSearchMode,
    searchAllColumns,
    searchableColumns,
    onServerSearch,
    effectiveOnServerSearch,
    COLUMNS,
    cascadeFilters,
    filterGroups,
    interGroupLogic,
    sortColumns,
    evaluateFilter,
    pendingDeleteIds,
  ]);

  // Keep ref in sync with filteredAndSortedEntries for use in callbacks
  filteredAndSortedEntriesRef.current = filteredAndSortedEntries;

  // SSoT: Compute visible selected count (intersection of selected rows and filtered rows)
  // This ensures bulk operations only affect rows the user can currently see
  const visibleSelectedCount = useMemo(() => {
    const visibleIds = new Set(filteredAndSortedEntries.map(e => e.id));
    return Array.from(selectedRows).filter(id => visibleIds.has(id)).length;
  }, [filteredAndSortedEntries, selectedRows]);

  // ============================================================================
  // KEYBOARD NAVIGATION - Arrow keys, Enter, Space, Escape, /
  // ============================================================================
  const {
    focusedRowIndex,
    setFocusedRowIndex,
    tableProps: keyboardProps,
    hasFocus: tableHasFocus,
  } = useTableKeyboardNavigation({
    rowCount: filteredAndSortedEntries.length,
    onRowOpen: (index) => {
      const row = filteredAndSortedEntries[index];
      if (row && onRowClick) {
        onRowClick(row);
      }
    },
    onToggleSelection: (index) => {
      const row = filteredAndSortedEntries[index];
      if (row) {
        setSelectedRows((prev) => {
          const next = new Set(prev);
          if (next.has(row.id)) {
            next.delete(row.id);
          } else {
            next.add(row.id);
          }
          return next;
        });
      }
    },
    onSelectAll: () => {
      setSelectedRows(new Set(filteredAndSortedEntries.map((e) => e.id)));
    },
    onClearSelection: () => {
      setSelectedRows(new Set());
    },
    onFocusSearch: () => {
      searchInputRef.current?.focus();
    },
    onEscape: () => {
      // Clear search if active, otherwise clear selection
      if (search) {
        setSearch("");
      } else {
        setSelectedRows(new Set());
        setFocusedRowIndex(-1);
      }
    },
    enabled: !isEditMode && !editingRowIds.size,
    containerRef: tableContainerRef as React.RefObject<HTMLElement>,
  });

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
    if (!dragStateRef.current) return;

    // If not yet dragging, check if mouse has moved enough to start
    if (!dragStateRef.current.isDragging) {
      const deltaX = Math.abs(e.clientX - dragStateRef.current.startX);
      const deltaY = Math.abs(e.clientY - dragStateRef.current.startY);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Start dragging if moved more than 5 pixels
      if (distance > 5) {
        dragStateRef.current.isDragging = true;
        // Initialize drag range with start row
        if (dragStateRef.current.startRowId !== null) {
          setDragRange({
            startId: dragStateRef.current.startRowId,
            endId: dragStateRef.current.startRowId,
          });
        }
      }
      return;
    }

    // During drag, find which row the mouse is over using elementFromPoint
    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element) return;

    // Find the closest TR element
    const row = element.closest('tr[data-row-id]');
    if (row) {
      const rowId = row.getAttribute('data-row-id');
      if (rowId) {
        const parsedId = isNaN(Number(rowId)) ? rowId : Number(rowId);
        dragStateRef.current.currentRowId = parsedId;
        // Update drag range for visual feedback
        if (dragStateRef.current.startRowId !== null) {
          setDragRange({
            startId: dragStateRef.current.startRowId,
            endId: parsedId,
          });
        }
      }
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
    // Clear drag range visual feedback
    setDragRange(null);

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
    // Handle arrays - join as comma-separated string
    if (Array.isArray(value)) {
      if (value.length === 0) return "—";
      return value.map(item => String(item)).join(", ");
    }
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
  // Groups are sorted by customOrder if available for the group column
  const groupedEntries = useMemo((): Record<string, NestedGroup> | null => {
    if (groupByColumns.length === 0) {
      return null;
    }

    // Helper to get customOrder for a column from sortColumns
    const getCustomOrderForColumn = (columnName: string): string[] | undefined => {
      const sortConfig = sortColumns.find(s => s.column === columnName);
      return sortConfig?.customOrder;
    };

    // Helper to sort group keys by customOrder
    const sortGroupKeys = (keys: string[], customOrder: string[] | undefined): string[] => {
      if (!customOrder || customOrder.length === 0) {
        return keys; // No custom order, keep insertion order
      }
      return [...keys].sort((a, b) => {
        const aIndex = customOrder.indexOf(a);
        const bIndex = customOrder.indexOf(b);
        // Items not in customOrder go to the end
        const aPos = aIndex === -1 ? customOrder.length + keys.indexOf(a) : aIndex;
        const bPos = bIndex === -1 ? customOrder.length + keys.indexOf(b) : bIndex;
        return aPos - bPos;
      });
    };

    const buildNestedGroups = (
      entries: TableRowType[],
      columns: string[],
      depth: number = 0
    ): Record<string, NestedGroup> => {
      if (columns.length === 0 || depth >= columns.length) {
        return {};
      }

      const currentCol = columns[depth];
      const unsortedGroups: Record<string, NestedGroup> = {};

      for (const entry of entries) {
        const groupKey = getDisplayValue(entry[currentCol]);
        if (!unsortedGroups[groupKey]) {
          unsortedGroups[groupKey] = { rows: [] };
        }
        unsortedGroups[groupKey].rows.push(entry);
      }

      // Sort group keys by customOrder if available for this column
      const customOrder = getCustomOrderForColumn(currentCol);
      const sortedKeys = sortGroupKeys(Object.keys(unsortedGroups), customOrder);

      // Rebuild groups object with sorted keys (maintains order)
      const groups: Record<string, NestedGroup> = {};
      for (const key of sortedKeys) {
        groups[key] = unsortedGroups[key];
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

    // IMPORTANT: Merge in server groups that aren't in loaded data
    // This ensures ALL groups appear in the UI, even if their records haven't been loaded yet
    // Only applies to first-level grouping (depth 0)
    // SKIP when searching - server counts don't include search term, so only show client-filtered results
    if (serverGroupCounts.length > 0 && groupByColumns.length > 0 && !search) {
      for (const serverGroup of serverGroupCounts) {
        const key = serverGroup.key === null ? "(Empty)" : String(serverGroup.key);
        if (!result[key]) {
          // Add empty group placeholder - rows will be lazy-loaded when expanded
          result[key] = { rows: [] };
        }
      }
    }

    return result;
  }, [filteredAndSortedEntries, groupByColumns, getDisplayValue, sortColumns, serverGroupCounts, search]);

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

  // Auto-expand all groups when searching
  // This ensures users can see matching results without manually expanding
  const prevSearchRef = useRef(search);
  useEffect(() => {
    const hasSearch = !!search;
    prevSearchRef.current = search;

    // When search becomes active, expand all groups so results are visible
    if (hasSearch && groupedEntries && collapsedGroups.size > 0) {
      setCollapsedGroups(new Set());
    }
    // NOTE: Do NOT trigger onLoadAll here - server search handles filtering at database level
    // Loading all records would overwrite the search-filtered results
  }, [search, groupedEntries, collapsedGroups.size, setCollapsedGroups]);

  // Helper to get visible (non-collapsed) row IDs in grouped tables
  const getVisibleRowIds = useCallback(() => {
    const visibleRowIds: (number | string)[] = [];

    if (groupedEntries) {
      const collectVisibleRows = (
        groups: GroupedEntries,
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

  // Helper to check if a row is in the current drag range (for visual highlighting)
  const isRowInDragRange = useCallback((rowId: number | string): boolean => {
    if (!dragRange) return false;
    const visibleRowIds = getVisibleRowIds();
    const startIndex = visibleRowIds.indexOf(dragRange.startId);
    const endIndex = visibleRowIds.indexOf(dragRange.endId);
    const rowIndex = visibleRowIds.indexOf(rowId);
    if (startIndex === -1 || endIndex === -1 || rowIndex === -1) return false;
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    return rowIndex >= minIndex && rowIndex <= maxIndex;
  }, [dragRange, getVisibleRowIds]);

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
    // If visibleColumns is empty (initial state), treat all non-system columns as visible
    // This prevents hydration mismatch between server (empty) and client (populated)
    const isVisibilityInitialized = Object.keys(visibleColumns).length > 0;

    // Start with columns from columnOrder that are visible
    const orderedVisible = columnOrder
      .filter((key) => {
        if (!isVisibilityInitialized) {
          // Not initialized yet - show all except system columns
          return !SYSTEM_DISPLAY_COLUMNS.includes(key);
        }
        return visibleColumns[key] === true;
      })
      .map((key) => COLUMNS.find((c) => c.key === key))
      .filter((col): col is TableColumn => col !== undefined);

    // Ensure select is always first if it exists in COLUMNS
    const selectCol = COLUMNS.find(c => c.key === 'select');
    const hasSelectInOrder = orderedVisible.some(c => c.key === 'select');
    if (selectCol && !hasSelectInOrder) {
      orderedVisible.unshift(selectCol);
    }

    // Ensure actions is always last if it exists in COLUMNS AND stickyActions is enabled
    // When stickyActions is OFF, hide the actions column entirely
    if (stickyActions) {
      const actionsCol = COLUMNS.find(c => c.key === 'actions');
      const hasActionsInOrder = orderedVisible.some(c => c.key === 'actions');
      if (actionsCol && !hasActionsInOrder) {
        orderedVisible.push(actionsCol);
      }
    } else {
      // Remove actions column if stickyActions is off
      const actionsIndex = orderedVisible.findIndex(c => c.key === 'actions');
      if (actionsIndex >= 0) {
        orderedVisible.splice(actionsIndex, 1);
      }
    }

    // Ensure alwaysVisibleColumns are included (insert after select, before other columns)
    alwaysVisibleColumns.forEach(colKey => {
      const alreadyIncluded = orderedVisible.some(c => c.key === colKey);
      if (!alreadyIncluded) {
        const col = COLUMNS.find(c => c.key === colKey);
        if (col) {
          // Insert after select column (index 1) or at start if no select
          const selectIndex = orderedVisible.findIndex(c => c.key === 'select');
          const insertIndex = selectIndex >= 0 ? selectIndex + 1 : 0;
          orderedVisible.splice(insertIndex, 0, col);
        }
      }
    });

    return orderedVisible;
  }, [columnOrder, visibleColumns, COLUMNS, alwaysVisibleColumns, stickyActions]);

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
  // Excel-style: measures ALL columns to fit content, then distributes extra space by priority
  // Algorithm: MEASURE → CONSTRAIN → EXPAND
  const calculateSmartFitWidths = useCallback(() => {
    const newWidths: ColumnWidthsState = {};
    const columnPriorities: Record<string, ColumnPriority> = {};

    // Helper to get display text for measurement
    const getDisplayText = (value: unknown, columnType?: string): string => {
      if (value === null || value === undefined) return '-';

      if (typeof value === 'object') {
        const obj = value as { display_value?: string; display?: string; name?: string };
        return obj.display_value || obj.display || obj.name || String(value);
      }

      // Format numbers for accurate measurement
      if (columnType === 'currency' && typeof value === 'number') {
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
      }
      if (columnType === 'percentage' && typeof value === 'number') {
        return `${value.toFixed(1)}%`;
      }
      if (columnType === 'date' && value) {
        return new Date(value as string).toLocaleDateString();
      }

      return String(value);
    };

    // Helper to measure column width using cached canvas
    const measureColumnWidth = (col: TableColumn): number => {
      // Measure header
      const headerText = col.label || col.key;
      let maxWidth = measureText(headerText, TABLE_FONTS.header) + TABLE_PADDING.header;

      // Measure content (sample first 100 rows)
      const sampleRows = filteredAndSortedEntries.slice(0, 100);
      sampleRows.forEach(row => {
        const displayText = getDisplayText(row[col.key], col.column_type);
        const contentWidth = measureText(displayText, TABLE_FONTS.cell) + TABLE_PADDING.cell;
        maxWidth = Math.max(maxWidth, contentWidth);
      });

      return Math.ceil(maxWidth);
    };

    // PHASE 1: MEASURE - Calculate content-based widths for ALL columns
    visibleColumnsInOrder.forEach(col => {
      const priority = getColumnPriority(col.key, col.column_type);
      const config = COLUMN_PRIORITY_CONFIG[priority];
      columnPriorities[col.key] = priority;

      // Skip hidden columns
      if (priority === 'hidden') return;

      // Fixed widths for special columns
      if (col.key === 'select') {
        newWidths[col.key] = 40;
        return;
      }
      if (col.key === 'actions') {
        newWidths[col.key] = 60;
        return;
      }

      // MEASURE ALL columns including technical (Excel-style fit to content)
      const measuredWidth = measureColumnWidth(col);

      // PHASE 2: CONSTRAIN - Apply min/max limits based on priority
      newWidths[col.key] = Math.max(config.minWidth, Math.min(config.maxWidth, measuredWidth));
    });

    // Excel-style: NO expansion. Columns fit content exactly.
    // If total width < screen, empty space on right (like Excel)
    // If total width > screen, horizontal scroll (like Excel)
    return newWidths;
  }, [visibleColumnsInOrder, filteredAndSortedEntries]);

  // NOTE: Smart-fit and Auto-fit logic removed.
  // Column widths are now always manual - set by user dragging column borders.
  // Widths are auto-saved to the view when changed.

  // Get visible data columns (excluding select and actions)
  const visibleDataColumns = useMemo(() => {
    return visibleColumnsInOrder.filter((c) => c.key !== "select" && c.key !== "actions");
  }, [visibleColumnsInOrder]);

  // Calculate column totals for numeric columns
  // Respects totalsColumns setting - empty array means ALL numeric columns
  const columnTotals = useMemo(() => {
    const numericTypes = ['number', 'whole_number', 'currency', 'percentage', 'computed'];
    const skipColumns = ['id', 'select', 'actions', 'latitude', 'longitude', 'lat', 'lng', 'long', 'design_id', 'user_id']; // Never show totals for these
    const totals: Record<string, { value: number; type: string; label: string; isAverage: boolean }> = {};

    // Check if specific columns are selected (empty = all, '__none__' marker = none)
    const hasSpecificSelection = totalsColumns.length > 0;
    const hasNoneMarker = totalsColumns.includes('__none__');

    visibleDataColumns.forEach(col => {
      if (col.column_type && numericTypes.includes(col.column_type) && !skipColumns.includes(col.key)) {
        // Skip if specific columns selected and this column isn't in the list
        // Empty array means "all columns" (default behavior)
        if (hasNoneMarker) return; // '__none__' marker means show no totals
        if (hasSpecificSelection && !totalsColumns.includes(col.key)) return;

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
  }, [visibleDataColumns, filteredAndSortedEntries, totalsColumns]);

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

  // Column types that support text highlighting
  const TEXT_HIGHLIGHTABLE_TYPES = [
    'text', 'single_line_text', 'multi_line_text',
    'email', 'url', 'phone', 'string'
  ];

  // Helper to determine if a column should show search highlighting
  const shouldHighlight = useCallback((column: TableColumn): boolean => {
    // Only highlight when there's an active search and we have a search mode
    if (!search || !propSearchMode) return false;

    // Check if column type supports highlighting
    const columnType = column.column_type || 'text';
    return TEXT_HIGHLIGHTABLE_TYPES.includes(columnType);
  }, [search, propSearchMode]);

  // Wrap text value with highlighting if applicable
  const wrapWithHighlight = useCallback((value: unknown, column: TableColumn): React.ReactNode => {
    if (!shouldHighlight(column)) {
      return value == null ? "" : String(value);
    }

    const textValue = value == null ? "" : String(value);
    if (!textValue) return textValue;

    return (
      <HighlightedText
        text={textValue}
        highlight={search}
        mode={propSearchMode || "contains"}
      />
    );
  }, [search, propSearchMode, shouldHighlight]);

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
              onView={effectiveOnView}
              onEdit={effectiveOnEdit}
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
          // Use registry for display, wrapped in italic styling
          return (
            <span className="text-muted-foreground italic" title={isComputed ? "Computed column" : "System column - not editable"}>
              {renderCellWithRegistry(value, column, entry, "display")}
            </span>
          );
        }
      }

      // Global edit mode - show clickable cells that start row editing on click
      // Cells stay as lightweight text until clicked
      if (isEditMode && isColumnEditable) {
        return (
          <div
            className="cursor-text hover:bg-blue-50 dark:hover:bg-blue-950/20 px-1 py-0.5 -mx-1 -my-0.5 rounded min-h-[24px]"
            onClick={(e) => {
              e.stopPropagation();
              // Start editing this row when cell is clicked
              startEditing(entry);
            }}
            title="Click to edit"
          >
            {renderCellWithRegistry(value, column, entry, "display")}
          </div>
        );
      }

      // ========================================================================
      // DISPLAY MODE - Use ColumnRenderer Registry (SSoT)
      // ========================================================================
      // All column types are now handled by the centralized registry.
      // See: components/table/core/column-renderer/ColumnRenderer.tsx
      // See: components/table/core/column-renderer/CellDisplay.tsx

      // Apply search highlighting for text-based columns
      if (shouldHighlight(column)) {
        const textValue = value == null ? "" : String(value);
        if (textValue) {
          return (
            <HighlightedText
              text={textValue}
              highlight={search}
              mode={propSearchMode || "contains"}
            />
          );
        }
      }

      return renderCellWithRegistry(value, column, entry, "display");
    };

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================

  // GOLD STANDARD: Position-based sticky columns
  // - Position 1 (select): always sticky at left: 0
  // - Position 2 (first data column): sticky at left: selectWidth
  // - Actions: sticky to right (controlled by stickyActions toggle)
  // User controls which column is sticky by reordering columns in their view!
  const getStickyColumnStyles = useCallback((columnKey: string, isHeader: boolean = false): React.CSSProperties => {
    const bgColor = isHeader ? 'hsl(40, 11%, 89%)' : 'hsl(40, 11%, 95%)';

    // Position 1: select - always sticky at left: 0
    if (columnKey === 'select') {
      return {
        position: 'sticky',
        left: 0,
        zIndex: isHeader ? 30 : 10,
        backgroundColor: bgColor,
        // IMPORTANT: Force exact width to prevent w-auto from shrinking it
        width: 40,
        minWidth: 40,
        maxWidth: 40,
      };
    }

    // Position 2: first data column (index 1 after select) - sticky at left: selectWidth
    // IMPORTANT: Use hardcoded 40px to match the select column definition
    // This avoids misalignment if columnWidths['select'] is undefined or differs
    const columnIndex = visibleColumnsInOrder.findIndex(c => c.key === columnKey);
    if (columnIndex === 1) {
      return {
        position: 'sticky',
        left: 40, // Match select column width (defined in DEFAULT_COLUMNS)
        zIndex: isHeader ? 30 : 10,
        backgroundColor: bgColor,
        boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
      };
    }

    // Actions column - sticky to right (only if stickyActions is enabled)
    if (columnKey === 'actions' && stickyActions) {
      return {
        position: 'sticky',
        right: 0,
        zIndex: isHeader ? 50 : 20,
        backgroundColor: bgColor,
        boxShadow: '-2px 0 4px rgba(0,0,0,0.1)',
      };
    }

    // Not a sticky column
    return {};
  }, [visibleColumnsInOrder, columnWidths, stickyActions]);

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
      showColumnFilters={showColumnFilters}
      cascadeFilters={safeFilters}
      updateFilter={updateFilter}
      removeFilter={removeFilter}
      createFilterWithValue={createFilterWithValue}
      columns={COLUMNS}
      lookupOptions={lookupOptions}
      lookupLoading={lookupLoading}
      onFetchLookupOptions={fetchLookupOptions}
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
      // Use server count for first-level groups (accurate total), UNLESS there's an active search
      // When searching, server counts are stale - use client count which reflects filtered results
      const hasActiveSearch = search.trim().length > 0;
      const serverCount = (depth === 0 && !hasActiveSearch) ? serverCountMap.get(groupKey) : undefined;
      const rowCount = serverCount ?? group.rows.length;
      const hasSubgroups = group.subgroups && Object.keys(group.subgroups).length > 0;
      // Check if this group has been fully loaded via lazy loading
      const isFullyLoaded = depth === 0 && lazyLoadedGroups.has(groupKey);
      // Check if we're currently loading this group
      const isLoadingThisGroup = depth === 0 && groupLoadingState.has(groupKey);
      // Check if ALL data is already loaded (main "Load All" was clicked)
      const allDataLoaded = totalCount === null || totalCount === undefined || entries.length >= totalCount;
      // Show indicator if we only have partial data loaded (and not fully loaded yet)
      // Don't show if all data is already loaded via main Load All button
      const hasPartialData = !allDataLoaded && serverCount !== undefined && !isFullyLoaded && group.rows.length < serverCount;

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
          <div className="flex items-center gap-2 whitespace-nowrap">
            {isLoadingThisGroup ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            ) : isCollapsed ? (
              <ChevronRight className="h-4 w-4 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0" />
            )}
            <span className="font-bold text-[13px]">
              {groupKey}
            </span>
            <span className="text-xs bg-white px-2 py-0.5 rounded shrink-0">
              ({rowCount})
              {hasPartialData && <span className="ml-1 text-muted-foreground">• {group.rows.length} loaded</span>}
              {isFullyLoaded && <span className="ml-1 text-green-600">✓</span>}
            </span>
            {hasPartialData && !isLoadingThisGroup && (
              <button
                type="button"
                className="text-xs text-primary hover:text-primary/80 underline ml-2"
                onClick={(e) => {
                  e.stopPropagation();
                  loadGroupRecords(groupKey);
                }}
              >
                Load All
              </button>
            )}
          </div>
        </div>
      );

      // If not collapsed, render content
      if (!isCollapsed) {
        // Check if we're currently loading this group's data
        const isLoadingGroup = depth === 0 && groupLoadingState.has(groupKey);
        // Use lazy-loaded records if available, otherwise use current records
        const effectiveRows = depth === 0 && lazyLoadedGroups.has(groupKey)
          ? lazyLoadedGroups.get(groupKey) || group.rows
          : group.rows;

        if (isLoadingGroup) {
          // Show loading indicator while fetching group records
          result.push(
            <div
              key={`loading-${fullKey}`}
              className="flex items-center justify-center py-8 text-muted-foreground"
              style={{ marginLeft: `${16 + depth * 24}px` }}
            >
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span>Loading {serverCount ? serverCount.toLocaleString() : ''} records...</span>
            </div>
          );
        } else if (hasSubgroups) {
          // Render subgroups recursively
          result.push(...renderGroupNavigation(group.subgroups as typeof groups, depth + 1, fullKey));
        } else {
          // Render data table for this group's rows with virtualization
          result.push(
            <VirtualizedGroupTable
              key={`data-${fullKey}`}
              fullKey={fullKey}
              depth={depth}
              rows={effectiveRows}
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
              isRowInDragRange={isRowInDragRange}
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
      parentKey: string = "",
      depth: number = 0
    ) => {
      Object.entries(groups).forEach(([groupKey, group]) => {
        const fullKey = parentKey ? `${parentKey}›${groupKey}` : groupKey;
        const isCollapsed = collapsedGroups.has(fullKey);

        if (!isCollapsed) {
          if (group.subgroups && Object.keys(group.subgroups).length > 0) {
            collectRows(group.subgroups as typeof groups, fullKey, depth + 1);
          } else {
            // Use lazy-loaded records if available (for first-level groups)
            const effectiveRows = depth === 0 && lazyLoadedGroups.has(groupKey)
              ? lazyLoadedGroups.get(groupKey) || group.rows
              : group.rows;
            visibleRows.push(...effectiveRows);
          }
        }
      });
    };

    collectRows(groupedEntries);
    return visibleRows;
  }, [groupedEntries, collapsedGroups, lazyLoadedGroups]);

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
        data-row-id={row.id}
        className={cn(
          selectedRows.has(row.id) && "bg-muted/50",
          isRowInDragRange(row.id) && !selectedRows.has(row.id) && "bg-blue-100 dark:bg-blue-900/30",
          "hover:bg-muted/30 cursor-pointer"
        )}
        onClick={() => {
          console.log("🟣 TeeemTableView row clicked (VR), isEditMode:", isEditMode, "hasOnRowClick:", !!onRowClick);
          if (!isEditMode && onRowClick) {
            console.log("🟣 Calling onRowClick with row:", row.id);
            onRowClick(row);
          }
        }}
        onDoubleClick={() => !isEditMode && onRowDoubleClick?.(row)}
        onMouseEnter={() => handleRowMouseEnter(row.id, globalIndex)}
      >
        {visibleColumnsInOrder.map((column, colIndex) => {
          const stickyStyles = getStickyColumnStyles(column.key, false);
          const isSystemGen = isSystemGeneratedColumn(column);
          return (
            <TableCell
              key={`${column.key}-${colIndex}`}
              title={column.key !== "select" && column.key !== "actions" ? getCellTooltip(row[column.key]) : undefined}
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
                column.key === "select" && "!border-r-0 !p-0 !h-full",
                column.key === "actions" && "!border-l-0"
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
              ) : column.key === "actions" ? (
                renderCellValue(row, column)
              ) : (
                <div
                  className="truncate"
                  title={getCellTooltip(row[column.key])}
                >
                  {renderCellValue(row, column)}
                </div>
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
      // Use server count for first-level groups (accurate total), UNLESS there's an active search
      // When searching, server counts are stale - use client count which reflects filtered results
      const hasActiveSearch = search.trim().length > 0;
      const serverCount = (depth === 0 && !hasActiveSearch) ? serverCountMap.get(groupKey) : undefined;
      const rowCount = serverCount ?? group.rows.length;
      // Check if this group has been fully loaded via lazy loading
      const isFullyLoaded = depth === 0 && lazyLoadedGroups.has(groupKey);
      // Check if we're currently loading this group
      const isLoadingThisGroup = depth === 0 && groupLoadingState.has(groupKey);
      // Check if ALL data is already loaded (main "Load All" was clicked)
      const allDataLoaded = totalCount === null || totalCount === undefined || entries.length >= totalCount;
      // Show indicator if we only have partial data loaded (and not fully loaded yet)
      // Don't show if all data is already loaded via main Load All button
      const hasPartialData = !allDataLoaded && serverCount !== undefined && !isFullyLoaded && group.rows.length < serverCount;

      // Add group header row - STICKY cell so it stays visible while scrolling within group
      // Calculate top position: column header height (28px) + previous group headers
      const stickyTop = 28 + (depth * 36); // 28px for column header, 36px per group level
      const groupBgColor = `rgba(242, 241, 239, ${Math.max(0.5, 0.95 - depth * 0.30)})`; // Solid enough for sticky

      // Calculate sticky width: select + first data column
      const selectWidth = 40; // Match select column width (hardcoded for consistency)
      const firstDataColKey = visibleColumnsInOrder[1]?.key;
      const firstDataColWidth = firstDataColKey ? (columnWidths[firstDataColKey] || 150) : 150;
      const stickyWidth = selectWidth + firstDataColWidth;

      result.push(
        <TableRow
          key={`group-${fullKey}`}
          className="cursor-pointer hover:opacity-80"
          onClick={() => toggleGroupCollapse(fullKey)}
        >
          {/* Sticky cell - spans first 2 columns (select + first data col) */}
          <TableCell
            colSpan={2}
            className="py-1"
            style={{
              width: stickyWidth,
              minWidth: stickyWidth,
              paddingLeft: `${16 + depth * 24}px`,
              position: 'sticky',
              left: 0,
              zIndex: 10,
              backgroundColor: groupBgColor,
            }}
          >
            <div className="flex items-center gap-2 whitespace-nowrap">
              {isLoadingThisGroup ? (
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              ) : isCollapsed ? (
                <ChevronRight className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0" />
              )}
              <span className="font-bold text-[13px]">
                {groupKey}
              </span>
              <span className="text-xs bg-white px-2 py-0.5 rounded shrink-0">
                ({rowCount})
                {hasPartialData && <span className="ml-1 text-muted-foreground">• {group.rows.length} loaded</span>}
                {isFullyLoaded && <span className="ml-1 text-green-600">✓</span>}
              </span>
            </div>
          </TableCell>
          {/* Non-sticky filler cell for remaining columns */}
          {visibleColumnsInOrder.length > 2 && (
            <TableCell
              colSpan={visibleColumnsInOrder.length - 2}
              style={{ backgroundColor: groupBgColor }}
            />
          )}
        </TableRow>
      );

      // If not collapsed, add content
      if (!isCollapsed) {
        // Check if we're currently loading this group's data
        const isLoadingGroup = depth === 0 && groupLoadingState.has(groupKey);
        // Use lazy-loaded records if available, otherwise use current records
        const effectiveRows = depth === 0 && lazyLoadedGroups.has(groupKey)
          ? lazyLoadedGroups.get(groupKey) || group.rows
          : group.rows;

        if (isLoadingGroup) {
          // Show loading row while fetching group records
          result.push(
            <TableRow key={`loading-${fullKey}`}>
              <TableCell
                colSpan={visibleColumnsInOrder.length}
                className="py-8 text-center text-muted-foreground"
              >
                <div className="flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span>Loading {serverCount ? serverCount.toLocaleString() : ''} records...</span>
                </div>
              </TableCell>
            </TableRow>
          );
        } else if (group.subgroups && Object.keys(group.subgroups).length > 0) {
          // Render subgroups recursively
          result.push(...renderInlineGroupRows(group.subgroups as typeof groups, depth + 1, fullKey));
        } else {
          // Render actual data rows
          effectiveRows.forEach((row, rowIndex) => {
            const globalIndex = filteredAndSortedEntries.findIndex(e => e.id === row.id);
            result.push(
              <TableRow
                key={`${fullKey}-row-${row.id}-${rowIndex}`}
                data-row-id={row.id}
                className={cn(
                  selectedRows.has(row.id) && "bg-muted/50",
                  isRowInDragRange(row.id) && !selectedRows.has(row.id) && "bg-blue-100 dark:bg-blue-900/30",
                  "hover:bg-muted/30 cursor-pointer"
                )}
                onClick={() => {
                  console.log("🟣 TeeemTableView row clicked (Grouped), isEditMode:", isEditMode, "hasOnRowClick:", !!onRowClick);
                  if (!isEditMode && onRowClick) {
                    console.log("🟣 Calling onRowClick with row:", row.id);
                    onRowClick(row);
                  }
                }}
                onDoubleClick={() => !isEditMode && onRowDoubleClick?.(row)}
                onMouseEnter={() => handleRowMouseEnter(row.id, globalIndex)}
              >
                {visibleColumnsInOrder.map((column, colIndex) => {
                  const isSystemGen = isSystemGeneratedColumn(column);
                  const stickyStyles = getStickyColumnStyles(column.key, false);
                  return (
                  <TableCell
                    key={`${column.key}-${colIndex}`}
                    title={column.key !== "select" && column.key !== "actions" ? getCellTooltip(row[column.key]) : undefined}
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
                      column.key === "select" && "!border-r-0 !p-0 !h-full",
                      column.key === "actions" && "!border-l-0"
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
                    ) : column.key === "actions" ? (
                      renderCellValue(row, column)
                    ) : (
                      <div
                        className="truncate"
                        title={getCellTooltip(row[column.key])}
                      >
                        {renderCellValue(row, column)}
                      </div>
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
      <>
        {groupViewMode === "inline" ? (
          /* Inline mode (default) - single table with sticky header */
          <Table className="w-full" style={{ tableLayout: 'fixed' }}>
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
      </>
    );
  };

  // Threshold for switching to virtualized rendering
  // Below this, use standard table (better for editing, printing, small datasets)
  // Above this, use virtual scrolling (better for performance with large datasets)
  const VIRTUALIZATION_THRESHOLD = 200;

  // Render flat table - uses virtualization for large datasets
  const renderFlatTable = () => {
    // Empty state
    if (filteredAndSortedEntries.length === 0) {
      // Determine which type of empty state to show
      const hasOriginalData = effectiveEntries.length > 0;
      const hasSearch = !!search;
      const hasFilters = safeFilters.length > 0;

      const emptyVariant = serverSearchLoading
        ? "loading"
        : getEmptyStateVariant({
            hasData: hasOriginalData,
            hasSearch,
            hasFilters,
          });

      return (
        <Table className="w-full" style={{ tableLayout: 'auto' }}>
          {renderTableHeader()}
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={visibleColumnsInOrder.length}
                className="p-0"
              >
                <EmptyState
                  variant={emptyVariant}
                  isLoading={serverSearchLoading}
                  searchTerm={search}
                  filterCount={safeFilters.length}
                  onClearSearch={search ? () => setSearch("") : undefined}
                  onClearFilters={safeFilters.length > 0 ? () => {
                    // Clear cascade filters
                    setCascadeFilters([]);
                  } : undefined}
                  onAddRecord={effectiveOnAddRow}
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );
    }

    // Use virtualized table for large datasets (60fps with 100K+ rows)
    if (filteredAndSortedEntries.length > VIRTUALIZATION_THRESHOLD) {
      return (
        <VirtualizedFlatTable
          rows={filteredAndSortedEntries}
          selectedRows={selectedRows}
          visibleColumnsInOrder={visibleColumnsInOrder}
          columnWidths={columnWidths}
          editingRowIds={editingRowIds}
          getStickyColumnStyles={getStickyColumnStyles}
          isSystemGeneratedColumn={isSystemGeneratedColumn}
          SYSTEM_COLUMN_BG={SYSTEM_COLUMN_BG}
          getToggleCallback={getToggleCallback}
          handleSelectMouseDown={handleSelectMouseDown}
          handleRowMouseEnter={handleRowMouseEnter}
          isRowInDragRange={isRowInDragRange}
          onRowClick={onRowClick}
          onRowDoubleClick={onRowDoubleClick}
          renderCellValue={renderCellValue}
          renderTableHeader={renderTableHeader}
          renderTableFooter={() => renderTableFooter(filteredAndSortedEntries)}
          isEditMode={isEditMode}
          showTotals={showTotals}
          tableHeight={600}
          // Keyboard navigation
          focusedRowIndex={focusedRowIndex}
          onFocusRow={setFocusedRowIndex}
          tableHasFocus={tableHasFocus}
        />
      );
    }

    // Standard table for small datasets (better for editing, printing)
    // tableLayout: fixed ensures column widths are respected (SSoT: user-set widths)
    return (
      <Table className="w-full" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          {visibleColumnsInOrder.map((column) => (
            <col
              key={column.key}
              style={{ width: column.key === "select" ? 40 : (columnWidths[column.key] || column.width || 150) }}
            />
          ))}
        </colgroup>
        {renderTableHeader()}
        <TableBody>
          {displayedRows.map((row, rowIndex) => {
            const globalIndex = filteredAndSortedEntries.findIndex(e => e.id === row.id);
            const isFocused = focusedRowIndex === globalIndex;
            return (
              <TableRow
                key={`${row.id}-${rowIndex}`}
                data-row-id={row.id}
                className={cn(
                  selectedRows.has(row.id) && "bg-muted/50",
                  isRowInDragRange(row.id) && !selectedRows.has(row.id) && "bg-blue-100 dark:bg-blue-900/30",
                  editingRowIds.has(row.id) && "bg-blue-50 dark:bg-blue-950/20",
                  isFocused && tableHasFocus && "ring-2 ring-inset ring-primary/50 bg-primary/5",
                  "hover:bg-muted/30 cursor-pointer"
                )}
                onClick={(e) => {
                  if (!isEditMode && !editingRowIds.has(row.id) && onRowClick) {
                    onRowClick(row);
                  }
                  setFocusedRowIndex(globalIndex);
                }}
                onDoubleClick={() =>
                  !isEditMode && !editingRowIds.has(row.id) && onRowDoubleClick?.(row)
                }
                onMouseEnter={() => handleRowMouseEnter(row.id, globalIndex)}
              >
                {visibleColumnsInOrder.map((column, colIndex) => {
                  const isSystemGen = isSystemGeneratedColumn(column);
                  const stickyStyles = getStickyColumnStyles(column.key, false);
                  return (
                    <TableCell
                      key={`${column.key}-${colIndex}`}
                      title={column.key !== "select" && column.key !== "actions" ? getCellTooltip(row[column.key]) : undefined}
                      style={{
                        width: columnWidths[column.key] || column.width,
                        minWidth: columnWidths[column.key] || column.width,
                        ...stickyStyles,
                        ...(column.key === "select" && {
                          textAlign: 'center',
                          verticalAlign: 'middle'
                        }),
                        ...(isSystemGen && column.key !== "select" && column.key !== "actions" && {
                          backgroundColor: SYSTEM_COLUMN_BG,
                        })
                      }}
                      className={cn(
                        column.key === "select" && "!border-r-0 !p-0 !h-full",
                        column.key === "actions" && "!border-l-0"
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
                      ) : column.key === "actions" ? (
                        renderCellValue(row, column)
                      ) : (
                        <div
                          className="truncate"
                          title={getCellTooltip(row[column.key])}
                        >
                          {renderCellValue(row, column)}
                        </div>
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
    <div className={cn(
      "flex flex-col h-full gap-2",
      debugGrid && "border-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 relative"
    )}>
      {/* DEBUG: Main Container Label */}
      {debugGrid && (
        <div className="absolute top-0 left-0 bg-blue-600 text-white px-2 py-1 text-xs font-bold z-50">
          [1] MAIN CONTAINER (BLUE) - flex flex-col h-full gap-2
        </div>
      )}

      {/* Data Health Widget - shown when button clicked or showDataHealth prop is true */}
      {(healthPanelOpen || showDataHealth) && foundationIdNumeric && (
        <div className={cn("px-4", debugGrid && "border-2 border-cyan-500 bg-cyan-50 dark:bg-cyan-950/20 relative")}>
          {debugGrid && (
            <div className="absolute top-0 left-0 bg-cyan-600 text-white px-2 py-1 text-xs font-bold z-50">
              [1a] DATA HEALTH (CYAN)
            </div>
          )}
          <DataHealthWidget
            foundationId={foundationIdNumeric}
            compact={!healthPanelOpen}
            forceShow={healthPanelOpen}
            onIssueClick={onDataHealthIssueClick}
            onDataChanged={onRefresh}
          />
        </div>
      )}

      {/* Page Header - Title + count on LEFT, totals on RIGHT (SSoT) */}
      {showHeader && (
        <div className={cn(
          "flex items-center justify-between px-4 shrink-0",
          debugGrid && "border-2 border-green-500 bg-green-50 dark:bg-green-950/20 relative"
        )}>
          {debugGrid && (
            <div className="absolute top-0 left-0 bg-green-600 text-white px-2 py-1 text-xs font-bold z-50">
              [2] HEADER (GREEN) - flex justify-between px-4 shrink-0
            </div>
          )}
          <div className={cn(
            "flex items-center gap-3",
            debugGrid && "border border-green-300 bg-green-100/50 dark:bg-green-900/30 mt-6"
          )}>
            <h1 className="text-2xl font-bold tracking-tight font-serif">{tableName}</h1>
            <span className="text-sm text-muted-foreground">
              {totalCount !== null
                ? `${filteredAndSortedEntries.length.toLocaleString()} of ${totalCount.toLocaleString()} records`
                : `${filteredAndSortedEntries.length.toLocaleString()} records`}
            </span>
            {/* Load All button OR loading indicator - inline with record count */}
            {loadingMore ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading more records...
              </span>
            ) : serverHasMore && onLoadAll ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadAll}
                className="gap-1.5 h-7 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Load All {totalCount !== null && totalCount !== undefined ? `(${totalCount - entries.length})` : ''}
              </Button>
            ) : null}
            {/* Virtual scroll indicator - shown when table exceeds threshold */}
            {filteredAndSortedEntries.length > VIRTUALIZATION_THRESHOLD && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Virtual scroll active
              </span>
            )}
          </div>
          {/* Totals in header (only when showTotals enabled and has numeric columns) */}
          {showTotals && Object.keys(columnTotals).length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {Object.entries(columnTotals).map(([key, data]) => (
                <span key={key} className="bg-muted px-1.5 py-0.5 rounded text-[11px]">
                  {data.label}: <span className="font-mono">{formatTotal(key)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Toolbar - First row: Search and main actions */}
      <div className={cn(
        "flex items-center justify-between gap-4 px-4",
        debugGrid && "border-2 border-purple-500 bg-purple-50 dark:bg-purple-950/20 relative"
      )}>
          {debugGrid && (
            <div className="absolute top-0 left-0 bg-purple-600 text-white px-2 py-1 text-xs font-bold z-50">
              [3] TOOLBAR (PURPLE) - flex justify-between gap-4 px-4
            </div>
          )}
          {/* Left section: Add button + leftActions + Search */}
          <div className={cn(
            "toolbar-left flex items-center gap-2 flex-shrink-0",
            debugGrid && "border border-purple-300 bg-purple-100/50 dark:bg-purple-900/30 mt-6"
          )}>
            {/* Add Row button - auto-shown when effectiveOnAddRow is available */}
            {effectiveOnAddRow && (
              <Button
                variant="default"
                size="sm"
                onClick={effectiveOnAddRow}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Record
              </Button>
            )}
            {/* Edit Mode Toggle - enables inline cell editing (hidden in viewOnly mode) */}
            <EditModeToggle show={!viewOnly} />
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
            serverSearchLoading={effectiveServerSearchLoading}
            hasServerSearch={showSearchOptionsMenu}
            searchMode={currentSearchMode}
            onSearchModeChange={(mode) => {
              setCurrentSearchMode(mode);
              onSearchModeChange?.(mode);
            }}
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

          {/* Bulk action buttons - show when rows selected (SSoT: always in first row) */}
          {selectedRows.size > 0 && (
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
              {/* Xero Transfer button - transfer Xero link between exactly 2 contacts */}
              {onXeroTransfer && !viewOnly && selectedRows.size === 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onXeroTransfer(Array.from(selectedRows))}
                >
                  <ArrowLeftRight className="h-4 w-4 mr-1" />
                  Xero
                </Button>
              )}
              {/* Delete button - bulk delete selected rows (auto-enabled with foundationIdNumeric) */}
              {effectiveBulkDelete && !viewOnly && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => effectiveBulkDelete(Array.from(selectedRows))}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
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
                  {(foundationId === "contacts" || foundationIdNumeric === 214) && (
                    <DropdownMenuItem onClick={handleFindMissingAbns} disabled={isFindingAbns}>
                      {isFindingAbns ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      Find Missing ABNs
                    </DropdownMenuItem>
                  )}
                </>
              )}

              {/* Display Options Section */}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                DISPLAY
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setShowColumnFilters(!showColumnFilters)}
                className="flex items-center justify-between"
              >
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Column Filters
                </span>
                {showColumnFilters && <Check className="h-4 w-4" />}
              </DropdownMenuItem>

              {/* Table Info Section */}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                TABLE INFO
              </DropdownMenuLabel>

              {foundationIdNumeric && (
                <>
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
                  <DropdownMenuItem
                    onClick={() => window.open(`/admin/system?tab=gold-standard&foundation=${foundationIdNumeric}`, '_blank')}
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Configure Table
                    <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground" />
                  </DropdownMenuItem>
                </>
              )}

            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Second row: Saved Views OR Selection Controls (for grouped tables) */}
      {((!disableSavedViews && savedViews.length > 0) || groupByColumn) && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 px-4">
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
              {/* Selection dropdown for grouped tables */}
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

              {/* Selection count and clear - bulk action buttons are in the first toolbar row (SSoT) */}
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
              {/* Uses native title attributes to avoid compose-refs issues during view switching */}
              {savedViews.map((view) => (
                <Button
                  key={view.id}
                  variant={activeViewId === view.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => loadViewState(view)}
                  title={view.is_global ? `Global view: ${view.name}` : `Personal view: ${view.name}`}
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
              ))}
            </>
          )}
        </div>
      )}

      {/* Active filters indicator - only show when NO saved view is active (view buttons already indicate active view) */}
      {safeFilters.length > 0 && !activeViewId && (
        <div className="flex items-center gap-2 flex-wrap px-4">
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
          {/* Xero Transfer button - transfer Xero link between exactly 2 contacts */}
          {onXeroTransfer && !viewOnly && selectedRows.size === 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onXeroTransfer?.(Array.from(selectedRows))}
            >
              <ArrowLeftRight className="h-4 w-4 mr-1" />
              Xero
            </Button>
          )}
          {/* Delete button (auto-enabled with foundationIdNumeric) */}
          {effectiveBulkDelete && !viewOnly && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => effectiveBulkDelete?.(Array.from(selectedRows))}
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

      {/* Table - scrollable container with max height so scrollbar stays visible */}
      {/* Account for: nav(64) + page header(80) + data health(60 collapsed/40vh expanded) + toolbar(50) + footer(30) */}
      {/* Keyboard navigation: Arrow keys, Enter, Space, Escape, / (search) */}
      <div
        ref={tableContainerRef}
        className={cn(
          "flex-1 min-h-0 w-full overflow-auto relative border-t border-b",
          tableHasFocus && "ring-2 ring-primary/20 ring-inset",
          debugGrid && "border-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20"
        )}
        role="region"
        aria-label={`${tableName} table with ${filteredAndSortedEntries.length} rows`}
        aria-busy={columnsLoading || serverSearchLoading || loadingMore}
        {...keyboardProps}
      >
        {debugGrid && (
          <div className="sticky top-0 left-0 bg-orange-600 text-white px-2 py-1 text-xs font-bold z-50 inline-block">
            [4] TABLE CONTAINER (ORANGE) - flex-1 min-h-0 overflow-auto
          </div>
        )}
        {/* Show skeleton while columns are loading */}
        {columnsLoading ? (
          <TableSkeleton
            rowCount={10}
            columnCount={Math.min(visibleColumnsInOrder.length || 6, 8)}
            showHeader
          />
        ) : filteredAndSortedEntries.length === 0 && loadingMore ? (
          /* Show loading state when searching but still loading records */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p className="text-sm font-medium">Loading records...</p>
            <p className="text-xs mt-1">Searching through all {totalCount || 'available'} records</p>
          </div>
        ) : filteredAndSortedEntries.length === 0 && search ? (
          /* Show no results message when search is active but no matches */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="h-8 w-8 mb-4 opacity-50" />
            <p className="text-sm font-medium">No results found</p>
            <p className="text-xs mt-1">No records match "{search}"</p>
          </div>
        ) : (
          groupedEntries ? renderGroupedTable() : renderFlatTable()
        )}
      </div>

      {/* Footer - only shows selected count (totals moved to header) */}
      {!hideFooter && selectedRows.size > 0 && (
        <div className={cn(
          "flex items-center justify-end text-xs text-muted-foreground shrink-0 py-1 px-4",
          debugGrid && "border-2 border-red-500 bg-yellow-50 dark:bg-yellow-950/20 relative"
        )}>
          {debugGrid && (
            <div className="absolute top-0 left-0 bg-red-600 text-white px-2 py-1 text-xs font-bold z-50">
              [5] FOOTER (YELLOW/RED) - shrink-0
            </div>
          )}
          <span>{visibleSelectedCount} selected{selectedRows.size !== visibleSelectedCount && ` (${selectedRows.size - visibleSelectedCount} hidden)`}</span>
        </div>
      )}

      {/* Bulk Update Modal */}
      <BulkUpdateModal
        open={showBulkUpdateModal}
        onOpenChange={setShowBulkUpdateModal}
        selectedRowsCount={visibleSelectedCount}
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
        searchableColumns={searchableColumns}
        setSearchableColumns={setSearchableColumns}
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
          onStickyActionsChange={setStickyActions}
          onRefresh={onRefresh}
          rows={entries as Record<string, unknown>[]}
          currentColumnWidths={columnWidths}
          activeViewId={activeViewId}
        />
      )}

      {/* ============================================================================ */}
      {/* RECORD CRUD MODALS (Phase 8) - Auto-enabled when foundationIdNumeric is set */}
      {/* ============================================================================ */}
      {foundationIdNumeric && (
        <>
          {/* Add Record Dialog */}
          <CreateRecordDialog
            open={showAddRecordModal}
            onOpenChange={setShowAddRecordModal}
            foundationId={foundationIdNumeric}
            tableName={tableName}
            columns={COLUMNS}
            onSuccess={() => {
              setShowAddRecordModal(false);
              onRefresh?.();
            }}
          />

          {/* Edit Record Modal */}
          <EditRecordModal
            open={showEditRecordModal}
            onOpenChange={setShowEditRecordModal}
            foundationId={foundationIdNumeric}
            tableName={tableName}
            columns={COLUMNS}
            record={selectedRecordForModal}
            onSuccess={() => {
              setShowEditRecordModal(false);
              setSelectedRecordForModal(null);
              onRefresh?.();
            }}
          />

          {/* View Record Modal */}
          <ViewRecordModal
            open={showViewRecordModal}
            onOpenChange={(open) => {
              setShowViewRecordModal(open);
              if (!open) setSelectedRecordForModal(null);
            }}
            tableName={tableName}
            columns={COLUMNS}
            record={selectedRecordForModal}
            onEdit={() => {
              // Switch from View to Edit mode
              setShowViewRecordModal(false);
              setShowEditRecordModal(true);
            }}
          />
        </>
      )}
    </div>
  );
}
