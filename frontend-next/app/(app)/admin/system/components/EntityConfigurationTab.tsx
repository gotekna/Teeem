"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EntityTabsConfig } from "@/components/admin/EntityTabsConfig";
import { DocumentTypesTab } from "./DocumentTypesTab";
import { StorageConfigTab } from "./StorageConfigTab";
import { EmailConfigTab } from "./EmailConfigTab";
import { ConfigSyncTab } from "./ConfigSyncTab";
import { Building2, Briefcase, X, FileText, Settings, Contact2, Mail, ChevronRight, Home, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

/**
 * EntityConfigurationTab - SSoT for ALL tab configuration
 *
 * This is THE ONE location for configuring tabs across all entity types:
 * - Corporate Entities (Companies, Trusts, Superfunds, Charities)
 * - People (Contacts)
 * - Jobs
 * - Document Folders
 * - Xero Integration
 *
 * Uses the unified EntityTabsConfig component with different scope props.
 */
const DEFAULT_ENTITY_CONFIG_BASE_PATH = "/admin/system/entity-config";

interface EntityConfigurationTabProps {
  onClose?: () => void;  // Called when user exits fullscreen
  scope?: string;  // Path-based scope
  subTab?: string;  // Alias for scope (for consistency with other tabs)
  basePath?: string;  // Base path for navigation
}

const scopes = [
  {
    id: "corporate_entity",
    label: "Corporate",
    icon: Building2,
    showEntityFilters: true,
    showSharePointPaths: true,
    showDocumentTypes: true,
    isEntityTab: true,
    showTabGroups: false,  // Flat list - allows mixing tabs from any group
  },
  {
    id: "job",
    label: "Jobs",
    icon: Briefcase,
    showEntityFilters: false,
    showSharePointPaths: true,
    showDocumentTypes: false,
    isEntityTab: true,
    showTabGroups: false,  // Flat list - allows mixing tabs from any group
  },
  {
    id: "contact",
    label: "Contacts",
    icon: Contact2,
    showEntityFilters: false,
    showSharePointPaths: true,
    showDocumentTypes: true,  // For licenses, insurance, etc.
    isEntityTab: true,
    showTabGroups: false,
  },
  // SSoT: Email, Warehouse, Task scopes are configured in Storage Config, not here
  {
    id: "document_types",
    label: "Document Types",
    icon: FileText,
    showEntityFilters: false,
    showSharePointPaths: false,
    showDocumentTypes: false,
    isEntityTab: false,
  },
  {
    id: "storage_config",  // SSoT: Provider-agnostic URL
    label: "Storage Config",  // SSoT: Provider-agnostic label
    icon: Settings,
    showEntityFilters: false,
    showSharePointPaths: false,
    showDocumentTypes: false,
    isEntityTab: false,
    isStorageConfig: true,  // SSoT: Provider-agnostic (was isSharePointConfig)
  },
  {
    id: "email_config",
    label: "Email Config",
    icon: Mail,
    showEntityFilters: false,
    showSharePointPaths: false,
    showDocumentTypes: false,
    isEntityTab: false,
    isEmailConfig: true,
  },
  {
    id: "config_sync",
    label: "Sync",
    icon: RefreshCw,
    showEntityFilters: false,
    showSharePointPaths: false,
    showDocumentTypes: false,
    isEntityTab: false,
    isConfigSync: true,
  },
] as const;

// Scope label mapping
const SCOPE_LABELS: Record<string, string> = {
  corporate_entity: "Corporate",
  job: "Jobs",
  contact: "Contacts",
  document_types: "Document Types",
  storage_config: "Storage Config",
  email_config: "Email Config",
  config_sync: "Sync from TEEEM",
};

// Build breadcrumb items from path and active scope
function buildBreadcrumbs(basePath: string, activeScope: string): Array<{ label: string; path: string }> {
  const crumbs: Array<{ label: string; path: string }> = [];

  if (basePath.startsWith("/settings/company")) {
    crumbs.push({ label: "Settings", path: "/settings" });
    crumbs.push({ label: "Company", path: "/settings/company" });
    crumbs.push({ label: "Entity Config", path: "/settings/company/entity-config" });
  } else if (basePath.startsWith("/admin/system")) {
    crumbs.push({ label: "Admin", path: "/admin" });
    crumbs.push({ label: "System", path: "/admin/system" });
    crumbs.push({ label: "Entity Config", path: "/admin/system/entity-config" });
  } else {
    crumbs.push({ label: "Entity Config", path: basePath });
  }

  // Add active scope as final breadcrumb
  const scopeLabel = SCOPE_LABELS[activeScope] || activeScope;
  crumbs.push({ label: scopeLabel, path: `${basePath}/${activeScope}` });

  return crumbs;
}

export function EntityConfigurationTab({ onClose, scope, subTab, basePath = DEFAULT_ENTITY_CONFIG_BASE_PATH }: EntityConfigurationTabProps) {
  const router = useRouter();
  // Support both scope and subTab props (subTab for consistency with other tabs)
  const activeScope = scope || subTab || "corporate_entity";

  // Build breadcrumbs from basePath and active scope
  const breadcrumbs = React.useMemo(() => buildBreadcrumbs(basePath, activeScope), [basePath, activeScope]);

  const setActiveScope = React.useCallback((newScope: string) => {
    router.push(`${basePath}/${newScope}`, { scroll: false });
  }, [router, basePath]);
  const [scopeCounts, setScopeCounts] = React.useState<Record<string, number>>({});

  // Fetch document type counts per scope
  React.useEffect(() => {
    const fetchCounts = async () => {
      try {
        const response = await api.get<{ success: boolean; data: { counts: Record<string, number> } }>(
          "/api/v1/entity_tabs/document_type_counts"
        );
        if (response?.success) {
          setScopeCounts(response.data.counts);
        }
      } catch (err) {
        console.error("Failed to fetch scope counts:", err);
      }
    };
    fetchCounts();
  }, []);

  // Handle escape key to exit
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Lock body scroll (always fullscreen)
  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Handle close - navigate back to previous page
  // SSoT: Use fallback navigation - router.back() fails when user arrives from external link
  const handleClose = React.useCallback(() => {
    if (onClose) {
      onClose();
    } else if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/settings');
    }
  }, [onClose, router]);

  // Always render fullscreen - z-[120] to be above breadcrumb (z-110)
  return (
    <div className="fixed inset-0 z-[120] bg-background flex flex-col">
      {/* Breadcrumb bar */}
      <div className="bg-muted/50 border-b px-4 py-1.5 shrink-0">
        <nav className="flex items-center gap-1 text-sm">
          <button
            onClick={() => router.push("/")}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted"
          >
            <Home className="h-4 w-4" />
          </button>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.path}>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {index === breadcrumbs.length - 1 ? (
                <span className="font-medium text-foreground">{crumb.label}</span>
              ) : (
                <button
                  onClick={() => router.push(crumb.path)}
                  className="text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5 rounded hover:bg-muted"
                >
                  {crumb.label}
                </button>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <Tabs value={activeScope} onValueChange={setActiveScope} className="flex flex-col h-full flex-1 min-h-0">
        {/* Compact header with scope tabs inline */}
        <div className="flex items-center justify-between border-b px-4 py-2 shrink-0 bg-muted/30">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold whitespace-nowrap">Entity Tabs</h1>
            <TabsList className="h-8 bg-transparent p-0 gap-1">
              {scopes.map((s) => {
                const Icon = s.icon;
                return (
                  <TabsTrigger
                    key={s.id}
                    value={s.id}
                    onClick={() => setActiveScope(s.id)}
                    className="h-7 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Icon className="h-3.5 w-3.5 mr-1.5" />
                    {s.label}
                    {scopeCounts[s.id] > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-4 px-1 text-[10px] font-medium bg-muted rounded">
                        {scopeCounts[s.id]}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-7 px-2 text-xs text-muted-foreground"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Close
          </Button>
        </div>

        {/* Scope Content */}
        <div className="flex-1 overflow-auto p-4">
          {scopes.map((scope) => (
            <TabsContent key={scope.id} value={scope.id} className="mt-0 h-full">
              {scope.isEntityTab ? (
                <EntityTabsConfig
                  scope={scope.id as "corporate_entity" | "job" | "contact" | "email" | "warehouse" | "task"}
                  showEntityFilters={scope.showEntityFilters}
                  showSharePointPaths={scope.showSharePointPaths}
                  showDocumentTypes={scope.showDocumentTypes}
                  showTabGroups={scope.showTabGroups !== false}
                  compact={true}
                />
              ) : "isStorageConfig" in scope && scope.isStorageConfig ? (
                <StorageConfigTab />
              ) : "isEmailConfig" in scope && scope.isEmailConfig ? (
                <EmailConfigTab />
              ) : "isConfigSync" in scope && scope.isConfigSync ? (
                <ConfigSyncTab />
              ) : (
                <DocumentTypesTab />
              )}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
