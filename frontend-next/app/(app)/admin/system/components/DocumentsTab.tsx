"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, FileCode, FormInput } from "lucide-react";
import { DocumentTypesTab } from "./DocumentTypesTab";
import { DocumentTemplatesTab } from "./DocumentTemplatesTab";
import { PdfFieldsTab } from "./PdfFieldsTab";

/**
 * DocumentsTab - Consolidated document configuration
 *
 * SSoT: This is THE ONE location for document settings.
 * Contains:
 * - Document Types (categories for documents)
 * - Templates (document templates)
 * - PDF Fields (field mappings for PDFs)
 */

const DOCUMENTS_SUB_TABS = [
  { id: "types", label: "Document Types", icon: FileText },
  { id: "templates", label: "Templates", icon: FileCode },
  { id: "pdf-fields", label: "PDF Fields", icon: FormInput },
];

const DEFAULT_DOCUMENTS_BASE_PATH = "/settings/company/documents";

interface DocumentsTabProps {
  subTab?: string;
  basePath?: string;
}

export function DocumentsTab({ subTab, basePath = DEFAULT_DOCUMENTS_BASE_PATH }: DocumentsTabProps) {
  const router = useRouter();

  // Default to "types" sub-tab
  const activeSubTab = DOCUMENTS_SUB_TABS.some((t) => t.id === subTab) ? subTab : "types";

  const handleSubTabChange = (tabId: string) => {
    router.push(`${basePath}/${tabId}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeSubTab} onValueChange={handleSubTabChange}>
        <TabsList>
          {DOCUMENTS_SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="types">
            <DocumentTypesTab basePath={`${basePath}/types`} />
          </TabsContent>
          <TabsContent value="templates">
            <DocumentTemplatesTab basePath={`${basePath}/templates`} />
          </TabsContent>
          <TabsContent value="pdf-fields">
            <PdfFieldsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
