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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  RefreshCw,
  Download,
  CheckCircle,
  AlertTriangle,
  Info,
  Database,
  FileText,
  GitCompare,
  Plus,
  Pencil,
  Settings,
  Eye,
  EyeOff,
  GripVertical,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import TeeemTableView from "@/components/table/TeeemTableView";
import { TableColumn, TableRow as TableRowType, SavedView } from "@/components/table/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ColumnType {
  columnName: string;
  sqlType: string;
  displayType: string;
  icon: string;
  validationRules: string;
  example: string;
  usedFor: string;
  sampleValue?: string;
}

interface SyncColumn {
  column_name: string;
  display_name: string;
  column_type: string;
  trinity_sql: string;
  backend_sql: string;
  frontend_sql: string;
  actual_db_sql: string;
  status: "match" | "mismatch" | "system" | "none";
  is_system: boolean;
}

interface SyncData {
  success: boolean;
  data: SyncColumn[];
  summary: {
    total_columns: number;
    matching: number;
    mismatched: number;
    system_columns: number;
  };
}

// Sortable field item for drag and drop
interface SortableFieldItemProps {
  col: { column_name: string; name: string; column_type: string };
  isVisible: boolean;
  order: number;
  onToggleVisibility: (columnName: string) => void;
  onUpdateOrder: (columnName: string, order: number) => void;
}

function SortableFieldItem({
  col,
  isVisible,
  order,
  onToggleVisibility,
  onUpdateOrder,
}: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: col.column_name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 text-xs rounded border transition-colors",
        isVisible
          ? "bg-primary/10 border-primary/30 text-foreground"
          : "bg-background border-border text-muted-foreground",
        isDragging && "opacity-50 shadow-lg z-50 bg-background"
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
        onClick={() => onToggleVisibility(col.column_name)}
        className="flex items-center gap-2 flex-1 text-left hover:opacity-70"
      >
        {isVisible ? (
          <Eye className="h-3 w-3 flex-shrink-0" />
        ) : (
          <EyeOff className="h-3 w-3 flex-shrink-0" />
        )}
        <span className="truncate">{col.name || col.column_name}</span>
      </button>
      <input
        type="number"
        min="1"
        value={order < 100 ? order : ''}
        onChange={(e) => onUpdateOrder(col.column_name, parseInt(e.target.value) || 0)}
        className="w-10 h-6 text-center text-xs border rounded bg-background"
        onClick={(e) => {
          e.stopPropagation();
          (e.target as HTMLInputElement).select();
        }}
        onFocus={(e) => e.target.select()}
      />
    </div>
  );
}

