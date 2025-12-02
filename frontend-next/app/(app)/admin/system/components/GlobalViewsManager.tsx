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
  display_order?: number;
}

interface Column {
  id: number;
  column_name: string;
  name: string;
  column_type: string;
  position?: number;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2 p-2 rounded border cursor-pointer transition-all",
        isActive
          ? "bg-primary/10 border-primary"
          : "bg-background border-border hover:border-primary/50",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {view.is_global ? (
            <Globe className="h-3 w-3 text-blue-500" />
          ) : (
            <User className="h-3 w-3 text-muted-foreground" />
          )}
          <span className="text-sm font-medium truncate">{view.name}</span>
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

      <div className="flex items-center gap-1">
        {onApply && (
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
        {view.name !== "Setup" && (
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
        )}
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
}: {
  id: string;
  column: Column;
  isVisible: boolean;
  onToggleVisibility: () => void;
  index?: number;
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

  const isSystemColumn = ['id', 'created_at', 'updated_at'].includes(column.column_name);

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
        <span className="flex items-center justify-center w-4 h-4 text-[9px] font-medium bg-muted rounded">
          {index}
        </span>
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
  const [editAutoFitColumns, setEditAutoFitColumns] = React.useState(true);

  // Collapse state
  const [filtersExpanded, setFiltersExpanded] = React.useState(true);
  const [sortExpanded, setSortExpanded] = React.useState(true);
  const [groupByExpanded, setGroupByExpanded] = React.useState(true);

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
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; views: SavedView[] }>(
        `/api/v1/foundation_views?foundation_id=${foundationId}`
      );

      if (response.success && response.views) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedViews = (response.views as any[]).map((v) => ({
          ...v,
          filters: v.filters?.cascadeFilters || [],
          filterGroups: v.filters?.filterGroups || [{ id: "default", logic: "AND" }],
          interGroupLogic: v.filters?.interGroupLogic || "OR",
          visibleColumns: v.columns?.visible || {},
          columnOrder: v.columns?.order || [],
          autoFitColumns: v.columns?.autoFitColumns === true,
          sortColumns: Array.isArray(v.sort_order) ? v.sort_order : [],
          groupByColumns: v.group_by_columns || [],
        })) as SavedView[];

        setViews(mappedViews);

        // If a view name was specified (for newly created views), select it
        if (selectViewByName) {
          const newView = mappedViews.find(v => v.name === selectViewByName);
          if (newView) {
            setActiveViewId(newView.id);
            loadViewIntoEditor(newView);
            return;
          }
        }

        // Auto-select first view if none selected
        if (!activeViewId && mappedViews.length > 0) {
          setActiveViewId(mappedViews[0].id);
          loadViewIntoEditor(mappedViews[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load views:", error);
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
    setEditAutoFitColumns(view.autoFitColumns || false);
  };

  const handleSelectView = (view: SavedView) => {
    setActiveViewId(view.id);
    loadViewIntoEditor(view);
  };

  const handleCreateNew = () => {
    setNewViewName("New View");
    setNewViewBaseId("blank");
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
      is_global: false,
      filters: baseView?.filters || [],
      filterGroups: baseView?.filterGroups || [{ id: "default", logic: "AND" }],
      interGroupLogic: baseView?.interGroupLogic || "OR",
      visibleColumns: baseView?.visibleColumns || Object.fromEntries(columns.map(c => [c.column_name, true])),
      columnOrder: baseView?.columnOrder || columns.map(c => c.column_name),
      sortColumns: baseView?.sortColumns || [],
      groupByColumns: baseView?.groupByColumns || [],
      autoFitColumns: baseView?.autoFitColumns ?? true,
    };

    setActiveViewId(newView.id);
    loadViewIntoEditor(newView);
    setShowCreateDialog(false);
  };

  const handleSaveView = async () => {
    if (!editingView) return;

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
          autoFitColumns: editAutoFitColumns,
        },
        sort_order: editSortColumns,
        group_by_columns: editGroupByColumns,
        group_by_column: editGroupByColumns[0] || null,
      };

      let response: { success: boolean; error?: string; view?: { id: number } } | null;

      // Wrap data in foundation_view for Rails strong params
      const wrappedData = { foundation_view: viewData };

      const isNewView = typeof editingView.id === "string" && editingView.id.startsWith("new_");

      if (isNewView) {
        // Create new view
        if (editIsGlobal) {
          response = await api.post<{ success: boolean; error?: string; view?: { id: number } }>("/api/v1/foundation_views/save_global", wrappedData);
        } else {
          response = await api.post<{ success: boolean; error?: string; view?: { id: number } }>("/api/v1/foundation_views", wrappedData);
        }
      } else {
        // Update existing view
        response = await api.patch<{ success: boolean; error?: string; view?: { id: number } }>(`/api/v1/foundation_views/${editingView.id}`, wrappedData);
      }

      if (response?.success) {
        toast({
          title: "Success",
          description: editIsGlobal ? "Global view saved for all users" : "View saved successfully",
        });

        // Reload views list - if this was a new view, pass the name so we can select it
        await loadViews(isNewView ? editName : undefined);
        onViewsChange?.();
      } else {
        throw new Error(response?.error || "Failed to save view");
      }
    } catch (error) {
      console.error("Failed to save view:", error);
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
    setEditVisibleColumns({
      ...editVisibleColumns,
      [columnName]: !editVisibleColumns[columnName],
    });
  };

