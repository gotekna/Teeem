"use client";

import * as React from "react";
import { useUrlState } from "@/hooks/useUrlState";
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
import MultipleSelector, { Option } from "@/components/ui/multiple-selector";
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
  MoreVertical,
  Tag,
  Expand,
  Minimize2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import TeeemTableView from "@/components/table/TeeemTableView";
import { GanttCanvasView } from "@/components/gantt-canvas";
import { SMGanttTab } from "./SMGanttTab";
import { RecurringTasksSection } from "./RecurringTasksSection";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Check, AlertCircle } from "lucide-react";

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

/**
 * Extract ID from lookup values that might be objects or primitives.
 * Backend may return lookup columns as {id: 123, display: "..."} or just the value.
 */
function extractLookupId(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  // If it's an object with an id property, extract the id
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (obj.id !== undefined) return String(obj.id);
    // Try other common patterns
    if (obj.value !== undefined) return String(obj.value);
    return undefined;
  }
  // If it's already a primitive, convert to string
  return String(value);
}

/**
 * Extracts the display value from a lookup column (Foundation API format).
 * Lookup columns return {id: 123, display: "Name"} format.
 */
function extractLookupDisplay(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.display === 'string') return obj.display;
    if (typeof obj.label === 'string') return obj.label;
    if (typeof obj.name === 'string') return obj.name;
  }
  return undefined;
}

interface SmScheduleMaster {
  id: number;
  task_number: number;
  name: string;
  description?: string;
  duration_days: number;
  sequence_order: number;
  predecessor_ids: Array<{ id: number; type?: string; lag?: number }>;
  trade?: string;
  stage?: string;
  trade_name?: string;  // SSoT: Resolved from Foundation SM Trades by backend
  stage_name?: string;  // SSoT: Resolved from Foundation SM Stages by backend
  assigned_role?: string | null;
  cost_centre?: string;
  header?: string | { id: number; display: string } | null;  // "Header" = this IS a header, {id,display} = parent lookup
  allow_header?: boolean;  // If true, this row can be selected as a header for other tasks
  is_active?: boolean;
  tags?: string[];
  po_required: boolean;
  critical_po?: boolean;
  create_po_on_job_start?: boolean;
  spawn_order_task?: boolean;
  spawn_call_task?: boolean;
  order_time_days?: number;
  call_time_days?: number;
  require_photo: boolean;
  pass_fail_enabled?: boolean;
  // Auto-PO configuration
  po_supplier_id?: number | null;
  po_supplier_name?: string | null;
  po_line_items?: Array<{ pricebook_item_id: number; qty: number }>;
  // Linked non-PO tasks (visibility follows this PO task)
  linked_task_ids?: number[];
  // Multi-template support
  sm_template_ids: number[];
}

interface SmScheduleMasterTemplate {
  id: number;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  row_count: number;
  rows?: SmScheduleMaster[];
  created_at: string;
  updated_at: string;
}

