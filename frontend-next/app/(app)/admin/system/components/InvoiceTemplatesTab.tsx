"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { api } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  RefreshCw,
  Eye,
  Star,
  Palette,
  Save,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ClaimInvoiceTemplate {
  id: number;
  name: string;
  description: string | null;
  style_key: string;
  is_default: boolean;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  logo_position: string;
  header_style: string;
  show_logo: boolean;
  show_company_details: boolean;
  show_bank_details: boolean;
}

interface PreviewData {
  template: ClaimInvoiceTemplate;
  preview_html: string;
}

export function InvoiceTemplatesTab() {
  const [templates, setTemplates] = useState<ClaimInvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<ClaimInvoiceTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ClaimInvoiceTemplate | null>(null);
  const [editForm, setEditForm] = useState<Partial<ClaimInvoiceTemplate>>({});
  const [saving, setSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{
        success: boolean;
        data: ClaimInvoiceTemplate[];
      }>("/api/v1/claim_invoice_templates");

      if (response?.success && response.data) {
        setTemplates(response.data);
        // Auto-select first template if none selected
        if (!selectedTemplate && response.data.length > 0) {
          loadPreview(response.data[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error("Failed to load invoice templates");
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate]);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadPreview = async (template: ClaimInvoiceTemplate) => {
    setSelectedTemplate(template);
    setPreviewLoading(true);
    setPreviewHtml("");

    try {
      const response = await api.get<{
        success: boolean;
        data: PreviewData;
      }>(`/api/v1/claim_invoice_templates/${template.id}/preview`);

      if (response?.success && response.data) {
        setPreviewHtml(response.data.preview_html);
      }
    } catch (error) {
      console.error("Failed to load preview:", error);
      setPreviewHtml("<p>Failed to load preview</p>");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSetDefault = async (template: ClaimInvoiceTemplate) => {
    try {
      const response = await api.patch<{ success: boolean }>(
        `/api/v1/claim_invoice_templates/${template.id}/set_default`
      );

      if (response?.success) {
        toast.success(`${template.name} is now the default template`);
        loadTemplates();
      }
    } catch (error) {
      console.error("Failed to set default:", error);
      toast.error("Failed to set default template");
    }
  };

  const openEditSheet = (template: ClaimInvoiceTemplate) => {
    setEditingTemplate(template);
    setEditForm({
      name: template.name,
      description: template.description,
      primary_color: template.primary_color,
      secondary_color: template.secondary_color,
      font_family: template.font_family,
      show_logo: template.show_logo,
      show_company_details: template.show_company_details,
      show_bank_details: template.show_bank_details,
    });
  };

  const closeEditSheet = () => {
    setEditingTemplate(null);
    setEditForm({});
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    try {
      setSaving(true);
      const response = await api.patch<{
        success: boolean;
        data: ClaimInvoiceTemplate;
      }>(`/api/v1/claim_invoice_templates/${editingTemplate.id}`, {
        template: editForm,
      });

      if (response?.success) {
        toast.success("Template updated successfully");
        closeEditSheet();
        loadTemplates();
        // Refresh preview if this was the selected template
        if (selectedTemplate?.id === editingTemplate.id) {
          loadPreview(response.data);
        }
      }
    } catch (error) {
      console.error("Failed to save template:", error);
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const getStyleBadge = (styleKey: string) => {
    switch (styleKey) {
      case "classic":
        return <Badge className="bg-slate-600 text-white">Classic</Badge>;
      case "modern":
        return <Badge className="bg-indigo-600 text-white">Modern</Badge>;
      case "bold":
        return <Badge className="bg-orange-600 text-white">Bold</Badge>;
      case "minimal":
        return <Badge className="bg-muted-foreground text-white">Minimal</Badge>;
      default:
        return <Badge variant="secondary">{styleKey}</Badge>;
    }
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Invoice Templates</h2>
          <p className="text-sm text-muted-foreground">
            SSoT: Claim invoice visual styles for Schedule Master
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadTemplates}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Template Grid with Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Template List */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Available Templates</CardTitle>
              <CardDescription>
                {templates.length} templates available for claim invoices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={cn(
                    "p-4 rounded-lg border transition-all cursor-pointer",
                    selectedTemplate?.id === template.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => loadPreview(template)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{template.name}</span>
                        {template.is_default && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-600">
                            <Star className="h-3 w-3 mr-1 fill-amber-500" />
                            Default
                          </Badge>
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {template.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {getStyleBadge(template.style_key)}
                        <div className="flex items-center gap-1">
                          <div
                            className="w-4 h-4 rounded border"
                            style={{ backgroundColor: template.primary_color }}
                            title={`Primary: ${template.primary_color}`}
                          />
                          <div
                            className="w-4 h-4 rounded border"
                            style={{ backgroundColor: template.secondary_color }}
                            title={`Secondary: ${template.secondary_color}`}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditSheet(template);
                        }}
                      >
                        <Palette className="h-4 w-4" />
                      </Button>
                      {!template.is_default && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetDefault(template);
                          }}
                          title="Set as default"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="lg:sticky lg:top-4">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {selectedTemplate ? selectedTemplate.name : "Preview"}
                  </CardTitle>
                  {selectedTemplate && (
                    <CardDescription className="text-xs">
                      {selectedTemplate.style_key} style
                    </CardDescription>
                  )}
                </div>
                {selectedTemplate && previewHtml && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Use blob URL to open preview in new window (avoids auth issues)
                      const blob = new Blob([previewHtml], { type: "text/html" });
                      const url = URL.createObjectURL(blob);
                      const newWindow = window.open(url, "_blank");
                      // Clean up blob URL after window loads
                      if (newWindow) {
                        newWindow.onload = () => URL.revokeObjectURL(url);
                      }
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Full Preview
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
              {!selectedTemplate ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Eye className="h-12 w-12 mb-4 opacity-20" />
                  <p className="text-sm">Select a template to preview</p>
                </div>
              ) : previewLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner size={32} className="text-muted-foreground" />
                </div>
              ) : (
                <div
                  className="h-full overflow-auto bg-white dark:bg-muted cursor-pointer"
                  onDoubleClick={() => {
                    // Double-click opens full preview in new window
                    const blob = new Blob([previewHtml], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    const newWindow = window.open(url, "_blank");
                    if (newWindow) {
                      newWindow.onload = () => URL.revokeObjectURL(url);
                    }
                  }}
                  title="Double-click to open full preview"
                >
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-full border-0 pointer-events-none"
                    title={`Preview: ${selectedTemplate.name}`}
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Sheet */}
      <Sheet open={!!editingTemplate} onOpenChange={(open) => !open && closeEditSheet()}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit Template</SheetTitle>
            <SheetDescription>
              Customize colors and visibility settings
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={editForm.name || ""}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={editForm.description || ""}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={editForm.primary_color || "#1e40af"}
                    onChange={(e) => setEditForm({ ...editForm, primary_color: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={editForm.primary_color || ""}
                    onChange={(e) => setEditForm({ ...editForm, primary_color: e.target.value })}
                    placeholder="#1e40af"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary_color">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary_color"
                    type="color"
                    value={editForm.secondary_color || "#64748b"}
                    onChange={(e) => setEditForm({ ...editForm, secondary_color: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={editForm.secondary_color || ""}
                    onChange={(e) => setEditForm({ ...editForm, secondary_color: e.target.value })}
                    placeholder="#64748b"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Font */}
            <div className="space-y-2">
              <Label htmlFor="font_family">Font Family</Label>
              <Input
                id="font_family"
                value={editForm.font_family || ""}
                onChange={(e) => setEditForm({ ...editForm, font_family: e.target.value })}
                placeholder="Inter"
              />
            </div>

            {/* Visibility Toggles */}
            <div className="space-y-4">
              <Label>Visibility Options</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="show_logo" className="font-normal">
                    Show Logo
                  </Label>
                  <Switch
                    id="show_logo"
                    checked={editForm.show_logo ?? true}
                    onCheckedChange={(checked) =>
                      setEditForm({ ...editForm, show_logo: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show_company_details" className="font-normal">
                    Show Company Details
                  </Label>
                  <Switch
                    id="show_company_details"
                    checked={editForm.show_company_details ?? true}
                    onCheckedChange={(checked) =>
                      setEditForm({ ...editForm, show_company_details: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show_bank_details" className="font-normal">
                    Show Bank Details
                  </Label>
                  <Switch
                    id="show_bank_details"
                    checked={editForm.show_bank_details ?? true}
                    onCheckedChange={(checked) =>
                      setEditForm({ ...editForm, show_bank_details: checked })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={closeEditSheet}
                disabled={saving}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSaveTemplate}
                disabled={saving}
              >
                {saving ? (
                  <Spinner size={16} className="mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
