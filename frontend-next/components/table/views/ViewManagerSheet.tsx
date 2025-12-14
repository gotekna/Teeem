"use client";

import React from "react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  Plus,
  Pencil,
  Eye,
  EyeOff,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Filter,
  ArrowUpDown,
  Columns3,
  Globe,
  User,
  Loader2,
  Check,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useFoundationColumns } from "@/lib/column-state-atoms";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import { sortHiddenColumnsAlphabetically } from "../column-utils";
import { getColumnPriority, COLUMN_PRIORITY_CONFIG, type ColumnPriority } from "@/lib/column-priority";
import type { SavedView, CascadeFilter, FilterGroup, SortColumn } from "../types";
import { useSetAtom } from "jotai";
import { foundationViewsAtom, invalidateViewsCacheAtom } from "@/lib/view-state-atoms";

import { SortableViewItem } from "./SortableViewItem";
import { SortableColumnItem } from "./SortableColumnItem";
import { SortableSortByItem } from "./SortableSortByItem";
import { SortableGroupByItem } from "./SortableGroupByItem";
import { useEntityTypes } from "@/hooks/useEntityTypes";
import { useContactChoices } from "@/hooks/useContactChoices";

// Column interface for view manager
interface Column {
  id: number;
  column_name: string;
  name: string;
  column_type: string;
  position?: number;
  lookup_foundation_id?: number;
  lookup_display_column?: string;
  available_choices?: { id: number; value: string }[] | string[];
  searchable?: boolean;
}

interface ViewManagerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foundationId: number;
  columns: Column[];
  onViewsChange?: () => void;
  onApplyView?: (view: SavedView) => void;
  onAutoFitChange?: (enabled: boolean) => void;
  onShowTotalsChange?: (enabled: boolean) => void;
  onRefresh?: () => void; // Called after saving to refresh data with new filters/settings
  rows?: Record<string, unknown>[];
}

// Known lookup column mappings (column_name -> foundation_id and custom endpoint)
const KNOWN_LOOKUP_MAPPINGS: Record<string, { foundationId: number; displayColumn: string; apiEndpoint?: string; responseKey?: string }> = {
  job_type_id: { foundationId: 344, displayColumn: 'name', apiEndpoint: '/api/v1/job_types', responseKey: 'job_types' },
  job_type: { foundationId: 344, displayColumn: 'name', apiEndpoint: '/api/v1/job_types', responseKey: 'job_types' },
  job_status_id: { foundationId: 345, displayColumn: 'name', apiEndpoint: '/api/v1/job_status', responseKey: 'job_statuses' },
  job_status: { foundationId: 345, displayColumn: 'name', apiEndpoint: '/api/v1/job_status', responseKey: 'job_statuses' },
  design_id: { foundationId: 368, displayColumn: 'name' },
  contact_id: { foundationId: 214, displayColumn: 'display_name' },
};

