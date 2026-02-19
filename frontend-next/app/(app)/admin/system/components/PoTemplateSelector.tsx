"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { api, getApiBaseUrl } from "@/lib/api";
import { TemplatePreviewModal } from "./TemplatePreviewModal";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Check,
  Eye,
  FileText,
  Columns3,
  Minus,
  Zap,
  Briefcase,
  HardHat,
  Code,
  RefreshCw,
} from "lucide-react";

interface PoTemplateVariant {
  key: string;
  name: string;
  description: string;
  active: boolean;
}

const VARIANT_ICONS: Record<string, React.ElementType> = {
  classic: FileText,
  modern: Minus,
  bold: Zap,
  compact: Columns3,
  professional: Briefcase,
  construction: HardHat,
  custom: Code,
};

const VARIANT_COLORS: Record<string, string> = {
  classic: "border-gray-300 dark:border-gray-600",
  modern: "border-gray-200 dark:border-gray-700",
  bold: "border-emerald-400 dark:border-emerald-600",
  compact: "border-amber-300 dark:border-amber-600",
  professional: "border-blue-400 dark:border-blue-600",
  construction: "border-yellow-400 dark:border-yellow-600",
  custom: "border-purple-400 dark:border-purple-600",
};

const VARIANT_ACCENT_BG: Record<string, string> = {
  classic: "bg-gray-50 dark:bg-gray-800/50",
  modern: "bg-gray-50 dark:bg-gray-800/30",
  bold: "bg-emerald-50 dark:bg-emerald-900/20",
  compact: "bg-amber-50 dark:bg-amber-900/20",
  professional: "bg-blue-50 dark:bg-blue-900/20",
  construction: "bg-yellow-50 dark:bg-yellow-900/20",
  custom: "bg-purple-50 dark:bg-purple-900/20",
};

