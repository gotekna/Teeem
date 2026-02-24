"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { api, getApiBaseUrl } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
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
  Download,
  Upload,
} from "lucide-react";

interface PoTemplateVariant {
  key: string;
  name: string;
  description: string;
  active: boolean;
}

interface JobOption {
  id: number;
  name: string;
  job_code: string;
}

interface PoOption {
  id: number;
  purchase_order_number: string;
  description: string | null;
  status: string;
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

// No default job - preview uses sample data until user selects a job

/** Wraps HTML content in an A4-aspect page container for full-preview new tabs */
function openA4Preview(html: string, title?: string) {
  const pageHtml = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${title || "Preview"}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #e5e5e5; display: flex; justify-content: center; padding: 20px 0; min-height: 100vh; }
  .a4-page { width: 210mm; min-height: 297mm; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.15); padding: 0; overflow: auto; }
  @media print { body { padding: 0; background: white; } .a4-page { box-shadow: none; width: 100%; } }
  @media (max-width: 240mm) { .a4-page { width: 100%; } }
</style>
</head><body>
<div class="a4-page" id="content"></div>
<script>
  var content = document.getElementById('content');
  var shadow = content.attachShadow({ mode: 'open' });
  shadow.innerHTML = ${JSON.stringify(html)};
</script>
</body></html>`;

  const blob = new Blob([pageHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const newWindow = window.open(url, "_blank");
  if (newWindow) {
    newWindow.onload = () => URL.revokeObjectURL(url);
  }
}

export function PoTemplateSelector() {
  const { toast } = useToast();
  const apiUrl = getApiBaseUrl();

  const [variants, setVariants] = React.useState<PoTemplateVariant[]>([]);
  const [currentVariant, setCurrentVariant] = React.useState<string>("classic");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [selectedVariantKey, setSelectedVariantKey] = React.useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = React.useState("");
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [customHtml, setCustomHtml] = React.useState("");
  const [editingCustom, setEditingCustom] = React.useState(false);

  // Job + PO selectors for live data preview
  const [jobs, setJobs] = React.useState<JobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = React.useState<number | null>(null);
  const [jobsLoading, setJobsLoading] = React.useState(false);
  const [pos, setPos] = React.useState<PoOption[]>([]);
  const [selectedPoId, setSelectedPoId] = React.useState<number | null>(null);
  const [posLoading, setPosLoading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    loadVariants();
    loadJobs();
  }, []);

  // Load POs when job changes
  React.useEffect(() => {
    if (selectedJobId) {
      loadPosForJob(selectedJobId);
    } else {
      setPos([]);
      setSelectedPoId(null);
    }
  }, [selectedJobId]);

  const loadJobs = async () => {
    try {
      setJobsLoading(true);
      const response = await api.get<{ jobs?: JobOption[]; default_preview_job_id?: number | null }>("/api/v1/jobs/for_select");
      if (response?.jobs) {
        setJobs(response.jobs);
        // Auto-select: backend returns most recent job with POs (tenant-dynamic)
        if (!selectedJobId && response.default_preview_job_id) {
          setSelectedJobId(response.default_preview_job_id);
        }
      }
    } catch (error) {
      console.error("Failed to load jobs:", error);
    } finally {
      setJobsLoading(false);
    }
  };

  const loadPosForJob = async (jobId: number) => {
    try {
      setPosLoading(true);
      const response = await api.get<{
        success: boolean;
        data: PoOption[];
      }>(`/api/v1/purchase_orders/for_job?job_id=${jobId}`);

      if (response?.success && response.data) {
        setPos(response.data);
        // Auto-select first PO if available
        if (response.data.length > 0) {
          setSelectedPoId(response.data[0].id);
        } else {
          setSelectedPoId(null);
        }
      }
    } catch (error) {
      console.error("Failed to load POs:", error);
      setPos([]);
      setSelectedPoId(null);
    } finally {
      setPosLoading(false);
    }
  };

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
        // Auto-preview the active variant
        loadPreview(response.current);
      }

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

  const loadPreview = async (variantKey: string, jobId?: number | null, poId?: number | null) => {
    if (variantKey === "custom") return;
    setSelectedVariantKey(variantKey);
    setPreviewLoading(true);
    setPreviewHtml("");

    try {
      const params = new URLSearchParams({ variant: variantKey });
      const previewPoId = poId !== undefined ? poId : selectedPoId;
      const previewJobId = jobId !== undefined ? jobId : selectedJobId;

      if (previewPoId) {
        params.set("purchase_order_id", String(previewPoId));
      } else if (previewJobId) {
        params.set("job_id", String(previewJobId));
      }

      const html = await api.getText(
        `/api/v1/purchase_orders/template_preview?${params.toString()}`
      );
      setPreviewHtml(html);
    } catch (error) {
      console.error("Failed to load preview:", error);
      setPreviewHtml("<p>Failed to load preview</p>");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleJobChange = (jobId: number | null) => {
    setSelectedJobId(jobId);
    setSelectedPoId(null);
    // Preview will reload after POs load (via useEffect)
    if (!jobId && selectedVariantKey) {
      // No job selected - preview with sample data
      loadPreview(selectedVariantKey, null, null);
    }
  };

  const handlePoChange = (poId: number | null) => {
    setSelectedPoId(poId);
    if (selectedVariantKey) {
      loadPreview(selectedVariantKey, selectedJobId, poId);
    }
  };

  const selectVariant = async (variantKey: string) => {
    if (variantKey === currentVariant) return;

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

  const handleExport = async () => {
    const variant = selectedVariantKey || currentVariant;
    try {
      const html = await api.getText(
        `/api/v1/purchase_orders/template_export?variant=${variant}`
      );
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `po-template-${variant}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Template exported",
        description: `Downloaded po-template-${variant}.html`,
      });
    } catch (error) {
      console.error("Failed to export template:", error);
      toast({
        variant: "destructive",
        title: "Export failed",
        description: "Could not export template",
      });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-imported
    event.target.value = "";

    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      toast({
        variant: "destructive",
        title: "Invalid file",
        description: "Please select an .html file",
      });
      return;
    }

    try {
      setImporting(true);
      const htmlContent = await file.text();

      // Save as custom template and activate
      const response = await api.put<{ success: boolean }>("/api/v1/tenant_settings/po_template", {
        variant: "custom",
        custom_html: htmlContent,
      });

      if (response?.success) {
        setCurrentVariant("custom");
        setCustomHtml(htmlContent);
        setSelectedVariantKey("custom");
        toast({
          title: "Template imported",
          description: `${file.name} saved as custom template and activated`,
        });
      }
    } catch (error) {
      console.error("Failed to import template:", error);
      toast({
        variant: "destructive",
        title: "Import failed",
        description: "Could not import template",
      });
    } finally {
      setImporting(false);
    }
  };

  // Reload preview when POs load for the first time (auto-select first PO)
  const prevPosRef = React.useRef<PoOption[]>([]);
  React.useEffect(() => {
    if (pos.length > 0 && prevPosRef.current.length === 0 && selectedVariantKey) {
      loadPreview(selectedVariantKey, selectedJobId, pos[0].id);
    }
    prevPosRef.current = pos;
  }, [pos]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
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

  const selectedVariant = variants.find(v => v.key === selectedVariantKey);
  const selectedJob = jobs.find(j => j.id === selectedJobId);
  const selectedPo = pos.find(p => p.id === selectedPoId);

  return (
    <div className="space-y-4">
      {/* Header with job/PO selectors */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Preview Job:</Label>
          <ComboboxDropdown
            items={jobs.map(j => ({
              id: String(j.id),
              label: `${j.job_code || ""} ${j.name}`.trim(),
            }))}
            selectedItem={selectedJob ? {
              id: String(selectedJob.id),
              label: `${selectedJob.job_code || ""} ${selectedJob.name}`.trim(),
            } : undefined}
            onSelect={(item) => handleJobChange(Number(item.id))}
            onClear={() => handleJobChange(null)}
            placeholder={jobsLoading ? "Loading jobs..." : "Select a job..."}
            searchPlaceholder="Search jobs..."
            emptyResults="No jobs found"
            className="w-[240px]"
            clearable
          />
          {selectedJobId && (
            <>
              <Label className="text-sm text-muted-foreground whitespace-nowrap">PO:</Label>
              <ComboboxDropdown
                items={pos.map(p => ({
                  id: String(p.id),
                  label: `${p.purchase_order_number}${p.description ? ` - ${p.description}` : ""}`,
                }))}
                selectedItem={selectedPo ? {
                  id: String(selectedPo.id),
                  label: `${selectedPo.purchase_order_number}${selectedPo.description ? ` - ${selectedPo.description}` : ""}`,
                } : undefined}
                onSelect={(item) => handlePoChange(Number(item.id))}
                onClear={() => handlePoChange(null)}
                placeholder={posLoading ? "Loading POs..." : pos.length === 0 ? "No POs for this job" : "Select a PO..."}
                searchPlaceholder="Search POs..."
                emptyResults="No purchase orders found"
                className="w-[280px]"
                clearable
              />
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            title="Export current variant as HTML file"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            title="Import HTML file as custom template"
          >
            {importing ? <Spinner size={14} className="mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm"
            className="hidden"
            onChange={handleImport}
          />
          <Button variant="outline" size="sm" onClick={loadVariants}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* List + Preview layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Template List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">PO Design Variants</CardTitle>
            <CardDescription className="text-xs">
              {variants.length} variants available. Active variant is used for all PO PDFs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {variants.map((variant) => {
              const Icon = VARIANT_ICONS[variant.key] || FileText;
              const isActive = variant.key === currentVariant;
              const isSelected = variant.key === selectedVariantKey;

              return (
                <div
                  key={variant.key}
                  className={cn(
                    "p-3 rounded-lg border transition-all cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => {
                    if (variant.key === "custom") {
                      setSelectedVariantKey("custom");
                    } else {
                      loadPreview(variant.key);
                    }
                  }}
                  onDoubleClick={() => selectVariant(variant.key)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-md shrink-0",
                      isActive ? "bg-primary/10" : "bg-muted/50"
                    )}>
                      <Icon className={cn(
                        "h-4 w-4",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{variant.name}</span>
                        {isActive && (
                          <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0">
                            <Check className="h-3 w-3 mr-0.5" />
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {variant.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {variant.key === "custom" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCustom(true);
                          }}
                        >
                          <Code className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      ) : !isActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectVariant(variant.key);
                          }}
                          disabled={saving}
                        >
                          {saving ? <Spinner size={12} className="mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                          Use
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <div className="lg:sticky lg:top-4">
          <Card className="h-[700px] flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {selectedVariant ? selectedVariant.name : "Preview"}
                  </CardTitle>
                  {selectedVariant && (
                    <CardDescription className="text-xs">
                      {selectedVariant.description}
                      {selectedPo && ` \u2022 ${selectedPo.purchase_order_number}`}
                      {!selectedPo && selectedJob && ` \u2022 ${selectedJob.job_code || selectedJob.name}`}
                      {!selectedPo && !selectedJob && " \u2022 Sample data"}
                    </CardDescription>
                  )}
                </div>
                {selectedVariant && previewHtml && (
                  <div className="flex gap-2">
                    {selectedVariantKey !== currentVariant && (
                      <Button
                        size="sm"
                        onClick={() => selectVariant(selectedVariantKey!)}
                        disabled={saving}
                      >
                        {saving ? <Spinner size={14} className="mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                        Use This
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openA4Preview(previewHtml, `PO Preview: ${selectedVariant?.name || ""}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Full Preview
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
              {!selectedVariantKey || selectedVariantKey === "custom" ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4 opacity-20" />
                  <p className="text-sm">
                    {selectedVariantKey === "custom"
                      ? "Custom templates use your own HTML"
                      : "Select a template to preview"}
                  </p>
                </div>
              ) : previewLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner size={32} className="text-muted-foreground" />
                </div>
              ) : (
                <div className="h-full overflow-auto bg-white dark:bg-muted">
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-full border-0"
                    title={`Preview: ${selectedVariant?.name || ""}`}
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
