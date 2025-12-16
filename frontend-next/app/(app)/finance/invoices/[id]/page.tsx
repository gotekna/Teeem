"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  CreditCard,
  ExternalLink,
  Download,
  RefreshCw,
  FileWarning,
  CheckCircle2,
} from "lucide-react";
import { api, getApiBaseUrl } from "@/lib/api";

// Types for external invoice data (from Xero)
interface LineItem {
  Description: string;
  Quantity: number;
  UnitAmount: number;
  TaxAmount?: number;
  LineAmount: number;
  AccountCode?: string;
}

interface Payment {
  PaymentID: string;
  Date: string;
  Amount: number;
  PaymentType?: string;
  Reference?: string;
  Status?: string;
}

interface Contact {
  id: number;
  display_name: string;
  abn?: string;
  bank_bsb?: string;
  bank_account_number?: string;
}

interface ExternalInvoice {
  id: number;
  external_id: string;
  invoice_number: string;
  reference?: string;
  invoice_type: string;
  status: string;
  invoice_date: string;
  due_date: string;
  fully_paid_date?: string;
  subtotal: number;
  total_tax: number;
  total: number;
  amount_due: number;
  amount_paid: number;
  currency_code: string;
  contact_id: number;
  contact_name: string;
  contact?: Contact;
  job_id: number | null;
  job_title: string | null;
  line_items: LineItem[];
  payments: Payment[];
  last_synced_at: string | null;
  external_updated_at: string | null;
  has_pdf: boolean;
  pdf_url: string | null;
  pdf_synced_at: string | null;
  tenant_id?: string;
  tenant_name?: string;
}

