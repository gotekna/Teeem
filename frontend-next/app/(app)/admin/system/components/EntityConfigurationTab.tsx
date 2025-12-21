"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EntityTabsConfig } from "@/components/admin/EntityTabsConfig";
import { Building2, Users, Briefcase, FolderOpen, FileSpreadsheet } from "lucide-react";

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
export function EntityConfigurationTab() {
  const [activeScope, setActiveScope] = React.useState("corporate_entity");

  const scopes = [
    {
      id: "corporate_entity",
      label: "Corporate Entities",
      icon: Building2,
      description: "Companies, Trusts, Superfunds, Charities",
      showEntityFilters: true,
      showSharePointPaths: true,
      showDocumentTypes: true,
    },
    {
      id: "people",
      label: "People",
      icon: Users,
      description: "Contact and person records",
      showEntityFilters: false,
      showSharePointPaths: false,
      showDocumentTypes: false,
    },
    {
      id: "job",
      label: "Jobs",
      icon: Briefcase,
      description: "Job and project records",
      showEntityFilters: false,
      showSharePointPaths: false,
      showDocumentTypes: false,
    },
    {
      id: "document",
      label: "Document Folders",
      icon: FolderOpen,
      description: "Document organization and SharePoint paths",
      showEntityFilters: true,
      showSharePointPaths: true,
      showDocumentTypes: true,
    },
    {
      id: "xero",
      label: "Xero",
      icon: FileSpreadsheet,
      description: "Xero integration tabs",
      showEntityFilters: false,
      showSharePointPaths: true,
      showDocumentTypes: true,
    },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Entity Tab Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Configure tabs for all entity types from one location. This is the single source of truth
          for tab configuration across the entire system.
        </p>
      </div>

      {/* Scope Tabs */}
      <Tabs value={activeScope} onValueChange={setActiveScope}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {scopes.map((scope) => {
            const Icon = scope.icon;
            return (
              <TabsTrigger
                key={scope.id}
                value={scope.id}
                className="flex items-center gap-2 text-xs sm:text-sm"
              >
                <Icon className="h-4 w-4" />
                <span>{scope.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Scope Content */}
        <div className="mt-6">
          {scopes.map((scope) => (
            <TabsContent key={scope.id} value={scope.id}>
              <EntityTabsConfig
                scope={scope.id as "corporate_entity" | "people" | "job" | "document" | "xero"}
                showEntityFilters={scope.showEntityFilters}
                showSharePointPaths={scope.showSharePointPaths}
                showDocumentTypes={scope.showDocumentTypes}
                showTabGroups={true}
                title={`${scope.label} Tabs`}
                description={scope.description}
              />
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
