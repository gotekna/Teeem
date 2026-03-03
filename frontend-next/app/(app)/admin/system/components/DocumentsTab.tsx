"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, FileCode, FormInput, Landmark, Mail } from "lucide-react";
import { ExpandableSection, ExpandButton, useExpandedState } from "@/components/ui/expandable-section";
import { DocumentTypesTab } from "./DocumentTypesTab";
import { DocumentTemplatesContent } from "./DocumentTemplatesTab";
import { BankStatementTemplatesTab } from "./BankStatementTemplatesTab";
import { EmailSignaturesTab } from "./EmailSignaturesTab";
import { PdfFieldsTab } from "./PdfFieldsTab";

/**
 * DocumentsTab - Consolidated document configuration
 *
 * SSoT: This is THE ONE location for document settings.
 * Contains:
 * - Document Types (categories for documents)
 * - Document Templates (PO, Claims, SSoT templates)
 * - Bank Statements (bank statement parsing templates)
 * - Email Signatures (signature style preferences)
 * - PDF Fields (field mappings for PDFs)
 *
 * Note: This was flattened from a nested structure in Jan 2026
 * Previously: Documents > Templates > (Doc Templates, Bank Statements, Invoice Templates)
 * Now: Documents > (Doc Types, Doc Templates, Bank Statements, Email Signatures, PDF Fields)
 * Note: Invoice Templates merged into Document Templates > Claims tab (Feb 2026)
 */

const DOCUMENTS_SUB_TABS = [
  { id: "types", label: "Document Types", icon: FileText },
  { id: "document-templates", label: "Document Templates", icon: FileCode },
  { id: "bank-statements", label: "Bank Statements", icon: Landmark },
  { id: "email-signatures", label: "Email Signatures", icon: Mail },
  { id: "pdf-fields", label: "PDF Fields", icon: FormInput },
];

const DEFAULT_DOCUMENTS_BASE_PATH = "/settings/company/documents";

interface DocumentsTabProps {
  subTab?: string;
  deepTab?: string;
  basePath?: string;
}

export function DocumentsTab({ subTab, deepTab, basePath = DEFAULT_DOCUMENTS_BASE_PATH }: DocumentsTabProps) {
  const router = useRouter();
  const [expanded, toggleExpanded] = useExpandedState("documents");

  // Default to "types" sub-tab
  const activeSubTab = DOCUMENTS_SUB_TABS.some((t) => t.id === subTab) ? subTab : "types";

  const handleSubTabChange = (tabId: string) => {
    router.push(`${basePath}/${tabId}`, { scroll: false });
  };

  return (
    <ExpandableSection expanded={expanded} onToggle={toggleExpanded}>
      <div className={expanded ? "flex flex-col h-full" : "space-y-6"}>
        <Tabs value={activeSubTab} onValueChange={handleSubTabChange} className={expanded ? "flex flex-col h-full flex-1 min-h-0" : ""}>
          <div className={expanded ? "px-4 pt-3 pb-2 shrink-0" : ""}>
            <div className="flex items-start gap-2">
              <TabsList className="flex-wrap h-auto gap-1 flex-1 min-w-0">
                {DOCUMENTS_SUB_TABS.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {!expanded && <ExpandButton expanded={expanded} onToggle={toggleExpanded} />}
            </div>
          </div>

          <div className={expanded ? "flex-1 overflow-auto p-4" : "mt-6"}>
            <TabsContent value="types">
              <DocumentTypesTab basePath={`${basePath}/types`} />
            </TabsContent>
            <TabsContent value="document-templates">
              <DocumentTemplatesContent basePath={`${basePath}/document-templates`} subTab={activeSubTab === "document-templates" ? deepTab : undefined} />
            </TabsContent>
            <TabsContent value="bank-statements">
              <BankStatementTemplatesTab />
            </TabsContent>
            <TabsContent value="email-signatures">
              <EmailSignaturesTab />
            </TabsContent>
            <TabsContent value="pdf-fields">
              <PdfFieldsTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </ExpandableSection>
  );
}
