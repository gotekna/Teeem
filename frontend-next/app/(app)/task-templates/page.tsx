"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import { Plus } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { api } from "@/lib/api";
import { TablePage } from "@/components/ui/page-wrappers";

// Foundation ID for Task Templates table

export default function TaskTemplatesPage() {
  // Use foundation hook for TeeemTableView
  const { foundation, records, isLoading, error, refresh } = useFoundationBySlug("task_templates");

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/task_templates/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update task template:", error);
      throw error;
    }
  }, [refresh]);

  // Stats from records
  const stats = {
    total: records.length,
    milestones: records.filter((t) => t.is_milestone).length,
    standard: records.filter((t) => t.is_standard).length,
    avgDuration: records.length > 0
      ? Math.round(records.reduce((sum, t) => sum + (Number(t.default_duration_days) || 0), 0) / records.length)
      : 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  // Left actions - Back button + Create Template button
  const leftActions = (
    <div className="flex items-center gap-2">
      <BackButton fallbackHref="/dashboard" />
      <Button>
        <Plus className="h-4 w-4 mr-2" />
        Create Template
      </Button>
    </div>
  );

  return (
    <TablePage>
      <TeeemTableView
        entries={records}
        foundationId="task_templates"
        foundationIdNumeric={foundation?.id}
        tableName={foundation?.name || "Task Templates"}
        enableExport={true}
        onRefresh={refresh}
        onRowUpdate={handleRowUpdate}
        leftActions={leftActions}
        hideFooter={true}
      />
    </TablePage>
  );
}
