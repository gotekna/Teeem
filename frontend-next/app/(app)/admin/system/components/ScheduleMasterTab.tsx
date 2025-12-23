"use client";

import * as React from "react";
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
} from "lucide-react";
import TeeemTableView from "@/components/table/TeeemTableView";
import { GanttChart, type GanttFeature, type GanttGroup } from "@/components/ui/gantt";
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

export function ScheduleMasterTab() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState("schedule-templates");

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
  const [ganttViewMode, setGanttViewMode] = React.useState<"canvas" | "react">("canvas");

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

      // Auto-select "Schedule Master LIVE" template for Gantt Preview if not already selected
      if (!ganttTemplateId && loadedTemplates.length > 0) {
        const scheduleMasterLive = loadedTemplates.find(t =>
          t.name.toLowerCase().includes('schedule master live') ||
          (t.row_count === 165 && t.name.toLowerCase().includes('schedule'))
        );
        if (scheduleMasterLive) {
          loadGanttRows(scheduleMasterLive.id);
        }
      }

      // Auto-select template with "LIVE" in name for Data View
      if (!dataViewTemplateId && loadedTemplates.length > 0) {
        const liveTemplate = loadedTemplates.find(t =>
          t.name.toLowerCase().includes('live') && !t.name.toLowerCase().includes('copy')
        );
        if (liveTemplate) {
          loadDataViewRows(liveTemplate.id);
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

  const convertRowsToGanttFeatures = (rows: SmTemplateRow[]): GanttFeature[] => {
    // Calculate start dates based on predecessors and durations
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);

    const rowMap = new Map<number, SmTemplateRow>();
    const startDates = new Map<number, Date>();

    rows.forEach(row => rowMap.set(row.id, row));

    // Calculate start dates considering predecessors
    const getStartDate = (row: SmTemplateRow): Date => {
      if (startDates.has(row.id)) {
        return startDates.get(row.id)!;
      }

      let maxEndDate = baseDate;

      if (row.predecessor_ids && row.predecessor_ids.length > 0) {
        row.predecessor_ids.forEach(pred => {
          const predId = typeof pred === 'object' ? pred.id : pred;
          const predRow = rowMap.get(predId);
          if (predRow) {
            const predStart = getStartDate(predRow);
            const predEnd = new Date(predStart);
            predEnd.setDate(predEnd.getDate() + predRow.duration_days);
            if (predEnd > maxEndDate) {
              maxEndDate = predEnd;
            }
          }
        });
      } else if (row.start_day_offset) {
        maxEndDate = new Date(baseDate);
        maxEndDate.setDate(maxEndDate.getDate() + row.start_day_offset);
      }

      startDates.set(row.id, maxEndDate);
      return maxEndDate;
    };

    return rows.map(row => {
      const startAt = getStartDate(row);
      const endAt = new Date(startAt);
      endAt.setDate(endAt.getDate() + Math.max(row.duration_days - 1, 0));

      // Determine status based on row properties
      const isHeader = ['SLAB', 'FRAME', 'ENCLOSED', 'FIXING', 'DRIVEWAY', 'LANDSCAPING', 'PRACTICAL COMPLETION'].includes(row.name.trim());

      return {
        id: String(row.id),
        name: row.name,
        startAt,
        endAt,
        status: {
          id: isHeader ? 'milestone' : 'not-started',
          name: isHeader ? 'Stage' : 'Not Started',
          color: isHeader ? 'bg-amber-500 text-white' : 'bg-secondary text-secondary-foreground',
        },
        progress: 0,
        dependencies: row.predecessor_ids?.map(p => String(typeof p === 'object' ? p.id : p)) || [],
      };
    });
  };

  const convertRowsToGanttGroups = (rows: SmTemplateRow[]): GanttGroup[] => {
    // Group by stage
    const stageHeaders = ['SLAB', 'FRAME', 'ENCLOSED', 'FIXING', 'DRIVEWAY', 'LANDSCAPING', 'PRACTICAL COMPLETION'];
    const groups: GanttGroup[] = [];
    let currentGroup: { name: string; rows: SmTemplateRow[] } = { name: 'Pre-Construction', rows: [] };

    rows.forEach(row => {
      if (stageHeaders.includes(row.name.trim())) {
        // Save current group if it has rows
        if (currentGroup.rows.length > 0) {
          groups.push({
            id: currentGroup.name.toLowerCase().replace(/\s+/g, '-'),
            name: currentGroup.name,
            features: convertRowsToGanttFeatures(currentGroup.rows),
          });
        }
        // Start new group
        currentGroup = { name: row.name, rows: [row] };
      } else {
        currentGroup.rows.push(row);
      }
    });

    // Don't forget the last group
    if (currentGroup.rows.length > 0) {
      groups.push({
        id: currentGroup.name.toLowerCase().replace(/\s+/g, '-'),
        name: currentGroup.name,
        features: convertRowsToGanttFeatures(currentGroup.rows),
      });
    }

    return groups;
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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

        <TabsContent value="gantt-preview" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Gantt Preview</h2>
                <p className="text-sm text-muted-foreground">
                  Preview schedule templates as a Gantt chart
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-2 border rounded-lg p-1">
                  <Button
                    variant={ganttViewMode === "canvas" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setGanttViewMode("canvas")}
                  >
                    Canvas (New)
                  </Button>
                  <Button
                    variant={ganttViewMode === "react" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setGanttViewMode("react")}
                  >
                    React (Legacy)
                  </Button>
                </div>
                <Select
                  value={ganttTemplateId ? String(ganttTemplateId) : ""}
                  onValueChange={(value) => loadGanttRows(parseInt(value))}
                >
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Select a template to preview" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={String(template.id)}>
                        {template.name} ({template.row_count} tasks)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loadingRows === ganttTemplateId && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {ganttTemplateId && loadingRows !== ganttTemplateId && (
              <>
                {ganttViewMode === "canvas" ? (
                  /* New Canvas-based Gantt - High Performance */
                  <Card>
                    <CardContent className="p-0">
                      <div className="h-[600px]">
                        <GanttCanvasView
                          templateId={ganttTemplateId}
                          className="h-full"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ) : ganttRows.length > 0 ? (
                  /* Legacy React Gantt */
                  <Card>
                    <CardContent className="p-0">
                      <div className="h-[600px]">
                        <GanttChart
                          features={convertRowsToGanttFeatures(ganttRows)}
                          showControls={true}
                          showSidebar={true}
                          showToday={true}
                          showDependencies={true}
                          title={templates.find(t => t.id === ganttTemplateId)?.name || "Template Preview"}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No tasks in this template</h3>
                      <p className="text-center max-w-md">
                        Add tasks to this template to see the Gantt preview.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {!ganttTemplateId && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Select a template</h3>
                  <p className="text-center max-w-md">
                    Choose a schedule template from the dropdown above to preview it as a Gantt chart.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
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
