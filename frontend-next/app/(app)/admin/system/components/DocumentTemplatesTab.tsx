"use client";

import * as React from "react";
import { useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Landmark,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { TemplateEditor } from "./TemplateEditor";
import { BankStatementTemplatesTab } from "./BankStatementTemplatesTab";
import { InvoiceTemplatesTab } from "./InvoiceTemplatesTab";

// SSoT Templates from TeknaDocumentGenerator (the source of truth)
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
  sharepoint_linked: boolean;
  local_template_path: string | null;
  is_legacy?: boolean;
  is_deprecated?: boolean;
}

interface TemplateGroup {
  title: string;
  description: string;
  icon: React.ElementType;
  templates: SsotTemplate[];
}

// Inner tabs for the Document Templates section
const DOC_INNER_TABS = [
  { id: "documents", label: "Document Templates", icon: FileText },
  { id: "bank-statements", label: "Bank Statements", icon: Landmark },
  { id: "invoice-templates", label: "Invoice Templates", icon: Receipt },
];

interface DocumentTemplatesTabProps {
  innerTab?: string;
  /** Base path for navigation (e.g., "/settings/company/doc-templates" or "/admin/system/company/doc-templates") */
  basePath?: string;
}

const DEFAULT_BASE_PATH = "/admin/system/company/doc-templates";

