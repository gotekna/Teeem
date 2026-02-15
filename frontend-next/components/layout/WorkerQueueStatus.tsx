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
  backlog: Array<{ key: string; label: string; remaining: number }>;
  dbConnections: { active: number; max: number } | null;
  memory: { usedMb: number; maxMb: number } | null;
  uptime: {
    bootedAt: string;
    uptimeSeconds: number;
    uptimeHuman: string;
  } | null;
  xeroRateLimits: Array<{
    tenantName: string;
    lockedOut: boolean;
    remainingSeconds: number;
    lockedUntil: string | null;
    dailyUsed: number;
    dailyLimit: number;
    minuteUsed: number;
    invoiceCount: number;
    syncedCount: number;
  }>;
  throughputHistory: Array<{ minutesAgo: number; count: number }>;
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

/** Map technical job class names to user-friendly labels */
const FRIENDLY_JOB_NAMES: Record<string, { name: string; hint: string }> = {
  XeroInvoiceSync: { name: "Xero Invoice Sync", hint: "Retries automatically" },
  XeroAttachmentSync: { name: "Xero Attachment Sync", hint: "Retries automatically" },
  XeroContactSync: { name: "Xero Contact Sync", hint: "Retries automatically" },
  XeroBankTransactionSync: { name: "Xero Bank Sync", hint: "Retries automatically" },
  GeneratePdf: { name: "PDF Generation", hint: "Will retry on next request" },
  AllOrgsEmailSync: { name: "Email Sync", hint: "Retries every few minutes" },
  BackupMirror: { name: "Backup Mirror", hint: "Retries on schedule" },
  EmailSync: { name: "Email Sync", hint: "Retries every few minutes" },
  DocumentClassification: { name: "Document Classification", hint: "Retries automatically" },
};

function friendlyJobName(className: string): { name: string; hint: string } {
  return FRIENDLY_JOB_NAMES[className] || {
    name: className.replace(/([A-Z])/g, " $1").trim(),
    hint: "Retries automatically",
  };
}

function ResourceBar({
  label,
  used,
  max,
  unit,
}: {
  label: string;
  used: number;
  max: number;
  unit?: string;
}) {
  const pct = max > 0 ? used / max : 0;
  const color =
    pct > 0.8
      ? "text-red-500 dark:text-red-400"
      : pct > 0.6
        ? "text-orange-500 dark:text-orange-400"
        : "text-foreground";
  const barColor =
    pct > 0.8 ? "bg-red-500" : pct > 0.6 ? "bg-orange-500" : "bg-green-500";

  return (
    <div>
      <div className="flex justify-between items-center text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className={cn("font-medium", color)}>{used}</span>
          <span className="text-muted-foreground">
            /{max}
            {unit ? ` ${unit}` : ""}
          </span>
        </span>
      </div>
      <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{
            width: `${Math.min(pct * 100, 100)}%`,
          }}
        />
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const h = 24;
  const w = 200;
  const step = w / (data.length - 1 || 1);

  const points = data
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-6"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-primary"
      />
      <polyline
        points={`0,${h} ${points} ${w},${h}`}
        fill="currentColor"
        className="text-primary/10"
      />
    </svg>
  );
}