export function PoTemplateSelector() {
  const { toast } = useToast();
  const apiUrl = getApiBaseUrl();

  const [variants, setVariants] = React.useState<PoTemplateVariant[]>([]);
  const [currentVariant, setCurrentVariant] = React.useState<string>("classic");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewHtml, setPreviewHtml] = React.useState("");
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewVariant, setPreviewVariant] = React.useState("");
  const [customHtml, setCustomHtml] = React.useState("");
  const [editingCustom, setEditingCustom] = React.useState(false);

  React.useEffect(() => {
    loadVariants();
  }, []);

  const loadVariants = async () => {
    try {
      setLoading(true);
      const response = await api.get<{
        success: boolean;
        data: PoTemplateVariant[];
        current: string;
      }>("/api/v1/purchase_orders/template_variants");

      if (response?.success) {
        setVariants(response.data);
        setCurrentVariant(response.current);
      }

      // Also load custom template if exists
      const settingsResponse = await api.get<{
        success: boolean;
        data: { variant: string; custom_template: string | null };
      }>("/api/v1/tenant_settings/po_template");

      if (settingsResponse?.success) {
        setCustomHtml(settingsResponse.data.custom_template || "");
      }
    } catch (error) {
      console.error("Failed to load PO template variants:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectVariant = async (variantKey: string) => {
    if (variantKey === currentVariant) return;

    // If selecting custom but no template exists, open editor
    if (variantKey === "custom" && !customHtml.trim()) {
      setEditingCustom(true);
      return;
    }

    try {
      setSaving(true);
      const response = await api.put<{ success: boolean }>("/api/v1/tenant_settings/po_template", {
        variant: variantKey,
      });

      if (response?.success) {
        setCurrentVariant(variantKey);
        toast({
          title: "Template updated",
          description: `Purchase order template set to ${variantKey}`,
        });
      }
    } catch (error) {
      console.error("Failed to update PO template:", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Could not update purchase order template",
      });
    } finally {
      setSaving(false);
    }
  };

  const previewTemplate = async (variantKey: string) => {
    setPreviewVariant(variantKey);
    setPreviewOpen(true);
    setPreviewLoading(true);

    try {
      const html = await api.getText(
        `/api/v1/purchase_orders/template_preview?variant=${variantKey}`
      );
      setPreviewHtml(html);
    } catch (error) {
      console.error("Failed to load preview:", error);
      setPreviewHtml("<p>Failed to load preview</p>");
    } finally {
      setPreviewLoading(false);
    }
  };

  const saveCustomTemplate = async () => {
    try {
      setSaving(true);
      const response = await api.put<{ success: boolean }>("/api/v1/tenant_settings/po_template", {
        variant: "custom",
        custom_html: customHtml,
      });

      if (response?.success) {
        setCurrentVariant("custom");
        setEditingCustom(false);
        toast({
          title: "Custom template saved",
          description: "Your custom PO template has been saved and activated",
        });
      }
    } catch (error) {
      console.error("Failed to save custom template:", error);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Could not save custom template",
      });
    } finally {
      setSaving(false);
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

  // Custom template editor view
  if (editingCustom) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Custom PO Template</CardTitle>
              <CardDescription>
                Write HTML/ERB with merge fields: purchase_order, job, company, colour_selections
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingCustom(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={saveCustomTemplate} disabled={saving}>
                {saving ? <Spinner size={14} className="mr-2" /> : null}
                Save & Activate
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Available merge fields:</p>
              <code className="block bg-muted p-2 rounded text-xs">
                {"<%= purchase_order[:purchase_order_number] %>"} {"<%= purchase_order[:total] %>"}{" "}
                {"<%= company[:company_name] %>"} {"<%= job[:full_address] %>"}
              </code>
            </div>
            <textarea
              value={customHtml}
              onChange={(e) => setCustomHtml(e.target.value)}
              className="w-full h-[400px] font-mono text-sm border rounded-md p-3 bg-background resize-y"
              placeholder="Enter your custom HTML template here..."
              spellCheck={false}
            />
          </div>
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
              <CardTitle className="text-base">Purchase Order Template</CardTitle>
              <CardDescription>
                Select a visual design for all purchase order PDFs. Company-wide setting.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadVariants}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {variants.map((variant) => {
              const Icon = VARIANT_ICONS[variant.key] || FileText;
              const isActive = variant.key === currentVariant;
              const borderColor = VARIANT_COLORS[variant.key] || "border-gray-300";
              const accentBg = VARIANT_ACCENT_BG[variant.key] || "bg-gray-50";

              return (
                <div
                  key={variant.key}
                  className={cn(
                    "relative border-2 rounded-lg p-4 cursor-pointer transition-all hover:shadow-md",
                    isActive
                      ? "border-primary ring-2 ring-primary/20 shadow-sm"
                      : borderColor,
                    accentBg
                  )}
                  onClick={() => selectVariant(variant.key)}
                >
                  {isActive && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5">
                        <Check className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-start gap-3 mb-2">
                    <div className={cn(
                      "p-2 rounded-md",
                      isActive ? "bg-primary/10" : "bg-background"
                    )}>
                      <Icon className={cn(
                        "h-5 w-5",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm leading-tight">{variant.name}</h4>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {variant.description}
                  </p>

                  <div className="flex gap-2">
                    {variant.key !== "custom" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          previewTemplate(variant.key);
                        }}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Preview
                      </Button>
                    )}
                    {variant.key === "custom" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCustom(true);
                        }}
                      >
                        <Code className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <TemplatePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={`Preview: ${variants.find((v) => v.key === previewVariant)?.name || previewVariant}`}
        previewHtml={previewHtml}
        loading={previewLoading}
        actionButton={
          previewVariant !== currentVariant ? (
            <Button
              onClick={() => {
                selectVariant(previewVariant);
                setPreviewOpen(false);
              }}
              disabled={saving}
            >
              {saving ? <Spinner size={14} className="mr-2" /> : null}
              Use This Template
            </Button>
          ) : undefined
        }
      />
    </>
  );
}
