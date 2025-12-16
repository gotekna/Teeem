"use client";

import { useState, useEffect, useMemo } from "react";
import { FileText, Loader2, Eye, RefreshCw } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  tenant_id?: string;
}

interface TenantInfo {
  tenant_id: string;
  tenant_name: string;
  badge_color: string;
}

interface TenantInvoicesData {
  tenant_info: TenantInfo;
  invoices: ExternalInvoice[];
  bills: ExternalInvoice[];
  credit_notes: ExternalInvoice[];
  quotes: ExternalInvoice[];
  total_invoices: number;
  total_bills: number;
  total_credit_notes: number;
  total_quotes: number;
}

interface WarehouseResponse {
  success: boolean;
  data: {
    by_tenant: Record<string, TenantInvoicesData>;
    invoices: ExternalInvoice[];
    bills: ExternalInvoice[];
    total_invoices: number;
    total_bills: number;
    contact_id: number;
    contact_name: string;
  };
  meta: {
    source: string;
    tenant_count: number;
    last_synced_at: string | null;
    cache_age_seconds: number | null;
  };
}

interface XeroInvoicesListByTenantProps {
  contactId: number;
  type: "ACCREC" | "ACCPAY"; // ACCREC = Invoices (Receivable), ACCPAY = Bills (Payable)
  onViewInvoiceDetail?: (invoiceId: string) => void;
}

export function XeroInvoicesListByTenant({
  contactId,
  type,
  onViewInvoiceDetail,
}: XeroInvoicesListByTenantProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [byTenant, setByTenant] = useState<Record<string, TenantInvoicesData>>({});
  const [activeTenant, setActiveTenant] = useState<string | null>(null);
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
      const response = await api.get<WarehouseResponse>(
        `/api/v1/external_invoices/by_contact/${contactId}`
      );

      if (response.success && response.data) {
        if (response.data.by_tenant) {
          setByTenant(response.data.by_tenant);
          // Auto-select first tenant if none selected
          const tenantIds = Object.keys(response.data.by_tenant);
          if (tenantIds.length > 0 && !activeTenant) {
            setActiveTenant(tenantIds[0]);
          }
        }

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
      return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    } else {
      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    }
  };

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status?.toUpperCase();
    const statusColors: Record<string, string> = {
      PAID: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
      AUTHORISED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      SUBMITTED: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
      DELETED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      VOIDED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    };

    return (
      <Badge className={statusColors[normalizedStatus] || "bg-gray-100 text-gray-700"}>
        {normalizedStatus}
      </Badge>
    );
  };

  // Get tenant name lookup for "All" view
  const getTenantName = (tenantId: string | undefined): string => {
    if (!tenantId) return "Unknown";
    const data = byTenant[tenantId];
    return data?.tenant_info?.tenant_name || "Unknown";
  };

  const renderInvoiceTable = (invoices: ExternalInvoice[], showTenantColumn: boolean = false) => {
    if (invoices.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No {title.toLowerCase()} found</p>
        </div>
      );
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              {showTenantColumn && <TableHead>Company</TableHead>}
              <TableHead>Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Job</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">
                {isInvoice ? "Amount Due" : "Amount Owing"}
              </TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                {showTenantColumn && (
                  <TableCell className="text-sm">
                    <Badge variant="outline" className="font-normal">
                      {getTenantName(invoice.tenant_id)}
                    </Badge>
                  </TableCell>
                )}
                <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                <TableCell>{invoice.due_date ? formatDate(invoice.due_date) : "-"}</TableCell>
                <TableCell className="text-sm">
                  {invoice.job_title ? (
                    <span className="text-blue-600">{invoice.job_title}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {invoice.reference ? (
                    <span className="font-mono text-xs">{invoice.reference}</span>
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
    );
  };

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

  const tenantIds = Object.keys(byTenant);

  if (tenantIds.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
        <p>No {title.toLowerCase()} found for this contact</p>
        {lastSyncedAt && (
          <p className="text-xs mt-2">Last synced: {formatRelativeTime(lastSyncedAt)}</p>
        )}
      </div>
    );
  }

  // Single tenant - no tabs needed
  if (tenantIds.length === 1) {
    const data = byTenant[tenantIds[0]];
    const items = isInvoice ? data.invoices : data.bills;
    return (
      <div className="space-y-4">
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
            <Button variant="ghost" size="sm" onClick={loadInvoices} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        )}
        {renderInvoiceTable(items)}
      </div>
    );
  }

  // Multiple tenants - show tabs with "All" option
  // Combine all items for the "All" tab
  const allItems = useMemo(() => {
    return tenantIds.flatMap((tenantId) => {
      const data = byTenant[tenantId];
      const items = isInvoice ? data.invoices : data.bills;
      // Ensure tenant_id is set on each item for display
      return items.map((item) => ({ ...item, tenant_id: tenantId }));
    });
  }, [byTenant, tenantIds, isInvoice]);

  const totalAllCount = tenantIds.reduce((sum, tenantId) => {
    const data = byTenant[tenantId];
    return sum + (isInvoice ? data.total_invoices : data.total_bills);
  }, 0);

  return (
    <div className="space-y-4">
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
          <Button variant="ghost" size="sm" onClick={loadInvoices} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      )}

      <Tabs value={activeTenant || "all"} onValueChange={setActiveTenant}>
        <TabsList className="mb-4">
          {/* "All" tab first */}
          <TabsTrigger value="all" className="flex items-center gap-2">
            All
            <Badge variant="secondary" className="ml-1">
              {totalAllCount}
            </Badge>
          </TabsTrigger>
          {/* Individual tenant tabs */}
          {tenantIds.map((tenantId) => {
            const data = byTenant[tenantId];
            const count = isInvoice ? data.total_invoices : data.total_bills;
            return (
              <TabsTrigger key={tenantId} value={tenantId} className="flex items-center gap-2">
                {data.tenant_info?.tenant_name || "Unknown"}
                <Badge variant="secondary" className="ml-1">
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* "All" tab content - shows Company column */}
        <TabsContent value="all">
          {renderInvoiceTable(allItems, true)}
        </TabsContent>

        {/* Individual tenant tab contents */}
        {tenantIds.map((tenantId) => {
          const data = byTenant[tenantId];
          const items = isInvoice ? data.invoices : data.bills;
          return (
            <TabsContent key={tenantId} value={tenantId}>
              {renderInvoiceTable(items, false)}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