// Gold Standard Data Tab - shows actual table records using TeeemTableView
function GoldStandardDataTab() {
  const { toast } = useToast();
  const [entries, setEntries] = React.useState<TableRowType[]>([]);
  const [columns, setColumns] = React.useState<TableColumn[]>([]);
  const [rawColumns, setRawColumns] = React.useState<Array<{
    id: number;
    column_name: string;
    name: string;
    column_type: string;
    position?: number;
    lookup_foundation_id?: number;
    lookup_display_column?: string;
    available_choices?: string[];
  }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<TableRowType | null>(null);
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  const [saving, setSaving] = React.useState(false);
  const [showMoreFields, setShowMoreFields] = React.useState(false);
  const [showFieldConfig, setShowFieldConfig] = React.useState(false);
  const [visibleFields, setVisibleFields] = React.useState<Set<string>>(new Set());
  const [fieldOrder, setFieldOrder] = React.useState<Record<string, number>>({});

  // Server search state
  const [serverSearchLoading, setServerSearchLoading] = React.useState(false);

  // Preloaded views state
  const [preloadedViews, setPreloadedViews] = React.useState<SavedView[] | null>(null);

  // View item dialog state
  const [showViewDialog, setShowViewDialog] = React.useState(false);
  const [viewingEntry, setViewingEntry] = React.useState<TableRowType | null>(null);

  // Initialize visible fields and order when columns load
  // Per GOLD_STANDARD_TABLE.md: System columns (id, created_at, updated_at) MUST be visible
  React.useEffect(() => {
    if (rawColumns.length > 0 && visibleFields.size === 0) {
      // Default: show common field types INCLUDING system columns
      const defaultVisibleTypes = ['short_text', 'long_text', 'number', 'whole_number', 'currency', 'date', 'boolean', 'email', 'dropdown', 'percentage'];
      const systemColumns = ['id', 'created_at', 'updated_at'];

      // Include ALL columns (system columns are visible but not editable)
      const allCols = rawColumns;

      const visibleCols = allCols.filter(col =>
        defaultVisibleTypes.includes(col.column_type) || systemColumns.includes(col.column_name)
      );
      const hiddenCols = allCols.filter(col =>
        !defaultVisibleTypes.includes(col.column_type) && !systemColumns.includes(col.column_name)
      );

      setVisibleFields(new Set(visibleCols.map(col => col.column_name)));

      // Initialize field order: system columns first, then visible, then hidden
      const initialOrder: Record<string, number> = {};
      let orderIdx = 1;

      // System columns get priority positions
      allCols.filter(col => systemColumns.includes(col.column_name)).forEach((col) => {
        initialOrder[col.column_name] = orderIdx++;
      });

      // Then visible non-system columns
      visibleCols.filter(col => !systemColumns.includes(col.column_name)).forEach((col) => {
        initialOrder[col.column_name] = orderIdx++;
      });

      // Hidden columns get high order numbers
      hiddenCols.forEach((col, idx) => {
        initialOrder[col.column_name] = 100 + idx;
      });
      setFieldOrder(initialOrder);
    }

  }, [rawColumns]);

  const updateFieldOrder = (columnName: string, newOrder: number) => {
    setFieldOrder(prev => {
      const updated = { ...prev };
      const oldOrder = prev[columnName] || 0;

      // Only handle conflicts for visible fields with valid order numbers
      if (newOrder > 0 && newOrder < 100 && visibleFields.has(columnName)) {
        // Find all visible fields and their current orders
        const visibleFieldOrders = rawColumns
          .filter(col =>
            !['id', 'created_at', 'updated_at'].includes(col.column_name) &&
            visibleFields.has(col.column_name) &&
            col.column_name !== columnName
          )
          .map(col => ({ name: col.column_name, order: prev[col.column_name] || 0 }))
          .filter(f => f.order > 0 && f.order < 100)
          .sort((a, b) => a.order - b.order);

        // If moving down (higher number), shift fields in between down
        // If moving up (lower number), shift fields in between up
        if (newOrder > oldOrder) {
          // Moving down: shift fields between old and new position up by 1
          visibleFieldOrders.forEach(f => {
            if (f.order > oldOrder && f.order <= newOrder) {
              updated[f.name] = f.order - 1;
            }
          });
        } else if (newOrder < oldOrder) {
          // Moving up: shift fields between new and old position down by 1
          visibleFieldOrders.forEach(f => {
            if (f.order >= newOrder && f.order < oldOrder) {
              updated[f.name] = f.order + 1;
            }
          });
        }
      }

      updated[columnName] = newOrder;
      return updated;
    });
  };

  // Get columns sorted by custom field order (visible first, then hidden)
  const getSortedColumns = () => {
    const nonSystemCols = [...rawColumns].filter(col => !['id', 'created_at', 'updated_at'].includes(col.column_name));

    // Separate visible and hidden columns
    const visibleCols = nonSystemCols.filter(col => visibleFields.has(col.column_name));
    const hiddenCols = nonSystemCols.filter(col => !visibleFields.has(col.column_name));

    // Sort visible by order, hidden by order (but they'll appear after visible)
    visibleCols.sort((a, b) => (fieldOrder[a.column_name] || 999) - (fieldOrder[b.column_name] || 999));
    hiddenCols.sort((a, b) => (fieldOrder[a.column_name] || 999) - (fieldOrder[b.column_name] || 999));

    return [...visibleCols, ...hiddenCols];
  };

  const toggleFieldVisibility = (columnName: string) => {
    setVisibleFields(prev => {
      const next = new Set(prev);
      if (next.has(columnName)) {
        // Hiding: remove from visible, renumber remaining visible fields
        next.delete(columnName);
        // Renumber visible fields sequentially
        const visibleCols = rawColumns
          .filter(col => !['id', 'created_at', 'updated_at'].includes(col.column_name) && next.has(col.column_name))
          .sort((a, b) => (fieldOrder[a.column_name] || 999) - (fieldOrder[b.column_name] || 999));
        const newOrder: Record<string, number> = {};
        visibleCols.forEach((col, idx) => {
          newOrder[col.column_name] = idx + 1;
        });
        // Hidden fields get high numbers
        rawColumns
          .filter(col => !['id', 'created_at', 'updated_at'].includes(col.column_name) && !next.has(col.column_name))
          .forEach((col, idx) => {
            newOrder[col.column_name] = 100 + idx;
          });
        setFieldOrder(newOrder);
      } else {
        // Showing: add to visible at the end
        next.add(columnName);
        // Get current max order of visible fields
        const maxOrder = Math.max(0, ...Array.from(next).map(name => fieldOrder[name] || 0));
        setFieldOrder(prev => ({
          ...prev,
          [columnName]: maxOrder + 1
        }));
      }
      return next;
    });
  };

  const showAllFields = () => {
    const nonSystemCols = rawColumns.filter(col => !['id', 'created_at', 'updated_at'].includes(col.column_name));
    setVisibleFields(new Set(nonSystemCols.map(col => col.column_name)));
    // Renumber all fields 1-N
    const newOrder: Record<string, number> = {};
    nonSystemCols.forEach((col, idx) => {
      newOrder[col.column_name] = idx + 1;
    });
    setFieldOrder(newOrder);
  };

  const hideAllFields = () => {
    setVisibleFields(new Set());
    // All fields become hidden with high numbers
    const newOrder: Record<string, number> = {};
    rawColumns
      .filter(col => !['id', 'created_at', 'updated_at'].includes(col.column_name))
      .forEach((col, idx) => {
        newOrder[col.column_name] = 100 + idx;
      });
    setFieldOrder(newOrder);
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const sortedCols = getSortedColumns();
      const oldIndex = sortedCols.findIndex(c => c.column_name === active.id);
      const newIndex = sortedCols.findIndex(c => c.column_name === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Reorder the columns
        const reorderedCols = arrayMove(sortedCols, oldIndex, newIndex);

        // Update field order - visible fields get 1-N, hidden get 100+
        const newOrder: Record<string, number> = {};
        let visibleIndex = 1;
        let hiddenIndex = 100;

        reorderedCols.forEach(col => {
          if (visibleFields.has(col.column_name)) {
            newOrder[col.column_name] = visibleIndex++;
          } else {
            newOrder[col.column_name] = hiddenIndex++;
          }
        });

        setFieldOrder(newOrder);
      }
    }
  };

  React.useEffect(() => {
    loadData();
     
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Fetch foundation (table) data including columns
      const foundationData = await api.get<{
        success: boolean;
        foundation: {
          id: number;
          name: string;
          columns: Array<{
            id: number;
            column_name: string;
            name: string;
            column_type: string;
            position?: number;
            available_choices?: string[];
          }>;
        };
      }>("/api/v1/foundations/1");

      // Fetch gold standard items
      const itemsData = await api.get<{
        success: boolean;
        items: TableRowType[];
      }>("/api/v1/gold_standard_table");

      if (foundationData?.foundation?.columns) {
        // Build columns from API response, sorted by position
        const sortedCols = [...foundationData.foundation.columns].sort(
          (a, b) => (a.position || 0) - (b.position || 0)
        );

        // Store raw columns for form building
        setRawColumns(sortedCols);

        // System columns that should not be editable
        const systemColumns = ['id', 'created_at', 'updated_at'];

        const tableColumns: TableColumn[] = [
          { key: "select", label: "", resizable: false, sortable: false, filterable: false, width: 32, editable: false },
          ...sortedCols.map((col) => ({
            key: col.column_name,
            label: col.name || col.column_name,
            column_type: col.column_type,
            id: col.id, // Include column ID for editing
            foundation_id: foundationData.foundation.id,
            choices: col.available_choices,
            resizable: true,
            sortable: true,
            filterable: true,
            width: col.column_name === 'id' ? 60 : 150,
            editable: !systemColumns.includes(col.column_name),
            system: systemColumns.includes(col.column_name),
          })),
          { key: "actions", label: "Actions", resizable: false, sortable: false, filterable: false, width: 80, editable: false },
        ];
        setColumns(tableColumns);
      }

      if (itemsData?.items) {
        setEntries(itemsData.items);
      }

      // Load views for this foundation
      try {
        const viewsData = await api.get<{
          success: boolean;
          views: SavedView[];
        }>("/api/v1/foundation_views?foundation_id=1");

        if (viewsData?.views) {
          setPreloadedViews(viewsData.views);
        }
      } catch (viewError) {
        console.warn("Failed to load views:", viewError);
        // Don't fail the whole load if views fail
      }
    } catch (error) {
      console.error("Failed to load gold standard data:", error);
      toast({
        title: "Error",
        description: "Failed to load gold standard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async (entry: TableRowType) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      await api.delete(`/api/v1/gold_standard_table/${entry.id}`);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
    } catch (error) {
      console.error("Failed to delete:", error);
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    }
  };

  // View handler - opens read-only view dialog
  const handleView = (entry: TableRowType) => {
    setViewingEntry(entry);
    setShowViewDialog(true);
  };

  // Double-click handler - opens edit dialog (same as edit)
  const handleRowDoubleClick = (entry: TableRowType) => {
    handleOpenEditDialog(entry);
  };

  // Server-side search handler
  const handleServerSearch = async (term: string, searchAllColumns: boolean) => {
    if (!term.trim()) {
      // If empty search, reload all data
      await loadData();
      return;
    }

    setServerSearchLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        items: TableRowType[];
      }>(`/api/v1/gold_standard_table?search=${encodeURIComponent(term)}&search_all=${searchAllColumns}`);

      if (response?.items) {
        setEntries(response.items);
      }
    } catch (error) {
      console.error("Server search failed:", error);
      toast({
        title: "Error",
        description: "Search failed",
        variant: "destructive",
      });
    } finally {
      setServerSearchLoading(false);
    }
  };

  const handleRowUpdate = async (id: number | string, column: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/gold_standard_table/${id}`, {
        gold_standard_table: { [column]: value },
      });
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, [column]: value } : e))
      );
    } catch (error) {
      console.error("Failed to update:", error);
      throw error;
    }
  };

  const handleOpenAddDialog = () => {
    // Initialize form with empty values for all columns
    const initialData: Record<string, unknown> = {};
    rawColumns.forEach((col) => {
      if (col.column_type === "boolean") {
        initialData[col.column_name] = false;
      } else if (col.column_type === "number" || col.column_type === "whole_number" || col.column_type === "currency" || col.column_type === "percentage") {
        initialData[col.column_name] = "";
      } else {
        initialData[col.column_name] = "";
      }
    });
    setFormData(initialData);
    setEditingEntry(null);
    setShowAddDialog(true);
  };

  const handleOpenEditDialog = (entry: TableRowType) => {
    // Initialize form with entry values
    const initialData: Record<string, unknown> = {};
    rawColumns.forEach((col) => {
      initialData[col.column_name] = entry[col.column_name] ?? "";
    });
    setFormData(initialData);
    setEditingEntry(entry);
    setShowEditDialog(true);
  };

  const handleSaveItem = async () => {
    setSaving(true);
    try {
      if (editingEntry) {
        // Update existing
        await api.patch(`/api/v1/gold_standard_table/${editingEntry.id}`, {
          gold_standard_table: formData,
        });
        setEntries((prev) =>
          prev.map((e) => (e.id === editingEntry.id ? { ...e, ...formData } : e))
        );
        toast({ title: "Success", description: "Item updated successfully" });
        setShowEditDialog(false);
      } else {
        // Create new
        const response = await api.post<{ success: boolean; item: TableRowType }>("/api/v1/gold_standard_table", {
          gold_standard_table: formData,
        });
        if (response?.success && response.item) {
          setEntries((prev) => [...prev, response.item]);
        } else {
          // Reload to get the new item
          await loadData();
        }
        toast({ title: "Success", description: "Item created successfully" });
        setShowAddDialog(false);
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast({
        title: "Error",
        description: "Failed to save item",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async (ids: (number | string)[]) => {
    console.log("[GoldStandardTab] handleBulkDelete called with ids:", ids);
    if (!confirm(`Are you sure you want to delete ${ids.length} item(s)?`)) {
      console.log("[GoldStandardTab] Delete cancelled by user");
      return;
    }
    try {
      console.log("[GoldStandardTab] Calling bulk_delete API...");
      const response = await api.post("/api/v1/gold_standard_table/bulk_delete", { ids });
      console.log("[GoldStandardTab] Bulk delete response:", response);
      setEntries((prev) => prev.filter((e) => !ids.includes(e.id)));
      toast({ title: "Success", description: `${ids.length} item(s) deleted successfully` });
    } catch (error) {
      console.error("Failed to bulk delete:", error);
      toast({
        title: "Error",
        description: "Failed to delete items",
        variant: "destructive",
      });
    }
  };

  // Render form field based on column type
  const renderFormField = (col: typeof rawColumns[0]) => {
    const value = formData[col.column_name];

    switch (col.column_type) {
      case "boolean":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={col.column_name}
              checked={value === true}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, [col.column_name]: checked === true })
              }
            />
            <Label htmlFor={col.column_name} className="cursor-pointer">
              {col.name || col.column_name}
            </Label>
          </div>
        );
      case "long_text":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.column_name}>{col.name || col.column_name}</Label>
            <textarea
              id={col.column_name}
              value={String(value || "")}
              onChange={(e) => setFormData({ ...formData, [col.column_name]: e.target.value })}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        );
      case "number":
      case "whole_number":
      case "currency":
      case "percentage":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.column_name}>{col.name || col.column_name}</Label>
            <Input
              id={col.column_name}
              type="number"
              step={col.column_type === "whole_number" ? "1" : "any"}
              value={String(value || "")}
              onChange={(e) => setFormData({ ...formData, [col.column_name]: e.target.value })}
            />
          </div>
        );
      case "date":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.column_name}>{col.name || col.column_name}</Label>
            <Input
              id={col.column_name}
              type="date"
              value={String(value || "")}
              onChange={(e) => setFormData({ ...formData, [col.column_name]: e.target.value })}
            />
          </div>
        );
      case "date_and_time":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.column_name}>{col.name || col.column_name}</Label>
            <Input
              id={col.column_name}
              type="datetime-local"
              value={String(value || "")}
              onChange={(e) => setFormData({ ...formData, [col.column_name]: e.target.value })}
            />
          </div>
        );
      case "email":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.column_name}>{col.name || col.column_name}</Label>
            <Input
              id={col.column_name}
              type="email"
              value={String(value || "")}
              onChange={(e) => setFormData({ ...formData, [col.column_name]: e.target.value })}
            />
          </div>
        );
      case "url":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.column_name}>{col.name || col.column_name}</Label>
            <Input
              id={col.column_name}
              type="url"
              value={String(value || "")}
              onChange={(e) => setFormData({ ...formData, [col.column_name]: e.target.value })}
            />
          </div>
        );
      case "color_picker":
        return (
          <div className="space-y-2">
            <Label htmlFor={col.column_name}>{col.name || col.column_name}</Label>
            <div className="flex items-center gap-2">
              <Input
                id={col.column_name}
                type="color"
                value={String(value || "#000000")}
                onChange={(e) => setFormData({ ...formData, [col.column_name]: e.target.value })}
                className="w-16 h-10 p-1"
              />
              <Input
                value={String(value || "")}
                onChange={(e) => setFormData({ ...formData, [col.column_name]: e.target.value })}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-2">
            <Label htmlFor={col.column_name}>{col.name || col.column_name}</Label>
            <Input
              id={col.column_name}
              value={String(value || "")}
              onChange={(e) => setFormData({ ...formData, [col.column_name]: e.target.value })}
            />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col -mx-4">
      <TeeemTableView
        entries={entries}
        // columns prop removed - TeeemTableView auto-fetches from Foundation API (SSoT)
        totalCount={entries.length}
        foundationId="gold-standard"
        foundationIdNumeric={1}
        tableName="Gold Standard Table"
        onView={handleView}
        onEdit={handleOpenEditDialog}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        onRowDoubleClick={handleRowDoubleClick}
        onRowUpdate={handleRowUpdate}
        onServerSearch={handleServerSearch}
        serverSearchLoading={serverSearchLoading}
        onRefresh={loadData}
        preloadedViews={preloadedViews}
        enableImport={true}
        enableExport={true}
        enableSchemaEditor={true}
        initialShowTotals={true}
        initialStickyActions={true}
        leftActions={
          <Button variant="default" size="sm" onClick={handleOpenAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        }
      />

      {/* Add Item Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) {
          setShowMoreFields(false);
          setShowFieldConfig(false);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Add New Item</DialogTitle>
                <DialogDescription>
                  Create a new gold standard item with sample data for all column types.
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFieldConfig(!showFieldConfig)}
                className="text-muted-foreground"
              >
                <Settings className="h-4 w-4 mr-1" />
                Fields
              </Button>
            </div>
          </DialogHeader>

          {/* Field Configuration Panel */}
          {showFieldConfig && (
            <div className="border rounded-md p-4 mb-4 bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Drag to reorder, or type order number</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={showAllFields} className="text-xs h-7">
                    Show All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={hideAllFields} className="text-xs h-7">
                    Hide All
                  </Button>
                </div>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={getSortedColumns().map(c => c.column_name)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
                    {getSortedColumns().map((col) => (
                      <SortableFieldItem
                        key={col.column_name}
                        col={col}
                        isVisible={visibleFields.has(col.column_name)}
                        order={fieldOrder[col.column_name] || 0}
                        onToggleVisibility={toggleFieldVisibility}
                        onUpdateOrder={updateFieldOrder}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Visible Fields */}
          <div className="grid grid-cols-2 gap-4 py-4">
            {getSortedColumns()
              .filter((col) => visibleFields.has(col.column_name))
              .map((col) => (
              <div key={col.column_name}>
                {renderFormField(col)}
              </div>
            ))}
          </div>

          {/* Hidden Fields - Accordion */}
          {getSortedColumns().filter((col) => !visibleFields.has(col.column_name)).length > 0 && (
            <Accordion
              type="single"
              collapsible
              value={showMoreFields ? "hidden-fields" : ""}
              onValueChange={(v) => setShowMoreFields(v === "hidden-fields")}
            >
              <AccordionItem value="hidden-fields" className="border-none">
                <AccordionTrigger className="text-muted-foreground hover:text-foreground py-0 hover:no-underline">
                  Hidden Fields ({getSortedColumns().filter((col) => !visibleFields.has(col.column_name)).length})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-2">
                    {getSortedColumns()
                      .filter((col) => !visibleFields.has(col.column_name))
                      .map((col) => (
                      <div key={col.column_name}>
                        {renderFormField(col)}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {visibleFields.size === 0 && !showMoreFields && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No fields visible. Click &quot;Fields&quot; to configure which fields to show.</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveItem} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Item
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) {
          setShowMoreFields(false);
          setShowFieldConfig(false);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-6">
          <DialogHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Edit Item</DialogTitle>
                <DialogDescription>
                  Update the gold standard item values.
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFieldConfig(!showFieldConfig)}
                className="text-muted-foreground"
              >
                <Settings className="h-4 w-4 mr-1" />
                Fields
              </Button>
            </div>
          </DialogHeader>

          {/* Field Configuration Panel */}
          {showFieldConfig && (
            <div className="border rounded-md p-4 mb-4 bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Drag to reorder, or type order number</span>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={showAllFields} className="text-xs h-7">
                    Show All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={hideAllFields} className="text-xs h-7">
                    Hide All
                  </Button>
                </div>
              </div>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={getSortedColumns().map(c => c.column_name)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
                    {getSortedColumns().map((col) => (
                      <SortableFieldItem
                        key={col.column_name}
                        col={col}
                        isVisible={visibleFields.has(col.column_name)}
                        order={fieldOrder[col.column_name] || 0}
                        onToggleVisibility={toggleFieldVisibility}
                        onUpdateOrder={updateFieldOrder}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Visible Fields */}
          <div className="grid grid-cols-2 gap-4 py-4">
            {getSortedColumns()
              .filter((col) => visibleFields.has(col.column_name))
              .map((col) => (
              <div key={col.column_name}>
                {renderFormField(col)}
              </div>
            ))}
          </div>

          {/* Hidden Fields - Accordion */}
          {getSortedColumns().filter((col) => !visibleFields.has(col.column_name)).length > 0 && (
            <Accordion
              type="single"
              collapsible
              value={showMoreFields ? "hidden-fields-edit" : ""}
              onValueChange={(v) => setShowMoreFields(v === "hidden-fields-edit")}
            >
              <AccordionItem value="hidden-fields-edit" className="border-none">
                <AccordionTrigger className="text-muted-foreground hover:text-foreground py-0 hover:no-underline">
                  Hidden Fields ({getSortedColumns().filter((col) => !visibleFields.has(col.column_name)).length})
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t mt-2">
                    {getSortedColumns()
                      .filter((col) => !visibleFields.has(col.column_name))
                      .map((col) => (
                      <div key={col.column_name}>
                        {renderFormField(col)}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {visibleFields.size === 0 && !showMoreFields && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No fields visible. Click &quot;Fields&quot; to configure which fields to show.</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveItem} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note: GlobalViewsManager is now handled by TeeemTableView internally when foundationIdNumeric is set */}

      {/* View Item Dialog (Read-only) */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              View Item #{viewingEntry?.id}
            </DialogTitle>
            <DialogDescription>
              Read-only view of this record
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {viewingEntry && rawColumns.map((col) => {
              const value = viewingEntry[col.column_name];
              if (value === null || value === undefined || value === '') return null;

              return (
                <div key={col.column_name} className="grid grid-cols-3 gap-4 items-start">
                  <Label className="text-sm font-medium text-muted-foreground">
                    {col.name || col.column_name}
                  </Label>
                  <div className="col-span-2 text-sm">
                    {col.column_type === 'boolean' ? (
                      <Badge variant={value ? "default" : "secondary"}>
                        {value ? "Yes" : "No"}
                      </Badge>
                    ) : col.column_type === 'date' || col.column_type === 'date_and_time' ? (
                      new Date(String(value)).toLocaleString()
                    ) : col.column_type === 'currency' ? (
                      `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                    ) : col.column_type === 'percentage' ? (
                      `${Number(value)}%`
                    ) : (
                      String(value)
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowViewDialog(false);
              if (viewingEntry) handleOpenEditDialog(viewingEntry);
            }}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Column Info Tab - shows column type reference
