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
  startTransition,
} from "react";
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
  ChevronsDownUp,
  ChevronsUpDown,
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
import { DataHealthWidget } from "./DataHealthWidget";
import { ColumnEditorModal } from "./ColumnEditorModal";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import { MergeModal } from "./MergeModal";
import { GlobalViewsManager } from "@/app/(app)/admin/system/components/GlobalViewsManager";

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

// Sortable Column Row for Edit Columns modal - with drag handle and position input
interface SortableColumnRowProps {
  id: string;
  column: TableColumn;
  isVisible: boolean;
  index: number;
  totalVisible: number;
  onToggleVisibility: () => void;
  onReorder: (newPosition: number) => void;
  columnWidth: number;
  onWidthChange: (width: number) => void;
  getColumnTypeEmoji: (type: string) => string;
  getColumnTypeSqlType: (type: string) => string;
  getColumnTypeLabel: (type: string) => string;
  getColumnTypeValidationRules: (type: string) => string;
}

function SortableColumnRow({
  id,
  column,
  isVisible,
  index,
  totalVisible,
  onToggleVisibility,
  onReorder,
  columnWidth,
  onWidthChange,
  getColumnTypeEmoji,
  getColumnTypeSqlType,
  getColumnTypeLabel,
  getColumnTypeValidationRules,
}: SortableColumnRowProps) {
  const [isEditingPosition, setIsEditingPosition] = React.useState(false);
  const [positionValue, setPositionValue] = React.useState(String(index));
  const inputRef = React.useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const columnType = column.column_type || "single_line_text";
  const sqlType = getColumnTypeSqlType(columnType);
  const displayLabel = getColumnTypeLabel(columnType);
  const typeEmoji = getColumnTypeEmoji(columnType);
  const validationRules = getColumnTypeValidationRules(columnType);
  const isSystemColumn = ['id', 'created_at', 'updated_at'].includes(column.key);

  // Focus input when editing starts
  React.useEffect(() => {
    if (isEditingPosition && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingPosition]);

  const handlePositionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isVisible) {
      setPositionValue(String(index));
      setIsEditingPosition(true);
    }
  };

  const handlePositionSubmit = () => {
    const newPos = parseInt(positionValue, 10);
    if (!isNaN(newPos) && newPos >= 1 && newPos <= totalVisible) {
      onReorder(newPos);
    }
    setIsEditingPosition(false);
  };

  const handlePositionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePositionSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingPosition(false);
      setPositionValue(String(index));
    }
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "hover:bg-muted/50",
        isDragging && "opacity-50 bg-muted",
        isSystemColumn && "bg-red-50 dark:bg-red-950/30",
        !isVisible && "opacity-60"
      )}
    >
      {/* Drag Handle + Position */}
      <TableCell className="w-16">
        <div className="flex items-center gap-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none p-1 hover:bg-muted rounded"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          {isVisible && (
            isEditingPosition ? (
              <input
                ref={inputRef}
                type="text"
                value={positionValue}
                onChange={(e) => setPositionValue(e.target.value)}
                onBlur={handlePositionSubmit}
                onKeyDown={handlePositionKeyDown}
                className="w-8 h-6 text-xs font-medium text-center bg-background border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary"
              />
            ) : (
              <button
                onClick={handlePositionClick}
                className="flex items-center justify-center w-6 h-6 text-xs font-medium bg-muted hover:bg-primary/20 hover:text-primary rounded cursor-pointer transition-colors"
                title="Click to change position"
              >
                {index}
              </button>
            )
          )}
        </div>
      </TableCell>
      {/* Visibility Checkbox */}
      <TableCell className="w-12">
        <Checkbox
          checked={isVisible}
          onCheckedChange={() => onToggleVisibility()}
        />
      </TableCell>
      {/* Column Name */}
      <TableCell>
        <div className="flex items-center gap-2">
          <span>{typeEmoji}</span>
          <span className="font-medium">{column.label}</span>
        </div>
      </TableCell>
      {/* SQL Type */}
      <TableCell>
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
          {sqlType}
        </code>
      </TableCell>
      {/* Display Type */}
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {displayLabel}
        </span>
      </TableCell>
      {/* Validation Rules */}
      <TableCell>
        <span className="text-xs text-muted-foreground">
          {validationRules}
        </span>
      </TableCell>
      {/* Width */}
      <TableCell>
        <Input
          type="number"
          value={columnWidth}
          onChange={(e) => onWidthChange(parseInt(e.target.value) || 50)}
          className="w-16 h-8 text-sm"
          min={50}
          max={500}
        />
      </TableCell>
    </TableRow>
  );
}

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
  onEdit,
  sortInfo,
  isGroupedBy,
  isEditMode,
  children,
}: {
  column: TableColumn;
  width: number;
  onResize: (key: string, width: number) => void;
  onSort: (key: string) => void;
  onHide: (key: string) => void;
  onGroupBy: (key: string | null) => void;
  onAddFilter: (key: string) => void;
  onEdit?: (key: string) => void;
  sortInfo?: SortColumn;
  isGroupedBy: boolean;
  isEditMode?: boolean;
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

      {/* Edit column button - outside dropdown trigger */}
      {isEditMode && onEdit && column.key !== "id" && column.key !== "created_at" && column.key !== "updated_at" && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit(column.key);
          }}
          className="p-1 rounded hover:bg-muted ml-1 flex-shrink-0 z-10"
          title="Edit column settings"
        >
          <Settings className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      )}

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
  lookupOptions,
  lookupLoading,
  onFetchLookupOptions,
}: {
  filter: CascadeFilter;
  columns: TableColumn[];
  onUpdate: (id: string | number, updates: Partial<CascadeFilter>) => void;
  onRemove: (id: string | number) => void;
  lookupOptions?: Record<string, Array<{ id: number; display: string }>>;
  lookupLoading?: Record<string, boolean>;
  onFetchLookupOptions?: (column: TableColumn) => void;
}) {
  const column = columns.find((c) => c.key === filter.column);

  // Fetch lookup options when column changes to a lookup type
  useEffect(() => {
    if (column && (column.column_type === 'lookup' || column.column_type === 'relation') &&
        column.lookup_config?.target_table_id && onFetchLookupOptions) {
      onFetchLookupOptions(column);
    }
  }, [column, onFetchLookupOptions]);

  // Determine if this column should show a dropdown for values
  const isLookupColumn = column?.column_type === 'lookup' || column?.column_type === 'relation';
  const isChoiceColumn = column?.column_type === 'choice';
  const isBooleanColumn = column?.column_type === 'boolean';
  const options = lookupOptions?.[filter.column] || [];
  const isLoading = lookupLoading?.[filter.column] || false;

  // Render value input based on column type
  const renderValueInput = () => {
    if (["is_empty", "is_not_empty"].includes(filter.operator)) {
      return null;
    }

    // Boolean column - show Yes/No dropdown
    if (isBooleanColumn) {
      return (
        <Select
          value={filter.value === true || filter.value === 'true' ? 'true' : filter.value === false || filter.value === 'false' ? 'false' : ''}
          onValueChange={(value) => onUpdate(filter.id, { value: value === 'true' })}
        >
          <SelectTrigger className="flex-1 h-8">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    // Choice column - show searchable choices dropdown
    if (isChoiceColumn && column?.choices && column.choices.length > 0) {
      const choiceItems: ComboboxItem[] = column.choices.map((choice) => ({
        id: choice,
        label: choice,
      }));
      const selectedChoice = choiceItems.find((item) => item.id === String(filter.value || ''));

      return (
        <div className="flex-1">
          <ComboboxDropdown
            items={choiceItems}
            selectedItem={selectedChoice}
            onSelect={(item) => onUpdate(filter.id, { value: item.id })}
            placeholder="Select..."
            searchPlaceholder="Search choices..."
          />
        </div>
      );
    }

    // Lookup column - show lookup values dropdown
    if (isLookupColumn && column?.lookup_config?.target_table_id) {
      if (isLoading) {
        return (
          <div className="flex-1 h-8 flex items-center px-3 text-sm text-muted-foreground bg-muted rounded-md">
            Loading...
          </div>
        );
      }

      if (options.length > 0) {
        const lookupItems: ComboboxItem[] = options.map((opt) => ({
          id: String(opt.id),
          label: opt.display,
        }));
        const selectedLookup = lookupItems.find((item) => item.id === String(filter.value || ''));

        return (
          <div className="flex-1">
            <ComboboxDropdown
              items={lookupItems}
              selectedItem={selectedLookup}
              onSelect={(item) => onUpdate(filter.id, { value: item.id })}
              placeholder="Select..."
              searchPlaceholder="Search records..."
            />
          </div>
        );
      }
    }

    // Default text input
    return (
      <Input
        className="flex-1 h-8"
        value={String(filter.value || "")}
        onChange={(e) => onUpdate(filter.id, { value: e.target.value })}
        placeholder="Value..."
      />
    );
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <Select
        value={filter.column}
        onValueChange={(value) => onUpdate(filter.id, { column: value, value: '' })}
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

      {renderValueInput()}

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
  { key: "id", label: "ID", resizable: true, sortable: true, filterable: true, width: 50 },
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
      result.push({ key: "actions", label: "Actions", resizable: false, sortable: false, filterable: false, width: 100 });
    }
    return result;
  }, [columns]);

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
  // STATE
  // ============================================================================

  const [search, setSearch] = useState("");
  const [searchAllColumns, setSearchAllColumns] = useState(false);
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const [columnWidths, setColumnWidths] = useState<ColumnWidthsState>(DEFAULT_COLUMN_WIDTHS);
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_COLUMN_ORDER);
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumnsState>(getDefaultVisibleColumns);

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
  const [groupViewMode, setGroupViewMode] = useState<"inline" | "panel">("inline"); // inline = groups as rows in table (default), panel = groups above header
  const [showTotals, setShowTotals] = useState(initialShowTotals); // Show column totals in footer
  const [autoFitColumns, setAutoFitColumns] = useState(false); // Auto-fit column widths to content
  const [editingRowIds, setEditingRowIds] = useState<Set<number | string>>(new Set()); // Multi-row editing
  const [editingData, setEditingData] = useState<Record<string | number, Record<string, unknown>>>({}); // keyed by row id
  const [validationErrors, setValidationErrors] = useState<Record<string, Record<string, string>>>({}); // {rowId: {columnKey: errorMessage}}
  // Cell-level inline editing state (for single-click dropdown, double-click text)
  const [editingCell, setEditingCell] = useState<{ rowId: number | string; columnKey: string } | null>(null);
  const [editingCellValue, setEditingCellValue] = useState<unknown>(null);
  const [lookupOptions, setLookupOptions] = useState<Record<string, Array<{ id: number; display: string }>>>({});
  const [lookupLoading, setLookupLoading] = useState<Record<string, boolean>>({});

  // Merge modal state (shared across all tables)
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSelectedIds, setMergeSelectedIds] = useState<(string | number)[]>([]);

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

  // Schema editor modal states
  const [showCreateColumnModal, setShowCreateColumnModal] = useState(false);
  const [showEditColumnsModal, setShowEditColumnsModal] = useState(false);
  const [showDeleteColumnModal, setShowDeleteColumnModal] = useState(false);
  const [showViewSchemaModal, setShowViewSchemaModal] = useState(false);
  const [showEditColumnModal, setShowEditColumnModal] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState("text");
  const [selectedColumnToDelete, setSelectedColumnToDelete] = useState("");
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [columnEditMode, setColumnEditMode] = useState(false);
  const [editingColumnKey, setEditingColumnKey] = useState<string | null>(null);
  const [editColumnName, setEditColumnName] = useState("");
  const [editColumnType, setEditColumnType] = useState("");

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportScope, setExportScope] = useState<"visible" | "all">("visible");
  const [exportFormat, setExportFormat] = useState<"csv" | "excel" | "pdf">("csv");

  // Global Views Manager state (auto-enabled when foundationIdNumeric is set)
  const [showGlobalViewsManager, setShowGlobalViewsManager] = useState(false);

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
  const getSortedColumnsForModal = useCallback(() => {
    const dataColumns = COLUMNS.filter(c => c.key !== "select" && c.key !== "actions");
    const orderMap = new Map(columnOrder.map((key, idx) => [key, idx]));
    return [...dataColumns].sort((a, b) => {
      const aIdx = orderMap.get(a.key) ?? 999;
      const bIdx = orderMap.get(b.key) ?? 999;
      return aIdx - bIdx;
    });
  }, [COLUMNS, columnOrder]);

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
    setSelectedRows(new Set());
    // Refresh data
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh]);

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

  // Fetch lookup options for a column
  const fetchLookupOptions = useCallback(async (column: TableColumn) => {
    const targetTableId = column.lookup_config?.target_table_id;
    if (!targetTableId || lookupOptions[column.key]) return;

    setLookupLoading(prev => ({ ...prev, [column.key]: true }));
    try {
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

      const displayColumn = column.lookup_config?.display_column || 'name';
      console.log('[fetchLookupOptions] targetTableId:', targetTableId, 'records:', records.length, 'displayColumn:', displayColumn);

      const options = records.map((record) => ({
        id: record.id as number,
        display: String(record[displayColumn] || record.name || record.title || record.id),
      }));

      setLookupOptions(prev => ({ ...prev, [column.key]: options }));
    } catch (error) {
      console.error('Failed to fetch lookup options:', error);
      setLookupOptions(prev => ({ ...prev, [column.key]: [] }));
    } finally {
      setLookupLoading(prev => ({ ...prev, [column.key]: false }));
    }
  }, [lookupOptions]);

  // Inline editing handlers - supports single or multiple rows
  const startEditing = useCallback((row: TableRowType) => {
    setEditingRowIds(new Set([row.id]));
    setEditingData({ [row.id]: { ...row } });

    // Pre-fetch lookup options for lookup columns
    console.log('[startEditing] Checking columns for lookup options...');
    COLUMNS.forEach(col => {
      if (col.column_type === 'lookup' || col.column_type === 'relation') {
        console.log('[startEditing] Found lookup column:', col.key, 'lookup_config:', col.lookup_config);
        if (col.lookup_config?.target_table_id) {
          fetchLookupOptions(col);
        } else {
          console.warn('[startEditing] Lookup column missing lookup_config.target_table_id:', col.key);
        }
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

    // Pre-fetch lookup options for lookup columns
    COLUMNS.forEach(col => {
      if (col.column_type === 'lookup' || col.column_type === 'relation') {
        if (col.lookup_config?.target_table_id) {
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

  // Validate a single cell value based on column type
  const validateCell = useCallback((columnKey: string, value: unknown, columnType?: string): string | null => {
    // Skip validation for empty values (they're optional)
    if (value === null || value === undefined || value === '') return null;

    const strValue = String(value);

    switch (columnType) {
      case 'email':
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(strValue)) {
          return 'Invalid email address';
        }
        break;

      case 'phone':
      case 'mobile':
        // Phone validation - allow digits, spaces, dashes, parentheses, plus
        // Must have at least 8 digits for Australian numbers
        const phoneRegex = /^[\d\s\-\(\)\+]+$/;
        if (strValue && !phoneRegex.test(strValue)) {
          return 'Invalid phone number';
        }
        // Count actual digits
        const digitCount = strValue.replace(/\D/g, '').length;
        if (digitCount > 0 && digitCount < 8) {
          return 'Phone must have at least 8 digits';
        }
        break;

      case 'url':
        // Basic URL validation
        try {
          new URL(strValue);
        } catch {
          return 'Invalid URL';
        }
        break;

      case 'number':
      case 'currency':
        if (strValue && isNaN(Number(strValue))) {
          return 'Must be a number';
        }
        if (Number(strValue) < 0) {
          return 'Must be 0 or greater';
        }
        break;

      case 'percentage':
        if (strValue && isNaN(Number(strValue))) {
          return 'Must be a number';
        }
        const pctVal = Number(strValue);
        if (pctVal < 0 || pctVal > 100) {
          return 'Must be between 0 and 100';
        }
        break;

      case 'whole_number':
        if (strValue && isNaN(Number(strValue))) {
          return 'Must be a number';
        }
        if (!Number.isInteger(Number(strValue))) {
          return 'Must be a whole number';
        }
        if (Number(strValue) < 0) {
          return 'Must be 0 or greater';
        }
        break;

      case 'gps_coordinates':
        // Format: latitude,longitude (e.g., -33.8688,151.2093)
        if (strValue && !/^-?\d+\.?\d*,-?\d+\.?\d*$/.test(strValue)) {
          return 'Must be format: latitude,longitude';
        }
        break;

      case 'color_picker':
        // Hex color format: #XXXXXX
        if (strValue && !/^#[0-9A-Fa-f]{6}$/.test(strValue)) {
          return 'Must be hex color (e.g., #FF0000)';
        }
        break;

      case 'bank_account':
        // Australian bank account - 6 to 10 digits
        const bankClean = strValue.replace(/[\s\-]/g, '');
        if (bankClean && !/^\d{6,10}$/.test(bankClean)) {
          return 'Account must be 6-10 digits';
        }
        break;

      case 'abn':
        // Australian Business Number - 11 digits
        const abnClean = strValue.replace(/\s/g, '');
        if (abnClean && (!/^\d{11}$/.test(abnClean))) {
          return 'ABN must be 11 digits';
        }
        break;

      case 'acn':
        // Australian Company Number - 9 digits
        const acnClean = strValue.replace(/\s/g, '');
        if (acnClean && (!/^\d{9}$/.test(acnClean))) {
          return 'ACN must be 9 digits';
        }
        break;

      case 'bsb':
        // BSB - 6 digits (often formatted as XXX-XXX)
        const bsbClean = strValue.replace(/[\s\-]/g, '');
        if (bsbClean && (!/^\d{6}$/.test(bsbClean))) {
          return 'BSB must be 6 digits';
        }
        break;

      case 'postcode':
        // Australian postcode - 4 digits
        if (strValue && (!/^\d{4}$/.test(strValue))) {
          return 'Postcode must be 4 digits';
        }
        break;

      case 'tfn':
        // Tax File Number - 8 or 9 digits
        const tfnClean = strValue.replace(/\s/g, '');
        if (tfnClean && (!/^\d{8,9}$/.test(tfnClean))) {
          return 'TFN must be 8-9 digits';
        }
        break;
    }

    return null;
  }, []);

  // Validate a cell and update validation errors state
  const handleCellBlur = useCallback((rowId: number | string, columnKey: string, value: unknown, columnType?: string) => {
    const error = validateCell(columnKey, value, columnType);

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
  }, [validateCell]);

  const saveEditing = useCallback(async () => {
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
      // Save each edited row
      for (const rowId of editingRowIds) {
        const originalRow = entries.find((e) => e.id === rowId);
        const rowData = editingData[rowId];
        if (!originalRow || !rowData) continue;

        for (const [key, value] of Object.entries(rowData)) {
          if (originalRow[key] !== value) {
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
  }, [editingRowIds, editingData, entries, onRowUpdate, toast, validationErrors]);

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

  // Fetch lookup options when bulk update column changes to a lookup column
  useEffect(() => {
    if (!bulkUpdateColumn) return;

    const selectedCol = COLUMNS.find(c => c.key === bulkUpdateColumn);
    if (!selectedCol) return;

    const isLookup = selectedCol.column_type === 'lookup' || selectedCol.lookup_config;
    if (isLookup && !lookupOptions[bulkUpdateColumn] && !lookupLoading[bulkUpdateColumn]) {
      console.log('[BulkUpdate] Fetching lookup options for:', bulkUpdateColumn);
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
    const isLookup = colType === 'lookup' || colType === 'relation' || !!column.lookup_config;
    const isChoice = colType === 'choice' || colType === 'single_select' || colType === 'multi_select';
    const isBoolean = colType === 'boolean';
    return hasChoices || isLookup || isChoice || isBoolean;
  }, []);

  // Start editing a specific cell
  const startCellEdit = useCallback((rowId: number | string, column: TableColumn) => {
    if (!onRowUpdate) return;

    // System columns that are NEVER editable
    const NON_EDITABLE_COLUMNS = ['id', 'created_at', 'updated_at', 'select', 'actions'];
    const isComputed = column.column_type === 'computed' || column.column_type === 'formula';
    const isSystemColumn = NON_EDITABLE_COLUMNS.includes(column.key) || column.system === true;
    const isColumnEditable = column.editable !== false && !isSystemColumn && !isComputed;

    if (!isColumnEditable) return;

    const row = entries.find(e => e.id === rowId);
    if (!row) return;

    setEditingCell({ rowId, columnKey: column.key });
    setEditingCellValue(row[column.key]);

    // Pre-fetch lookup options if needed
    if (column.column_type === 'lookup' || column.column_type === 'relation') {
      if (column.lookup_config?.target_table_id) {
        fetchLookupOptions(column);
      }
    }
  }, [entries, onRowUpdate, fetchLookupOptions]);

  // Save cell edit
  const saveCellEdit = useCallback(async () => {
    if (!editingCell || !onRowUpdate) return;

    const row = entries.find(e => e.id === editingCell.rowId);
    if (!row) return;

    // Only save if value changed
    if (row[editingCell.columnKey] !== editingCellValue) {
      try {
        await onRowUpdate(editingCell.rowId, editingCell.columnKey, editingCellValue);
      } catch (error) {
        console.error("Failed to save cell:", error);
      }
    }

    setEditingCell(null);
    setEditingCellValue(null);
  }, [editingCell, editingCellValue, entries, onRowUpdate]);

  // Cancel cell edit
  const cancelCellEdit = useCallback(() => {
    setEditingCell(null);
    setEditingCellValue(null);
  }, []);

  // Handle cell click - single click for dropdowns
  const handleCellClick = useCallback((e: React.MouseEvent, row: TableRowType, column: TableColumn) => {
    // Don't interfere with row selection checkbox or actions
    if (column.key === 'select' || column.key === 'actions') return;

    // If already editing this cell, let the editor handle clicks
    if (editingCell?.rowId === row.id && editingCell?.columnKey === column.key) return;

    // For dropdown columns, start editing on single click
    if (isDropdownColumn(column) && onRowUpdate) {
      e.stopPropagation(); // Prevent row selection
      startCellEdit(row.id, column);
    }
  }, [editingCell, isDropdownColumn, onRowUpdate, startCellEdit]);

  // Handle cell double-click - for text columns
  const handleCellDoubleClick = useCallback((e: React.MouseEvent, row: TableRowType, column: TableColumn) => {
    // Don't interfere with row selection checkbox or actions
    if (column.key === 'select' || column.key === 'actions') return;

    // For non-dropdown columns, start editing on double click
    if (!isDropdownColumn(column) && onRowUpdate) {
      e.stopPropagation(); // Prevent row navigation
      startCellEdit(row.id, column);
    }
  }, [isDropdownColumn, onRowUpdate, startCellEdit]);

  // ============================================================================
  // SCHEMA HANDLERS
  // ============================================================================

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
  }, [newColumnName, newColumnType, foundationIdNumeric, onCreateColumn, onRefresh, toast]);

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
  }, [selectedColumnToDelete, foundationIdNumeric, COLUMNS, onDeleteColumn, onRefresh, toast]);

  // Copy table ID to clipboard
  const handleCopyTableId = useCallback(() => {
    if (foundationIdNumeric) {
      navigator.clipboard.writeText(String(foundationIdNumeric));
      toast({ title: "Copied", description: `Table ID ${foundationIdNumeric} copied to clipboard` });
    }
  }, [foundationIdNumeric, toast]);

  // Open column edit modal
  const handleOpenColumnEdit = useCallback((columnKey: string) => {
    const col = COLUMNS.find((c) => c.key === columnKey);
    if (col) {
      setEditingColumnKey(columnKey);
      setEditColumnName(col.label);
      setEditColumnType(col.column_type || "text");
      setShowEditColumnModal(true);
    }
  }, [COLUMNS]);

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
  }, [editingColumnKey, editColumnName, editColumnType, foundationIdNumeric, COLUMNS, onColumnUpdate, onRefresh, toast]);

  // Toggle column edit mode
  const toggleColumnEditMode = useCallback(() => {
    setColumnEditMode((prev) => !prev);
    if (columnEditMode) {
      toast({ title: "Edit Mode Off", description: "Column editing disabled" });
    } else {
      toast({ title: "Edit Mode On", description: "Click the cog icon on any column to edit it" });
    }
  }, [columnEditMode, toast]);

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
          // Map API format to frontend format and filter/sort
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mappedViews = (data.views as any[]).map((v) => {
            console.log('[TeeemTableView] View raw data:', { id: v.id, name: v.name, columns: v.columns, visibleColumns: v.visibleColumns });
            return {
            ...v,
            // Map columns.visible to visibleColumns (API format -> frontend format)
            visibleColumns: v.columns?.visible || v.visibleColumns || {},
            columnOrder: v.columns?.order || v.columnOrder || [],
            columnWidths: v.columns?.widths || v.columnWidths || {},
            autoFitColumns: v.columns?.autoFitColumns === true || v.autoFitColumns === true,
            showTotals: v.columns?.showTotals !== false && v.showTotals !== false, // Default to true
            // Map filters format
            filters: v.filters?.cascadeFilters || v.filters || [],
            filterGroups: v.filters?.filterGroups || v.filterGroups || [{ id: "default", logic: "AND" }],
            interGroupLogic: v.filters?.interGroupLogic || v.interGroupLogic || "OR",
            // Map sort and group
            sortColumns: Array.isArray(v.sort_order) ? v.sort_order : (v.sortColumns || []),
            groupByColumns: v.group_by_columns || v.groupByColumns || [],
          };
          }) as SavedView[];

          console.log('[TeeemTableView] Mapped views with autoFitColumns:', mappedViews.map(v => ({ id: v.id, name: v.name, autoFitColumns: v.autoFitColumns, showTotals: v.showTotals })));

          // Sort views by display_order
          const filteredViews = mappedViews
            .sort((a, b) => {
              // Global views first
              if (a.is_global && !b.is_global) return -1;
              if (!a.is_global && b.is_global) return 1;
              // Then by display_order
              return (a.display_order ?? 999) - (b.display_order ?? 999);
            });

          setSavedViews(filteredViews);

          // Auto-apply default view - prioritize global views, then display_order
          // Check URL for view parameter first
          const urlViewId = searchParams.get('view');
          if (urlViewId) {
            const urlView = filteredViews.find((v) => String(v.id) === urlViewId);
            if (urlView) {
              loadViewState(urlView);
              return;
            }
          }

          if (!activeViewId && filteredViews.length > 0) {
            // Find the best default: first check for explicit isDefault, then first global, then first by display_order
            const defaultView =
              filteredViews.find((v: SavedView) => v.isDefault && v.is_global) ||
              filteredViews.find((v: SavedView) => v.isDefault) ||
              filteredViews.find((v: SavedView) => v.is_global && v.display_order === 0) ||
              filteredViews.find((v: SavedView) => v.display_order === 0) ||
              filteredViews[0]; // Fallback to first view

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

  // Load view state helper - uses startTransition for non-urgent updates to avoid blocking UI
  const loadViewState = useCallback(
    (view: SavedView) => {
      // Helper to ensure filters have unique ids
      const ensureFilterIds = (filters: CascadeFilter[]) =>
        filters.map((f, idx) => ({
          ...f,
          id: f.id || `filter_${Date.now()}_${idx}`,
        }));

      // Wrap all state updates in startTransition to mark them as non-urgent
      // This allows React to interrupt the update if user interacts again
      startTransition(() => {
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
        // Only load saved column widths if auto-fit is NOT enabled
        // Check both direct property and columns object (API format varies)
        const viewAny = view as SavedView & { columns?: { autoFitColumns?: boolean; showTotals?: boolean } };
        const viewAutoFit = view.autoFitColumns === true ||
          (viewAny.columns && viewAny.columns.autoFitColumns === true);
        if (view.columnWidths && !viewAutoFit) {
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
        // Handle showTotals - check both direct property and columns object
        if (typeof view.showTotals === 'boolean') {
          setShowTotals(view.showTotals);
        } else if (viewAny.columns && typeof viewAny.columns.showTotals === 'boolean') {
          setShowTotals(viewAny.columns.showTotals);
        }
        // Handle autoFitColumns - check both direct property and columns object
        if (typeof view.autoFitColumns === 'boolean') {
          setAutoFitColumns(view.autoFitColumns);
        } else if (viewAny.columns && typeof viewAny.columns.autoFitColumns === 'boolean') {
          setAutoFitColumns(viewAny.columns.autoFitColumns);
        }
        // Hide filter editor when loading a saved view (user can click Filters button to show)
        setShowFilters(false);
        if (view.id) {
          setActiveViewId(view.id);
        }
      });

      // URL update is kept outside startTransition as it's a side effect
      if (view.id) {
        const currentParams = new URLSearchParams(searchParams.toString());
        currentParams.set('view', String(view.id));
        const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
        router.replace(newUrl, { scroll: false });
      }

      // Handle apiParams for server-side filtering
      if (view.filters && onViewApiParamsChange) {
        onViewApiParamsChange(null);
      }
    },
    [onViewApiParamsChange, searchParams, router]
  );

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

    return buildNestedGroups(filteredAndSortedEntries, groupByColumns, 0);
  }, [filteredAndSortedEntries, groupByColumns, getDisplayValue]);

  // Expand/collapse all group handlers (must be after groupedEntries)
  const expandAllGroups = useCallback(() => {
    setCollapsedGroups(new Set());
  }, []);

  const collapseAllGroups = useCallback(() => {
    if (groupedEntries) {
      const allKeys = getAllGroupKeys(groupedEntries);
      setCollapsedGroups(new Set(allKeys));
    }
  }, [groupedEntries, getAllGroupKeys]);

  // Auto-expand all groups when searching/filtering
  useEffect(() => {
    if (search.trim() && groupedEntries) {
      // Expand all groups when there's a search term
      setCollapsedGroups(new Set());
    }
  }, [search, groupedEntries]);

  // Get visible columns in order
  const visibleColumnsInOrder = useMemo(() => {
    // Start with columns from columnOrder that are visible
    const orderedVisible = columnOrder
      .filter((key) => visibleColumns[key] === true)
      .map((key) => COLUMNS.find((c) => c.key === key))
      .filter((col): col is TableColumn => col !== undefined);

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

  // Apply auto-fit widths when enabled
  useEffect(() => {
    console.log('[TeeemTableView] Auto-fit effect running, autoFitColumns:', autoFitColumns, 'entries:', filteredAndSortedEntries.length);
    if (autoFitColumns && filteredAndSortedEntries.length > 0) {
      const autoWidths = calculateAutoFitWidths();
      console.log('[TeeemTableView] Auto-fit widths calculated:', autoWidths);
      // Replace widths entirely when auto-fit is on (not merge)
      setColumnWidths(autoWidths);
    }
  }, [autoFitColumns, calculateAutoFitWidths, visibleColumnsInOrder]);

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

  // Export handler - exports to CSV
  const handleExportCSV = useCallback(() => {
    const columnsToExport = exportScope === "visible" ? visibleDataColumns : allDataColumns;

    // Helper to escape CSV values
    const escapeCSV = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      // If contains comma, quote, or newline, wrap in quotes and escape existing quotes
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Build header row
    const headers = columnsToExport.map((col) => escapeCSV(col.label || col.key));

    // Build data rows from filtered/sorted entries
    const rows = filteredAndSortedEntries.map((entry) => {
      return columnsToExport.map((col) => {
        const value = entry[col.key];
        // Handle objects (like nested relations)
        if (typeof value === "object" && value !== null) {
          if ("name" in value) return escapeCSV((value as { name: string }).name);
          if ("label" in value) return escapeCSV((value as { label: string }).label);
          return escapeCSV(JSON.stringify(value));
        }
        return escapeCSV(value);
      });
    });

    // Combine into CSV string
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    // Create and download blob
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const timestamp = new Date().toISOString().split("T")[0];
    const scopeLabel = exportScope === "visible" ? "visible" : "all";
    a.download = `${tableName.toLowerCase().replace(/\s+/g, "-")}-${scopeLabel}-${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Close modal and show toast
    setShowExportModal(false);
    toast({
      title: "Export Complete",
      description: `Exported ${filteredAndSortedEntries.length} rows with ${columnsToExport.length} columns`,
    });
  }, [exportScope, visibleDataColumns, allDataColumns, filteredAndSortedEntries, tableName, toast]);

  // Export handler - exports to Excel
  const handleExportExcel = useCallback(async () => {
    const columnsToExport = exportScope === "visible" ? visibleDataColumns : allDataColumns;

    // Dynamic import xlsx to avoid SSR issues
    const XLSX = await import('xlsx');

    // Build data array with headers
    const headers = columnsToExport.map((col) => col.label || col.key);
    const data = filteredAndSortedEntries.map((entry) => {
      return columnsToExport.map((col) => {
        const value = entry[col.key];
        // Handle objects (like nested relations)
        if (typeof value === "object" && value !== null) {
          if ("name" in value) return (value as { name: string }).name;
          if ("label" in value) return (value as { label: string }).label;
          return JSON.stringify(value);
        }
        return value;
      });
    });

    // Create worksheet with headers
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Auto-size columns
    const colWidths = headers.map((h, i) => {
      const maxLen = Math.max(
        String(h).length,
        ...data.map(row => String(row[i] || '').length)
      );
      return { wch: Math.min(maxLen + 2, 50) };
    });
    ws['!cols'] = colWidths;

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tableName.slice(0, 31)); // Sheet name max 31 chars

    // Generate and download
    const timestamp = new Date().toISOString().split("T")[0];
    const scopeLabel = exportScope === "visible" ? "visible" : "all";
    XLSX.writeFile(wb, `${tableName.toLowerCase().replace(/\s+/g, "-")}-${scopeLabel}-${timestamp}.xlsx`);

    // Close modal and show toast
    setShowExportModal(false);
    toast({
      title: "Export Complete",
      description: `Exported ${filteredAndSortedEntries.length} rows to Excel`,
    });
  }, [exportScope, visibleDataColumns, allDataColumns, filteredAndSortedEntries, tableName, toast]);

  // Export handler - exports to PDF
  const handleExportPDF = useCallback(async () => {
    const columnsToExport = exportScope === "visible" ? visibleDataColumns : allDataColumns;

    // Dynamic imports to avoid SSR issues
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    // Create PDF document
    const doc = new jsPDF({
      orientation: columnsToExport.length > 6 ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Add title
    doc.setFontSize(16);
    doc.text(tableName, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Exported: ${new Date().toLocaleString()}`, 14, 22);
    doc.text(`Rows: ${filteredAndSortedEntries.length} | Columns: ${columnsToExport.length}`, 14, 27);

    // Build table data
    const headers = columnsToExport.map((col) => col.label || col.key);
    const data = filteredAndSortedEntries.map((entry) => {
      return columnsToExport.map((col) => {
        const value = entry[col.key];
        // Handle objects (like nested relations)
        if (typeof value === "object" && value !== null) {
          if ("name" in value) return (value as { name: string }).name;
          if ("label" in value) return (value as { label: string }).label;
          return JSON.stringify(value);
        }
        // Truncate long values for PDF readability
        const strVal = String(value ?? '');
        return strVal.length > 50 ? strVal.slice(0, 47) + '...' : strVal;
      });
    });

    // Add table using autoTable
    autoTable(doc, {
      head: [headers],
      body: data,
      startY: 32,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246], // Blue header
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      margin: { top: 32 },
    });

    // Generate and download
    const timestamp = new Date().toISOString().split("T")[0];
    const scopeLabel = exportScope === "visible" ? "visible" : "all";
    doc.save(`${tableName.toLowerCase().replace(/\s+/g, "-")}-${scopeLabel}-${timestamp}.pdf`);

    // Close modal and show toast
    setShowExportModal(false);
    toast({
      title: "Export Complete",
      description: `Exported ${filteredAndSortedEntries.length} rows to PDF`,
    });
  }, [exportScope, visibleDataColumns, allDataColumns, filteredAndSortedEntries, tableName, toast]);

  // Master export handler that routes to the correct format
  const handleExport = useCallback(() => {
    switch (exportFormat) {
      case 'excel':
        handleExportExcel();
        break;
      case 'pdf':
        handleExportPDF();
        break;
      default:
        handleExportCSV();
    }
  }, [exportFormat, handleExportCSV, handleExportExcel, handleExportPDF]);

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
      const isEditing = editingRowIds.has(entry.id);
      const rowEditingData = editingData[entry.id] || {};

      // Handle special column types
      switch (column.key) {
        case "select":
          return (
            <div className="flex items-center justify-center h-full w-full">
              <Checkbox
                checked={selectedRows.has(entry.id)}
                onCheckedChange={() => toggleRowSelection(entry.id)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
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
            <div className="flex items-center justify-center gap-0">
              {onView && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onView(entry)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              )}
              {/* Edit button: inline edit if single row, bulk edit modal if multiple selected */}
              {!viewOnly && (onRowUpdate || onEdit) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    // If multiple rows selected, open bulk edit dialog
                    if (selectedRows.size > 1) {
                      onEdit?.(entry);
                    } else {
                      // Single row or no selection: inline edit if available
                      if (onRowUpdate) {
                        startEditing(entry);
                      } else {
                        onEdit?.(entry);
                      }
                    }
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {!viewOnly && onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onDelete(entry)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          );
      }

      // Inline editing mode - with column type-specific editors
      // System columns that are NEVER editable
      const NON_EDITABLE_COLUMNS = ['id', 'created_at', 'updated_at', 'select', 'actions'];
      const isComputed = column.column_type === 'computed' || column.column_type === 'formula';
      const isSystemColumn = NON_EDITABLE_COLUMNS.includes(column.key) || column.system === true;
      const isColumnEditable = column.editable !== false && !isSystemColumn && !isComputed;

      if (isEditing && isColumnEditable) {
        const columnType = column.column_type || 'single_line_text';

        // Boolean - Switch toggle
        if (columnType === 'boolean') {
          const boolValue = rowEditingData[column.key] === true || rowEditingData[column.key] === 'true' || rowEditingData[column.key] === 1;
          return (
            <div className="flex items-center justify-center">
              <Switch
                checked={boolValue}
                onCheckedChange={(checked) =>
                  setEditingData((prev) => ({
                    ...prev,
                    [entry.id]: { ...prev[entry.id], [column.key]: checked },
                  }))
                }
              />
            </div>
          );
        }

        // Choice - Searchable dropdown with predefined options
        if (columnType === 'choice' || columnType === 'single_select' || columnType === 'multi_select') {
          const choices = column.choices || [];
          const choiceItems: ComboboxItem[] = choices.map((choice) => ({
            id: choice,
            label: choice,
          }));
          const currentValue = String(rowEditingData[column.key] ?? "");
          const selectedChoice = choiceItems.find((item) => item.id === currentValue);

          return (
            <ComboboxDropdown
              items={choiceItems}
              selectedItem={selectedChoice}
              onSelect={(item) =>
                setEditingData((prev) => ({
                  ...prev,
                  [entry.id]: { ...prev[entry.id], [column.key]: item.id },
                }))
              }
              placeholder="Select..."
              searchPlaceholder="Search choices..."
            />
          );
        }

        // User - Dropdown (would need users fetched, for now use text input)
        if (columnType === 'user') {
          // TODO: Fetch users from API and show dropdown
          return (
            <Input
              className="h-7 text-sm"
              placeholder="User..."
              value={String(rowEditingData[column.key] ?? "")}
              onChange={(e) =>
                setEditingData((prev) => ({
                  ...prev,
                  [entry.id]: { ...prev[entry.id], [column.key]: e.target.value },
                }))
              }
            />
          );
        }

        // Date - Date picker
        if (columnType === 'date') {
          const dateValue = rowEditingData[column.key];
          let parsedDate: Date | undefined;
          try {
            if (dateValue) {
              parsedDate = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue as number);
            }
          } catch {
            parsedDate = undefined;
          }

          return (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-7 w-full justify-start text-left font-normal text-sm",
                    !parsedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {parsedDate ? format(parsedDate, "yyyy-MM-dd") : "Pick date..."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parsedDate}
                  onSelect={(date) =>
                    setEditingData((prev) => ({
                      ...prev,
                      [entry.id]: { ...prev[entry.id], [column.key]: date ? format(date, "yyyy-MM-dd") : null },
                    }))
                  }
                />
              </PopoverContent>
            </Popover>
          );
        }

        // Date and Time - DateTime picker
        if (columnType === 'date_and_time' || columnType === 'datetime') {
          const dateValue = rowEditingData[column.key];
          let parsedDate: Date | undefined;
          try {
            if (dateValue) {
              parsedDate = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue as number);
            }
          } catch {
            parsedDate = undefined;
          }

          return (
            <Input
              type="datetime-local"
              className="h-7 text-sm"
              value={parsedDate ? format(parsedDate, "yyyy-MM-dd'T'HH:mm") : ""}
              onChange={(e) =>
                setEditingData((prev) => ({
                  ...prev,
                  [entry.id]: { ...prev[entry.id], [column.key]: e.target.value ? new Date(e.target.value).toISOString() : null },
                }))
              }
            />
          );
        }

        // File Upload - Show paperclip button
        if (columnType === 'file_upload' || columnType === 'file' || columnType === 'attachment') {
          return (
            <div className="flex items-center gap-1">
              <Input
                className="h-7 text-sm flex-1"
                placeholder="File URL..."
                value={String(rowEditingData[column.key] ?? "")}
                onChange={(e) =>
                  setEditingData((prev) => ({
                    ...prev,
                    [entry.id]: { ...prev[entry.id], [column.key]: e.target.value },
                  }))
                }
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => {
                  // TODO: Open file picker dialog
                  toast({ title: "File upload coming soon" });
                }}
              >
                <Paperclip className="h-3 w-3" />
              </Button>
            </div>
          );
        }

        // Lookup - Searchable dropdown with options from related table
        if (columnType === 'lookup' || columnType === 'relation') {
          const options = lookupOptions[column.key] || [];
          const isLoading = lookupLoading[column.key];
          console.log('[Lookup Edit] column:', column.key, 'options:', options.length, 'lookup_config:', column.lookup_config, 'isLoading:', isLoading);

          // Get current value - could be an object with id or just an id
          const currentValue = rowEditingData[column.key];
          const currentId = typeof currentValue === 'object' && currentValue !== null
            ? (currentValue as { id?: number }).id
            : currentValue;

          // Build items with "No Record" option first
          const lookupItems: ComboboxItem[] = [
            { id: "__none__", label: "No Record" },
            ...options.map((option) => ({
              id: String(option.id),
              label: option.display,
            })),
          ];
          const selectedLookup = lookupItems.find((item) => item.id === (currentId ? String(currentId) : "__none__"));

          return (
            <ComboboxDropdown
              items={lookupItems}
              selectedItem={selectedLookup}
              onSelect={(item) => {
                if (item.id === "__none__") {
                  setEditingData((prev) => ({
                    ...prev,
                    [entry.id]: { ...prev[entry.id], [column.key]: null },
                  }));
                  return;
                }
                const selectedOption = options.find(o => String(o.id) === item.id);
                setEditingData((prev) => ({
                  ...prev,
                  [entry.id]: { ...prev[entry.id], [column.key]: selectedOption ? { id: selectedOption.id, display: selectedOption.display } : null },
                }));
              }}
              placeholder={isLoading ? "Loading..." : "Select..."}
              searchPlaceholder="Search records..."
              renderListItem={({ isChecked, item }) => (
                <>
                  <Check className={cn("mr-2 h-4 w-4", isChecked ? "opacity-100" : "opacity-0")} />
                  {item.id === "__none__" ? (
                    <span className="text-muted-foreground italic">{item.label}</span>
                  ) : (
                    item.label
                  )}
                </>
              )}
            />
          );
        }

        // Color picker - color input
        if (columnType === 'color_picker') {
          return (
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-7 w-10 p-0 border rounded cursor-pointer"
                value={String(rowEditingData[column.key] ?? "#000000")}
                onChange={(e) =>
                  setEditingData((prev) => ({
                    ...prev,
                    [entry.id]: { ...prev[entry.id], [column.key]: e.target.value },
                  }))
                }
              />
              <Input
                className="h-7 text-sm font-mono w-20"
                value={String(rowEditingData[column.key] ?? "")}
                onChange={(e) =>
                  setEditingData((prev) => ({
                    ...prev,
                    [entry.id]: { ...prev[entry.id], [column.key]: e.target.value },
                  }))
                }
                placeholder="#000000"
              />
            </div>
          );
        }

        // GPS Coordinates - lat/lng input
        if (columnType === 'gps_coordinates') {
          return (
            <Input
              className="h-7 text-sm font-mono"
              placeholder="-33.8688, 151.2093"
              value={String(rowEditingData[column.key] ?? "")}
              onChange={(e) =>
                setEditingData((prev) => ({
                  ...prev,
                  [entry.id]: { ...prev[entry.id], [column.key]: e.target.value },
                }))
              }
            />
          );
        }

        // Multiple lookups - multi-select (simplified tag input)
        if (columnType === 'multiple_lookups') {
          const currentItems = Array.isArray(rowEditingData[column.key])
            ? rowEditingData[column.key] as Array<{ id: number; display?: string }>
            : [];
          const options = lookupOptions[column.key] || [];

          return (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap gap-1 min-h-[28px] p-1 border rounded bg-background">
                {currentItems.map((item, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs flex items-center gap-1">
                    {item.display || `#${item.id}`}
                    <button
                      type="button"
                      className="hover:text-destructive"
                      onClick={() => {
                        const newItems = currentItems.filter((_, i) => i !== idx);
                        setEditingData((prev) => ({
                          ...prev,
                          [entry.id]: { ...prev[entry.id], [column.key]: newItems },
                        }));
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Select
                value=""
                onValueChange={(val) => {
                  if (!val) return;
                  const option = options.find(o => String(o.id) === val);
                  if (option && !currentItems.some(i => i.id === option.id)) {
                    setEditingData((prev) => ({
                      ...prev,
                      [entry.id]: {
                        ...prev[entry.id],
                        [column.key]: [...currentItems, { id: option.id, display: option.display }]
                      },
                    }));
                  }
                }}
              >
                <SelectTrigger className="h-7 text-sm">
                  <SelectValue placeholder="Add..." />
                </SelectTrigger>
                <SelectContent>
                  {options
                    .filter(o => !currentItems.some(i => i.id === o.id))
                    .map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.display}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        // Structured data (JSON) - textarea for JSON editing
        if (columnType === 'structured_data') {
          const jsonValue = typeof rowEditingData[column.key] === 'string'
            ? rowEditingData[column.key]
            : JSON.stringify(rowEditingData[column.key] ?? {}, null, 2);
          return (
            <textarea
              className="h-20 w-full text-xs font-mono p-2 border rounded resize-none"
              value={String(jsonValue)}
              onChange={(e) =>
                setEditingData((prev) => ({
                  ...prev,
                  [entry.id]: { ...prev[entry.id], [column.key]: e.target.value },
                }))
              }
              placeholder='{"key": "value"}'
            />
          );
        }

        // Array of items - tag input (uses comma-separated input)
        if (columnType === 'array_of_items') {
          const currentItems = Array.isArray(rowEditingData[column.key])
            ? rowEditingData[column.key] as string[]
            : [];

          return (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap gap-1 min-h-[28px] p-1 border rounded bg-background">
                {currentItems.map((item, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs flex items-center gap-1">
                    {item}
                    <button
                      type="button"
                      className="hover:text-destructive"
                      onClick={() => {
                        const newItems = currentItems.filter((_, i) => i !== idx);
                        setEditingData((prev) => ({
                          ...prev,
                          [entry.id]: { ...prev[entry.id], [column.key]: newItems },
                        }));
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                className="h-7 text-sm"
                placeholder="Type and press Enter to add..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const input = e.currentTarget;
                    const value = input.value.trim();
                    if (value) {
                      setEditingData((prev) => ({
                        ...prev,
                        [entry.id]: {
                          ...prev[entry.id],
                          [column.key]: [...currentItems, value]
                        },
                      }));
                      input.value = "";
                    }
                  }
                }}
              />
            </div>
          );
        }

        // Australian types - text inputs with format hints
        if (columnType === 'abn') {
          return (
            <Input
              className="h-7 text-sm font-mono"
              placeholder="XX XXX XXX XXX"
              maxLength={14}
              value={String(rowEditingData[column.key] ?? "")}
              onChange={(e) =>
                setEditingData((prev) => ({
                  ...prev,
                  [entry.id]: { ...prev[entry.id], [column.key]: e.target.value.replace(/\D/g, '').slice(0, 11) },
                }))
              }
            />
          );
        }

        if (columnType === 'acn') {
          return (
            <Input
              className="h-7 text-sm font-mono"
              placeholder="XXX XXX XXX"
              maxLength={11}
              value={String(rowEditingData[column.key] ?? "")}
              onChange={(e) =>
                setEditingData((prev) => ({
                  ...prev,
                  [entry.id]: { ...prev[entry.id], [column.key]: e.target.value.replace(/\D/g, '').slice(0, 9) },
                }))
              }
            />
          );
        }

        if (columnType === 'bsb') {
          return (
            <Input
              className="h-7 text-sm font-mono"
              placeholder="XXX-XXX"
              maxLength={7}
              value={String(rowEditingData[column.key] ?? "")}
              onChange={(e) =>
                setEditingData((prev) => ({
                  ...prev,
                  [entry.id]: { ...prev[entry.id], [column.key]: e.target.value.replace(/\D/g, '').slice(0, 6) },
                }))
              }
            />
          );
        }

        if (columnType === 'bank_account') {
          return (
            <Input
              className="h-7 text-sm font-mono"
              placeholder="Account number"
              maxLength={9}
              value={String(rowEditingData[column.key] ?? "")}
              onChange={(e) =>
                setEditingData((prev) => ({
                  ...prev,
                  [entry.id]: { ...prev[entry.id], [column.key]: e.target.value.replace(/\D/g, '').slice(0, 9) },
                }))
              }
            />
          );
        }

        if (columnType === 'postcode') {
          return (
            <Input
              className="h-7 text-sm font-mono"
              placeholder="3000"
              maxLength={4}
              value={String(rowEditingData[column.key] ?? "")}
              onChange={(e) =>
                setEditingData((prev) => ({
                  ...prev,
                  [entry.id]: { ...prev[entry.id], [column.key]: e.target.value.replace(/\D/g, '').slice(0, 4) },
                }))
              }
            />
          );
        }

        if (columnType === 'tfn') {
          return (
            <Input
              type="password"
              className="h-7 text-sm font-mono"
              placeholder="XXX XXX XXX"
              maxLength={11}
              value={String(rowEditingData[column.key] ?? "")}
              onChange={(e) =>
                setEditingData((prev) => ({
                  ...prev,
                  [entry.id]: { ...prev[entry.id], [column.key]: e.target.value.replace(/\D/g, '').slice(0, 9) },
                }))
              }
            />
          );
        }

        // Number types
        if (columnType === 'number' || columnType === 'integer' || columnType === 'decimal' || columnType === 'currency' || columnType === 'percentage') {
          const hasError = validationErrors[entry.id]?.[column.key];
          return (
            <div className="relative">
              <Input
                type="number"
                className={cn(
                  "h-7 text-sm",
                  hasError && "border-red-500 focus:ring-red-500"
                )}
                value={String(rowEditingData[column.key] ?? "")}
                onChange={(e) =>
                  setEditingData((prev) => ({
                    ...prev,
                    [entry.id]: { ...prev[entry.id], [column.key]: e.target.value ? Number(e.target.value) : null },
                  }))
                }
                onBlur={() => handleCellBlur(entry.id, column.key, rowEditingData[column.key], columnType)}
              />
              {hasError && (
                <span className="absolute -bottom-4 left-0 text-[10px] text-red-500 whitespace-nowrap">
                  {hasError}
                </span>
              )}
            </div>
          );
        }

        // Default - Text input for single_line_text, long_text, email, phone, url, etc.
        const hasError = validationErrors[entry.id]?.[column.key];
        return (
          <div className="relative">
            <Input
              className={cn(
                "h-7 text-sm",
                hasError && "border-red-500 focus:ring-red-500"
              )}
              value={String(rowEditingData[column.key] ?? "")}
              onChange={(e) =>
                setEditingData((prev) => ({
                  ...prev,
                  [entry.id]: { ...prev[entry.id], [column.key]: e.target.value },
                }))
              }
              onBlur={() => handleCellBlur(entry.id, column.key, rowEditingData[column.key], columnType)}
            />
            {hasError && (
              <span className="absolute -bottom-4 left-0 text-[10px] text-red-500 whitespace-nowrap">
                {hasError}
              </span>
            )}
          </div>
        );
      }

      // Show read-only indicator for non-editable columns when in edit mode
      if (isEditing && !isColumnEditable) {
        // Don't show indicator for select/actions columns
        if (column.key === 'select' || column.key === 'actions') {
          // Fall through to normal rendering
        } else {
          // Show the value with a subtle indicator it's not editable
          const displayValue = value == null || value === "" ? "-" : String(value);
          return (
            <span className="text-muted-foreground italic" title={isComputed ? "Computed column" : "System column - not editable"}>
              {displayValue}
            </span>
          );
        }
      }

      // CELL-LEVEL INLINE EDITING (single-click dropdown, double-click text)
      const isCellEditing = editingCell?.rowId === entry.id && editingCell?.columnKey === column.key;
      if (isCellEditing && isColumnEditable) {
        const columnType = column.column_type || 'single_line_text';

        // Boolean - Switch toggle (auto-saves on change)
        if (columnType === 'boolean') {
          const boolValue = editingCellValue === true || editingCellValue === 'true' || editingCellValue === 1;
          return (
            <div className="flex items-center justify-center">
              <Switch
                checked={boolValue}
                onCheckedChange={(checked) => {
                  setEditingCellValue(checked);
                  // Auto-save boolean changes
                  if (onRowUpdate) {
                    onRowUpdate(entry.id, column.key, checked);
                  }
                  setEditingCell(null);
                  setEditingCellValue(null);
                }}
              />
            </div>
          );
        }

        // Choice - Searchable dropdown with predefined options (auto-saves on selection)
        if (columnType === 'choice' || columnType === 'single_select' || columnType === 'multi_select' || (column.choices && column.choices.length > 0)) {
          const choices = column.choices || [];
          const choiceItems: ComboboxItem[] = choices.map((choice) => ({
            id: choice,
            label: choice,
          }));
          const currentValue = String(editingCellValue ?? "");
          const selectedChoice = choiceItems.find((item) => item.id === currentValue);

          return (
            <ComboboxDropdown
              items={choiceItems}
              selectedItem={selectedChoice}
              onSelect={(item) => {
                setEditingCellValue(item.id);
                // Auto-save choice changes
                if (onRowUpdate) {
                  onRowUpdate(entry.id, column.key, item.id);
                }
                setEditingCell(null);
                setEditingCellValue(null);
              }}
              placeholder="Select..."
              searchPlaceholder="Search choices..."
            />
          );
        }

        // Lookup - Searchable dropdown with options from related table (auto-saves on selection)
        if (columnType === 'lookup' || columnType === 'relation' || column.lookup_config) {
          const options = lookupOptions[column.key] || [];
          const isLoading = lookupLoading[column.key];
          const currentValue = editingCellValue;
          const currentId = typeof currentValue === 'object' && currentValue !== null
            ? (currentValue as { id?: number }).id
            : currentValue;

          // Build items with "None" option first
          const lookupItems: ComboboxItem[] = [
            { id: "__none__", label: "None" },
            ...options.map((option) => ({
              id: String(option.id),
              label: option.display,
            })),
          ];
          const selectedLookup = lookupItems.find((item) => item.id === (currentId ? String(currentId) : "__none__"));

          return (
            <ComboboxDropdown
              items={lookupItems}
              selectedItem={selectedLookup}
              onSelect={(item) => {
                if (item.id === "__none__") {
                  if (onRowUpdate) onRowUpdate(entry.id, column.key, null);
                } else {
                  const selectedOption = options.find(o => String(o.id) === item.id);
                  if (onRowUpdate) onRowUpdate(entry.id, column.key, selectedOption?.id || item.id);
                }
                setEditingCell(null);
                setEditingCellValue(null);
              }}
              placeholder={isLoading ? "Loading..." : "Select..."}
              searchPlaceholder="Search records..."
              renderListItem={({ isChecked, item }) => (
                <>
                  <Check className={cn("mr-2 h-4 w-4", isChecked ? "opacity-100" : "opacity-0")} />
                  {item.id === "__none__" ? (
                    <span className="text-muted-foreground">{item.label}</span>
                  ) : (
                    item.label
                  )}
                </>
              )}
            />
          );
        }

        // Multiple lines text - Rich text editor with formatting
        if (columnType === 'multiple_lines_text' || columnType === 'long_text') {
          return (
            <div className="min-w-[250px]">
              <InlineRichTextEditor
                value={String(editingCellValue ?? "")}
                onChange={(val) => setEditingCellValue(val)}
                onBlur={() => saveCellEdit()}
                placeholder="Enter text..."
              />
              <div className="flex justify-end gap-1 mt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={cancelCellEdit}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-6 text-xs"
                  onClick={saveCellEdit}
                >
                  Save
                </Button>
              </div>
            </div>
          );
        }

        // Text/Number/Date - Input field with Enter to save, Escape to cancel
        return (
          <Input
            autoFocus
            className="h-7 text-sm"
            value={String(editingCellValue ?? "")}
            onChange={(e) => setEditingCellValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                saveCellEdit();
              } else if (e.key === 'Escape') {
                cancelCellEdit();
              }
            }}
            onBlur={() => saveCellEdit()}
          />
        );
      }

      // Handle null/undefined
      if (value == null || value === "") {
        return <span className="text-muted-foreground">-</span>;
      }

      // Handle boolean
      if (typeof value === "boolean" || column.column_type === "boolean") {
        const boolValue = typeof value === "boolean" ? value : value === "true" || value === true || value === 1;
        return boolValue ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground" />
        );
      }

      // Handle email - clickable link
      if (column.column_type === "email" && value) {
        return (
          <a href={`mailto:${value}`} className="text-blue-600 hover:underline">
            {String(value)}
          </a>
        );
      }

      // Handle phone/mobile - clickable link
      if ((column.column_type === "phone" || column.column_type === "mobile") && value) {
        return (
          <a href={`tel:${value}`} className="text-blue-600 hover:underline">
            {String(value)}
          </a>
        );
      }

      // Handle URL - clickable link
      if (column.column_type === "url" && value) {
        const urlStr = String(value);
        const href = urlStr.startsWith("http") ? urlStr : `https://${urlStr}`;
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline flex items-center gap-1"
          >
            {urlStr.length > 30 ? urlStr.slice(0, 30) + "..." : urlStr}
            <ExternalLink className="h-3 w-3" />
          </a>
        );
      }

      // Handle color_picker - show color swatch
      if (column.column_type === "color_picker" && value) {
        return (
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded border border-gray-200"
              style={{ backgroundColor: String(value) }}
            />
            <span className="font-mono text-xs">{String(value)}</span>
          </div>
        );
      }

      // Handle GPS coordinates
      if (column.column_type === "gps_coordinates" && value) {
        const coords = String(value);
        return (
          <a
            href={`https://maps.google.com/?q=${coords}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline flex items-center gap-1"
          >
            📍 {coords}
          </a>
        );
      }

      // Handle file_upload - show file info
      if (column.column_type === "file_upload" && value) {
        const fileData = typeof value === "string" ? value : JSON.stringify(value);
        return (
          <div className="flex items-center gap-1 text-sm">
            📎 {fileData.length > 20 ? fileData.slice(0, 20) + "..." : fileData}
          </div>
        );
      }

      // Handle user type - display user name
      if (column.column_type === "user" && value) {
        const userData = value as { name?: string; email?: string; id?: number } | string | number;
        if (typeof userData === "object" && userData.name) {
          return <span>👤 {userData.name}</span>;
        }
        return <span>👤 User #{String(value)}</span>;
      }

      // Handle lookup - display linked record
      if (column.column_type === "lookup" && value) {
        const lookupData = value as { display_value?: string; display?: string; name?: string; id?: number } | string | number;
        if (typeof lookupData === "object") {
          // Support multiple display field names: display_value, display, name
          const displayText = lookupData.display_value || lookupData.display || lookupData.name;
          if (displayText) {
            return <span>{displayText}</span>;
          }
          if (lookupData.id) {
            return <span>#{lookupData.id}</span>;
          }
        }
        return <span>#{String(value)}</span>;
      }

      // Handle _id columns that have expanded lookup data (system tables)
      if (column.key.endsWith('_id') && typeof value === 'object' && value !== null) {
        const lookupData = value as { display?: string; display_value?: string; name?: string; id?: number };
        const displayText = lookupData.display || lookupData.display_value || lookupData.name;
        if (displayText) {
          return <span>{displayText}</span>;
        }
        if (lookupData.id) {
          return <span>#{lookupData.id}</span>;
        }
      }

      // Handle multiple_lookups - display linked records
      if (column.column_type === "multiple_lookups" && value) {
        const items = Array.isArray(value) ? value : [];
        if (items.length === 0) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {items.slice(0, 3).map((item, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {typeof item === "object" ? item.display_value || item.name || `#${item.id}` : String(item)}
              </Badge>
            ))}
            {items.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{items.length - 3} more
              </Badge>
            )}
          </div>
        );
      }

      // Handle computed - display calculated value
      if (column.column_type === "computed" && value != null) {
        const numValue = typeof value === "number" ? value : parseFloat(String(value));
        if (!isNaN(numValue)) {
          return (
            <span className="font-mono text-purple-600 dark:text-purple-400">
              {numValue.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
            </span>
          );
        }
        return <span className="font-mono">{String(value)}</span>;
      }

      // Handle number/whole_number
      if ((column.column_type === "number" || column.column_type === "whole_number") && typeof value === "number") {
        return value.toLocaleString("en-AU");
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

      // Handle multiple_lines_text - render HTML content
      if (column.column_type === "multiple_lines_text" || column.column_type === "long_text") {
        const htmlValue = String(value);
        // Check if it contains HTML tags
        const hasHtml = /<[^>]+>/.test(htmlValue);
        if (hasHtml) {
          // Strip HTML for preview, show full in tooltip
          const textContent = htmlValue.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          const preview = textContent.length > 80 ? textContent.slice(0, 80) + '...' : textContent;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate block max-w-[200px] cursor-pointer">
                    {preview || <span className="text-muted-foreground">-</span>}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <div
                    className="prose prose-sm dark:prose-invert max-h-[300px] overflow-auto"
                    dangerouslySetInnerHTML={{ __html: htmlValue }}
                  />
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        // Plain text - show with line breaks preserved
        if (htmlValue.length > 80) {
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate block max-w-[200px]">
                    {htmlValue.slice(0, 80)}...
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <p className="whitespace-pre-wrap">{htmlValue}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }
        return <span className="whitespace-pre-wrap">{htmlValue}</span>;
      }

      // Handle structured_data (JSON) - collapsible JSON viewer
      if (column.column_type === "structured_data" && value) {
        const jsonStr = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        const preview = jsonStr.length > 50 ? jsonStr.slice(0, 50) + '...' : jsonStr;
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded cursor-pointer">
                  {'{...}'} {preview.slice(0, 20)}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-lg">
                <pre className="text-xs whitespace-pre-wrap max-h-[300px] overflow-auto">
                  {jsonStr}
                </pre>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      // Handle array_of_items - show as tags
      if (column.column_type === "array_of_items" && value) {
        const items = Array.isArray(value) ? value : (typeof value === 'string' ? JSON.parse(value) : []);
        if (items.length === 0) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {items.slice(0, 3).map((item: string, idx: number) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {String(item)}
              </Badge>
            ))}
            {items.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{items.length - 3}
              </Badge>
            )}
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
        return <span className="font-mono">{formatted}</span>;
      }

      // ACN: XXX XXX XXX (9 digits)
      if (column.column_type === "acn" && value) {
        const digits = String(value).replace(/\D/g, '');
        const formatted = digits.length === 9
          ? `${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6,9)}`
          : String(value);
        return <span className="font-mono">{formatted}</span>;
      }

      // BSB: XXX-XXX (6 digits)
      if (column.column_type === "bsb" && value) {
        const digits = String(value).replace(/\D/g, '');
        const formatted = digits.length === 6
          ? `${digits.slice(0,3)}-${digits.slice(3,6)}`
          : String(value);
        return <span className="font-mono">{formatted}</span>;
      }

      // Bank Account: up to 9 digits
      if (column.column_type === "bank_account" && value) {
        return <span className="font-mono">{String(value)}</span>;
      }

      // Postcode: 4 digits
      if (column.column_type === "postcode" && value) {
        return <span className="font-mono">{String(value).padStart(4, '0').slice(0,4)}</span>;
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
                <span className="font-mono text-muted-foreground cursor-help">{masked}</span>
              </TooltipTrigger>
              <TooltipContent>
                <span>TFN hidden for security</span>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
      editingRowIds,
      editingData,
      editingCell,
      editingCellValue,
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
      saveCellEdit,
      cancelCellEdit,
      lookupOptions,
      lookupLoading,
      validationErrors,
      handleCellBlur,
    ]
  );

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
        zIndex: isHeader ? 30 : 10,
        background: isHeader ? 'hsl(40, 11%, 89%)' : 'hsl(40, 11%, 95%)',
        boxShadow: '-1px 0 0 #d4d4d4',
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
  const renderTableHeader = () => {
    const isStickyColumn = (key: string) => STICKY_COLUMNS.includes(key) || key === 'actions';

    return (
      <TableHeader>
        <TableRow>
          {visibleColumnsInOrder.map((column, colIndex) => {
            const stickyStyles = getStickyColumnStyles(column.key, true);
            const isSticky = isStickyColumn(column.key);
            const isSystemGen = isSystemGeneratedColumn(column);

            return (
              <TableHead
                key={`${column.key}-${colIndex}`}
                style={{
                  width: columnWidths[column.key] || column.width,
                  minWidth: columnWidths[column.key] || column.width || 50,
                  position: 'sticky',
                  top: 0,
                  zIndex: isSticky ? 30 : 20,
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
                  "relative",
                  column.key === "select" && "!border-r-0 !p-0 !h-full",
                  column.key === "actions" && "!border-l-0"
                )}
                title={isSystemGen ? "System-generated column (read-only)" : undefined}
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
                    onEdit={handleOpenColumnEdit}
                    sortInfo={sortColumns.find((s) => s.column === column.key)}
                    isGroupedBy={groupByColumn === column.key}
                    isEditMode={columnEditMode}
                  >
                    <span className="truncate">{column.label}</span>
                  </ResizableColumnHeader>
                )}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
    );
  };

  // Render table footer with calculated totals for numeric columns
  const renderTableFooter = (rows: TableRowType[] = filteredAndSortedEntries) => {
    // Check if any visible columns are numeric
    const numericTypes = ['number', 'whole_number', 'currency', 'percentage', 'computed'];
    const hasNumericColumns = visibleColumnsInOrder.some(
      col => col.column_type && numericTypes.includes(col.column_type)
    );

    if (!hasNumericColumns || rows.length === 0) return null;

    return (
      <tfoot className="bg-muted/50 border-t-2 font-medium">
        <tr>
          {visibleColumnsInOrder.map((column, colIndex) => {
            // Skip id column and other non-summable columns
            const skipColumns = ['id', 'select', 'actions', 'latitude', 'longitude', 'lat', 'lng', 'long', 'design_id', 'user_id'];
            const isNumeric = column.column_type && numericTypes.includes(column.column_type) && !skipColumns.includes(column.key);
            let total: number | null = null;

            if (isNumeric) {
              total = rows.reduce((sum, row) => {
                const val = row[column.key];
                const num = typeof val === 'number' ? val : parseFloat(String(val || 0));
                return sum + (isNaN(num) ? 0 : num);
              }, 0);
            }

            const stickyStyles = getStickyColumnStyles(column.key, true);

            return (
              <td
                key={`footer-${column.key}-${colIndex}`}
                className="px-3 py-2 text-sm"
                style={{
                  width: columnWidths[column.key] || column.width,
                  ...stickyStyles,
                }}
              >
                {column.key === "select" ? (
                  <span className="text-xs text-muted-foreground">Total</span>
                ) : isNumeric && total !== null ? (
                  <span>
                    {column.column_type === 'currency'
                      ? `$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : column.column_type === 'percentage'
                      ? `${total.toFixed(1)}%`
                      : total.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    }
                  </span>
                ) : null}
              </td>
            );
          })}
        </tr>
      </tfoot>
    );
  };

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
          className="cursor-pointer hover:bg-muted/50 py-2 px-4 border rounded-md bg-muted/30 mb-2"
          style={{ paddingLeft: `${16 + depth * 24}px` }}
          onClick={() => toggleGroupCollapse(fullKey)}
        >
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <span className="font-medium text-sm">
              {currentColLabel}: {groupKey}
            </span>
            <Badge variant="secondary" className="text-xs">{rowCount} rows</Badge>
          </div>
        </div>
      );

      // If not collapsed, render content
      if (!isCollapsed) {
        if (hasSubgroups) {
          // Render subgroups recursively
          result.push(...renderGroupNavigation(group.subgroups as typeof groups, depth + 1, fullKey));
        } else {
          // Render data table for this group's rows
          result.push(
            <div key={`data-${fullKey}`} className="mb-4" style={{ marginLeft: `${(depth + 1) * 24}px`, marginRight: '16px' }}>
              <Table className="w-full border rounded" style={{ tableLayout: 'fixed' }}>
                {renderTableHeader()}
                <TableBody>
                  {group.rows.map((row, rowIndex) => (
                    <TableRow
                      key={`${fullKey}-row-${row.id}-${rowIndex}`}
                      className={cn(
                        selectedRows.has(row.id) && "bg-muted/50",
                        "hover:bg-muted/30 cursor-pointer"
                      )}
                      onClick={() => onRowClick?.(row)}
                      onDoubleClick={() => onRowDoubleClick?.(row)}
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
                            onClick={(e) => handleCellClick(e, row, column)}
                            onDoubleClick={(e) => handleCellDoubleClick(e, row, column)}
                          >
                            {renderCellValue(row, column)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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

    return rows.map((row, rowIndex) => (
      <TableRow
        key={`row-${row.id}-${rowIndex}`}
        className={cn(
          selectedRows.has(row.id) && "bg-muted/50",
          "hover:bg-muted/30 cursor-pointer"
        )}
        onClick={() => onRowClick?.(row)}
        onDoubleClick={() => onRowDoubleClick?.(row)}
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
                column.key === "select" && "!border-r-0 !p-0 !h-full",
                column.key === "actions" && "!border-l-0"
              )}
              onClick={(e) => handleCellClick(e, row, column)}
              onDoubleClick={(e) => handleCellDoubleClick(e, row, column)}
            >
              {renderCellValue(row, column)}
            </TableCell>
          );
        })}
      </TableRow>
    ));
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
          className={cn(
            "cursor-pointer hover:bg-muted/50",
            depth === 0 ? "bg-muted/30" : "bg-muted/20"
          )}
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
              <span className="font-medium text-sm">
                {currentColLabel}: {groupKey}
              </span>
              <Badge variant="secondary" className="text-xs">{rowCount} rows</Badge>
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
            result.push(
              <TableRow
                key={`${fullKey}-row-${row.id}-${rowIndex}`}
                className={cn(
                  selectedRows.has(row.id) && "bg-muted/50",
                  "hover:bg-muted/30 cursor-pointer"
                )}
                onClick={() => onRowClick?.(row)}
                onDoubleClick={() => onRowDoubleClick?.(row)}
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
                      column.key === "select" && "!border-r-0 !p-0 !h-full",
                      column.key === "actions" && "!border-l-0"
                    )}
                    onClick={(e) => handleCellClick(e, row, column)}
                    onDoubleClick={(e) => handleCellDoubleClick(e, row, column)}
                  >
                    {renderCellValue(row, column)}
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

    const allKeys = getAllGroupKeys(groupedEntries);
    const allCollapsed = allKeys.length > 0 && allKeys.every(k => collapsedGroups.has(k));
    const allExpanded = collapsedGroups.size === 0;
    const visibleRows = getVisibleRows();

    return (
      <div style={{ width: `${totalTableWidth}px` }}>
        {/* View mode toggle + Expand/Collapse buttons */}
        <div className="flex items-center gap-2 mb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center">
                <Checkbox
                  checked={
                    selectedRows.size === filteredAndSortedEntries.length &&
                    filteredAndSortedEntries.length > 0
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
              <DropdownMenuItem
                onClick={() => {
                  const visible = visibleRows;
                  setSelectedRows(new Set(visible.map(r => r.id)));
                }}
                disabled={visibleRows.length === 0}
              >
                Select Expanded ({visibleRows.length})
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSelectedRows(new Set())}>
                Clear Selection
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-sm font-medium text-muted-foreground">View:</span>
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
          <div className="h-4 w-px bg-border mx-2" />
          <Button
            variant="outline"
            size="sm"
            onClick={expandAllGroups}
            disabled={allExpanded}
            className="h-7 px-2 text-xs"
          >
            <ChevronsUpDown className="h-3 w-3 mr-1" />
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={collapseAllGroups}
            disabled={allCollapsed}
            className="h-7 px-2 text-xs"
          >
            <ChevronsDownUp className="h-3 w-3 mr-1" />
            Collapse All
          </Button>
          {selectedRows.size > 0 && (
            <>
              <div className="h-4 w-px bg-border mx-2" />
              <span className="text-sm font-medium">{selectedRows.size} selected</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRows(new Set())}
                className="h-7 px-2 text-xs"
              >
                Clear
              </Button>
            </>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {visibleRows.length} rows visible
          </span>
        </div>

        {groupViewMode === "inline" ? (
          /* Inline mode (default) - groups as rows in table body */
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
      </div>
    );
  };

  // Render flat table
  const renderFlatTable = () => {
    console.log('[TeeemTableView] renderFlatTable columnWidths:', columnWidths);
    return (
    <Table className="w-full" style={{ tableLayout: 'fixed', width: `${totalTableWidth}px` }}>
        <colgroup>
          {visibleColumnsInOrder.map((column) => (
            <col
              key={column.key}
              style={{ width: column.key === "select" ? 40 : (columnWidths[column.key] || column.width || 50) }}
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
            filteredAndSortedEntries.map((row, rowIndex) => (
              <TableRow
                key={`${row.id}-${rowIndex}`}
                className={cn(
                  selectedRows.has(row.id) && "bg-muted/50",
                  editingRowIds.has(row.id) && "bg-blue-50 dark:bg-blue-950/20",
                  "hover:bg-muted/30 cursor-pointer"
                )}
                onClick={(e) => {
                  console.log('Row clicked', row.id, 'target:', e.target, 'onRowClick:', !!onRowClick);
                  if (!editingRowIds.has(row.id) && onRowClick) {
                    onRowClick(row);
                  }
                }}
                onDoubleClick={() =>
                  !editingRowIds.has(row.id) && onRowDoubleClick?.(row)
                }
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
                      column.key === "select" && "!border-r-0 !p-0 !h-full",
                      column.key === "actions" && "!border-l-0"
                    )}
                  >
                    {renderCellValue(row, column)}
                  </TableCell>
                );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
  );
  };

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
        {/* Left section: Add button + leftActions + Search */}
        <div className="flex items-center gap-2">
          {/* Add Row button - auto-shown when onAddRow is provided */}
          {onAddRow && (
            <Button
              variant="default"
              size="sm"
              onClick={onAddRow}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          )}
          {leftActions}
          <SearchInput
          onSearch={handleSearchFromInput}
          onSearchAllChange={handleSearchAllChange}
          searchAllColumns={searchAllColumns}
          serverSearchLoading={serverSearchLoading}
          hasServerSearch={!!onServerSearch}
        />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Saved Views - show as many as fit, rest in dropdown */}
          {savedViews.length > 0 && (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                {savedViews.map((view) => (
                  <TooltipProvider key={view.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={activeViewId === view.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => loadViewState(view)}
                          className={cn(
                            "shrink-0 whitespace-nowrap",
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
                        {view.is_global ? "Global view" : "Personal view"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>
          )}

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

              {/* Table Info Section */}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
                TABLE INFO
              </DropdownMenuLabel>

              {foundationIdNumeric && (
                <div className="px-2 py-1.5 flex items-center justify-between">
                  <span className="text-sm">
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

      {/* Active filters indicator - only show when NO saved view is active (view buttons already indicate active view) */}
      {safeFilters.length > 0 && !activeViewId && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
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

      {/* Bulk actions */}
      {selectedRows.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
          {/* Only show selection count/clear when NOT in grouped view (grouped view has it inline) */}
          {!groupByColumn && (
            <>
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
            </>
          )}
          {/* Bulk Edit button - for editing multiple rows */}
          {onBulkEdit && !viewOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkEdit(Array.from(selectedRows))}
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
              onClick={() => onBulkDelete(Array.from(selectedRows))}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
        </div>
      )}

      {/* Multi-row editing toolbar */}
      {editingRowIds.size > 0 && (() => {
        const errorCount = Object.values(validationErrors).reduce(
          (count, rowErrors) => count + Object.keys(rowErrors).length,
          0
        );
        return (
          <div className={cn(
            "flex items-center gap-2 p-2 rounded-lg",
            errorCount > 0
              ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
              : "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
          )}>
            <span className={cn(
              "text-sm font-medium",
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
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={saveEditing}
              className={cn(
                errorCount > 0
                  ? "bg-gray-400 hover:bg-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
              )}
              disabled={errorCount > 0}
            >
              <Check className="h-4 w-4 mr-1" />
              Save All
            </Button>
          </div>
        );
      })()}

      {/* Sort controls - indicators hidden but functionality preserved */}
      {false && sortColumns.length > 0 && (
        <div className="flex items-center gap-4 text-sm">
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

      {/* Table - scrollable container with minimum height for ~10 rows */}
      <div className="flex-1 min-h-[360px] w-full overflow-auto relative">
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
      <Dialog open={showBulkUpdateModal} onOpenChange={setShowBulkUpdateModal}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle>Bulk Update</DialogTitle>
            <DialogDescription>
              Update {selectedRows.size} selected row{selectedRows.size !== 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Column to update</Label>
              <Select
                value={bulkUpdateColumn}
                onValueChange={(val) => {
                  setBulkUpdateColumn(val);
                  setBulkUpdateValue(""); // Reset value when column changes
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select column..." />
                </SelectTrigger>
                <SelectContent>
                  {COLUMNS.filter(
                    (c) =>
                      c.key !== "select" &&
                      c.key !== "actions" &&
                      c.key !== "id" &&
                      c.editable !== false
                  ).map((col) => (
                    <SelectItem key={col.key} value={col.key}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {bulkUpdateColumn && (
              <div className="space-y-2">
                <Label>New value</Label>
                {(() => {
                  const selectedCol = COLUMNS.find(c => c.key === bulkUpdateColumn);
                  const hasChoices = selectedCol?.choices && selectedCol.choices.length > 0;
                  const isLookup = selectedCol?.column_type === 'lookup' || selectedCol?.lookup_config;
                  const isChoice = selectedCol?.column_type === 'choice' || selectedCol?.column_type === 'single_select';

                  console.log('[BulkUpdate] Column:', bulkUpdateColumn, 'hasChoices:', hasChoices, 'isLookup:', isLookup, 'choices:', selectedCol?.choices, 'column_type:', selectedCol?.column_type, 'lookupOptions:', lookupOptions[bulkUpdateColumn]);

                  // For lookup columns, use the lookupOptions if available
                  if (isLookup) {
                    const options = lookupOptions[bulkUpdateColumn] || [];
                    const isLoading = lookupLoading[bulkUpdateColumn];

                    return (
                      <Select
                        value={bulkUpdateValue}
                        onValueChange={setBulkUpdateValue}
                      >
                        <SelectTrigger className="w-full">
                          {isLoading ? (
                            <span className="text-muted-foreground">Loading...</span>
                          ) : (
                            <SelectValue placeholder="Select value..." />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {options.length === 0 && !isLoading && (
                            <SelectItem value="__no_options__" disabled>
                              No options available
                            </SelectItem>
                          )}
                          {options.map((option) => (
                            <SelectItem key={option.id} value={String(option.id)}>
                              {option.display}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  }

                  if (hasChoices || isChoice) {
                    // Dropdown for choice columns with predefined options
                    const options = selectedCol?.choices || [];
                    console.log('[BulkUpdate] Rendering choice dropdown with options:', options);
                    return (
                      <Select
                        value={bulkUpdateValue}
                        onValueChange={setBulkUpdateValue}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select value..." />
                        </SelectTrigger>
                        <SelectContent>
                          {options.length === 0 && (
                            <SelectItem value="__no_options__" disabled>
                              No options available
                            </SelectItem>
                          )}
                          {options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  } else if (selectedCol?.column_type === 'boolean') {
                    // Dropdown for boolean
                    return (
                      <Select
                        value={bulkUpdateValue}
                        onValueChange={setBulkUpdateValue}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select value..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
                    );
                  } else {
                    // Text input for other columns
                    return (
                      <Input
                        value={bulkUpdateValue}
                        onChange={(e) => setBulkUpdateValue(e.target.value)}
                        placeholder="Enter new value..."
                        className="w-full"
                      />
                    );
                  }
                })()}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkUpdateModal(false);
                setBulkUpdateColumn("");
                setBulkUpdateValue("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkUpdate}
              disabled={!bulkUpdateColumn || !bulkUpdateValue || bulkUpdateSaving}
            >
              {bulkUpdateSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              Update {selectedRows.size} row{selectedRows.size !== 1 ? "s" : ""}
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

      {/* Create Column Modal - Table-based type selection */}
      <Dialog open={showCreateColumnModal} onOpenChange={setShowCreateColumnModal}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Create New Column</DialogTitle>
            <DialogDescription>
              Add a new column to this table. Select a column type from the list below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Column Name</Label>
              <Input
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="e.g., Status, Due Date, Priority..."
              />
            </div>

            <div className="space-y-2">
              <Label>Column Type</Label>
              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="w-48">Type</TableHead>
                      <TableHead className="w-32">SQL Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-48">Example</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COLUMN_TYPES.map((colType) => {
                      const isSelected = newColumnType === colType.value;
                      return (
                        <TableRow
                          key={colType.value}
                          className={cn(
                            "cursor-pointer hover:bg-muted/50",
                            isSelected && "bg-primary/10 border-l-2 border-l-primary"
                          )}
                          onClick={() => setNewColumnType(colType.value)}
                        >
                          <TableCell>
                            <div className="flex items-center justify-center">
                              {isSelected ? (
                                <Check className="h-4 w-4 text-primary" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{getColumnTypeEmoji(colType.value)}</span>
                              <span className="font-medium">{colType.label}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {colType.sqlType}
                            </code>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {colType.description}
                            </span>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs text-muted-foreground">
                              {colType.example.length > 30
                                ? colType.example.substring(0, 30) + "..."
                                : colType.example}
                            </code>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              {newColumnType && (
                <div className="p-3 bg-muted/50 rounded-md border">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{getColumnTypeEmoji(newColumnType)}</span>
                    <span className="font-medium">{getColumnTypeLabel(newColumnType)}</span>
                    <Badge variant="secondary" className="text-xs font-mono">
                      {getColumnTypeSqlType(newColumnType)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {COLUMN_TYPES.find(t => t.value === newColumnType)?.usedFor || ""}
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateColumnModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateColumn} disabled={schemaLoading || !newColumnName || !newColumnType}>
              {schemaLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <PlusCircle className="h-4 w-4 mr-1" />
              )}
              Create Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Column Modal */}
      <Dialog open={showDeleteColumnModal} onOpenChange={setShowDeleteColumnModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Column</DialogTitle>
            <DialogDescription>
              Select a column to delete. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Column</Label>
              <Select value={selectedColumnToDelete} onValueChange={setSelectedColumnToDelete}>
                <SelectTrigger>
                  <SelectValue placeholder="Select column to delete" />
                </SelectTrigger>
                <SelectContent>
                  {COLUMNS.filter(
                    (c) =>
                      c.key !== "select" &&
                      c.key !== "actions" &&
                      c.key !== "id" &&
                      c.key !== "created_at" &&
                      c.key !== "updated_at"
                  ).map((col) => (
                    <SelectItem key={col.key} value={col.key}>
                      {col.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedColumnToDelete && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive">
                  Warning: Deleting this column will remove all data stored in it. This cannot be undone.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteColumnModal(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteColumn}
              disabled={!selectedColumnToDelete || schemaLoading}
            >
              {schemaLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <MinusCircle className="h-4 w-4 mr-1" />
              )}
              Delete Column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Schema Modal */}
      <Dialog open={showViewSchemaModal} onOpenChange={setShowViewSchemaModal}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Table Schema</DialogTitle>
            <DialogDescription>
              {tableName} - {COLUMNS.filter(c => c.key !== "select" && c.key !== "actions").length} columns
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {COLUMNS.filter(c => c.key !== "select" && c.key !== "actions").map((col, index) => (
                <div
                  key={col.key}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-6">{index + 1}</span>
                    <div>
                      <p className="font-medium">{col.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{col.key}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {col.column_type || "text"}
                    </Badge>
                    {col.key === "id" || col.key === "created_at" || col.key === "updated_at" ? (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        System
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewSchemaModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <Dialog open={showEditColumnsModal} onOpenChange={setShowEditColumnsModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] p-8">
          <DialogHeader className="pb-4">
            <DialogTitle>SHOW/HIDE & REORDER COLUMNS</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Drag rows to reorder, or click the position number to type a new position
            </p>
          </DialogHeader>

          <ScrollArea className="h-[600px] border rounded-md">
            <DndContext
              sensors={dndSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleColumnDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Order</TableHead>
                    <TableHead className="w-12">Show</TableHead>
                    <TableHead className="w-44">Column Name</TableHead>
                    <TableHead className="w-32">SQL Type</TableHead>
                    <TableHead className="w-32">Display Type</TableHead>
                    <TableHead className="min-w-[200px]">Validation Rules</TableHead>
                    <TableHead className="w-20">Width</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext
                    items={getSortedColumnsForModal().map(c => c.key)}
                    strategy={verticalListSortingStrategy}
                  >
                    {(() => {
                      const sortedColumns = getSortedColumnsForModal();
                      const visibleColumnKeys = sortedColumns.filter(c => visibleColumns[c.key] === true).map(c => c.key);
                      const totalVisible = visibleColumnKeys.length;

                      return sortedColumns.map((col) => {
                        const isVisible = visibleColumns[col.key] === true;
                        const visibleIndex = isVisible ? visibleColumnKeys.indexOf(col.key) + 1 : 0;

                        return (
                          <SortableColumnRow
                            key={col.key}
                            id={col.key}
                            column={col}
                            isVisible={isVisible}
                            index={visibleIndex}
                            totalVisible={totalVisible}
                            onToggleVisibility={() =>
                              setVisibleColumns((prev) => ({
                                ...prev,
                                [col.key]: !prev[col.key],
                              }))
                            }
                            onReorder={(newPos) => reorderColumnToPosition(col.key, newPos)}
                            columnWidth={columnWidths[col.key] || col.width || 50}
                            onWidthChange={(width) =>
                              setColumnWidths((prev) => ({
                                ...prev,
                                [col.key]: width,
                              }))
                            }
                            getColumnTypeEmoji={getColumnTypeEmoji}
                            getColumnTypeSqlType={getColumnTypeSqlType}
                            getColumnTypeLabel={getColumnTypeLabel}
                            getColumnTypeValidationRules={getColumnTypeValidationRules}
                          />
                        );
                      });
                    })()}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          </ScrollArea>

          <DialogFooter className="flex justify-between pt-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Show all columns
                  const allVisible: VisibleColumnsState = {};
                  COLUMNS.forEach(c => { allVisible[c.key] = true; });
                  setVisibleColumns(allVisible);
                }}
              >
                Show All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Hide all except essential columns
                  const hidden: VisibleColumnsState = {};
                  COLUMNS.forEach(c => { hidden[c.key] = c.key === "id"; });
                  setVisibleColumns(hidden);
                }}
              >
                Hide All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleColumns(getDefaultVisibleColumns())}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            </div>
            <Button onClick={() => setShowEditColumnsModal(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-md p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Data
            </DialogTitle>
            <DialogDescription>
              Export {filteredAndSortedEntries.length} rows to a file
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Format Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Export Format</Label>
              <div className="grid grid-cols-3 gap-2">
                <label
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer transition-colors",
                    exportFormat === "csv"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  )}
                >
                  <input
                    type="radio"
                    name="exportFormat"
                    value="csv"
                    checked={exportFormat === "csv"}
                    onChange={() => setExportFormat("csv")}
                    className="sr-only"
                  />
                  <FileSpreadsheet className="h-6 w-6 text-green-600" />
                  <span className="text-sm font-medium">CSV</span>
                </label>

                <label
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer transition-colors",
                    exportFormat === "excel"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  )}
                >
                  <input
                    type="radio"
                    name="exportFormat"
                    value="excel"
                    checked={exportFormat === "excel"}
                    onChange={() => setExportFormat("excel")}
                    className="sr-only"
                  />
                  <Table2 className="h-6 w-6 text-emerald-600" />
                  <span className="text-sm font-medium">Excel</span>
                </label>

                <label
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-lg border cursor-pointer transition-colors",
                    exportFormat === "pdf"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  )}
                >
                  <input
                    type="radio"
                    name="exportFormat"
                    value="pdf"
                    checked={exportFormat === "pdf"}
                    onChange={() => setExportFormat("pdf")}
                    className="sr-only"
                  />
                  <FileSpreadsheet className="h-6 w-6 text-red-600" />
                  <span className="text-sm font-medium">PDF</span>
                </label>
              </div>
            </div>

            {/* Column Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Columns to Export</Label>
              <div className="grid gap-2">
                <label
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    exportScope === "visible"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  )}
                >
                  <input
                    type="radio"
                    name="exportScope"
                    value="visible"
                    checked={exportScope === "visible"}
                    onChange={() => setExportScope("visible")}
                    className="h-4 w-4 text-primary"
                  />
                  <div className="flex-1">
                    <div className="font-medium">Visible Columns Only</div>
                    <div className="text-sm text-muted-foreground">
                      Export {visibleDataColumns.length} columns currently shown
                    </div>
                  </div>
                  <Badge variant="secondary">{visibleDataColumns.length}</Badge>
                </label>

                <label
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    exportScope === "all"
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/50"
                  )}
                >
                  <input
                    type="radio"
                    name="exportScope"
                    value="all"
                    checked={exportScope === "all"}
                    onChange={() => setExportScope("all")}
                    className="h-4 w-4 text-primary"
                  />
                  <div className="flex-1">
                    <div className="font-medium">All Columns</div>
                    <div className="text-sm text-muted-foreground">
                      Export all {allDataColumns.length} columns in the table
                    </div>
                  </div>
                  <Badge variant="secondary">{allDataColumns.length}</Badge>
                </label>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg border">
              <div className="text-sm font-medium mb-1">Export Summary</div>
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Rows:</span>
                  <span className="font-mono">{filteredAndSortedEntries.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Columns:</span>
                  <span className="font-mono">
                    {exportScope === "visible" ? visibleDataColumns.length : allDataColumns.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Format:</span>
                  <span className="font-mono uppercase">{exportFormat}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export {exportFormat.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Global Views Manager - auto-enabled when foundationIdNumeric is set */}
      {/* Per GOLD_STANDARD_TABLE.md: Tables with foundationIdNumeric get Filters button + GlobalViewsManager */}
      {foundationIdNumeric && (
        <GlobalViewsManager
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
              lookup_foundation_id: col.lookup_config?.target_table_id,
              lookup_display_column: col.lookup_config?.display_column,
              available_choices: col.choices,
            }))}
          onViewsChange={onRefresh}
          onApplyView={loadViewState as (view: unknown) => void}
          rows={entries as Record<string, unknown>[]}
        />
      )}
    </div>
  );
}
