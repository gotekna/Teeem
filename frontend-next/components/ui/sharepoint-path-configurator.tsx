"use client";

/**
 * SharePointPathConfigurator - SSoT Component
 *
 * This is THE ONE component for configuring SharePoint folder path templates.
 * It loads and saves templates from/to CorporateCompanySetting (SSoT).
 *
 * Usage:
 *   <SharePointPathConfigurator
 *     defaultScope="job"
 *     onPathChange={(scope, path) => console.log(scope, path)}
 *     showAllScopes={true}
 *   />
 *
 * Backend API (SSoT):
 *   GET   /api/v1/corporate_company_settings/sharepoint
 *   PATCH /api/v1/corporate_company_settings/sharepoint
 *
 * Path Structure:
 *   Full path = root_path + scope_path + resolved_template
 *   e.g., /Shared Documents/TEEEM Jobs/JOB-001/Plans
 */

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { SharePointFolderBrowser } from "@/components/ui/sharepoint-folder-browser";
import { Spinner } from "@/components/ui/spinner";
import {
  FolderTree,
  Copy,
  CheckCircle,
  Building2,
  Briefcase,
  Users,
  RefreshCw,
  EyeOff,
  Eye,
  Info,
} from "lucide-react";

// ============================================================================
// SSoT: Scope and Placeholder Definitions
// ============================================================================

export type ScopeType = "job" | "company" | "people" | "contacts";

export interface PlaceholderDef {
  key: string;
  example: string;
  description: string;
}

// SSoT: All placeholder definitions for each scope
export const SCOPE_PLACEHOLDERS: Record<ScopeType, PlaceholderDef[]> = {
  job: [
    { key: "{{JobCode}}", example: "JOB-001", description: "Job code/number" },
    { key: "{{Category}}", example: "Plans", description: "Document category" },
  ],
  company: [
    { key: "{{CompanyGroup}}", example: "Tekna Group", description: "Parent company group" },
    { key: "{{CompanyCode}}", example: "ABC123", description: "Company code" },
    { key: "{{TabName}}", example: "Invoices", description: "Tab/folder name" },
  ],
  people: [
    { key: "{{ContactName}}", example: "John Smith", description: "Contact/person name" },
    { key: "{{Category}}", example: "Documents", description: "Document category" },
  ],
  contacts: [
    { key: "{{ContactName}}", example: "John Smith", description: "Contact/person name" },
    { key: "{{Category}}", example: "Documents", description: "Document category" },
  ],
};

// SSoT: Default path templates (templates only, not full paths)
export const DEFAULT_TEMPLATES: Record<ScopeType, string> = {
  job: "{{JobCode}}/{{Category}}",
  company: "{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}",
  people: "{{ContactName}}/{{Category}}",
  contacts: "{{ContactName}}/{{Category}}",
};

// SSoT: Default scope paths (relative to root)
export const DEFAULT_SCOPE_PATHS: Record<ScopeType, string> = {
  job: "Jobs",
  company: "Corporate",
  people: "Corporate/People",
  contacts: "Contacts",
};

// Default root path
export const DEFAULT_ROOT_PATH = "/Shared Documents";

// SSoT: Scope styling
export const SCOPE_STYLES: Record<ScopeType, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  job: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-300 dark:border-orange-700",
    icon: <Briefcase className="h-3 w-3 mr-1" />,
  },
  company: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-300 dark:border-purple-700",
    icon: <Building2 className="h-3 w-3 mr-1" />,
  },
  people: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-300 dark:border-green-700",
    icon: <Users className="h-3 w-3 mr-1" />,
  },
  contacts: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-700",
    icon: <Users className="h-3 w-3 mr-1" />,
  },
};

// ============================================================================
// API Response Types
// ============================================================================

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

// ============================================================================
// Component Props
// ============================================================================

