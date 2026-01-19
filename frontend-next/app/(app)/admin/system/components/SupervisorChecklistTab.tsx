"use client";

import * as React from "react";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  ClipboardCheck,
  CheckCircle,
  Info,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";

interface ChecklistTemplate {
  id: number;
  name: string;
  description: string;
  category: string;
  response_type: "checkbox" | "photo" | "note" | "photo_and_note";
}

const CATEGORIES = ["Safety", "Quality", "Pre-Start", "Completion", "Documentation"];

const RESPONSE_TYPES = [
  { value: "checkbox", label: "Checkbox (Yes/No)" },
  { value: "photo", label: "Photo Required" },
  { value: "note", label: "Note Required" },
  { value: "photo_and_note", label: "Photo and Note Required" },
];

export function SupervisorChecklistTab() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [templates, setTemplates] = React.useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [formData, setFormData] = React.useState<{
    name: string;
    description: string;
    category: string;
    response_type: "checkbox" | "note" | "photo" | "photo_and_note";
  }>({
    name: "",
    description: "",
    category: "",
    response_type: "checkbox",
  });

  React.useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await api.get<ChecklistTemplate[]>("/api/v1/supervisor_checklist_templates");
      setTemplates(data);
    } catch (error) {
      console.error("Failed to load templates:", error);
      // Mock data
      setTemplates([
        { id: 1, name: "Safety barriers installed", description: "Check all safety barriers are in place", category: "Safety", response_type: "checkbox" },
        { id: 2, name: "Site induction completed", description: "Verify all workers completed induction", category: "Safety", response_type: "checkbox" },
        { id: 3, name: "Foundation inspection", description: "Photo documentation of foundation", category: "Quality", response_type: "photo" },
        { id: 4, name: "Material delivery check", description: "Verify delivered materials match order", category: "Pre-Start", response_type: "photo_and_note" },
        { id: 5, name: "Final clean completed", description: "Site fully cleaned before handover", category: "Completion", response_type: "checkbox" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "",
      response_type: "checkbox",
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await api.post("/api/v1/supervisor_checklist_templates", {
        supervisor_checklist_template: formData,
      });
      toast({ title: "Success", description: "Checklist item created successfully" });
      resetForm();
      loadTemplates();
    } catch (error) {
      console.error("Failed to create template:", error);
      toast({ title: "Error", description: "Failed to create checklist item", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (template: ChecklistTemplate) => {
    setEditingId(template.id);
    setFormData({
      name: template.name,
      description: template.description || "",
      category: template.category || "",
      response_type: template.response_type || "checkbox",
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;

    setSaving(true);
    try {
      await api.put(`/api/v1/supervisor_checklist_templates/${editingId}`, {
        supervisor_checklist_template: formData,
      });
      toast({ title: "Success", description: "Checklist item updated successfully" });
      setEditingId(null);
      loadTemplates();
    } catch (error) {
      console.error("Failed to update template:", error);
      toast({ title: "Error", description: "Failed to update checklist item", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirm("Are you sure you want to delete this checklist item?"))) return;

    try {
      await api.delete(`/api/v1/supervisor_checklist_templates/${id}`);
      toast({ title: "Success", description: "Checklist item deleted successfully" });
      loadTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast({ title: "Error", description: "Failed to delete checklist item", variant: "destructive" });
    }
  };

  const getResponseTypeLabel = (type: string) => {
    return RESPONSE_TYPES.find((t) => t.value === type)?.label || "Checkbox (Yes/No)";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Supervisor Checklist Templates</h2>
          <p className="text-sm text-muted-foreground">
            Create reusable checklist items for supervisor checks. Assign these to tasks in Schedule Master templates.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} disabled={showForm}>
          <Plus className="h-4 w-4 mr-2" />
          Add Checklist Item
        </Button>
      </div>

      {/* New Item Form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New Checklist Item</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">Checklist Item Name *</Label>
                <Input
                  id="new-name"
                  placeholder="e.g., Safety barriers installed"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-category">Category</Label>
                <Select
                  value={formData.category || "__none__"}
                  onValueChange={(value) => setFormData({ ...formData, category: value === "__none__" ? "" : value })}
                >
                  <SelectTrigger id="new-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No category</SelectItem>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-response">Response Type *</Label>
                <Select
                  value={formData.response_type}
                  onValueChange={(value: "checkbox" | "photo" | "note" | "photo_and_note") =>
                    setFormData({ ...formData, response_type: value })
                  }
                >
                  <SelectTrigger id="new-response">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESPONSE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-desc">Description</Label>
                <Input
                  id="new-desc"
                  placeholder="Optional details"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="col-span-full flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Spinner size={16} className="mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Create
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Templates Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Checklist Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Response Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No checklist items yet. Create one to get started.</p>
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      {editingId === template.id ? (
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="max-w-[200px]"
                        />
                      ) : (
                        <span className="font-medium">{template.name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === template.id ? (
                        <Select
                          value={formData.category || "__none__"}
                          onValueChange={(value) => setFormData({ ...formData, category: value === "__none__" ? "" : value })}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">No category</SelectItem>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : template.category ? (
                        <Badge variant="secondary">{template.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === template.id ? (
                        <Select
                          value={formData.response_type}
                          onValueChange={(value: "checkbox" | "photo" | "note" | "photo_and_note") =>
                            setFormData({ ...formData, response_type: value })
                          }
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RESPONSE_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span>{getResponseTypeLabel(template.response_type)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {editingId === template.id ? (
                        <Input
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="max-w-[200px]"
                        />
                      ) : (
                        template.description || "-"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === template.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" onClick={handleUpdate} disabled={saving}>
                            {saving ? <Spinner size={16} /> : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null);
                              loadTemplates();
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(template)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDelete(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="flex gap-3 pt-6">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-2">How it works</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Create checklist items here (e.g., &quot;Safety barriers installed&quot;, &quot;Site induction completed&quot;)</li>
              <li>In Schedule Master, assign these items to tasks that require supervisor checks</li>
              <li>When a job is created, checklist items are automatically added to assigned tasks</li>
              <li>Site supervisors check off items as they complete them</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
