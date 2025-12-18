"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderTree,
  Save,
  RefreshCw,
  ExternalLink,
  Info,
  FileCode,
  Briefcase,
  Building2,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface SharePointConfig {
  configured: boolean;
  site_url: string | null;
  site_id: string | null;
  drive_id: string | null;
  drive_name: string | null;
  root_path: string;
  paths: {
    jobs: string;
    people: string;
    company: string;
    contacts: string;
  };
  templates: {
    job: string;
    company: string;
    people: string;
    contacts: string;
  };
}

export function SharePointTab() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [config, setConfig] = React.useState<SharePointConfig | null>(null);
  const [formData, setFormData] = React.useState({
    // Site configuration
    sharepoint_site_url: "",
    sharepoint_site_id: "",
    sharepoint_drive_id: "",
    sharepoint_drive_name: "",
    // Folder paths
    sharepoint_root_path: "/Shared Documents",
    sharepoint_jobs_path: "TEEEM Jobs",
    sharepoint_people_path: "Corporate/People",
    sharepoint_company_path: "00 TEEEM PRIVATE",
    sharepoint_contacts_path: "Contacts",
    // Path templates
    sharepoint_job_template: "{{JobCode}}/{{Category}}",
    sharepoint_company_template: "{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}",
    sharepoint_people_template: "{{ContactName}}/{{Category}}",
    sharepoint_contacts_template: "{{ContactName}}/{{Category}}",
  });

  // Load SharePoint config on mount
  React.useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: SharePointConfig }>(
        "/api/v1/corporate_company_settings/sharepoint"
      );
      if (response?.success && response.data) {
        setConfig(response.data);
        setFormData({
          sharepoint_site_url: response.data.site_url || "",
          sharepoint_site_id: response.data.site_id || "",
          sharepoint_drive_id: response.data.drive_id || "",
          sharepoint_drive_name: response.data.drive_name || "",
          sharepoint_root_path: response.data.root_path || "/Shared Documents",
          sharepoint_jobs_path: response.data.paths?.jobs || "TEEEM Jobs",
          sharepoint_people_path: response.data.paths?.people || "Corporate/People",
          sharepoint_company_path: response.data.paths?.company || "00 TEEEM PRIVATE",
          sharepoint_contacts_path: response.data.paths?.contacts || "Contacts",
          sharepoint_job_template: response.data.templates?.job || "{{JobCode}}/{{Category}}",
          sharepoint_company_template: response.data.templates?.company || "{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}",
          sharepoint_people_template: response.data.templates?.people || "{{ContactName}}/{{Category}}",
          sharepoint_contacts_template: response.data.templates?.contacts || "{{ContactName}}/{{Category}}",
        });
      }
    } catch (error) {
      console.error("Failed to load SharePoint config:", error);
      toast({
        title: "Error",
        description: "Failed to load SharePoint configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await api.patch<{ success: boolean; data: SharePointConfig }>(
        "/api/v1/corporate_company_settings/sharepoint",
        { sharepoint: formData }
      );
      if (response?.success) {
        setConfig(response.data);
        toast({
          title: "Saved",
          description: "SharePoint configuration updated successfully",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to save SharePoint configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      const response = await api.post<{ success: boolean; message?: string; error?: string; site?: { name: string; web_url: string } }>(
        "/api/v1/corporate_company_settings/sharepoint/test"
      );
      if (response?.success) {
        toast({
          title: "Connection Successful",
          description: `Connected to ${response.site?.name || "SharePoint"}`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: response?.error || "Could not connect to SharePoint",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Connection Failed",
        description: error?.message || "Could not connect to SharePoint",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Build full path preview
  const getFullPath = (subPath: string, template?: string) => {
    const root = formData.sharepoint_root_path.replace(/\/$/, "");
    const sub = subPath.replace(/^\//, "").replace(/\/$/, "");
    const tmpl = template ? `/${template.replace(/^\//, "")}` : "";
    return `${root}/${sub}${tmpl}`.replace(/\/+/g, "/");
  };

  // Resolve template preview with example values
  const resolveTemplatePreview = (template: string) => {
    return template
      .replace("{{JobCode}}", "JOB-001")
      .replace("{{Category}}", "Plans")
      .replace("{{CompanyGroup}}", "Tekna Group")
      .replace("{{CompanyCode}}", "TEK")
      .replace("{{Folder}}", "ASIC")
      .replace("{{ContactName}}", "John Smith");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">SharePoint Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Single Source of Truth for all SharePoint document storage paths
          </p>
        </div>
        <Badge
          variant={config?.configured ? "default" : "secondary"}
          className={cn(
            "gap-1",
            config?.configured && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          )}
        >
          {config?.configured ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3" />
              Not Configured
            </>
          )}
        </Badge>
      </div>

      {/* Site Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            SharePoint Site
          </CardTitle>
          <CardDescription>
            Configure the SharePoint site where all documents will be stored
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="site_url">Site URL</Label>
              <Input
                id="site_url"
                value={formData.sharepoint_site_url}
                onChange={(e) => handleChange("sharepoint_site_url", e.target.value)}
                placeholder="https://gotekna.sharepoint.com/sites/TEEEM"
              />
              <p className="text-xs text-muted-foreground">
                The full URL to your SharePoint site
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="site_id">Site ID</Label>
              <Input
                id="site_id"
                value={formData.sharepoint_site_id}
                onChange={(e) => handleChange("sharepoint_site_id", e.target.value)}
                placeholder="gotekna.sharepoint.com,abc123..."
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Microsoft Graph Site ID (from API)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="drive_id">Drive ID</Label>
              <Input
                id="drive_id"
                value={formData.sharepoint_drive_id}
                onChange={(e) => handleChange("sharepoint_drive_id", e.target.value)}
                placeholder="b!abc123..."
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Document Library Drive ID
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="drive_name">Drive Name</Label>
              <Input
                id="drive_name"
                value={formData.sharepoint_drive_name}
                onChange={(e) => handleChange("sharepoint_drive_name", e.target.value)}
                placeholder="Shared Documents"
              />
              <p className="text-xs text-muted-foreground">
                Display name of the document library
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleTest} disabled={testing || !formData.sharepoint_site_id}>
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>
            {formData.sharepoint_site_url && (
              <Button variant="outline" asChild>
                <a href={formData.sharepoint_site_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Site
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Document Paths */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            Folder Structure (SSoT)
          </CardTitle>
          <CardDescription>
            Base folders for each document type. All paths are relative to the root.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Root Path */}
          <div className="space-y-2 p-4 bg-muted/50 rounded-lg border">
            <Label htmlFor="root_path" className="text-sm font-medium">
              Root Path
            </Label>
            <Input
              id="root_path"
              value={formData.sharepoint_root_path}
              onChange={(e) => handleChange("sharepoint_root_path", e.target.value)}
              placeholder="/Shared Documents"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              All paths below are relative to this root
            </p>
          </div>

          {/* Sub-paths */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="jobs_path" className="flex items-center gap-1">
                <Briefcase className="h-3 w-3 text-orange-500" />
                Job Documents
              </Label>
              <Input
                id="jobs_path"
                value={formData.sharepoint_jobs_path}
                onChange={(e) => handleChange("sharepoint_jobs_path", e.target.value)}
                placeholder="TEEEM Jobs"
              />
              <p className="text-xs text-muted-foreground font-mono">
                {getFullPath(formData.sharepoint_jobs_path)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_path" className="flex items-center gap-1">
                <Building2 className="h-3 w-3 text-purple-500" />
                Company Documents
              </Label>
              <Input
                id="company_path"
                value={formData.sharepoint_company_path}
                onChange={(e) => handleChange("sharepoint_company_path", e.target.value)}
                placeholder="00 TEEEM PRIVATE"
              />
              <p className="text-xs text-muted-foreground font-mono">
                {getFullPath(formData.sharepoint_company_path)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="people_path" className="flex items-center gap-1">
                <Users className="h-3 w-3 text-green-500" />
                People Documents
              </Label>
              <Input
                id="people_path"
                value={formData.sharepoint_people_path}
                onChange={(e) => handleChange("sharepoint_people_path", e.target.value)}
                placeholder="Corporate/People"
              />
              <p className="text-xs text-muted-foreground font-mono">
                {getFullPath(formData.sharepoint_people_path)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contacts_path" className="flex items-center gap-1">
                <Users className="h-3 w-3 text-blue-500" />
                Contact Documents
              </Label>
              <Input
                id="contacts_path"
                value={formData.sharepoint_contacts_path}
                onChange={(e) => handleChange("sharepoint_contacts_path", e.target.value)}
                placeholder="Contacts"
              />
              <p className="text-xs text-muted-foreground font-mono">
                {getFullPath(formData.sharepoint_contacts_path)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Path Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            Path Templates (SSoT)
          </CardTitle>
          <CardDescription>
            Dynamic path templates using placeholders. These define how documents are organized within each folder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info about placeholders */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Available Placeholders:</strong>
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="font-mono">{"{{JobCode}}"}</Badge>
              <Badge variant="outline" className="font-mono">{"{{Category}}"}</Badge>
              <Badge variant="outline" className="font-mono">{"{{CompanyGroup}}"}</Badge>
              <Badge variant="outline" className="font-mono">{"{{CompanyCode}}"}</Badge>
              <Badge variant="outline" className="font-mono">{"{{Folder}}"}</Badge>
              <Badge variant="outline" className="font-mono">{"{{ContactName}}"}</Badge>
            </div>
          </div>

          {/* Templates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="job_template" className="flex items-center gap-1">
                <Briefcase className="h-3 w-3 text-orange-500" />
                Job Template
              </Label>
              <Input
                id="job_template"
                value={formData.sharepoint_job_template}
                onChange={(e) => handleChange("sharepoint_job_template", e.target.value)}
                placeholder="{{JobCode}}/{{Category}}"
                className="font-mono text-sm"
              />
              <div className="text-xs space-y-1">
                <p className="text-muted-foreground">Full path preview:</p>
                <p className="font-mono text-green-600 dark:text-green-400 break-all">
                  {getFullPath(formData.sharepoint_jobs_path, resolveTemplatePreview(formData.sharepoint_job_template))}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_template" className="flex items-center gap-1">
                <Building2 className="h-3 w-3 text-purple-500" />
                Company Template
              </Label>
              <Input
                id="company_template"
                value={formData.sharepoint_company_template}
                onChange={(e) => handleChange("sharepoint_company_template", e.target.value)}
                placeholder="{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}"
                className="font-mono text-sm"
              />
              <div className="text-xs space-y-1">
                <p className="text-muted-foreground">Full path preview:</p>
                <p className="font-mono text-green-600 dark:text-green-400 break-all">
                  {getFullPath(formData.sharepoint_company_path, resolveTemplatePreview(formData.sharepoint_company_template))}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="people_template" className="flex items-center gap-1">
                <Users className="h-3 w-3 text-green-500" />
                People Template
              </Label>
              <Input
                id="people_template"
                value={formData.sharepoint_people_template}
                onChange={(e) => handleChange("sharepoint_people_template", e.target.value)}
                placeholder="{{ContactName}}/{{Category}}"
                className="font-mono text-sm"
              />
              <div className="text-xs space-y-1">
                <p className="text-muted-foreground">Full path preview:</p>
                <p className="font-mono text-green-600 dark:text-green-400 break-all">
                  {getFullPath(formData.sharepoint_people_path, resolveTemplatePreview(formData.sharepoint_people_template))}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contacts_template" className="flex items-center gap-1">
                <Users className="h-3 w-3 text-blue-500" />
                Contacts Template
              </Label>
              <Input
                id="contacts_template"
                value={formData.sharepoint_contacts_template}
                onChange={(e) => handleChange("sharepoint_contacts_template", e.target.value)}
                placeholder="{{ContactName}}/{{Category}}"
                className="font-mono text-sm"
              />
              <div className="text-xs space-y-1">
                <p className="text-muted-foreground">Full path preview:</p>
                <p className="font-mono text-green-600 dark:text-green-400 break-all">
                  {getFullPath(formData.sharepoint_contacts_path, resolveTemplatePreview(formData.sharepoint_contacts_template))}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