  const showAllColumns = () => {
    setEditVisibleColumns(Object.fromEntries(columns.map(c => [c.column_name, true])));
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

  const filteredColumns = columns.filter(c => !["id", "created_at", "updated_at"].includes(c.column_name));

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col p-0" side="right-full">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Global Views Manager
            </SheetTitle>
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
                        {views.filter(v => v.name !== "__default_setup__").map(view => (
                          <SortableViewItem
                            key={view.id}
                            view={view}
                            isActive={activeViewId === view.id}
                            onSelect={() => handleSelectView(view)}
                            onEdit={() => handleSelectView(view)}
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
                    <div className="p-4 border-b bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="max-w-[200px] font-medium"
                          placeholder="View name..."
                        />
                        <div className="flex items-center gap-2">
                          <Switch
                            id="global-switch"
                            checked={editIsGlobal}
                            onCheckedChange={setEditIsGlobal}
                          />
                          <Label htmlFor="global-switch" className="text-sm flex items-center gap-1">
                            {editIsGlobal ? <Globe className="h-3 w-3 text-blue-500" /> : <User className="h-3 w-3" />}
                            {editIsGlobal ? "Global" : "Personal"}
                          </Label>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => loadViewIntoEditor(editingView)}>
                            Reset
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleSaveView} disabled={saving}>
                            {saving ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Save
                          </Button>
                          <Button size="sm" onClick={async () => { await handleSaveView(); onOpenChange(false); }} disabled={saving}>
                            {saving ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4 mr-2" />
                            )}
                            Save & Close
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Editor Content - Two Column Layout */}
                    <div className="flex-1 flex overflow-hidden">
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
                                                {/* Column Select */}
                                                <Select
                                                  value={filter.column}
                                                  onValueChange={(v) => updateFilter(filter.id, { column: v })}
                                                >
                                                  <SelectTrigger className="w-[120px] h-8">
                                                    <SelectValue placeholder="Column..." />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {filteredColumns.map(col => (
                                                      <SelectItem key={col.column_name} value={col.column_name}>
                                                        {col.name || col.column_name}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>

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

                                                {/* Value Input */}
                                                {filter.operator !== "empty" && filter.operator !== "notEmpty" && (
                                                  <Input
                                                    value={String(filter.value || "")}
                                                    onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                                                    placeholder="Value..."
                                                    className="w-[80px] h-8"
                                                  />
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

                      {/* Right Side - Columns (Takes remaining space) */}
                      <div className="flex-1 flex flex-col p-4 overflow-hidden min-w-0">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 font-semibold text-sm">
                            <Eye className="h-4 w-4" />
                            Columns
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor="auto-fit" className="text-xs text-muted-foreground">Auto-fit</Label>
                            <Switch
                              id="auto-fit"
                              checked={editAutoFitColumns}
                              onCheckedChange={setEditAutoFitColumns}
                            />
                          </div>
                        </div>
                        <ScrollArea className="flex-1 -mx-4 px-4">
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
                                  {getSortedColumns()
                                    .filter(col => editVisibleColumns[col.column_name] === true)
                                    .map((col, index) => (
                                      <SortableColumnItem
                                        key={col.column_name}
                                        id={col.column_name}
                                        column={col}
                                        isVisible={true}
                                        onToggleVisibility={() => toggleColumnVisibility(col.column_name)}
                                        index={index + 1}
                                      />
                                    ))}
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
                      </div>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New View</DialogTitle>
            <DialogDescription>
              Choose a name and optionally start from an existing view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="Enter view name..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="base-view">Start From</Label>
              <Select value={newViewBaseId} onValueChange={setNewViewBaseId}>
                <SelectTrigger id="base-view">
                  <SelectValue placeholder="Select a starting view..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blank">
                    <span className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-muted-foreground" />
                      Blank View
                    </span>
                  </SelectItem>
                  {views.filter(v => v.name !== "__default_setup__").map(view => (
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
          </div>
          <DialogFooter>
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
