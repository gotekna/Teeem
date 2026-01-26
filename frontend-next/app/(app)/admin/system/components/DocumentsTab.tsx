"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, FileCode, FormInput, Landmark, Receipt, Mail } from "lucide-react";
import { DocumentTypesTab } from "./DocumentTypesTab";
import { DocumentTemplatesContent } from "./DocumentTemplatesTab";
import { BankStatementTemplatesTab } from "./BankStatementTemplatesTab";
import { InvoiceTemplatesTab } from "./InvoiceTemplatesTab";
import { EmailSignaturesTab } from "./EmailSignaturesTab";
import { PdfFieldsTab } from "./PdfFieldsTab";

/**
 * DocumentsTab - Consolidated document configuration
 *
 * SSoT: This is THE ONE location for document settings.
 * Contains:
 * - Document Types (categories for documents)
 * - Document Templates (Tekna document templates)
 * - Bank Statements (bank statement parsing templates)
 * - Invoice Templates (invoice PDF templates)
 * - Email Signatures (signature style preferences)
 * - PDF Fields (field mappings for PDFs)
 *
 * Note: This was flattened from a nested structure in Jan 2026
 * Previously: Documents > Templates > (Doc Templates, Bank Statements, Invoice Templates)
 * Now: Documents > (Doc Types, Doc Templates, Bank Statements, Invoice Templates, Email Signatures, PDF Fields)
 */

const DOCUMENTS_SUB_TABS = [
  { id: "types", label: "Document Types", icon: FileText },
  { id: "document-templates", label: "Document Templates", icon: FileCode },
  { id: "bank-statements", label: "Bank Statements", icon: Landmark },
  { id: "invoice-templates", label: "Invoice Templates", icon: Receipt },
  { id: "email-signatures", label: "Email Signatures", icon: Mail },
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
        <TabsList className="flex-wrap h-auto gap-1">
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
          <TabsContent value="document-templates">
            <DocumentTemplatesContent basePath={`${basePath}/document-templates`} />
          </TabsContent>
          <TabsContent value="bank-statements">
            <BankStatementTemplatesTab />
          </TabsContent>
          <TabsContent value="invoice-templates">
            <InvoiceTemplatesTab />
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
  );
}