export function ViewManagerSheet({
  open,
  onOpenChange,
  foundationId,
  columns,
  onViewsChange,
  onApplyView,
  onAutoFitChange,
  onShowTotalsChange,
  onRefresh,
  rows,
}: ViewManagerSheetProps) {
  const { toast } = useToast();

  // Global views atom - update this to sync view order with main table
  const setGlobalViews = useSetAtom(foundationViewsAtom);

  // Import invalidate cache action (now imported at top of file)
  const invalidateCache = useSetAtom(invalidateViewsCacheAtom);

  // State
  const [views, setViews] = React.useState<SavedView[]>([]);

  // Load all Foundation columns with caching
  const { columns: allFoundationColumns, loading: columnsLoading } = useFoundationColumns(
    open ? foundationId : null
  );

  // Use all foundation columns if loaded, otherwise fall back to prop columns
  const effectiveColumns = allFoundationColumns.length > 0 ? allFoundationColumns : columns;

  // Foundation names for lookup columns
  const [foundationNames, setFoundationNames] = React.useState<Record<number, string>>({});

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
  const [editViewType, setEditViewType] = React.useState<"table" | "relational">("table");
  const [editFilters, setEditFilters] = React.useState<CascadeFilter[]>([]);
  const [editFilterGroups, setEditFilterGroups] = React.useState<FilterGroup[]>([{ id: "default", logic: "AND" }]);
  const [editInterGroupLogic, setEditInterGroupLogic] = React.useState<"AND" | "OR">("OR");
  const [editSortColumns, setEditSortColumns] = React.useState<SortColumn[]>([]);
  const [editGroupByColumns, setEditGroupByColumns] = React.useState<string[]>([]);
  const [editVisibleColumns, setEditVisibleColumns] = React.useState<Record<string, boolean>>({});
  const [editColumnOrder, setEditColumnOrder] = React.useState<string[]>([]);
  const [editColumnWidths, setEditColumnWidths] = React.useState<Record<string, number>>({});
  const [editAutoFitColumns, setEditAutoFitColumns] = React.useState(false);
  const [editSmartFit, setEditSmartFit] = React.useState(true); // Default to TEEEM Smart
  const [editShowTotals, setEditShowTotals] = React.useState(true);
  const [editSearchableColumns, setEditSearchableColumns] = React.useState<Record<string, boolean>>({});

  // Collapse state
  const [filtersExpanded, setFiltersExpanded] = React.useState(true);
  const [sortExpanded, setSortExpanded] = React.useState(true);
  const [groupByExpanded, setGroupByExpanded] = React.useState(true);
  const [columnsExpanded, setColumnsExpanded] = React.useState(true);
  const [columnSearch, setColumnSearch] = React.useState("");

  // Lookup options cache for filter dropdowns
  const [lookupOptionsCache, setLookupOptionsCache] = React.useState<Record<string, { id: number; display: string }[]>>({});
  const [lookupLoadingColumns, setLookupLoadingColumns] = React.useState<Set<string>>(new Set());

  // SSoT: Contact choices from API (used for choice column filters)
  const { metadata: entityTypeMetadata } = useEntityTypes();
  const { employmentStatusMetadata, roleMetadata } = useContactChoices();

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

  // Load foundation names for lookup columns
  React.useEffect(() => {
    if (open) {
      loadFoundationNames();
    }
  }, [open]);

  const loadFoundationNames = async () => {
    try {
      const response = await api.get<{ success: boolean; foundations: Array<{ id: number; name: string }> }>('/api/v1/foundations');
      if (response?.success && response.foundations) {
        const nameMap: Record<number, string> = {};
        response.foundations.forEach(f => {
          nameMap[f.id] = f.name;
        });
        setFoundationNames(nameMap);
      }
    } catch (error) {
      console.error('[ViewManagerSheet] Failed to load foundation names:', error);
    }
  };

  const loadViews = async (selectViewByName?: string) => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; views: SavedView[] }>(
        `/api/v1/foundation_views?foundation_id=${foundationId}`
      );

      if (response?.success && response.views) {

        const mappedViews = (response.views as any[]).map((v) => ({
          ...v,
          view_type: v.view_display_type || "table", // Map backend field to frontend field
          filters: v.filters?.cascadeFilters || [],
          filterGroups: v.filters?.filterGroups || [{ id: "default", logic: "AND" }],
          interGroupLogic: v.filters?.interGroupLogic || "OR",
          visibleColumns: v.columns?.visible || {},
          searchableColumns: v.columns?.searchable || {},
          columnOrder: v.columns?.order || [],
          columnWidths: v.columns?.widths || {},
          autoFitColumns: v.columns?.autoFitColumns === true,
          smartFit: v.columns?.smartFit !== false, // Default to true
          showTotals: v.columns?.showTotals !== false,
          sortColumns: Array.isArray(v.sort_order) ? v.sort_order : [],
          groupByColumns: v.group_by_columns || [],
        })) as SavedView[];

        setViews(mappedViews);

        if (selectViewByName) {
          const newView = mappedViews.find(v => v.name === selectViewByName);
          if (newView) {
            setActiveViewId(newView.id);
            loadViewIntoEditor(newView);
            setIsEditing(false);
            return;
          }
        }

        if (activeViewId) {
          const currentView = mappedViews.find(v => v.id === activeViewId);
          if (currentView) {
            loadViewIntoEditor(currentView);
            setIsEditing(false);
          }
          return;
        }

        if (!activeViewId && mappedViews.length > 0) {
          setActiveViewId(mappedViews[0].id);
          loadViewIntoEditor(mappedViews[0]);
        }
      }
    } catch (error) {
      console.error("[ViewManagerSheet] Failed to load views:", error);
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
    setEditViewType(view.view_type || "table");
    setEditFilters(view.filters || []);
    setEditFilterGroups(view.filterGroups || [{ id: "default", logic: "AND" }]);
    setEditInterGroupLogic(view.interGroupLogic || "OR");
    setEditSortColumns(view.sortColumns || []);
    setEditGroupByColumns(view.groupByColumns || []);

    const hasVisibleColumns = view.visibleColumns && Object.keys(view.visibleColumns).length > 0;
    const visibleColumnsToSet = hasVisibleColumns
      ? view.visibleColumns
      : Object.fromEntries(effectiveColumns.map(c => [c.column_name, true]));
    setEditVisibleColumns(visibleColumnsToSet!);

    setEditColumnOrder(view.columnOrder || effectiveColumns.map(c => c.column_name));
    setEditColumnWidths(view.columnWidths || {});
    setEditAutoFitColumns(view.autoFitColumns || false);
    setEditSmartFit(view.smartFit !== false); // Default to true for TEEEM Smart
    setEditShowTotals(view.showTotals !== false);

    // Load searchable columns - default to foundation schema's searchable settings
    const hasSearchableColumns = view.searchableColumns && Object.keys(view.searchableColumns).length > 0;
    const searchableColumnsToSet = hasSearchableColumns
      ? view.searchableColumns
      : Object.fromEntries(effectiveColumns.map(c => [c.column_name, c.searchable ?? false]));
    setEditSearchableColumns(searchableColumnsToSet!);
  };

  const handleSelectView = (view: SavedView) => {
    setActiveViewId(view.id);
    loadViewIntoEditor(view);
    setIsEditing(false);
    // Also apply the view to the table immediately (better UX - click = use)
    onApplyView?.(view);
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
      visibleColumns: baseView?.visibleColumns || Object.fromEntries(effectiveColumns.map(c => [c.column_name, true])),
      columnOrder: baseView?.columnOrder || effectiveColumns.map(c => c.column_name),
      columnWidths: baseView?.columnWidths || {},
      sortColumns: baseView?.sortColumns || [],
      groupByColumns: baseView?.groupByColumns || [],
      autoFitColumns: baseView?.autoFitColumns ?? false,
      smartFit: baseView?.smartFit ?? true, // Default to TEEEM Smart for new views
      showTotals: baseView?.showTotals ?? true,
    };

    setViews(prev => [...prev, newView]);
    setActiveViewId(newView.id);
    loadViewIntoEditor(newView);
    setIsEditing(true);
    setShowCreateDialog(false);
  };

  const handleSaveView = async () => {
    if (!editingView) return;

    setSaving(true);
    try {
      // Capture current edit state BEFORE any async operations
      // This prevents race conditions where loadViews resets edit state
      const currentEditState = {
        name: editName,
        isGlobal: editIsGlobal,
        viewType: editViewType,
        visibleColumns: editVisibleColumns,
        columnOrder: editColumnOrder,
        columnWidths: editColumnWidths,
        autoFitColumns: editAutoFitColumns,
        smartFit: editSmartFit,
        showTotals: editShowTotals,
        searchableColumns: editSearchableColumns,
        filters: editFilters,
        filterGroups: editFilterGroups,
        interGroupLogic: editInterGroupLogic,
        sortColumns: editSortColumns,
        groupByColumns: editGroupByColumns,
      };

      const viewData = {
        foundation_id: foundationId,
        name: currentEditState.name,
        view_type: "custom",
        view_display_type: currentEditState.viewType,
        is_global: currentEditState.isGlobal,
        filters: {
          cascadeFilters: currentEditState.filters,
          filterGroups: currentEditState.filterGroups,
          interGroupLogic: currentEditState.interGroupLogic,
        },
        columns: {
          visible: currentEditState.visibleColumns,
          order: currentEditState.columnOrder,
          widths: currentEditState.columnWidths,
          autoFitColumns: currentEditState.autoFitColumns,
          smartFit: currentEditState.smartFit,
          showTotals: currentEditState.showTotals,
          searchable: currentEditState.searchableColumns,
        },
        sort_order: currentEditState.sortColumns,
        group_by_columns: currentEditState.groupByColumns,
        group_by_column: currentEditState.groupByColumns[0] || null,
      };

      let response: { success: boolean; error?: string; view?: { id: number } } | null;
      const wrappedData = { foundation_view: viewData };
      const isNewView = typeof editingView.id === "string" && editingView.id.startsWith("new_");

      if (isNewView) {
        const endpoint = currentEditState.isGlobal ? "/api/v1/foundation_views/save_global" : "/api/v1/foundation_views";
        response = await api.post<{ success: boolean; error?: string; view?: { id: number } }>(endpoint, wrappedData);
      } else {
        const endpoint = `/api/v1/foundation_views/${editingView.id}`;
        response = await api.patch<{ success: boolean; error?: string; view?: { id: number } }>(endpoint, wrappedData);
      }

      if (response?.success) {
        toast({
          title: "Success",
          description: currentEditState.isGlobal ? "Global view saved for all users" : "View saved successfully",
        });

        // Construct savedView BEFORE calling loadViews to avoid state reset race condition
        const savedView: SavedView = {
          id: isNewView && response.view?.id ? response.view.id : editingView.id,
          name: currentEditState.name,
          view_type: currentEditState.viewType,
          is_global: currentEditState.isGlobal,
          visibleColumns: currentEditState.visibleColumns,
          columnOrder: currentEditState.columnOrder,
          columnWidths: currentEditState.columnWidths,
          autoFitColumns: currentEditState.autoFitColumns,
          smartFit: currentEditState.smartFit,
          showTotals: currentEditState.showTotals,
          searchableColumns: currentEditState.searchableColumns,
          filters: currentEditState.filters,
          filterGroups: currentEditState.filterGroups,
          interGroupLogic: currentEditState.interGroupLogic,
          sortColumns: currentEditState.sortColumns,
          groupByColumns: currentEditState.groupByColumns,
        };

        // Invalidate cache to force fresh load with updated view_display_type
        invalidateCache(foundationId);

        // Then refresh the views list (this may reset edit state, but that's OK now)
        await loadViews(isNewView ? currentEditState.name : undefined);

        // Apply the view state immediately using captured state
        // This ensures display type changes take effect immediately
        console.log('[ViewManagerSheet] Applying saved view with columnOrder:', savedView.columnOrder);
        onApplyView?.(savedView);

        // Trigger data refresh to apply new filters/sorting/etc
        onRefresh?.();

        onViewsChange?.();
      } else {
        throw new Error(response?.error || "Failed to save view");
      }
    } catch (error) {
      console.error("[ViewManagerSheet] Failed to save view:", error);
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
    // Also update global atom so view chips on main page reflect new order immediately
    setGlobalViews(reorderedViews);

    const orders = reorderedViews.map((v, idx) => ({
      id: v.id,
      display_order: idx,
    }));

    try {
      const response = await api.post<{ success: boolean; error?: string }>("/api/v1/foundation_views/reorder", { orders });
      if (response?.success) {
        // Notify parent that views changed (for cache invalidation)
        onViewsChange?.();
      } else {
        console.error("Failed to save view order:", response?.error);
        toast({
          title: "Error",
          description: "Failed to save view order",
          variant: "destructive",
        });
        // Revert both local and global state
        setViews(views);
        setGlobalViews(views);
      }
    } catch (error) {
      console.error("Failed to save view order:", error);
      toast({
        title: "Error",
        description: "Failed to save view order",
        variant: "destructive",
      });
      // Revert both local and global state
      setViews(views);
      setGlobalViews(views);
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

  // Fetch lookup options for a column
  const fetchLookupOptions = async (column: Column) => {
    if (!column.lookup_foundation_id) return;

    const cacheKey = `${column.lookup_foundation_id}`;
    if (lookupOptionsCache[cacheKey]) return;
    if (lookupLoadingColumns.has(cacheKey)) return;

    setLookupLoadingColumns(prev => new Set([...prev, cacheKey]));

    try {
      const knownMapping = Object.values(KNOWN_LOOKUP_MAPPINGS).find(
        m => m.foundationId === column.lookup_foundation_id
      );

      let options: { id: number; display: string }[] = [];

      if (knownMapping?.apiEndpoint) {
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
        const response = await api.get<{ entries?: { id: number; [key: string]: unknown }[] }>(
          `/api/v1/foundations/${column.lookup_foundation_id}/entries`
        );

        if (response?.entries) {
          const displayCol = column.lookup_display_column || 'name';
          options = response.entries.map(entry => ({
            id: entry.id,
            display: String(entry[displayCol] || entry.name || entry.id),
          }));
        }
      }

      setLookupOptionsCache(prev => ({
        ...prev,
        [cacheKey]: options,
      }));
    } catch (error) {
      console.error('[ViewManagerSheet] Failed to fetch lookup options:', error);
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
    let resolvedColumn = column;
    if (!column && filter.column.endsWith('_id')) {
      const baseColumnName = filter.column.replace(/_id$/, '');
      resolvedColumn = effectiveColumns.find(c => c.column_name === baseColumnName);
    }
    column = resolvedColumn;

    const knownMapping = KNOWN_LOOKUP_MAPPINGS[filter.column];

    if (!column) {
      if (knownMapping) {
        const cacheKey = `${knownMapping.foundationId}`;
        const options = lookupOptionsCache[cacheKey] || [];
        const isLoading = lookupLoadingColumns.has(cacheKey);

        if (!lookupOptionsCache[cacheKey] && !isLoading) {
          fetchLookupOptions({
            id: 0,
            column_name: filter.column,
            name: filter.column,
            column_type: 'lookup',
            lookup_foundation_id: knownMapping.foundationId,
            lookup_display_column: knownMapping.displayColumn,
          });
        }

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
              popoverProps={{ className: "min-w-[200px] w-auto" }}
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

    // SSoT: Use choices from API for specific columns (not column.available_choices)
    // This ensures filter dropdowns show valid values from Contact model constants
    const ssotColumns: Record<string, { metadata: { value: string; label: string }[]; placeholder: string }> = {
      entity_type: { metadata: entityTypeMetadata, placeholder: "Search type..." },
      employment_status: { metadata: employmentStatusMetadata, placeholder: "Search status..." },
      primary_role: { metadata: roleMetadata, placeholder: "Search role..." },
    };

    const ssotConfig = ssotColumns[filter.column];
    if (ssotConfig && ssotConfig.metadata.length > 0) {
      const items: ComboboxItem[] = ssotConfig.metadata.map((item) => ({
        id: item.value,
        label: item.label,
      }));

      return (
        <div className="w-[140px]">
          <ComboboxDropdown
            items={items}
            selectedItem={filter.value ? { id: String(filter.value), label: ssotConfig.metadata.find(m => m.value === filter.value)?.label || String(filter.value) } : undefined}
            onSelect={(item) => updateFilter(filter.id, { value: item.id })}
            placeholder={ssotConfig.placeholder}
            searchInTrigger={true}
            popoverProps={{ className: "min-w-[200px] w-auto" }}
          />
        </div>
      );
    }

    const hasAvailableChoices = column.available_choices && column.available_choices.length > 0;

    if (isChoiceColumn || hasAvailableChoices) {
      const choices = column.available_choices || [];
      if (choices.length > 0) {
        const choiceItems: ComboboxItem[] = choices.map((choice) => {
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
              popoverProps={{ className: "min-w-[200px] w-auto" }}
            />
          </div>
        );
      } else if (isChoiceColumn) {
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

    const effectiveLookupFoundationId = column.lookup_foundation_id || knownMapping?.foundationId;
    const effectiveDisplayColumn = column.lookup_display_column || knownMapping?.displayColumn || 'name';

    if (isLookupColumn) {
      if (effectiveLookupFoundationId) {
        const cacheKey = `${effectiveLookupFoundationId}`;
        const options = lookupOptionsCache[cacheKey] || [];
        const isLoading = lookupLoadingColumns.has(cacheKey);

        if (!lookupOptionsCache[cacheKey] && !isLoading) {
          fetchLookupOptions({
            ...column,
            lookup_foundation_id: effectiveLookupFoundationId,
            lookup_display_column: effectiveDisplayColumn,
          });
        }

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
              popoverProps={{ className: "min-w-[200px] w-auto" }}
            />
          </div>
        );
      } else {
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
  // Per GOLD_STANDARD_TABLE.md: System columns should be available for sorting
  const addSortColumn = () => {
    const availableCols = effectiveColumns.filter(c =>
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
    if (newVisible && !editColumnOrder.includes(columnName)) {
      setEditColumnOrder([...editColumnOrder, columnName]);
    }
  };

  // Toggle whether a column is included in search for this view
  const toggleColumnSearchable = (columnName: string) => {
    setEditSearchableColumns({
      ...editSearchableColumns,
      [columnName]: !editSearchableColumns[columnName],
    });
  };

  const showAllColumns = () => {
    setEditVisibleColumns(Object.fromEntries(effectiveColumns.map(c => [c.column_name, true])));
    const allColumnNames = effectiveColumns.map(c => c.column_name);
    const missingFromOrder = allColumnNames.filter(name => !editColumnOrder.includes(name));
    if (missingFromOrder.length > 0) {
      setEditColumnOrder([...editColumnOrder, ...missingFromOrder]);
    }
  };

  const hideAllColumns = () => {
    setEditVisibleColumns(Object.fromEntries(effectiveColumns.map(c => [c.column_name, c.column_name === "id"])));
  };

  // Get sorted columns for display
  const getSortedColumns = () => {
    const orderMap = new Map(editColumnOrder.map((name, idx) => [name, idx]));
    return [...effectiveColumns].sort((a, b) => {
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

    const targetIndex = Math.max(0, Math.min(newPosition - 1, visibleCols.length - 1));
    if (currentIndex === targetIndex) return;

    const newVisibleOrder = visibleCols.map(c => c.column_name);
    const [moved] = newVisibleOrder.splice(currentIndex, 1);
    newVisibleOrder.splice(targetIndex, 0, moved);

    const hiddenCols = getSortedColumns()
      .filter(col => editVisibleColumns[col.column_name] !== true)
      .map(c => c.column_name);

    setEditColumnOrder([...newVisibleOrder, ...hiddenCols]);
  };

  // Per GOLD_STANDARD_TABLE.md: System columns should be visible (but not editable)
  // Include all columns - system columns are available for filtering, sorting, grouping
  const filteredColumns = effectiveColumns;

  // Calculate smart width for a column based on priority
  const calculateSmartWidth = (col: Column): number => {
    const priority = getColumnPriority(col.column_name, col.column_type);
    const config = COLUMN_PRIORITY_CONFIG[priority];

    if (priority === 'technical') {
      return config.minWidth; // Use minimal width for technical columns
    }

    if (priority === 'essential') {
      // For essential, we'd ideally measure but for preview just use a reasonable width
      return Math.min(config.maxWidth, getDefaultColumnWidth(col) * 1.5);
    }

    // For supporting, use type-based width clamped to priority limits
    const typeWidth = getDefaultColumnWidth(col);
    return Math.max(config.minWidth, Math.min(config.maxWidth, typeWidth));
  };

  // Get default width for a column based on its type
  const getDefaultColumnWidth = (col: Column): number => {
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
      case 'color_picker': return 100;
      case 'file_upload': return 150;
      case 'gps_coordinates': return 180;
      case 'user': return 150;
      default: return 150;
    }
  };

  const handleAutoFitChange = (enabled: boolean) => {
    setEditAutoFitColumns(enabled);
    onAutoFitChange?.(enabled);
    if (enabled) {
      // Turn off smart-fit when auto-fit is enabled
      setEditSmartFit(false);
    }
    if (!enabled && Object.keys(editColumnWidths).length === 0) {
      const defaultWidths: Record<string, number> = {};
      effectiveColumns.forEach(col => {
        if (editVisibleColumns[col.column_name]) {
          defaultWidths[col.column_name] = getDefaultColumnWidth(col);
        }
      });
      setEditColumnWidths(defaultWidths);
    }
  };

  const handleSmartFitChange = (enabled: boolean) => {
    setEditSmartFit(enabled);
    if (enabled) {
      // Turn off auto-fit when smart-fit is enabled
      setEditAutoFitColumns(false);
    }
  };

  const handleShowTotalsChange = (enabled: boolean) => {
    setEditShowTotals(enabled);
    onShowTotalsChange?.(enabled);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex flex-col p-0" side="right-full" title="View Manager">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle>
                <span className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  View Manager
                </span>
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
              Create and manage saved views for this table. Global views are shared with all users.
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
                        {views.map((view, idx) => (
                          <SortableViewItem
                            key={view.id}
                            view={view}
                            isActive={activeViewId === view.id}
                            index={idx + 1}
                            onSelect={() => handleSelectView(view)}
                            onEdit={() => handleEditView(view)}
                            onDelete={() => {
                              setViewToDelete(view);
                              setShowDeleteConfirm(true);
                            }}
                            onApply={onApplyView ? () => {
                              onApplyView(view);
                              onOpenChange(false);
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
                        <div className="flex items-center gap-2 border-l pl-3">
                          <Label htmlFor="view-type-select" className="text-sm text-muted-foreground whitespace-nowrap">
                            Display as:
                          </Label>
                          <Select
                            value={editViewType}
                            onValueChange={(value: "table" | "relational") => setEditViewType(value)}
                            disabled={!isEditing}
                          >
                            <SelectTrigger id="view-type-select" className="w-[130px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="table">Table View</SelectItem>
                              <SelectItem value="relational">Relational View</SelectItem>
                            </SelectContent>
                          </Select>
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
                              <Button size="sm" onClick={async () => {
                                await handleSaveView();
                                setIsEditing(false);
                                // No delay needed - atoms apply state atomically
                                onOpenChange(false);
                              }} disabled={saving}>
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
                      {!isEditing && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/30">
                          <p className="text-muted-foreground text-sm">Click &quot;Edit View&quot; to make changes</p>
                        </div>
                      )}
                      {/* Left Side - Settings (Scrollable, fixed width) */}
                      <ScrollArea className="w-[400px] shrink-0 p-4 border-r">
                        <div className="space-y-4">
                          {/* View Filter Section */}
                          <Accordion
                            type="single"
                            collapsible
                            value={filtersExpanded ? "filters" : ""}
                            onValueChange={(v) => setFiltersExpanded(v === "filters")}
                          >
                            <AccordionItem value="filters" className="border-none">
                              <AccordionTrigger className="flex items-center gap-2 w-full text-left font-semibold text-sm hover:text-primary p-0 hover:no-underline [&>svg]:hidden">
                                {filtersExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                <Filter className="h-4 w-4" />
                                View Filter
                                {editFilters.length > 0 && (
                                  <Badge variant="secondary" className="ml-2">
                                    {editFilters.length} active
                                  </Badge>
                                )}
                              </AccordionTrigger>
                              <AccordionContent className="pt-3">
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
                                                    popoverProps={{ className: "min-w-[200px] w-auto" }}
                                                  />
                                                </div>

                                                {/* Operator Select */}
                                                <Select
                                                  value={filter.operator}
                                                  onValueChange={(v) => updateFilter(filter.id, { operator: v as CascadeFilter["operator"] })}
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
                                                    <SelectItem value="is_empty">empty</SelectItem>
                                                    <SelectItem value="is_not_empty">not empty</SelectItem>
                                                  </SelectContent>
                                                </Select>

                                                {/* Value Input */}
                                                {filter.operator !== "is_empty" && filter.operator !== "is_not_empty" && (
                                                  renderFilterValueInput(filter, effectiveColumns.find(c => c.column_name === filter.column))
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
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>

                        <Separator />

                        {/* Sort By Section */}
                        <Accordion
                          type="single"
                          collapsible
                          value={sortExpanded ? "sort" : ""}
                          onValueChange={(v) => setSortExpanded(v === "sort")}
                        >
                          <AccordionItem value="sort" className="border-none">
                            <AccordionTrigger className="flex items-center gap-2 w-full text-left font-semibold text-sm hover:text-primary p-0 hover:no-underline [&>svg]:hidden">
                              {sortExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <ArrowUpDown className="h-4 w-4" />
                              Sort By
                              {editSortColumns.length > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                  {editSortColumns.length} column{editSortColumns.length !== 1 ? "s" : ""}
                                </Badge>
                              )}
                            </AccordionTrigger>
                            <AccordionContent className="pt-3">
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
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>

                        <Separator />

                        {/* Group By Section */}
                        <Accordion
                          type="single"
                          collapsible
                          value={groupByExpanded ? "groupBy" : ""}
                          onValueChange={(v) => setGroupByExpanded(v === "groupBy")}
                        >
                          <AccordionItem value="groupBy" className="border-none">
                            <AccordionTrigger className="flex items-center gap-2 w-full text-left font-semibold text-sm hover:text-primary p-0 hover:no-underline [&>svg]:hidden">
                              {groupByExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <Columns3 className="h-4 w-4" />
                              Group By
                              {editGroupByColumns.length > 0 && (
                              <Badge variant="secondary" className="ml-2">
                                {editGroupByColumns.length} column{editGroupByColumns.length !== 1 ? "s" : ""}
                              </Badge>
                            )}
                            </AccordionTrigger>
                            <AccordionContent className="pt-3">
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
                                        const columnInfo = effectiveColumns.find(c => c.column_name === col);
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
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>

                        </div>
                      </ScrollArea>

                      {/* Right Side - Columns */}
                      <Accordion
                        type="single"
                        collapsible
                        value={columnsExpanded ? "columns" : ""}
                        onValueChange={(v) => setColumnsExpanded(v === "columns")}
                        className={cn("flex flex-col p-4 overflow-hidden border-l transition-all", columnsExpanded ? "flex-1 min-w-0" : "w-auto")}
                      >
                        <AccordionItem value="columns" className="border-none flex flex-col flex-1">
                        <div className="flex items-center justify-between mb-3 -mx-2 px-2 py-1 shrink-0">
                          <AccordionTrigger className="flex items-center gap-2 font-semibold text-sm cursor-pointer hover:bg-muted/50 px-2 py-1 rounded p-0 hover:no-underline [&>svg]:hidden">
                            {columnsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <Eye className="h-4 w-4" />
                            Columns
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {Object.values(editVisibleColumns).filter(Boolean).length}
                            </Badge>
                          </AccordionTrigger>
                          {columnsExpanded && (
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <Label htmlFor="show-totals" className="text-xs text-muted-foreground">Totals</Label>
                                <Switch
                                  id="show-totals"
                                  checked={editShowTotals}
                                  onCheckedChange={handleShowTotalsChange}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Label htmlFor="auto-fit" className="text-xs text-muted-foreground">Auto-fit</Label>
                                <Switch
                                  id="auto-fit"
                                  checked={editAutoFitColumns}
                                  onCheckedChange={handleAutoFitChange}
                                  disabled={editSmartFit}
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Label htmlFor="smart-fit" className="text-xs text-muted-foreground">
                                  TEEEM Smart
                                  <span className="ml-1 text-[10px] text-primary">(Recommended)</span>
                                </Label>
                                <Switch
                                  id="smart-fit"
                                  checked={editSmartFit}
                                  onCheckedChange={handleSmartFitChange}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        {columnsExpanded && (
                          <div className="relative mb-3 shrink-0">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              placeholder="Search columns..."
                              value={columnSearch}
                              onChange={(e) => setColumnSearch(e.target.value)}
                              className="h-8 pl-8 pr-8 text-sm"
                            />
                            {columnSearch && (
                              <button
                                type="button"
                                onClick={() => setColumnSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                        <AccordionContent className="flex-1 min-h-0 overflow-y-auto -mx-4 px-4">
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
                                      const searchLower = columnSearch.toLowerCase();
                                      const filteredVisible = columnSearch
                                        ? visibleCols.filter(col =>
                                            col.name.toLowerCase().includes(searchLower) ||
                                            col.column_name.toLowerCase().includes(searchLower)
                                          )
                                        : visibleCols;
                                      return filteredVisible.map((col) => {
                                        const originalIndex = visibleCols.findIndex(c => c.column_name === col.column_name);
                                        return (
                                          <SortableColumnItem
                                            key={col.column_name}
                                            id={col.column_name}
                                            column={col}
                                            isVisible={true}
                                            isSearchable={editSearchableColumns[col.column_name] === true}
                                            onToggleVisibility={() => toggleColumnVisibility(col.column_name)}
                                            onToggleSearchable={() => toggleColumnSearchable(col.column_name)}
                                            index={originalIndex + 1}
                                            totalVisible={visibleCols.length}
                                            onReorder={(newPos) => reorderColumnToPosition(col.column_name, newPos)}
                                            showWidthInput={!editAutoFitColumns && !editSmartFit}
                                            width={editColumnWidths[col.column_name]}
                                            onWidthChange={(w) => setEditColumnWidths(prev => ({ ...prev, [col.column_name]: w }))}
                                            smartFit={editSmartFit}
                                            priority={editSmartFit ? getColumnPriority(col.column_name, col.column_type) : undefined}
                                            smartWidth={editSmartFit ? calculateSmartWidth(col) : undefined}
                                            lookupFoundationName={col.lookup_foundation_id ? foundationNames[col.lookup_foundation_id] : undefined}
                                          />
                                        );
                                      });
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
                                  {(() => {
                                    const hiddenCols = getSortedColumns().filter(col => editVisibleColumns[col.column_name] !== true);
                                    const searchLower = columnSearch.toLowerCase();
                                    const filteredHidden = columnSearch
                                      ? sortHiddenColumnsAlphabetically(hiddenCols).filter(col =>
                                          col.name.toLowerCase().includes(searchLower) ||
                                          col.column_name.toLowerCase().includes(searchLower)
                                        )
                                      : sortHiddenColumnsAlphabetically(hiddenCols);

                                    return hiddenCols.length > 0 ? (
                                      filteredHidden.length > 0 ? (
                                        <div className="grid grid-cols-3 gap-1">
                                          {filteredHidden.map(col => (
                                            <SortableColumnItem
                                              key={col.column_name}
                                              id={col.column_name}
                                              column={col}
                                              isVisible={false}
                                              isSearchable={editSearchableColumns[col.column_name] === true}
                                              onToggleVisibility={() => toggleColumnVisibility(col.column_name)}
                                              onToggleSearchable={() => toggleColumnSearchable(col.column_name)}
                                              lookupFoundationName={col.lookup_foundation_id ? foundationNames[col.lookup_foundation_id] : undefined}
                                            />
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground italic py-2">No matching hidden columns</p>
                                      )
                                    ) : (
                                      <p className="text-xs text-muted-foreground italic py-2">No hidden columns</p>
                                    );
                                  })()}
                                </div>
                              </SortableContext>
                            </DndContext>
                        </AccordionContent>
                        </AccordionItem>
                      </Accordion>
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
