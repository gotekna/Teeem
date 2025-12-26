"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow, TableColumn } from "@/components/table/types";

interface SmTask {
  id: number;
  task_number: number;
  name: string;
  trade?: string;
  stage?: string;
  status: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  supplier?: { id: number; display_name: string };
  supplier_name?: string;
  sm_template_row_id?: number;
  purchase_order_id?: number;
  purchase_order_number?: string;
}

interface JobScheduleTabProps {
  jobId: string | number;
}

// Define columns for SmTasks table
const SM_TASK_COLUMNS: TableColumn[] = [
  { key: "task_number", label: "Task #", column_type: "number", width: 70 },
  { key: "name", label: "Name", column_type: "text", width: 250 },
  { key: "trade", label: "Trade", column_type: "text", width: 120 },
  { key: "stage", label: "Stage", column_type: "text", width: 100 },
  { key: "status", label: "Status", column_type: "badge", width: 100 },
  { key: "start_date", label: "Start", column_type: "date", width: 100 },
  { key: "end_date", label: "End", column_type: "date", width: 100 },
  { key: "duration_days", label: "Days", column_type: "number", width: 60 },
  { key: "supplier_name", label: "Supplier", column_type: "text", width: 150 },
];

export function JobScheduleTab({ jobId }: JobScheduleTabProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<SmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{ sm_tasks: SmTask[] }>(`/api/v1/jobs/${jobId}/sm_tasks`);
      // Add supplier_name for display
      const tasksWithSupplierName = (response?.sm_tasks || []).map(task => ({
        ...task,
        supplier_name: task.supplier?.display_name || "",
      }));
      setTasks(tasksWithSupplierName);
    } catch (err) {
      console.error("Failed to load tasks:", err);
      setError("Failed to load schedule tasks");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleRowClick = (row: TableRow) => {
    // Navigate to Schedule Master (SSoT) with task filter
    router.push(`/admin/system?tab=schedule-master`);
  };

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        entries={tasks as unknown as TableRow[]}
        columns={SM_TASK_COLUMNS}
        tableName="Schedule Tasks"
        onRefresh={loadTasks}
        onRowClick={handleRowClick}
        leftActions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/admin/system?tab=schedule-master`)}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Master
          </Button>
        }
        enableExport={true}
      />
    </div>
  );
}
