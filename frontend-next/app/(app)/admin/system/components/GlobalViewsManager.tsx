"use client";

import * as React from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Filter,
  ArrowUpDown,
  Columns3,
  Globe,
  User,
  Loader2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";

// Types
interface CascadeFilter {
  id: string | number;
  column: string;
  value: string | number | boolean | null;
  operator: string;
  label?: string;
  groupId?: string;
}

interface FilterGroup {
  id: string;
  logic: "AND" | "OR";
}

interface SortColumn {
  column: string;
  dir: "asc" | "desc" | "custom";
  customOrder?: string[]; // Custom order of values for lookup columns
}

interface SavedView {
  id: number | string;
  name: string;
  is_global?: boolean;
  filters?: CascadeFilter[];
  filterGroups?: FilterGroup[];
  interGroupLogic?: "AND" | "OR";
  visibleColumns?: Record<string, boolean>;
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  sortColumns?: SortColumn[];
  groupByColumn?: string | null;
  groupByColumns?: string[];
  autoFitColumns?: boolean;
  showTotals?: boolean;
  display_order?: number;
}

interface Column {
  id: number;
  column_name: string;
  name: string;
  column_type: string;
  position?: number;
  lookup_foundation_id?: number;
  lookup_display_column?: string;
  available_choices?: { id: number; value: string }[] | string[];
}

interface GlobalViewsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foundationId: number;
  columns: Column[];
  onViewsChange?: () => void;
  onApplyView?: (view: SavedView) => void; // Apply view to the table
  rows?: Record<string, unknown>[]; // For custom sort order values
}

