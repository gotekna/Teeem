"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  ExternalLink,
  FileText,
  Briefcase,
  Lock,
  Hash,
  CheckCircle,
  AlertTriangle,
  Percent,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";
import { XeroSyncSection } from "@/components/contacts/XeroSyncSection";
import { XeroTransactionsSection } from "@/components/contacts/XeroTransactionsSection";
import { PendingXeroReviewPanel } from "@/components/contacts/PendingXeroReviewPanel";
import { XeroInvoicesListByTenant } from "@/components/contacts/XeroInvoicesListByTenant";
import type { Contact } from "../types";
import { formatABN } from "../types";
import type { XeroLink } from "./ContactHeader";

// =============================================================================
// SSoT: Financial Tab Structure
// =============================================================================
// Level 1: Xero Connection tabs (dynamic - one per xeroLink)
// Level 2: Under each connection - Bank Details, Xero, Invoices, Bills, Jobs, POs
//
// If no Xero connections: Show "No Xero connections" message with link options
// If 1+ connections: Show tab for each connection name
// =============================================================================

interface ContactFinancialTabProps {
  contact: Contact;
  activeFinancialSubTab: string;
  handleFinancialSubTabChange: (value: string) => void;
  setContact: (contact: Contact) => void;
  handleViewInvoiceDetail: (invoiceId: string) => void;
  xeroLinks: XeroLink[];
}

