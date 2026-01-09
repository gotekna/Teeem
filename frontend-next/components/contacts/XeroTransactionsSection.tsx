"use client";

import { useState, useEffect, useMemo } from "react";
import { FileText, CreditCard, FileCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";
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

  // Column definitions for TeeemTableView
  const invoiceColumns: TableColumn[] = useMemo(() => [
    { key: "InvoiceNumber", label: "Number", width: 100, sortable: true },
    { key: "Type", label: "Type", width: 100, column_type: "badge" },
    { key: "Date", label: "Date", width: 110, sortable: true, column_type: "date" },
    { key: "DueDate", label: "Due Date", width: 110, sortable: true, column_type: "date" },
    { key: "Status", label: "Status", width: 100, column_type: "badge" },
    { key: "Total", label: "Total", width: 120, sortable: true, column_type: "currency", showSum: true },
    { key: "AmountDue", label: "Due", width: 120, sortable: true, column_type: "currency", showSum: true },
  ], []);

  const creditNoteColumns: TableColumn[] = useMemo(() => [
    { key: "CreditNoteNumber", label: "Number", width: 100, sortable: true },
    { key: "Type", label: "Type", width: 100, column_type: "badge" },
    { key: "Date", label: "Date", width: 110, sortable: true, column_type: "date" },
    { key: "Status", label: "Status", width: 100, column_type: "badge" },
    { key: "Total", label: "Total", width: 120, sortable: true, column_type: "currency", showSum: true },
    { key: "RemainingCredit", label: "Remaining", width: 120, sortable: true, column_type: "currency", showSum: true },
  ], []);

  const quoteColumns: TableColumn[] = useMemo(() => [
    { key: "QuoteNumber", label: "Number", width: 100, sortable: true },
    { key: "Title", label: "Title", width: 200, sortable: true },
    { key: "Date", label: "Date", width: 110, sortable: true, column_type: "date" },
    { key: "ExpiryDate", label: "Expiry", width: 110, sortable: true, column_type: "date" },
    { key: "Status", label: "Status", width: 100, column_type: "badge" },
    { key: "Total", label: "Total", width: 120, sortable: true, column_type: "currency", showSum: true },
  ], []);

  // Transform data to table rows
  const invoiceRows: TableRow[] = useMemo(() => invoices.map((invoice) => ({
    id: invoice.InvoiceID,
    InvoiceNumber: invoice.InvoiceNumber,
    Type: invoice.Type,
    Date: invoice.Date,
    DueDate: invoice.DueDate,
    Status: invoice.Status,
    Total: invoice.Total,
    AmountDue: invoice.AmountDue,
    CurrencyCode: invoice.CurrencyCode,
  })), [invoices]);

  const creditNoteRows: TableRow[] = useMemo(() => creditNotes.map((cn) => ({
    id: cn.CreditNoteID,
    CreditNoteNumber: cn.CreditNoteNumber,
    Type: cn.Type,
    Date: cn.Date,
    Status: cn.Status,
    Total: cn.Total,
    RemainingCredit: cn.RemainingCredit,
    CurrencyCode: cn.CurrencyCode,
  })), [creditNotes]);

  const quoteRows: TableRow[] = useMemo(() => quotes.map((quote) => ({
    id: quote.QuoteID,
    QuoteNumber: quote.QuoteNumber,
    Title: quote.Title || quote.Reference || "-",
    Date: quote.Date,
    ExpiryDate: quote.ExpiryDate,
    Status: quote.Status,
    Total: quote.Total,
    CurrencyCode: quote.CurrencyCode,
  })), [quotes]);

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
              <div className="-mx-4">
                <TeeemTableView
                  entries={invoiceRows}
                  columns={invoiceColumns}
                  tableName="Invoices"
                  viewOnly={true}
                  enableExport={true}
                  onRowClick={onViewInvoiceDetail ? (row) => onViewInvoiceDetail(row.id as string) : undefined}
                />
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
              <div className="-mx-4">
                <TeeemTableView
                  entries={creditNoteRows}
                  columns={creditNoteColumns}
                  tableName="Credit Notes"
                  viewOnly={true}
                  enableExport={true}
                />
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
              <div className="-mx-4">
                <TeeemTableView
                  entries={quoteRows}
                  columns={quoteColumns}
                  tableName="Quotes"
                  viewOnly={true}
                  enableExport={true}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
