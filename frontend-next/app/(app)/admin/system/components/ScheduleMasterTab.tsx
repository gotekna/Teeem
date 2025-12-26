"use client";

import * as React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import {
  Plus,
  Loader2,
  Pencil,
  Trash2,
  Copy,
  Calendar,
  ListChecks,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  Flag,
  Camera,
  Settings,
  BarChart3,
  Table as TableIcon,
  BookOpen,
  X,
} from "lucide-react";
import TeeemTableView from "@/components/table/TeeemTableView";
import { GanttCanvasView } from "@/components/gantt-canvas";
import { SMGanttTab } from "./SMGanttTab";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Check } from "lucide-react";

// Copyable code component for column names
function CopyableCode({ children }: { children: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{children}</code>
      <button
        onClick={handleCopy}
        className="p-0.5 rounded hover:bg-muted transition-colors shrink-0"
        title="Copy column name"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        )}
      </button>
    </span>
  );
}

interface SmTemplateRow {
  id: number;
  task_number: number;
  name: string;
  description?: string;
  duration_days: number;
  sequence_order: number;
  predecessor_ids: Array<{ id: number; type?: string; lag?: number }>;
  trade?: string;
  stage?: string;
  po_required: boolean;
  critical_po?: boolean;
  create_po_on_job_start?: boolean;
  require_photo: boolean;
  require_certificate?: boolean;
  // Auto-PO configuration
  po_supplier_id?: number | null;
  po_supplier_name?: string | null;
  po_price_history_ids?: number[];
  po_line_items?: Array<{ price_history_id: number; qty: number }>;
  // Multi-template support
  sm_template_ids: number[];
}

interface SmTemplate {
  id: number;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  row_count: number;
  rows?: SmTemplateRow[];
  created_at: string;
  updated_at: string;
}

const VALID_SUBTABS = [
  "schedule-templates",
  "display-settings",
  "gantt-preview",
  "data-view",
  "column-reference",
] as const;

type SubTab = typeof VALID_SUBTABS[number];

// All columns for tracking
const ALL_COLUMNS = [
  // Core Identity
  "task_number", "name", "description", "sequence_order", "header",
  // Scheduling
  "duration_days", "predecessor_ids", "predecessor_ids_backup",
  // Locking & Status (prevents cascade, confirms completion)
  "hold", "hold_date", "hold_at", "dependency_broken",
  "confirm", "confirmed_at",
  "supplier_confirm", "supplier_confirmed_at",
  "completed", "completed_at",
  // Assignment & Supplier
  "trade", "stage", "assigned_role", "cost_centre",
  // PO Settings
  "po_required", "critical_po", "create_po_on_job_start", "linked_po_task_id",
  "price_book_item_ids", "order_time_days", "call_time_days",
  // Completion Requirements
  "require_photo", "require_certificate", "cert_lag_days", "pass_fail_enabled",
  // Subtasks
  "has_subtasks", "subtask_count", "subtask_names", "linked_task_ids", "parent_row_id",
  // Documentation
  "documentation_category_ids", "show_in_docs_tab", "start_entity_tab_ids",
  "complete_entity_tab_ids", "photo_entity_tab_id", "plan_type_ids",
  // Spawning Tasks
  "spawn_photo_task", "spawn_scan_task", "spawn_office_tasks",
  // Checklists
  "checklist_id",
  // Template Membership
  "sm_template_ids",
  // Automation & AI
  "auto_include", "allow_duplicates", "ai_select", "is_master",
  // Display
  "tags", "color", "is_active",
  // Audit
  "created_by_id", "updated_by_id", "created_at", "updated_at",
] as const;

type ColumnStatus = {
  complete: Record<string, boolean>;
};

const COLUMN_STATUS_KEY = "sm_column_status";