export function DocumentTemplatesTab({ innerTab: innerTabProp, basePath = DEFAULT_BASE_PATH }: DocumentTemplatesTabProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const subtabFromUrl = searchParams.get("subtab");
  const activeTab = subtabFromUrl || "ssot";

  // Extract innerTab from URL path (format: .../inner/{innerTab})
  // This handles path-based routing like /settings/company/documents/templates/inner/bank-statements
  const innerTabFromPath = useMemo(() => {
    const innerMatch = pathname.match(/\/inner\/([^/]+)/);
    return innerMatch ? innerMatch[1] : null;
  }, [pathname]);

  // Use prop if provided, otherwise fall back to path, then search param, then default
  const innerTab = innerTabProp || innerTabFromPath || searchParams.get("inner") || "documents";

  const handleTabChange = useCallback((tabId: string) => {
    const innerPath = innerTab !== "documents" ? `/inner/${innerTab}` : "";
    const url = tabId === "ssot"
      ? `${basePath}${innerPath}`
      : `${basePath}/${tabId}${innerPath}`;
    router.push(url, { scroll: false });
  }, [router, innerTab, basePath]);

  const handleInnerTabChange = (value: string) => {
    const subtabPath = subtabFromUrl ? `/${subtabFromUrl}` : "";
    router.push(`${basePath}${subtabPath}/inner/${value}`, { scroll: false });
  };

  const [ssotTemplates, setSsotTemplates] = React.useState<SsotTemplate[]>([]);
  const [legacyTemplates, setLegacyTemplates] = React.useState<LegacyTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedTemplate, setSelectedTemplate] = React.useState<SsotTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = React.useState<string>("");
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<string | null>(null);

  const apiUrl = getApiBaseUrl();

  React.useEffect(() => {
    loadAllTemplates();
  }, []);

  const loadAllTemplates = async () => {
    try {
      setLoading(true);

      // Load SSoT templates from TeknaDocumentGenerator (the source of truth)
      const response = await api.get<{
        success: boolean;
        data: (SsotTemplate | LegacyTemplate)[];
        ssot_count: number;
        legacy_count: number;
      }>("/api/v1/document_templates?include_legacy=true");

      if (response?.success && response.data) {
        // Separate SSoT templates from legacy
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

  const loadPreview = async (template: SsotTemplate) => {
    setSelectedTemplate(template);
    setPreviewLoading(true);
    setPreviewHtml("");

    try {
      const html = await api.getText(`/api/v1/tekna_documents/${template.template_key}/preview`, {
        params: { format: "html" }
      });
      setPreviewHtml(html);
    } catch (error) {
      console.error("Failed to load preview:", error);
      setPreviewHtml("<p>Failed to load preview</p>");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Group SSoT templates by layout (for preview tab)
  const templateGroups: TemplateGroup[] = React.useMemo(() => {
    const teknaTemplates = ssotTemplates.filter(t => t.layout === "tekna");
    const qbccTemplates = ssotTemplates.filter(t => t.layout === "qbcc_official");
    const sharepointTemplates = ssotTemplates.filter(t => t.template_type === "sharepoint_fetch");

    return [
      {
        title: "Tekna Branded Documents",
        description: "Professional documents with Tekna branding, logo, and design system",
        icon: Building2,
        templates: teknaTemplates,
      },
      {
        title: "QBCC Official Documents",
        description: "Official QBCC format documents required for compliance",
        icon: Scale,
        templates: qbccTemplates,
      },
      {
        title: "Cloud Storage Sourced",
        description: "Documents fetched from job folders in cloud storage",
        icon: Cloud,
        templates: sharepointTemplates,
      },
    ].filter(g => g.templates.length > 0);
  }, [ssotTemplates]);

  // Filter templates by category for stats
  const htmlTemplateCount = ssotTemplates.filter(t => t.template_type === "html").length;
  const qbccTemplateCount = ssotTemplates.filter(t => t.qbcc_required).length;
  const legacyCount = legacyTemplates.length;

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
    if (layout === "tekna") {
      return <Badge className="bg-blue-600 text-white text-xs">TEKNA</Badge>;
    }
    if (layout === "none") {
      return <Badge variant="outline" className="text-xs">PASSTHROUGH</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">{layout.toUpperCase()}</Badge>;
  };

  // If editing a template, show the editor (only for document templates)
  if (editingTemplate) {
    return (
      <TemplateEditor
        templateKey={editingTemplate}
        onClose={() => setEditingTemplate(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Outer Tabs: Documents vs Bank Statements */}
      <Tabs value={innerTab} onValueChange={handleInnerTabChange}>
        <TabsList className="mb-4">
          {DOC_INNER_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Document Templates Tab Content */}
        <TabsContent value="documents">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Spinner size={32} className="text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  SSoT: Templates from TeknaDocumentGenerator (code-based)
                </p>
                <Button variant="outline" size="sm" onClick={loadAllTemplates}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{ssotTemplates.length}</p>
                <p className="text-xs text-muted-foreground">SSoT Templates</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{htmlTemplateCount}</p>
                <p className="text-xs text-muted-foreground">HTML Templates</p>
              </div>
              <FileCode className="h-8 w-8 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{qbccTemplateCount}</p>
                <p className="text-xs text-muted-foreground">QBCC Documents</p>
              </div>
              <ShieldCheck className="h-8 w-8 text-amber-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-muted-foreground">{legacyCount}</p>
                <p className="text-xs text-muted-foreground">Legacy (Deprecated)</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="ssot">SSoT Templates ({ssotTemplates.length})</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="legacy" className="text-muted-foreground">Legacy ({legacyCount})</TabsTrigger>
        </TabsList>

        {/* SSoT Templates Tab */}
        <TabsContent value="ssot" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                SSoT Templates (TeknaDocumentGenerator)
              </CardTitle>
              <CardDescription>
                Source of truth for all document templates. Code-based, version-controlled.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ssotTemplates.map((template) => {
                  const Icon = getTemplateTypeIcon(template.template_type);
                  return (
                    <div
                      key={template.id}
                      className={cn(
                        "w-full flex items-center justify-between p-3 rounded-md transition-colors",
                        selectedTemplate?.template_key === template.template_key
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <button
                        onClick={() => loadPreview(template)}
                        className="flex items-center gap-3 flex-1 text-left"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {template.name}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {template.template_key} • {template.category}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-2">
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
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Legacy Templates Tab */}
        <TabsContent value="legacy" className="mt-4">
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Legacy Templates (Deprecated)
              </CardTitle>
              <CardDescription>
                Database templates from old Word/SharePoint system. No longer used. Will be removed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {legacyTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No legacy templates found.</p>
              ) : (
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
                            {template.category} • {template.template_type}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        {template.sharepoint_linked ? "Cloud Storage" : "Not Linked"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Template List */}
            <div className="space-y-6">
              {templateGroups.map((group) => (
                <Card key={group.title}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <group.icon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">{group.title}</CardTitle>
                    </div>
                    <CardDescription className="text-xs">
                      {group.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      {group.templates.map((template) => (
                        <div
                          key={template.template_key}
                          className={cn(
                            "w-full flex items-center justify-between p-3 rounded-md transition-colors",
                            selectedTemplate?.template_key === template.template_key
                              ? "bg-primary/10 border border-primary/20"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <button
                            onClick={() => loadPreview(template)}
                            className="flex items-center gap-3 flex-1 text-left"
                          >
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium text-sm">{template.name}</div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {template.category}
                              </div>
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
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
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                          {selectedTemplate.template_key} • {selectedTemplate.layout === "tekna" ? "Tekna Branded" : selectedTemplate.layout === "qbcc_official" ? "QBCC Official" : "Passthrough"}
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
                          onClick={() => window.open(`${apiUrl}/api/v1/tekna_documents/${selectedTemplate.template_key}/preview?format=html`, '_blank')}
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
        </TabsContent>
      </Tabs>

              {/* Info Section */}
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="font-medium text-sm mb-2">SSoT Location</h4>
                      <p className="text-xs text-muted-foreground font-mono">
                        TeknaDocumentGenerator::TEMPLATES
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        backend/app/services/tekna_document_generator.rb
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm mb-2">HTML Templates</h4>
                      <p className="text-xs text-muted-foreground font-mono">
                        app/views/tekna_documents/templates/
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Layouts: tekna.html.erb, qbcc_official.html.erb
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-sm mb-2">Available Merge Fields</h4>
                      <p className="text-xs text-muted-foreground">
                        @job, @company, @client_names, @dear, @clients
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        @colour_selections, @specifications
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Bank Statement Templates Tab Content */}
        <TabsContent value="bank-statements">
          <BankStatementTemplatesTab />
        </TabsContent>

        {/* Invoice Templates Tab Content */}
        <TabsContent value="invoice-templates">
          <InvoiceTemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
