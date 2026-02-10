"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  RefreshCw,
  Eye,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BankStatementComparisonModal } from "./BankStatementComparisonModal";

// Bank Statement Template from API
interface BankStatementTemplate {
  id: number;
  bank_code: string;
  bank_name: string;
  primary_color: string;
  secondary_color: string;
  text_on_primary: string;
  account_type: string;
  date_format: string;
  date_format_preview: string;
  detection_patterns: string[];
  layout_style: string;
  reference_image_path: string | null;
  has_reference_image: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ApiMeta {
  layout_styles: string[];
  date_format_options: { value: string; label: string; preview: string }[];
}

interface TemplateFormData {
  bank_code: string;
  bank_name: string;
  primary_color: string;
  secondary_color: string;
  text_on_primary: string;
  account_type: string;
  date_format: string;
  detection_patterns: string[];
  layout_style: string;
  is_active: boolean;
}

const DEFAULT_FORM_DATA: TemplateFormData = {
  bank_code: "",
  bank_name: "",
  primary_color: "5D2E46",
  secondary_color: "333333",
  text_on_primary: "FFFFFF",
  account_type: "Account",
  date_format: "%-d %b %Y",
  detection_patterns: [],
  layout_style: "default",
  is_active: true,
};

export function BankStatementTemplatesTab() {
  const [templates, setTemplates] = React.useState<BankStatementTemplate[]>([]);
  const [meta, setMeta] = React.useState<ApiMeta | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<BankStatementTemplate | null>(null);
  const [formData, setFormData] = React.useState<TemplateFormData>(DEFAULT_FORM_DATA);
  const [patternInput, setPatternInput] = React.useState("");
  const [comparisonModalOpen, setComparisonModalOpen] = React.useState(false);
  const [comparisonTemplate, setComparisonTemplate] = React.useState<BankStatementTemplate | null>(null);

  React.useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get<{
        success: boolean;
        data: BankStatementTemplate[];
        meta: ApiMeta;
      }>("/api/v1/bank_statement_templates");

      if (response?.success && response.data) {
        setTemplates(response.data);
        setMeta(response.meta);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (template?: BankStatementTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        bank_code: template.bank_code,
        bank_name: template.bank_name,
        primary_color: template.primary_color,
        secondary_color: template.secondary_color,
        text_on_primary: template.text_on_primary,
        account_type: template.account_type,
        date_format: template.date_format,
        detection_patterns: template.detection_patterns || [],
        layout_style: template.layout_style,
        is_active: template.is_active,
      });
    } else {
      setEditingTemplate(null);
      setFormData(DEFAULT_FORM_DATA);
    }
    setPatternInput("");
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setEditingTemplate(null);
    setFormData(DEFAULT_FORM_DATA);
    setPatternInput("");
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = { bank_statement_template: formData };

      if (editingTemplate) {
        await api.patch(`/api/v1/bank_statement_templates/${editingTemplate.id}`, payload);
      } else {
        await api.post("/api/v1/bank_statement_templates", payload);
      }

