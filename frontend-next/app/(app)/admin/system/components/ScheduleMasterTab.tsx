"use client";

import * as React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  start_day_offset: number;
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

interface TaskTemplate {
  id: number;
  name: string;
  task_type: string;
  category: string;
  default_duration_days: number;
  description: string | null;
  is_milestone: boolean;
  requires_photo: boolean;
  sequence_order: number;
  is_standard: boolean;
  predecessor_template_codes: string[];
  created_at: string;
  updated_at: string;
}

const TASK_CATEGORIES = [
  "Site Works",
  "Foundation",
  "Frame",
  "Roof",
  "Lock Up",
  "Fit Out",
  "Services",
  "Finishing",
  "External",
  "Other",
];

const TASK_TYPES = [
  "construction",
  "inspection",
  "approval",
  "procurement",
  "admin",
  "other",
];

const VALID_SUBTABS = [
  "schedule-templates",
  "task-templates",
  "display-settings",
  "gantt-preview",
  "data-view",
  "column-reference",
] as const;

type SubTab = typeof VALID_SUBTABS[number];

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

  // Task Templates state
  const [taskTemplates, setTaskTemplates] = React.useState<TaskTemplate[]>([]);
  const [taskTemplatesLoading, setTaskTemplatesLoading] = React.useState(true);
  const [showTaskDialog, setShowTaskDialog] = React.useState(false);
  const [editingTaskTemplate, setEditingTaskTemplate] = React.useState<TaskTemplate | null>(null);
  const [savingTask, setSavingTask] = React.useState(false);
  const [deletingTask, setDeletingTask] = React.useState<number | null>(null);

  const [taskFormData, setTaskFormData] = React.useState({
    name: "",
    task_type: "construction",
    category: "Other",
    default_duration_days: 1,
    description: "",
    is_milestone: false,
    requires_photo: false,
    sequence_order: 0,
    is_standard: true,
  });

  React.useEffect(() => {
    loadTemplates();
    loadTaskTemplates();
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

  // Task Templates functions
  const loadTaskTemplates = async () => {
    try {
      const data = await api.get<{ task_templates: TaskTemplate[] }>("/api/v1/task_templates");
      setTaskTemplates(data?.task_templates || []);
    } catch (error) {
      console.error("Failed to load task templates:", error);
      setTaskTemplates([]);
    } finally {
      setTaskTemplatesLoading(false);
    }
  };

  const handleOpenAddTaskDialog = () => {
    setTaskFormData({
      name: "",
      task_type: "construction",
      category: "Other",
      default_duration_days: 1,
      description: "",
      is_milestone: false,
      requires_photo: false,
      sequence_order: taskTemplates.length + 1,
      is_standard: true,
    });
    setEditingTaskTemplate(null);
    setShowTaskDialog(true);
  };

  const handleOpenEditTaskDialog = (template: TaskTemplate) => {
    setTaskFormData({
      name: template.name,
      task_type: template.task_type || "construction",
      category: template.category || "Other",
      default_duration_days: template.default_duration_days || 1,
      description: template.description || "",
      is_milestone: template.is_milestone || false,
      requires_photo: template.requires_photo || false,
      sequence_order: template.sequence_order || 0,
      is_standard: template.is_standard !== false,
    });
    setEditingTaskTemplate(template);
    setShowTaskDialog(true);
  };

  const handleSaveTaskTemplate = async () => {
    if (!taskFormData.name) {
      toast({ title: "Error", description: "Task name is required", variant: "destructive" });
      return;
    }

    setSavingTask(true);
    try {
      if (editingTaskTemplate) {
        await api.patch(`/api/v1/task_templates/${editingTaskTemplate.id}`, {
          task_template: taskFormData,
        });
        toast({ title: "Success", description: "Task template updated successfully" });
      } else {
        await api.post("/api/v1/task_templates", {
          task_template: taskFormData,
        });
        toast({ title: "Success", description: "Task template created successfully" });
      }
      setShowTaskDialog(false);
      loadTaskTemplates();
    } catch (error) {
      console.error("Failed to save task template:", error);
      toast({ title: "Error", description: "Failed to save task template", variant: "destructive" });
    } finally {
      setSavingTask(false);
    }
  };

  const handleDeleteTaskTemplate = async (id: number) => {
    if (!confirm("Are you sure you want to delete this task template? This cannot be undone.")) return;

    setDeletingTask(id);
    try {
      await api.delete(`/api/v1/task_templates/${id}`);
      toast({ title: "Success", description: "Task template deleted successfully" });
      loadTaskTemplates();
    } catch (error) {
      console.error("Failed to delete task template:", error);
      toast({ title: "Error", description: "Failed to delete task template", variant: "destructive" });
    } finally {
      setDeletingTask(null);
    }
  };

  // Group task templates by category
  const taskTemplatesByCategory = React.useMemo(() => {
    if (!Array.isArray(taskTemplates)) return {};

    const grouped: Record<string, TaskTemplate[]> = {};
    taskTemplates.forEach((template) => {
      const cat = template.category || "Other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(template);
    });
    // Sort each category by sequence_order (create new sorted arrays)
    const sorted: Record<string, TaskTemplate[]> = {};
    Object.keys(grouped).forEach((cat) => {
      sorted[cat] = [...grouped[cat]].sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));
    });
    return sorted;
  }, [taskTemplates]);

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
          <TabsTrigger value="task-templates">
            <ClipboardList className="h-4 w-4 mr-2" />
            Task Templates
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
                                  {row.start_day_offset > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{row.start_day_offset} offset
                                    </Badge>
                                  )}
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

        {/* Task Templates Tab */}
        <TabsContent value="task-templates" className="space-y-6 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Task Templates</h2>
              <p className="text-sm text-muted-foreground">
                Define reusable task templates for purchase orders and schedules.
              </p>
            </div>
            <Button onClick={handleOpenAddTaskDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New Task Template
            </Button>
          </div>

          {taskTemplatesLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : taskTemplates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No task templates yet</h3>
                <p className="text-center max-w-md mb-4">
                  Create task templates to standardize tasks across your projects.
                </p>
                <Button onClick={handleOpenAddTaskDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Task Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(taskTemplatesByCategory).map(([category, categoryTasks]) => (
                <div key={category}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">{category}</h3>
                  <div className="grid gap-3">
                    {categoryTasks.map((template) => (
                      <Card key={template.id} className="overflow-hidden">
                        <div className="flex items-center gap-4 p-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{template.name}</span>
                              {template.is_milestone && (
                                <Badge variant="secondary" className="text-xs">
                                  <Flag className="h-3 w-3 mr-1" />
                                  Milestone
                                </Badge>
                              )}
                              {template.requires_photo && (
                                <Badge variant="outline" className="text-xs">
                                  <Camera className="h-3 w-3 mr-1" />
                                  Photo
                                </Badge>
                              )}
                            </div>
                            {template.description && (
                              <p className="text-sm text-muted-foreground mt-1 truncate">
                                {template.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline">
                              {template.default_duration_days} days
                            </Badge>
                            <Badge variant="secondary" className="capitalize">
                              {template.task_type}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEditTaskDialog(template)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => handleDeleteTaskTemplate(template.id)}
                              disabled={deletingTask === template.id}
                            >
                              {deletingTask === template.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
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
              <h2 className="text-lg font-semibold mb-2">Schedule Master Column Reference</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Complete documentation of all 50+ columns in the sm_template_rows table.
              </p>
            </div>

            {/* Core Identity */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Core Identity</CardTitle>
                <CardDescription>Basic task identification fields</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">task_number</code>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">Display number for the task (globally unique)</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">name</code>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Task name/description</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">description</code>
                    <Badge variant="outline" className="text-xs w-fit">text</Badge>
                    <span className="text-muted-foreground">Extended description of the task</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">sequence_order</code>
                    <Badge variant="outline" className="text-xs w-fit">decimal</Badge>
                    <span className="text-muted-foreground">Controls display order in the list</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">category</code>
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
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">duration_days</code>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">How many working days the task takes</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">start_day_offset</code>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">Days after job start (used for initial positioning)</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">predecessor_ids</code>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Array of {`{id, type, lag}`} - defines task dependencies (FS, SS, FF, SF)</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">manually_positioned</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Task is locked/pinned (won&apos;t auto-cascade)</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">manual_start_date</code>
                    <Badge variant="outline" className="text-xs w-fit">date</Badge>
                    <span className="text-muted-foreground">Override start date when manually positioned</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">dependency_broken</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Dependencies were intentionally broken</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">predecessor_ids_backup</code>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Backup of dependencies before they were broken</span>
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
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">supplier_id</code>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">Contact who does the work</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">trade</code>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Trade category (Plumbing, Electrical, etc.)</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">stage</code>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Construction stage (Foundation, Frame, etc.)</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">assigned_role</code>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Internal role assignment (admin, site, supervisor, etc.)</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cost_centre</code>
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
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">po_required</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">This task needs a PO created</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">critical_po</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">PO is critical path - high priority</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">create_po_on_job_start</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Auto-create PO when job starts</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">linked_po_task_id</code>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">Link this task&apos;s PO to another task&apos;s PO</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">price_book_item_ids</code>
                    <Badge variant="outline" className="text-xs w-fit">integer[]</Badge>
                    <span className="text-muted-foreground">Price book items to add to PO</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">order_time_days</code>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">Lead time for ordering materials</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">call_time_days</code>
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
                <CardDescription>What&apos;s needed to mark task complete</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">require_photo</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Photo evidence needed on completion</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">require_certificate</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Certificate required (trades cert, inspection)</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">require_supervisor_check</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Supervisor must sign off</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">require_supplier_confirm</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Supplier must confirm completion</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">cert_lag_days</code>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">Days after task for cert to arrive</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">pass_fail_enabled</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Enable pass/fail status on task</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">is_completed</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Task has been completed</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">completed_at</code>
                    <Badge variant="outline" className="text-xs w-fit">date</Badge>
                    <span className="text-muted-foreground">When task was completed</span>
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
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">has_subtasks</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Task has child subtasks</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">subtask_count</code>
                    <Badge variant="outline" className="text-xs w-fit">integer</Badge>
                    <span className="text-muted-foreground">Number of subtasks</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">subtask_names</code>
                    <Badge variant="outline" className="text-xs w-fit">string[]</Badge>
                    <span className="text-muted-foreground">Names of each subtask</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">linked_task_ids</code>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">Other tasks linked to this one</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">parent_row_id</code>
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
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">documentation_category_ids</code>
                    <Badge variant="outline" className="text-xs w-fit">integer[]</Badge>
                    <span className="text-muted-foreground">Documentation tabs this task belongs to</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">show_in_docs_tab</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Show in documents tab</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">start_entity_tab_ids</code>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">EntityTabs for docs SENT on task START</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">complete_entity_tab_ids</code>
                    <Badge variant="outline" className="text-xs w-fit">JSONB</Badge>
                    <span className="text-muted-foreground">EntityTabs for docs RECEIVED on COMPLETE</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">photo_entity_tab_id</code>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">EntityTab where photos are stored</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">plan_type_ids</code>
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
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">spawn_photo_task</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Create a photo task when this starts</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">spawn_scan_task</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Create a document scan task</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">spawn_office_tasks</code>
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
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">checklist_id</code>
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
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">sm_template_ids</code>
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
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">auto_include</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Automatically include in new jobs</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">allow_duplicates</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">Allow multiple instances of this task</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">ai_select</code>
                    <Badge variant="outline" className="text-xs w-fit">boolean</Badge>
                    <span className="text-muted-foreground">AI can recommend/select this task</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">is_master</code>
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
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">tags</code>
                    <Badge variant="outline" className="text-xs w-fit">string[]</Badge>
                    <span className="text-muted-foreground">Tags for filtering/grouping</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">color</code>
                    <Badge variant="outline" className="text-xs w-fit">string</Badge>
                    <span className="text-muted-foreground">Custom color for Gantt bar</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">is_active</code>
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
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">created_by_id</code>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">User who created</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">updated_by_id</code>
                    <Badge variant="outline" className="text-xs w-fit">FK</Badge>
                    <span className="text-muted-foreground">User who last updated</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">created_at</code>
                    <Badge variant="outline" className="text-xs w-fit">datetime</Badge>
                    <span className="text-muted-foreground">Creation timestamp</span>
                  </div>
                  <div className="grid grid-cols-[140px_80px_1fr] gap-2 items-start">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">updated_at</code>
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

      {/* Task Template Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTaskTemplate ? "Edit Task Template" : "New Task Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTaskTemplate
                ? "Update the task template details."
                : "Create a new task template for your projects."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">Task Name</Label>
              <Input
                id="task-name"
                placeholder="e.g., Pour Slab"
                value={taskFormData.name}
                onChange={(e) => setTaskFormData({ ...taskFormData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-type">Task Type</Label>
                <Select
                  value={taskFormData.task_type}
                  onValueChange={(value) => setTaskFormData({ ...taskFormData, task_type: value })}
                >
                  <SelectTrigger id="task-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="capitalize">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-category">Category</Label>
                <Select
                  value={taskFormData.category}
                  onValueChange={(value) => setTaskFormData({ ...taskFormData, category: value })}
                >
                  <SelectTrigger id="task-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-duration">Default Duration (days)</Label>
                <Input
                  id="task-duration"
                  type="number"
                  min={1}
                  value={taskFormData.default_duration_days}
                  onChange={(e) => setTaskFormData({ ...taskFormData, default_duration_days: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-sequence">Sequence Order</Label>
                <Input
                  id="task-sequence"
                  type="number"
                  min={0}
                  value={taskFormData.sequence_order}
                  onChange={(e) => setTaskFormData({ ...taskFormData, sequence_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Input
                id="task-description"
                placeholder="Brief description of this task"
                value={taskFormData.description}
                onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
              />
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Milestone</Label>
                  <p className="text-sm text-muted-foreground">Mark this as a key milestone</p>
                </div>
                <Switch
                  checked={taskFormData.is_milestone}
                  onCheckedChange={(checked) => setTaskFormData({ ...taskFormData, is_milestone: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Requires Photo</Label>
                  <p className="text-sm text-muted-foreground">Photo evidence required on completion</p>
                </div>
                <Switch
                  checked={taskFormData.requires_photo}
                  onCheckedChange={(checked) => setTaskFormData({ ...taskFormData, requires_photo: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Standard Task</Label>
                  <p className="text-sm text-muted-foreground">Include in standard task lists</p>
                </div>
                <Switch
                  checked={taskFormData.is_standard}
                  onCheckedChange={(checked) => setTaskFormData({ ...taskFormData, is_standard: checked })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTaskTemplate} disabled={savingTask}>
              {savingTask ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingTaskTemplate ? (
                "Update Task Template"
              ) : (
                "Create Task Template"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
