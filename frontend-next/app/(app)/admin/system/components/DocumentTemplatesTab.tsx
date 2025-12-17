"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  Loader2,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// HTML templates from TeknaDocuments (for preview)
interface HtmlTemplate {
  key: string;
  name: string;
  category: string;
  layout: string;
  requires: string[];
}

// Database templates (unified view)
interface DbTemplate {
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
}

interface TemplateGroup {
  title: string;
  description: string;
  icon: React.ElementType;
  templates: HtmlTemplate[];
}

export function DocumentTemplatesTab() {
  const [htmlTemplates, setHtmlTemplates] = React.useState<HtmlTemplate[]>([]);
  const [dbTemplates, setDbTemplates] = React.useState<DbTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedTemplate, setSelectedTemplate] = React.useState<HtmlTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = React.useState<string>("");
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<string>("all");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  React.useEffect(() => {
    loadAllTemplates();
  }, []);

  const loadAllTemplates = async () => {
    try {
      setLoading(true);

      // Load HTML templates (for preview functionality)
      const htmlResponse = await api.get<{ success: boolean; data: HtmlTemplate[] }>(
        "/api/v1/tekna_documents/templates"
      );
      if (htmlResponse?.success && htmlResponse.data) {
        setHtmlTemplates(htmlResponse.data);
      }

      // Load all DB templates
      const dbResponse = await api.get<{ success: boolean; data: DbTemplate[] }>(
        "/api/v1/document_templates"
      );
      if (dbResponse?.success && dbResponse.data) {
        setDbTemplates(dbResponse.data);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async (template: HtmlTemplate) => {
    setSelectedTemplate(template);
    setPreviewLoading(true);
    setPreviewHtml("");

    try {
      const response = await fetch(`${apiUrl}/api/v1/tekna_documents/${template.key}/preview?format=html`);
      if (response.ok) {
        const html = await response.text();
        setPreviewHtml(html);
      }
    } catch (error) {
      console.error("Failed to load preview:", error);
      setPreviewHtml("<p>Failed to load preview</p>");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Group HTML templates by layout (for preview tab)
  const templateGroups: TemplateGroup[] = React.useMemo(() => {
    const teknaTemplates = htmlTemplates.filter(t => t.layout === "tekna");
    const qbccTemplates = htmlTemplates.filter(t => t.layout === "qbcc_official");

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
    ];
  }, [htmlTemplates]);

  // Filter DB templates by type
  const wordTemplates = dbTemplates.filter(t => t.template_type === "word");
  const htmlDbTemplates = dbTemplates.filter(t => t.template_type === "html");
  const legalTemplates = dbTemplates.filter(t => t.is_legal_format);

  const getTemplateTypeIcon = (type: string) => {
    switch (type) {
      case "word": return FileSpreadsheet;
      case "html": return FileCode;
      case "pdf_overlay": return FileText;
      case "sharepoint_fetch": return Cloud;
      default: return FileText;
    }
  };

  const getTemplateTypeBadge = (template: DbTemplate) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      word: "default",
      html: "secondary",
      pdf_overlay: "outline",
      sharepoint_fetch: "outline",
    };
    return (
      <Badge variant={variants[template.template_type] || "outline"} className="text-xs">
        {template.template_type.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Document Templates</h2>
          <p className="text-sm text-muted-foreground">
            Unified view of all document templates (Word, HTML, PDF)
          </p>
        </div>
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
                <p className="text-2xl font-bold">{dbTemplates.length}</p>
                <p className="text-xs text-muted-foreground">Total Templates</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{wordTemplates.length}</p>
                <p className="text-xs text-muted-foreground">Word (SharePoint)</p>
              </div>
              <FileSpreadsheet className="h-8 w-8 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{htmlDbTemplates.length}</p>
                <p className="text-xs text-muted-foreground">HTML (Local)</p>
              </div>
              <FileCode className="h-8 w-8 text-green-500/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{legalTemplates.length}</p>
                <p className="text-xs text-muted-foreground">Legal (QBCC/HIA)</p>
              </div>
              <ShieldCheck className="h-8 w-8 text-amber-500/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Templates</TabsTrigger>
          <TabsTrigger value="word">Word ({wordTemplates.length})</TabsTrigger>
          <TabsTrigger value="html">HTML ({htmlDbTemplates.length})</TabsTrigger>
          <TabsTrigger value="preview">HTML Preview</TabsTrigger>
        </TabsList>

        {/* All Templates Tab */}
        <TabsContent value="all" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {dbTemplates.map((template) => {
                  const Icon = getTemplateTypeIcon(template.template_type);
                  return (
                    <div
                      key={template.id}
                      className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {template.name}
                            {template.is_legal_format && (
                              <Badge variant="destructive" className="text-xs">
                                LEGAL
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {template.category} • {template.layout || "default"}
                            {template.sharepoint_linked && " • SharePoint"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTemplateTypeBadge(template)}
                        {!template.is_active && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Word Templates Tab */}
        <TabsContent value="word" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Word Templates (SharePoint)
              </CardTitle>
              <CardDescription>
                Templates stored in SharePoint, processed with Sablon mail-merge
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {wordTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          {template.name}
                          {template.is_legal_format && (
                            <Badge variant="destructive" className="text-xs">
                              {template.legal_source?.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {template.category}
                          {template.sharepoint_linked && " • Linked to SharePoint"}
                        </div>
                      </div>
                    </div>
                    <Badge variant={template.sharepoint_linked ? "default" : "outline"} className="text-xs">
                      {template.sharepoint_linked ? "Connected" : "Not Linked"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HTML Templates Tab */}
        <TabsContent value="html" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCode className="h-5 w-5" />
                HTML Templates (Local)
              </CardTitle>
              <CardDescription>
                Templates stored in codebase, rendered with Grover (HTML to PDF)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {htmlDbTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-3 rounded-md hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <FileCode className="h-4 w-4 text-green-500" />
                      <div>
                        <div className="font-medium text-sm">{template.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {template.local_template_path || "N/A"}
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {template.layout || "default"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HTML Preview Tab */}
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
                        <button
                          key={template.key}
                          onClick={() => loadPreview(template)}
                          className={cn(
                            "w-full flex items-center justify-between p-3 rounded-md text-left transition-colors",
                            selectedTemplate?.key === template.key
                              ? "bg-primary/10 border border-primary/20"
                              : "hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium text-sm">{template.name}</div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {template.category}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {template.layout === "tekna" ? "Tekna" : "QBCC"}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </button>
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
                          {selectedTemplate.key} • {selectedTemplate.layout === "tekna" ? "Tekna Branded" : "QBCC Official"}
                        </CardDescription>
                      )}
                    </div>
                    {selectedTemplate && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`${apiUrl}/api/v1/tekna_documents/${selectedTemplate.key}/preview?format=html`, '_blank')}
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
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
              <h4 className="font-medium text-sm mb-2">HTML Templates</h4>
              <p className="text-xs text-muted-foreground font-mono">
                backend/app/views/tekna_documents/templates/
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2">Word Templates</h4>
              <p className="text-xs text-muted-foreground">
                SharePoint: Warehousing/Templates/
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2">Available Merge Fields</h4>
              <p className="text-xs text-muted-foreground">
                @job, @company, @client_names, @dear, @client_1, @client_2
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
