"use client";

import Link from "next/link";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { XeroSyncSection } from "@/components/contacts/XeroSyncSection";
import { XeroTransactionsSection } from "@/components/contacts/XeroTransactionsSection";
import { PendingXeroReviewPanel } from "@/components/contacts/PendingXeroReviewPanel";
import { XeroInvoicesListByTenant } from "@/components/contacts/XeroInvoicesListByTenant";
import type { Contact } from "../types";
import { formatABN } from "../types";

interface ContactFinancialTabProps {
  contact: Contact;
  activeFinancialSubTab: string;
  handleFinancialSubTabChange: (value: string) => void;
  setContact: (contact: Contact) => void;
  handleViewInvoiceDetail: (invoiceId: string) => void;
}

export function ContactFinancialTab({
  contact,
  activeFinancialSubTab,
  handleFinancialSubTabChange,
  setContact,
  handleViewInvoiceDetail,
}: ContactFinancialTabProps) {
  return (
    <Tabs value={activeFinancialSubTab} onValueChange={handleFinancialSubTabChange}>
      <TabsList className="mb-4">
        <TabsTrigger value="bank">
          <CreditCard className="h-3.5 w-3.5 mr-1" />
          Bank Details
        </TabsTrigger>
        <TabsTrigger value="xero">
          <ExternalLink className="h-3.5 w-3.5 mr-1" />
          Xero
        </TabsTrigger>
        {contact["is_supplier?"] && (
          <TabsTrigger value="bills">
            <FileText className="h-3.5 w-3.5 mr-1" />
            Bills
          </TabsTrigger>
        )}
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
          setContact={setContact}
          handleViewInvoiceDetail={handleViewInvoiceDetail}
        />
      </TabsContent>

      {/* Bills Sub-Tab */}
      {contact["is_supplier?"] && (
        <TabsContent value="bills" className="mt-4">
          <BillsSubTab
            contactId={contact.id}
            handleViewInvoiceDetail={handleViewInvoiceDetail}
          />
        </TabsContent>
      )}

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
                    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : contact.abn_valid === false ? (
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
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
// Xero Sub-Tab
// ================================

interface XeroSubTabProps {
  contact: Contact;
  setContact: (contact: Contact) => void;
  handleViewInvoiceDetail: (invoiceId: string) => void;
}

function XeroSubTab({
  contact,
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
        xeroLink={null}
        onViewInvoiceDetail={handleViewInvoiceDetail}
      />
    </div>
  );
}

// ================================
// Bills Sub-Tab
// ================================

interface BillsSubTabProps {
  contactId: number;
  handleViewInvoiceDetail: (invoiceId: string) => void;
}

function BillsSubTab({ contactId, handleViewInvoiceDetail }: BillsSubTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bills</CardTitle>
      </CardHeader>
      <CardContent>
        <XeroInvoicesListByTenant
          contactId={contactId}
          type="ACCPAY"
          onViewInvoiceDetail={handleViewInvoiceDetail}
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
                  className="font-semibold text-blue-600 hover:underline flex items-center gap-1"
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

function PurchaseOrdersSubTab({ contact }: { contact: Contact }) {
  const purchaseOrders = (contact as any).purchase_orders;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase Orders</CardTitle>
      </CardHeader>
      <CardContent>
        {purchaseOrders && purchaseOrders.length > 0 ? (
          <div className="space-y-3">
            {purchaseOrders.map((po: any) => (
              <div key={po.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-semibold">PO #{po.po_number || po.id}</div>
                    {po.job_title && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Job: {po.job_title}
                      </div>
                    )}
                    {po.total && (
                      <div className="text-sm font-medium mt-2">
                        Total: ${po.total.toLocaleString()}
                      </div>
                    )}
                  </div>
                  {po.status && (
                    <Badge variant="secondary">{po.status}</Badge>
                  )}
                </div>
              </div>
            ))}
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