export function ScheduleMasterTab() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get subtab from URL, default to schedule-templates
  const subtabParam = searchParams.get("subtab");
  const initialTab: SubTab = VALID_SUBTABS.includes(subtabParam as SubTab)
    ? (subtabParam as SubTab)
    : "schedule-templates";

  const [activeTab, setActiveTab] = React.useState<SubTab>(initialTab);

  // Sync tab changes to URL
  const handleTabChange = (value: string) => {
    const newTab = value as SubTab;
    setActiveTab(newTab);

    // Update URL with new subtab
    const params = new URLSearchParams(searchParams.toString());
    params.set("subtab", newTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Schedule Templates state
  const [templates, setTemplates] = React.useState<SmTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedTemplate, setExpandedTemplate] = React.useState<number | null>(null);
  const [showDialog, setShowDialog] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<SmTemplate | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [duplicating, setDuplicating] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState<number | null>(null);
  const [loadingRows, setLoadingRows] = React.useState<number | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
  });

  // Gantt Preview state
  const [ganttTemplateId, setGanttTemplateId] = React.useState<number | null>(null);
  const [ganttRows, setGanttRows] = React.useState<SmTemplateRow[]>([]);
  const [ganttFullscreen, setGanttFullscreen] = React.useState(true); // Default to fullscreen

  // Data View state
  const [dataViewTemplateId, setDataViewTemplateId] = React.useState<number | null>(null);
  const [dataViewRows, setDataViewRows] = React.useState<SmTemplateRow[]>([]);
  const [dataViewLoading, setDataViewLoading] = React.useState(false);
  const [dataViewRefreshKey, setDataViewRefreshKey] = React.useState(0);

  // Row Edit Sheet state
  const [showEditSheet, setShowEditSheet] = React.useState(false);
  const [editingRow, setEditingRow] = React.useState<SmTemplateRow | null>(null);
  const [editRowForm, setEditRowForm] = React.useState<Partial<SmTemplateRow>>({});
  const [savingRow, setSavingRow] = React.useState(false);

  // Auto-PO Configuration state
  const [showAutoPODialog, setShowAutoPODialog] = React.useState(false);
  const [suppliers, setSuppliers] = React.useState<Array<{ id: number; display_name: string }>>([]);
  const [priceHistories, setPriceHistories] = React.useState<Array<{
    id: number;
    pricebook_item_name: string;
    pricebook_item_code: string;
    new_price: number | string;
  }>>([]);
  const [loadingSuppliers, setLoadingSuppliers] = React.useState(false);
  const [loadingPriceHistories, setLoadingPriceHistories] = React.useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string>("");
  const [poLineItems, setPoLineItems] = React.useState<Array<{ price_history_id: number; qty: number }>>([]);
  const [savingAutoPO, setSavingAutoPO] = React.useState(false);

  // Column status tracking (persisted to localStorage)
  const [columnStatus, setColumnStatus] = React.useState<ColumnStatus>({
    complete: {},
  });

  // Load column status from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem(COLUMN_STATUS_KEY);
    if (saved) {
      try {
        setColumnStatus(JSON.parse(saved));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save column status to localStorage when it changes
  const updateColumnStatus = (column: string, value: boolean) => {
    setColumnStatus((prev) => {
      const newStatus = {
        ...prev,
        complete: {
          ...prev.complete,
          [column]: value,
        },
      };
      localStorage.setItem(COLUMN_STATUS_KEY, JSON.stringify(newStatus));
      return newStatus;
    });
  };

  // Calculate stats
  const completeCount = Object.values(columnStatus.complete).filter(Boolean).length;
    const totalColumns = ALL_COLUMNS.length;

  React.useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await api.get<{ success: boolean; sm_templates: SmTemplate[] }>("/api/v1/sm_templates");
      const loadedTemplates = data?.sm_templates || [];
      setTemplates(loadedTemplates);

      // Auto-select template for Gantt Preview if not already selected
      if (!ganttTemplateId && loadedTemplates.length > 0) {
        // Try to find a template in priority order:
        // 1. "PO Schedule Master" (current default)
        // 2. Any template with "schedule master" in name
        // 3. First template in list
        const autoSelectTemplate = loadedTemplates.find(t =>
          t.name.toLowerCase() === 'po schedule master'
        ) || loadedTemplates.find(t =>
          t.name.toLowerCase().includes('schedule master')
        ) || loadedTemplates[0];

        if (autoSelectTemplate) {
          loadGanttRows(autoSelectTemplate.id);
        }
      }

      // Auto-select template for Data View (same priority as Gantt)
      if (!dataViewTemplateId && loadedTemplates.length > 0) {
        const autoSelectTemplate = loadedTemplates.find(t =>
          t.name.toLowerCase() === 'po schedule master'
        ) || loadedTemplates.find(t =>
          t.name.toLowerCase().includes('schedule master')
        ) || loadedTemplates[0];

        if (autoSelectTemplate) {
          loadDataViewRows(autoSelectTemplate.id);
        }
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setFormData({ name: "", description: "" });
    setEditingTemplate(null);
    setShowDialog(true);
  };

  const handleOpenEditDialog = (template: SmTemplate) => {
    setFormData({
      name: template.name,
      description: template.description || "",
    });
    setEditingTemplate(template);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: "Error", description: "Template name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        await api.patch(`/api/v1/sm_templates/${editingTemplate.id}`, {
          sm_template: formData,
        });
        toast({ title: "Success", description: "Template updated successfully" });
      } else {
        await api.post("/api/v1/sm_templates", {
          sm_template: formData,
        });
        toast({ title: "Success", description: "Template created successfully" });
      }
      setShowDialog(false);
      loadTemplates();
    } catch (error) {
      console.error("Failed to save template:", error);
      toast({ title: "Error", description: "Failed to save template", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    setDuplicating(id);
    try {
      await api.post(`/api/v1/sm_templates/${id}/duplicate`);
      toast({ title: "Success", description: "Template duplicated successfully" });
      loadTemplates();
    } catch (error) {
      console.error("Failed to duplicate template:", error);
      toast({ title: "Error", description: "Failed to duplicate template", variant: "destructive" });
    } finally {
      setDuplicating(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this template? This cannot be undone.")) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/sm_templates/${id}`);
      toast({ title: "Success", description: "Template archived successfully" });
      loadTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast({ title: "Error", description: "Failed to archive template", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const toggleExpand = async (id: number) => {
    if (expandedTemplate === id) {
      setExpandedTemplate(null);
      return;
    }

    // Check if we already have rows for this template
    const template = templates.find(t => t.id === id);
    if (template?.rows && template.rows.length > 0) {
      setExpandedTemplate(id);
      return;
    }

    // Fetch the template with rows
    setLoadingRows(id);
    try {
      const data = await api.get<{ success: boolean; sm_template: SmTemplate }>(`/api/v1/sm_templates/${id}`);
      if (data?.sm_template) {
        setTemplates(prev => prev.map(t =>
          t.id === id ? { ...t, rows: data.sm_template.rows } : t
        ));
      }
      setExpandedTemplate(id);
    } catch (error) {
      console.error("Failed to load template rows:", error);
      toast({ title: "Error", description: "Failed to load template details", variant: "destructive" });
    } finally {
      setLoadingRows(null);
    }
  };

  const getTotalDuration = (rows: SmTemplateRow[]) => {
    return rows.reduce((sum, row) => sum + row.duration_days, 0);
  };

  // Data View functions
  const loadDataViewRows = async (templateId: number | null) => {
    setDataViewTemplateId(templateId);
    if (!templateId) {
      setDataViewRows([]);
      return;
    }
    setDataViewLoading(true);
    try {
      const data = await api.get<{ success: boolean; rows: SmTemplateRow[] }>(
        `/api/v1/sm_templates/${templateId}/rows`
      );
      setDataViewRows(data.rows || []);
    } catch (error) {
      console.error("Failed to load data view rows:", error);
      setDataViewRows([]);
    } finally {
      setDataViewLoading(false);
    }
  };

  // Handle row update from Data View (inline editing)
  const handleDataViewRowUpdate = async (
    rowId: number | string,
    field: string,
    value: unknown
  ): Promise<{ success: boolean; error?: string }> => {
    if (!dataViewTemplateId) {
      return { success: false, error: "No template selected" };
    }
    try {
      await api.patch(`/api/v1/sm_templates/${dataViewTemplateId}/rows/${rowId}`, {
        row: { [field]: value },
      });
      // Refresh the data
      loadDataViewRows(dataViewTemplateId);
      return { success: true };
    } catch (error) {
      console.error("Failed to update row:", error);
      return { success: false, error: "Failed to update row" };
    }
  };

  // Handle row double-click - open edit sheet
  const handleDataViewRowDoubleClick = (row: Record<string, unknown>) => {
    const fullRow = dataViewRows.find(r => r.id === row.id);
    if (fullRow) {
      setEditingRow(fullRow);
      setEditRowForm({
        name: fullRow.name,
        description: fullRow.description,
        duration_days: fullRow.duration_days,
        trade: fullRow.trade,
        stage: fullRow.stage,
        po_required: fullRow.po_required,
        critical_po: fullRow.critical_po,
        create_po_on_job_start: fullRow.create_po_on_job_start,
        require_photo: fullRow.require_photo,
        require_certificate: fullRow.require_certificate,
      });
      setShowEditSheet(true);
    }
  };

  // Save row from edit sheet
  const handleSaveRow = async () => {
    if (!editingRow || !dataViewTemplateId) return;
    setSavingRow(true);
    try {
      await api.patch(`/api/v1/sm_templates/${dataViewTemplateId}/rows/${editingRow.id}`, {
        row: editRowForm,
      });
      toast({ title: "Success", description: "Row updated" });
      setShowEditSheet(false);
      loadDataViewRows(dataViewTemplateId);
    } catch (error) {
      console.error("Failed to save row:", error);
      toast({ title: "Error", description: "Failed to save row", variant: "destructive" });
    } finally {
      setSavingRow(false);
    }
  };

  // Load suppliers for auto-PO
  const loadSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      console.log("[Auto-PO] Loading suppliers...");
      const response = await api.get<{ success: boolean; contacts: Array<{ id: number; display_name: string }> }>(
        "/api/v1/contacts?type=suppliers&limit=500"
      );
      console.log("[Auto-PO] Suppliers response:", response);
      console.log("[Auto-PO] Suppliers count:", response.contacts?.length || 0);
      setSuppliers(response.contacts || []);
    } catch (error) {
      console.error("[Auto-PO] Failed to load suppliers:", error);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  // Load price histories for supplier
  const loadPriceHistoriesForSupplier = async (supplierId: string) => {
    if (!supplierId) {
      setPriceHistories([]);
      return;
    }
    setLoadingPriceHistories(true);
    try {
      const response = await api.get<{ success: boolean; data: Array<{
        id: number;
        pricebook_item_name: string;
        pricebook_item_code: string;
        new_price: number | string;
      }> }>(`/api/v1/pricebook/all_price_histories?supplier_id=${supplierId}&limit=500`);
      setPriceHistories(response.data || []);
    } catch (error) {
      console.error("Failed to load price histories:", error);
    } finally {
      setLoadingPriceHistories(false);
    }
  };

  // Open auto-PO config dialog
  const handleOpenAutoPODialog = () => {
    if (!editingRow) return;
    setSelectedSupplierId(editingRow.po_supplier_id ? String(editingRow.po_supplier_id) : "");
    // Initialize from po_line_items if available, otherwise from legacy po_price_history_ids
    if (editingRow.po_line_items && editingRow.po_line_items.length > 0) {
      setPoLineItems(editingRow.po_line_items);
    } else if (editingRow.po_price_history_ids && editingRow.po_price_history_ids.length > 0) {
      // Migrate legacy format to new format with qty=1
      setPoLineItems(editingRow.po_price_history_ids.map(id => ({ price_history_id: id, qty: 1 })));
    } else {
      setPoLineItems([]);
    }
    setPriceHistories([]);
    setShowAutoPODialog(true);
    loadSuppliers();
    if (editingRow.po_supplier_id) {
      loadPriceHistoriesForSupplier(String(editingRow.po_supplier_id));
    }
  };

  // Handle supplier change
  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    setPoLineItems([]);
    if (supplierId) {
      loadPriceHistoriesForSupplier(supplierId);
    } else {
      setPriceHistories([]);
    }
  };

  // Toggle price history selection (adds with qty=1 or removes)
  const togglePriceHistorySelection = (phId: number) => {
    setPoLineItems(prev => {
      const existing = prev.find(item => item.price_history_id === phId);
      if (existing) {
        return prev.filter(item => item.price_history_id !== phId);
      } else {
        return [...prev, { price_history_id: phId, qty: 1 }];
      }
    });
  };

  // Update quantity for a line item
  const updateLineItemQty = (phId: number, qty: number) => {
    setPoLineItems(prev =>
      prev.map(item =>
        item.price_history_id === phId ? { ...item, qty: Math.max(1, qty) } : item
      )
    );
  };

  // Save auto-PO configuration
  const handleSaveAutoPO = async () => {
    if (!editingRow || !dataViewTemplateId) return;
    setSavingAutoPO(true);
    try {
      await api.patch(`/api/v1/sm_templates/${dataViewTemplateId}/rows/${editingRow.id}`, {
        row: {
          create_po_on_job_start: true,
          po_supplier_id: selectedSupplierId ? parseInt(selectedSupplierId) : null,
          po_line_items: poLineItems,
        },
      });
      toast({ title: "Success", description: "Auto-PO configuration saved" });
      setShowAutoPODialog(false);
      // Update the editing row state
      setEditingRow(prev => prev ? {
        ...prev,
        create_po_on_job_start: true,
        po_supplier_id: selectedSupplierId ? parseInt(selectedSupplierId) : null,
        po_supplier_name: suppliers.find(s => s.id === parseInt(selectedSupplierId))?.display_name || null,
        po_line_items: poLineItems,
      } : null);
      setEditRowForm(prev => ({ ...prev, create_po_on_job_start: true }));
      loadDataViewRows(dataViewTemplateId);
    } catch (error) {
      console.error("Failed to save auto-PO:", error);
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setSavingAutoPO(false);
    }
  };

  // Clear auto-PO configuration
  const handleClearAutoPO = async () => {
    if (!editingRow || !dataViewTemplateId) return;
    setSavingAutoPO(true);
    try {
      await api.patch(`/api/v1/sm_templates/${dataViewTemplateId}/rows/${editingRow.id}`, {
        row: {
          create_po_on_job_start: false,
          po_supplier_id: null,
          po_price_history_ids: [],
        },
      });
      toast({ title: "Success", description: "Auto-PO cleared" });
      setShowAutoPODialog(false);
      setEditingRow(prev => prev ? {
        ...prev,
        create_po_on_job_start: false,
        po_supplier_id: null,
        po_supplier_name: null,
        po_price_history_ids: [],
      } : null);
      setEditRowForm(prev => ({ ...prev, create_po_on_job_start: false }));
      loadDataViewRows(dataViewTemplateId);
    } catch (error) {
      console.error("Failed to clear auto-PO:", error);
      toast({ title: "Error", description: "Failed to clear", variant: "destructive" });
    } finally {
      setSavingAutoPO(false);
    }
  };

  // Gantt Preview functions
  const loadGanttRows = async (templateId: number) => {
    setGanttTemplateId(templateId);
    setLoadingRows(templateId);
    try {
      const data = await api.get<{ success: boolean; rows: SmTemplateRow[] }>(
        `/api/v1/sm_templates/${templateId}/rows`
      );
      setGanttRows(data.rows || []);
    } catch (error) {
      console.error("Failed to load gantt rows:", error);
      setGanttRows([]);
    } finally {
      setLoadingRows(null);
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
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="schedule-templates">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Templates
          </TabsTrigger>
          <TabsTrigger value="display-settings">
            <Settings className="h-4 w-4 mr-2" />
            Display Settings
          </TabsTrigger>
          <TabsTrigger value="gantt-preview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Gantt Preview
          </TabsTrigger>
          <TabsTrigger value="data-view">
            <TableIcon className="h-4 w-4 mr-2" />
            Data View
          </TabsTrigger>
          <TabsTrigger value="column-reference">
            <BookOpen className="h-4 w-4 mr-2" />
            Column Reference
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule-templates" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Schedule Master Templates</h2>
              <p className="text-sm text-muted-foreground">
                Create and manage schedule templates for different job types.
              </p>
            </div>
            <Button onClick={handleOpenAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </div>

              {templates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No templates yet</h3>
                <p className="text-center max-w-md mb-4">
                  Create schedule templates to quickly set up task schedules for new jobs.
                </p>
                <Button onClick={handleOpenAddDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <Card key={template.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => toggleExpand(template.id)}
                      >
                        {expandedTemplate === template.id ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          {template.description && (
                            <CardDescription className="mt-1">{template.description}</CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {template.row_count || (template.rows?.length ?? 0)} tasks
                        </Badge>
                        <Badge variant="outline">
                          {getTotalDuration(template.rows || [])} days
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditDialog(template)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDuplicate(template.id)}
                          disabled={duplicating === template.id}
                        >
                          {duplicating === template.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(template.id)}
                          disabled={deleting === template.id}
                        >
                          {deleting === template.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {expandedTemplate === template.id && (
                    <CardContent>
                      {loadingRows === template.id ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <>
                          <div className="border rounded-lg divide-y">
                            {[...(template.rows || [])]
                              .sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0))
                              .map((row, index) => (
                                <div
                                  key={row.id}
                                  className="flex items-center gap-4 p-3 hover:bg-muted/50"
                                >
                                  <span className="w-6 text-center text-sm text-muted-foreground">
                                    {row.task_number || index + 1}
                                  </span>
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{row.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {row.trade && (
                                        <span className="text-xs text-muted-foreground">{row.trade}</span>
                                      )}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-xs">
                                    {row.duration_days} days
                                  </Badge>
                                  {row.po_required && (
                                    <Badge variant="outline" className="text-xs text-orange-600 dark:text-orange-400">
                                      PO
                                    </Badge>
                                  )}
                                  {row.require_photo && (
                                    <Badge variant="outline" className="text-xs text-blue-600 dark:text-blue-400">
                                      <Camera className="h-3 w-3" />
                                    </Badge>
                                  )}
                                </div>
                              ))}
                          </div>

                          <div className="mt-4 flex justify-end">
                            <Button variant="outline" size="sm" asChild>
                              <a href={`/schedule-templates/${template.id}`}>
                                <Pencil className="h-3 w-3 mr-1" />
                                Edit Rows
                              </a>
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="display-settings" className="mt-6">
          <SMGanttTab />
        </TabsContent>

        <TabsContent value="gantt-preview" className="mt-0 h-[calc(100vh-200px)]">
          {loadingRows === ganttTemplateId && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {loadingRows !== ganttTemplateId && (
            <GanttCanvasView
              templateId={ganttTemplateId ?? undefined}
              templates={templates}
              onTemplateChange={loadGanttRows}
              className="h-full"
              isFullscreen={ganttFullscreen}
              onFullscreenChange={setGanttFullscreen}
            />
          )}
        </TabsContent>

        {/* Data View Tab - Full TeeemTableView */}
        <TabsContent value="data-view" className="mt-6">
          <div className="flex flex-col h-[calc(100vh-280px)] -mx-4">
            <TeeemTableView
              key={dataViewRefreshKey}
              entries={dataViewRows as unknown as { id: number; [key: string]: unknown }[]}
              foundationId="sm_template_rows"
              foundationIdNumeric={426}
              tableName={dataViewTemplateId
                ? templates.find(t => t.id === dataViewTemplateId)?.name || "Schedule Template Rows"
                : "Schedule Template Rows"
              }
              onRefresh={() => {
                if (dataViewTemplateId) {
                  loadDataViewRows(dataViewTemplateId);
                }
                setDataViewRefreshKey(prev => prev + 1);
              }}
              onRowUpdate={handleDataViewRowUpdate}
              onRowDoubleClick={handleDataViewRowDoubleClick}
              enableExport={true}
              leftActions={
                <Select
                  value={dataViewTemplateId ? String(dataViewTemplateId) : ""}
                  onValueChange={(value) => {
                    if (value) {
                      loadDataViewRows(parseInt(value));
                    }
                  }}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select a template to view..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={String(template.id)}>
                        {template.name} ({template.row_count} rows)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            />
            {!dataViewTemplateId && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <TableIcon className="h-12 w-12 mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Select a template</h3>
                <p className="text-center max-w-md">
                  Choose a schedule template from the dropdown above to view its rows.
                </p>
              </div>
            )}
            {dataViewLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </TabsContent>

        {/* Column Reference Tab */}
        <TabsContent value="column-reference" className="mt-6">
          <div className="space-y-8 max-w-5xl">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Schedule Master Column Reference</h2>
                  <p className="text-sm text-muted-foreground">
                    Complete documentation of all {totalColumns} columns in the sm_template_rows table.
                  </p>
                </div>
                <div className="flex gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">{completeCount}</div>
                    <div className="text-muted-foreground">Complete</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{totalColumns - completeCount}</div>
                    <div className="text-muted-foreground">Remaining</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 mb-6">
                <Progress value={(completeCount / totalColumns) * 100} className="flex-1" />
                <span className="text-sm font-medium">{Math.round((completeCount / totalColumns) * 100)}%</span>
              </div>
            </div>

            {/* Core Identity */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Core Identity</CardTitle>
                <CardDescription>Basic task identification fields</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["task_number"] || false} onCheckedChange={(v) => updateColumnStatus("task_number", !!v)} />
                    <CopyableCode>task_number</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">Display number for the task (globally unique)</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["name"] || false} onCheckedChange={(v) => updateColumnStatus("name", !!v)} />
                    <CopyableCode>name</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Task name/description</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["description"] || false} onCheckedChange={(v) => updateColumnStatus("description", !!v)} />
                    <CopyableCode>description</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">text</Badge>
                    <span className="text-muted-foreground">Extended description of the task</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["sequence_order"] || false} onCheckedChange={(v) => updateColumnStatus("sequence_order", !!v)} />
                    <CopyableCode>sequence_order</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">decimal</Badge>
                    <span className="text-muted-foreground">Controls display order in the list</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["header"] || false} onCheckedChange={(v) => updateColumnStatus("header", !!v)} />
                    <CopyableCode>header</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Header vs Task - allows section grouping</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scheduling */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Scheduling</CardTitle>
                <CardDescription>Task timing and dependencies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["duration_days"] || false} onCheckedChange={(v) => updateColumnStatus("duration_days", !!v)} />
                    <CopyableCode>duration_days</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">How many working days the task takes</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["predecessor_ids"] || false} onCheckedChange={(v) => updateColumnStatus("predecessor_ids", !!v)} />
                    <CopyableCode>predecessor_ids</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Array of {`{id, type, lag}`} - defines task dependencies (FS, SS, FF, SF)</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["predecessor_ids_backup"] || false} onCheckedChange={(v) => updateColumnStatus("predecessor_ids_backup", !!v)} />
                    <CopyableCode>predecessor_ids_backup</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Backup of dependencies before they were broken</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Locking & Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Locking & Status</CardTitle>
                <CardDescription>Columns that lock/pin tasks and track completion</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["hold"] || false} onCheckedChange={(v) => updateColumnStatus("hold", !!v)} />
                    <CopyableCode>hold</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Hold</Badge>Task is pinned to hold_date</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["hold_date"] || false} onCheckedChange={(v) => updateColumnStatus("hold_date", !!v)} />
                    <CopyableCode>hold_date</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">date</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Hold Date</Badge>Fixed start date when hold=true</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["hold_at"] || false} onCheckedChange={(v) => updateColumnStatus("hold_at", !!v)} />
                    <CopyableCode>hold_at</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">datetime</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Hold At</Badge>Timestamp when hold was enabled</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["dependency_broken"] || false} onCheckedChange={(v) => updateColumnStatus("dependency_broken", !!v)} />
                    <CopyableCode>dependency_broken</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Task was detached from dependency chain</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["confirm"] || false} onCheckedChange={(v) => updateColumnStatus("confirm", !!v)} />
                    <CopyableCode>confirm</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Confirm</Badge>Supervisor sign-off (LOCKS from cascade)</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["confirmed_at"] || false} onCheckedChange={(v) => updateColumnStatus("confirmed_at", !!v)} />
                    <CopyableCode>confirmed_at</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">datetime</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Confirmed At</Badge>Timestamp when supervisor confirmed</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["supplier_confirm"] || false} onCheckedChange={(v) => updateColumnStatus("supplier_confirm", !!v)} />
                    <CopyableCode>supplier_confirm</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Supplier Confirm</Badge>Supplier confirmation (LOCKS from cascade)</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["supplier_confirmed_at"] || false} onCheckedChange={(v) => updateColumnStatus("supplier_confirmed_at", !!v)} />
                    <CopyableCode>supplier_confirmed_at</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">datetime</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Supplier Confirmed At</Badge>Timestamp when supplier confirmed</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["completed"] || false} onCheckedChange={(v) => updateColumnStatus("completed", !!v)} />
                    <CopyableCode>completed</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Completed</Badge>Task completed (LOCKS from cascade)</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["completed_at"] || false} onCheckedChange={(v) => updateColumnStatus("completed_at", !!v)} />
                    <CopyableCode>completed_at</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">date</Badge>
                    <span className="text-muted-foreground"><Badge className="text-[10px] mr-1 px-1 py-0">Completed At</Badge>Timestamp when marked complete</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assignment & Supplier */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Assignment & Supplier</CardTitle>
                <CardDescription>Who does the work</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["trade"] || false} onCheckedChange={(v) => updateColumnStatus("trade", !!v)} />
                    <CopyableCode>trade</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Trade category (Plumbing, Electrical, etc.)</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["stage"] || false} onCheckedChange={(v) => updateColumnStatus("stage", !!v)} />
                    <CopyableCode>stage</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Construction stage (Foundation, Frame, etc.)</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["assigned_role"] || false} onCheckedChange={(v) => updateColumnStatus("assigned_role", !!v)} />
                    <CopyableCode>assigned_role</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Internal role assignment (admin, site, supervisor, etc.)</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["cost_centre"] || false} onCheckedChange={(v) => updateColumnStatus("cost_centre", !!v)} />
                    <CopyableCode>cost_centre</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Cost centre for accounting</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PO Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">PO (Purchase Order) Settings</CardTitle>
                <CardDescription>Purchase order configuration</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["po_required"] || false} onCheckedChange={(v) => updateColumnStatus("po_required", !!v)} />
                    <CopyableCode>po_required</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">This task needs a PO created</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["critical_po"] || false} onCheckedChange={(v) => updateColumnStatus("critical_po", !!v)} />
                    <CopyableCode>critical_po</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">PO is critical path - high priority</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["create_po_on_job_start"] || false} onCheckedChange={(v) => updateColumnStatus("create_po_on_job_start", !!v)} />
                    <CopyableCode>create_po_on_job_start</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Auto-create PO when job starts</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["linked_po_task_id"] || false} onCheckedChange={(v) => updateColumnStatus("linked_po_task_id", !!v)} />
                    <CopyableCode>linked_po_task_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">Link this task&apos;s PO to another task&apos;s PO</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["price_book_item_ids"] || false} onCheckedChange={(v) => updateColumnStatus("price_book_item_ids", !!v)} />
                    <CopyableCode>price_book_item_ids</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer[]</Badge>
                    <span className="text-muted-foreground">Price book items to add to PO</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["order_time_days"] || false} onCheckedChange={(v) => updateColumnStatus("order_time_days", !!v)} />
                    <CopyableCode>order_time_days</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">Lead time for ordering materials</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["call_time_days"] || false} onCheckedChange={(v) => updateColumnStatus("call_time_days", !!v)} />
                    <CopyableCode>call_time_days</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">Days before to call/schedule supplier</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Completion Requirements */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Completion Requirements</CardTitle>
                <CardDescription>Evidence and documentation needed</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["require_photo"] || false} onCheckedChange={(v) => updateColumnStatus("require_photo", !!v)} />
                    <CopyableCode>require_photo</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Photo evidence needed on completion</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["require_certificate"] || false} onCheckedChange={(v) => updateColumnStatus("require_certificate", !!v)} />
                    <CopyableCode>require_certificate</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Certificate required (trades cert, inspection)</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["cert_lag_days"] || false} onCheckedChange={(v) => updateColumnStatus("cert_lag_days", !!v)} />
                    <CopyableCode>cert_lag_days</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">Days after task for cert to arrive</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["pass_fail_enabled"] || false} onCheckedChange={(v) => updateColumnStatus("pass_fail_enabled", !!v)} />
                    <CopyableCode>pass_fail_enabled</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Enable pass/fail status on task</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subtasks */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Subtasks & Linked Tasks</CardTitle>
                <CardDescription>Child tasks and task relationships</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["has_subtasks"] || false} onCheckedChange={(v) => updateColumnStatus("has_subtasks", !!v)} />
                    <CopyableCode>has_subtasks</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Task has child subtasks</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["subtask_count"] || false} onCheckedChange={(v) => updateColumnStatus("subtask_count", !!v)} />
                    <CopyableCode>subtask_count</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">Number of subtasks</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["subtask_names"] || false} onCheckedChange={(v) => updateColumnStatus("subtask_names", !!v)} />
                    <CopyableCode>subtask_names</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string[]</Badge>
                    <span className="text-muted-foreground">Names of each subtask</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["linked_task_ids"] || false} onCheckedChange={(v) => updateColumnStatus("linked_task_ids", !!v)} />
                    <CopyableCode>linked_task_ids</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Other tasks linked to this one</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["parent_row_id"] || false} onCheckedChange={(v) => updateColumnStatus("parent_row_id", !!v)} />
                    <CopyableCode>parent_row_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">Parent row for hierarchical structure</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Documentation */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Documentation</CardTitle>
                <CardDescription>Documents and photos linked to tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["documentation_category_ids"] || false} onCheckedChange={(v) => updateColumnStatus("documentation_category_ids", !!v)} />
                    <CopyableCode>documentation_category_ids</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer[]</Badge>
                    <span className="text-muted-foreground">Documentation tabs this task belongs to</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["show_in_docs_tab"] || false} onCheckedChange={(v) => updateColumnStatus("show_in_docs_tab", !!v)} />
                    <CopyableCode>show_in_docs_tab</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Show in documents tab</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["start_entity_tab_ids"] || false} onCheckedChange={(v) => updateColumnStatus("start_entity_tab_ids", !!v)} />
                    <CopyableCode>start_entity_tab_ids</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">EntityTabs for docs SENT on task START</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["complete_entity_tab_ids"] || false} onCheckedChange={(v) => updateColumnStatus("complete_entity_tab_ids", !!v)} />
                    <CopyableCode>complete_entity_tab_ids</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">EntityTabs for docs RECEIVED on COMPLETE</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["photo_entity_tab_id"] || false} onCheckedChange={(v) => updateColumnStatus("photo_entity_tab_id", !!v)} />
                    <CopyableCode>photo_entity_tab_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">EntityTab where photos are stored</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["plan_type_ids"] || false} onCheckedChange={(v) => updateColumnStatus("plan_type_ids", !!v)} />
                    <CopyableCode>plan_type_ids</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Plan types to attach to this task</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Spawning Tasks */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Spawning Tasks</CardTitle>
                <CardDescription>Auto-create related tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["spawn_photo_task"] || false} onCheckedChange={(v) => updateColumnStatus("spawn_photo_task", !!v)} />
                    <CopyableCode>spawn_photo_task</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Create a photo task when this starts</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["spawn_scan_task"] || false} onCheckedChange={(v) => updateColumnStatus("spawn_scan_task", !!v)} />
                    <CopyableCode>spawn_scan_task</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Create a document scan task</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["spawn_office_tasks"] || false} onCheckedChange={(v) => updateColumnStatus("spawn_office_tasks", !!v)} />
                    <CopyableCode>spawn_office_tasks</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Array of office tasks to spawn</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Checklists */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Checklists</CardTitle>
                <CardDescription>Supervisor checklist templates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["checklist_id"] || false} onCheckedChange={(v) => updateColumnStatus("checklist_id", !!v)} />
                    <CopyableCode>checklist_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">Supervisor checklist template to use</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Template Membership */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Template Membership</CardTitle>
                <CardDescription>Which templates include this task</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["sm_template_ids"] || false} onCheckedChange={(v) => updateColumnStatus("sm_template_ids", !!v)} />
                    <CopyableCode>sm_template_ids</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Array of template IDs this row belongs to (multi-template support)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Automation & AI */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Automation & AI</CardTitle>
                <CardDescription>Automatic task behavior</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["auto_include"] || false} onCheckedChange={(v) => updateColumnStatus("auto_include", !!v)} />
                    <CopyableCode>auto_include</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Automatically include in new jobs</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["allow_duplicates"] || false} onCheckedChange={(v) => updateColumnStatus("allow_duplicates", !!v)} />
                    <CopyableCode>allow_duplicates</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Allow multiple instances of this task</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["ai_select"] || false} onCheckedChange={(v) => updateColumnStatus("ai_select", !!v)} />
                    <CopyableCode>ai_select</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">AI can recommend/select this task</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["is_master"] || false} onCheckedChange={(v) => updateColumnStatus("is_master", !!v)} />
                    <CopyableCode>is_master</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">This is a master/template task</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Display */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Display</CardTitle>
                <CardDescription>Visual and organizational settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["tags"] || false} onCheckedChange={(v) => updateColumnStatus("tags", !!v)} />
                    <CopyableCode>tags</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string[]</Badge>
                    <span className="text-muted-foreground">Tags for filtering/grouping</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["color"] || false} onCheckedChange={(v) => updateColumnStatus("color", !!v)} />
                    <CopyableCode>color</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Custom color for Gantt bar</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["is_active"] || false} onCheckedChange={(v) => updateColumnStatus("is_active", !!v)} />
                    <CopyableCode>is_active</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Soft delete flag</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Audit */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Audit</CardTitle>
                <CardDescription>Who created/modified and when</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["created_by_id"] || false} onCheckedChange={(v) => updateColumnStatus("created_by_id", !!v)} />
                    <CopyableCode>created_by_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">User who created</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["updated_by_id"] || false} onCheckedChange={(v) => updateColumnStatus("updated_by_id", !!v)} />
                    <CopyableCode>updated_by_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">User who last updated</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["created_at"] || false} onCheckedChange={(v) => updateColumnStatus("created_at", !!v)} />
                    <CopyableCode>created_at</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">datetime</Badge>
                    <span className="text-muted-foreground">Creation timestamp</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["updated_at"] || false} onCheckedChange={(v) => updateColumnStatus("updated_at", !!v)} />
                    <CopyableCode>updated_at</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">datetime</Badge>
                    <span className="text-muted-foreground">Last update timestamp</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Schedule Template Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "New Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the schedule template details."
                : "Create a new schedule template for your jobs."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                placeholder="e.g., Standard New Build"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of this template"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingTemplate ? (
                "Update Template"
              ) : (
                "Create Template"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Row Edit Sheet */}
      <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
        <SheetContent className="w-[500px] sm:max-w-[500px]">
          <SheetHeader>
            <SheetTitle>Edit Row</SheetTitle>
            <SheetDescription>
              {editingRow?.name} (Task #{editingRow?.task_number})
            </SheetDescription>
          </SheetHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="row-name">Name</Label>
              <Input
                id="row-name"
                value={editRowForm.name || ""}
                onChange={(e) => setEditRowForm({ ...editRowForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="row-duration">Duration (days)</Label>
              <Input
                id="row-duration"
                type="number"
                value={editRowForm.duration_days || 0}
                onChange={(e) => setEditRowForm({ ...editRowForm, duration_days: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="row-trade">Trade</Label>
                <Input
                  id="row-trade"
                  value={editRowForm.trade || ""}
                  onChange={(e) => setEditRowForm({ ...editRowForm, trade: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="row-stage">Stage</Label>
                <Input
                  id="row-stage"
                  value={editRowForm.stage || ""}
                  onChange={(e) => setEditRowForm({ ...editRowForm, stage: e.target.value })}
                />
              </div>
            </div>

            {/* PO Settings */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">PO Settings</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="row-po-required">PO Required</Label>
                  <Switch
                    id="row-po-required"
                    checked={editRowForm.po_required || false}
                    onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, po_required: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="row-critical-po">Critical PO</Label>
                  <Switch
                    id="row-critical-po"
                    checked={editRowForm.critical_po || false}
                    onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, critical_po: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="row-create-po">Create PO on Job Start</Label>
                    {editingRow?.po_supplier_name && (
                      <p className="text-xs text-muted-foreground">
                        Supplier: {editingRow.po_supplier_name}
                        {editingRow.po_price_history_ids && editingRow.po_price_history_ids.length > 0 && (
                          <> · {editingRow.po_price_history_ids.length} items</>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {editRowForm.create_po_on_job_start && (
                      <Button variant="outline" size="sm" onClick={handleOpenAutoPODialog}>
                        Configure
                      </Button>
                    )}
                    <Switch
                      id="row-create-po"
                      checked={editRowForm.create_po_on_job_start || false}
                      onCheckedChange={(checked) => {
                        setEditRowForm({ ...editRowForm, create_po_on_job_start: checked });
                        if (checked && !editingRow?.po_supplier_id) {
                          handleOpenAutoPODialog();
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Completion Requirements */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Completion Requirements</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="row-require-photo">Require Photo</Label>
                  <Switch
                    id="row-require-photo"
                    checked={editRowForm.require_photo || false}
                    onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, require_photo: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="row-require-cert">Require Certificate</Label>
                  <Switch
                    id="row-require-cert"
                    checked={editRowForm.require_certificate || false}
                    onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, require_certificate: checked })}
                  />
                </div>
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setShowEditSheet(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRow} disabled={savingRow}>
              {savingRow ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Auto-PO Configuration Dialog */}
      <Dialog open={showAutoPODialog} onOpenChange={setShowAutoPODialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Configure Auto-PO</DialogTitle>
            <DialogDescription>
              Select a supplier and items to automatically create a PO when this task&apos;s job starts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Supplier Selection */}
            <div className="space-y-2">
              <Label>Supplier</Label>
              {loadingSuppliers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading suppliers...
                </div>
              ) : suppliers.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No suppliers found. Check the Contacts page to add suppliers.
                </div>
              ) : (
                <ComboboxDropdown
                  items={suppliers.map((s) => ({ id: String(s.id), label: s.display_name || `Supplier ${s.id}` }))}
                  selectedItem={selectedSupplierId ? { id: selectedSupplierId, label: suppliers.find(s => String(s.id) === selectedSupplierId)?.display_name || "" } : undefined}
                  onSelect={(item) => handleSupplierChange(item.id)}
                  placeholder="Search suppliers..."
                  emptyResults="No supplier found"
                  className="w-full"
                />
              )}
            </div>

            {/* Price History Items */}
            {selectedSupplierId && (
              <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
                <Label>Items to Include in PO</Label>
                {loadingPriceHistories ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading items...
                  </div>
                ) : priceHistories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No price history found for this supplier.
                  </p>
                ) : (
                  <div className="border rounded-md overflow-hidden flex-1 flex flex-col">
                    <div className="overflow-auto flex-1">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right w-[80px]">Price</TableHead>
                            <TableHead className="text-center w-[70px]">Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {priceHistories.map((ph) => {
                            const lineItem = poLineItems.find(item => item.price_history_id === ph.id);
                            const isSelected = !!lineItem;
                            return (
                              <TableRow
                                key={ph.id}
                                className={`cursor-pointer ${isSelected ? "bg-accent/50" : ""}`}
                                onClick={() => togglePriceHistorySelection(ph.id)}
                              >
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => togglePriceHistorySelection(ph.id)}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {ph.pricebook_item_code}
                                </TableCell>
                                <TableCell>{ph.pricebook_item_name}</TableCell>
                                <TableCell className="text-right">
                                  ${typeof ph.new_price === 'number' ? ph.new_price.toFixed(2) : (parseFloat(ph.new_price) || 0).toFixed(2)}
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  {isSelected && (
                                    <Input
                                      type="number"
                                      min={1}
                                      value={lineItem.qty}
                                      onChange={(e) => updateLineItemQty(ph.id, parseInt(e.target.value) || 1)}
                                      className="w-16 h-8 text-center"
                                    />
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    {poLineItems.length > 0 && (
                      <div className="border-t bg-muted/50 p-2 text-sm flex justify-between">
                        <span>{poLineItems.length} item{poLineItems.length !== 1 ? "s" : ""} selected</span>
                        <span className="font-medium">
                          Total Qty: {poLineItems.reduce((sum, item) => sum + item.qty, 0)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex-shrink-0">
            {editingRow?.po_supplier_id && (
              <Button variant="destructive" onClick={handleClearAutoPO} disabled={savingAutoPO}>
                Clear Auto-PO
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowAutoPODialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAutoPO}
              disabled={savingAutoPO || !selectedSupplierId}
            >
              {savingAutoPO ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Configuration"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
