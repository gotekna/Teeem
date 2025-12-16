"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import {
  Plus,
  FileQuestion,
  Clock,
  CheckCircle,
  DollarSign,
} from "lucide-react";
import { api } from "@/lib/api";
import type { TableRow } from "@/components/table/types";

// Foundation ID for Quote Requests table

export default function QuoteRequestsPage() {
  const router = useRouter();

  // Use foundation hook for TeeemTableView
  const { foundation, columns, records, isLoading, error, refresh } = useFoundationBySlug("quote_requests");

  // Handle row click - navigate to quote request detail
  const handleRowClick = useCallback((row: TableRow) => {
    router.push(`/quote-requests/${row.id}`);
  }, [router]);

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/quote_requests/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update quote request:", error);
      throw error;
    }
  }, [refresh]);

  // Stats from records
  const stats = {
    total: records.length,
    pending: records.filter((r) => r.status === "sent" || r.status === "responded").length,
    accepted: records.filter((r) => r.status === "accepted").length,
    totalSavings: records
      .filter((r) => r.status === "accepted" && r.budget_estimate && r.accepted_amount)
      .reduce((sum, r) => sum + ((Number(r.budget_estimate) || 0) - (Number(r.accepted_amount) || 0)), 0),
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  // Left actions - New Quote Request button
  const leftActions = (
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      New Quote Request
    </Button>
  );

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        entries={records}
        columns={columns}
        foundationId="quote_requests"
        foundationIdNumeric={foundation?.id}
        tableName={foundation?.name || "Quote Requests"}
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
