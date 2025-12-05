"use client";

import { useState, useEffect } from "react";
import { X, Loader2, FileText, Calendar, CreditCard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
import { api } from "@/lib/api";
import type { XeroInvoice } from "@/types/xero";

interface XeroInvoiceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string | null;
}

export function XeroInvoiceDetailModal({
  isOpen,
  onClose,
  invoiceId,
}: XeroInvoiceDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<XeroInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && invoiceId) {
      loadInvoiceDetail();
    } else {
      setInvoice(null);
      setError(null);
    }
  }, [isOpen, invoiceId]);

  const loadInvoiceDetail = async () => {
    if (!invoiceId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{ success: boolean; invoice: XeroInvoice }>(
        `/api/v1/xero/invoices/${invoiceId}`
      );
      if (response?.success && response.invoice) {
        setInvoice(response.invoice);
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Details
          </DialogTitle>
          {invoice && (
            <DialogDescription>
              Invoice #{invoice.InvoiceNumber} - {invoice.Contact.Name}
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
          <div className="space-y-6">
            {/* Invoice Header */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  Invoice Number
                </h3>
                <p className="text-2xl font-bold">{invoice.InvoiceNumber}</p>
              </div>
              <div className="text-right">
                <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  Status
                </h3>
                {getStatusBadge(invoice.Status)}
              </div>
            </div>

            <Separator />

            {/* Contact & Dates */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  Contact
                </h3>
                <p className="font-medium">{invoice.Contact.Name}</p>
              </div>
              <div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Invoice Date</p>
                      <p className="font-medium">{formatDate(invoice.Date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Due Date</p>
                      <p className="font-medium">{formatDate(invoice.DueDate)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {invoice.Reference && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase mb-1">
                  Reference
                </h3>
                <p>{invoice.Reference}</p>
              </div>
            )}

            <Separator />

            {/* Line Items */}
            {invoice.LineItems && invoice.LineItems.length > 0 && (
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
                      {invoice.LineItems.map((item, index) => (
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
                            {formatCurrency(item.UnitAmount, invoice.CurrencyCode)}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.TaxAmount
                              ? formatCurrency(item.TaxAmount, invoice.CurrencyCode)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(item.LineAmount, invoice.CurrencyCode)}
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
                          {formatCurrency(invoice.SubTotal, invoice.CurrencyCode)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={4} className="text-right font-medium">
                          Tax
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(invoice.TotalTax, invoice.CurrencyCode)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={4} className="text-right text-lg font-bold">
                          Total
                        </TableCell>
                        <TableCell className="text-right text-lg font-bold">
                          {formatCurrency(invoice.Total, invoice.CurrencyCode)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </div>
            )}

            {/* Payments */}
            {invoice.Payments && invoice.Payments.length > 0 && (
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
                        {invoice.Payments.map((payment) => (
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
                              {formatCurrency(payment.Amount, invoice.CurrencyCode)}
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
                            {formatCurrency(invoice.AmountPaid, invoice.CurrencyCode)}
                          </TableCell>
                        </TableRow>
                        {invoice.AmountDue > 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-right font-bold text-red-600">
                              Amount Due
                            </TableCell>
                            <TableCell className="text-right font-bold text-red-600">
                              {formatCurrency(invoice.AmountDue, invoice.CurrencyCode)}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableFooter>
                    </Table>
                  </div>
                </div>
              </>
            )}

            {/* Footer Info */}
            <div className="text-xs text-muted-foreground">
              <p>
                Last Updated: {new Date(invoice.UpdatedDateUTC).toLocaleString("en-AU")}
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
