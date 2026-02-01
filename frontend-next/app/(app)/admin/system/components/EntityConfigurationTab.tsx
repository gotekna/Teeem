"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntityTabsConfig } from "@/components/admin/EntityTabsConfig";
import { DocumentTypesTab } from "./DocumentTypesTab";
import { WarehouseProviderTab } from "./WarehouseProviderTab";
import { EmailConfigTab } from "./EmailConfigTab";
import { ConfigSyncTab } from "./ConfigSyncTab";
import { AdminConfigSyncTab } from "./AdminConfigSyncTab";
import { Building2, Briefcase, FileText, Settings, Contact2, Mail, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/contexts/SidebarContext";

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
    id: "storage_config",  // SSoT: Provider-agnostic URL - FIRST for quick access
    label: "Storage Config",  // SSoT: Provider-agnostic label
    icon: Settings,
    showEntityFilters: false,
    showSharePointPaths: false,
    showDocumentTypes: false,
    isEntityTab: false,
    isStorageConfig: true,  // SSoT: Provider-agnostic (was isSharePointConfig)
  },
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
    id: "corporate",
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
  corporate: "Corporate",
  job: "Jobs",
  contact: "Contacts",
  document_types: "Document Types",
  storage_config: "Storage Config",
  email_config: "Email Config",
  config_sync: "Config Sync",
};

// Build breadcrumb items from path and active scope
function buildBreadcrumbs(basePath: string, activeScope: string): Array<{ label: string; path: string }> {
  const crumbs: Array<{ label: string; path: string }> = [];

  if (basePath.startsWith("/settings/company")) {
    crumbs.push({ label: "Settings", path: "/settings" });
    crumbs.push({ label: "Company", path: "/settings/company" });
    crumbs.push({ label: "Folder Config", path: "/settings/company/entity-config" });
  } else if (basePath.startsWith("/admin/system")) {
    crumbs.push({ label: "Admin", path: "/admin" });
    crumbs.push({ label: "System", path: "/admin/system" });
    crumbs.push({ label: "Folder Config", path: "/admin/system/entity-config" });
  } else {
    crumbs.push({ label: "Folder Config", path: basePath });
  }

  // Add active scope as final breadcrumb
  const scopeLabel = SCOPE_LABELS[activeScope] || activeScope;
  crumbs.push({ label: scopeLabel, path: `${basePath}/${activeScope}` });

  return crumbs;
}

export function EntityConfigurationTab({ onClose, scope, subTab, basePath = DEFAULT_ENTITY_CONFIG_BASE_PATH }: EntityConfigurationTabProps) {
  const router = useRouter();
  const { sidebarWidth } = useSidebar();
  // Support both scope and subTab props (subTab for consistency with other tabs)
  const activeScope = scope || subTab || "storage_config";

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

  // Render full page below header AND breadcrumbs
  // top-24 = 96px to sit below header + breadcrumbs
  // Left offset matches sidebar width on desktop (md+), full-width on mobile
  return (
    <div
      className="fixed top-24 left-0 md:left-[var(--sidebar-width)] right-0 bottom-0 bg-background flex flex-col z-40 transition-[left] duration-300"
      style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
    >
      <Tabs value={activeScope} onValueChange={setActiveScope} className="flex flex-col h-full flex-1 min-h-0">
        {/* Scope tabs */}
        <div className="flex items-center justify-between border-b px-4 py-2 shrink-0 bg-muted/30">
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

        {/* Scope Content */}
        <div className="flex-1 overflow-auto p-4">
          {scopes.map((scope) => (
            <TabsContent key={scope.id} value={scope.id} className="mt-0 h-full">
              {scope.isEntityTab ? (
                <EntityTabsConfig
                  scope={scope.id as "corporate" | "job" | "contact" | "email" | "warehouse" | "task"}
                  showEntityFilters={scope.showEntityFilters}
                  showSharePointPaths={scope.showSharePointPaths}
                  showDocumentTypes={scope.showDocumentTypes}
                  showTabGroups={scope.showTabGroups !== false}
                  compact={true}
                />
              ) : "isStorageConfig" in scope && scope.isStorageConfig ? (
                <WarehouseProviderTab />
              ) : "isEmailConfig" in scope && scope.isEmailConfig ? (
                <EmailConfigTab />
              ) : "isConfigSync" in scope && scope.isConfigSync ? (
                <div className="space-y-8">
                  {/* Admin Import UI - Pull data FROM other tenants INTO TEEEM */}
                  <AdminConfigSyncTab />

                  {/* Divider */}
                  <div className="border-t pt-8">
                    <h2 className="text-lg font-semibold mb-4">Tenant Configuration Overview</h2>
                    <ConfigSyncTab />
                  </div>
                </div>
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
