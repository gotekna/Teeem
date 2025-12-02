"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TeeemTableView } from "@/components/table";
import type { TableColumn, TableRow, SavedView } from "@/components/table/types";
import { api } from "@/lib/api";
import { slugifyJobTitle } from "@/lib/url-utils";
import { Loader } from "@/components/ui/loader";
import { Plus } from "lucide-react";

interface Job {
  id: number;
  title: string;
  ted_number: string | null;
  stage: string | null;
  job_status: string | null;
  job_type: string | null;
  contract_value: number | null;
  live_profit: number | null;
  profit_percentage: number | null;
  start_date: string | null;
  location: string | null;
  site_supervisor_name: string | null;
  site_supervisor_email: string | null;
  site_supervisor_phone: string | null;
  design_name: string | null;
  created_at: string;
  updated_at: string;
}

interface JobsResponse {
  jobs: Job[];
  total: number;
  columns?: TableColumn[];
  views?: SavedView[];
}

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [views, setViews] = useState<SavedView[]>([]);
  const [serverSearchLoading, setServerSearchLoading] = useState(false);

  // Jobs table is foundation ID 204
  const JOBS_TABLE_ID = 204;

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async (searchTerm?: string, searchAllColumns?: boolean) => {
    try {
      if (searchTerm) {
        setServerSearchLoading(true);
      } else {
        setLoading(true);
      }

      const params: Record<string, string | number | boolean> = {};
      if (searchTerm) {
        params.search = searchTerm;
        if (searchAllColumns) {
          params.search_all = true;
        }
      }

      const response = await api.get<JobsResponse>("/api/v1/jobs", { params });
      setJobs(response.jobs || []);

      // Load columns if not already loaded
      if (!columns.length && response.columns) {
        setColumns(response.columns);
      }

      // Load views if provided
      if (response.views) {
        setViews(response.views);
      }
    } catch (error) {
      console.error("Failed to load jobs:", error);
    } finally {
      setLoading(false);
      setServerSearchLoading(false);
    }
  };

  // Define columns for the jobs table
  const tableColumns: TableColumn[] = useMemo(() => {
    // If columns came from API, use those
    if (columns.length > 0) {
      return [
        { key: "select", label: "", width: 40, sortable: false, filterable: false },
        ...columns,
        { key: "actions", label: "Actions", width: 100, sortable: false, filterable: false },
      ];
    }

    // Default columns
    return [
      { key: "select", label: "", width: 40, sortable: false, filterable: false },
      { key: "ted_number", label: "TED #", width: 100, sortable: true, filterable: true, column_type: "single_line_text" },
      { key: "title", label: "Job Title", width: 250, sortable: true, filterable: true, column_type: "single_line_text" },
      { key: "job_type", label: "Job Type", width: 120, sortable: true, filterable: true, filterType: "dropdown", column_type: "choice" },
      { key: "job_status", label: "Job Status", width: 120, sortable: true, filterable: true, filterType: "dropdown", column_type: "choice" },
      { key: "stage", label: "Stage", width: 100, sortable: true, filterable: true, filterType: "dropdown", column_type: "choice" },
      { key: "location", label: "Location", width: 200, sortable: true, filterable: true, column_type: "single_line_text" },
      { key: "site_supervisor_name", label: "Supervisor", width: 150, sortable: true, filterable: true, column_type: "single_line_text" },
      { key: "contract_value", label: "Contract Value", width: 130, sortable: true, filterable: true, column_type: "currency" },
      { key: "start_date", label: "Start Date", width: 120, sortable: true, filterable: true, column_type: "date" },
      { key: "actions", label: "Actions", width: 100, sortable: false, filterable: false },
    ];
  }, [columns]);

  // Convert jobs to table rows - flatten nested objects for display
  const tableRows: TableRow[] = useMemo(() => {
    return jobs.map((job) => ({
      ...job,
      id: job.id,
      // Flatten nested objects to display their name property
      job_type: typeof job.job_type === 'object' && job.job_type !== null
        ? (job.job_type as { name?: string }).name || ''
        : job.job_type,
      job_status: typeof job.job_status === 'object' && job.job_status !== null
        ? (job.job_status as { name?: string }).name || ''
        : job.job_status,
      // Keep original objects for filtering if needed
      job_type_id: typeof job.job_type === 'object' && job.job_type !== null
        ? (job.job_type as { id?: number }).id
        : undefined,
      job_status_id: typeof job.job_status === 'object' && job.job_status !== null
        ? (job.job_status as { id?: number }).id
        : undefined,
    }));
  }, [jobs]);

  // Calculate stats
  const stats = useMemo(() => {
    const inProgress = jobs.filter(
      (j) => j.stage === "Slab" || j.stage === "Frame" || j.stage === "Lockup"
    ).length;
    const completed = jobs.filter((j) => j.stage === "Completion").length;
    const totalValue = jobs.reduce((sum, j) => sum + (j.contract_value || 0), 0);

    return { total: jobs.length, inProgress, completed, totalValue };
  }, [jobs]);

  // Handlers
  const handleView = (row: TableRow) => {
    // Use numeric ID - the detail page will redirect to slug URL after loading
    router.push(`/jobs/${row.id}`);
  };

  const handleRowDoubleClick = (row: TableRow) => {
    // Navigate to full job page on double-click
    const slug = row.title ? slugifyJobTitle(String(row.title)) : String(row.id);
    router.push(`/jobs/${slug}`);
  };

  const handleRowDoubleClick = (row: TableRow) => {
    // Navigate to full job page on double-click
    const slug = row.title ? slugifyJobTitle(String(row.title)) : String(row.id);
    router.push(`/jobs/${slug}`);
  };

  const handleEdit = (row: TableRow) => {
    // Use numeric ID - the detail page will redirect to slug URL after loading
    router.push(`/jobs/${row.id}?edit=true`);
  };

  const handleDelete = async (row: TableRow) => {
    if (!confirm(`Are you sure you want to delete this job?`)) return;

    try {
      await api.delete(`/api/v1/jobs/${row.id}`);
      setJobs((prev) => prev.filter((j) => j.id !== row.id));
    } catch (error) {
      console.error("Failed to delete job:", error);
      alert("Failed to delete job");
    }
  };

  const handleBulkDelete = async (ids: (number | string)[]) => {
    if (!confirm(`Are you sure you want to delete ${ids.length} jobs?`)) return;

    try {
      await Promise.all(ids.map((id) => api.delete(`/api/v1/jobs/${id}`)));
      setJobs((prev) => prev.filter((j) => !ids.includes(j.id)));
    } catch (error) {
      console.error("Failed to delete jobs:", error);
      alert("Failed to delete some jobs");
    }
  };

  const handleServerSearch = (term: string, searchAllColumns: boolean) => {
    loadJobs(term, searchAllColumns);
  };

  const handleExport = () => {
    // Export jobs to CSV
    const headers = ["ID", "TED #", "Title", "Type", "Status", "Stage", "Location", "Supervisor", "Contract Value"];
    const rows = jobs.map((j) => [
      j.id,
      j.ted_number || "",
      j.title,
      j.job_type || "",
      j.job_status || "",
      j.stage || "",
      j.location || "",
      j.site_supervisor_name || "",
      j.contract_value || "",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jobs-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Jobs</h1>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          entries={tableRows}
          columns={tableColumns}
          foundationId="jobs"
          foundationIdNumeric={JOBS_TABLE_ID}
          tableName="Jobs"
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          onRowDoubleClick={handleRowDoubleClick}
          onServerSearch={handleServerSearch}
          serverSearchLoading={serverSearchLoading}
          enableExport={true}
          onExport={handleExport}
          preloadedViews={views}
          onRefresh={() => loadJobs()}
        />
      </div>

    </div>
  );
}
