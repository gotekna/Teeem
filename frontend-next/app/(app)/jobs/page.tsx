"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TeeemTableView } from "@/components/table";
import type { TableRow } from "@/components/table/types";
import { api } from "@/lib/api";
import { getTableUIConfig } from "@/lib/table-ui-config";
import { Spinner } from "@/components/ui/spinner";
import { Plus } from "lucide-react";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";

// Metadata types for filter dropdowns
interface JobStatus {
  id: number;
  name: string;
}

interface JobType {
  id: number;
  name: string;
}

export default function JobsPage() {
  const router = useRouter();

  // Use Foundation API with fields=minimal for 96% payload reduction (50 → ~5 columns)
  const {
    foundation,
    columns,
    records,
    originalRecords,
    totalCount,
    isLoading,
    refresh,
    serverSearch,
    isSearching
  } = useFoundationBySlug("jobs");

  const [jobStatuses, setJobStatuses] = useState<JobStatus[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);

  // Jobs table is foundation ID 204
  const JOBS_TABLE_ID = 204;
  const tableConfig = getTableUIConfig(JOBS_TABLE_ID);

  // Load job metadata (statuses and types) for filters
  useEffect(() => {
    loadJobMetadata();
  }, []);

  const loadJobMetadata = async () => {
    try {
      // Load job statuses and job types for filter dropdowns
      const [statusesRes, typesRes] = await Promise.all([
        api.get<{ success: boolean; job_statuses: JobStatus[] }>("/api/v1/job_status"),
        api.get<{ success: boolean; job_types: JobType[] }>("/api/v1/job_types"),
      ]);

      if (statusesRes.success && statusesRes.job_statuses) {
        setJobStatuses(statusesRes.job_statuses);
      }
      if (typesRes.success && typesRes.job_types) {
        setJobTypes(typesRes.job_types);
      }
    } catch (error) {
      console.error("Failed to load job metadata:", error);
    }
  };

  // Calculate stats from Foundation records
  const stats = useMemo(() => {
    const inProgress = originalRecords.filter(
      (j) => j.stage === "Slab" || j.stage === "Frame" || j.stage === "Lockup"
    ).length;
    const completed = originalRecords.filter((j) => j.stage === "Completion").length;
    const totalValue = originalRecords.reduce((sum, j) => sum + (Number(j.contract_value) || 0), 0);

    return { total: totalCount ?? originalRecords.length, inProgress, completed, totalValue };
  }, [originalRecords, totalCount]);

  // Handlers
  const handleView = (row: TableRow) => {
    // Use numeric ID - the detail page will redirect to slug URL after loading
    router.push(`/jobs/${row.id}`);
  };

  const handleRowDoubleClick = (row: TableRow) => {
    // Navigate to full job page on double-click using numeric ID
    router.push(`/jobs/${row.id}`);
  };

  const handleEdit = (row: TableRow) => {
    // Use numeric ID - the detail page will redirect to slug URL after loading
    router.push(`/jobs/${row.id}?edit=true`);
  };

  const handleDelete = useCallback(async (row: TableRow) => {
    if (!confirm(`Are you sure you want to delete this job?`)) return;

    try {
      await api.delete(`/api/v1/jobs/${row.id}`);
      refresh(); // Refresh from Foundation API
    } catch (error) {
      console.error("Failed to delete job:", error);
      alert("Failed to delete job");
    }
  }, [refresh]);

  const handleBulkDelete = useCallback(async (ids: (number | string)[]) => {
    if (!confirm(`Are you sure you want to delete ${ids.length} jobs?`)) return;

    try {
      await Promise.all(ids.map((id) => api.delete(`/api/v1/jobs/${id}`)));
      refresh(); // Refresh from Foundation API
    } catch (error) {
      console.error("Failed to delete jobs:", error);
      alert("Failed to delete some jobs");
    }
  }, [refresh]);

  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/jobs/${rowId}`, { job: { [field]: value } });
      refresh(); // Refresh from Foundation API
    } catch (error) {
      console.error("Failed to update job:", error);
      throw error; // Re-throw so the table can handle the error
    }
  }, [refresh]);

  const handleServerSearch = useCallback((term: string, searchAllColumns: boolean) => {
    serverSearch(term);
  }, [serverSearch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-serif">Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your construction projects and jobs
            <span className="ml-2 text-xs font-mono">Table #{JOBS_TABLE_ID}</span>
          </p>
        </div>
        <Button asChild>
          <Link href="/jobs/new">
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold font-mono">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold font-mono text-blue-600">
              {stats.inProgress}
            </div>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold font-mono text-green-600">
              {stats.completed}
            </div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold font-mono text-purple-600">
              ${stats.totalValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Total Value</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0">
        <TeeemTableView
          entries={records as TableRow[]}
          // columns prop removed - TeeemTableView auto-fetches from Foundation API (SSoT)
          foundationId="jobs"
          foundationIdNumeric={JOBS_TABLE_ID}
          tableName="Jobs"
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          onRowDoubleClick={handleRowDoubleClick}
          onRowUpdate={handleRowUpdate}
          onServerSearch={handleServerSearch}
          serverSearchLoading={isSearching}
          enableExport={tableConfig.enableExport}
          enableImport={tableConfig.enableImport}
          enableSchemaEditor={tableConfig.enableSchemaEditor}
          onRefresh={refresh}
        />
      </div>
    </div>
  );
}
