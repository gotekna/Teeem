"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Check,
  Eye,
  FileText,
  Columns3,
  Minus,
  Zap,
  HardHat,
  Star,
  Palette,
  RefreshCw,
} from "lucide-react";

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

const STYLE_ICONS: Record<string, React.ElementType> = {
  classic: FileText,
  modern: Minus,
  bold: Zap,
  minimal: Columns3,
  compact: Columns3,
  construction: HardHat,
};

const STYLE_COLORS: Record<string, string> = {
  classic: "border-slate-300 dark:border-slate-600",
  modern: "border-indigo-300 dark:border-indigo-600",
  bold: "border-orange-300 dark:border-orange-600",
  minimal: "border-gray-200 dark:border-gray-700",
  compact: "border-amber-300 dark:border-amber-600",
  construction: "border-yellow-400 dark:border-yellow-600",
};

const STYLE_ACCENT_BG: Record<string, string> = {
  classic: "bg-slate-50 dark:bg-slate-800/50",
  modern: "bg-indigo-50 dark:bg-indigo-900/20",
  bold: "bg-orange-50 dark:bg-orange-900/20",
  minimal: "bg-gray-50 dark:bg-gray-800/30",
  compact: "bg-amber-50 dark:bg-amber-900/20",
  construction: "bg-yellow-50 dark:bg-yellow-900/20",
};

export function ClaimTemplateSelector() {
  const { toast } = useToast();

  const [templates, setTemplates] = React.useState<ClaimInvoiceTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [settingDefault, setSettingDefault] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewHtml, setPreviewHtml] = React.useState("");
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewTemplate, setPreviewTemplate] = React.useState<ClaimInvoiceTemplate | null>(null);

  React.useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get<{
        success: boolean;
        data: ClaimInvoiceTemplate[];
      }>("/api/v1/claim_invoice_templates");

      if (response?.success && response.data) {
        setTemplates(response.data);
      }
    } catch (error) {
      console.error("Failed to load claim invoice templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const setDefault = async (template: ClaimInvoiceTemplate) => {
    if (template.is_default) return;

    try {
      setSettingDefault(true);
      const response = await api.patch<{ success: boolean }>(
        `/api/v1/claim_invoice_templates/${template.id}/set_default`
      );

      if (response?.success) {
        // Update local state
        setTemplates((prev) =>
          prev.map((t) => ({
            ...t,
            is_default: t.id === template.id,
          }))
        );
        toast({
          title: "Default template updated",
          description: `Claim invoice template set to ${template.name}`,
        });
      }
    } catch (error) {
      console.error("Failed to set default template:", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Could not set default claim invoice template",
      });
    } finally {
      setSettingDefault(false);
    }
  };

  const previewTemplateAction = async (template: ClaimInvoiceTemplate) => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
    setPreviewLoading(true);

    try {
      const response = await api.get<{
        success: boolean;
        data: { template: ClaimInvoiceTemplate; preview_html: string };
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

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner size={24} className="text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Claim Invoice Template</CardTitle>
              <CardDescription>
                Select a visual design for progress claim invoices. Used across all Schedule Master claim stages.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadTemplates}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {templates.map((template) => {
              const Icon = STYLE_ICONS[template.style_key] || FileText;
              const isDefault = template.is_default;
              const borderColor = STYLE_COLORS[template.style_key] || "border-gray-300";
              const accentBg = STYLE_ACCENT_BG[template.style_key] || "bg-gray-50";

              return (
                <div
                  key={template.id}
                  className={cn(
                    "relative border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md",
                    isDefault
                      ? "border-primary ring-2 ring-primary/20 shadow-sm"
                      : borderColor,
                    accentBg
                  )}
                  onClick={() => setDefault(template)}
                >
                  {isDefault && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5">
                        <Check className="h-3 w-3 mr-1" />
                        Default
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-start gap-3 mb-2">
                    <div className={cn(
                      "p-2 rounded-md",
                      isDefault ? "bg-primary/10" : "bg-background"
                    )}>
                      <Icon className={cn(
                        "h-5 w-5",
                        isDefault ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm leading-tight">{template.name}</h4>
                      <div className="flex items-center gap-1 mt-1">
                        <div
                          className="w-3 h-3 rounded border"
                          style={{ backgroundColor: template.primary_color }}
                          title={`Primary: ${template.primary_color}`}
                        />
                        <div
                          className="w-3 h-3 rounded border"
                          style={{ backgroundColor: template.secondary_color }}
                          title={`Secondary: ${template.secondary_color}`}
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {template.description || `${template.style_key} style claim invoice`}
                  </p>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        previewTemplateAction(template);
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[85vh]">
          <DialogHeader>
            <DialogTitle>
              Preview: {previewTemplate?.name || ""}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            {previewLoading ? (
              <div className="flex items-center justify-center h-full">
                <Spinner size={32} className="text-muted-foreground" />
              </div>
            ) : (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full border rounded bg-white"
                title={`Claim Template Preview: ${previewTemplate?.name}`}
                sandbox="allow-same-origin"
              />
            )}
          </div>
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            {previewTemplate && !previewTemplate.is_default && (
              <Button
                onClick={() => {
                  setDefault(previewTemplate);
                  setPreviewOpen(false);
                }}
                disabled={settingDefault}
              >
                {settingDefault ? <Spinner size={14} className="mr-2" /> : null}
                Set as Default
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
