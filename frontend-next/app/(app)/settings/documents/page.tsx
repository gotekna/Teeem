"use client";

import * as React from "react";
import { useCallback, useMemo, useEffect } from "react";
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
  const activeTab = useMemo(() => {
    const parts = pathname.replace("/settings/documents", "").split("/").filter(Boolean);
    const tab = parts[0] || DEFAULT_TAB;
    // Validate tab exists
    return DOCUMENT_TABS.some((t) => t.id === tab) ? tab : DEFAULT_TAB;
  }, [pathname]);

  // Redirect to default tab if no tab in URL
  useEffect(() => {
    if (!pathname.includes("/settings/documents/")) {
      router.replace(`/settings/documents/${DEFAULT_TAB}`, { scroll: false });
    }
  }, [pathname, router]);

  const handleTabChange = useCallback((tabId: string) => {
    router.push(`/settings/documents/${tabId}`, { scroll: false });
  }, [router]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Document Configuration</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage document types, templates, and PDF field mappings
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
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
