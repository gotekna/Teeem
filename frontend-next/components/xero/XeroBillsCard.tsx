"use client";

/**
 * XeroBillsCard - Displays Bills from Xero
 *
 * Extracted from corporate page inline rendering for unified tab system.
 * Uses TeeemTableView with Foundation ID 523 (external_invoices).
 */

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";

import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";

interface XeroBillsCardProps {
  companyId: string;
  entityId?: string; // Alias for companyId (TabComponentProps)
  tenantId?: string;
  onRefresh?: () => Promise<void>;
  onRowClick?: (row: TableRow) => void;
  onRowDoubleClick?: (row: TableRow) => void;
}

export function XeroBillsCard({
  companyId,
  entityId,
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

  // Fetch tenant ID if not provided
  const fetchTenantId = React.useCallback(async () => {
    if (propTenantId) {
      setTenantId(propTenantId);
      return propTenantId;
    }

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

  // Fetch bills
  const fetchBills = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
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
  }, [tenantId, fetchTenantId]);

  React.useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const handleRefresh = async () => {
    await fetchBills();
    await onRefresh?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mx-4">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <p className="font-medium mb-2 text-red-600">Error</p>
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
            <p className="font-medium mb-2">No Bills</p>
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
        foundationId="external_invoices"
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
