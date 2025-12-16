"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Building2,
  Calendar,
  FileText,
  CreditCard,
  ExternalLink,
  Download,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";

// Types for external invoice data
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
}

// Status color mapping
const statusColors: Record<string, string> = {
  PAID: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  AUTHORISED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  SUBMITTED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  DELETED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  VOIDED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<ExternalInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-AU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    }
  };

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status?.toUpperCase();
    return (
      <Badge className={statusColors[normalizedStatus] || "bg-gray-100 text-gray-700"}>
        {normalizedStatus}
      </Badge>
    );
  };

  const isBill = invoice?.invoice_type === "bill" || invoice?.invoice_type === "ACCPAY";
  const typeLabel = isBill ? "Bill" : "Invoice";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <FileText className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">{error || "Invoice not found"}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-4">
      {/* Header */}
      <div className="px-4 py-4 border-b bg-background shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-3">
              {/* PAY FROM / PAY TO Header similar to bills page */}
              {isBill ? (
                <>
                  <div className="bg-blue-600 text-white px-4 py-2 rounded-lg">
                    <div className="text-xs opacity-80">PAY TO</div>
                    <div className="font-semibold">{invoice.contact_name}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-green-600 text-white px-4 py-2 rounded-lg">
                    <div className="text-xs opacity-80">INVOICE TO</div>
                    <div className="font-semibold">{invoice.contact_name}</div>
                  </div>
                </>
              )}
              <div className="bg-gray-700 text-white px-4 py-2 rounded-lg">
                <div className="text-xs opacity-80">{typeLabel.toUpperCase()} #</div>
                <div className="font-semibold">{invoice.invoice_number}</div>
              </div>
              {getStatusBadge(invoice.status)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadInvoice}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column - Invoice Details */}
        <div className="w-1/2 overflow-y-auto p-4 border-r">
          {/* Amount Summary */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {typeLabel} Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground uppercase mb-1">
                    {typeLabel} Date
                  </div>
                  <div className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {formatDate(invoice.invoice_date)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase mb-1">
                    Due Date
                  </div>
                  <div className="font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {invoice.due_date ? formatDate(invoice.due_date) : "-"}
                  </div>
                </div>
              </div>

              {invoice.reference && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase mb-1">
                    Reference
                  </div>
                  <div className="font-mono text-sm">{invoice.reference}</div>
                </div>
              )}

              {invoice.job_title && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase mb-1">
                    Job
                  </div>
                  <div className="text-blue-600 font-medium">{invoice.job_title}</div>
                </div>
              )}

              <Separator />

              {/* Amounts */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    {formatCurrency(invoice.subtotal, invoice.currency_code)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">
                    {formatCurrency(invoice.total_tax, invoice.currency_code)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold">
                    {formatCurrency(invoice.total, invoice.currency_code)}
                  </span>
                </div>
                {invoice.amount_paid > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Paid</span>
                    <span className="font-medium">
                      -{formatCurrency(invoice.amount_paid, invoice.currency_code)}
                    </span>
                  </div>
                )}
                {invoice.amount_due > 0 && (
                  <div className="flex justify-between text-red-600 text-lg">
                    <span className="font-semibold">Amount Due</span>
                    <span className="font-bold">
                      {formatCurrency(invoice.amount_due, invoice.currency_code)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {isBill ? "Supplier" : "Customer"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-medium text-lg">{invoice.contact_name}</div>
              {invoice.contact_id && (
                <Button
                  variant="link"
                  className="p-0 h-auto text-blue-600"
                  onClick={() => router.push(`/contacts/${invoice.contact_id}`)}
                >
                  View Contact
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Line Items */}
          {invoice.line_items && invoice.line_items.length > 0 && (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Line Items</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.line_items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.Description}</p>
                            {item.AccountCode && (
                              <p className="text-xs text-muted-foreground">
                                Account: {item.AccountCode}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.Quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.UnitAmount, invoice.currency_code)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.LineAmount, invoice.currency_code)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-medium">
                        Total
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(invoice.total, invoice.currency_code)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Payments */}
          {invoice.payments && invoice.payments.length > 0 && (
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payments
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.payments.map((payment) => (
                      <TableRow key={payment.PaymentID}>
                        <TableCell>{formatDate(payment.Date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{payment.PaymentType || "Payment"}</Badge>
                        </TableCell>
                        <TableCell>{payment.Reference || "-"}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(payment.Amount, invoice.currency_code)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-medium">
                        Total Paid
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatCurrency(invoice.amount_paid, invoice.currency_code)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Sync Info */}
          <div className="text-xs text-muted-foreground border-t pt-3">
            {invoice.last_synced_at ? (
              <span>Synced from Xero: {formatRelativeTime(invoice.last_synced_at)}</span>
            ) : (
              <span>Not yet synced</span>
            )}
          </div>
        </div>

        {/* Right Column - PDF Preview */}
        <div className="w-1/2 overflow-hidden flex flex-col bg-gray-100 dark:bg-gray-900">
          <div className="p-4 bg-background border-b flex items-center justify-between shrink-0">
            <h3 className="font-semibold">PDF Preview</h3>
            {invoice.has_pdf && invoice.pdf_url && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(invoice.pdf_url!, "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={invoice.pdf_url} download>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </a>
                </Button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            {invoice.has_pdf && invoice.pdf_url ? (
              <iframe
                src={invoice.pdf_url}
                className="w-full h-full"
                title={`PDF preview for ${invoice.invoice_number}`}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium mb-2">PDF Not Available</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  The PDF for this {typeLabel.toLowerCase()} has not been synced from Xero yet.
                  PDFs are synced automatically in the background.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