const VALID_SUBTABS = [
  "schedule-templates",
  "display-settings",
  "gantt-preview",
  "data-view",
  "column-reference",
  "tables",
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
  "po_required", "critical_po",
  // Auto-PO (create_po_on_job_start + po_line_items work together)
  "create_po_on_job_start", "po_line_items", "linked_po_task_id",
  "order_time_days", "call_time_days",
  // Completion Requirements
  "require_photo", "pass_fail_enabled",
  // Subtasks
  "has_subtasks", "subtask_count", "subtask_names", "linked_task_ids",
  // Documentation
  "documentation_category_ids",
  // Spawning Tasks
  "spawn_scan_task_id", "spawn_scan_lag_days", "spawn_order_task", "spawn_call_task",
  // Checklists
  "checklist_id",
  // Template Membership
  "sm_template_ids",
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

  // SSoT: URL state managed by useUrlState hook
  const [urlState, setUrlState] = useUrlState({
    subtab: null as string | null,  // null = default "schedule-templates"
    view: null as string | null,     // Foundation view filter
    table: null as string | null,    // Lookup table selection
  });

  // URL is SSoT for tab state (back button support)
  const activeTab: SubTab = VALID_SUBTABS.includes(urlState.subtab as SubTab)
    ? (urlState.subtab as SubTab)
    : "schedule-templates";

  // URL view param (Foundation view filter)
  const viewSlug = urlState.view || undefined;

  // Clear view filter from URL
  const handleViewClear = React.useCallback(() => {
    setUrlState({ view: null });
  }, [setUrlState]);

  // Update URL when tab changes
  const handleTabChange = React.useCallback((value: string) => {
    const newTab = value as SubTab;
    setUrlState({ subtab: newTab === "schedule-templates" ? null : newTab });
  }, [setUrlState]);

  // Schedule Templates state
  const [templates, setTemplates] = React.useState<SmScheduleMasterTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedTemplate, setExpandedTemplate] = React.useState<number | null>(null);
  const [showDialog, setShowDialog] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<SmScheduleMasterTemplate | null>(null);
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
  const [ganttRows, setGanttRows] = React.useState<SmScheduleMaster[]>([]);
  const [ganttFullscreen, setGanttFullscreen] = React.useState(true); // Default to fullscreen

  // Data View state
  const [dataViewTemplateId, setDataViewTemplateId] = React.useState<number | null>(null);
  const [dataViewRows, setDataViewRows] = React.useState<SmScheduleMaster[]>([]);
  const [dataViewLoading, setDataViewLoading] = React.useState(false);
  const [dataViewRefreshKey, setDataViewRefreshKey] = React.useState(0);
  const [dataViewFullscreen, setDataViewFullscreen] = React.useState(false);

  // Row Edit Sheet state
  const [showEditSheet, setShowEditSheet] = React.useState(false);
  const [editingRow, setEditingRow] = React.useState<SmScheduleMaster | null>(null);
  const [editRowForm, setEditRowForm] = React.useState<Partial<SmScheduleMaster>>({});
  const [savingRow, setSavingRow] = React.useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const initialFormLoadRef = React.useRef(true);

  // Auto-PO Configuration state
  const [showAutoPODialog, setShowAutoPODialog] = React.useState(false);
  const [suppliers, setSuppliers] = React.useState<Array<{ id: number; display_name: string }>>([]);
  const [priceHistories, setPriceHistories] = React.useState<Array<{
    id: number;
    pricebook_item_id: number;
    pricebook_item_name: string;
    pricebook_item_code: string;
    new_price: number | string;
  }>>([]);
  const [loadingSuppliers, setLoadingSuppliers] = React.useState(false);
  const [loadingPriceHistories, setLoadingPriceHistories] = React.useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = React.useState<string>("");
  const [poLineItems, setPoLineItems] = React.useState<Array<{ pricebook_item_id: number; qty: number }>>([]);
  const [savingAutoPO, setSavingAutoPO] = React.useState(false);

  // Column status tracking (persisted to localStorage)
  const [columnStatus, setColumnStatus] = React.useState<ColumnStatus>({
    complete: {},
  });

  // Job EntityTabs for photo storage dropdown
  const [jobEntityTabs, setJobEntityTabs] = React.useState<Array<{ id: number; display_name: string; tab_key: string }>>([]);

  // Lookup Tables subtab state - SSoT for which table is displayed
  // NOTE: Using foundationId (slug) only - not numericId - to avoid environment ID mismatches
  const LOOKUP_TABLES = [
    { id: "sm_trades", name: "SM Trades", description: "Trade types for schedule tasks (e.g., CARPENTER, ELECTRICIAN)" },
    { id: "sm_stages", name: "SM Stages", description: "Stage types for schedule tasks (e.g., 01 Slab, 05 Enclosed)" },
    { id: "cost_centres", name: "Cost Centres", description: "Cost centres for categorizing schedule tasks" },
  ] as const;
  type LookupTableId = typeof LOOKUP_TABLES[number]["id"];

  // URL is SSoT for table selection (enables shareable links)
  const selectedLookupTable: LookupTableId = LOOKUP_TABLES.some(t => t.id === urlState.table)
    ? (urlState.table as LookupTableId)
    : "sm_trades";

  // Update URL when table changes
  const handleTableChange = React.useCallback((tableId: LookupTableId) => {
    setUrlState({ table: tableId === "sm_trades" ? null : tableId });
  }, [setUrlState]);

  const [lookupTableRefreshKey, setLookupTableRefreshKey] = React.useState(0);

  // Tag management state
  const [availableTags, setAvailableTags] = React.useState<string[]>([]);
  const [selectedTagFilter, setSelectedTagFilter] = React.useState<string>("");
  const [showTagDialog, setShowTagDialog] = React.useState(false);
  const [newTagName, setNewTagName] = React.useState("");
  const [editingTag, setEditingTag] = React.useState<string | null>(null);
  const [editTagName, setEditTagName] = React.useState("");
  const [savingTag, setSavingTag] = React.useState(false);

  // Trade, Stage, Role, Cost Centre dropdown management
  // SSoT: Trades come from Foundation SM Trades (ID 542)
  const [availableTrades, setAvailableTrades] = React.useState<{ id: number; name: string }[]>([]);
  // SSoT: Stages come from Foundation SM Stages (ID 543)
  const [availableStages, setAvailableStages] = React.useState<{ id: number; name: string }[]>([]);
  // SSoT: Roles come from Role model (Admin > System > Company > Security > Roles)
  const [availableRoles, setAvailableRoles] = React.useState<{ id: number; name: string; display_name: string }[]>([]);
  // SSoT: Cost Centres come from Foundation Cost Centres (ID 533)
  const [availableCostCentres, setAvailableCostCentres] = React.useState<{ id: number; name: string }[]>([]);
  // SSoT: Header rows are rows with header=NULL (they ARE headers, no parent)
  const [availableHeaderRows, setAvailableHeaderRows] = React.useState<{ id: number; name: string }[]>([]);

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
    loadJobEntityTabs();
    loadTags();
    loadTrades();
    loadStages();
    loadRoles();
    loadCostCentres();
    loadHeaderRows();
  }, []);

  // Load job EntityTabs for photo storage dropdown
  const loadJobEntityTabs = async () => {
    try {
      const data = await api.get<{ success: boolean; data: { tabs: Array<{ id: number; display_name: string; tab_key: string }> } }>("/api/v1/entity_tabs?scope=job");
      if (data?.data?.tabs) {
        setJobEntityTabs(data.data.tabs);
      }
    } catch (error) {
      console.error("Failed to load job EntityTabs:", error);
    }
  };

  // Load available tags from SmSetting
  const loadTags = async () => {
    try {
      const data = await api.get<{ success: boolean; tags: string[] }>("/api/v1/sm_settings/tags");
      if (data?.tags) {
        setAvailableTags(data.tags);
      }
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  };

  // Add a new tag
  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    setSavingTag(true);
    try {
      const data = await api.post<{ success: boolean; tags: string[] }>("/api/v1/sm_settings/tags", { tag: newTagName.trim() });
      if (data?.tags) {
        setAvailableTags(data.tags);
        setNewTagName("");
        toast({ title: "Tag added", description: `"${newTagName.trim()}" has been added.` });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add tag", variant: "destructive" });
    } finally {
      setSavingTag(false);
    }
  };

  // Rename a tag
  const handleRenameTag = async () => {
    if (!editingTag || !editTagName.trim()) return;
    setSavingTag(true);
    try {
      const data = await api.patch<{ success: boolean; tags: string[] }>(`/api/v1/sm_settings/tags/${encodeURIComponent(editingTag)}`, { new_name: editTagName.trim() });
      if (data?.tags) {
        setAvailableTags(data.tags);
        // Update filter if the renamed tag was selected
        if (selectedTagFilter === editingTag) {
          setSelectedTagFilter(editTagName.trim());
        }
        setEditingTag(null);
        setEditTagName("");
        toast({ title: "Tag renamed" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to rename tag", variant: "destructive" });
    } finally {
      setSavingTag(false);
    }
  };

  // Delete a tag
  const handleDeleteTag = async (tagName: string) => {
    setSavingTag(true);
    try {
      const data = await api.delete<{ success: boolean; tags: string[] }>(`/api/v1/sm_settings/tags/${encodeURIComponent(tagName)}`);
      if (data?.tags) {
        setAvailableTags(data.tags);
        // Clear filter if the deleted tag was selected
        if (selectedTagFilter === tagName) {
          setSelectedTagFilter("");
        }
        toast({ title: "Tag deleted" });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete tag", variant: "destructive" });
    } finally {
      setSavingTag(false);
    }
  };

  // SSoT: Load trades from Foundation SM Trades (slug: sm_trades)
  const loadTrades = async () => {
    try {
      const data = await api.get<{ success: boolean; records: { id: number; name: string }[] }>("/api/v1/foundations/sm_trades/records?per_page=100");
      if (data?.records) {
        setAvailableTrades(data.records);
      }
    } catch (error) {
      console.error("Failed to load trades:", error);
    }
  };

  // SSoT: Load stages from Foundation SM Stages (slug: sm_stages)
  const loadStages = async () => {
    try {
      const data = await api.get<{ success: boolean; records: { id: number; name: string }[] }>("/api/v1/foundations/sm_stages/records?per_page=100");
      if (data?.records) {
        setAvailableStages(data.records);
      }
    } catch (error) {
      console.error("Failed to load stages:", error);
    }
  };

  // Navigate to Tables tab to add new trades/stages
  const handleNavigateToTables = () => {
    handleTabChange("tables");
  };

  // SSoT: Load roles from Foundation Role (slug: roles) - same as Admin > System > Company > Security > Roles
  const loadRoles = async () => {
    try {
      const data = await api.get<{ success: boolean; records: { id: number; name: string; display_name: string }[] }>("/api/v1/foundations/roles/records?per_page=100");
      if (data?.records) {
        setAvailableRoles(data.records.map(r => ({ id: r.id, name: r.name, display_name: r.display_name || r.name })));
      }
    } catch (error) {
      console.error("Failed to load roles:", error);
    }
  };

  // SSoT: Load cost centres from Foundation Cost Centres (slug: cost_centres)
  const loadCostCentres = async () => {
    try {
      const data = await api.get<{ success: boolean; records: { id: number; name: string }[] }>("/api/v1/foundations/cost_centres/records?per_page=100");
      if (data?.records) {
        setAvailableCostCentres(data.records);
      }
    } catch (error) {
      console.error("Failed to load cost centres:", error);
    }
  };

  // SSoT: Load header rows (rows where allow_header = true)
  const loadHeaderRows = async () => {
    try {
      // Query sm_schedule_master rows where allow_header = true (the ones that CAN be headers)
      const data = await api.get<{ success: boolean; records: { id: number; name: string }[] }>(
        "/api/v1/foundations/sm_schedule_master/records?per_page=100&filters=" + encodeURIComponent(JSON.stringify([
          { column: "allow_header", operator: "equals", value: "true" }
        ]))
      );
      if (data?.records) {
        setAvailableHeaderRows(data.records);
      }
    } catch (error) {
      console.error("Failed to load header rows:", error);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await api.get<{ success: boolean; sm_schedule_master_templates: SmScheduleMasterTemplate[] }>("/api/v1/sm_schedule_master_templates");
      const loadedTemplates = data?.sm_schedule_master_templates || [];
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

  const handleOpenEditDialog = (template: SmScheduleMasterTemplate) => {
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
        await api.patch(`/api/v1/sm_schedule_master_templates/${editingTemplate.id}`, {
          sm_schedule_master_template: formData,
        });
        toast({ title: "Success", description: "Template updated successfully" });
      } else {
        await api.post("/api/v1/sm_schedule_master_templates", {
          sm_schedule_master_template: formData,
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
      await api.post(`/api/v1/sm_schedule_master_templates/${id}/duplicate`);
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
      await api.delete(`/api/v1/sm_schedule_master_templates/${id}`);
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
      const data = await api.get<{ success: boolean; sm_schedule_master_template: SmScheduleMasterTemplate }>(`/api/v1/sm_schedule_master_templates/${id}`);
      if (data?.sm_schedule_master_template) {
        setTemplates(prev => prev.map(t =>
          t.id === id ? { ...t, rows: data.sm_schedule_master_template.rows } : t
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

  const getTotalDuration = (rows: SmScheduleMaster[]) => {
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
      const data = await api.get<{ success: boolean; rows: SmScheduleMaster[] }>(
        `/api/v1/sm_schedule_master_templates/${templateId}/rows`
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
      await api.patch(`/api/v1/sm_schedule_master_templates/${dataViewTemplateId}/rows/${rowId}`, {
        row: { [field]: value },
      });
      // SSoT: Refresh TeeemTableView (primary data display via Foundation API)
      setDataViewRefreshKey(prev => prev + 1);
      // Also refresh predecessor selector list (secondary use)
      loadDataViewRows(dataViewTemplateId);
      return { success: true };
    } catch (error) {
      console.error("Failed to update row:", error);
      return { success: false, error: "Failed to update row" };
    }
  };

  // Handle row double-click - open edit sheet
  // SSoT: Use row directly from TeeemTableView callback (Foundation API data)
  // Don't lookup from dataViewRows which comes from custom endpoint with broken lookup expansion
  const handleDataViewRowDoubleClick = (row: Record<string, unknown>) => {
    // Reset auto-save state for fresh sheet
    initialFormLoadRef.current = true;
    setAutoSaveStatus('idle');

    // Cast row from TeeemTableView - it has all the data with proper lookup expansion from Foundation API
    const fullRow = row as unknown as SmScheduleMaster;
    setEditingRow(fullRow);
    setEditRowForm({
      name: fullRow.name,
      description: fullRow.description,
      duration_days: fullRow.duration_days,
      sequence_order: fullRow.sequence_order,
      // Extract IDs from lookup columns (Foundation API returns {id: 123, display: "..."} format)
      trade: extractLookupId(fullRow.trade),
      stage: extractLookupId(fullRow.stage),
      assigned_role: extractLookupId(fullRow.assigned_role),
      cost_centre: extractLookupId(fullRow.cost_centre),
      header: extractLookupId(fullRow.header),  // Parent header row (self-reference lookup)
      po_required: fullRow.po_required,
      critical_po: fullRow.critical_po,
      create_po_on_job_start: fullRow.create_po_on_job_start,
      require_photo: fullRow.require_photo,
      pass_fail_enabled: fullRow.pass_fail_enabled,
      spawn_order_task: fullRow.spawn_order_task,
      spawn_call_task: fullRow.spawn_call_task,
      order_time_days: fullRow.order_time_days,
      call_time_days: fullRow.call_time_days,
      linked_task_ids: fullRow.linked_task_ids,
      allow_header: fullRow.allow_header,
      is_active: fullRow.is_active,
    });
    setShowEditSheet(true);
  };

  // Save row from edit sheet (supports both manual and auto-save)
  const handleSaveRow = async (options?: { silent?: boolean }) => {
    if (!editingRow || !dataViewTemplateId) return;

    const silent = options?.silent ?? false;

    if (silent) {
      setAutoSaveStatus('saving');
    } else {
      setSavingRow(true);
    }

    try {
      await api.patch(`/api/v1/sm_schedule_master_templates/${dataViewTemplateId}/rows/${editingRow.id}`, {
        row: editRowForm,
      });

      if (silent) {
        setAutoSaveStatus('saved');
        // Reset to idle after 2 seconds
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
        // SSoT: Refresh TeeemTableView (primary data display via Foundation API)
        setDataViewRefreshKey(prev => prev + 1);
        // Also refresh predecessor selector list (secondary use - still uses custom endpoint)
        loadDataViewRows(dataViewTemplateId);
      } else {
        toast({ title: "Success", description: "Row updated" });
        setShowEditSheet(false);
        // SSoT: Refresh TeeemTableView (primary data display via Foundation API)
        setDataViewRefreshKey(prev => prev + 1);
        // Also refresh predecessor selector list (secondary use)
        loadDataViewRows(dataViewTemplateId);
      }
    } catch (error) {
      console.error("Failed to save row:", error);
      if (silent) {
        setAutoSaveStatus('error');
        // Reset to idle after 3 seconds
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } else {
        toast({ title: "Error", description: "Failed to save row", variant: "destructive" });
      }
    } finally {
      if (!silent) {
        setSavingRow(false);
      }
    }
  };

  // Auto-save effect - debounced save when form changes
  React.useEffect(() => {
    // Skip auto-save on initial form load
    if (initialFormLoadRef.current) {
      initialFormLoadRef.current = false;
      return;
    }

    // Skip if sheet is not open or no row is being edited
    if (!showEditSheet || !editingRow) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer for debounced save (500ms delay)
    autoSaveTimerRef.current = setTimeout(() => {
      handleSaveRow({ silent: true });
    }, 500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editRowForm]);

  // Load suppliers for auto-PO
  const loadSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const response = await api.get<{ success: boolean; contacts: Array<{ id: number; display_name: string }> }>(
        "/api/v1/contacts?type=suppliers&limit=500"
      );
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
        pricebook_item_id: number;
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
    // Initialize from po_line_items if available
    if (editingRow.po_line_items && editingRow.po_line_items.length > 0) {
      setPoLineItems(editingRow.po_line_items);
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

  // Toggle pricebook item selection (adds with qty=1 or removes)
  const togglePricebookItemSelection = (pricebookItemId: number) => {
    setPoLineItems(prev => {
      const existing = prev.find(item => item.pricebook_item_id === pricebookItemId);
      if (existing) {
        return prev.filter(item => item.pricebook_item_id !== pricebookItemId);
      } else {
        return [...prev, { pricebook_item_id: pricebookItemId, qty: 1 }];
      }
    });
  };

  // Update quantity for a line item
  const updateLineItemQty = (pricebookItemId: number, qty: number) => {
    setPoLineItems(prev =>
      prev.map(item =>
        item.pricebook_item_id === pricebookItemId ? { ...item, qty: Math.max(1, qty) } : item
      )
    );
  };

  // Save auto-PO configuration
  const handleSaveAutoPO = async () => {
    if (!editingRow || !dataViewTemplateId) return;
    setSavingAutoPO(true);
    try {
      await api.patch(`/api/v1/sm_schedule_master_templates/${dataViewTemplateId}/rows/${editingRow.id}`, {
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
      // SSoT: Refresh TeeemTableView (primary data display via Foundation API)
      setDataViewRefreshKey(prev => prev + 1);
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
      await api.patch(`/api/v1/sm_schedule_master_templates/${dataViewTemplateId}/rows/${editingRow.id}`, {
        row: {
          create_po_on_job_start: false,
          po_supplier_id: null,
          po_line_items: [],
        },
      });
      toast({ title: "Success", description: "Auto-PO cleared" });
      setShowAutoPODialog(false);
      setEditingRow(prev => prev ? {
        ...prev,
        create_po_on_job_start: false,
        po_supplier_id: null,
        po_supplier_name: null,
        po_line_items: [],
      } : null);
      setEditRowForm(prev => ({ ...prev, create_po_on_job_start: false }));
      // SSoT: Refresh TeeemTableView (primary data display via Foundation API)
      setDataViewRefreshKey(prev => prev + 1);
      loadDataViewRows(dataViewTemplateId);
    } catch (error) {
      console.error("Failed to clear auto-PO:", error);
      toast({ title: "Error", description: "Failed to clear", variant: "destructive" });
    } finally {
      setSavingAutoPO(false);
    }
  };

  // Exit Data View fullscreen on Escape key
  React.useEffect(() => {
    if (!dataViewFullscreen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDataViewFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [dataViewFullscreen]);

  // Gantt Preview functions
  const loadGanttRows = async (templateId: number) => {
    setGanttTemplateId(templateId);
    setLoadingRows(templateId);
    try {
      const data = await api.get<{ success: boolean; rows: SmScheduleMaster[] }>(
        `/api/v1/sm_schedule_master_templates/${templateId}/rows`
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
    <div className="h-full w-full flex flex-col">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
        <TabsList className="shrink-0 mx-4">
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
          <TabsTrigger value="recurring-tasks">
            <ClipboardList className="h-4 w-4 mr-2" />
            Recurring Tasks
          </TabsTrigger>
          <TabsTrigger value="tables">
            <TableIcon className="h-4 w-4 mr-2" />
            Tables
          </TabsTrigger>
        </TabsList>

        {/* Tab content container - flex-1 to fill remaining space, relative for absolute children */}
        <div className="flex-1 min-h-0 relative mt-2">
          <TabsContent value="schedule-templates" className="absolute inset-0 overflow-auto px-4 pt-4 space-y-6 data-[state=inactive]:hidden">
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

          <TabsContent value="display-settings" className="absolute inset-0 overflow-auto px-4 pt-4 data-[state=inactive]:hidden">
          <SMGanttTab />
        </TabsContent>

          <TabsContent value="gantt-preview" className="absolute inset-0 overflow-hidden data-[state=inactive]:hidden">
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
              viewSlug={viewSlug}
              onViewClear={handleViewClear}
            />
          )}
        </TabsContent>

          {/* Data View Tab - Full TeeemTableView */}
          <TabsContent value="data-view" className="absolute inset-0 flex flex-col overflow-hidden data-[state=inactive]:hidden">
          <div className={`flex flex-col h-full ${dataViewFullscreen ? "fixed inset-0 z-50 bg-background p-4" : ""}`}>
            <TeeemTableView
              key={`${dataViewRefreshKey}-${dataViewTemplateId}-${selectedTagFilter}`}
              foundationId="sm_schedule_master"
              tableName={dataViewTemplateId
                ? templates.find(t => t.id === dataViewTemplateId)?.name || "PO Schedule Master"
                : "PO Schedule Master"
              }
              autoFetchRecords={!!dataViewTemplateId}
              initialFilters={dataViewTemplateId ? [
                { id: "template", column: "sm_template_ids", operator: "array_contains" as const, value: String(dataViewTemplateId), label: `Template: ${templates.find(t => t.id === dataViewTemplateId)?.name || 'Selected'}` },
                ...(selectedTagFilter ? [{ id: "tag", column: "tags", operator: "contains" as const, value: selectedTagFilter, label: `Tag: ${selectedTagFilter}` }] : [])
              ] : []}
              onRefresh={() => {
                setDataViewRefreshKey(prev => prev + 1);
              }}
              onRowUpdate={handleDataViewRowUpdate}
              onRowDoubleClick={handleDataViewRowDoubleClick}
              initialShowTotals={true}
              leftActions={
                <div className="flex items-center gap-2">
                  {/* Fullscreen toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDataViewFullscreen(!dataViewFullscreen)}
                    title={dataViewFullscreen ? "Exit Fullscreen (Esc)" : "Fullscreen"}
                    className="h-9 w-9"
                  >
                    {dataViewFullscreen ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
                  </Button>

                  {/* Template selector */}
                  <Select
                    value={dataViewTemplateId ? String(dataViewTemplateId) : ""}
                    onValueChange={(value) => {
                      if (value) {
                        // SSoT: Just update template ID, TeeemTableView will auto-fetch via Foundation API
                        setDataViewTemplateId(parseInt(value));
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

                  {/* Tag filter dropdown */}
                  <Select
                    value={selectedTagFilter || "__all__"}
                    onValueChange={(v) => setSelectedTagFilter(v === "__all__" ? "" : v)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <Tag className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="All Tags" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Tags</SelectItem>
                      {availableTags.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Tag management menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowTagDialog(true)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Manage Tags
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
          <TabsContent value="column-reference" className="absolute inset-0 overflow-auto p-4 data-[state=inactive]:hidden">
          <div className="space-y-8 max-w-5xl">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Schedule Master Column Reference</h2>
                  <p className="text-sm text-muted-foreground">
                    Complete documentation of all {totalColumns} columns in the sm_schedule_master table.
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
                    <span className="text-muted-foreground">The unique number shown next to each task (e.g., Task #47). Used when referencing tasks in dependencies like &quot;starts after Task 46&quot;.</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["name"] || false} onCheckedChange={(v) => updateColumnStatus("name", !!v)} />
                    <CopyableCode>name</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">The main title of the task that appears in the Gantt chart and lists (e.g., &quot;Slab Pour&quot;, &quot;Frame Inspection&quot;). Keep it short and descriptive.</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["description"] || false} onCheckedChange={(v) => updateColumnStatus("description", !!v)} />
                    <CopyableCode>description</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">text</Badge>
                    <span className="text-muted-foreground">Additional notes or instructions for this task. Use this for details like special requirements, contact numbers, or things to watch out for.</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["sequence_order"] || false} onCheckedChange={(v) => updateColumnStatus("sequence_order", !!v)} />
                    <CopyableCode>sequence_order</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">decimal</Badge>
                    <span className="text-muted-foreground">Determines where this task appears in the list. Lower numbers appear first. You can use decimals (e.g., 1.5) to insert tasks between existing ones.</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["header"] || false} onCheckedChange={(v) => updateColumnStatus("header", !!v)} />
                    <CopyableCode>header</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Set to &quot;Header&quot; to make this row a section divider (like &quot;FOUNDATION STAGE&quot;). Headers group related tasks together visually.</span>
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
                    <span className="text-muted-foreground">How many working days (Mon-Fri) this task takes to complete. Enter 1 for same-day tasks, 5 for a full week, etc. Weekends are automatically skipped.</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["predecessor_ids"] || false} onCheckedChange={(v) => updateColumnStatus("predecessor_ids", !!v)} />
                    <CopyableCode>predecessor_ids</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Links to tasks that must finish before this one can start. Format: FS (Finish-to-Start, most common), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish). Lag adds extra waiting days.</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["predecessor_ids_backup"] || false} onCheckedChange={(v) => updateColumnStatus("predecessor_ids_backup", !!v)} />
                    <CopyableCode>predecessor_ids_backup</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Stores the original dependencies when a link is broken (e.g., when a locked task can&apos;t move). Used to restore connections later if needed.</span>
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
                    <span className="text-muted-foreground">Task invisible in Gantt until PO linked; dependencies skip over it</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["critical_po"] || false} onCheckedChange={(v) => updateColumnStatus("critical_po", !!v)} />
                    <CopyableCode>critical_po</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Critical path marker - searchable/filterable in Gantt</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["create_po_on_job_start"] || false} onCheckedChange={(v) => updateColumnStatus("create_po_on_job_start", !!v)} />
                    <CopyableCode>create_po_on_job_start</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Auto-create PO when job starts</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center pl-6">
                    <Checkbox checked={columnStatus.complete["po_line_items"] || false} onCheckedChange={(v) => updateColumnStatus("po_line_items", !!v)} />
                    <CopyableCode>po_line_items</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">jsonb</Badge>
                    <span className="text-muted-foreground">↳ Line items for auto-PO: [{'{'}pricebook_item_id, qty{'}'}]</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["linked_po_task_id"] || false} onCheckedChange={(v) => updateColumnStatus("linked_po_task_id", !!v)} />
                    <CopyableCode>linked_po_task_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">Link this task&apos;s PO to another task&apos;s PO</span>
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
                    <span className="text-muted-foreground">Non-PO tasks that follow this PO task's visibility (only visible when PO task is on job)</span>
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
                    <Checkbox checked={columnStatus.complete["spawn_scan_task_id"] || false} onCheckedChange={(v) => updateColumnStatus("spawn_scan_task_id", !!v)} />
                    <CopyableCode>spawn_scan_task_id</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">bigint</Badge>
                    <span className="text-muted-foreground">Which task template to spawn for document scan</span>
                  </div>
                  <div className="grid grid-cols-[24px_auto_70px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["spawn_scan_lag_days"] || false} onCheckedChange={(v) => updateColumnStatus("spawn_scan_lag_days", !!v)} />
                    <CopyableCode>spawn_scan_lag_days</CopyableCode>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">Days after completion to schedule the scan task</span>
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

        {/* Recurring Tasks Tab */}
          <TabsContent value="recurring-tasks" className="absolute inset-0 overflow-auto px-4 pt-4 data-[state=inactive]:hidden">
          <RecurringTasksSection />
        </TabsContent>

        {/* Tables Tab - Gold Standard Table pattern for SM lookup tables */}
        <TabsContent value="tables" className="absolute inset-0 flex flex-col data-[state=inactive]:hidden">
          {/* Table selector - horizontal tabs */}
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30 shrink-0">
            {LOOKUP_TABLES.map((table) => (
              <Button
                key={table.id}
                variant={selectedLookupTable === table.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleTableChange(table.id)}
                className="gap-2"
              >
                <TableIcon className="h-4 w-4" />
                {table.name}
              </Button>
            ))}
            <div className="flex-1" />
            <p className="text-sm text-muted-foreground">
              {LOOKUP_TABLES.find(t => t.id === selectedLookupTable)?.description}
            </p>
          </div>

          {/* Full-height Gold Standard Table */}
          <div className="flex-1 min-h-0">
            {LOOKUP_TABLES.map((table) => (
              selectedLookupTable === table.id && (
                <TeeemTableView
                  key={`${table.id}-${lookupTableRefreshKey}`}
                  entries={[]}
                  foundationId={table.id}
                  tableName={table.name}
                  enableExport={true}
                  autoFetchRecords
                  onRefresh={() => setLookupTableRefreshKey(k => k + 1)}
                />
              )
            ))}
          </div>
        </TabsContent>
        </div>
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

      {/* Row Edit Sheet - Compact 2-column layout to avoid scrolling */}
      <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
        <SheetContent side="right-xl">
          <SheetHeader className="pb-2">
            <SheetTitle>Edit Row</SheetTitle>
            <SheetDescription>
              {editingRow?.name} (Task #{editingRow?.task_number})
            </SheetDescription>
          </SheetHeader>
          <div className="py-3 space-y-3">
            {/* Row 1: Name + Duration + Sequence - full width */}
            <div className="grid grid-cols-[1fr_80px_80px] gap-3">
              <div className="space-y-1">
                <Label htmlFor="row-name" className="text-xs">Name</Label>
                <Input
                  id="row-name"
                  value={editRowForm.name || ""}
                  onChange={(e) => setEditRowForm({ ...editRowForm, name: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="row-duration" className="text-xs">Days</Label>
                <Input
                  id="row-duration"
                  type="number"
                  value={editRowForm.duration_days || 0}
                  onChange={(e) => setEditRowForm({ ...editRowForm, duration_days: parseInt(e.target.value) || 0 })}
                  className="h-8"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="row-sequence" className="text-xs">Seq</Label>
                <Input
                  id="row-sequence"
                  type="number"
                  step="0.1"
                  value={editRowForm.sequence_order || 0}
                  onChange={(e) => setEditRowForm({ ...editRowForm, sequence_order: parseFloat(e.target.value) || 0 })}
                  className="h-8"
                />
              </div>
            </div>
            {/* Description - full width */}
            <div className="space-y-1">
              <Label htmlFor="row-description" className="text-xs">Description</Label>
              <Input
                id="row-description"
                value={editRowForm.description || ""}
                onChange={(e) => setEditRowForm({ ...editRowForm, description: e.target.value })}
                className="h-8"
                placeholder="Optional description..."
              />
            </div>
            {/* Two-column layout for dropdowns and settings */}
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Trade</Label>
                  <ComboboxDropdown
                    items={availableTrades.map(t => ({ id: String(t.id), label: t.name }))}
                    selectedItem={editRowForm.trade ? { id: editRowForm.trade, label: availableTrades.find(t => String(t.id) === editRowForm.trade)?.name || editingRow?.trade_name || editRowForm.trade } : undefined}
                    onSelect={(item) => setEditRowForm({ ...editRowForm, trade: item.id })}
                    placeholder="Select trade..."
                    emptyResults="No trades found"
                    clearable
                    onClear={() => setEditRowForm({ ...editRowForm, trade: "" })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Assigned Role</Label>
                  <ComboboxDropdown
                    items={availableRoles.map(r => ({ id: String(r.id), label: r.display_name }))}
                    selectedItem={editRowForm.assigned_role ? { id: editRowForm.assigned_role, label: availableRoles.find(r => String(r.id) === editRowForm.assigned_role)?.display_name || editRowForm.assigned_role } : undefined}
                    onSelect={(item) => setEditRowForm({ ...editRowForm, assigned_role: item.id })}
                    placeholder="Select role..."
                    emptyResults="No roles found"
                    clearable
                    onClear={() => setEditRowForm({ ...editRowForm, assigned_role: null })}
                  />
                </div>
                <div className="pt-2 border-t">
                  <h4 className="font-medium text-sm mb-2">PO Settings</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="row-po-required"
                        checked={editRowForm.po_required || false}
                        onCheckedChange={(checked) => {
                          if (!checked && !editRowForm.create_po_on_job_start) {
                            setEditRowForm({
                              ...editRowForm,
                              po_required: checked,
                              spawn_order_task: false,
                              spawn_call_task: false,
                              order_time_days: undefined,
                              call_time_days: undefined,
                            });
                          } else {
                            setEditRowForm({ ...editRowForm, po_required: checked });
                          }
                        }}
                      />
                      <Label htmlFor="row-po-required" className="text-xs">PO Required</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="row-critical-po"
                        checked={editRowForm.critical_po || false}
                        onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, critical_po: checked })}
                      />
                      <Label htmlFor="row-critical-po" className="text-xs">Critical PO</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="row-create-po"
                        checked={editRowForm.create_po_on_job_start || false}
                        onCheckedChange={(checked) => {
                          if (!checked && !editRowForm.po_required) {
                            setEditRowForm({
                              ...editRowForm,
                              create_po_on_job_start: checked,
                              spawn_order_task: false,
                              spawn_call_task: false,
                              order_time_days: undefined,
                              call_time_days: undefined,
                            });
                          } else {
                            setEditRowForm({ ...editRowForm, create_po_on_job_start: checked });
                          }
                          if (checked && !editingRow?.po_supplier_id) {
                            handleOpenAutoPODialog();
                          }
                        }}
                      />
                      <div className="flex items-center gap-1">
                        <Label htmlFor="row-create-po" className="text-xs">Auto-PO on Start</Label>
                        {editRowForm.create_po_on_job_start && (
                          <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={handleOpenAutoPODialog}>
                            Edit
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="row-spawn-order"
                        checked={editRowForm.spawn_order_task || false}
                        disabled={!(editRowForm.po_required || editRowForm.create_po_on_job_start)}
                        onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, spawn_order_task: checked })}
                      />
                      <Label htmlFor="row-spawn-order" className={`text-xs ${!(editRowForm.po_required || editRowForm.create_po_on_job_start) ? "text-muted-foreground" : ""}`}>
                        Spawn Order Task
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="row-spawn-call"
                        checked={editRowForm.spawn_call_task || false}
                        disabled={!(editRowForm.po_required || editRowForm.create_po_on_job_start)}
                        onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, spawn_call_task: checked })}
                      />
                      <Label htmlFor="row-spawn-call" className={`text-xs ${!(editRowForm.po_required || editRowForm.create_po_on_job_start) ? "text-muted-foreground" : ""}`}>
                        Spawn Call Task
                      </Label>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <h4 className="font-medium text-sm mb-2">Completion</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="row-require-photo"
                        checked={editRowForm.require_photo || false}
                        onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, require_photo: checked })}
                      />
                      <Label htmlFor="row-require-photo" className="text-xs">Require Photo</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="row-pass-fail"
                        checked={editRowForm.pass_fail_enabled || false}
                        onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, pass_fail_enabled: checked })}
                      />
                      <div>
                        <Label htmlFor="row-pass-fail" className="text-xs">Pass/Fail</Label>
                        <p className="text-[10px] text-muted-foreground">Spawns re-inspect if failed</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Stage</Label>
                  <ComboboxDropdown
                    items={availableStages.map(s => ({ id: String(s.id), label: s.name }))}
                    selectedItem={editRowForm.stage ? { id: editRowForm.stage, label: availableStages.find(s => String(s.id) === editRowForm.stage)?.name || editingRow?.stage_name || editRowForm.stage } : undefined}
                    onSelect={(item) => setEditRowForm({ ...editRowForm, stage: item.id })}
                    placeholder="Select stage..."
                    emptyResults="No stages found"
                    clearable
                    onClear={() => setEditRowForm({ ...editRowForm, stage: "" })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cost Centre</Label>
                  <ComboboxDropdown
                    items={availableCostCentres.map(c => ({ id: String(c.id), label: c.name }))}
                    selectedItem={editRowForm.cost_centre ? { id: editRowForm.cost_centre, label: availableCostCentres.find(c => String(c.id) === editRowForm.cost_centre)?.name || editRowForm.cost_centre } : undefined}
                    onSelect={(item) => setEditRowForm({ ...editRowForm, cost_centre: item.id })}
                    placeholder="Cost centre..."
                    emptyResults="No cost centres found"
                    clearable
                    onClear={() => setEditRowForm({ ...editRowForm, cost_centre: "" })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Header Gantt</Label>
                  <ComboboxDropdown
                    items={availableHeaderRows.map(h => ({ id: String(h.id), label: h.name }))}
                    selectedItem={(() => {
                      const headerId = extractLookupId(editRowForm.header);
                      if (!headerId || headerId === 'Header') return undefined;  // Skip if "Header" marker
                      const headerName = availableHeaderRows.find(h => String(h.id) === headerId)?.name
                        || extractLookupDisplay(editingRow?.header)
                        || headerId;
                      return { id: headerId, label: headerName };
                    })()}
                    onSelect={(item) => setEditRowForm({ ...editRowForm, header: item.id })}
                    placeholder="Select header..."
                    emptyResults="No header rows found"
                    clearable
                    onClear={() => setEditRowForm({ ...editRowForm, header: null })}
                  />
                </div>
                {/* Auto-save status indicator */}
                <div className="flex items-center text-sm pt-2">
                  {autoSaveStatus === 'saving' && (
                    <span className="flex items-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </span>
                  )}
                  {autoSaveStatus === 'saved' && (
                    <span className="flex items-center text-green-600 dark:text-green-500">
                      <Check className="h-4 w-4 mr-2" />
                      Saved
                    </span>
                  )}
                  {autoSaveStatus === 'error' && (
                    <span className="flex items-center text-red-600 dark:text-red-500">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Save failed
                    </span>
                  )}
                  {autoSaveStatus === 'idle' && (
                    <span className="text-muted-foreground">Auto-save enabled</span>
                  )}
                </div>
                {/* Allow Header */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Switch
                    id="row-allow-header"
                    checked={editRowForm.allow_header || false}
                    disabled={editRowForm.po_required || editRowForm.create_po_on_job_start}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        // Clear header field when becoming a header
                        setEditRowForm({ ...editRowForm, allow_header: checked, header: null });
                      } else {
                        setEditRowForm({ ...editRowForm, allow_header: checked });
                      }
                    }}
                  />
                  <div>
                    <Label htmlFor="row-allow-header" className={`text-xs ${(editRowForm.po_required || editRowForm.create_po_on_job_start) ? "text-muted-foreground" : ""}`}>
                      Allow Header
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Can be selected as parent for other tasks</p>
                  </div>
                  {editRowForm.allow_header && (
                    <Badge className="text-[10px] bg-blue-500">Header</Badge>
                  )}
                </div>
                {/* Active Status */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Switch
                    id="row-is-active"
                    checked={editRowForm.is_active !== false}
                    onCheckedChange={(checked) => setEditRowForm({ ...editRowForm, is_active: checked })}
                  />
                  <div>
                    <Label htmlFor="row-is-active" className="text-xs">
                      Active
                    </Label>
                    <p className="text-[10px] text-muted-foreground">Inactive tasks won't appear in new jobs</p>
                  </div>
                  {editRowForm.is_active === false && (
                    <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Linked Tasks - only shown when PO Required is on */}
            {editRowForm.po_required && (
              <div className="border-t pt-3">
                <Label className="text-xs">Linked Tasks (appear when this PO task is included)</Label>
                <MultipleSelector
                  value={(editRowForm.linked_task_ids || []).map(id => {
                    const linkedRow = dataViewRows.find(r => r.id === id);
                    return { value: String(id), label: linkedRow?.name || `Task ${id}` };
                  })}
                  onChange={(options) => {
                    setEditRowForm({
                      ...editRowForm,
                      linked_task_ids: options.map(o => parseInt(o.value))
                    });
                  }}
                  defaultOptions={dataViewRows
                    .filter(r => !r.po_required && r.id !== editingRow?.id)
                    .map(r => ({
                      value: String(r.id),
                      label: r.name
                    }))}
                  placeholder="Select tasks to link..."
                  emptyIndicator={
                    <p className="text-center text-xs text-muted-foreground">
                      No non-PO tasks available
                    </p>
                  }
                />
              </div>
            )}
          </div>
          <SheetFooter className="flex items-center justify-end">
            <Button variant="outline" onClick={() => setShowEditSheet(false)}>
              Close
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
                            const lineItem = poLineItems.find(item => item.pricebook_item_id === ph.pricebook_item_id);
                            const isSelected = !!lineItem;
                            return (
                              <TableRow
                                key={ph.id}
                                className={`cursor-pointer ${isSelected ? "bg-accent/50" : ""}`}
                                onClick={() => togglePricebookItemSelection(ph.pricebook_item_id)}
                              >
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => togglePricebookItemSelection(ph.pricebook_item_id)}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {ph.pricebook_item_code}
                                </TableCell>
                                <TableCell>{ph.pricebook_item_name}</TableCell>
                                <TableCell className="text-right">
                                  ${(Number(ph.new_price) || 0).toFixed(2)}
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  {isSelected && lineItem && (
                                    <Input
                                      type="number"
                                      min={1}
                                      value={lineItem.qty}
                                      onChange={(e) => updateLineItemQty(ph.pricebook_item_id, parseInt(e.target.value) || 1)}
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

      {/* Tag Management Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Create and manage tags for grouping schedule master tasks.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Add new tag */}
            <div className="flex gap-2">
              <Input
                placeholder="New tag name..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddTag();
                  }
                }}
              />
              <Button onClick={handleAddTag} disabled={savingTag || !newTagName.trim()}>
                {savingTag ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            {/* Tag list */}
            <div className="border rounded-md max-h-[300px] overflow-y-auto">
              {availableTags.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No tags yet. Add one above.
                </div>
              ) : (
                <div className="divide-y">
                  {availableTags.map((tag) => (
                    <div key={tag} className="flex items-center justify-between p-3">
                      {editingTag === tag ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <Input
                            value={editTagName}
                            onChange={(e) => setEditTagName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleRenameTag();
                              } else if (e.key === "Escape") {
                                setEditingTag(null);
                                setEditTagName("");
                              }
                            }}
                            className="h-8"
                            autoFocus
                          />
                          <Button size="sm" variant="ghost" onClick={handleRenameTag} disabled={savingTag}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingTag(null); setEditTagName(""); }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            <span>{tag}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingTag(tag);
                                setEditTagName(tag);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteTag(tag)}
                              disabled={savingTag}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTagDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NOTE: Trades/Stages are managed in Tables tab (SSoT: Foundation SM Trades ID 542, SM Stages ID 543) */}
      {/* NOTE: Roles are managed in Admin > System > Company > Security > Roles (SSoT) */}
    </div>
  );
}
