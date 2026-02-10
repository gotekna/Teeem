"use client";

import * as React from "react";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Pencil,
  Trash2,
  Eye,
  Copy,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";
import { useToast } from "@/components/ui/use-toast";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";

interface MinuteTemplate {
  id: number;
  name: string;
  template_type: string;
  body?: string;
  required_fields?: string;
  active: boolean;
  minutes_count?: number;
}

interface FormData {
  name: string;
  template_type: string;
  body: string;
  required_fields: string;
  active: boolean;
}

interface PreviewContent {
  template?: { name: string };
  preview?: string;
  variables_used?: string[];
}

const TEMPLATE_TYPES = ["company", "trust", "general"];

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  company: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300" },
  trust: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-800 dark:text-purple-300" },
  general: { bg: "bg-muted dark:bg-muted", text: "text-foreground dark:text-muted-foreground" },
};

export default function MinuteTemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [templates, setTemplates] = React.useState<MinuteTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedType, setSelectedType] = React.useState("all");
  const [showInactive, setShowInactive] = React.useState(false);

  // Form state
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<MinuteTemplate | null>(null);
  const [formData, setFormData] = React.useState<FormData>({
    name: "",
    template_type: "company",
    body: "",
    required_fields: "",
    active: true,
  });
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  // Preview state
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewContent, setPreviewContent] = React.useState<PreviewContent | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);

  React.useEffect(() => {
    loadTemplates();
     
  }, [selectedType, showInactive]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { include_inactive: showInactive ? "true" : "false" };
      if (selectedType !== "all") {
        params.template_type = selectedType;
      }
      const response = await api.get<{ data: MinuteTemplate[] }>("/api/v1/minute_templates", { params });
      setTemplates(response.data || []);
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast({ title: "Failed to load templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openNewForm = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      template_type: "company",
      body: "",
      required_fields: "",
      active: true,
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditForm = async (template: MinuteTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name || "",
      template_type: template.template_type || "company",
      body: template.body || "",
      required_fields: template.required_fields || "",
      active: template.active !== false,
    });
    setFormErrors({});
    setIsFormOpen(true);

    // Fetch full template with body if needed
    if (!template.body) {
      try {
        const response = await api.get<{ data: MinuteTemplate }>(`/api/v1/minute_templates/${template.id}`);
        if (response?.data) {
          setFormData((prev) => ({
            ...prev,
            body: response.data.body || "",
          }));
        }
      } catch (error) {
        console.error("Failed to fetch template body:", error);
      }
    }
  };

  const handleFormChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = "Template name is required";
    }
    if (!formData.body.trim()) {
      errors.body = "Template body is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = { minute_template: formData };

      if (editingTemplate) {
        await api.put(`/api/v1/minute_templates/${editingTemplate.id}`, payload);
        toast({ title: "Template updated successfully" });
      } else {
        await api.post("/api/v1/minute_templates", payload);
        toast({ title: "Template created successfully" });
      }

      setIsFormOpen(false);
      loadTemplates();
    } catch (error: unknown) {
      console.error("Failed to save template:", error);
      const errorMsg = (error as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0] || "Failed to save template";
      toast({ title: errorMsg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: MinuteTemplate) => {
    if (!(await confirm(`Delete template "${template.name}"? This cannot be undone.`))) return;

    try {
      await api.delete(`/api/v1/minute_templates/${template.id}`);
      setTemplates(templates.filter((t) => t.id !== template.id));
      toast({ title: "Template deleted successfully" });
    } catch (error: unknown) {
      console.error("Failed to delete template:", error);
      const errorMsg = (error as { response?: { data?: { errors?: string[] } } })?.response?.data?.errors?.[0] || "Failed to delete template";
      toast({ title: errorMsg, variant: "destructive" });
    }
  };

  const handlePreview = async (template: MinuteTemplate) => {
    setPreviewLoading(true);
    setPreviewOpen(true);

    try {
      const response = await api.post<{ data: PreviewContent }>(`/api/v1/minute_templates/${template.id}/preview`, {});
      if (response) {
        setPreviewContent(response.data);
      }
    } catch (error) {
      console.error("Failed to generate preview:", error);
      toast({ title: "Failed to generate preview", variant: "destructive" });
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDuplicate = async (template: MinuteTemplate) => {
    try {
      // Fetch full template first
      const response = await api.get<{ data: MinuteTemplate }>(`/api/v1/minute_templates/${template.id}`);
      const fullTemplate = response.data;

      const payload = {
        minute_template: {
          name: `${fullTemplate.name} (Copy)`,
          template_type: fullTemplate.template_type,
          body: fullTemplate.body,
          required_fields: fullTemplate.required_fields,
          active: true,
        },
      };

      await api.post("/api/v1/minute_templates", payload);
      toast({ title: "Template duplicated successfully" });
      loadTemplates();
    } catch (error) {
      console.error("Failed to duplicate template:", error);
      toast({ title: "Failed to duplicate template", variant: "destructive" });
    }
  };

  const formatType = (type: string) => {
    if (!type) return "";
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  // Extract placeholders from template body for display
  const extractPlaceholders = (body: string) => {
    if (!body) return [];
    const matches = body.match(/\{\{(\w+)\}\}/g);
    return matches ? [...new Set(matches)] : [];
  };

  if (loading) {
    return (
      <LoadingOverlay height="h-96" />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <BackButton fallbackHref="/corporate" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Minute Templates</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage templates for company and trust minutes
            </p>
          </div>
        </div>
        <Button onClick={openNewForm}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1">Type</label>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {TEMPLATE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {formatType(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center pt-6 gap-2">
          <Checkbox
            id="showInactive"
            checked={showInactive}
            onCheckedChange={(checked) => setShowInactive(checked as boolean)}
          />
          <label htmlFor="showInactive" className="text-sm text-muted-foreground cursor-pointer">
            Show inactive
          </label>
        </div>
      </div>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <EmptyState
          title="No templates found"
          description={selectedType !== "all" ? "Try selecting a different type." : "Create your first template to get started."}
          icon={<FileText className="h-12 w-12" />}
          action={{
            label: "Create your first template",
            onClick: openNewForm
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const colors = TYPE_COLORS[template.template_type] || TYPE_COLORS.general;
            return (
              <Card
                key={template.id}
                className={cn(
                  "overflow-hidden hover:shadow-md transition-shadow",
                  !template.active && "opacity-60"
                )}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium truncate">{template.name}</h3>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge className={cn(colors.bg, colors.text)}>
                          {formatType(template.template_type)}
                        </Badge>
                        {!template.active && (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="mt-3 text-sm text-muted-foreground">
                    {(template.minutes_count || 0) > 0 ? (
                      <span>
                        Used in {template.minutes_count} minute{template.minutes_count !== 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span>Not used yet</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex items-center gap-2 border-t pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(template)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditForm(template)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDuplicate(template)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(template)}
                      className="text-muted-foreground hover:text-destructive ml-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit/Create Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "New Template"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-4">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">Template Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleFormChange("name", e.target.value)}
                  placeholder="e.g., Annual General Meeting Minutes"
                  className={cn(formErrors.name && "border-destructive")}
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-destructive">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <Select value={formData.template_type} onValueChange={(v) => handleFormChange("template_type", v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {formatType(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Template Body *</label>
              <p className="text-xs text-muted-foreground mb-2">
                Use {"{{placeholder}}"} syntax for dynamic fields. Example: {"{{company_name}}"}, {"{{director_name}}"}, {"{{meeting_date}}"}
              </p>
              <Textarea
                value={formData.body}
                onChange={(e) => handleFormChange("body", e.target.value)}
                rows={15}
                className={cn("font-mono", formErrors.body && "border-destructive")}
                placeholder={`MINUTES OF MEETING OF DIRECTORS
OF
{{company_name}}
ACN {{acn}}

Date: {{meeting_date}}
Time: {{meeting_time}}
Place: {{meeting_place}}

PRESENT:
{{director_name}} (Chair)

QUORUM:
A quorum being present, the Chair declared the meeting open.

RESOLUTION:
{{resolution_text}}

CLOSURE:
There being no further business, the meeting was declared closed.

_______________________
{{director_name}}
Director`}
              />
              {formErrors.body && (
                <p className="mt-1 text-sm text-destructive">{formErrors.body}</p>
              )}

              {/* Show detected placeholders */}
              {formData.body && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    Detected placeholders: {extractPlaceholders(formData.body).join(", ") || "None"}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => handleFormChange("active", checked as boolean)}
              />
              <label htmlFor="active" className="text-sm cursor-pointer">
                Active (available for use)
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>
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

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {previewLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size={32} className="text-muted-foreground" />
              </div>
            ) : previewContent ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <strong>Template:</strong> {previewContent.template?.name}
                </div>
                {previewContent.variables_used && previewContent.variables_used.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <strong>Variables:</strong> {previewContent.variables_used.join(", ")}
                  </div>
                )}
                <div className="border rounded-lg p-6 bg-muted/50">
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {previewContent.preview}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No preview available</p>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results count */}
      {templates.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Showing {templates.length} template{templates.length !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
