"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationById } from "@/hooks/useFoundationById";
import {
  Plus,
  ShoppingCart,
  FileText,
  Clock,
  CheckCircle,
  DollarSign,
} from "lucide-react";
import { api } from "@/lib/api";
import type { TableRow } from "@/components/table/types";

// Foundation ID for Purchase Orders table
const PURCHASE_ORDERS_FOUNDATION_ID = 217;

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

  // Use foundation hook for TeeemTableView
  const { foundation, columns, records, isLoading, error, refresh } = useFoundationById(PURCHASE_ORDERS_FOUNDATION_ID);

  // Handle row click - navigate to job with PO tab
  const handleRowClick = useCallback((row: TableRow) => {
    const jobId = row.job_id || (row.job as { id?: number })?.id;
    if (jobId) {
      router.push(`/jobs/${jobId}?tab=purchase-orders`);
    }
  }, [router]);

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/${PURCHASE_ORDERS_FOUNDATION_ID}/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update purchase order:", error);
      throw error;
    }
  }, [refresh]);

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
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">Purchase Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage purchase orders across all jobs
          <span className="ml-2 text-xs font-mono">Table #217</span>
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
        foundationId={String(PURCHASE_ORDERS_FOUNDATION_ID)}
        foundationIdNumeric={PURCHASE_ORDERS_FOUNDATION_ID}
        tableName={foundation?.name || "Purchase Orders"}
        enableExport={true}
        onRefresh={refresh}
        onRowClick={handleRowClick}
        onRowUpdate={handleRowUpdate}
      />
    </div>
  );
}