export function ContactFinancialTab({
  contact,
  activeFinancialSubTab,
  handleFinancialSubTabChange,
  setContact,
  handleViewInvoiceDetail,
  xeroLinks,
}: ContactFinancialTabProps) {
  const hasXeroLinks = xeroLinks.length > 0;

  // Parse the activeFinancialSubTab to get connection and sub-tab
  // Format: "connection-{index}" or "connection-{index}-{subtab}"
  const { activeConnectionIndex, activeSubTab } = useMemo(() => {
    const parts = activeFinancialSubTab.split("-");
    if (parts[0] === "connection" && parts.length >= 2) {
      const index = parseInt(parts[1], 10);
      const subtab = parts.slice(2).join("-") || "bank";
      return { activeConnectionIndex: isNaN(index) ? 0 : index, activeSubTab: subtab };
    }
    // Default to first connection, bank tab
    return { activeConnectionIndex: 0, activeSubTab: "bank" };
  }, [activeFinancialSubTab]);

  // Handle connection tab change
  const handleConnectionChange = (connectionIndex: number) => {
    handleFinancialSubTabChange(`connection-${connectionIndex}-bank`);
  };

  // Handle sub-tab change within a connection
  const handleSubTabChange = (subtab: string) => {
    handleFinancialSubTabChange(`connection-${activeConnectionIndex}-${subtab}`);
  };

  // No Xero connections - show setup prompt
  if (!hasXeroLinks) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Financial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-4">
            <p className="text-muted-foreground">
              No Xero connections found for this contact.
            </p>
            <p className="text-sm text-muted-foreground">
              Link this contact to a Xero organization to view financial data.
            </p>
            <XeroSyncSection
              contact={contact}
              onContactUpdate={(updatedContact) => setContact(updatedContact as Contact)}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Level 1: Xero Connection Tabs */}
      <Tabs
        value={`connection-${activeConnectionIndex}`}
        onValueChange={(v) => {
          const index = parseInt(v.replace("connection-", ""), 10);
          handleConnectionChange(index);
        }}
      >
        <TabsList className="mb-4">
          {xeroLinks.map((link, index) => (
            <TabsTrigger key={link.xero_tenant_id} value={`connection-${index}`}>
              <Building2 className="h-3.5 w-3.5 mr-1" />
              {link.xero_tenant_name}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Content for each Xero connection */}
        {xeroLinks.map((link, index) => (
          <TabsContent key={link.xero_tenant_id} value={`connection-${index}`}>
            {/* Level 2: Sub-tabs within this connection */}
            <XeroConnectionSubTabs
              contact={contact}
              xeroLink={link}
              activeSubTab={activeSubTab}
              onSubTabChange={handleSubTabChange}
              setContact={setContact}
              handleViewInvoiceDetail={handleViewInvoiceDetail}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// =============================================================================
// Level 2: Sub-tabs within a Xero Connection
// =============================================================================

interface XeroConnectionSubTabsProps {
  contact: Contact;
  xeroLink: XeroLink;
  activeSubTab: string;
  onSubTabChange: (subtab: string) => void;
  setContact: (contact: Contact) => void;
  handleViewInvoiceDetail: (invoiceId: string) => void;
}

function XeroConnectionSubTabs({
  contact,
  xeroLink,
  activeSubTab,
  onSubTabChange,
  setContact,
  handleViewInvoiceDetail,
}: XeroConnectionSubTabsProps) {
  return (
    <Tabs value={activeSubTab} onValueChange={onSubTabChange}>
      <TabsList className="mb-4">
        <TabsTrigger value="bank">
          <CreditCard className="h-3.5 w-3.5 mr-1" />
          Bank Details
        </TabsTrigger>
        <TabsTrigger value="xero">
          <ExternalLink className="h-3.5 w-3.5 mr-1" />
          Xero
        </TabsTrigger>
        <TabsTrigger value="invoices">
          <FileText className="h-3.5 w-3.5 mr-1" />
          Invoices
        </TabsTrigger>
        <TabsTrigger value="bills">
          <FileText className="h-3.5 w-3.5 mr-1" />
          Bills
        </TabsTrigger>
        <TabsTrigger value="jobs">
          <Briefcase className="h-3.5 w-3.5 mr-1" />
          Jobs
        </TabsTrigger>
        {contact["is_supplier?"] && (
          <TabsTrigger value="purchase-orders">
            <FileText className="h-3.5 w-3.5 mr-1" />
            Purchase Orders
          </TabsTrigger>
        )}
      </TabsList>

      {/* Bank Details Sub-Tab */}
      <TabsContent value="bank" className="mt-4">
        <BankDetailsSubTab contact={contact} />
      </TabsContent>

      {/* Xero Sub-Tab */}
      <TabsContent value="xero" className="mt-4">
        <XeroSubTab
          contact={contact}
          xeroLink={xeroLink}
          setContact={setContact}
          handleViewInvoiceDetail={handleViewInvoiceDetail}
        />
      </TabsContent>

      {/* Invoices Sub-Tab - filtered to this Xero connection */}
      <TabsContent value="invoices" className="mt-4">
        <InvoicesSubTab
          contactId={contact.id}
          handleViewInvoiceDetail={handleViewInvoiceDetail}
          xeroLink={xeroLink}
        />
      </TabsContent>

      {/* Bills Sub-Tab - filtered to this Xero connection */}
      <TabsContent value="bills" className="mt-4">
        <BillsSubTab
          contactId={contact.id}
          handleViewInvoiceDetail={handleViewInvoiceDetail}
          xeroLink={xeroLink}
        />
      </TabsContent>

      {/* Jobs Sub-Tab */}
      <TabsContent value="jobs" className="mt-4">
        <JobsSubTab contact={contact} />
      </TabsContent>

      {/* Purchase Orders Sub-Tab */}
      {contact["is_supplier?"] && (
        <TabsContent value="purchase-orders" className="mt-4">
          <PurchaseOrdersSubTab contact={contact} />
        </TabsContent>
      )}
    </Tabs>
  );
}

// ================================
// Bank Details Sub-Tab
// ================================

function BankDetailsSubTab({ contact }: { contact: Contact }) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bank Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Bank Details
              {!contact.can_view_confidential && (
                <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                  <Lock className="h-3 w-3 mr-1" />
                  Restricted
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">BSB</p>
              <p className="text-sm font-medium font-mono">
                {contact.bank_bsb === "[RESTRICTED]" ? (
                  <span className="text-amber-600 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Restricted
                  </span>
                ) : contact.bank_bsb ? (
                  contact.bank_bsb
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Account Number</p>
              <p className="text-sm font-medium font-mono">
                {contact.bank_account_number === "[RESTRICTED]" ? (
                  <span className="text-amber-600 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Restricted
                  </span>
                ) : contact.bank_account_number ? (
                  contact.bank_account_number
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Account Name</p>
              <p className="text-sm font-medium">
                {contact.bank_account_name === "[RESTRICTED]" ? (
                  <span className="text-amber-600 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Restricted
                  </span>
                ) : contact.bank_account_name ? (
                  contact.bank_account_name
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tax Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Tax Information
              {!contact.can_view_confidential && (
                <Badge variant="outline" className="ml-2 text-amber-600 border-amber-300">
                  <Lock className="h-3 w-3 mr-1" />
                  Restricted
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">ABN / TFN</p>
              <p className="text-sm font-medium font-mono">
                {contact.abn === "[RESTRICTED]" ? (
                  <span className="text-amber-600 flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Restricted
                  </span>
                ) : contact.abn ? (
                  formatABN(contact.abn)
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </p>
            </div>

            {/* ABN Verification Status */}
            {contact.abn && contact.abn !== "[RESTRICTED]" && contact.abn.replace(/\D/g, "").length === 11 && (
              <div className="pt-3 border-t">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground">ABN Verification</p>
                  {contact.abn_valid ? (
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-900/30 dark:text-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : contact.abn_valid === false ? (
                    <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 dark:bg-red-900/30 dark:text-red-300">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Invalid
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      Not Verified
                    </Badge>
                  )}
                </div>
                {contact.abn_entity_name && (
                  <div className="text-sm">
                    <p className="font-medium">{contact.abn_entity_name}</p>
                    {contact.abn_entity_type && (
                      <p className="text-xs text-muted-foreground">{contact.abn_entity_type}</p>
                    )}
                  </div>
                )}
                {contact.abn_gst_registered && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    GST Registered
                  </p>
                )}
                {contact.abn_verified_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Verified: {new Date(contact.abn_verified_at).toLocaleDateString("en-AU")}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary and Payment Terms Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Financial Summary */}
        {(contact["is_supplier?"] || contact["is_customer?"]) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contact["is_customer?"] && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Accounts Receivable:</span>
                    <span className="text-sm font-medium">
                      {contact.accounts_receivable_outstanding != null
                        ? `$${contact.accounts_receivable_outstanding.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "-"}
                    </span>
                  </div>
                  {contact.accounts_receivable_overdue != null && contact.accounts_receivable_overdue > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">AR Overdue:</span>
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        ${contact.accounts_receivable_overdue.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </>
              )}
              {contact["is_supplier?"] && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Accounts Payable:</span>
                    <span className="text-sm font-medium">
                      {contact.accounts_payable_outstanding != null
                        ? `$${contact.accounts_payable_outstanding.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "-"}
                    </span>
                  </div>
                  {contact.accounts_payable_overdue != null && contact.accounts_payable_overdue > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">AP Overdue:</span>
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        ${contact.accounts_payable_overdue.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payment Terms */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Payment Terms
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contact["is_supplier?"] && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Bill Payment Terms</p>
                <p className="text-sm font-medium">
                  {contact.bill_due_day && contact.bill_due_type
                    ? `${contact.bill_due_day} days (${contact.bill_due_type})`
                    : "-"}
                </p>
              </div>
            )}
            {contact["is_customer?"] && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Sales Payment Terms</p>
                <p className="text-sm font-medium">
                  {contact.sales_due_day && contact.sales_due_type
                    ? `${contact.sales_due_day} days (${contact.sales_due_type})`
                    : "-"}
                </p>
              </div>
            )}
            {contact.default_discount != null && contact.default_discount > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Default Discount</p>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  {contact.default_discount}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ================================
// Xero Sub-Tab (per connection)
// ================================

interface XeroSubTabProps {
  contact: Contact;
  xeroLink: XeroLink;
  setContact: (contact: Contact) => void;
  handleViewInvoiceDetail: (invoiceId: string) => void;
}

function XeroSubTab({
  contact,
  xeroLink,
  setContact,
  handleViewInvoiceDetail,
}: XeroSubTabProps) {
  return (
    <div className="space-y-6">
      <PendingXeroReviewPanel />
      <XeroSyncSection
        contact={contact}
        onContactUpdate={(updatedContact) => setContact(updatedContact as Contact)}
      />
      <XeroTransactionsSection
        contactId={contact.id}
        xeroLink={xeroLink}
        onViewInvoiceDetail={handleViewInvoiceDetail}
      />
    </div>
  );
}

// ================================
// Invoices Sub-Tab (per connection)
// ================================

interface InvoicesSubTabProps {
  contactId: number;
  handleViewInvoiceDetail: (invoiceId: string) => void;
  xeroLink: XeroLink;
}

function InvoicesSubTab({ contactId, handleViewInvoiceDetail, xeroLink }: InvoicesSubTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Invoices
          <Badge variant="outline" className="text-xs">
            {xeroLink.xero_tenant_name}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <XeroInvoicesListByTenant
          contactId={contactId}
          type="ACCREC"
          onViewInvoiceDetail={handleViewInvoiceDetail}
          linkedTenants={[xeroLink]}
        />
      </CardContent>
    </Card>
  );
}

// ================================
// Bills Sub-Tab (per connection)
// ================================

interface BillsSubTabProps {
  contactId: number;
  handleViewInvoiceDetail: (invoiceId: string) => void;
  xeroLink: XeroLink;
}

function BillsSubTab({ contactId, handleViewInvoiceDetail, xeroLink }: BillsSubTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Bills
          <Badge variant="outline" className="text-xs">
            {xeroLink.xero_tenant_name}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <XeroInvoicesListByTenant
          contactId={contactId}
          type="ACCPAY"
          onViewInvoiceDetail={handleViewInvoiceDetail}
          linkedTenants={[xeroLink]}
        />
      </CardContent>
    </Card>
  );
}

// ================================
// Jobs Sub-Tab
// ================================

function JobsSubTab({ contact }: { contact: Contact }) {
  const relatedJobs = (contact as any).related_jobs;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Jobs</CardTitle>
      </CardHeader>
      <CardContent>
        {relatedJobs && relatedJobs.length > 0 ? (
          <div className="space-y-3">
            {relatedJobs.map((job: any) => (
              <div key={job.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <Link
                  href={`/jobs/${job.id}`}
                  className="font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  {job.title || `Job #${job.id}`}
                  <ExternalLink className="h-3 w-3" />
                </Link>
                {job.status && (
                  <Badge variant="secondary" className="mt-2">
                    {job.status}
                  </Badge>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            No jobs associated with this contact.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ================================
// Purchase Orders Sub-Tab
// ================================

interface PurchaseOrder {
  id: number;
  purchase_order_number: string;
  status: string;
  total: number | null;
  sub_total: number | null;
  required_date: string | null;
  ordered_date: string | null;
  description: string | null;
  job?: {
    id: number;
    title: string;
    job_code: string;
  } | null;
  supplier?: {
    id: number;
    display_name: string;
  } | null;
}

interface PurchaseOrdersResponse {
  purchase_orders: PurchaseOrder[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
  };
}

function PurchaseOrdersSubTab({ contact }: { contact: Contact }) {
  const router = useRouter();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadPurchaseOrders();
  }, [contact.id]);

  const loadPurchaseOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<PurchaseOrdersResponse>(
        `/api/v1/purchase_orders?supplier_id=${contact.id}&per_page=100`
      );

      if (response?.purchase_orders) {
        setPurchaseOrders(response.purchase_orders);
        setTotal(response.pagination?.total_count || response.purchase_orders.length);
      }
    } catch (err) {
      console.error("Failed to load purchase orders:", err);
      setError(err instanceof Error ? err.message : "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  // Define columns for TeeemTableView
  const columns: TableColumn[] = useMemo(() => [
    { key: "purchase_order_number", label: "PO #", width: 120, sortable: true },
    { key: "job_title", label: "Job", width: 250, sortable: true },
    { key: "description", label: "Description", width: 200, sortable: true },
    { key: "status", label: "Status", width: 100, sortable: true, column_type: "badge" },
    { key: "required_date", label: "Required", width: 110, sortable: true, column_type: "date" },
    { key: "ordered_date", label: "Ordered", width: 110, sortable: true, column_type: "date" },
    { key: "total", label: "Total", width: 120, sortable: true, column_type: "currency", showSum: true, sumType: "currency" },
  ], []);

  // Transform to rows
  const rows: TableRow[] = useMemo(() => {
    return purchaseOrders.map((po) => ({
      id: po.id,
      purchase_order_number: po.purchase_order_number,
      job_id: po.job?.id,
      job_title: po.job ? `${po.job.job_code} - ${po.job.title}` : null,
      description: po.description,
      status: po.status?.toUpperCase(),
      required_date: po.required_date,
      ordered_date: po.ordered_date,
      total: po.total,
    }));
  }, [purchaseOrders]);

  const handleRowClick = (row: TableRow) => {
    if (row.id) {
      router.push(`/purchase-orders/${row.id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Purchase Orders</span>
          {total > 0 && (
            <Badge variant="secondary">{total}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {purchaseOrders.length > 0 ? (
          <div className="-mx-6">
            <TeeemTableView
              entries={rows}
              columns={columns}
              tableName="Purchase Orders"
              onRowClick={handleRowClick}
              viewOnly={true}
              enableExport={true}
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            No purchase orders for this supplier.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