export function WorkerQueueStatus() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<QueueStatusData | null>(null);
  const [status, setStatus] = useState<QueueStatusLevel>("unknown");
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

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
        setLastFetched(new Date());
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
          <div className="flex items-center gap-1.5">
            {lastFetched && !isLoading && (
              <span className="text-[10px] text-muted-foreground">
                {timeAgo(lastFetched.toISOString())}
              </span>
            )}
            <button
              onClick={() => fetchQueueStatus()}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
              />
            </button>
          </div>
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
                    <span className="font-medium text-orange-500 dark:text-orange-400">
                      {data.failed}
                    </span>{" "}
                    <span className="text-orange-500 dark:text-orange-400">retrying</span>
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

            {/* Resources: DB, Memory, Uptime */}
            {(data.dbConnections || data.memory || data.uptime) && (
              <div className="p-3 border-b border-border space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Resources
                  </p>
                  {data.uptime && (
                    <span className="text-[10px] text-muted-foreground">
                      up {data.uptime.uptimeHuman}
                    </span>
                  )}
                </div>
                {data.dbConnections && (
                  <ResourceBar
                    label="DB Connections"
                    used={data.dbConnections.active}
                    max={data.dbConnections.max}
                  />
                )}
                {data.memory && (
                  <ResourceBar
                    label="Memory"
                    used={data.memory.usedMb}
                    max={data.memory.maxMb}
                    unit="MB"
                  />
                )}
              </div>
            )}

            {/* Throughput sparkline */}
            {data.throughputHistory && data.throughputHistory.length > 0 && (
              <div className="p-3 border-b border-border">
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Throughput
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    last 60 min
                  </p>
                </div>
                <Sparkline data={data.throughputHistory.map((b) => b.count)} />
              </div>
            )}

            {/* Xero Rate Limits */}
            {data.xeroRateLimits && data.xeroRateLimits.length > 0 && (
              <div className="p-3 border-b border-border">
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Xero Orgs
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {data.xeroRateLimits.filter((r) => !r.lockedOut).length}/{data.xeroRateLimits.length} active
                  </p>
                </div>
                <div className="space-y-1.5">
                  {data.xeroRateLimits.map((org) => {
                    const syncPct = org.invoiceCount > 0
                      ? Math.round((org.syncedCount / org.invoiceCount) * 100)
                      : 0;
                    return (
                      <div key={org.tenantName}>
                        <div className="flex justify-between text-xs items-center">
                          <span className={cn(
                            "truncate",
                            org.lockedOut ? "text-orange-500 dark:text-orange-400" : "text-foreground"
                          )}>
                            {org.tenantName}
                          </span>
                          <span className="shrink-0 ml-2 text-[10px] flex items-center gap-1.5">
                            <span className="text-muted-foreground tabular-nums">
                              {org.syncedCount.toLocaleString()}/{org.invoiceCount.toLocaleString()}
                            </span>
                            {org.lockedOut ? (
                              <span className="text-orange-500 dark:text-orange-400 w-6 text-right">
                                {Math.ceil(org.remainingSeconds / 60)}m
                              </span>
                            ) : (
                              <span className="text-green-500 dark:text-green-400 w-6 text-right">OK</span>
                            )}
                          </span>
                        </div>
                        {org.invoiceCount > 0 && (
                          <div className="mt-0.5 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                syncPct >= 100
                                  ? "bg-green-500"
                                  : org.lockedOut
                                    ? "bg-orange-500"
                                    : "bg-blue-500"
                              )}
                              style={{ width: `${Math.min(syncPct, 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Backlog - application-level remaining work */}
            {data.backlog && data.backlog.length > 0 && (
              <div className="p-3 border-b border-border">
                <div className="flex justify-between items-center mb-1.5">
                  <p className="text-[10px] font-medium text-blue-500 dark:text-blue-400 uppercase tracking-wider">
                    Backlog
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    remaining
                  </p>
                </div>
                {data.backlog.map((item) => (
                  <div
                    key={item.key}
                    className="flex justify-between text-xs py-0.5"
                  >
                    <span className="text-foreground">{item.label}</span>
                    <span className="text-blue-500 dark:text-blue-400 shrink-0 ml-2 tabular-nums">
                      {item.remaining.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

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

            {/* Top failed - friendly names with guidance */}
            {data.failed > 0 && data.topFailed.length > 0 && (
              <div className="p-3 border-b border-border">
                <p className="text-[10px] font-medium text-orange-500 dark:text-orange-400 uppercase tracking-wider mb-1.5">
                  Recent Issues ({data.failed})
                </p>
                <p className="text-[10px] text-muted-foreground mb-2">
                  These are automatically retried and cleared after 24h.
                </p>
                {data.topFailed.map((f) => {
                  const friendly = friendlyJobName(f.className);
                  return (
                    <div
                      key={f.className}
                      className="flex justify-between text-xs py-0.5 items-center"
                    >
                      <div className="min-w-0">
                        <span className="text-foreground">{friendly.name}</span>
                        <span className="text-[10px] text-muted-foreground ml-1.5">{friendly.hint}</span>
                      </div>
                      <span className="text-orange-500 dark:text-orange-400 shrink-0 ml-2 tabular-nums">
                        {f.count}
                      </span>
                    </div>
                  );
                })}
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
