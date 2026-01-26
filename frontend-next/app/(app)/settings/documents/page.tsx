"use client";

import * as React from "react";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const router = useRouter();

  // URL is SSoT for tab state (path-based navigation)
  // Default to DEFAULT_TAB if no tab specified - no redirect needed
  // This allows breadcrumb navigation to /settings/documents to work
  const activeTab = useMemo(() => {
    const parts = pathname.replace("/settings/documents", "").split("/").filter(Boolean);
    const tab = parts[0] || DEFAULT_TAB;
    // Validate tab exists
    return DOCUMENT_TABS.some((t) => t.id === tab) ? tab : DEFAULT_TAB;
  }, [pathname]);

  const handleTabChange = useCallback((tabId: string) => {
    router.push(`/settings/documents/${tabId}`, { scroll: false });
  }, [router]);

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange}>
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
            <DocumentTemplatesTab basePath="/settings/documents/templates" />
          </TabsContent>
          <TabsContent value="pdf-fields">
            <PdfFieldsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
