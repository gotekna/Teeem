"use client";

import * as React from "react";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { api, getApiBaseUrl } from "@/lib/api";
import {
  Eye,
  FileText,
  RefreshCw,
  Building2,
  Scale,
  ChevronRight,
  FileCode,
  FileSpreadsheet,
  Cloud,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { ExpandableSection, ExpandButton, useExpandedState } from "@/components/ui/expandable-section";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import { TemplateEditor } from "./TemplateEditor";
import { PoTemplateSelector } from "./PoTemplateSelector";
import { InvoiceTemplatesTab } from "./InvoiceTemplatesTab";
import { PoInfoTab } from "./PoInfoTab";

// SSoT Templates from the document generator (the source of truth)
interface SsotTemplate {
  id: string;
  template_key: string;
  name: string;
  category: string;
  template_type: string;
  layout: string;
  is_active: boolean;
  is_ssot: boolean;
  requires: string[];
  output_filename: string;
  qbcc_required: boolean;
  preview_url: string;
}

// Legacy database templates (deprecated)
interface LegacyTemplate {
  id: number;
  name: string;
  category: string;
  template_type: "word" | "html" | "pdf_overlay" | "sharepoint_fetch";
  layout: string | null;
  is_legal_format: boolean;
  legal_source: string | null;
  is_active: boolean;
  storage_linked: boolean;
  local_template_path: string | null;
  is_legacy?: boolean;
  is_deprecated?: boolean;
}

interface JobOption {
  id: number;
  name: string;
  job_code: string;
}

interface DocumentTemplatesContentProps {
  /** Base path for navigation (e.g., "/settings/company/documents/document-templates") */
  basePath?: string;
  /** Active sub-tab from path segment */
  subTab?: string;
}

const DEFAULT_BASE_PATH = "/settings/company/documents/document-templates";

// No default job - preview uses sample data until user selects a job

const TABS = [
  { id: "po-templates", label: "PO Templates" },
  { id: "po-info", label: "PO Info" },
  { id: "claims", label: "Claims" },
  { id: "ssot", label: "SSoT Templates" },
];

/**
 * DocumentTemplatesContent - SSoT for document template management
 *
 * Organized into 3 tabs:
 * - PO Templates: Purchase order PDF design selection
 * - Claims: Claim invoice visual templates (list + preview + edit)
 * - SSoT Templates: Code-based document templates with job-based preview
 *
 * Refactored Feb 2026: Split into separate tabs, merged invoice templates,
 * added job selector for preview.
 */
export function DocumentTemplatesContent({ basePath = DEFAULT_BASE_PATH, subTab }: DocumentTemplatesContentProps) {
  const router = useRouter();
  const [expanded, toggleExpanded] = useExpandedState("doc-templates");
  const activeTab = TABS.some(t => t.id === subTab) ? subTab! : "po-templates";

  const handleTabChange = useCallback((tabId: string) => {
    const url = tabId === "po-templates"
      ? basePath
      : `${basePath}/${tabId}`;
    router.push(url, { scroll: false });
  }, [router, basePath]);

  return (
    <ExpandableSection expanded={expanded} onToggle={toggleExpanded}>
      <div className={expanded ? "flex flex-col h-full" : "space-y-6"}>
        <Tabs value={activeTab} onValueChange={handleTabChange} className={expanded ? "flex flex-col h-full flex-1 min-h-0" : ""}>
          <div className={expanded ? "px-4 pt-3 pb-2 shrink-0" : ""}>
            <div className="flex items-start gap-2">
              <TabsList className="flex-1 min-w-0">
                {TABS.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ExpandButton expanded={expanded} onToggle={toggleExpanded} />
            </div>
          </div>

          <div className={expanded ? "flex-1 overflow-auto p-4" : ""}>
            <TabsContent value="po-templates" className="mt-4">
              <PoTemplateSelector />
            </TabsContent>

            <TabsContent value="po-info" className="mt-4">
              <PoInfoTab />
            </TabsContent>

            <TabsContent value="claims" className="mt-4">
              <InvoiceTemplatesTab />
            </TabsContent>

            <TabsContent value="ssot" className="mt-4">
              <SsotTemplatesPanel />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </ExpandableSection>
  );
}

/**
 * SSoT Templates Panel - list on left, preview on right, with job selector.
 * Shows all code-based templates from the document generator.
 */
function SsotTemplatesPanel() {
  const [ssotTemplates, setSsotTemplates] = React.useState<SsotTemplate[]>([]);
  const [legacyTemplates, setLegacyTemplates] = React.useState<LegacyTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedTemplate, setSelectedTemplate] = React.useState<SsotTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = React.useState<string>("");
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<string | null>(null);
  const [showLegacy, setShowLegacy] = React.useState(false);

  // Job selector for preview
  const [jobs, setJobs] = React.useState<JobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = React.useState<number | null>(null);
  const [jobsLoading, setJobsLoading] = React.useState(false);

  const apiUrl = getApiBaseUrl();

  React.useEffect(() => {
    loadAllTemplates();
    loadJobs();
  }, []);

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

  const loadAllTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get<{
        success: boolean;
        data: (SsotTemplate | LegacyTemplate)[];
        ssot_count: number;
        legacy_count: number;
      }>("/api/v1/document_templates?include_legacy=true");

      if (response?.success && response.data) {
        const ssot = response.data.filter((t): t is SsotTemplate => 'is_ssot' in t && t.is_ssot === true);
        const legacy = response.data.filter((t): t is LegacyTemplate => 'is_legacy' in t && t.is_legacy === true);
        setSsotTemplates(ssot);
        setLegacyTemplates(legacy);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async (template: SsotTemplate, jobId?: number | null) => {
    setSelectedTemplate(template);
    setPreviewLoading(true);
    setPreviewHtml("");

    try {
      const params: Record<string, string> = { format: "html" };
      const previewJobId = jobId !== undefined ? jobId : selectedJobId;
      if (previewJobId) {
        params.job_id = String(previewJobId);
      }
      const html = await api.getText(`/api/v1/teeem_template_documents/${template.template_key}/preview`, {
        params,
      });
      setPreviewHtml(html);
    } catch (error) {
      console.error("Failed to load preview:", error);
      setPreviewHtml("<p>Failed to load preview</p>");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Reload preview when job changes
  const handleJobChange = (jobId: number | null) => {
    setSelectedJobId(jobId);
    if (selectedTemplate) {
      loadPreview(selectedTemplate, jobId);
    }
  };

  // Group SSoT templates by layout
  const templateGroups = React.useMemo(() => {
    const branded = ssotTemplates.filter(t => t.layout === "teeem");
    const qbcc = ssotTemplates.filter(t => t.layout === "qbcc_official");
    const cloud = ssotTemplates.filter(t => t.template_type === "sharepoint_fetch");

    return [
      {
        title: "Teeem Branded",
        description: "Professional documents with company branding",
        icon: Building2,
        templates: branded,
      },
      {
        title: "QBCC Official",
        description: "Official QBCC compliance documents",
        icon: Scale,
        templates: qbcc,
      },
      {
        title: "Cloud Storage",
        description: "Documents fetched from job folders",
        icon: Cloud,
        templates: cloud,
      },
    ].filter(g => g.templates.length > 0);
  }, [ssotTemplates]);

  const getTemplateTypeIcon = (type: string) => {
    switch (type) {
      case "word": return FileSpreadsheet;
      case "html": return FileCode;
      case "pdf_overlay": return FileText;
      case "sharepoint_fetch": return Cloud;
      default: return FileText;
    }
  };

  const getLayoutBadge = (layout: string, qbccRequired?: boolean) => {
    if (qbccRequired) {
      return <Badge variant="destructive" className="text-xs">QBCC</Badge>;
    }
    if (layout === "teeem") {
      return <Badge className="bg-blue-600 text-white text-xs">TEEEM</Badge>;
    }
    if (layout === "none") {
      return <Badge variant="outline" className="text-xs">PASSTHROUGH</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">{layout.toUpperCase()}</Badge>;
  };

  // If editing a template, show the editor full-screen
  if (editingTemplate) {
    return (
      <TemplateEditor
        templateKey={editingTemplate}
        onClose={() => setEditingTemplate(null)}
      />
    );
  }

  if (loading) {
    return <LoadingOverlay />;
  }

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  return (
    <div className="space-y-4">
      {/* Header with job selector and refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
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
            placeholder={jobsLoading ? "Loading jobs..." : "Select a job for preview..."}
            searchPlaceholder="Search jobs..."
            emptyResults="No jobs found"
            className="w-[280px]"
            clearable
          />
        </div>
        <Button variant="outline" size="sm" onClick={loadAllTemplates}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Main list + preview layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Template List */}
        <div className="space-y-4">
          {templateGroups.map((group) => (
            <Card key={group.title}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <group.icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{group.title}</CardTitle>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {group.templates.length}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {group.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {group.templates.map((template) => {
                    const Icon = getTemplateTypeIcon(template.template_type);
                    return (
                      <div
                        key={template.template_key}
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-md transition-colors cursor-pointer",
                          selectedTemplate?.template_key === template.template_key
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => loadPreview(template)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{template.name}</div>
                            <div className="text-xs text-muted-foreground font-mono truncate">
                              {template.template_key} &bull; {template.category}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {getLayoutBadge(template.layout, template.qbcc_required)}
                          {template.template_type === "html" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingTemplate(template.template_key);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Legacy templates toggle */}
          {legacyTemplates.length > 0 && (
            <div>
              <button
                onClick={() => setShowLegacy(!showLegacy)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className={cn("h-4 w-4 transition-transform", showLegacy && "rotate-90")} />
                <AlertCircle className="h-4 w-4" />
                Legacy Templates ({legacyTemplates.length})
              </button>
              {showLegacy && (
                <Card className="mt-2 border-destructive/30">
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      {legacyTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="flex items-center justify-between p-3 rounded-md bg-muted/30 opacity-60"
                        >
                          <div className="flex items-center gap-3">
                            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium text-sm flex items-center gap-2">
                                {template.name}
                                <Badge variant="outline" className="text-xs text-destructive">
                                  DEPRECATED
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {template.category} &bull; {template.template_type}
                              </div>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            {template.storage_linked ? "Cloud Storage" : "Not Linked"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Preview Panel */}
        <div className="lg:sticky lg:top-4">
          <Card className="h-[700px] flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {selectedTemplate ? selectedTemplate.name : "Preview"}
                  </CardTitle>
                  {selectedTemplate && (
                    <CardDescription className="text-xs">
                      {selectedTemplate.template_key} &bull; {selectedTemplate.layout === "teeem" ? "Teeem Branded" : selectedTemplate.layout === "qbcc_official" ? "QBCC Official" : "Passthrough"}
                      {selectedJob && ` &bull; ${selectedJob.job_code || selectedJob.name}`}
                    </CardDescription>
                  )}
                </div>
                {selectedTemplate && (
                  <div className="flex gap-2">
                    {selectedTemplate.template_type === "html" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setEditingTemplate(selectedTemplate.template_key)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const jobParam = selectedJobId ? `&job_id=${selectedJobId}` : "";
                        window.open(`${apiUrl}/api/v1/teeem_template_documents/${selectedTemplate.template_key}/preview?format=html${jobParam}`, '_blank');
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Full Preview
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
              {!selectedTemplate ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4 opacity-20" />
                  <p className="text-sm">Select a template to preview</p>
                  {selectedJob && (
                    <p className="text-xs mt-1">
                      Using job: {selectedJob.job_code || selectedJob.name}
                    </p>
                  )}
                </div>
              ) : previewLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner size={32} className="text-muted-foreground" />
                </div>
              ) : (
                <div className="h-full overflow-auto bg-white">
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-full border-0"
                    title={`Preview: ${selectedTemplate.name}`}
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

/**
 * @deprecated Use DocumentTemplatesContent instead. This is kept for backwards compatibility.
 */
export function DocumentTemplatesTab(props: DocumentTemplatesContentProps) {
  return <DocumentTemplatesContent {...props} />;
}
