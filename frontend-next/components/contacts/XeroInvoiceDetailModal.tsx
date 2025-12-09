"use client";

import { useState, useEffect } from "react";
import { Loader2, FileText, Calendar, CreditCard, ExternalLink, FileDown, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";

// Warehouse invoice data structure (from ExternalInvoice)
interface WarehouseInvoice {
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
  // PDF info
  has_pdf: boolean;
  pdf_url: string | null;
  pdf_synced_at: string | null;
}

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

interface XeroInvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string | null; // This is the Xero external_id
}

export function XeroInvoiceDetailModal({
  isOpen,
  onClose,
  invoiceId,
}: XeroInvoiceDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<WarehouseInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "pdf">("details");

  useEffect(() => {
    if (isOpen && invoiceId) {
      loadInvoiceDetail();
    } else {
      setInvoice(null);
      setError(null);
      setActiveTab("details");
    }
     
  }, [isOpen, invoiceId]);

  const loadInvoiceDetail = async () => {
    if (!invoiceId) return;

    setLoading(true);
    setError(null);
    try {
      // Use warehouse endpoint instead of live Xero API
      const response = await api.get<{ success: boolean; data: WarehouseInvoice }>(
        `/api/v1/external_invoices/by_external_id/${invoiceId}`
      );
      if (response?.success && response.data) {
        setInvoice(response.data);
      }
    } catch (err) {
      console.error("Failed to load invoice detail:", err);
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
      month: "long",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      PAID: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      AUTHORISED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      SUBMITTED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
      DELETED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      VOIDED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    };

    return (
      <Badge className={statusColors[status] || "bg-gray-100 text-gray-700"}>
        {status}
      </Badge>
    );
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {invoice?.invoice_type === "bill" ? "Bill" : "Invoice"} Details
          </DialogTitle>
          {invoice && (
            <DialogDescription>
              {invoice.invoice_number} - {invoice.contact_name}
            </DialogDescription>
          )}
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
          </div>
        )}

        {invoice && !loading && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "details" | "pdf")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Details
              </TabsTrigger>
              <TabsTrigger value="pdf" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                PDF Preview
                {invoice.has_pdf && (
                  <Badge variant="secondary" className="ml-1 text-xs">Available</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-4">
              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                    {invoice.invoice_type === "bill" ? "Bill" : "Invoice"} Number
                  </h3>
                  <p className="text-2xl font-bold">{invoice.invoice_number}</p>
                </div>
                <div className="text-right">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                    Status
                  </h3>
                  {getStatusBadge(invoice.status)}
                </div>
              </div>

              <Separator />

              {/* Contact & Dates */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                    {invoice.invoice_type === "bill" ? "Supplier" : "Customer"}
                  </h3>
                  <p className="font-medium">{invoice.contact_name}</p>
                  {invoice.job_title && (
                    <p className="text-sm text-blue-600 mt-1">{invoice.job_title}</p>
                  )}
                </div>
                <div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {invoice.invoice_type === "bill" ? "Bill" : "Invoice"} Date
                        </p>
                        <p className="font-medium">{formatDate(invoice.invoice_date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Due Date</p>
                        <p className="font-medium">{formatDate(invoice.due_date)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {invoice.reference && (
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase mb-1">
                    Reference
                  </h3>
                  <p className="font-mono text-sm">{invoice.reference}</p>
                </div>
              )}

              <Separator />

              {/* Line Items */}
              {invoice.line_items && invoice.line_items.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Line Items</h3>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Tax</TableHead>
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
                            <TableCell className="text-right">
                              {item.TaxAmount
                                ? formatCurrency(item.TaxAmount, invoice.currency_code)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.LineAmount, invoice.currency_code)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={4} className="text-right font-medium">
                            Subtotal
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(invoice.subtotal, invoice.currency_code)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={4} className="text-right font-medium">
                            Tax
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(invoice.total_tax, invoice.currency_code)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={4} className="text-right text-lg font-bold">
                            Total
                          </TableCell>
                          <TableCell className="text-right text-lg font-bold">
                            {formatCurrency(invoice.total, invoice.currency_code)}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                </div>
              )}

              {/* Payments */}
              {invoice.payments && invoice.payments.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Payments
                    </h3>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Status</TableHead>
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
                              <TableCell>
                                {payment.Status && getStatusBadge(payment.Status)}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(payment.Amount, invoice.currency_code)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell colSpan={4} className="text-right font-medium">
                              Amount Paid
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(invoice.amount_paid, invoice.currency_code)}
                            </TableCell>
                          </TableRow>
                          {invoice.amount_due > 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-right font-bold text-red-600">
                                Amount Due
                              </TableCell>
                              <TableCell className="text-right font-bold text-red-600">
                                {formatCurrency(invoice.amount_due, invoice.currency_code)}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableFooter>
                      </Table>
                    </div>
                  </div>
                </>
              )}

              {/* Footer Info - SSoT sync time */}
              <div className="text-xs text-muted-foreground border-t pt-3 flex items-center justify-between">
                <div>
                  {invoice.last_synced_at ? (
                    <span>Synced from Xero: {formatRelativeTime(invoice.last_synced_at)}</span>
                  ) : (
                    <span>Not yet synced</span>
                  )}
                </div>
                {invoice.external_updated_at && (
                  <span>Xero updated: {formatDate(invoice.external_updated_at)}</span>
                )}
              </div>
            </TabsContent>

            <TabsContent value="pdf" className="mt-4">
              {invoice.has_pdf && invoice.pdf_url ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      PDF synced {invoice.pdf_synced_at ? formatRelativeTime(invoice.pdf_synced_at) : 'recently'}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(invoice.pdf_url!, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open in New Tab
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a href={invoice.pdf_url} download>
                          <FileDown className="h-4 w-4 mr-2" />
                          Download
                        </a>
                      </Button>
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900">
                    <iframe
                      src={invoice.pdf_url}
                      className="w-full h-[500px]"
                      title={`PDF preview for ${invoice.invoice_number}`}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium mb-2">PDF Not Yet Available</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    The PDF for this {invoice.invoice_type === "bill" ? "bill" : "invoice"} has not been synced from Xero yet.
                    PDFs are synced automatically in the background.
                  </p>
                  <p className="text-xs text-muted-foreground mt-4">
                    Check the Xero integration settings to see sync progress.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
