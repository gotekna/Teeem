"use client";

import { useState, useEffect, useMemo } from "react";
import { FileText, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "next/navigation";

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

// SSoT: XeroLink from ContactHeader defines which tenants the contact is linked to
interface LinkedTenant {
  xero_tenant_id: string;
  xero_tenant_name: string;
}

interface XeroInvoicesListByTenantProps {
  contactId: number;
  type: "ACCREC" | "ACCPAY"; // ACCREC = Invoices (Receivable), ACCPAY = Bills (Payable)
  onViewInvoiceDetail?: (invoiceId: string) => void;
  // SSoT: Only show tabs for linked tenants (from contact's xero_links)
  // If not provided, shows all tenants from API response
  linkedTenants?: LinkedTenant[];
}

export function XeroInvoicesListByTenant({
  contactId,
  type,
  onViewInvoiceDetail,
  linkedTenants,
}: XeroInvoicesListByTenantProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [byTenant, setByTenant] = useState<Record<string, TenantInvoicesData>>({});
  const [activeTenant, setActiveTenant] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [cacheAgeSeconds, setCacheAgeSeconds] = useState<number | null>(null);

  const isInvoice = type === "ACCREC";
  const title = isInvoice ? "Invoices" : "Bills";

  // SSoT: Calculate tenantIds based on linkedTenants prop
  // Must be calculated before any early returns (React hooks rules)
  const tenantIds = useMemo(() => {
    if (linkedTenants && linkedTenants.length > 0) {
      return linkedTenants.map(t => t.xero_tenant_id).filter(id => byTenant[id]);
    }
    return Object.keys(byTenant);
  }, [linkedTenants, byTenant]);

  // Pre-calculate allItems and totalAllCount before any early returns
  const allItems = useMemo(() => {
    return tenantIds.flatMap((tenantId) => {
      const data = byTenant[tenantId];
      if (!data) return [];
      const items = isInvoice ? data.invoices : data.bills;
      return items.map((item) => ({ ...item, tenant_id: tenantId }));
    });
  }, [byTenant, tenantIds, isInvoice]);

  const totalAllCount = useMemo(() => {
    return tenantIds.reduce((sum, tenantId) => {
      const data = byTenant[tenantId];
      if (!data) return sum;
      return sum + (isInvoice ? data.total_invoices : data.total_bills);
    }, 0);
  }, [byTenant, tenantIds, isInvoice]);

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

  // Get tenant name lookup for "All" view
  const getTenantName = (tenantId: string | undefined): string => {
    if (!tenantId) return "Unknown";
    const data = byTenant[tenantId];
    return data?.tenant_info?.tenant_name || "Unknown";
  };

  // Define columns for TeeemTableView
  // Note: Columns are defined explicitly since external_invoices come from Xero (no Foundation table)
  const getColumns = (showTenantColumn: boolean): TableColumn[] => {
    const cols: TableColumn[] = [
      { key: "invoice_number", label: "Number", width: 100, sortable: true },
    ];

    if (showTenantColumn) {
      cols.push({ key: "tenant_name", label: "Company", width: 150, sortable: true });
    }

    cols.push(
      { key: "invoice_date", label: "Date", width: 110, sortable: true, column_type: "date" },
      { key: "due_date", label: "Due Date", width: 110, sortable: true, column_type: "date" },
      { key: "job_title", label: "Job", width: 250, sortable: true },
      { key: "reference", label: "Reference", width: 100, sortable: true },
      { key: "status", label: "Status", width: 100, sortable: true, column_type: "badge" },
      { key: "total", label: "Total", width: 120, sortable: true, column_type: "currency", showSum: true, sumType: "currency" },
      { key: "amount_due", label: isInvoice ? "Amount Due" : "Amount Owing", width: 130, sortable: true, column_type: "currency", showSum: true, sumType: "currency" }
    );

    return cols;
  };

  // Transform invoice data to table rows
  const transformToRows = (invoices: ExternalInvoice[], includeTenant: boolean): TableRow[] => {
    return invoices.map((invoice) => ({
      id: invoice.id,
      external_id: invoice.external_id,
      invoice_number: invoice.invoice_number,
      tenant_name: includeTenant ? getTenantName(invoice.tenant_id) : undefined,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      job_title: invoice.job_title,
      job_id: invoice.job_id,
      reference: invoice.reference,
      status: invoice.status?.toUpperCase(),
      total: invoice.total,
      amount_due: invoice.amount_due,
      currency_code: invoice.currency_code,
    }));
  };

  // Handle row click - navigate to invoice detail page
  const handleRowClick = (row: TableRow) => {
    if (row.external_id) {
      // Navigate to the full-page invoice detail view
      router.push(`/finance/invoices/${row.external_id}`);
    }
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

  // Sync status header
  const SyncHeader = () => (
    <div className="flex items-center justify-between text-sm text-muted-foreground px-1 mb-4">
      <span>
        Last synced: {lastSyncedAt ? formatRelativeTime(lastSyncedAt) : "Never"}
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
  );

  // SSoT: Tab structure based on linkedTenants count, not data count
  // - 1 linked tenant: show company name as header (no tabs)
  // - 2+ linked tenants: show "All" + company tabs
  const linkedTenantCount = linkedTenants?.length || 0;
  const showTabs = linkedTenantCount >= 2;

  // Get all linked tenant IDs for tabs (show even if empty)
  const allLinkedTenantIds = linkedTenants?.map(t => t.xero_tenant_id) || tenantIds;

  // Single linked tenant - no tabs needed, just show the tenant name
  if (!showTabs && tenantIds.length <= 1) {
    const tenantId = tenantIds[0];
    const data = tenantId ? byTenant[tenantId] : null;
    const items = data ? (isInvoice ? data.invoices : data.bills) : [];
    const rows = transformToRows(items, false);
    const columns = getColumns(false);
    const tenantName = linkedTenants?.[0]?.xero_tenant_name || data?.tenant_info?.tenant_name;

    return (
      <div className="h-full space-y-4">
        <SyncHeader />
        {tenantName && (
          <div className="text-sm font-medium text-muted-foreground mb-2">
            {tenantName}
          </div>
        )}
        {rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No {title.toLowerCase()} found</p>
          </div>
        ) : (
          <div className="-mx-4">
            <TeeemTableView
              entries={rows}
              columns={columns}
              tableName={title}
              onRowClick={handleRowClick}
              viewOnly={true}
              enableExport={true}
            />
          </div>
        )}
      </div>
    );
  }

  // Multiple linked tenants - show tabs with "All" option
  return (
    <div className="h-full space-y-4">
      <SyncHeader />

      <Tabs value={activeTenant || "all"} onValueChange={setActiveTenant}>
        <TabsList className="mb-4">
          {/* "All" tab first */}
          <TabsTrigger value="all" className="flex items-center gap-2">
            All
            <Badge variant="secondary" className="ml-1">
              {totalAllCount}
            </Badge>
          </TabsTrigger>
          {/* Individual tenant tabs - show all linked tenants */}
          {allLinkedTenantIds.map((tenantId) => {
            const data = byTenant[tenantId];
            const linkedTenant = linkedTenants?.find(t => t.xero_tenant_id === tenantId);
            const count = data ? (isInvoice ? data.total_invoices : data.total_bills) : 0;
            const tenantName = linkedTenant?.xero_tenant_name || data?.tenant_info?.tenant_name || "Unknown";
            return (
              <TabsTrigger key={tenantId} value={tenantId} className="flex items-center gap-2">
                {tenantName}
                <Badge variant="secondary" className="ml-1">
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* "All" tab content - shows Company column */}
        <TabsContent value="all">
          {allItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No {title.toLowerCase()} found</p>
            </div>
          ) : (
            <div className="-mx-4">
              <TeeemTableView
                entries={transformToRows(allItems, true)}
                columns={getColumns(true)}
                tableName={title}
                onRowClick={handleRowClick}
                viewOnly={true}
                enableExport={true}
              />
            </div>
          )}
        </TabsContent>

        {/* Individual tenant tab contents - show all linked tenants */}
        {allLinkedTenantIds.map((tenantId) => {
          const data = byTenant[tenantId];
          const items = data ? (isInvoice ? data.invoices : data.bills) : [];
          const rows = transformToRows(items, false);
          return (
            <TabsContent key={tenantId} value={tenantId}>
              {rows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No {title.toLowerCase()} found</p>
                </div>
              ) : (
                <div className="-mx-4">
                  <TeeemTableView
                    entries={rows}
                    columns={getColumns(false)}
                    tableName={title}
                    onRowClick={handleRowClick}
                    viewOnly={true}
                    enableExport={true}
                  />
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
