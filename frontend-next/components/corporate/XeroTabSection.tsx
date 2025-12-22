"use client";

/**
 * XeroTabSection - Xero Tab Content with Two-Level Navigation
 *
 * Extracted from corporate page for unified tab system.
 * Contains all Xero-related state, computed values, effects, and rendering.
 *
 * Features:
 * - Level 1 tabs: Main Xero feature tabs (Connection, Overview, Accounts, etc.)
 * - Level 2 tabs: Sub-tabs for parent groups (P&L → Statement/Transactions)
 * - Dynamic tab visibility based on company consolidation status
 * - Loading states for contacts, invoices, bills
 * - Bill drawer for quick preview
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { format, isValid } from "date-fns";
import TeeemTableView from "@/components/table/TeeemTableView";
import { XeroStatementView } from "@/components/corporate/XeroStatementView";
import { XeroSetupWizard } from "@/components/xero/XeroSetupWizard";
import { XeroContactsTable } from "@/components/xero/XeroContactsTable";
import {
  XeroConnectionCard,
  XeroOverviewCard,
  XeroAccountsCard,
  XeroProfitLossCard,
  XeroBalanceSheetCard,
  XeroPLStatementView,
  XeroBalanceSheetStatementView,
  XeroBankAccountsCard,
  XeroReportsPanel,
  XeroConsolidatedCard,
  XeroCompanyDocSyncCard,
  XeroGroupPLCard,
  XeroGroupBalanceSheetCard,
} from "@/components/xero";
import { useXeroEntityTabs } from "@/lib/hooks/useXeroEntityTabs";
import type { CorporateCompany } from "@/lib/types/corporate";

// Safe date formatter that handles null/invalid dates
const safeFormatDate = (dateValue: string | Date | null | undefined, formatStr: string, fallback = "—"): string => {
  if (!dateValue) return fallback;
  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  return isValid(date) ? format(date, formatStr) : fallback;
};

interface XeroTabSectionProps {
  companyId: string;
  company: CorporateCompany;
  // CompanyDocumentsTab for document folder tabs
  DocumentsTabComponent: React.ComponentType<{
    companyId: string;
    company: CorporateCompany;
    category?: string;
  }>;
}

export function XeroTabSection({
  companyId,
  company,
  DocumentsTabComponent,
}: XeroTabSectionProps) {
  const router = useRouter();

  // Xero tab state
  const [xeroSubTab, setXeroSubTab] = React.useState("connection");
  const [xeroConnected, setXeroConnected] = React.useState(false);

  // Xero data loading state
  const [xeroContacts, setXeroContacts] = React.useState<any[]>([]);
  const [xeroContactsLoading, setXeroContactsLoading] = React.useState(false);
  const [xeroBills, setXeroBills] = React.useState<any[]>([]);
  const [xeroBillsLoading, setXeroBillsLoading] = React.useState(false);
  const [xeroInvoices, setXeroInvoices] = React.useState<any[]>([]);
  const [xeroInvoicesLoading, setXeroInvoicesLoading] = React.useState(false);

  // Bill drawer state
  const [selectedBill, setSelectedBill] = React.useState<any | null>(null);
  const [isBillDrawerOpen, setIsBillDrawerOpen] = React.useState(false);
  const billClickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // SSoT: Xero feature tabs from EntityTabs API
  const { tabs: xeroFeatureTabs } = useXeroEntityTabs();

  // Bill click handlers (single = drawer, double = navigate)
  const handleBillSingleClick = (bill: any) => {
    if (billClickTimeoutRef.current) {
      clearTimeout(billClickTimeoutRef.current);
    }
    billClickTimeoutRef.current = setTimeout(() => {
      setSelectedBill(bill);
      setIsBillDrawerOpen(true);
      billClickTimeoutRef.current = null;
    }, 200);
  };

  const handleBillDoubleClick = (bill: any) => {
    if (billClickTimeoutRef.current) {
      clearTimeout(billClickTimeoutRef.current);
      billClickTimeoutRef.current = null;
    }
    setIsBillDrawerOpen(false);
    setSelectedBill(null);
    if (bill.id) {
      router.push(`/finance/invoices/${bill.id}`);
    }
  };

  // Compute merged Xero sub-tabs with visibility filtering
  // Visibility rules:
  // - head_only: Only show if company is a head (has_consolidated_children)
  // - group_member: Show if company is part of a group (is head OR has a parent)
  // SSoT: All tabs sorted by order_position from admin config
  const mergedXeroSubTabs = React.useMemo(() => {
    const isHeadCompany = company?.has_consolidated_children === true;
    const isPartOfGroup = isHeadCompany || !!company?.consolidation_parent_id;

    return xeroFeatureTabs
      .filter(tab => {
        if (tab.head_only && !isHeadCompany) return false;
        if (tab.group_member && !isPartOfGroup) return false;
        return true;
      })
      .sort((a, b) => (a.order_position ?? 999) - (b.order_position ?? 999));
  }, [xeroFeatureTabs, company?.has_consolidated_children, company?.consolidation_parent_id]);

  // Level 1 tabs: tabs without a parent (top-level tabs shown in the tab bar)
  const xeroLevel1Tabs = React.useMemo(() => {
    return mergedXeroSubTabs.filter(tab => !tab.parent);
  }, [mergedXeroSubTabs]);

  // Get child tabs for a given parent
  const getXeroChildTabs = React.useCallback((parentKey: string) => {
    return mergedXeroSubTabs.filter(tab => tab.parent === parentKey);
  }, [mergedXeroSubTabs]);

  // Check if current xeroSubTab belongs to a parent group
  const currentXeroParent = React.useMemo(() => {
    const currentTab = mergedXeroSubTabs.find(t => t.id === xeroSubTab);
    if (currentTab?.parent) return currentTab.parent;
    const level1Tab = xeroLevel1Tabs.find(t => t.id === xeroSubTab);
    if (level1Tab?.is_parent) return xeroSubTab;
    return null;
  }, [xeroSubTab, mergedXeroSubTabs, xeroLevel1Tabs]);

  // Load contacts linked to this company's Xero tenant when contacts tab is selected
  React.useEffect(() => {
    const loadXeroContacts = async () => {
      const tenantId = company?.corporate_company_xero_connection?.xero_tenant_id;
      if (xeroSubTab !== "contacts" || !tenantId) return;

      setXeroContactsLoading(true);
      try {
        const response = await api.get<{ success: boolean; contacts: any[] }>(
          `/api/v1/contacts?xero_tenant_id=${tenantId}`
        );
        if (response.success) {
          setXeroContacts(response.contacts || []);
        }
      } catch (error) {
        console.error("Failed to load Xero contacts:", error);
      } finally {
        setXeroContactsLoading(false);
      }
    };
    loadXeroContacts();
  }, [xeroSubTab, company?.corporate_company_xero_connection?.xero_tenant_id]);

  // Load bills when Bills tab is selected
  React.useEffect(() => {
    const loadXeroBills = async () => {
      const tenantId = company?.corporate_company_xero_connection?.xero_tenant_id;
      if (xeroSubTab !== "xero-bills" || !tenantId) return;

      setXeroBillsLoading(true);
      try {
        const response = await api.get<{ success: boolean; data: any[] }>(
          `/api/v1/external_invoices?tenant_id=${tenantId}&type=bill&per_page=200`
        );
        if (response.success) {
          setXeroBills(response.data || []);
        }
      } catch (error) {
        console.error("Failed to load Xero bills:", error);
      } finally {
        setXeroBillsLoading(false);
      }
    };
    loadXeroBills();
  }, [xeroSubTab, company?.corporate_company_xero_connection?.xero_tenant_id]);

  // Load invoices when Invoices tab is selected
  React.useEffect(() => {
    const loadXeroInvoices = async () => {
      const tenantId = company?.corporate_company_xero_connection?.xero_tenant_id;
      if (xeroSubTab !== "xero-invoices" || !tenantId) return;

      setXeroInvoicesLoading(true);
      try {
        const response = await api.get<{ success: boolean; data: any[] }>(
          `/api/v1/external_invoices?tenant_id=${tenantId}&type=sales_invoice&per_page=200`
        );
        if (response.success) {
          setXeroInvoices(response.data || []);
        }
      } catch (error) {
        console.error("Failed to load Xero invoices:", error);
      } finally {
        setXeroInvoicesLoading(false);
      }
    };
    loadXeroInvoices();
  }, [xeroSubTab, company?.corporate_company_xero_connection?.xero_tenant_id]);

  return (
    <>
      {/* Level 1: Main Xero tabs (tabs without a parent) - SSoT: ordered by order_position */}
      <div className="flex gap-2 mb-2 border-b flex-wrap">
        {xeroLevel1Tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setXeroSubTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              (xeroSubTab === tab.id || (tab.is_parent && currentXeroParent === tab.id))
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Level 2: Sub-tabs for parent groups (dynamically rendered from getXeroChildTabs) */}
      {currentXeroParent && (
        <div className="flex gap-2 mb-4 bg-muted/50 rounded-lg p-1 w-fit">
          {getXeroChildTabs(currentXeroParent).map((child) => (
            <button
              key={child.id}
              onClick={() => setXeroSubTab(child.id)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                xeroSubTab === child.id
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {/* Show short name (strip parent prefix if present) */}
              {child.name.includes('Transactions') ? 'Transactions' :
               child.name.includes('Statement') ? 'Statement' : child.name}
            </button>
          ))}
        </div>
      )}

      {xeroSubTab === "connection" && (
        <div className="space-y-4">
          <XeroConnectionCard
            companyId={companyId}
            companyName={company?.name}
            onConnectionChange={setXeroConnected}
          />
          {/* Setup Wizard - shows after connection to guide first-time setup */}
          {xeroConnected && (
            <>
              <XeroSetupWizard
                companyId={companyId}
                companyName={company?.name}
                onComplete={() => setXeroSubTab("overview")}
              />
              {/* Document Sync Status - shows PDF sync progress for this company */}
              <XeroCompanyDocSyncCard companyId={companyId} />
            </>
          )}
        </div>
      )}

      {xeroSubTab === "overview" && (
        <XeroOverviewCard companyId={companyId} />
      )}

      {xeroSubTab === "accounts" && (
        <XeroAccountsCard companyId={companyId} companyName={company?.name} />
      )}

      {xeroSubTab === "profit-loss" && (
        <XeroProfitLossCard companyId={companyId} />
      )}

      {xeroSubTab === "balance-sheet" && (
        <XeroBalanceSheetCard companyId={companyId} />
      )}

      {xeroSubTab === "reports" && (
        <XeroReportsPanel companyId={companyId} />
      )}

      {/* Statement sub-tabs - show P&L PDF reports in table */}
      {xeroSubTab === "profit-loss-statement" && (
        <XeroPLStatementView companyId={companyId} />
      )}

      {/* Transactions sub-tabs - show raw P&L data from Xero */}
      {xeroSubTab === "xero-profit-loss-transactions" && (
        <XeroProfitLossCard companyId={companyId} />
      )}

      {xeroSubTab === "balance-sheet-statement" && (
        <XeroBalanceSheetStatementView companyId={companyId} />
      )}

      {xeroSubTab === "xero-balance-sheet-transactions" && (
        <XeroBalanceSheetCard companyId={companyId} />
      )}

      {xeroSubTab === "xero-bank-statement" && (
        <XeroStatementView companyId={companyId} />
      )}

      {xeroSubTab === "xero-bank-accounts" && (
        <XeroBankAccountsCard companyId={companyId} />
      )}

      {/* Contacts tab - shows contacts linked to this company's Xero tenant */}
      {xeroSubTab === "contacts" && (
        <div className="flex flex-col h-full -mx-4">
          {xeroContactsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : xeroContacts.length === 0 ? (
            <Card className="mx-4">
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  <p className="font-medium mb-2">No Contacts Linked</p>
                  <p className="text-sm">No contacts are linked to this Xero account yet.</p>
                  <p className="text-sm mt-2">Link contacts to Xero in the Contacts module.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="px-4">
              <XeroContactsTable
                contacts={xeroContacts}
                onRowClick={(contact) => router.push(`/contacts/${contact.id}`)}
                onAddContact={() => router.push("/contacts/new")}
              />
            </div>
          )}
        </div>
      )}

      {/* Invoices tab - shows sales invoices for this company */}
      {xeroSubTab === "xero-invoices" && (
        <div className="flex flex-col h-full -mx-4">
          {xeroInvoicesLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : xeroInvoices.length === 0 ? (
            <Card className="mx-4">
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  <p className="font-medium mb-2">No Sales Invoices</p>
                  <p className="text-sm">No sales invoices found for this Xero account.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <TeeemTableView
              entries={xeroInvoices}
              foundationId="external_invoices"
              foundationIdNumeric={523}
              tableName="Sales Invoices"
              onRefresh={async () => {
                const tenantId = company?.corporate_company_xero_connection?.xero_tenant_id;
                if (tenantId) {
                  setXeroInvoicesLoading(true);
                  try {
                    const response = await api.get<{ success: boolean; data: any[] }>(
                      `/api/v1/external_invoices?tenant_id=${tenantId}&type=sales_invoice&per_page=200`
                    );
                    if (response.success) {
                      setXeroInvoices(response.data || []);
                    }
                  } finally {
                    setXeroInvoicesLoading(false);
                  }
                }
              }}
              enableExport={true}
            />
          )}
        </div>
      )}

      {/* Bills tab - shows bills for this company */}
      {xeroSubTab === "xero-bills" && (
        <div className="flex flex-col h-full -mx-4">
          {xeroBillsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : xeroBills.length === 0 ? (
            <Card className="mx-4">
              <CardContent className="p-6">
                <div className="text-center text-muted-foreground">
                  <p className="font-medium mb-2">No Bills</p>
                  <p className="text-sm">No bills found for this Xero account.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <TeeemTableView
              entries={xeroBills}
              foundationId="external_invoices"
              foundationIdNumeric={523}
              tableName="Bills"
              onRowClick={handleBillSingleClick}
              onRowDoubleClick={handleBillDoubleClick}
              onRefresh={async () => {
                const tenantId = company?.corporate_company_xero_connection?.xero_tenant_id;
                if (tenantId) {
                  setXeroBillsLoading(true);
                  try {
                    const response = await api.get<{ success: boolean; data: any[] }>(
                      `/api/v1/external_invoices?tenant_id=${tenantId}&type=bill&per_page=200`
                    );
                    if (response.success) {
                      setXeroBills(response.data || []);
                    }
                  } finally {
                    setXeroBillsLoading(false);
                  }
                }
              }}
              enableExport={true}
            />
          )}
        </div>
      )}

      {xeroSubTab === "xero-consolidated-accounts" && (
        <XeroConsolidatedCard companyId={companyId} companyName={company?.name} />
      )}

      {/* Group reports - for any company in a group */}
      {xeroSubTab === "xero-consolidated-pl" && (
        <XeroGroupPLCard companyId={companyId} />
      )}

      {xeroSubTab === "xero-consolidated-bs" && (
        <XeroGroupBalanceSheetCard companyId={companyId} />
      )}

      {/* Document folder sub-tabs from API (SSoT) */}
      {xeroSubTab.startsWith('xero-doc-') && (
        <DocumentsTabComponent
          companyId={companyId}
          company={company}
          category={mergedXeroSubTabs.find(t => t.id === xeroSubTab)?.name || 'XERO'}
        />
      )}

      {/* Bill/Invoice Drawer - Single click preview */}
      <Sheet open={isBillDrawerOpen} onOpenChange={setIsBillDrawerOpen}>
        <SheetContent className="w-[500px] sm:w-[600px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedBill?.invoice_number || "Bill Details"}
            </SheetTitle>
            <SheetDescription>
              {selectedBill?.contact_name || "Unknown Contact"}
            </SheetDescription>
          </SheetHeader>
          {selectedBill && (
            <div className="mt-6 space-y-6">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <Badge variant={selectedBill.status === "paid" ? "default" : "secondary"}>
                  {selectedBill.status?.toUpperCase()}
                </Badge>
                {selectedBill.contact_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/contacts/${selectedBill.contact_id}`)}
                  >
                    View Contact
                  </Button>
                )}
              </div>

              {/* Amount Summary */}
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">
                        ${Number(selectedBill.total || 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Amount Due</p>
                      <p className="text-2xl font-bold text-red-600">
                        ${Number(selectedBill.amount_due || 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Invoice Date</span>
                  <span className="font-medium">
                    {selectedBill.invoice_date ? safeFormatDate(selectedBill.invoice_date, "d MMM yyyy") : "—"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Due Date</span>
                  <span className="font-medium">
                    {selectedBill.due_date ? safeFormatDate(selectedBill.due_date, "d MMM yyyy") : "—"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-medium">{selectedBill.reference || "—"}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Currency</span>
                  <span className="font-medium">{selectedBill.currency_code || "AUD"}</span>
                </div>
              </div>

              {/* View Full Invoice button */}
              <Button
                className="w-full"
                onClick={() => {
                  setIsBillDrawerOpen(false);
                  router.push(`/finance/invoices/${selectedBill.id}`);
                }}
              >
                View Full Invoice
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

export default XeroTabSection;
