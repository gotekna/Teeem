"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import {
  Plus,
  Clock,
  ListTodo,
  Flag,
  Layers,
} from "lucide-react";
import { api } from "@/lib/api";

// Foundation ID for Task Templates table

export default function TaskTemplatesPage() {
  // Use foundation hook for TeeemTableView
  const { foundation, columns, records, isLoading, error, refresh } = useFoundationBySlug("task_templates");

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

  // Left actions - Create Template button
  const leftActions = (
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      Create Template
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Task Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total} reusable task definitions for construction schedules
            
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Total Templates</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-yellow-600" />
              <span className="text-xs text-muted-foreground">Milestones</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.milestones}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Standard Tasks</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.standard}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Avg Duration</span>
            </div>
            <div className="text-2xl font-bold font-mono mt-2">{stats.avgDuration} days</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <TeeemTableView
        entries={records}
        columns={columns}
        foundationId="task_templates"
        foundationIdNumeric={foundation?.id}
        tableName={foundation?.name || "Task Templates"}
        enableExport={true}
        onRefresh={refresh}
        onRowUpdate={handleRowUpdate}
        leftActions={leftActions}
      />
    </div>
  );
}