// Sortable View Item
function SortableViewItem({
  view,
  isActive,
  onSelect,
  onEdit,
  onDelete,
  onApply,
}: {
  view: SavedView;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onApply?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: view.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Check if this is an unsaved new view
  const isUnsaved = typeof view.id === "string" && view.id.startsWith("new_");

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-1.5 p-2 rounded border cursor-pointer transition-all",
        isActive
          ? "bg-primary/10 border-primary"
          : "bg-background border-border hover:border-primary/50",
        isDragging && "opacity-50 shadow-lg",
        isUnsaved && "border-dashed border-orange-400 bg-orange-50 dark:bg-orange-950/20"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center gap-1.5">
          {view.is_global ? (
            <Globe className="h-3 w-3 text-blue-500 shrink-0" />
          ) : (
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium truncate">{view.name}</span>
          {isUnsaved && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 text-orange-600 border-orange-400 shrink-0">
              unsaved
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
            {view.filters?.length || 0}f
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
            {view.sortColumns?.length || 0}s
          </Badge>
        </div>
      </div>

      <div className="flex items-center shrink-0">
        {onApply && !isUnsaved && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-primary hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onApply();
            }}
            title="Apply this view"
          >
            <Eye className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// Sortable Column Item for visibility/order
function SortableColumnItem({
  id,
  column,
  isVisible,
  onToggleVisibility,
  index,
  totalVisible,
  onReorder,
  showWidthInput,
  width,
  onWidthChange,
}: {
  id: string;
  column: Column;
  isVisible: boolean;
  onToggleVisibility: () => void;
  index?: number;
  totalVisible?: number;
  onReorder?: (newIndex: number) => void;
  showWidthInput?: boolean;
  width?: number;
  onWidthChange?: (width: number) => void;
}) {
  const [isEditingPosition, setIsEditingPosition] = React.useState(false);
  const [positionValue, setPositionValue] = React.useState(String(index || 1));
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

  const isSystemColumn = ['id', 'created_at', 'updated_at'].includes(column.column_name);

  // Focus input when editing starts
  React.useEffect(() => {
    if (isEditingPosition && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingPosition]);

  const handlePositionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onReorder && index !== undefined) {
      setPositionValue(String(index));
      setIsEditingPosition(true);
    }
  };

  const handlePositionSubmit = () => {
    const newPos = parseInt(positionValue, 10);
    if (!isNaN(newPos) && newPos >= 1 && newPos <= (totalVisible || 999) && onReorder) {
      onReorder(newPos);
    }
    setIsEditingPosition(false);
  };

  const handlePositionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePositionSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingPosition(false);
      setPositionValue(String(index || 1));
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1.5 rounded border transition-all",
        isVisible ? "bg-background border-border" : "bg-muted/30 border-border",
        isSystemColumn && "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900/50",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>
      {index !== undefined && (
        isEditingPosition ? (
          <input
            ref={inputRef}
            type="text"
            value={positionValue}
            onChange={(e) => setPositionValue(e.target.value)}
            onBlur={handlePositionSubmit}
            onKeyDown={handlePositionKeyDown}
            className="w-6 h-5 text-[10px] font-medium text-center bg-background border border-primary rounded focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          <button
            onClick={handlePositionClick}
            className="flex items-center justify-center w-5 h-5 text-[9px] font-medium bg-muted hover:bg-primary/20 hover:text-primary rounded cursor-pointer transition-colors"
            title="Click to change position"
          >
            {index}
          </button>
        )
      )}
      <button
        onClick={onToggleVisibility}
        className="flex items-center gap-1 flex-1 text-left hover:opacity-70 min-w-0"
      >
        {isVisible ? (
          <Check className="h-3 w-3 text-primary shrink-0" />
        ) : (
          <EyeOff className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <span className={cn("text-xs font-medium truncate", !isVisible && "text-muted-foreground font-normal")}>
          {column.name || column.column_name}
        </span>
      </button>
      {showWidthInput && isVisible && (
        <input
          type="number"
          value={width || ""}
          onChange={(e) => onWidthChange?.(parseInt(e.target.value, 10) || 0)}
          placeholder="150"
          className="w-14 h-5 text-[10px] text-center bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
          title="Column width in pixels"
          onClick={(e) => e.stopPropagation()}
          min={40}
          max={500}
        />
      )}
    </div>
  );
}

// Sortable Sort By Item
function SortableSortByItem({
  id,
  sort,
  columns,
  onChangeColumn,
  onChangeDir,
  onChangeCustomOrder,
  onRemove,
  allRows,
}: {
  id: string;
  sort: SortColumn;
  columns: Column[];
  onChangeColumn: (col: string) => void;
  onChangeDir: (dir: "asc" | "desc" | "custom") => void;
  onChangeCustomOrder?: (order: string[]) => void;
  onRemove: () => void;
  allRows?: Record<string, unknown>[];
}) {
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

  // Get unique values for the selected column (for custom sort)
  const uniqueValues = React.useMemo(() => {
    if (!allRows || !sort.column) return [];
    const values = new Set<string>();
    allRows.forEach(row => {
      const val = row[sort.column];
      if (val !== null && val !== undefined) {
        // Handle object values (lookup columns)
        if (typeof val === 'object') {
          const objVal = val as { display?: string; name?: string; id?: number };
          const displayVal = objVal.display || objVal.name || String(objVal.id || '');
          if (displayVal) values.add(displayVal);
        } else {
          values.add(String(val));
        }
      }
    });
    return Array.from(values).sort();
  }, [allRows, sort.column]);

  // Initialize custom order with unique values if not set
  const currentOrder = sort.customOrder || uniqueValues;

  const handleCustomOrderChange = (fromIndex: number, toIndex: number) => {
    if (!onChangeCustomOrder) return;
    const newOrder = [...currentOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    onChangeCustomOrder(newOrder);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "space-y-2",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-center gap-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <Select value={sort.column} onValueChange={onChangeColumn}>
          <SelectTrigger className="flex-1 h-8">
            <SelectValue placeholder="Column..." />
          </SelectTrigger>
          <SelectContent>
            {columns.map(c => (
              <SelectItem key={c.column_name} value={c.column_name}>
                {c.name || c.column_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort.dir} onValueChange={(v) => onChangeDir(v as "asc" | "desc" | "custom")}>
          <SelectTrigger className="w-[110px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">A → Z</SelectItem>
            <SelectItem value="desc">Z → A</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {/* Custom order editor */}
      {sort.dir === "custom" && uniqueValues.length > 0 && (
        <div className="ml-6 p-2 bg-muted/50 rounded border space-y-1">
          <p className="text-xs text-muted-foreground mb-2">Drag to reorder:</p>
          {currentOrder.map((value, index) => (
            <div
              key={value}
              className="flex items-center gap-2 p-1.5 bg-background rounded border text-sm"
            >
              <span className="text-muted-foreground w-4 text-center">{index + 1}</span>
              <span className="flex-1">{value}</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={index === 0}
                  onClick={() => handleCustomOrderChange(index, index - 1)}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={index === currentOrder.length - 1}
                  onClick={() => handleCustomOrderChange(index, index + 1)}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Sortable Group By Item
function SortableGroupByItem({
  id,
  columnName,
  columns,
  onChangeColumn,
  onRemove,
}: {
  id: string;
  columnName: string;
  columns: Column[];
  onChangeColumn: (col: string) => void;
  onRemove: () => void;
}) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2",
        isDragging && "opacity-50"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <Select value={id} onValueChange={onChangeColumn}>
        <SelectTrigger className="flex-1 h-8">
          <SelectValue placeholder="Column...">{columnName}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {columns.map(c => (
            <SelectItem key={c.column_name} value={c.column_name}>
              {c.name || c.column_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function GlobalViewsManager({
  open,
  onOpenChange,
  foundationId,
  columns,
  onViewsChange,
  onApplyView,
  rows,
}: GlobalViewsManagerProps) {
  const { toast } = useToast();

  // State
  const [views, setViews] = React.useState<SavedView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [activeViewId, setActiveViewId] = React.useState<number | string | null>(null);
  const [editingView, setEditingView] = React.useState<SavedView | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [viewToDelete, setViewToDelete] = React.useState<SavedView | null>(null);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [newViewName, setNewViewName] = React.useState("New View");
  const [newViewBaseId, setNewViewBaseId] = React.useState<string>("blank");
  const [newViewIsGlobal, setNewViewIsGlobal] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);

  // Edit state
  const [editName, setEditName] = React.useState("");
  const [editIsGlobal, setEditIsGlobal] = React.useState(false);
  const [editFilters, setEditFilters] = React.useState<CascadeFilter[]>([]);
  const [editFilterGroups, setEditFilterGroups] = React.useState<FilterGroup[]>([{ id: "default", logic: "AND" }]);
  const [editInterGroupLogic, setEditInterGroupLogic] = React.useState<"AND" | "OR">("OR");
  const [editSortColumns, setEditSortColumns] = React.useState<SortColumn[]>([]);
  const [editGroupByColumns, setEditGroupByColumns] = React.useState<string[]>([]);
  const [editVisibleColumns, setEditVisibleColumns] = React.useState<Record<string, boolean>>({});
  const [editColumnOrder, setEditColumnOrder] = React.useState<string[]>([]);
  const [editColumnWidths, setEditColumnWidths] = React.useState<Record<string, number>>({});
  const [editAutoFitColumns, setEditAutoFitColumns] = React.useState(true);
  const [editShowTotals, setEditShowTotals] = React.useState(true);

  // Collapse state
  const [filtersExpanded, setFiltersExpanded] = React.useState(true);
  const [sortExpanded, setSortExpanded] = React.useState(true);
  const [groupByExpanded, setGroupByExpanded] = React.useState(true);
  const [columnsExpanded, setColumnsExpanded] = React.useState(true);

  // Lookup options cache for filter dropdowns
  const [lookupOptionsCache, setLookupOptionsCache] = React.useState<Record<string, { id: number; display: string }[]>>({});
  const [lookupLoadingColumns, setLookupLoadingColumns] = React.useState<Set<string>>(new Set());

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load views
  React.useEffect(() => {
    if (open && foundationId) {
      loadViews();
    }
  }, [open, foundationId]);

  const loadViews = async (selectViewByName?: string) => {
    console.log('[GlobalViewsManager] loadViews called, selectViewByName:', selectViewByName);
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; views: SavedView[] }>(
        `/api/v1/foundation_views?foundation_id=${foundationId}`
      );

      console.log('[GlobalViewsManager] loadViews response:', response);

      if (response.success && response.views) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedViews = (response.views as any[]).map((v) => ({
          ...v,
          filters: v.filters?.cascadeFilters || [],
          filterGroups: v.filters?.filterGroups || [{ id: "default", logic: "AND" }],
          interGroupLogic: v.filters?.interGroupLogic || "OR",
          visibleColumns: v.columns?.visible || {},
          columnOrder: v.columns?.order || [],
          columnWidths: v.columns?.widths || {},
          autoFitColumns: v.columns?.autoFitColumns === true,
          showTotals: v.columns?.showTotals !== false, // Default to true
          sortColumns: Array.isArray(v.sort_order) ? v.sort_order : [],
          groupByColumns: v.group_by_columns || [],
        })) as SavedView[];

        console.log('[GlobalViewsManager] Loaded', mappedViews.length, 'views:', mappedViews.map(v => ({ id: v.id, name: v.name })));
        setViews(mappedViews);

        // If a view name was specified (for newly created views), select it
        if (selectViewByName) {
          console.log('[GlobalViewsManager] Looking for view by name:', selectViewByName);
          const newView = mappedViews.find(v => v.name === selectViewByName);
          console.log('[GlobalViewsManager] Found view:', newView ? { id: newView.id, name: newView.name } : 'NOT FOUND');
          if (newView) {
            setActiveViewId(newView.id);
            loadViewIntoEditor(newView);
            return;
          }
        }

        // Auto-select first view if none selected
        if (!activeViewId && mappedViews.length > 0) {
          console.log('[GlobalViewsManager] Auto-selecting first view');
          setActiveViewId(mappedViews[0].id);
          loadViewIntoEditor(mappedViews[0]);
        }
      }
    } catch (error) {
      console.error("[GlobalViewsManager] Failed to load views:", error);
      toast({
        title: "Error",
        description: "Failed to load saved views",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadViewIntoEditor = (view: SavedView) => {
    setEditingView(view);
    setEditName(view.name);
    setEditIsGlobal(view.is_global || false);
    setEditFilters(view.filters || []);
    setEditFilterGroups(view.filterGroups || [{ id: "default", logic: "AND" }]);
    setEditInterGroupLogic(view.interGroupLogic || "OR");
    setEditSortColumns(view.sortColumns || []);
    setEditGroupByColumns(view.groupByColumns || []);

    // If visibleColumns is empty or missing, default all columns to visible
    const hasVisibleColumns = view.visibleColumns && Object.keys(view.visibleColumns).length > 0;
    const visibleColumnsToSet = hasVisibleColumns
      ? view.visibleColumns
      : Object.fromEntries(columns.map(c => [c.column_name, true]));
    setEditVisibleColumns(visibleColumnsToSet!);

    setEditColumnOrder(view.columnOrder || columns.map(c => c.column_name));
    setEditColumnWidths(view.columnWidths || {});
    setEditAutoFitColumns(view.autoFitColumns || false);
    setEditShowTotals(view.showTotals !== false); // Default to true
  };

  const handleSelectView = (view: SavedView) => {
    setActiveViewId(view.id);
    // Just select, don't edit - load into editor but keep editing disabled
    loadViewIntoEditor(view);
    setIsEditing(false);
  };

  const handleEditView = (view: SavedView) => {
    setActiveViewId(view.id);
    loadViewIntoEditor(view);
    setIsEditing(true);
  };

  const handleCreateNew = () => {
    setNewViewName("New View");
    setNewViewBaseId("blank");
    setNewViewIsGlobal(false);
    setShowCreateDialog(true);
  };

  const handleConfirmCreate = () => {
    // Find the base view if one was selected
    const baseView = newViewBaseId !== "blank"
      ? views.find(v => String(v.id) === newViewBaseId)
      : null;

    const newView: SavedView = {
      id: `new_${Date.now()}`,
      name: newViewName || "New View",
      is_global: newViewIsGlobal,
      filters: baseView?.filters || [],
      filterGroups: baseView?.filterGroups || [{ id: "default", logic: "AND" }],
      interGroupLogic: baseView?.interGroupLogic || "OR",
      visibleColumns: baseView?.visibleColumns || Object.fromEntries(columns.map(c => [c.column_name, true])),
      columnOrder: baseView?.columnOrder || columns.map(c => c.column_name),
      columnWidths: baseView?.columnWidths || {},
      sortColumns: baseView?.sortColumns || [],
      groupByColumns: baseView?.groupByColumns || [],
      autoFitColumns: baseView?.autoFitColumns ?? true,
      showTotals: baseView?.showTotals ?? true,
    };

    console.log('[GlobalViewsManager] Creating new view:', newView.id, newView.name);

    // Add new view to the list so it appears in the sidebar
    setViews(prev => [...prev, newView]);
    setActiveViewId(newView.id);
    loadViewIntoEditor(newView);
    setIsEditing(true); // Enable editing for new views
    setShowCreateDialog(false);
  };

  const handleSaveView = async () => {
    if (!editingView) return;

    console.log('[GlobalViewsManager] handleSaveView called');
    console.log('[GlobalViewsManager] editingView.id:', editingView.id);
    console.log('[GlobalViewsManager] editName:', editName);
    console.log('[GlobalViewsManager] editIsGlobal:', editIsGlobal);

    setSaving(true);
    try {
      const viewData = {
        foundation_id: foundationId,
        name: editName,
        view_type: "custom",
        is_global: editIsGlobal,
        filters: {
          cascadeFilters: editFilters,
          filterGroups: editFilterGroups,
          interGroupLogic: editInterGroupLogic,
        },
        columns: {
          visible: editVisibleColumns,
          order: editColumnOrder,
          widths: editColumnWidths,
          autoFitColumns: editAutoFitColumns,
          showTotals: editShowTotals,
        },
        sort_order: editSortColumns,
        group_by_columns: editGroupByColumns,
        group_by_column: editGroupByColumns[0] || null,
      };

      let response: { success: boolean; error?: string; view?: { id: number } } | null;

      // Wrap data in foundation_view for Rails strong params
      const wrappedData = { foundation_view: viewData };

      const isNewView = typeof editingView.id === "string" && editingView.id.startsWith("new_");
      console.log('[GlobalViewsManager] isNewView:', isNewView);

      if (isNewView) {
        // Create new view
        const endpoint = editIsGlobal ? "/api/v1/foundation_views/save_global" : "/api/v1/foundation_views";
        console.log('[GlobalViewsManager] Creating new view via POST to:', endpoint);
        response = await api.post<{ success: boolean; error?: string; view?: { id: number } }>(endpoint, wrappedData);
      } else {
        // Update existing view
        const endpoint = `/api/v1/foundation_views/${editingView.id}`;
        console.log('[GlobalViewsManager] Updating existing view via PATCH to:', endpoint);
        response = await api.patch<{ success: boolean; error?: string; view?: { id: number } }>(endpoint, wrappedData);
      }

      console.log('[GlobalViewsManager] API response:', response);

      if (response?.success) {
        toast({
          title: "Success",
          description: editIsGlobal ? "Global view saved for all users" : "View saved successfully",
        });

        // Reload views list - if this was a new view, pass the name so we can select it
        console.log('[GlobalViewsManager] Reloading views, selectByName:', isNewView ? editName : 'none');
        await loadViews(isNewView ? editName : undefined);
        onViewsChange?.();
      } else {
        throw new Error(response?.error || "Failed to save view");
      }
    } catch (error) {
      console.error("[GlobalViewsManager] Failed to save view:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save view",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteView = async () => {
    if (!viewToDelete) return;

    try {
      await api.delete(`/api/v1/foundation_views/${viewToDelete.id}`);
      toast({ title: "Success", description: "View deleted" });
      await loadViews();
      onViewsChange?.();
      setShowDeleteConfirm(false);
      setViewToDelete(null);

      // Clear editor if deleted view was being edited
      if (editingView?.id === viewToDelete.id) {
        setEditingView(null);
        setActiveViewId(null);
      }
    } catch (error) {
      console.error("Failed to delete view:", error);
      toast({
        title: "Error",
        description: "Failed to delete view",
        variant: "destructive",
      });
    }
  };

  const handleViewDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = views.findIndex(v => v.id === active.id);
    const newIndex = views.findIndex(v => v.id === over.id);

    const reorderedViews = arrayMove(views, oldIndex, newIndex);
    setViews(reorderedViews);

    // Save new order
    const orders = reorderedViews.map((v, idx) => ({
      id: v.id,
      display_order: idx,
    }));

    try {
      await api.post("/api/v1/foundation_views/reorder", { orders });
    } catch (error) {
      console.error("Failed to save view order:", error);
    }
  };

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = editColumnOrder.indexOf(active.id as string);
    const newIndex = editColumnOrder.indexOf(over.id as string);

    setEditColumnOrder(arrayMove(editColumnOrder, oldIndex, newIndex));
  };

  // Filter management
  const addFilter = (groupId: string) => {
    const newFilter: CascadeFilter = {
      id: Date.now(),
      column: "",
      operator: "contains",
      value: "",
      groupId,
    };
    setEditFilters([...editFilters, newFilter]);
  };

  const updateFilter = (filterId: string | number, updates: Partial<CascadeFilter>) => {
    setEditFilters(editFilters.map(f =>
      f.id === filterId ? { ...f, ...updates } : f
    ));
  };

  const removeFilter = (filterId: string | number) => {
    setEditFilters(editFilters.filter(f => f.id !== filterId));
  };

  const addFilterGroup = () => {
    const newGroup: FilterGroup = {
      id: `group_${Date.now()}`,
      logic: "AND",
    };
    setEditFilterGroups([...editFilterGroups, newGroup]);
  };

  const removeFilterGroup = (groupId: string) => {
    setEditFilterGroups(editFilterGroups.filter(g => g.id !== groupId));
    setEditFilters(editFilters.filter(f => f.groupId !== groupId));
  };

  // Known lookup column mappings (column_name -> foundation_id and custom endpoint)
  // This is used when columns don't have lookup_foundation_id set, or need a custom API endpoint
  const KNOWN_LOOKUP_MAPPINGS: Record<string, { foundationId: number; displayColumn: string; apiEndpoint?: string; responseKey?: string }> = {
    job_type_id: { foundationId: 344, displayColumn: 'name', apiEndpoint: '/api/v1/job_types', responseKey: 'job_types' },
    job_type: { foundationId: 344, displayColumn: 'name', apiEndpoint: '/api/v1/job_types', responseKey: 'job_types' },
    job_status_id: { foundationId: 345, displayColumn: 'name', apiEndpoint: '/api/v1/job_statuses', responseKey: 'job_statuses' },
    job_status: { foundationId: 345, displayColumn: 'name', apiEndpoint: '/api/v1/job_statuses', responseKey: 'job_statuses' },
    design_id: { foundationId: 368, displayColumn: 'name' },
    contact_id: { foundationId: 214, displayColumn: 'full_name' },
  };

  // Fetch lookup options for a column
  const fetchLookupOptions = async (column: Column) => {
    if (!column.lookup_foundation_id) return;

    const cacheKey = `${column.lookup_foundation_id}`;

    // Check if already cached
    if (lookupOptionsCache[cacheKey]) return;

    // Check if already loading
    if (lookupLoadingColumns.has(cacheKey)) return;

    setLookupLoadingColumns(prev => new Set([...prev, cacheKey]));

    try {
      // Check if there's a known mapping with a custom endpoint
      const knownMapping = Object.values(KNOWN_LOOKUP_MAPPINGS).find(
        m => m.foundationId === column.lookup_foundation_id
      );

      console.log('[GlobalViewsManager] fetchLookupOptions:', {
        column_name: column.column_name,
        lookup_foundation_id: column.lookup_foundation_id,
        knownMapping: knownMapping,
        hasApiEndpoint: !!knownMapping?.apiEndpoint,
      });

      let options: { id: number; display: string }[] = [];

      if (knownMapping?.apiEndpoint) {
        // Use the custom API endpoint
        console.log('[GlobalViewsManager] Using custom endpoint:', knownMapping.apiEndpoint);
        const response = await api.get<Record<string, { id: number; name?: string; [key: string]: unknown }[]>>(
          knownMapping.apiEndpoint
        );

        const entries = knownMapping.responseKey ? response[knownMapping.responseKey] : [];
        if (entries && Array.isArray(entries)) {
          const displayCol = column.lookup_display_column || knownMapping.displayColumn || 'name';
          options = entries.map(entry => ({
            id: entry.id,
            display: String(entry[displayCol] || entry.name || entry.id),
          }));
        }
      } else {
        // Use the generic foundations endpoint
        const response = await api.get<{ entries?: { id: number; [key: string]: unknown }[] }>(
          `/api/v1/foundations/${column.lookup_foundation_id}/entries`
        );

        if (response.entries) {
          const displayCol = column.lookup_display_column || 'name';
          options = response.entries.map(entry => ({
            id: entry.id,
            display: String(entry[displayCol] || entry.name || entry.id),
          }));
        }
      }

      console.log('[GlobalViewsManager] fetchLookupOptions result:', {
        cacheKey,
        optionsCount: options.length,
        options: options.slice(0, 5), // First 5 options for debugging
      });

      setLookupOptionsCache(prev => ({
        ...prev,
        [cacheKey]: options,
      }));
    } catch (error) {
      console.error('[GlobalViewsManager] Failed to fetch lookup options:', error);
    } finally {
      setLookupLoadingColumns(prev => {
        const next = new Set(prev);
        next.delete(cacheKey);
        return next;
      });
    }
  };

  // Render the filter value input based on column type
  const renderFilterValueInput = (filter: CascadeFilter, column: Column | undefined) => {
    // For _id columns, try to find the base column (e.g., job_type_id -> job_type)
    let resolvedColumn = column;
    if (!column && filter.column.endsWith('_id')) {
      const baseColumnName = filter.column.replace(/_id$/, '');
      resolvedColumn = columns.find(c => c.column_name === baseColumnName);
    }

    // Use resolved column for the rest of the function
    column = resolvedColumn;

    // Get known lookup mapping if available
    const knownMapping = KNOWN_LOOKUP_MAPPINGS[filter.column];

    // Debug: Log full details for job_status_id or job_type_id
    if (filter.column.includes('job_status') || filter.column.includes('job_type')) {
      console.log('[GlobalViewsManager] FILTER DEBUG:', {
        filterColumn: filter.column,
        columnFound: !!column,
        column_type: column?.column_type,
        available_choices: column?.available_choices,
        choices_length: column?.available_choices?.length,
        knownMapping: knownMapping,
        all_columns: columns.map(c => c.column_name),
      });
    }

    if (!column) {
      // Even without a column, check if we have a known mapping
      if (knownMapping) {
        const cacheKey = `${knownMapping.foundationId}`;
        const options = lookupOptionsCache[cacheKey] || [];
        const isLoading = lookupLoadingColumns.has(cacheKey);

        // Trigger fetch if not cached
        if (!lookupOptionsCache[cacheKey] && !isLoading) {
          // Create a fake column with the known mapping to fetch options
          fetchLookupOptions({
            id: 0,
            column_name: filter.column,
            name: filter.column,
            column_type: 'lookup',
            lookup_foundation_id: knownMapping.foundationId,
            lookup_display_column: knownMapping.displayColumn,
          });
        }

        // Convert options to ComboboxItem format
        const knownMappingItems: ComboboxItem[] = options.map((opt) => ({
          id: opt.display,
          label: opt.display,
        }));

        if (isLoading) {
          return (
            <div className="w-[140px] h-8 flex items-center justify-center border rounded">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          );
        }

        return (
          <div className="w-[140px]">
            <ComboboxDropdown
              items={knownMappingItems}
              selectedItem={filter.value ? { id: String(filter.value), label: String(filter.value) } : undefined}
              onSelect={(item) => updateFilter(filter.id, { value: item.id })}
              placeholder="Search value..."
              searchInTrigger={true}
              popoverProps={{ className: "w-[200px]" }}
            />
          </div>
        );
      }

      return (
        <Input
          value={String(filter.value || "")}
          onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
          placeholder="Value..."
          className="w-[100px] h-8"
        />
      );
    }

    const columnType = column.column_type?.toLowerCase() || '';
    const isLookupColumn = columnType === 'lookup' || columnType === 'relation' || columnType === 'multiple_lookups';
    const isChoiceColumn = columnType === 'choice';
    const isBooleanColumn = columnType === 'boolean';

    // Debug logging for all filter columns
    console.log('[GlobalViewsManager] Filter column:', {
      column_name: column.column_name,
      column_type: column.column_type,
      isLookupColumn,
      isChoiceColumn,
      available_choices: column.available_choices,
      lookup_foundation_id: column.lookup_foundation_id,
    });

    // Boolean dropdown
    if (isBooleanColumn) {
      return (
        <Select
          value={filter.value === true ? "true" : filter.value === false ? "false" : ""}
          onValueChange={(v) => updateFilter(filter.id, { value: v === "true" })}
        >
          <SelectTrigger className="w-[80px] h-8">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    // Choice dropdown - also handle available_choices on any column type
    const hasAvailableChoices = column.available_choices && column.available_choices.length > 0;

    if (isChoiceColumn || hasAvailableChoices) {
      const choices = column.available_choices || [];
      if (choices.length > 0) {
        // Convert choices to ComboboxItem format
        const choiceItems: ComboboxItem[] = choices.map((choice, idx) => {
          const value = typeof choice === 'string' ? choice : (choice.value || String(choice.id));
          return { id: value, label: value };
        });

        return (
          <div className="w-[140px]">
            <ComboboxDropdown
              items={choiceItems}
              selectedItem={filter.value ? { id: String(filter.value), label: String(filter.value) } : undefined}
              onSelect={(item) => updateFilter(filter.id, { value: item.id })}
              placeholder="Search value..."
              searchInTrigger={true}
              popoverProps={{ className: "w-[200px]" }}
            />
          </div>
        );
      } else if (isChoiceColumn) {
        // Choice column with no choices defined - show text input with hint
        return (
          <Input
            value={String(filter.value || "")}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            placeholder="No choices defined"
            className="w-[120px] h-8"
            title="This choice column has no options defined yet"
          />
        );
      }
    }

    // Lookup dropdown - check for lookup_foundation_id or known mapping
    const effectiveLookupFoundationId = column.lookup_foundation_id || knownMapping?.foundationId;
    const effectiveDisplayColumn = column.lookup_display_column || knownMapping?.displayColumn || 'name';

    if (isLookupColumn) {
      if (effectiveLookupFoundationId) {
        const cacheKey = `${effectiveLookupFoundationId}`;
        const options = lookupOptionsCache[cacheKey] || [];
        const isLoading = lookupLoadingColumns.has(cacheKey);

        // Trigger fetch if not cached
        if (!lookupOptionsCache[cacheKey] && !isLoading) {
          fetchLookupOptions({
            ...column,
            lookup_foundation_id: effectiveLookupFoundationId,
            lookup_display_column: effectiveDisplayColumn,
          });
        }

        // Convert options to ComboboxItem format
        const lookupItems: ComboboxItem[] = options.map((opt) => ({
          id: opt.display,
          label: opt.display,
        }));

        if (isLoading) {
          return (
            <div className="w-[140px] h-8 flex items-center justify-center border rounded">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          );
        }

        return (
          <div className="w-[140px]">
            <ComboboxDropdown
              items={lookupItems}
              selectedItem={filter.value ? { id: String(filter.value), label: String(filter.value) } : undefined}
              onSelect={(item) => updateFilter(filter.id, { value: item.id })}
              placeholder="Search value..."
              searchInTrigger={true}
              emptyResults="No options available"
              popoverProps={{ className: "w-[200px]" }}
            />
          </div>
        );
      } else {
        // Lookup without foundation_id - show text input with hint
        return (
          <Input
            value={String(filter.value || "")}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            placeholder="Type value..."
            className="w-[120px] h-8"
            title="Lookup table not configured - enter value manually"
          />
        );
      }
    }

    // Default text input
    return (
      <Input
        value={String(filter.value || "")}
        onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
        placeholder="Value..."
        className="w-[120px] h-8"
      />
    );
  };

  // Sort management
  const addSortColumn = () => {
    const availableCols = columns.filter(c =>
      !["id", "created_at", "updated_at"].includes(c.column_name) &&
      !editSortColumns.some(s => s.column === c.column_name)
    );
    if (availableCols.length > 0) {
      setEditSortColumns([...editSortColumns, { column: availableCols[0].column_name, dir: "asc" }]);
    }
  };

  const updateSortColumn = (index: number, updates: Partial<SortColumn>) => {
    setEditSortColumns(editSortColumns.map((s, i) =>
      i === index ? { ...s, ...updates } : s
    ));
  };

  const removeSortColumn = (index: number) => {
    setEditSortColumns(editSortColumns.filter((_, i) => i !== index));
  };

  // Column visibility
  const toggleColumnVisibility = (columnName: string) => {
    const newVisible = !editVisibleColumns[columnName];
    setEditVisibleColumns({
      ...editVisibleColumns,
      [columnName]: newVisible,
    });
    // If making visible and not in order, add to order
    if (newVisible && !editColumnOrder.includes(columnName)) {
      setEditColumnOrder([...editColumnOrder, columnName]);
    }
  };

  const showAllColumns = () => {
    setEditVisibleColumns(Object.fromEntries(columns.map(c => [c.column_name, true])));
    // Ensure all columns are in the order array
    const allColumnNames = columns.map(c => c.column_name);
    const missingFromOrder = allColumnNames.filter(name => !editColumnOrder.includes(name));
    if (missingFromOrder.length > 0) {
      setEditColumnOrder([...editColumnOrder, ...missingFromOrder]);
    }
  };

  const hideAllColumns = () => {
    setEditVisibleColumns(Object.fromEntries(columns.map(c => [c.column_name, c.column_name === "id"])));
  };

  // Get sorted columns for display
  const getSortedColumns = () => {
    const orderMap = new Map(editColumnOrder.map((name, idx) => [name, idx]));
    return [...columns].sort((a, b) => {
      const aIdx = orderMap.get(a.column_name) ?? 999;
      const bIdx = orderMap.get(b.column_name) ?? 999;
      return aIdx - bIdx;
    });
  };

  // Get visible columns in order for reordering
  const getVisibleColumnsInOrder = () => {
    return getSortedColumns().filter(col => editVisibleColumns[col.column_name] === true);
  };

  // Reorder a column to a new position (1-based index)
  const reorderColumnToPosition = (columnName: string, newPosition: number) => {
    const visibleCols = getVisibleColumnsInOrder();
    const currentIndex = visibleCols.findIndex(c => c.column_name === columnName);
    if (currentIndex === -1) return;

    // Convert to 0-based index
    const targetIndex = Math.max(0, Math.min(newPosition - 1, visibleCols.length - 1));
    if (currentIndex === targetIndex) return;

    // Create new order array for visible columns
    const newVisibleOrder = visibleCols.map(c => c.column_name);
    const [moved] = newVisibleOrder.splice(currentIndex, 1);
    newVisibleOrder.splice(targetIndex, 0, moved);

    // Now rebuild the full column order, preserving hidden columns in their relative positions
    const hiddenCols = getSortedColumns()
      .filter(col => editVisibleColumns[col.column_name] !== true)
      .map(c => c.column_name);

    // Put visible columns first, then hidden columns
    setEditColumnOrder([...newVisibleOrder, ...hiddenCols]);
  };

  const filteredColumns = columns.filter(c => !["id", "created_at", "updated_at"].includes(c.column_name));

  // Get default width for a column based on its type
  const getDefaultColumnWidth = (col: Column): number => {
    const type = col.column_type?.toLowerCase() || 'text';
    switch (type) {
      case 'id':
        return 60;
      case 'boolean':
        return 80;
      case 'date':
        return 100;
      case 'date_time':
      case 'datetime':
        return 150;
      case 'currency':
      case 'percentage':
      case 'number':
      case 'decimal':
      case 'whole_number':
        return 100;
      case 'phone':
      case 'mobile':
        return 120;
      case 'email':
      case 'url':
        return 200;
      case 'choice':
      case 'lookup':
      case 'relation':
        return 150;
      case 'multiple_lookups':
        return 200;
      case 'text':
      case 'single_line_text':
        return 150;
      case 'multiple_lines_text':
      case 'textarea':
        return 250;
      case 'color_picker':
        return 100;
      case 'file_upload':
        return 150;
      case 'gps_coordinates':
        return 180;
      case 'user':
        return 150;
      default:
        return 150;
    }
  };

  // Handle auto-fit toggle - populate default widths when turning off
  const handleAutoFitChange = (enabled: boolean) => {
    setEditAutoFitColumns(enabled);
    if (!enabled && Object.keys(editColumnWidths).length === 0) {
      // Populate default widths for all visible columns
      const defaultWidths: Record<string, number> = {};
      columns.forEach(col => {
        if (editVisibleColumns[col.column_name]) {
          defaultWidths[col.column_name] = getDefaultColumnWidth(col);
        }
      });
      setEditColumnWidths(defaultWidths);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col p-0" side="right-full">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Global Views Manager
              </SheetTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SheetDescription>
              Create and manage saved views for the Gold Standard table. Global views are shared with all users.
            </SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex-1 flex overflow-hidden">
              {/* Left Panel - Views List */}
              <div className="w-64 border-r flex flex-col">
                <div className="p-3 border-b">
                  <Button onClick={handleCreateNew} className="w-full" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create New View
                  </Button>
                </div>

                <ScrollArea className="flex-1 p-3">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleViewDragEnd}
                  >
                    <SortableContext
                      items={views.map(v => v.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {views.map(view => (
                          <SortableViewItem
                            key={view.id}
                            view={view}
                            isActive={activeViewId === view.id}
                            onSelect={() => handleSelectView(view)}
                            onEdit={() => handleEditView(view)}
                            onDelete={() => {
                              setViewToDelete(view);
                              setShowDeleteConfirm(true);
                            }}
                            onApply={onApplyView ? () => {
                              onApplyView(view);
                              onOpenChange(false); // Close the manager after applying
                            } : undefined}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>

                  {views.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No saved views yet
                    </div>
                  )}
                </ScrollArea>
              </div>

              {/* Right Panel - View Editor */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {editingView ? (
                  <>
                    {/* Editor Header */}
                    <div className={cn("p-4 border-b", isEditing ? "bg-muted/30" : "bg-muted/10")}>
                      <div className="flex items-center gap-3">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="max-w-[200px] font-medium"
                          placeholder="View name..."
                          disabled={!isEditing}
                        />
                        <div className="flex items-center gap-2">
                          <Switch
                            id="global-switch"
                            checked={editIsGlobal}
                            onCheckedChange={setEditIsGlobal}
                            disabled={!isEditing}
                          />
                          <Label htmlFor="global-switch" className={cn("text-sm flex items-center gap-1", !isEditing && "text-muted-foreground")}>
                            {editIsGlobal ? <Globe className="h-3 w-3 text-blue-500" /> : <User className="h-3 w-3" />}
                            {editIsGlobal ? "Global" : "Personal"}
                          </Label>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          {!isEditing ? (
                            <Button size="sm" onClick={() => setIsEditing(true)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit View
                            </Button>
                          ) : (
                            <>
                              <Button variant="outline" size="sm" onClick={() => { loadViewIntoEditor(editingView); setIsEditing(false); }}>
                                Cancel
                              </Button>
                              <Button variant="outline" size="sm" onClick={handleSaveView} disabled={saving}>
                                {saving ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4 mr-2" />
                                )}
                                Save
                              </Button>
                              <Button size="sm" onClick={async () => { await handleSaveView(); setIsEditing(false); }} disabled={saving}>
                                {saving ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4 mr-2" />
                                )}
                                Save & Close
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Editor Content - Two Column Layout */}
                    <div className={cn("flex-1 flex overflow-hidden relative", !isEditing && "opacity-50 pointer-events-none")}>
                      {/* Disabled overlay hint */}
                      {!isEditing && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/30">
                          <p className="text-muted-foreground text-sm">Click &quot;Edit View&quot; to make changes</p>
                        </div>
                      )}
                      {/* Left Side - Settings (Scrollable, fixed width) */}
                      <ScrollArea className="w-[400px] shrink-0 p-4 border-r">
                        <div className="space-y-4">
                          {/* View Filter Section */}
                          <Collapsible open={filtersExpanded} onOpenChange={setFiltersExpanded}>
                          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-semibold text-sm hover:text-primary">
                            {filtersExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <Filter className="h-4 w-4" />
                            View Filter
                            {editFilters.length > 0 && (
                              <Badge variant="secondary" className="ml-2">
                                {editFilters.length} active
                              </Badge>
                            )}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-3">
                            <Card>
                              <CardContent className="p-4">
                                {/* Filter Groups Controls */}
                                <div className="flex items-center gap-2 mb-3">
                                  <Button variant="outline" size="sm" onClick={addFilterGroup}>
                                    <Plus className="h-3 w-3 mr-1" />
                                    Group
                                  </Button>
                                  {editFilterGroups.length > 1 && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span>Between groups:</span>
                                      <Select
                                        value={editInterGroupLogic}
                                        onValueChange={(v) => setEditInterGroupLogic(v as "AND" | "OR")}
                                      >
                                        <SelectTrigger className="w-20 h-7">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="AND">AND</SelectItem>
                                          <SelectItem value="OR">OR</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                  {editFilters.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="ml-auto text-destructive"
                                      onClick={() => {
                                        setEditFilters([]);
                                        setEditFilterGroups([{ id: "default", logic: "AND" }]);
                                      }}
                                    >
                                      Clear All
                                    </Button>
                                  )}
                                </div>

                                {/* Filter Groups */}
                                <div className="space-y-4">
                                  {editFilterGroups.map((group, groupIndex) => {
                                    const groupFilters = editFilters.filter(f => (f.groupId || "default") === group.id);

                                    return (
                                      <div
                                        key={group.id}
                                        className={cn(
                                          "border rounded-lg p-3",
                                          editFilterGroups.length > 1
                                            ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/10"
                                            : "border-border"
                                        )}
                                      >
                                        {/* Group Header */}
                                        <div className="flex items-center gap-2 mb-2">
                                          {editFilterGroups.length > 1 && (
                                            <Badge variant="secondary">Group {groupIndex + 1}</Badge>
                                          )}
                                          <Select
                                            value={group.logic}
                                            onValueChange={(v) => {
                                              setEditFilterGroups(editFilterGroups.map(g =>
                                                g.id === group.id ? { ...g, logic: v as "AND" | "OR" } : g
                                              ));
                                            }}
                                          >
                                            <SelectTrigger className="w-20 h-7">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="AND">AND</SelectItem>
                                              <SelectItem value="OR">OR</SelectItem>
                                            </SelectContent>
                                          </Select>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => addFilter(group.id)}
                                          >
                                            <Plus className="h-3 w-3 mr-1" />
                                            Rule
                                          </Button>
                                          {editFilterGroups.length > 1 && (
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="ml-auto h-7 w-7 text-destructive"
                                              onClick={() => removeFilterGroup(group.id)}
                                            >
                                              <X className="h-3 w-3" />
                                            </Button>
                                          )}
                                        </div>

                                        {/* Rules */}
                                        <div className="space-y-2">
                                          {groupFilters.length === 0 ? (
                                            <p className="text-xs text-muted-foreground text-center py-2 italic">
                                              No rules. Click +Rule to add one.
                                            </p>
                                          ) : (
                                            groupFilters.map(filter => (
                                              <div key={filter.id} className="flex flex-wrap items-center gap-2 p-2 bg-background rounded border">
                                                {/* Column Select - Searchable in trigger */}
                                                <div className="w-[140px]">
                                                  <ComboboxDropdown
                                                    items={filteredColumns.map(col => ({
                                                      id: col.column_name,
                                                      label: col.name || col.column_name,
                                                    }))}
                                                    selectedItem={filter.column ? {
                                                      id: filter.column,
                                                      label: filteredColumns.find(c => c.column_name === filter.column)?.name || filter.column,
                                                    } : undefined}
                                                    onSelect={(item) => updateFilter(filter.id, { column: item.id })}
                                                    placeholder="Search column..."
                                                    searchInTrigger={true}
                                                    popoverProps={{ className: "w-[200px]" }}
                                                  />
                                                </div>

                                                {/* Operator Select */}
                                                <Select
                                                  value={filter.operator}
                                                  onValueChange={(v) => updateFilter(filter.id, { operator: v })}
                                                >
                                                  <SelectTrigger className="w-[90px] h-8">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="contains">contains</SelectItem>
                                                    <SelectItem value="=">=</SelectItem>
                                                    <SelectItem value="!=">≠</SelectItem>
                                                    <SelectItem value=">">{">"}</SelectItem>
                                                    <SelectItem value="<">{"<"}</SelectItem>
                                                    <SelectItem value=">=">≥</SelectItem>
                                                    <SelectItem value="<=">≤</SelectItem>
                                                    <SelectItem value="empty">empty</SelectItem>
                                                    <SelectItem value="notEmpty">not empty</SelectItem>
                                                  </SelectContent>
                                                </Select>

                                                {/* Value Input - renders dropdown for lookup/choice/boolean columns */}
                                                {filter.operator !== "empty" && filter.operator !== "notEmpty" && (
                                                  renderFilterValueInput(filter, columns.find(c => c.column_name === filter.column))
                                                )}

                                                {/* Delete Button */}
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                  onClick={() => removeFilter(filter.id)}
                                                >
                                                  <X className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </CardContent>
                            </Card>
                          </CollapsibleContent>
                        </Collapsible>

                        <Separator />

                        {/* Sort By Section */}
                        <Collapsible open={sortExpanded} onOpenChange={setSortExpanded}>
                          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-semibold text-sm hover:text-primary">
                            {sortExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <ArrowUpDown className="h-4 w-4" />
                            Sort By
                            {editSortColumns.length > 0 && (
                              <Badge variant="secondary" className="ml-2">
                                {editSortColumns.length} column{editSortColumns.length !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-3">
                            <Card>
                              <CardContent className="p-4">
                                <DndContext
                                  sensors={sensors}
                                  collisionDetection={closestCenter}
                                  onDragEnd={(event) => {
                                    const { active, over } = event;
                                    if (!over || active.id === over.id) return;
                                    const oldIndex = editSortColumns.findIndex(s => `sort-${s.column}` === active.id);
                                    const newIndex = editSortColumns.findIndex(s => `sort-${s.column}` === over.id);
                                    setEditSortColumns(arrayMove(editSortColumns, oldIndex, newIndex));
                                  }}
                                >
                                  <SortableContext
                                    items={editSortColumns.map(s => `sort-${s.column}`)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    <div className="space-y-2">
                                      {editSortColumns.map((sort, index) => (
                                        <SortableSortByItem
                                          key={`sort-${sort.column}`}
                                          id={`sort-${sort.column}`}
                                          sort={sort}
                                          columns={filteredColumns}
                                          onChangeColumn={(col) => updateSortColumn(index, { column: col })}
                                          onChangeDir={(dir) => updateSortColumn(index, { dir })}
                                          onChangeCustomOrder={(order) => updateSortColumn(index, { customOrder: order })}
                                          onRemove={() => removeSortColumn(index)}
                                          allRows={rows}
                                        />
                                      ))}
                                    </div>
                                  </SortableContext>
                                </DndContext>
                                <Button variant="outline" size="sm" className="mt-2" onClick={addSortColumn}>
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Sort Column
                                </Button>
                              </CardContent>
                            </Card>
                          </CollapsibleContent>
                        </Collapsible>

                        <Separator />

                        {/* Group By Section */}
                        <Collapsible open={groupByExpanded} onOpenChange={setGroupByExpanded}>
                          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-semibold text-sm hover:text-primary">
                            {groupByExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <Columns3 className="h-4 w-4" />
                            Group By
                            {editGroupByColumns.length > 0 && (
                              <Badge variant="secondary" className="ml-2">
                                {editGroupByColumns.length} column{editGroupByColumns.length !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-3">
                            <Card>
                              <CardContent className="p-4">
                                <DndContext
                                  sensors={sensors}
                                  collisionDetection={closestCenter}
                                  onDragEnd={(event) => {
                                    const { active, over } = event;
                                    if (!over || active.id === over.id) return;
                                    const oldIndex = editGroupByColumns.indexOf(active.id as string);
                                    const newIndex = editGroupByColumns.indexOf(over.id as string);
                                    setEditGroupByColumns(arrayMove(editGroupByColumns, oldIndex, newIndex));
                                  }}
                                >
                                  <SortableContext
                                    items={editGroupByColumns}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    <div className="space-y-2">
                                      {editGroupByColumns.map((col) => {
                                        const columnInfo = columns.find(c => c.column_name === col);
                                        return (
                                          <SortableGroupByItem
                                            key={col}
                                            id={col}
                                            columnName={columnInfo?.name || col}
                                            columns={filteredColumns}
                                            onChangeColumn={(newCol) => {
                                              setEditGroupByColumns(editGroupByColumns.map(c => c === col ? newCol : c));
                                            }}
                                            onRemove={() => {
                                              setEditGroupByColumns(editGroupByColumns.filter(c => c !== col));
                                            }}
                                          />
                                        );
                                      })}
                                    </div>
                                  </SortableContext>
                                </DndContext>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-2"
                                  onClick={() => {
                                    const available = filteredColumns.find(c => !editGroupByColumns.includes(c.column_name));
                                    if (available) {
                                      setEditGroupByColumns([...editGroupByColumns, available.column_name]);
                                    }
                                  }}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Group Column
                                </Button>
                              </CardContent>
                            </Card>
                          </CollapsibleContent>
                        </Collapsible>

                        </div>
                      </ScrollArea>

                      {/* Right Side - Columns (Collapsible) */}
                      <Collapsible open={columnsExpanded} onOpenChange={setColumnsExpanded} className={cn("flex flex-col p-4 overflow-hidden border-l transition-all", columnsExpanded ? "flex-1 min-w-0" : "w-auto")}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between mb-3 cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded">
                            <div className="flex items-center gap-2 font-semibold text-sm">
                              {columnsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <Eye className="h-4 w-4" />
                              Columns
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {Object.values(editVisibleColumns).filter(Boolean).length}
                              </Badge>
                            </div>
                            {columnsExpanded && (
                              <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-2">
                                  <Label htmlFor="show-totals" className="text-xs text-muted-foreground">Totals</Label>
                                  <Switch
                                    id="show-totals"
                                    checked={editShowTotals}
                                    onCheckedChange={setEditShowTotals}
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label htmlFor="auto-fit" className="text-xs text-muted-foreground">Auto-fit</Label>
                                  <Switch
                                    id="auto-fit"
                                    checked={editAutoFitColumns}
                                    onCheckedChange={handleAutoFitChange}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="flex-1 overflow-hidden">
                          <ScrollArea className="h-full -mx-4 px-4">
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragEnd={handleColumnDragEnd}
                            >
                              <SortableContext
                                items={editColumnOrder}
                                strategy={verticalListSortingStrategy}
                              >
                                {/* Visible Columns Section */}
                                <div className="mb-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                      <Eye className="h-3.5 w-3.5" />
                                      Visible
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                        {Object.values(editVisibleColumns).filter(Boolean).length}
                                      </Badge>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={hideAllColumns}>
                                      Hide All
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-1">
                                    {(() => {
                                      const visibleCols = getVisibleColumnsInOrder();
                                      return visibleCols.map((col, index) => (
                                        <SortableColumnItem
                                          key={col.column_name}
                                          id={col.column_name}
                                          column={col}
                                          isVisible={true}
                                          onToggleVisibility={() => toggleColumnVisibility(col.column_name)}
                                          index={index + 1}
                                          totalVisible={visibleCols.length}
                                          onReorder={(newPos) => reorderColumnToPosition(col.column_name, newPos)}
                                          showWidthInput={!editAutoFitColumns}
                                          width={editColumnWidths[col.column_name]}
                                          onWidthChange={(w) => setEditColumnWidths(prev => ({ ...prev, [col.column_name]: w }))}
                                        />
                                      ));
                                    })()}
                                  </div>
                                </div>

                                {/* Hidden Columns Section */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                      <EyeOff className="h-3.5 w-3.5" />
                                      Hidden
                                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                        {getSortedColumns().filter(col => editVisibleColumns[col.column_name] !== true).length}
                                      </Badge>
                                    </div>
                                    {getSortedColumns().filter(col => editVisibleColumns[col.column_name] !== true).length > 0 && (
                                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={showAllColumns}>
                                        Show All
                                      </Button>
                                    )}
                                  </div>
                                  {getSortedColumns().filter(col => editVisibleColumns[col.column_name] !== true).length > 0 ? (
                                    <div className="grid grid-cols-3 gap-1">
                                      {getSortedColumns()
                                        .filter(col => editVisibleColumns[col.column_name] !== true)
                                        .map(col => (
                                          <SortableColumnItem
                                            key={col.column_name}
                                            id={col.column_name}
                                            column={col}
                                            isVisible={false}
                                            onToggleVisibility={() => toggleColumnVisibility(col.column_name)}
                                          />
                                        ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic py-2">No hidden columns</p>
                                  )}
                                </div>
                              </SortableContext>
                            </DndContext>
                          </ScrollArea>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Filter className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>Select a view to edit or create a new one</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create View Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[450px] p-8">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl">Create New View</DialogTitle>
            <DialogDescription className="pt-1">
              Choose a name and optionally start from an existing view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="Enter view name..."
                className="h-11"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="base-view">Start From</Label>
              <Select value={newViewBaseId} onValueChange={setNewViewBaseId}>
                <SelectTrigger id="base-view" className="h-11">
                  <SelectValue placeholder="Select a starting view..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">
                    <span className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-muted-foreground" />
                      Blank View
                    </span>
                  </SelectItem>
                  {views.map(view => (
                    <SelectItem key={view.id} value={String(view.id)}>
                      <span className="flex items-center gap-2">
                        {view.is_global ? (
                          <Globe className="h-4 w-4 text-blue-500" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                        {view.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="space-y-1">
                <Label htmlFor="new-view-global" className="text-sm font-medium flex items-center gap-2">
                  {newViewIsGlobal ? (
                    <Globe className="h-4 w-4 text-blue-500" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                  {newViewIsGlobal ? "Global View" : "Personal View"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {newViewIsGlobal
                    ? "Visible to all users"
                    : "Only visible to you"}
                </p>
              </div>
              <Switch
                id="new-view-global"
                checked={newViewIsGlobal}
                onCheckedChange={setNewViewIsGlobal}
              />
            </div>
          </div>
          <DialogFooter className="pt-2 gap-3">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmCreate}>
              Create View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete View</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{viewToDelete?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteView}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
