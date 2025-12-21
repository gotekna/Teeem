"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { EntityTabsConfig } from "@/components/admin/EntityTabsConfig";
import { Building2, Users, Briefcase, FolderOpen, FileSpreadsheet, ArrowLeft } from "lucide-react";

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
}

const scopes = [
  {
    id: "corporate_entity",
    label: "Corporate",
    icon: Building2,
    showEntityFilters: true,
    showSharePointPaths: true,
    showDocumentTypes: true,
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    showEntityFilters: false,
    showSharePointPaths: false,
    showDocumentTypes: false,
  },
  {
    id: "job",
    label: "Jobs",
    icon: Briefcase,
    showEntityFilters: false,
    showSharePointPaths: false,
    showDocumentTypes: false,
  },
  {
    id: "document",
    label: "Folders",
    icon: FolderOpen,
    showEntityFilters: true,
    showSharePointPaths: true,
    showDocumentTypes: true,
  },
  {
    id: "xero",
    label: "Xero",
    icon: FileSpreadsheet,
    showEntityFilters: false,
    showSharePointPaths: true,
    showDocumentTypes: true,
  },
] as const;

export function EntityConfigurationTab({ onClose }: EntityConfigurationTabProps) {
  const [activeScope, setActiveScope] = React.useState("corporate_entity");

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
              <EntityTabsConfig
                scope={scope.id as "corporate_entity" | "people" | "job" | "document" | "xero"}
                showEntityFilters={scope.showEntityFilters}
                showSharePointPaths={scope.showSharePointPaths}
                showDocumentTypes={scope.showDocumentTypes}
                showTabGroups={true}
                compact={true}
              />
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
