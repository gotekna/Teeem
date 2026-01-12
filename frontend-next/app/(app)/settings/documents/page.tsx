"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
 */

const DOCUMENT_TABS = [
  { id: "types", label: "Document Types" },
  { id: "templates", label: "Templates" },
  { id: "pdf-fields", label: "PDF Fields" },
];

export default function DocumentsSettingsPage() {
  const [activeTab, setActiveTab] = React.useState("types");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Document Configuration</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage document types, templates, and PDF field mappings
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50 p-1">
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
            <DocumentTypesTab />
          </TabsContent>
          <TabsContent value="templates">
            <DocumentTemplatesTab />
          </TabsContent>
          <TabsContent value="pdf-fields">
            <PdfFieldsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