      closeEditDialog();
      await loadTemplates();
    } catch (error) {
      console.error("Failed to save template:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingTemplate) return;

    try {
      setSaving(true);
      await api.delete(`/api/v1/bank_statement_templates/${editingTemplate.id}`);
      setDeleteDialogOpen(false);
      closeEditDialog();
      await loadTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
    } finally {
      setSaving(false);
    }
  };

  const addPattern = () => {
    const trimmed = patternInput.trim().toLowerCase();
    if (trimmed && !formData.detection_patterns.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        detection_patterns: [...prev.detection_patterns, trimmed],
      }));
    }
    setPatternInput("");
  };

  const removePattern = (pattern: string) => {
    setFormData((prev) => ({
      ...prev,
      detection_patterns: prev.detection_patterns.filter((p) => p !== pattern),
    }));
  };

  const openComparison = (template: BankStatementTemplate) => {
    setComparisonTemplate(template);
    setComparisonModalOpen(true);
  };

  // Format date preview based on current date
  const getDatePreview = (format: string) => {
    const option = meta?.date_format_options?.find((o) => o.value === format);
    return option?.preview || format;
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Bank Statement Templates</h2>
          <p className="text-sm text-muted-foreground">
            SSoT: BankStatementTemplate model - Configure bank branding for PDF statements
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadTemplates}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => openEditDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Template
          </Button>
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {templates.map((template) => (
          <Card
            key={template.id}
            className={cn(
              "relative overflow-hidden transition-shadow hover:shadow-md",
              !template.is_active && "opacity-60"
            )}
          >
            {/* Color Preview Header */}
            <div
              className="h-12 flex items-center justify-between px-4"
              style={{ backgroundColor: `#${template.primary_color}` }}
            >
              <span
                className="font-semibold text-sm"
                style={{ color: `#${template.text_on_primary}` }}
              >
                {template.bank_name}
              </span>
              {!template.is_active && (
                <Badge variant="outline" className="bg-white/90 text-xs">
                  Inactive
                </Badge>
              )}
            </div>

            <CardContent className="pt-4 space-y-3">
              {/* Color Swatches */}
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded border"
                  style={{ backgroundColor: `#${template.primary_color}` }}
                  title={`Primary: #${template.primary_color}`}
                />
                <div
                  className="w-6 h-6 rounded border"
                  style={{ backgroundColor: `#${template.secondary_color}` }}
                  title={`Secondary: #${template.secondary_color}`}
                />
                <span className="text-xs text-muted-foreground font-mono">
                  #{template.primary_color}
                </span>
              </div>

              {/* Details */}
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Code:</span>
                  <span className="font-mono">{template.bank_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Layout:</span>
                  <span>{template.layout_style}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{template.date_format_preview}</span>
                </div>
              </div>

              {/* Detection Patterns */}
              {template.detection_patterns && template.detection_patterns.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.detection_patterns.slice(0, 3).map((pattern) => (
                    <Badge key={pattern} variant="secondary" className="text-xs">
                      {pattern}
                    </Badge>
                  ))}
                  {template.detection_patterns.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{template.detection_patterns.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEditDialog(template)}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openComparison(template)}
                  title="Compare with reference"
                >
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? `Edit Template: ${editingTemplate.bank_name}` : "New Bank Template"}
            </DialogTitle>
            <DialogDescription>
              Configure the bank branding for PDF statement generation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            {/* Left Column - Form Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bank_code">Bank Code</Label>
                <Input
                  id="bank_code"
                  value={formData.bank_code}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, bank_code: e.target.value.toLowerCase() }))
                  }
                  placeholder="nab"
                  disabled={!!editingTemplate}
                />
                <p className="text-xs text-muted-foreground">
                  Unique identifier (lowercase, no spaces)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  value={formData.bank_name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, bank_name: e.target.value }))
                  }
                  placeholder="NAB"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="primary_color">Primary</Label>
                  <div className="flex gap-2">
                    <div
                      className="w-8 h-8 rounded border cursor-pointer"
                      style={{ backgroundColor: `#${formData.primary_color}` }}
                    />
                    <Input
                      id="primary_color"
                      value={formData.primary_color}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          primary_color: e.target.value.replace("#", "").toUpperCase(),
                        }))
                      }
                      placeholder="C20000"
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary_color">Secondary</Label>
                  <div className="flex gap-2">
                    <div
                      className="w-8 h-8 rounded border cursor-pointer"
                      style={{ backgroundColor: `#${formData.secondary_color}` }}
                    />
                    <Input
                      id="secondary_color"
                      value={formData.secondary_color}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          secondary_color: e.target.value.replace("#", "").toUpperCase(),
                        }))
                      }
                      placeholder="000000"
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="text_on_primary">Text</Label>
                  <div className="flex gap-2">
                    <div
                      className="w-8 h-8 rounded border cursor-pointer"
                      style={{ backgroundColor: `#${formData.text_on_primary}` }}
                    />
                    <Input
                      id="text_on_primary"
                      value={formData.text_on_primary}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          text_on_primary: e.target.value.replace("#", "").toUpperCase(),
                        }))
                      }
                      placeholder="FFFFFF"
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_type">Account Type Label</Label>
                <Input
                  id="account_type"
                  value={formData.account_type}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, account_type: e.target.value }))
                  }
                  placeholder="Business Everyday Account"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_format">Date Format</Label>
                <Select
                  value={formData.date_format}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, date_format: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    {meta?.date_format_options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label} ({option.preview})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="layout_style">Layout Style</Label>
                <Select
                  value={formData.layout_style}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, layout_style: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select layout" />
                  </SelectTrigger>
                  <SelectContent>
                    {meta?.layout_styles?.map((style) => (
                      <SelectItem key={style} value={style}>
                        {style}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Active</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_active: checked }))
                  }
                />
              </div>
            </div>

            {/* Right Column - Preview & Patterns */}
            <div className="space-y-4">
              {/* Live Preview */}
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="border rounded-lg overflow-hidden">
                  <div
                    className="h-16 px-4 flex items-center justify-between"
                    style={{ backgroundColor: `#${formData.primary_color}` }}
                  >
                    <div>
                      <div
                        className="font-bold"
                        style={{ color: `#${formData.text_on_primary}` }}
                      >
                        {formData.bank_name || "Bank Name"}
                      </div>
                      <div
                        className="text-sm opacity-90"
                        style={{ color: `#${formData.text_on_primary}` }}
                      >
                        {formData.account_type || "Account Type"}
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-muted/30 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Date Preview:</span>
                      <span>{getDatePreview(formData.date_format)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detection Patterns */}
              <div className="space-y-2">
                <Label>Detection Patterns</Label>
                <p className="text-xs text-muted-foreground">
                  Patterns to match against account names (case-insensitive regex)
                </p>
                <div className="flex gap-2">
                  <Input
                    value={patternInput}
                    onChange={(e) => setPatternInput(e.target.value)}
                    placeholder="e.g., nab, national australia"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPattern();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addPattern}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-2 border rounded-md bg-muted/30">
                  {formData.detection_patterns.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No patterns defined</span>
                  ) : (
                    formData.detection_patterns.map((pattern) => (
                      <Badge key={pattern} variant="secondary" className="gap-1">
                        {pattern}
                        <button
                          type="button"
                          onClick={() => removePattern(pattern)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              {/* Info Box */}
              <Card className="bg-muted/30">
                <CardContent className="pt-4 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Layout:</span>
                    <span className="font-mono">{formData.layout_style}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Code:</span>
                    <span className="font-mono">{formData.bank_code || "(not set)"}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {editingTemplate && editingTemplate.bank_code !== "default" && (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={saving}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" onClick={closeEditDialog} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the "{editingTemplate?.bank_name}" template? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SSoT Info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium text-sm mb-2">SSoT Location</h4>
              <p className="text-xs text-muted-foreground font-mono">
                BankStatementTemplate
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                backend/app/models/bank_statement_template.rb
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2">PDF Generation</h4>
              <p className="text-xs text-muted-foreground font-mono">
                BankTransactionReportService
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Uses templates for colors, dates, layout
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2">Detection</h4>
              <p className="text-xs text-muted-foreground">
                Templates are matched against Xero account names using detection patterns.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Falls back to "default" if no match.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Modal */}
      <BankStatementComparisonModal
        open={comparisonModalOpen}
        onOpenChange={setComparisonModalOpen}
        template={comparisonTemplate}
      />
    </div>
  );
}
