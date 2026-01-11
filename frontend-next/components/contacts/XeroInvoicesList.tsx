"use client";

import { useState, useEffect } from "react";
import { FileText, Eye, RefreshCw } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

// Warehouse invoice type (from external_invoices table)
interface ExternalInvoice {
  id: number;
  external_id: string;
  invoice_number: string;
  reference?: string;
  invoice_type: string;
  status: string;
  invoice_date: string;
  due_date: string;
  total: number;
  amount_due: number;
  amount_paid: number;
  currency_code: string;
  contact_id: number;
  contact_name: string;
  job_id: number | null;
  job_title: string | null;
}

interface WarehouseResponse {
  success: boolean;
  data: {
    invoices: ExternalInvoice[];
    bills: ExternalInvoice[];
    total_invoices: number;
    total_bills: number;
    contact_id: number;
    contact_name: string;
  };
  meta: {
    source: string;
    last_synced_at: string | null;
    cache_age_seconds: number | null;
  };
}

interface XeroInvoicesListProps {
  contactId: number;
  type: "ACCREC" | "ACCPAY"; // ACCREC = Invoices (Receivable), ACCPAY = Bills (Payable)
  onViewInvoiceDetail?: (invoiceId: string) => void;
}

export function XeroInvoicesList({
  contactId,
  type,
  onViewInvoiceDetail,
}: XeroInvoicesListProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<ExternalInvoice[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [cacheAgeSeconds, setCacheAgeSeconds] = useState<number | null>(null);

  const isInvoice = type === "ACCREC";
  const title = isInvoice ? "Invoices" : "Bills";

  useEffect(() => {
    if (contactId) {
      loadInvoices();
    }
     
  }, [contactId, type]);

  const loadInvoices = async () => {
    if (!contactId) return;

    setLoading(true);
    setError(null);
    try {
      // Use warehouse endpoint instead of Xero API
      const response = await api.get<WarehouseResponse>(
        `/api/v1/external_invoices/by_contact/${contactId}`
      );

      if (response.success && response.data) {
        // Get bills or invoices based on type
        const data = isInvoice ? response.data.invoices : response.data.bills;
        setInvoices(data || []);

        // Store sync metadata
        if (response.meta) {
          setLastSyncedAt(response.meta.last_synced_at);
          setCacheAgeSeconds(response.meta.cache_age_seconds);
        }
      }
    } catch (err) {
      console.error(`Failed to load ${title.toLowerCase()}:`, err);
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

  const getStatusBadge = (status: string) => {
    // Handle both Xero statuses (UPPERCASE) and normalized statuses (lowercase)
    const normalizedStatus = status?.toUpperCase();
    const statusColors: Record<string, string> = {
      PAID: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      AUTHORISED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      DRAFT: "bg-muted text-foreground dark:bg-gray-800 dark:text-muted-foreground",
      SUBMITTED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
      DELETED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      VOIDED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    };

    return (
      <Badge className={statusColors[normalizedStatus] || "bg-muted text-foreground"}>
        {normalizedStatus}
      </Badge>
    );
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

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p>No {title.toLowerCase()} found for this contact</p>
        {lastSyncedAt && (
          <p className="text-xs mt-2">
            Last synced: {formatRelativeTime(lastSyncedAt)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cache age indicator */}
      {lastSyncedAt && (
        <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
          <span>
            Last synced: {formatRelativeTime(lastSyncedAt)}
            {cacheAgeSeconds && cacheAgeSeconds > 86400 && (
              <span className="text-yellow-600 dark:text-yellow-400 ml-2">
                (Data may be outdated)
              </span>
            )}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadInvoices}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">{isInvoice ? "Amount Due" : "Amount Owing"}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">
                  {invoice.invoice_number}
                </TableCell>
                <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                <TableCell>{invoice.due_date ? formatDate(invoice.due_date) : '-'}</TableCell>
                <TableCell className="text-sm">
                  {invoice.job_title ? (
                    <span className="text-blue-600">{invoice.job_title}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {(invoice as any).reference ? (
                    <span className="font-mono text-xs">{(invoice as any).reference}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(invoice.total, invoice.currency_code)}
                </TableCell>
                <TableCell className="text-right">
                  {invoice.amount_due > 0 ? (
                    <span className="text-red-600 font-medium">
                      {formatCurrency(invoice.amount_due, invoice.currency_code)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {onViewInvoiceDetail && invoice.external_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewInvoiceDetail(invoice.external_id)}
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
    </div>
  );
}
