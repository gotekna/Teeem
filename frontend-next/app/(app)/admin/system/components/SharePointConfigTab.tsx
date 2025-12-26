"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, FolderOpen, Building2, Briefcase, Users, Search } from "lucide-react";
import { api } from "@/lib/api";
import { SharePointFolderBrowser } from "@/components/ui/sharepoint-folder-browser";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface SharePointConfig {
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

/**
 * SharePointConfigTab - SSoT for SharePoint path configuration
 *
 * This tab displays and edits CorporateCompanySetting SharePoint fields.
 * These templates define the default folder structure for all entity tabs.
 */
export function SharePointConfigTab() {
  const [config, setConfig] = React.useState<SharePointConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [showBrowser, setShowBrowser] = React.useState<"root" | "jobs" | "company" | "people" | null>(null);

  // Load config on mount
  React.useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: SharePointConfig }>(
        "/api/v1/corporate_company_settings/sharepoint"
      );
      if (response?.success) {
        setConfig(response.data);
      }
    } catch (error) {
      console.error("Failed to load SharePoint config:", error);
      toast.error("Failed to load SharePoint configuration");
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);
      const response = await api.put<{ success: boolean }>(
        "/api/v1/corporate_company_settings/sharepoint",
        {
          sharepoint_root_path: config.root_path,
          sharepoint_jobs_path: config.paths.jobs,
          sharepoint_job_template: config.templates.job,
          sharepoint_company_path: config.paths.company,
          sharepoint_company_template: config.templates.company,
          sharepoint_people_path: config.paths.people,
          sharepoint_people_template: config.templates.people,
          sharepoint_contacts_path: config.paths.contacts,
          sharepoint_contacts_template: config.templates.contacts,
        }
      );
      if (response?.success) {
        toast.success("SharePoint configuration saved");
      }
    } catch (error) {
      console.error("Failed to save SharePoint config:", error);
      toast.error("Failed to save SharePoint configuration");
    } finally {
      setSaving(false);
    }
  };

  const updatePath = (scope: keyof SharePointConfig["paths"], value: string) => {
    if (!config) return;
    setConfig({
      ...config,
      paths: { ...config.paths, [scope]: value },
    });
  };

  const updateTemplate = (scope: keyof SharePointConfig["templates"], value: string) => {
    if (!config) return;
    setConfig({
      ...config,
      templates: { ...config.templates, [scope]: value },
    });
  };

  const buildPreview = (scope: "job" | "company" | "people") => {
    if (!config) return "";
    const base = config.root_path || "/Shared Documents";
    const path = config.paths[scope === "job" ? "jobs" : scope];
    const template = config.templates[scope];
    return `${base}/${path}/${template}`.replace(/\/+/g, "/");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Failed to load configuration
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                SharePoint Path Configuration
              </CardTitle>
              <CardDescription>
                SSoT for SharePoint folder structure. These templates define the default paths for all entity tabs.
              </CardDescription>
            </div>
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Root Path */}
          <div className="space-y-2">
            <Label htmlFor="root_path">Root Path</Label>
            <div className="flex gap-2">
              <Input
                id="root_path"
                value={config.root_path}
                onChange={(e) => setConfig({ ...config, root_path: e.target.value })}
                placeholder="/Shared Documents"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => setShowBrowser("root")}
              >
                <Search className="h-4 w-4 mr-2" />
                Browse
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The base SharePoint path for all documents
            </p>
          </div>

          {/* Jobs Section */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Briefcase className="h-4 w-4" />
              Jobs
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="jobs_path">Base Folder</Label>
                <div className="flex gap-2">
                  <Input
                    id="jobs_path"
                    value={config.paths.jobs}
                    onChange={(e) => updatePath("jobs", e.target.value)}
                    placeholder="TEEEM Jobs"
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowBrowser("jobs")}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_template">Template</Label>
                <Input
                  id="job_template"
                  value={config.templates.job}
                  onChange={(e) => updateTemplate("job", e.target.value)}
                  placeholder="{{JobCode}}/{{Category}}"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono">
              Preview: {buildPreview("job")}
            </div>
          </div>

          {/* Company Section */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4" />
              Company
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_path">Base Folder</Label>
                <div className="flex gap-2">
                  <Input
                    id="company_path"
                    value={config.paths.company}
                    onChange={(e) => updatePath("company", e.target.value)}
                    placeholder="Corporate"
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowBrowser("company")}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_template">Template</Label>
                <Input
                  id="company_template"
                  value={config.templates.company}
                  onChange={(e) => updateTemplate("company", e.target.value)}
                  placeholder="{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono">
              Preview: {buildPreview("company")}
            </div>
          </div>

          {/* People Section */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" />
              People
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="people_path">Base Folder</Label>
                <div className="flex gap-2">
                  <Input
                    id="people_path"
                    value={config.paths.people}
                    onChange={(e) => updatePath("people", e.target.value)}
                    placeholder="Corporate/People"
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowBrowser("people")}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="people_template">Template</Label>
                <Input
                  id="people_template"
                  value={config.templates.people}
                  onChange={(e) => updateTemplate("people", e.target.value)}
                  placeholder="{{ContactName}}"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded font-mono">
              Preview: {buildPreview("people")}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Available Placeholders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium mb-1">Jobs:</p>
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{JobCode}}"}</code>
              <code className="text-xs bg-muted px-1 py-0.5 rounded ml-1">{"{{Category}}"}</code>
            </div>
            <div>
              <p className="font-medium mb-1">Company:</p>
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{CompanyGroup}}"}</code>
              <code className="text-xs bg-muted px-1 py-0.5 rounded ml-1">{"{{CompanyCode}}"}</code>
              <code className="text-xs bg-muted px-1 py-0.5 rounded ml-1">{"{{Folder}}"}</code>
            </div>
            <div>
              <p className="font-medium mb-1">People:</p>
              <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{ContactName}}"}</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SharePoint Folder Browser Dialog */}
      {showBrowser && (
        <Sheet open={true} onOpenChange={() => setShowBrowser(null)}>
          <SheetContent side="right" className="w-[500px] sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>
                Select {showBrowser === "root" ? "Root" : showBrowser === "jobs" ? "Jobs" : showBrowser === "company" ? "Company" : "People"} Folder
              </SheetTitle>
              <SheetDescription>
                Browse SharePoint to select a folder
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 h-[calc(100vh-200px)] overflow-auto">
              <SharePointFolderBrowser
                onSelect={(folder, path) => {
                  if (!config || !path) return;
                  if (showBrowser === "root") {
                    setConfig({ ...config, root_path: path });
                  } else if (showBrowser === "jobs") {
                    // Remove root path prefix if present
                    const relativePath = path.startsWith(config.root_path)
                      ? path.slice(config.root_path.length + 1)
                      : path;
                    updatePath("jobs", relativePath);
                  } else if (showBrowser === "company") {
                    const relativePath = path.startsWith(config.root_path)
                      ? path.slice(config.root_path.length + 1)
                      : path;
                    updatePath("company", relativePath);
                  } else if (showBrowser === "people") {
                    const relativePath = path.startsWith(config.root_path)
                      ? path.slice(config.root_path.length + 1)
                      : path;
                    updatePath("people", relativePath);
                  }
                  setShowBrowser(null);
                }}
                rootFolder=""
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