function GoldStandardTableTab() {
  const [columns, setColumns] = React.useState<ColumnType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dataSource, setDataSource] = React.useState("Loading...");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadColumnTypes();
  }, []);

  const loadColumnTypes = async () => {
    try {
      setLoading(true);
      const data = await api.get<{ success: boolean; data: ColumnType[]; foundation_id: number }>(
        "/api/v1/column_types"
      );

      if (data.success && data.data) {
        // Add system columns
        const systemColumns: ColumnType[] = [
          {
            columnName: "id",
            sqlType: "INTEGER",
            displayType: "ID / Primary Key",
            icon: "🔑",
            validationRules: "Auto-increment, unique, not null",
            example: "1, 2, 3, 100",
            usedFor: "Primary key for identifying records",
          },
          // Filter out system columns from API data (we add them manually above/below)
          ...data.data
            .filter((col) => !["id", "created_at", "updated_at"].includes(col.columnName))
            .map((col) => ({
              ...col,
              icon: col.icon || "📝",
            })),
          {
            columnName: "created_at",
            sqlType: "TIMESTAMP",
            displayType: "Date & Time (Created)",
            icon: "📅",
            validationRules: "Auto-populated on creation, not editable",
            example: "19/11/2024 14:30",
            usedFor: "Record creation timestamp",
          },
          {
            columnName: "updated_at",
            sqlType: "TIMESTAMP",
            displayType: "Date & Time (Updated)",
            icon: "📅",
            validationRules: "Auto-updated on any modification",
            example: "19/11/2024 16:45",
            usedFor: "Last modification timestamp",
          },
        ];

        setColumns(systemColumns);
        setDataSource(`Gold Standard Reference Table (ID: ${data.foundation_id})`);
        setError(null);
      } else {
        throw new Error("Invalid API response");
      }
    } catch (err) {
      console.error("Failed to fetch column types:", err);
      setError(err instanceof Error ? err.message : "Failed to load column types");
      setDataSource("Local Fallback (COLUMN_TYPES constant)");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Column Name", "SQL Type", "Display Type", "Validation Rules", "Example", "Used For"];
    const csvRows = [
      headers.join(","),
      ...columns.map((col) =>
        [
          col.columnName,
          `"${col.sqlType}"`,
          `"${col.displayType}"`,
          `"${col.validationRules.replace(/"/g, '""')}"`,
          `"${col.example.replace(/"/g, '""')}"`,
          `"${col.usedFor.replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gold_standard_columns.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    const data = {
      exportDate: new Date().toISOString(),
      columns: columns,
      statistics: {
        totalColumns: columns.length,
        uniqueSQLTypes: new Set(columns.map((c) => c.sqlType)).size,
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gold_standard_columns.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isSystemColumn = (name: string) => ["id", "created_at", "updated_at"].includes(name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gold Standard Column Reference</h2>
          <p className="text-sm text-muted-foreground">
            Complete reference of all column types with validation rules and usage guidelines
          </p>
          <Badge
            variant={error ? "secondary" : "default"}
            className={cn("mt-2", error ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800")}
          >
            {dataSource}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadColumnTypes}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={exportToJSON}>
            <Download className="h-4 w-4 mr-2" />
            JSON
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Columns</div>
            <div className="text-2xl font-bold">{columns.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-900/20">
          <CardContent className="pt-6">
            <div className="text-sm text-green-700 dark:text-green-400">Unique SQL Types</div>
            <div className="text-2xl font-bold text-green-800 dark:text-green-300">
              {new Set(columns.map((c) => c.sqlType)).size}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 dark:bg-purple-900/20">
          <CardContent className="pt-6">
            <div className="text-sm text-purple-700 dark:text-purple-400">Always Live</div>
            <div className="text-sm font-bold text-purple-800 dark:text-purple-300">
              Real-time from source
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Column Types Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Column Types ({columns.length})
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-3 h-3 bg-red-100 border border-red-300 rounded" />
            System-Generated Columns (Auto-managed by database)
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Column Name</TableHead>
                  <TableHead>SQL Type</TableHead>
                  <TableHead>Display Type</TableHead>
                  <TableHead>Validation Rules</TableHead>
                  <TableHead>Example</TableHead>
                  <TableHead>Used For</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {columns.map((col, index) => (
                  <TableRow
                    key={col.columnName}
                    className={cn(isSystemColumn(col.columnName) && "bg-red-50 dark:bg-red-900/10")}
                  >
                    <TableCell className="font-medium text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code
                          className={cn(
                            "text-sm font-mono font-semibold",
                            isSystemColumn(col.columnName)
                              ? "text-red-600 dark:text-red-400"
                              : "text-indigo-600 dark:text-indigo-400"
                          )}
                        >
                          {col.columnName}
                        </code>
                        {isSystemColumn(col.columnName) && <span>🔒</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "font-mono text-xs",
                          isSystemColumn(col.columnName) && "bg-red-100 text-red-700 dark:bg-red-900/30"
                        )}
                      >
                        {col.sqlType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span>{col.icon}</span>
                        <span>{col.displayType}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                      {col.validationRules}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{col.example}</code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                      {col.usedFor}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-muted/50">
        <CardContent className="flex gap-3 pt-6">
          <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Usage Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>All validation rules are enforced at the database and application level</li>
              <li>Computed fields are read-only and calculated automatically</li>
              <li>Timestamp fields (created_at, updated_at) are managed by the database</li>
              <li>Export data as CSV or JSON using the buttons above</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SyncCheckTab() {
  const [syncData, setSyncData] = React.useState<SyncData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadSyncData();
  }, []);

  const loadSyncData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<SyncData>("/api/v1/gold_table_sync");

      if (data.success) {
        setSyncData(data);
      } else {
        throw new Error("Failed to fetch sync data");
      }
    } catch (err) {
      console.error("Error fetching sync data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch sync data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200 mb-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold">Error loading sync data</span>
          </div>
          <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
          <Button variant="outline" onClick={loadSyncData}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!syncData?.data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No sync data available
      </div>
    );
  }

  const { summary } = syncData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Gold Table Sync Check</h2>
          <p className="text-sm text-muted-foreground">
            Compares column type definitions across Trinity documentation, backend code, frontend constants, and actual database schema.
          </p>
        </div>
        <Button variant="outline" onClick={loadSyncData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Total Columns</div>
            <div className="text-2xl font-bold">{summary.total_columns}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-900/20">
          <CardContent className="pt-6">
            <div className="text-sm text-green-700 dark:text-green-400">Matching</div>
            <div className="text-2xl font-bold text-green-800 dark:text-green-300 flex items-center gap-2">
              {summary.matching}
              <CheckCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="pt-6">
            <div className="text-sm text-yellow-700 dark:text-yellow-400">Mismatched</div>
            <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
              {summary.mismatched}
              <AlertTriangle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-6">
            <div className="text-sm text-red-700 dark:text-red-400">System Columns</div>
            <div className="text-2xl font-bold text-red-800 dark:text-red-300">{summary.system_columns}</div>
          </CardContent>
        </Card>
      </div>

      {/* Legend */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border border-red-300 rounded" />
              <span className="text-muted-foreground">System-generated column (id, created_at, updated_at)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border border-green-300 rounded" />
              <span className="text-muted-foreground">All sources match</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded" />
              <span className="text-muted-foreground">Sources do not match</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded" />
              <span className="text-muted-foreground">No type defined (expected for relationships)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Column Name</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Column Type</TableHead>
                  <TableHead>Trinity SQL</TableHead>
                  <TableHead>Backend SQL</TableHead>
                  <TableHead>Frontend SQL</TableHead>
                  <TableHead>Actual DB SQL</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncData.data.map((col, index) => (
                  <TableRow
                    key={index}
                    className={cn(
                      col.is_system && "bg-red-50 dark:bg-red-900/10",
                      col.status === "match" && !col.is_system && "bg-green-50 dark:bg-green-900/10",
                      col.status === "mismatch" && "bg-yellow-50 dark:bg-yellow-900/10"
                    )}
                  >
                    <TableCell className="font-medium">{col.column_name}</TableCell>
                    <TableCell>{col.display_name}</TableCell>
                    <TableCell>{col.column_type || "-"}</TableCell>
                    <TableCell>{col.trinity_sql}</TableCell>
                    <TableCell>{col.backend_sql}</TableCell>
                    <TableCell>{col.frontend_sql}</TableCell>
                    <TableCell>{col.actual_db_sql}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          col.status === "system" && "bg-red-100 text-red-800",
                          col.status === "match" && "bg-green-100 text-green-800",
                          col.status === "mismatch" && "bg-yellow-100 text-yellow-800"
                        )}
                      >
                        {col.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function GoldStandardTab() {
  return (
    <Tabs defaultValue="table" className="flex flex-col h-full">
      <TabsList className="shrink-0">
        <TabsTrigger value="table" className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          Gold Standard Table
        </TabsTrigger>
        <TabsTrigger value="column-info" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Column Info
        </TabsTrigger>
        <TabsTrigger value="sync-check" className="flex items-center gap-2">
          <GitCompare className="h-4 w-4" />
          Sync Check
        </TabsTrigger>
      </TabsList>

      <TabsContent value="table" className="flex-1 min-h-0 mt-4">
        <GoldStandardDataTab />
      </TabsContent>

      <TabsContent value="column-info" className="flex-1 min-h-0 mt-4 overflow-auto">
        <GoldStandardTableTab />
      </TabsContent>

      <TabsContent value="sync-check" className="flex-1 min-h-0 mt-4 overflow-auto">
        <SyncCheckTab />
      </TabsContent>
    </Tabs>
  );
}
