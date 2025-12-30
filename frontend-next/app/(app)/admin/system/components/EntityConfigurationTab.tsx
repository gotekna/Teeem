"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EntityTabsConfig } from "@/components/admin/EntityTabsConfig";
import { DocumentTypesTab } from "./DocumentTypesTab";
import { SharePointTab } from "./SharePointTab";
import { Building2, Users, Briefcase, X, FileText, Settings, Contact2 } from "lucide-react";
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
interface EntityConfigurationTabProps {
  onClose?: () => void;  // Called when user exits fullscreen
  scope?: string;  // Path-based scope
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
    id: "sharepoint_config",
    label: "SharePoint Config",
    icon: Settings,
    showEntityFilters: false,
    showSharePointPaths: false,
    showDocumentTypes: false,
    isEntityTab: false,
    isSharePointConfig: true,
  },
] as const;

export function EntityConfigurationTab({ onClose, scope }: EntityConfigurationTabProps) {
  const router = useRouter();
  const activeScope = scope || "corporate_entity";

  const setActiveScope = React.useCallback((newScope: string) => {
    router.push(`/admin/system/entity-config/${newScope}`, { scroll: false });
  }, [router]);
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

  // Always render fullscreen
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <Tabs value={activeScope} onValueChange={setActiveScope} className="flex flex-col h-full">
        {/* Compact header with scope tabs inline */}
        <div className="flex items-center justify-between border-b px-4 py-2 shrink-0 bg-muted/30">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold whitespace-nowrap">Entity Tabs</h1>
            <TabsList className="h-8 bg-transparent p-0 gap-1">
              {scopes.map((scope) => {
                const Icon = scope.icon;
                return (
                  <TabsTrigger
                    key={scope.id}
                    value={scope.id}
                    className="h-7 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Icon className="h-3.5 w-3.5 mr-1.5" />
                    {scope.label}
                    {scopeCounts[scope.id] > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-4 px-1 text-[10px] font-medium bg-muted rounded">
                        {scopeCounts[scope.id]}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 px-2 text-xs text-muted-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              Back
            </Button>
          )}
        </div>

        {/* Scope Content */}
        <div className="flex-1 overflow-auto p-4">
          {scopes.map((scope) => (
            <TabsContent key={scope.id} value={scope.id} className="mt-0 h-full">
              {scope.isEntityTab ? (
                <EntityTabsConfig
                  scope={scope.id as "corporate_entity" | "job" | "contact"}
                  showEntityFilters={scope.showEntityFilters}
                  showSharePointPaths={scope.showSharePointPaths}
                  showDocumentTypes={scope.showDocumentTypes}
                  showTabGroups={scope.showTabGroups !== false}
                  compact={true}
                />
              ) : "isSharePointConfig" in scope && scope.isSharePointConfig ? (
                <SharePointTab />
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
