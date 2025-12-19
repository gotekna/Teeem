"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import {
  Plus,
  FileText,
  Clock,
  CheckCircle,
  DollarSign,
} from "lucide-react";
import { api } from "@/lib/api";
import type { TableRow } from "@/components/table/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function EstimatesPage() {
  useSetLayoutMode("full-height");
  const router = useRouter();

  // Use foundation hook for TeeemTableView
  const { foundation, records, isLoading, error, refresh } = useFoundationBySlug("estimates");

  // Handle row click - navigate to job with estimates tab
  const handleRowClick = useCallback((row: TableRow) => {
    const jobId = row.job_id || (row.job as { id?: number })?.id;
    if (jobId) {
      router.push(`/jobs/${jobId}?tab=estimates`);
    }
  }, [router]);

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/estimates/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update estimate:", error);
      throw error;
    }
  }, [refresh]);

  // Stats from records
  const stats = {
    total: records.length,
    pendingReview: records.filter((e) => e.status === "pending").length,
    approved: records.filter((e) => e.status === "approved").length,
    poGenerated: records.filter((e) => e.po_generated).length,
    totalValue: records.reduce((sum, e) => sum + (Number(e.total_amount) || 0), 0),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    );
  }

  // Left actions - Upload Estimate button
  const leftActions = (
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      Upload Estimate
    </Button>
  );

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        entries={records}
        foundationId="estimates"
        foundationIdNumeric={foundation?.id}
        tableName={foundation?.name || "Estimates"}
        enableExport={true}
        onRefresh={refresh}
        onRowClick={handleRowClick}
        onRowUpdate={handleRowUpdate}
        leftActions={leftActions}
        hideFooter={true}
      />
    </div>
  );
}
