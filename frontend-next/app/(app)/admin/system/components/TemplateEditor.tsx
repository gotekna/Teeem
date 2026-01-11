"use client";

import * as React from "react";
import { useUrlSubTabs } from "@/hooks/useUrlTabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { api, getApiBaseUrl } from "@/lib/api";
import {
  Save,
  Eye,
  Code,
  Layout,
  FileText,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TemplateEditorProps {
  templateKey: string;
  onClose: () => void;
}

interface TemplateData {
  template_key: string;
  name: string;
  category: string;
  layout: string;
  template_content: string | null;
  layout_content: string | null;
  preview_url: string;
  available_layouts: string[];
}

interface LayoutData {
  name: string;
  display_name: string;
  content: string;
  description: string;
  templates_using: string[];
}

export function TemplateEditor({ templateKey, onClose }: TemplateEditorProps) {
  // SSoT: URL subtab state managed by useUrlSubTabs hook
  const [activeTab, handleTabChange] = useUrlSubTabs("content");

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [template, setTemplate] = React.useState<TemplateData | null>(null);
  const [layouts, setLayouts] = React.useState<LayoutData[]>([]);
  const [templateContent, setTemplateContent] = React.useState<string>("");
  const [layoutContent, setLayoutContent] = React.useState<string>("");
  const [selectedLayout, setSelectedLayout] = React.useState<string>("");
  const [hasChanges, setHasChanges] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const [previewHtml, setPreviewHtml] = React.useState<string>("");
  const [previewLoading, setPreviewLoading] = React.useState(false);

  const apiUrl = getApiBaseUrl();

  React.useEffect(() => {
    loadTemplate();
    loadLayouts();
  }, [templateKey]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: TemplateData }>(
        `/api/v1/document_templates/ssot/${templateKey}`
      );
      if (response?.success && response.data) {
        setTemplate(response.data);
        setTemplateContent(response.data.template_content || "");
        setSelectedLayout(response.data.layout);
      }
    } catch (error) {
      console.error("Failed to load template:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadLayouts = async () => {
    try {
      const response = await api.get<{ success: boolean; data: LayoutData[] }>(
        "/api/v1/document_templates/layouts"
      );
      if (response?.success && response.data) {
        setLayouts(response.data);
      }
    } catch (error) {
      console.error("Failed to load layouts:", error);
    }
  };

  const loadLayoutContent = async (layoutName: string) => {
    const layout = layouts.find((l) => l.name === layoutName);
    if (layout) {
      setLayoutContent(layout.content);
      setSelectedLayout(layoutName);
    }
  };

  const handleTemplateChange = (value: string) => {
    setTemplateContent(value);
    setHasChanges(true);
    setSaveMessage(null);
  };

  const handleLayoutChange = (value: string) => {
    setLayoutContent(value);
    setHasChanges(true);
    setSaveMessage(null);
  };

  const saveTemplate = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);

      const response = await api.put<{ success: boolean; message: string }>(
        `/api/v1/document_templates/ssot/${templateKey}`,
        { template_content: templateContent }
      );

      if (response?.success) {
        setSaveMessage({ type: "success", text: "Template saved successfully" });
        setHasChanges(false);
      } else {
        setSaveMessage({ type: "error", text: "Failed to save template" });
      }
    } catch (error) {
      console.error("Failed to save template:", error);
      setSaveMessage({ type: "error", text: "Error saving template" });
    } finally {
      setSaving(false);
    }
  };

  const saveLayout = async () => {
    try {
      setSaving(true);
      setSaveMessage(null);

      const response = await api.put<{ success: boolean; message: string }>(
        `/api/v1/document_templates/layouts/${selectedLayout}`,
        { content: layoutContent }
      );

      if (response?.success) {
        setSaveMessage({ type: "success", text: "Layout saved successfully" });
        setHasChanges(false);
        // Reload layouts to get updated content
        loadLayouts();
      } else {
        setSaveMessage({ type: "error", text: "Failed to save layout" });
      }
    } catch (error) {
      console.error("Failed to save layout:", error);
      setSaveMessage({ type: "error", text: "Error saving layout" });
    } finally {
      setSaving(false);
    }
  };

  const loadPreview = async () => {
    setPreviewLoading(true);
    try {
      const html = await api.getText(`/api/v1/tekna_documents/${templateKey}/preview`, {
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

  // Load preview when switching to preview tab
  React.useEffect(() => {
    if (activeTab === "preview") {
      loadPreview();
    }
  }, [activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-muted-foreground">Template not found</p>
        <Button variant="outline" className="mt-4" onClick={onClose}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {template.name}
              {hasChanges && (
                <Badge variant="outline" className="text-xs text-amber-600">
                  Unsaved Changes
                </Badge>
              )}
            </h2>
            <p className="text-sm text-muted-foreground font-mono">
              {template.template_key} • {template.layout} layout
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveMessage && (
            <div className={cn(
              "flex items-center gap-1 text-sm",
              saveMessage.type === "success" ? "text-green-600" : "text-destructive"
            )}>
              {saveMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {saveMessage.text}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`${apiUrl}/api/v1/tekna_documents/${templateKey}/preview?format=html`, '_blank')}
          >
            <Eye className="h-4 w-4 mr-2" />
            Full Preview
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="content" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Template Content
          </TabsTrigger>
          <TabsTrigger value="layout" className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            Layout (Header/Footer)
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        {/* Template Content Tab */}
        <TabsContent value="content" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Template Content (ERB)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Edit the template body content. Uses ERB syntax for dynamic fields.
                  </CardDescription>
                </div>
                <Button onClick={saveTemplate} disabled={saving || !hasChanges}>
                  {saving ? (
                    <Spinner size={16} className="mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Available fields info */}
                <div className="bg-muted/50 p-3 rounded-md">
                  <p className="text-xs font-medium mb-2">Available Merge Fields:</p>
                  <div className="flex flex-wrap gap-2">
                    {["job", "company", "client_names", "dear", "clients", "client_1", "client_2", "colour_selections", "specifications", "generated_date"].map((field) => (
                      <Badge key={field} variant="outline" className="text-xs font-mono">
                        @{field}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Code editor */}
                <textarea
                  value={templateContent}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full h-[500px] font-mono text-sm p-4 border rounded-md bg-slate-950 text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  spellCheck={false}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Layout Tab */}
        <TabsContent value="layout" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Layout selector */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Layouts</CardTitle>
                <CardDescription className="text-xs">
                  Select a layout to edit header/footer
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {layouts.map((layout) => (
                    <button
                      key={layout.name}
                      onClick={() => loadLayoutContent(layout.name)}
                      className={cn(
                        "w-full text-left p-3 rounded-md transition-colors",
                        selectedLayout === layout.name
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <div className="font-medium text-sm">{layout.display_name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {layout.description}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Used by: {layout.templates_using?.length || 0} templates
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Layout editor */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Layout className="h-5 w-5" />
                        {selectedLayout ? `${selectedLayout}.html.erb` : "Select a layout"}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Edit header, footer, and page structure
                      </CardDescription>
                    </div>
                    {selectedLayout && (
                      <Button onClick={saveLayout} disabled={saving || !hasChanges}>
                        {saving ? (
                          <Spinner size={16} className="mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Layout
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedLayout ? (
                    <textarea
                      value={layoutContent}
                      onChange={(e) => handleLayoutChange(e.target.value)}
                      className="w-full h-[500px] font-mono text-sm p-4 border rounded-md bg-slate-950 text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      spellCheck={false}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-[500px] text-muted-foreground">
                      Select a layout from the list to edit
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="mt-4">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Document Preview</CardTitle>
                  <CardDescription className="text-xs">
                    Preview uses sample data. Save changes and refresh to see updates.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadPreview} disabled={previewLoading}>
                  <RefreshCw className={cn("h-4 w-4 mr-2", previewLoading && "animate-spin")} />
                  Refresh Preview
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-hidden p-0">
              {previewLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner size={32} className="text-muted-foreground" />
                </div>
              ) : (
                <div className="h-full overflow-auto bg-white">
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-full border-0"
                    title={`Preview: ${template.name}`}
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
