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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Table,
  BookOpen,
} from "lucide-react";
import TeeemTableView from "@/components/table/TeeemTableView";
import { GanttCanvasView } from "@/components/gantt-canvas";
import { SMGanttTab } from "./SMGanttTab";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface SmTemplateRow {
  id: number;
  task_number: number;
  name: string;
  duration_days: number;
  sequence_order: number;
  predecessor_ids: Array<{ id: number; type?: string; lag?: number }>;
  trade?: string;
  stage?: string;
  supplier_id?: number;
  supplier_name?: string;
  po_required: boolean;
  require_photo: boolean;
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
  "manually_positioned", "manual_start_date", "dependency_broken",
  "require_supervisor_check", "require_supplier_confirm",
  "is_completed", "completed_at",
  // Assignment & Supplier
  "supplier_id", "trade", "stage", "assigned_role", "cost_centre",
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
  delete: Record<string, boolean>;
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

  // Column status tracking (persisted to localStorage)
  const [columnStatus, setColumnStatus] = React.useState<ColumnStatus>({
    complete: {},
    delete: {},
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
  const updateColumnStatus = (
    type: "complete" | "delete",
    column: string,
    value: boolean
  ) => {
    setColumnStatus((prev) => {
      const newStatus = {
        ...prev,
        [type]: {
          ...prev[type],
          [column]: value,
        },
      };
      localStorage.setItem(COLUMN_STATUS_KEY, JSON.stringify(newStatus));
      return newStatus;
    });
  };

  // Calculate stats
  const completeCount = Object.values(columnStatus.complete).filter(Boolean).length;
  const deleteCount = Object.values(columnStatus.delete).filter(Boolean).length;
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
            <Table className="h-4 w-4 mr-2" />
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
                                      {row.supplier_name && (
                                        <span className="text-xs text-muted-foreground">• {row.supplier_name}</span>
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
                <Table className="h-12 w-12 mb-4 opacity-50" />
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
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{deleteCount}</div>
                    <div className="text-muted-foreground">To Delete</div>
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
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center text-xs text-muted-foreground border-b pb-2 mb-1">
                    <span title="Complete">Done</span>
                    <span title="Delete" className="text-red-500">Del</span>
                    <span>Column</span>
                    <span>Type</span>
                    <span>Description</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["task_number"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "task_number", !!v)} />
                    <Checkbox checked={columnStatus.delete["task_number"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "task_number", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">task_number</code>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">Display number for the task (globally unique)</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["name"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "name", !!v)} />
                    <Checkbox checked={columnStatus.delete["name"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "name", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">name</code>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Task name/description</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["description"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "description", !!v)} />
                    <Checkbox checked={columnStatus.delete["description"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "description", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">description</code>
                    <Badge variant="outline" className="text-xs w-fit">text</Badge>
                    <span className="text-muted-foreground">Extended description of the task</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["sequence_order"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "sequence_order", !!v)} />
                    <Checkbox checked={columnStatus.delete["sequence_order"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "sequence_order", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">sequence_order</code>
                    <Badge variant="outline" className="text-xs w-fit">decimal</Badge>
                    <span className="text-muted-foreground">Controls display order in the list</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["header"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "header", !!v)} />
                    <Checkbox checked={columnStatus.delete["header"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "header", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">header</code>
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
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["duration_days"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "duration_days", !!v)} />
                    <Checkbox checked={columnStatus.delete["duration_days"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "duration_days", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">duration_days</code>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">How many working days the task takes</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["predecessor_ids"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "predecessor_ids", !!v)} />
                    <Checkbox checked={columnStatus.delete["predecessor_ids"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "predecessor_ids", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">predecessor_ids</code>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Array of {`{id, type, lag}`} - defines task dependencies (FS, SS, FF, SF)</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["predecessor_ids_backup"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "predecessor_ids_backup", !!v)} />
                    <Checkbox checked={columnStatus.delete["predecessor_ids_backup"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "predecessor_ids_backup", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">predecessor_ids_backup</code>
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
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["manually_positioned"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "manually_positioned", !!v)} />
                    <Checkbox checked={columnStatus.delete["manually_positioned"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "manually_positioned", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">manually_positioned</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Task is pinned to manual_start_date (ignores predecessors)</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["manual_start_date"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "manual_start_date", !!v)} />
                    <Checkbox checked={columnStatus.delete["manual_start_date"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "manual_start_date", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">manual_start_date</code>
                    <Badge variant="outline" className="text-xs w-fit">date</Badge>
                    <span className="text-muted-foreground">Fixed start date when manually_positioned=true</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["dependency_broken"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "dependency_broken", !!v)} />
                    <Checkbox checked={columnStatus.delete["dependency_broken"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "dependency_broken", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">dependency_broken</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Task was detached from dependency chain</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["require_supervisor_check"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "require_supervisor_check", !!v)} />
                    <Checkbox checked={columnStatus.delete["require_supervisor_check"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "require_supervisor_check", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">require_supervisor_check</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Needs supervisor sign-off (LOCKS task from cascade)</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["require_supplier_confirm"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "require_supplier_confirm", !!v)} />
                    <Checkbox checked={columnStatus.delete["require_supplier_confirm"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "require_supplier_confirm", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">require_supplier_confirm</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Needs supplier confirmation (LOCKS task from cascade)</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["is_completed"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "is_completed", !!v)} />
                    <Checkbox checked={columnStatus.delete["is_completed"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "is_completed", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">is_completed</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Task is done (LOCKS task from cascade)</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["completed_at"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "completed_at", !!v)} />
                    <Checkbox checked={columnStatus.delete["completed_at"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "completed_at", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">completed_at</code>
                    <Badge variant="outline" className="text-xs w-fit">date</Badge>
                    <span className="text-muted-foreground">When task was completed</span>
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
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["supplier_id"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "supplier_id", !!v)} />
                    <Checkbox checked={columnStatus.delete["supplier_id"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "supplier_id", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">supplier_id</code>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">Contact who does the work</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["trade"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "trade", !!v)} />
                    <Checkbox checked={columnStatus.delete["trade"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "trade", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">trade</code>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Trade category (Plumbing, Electrical, etc.)</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["stage"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "stage", !!v)} />
                    <Checkbox checked={columnStatus.delete["stage"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "stage", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">stage</code>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Construction stage (Foundation, Frame, etc.)</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["assigned_role"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "assigned_role", !!v)} />
                    <Checkbox checked={columnStatus.delete["assigned_role"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "assigned_role", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">assigned_role</code>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Internal role assignment (admin, site, supervisor, etc.)</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["cost_centre"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "cost_centre", !!v)} />
                    <Checkbox checked={columnStatus.delete["cost_centre"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "cost_centre", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">cost_centre</code>
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
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["po_required"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "po_required", !!v)} />
                    <Checkbox checked={columnStatus.delete["po_required"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "po_required", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">po_required</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">This task needs a PO created</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["critical_po"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "critical_po", !!v)} />
                    <Checkbox checked={columnStatus.delete["critical_po"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "critical_po", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">critical_po</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">PO is critical path - high priority</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["create_po_on_job_start"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "create_po_on_job_start", !!v)} />
                    <Checkbox checked={columnStatus.delete["create_po_on_job_start"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "create_po_on_job_start", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">create_po_on_job_start</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Auto-create PO when job starts</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["linked_po_task_id"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "linked_po_task_id", !!v)} />
                    <Checkbox checked={columnStatus.delete["linked_po_task_id"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "linked_po_task_id", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">linked_po_task_id</code>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">Link this task&apos;s PO to another task&apos;s PO</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["price_book_item_ids"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "price_book_item_ids", !!v)} />
                    <Checkbox checked={columnStatus.delete["price_book_item_ids"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "price_book_item_ids", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">price_book_item_ids</code>
                    <Badge variant="outline" className="text-xs w-fit">integer[]</Badge>
                    <span className="text-muted-foreground">Price book items to add to PO</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["order_time_days"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "order_time_days", !!v)} />
                    <Checkbox checked={columnStatus.delete["order_time_days"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "order_time_days", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">order_time_days</code>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">Lead time for ordering materials</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["call_time_days"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "call_time_days", !!v)} />
                    <Checkbox checked={columnStatus.delete["call_time_days"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "call_time_days", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">call_time_days</code>
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
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["require_photo"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "require_photo", !!v)} />
                    <Checkbox checked={columnStatus.delete["require_photo"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "require_photo", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">require_photo</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Photo evidence needed on completion</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["require_certificate"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "require_certificate", !!v)} />
                    <Checkbox checked={columnStatus.delete["require_certificate"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "require_certificate", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">require_certificate</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Certificate required (trades cert, inspection)</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["cert_lag_days"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "cert_lag_days", !!v)} />
                    <Checkbox checked={columnStatus.delete["cert_lag_days"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "cert_lag_days", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">cert_lag_days</code>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">Days after task for cert to arrive</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["pass_fail_enabled"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "pass_fail_enabled", !!v)} />
                    <Checkbox checked={columnStatus.delete["pass_fail_enabled"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "pass_fail_enabled", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">pass_fail_enabled</code>
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
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["has_subtasks"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "has_subtasks", !!v)} />
                    <Checkbox checked={columnStatus.delete["has_subtasks"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "has_subtasks", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">has_subtasks</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Task has child subtasks</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["subtask_count"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "subtask_count", !!v)} />
                    <Checkbox checked={columnStatus.delete["subtask_count"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "subtask_count", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">subtask_count</code>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">Number of subtasks</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["subtask_names"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "subtask_names", !!v)} />
                    <Checkbox checked={columnStatus.delete["subtask_names"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "subtask_names", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">subtask_names</code>
                    <Badge variant="outline" className="text-xs w-fit">string[]</Badge>
                    <span className="text-muted-foreground">Names of each subtask</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["linked_task_ids"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "linked_task_ids", !!v)} />
                    <Checkbox checked={columnStatus.delete["linked_task_ids"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "linked_task_ids", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">linked_task_ids</code>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Other tasks linked to this one</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["parent_row_id"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "parent_row_id", !!v)} />
                    <Checkbox checked={columnStatus.delete["parent_row_id"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "parent_row_id", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">parent_row_id</code>
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
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["documentation_category_ids"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "documentation_category_ids", !!v)} />
                    <Checkbox checked={columnStatus.delete["documentation_category_ids"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "documentation_category_ids", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">documentation_category_ids</code>
                    <Badge variant="outline" className="text-xs w-fit">integer[]</Badge>
                    <span className="text-muted-foreground">Documentation tabs this task belongs to</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["show_in_docs_tab"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "show_in_docs_tab", !!v)} />
                    <Checkbox checked={columnStatus.delete["show_in_docs_tab"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "show_in_docs_tab", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">show_in_docs_tab</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Show in documents tab</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["start_entity_tab_ids"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "start_entity_tab_ids", !!v)} />
                    <Checkbox checked={columnStatus.delete["start_entity_tab_ids"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "start_entity_tab_ids", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">start_entity_tab_ids</code>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">EntityTabs for docs SENT on task START</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["complete_entity_tab_ids"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "complete_entity_tab_ids", !!v)} />
                    <Checkbox checked={columnStatus.delete["complete_entity_tab_ids"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "complete_entity_tab_ids", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">complete_entity_tab_ids</code>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">EntityTabs for docs RECEIVED on COMPLETE</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["photo_entity_tab_id"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "photo_entity_tab_id", !!v)} />
                    <Checkbox checked={columnStatus.delete["photo_entity_tab_id"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "photo_entity_tab_id", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">photo_entity_tab_id</code>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">EntityTab where photos are stored</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["plan_type_ids"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "plan_type_ids", !!v)} />
                    <Checkbox checked={columnStatus.delete["plan_type_ids"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "plan_type_ids", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">plan_type_ids</code>
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
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["spawn_photo_task"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "spawn_photo_task", !!v)} />
                    <Checkbox checked={columnStatus.delete["spawn_photo_task"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "spawn_photo_task", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">spawn_photo_task</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Create a photo task when this starts</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["spawn_scan_task"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "spawn_scan_task", !!v)} />
                    <Checkbox checked={columnStatus.delete["spawn_scan_task"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "spawn_scan_task", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">spawn_scan_task</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Create a document scan task</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["spawn_office_tasks"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "spawn_office_tasks", !!v)} />
                    <Checkbox checked={columnStatus.delete["spawn_office_tasks"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "spawn_office_tasks", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">spawn_office_tasks</code>
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
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["checklist_id"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "checklist_id", !!v)} />
                    <Checkbox checked={columnStatus.delete["checklist_id"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "checklist_id", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">checklist_id</code>
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
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["sm_template_ids"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "sm_template_ids", !!v)} />
                    <Checkbox checked={columnStatus.delete["sm_template_ids"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "sm_template_ids", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">sm_template_ids</code>
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
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["auto_include"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "auto_include", !!v)} />
                    <Checkbox checked={columnStatus.delete["auto_include"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "auto_include", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">auto_include</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Automatically include in new jobs</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["allow_duplicates"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "allow_duplicates", !!v)} />
                    <Checkbox checked={columnStatus.delete["allow_duplicates"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "allow_duplicates", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">allow_duplicates</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Allow multiple instances of this task</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["ai_select"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "ai_select", !!v)} />
                    <Checkbox checked={columnStatus.delete["ai_select"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "ai_select", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">ai_select</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">AI can recommend/select this task</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["is_master"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "is_master", !!v)} />
                    <Checkbox checked={columnStatus.delete["is_master"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "is_master", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">is_master</code>
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
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["tags"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "tags", !!v)} />
                    <Checkbox checked={columnStatus.delete["tags"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "tags", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">tags</code>
                    <Badge variant="outline" className="text-xs w-fit">string[]</Badge>
                    <span className="text-muted-foreground">Tags for filtering/grouping</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["color"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "color", !!v)} />
                    <Checkbox checked={columnStatus.delete["color"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "color", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">color</code>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Custom color for Gantt bar</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["is_active"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "is_active", !!v)} />
                    <Checkbox checked={columnStatus.delete["is_active"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "is_active", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">is_active</code>
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
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["created_by_id"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "created_by_id", !!v)} />
                    <Checkbox checked={columnStatus.delete["created_by_id"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "created_by_id", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">created_by_id</code>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">User who created</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["updated_by_id"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "updated_by_id", !!v)} />
                    <Checkbox checked={columnStatus.delete["updated_by_id"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "updated_by_id", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">updated_by_id</code>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">User who last updated</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["created_at"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "created_at", !!v)} />
                    <Checkbox checked={columnStatus.delete["created_at"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "created_at", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">created_at</code>
                    <Badge variant="outline" className="text-xs w-fit">datetime</Badge>
                    <span className="text-muted-foreground">Creation timestamp</span>
                  </div>
                  <div className="grid grid-cols-[28px_28px_160px_80px_1fr] gap-2 items-center">
                    <Checkbox checked={columnStatus.complete["updated_at"] || false} onCheckedChange={(v) => updateColumnStatus("complete", "updated_at", !!v)} />
                    <Checkbox checked={columnStatus.delete["updated_at"] || false} onCheckedChange={(v) => updateColumnStatus("delete", "updated_at", !!v)} className="data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" />
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded w-fit">updated_at</code>
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
    </div>
  );
}
