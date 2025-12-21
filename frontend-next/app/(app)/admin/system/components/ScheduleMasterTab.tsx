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
} from "lucide-react";
import { SMGanttTab } from "./SMGanttTab";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface ScheduleTask {
  id: number;
  name: string;
  duration_days: number;
  offset_days: number;
  dependency_id: number | null;
  position: number;
  checklist_items?: string[];
}

interface ScheduleTemplate {
  id: number;
  name: string;
  description: string;
  job_type_id: number | null;
  tasks: ScheduleTask[];
  created_at: string;
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
  const [templates, setTemplates] = React.useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedTemplate, setExpandedTemplate] = React.useState<number | null>(null);
  const [showDialog, setShowDialog] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<ScheduleTemplate | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [duplicating, setDuplicating] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState<number | null>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
  });

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
      const data = await api.get<ScheduleTemplate[] | { schedule_templates: ScheduleTemplate[] }>("/api/v1/schedule_templates");
      // Handle both direct array and { schedule_templates: [...] } response formats
      const templatesArray = Array.isArray(data) ? data : (data?.schedule_templates || []);
      setTemplates(templatesArray);
    } catch (error) {
      console.error("Failed to load templates:", error);
      // Mock data for development
      setTemplates([
        {
          id: 1,
          name: "Standard New Build",
          description: "Default schedule for new residential builds",
          job_type_id: 1,
          tasks: [
            { id: 1, name: "Site Preparation", duration_days: 5, offset_days: 0, dependency_id: null, position: 1 },
            { id: 2, name: "Foundation", duration_days: 10, offset_days: 0, dependency_id: 1, position: 2 },
            { id: 3, name: "Frame", duration_days: 15, offset_days: 0, dependency_id: 2, position: 3 },
            { id: 4, name: "Roof", duration_days: 7, offset_days: 0, dependency_id: 3, position: 4 },
            { id: 5, name: "Lock Up", duration_days: 5, offset_days: 0, dependency_id: 4, position: 5 },
            { id: 6, name: "Fit Out", duration_days: 20, offset_days: 0, dependency_id: 5, position: 6 },
            { id: 7, name: "Handover", duration_days: 3, offset_days: 0, dependency_id: 6, position: 7 },
          ],
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          name: "Renovation Template",
          description: "Schedule for renovation projects",
          job_type_id: 2,
          tasks: [
            { id: 8, name: "Demo & Strip Out", duration_days: 5, offset_days: 0, dependency_id: null, position: 1 },
            { id: 9, name: "Structural Work", duration_days: 10, offset_days: 0, dependency_id: 8, position: 2 },
            { id: 10, name: "Services Rough-in", duration_days: 7, offset_days: 0, dependency_id: 9, position: 3 },
            { id: 11, name: "Fit Out", duration_days: 15, offset_days: 0, dependency_id: 10, position: 4 },
            { id: 12, name: "Finishing", duration_days: 5, offset_days: 0, dependency_id: 11, position: 5 },
          ],
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddDialog = () => {
    setFormData({ name: "", description: "" });
    setEditingTemplate(null);
    setShowDialog(true);
  };

  const handleOpenEditDialog = (template: ScheduleTemplate) => {
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
        await api.patch(`/api/v1/schedule_templates/${editingTemplate.id}`, {
          schedule_template: formData,
        });
        toast({ title: "Success", description: "Template updated successfully" });
      } else {
        await api.post("/api/v1/schedule_templates", {
          schedule_template: formData,
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
      await api.post(`/api/v1/schedule_templates/${id}/duplicate`);
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
      await api.delete(`/api/v1/schedule_templates/${id}`);
      toast({ title: "Success", description: "Template deleted successfully" });
      loadTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedTemplate(expandedTemplate === id ? null : id);
  };

  const getTotalDuration = (tasks: ScheduleTask[]) => {
    return tasks.reduce((sum, task) => sum + task.duration_days, 0);
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
                          {(Array.isArray(template.tasks) ? template.tasks : []).length} tasks
                        </Badge>
                        <Badge variant="outline">
                          {getTotalDuration(Array.isArray(template.tasks) ? template.tasks : [])} days
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
                      <div className="border rounded-lg divide-y">
                        {[...(Array.isArray(template.tasks) ? template.tasks : [])]
                          .sort((a, b) => (a.position || 0) - (b.position || 0))
                          .map((task, index) => (
                            <div
                              key={task.id}
                              className="flex items-center gap-4 p-3 hover:bg-muted/50"
                            >
                              <span className="w-6 text-center text-sm text-muted-foreground">
                                {index + 1}
                              </span>
                              <div className="flex-1">
                                <p className="font-medium text-sm">{task.name}</p>
                                {task.checklist_items && task.checklist_items.length > 0 && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <ListChecks className="h-3 w-3" />
                                    {task.checklist_items.length} checklist items
                                  </p>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {task.duration_days} days
                              </Badge>
                              {task.offset_days > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{task.offset_days} offset
                                </Badge>
                              )}
                            </div>
                          ))}
                      </div>

                      <div className="mt-4 flex justify-end">
                        <Button variant="outline" size="sm">
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit Tasks
                        </Button>
                      </div>
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
