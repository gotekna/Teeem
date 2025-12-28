"use client";

import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import {
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { api } from "@/lib/api";

// Foundation ID for WHS Inspections table

export default function WHSInspectionsPage() {
  // Use foundation hook for TeeemTableView
  const { foundation, records, isLoading, refresh } = useFoundationBySlug("whs_inspections");

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/whs_inspections/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update inspection:", error);
      throw error;
    }
  }, [refresh]);

  // Stats from records
  const stats = {
    total: records.length,
    completed: records.filter((i) => i.status === "completed").length,
    scheduled: records.filter((i) => i.status === "scheduled").length,
    overdue: records.filter((i) => i.status === "overdue").length,
    avgScore: Math.round(
      records
        .filter((i) => i.score !== undefined && i.score !== null)
        .reduce((sum, i) => sum + (Number(i.score) || 0), 0) /
        (records.filter((i) => i.score !== undefined && i.score !== null).length || 1)
    ),
  };

  // Get score color
  const getScoreColor = (score: number): string => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    );
  }

  // Left actions - Back button + action buttons
  const leftActions = (
    <div className="flex items-center gap-2">
      <BackButton fallbackHref="/whs" />
      <Button>
        <Plus className="h-4 w-4 mr-2" />
        New Inspection
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        entries={records}
        foundationId="whs_inspections"
        foundationIdNumeric={foundation?.id}
        tableName={foundation?.name || "Site Inspections"}
        enableExport={true}
        onRefresh={refresh}
        onRowUpdate={handleRowUpdate}
        leftActions={leftActions}
        hideFooter={true}
      />
    </div>
  );
}
