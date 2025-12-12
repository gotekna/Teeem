"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import {
  ShoppingCart,
  FileText,
  Clock,
  CheckCircle,
  DollarSign,
} from "lucide-react";
import { api } from "@/lib/api";
import type { TableRow } from "@/components/table/types";

// Use database table name instead of hardcoded foundation ID
const PURCHASE_ORDERS_TABLE_NAME = "purchase_orders";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PurchaseOrdersPage() {
  const router = useRouter();

  // Use foundation hook with table name (slug) instead of hardcoded ID
  const { foundation, columns, records, isLoading, refresh } = useFoundationBySlug(PURCHASE_ORDERS_TABLE_NAME);

  // Get foundation ID from loaded foundation data
  const foundationId = foundation?.id;

  // Handle row click - navigate to PO detail page
  const handleRowClick = useCallback((row: TableRow) => {
    // Use purchase_order_number if available, otherwise fall back to ID
    const poNumber = row.purchase_order_number as string | undefined;
    const slug = poNumber?.replace('PO-', '') || row.id;
    if (slug) {
      router.push(`/purchase_orders/${slug}`);
    }
  }, [router]);

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    if (!foundationId) return;
    try {
      await api.patch(`/api/v1/foundations/${foundationId}/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (err) {
      console.error("Failed to update purchase order:", err);
      throw err;
    }
  }, [foundationId, refresh]);

  // Stats from records
  const stats = {
    total: records.length,
    draft: records.filter((po) => po.status === "draft").length,
    pending: records.filter((po) => po.status === "pending").length,
    approved: records.filter((po) => po.status === "approved").length,
    sent: records.filter((po) => po.status === "sent").length,
    totalValue: records.reduce((sum, po) => sum + (Number(po.total) || 0), 0),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">{foundation?.name || "Purchase Orders"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage purchase orders across all jobs
          {foundationId && <span className="ml-2 text-xs font-mono">Table #{foundationId}</span>}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total POs</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Draft</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.draft}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Approved</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Value</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(stats.totalValue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <TeeemTableView
        entries={records}
        columns={columns}
        foundationId={foundationId ? String(foundationId) : ""}
        foundationIdNumeric={foundationId || 0}
        tableName={foundation?.name || "Purchase Orders"}
        enableExport={true}
        onRefresh={refresh}
        onRowClick={handleRowClick}
        onRowUpdate={handleRowUpdate}
      />
    </div>
  );
}
