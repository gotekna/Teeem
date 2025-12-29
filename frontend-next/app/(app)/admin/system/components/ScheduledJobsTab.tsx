"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SimpleTableView, type SimpleColumn } from "@/components/table";
import { Spinner } from "@/components/ui/spinner";
import {
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Timer,
  Layers,
  Play,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

interface ScheduledJob {
  [key: string]: unknown;
  id: number;
  key: string;
  class_name: string;
  command: string | null;
  schedule: string;
  schedule_human: string;
  queue_name: string;
  arguments: unknown;
  description: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  status: "ok" | "overdue" | "pending";
}

interface QueueStats {
  [queueName: string]: number;
}

interface WorkerInfo {
  threads: number;
  processes: number;
}

interface ScheduledJobsResponse {
  success: boolean;
  data: {
    scheduled_jobs: ScheduledJob[];
    queue_stats: QueueStats;
    worker_info: WorkerInfo;
    config_source: string;
  };
}

export function ScheduledJobsTab() {
  const [jobs, setJobs] = React.useState<ScheduledJob[]>([]);
  const [queueStats, setQueueStats] = React.useState<QueueStats>({});
  const [workerInfo, setWorkerInfo] = React.useState<WorkerInfo>({ threads: 0, processes: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<ScheduledJobsResponse>("/api/v1/system/scheduled_jobs");
      if (response.success && response.data) {
        setJobs(response.data.scheduled_jobs);
        setQueueStats(response.data.queue_stats);
        setWorkerInfo(response.data.worker_info);
      }
    } catch (err) {
      console.error("Failed to load scheduled jobs:", err);
      setError("Failed to load scheduled jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const totalQueueDepth = Object.values(queueStats).reduce((a, b) => a + b, 0);
  const overdueJobs = jobs.filter((j) => j.status === "overdue").length;

  if (loading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-2" />
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={loadData}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Scheduled Jobs</h2>
          <p className="text-sm text-muted-foreground">
            Background tasks configured in config/recurring.yml
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{jobs.length}</p>
                <p className="text-xs text-muted-foreground">Scheduled Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Layers className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{workerInfo.threads}</p>
                <p className="text-xs text-muted-foreground">Worker Threads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                totalQueueDepth > 20
                  ? "bg-red-100 dark:bg-red-900/30"
                  : totalQueueDepth > 10
                  ? "bg-amber-100 dark:bg-amber-900/30"
                  : "bg-green-100 dark:bg-green-900/30"
              )}>
                <Timer className={cn(
                  "h-5 w-5",
                  totalQueueDepth > 20
                    ? "text-red-600 dark:text-red-400"
                    : totalQueueDepth > 10
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-green-600 dark:text-green-400"
                )} />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalQueueDepth}</p>
                <p className="text-xs text-muted-foreground">Queue Depth</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                overdueJobs > 0
                  ? "bg-red-100 dark:bg-red-900/30"
                  : "bg-green-100 dark:bg-green-900/30"
              )}>
                {overdueJobs > 0 ? (
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">{overdueJobs}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue Stats by Queue Name */}
      {Object.keys(queueStats).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Queue Depth by Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(queueStats).map(([queue, count]) => (
                <Badge
                  key={queue}
                  variant={count > 10 ? "destructive" : count > 5 ? "outline" : "secondary"}
                  className="text-xs"
                >
                  {queue}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Jobs Table */}
      <SimpleTableView
        tableName="All Scheduled Tasks"
        entries={jobs}
        columns={[
          { key: "key", label: "Task", width: 200 },
          { key: "schedule_human", label: "Schedule", width: 120 },
          { key: "queue_name", label: "Queue", width: 100 },
          { key: "last_run_at", label: "Last Run", width: 130 },
          { key: "next_run_at", label: "Next Run", width: 130 },
          { key: "status", label: "Status", width: 100 },
        ]}
        customCellRenderer={(column, value, row) => {
          const job = row as ScheduledJob;

          if (column.key === "key") {
            return (
              <div className="min-w-0">
                <p className="font-mono text-xs truncate">{job.key}</p>
                <p className="text-xs text-muted-foreground truncate">{job.class_name}</p>
              </div>
            );
          }

          if (column.key === "schedule_human") {
            return (
              <Badge variant="outline" className="text-xs font-normal">
                {job.schedule_human}
              </Badge>
            );
          }

          if (column.key === "queue_name") {
            return (
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs",
                  job.queue_name === "default" && "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                  job.queue_name === "low" && "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                )}
              >
                {job.queue_name}
              </Badge>
            );
          }

          if (column.key === "last_run_at") {
            return job.last_run_at ? (
              <span className="text-xs text-muted-foreground" title={format(new Date(job.last_run_at), "PPpp")}>
                {formatDistanceToNow(new Date(job.last_run_at), { addSuffix: true })}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Never</span>
            );
          }

          if (column.key === "next_run_at") {
            return job.next_run_at ? (
              <span className="text-xs text-muted-foreground" title={format(new Date(job.next_run_at), "PPpp")}>
                {formatDistanceToNow(new Date(job.next_run_at), { addSuffix: true })}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">-</span>
            );
          }

          if (column.key === "status") {
            if (job.status === "ok") {
              return (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  OK
                </Badge>
              );
            }
            if (job.status === "overdue") {
              return (
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Overdue
                </Badge>
              );
            }
            if (job.status === "pending") {
              return (
                <Badge variant="outline" className="text-xs">
                  <Play className="h-3 w-3 mr-1" />
                  Pending
                </Badge>
              );
            }
          }

          return null;
        }}
        showFooter={false}
        rowHeight={44}
        className="h-[400px]"
      />

      {/* Queue Priority Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Queue Priority Order</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Jobs are processed in this order (highest priority first):
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-blue-600 text-white">1. default</Badge>
            <Badge className="bg-purple-600 text-white">2. solid_queue_recurring</Badge>
            <Badge className="bg-amber-600 text-white">3. xero_bulk</Badge>
            <Badge className="bg-gray-600 text-white">4. low</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            BPMN workflows and user actions go to <code className="bg-muted px-1 py-0.5 rounded">default</code> queue
            for immediate processing. Background analytics use the <code className="bg-muted px-1 py-0.5 rounded">low</code> queue.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
