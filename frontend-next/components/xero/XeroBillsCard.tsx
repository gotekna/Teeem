"use client";

/**
 * XeroBillsCard - Displays Bills from Xero
 *
 * Supports two contexts:
 * - Corporate: Uses companyId to look up Xero tenant, fetches all bills for that tenant
 * - Job: Uses jobId to fetch bills linked to that job via by_job endpoint
 */

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";

import { api } from "@/lib/api";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";

interface XeroBillsCardProps {
  companyId?: string;
  entityId?: string; // Alias for companyId (TabComponentProps)
  jobId?: string | number; // Job context: fetch bills for this job
  tenantId?: string;
  onRefresh?: () => Promise<void>;
  onRowClick?: (row: TableRow) => void;
  onRowDoubleClick?: (row: TableRow) => void;
}

export function XeroBillsCard({
  companyId,
  entityId,
  jobId,
  tenantId: propTenantId,
  onRefresh,
  onRowClick,
  onRowDoubleClick,
}: XeroBillsCardProps) {
  const effectiveCompanyId = companyId || entityId;
  const [bills, setBills] = React.useState<TableRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tenantId, setTenantId] = React.useState<string | null>(propTenantId || null);

  // Fetch tenant ID if not provided (corporate context only)
  const fetchTenantId = React.useCallback(async () => {
    if (propTenantId) {
      setTenantId(propTenantId);
      return propTenantId;
    }

    if (!effectiveCompanyId) return null;

    try {
      const response = await api.get<{
        success: boolean;
        connection?: { xero_tenant_id: string };
      }>(`/api/v1/companies/${effectiveCompanyId}/xero/connection`);

      if (response?.success && response.connection?.xero_tenant_id) {
        setTenantId(response.connection.xero_tenant_id);
        return response.connection.xero_tenant_id;
      }
      return null;
    } catch (err) {
      console.error("Failed to fetch tenant ID:", err);
      return null;
    }
  }, [effectiveCompanyId, propTenantId]);

  // Fetch bills - uses job endpoint when jobId is available
  const fetchBills = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Job context: use the by_job endpoint which returns bills linked to this job
      if (jobId) {
        const response = await api.get<{
          success: boolean;
          data: { bills: TableRow[] };
        }>(`/api/v1/external_invoices/by_job/${jobId}`);

        if (response?.success) {
          setBills(response.data?.bills || []);
        } else {
          setError("Failed to load bills for this job");
        }
        return;
      }

      // Corporate context: use tenant-based endpoint
      const tid = tenantId || (await fetchTenantId());
      if (!tid) {
        setError("No Xero connection found for this company");
        return;
      }

      const response = await api.get<{ success: boolean; data: TableRow[] }>(
        `/api/v1/external_invoices?tenant_id=${tid}&type=bill&per_page=200`
      );

      if (response?.success) {
        setBills(response.data || []);
      } else {
        setError("Failed to load bills");
      }
    } catch (err: unknown) {
      const errorMessage =
        (err as { data?: { error?: string } })?.data?.error ||
        (err as Error)?.message ||
        "Failed to load bills";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [jobId, tenantId, fetchTenantId]);

  React.useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleRefresh = async () => {
    await fetchBills();
    await onRefresh?.();
  };

  if (loading) {
    return (
      <LoadingOverlay height="h-48" size={24} />
    );
  }

  if (error) {
    return (
      <Card className="mx-4">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p className="font-medium mb-2 text-red-600 dark:text-red-400">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bills.length === 0) {
    return (
      <Card className="mx-4">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p className="text-sm font-medium mb-2">No Bills</p>
            <p className="text-sm">No bills found for this Xero account.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        entries={bills}
        foundationId={FOUNDATION_SLUGS.EXTERNAL_INVOICES}
        tableName="Bills"
        onRefresh={handleRefresh}
        onRowClick={onRowClick}
        onRowDoubleClick={onRowDoubleClick}
        enableExport={true}
      />
    </div>
  );
}

export default XeroBillsCard;