// Status color mapping - matching bills page
const statusColors: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
  AUTHORISED: "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400",
  SUBMITTED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-500",
  DELETED: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-400",
  VOIDED: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-400",
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params?.id as string;

  const [invoice, setInvoice] = useState<ExternalInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (invoiceId) {
      loadInvoice();
    }
  }, [invoiceId]);

  const loadInvoice = async () => {
    setLoading(true);
    setError(null);
    try {
      // Try to load by ID first, then by external_id
      let response;
      if (/^\d+$/.test(invoiceId)) {
        // Numeric ID - use show endpoint
        response = await api.get<{ success: boolean; data: ExternalInvoice }>(
          `/api/v1/external_invoices/${invoiceId}`
        );
      } else {
        // External ID (Xero UUID) - use by_external_id endpoint
        response = await api.get<{ success: boolean; data: ExternalInvoice }>(
          `/api/v1/external_invoices/by_external_id/${invoiceId}`
        );
      }

      if (response?.success && response.data) {
        setInvoice(response.data);
      } else {
        setError("Invoice not found");
      }
    } catch (err) {
      console.error("Failed to load invoice:", err);
      setError(err instanceof Error ? err.message : "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = "AUD") => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-AU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isBill = invoice?.invoice_type === "bill" || invoice?.invoice_type === "ACCPAY";
  const isOverdue = invoice?.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== "PAID";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileWarning className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Invoice not found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {error || "This invoice may have been deleted or doesn't exist."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex gap-4 p-2 w-full overflow-hidden -mt-4">
      {/* LEFT HALF - Header + Details (flexible width) */}
      <div className="flex-1 min-w-0 flex flex-col gap-2 overflow-hidden h-[calc(100vh-80px)]">
        {/* Header - EXACT same structure as bills page */}
        <div className="flex items-center justify-between p-1 shrink-0 bg-muted/30 rounded">
          {/* Left - Pay From / Pay To */}
          <div className="flex items-center gap-2">
            {/* Back Button */}
            <Button variant="ghost" size="sm" className="h-[42px] px-2" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {/* Company Box - Pay From */}
            <div className="px-3 py-1 bg-blue-600 text-white rounded min-w-[200px]">
              <div className="text-[10px] uppercase tracking-wide opacity-80">
                {isBill ? "Pay From" : "Invoice From"}
              </div>
              <div className="font-bold text-sm truncate" title={invoice.tenant_name || "Company"}>
                {invoice.tenant_name || "Company"}
              </div>
            </div>
            {/* Arrow */}
            <ArrowLeft className="h-5 w-5 text-gray-500 rotate-180" />
            {/* Supplier/Customer Box - Pay To / Invoice To */}
            <div className={`px-3 py-1 ${isBill ? "bg-green-600" : "bg-teal-600"} text-white rounded min-w-[200px]`}>
              <div className="text-[10px] uppercase tracking-wide opacity-80">
                {isBill ? "Pay To" : "Invoice To"}
              </div>
              <div className="font-bold text-sm truncate" title={invoice.contact_name}>
                {invoice.contact_name}
              </div>
            </div>
          </div>
          {/* Right - Invoice # and Status */}
          <div className="flex items-center gap-1">
            {/* Invoice Number Box */}
            <div className="px-2 py-1 bg-gray-700 text-white rounded min-w-[80px]">
              <div className="text-[10px] uppercase tracking-wide opacity-80">
                {isBill ? "Bill #" : "Invoice #"}
              </div>
              <div className="font-bold text-sm font-mono">{invoice.invoice_number || "-"}</div>
            </div>
            {/* Status Badge */}
            <Badge className={`${statusColors[invoice.status?.toUpperCase()] || statusColors.DRAFT} h-[42px] px-3 text-sm font-semibold`}>
              {invoice.status?.toUpperCase()}
            </Badge>
            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-[42px] px-2"
              onClick={loadInvoice}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Payment Summary Bar - Same style as bills page */}
        <Card className="shrink-0">
          <CardContent className="py-1.5 px-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="font-mono font-bold text-emerald-700">
                  {formatCurrency(invoice.total, invoice.currency_code)}
                </span>
                {invoice.amount_paid > 0 && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-green-600">
                      Paid: {formatCurrency(invoice.amount_paid, invoice.currency_code)}
                    </span>
                  </>
                )}
                {invoice.amount_due > 0 && (
                  <>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-red-600 font-semibold">
                      Due: {formatCurrency(invoice.amount_due, invoice.currency_code)}
                    </span>
                  </>
                )}
                <span className="text-muted-foreground">|</span>
                <span className={isOverdue ? "text-red-600 font-semibold" : ""}>
                  {formatDate(invoice.due_date)}
                  {isOverdue && " (Overdue)"}
                </span>
                <Badge className={`${statusColors[invoice.status?.toUpperCase()] || statusColors.DRAFT} text-[10px] px-1.5 py-0`}>
                  {invoice.status?.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {invoice.contact_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => router.push(`/contacts/${invoice.contact_id}`)}
                  >
                    <Building2 className="h-3 w-3 mr-1" />
                    View Contact
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details Grid - A4 proportioned panels */}
        <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
          {/* Invoice Details - A4 Portrait */}
          <Card className="overflow-auto aspect-[1/1.414] max-h-[calc(100vh-220px)]">
            <CardHeader className="py-2 px-3">
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {isBill ? "Bill" : "Invoice"} Details
                </span>
                <span className="text-[10px] font-normal text-muted-foreground">
                  From Xero
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 py-0 text-xs">
              {/* Row 1: Invoice # and Date */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-1.5 rounded bg-green-100 dark:bg-green-900/40 border-2 border-green-400 shadow-sm">
                  <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                    {isBill ? "Bill" : "Invoice"} #
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  </p>
                  <p className="font-mono font-bold">{invoice.invoice_number || "-"}</p>
                </div>
                <div className="p-1.5 rounded bg-green-100 dark:bg-green-900/40 border-2 border-green-400 shadow-sm">
                  <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                    {isBill ? "Bill" : "Invoice"} Date
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  </p>
                  <p className="font-bold">{formatDate(invoice.invoice_date)}</p>
                </div>
              </div>

              {/* Row 2: Due Date and Reference */}
              <div className="grid grid-cols-2 gap-2">
                <div className={`p-1.5 rounded ${
                  isOverdue
                    ? 'bg-red-100 dark:bg-red-900/40 border-2 border-red-400 shadow-sm'
                    : 'bg-green-100 dark:bg-green-900/40 border-2 border-green-400 shadow-sm'
                }`}>
                  <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                    Due Date
                    {!isOverdue && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                  </p>
                  <p className={`font-bold ${isOverdue ? "text-red-600" : ""}`}>
                    {formatDate(invoice.due_date)}
                    {isOverdue && <span className="ml-1 text-[10px] font-normal">(Overdue)</span>}
                  </p>
                </div>
                <div className={`p-1.5 rounded ${
                  invoice.reference
                    ? 'bg-green-100 dark:bg-green-900/40 border-2 border-green-400 shadow-sm'
                    : 'bg-gray-50 dark:bg-gray-800 border border-gray-200'
                }`}>
                  <p className="text-[10px] text-muted-foreground uppercase">Reference</p>
                  <p className="font-mono font-bold">{invoice.reference || "-"}</p>
                </div>
              </div>

              {/* Row 3: Contact ABN (if available) */}
              {invoice.contact?.abn && (
                <div className="p-1.5 rounded bg-green-100 dark:bg-green-900/40 border-2 border-green-400 shadow-sm">
                  <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                    {isBill ? "Supplier" : "Customer"} ABN
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  </p>
                  <p className="font-mono font-bold">
                    {(() => {
                      const abn = invoice.contact.abn;
                      const clean = abn.replace(/\s/g, '');
                      return clean.length === 11 ? `${clean.slice(0,2)} ${clean.slice(2,5)} ${clean.slice(5,8)} ${clean.slice(8)}` : abn;
                    })()}
                  </p>
                </div>
              )}

              {/* Job Reference */}
              {invoice.job_title && (
                <div className="p-1.5 rounded bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400">
                  <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                    Job
                    <CheckCircle2 className="h-3 w-3 text-blue-600" />
                  </p>
                  <p className="font-bold text-blue-700 truncate">{invoice.job_title}</p>
                </div>
              )}

              {/* Amounts Section */}
              <div className="pt-2 border-t space-y-1">
                <div className="flex justify-between items-center p-1.5 rounded bg-gray-50 dark:bg-gray-800">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono font-bold">{formatCurrency(invoice.subtotal, invoice.currency_code)}</span>
                </div>
                <div className="flex justify-between items-center p-1.5 rounded bg-gray-50 dark:bg-gray-800">
                  <span className="text-muted-foreground">Tax (GST)</span>
                  <span className="font-mono font-bold">{formatCurrency(invoice.total_tax, invoice.currency_code)}</span>
                </div>
                <div className="flex justify-between items-center p-1.5 rounded bg-emerald-100 dark:bg-emerald-900/40 border-2 border-emerald-400">
                  <span className="font-semibold text-emerald-700">Total</span>
                  <span className="font-mono font-bold text-lg text-emerald-700">{formatCurrency(invoice.total, invoice.currency_code)}</span>
                </div>
                {invoice.amount_paid > 0 && (
                  <div className="flex justify-between items-center p-1.5 rounded bg-green-100 dark:bg-green-900/40">
                    <span className="text-green-700">Paid</span>
                    <span className="font-mono font-bold text-green-700">-{formatCurrency(invoice.amount_paid, invoice.currency_code)}</span>
                  </div>
                )}
                {invoice.amount_due > 0 && (
                  <div className="flex justify-between items-center p-1.5 rounded bg-red-100 dark:bg-red-900/40 border-2 border-red-400">
                    <span className="font-semibold text-red-700">Amount Due</span>
                    <span className="font-mono font-bold text-lg text-red-700">{formatCurrency(invoice.amount_due, invoice.currency_code)}</span>
                  </div>
                )}
              </div>

              {/* Sync Info */}
              {invoice.last_synced_at && (
                <div className="pt-2 border-t text-[10px] text-muted-foreground">
                  Synced from Xero: {new Date(invoice.last_synced_at).toLocaleString("en-AU")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line Items / Payments - Second A4 Panel */}
          <Card className="overflow-auto aspect-[1/1.414] max-h-[calc(100vh-220px)]">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Line Items & Payments
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 py-0 text-xs space-y-4">
              {/* Line Items */}
              {invoice.line_items && invoice.line_items.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide">Line Items</h4>
                  <div className="space-y-1">
                    {invoice.line_items.map((item, index) => (
                      <div key={index} className="p-2 rounded border bg-gray-50 dark:bg-gray-800">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0 pr-2">
                            <p className="font-medium truncate">{item.Description}</p>
                            {item.AccountCode && (
                              <p className="text-[10px] text-muted-foreground">Account: {item.AccountCode}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono font-bold">{formatCurrency(item.LineAmount, invoice.currency_code)}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {item.Quantity} × {formatCurrency(item.UnitAmount, invoice.currency_code)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payments */}
              {invoice.payments && invoice.payments.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide">Payments</h4>
                  <div className="space-y-1">
                    {invoice.payments.map((payment) => (
                      <div key={payment.PaymentID} className="p-2 rounded border bg-green-50 dark:bg-green-900/20">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">{formatDate(payment.Date)}</p>
                            {payment.Reference && (
                              <p className="text-[10px] text-muted-foreground">Ref: {payment.Reference}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-green-700">{formatCurrency(payment.Amount, invoice.currency_code)}</p>
                            <Badge variant="outline" className="text-[10px]">{payment.PaymentType || "Payment"}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Total Paid */}
                    <div className="p-2 rounded bg-green-100 dark:bg-green-900/40 border-2 border-green-400">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-green-700">Total Paid</span>
                        <span className="font-mono font-bold text-green-700">{formatCurrency(invoice.amount_paid, invoice.currency_code)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state if no line items or payments */}
              {(!invoice.line_items || invoice.line_items.length === 0) && (!invoice.payments || invoice.payments.length === 0) && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No line items or payments</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>{/* End Details Grid */}
      </div>{/* End Left Half */}

      {/* RIGHT HALF - PDF Preview (fills available space) - EXACT same structure as bills page */}
      <div className="flex-1 min-w-[500px] sticky top-0 h-[calc(100vh-80px)]">
        <Card className="h-full w-full">
          <CardContent className="p-2 h-full">
            {pdfLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30 h-full">
                <Spinner />
                <p className="text-sm text-muted-foreground mt-4">Loading PDF...</p>
              </div>
            ) : invoice.has_pdf && invoice.pdf_url ? (
              <div className="relative w-full h-full border rounded-lg overflow-hidden">
                <div className="absolute top-2 right-2 z-10 flex gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 px-2 text-xs shadow"
                    onClick={() => window.open(invoice.pdf_url!, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 px-2 text-xs shadow"
                    asChild
                  >
                    <a href={invoice.pdf_url} download>
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  </Button>
                </div>
                <iframe
                  src={invoice.pdf_url}
                  className="w-full h-full"
                  title={`PDF preview for ${invoice.invoice_number}`}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30 h-full">
                <FileWarning className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">PDF Not Available</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  The PDF for this {isBill ? "bill" : "invoice"} has not been synced from Xero yet.
                  PDFs are synced automatically in the background.
                </p>
                {invoice.pdf_synced_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last sync attempt: {new Date(invoice.pdf_synced_at).toLocaleString("en-AU")}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>{/* End Right Half */}
    </div>
  );
}
