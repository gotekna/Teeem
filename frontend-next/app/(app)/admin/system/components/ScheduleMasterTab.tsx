"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Loader2,
  GripVertical,
  Pencil,
  Trash2,
  Copy,
  Calendar,
  ListChecks,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

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

export function ScheduleMasterTab() {
  const { toast } = useToast();
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

  React.useEffect(() => {
    loadTemplates();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                      {(template.tasks || []).length} tasks
                    </Badge>
                    <Badge variant="outline">
                      {getTotalDuration(template.tasks || [])} days
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
                    {(template.tasks || [])
                      .sort((a, b) => a.position - b.position)
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