export interface SharePointPathConfiguratorProps {
  /** Initial scope to show (defaults to "job") */
  defaultScope?: ScopeType;
  /** Callback when path template changes */
  onPathChange?: (scope: ScopeType, path: string) => void;
  /** Callback when templates are saved */
  onSave?: (templates: Record<ScopeType, string>) => void;
  /** Show all scope tabs or just one */
  showAllScopes?: boolean;
  /** If showAllScopes is false, which scope to show */
  fixedScope?: ScopeType;
  /** Show the folder browser (can be hidden for compact view) */
  showBrowser?: boolean;
  /** Show save button (set false if parent handles saving) */
  showSaveButton?: boolean;
  /** Additional className */
  className?: string;
  /** Compact mode - hides header and info */
  compact?: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function SharePointPathConfigurator({
  defaultScope = "job",
  onPathChange,
  onSave,
  showAllScopes = true,
  fixedScope,
  showBrowser = true,
  showSaveButton = true,
  className,
  compact = false,
}: SharePointPathConfiguratorProps) {
  const { toast } = useToast();

  // State
  const [templates, setTemplates] = React.useState<Record<ScopeType, string>>(DEFAULT_TEMPLATES);
  const [scopePaths, setScopePaths] = React.useState<Record<ScopeType, string>>(DEFAULT_SCOPE_PATHS);
  const [rootPath, setRootPath] = React.useState(DEFAULT_ROOT_PATH);
  const [activeScope, setActiveScope] = React.useState<ScopeType>(fixedScope || defaultScope);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [copiedPath, setCopiedPath] = React.useState<string | null>(null);
  const [showFolderBrowser, setShowFolderBrowser] = React.useState(showBrowser);
  const [hasChanges, setHasChanges] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Current template for active scope
  const currentTemplate = templates[activeScope];
  const currentScopePath = scopePaths[activeScope];

  // Build full preview path
  const fullPreviewPath = React.useMemo(() => {
    const root = rootPath.replace(/\/$/, "");
    const scope = currentScopePath.replace(/^\//, "").replace(/\/$/, "");
    const template = currentTemplate.replace(/^\//, "");
    return `${root}/${scope}/${template}`.replace(/\/+/g, "/");
  }, [rootPath, currentScopePath, currentTemplate]);

  // ============================================================================
  // API: Load config from CorporateCompanySetting (SSoT)
  // ============================================================================
  const loadConfig = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: SharePointConfig }>(
        "/api/v1/corporate_company_settings/sharepoint"
      );
      if (response?.success && response.data) {
        const data = response.data;
        setRootPath(data.root_path || DEFAULT_ROOT_PATH);
        setScopePaths({
          job: data.paths?.jobs || DEFAULT_SCOPE_PATHS.job,
          company: data.paths?.company || DEFAULT_SCOPE_PATHS.company,
          people: data.paths?.people || DEFAULT_SCOPE_PATHS.people,
          contacts: data.paths?.contacts || DEFAULT_SCOPE_PATHS.contacts,
        });
        setTemplates({
          job: data.templates?.job || DEFAULT_TEMPLATES.job,
          company: data.templates?.company || DEFAULT_TEMPLATES.company,
          people: data.templates?.people || DEFAULT_TEMPLATES.people,
          contacts: data.templates?.contacts || DEFAULT_TEMPLATES.contacts,
        });
      }
    } catch (error) {
      console.error("Failed to load SharePoint config:", error);
      // Use defaults on error
      setRootPath(DEFAULT_ROOT_PATH);
      setScopePaths(DEFAULT_SCOPE_PATHS);
      setTemplates(DEFAULT_TEMPLATES);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // API: Save config to CorporateCompanySetting (SSoT)
  // ============================================================================
  const saveConfig = React.useCallback(async () => {
    setSaving(true);
    try {
      // Map scope names to database column names
      const payload = {
        sharepoint: {
          sharepoint_root_path: rootPath,
          sharepoint_jobs_path: scopePaths.job,
          sharepoint_people_path: scopePaths.people,
          sharepoint_company_path: scopePaths.company,
          sharepoint_contacts_path: scopePaths.contacts,
          sharepoint_job_template: templates.job,
          sharepoint_company_template: templates.company,
          sharepoint_people_template: templates.people,
          sharepoint_contacts_template: templates.contacts,
        },
      };

      await api.patch("/api/v1/corporate_company_settings/sharepoint", payload);
      toast({
        title: "Saved",
        description: "Storage path configuration saved successfully",
      });
      setHasChanges(false);
      onSave?.(templates);
    } catch (error) {
      console.error("Failed to save storage config:", error);
      toast({
        title: "Error",
        description: "Failed to save path configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [rootPath, scopePaths, templates, toast, onSave]);

  // ============================================================================
  // Load on mount
  // ============================================================================
  React.useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // ============================================================================
  // Handlers
  // ============================================================================
  const updateTemplate = (scope: ScopeType, value: string) => {
    setTemplates(prev => ({ ...prev, [scope]: value }));
    setHasChanges(true);
    onPathChange?.(scope, value);
  };

  const handleFolderSelect = (
    folder: { id: string; name: string; web_url?: string; child_count: number } | null,
    path: string
  ) => {
    // When folder is selected, update the scope path
    // Extract the relative path from root
    const cleanPath = path.replace(/^\/Shared Documents\/?/, "").replace(/^\//, "");
    setScopePaths(prev => ({ ...prev, [activeScope]: cleanPath }));
    setHasChanges(true);
  };

  const insertPlaceholder = (placeholder: string) => {
    if (inputRef.current) {
      const input = inputRef.current;
      const start = input.selectionStart || currentTemplate.length;
      const end = input.selectionEnd || currentTemplate.length;
      const newValue = currentTemplate.slice(0, start) + placeholder + currentTemplate.slice(end);
      updateTemplate(activeScope, newValue);
      // Focus and move cursor after the inserted placeholder
      setTimeout(() => {
        input.focus();
        const newCursorPos = start + placeholder.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      updateTemplate(activeScope, currentTemplate + placeholder);
    }
  };

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    toast({
      title: "Copied!",
      description: "Path copied to clipboard",
    });
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const resetToDefault = () => {
    updateTemplate(activeScope, DEFAULT_TEMPLATES[activeScope]);
    setScopePaths(prev => ({ ...prev, [activeScope]: DEFAULT_SCOPE_PATHS[activeScope] }));
    setHasChanges(true);
  };

  // ============================================================================
  // Render
  // ============================================================================
  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Spinner size={24} className="text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading path configuration...</span>
      </div>
    );
  }

  const scopeStyle = SCOPE_STYLES[activeScope];
  const placeholders = SCOPE_PLACEHOLDERS[activeScope];

  return (
    <Card className={cn(
      "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-900",
      className
    )}>
      <CardContent className={compact ? "p-4" : "p-6"}>
        {/* Header */}
        {!compact && (
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-base font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                <FolderTree className="h-5 w-5" />
                SharePoint Folder Structure
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Configure folder path templates for automated document organization in SharePoint.
                Use placeholders like {"{{JobCode}}"} to create dynamic paths.
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFolderBrowser(!showFolderBrowser)}
              >
                {showFolderBrowser ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {showFolderBrowser ? "Hide" : "Show"} Browser
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyPath(fullPreviewPath)}
              >
                <Copy className="h-4 w-4 mr-2" />
                {copiedPath === fullPreviewPath ? "Copied!" : "Copy Path"}
              </Button>
            </div>
          </div>
        )}

        {/* Scope Tabs */}
        {showAllScopes && !fixedScope && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {(["job", "company", "people", "contacts"] as ScopeType[]).map((scope) => {
              const style = SCOPE_STYLES[scope];
              return (
                <Badge
                  key={scope}
                  variant="outline"
                  className={cn(
                    "cursor-pointer transition-all capitalize px-3 py-1",
                    activeScope === scope
                      ? `${style.bg} ${style.text} ${style.border}`
                      : "hover:bg-muted"
                  )}
                  onClick={() => setActiveScope(scope)}
                >
                  {style.icon}
                  {scope}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Single Scope Header (when fixedScope is set) */}
        {fixedScope && (
          <div className="flex items-center gap-2 mb-4">
            <Badge
              variant="outline"
              className={cn(scopeStyle.bg, scopeStyle.text, scopeStyle.border, "px-3 py-1")}
            >
              {scopeStyle.icon}
              {fixedScope} Documents
            </Badge>
          </div>
        )}

        {/* SharePoint Browser */}
        {showFolderBrowser && (
          <SharePointFolderBrowser
            onSelect={handleFolderSelect}
            selectedFolderId={null}
            rootFolder="" // Show all folders
            className="mb-4"
          />
        )}

        {/* Path Structure Info */}
        <div className="bg-muted/50 rounded-lg p-3 mb-4 space-y-2">
          <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" />
            Full Path Structure
          </Label>
          <div className="font-mono text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Root:</span>
              <span className="text-blue-600 dark:text-blue-400">{rootPath}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Scope:</span>
              <span className={cn(scopeStyle.text)}>{currentScopePath}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Template:</span>
              <span className="text-purple-600 dark:text-purple-400">{currentTemplate}</span>
            </div>
            <div className="pt-2 border-t mt-2">
              <span className="text-muted-foreground">Preview:</span>
              <span className="ml-2 text-green-600 dark:text-green-400 break-all">{fullPreviewPath}</span>
            </div>
          </div>
        </div>

        {/* Placeholders */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground">
            Available Placeholders (click to insert)
          </Label>
          <div className="flex flex-wrap gap-2">
            {placeholders.map((placeholder) => (
              <Badge
                key={placeholder.key}
                variant="outline"
                className={cn(
                  "cursor-pointer transition-all hover:scale-105",
                  scopeStyle.text,
                  `hover:${scopeStyle.bg}`
                )}
                onClick={() => insertPlaceholder(placeholder.key)}
              >
                {placeholder.key}{" "}
                <span className="ml-1 text-xs opacity-60">e.g., &quot;{placeholder.example}&quot;</span>
              </Badge>
            ))}
          </div>
        </div>

        {/* Path Template Input */}
        <div className="mt-4 space-y-2">
          <Label className="text-xs font-medium">Template (placeholders for dynamic paths)</Label>
          <Input
            ref={inputRef}
            value={currentTemplate}
            onChange={(e) => updateTemplate(activeScope, e.target.value)}
            className="text-xs font-mono"
            placeholder={DEFAULT_TEMPLATES[activeScope]}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadConfig}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefault}
          >
            Reset
          </Button>
          {showSaveButton && (
            <Button
              size="sm"
              onClick={saveConfig}
              disabled={saving || !hasChanges}
            >
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {hasChanges ? "Save Changes" : "Done"}
                </>
              )}
            </Button>
          )}
        </div>

        {/* Unsaved Changes Indicator */}
        {hasChanges && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-right">
            You have unsaved changes
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Export helper to get SharePoint config (for use in other components)
// ============================================================================

export interface SharePointPathInfo {
  rootPath: string;
  scopePath: string;
  template: string;
  fullPath: string;
}

export async function getSharePointPathConfig(scope: ScopeType): Promise<SharePointPathInfo> {
  try {
    const response = await api.get<{ success: boolean; data: SharePointConfig }>(
      "/api/v1/corporate_company_settings/sharepoint"
    );
    if (response?.success && response.data) {
      const data = response.data;
      const scopePathMap: Record<ScopeType, string> = {
        job: data.paths?.jobs || DEFAULT_SCOPE_PATHS.job,
        company: data.paths?.company || DEFAULT_SCOPE_PATHS.company,
        people: data.paths?.people || DEFAULT_SCOPE_PATHS.people,
        contacts: data.paths?.contacts || DEFAULT_SCOPE_PATHS.contacts,
      };
      const templateMap: Record<ScopeType, string> = {
        job: data.templates?.job || DEFAULT_TEMPLATES.job,
        company: data.templates?.company || DEFAULT_TEMPLATES.company,
        people: data.templates?.people || DEFAULT_TEMPLATES.people,
        contacts: data.templates?.contacts || DEFAULT_TEMPLATES.contacts,
      };

      const rootPath = data.root_path || DEFAULT_ROOT_PATH;
      const scopePath = scopePathMap[scope];
      const template = templateMap[scope];
      const fullPath = `${rootPath}/${scopePath}/${template}`.replace(/\/+/g, "/");

      return { rootPath, scopePath, template, fullPath };
    }
  } catch (error) {
    console.error("Failed to get SharePoint path config:", error);
  }

  // Return defaults on error
  return {
    rootPath: DEFAULT_ROOT_PATH,
    scopePath: DEFAULT_SCOPE_PATHS[scope],
    template: DEFAULT_TEMPLATES[scope],
    fullPath: `${DEFAULT_ROOT_PATH}/${DEFAULT_SCOPE_PATHS[scope]}/${DEFAULT_TEMPLATES[scope]}`.replace(/\/+/g, "/"),
  };
}

// ============================================================================
// Export helper to get path template (legacy compatibility)
// ============================================================================

export async function getSharePointPathTemplate(scope: ScopeType): Promise<string> {
  const config = await getSharePointPathConfig(scope);
  return config.fullPath;
}

// ============================================================================
// Export helper to resolve placeholders in a path
// ============================================================================

export function resolvePathTemplate(
  template: string,
  values: Record<string, string>
): string {
  let resolved = template;
  Object.entries(values).forEach(([key, value]) => {
    // Handle both {{key}} and key formats
    const placeholder = key.startsWith("{{") ? key : `{{${key}}}`;
    resolved = resolved.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value);
  });
  // Clean up any remaining empty placeholders and double slashes
  resolved = resolved.replace(/\/+/g, "/").replace(/\/$/, "");
  return resolved;
}
