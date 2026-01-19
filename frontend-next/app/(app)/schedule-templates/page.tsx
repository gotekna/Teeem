"use client";

import { useState, useCallback, useEffect } from "react";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Clock,
  Copy,
  Star,
  MoreHorizontal,
  Edit,
  Trash,
  Eye,
  ListTodo,
  LayoutGrid,
  List,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { api } from "@/lib/api";

interface SmScheduleMasterTemplate {
  id: number;
  name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
  row_count: number;
  created_at: string;
  updated_at: string;
}

export default function ScheduleTemplatesPage() {
  useSetLayoutMode("full-height");
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [templates, setTemplates] = useState<SmScheduleMasterTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SmScheduleMasterTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [settingDefault, setSettingDefault] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });

  const loadTemplates = useCallback(async () => {
    try {
      const data = await api.get<{ success: boolean; sm_schedule_master_templates: SmScheduleMasterTemplate[] }>("/api/v1/sm_schedule_master_templates");
      setTemplates(data?.sm_schedule_master_templates || []);
    } catch (error) {
      console.error("Failed to load templates:", error);
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const refresh = useCallback(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Create template handler
  const handleCreate = () => {
    setFormData({ name: "", description: "" });
    setEditingTemplate(null);
    setShowDialog(true);
  };

  // Edit template handler
  const handleEdit = (template: SmScheduleMasterTemplate) => {
    setFormData({ name: template.name, description: template.description || "" });
    setEditingTemplate(template);
    setShowDialog(true);
  };

  // Save template handler
  const handleSave = async () => {
    if (!formData.name) {
      toast({ title: "Error", description: "Template name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        await api.patch(`/api/v1/sm_schedule_master_templates/${editingTemplate.id}`, { sm_schedule_master_template: formData });
        toast({ title: "Success", description: "Template updated successfully" });
      } else {
        await api.post("/api/v1/sm_schedule_master_templates", { sm_schedule_master_template: formData });
        toast({ title: "Success", description: "Template created successfully" });
      }
      setShowDialog(false);
      refresh();
    } catch (error) {
      console.error("Failed to save template:", error);
      toast({ title: "Error", description: "Failed to save template", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Duplicate template handler
  const handleDuplicate = async (id: number) => {
    setDuplicating(id);
    try {
      await api.post(`/api/v1/sm_schedule_master_templates/${id}/duplicate`);
      toast({ title: "Success", description: "Template duplicated successfully" });
      refresh();
    } catch (error) {
      console.error("Failed to duplicate template:", error);
      toast({ title: "Error", description: "Failed to duplicate template", variant: "destructive" });
    } finally {
      setDuplicating(null);
    }
  };

  // Set default template handler
  const handleSetDefault = async (id: number) => {
    setSettingDefault(id);
    try {
      await api.post(`/api/v1/sm_schedule_master_templates/${id}/set_default`);
      toast({ title: "Success", description: "Template set as default" });
      refresh();
    } catch (error) {
      console.error("Failed to set default template:", error);
      toast({ title: "Error", description: "Failed to set default template", variant: "destructive" });
    } finally {
      setSettingDefault(null);
    }
  };

  // Delete template handler
  const handleDelete = async (id: number) => {
    if (!(await confirm("Are you sure you want to delete this template?"))) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/sm_schedule_master_templates/${id}`);
      toast({ title: "Success", description: "Template archived successfully" });
      refresh();
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast({ title: "Error", description: "Failed to archive template", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  // Stats from templates
  const defaultTemplate = templates.find((t) => t.is_default);
  const stats = {
    total: templates.length,
    defaultTemplate: defaultTemplate?.name || "None",
    totalTasks: templates.reduce((sum, t) => sum + (t.row_count || 0), 0),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  // Left actions - Create button + View Toggle
  const leftActionsWithToggle = (
    <div className="flex items-center gap-2">
      <Button onClick={handleCreate}>
        <Plus className="h-4 w-4 mr-2" />
        Create Template
      </Button>
      <div className="flex items-center gap-1 ml-4">
        <Button
          variant={viewMode === "cards" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("cards")}
        >
          <LayoutGrid className="h-4 w-4 mr-1" />
          Cards
        </Button>
        <Button
          variant={viewMode === "table" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("table")}
        >
          <List className="h-4 w-4 mr-1" />
          Table
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/dashboard" />
          <div>
            <h1 className="text-2xl font-bold">Schedule Templates</h1>
            <p className="text-sm text-muted-foreground">
              {stats.total} templates • {stats.totalTasks} total rows • Default: {stats.defaultTemplate}
            </p>
          </div>
        </div>
        {leftActionsWithToggle}
      </div>

      {/* Templates Grid - Card View */}
      <div className="px-4 flex-1 overflow-auto">
        {templates.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12">
            <ListTodo className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No templates yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create schedule templates to quickly set up task schedules for new jobs.
            </p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Template
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer transition-all hover:shadow-md"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {template.name}
                        {template.is_default && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </CardTitle>
                      {template.description && (
                        <CardDescription className="mt-1">{template.description}</CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          {(duplicating === template.id || settingDefault === template.id || deleting === template.id) ? (
                            <Spinner size={16} />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a href={`/schedule-templates/${template.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Rows
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(template)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(template.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        {!template.is_default && (
                          <DropdownMenuItem onClick={() => handleSetDefault(template.id)}>
                            <Star className="h-4 w-4 mr-2" />
                            Set as Default
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(template.id)}
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <ListTodo className="h-4 w-4" />
                      {template.row_count || 0} rows
                    </div>
                  </div>

                  {template.is_active ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}

                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                    Updated {new Date(template.updated_at).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
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
                  <Spinner size={16} className="mr-2" />
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
