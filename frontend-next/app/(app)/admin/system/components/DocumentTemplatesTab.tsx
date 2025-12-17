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
  Download,
  RefreshCw,
  Building2,
  Scale,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentTemplate {
  key: string;
  name: string;
  category: string;
  layout: string;
  requires: string[];
}

interface TemplateGroup {
  title: string;
  description: string;
  icon: React.ElementType;
  templates: DocumentTemplate[];
}

export function DocumentTemplatesTab() {
  const [templates, setTemplates] = React.useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedTemplate, setSelectedTemplate] = React.useState<DocumentTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = React.useState<string>("");
  const [previewLoading, setPreviewLoading] = React.useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  React.useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: DocumentTemplate[] }>(
        "/api/v1/tekna_documents/templates"
      );
      if (response?.success && response.data) {
        setTemplates(response.data);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async (template: DocumentTemplate) => {
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

  // Group templates by layout
  const templateGroups: TemplateGroup[] = React.useMemo(() => {
    const teknaTemplates = templates.filter(t => t.layout === "tekna");
    const qbccTemplates = templates.filter(t => t.layout === "qbcc_official");

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
  }, [templates]);

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
            View and preview document templates used in workflows
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadTemplates}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

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

      {/* Info Section */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium text-sm mb-2">Template Location</h4>
              <p className="text-xs text-muted-foreground font-mono">
                backend/app/views/tekna_documents/templates/
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2">Design Tokens</h4>
              <p className="text-xs text-muted-foreground font-mono">
                backend/lib/tekna_design_system/design_tokens.json
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-2">Available Merge Fields</h4>
              <p className="text-xs text-muted-foreground">
                @job, @company, @client_names, @dear, @client_1, @client_2, @variation
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
