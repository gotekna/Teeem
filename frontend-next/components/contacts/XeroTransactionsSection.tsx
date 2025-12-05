"use client";

import { useState, useEffect } from "react";
import { FileText, CreditCard, FileCheck, Loader2, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import type { XeroInvoice, XeroCreditNote, XeroQuote, XeroLink } from "@/types/xero";

interface XeroTransactionsSectionProps {
  contactId: number;
  xeroLink: XeroLink | null;
  onViewInvoiceDetail?: (invoiceId: string) => void;
}

export function XeroTransactionsSection({
  contactId,
  xeroLink,
  onViewInvoiceDetail,
}: XeroTransactionsSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<XeroInvoice[]>([]);
  const [creditNotes, setCreditNotes] = useState<XeroCreditNote[]>([]);
  const [quotes, setQuotes] = useState<XeroQuote[]>([]);

  useEffect(() => {
    if (xeroLink && xeroLink.xero_contact_id) {
      loadTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  }, [xeroLink]);

  const loadTransactions = async () => {
    if (!xeroLink) return;

    setLoading(true);
    setError(null);
    try {
      const tenantParam = `&tenant_id=${xeroLink.xero_tenant_id}`;

      // Load invoices
      const invoicesResponse = await api.get<{ success: boolean; invoices: XeroInvoice[] }>(
        `/api/v1/xero/invoices?contact_id=${xeroLink.xero_contact_id}${tenantParam}`
      );
      if (invoicesResponse.success && invoicesResponse.invoices) {
        setInvoices(invoicesResponse.invoices);
      }

      // Load credit notes
      const creditNotesResponse = await api.get<{ success: boolean; credit_notes: XeroCreditNote[] }>(
        `/api/v1/xero/credit_notes?contact_id=${xeroLink.xero_contact_id}${tenantParam}`
      );
      if (creditNotesResponse.success && creditNotesResponse.credit_notes) {
        setCreditNotes(creditNotesResponse.credit_notes);
      }

      // Load quotes
      const quotesResponse = await api.get<{ success: boolean; quotes: XeroQuote[] }>(
        `/api/v1/xero/quotes?contact_id=${xeroLink.xero_contact_id}${tenantParam}`
      );
      if (quotesResponse.success && quotesResponse.quotes) {
        setQuotes(quotesResponse.quotes);
      }
    } catch (err) {
      console.error("Failed to load Xero transactions:", err);
      setError(err instanceof Error ? err.message : "Failed to load transactions");
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

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      PAID: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      AUTHORISED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      SUBMITTED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
      DELETED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      VOIDED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      SENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      ACCEPTED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      DECLINED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      INVOICED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    };

    return (
      <Badge className={statusColors[status] || "bg-gray-100 text-gray-700"}>
        {status}
      </Badge>
    );
  };

  if (!xeroLink) {
    return (
      <Alert>
        <AlertDescription>
          Link this contact to Xero to view financial transactions
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Xero Transactions
        </CardTitle>
        <CardDescription>
          Financial transactions from {xeroLink.xero_tenant_name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="invoices" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="invoices">
              <FileText className="h-4 w-4 mr-2" />
              Invoices ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="credit-notes">
              <CreditCard className="h-4 w-4 mr-2" />
              Credit Notes ({creditNotes.length})
            </TabsTrigger>
            <TabsTrigger value="quotes">
              <FileCheck className="h-4 w-4 mr-2" />
              Quotes ({quotes.length})
            </TabsTrigger>
          </TabsList>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="mt-4">
            {invoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No invoices found
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.InvoiceID}>
                        <TableCell className="font-medium">
                          {invoice.InvoiceNumber}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{invoice.Type}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(invoice.Date)}</TableCell>
                        <TableCell>{formatDate(invoice.DueDate)}</TableCell>
                        <TableCell>{getStatusBadge(invoice.Status)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(invoice.Total, invoice.CurrencyCode)}
                        </TableCell>
                        <TableCell className="text-right">
                          {invoice.AmountDue > 0 ? (
                            <span className="text-red-600 font-medium">
                              {formatCurrency(invoice.AmountDue, invoice.CurrencyCode)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {onViewInvoiceDetail && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewInvoiceDetail(invoice.InvoiceID)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Credit Notes Tab */}
          <TabsContent value="credit-notes" className="mt-4">
            {creditNotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No credit notes found
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditNotes.map((creditNote) => (
                      <TableRow key={creditNote.CreditNoteID}>
                        <TableCell className="font-medium">
                          {creditNote.CreditNoteNumber}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{creditNote.Type}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(creditNote.Date)}</TableCell>
                        <TableCell>{getStatusBadge(creditNote.Status)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(creditNote.Total, creditNote.CurrencyCode)}
                        </TableCell>
                        <TableCell className="text-right">
                          {creditNote.RemainingCredit > 0 ? (
                            <span className="text-green-600 font-medium">
                              {formatCurrency(creditNote.RemainingCredit, creditNote.CurrencyCode)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Applied</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Quotes Tab */}
          <TabsContent value="quotes" className="mt-4">
            {quotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No quotes found
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotes.map((quote) => (
                      <TableRow key={quote.QuoteID}>
                        <TableCell className="font-medium">
                          {quote.QuoteNumber}
                        </TableCell>
                        <TableCell>{quote.Title || quote.Reference || "-"}</TableCell>
                        <TableCell>{formatDate(quote.Date)}</TableCell>
                        <TableCell>
                          {quote.ExpiryDate ? formatDate(quote.ExpiryDate) : "-"}
                        </TableCell>
                        <TableCell>{getStatusBadge(quote.Status)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(quote.Total, quote.CurrencyCode)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
