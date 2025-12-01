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
  Filter,
  ArrowUpDown,
  Columns3,
  Settings2,
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
  dir: "asc" | "desc";
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
  showFilters?: boolean;
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
}

// Sortable View Item
function SortableViewItem({
  view,
  isActive,
  onSelect,
  onEdit,
  onDelete,
}: {
  view: SavedView;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
}: {
  id: string;
  column: Column;
  isVisible: boolean;
  onToggleVisibility: () => void;
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
        "flex items-center gap-2 p-2 rounded border transition-all",
        isVisible ? "bg-background border-border" : "bg-muted/30 border-border",
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
      <button
        onClick={onToggleVisibility}
        className="flex items-center gap-2 flex-1 text-left hover:opacity-70"
      >
        {isVisible ? (
          <Eye className="h-3 w-3 text-primary" />
        ) : (
          <EyeOff className="h-3 w-3 text-muted-foreground" />
        )}
        <span className={cn("text-xs truncate", !isVisible && "text-muted-foreground")}>
          {column.name || column.column_name}
        </span>
      </button>
    </div>
  );
}

export function GlobalViewsManager({
  open,
  onOpenChange,
  foundationId,
  columns,
  onViewsChange,
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
  const [editShowFilters, setEditShowFilters] = React.useState(true);
  const [editAutoFitColumns, setEditAutoFitColumns] = React.useState(false);

  // Collapse state
  const [filtersExpanded, setFiltersExpanded] = React.useState(true);
  const [sortExpanded, setSortExpanded] = React.useState(true);
  const [groupByExpanded, setGroupByExpanded] = React.useState(true);
  const [columnsExpanded, setColumnsExpanded] = React.useState(true);
  const [displayExpanded, setDisplayExpanded] = React.useState(true);

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

  const loadViews = async () => {
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
          showFilters: v.columns?.showFilters !== false,
          autoFitColumns: v.columns?.autoFitColumns === true,
          sortColumns: Array.isArray(v.sort_order) ? v.sort_order : [],
          groupByColumns: v.group_by_columns || [],
        })) as SavedView[];

        setViews(mappedViews);

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
    setEditVisibleColumns(view.visibleColumns || {});
    setEditColumnOrder(view.columnOrder || columns.map(c => c.column_name));
    setEditShowFilters(view.showFilters !== false);
    setEditAutoFitColumns(view.autoFitColumns || false);
  };

  const handleSelectView = (view: SavedView) => {
    setActiveViewId(view.id);
    loadViewIntoEditor(view);
  };

  const handleCreateNew = () => {
    const newView: SavedView = {
      id: `new_${Date.now()}`,
      name: "New View",
      is_global: false,
      filters: [],
      filterGroups: [{ id: "default", logic: "AND" }],
      interGroupLogic: "OR",
      visibleColumns: Object.fromEntries(columns.map(c => [c.column_name, true])),
      columnOrder: columns.map(c => c.column_name),
      sortColumns: [],
      groupByColumns: [],
      showFilters: true,
      autoFitColumns: false,
    };

    setActiveViewId(newView.id);
    loadViewIntoEditor(newView);
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
          showFilters: editShowFilters,
          autoFitColumns: editAutoFitColumns,
        },
        sort_order: editSortColumns,
        group_by_columns: editGroupByColumns,
        group_by_column: editGroupByColumns[0] || null,
      };

      let response: { success: boolean; error?: string } | null;

      if (typeof editingView.id === "string" && editingView.id.startsWith("new_")) {
        // Create new view
        if (editIsGlobal) {
          response = await api.post<{ success: boolean; error?: string }>("/api/v1/foundation_views/save_global", viewData);
        } else {
          response = await api.post<{ success: boolean; error?: string }>("/api/v1/foundation_views", viewData);
        }
      } else {
        // Update existing view
        response = await api.patch<{ success: boolean; error?: string }>(`/api/v1/foundation_views/${editingView.id}`, viewData);
      }

      if (response?.success) {
        toast({
          title: "Success",
          description: editIsGlobal ? "Global view saved for all users" : "View saved successfully",
        });
        await loadViews();
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
                          <Button size="sm" onClick={handleSaveView} disabled={saving}>
                            {saving ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Editor Content */}
                    <ScrollArea className="flex-1 p-4">
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
                                              <div key={filter.id} className="flex items-center gap-2 p-2 bg-background rounded border">
                                                {/* Column Select */}
                                                <Select
                                                  value={filter.column}
                                                  onValueChange={(v) => updateFilter(filter.id, { column: v })}
                                                >
                                                  <SelectTrigger className="w-[140px] h-8">
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
                                                  <SelectTrigger className="w-[100px] h-8">
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
                                                    <SelectItem value="empty">is empty</SelectItem>
                                                    <SelectItem value="notEmpty">is not empty</SelectItem>
                                                  </SelectContent>
                                                </Select>

                                                {/* Value Input */}
                                                {filter.operator !== "empty" && filter.operator !== "notEmpty" && (
                                                  <Input
                                                    value={String(filter.value || "")}
                                                    onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                                                    placeholder="Value..."
                                                    className="flex-1 h-8"
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
                                <div className="space-y-2">
                                  {editSortColumns.map((sort, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                      <Select
                                        value={sort.column}
                                        onValueChange={(v) => updateSortColumn(index, { column: v })}
                                      >
                                        <SelectTrigger className="flex-1 h-8">
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
                                      <Select
                                        value={sort.dir}
                                        onValueChange={(v) => updateSortColumn(index, { dir: v as "asc" | "desc" })}
                                      >
                                        <SelectTrigger className="w-[100px] h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="asc">A → Z</SelectItem>
                                          <SelectItem value="desc">Z → A</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeSortColumn(index)}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button variant="outline" size="sm" onClick={addSortColumn}>
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Sort Column
                                  </Button>
                                </div>
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
                                <div className="space-y-2">
                                  {editGroupByColumns.map((col, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                      <Select
                                        value={col}
                                        onValueChange={(v) => {
                                          const newCols = [...editGroupByColumns];
                                          newCols[index] = v;
                                          setEditGroupByColumns(newCols);
                                        }}
                                      >
                                        <SelectTrigger className="flex-1 h-8">
                                          <SelectValue placeholder="Column..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {filteredColumns.map(c => (
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
                                        onClick={() => {
                                          setEditGroupByColumns(editGroupByColumns.filter((_, i) => i !== index));
                                        }}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                  <Button
                                    variant="outline"
                                    size="sm"
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
                                </div>
                              </CardContent>
                            </Card>
                          </CollapsibleContent>
                        </Collapsible>

                        <Separator />

                        {/* Display Options Section */}
                        <Collapsible open={displayExpanded} onOpenChange={setDisplayExpanded}>
                          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-semibold text-sm hover:text-primary">
                            {displayExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <Settings2 className="h-4 w-4" />
                            Display Options
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-3">
                            <Card>
                              <CardContent className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm">Show inline filters</Label>
                                  <Switch
                                    checked={editShowFilters}
                                    onCheckedChange={setEditShowFilters}
                                  />
                                </div>
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm">Auto-fit columns</Label>
                                  <Switch
                                    checked={editAutoFitColumns}
                                    onCheckedChange={setEditAutoFitColumns}
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          </CollapsibleContent>
                        </Collapsible>

                        <Separator />

                        {/* Columns Section */}
                        <Collapsible open={columnsExpanded} onOpenChange={setColumnsExpanded}>
                          <CollapsibleTrigger className="flex items-center gap-2 w-full text-left font-semibold text-sm hover:text-primary">
                            {columnsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <Eye className="h-4 w-4" />
                            Columns
                            <Badge variant="secondary" className="ml-2">
                              {Object.values(editVisibleColumns).filter(Boolean).length} visible
                            </Badge>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pt-3">
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <Button variant="outline" size="sm" onClick={showAllColumns}>
                                    Show All
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={hideAllColumns}>
                                    Hide All
                                  </Button>
                                </div>
                                <DndContext
                                  sensors={sensors}
                                  collisionDetection={closestCenter}
                                  onDragEnd={handleColumnDragEnd}
                                >
                                  <SortableContext
                                    items={editColumnOrder}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1">
                                      {getSortedColumns().map(col => (
                                        <SortableColumnItem
                                          key={col.column_name}
                                          id={col.column_name}
                                          column={col}
                                          isVisible={editVisibleColumns[col.column_name] !== false}
                                          onToggleVisibility={() => toggleColumnVisibility(col.column_name)}
                                        />
                                      ))}
                                    </div>
                                  </SortableContext>
                                </DndContext>
                              </CardContent>
                            </Card>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    </ScrollArea>
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
