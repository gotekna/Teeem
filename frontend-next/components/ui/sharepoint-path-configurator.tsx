"use client";

/**
 * SharePointPathConfigurator - SSoT Component
 *
 * This is THE ONE component for configuring SharePoint folder path templates.
 * It loads and saves templates from/to the backend API, ensuring consistency
 * across all usages in the app.
 *
 * Usage:
 *   <SharePointPathConfigurator
 *     defaultScope="job"
 *     onPathChange={(scope, path) => console.log(scope, path)}
 *     showAllScopes={true}
 *   />
 *
 * Backend API:
 *   GET  /api/v1/system_settings/sharepoint_path_templates
 *   PUT  /api/v1/system_settings/update_sharepoint_path_templates
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
import {
  Loader2,
  FolderTree,
  Copy,
  CheckCircle,
  Building2,
  Briefcase,
  Users,
  RefreshCw,
  FolderOpen,
  EyeOff,
  Eye,
} from "lucide-react";

// ============================================================================
// SSoT: Scope and Placeholder Definitions
// ============================================================================

export type ScopeType = "job" | "company" | "people";

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
    { key: "{{Folder}}", example: "Invoices", description: "Document folder" },
  ],
  people: [
    { key: "{{ContactName}}", example: "John Smith", description: "Contact/person name" },
    { key: "{{Category}}", example: "Documents", description: "Document category" },
  ],
};

// SSoT: Default path templates (used if API fails)
export const DEFAULT_PATH_TEMPLATES: Record<ScopeType, string> = {
  company: "/Teeem/Companies/{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}",
  job: "/Teeem/Jobs/{{JobCode}}/{{Category}}",
  people: "/Teeem/People/{{ContactName}}/{{Category}}",
};

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
};

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
  const [templates, setTemplates] = React.useState<Record<ScopeType, string>>(DEFAULT_PATH_TEMPLATES);
  const [activeScope, setActiveScope] = React.useState<ScopeType>(fixedScope || defaultScope);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [copiedPath, setCopiedPath] = React.useState<string | null>(null);
  const [showFolderBrowser, setShowFolderBrowser] = React.useState(showBrowser);
  const [hasChanges, setHasChanges] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Current path template for active scope
  const currentPath = templates[activeScope];

  // ============================================================================
  // API: Load templates from backend
  // ============================================================================
  const loadTemplates = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ templates: Record<ScopeType, string> }>(
        "/api/v1/system_settings/sharepoint_path_templates"
      );
      if (response?.templates) {
        setTemplates({
          company: response.templates.company || DEFAULT_PATH_TEMPLATES.company,
          job: response.templates.job || DEFAULT_PATH_TEMPLATES.job,
          people: response.templates.people || DEFAULT_PATH_TEMPLATES.people,
        });
      }
    } catch (error) {
      console.error("Failed to load SharePoint path templates:", error);
      // Use defaults on error
      setTemplates(DEFAULT_PATH_TEMPLATES);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================================
  // API: Save templates to backend
  // ============================================================================
  const saveTemplates = React.useCallback(async () => {
    setSaving(true);
    try {
      await api.put("/api/v1/system_settings/update_sharepoint_path_templates", {
        templates,
      });
      toast({
        title: "Saved",
        description: "SharePoint path templates saved successfully",
      });
      setHasChanges(false);
      onSave?.(templates);
    } catch (error) {
      console.error("Failed to save SharePoint path templates:", error);
      toast({
        title: "Error",
        description: "Failed to save path templates",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }, [templates, toast, onSave]);

  // ============================================================================
  // Load on mount
  // ============================================================================
  React.useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

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
    // Auto-append placeholders based on scope when a folder is selected
    const placeholders = SCOPE_PLACEHOLDERS[activeScope];
    const placeholderSuffix = placeholders.map(p => p.key).join("/");
    const newPath = path ? `${path}/${placeholderSuffix}` : `/${placeholderSuffix}`;
    updateTemplate(activeScope, newPath);
  };

  const insertPlaceholder = (placeholder: string) => {
    if (inputRef.current) {
      const input = inputRef.current;
      const start = input.selectionStart || currentPath.length;
      const end = input.selectionEnd || currentPath.length;
      const newValue = currentPath.slice(0, start) + placeholder + currentPath.slice(end);
      updateTemplate(activeScope, newValue);
      // Focus and move cursor after the inserted placeholder
      setTimeout(() => {
        input.focus();
        const newCursorPos = start + placeholder.length;
        input.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      updateTemplate(activeScope, currentPath + placeholder);
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
    updateTemplate(activeScope, DEFAULT_PATH_TEMPLATES[activeScope]);
  };

  // ============================================================================
  // Render
  // ============================================================================
  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading path templates...</span>
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
                Configure folder path templates for automated document organization in SharePoint/OneDrive.
                Use placeholders like {"{{CompanyCode}}"} to create dynamic paths.
              </p>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFolderBrowser(!showFolderBrowser)}
              >
                {showFolderBrowser ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                {showFolderBrowser ? "Hide" : "Show"} Paths
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyPath(currentPath)}
              >
                <Copy className="h-4 w-4 mr-2" />
                {copiedPath === currentPath ? "Copied!" : "Copy Path"}
              </Button>
            </div>
          </div>
        )}

        {/* Scope Tabs */}
        {showAllScopes && !fixedScope && (
          <div className="flex gap-2 mb-4">
            {(["job", "company", "people"] as ScopeType[]).map((scope) => {
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
                  {scope} Base Folder
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
              {fixedScope} Base Folder
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

        {/* Placeholders */}
        <div className="space-y-2 mt-4">
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
        <div className="mt-4">
          <Input
            ref={inputRef}
            value={currentPath}
            onChange={(e) => updateTemplate(activeScope, e.target.value)}
            className="text-xs font-mono"
            placeholder={DEFAULT_PATH_TEMPLATES[activeScope]}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-end pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadTemplates}
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
              onClick={saveTemplates}
              disabled={saving || !hasChanges}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
// Export helper to get current path template (for use in other components)
// ============================================================================

export async function getSharePointPathTemplate(scope: ScopeType): Promise<string> {
  try {
    const response = await api.get<{ templates: Record<ScopeType, string> }>(
      "/api/v1/system_settings/sharepoint_path_templates"
    );
    return response?.templates?.[scope] || DEFAULT_PATH_TEMPLATES[scope];
  } catch {
    return DEFAULT_PATH_TEMPLATES[scope];
  }
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
  return resolved;
}