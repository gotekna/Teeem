"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathTabs } from "@/hooks/usePathTabs";

// Import document-related tab components from admin
import { DocumentTypesTab } from "@/app/(app)/admin/system/components/DocumentTypesTab";
import { DocumentTemplatesTab } from "@/app/(app)/admin/system/components/DocumentTemplatesTab";
import { PdfFieldsTab } from "@/app/(app)/admin/system/components/PdfFieldsTab";

/**
 * Documents Settings Page - Organization Settings
 *
 * SSoT: This is THE ONE location for document configuration.
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 *
 * URL is SSoT for tab state: /settings/documents/[tab]
 */

const DOCUMENT_TABS = [
  { id: "types", label: "Document Types" },
  { id: "templates", label: "Templates" },
  { id: "pdf-fields", label: "PDF Fields" },
];

const DEFAULT_TAB = "types";

export default function DocumentsSettingsPage() {
  // URL is SSoT for tab state (path-based navigation)
  // Default to DEFAULT_TAB if no tab specified - no redirect needed
  // This allows breadcrumb navigation to /settings/documents to work
  const [activeTab, setActiveTab, subTab] = usePathTabs(
    "/settings/documents",
    DEFAULT_TAB,
    DOCUMENT_TABS.map(t => t.id)
  );

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {DOCUMENT_TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="text-sm"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="types">
            <DocumentTypesTab basePath="/settings/documents/types" />
          </TabsContent>
          <TabsContent value="templates">
            <DocumentTemplatesTab basePath="/settings/documents/templates" subTab={activeTab === "templates" ? subTab : undefined} />
          </TabsContent>
          <TabsContent value="pdf-fields">
            <PdfFieldsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
