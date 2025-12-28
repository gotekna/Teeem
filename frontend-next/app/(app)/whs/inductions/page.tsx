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
  Mail,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { api } from "@/lib/api";

// Foundation ID for WHS Inductions table

export default function WHSInductionsPage() {
  // Use foundation hook for TeeemTableView
  const { foundation, records, isLoading, refresh } = useFoundationBySlug("whs_inductions");

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/whs_inductions/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update induction:", error);
      throw error;
    }
  }, [refresh]);

  // Stats from records
  const stats = {
    total: records.length,
    completed: records.filter((i) => i.status === "completed").length,
    pending: records.filter((i) => i.status === "pending").length,
    expired: records.filter((i) => i.status === "expired").length,
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
      <Button variant="outline">
        <Mail className="h-4 w-4 mr-2" />
        Send Reminders
      </Button>
      <Button>
        <Plus className="h-4 w-4 mr-2" />
        New Induction
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        entries={records}
        foundationId="whs_inductions"
        foundationIdNumeric={foundation?.id}
        tableName={foundation?.name || "Site Inductions"}
        enableExport={true}
        onRefresh={refresh}
        onRowUpdate={handleRowUpdate}
        leftActions={leftActions}
        hideFooter={true}
      />
    </div>
  );
}
