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
import { getTableUIConfig } from "@/lib/table-ui-config";
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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [views, setViews] = useState<SavedView[]>([]);
  const [serverSearchLoading, setServerSearchLoading] = useState(false);
  const [jobStatuses, setJobStatuses] = useState<JobStatus[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);

  // Jobs table is foundation ID 204
  const JOBS_TABLE_ID = 204;
  const tableConfig = getTableUIConfig(JOBS_TABLE_ID);

  // System-generated column types that users cannot edit
  const SYSTEM_GENERATED_TYPES = [
    'computed', 'formula', 'auto_number', 'created_time', 'modified_time',
    'created_by', 'modified_by', 'rollup', 'count'
  ];

  // Check if a column is system-generated
  const isSystemColumn = (columnName: string, columnType?: string): boolean => {
    return ['id', 'created_at', 'updated_at'].includes(columnName) ||
           SYSTEM_GENERATED_TYPES.includes(columnType || '');
  };

  useEffect(() => {
    loadJobs();
    loadJobMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only effect
  }, []);

  const loadJobMetadata = async () => {
    try {
      // Load job statuses and job types for filter dropdowns
      const [statusesRes, typesRes] = await Promise.all([
        api.get<{ success: boolean; job_statuses: JobStatus[] }>("/api/v1/job_statuses"),
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
      if (response?.views) {
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
    console.log('[Jobs] tableColumns useMemo - columns from API:', columns.length, 'jobStatuses:', jobStatuses.length, 'jobTypes:', jobTypes.length);
    console.log('[Jobs] jobStatuses:', jobStatuses.map(s => s.name));
    console.log('[Jobs] jobTypes:', jobTypes.map(t => t.name));

    // If columns came from API, use those but enrich with choices data
    if (columns.length > 0) {
      const enrichedColumns = columns.map(col => {
        // Get the column identifier - API columns may use 'key' or 'column_name'
        const colKey = col.key || (col as unknown as { column_name?: string }).column_name || '';
        const isSysCol = isSystemColumn(colKey, col.column_type);

        // Add choices for job_type and job_type_id columns
        if (colKey === 'job_type' || colKey === 'job_type_id') {
          return { ...col, choices: jobTypes.map(t => t.name), column_type: 'choice', editable: !isSysCol, system: isSysCol };
        }
        // Add choices for job_status and job_status_id columns
        if (colKey === 'job_status' || colKey === 'job_status_id') {
          return { ...col, choices: jobStatuses.map(s => s.name), column_type: 'choice', editable: !isSysCol, system: isSysCol };
        }
        return { ...col, editable: !isSysCol, system: isSysCol };
      });

      // Ensure job_status and job_type columns are always available for filtering
      // (they may not be returned by the API but exist in the data)
      const columnKeys = enrichedColumns.map(c => c.key || (c as unknown as { column_name?: string }).column_name);
      const additionalColumns: TableColumn[] = [];

      if (!columnKeys.includes('job_status')) {
        additionalColumns.push({
          key: "job_status", label: "Job Status", width: 120, sortable: true, filterable: true,
          filterType: "dropdown", column_type: "choice", choices: jobStatuses.map(s => s.name)
        });
      }
      if (!columnKeys.includes('job_type')) {
        additionalColumns.push({
          key: "job_type", label: "Job Type", width: 120, sortable: true, filterable: true,
          filterType: "dropdown", column_type: "choice", choices: jobTypes.map(t => t.name)
        });
      }
      if (!columnKeys.includes('ted_number')) {
        additionalColumns.push({
          key: "ted_number", label: "TED #", width: 100, sortable: true, filterable: true, column_type: "single_line_text"
        });
      }

      return [
        { key: "select", label: "", width: 40, sortable: false, filterable: false },
        ...enrichedColumns,
        ...additionalColumns,
        { key: "actions", label: "Actions", width: 100, sortable: false, filterable: false },
      ];
    }

    // Default columns - include choices from loaded metadata
    // Note: Include both job_type/job_status AND job_type_id/job_status_id for backward compatibility with saved views
    return [
      { key: "select", label: "", width: 40, sortable: false, filterable: false },
      { key: "id", label: "ID", width: 60, sortable: true, filterable: true, column_type: "whole_number", editable: false, system: true },
      { key: "ted_number", label: "TED #", width: 100, sortable: true, filterable: true, column_type: "single_line_text" },
      { key: "title", label: "Job Title", width: 250, sortable: true, filterable: true, column_type: "single_line_text" },
      { key: "job_type", label: "Job Type", width: 120, sortable: true, filterable: true, filterType: "dropdown", column_type: "choice", choices: jobTypes.map(t => t.name) },
      { key: "job_type_id", label: "Job Type", width: 120, sortable: true, filterable: true, filterType: "dropdown", column_type: "choice", choices: jobTypes.map(t => t.name), hidden: true },
      { key: "job_status", label: "Job Status", width: 120, sortable: true, filterable: true, filterType: "dropdown", column_type: "choice", choices: jobStatuses.map(s => s.name) },
      { key: "job_status_id", label: "Job Status", width: 120, sortable: true, filterable: true, filterType: "dropdown", column_type: "choice", choices: jobStatuses.map(s => s.name), hidden: true },
      { key: "stage", label: "Stage", width: 100, sortable: true, filterable: true, filterType: "dropdown", column_type: "choice" },
      { key: "location", label: "Location", width: 200, sortable: true, filterable: true, column_type: "single_line_text" },
      { key: "site_supervisor_name", label: "Supervisor", width: 150, sortable: true, filterable: true, column_type: "single_line_text" },
      { key: "contract_value", label: "Contract Value", width: 130, sortable: true, filterable: true, column_type: "currency" },
      { key: "start_date", label: "Start Date", width: 120, sortable: true, filterable: true, column_type: "date" },
      { key: "actions", label: "Actions", width: 100, sortable: false, filterable: false },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally excluding isSystemColumn (defined in component scope)
  }, [columns, jobStatuses, jobTypes]);

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
      // Map _id columns to show names (for views that use job_type_id instead of job_type)
      job_type_id: typeof job.job_type === 'object' && job.job_type !== null
        ? (job.job_type as { name?: string }).name || ''
        : job.job_type,
      job_status_id: typeof job.job_status === 'object' && job.job_status !== null
        ? (job.job_status as { name?: string }).name || ''
        : job.job_status,
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

  const handleRowUpdate = async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/jobs/${rowId}`, { job: { [field]: value } });
      // Update local state
      setJobs((prev) =>
        prev.map((j) => (j.id === rowId ? { ...j, [field]: value } : j))
      );
    } catch (error) {
      console.error("Failed to update job:", error);
      throw error; // Re-throw so the table can handle the error
    }
  };

  const handleServerSearch = (term: string, searchAllColumns: boolean) => {
    loadJobs(term, searchAllColumns);
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
      <div className="flex items-center justify-between shrink-0">
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
          onRowUpdate={handleRowUpdate}
          onServerSearch={handleServerSearch}
          serverSearchLoading={serverSearchLoading}
          enableExport={tableConfig.enableExport}
          enableImport={tableConfig.enableImport}
          enableSchemaEditor={tableConfig.enableSchemaEditor}
          preloadedViews={views}
          onRefresh={() => loadJobs()}
        />
      </div>
    </div>
  );
}
