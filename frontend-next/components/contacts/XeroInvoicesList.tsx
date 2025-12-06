"use client";

import { useState, useEffect } from "react";
import { FileText, Loader2, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { XeroInvoice } from "@/types/xero";

interface XeroInvoicesListProps {
  contactId: number;
  xeroContactId: string | null;
  type: "ACCREC" | "ACCPAY"; // ACCREC = Invoices (Receivable), ACCPAY = Bills (Payable)
  onViewInvoiceDetail?: (invoiceId: string) => void;
}

export function XeroInvoicesList({
  contactId,
  xeroContactId,
  type,
  onViewInvoiceDetail,
}: XeroInvoicesListProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<XeroInvoice[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const isInvoice = type === "ACCREC";
  const title = isInvoice ? "Invoices" : "Bills";

  // Load tenant ID when component mounts
  useEffect(() => {
    const loadTenantId = async () => {
      try {
        // Get the default tenant ID from the Xero tenants endpoint
        const response = await api.get<{ success: boolean; tenants: Array<{ tenant_id: string }> }>(
          `/api/v1/xero/tenants`
        );
        if (response.success && response.tenants && response.tenants.length > 0) {
          setTenantId(response.tenants[0].tenant_id);
        }
      } catch (err) {
        console.error("Failed to load Xero tenant:", err);
      }
    };

    loadTenantId();
  }, []);

  useEffect(() => {
    if (xeroContactId && tenantId) {
      loadInvoices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  }, [xeroContactId, tenantId, type]);

  const loadInvoices = async () => {
    if (!xeroContactId || !tenantId) return;

    setLoading(true);
    setError(null);
    try {
      const tenantParam = `&tenant_id=${tenantId}`;
      const typeParam = `&type=${type}`;

      // Load invoices with type filter
      const response = await api.get<{ success: boolean; data: { invoices: XeroInvoice[] } }>(
        `/api/v1/xero/invoices?contact_id=${xeroContactId}${tenantParam}${typeParam}`
      );
      if (response.success && response.data && response.data.invoices) {
        setInvoices(response.data.invoices);
      }
    } catch (err) {
      console.error(`Failed to load Xero ${title.toLowerCase()}:`, err);
      setError(err instanceof Error ? err.message : `Failed to load ${title.toLowerCase()}`);
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
    };

    return (
      <Badge className={statusColors[status] || "bg-gray-100 text-gray-700"}>
        {status}
      </Badge>
    );
  };

  if (!xeroContactId) {
    return (
      <Alert>
        <AlertDescription>
          Link this contact to Xero to view {title.toLowerCase()}
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

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p>No {title.toLowerCase()} found for this contact</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Number</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">{isInvoice ? "Amount Due" : "Amount Owing"}</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.InvoiceID}>
              <TableCell className="font-medium">
                {invoice.InvoiceNumber}
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
  );
}
