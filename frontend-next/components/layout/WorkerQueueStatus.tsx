"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  TrendingDown,
  TrendingUp,
  Minus,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

type QueueStatusLevel = "healthy" | "busy" | "degraded" | "error" | "unknown";

interface QueueStatusData {
  status: QueueStatusLevel;
  statusMessage: string;
  processes: Record<
    string,
    { count: number; latestHeartbeat: string | null }
  >;
  pending: number;
  running: number;
  failed: number;
  scheduled: number;
  blocked: number;
  completedPerMin: number;
  trend: "idle" | "draining" | "stable" | "stuck" | "growing";
  queueDepth: Array<{ queue: string; count: number }>;
  pausedQueues: string[];
  topFailed: Array<{ className: string; count: number }>;
  watchdog: {
    status: string;
    last_heartbeat: string | null;
    staleness_seconds: number | null;
  };
}

function getStatusIconColor(status: QueueStatusLevel) {
  switch (status) {
    case "healthy":
      return "text-green-500 dark:text-green-400 hover:text-green-600";
    case "busy":
      return "text-blue-500 dark:text-blue-400 hover:text-blue-600";
    case "degraded":
      return "text-orange-500 dark:text-orange-400 hover:text-orange-600";
    case "error":
      return "text-red-500 dark:text-red-400 hover:text-red-600";
    default:
      return "text-muted-foreground hover:text-muted-foreground";
  }
}

function getDotColor(status: QueueStatusLevel) {
  switch (status) {
    case "healthy":
      return "bg-green-500";
    case "busy":
      return "bg-blue-500";
    case "degraded":
      return "bg-orange-500";
    case "error":
      return "bg-red-500";
    default:
      return "bg-muted-foreground";
  }
}

function TrendIndicator({
  trend,
  rate,
}: {
  trend: string;
  rate: number;
}) {
  switch (trend) {
    case "draining":
      return (
        <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5">
          <TrendingDown className="h-3 w-3" /> Draining ({rate}/min)
        </span>
      );
    case "growing":
      return (
        <span className="text-orange-600 dark:text-orange-400 flex items-center gap-0.5">
          <TrendingUp className="h-3 w-3" /> Growing
        </span>
      );
    case "stuck":
      return (
        <span className="text-red-600 dark:text-red-400 flex items-center gap-0.5">
          <Minus className="h-3 w-3" /> Stuck
        </span>
      );
    case "idle":
      return (
        <span className="text-muted-foreground flex items-center gap-0.5">
          <Minus className="h-3 w-3" /> Idle
        </span>
      );
    default:
      return (
        <span className="text-muted-foreground flex items-center gap-0.5">
          <ArrowRight className="h-3 w-3" /> Stable ({rate}/min)
        </span>
      );
  }
}

function timeAgo(iso: string | null): string {
  if (!iso) return "n/a";
  const seconds = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 1000
  );
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function WorkerQueueStatus() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<QueueStatusData | null>(null);
  const [status, setStatus] = useState<QueueStatusLevel>("unknown");

  const fetchQueueStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        data: QueueStatusData;
      }>("/api/v1/system/queue_status");
      if (response?.success && response?.data) {
        setData(response.data);
        setStatus(response.data.status);
      }
    } catch (error) {
      console.debug("Failed to fetch queue status:", error);
      setStatus("unknown");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount (for the status dot)
  useEffect(() => {
    fetchQueueStatus();
  }, [fetchQueueStatus]);

  // Re-fetch when popover opens (for fresh detail data)
  useEffect(() => {
    if (isOpen) fetchQueueStatus();
  }, [isOpen, fetchQueueStatus]);

  const processEntries = data?.processes
    ? Object.entries(data.processes).sort(([a], [b]) =>
        a.localeCompare(b)
      )
    : [];

  const hasQueueDepth =
    data?.queueDepth && data.queueDepth.some((q) => q.count > 0);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative p-1.5 rounded-md transition-colors",
            getStatusIconColor(status)
          )}
          title={data?.statusMessage || "Worker Queue: Loading..."}
        >
          <Activity className="h-4 w-4" />
          <div
            className={cn(
              "absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-white dark:border-border",
              getDotColor(status)
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div>
            <h4 className="font-medium text-sm">Worker Queue</h4>
            <p className="text-xs text-muted-foreground">
              {data?.statusMessage || "Loading..."}
            </p>
          </div>
          <button
            onClick={() => fetchQueueStatus()}
            disabled={isLoading}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
            />
          </button>
        </div>

        {data && (
          <>
            {/* Execution summary */}
            <div className="p-3 border-b border-border">
              <div className="flex gap-3 text-xs">
                <span>
                  <span className="font-medium">{data.running}</span>{" "}
                  <span className="text-muted-foreground">running</span>
                </span>
                <span>
                  <span className="font-medium">{data.pending}</span>{" "}
                  <span className="text-muted-foreground">pending</span>
                </span>
                {data.failed > 0 && (
                  <span>
                    <span className="font-medium text-red-500">
                      {data.failed}
                    </span>{" "}
                    <span className="text-red-500">failed</span>
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-xs">
                <TrendIndicator
                  trend={data.trend}
                  rate={data.completedPerMin}
                />
              </div>
            </div>

            {/* Processes */}
            {processEntries.length > 0 && (
              <div className="p-3 border-b border-border">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  Processes
                </p>
                {processEntries.map(([kind, info]) => (
                  <div
                    key={kind}
                    className="flex justify-between text-xs py-0.5"
                  >
                    <span>{kind}</span>
                    <span className="text-muted-foreground">
                      {info.count}{" "}
                      <span className="text-[10px]">
                        {timeAgo(info.latestHeartbeat)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Queue depth */}
            {hasQueueDepth && (
              <div className="p-3 border-b border-border">
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Queues
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    pending
                  </p>
                </div>
                {data.queueDepth.map((q) => (
                  <div
                    key={q.queue}
                    className="flex justify-between text-xs py-0.5"
                  >
                    <span className="text-muted-foreground truncate">
                      {q.queue}
                    </span>
                    <span className="shrink-0 ml-2">{q.count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Paused queues */}
            {data.pausedQueues.length > 0 && (
              <div className="p-3 border-b border-border">
                <p className="text-[10px] font-medium text-orange-500 uppercase tracking-wider mb-1.5">
                  Paused Queues
                </p>
                {data.pausedQueues.map((q) => (
                  <div key={q} className="text-xs text-orange-500 py-0.5">
                    {q}
                  </div>
                ))}
              </div>
            )}

            {/* Top failed */}
            {data.failed > 0 && data.topFailed.length > 0 && (
              <div className="p-3 border-b border-border">
                <p className="text-[10px] font-medium text-red-500 uppercase tracking-wider mb-1.5">
                  Failed ({data.failed})
                </p>
                {data.topFailed.map((f) => (
                  <div
                    key={f.className}
                    className="flex justify-between text-xs py-0.5"
                  >
                    <span className="text-muted-foreground truncate">
                      {f.className}
                    </span>
                    <span className="text-red-500 shrink-0 ml-2">
                      {f.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="p-2 border-t border-border bg-muted/30">
          <Link
            href="/admin/system?tab=scheduled-jobs"
            className="block text-center text-xs text-primary hover:underline"
          >
            View Scheduled Jobs
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
