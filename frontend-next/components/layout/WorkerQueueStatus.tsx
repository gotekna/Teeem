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
  AlertTriangle,
  X,
  ChevronRight,
  Check,
  Mail,
  FileText,
  CircleAlert,
  RotateCcw,
} from "lucide-react";
import { createPortal } from "react-dom";
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
    circuit_breaker?: {
      open: boolean;
      cooled_down?: boolean;
      cooldown_remaining_seconds?: number;
      recent_restarts: number;
    };
  };
  backlog: Array<{ key: string; label: string; remaining: number; bills_processed?: number }>;
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
  dynos: Array<{
    app: string;
    environment: string;
    dyno: string;
    size: string;
    quantity: number;
    running: boolean;
    cost: number;
  }> | null;
  threadCapacity: { total: number; used: number } | null;
  workerApps: Array<{
    name: string;
    label: string;
    type: "worker" | "web";
    running: boolean | null;
    dynoSize: string | null;
    bootedAt?: string | null;
    threads?: { total: number; used: number };
    queues?: string[];
    memory: { usedMb: number | null; maxMb: number; live: boolean } | null;
    dbConnections?: number;
  }> | null;
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

function formatEta(remaining: number, ratePerMin: number): string {
  if (ratePerMin <= 0 || remaining <= 0) return "";
  const minutes = remaining / ratePerMin;
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `~${Math.round(minutes)} min`;
  if (minutes < 1440) return `~${Math.round(minutes / 60)} hrs`;
  return `~${Math.round(minutes / 1440)} days`;
}

/** Map backlog keys to user-friendly labels and icons */
const BACKLOG_ICONS: Record<string, typeof Mail> = {
  email_uploads: Mail,
  xero_invoices: FileText,
};

/** Module-level history so it persists across popover open/close */
interface HistoryPoint { timestamp: number; remaining: number }
const backlogHistory = new Map<string, HistoryPoint[]>();
const MAX_HISTORY_AGE_MS = 90 * 60_000; // keep 90 min of data

function recordBacklogSnapshot(backlog: Array<{ key: string; remaining: number }>) {
  const now = Date.now();
  for (const item of backlog) {
    const points = backlogHistory.get(item.key) || [];
    points.push({ timestamp: now, remaining: item.remaining });
    // Prune old entries
    const cutoff = now - MAX_HISTORY_AGE_MS;
    const pruned = points.filter((p) => p.timestamp >= cutoff);
    backlogHistory.set(item.key, pruned);
  }
}

function getHourlyProgress(key: string): { processed: number; stalled: boolean; hasData: boolean } {
  const points = backlogHistory.get(key);
  if (!points || points.length < 2) return { processed: 0, stalled: false, hasData: false };

  const now = Date.now();
  const oneHourAgo = now - 60 * 60_000;

  // Find the oldest point within the last hour (or the oldest we have)
  const oldest = points.find((p) => p.timestamp >= oneHourAgo) || points[0];
  const latest = points[points.length - 1];

  if (oldest === latest) return { processed: 0, stalled: false, hasData: false };

  const processed = oldest.remaining - latest.remaining;

  // Check if stalled: no change in last 5 minutes
  // Require oldest data point to be 3+ min old to avoid false positives on first load
  const fiveMinAgo = now - 5 * 60_000;
  const threeMinAgo = now - 3 * 60_000;
  const recentPoints = points.filter((p) => p.timestamp >= fiveMinAgo);
  const hasEnoughHistory = recentPoints.length >= 2 &&
    recentPoints[0].timestamp <= threeMinAgo;
  const stalled = hasEnoughHistory &&
    recentPoints.every((p) => p.remaining === latest.remaining) &&
    latest.remaining > 0;

  return { processed, stalled, hasData: true };
}

function formatProcessed(processed: number): string {
  if (processed === 0) return "";
  const abs = Math.abs(processed);
  const formatted = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toLocaleString();
  // Negative = backlog growing (more added than processed)
  if (processed < 0) return `+${formatted}`;
  return formatted;
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
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [restartingApp, setRestartingApp] = useState<string | null>(null);

  const fetchQueueStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        data: QueueStatusData;
      }>("/api/v1/system/queue_status");
      if (response?.success && response?.data) {
        // Un-dismiss banner if worker recovers then dies again
        if (response.data.status === "error" && status !== "error") {
          setBannerDismissed(false);
        }
        setData(response.data);
        setStatus(response.data.status);
        setLastFetched(new Date());
        if (response.data.backlog) {
          recordBacklogSnapshot(response.data.backlog);
        }
      }
    } catch (error) {
      console.debug("Failed to fetch queue status:", error);
      setStatus("unknown");
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  const handleRestartApp = useCallback(async (appName: string, label: string) => {
    if (!window.confirm(`Restart ${label}?\n\nIn-progress jobs will be re-queued automatically.`)) return;
    setRestartingApp(appName);
    try {
      await api.post("/api/v1/heroku/restart", { app: appName });
      await fetchQueueStatus();
    } catch (error) {
      console.error("Failed to restart app:", error);
    } finally {
      setRestartingApp(null);
    }
  }, [fetchQueueStatus]);

  // Fetch on mount only (no polling - queue status is complex data, fetch on-demand when popover opens)
  // FRC (Feb 2026): Removed 60s interval that contributed to R14 memory on Basic web dyno
  useEffect(() => {
    fetchQueueStatus();
  }, [fetchQueueStatus]);

  // Re-fetch when popover opens (for fresh detail data)
  useEffect(() => {
    if (isOpen) fetchQueueStatus();
  }, [isOpen, fetchQueueStatus]);

  const [systemDetailsOpen, setSystemDetailsOpen] = useState(false);

  const processEntries = data?.processes
    ? Object.entries(data.processes).sort(([a], [b]) =>
        a.localeCompare(b)
      )
    : [];

  const hasQueueDepth =
    data?.queueDepth && data.queueDepth.some((q) => q.count > 0);

  const hasBacklog = data?.backlog && data.backlog.some((b) => b.remaining > 0 || (b.bills_processed ?? 0) > 0);

  // Worker dead banner - portal to body so it renders above everything
  const showBanner = status === "error" && !bannerDismissed;
  const workerBanner = showBanner && typeof document !== "undefined"
    ? createPortal(
        <div
          role="alert"
          aria-live="assertive"
          className="fixed top-0 left-0 right-0 z-[60] px-4 py-2 flex items-center justify-between gap-3 text-sm font-medium bg-red-600 text-white dark:bg-red-900 dark:text-red-100 shadow-lg"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>
              Background processing offline &mdash; email sync, Xero sync, and scheduled jobs are paused
              {data?.watchdog?.status === "dead" && " (auto-restart in progress)"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchQueueStatus()}
              className="p-1 rounded hover:bg-white/20 transition-colors"
              aria-label="Refresh status"
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="p-1 rounded hover:bg-white/20 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
    {workerBanner}
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative p-1.5 rounded-md transition-colors",
            getStatusIconColor(status)
          )}
          title={data?.statusMessage || "Background Tasks: Loading..."}
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
            <h4 className="font-medium text-sm">Background Tasks</h4>
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
          <div className="max-h-[70vh] overflow-y-auto">
            {/* ── Sync Progress ── */}
            <div className="p-3 border-b border-border">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Sync Progress
              </p>
              {hasBacklog ? (
                <div className="space-y-2.5">
                  {data.backlog.filter((b) => b.remaining > 0 || (b.bills_processed ?? 0) > 0).map((item) => {
                    const Icon = BACKLOG_ICONS[item.key] || FileText;
                    const eta = formatEta(item.remaining, data.completedPerMin);
                    const hourly = getHourlyProgress(item.key);
                    const processedText = formatProcessed(hourly.processed);
                    const systemStuck = data.trend === "stuck";
                    const hasBills = (item.bills_processed ?? 0) > 0;
                    return (
                      <div key={item.key}>
                        <div className="flex justify-between text-xs items-center">
                          <span className="flex items-center gap-1.5 text-foreground">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            {item.label}
                          </span>
                          <span className="shrink-0 ml-2 text-muted-foreground tabular-nums">
                            {item.remaining > 0 ? `${(item.remaining).toLocaleString()} left` : hasBills ? "done" : "0 left"}
                          </span>
                        </div>
                        {hasBills && (
                          <div className="text-[10px] text-muted-foreground ml-5">
                            {(item.bills_processed!).toLocaleString()} bills (no PDF)
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                systemStuck
                                  ? "bg-orange-500 dark:bg-orange-400"
                                  : "bg-blue-500 dark:bg-blue-400 animate-pulse"
                              )}
                              style={{ width: systemStuck ? "100%" : "15%" }}
                            />
                          </div>
                          <span className="text-[10px] shrink-0 tabular-nums">
                            {systemStuck ? (
                              <span className="text-orange-500 dark:text-orange-400 flex items-center gap-0.5">
                                <CircleAlert className="h-3 w-3" /> stuck
                              </span>
                            ) : hourly.hasData && processedText ? (
                              <span className={hourly.processed < 0
                                ? "text-orange-500 dark:text-orange-400"
                                : "text-green-600 dark:text-green-400"
                              }>
                                {processedText}/hr
                              </span>
                            ) : eta ? (
                              <span className="text-muted-foreground">{eta}</span>
                            ) : null}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                  <Check className="h-3.5 w-3.5" />
                  All caught up
                </div>
              )}
            </div>

            {/* ── Xero Orgs ── */}
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
                              {(org.syncedCount ?? 0).toLocaleString()}/{(org.invoiceCount ?? 0).toLocaleString()}
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

            {/* ── Recent Issues ── */}
            {data.failed > 0 && data.topFailed.length > 0 && (
              <div className="p-3 border-b border-border">
                <p className="text-[10px] font-medium text-orange-500 dark:text-orange-400 uppercase tracking-wider mb-1.5">
                  Recent Issues ({data.failed})
                </p>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Auto-retried and cleared after 24h
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

            {/* ── System Details (collapsed by default) ── */}
            <div className="border-b border-border">
              <button
                onClick={() => setSystemDetailsOpen(!systemDetailsOpen)}
                className="w-full p-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <ChevronRight className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  systemDetailsOpen && "rotate-90"
                )} />
                <span className="font-medium">System Details</span>
              </button>

              {systemDetailsOpen && (
                <div className="border-t border-border">
                  {/* Execution summary */}
                  <div className="px-3 py-2 border-b border-border">
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

                  {/* Resources - All 5 apps shown separately */}
                  {(data.workerApps || data.dbConnections || data.memory || data.threadCapacity) && (
                    <div className="px-3 py-2 border-b border-border space-y-2.5">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        Apps
                      </p>

                      {data.workerApps && data.workerApps.length > 0 ? (
                        data.workerApps.map((app) => {
                          const hasThreads = app.threads && app.threads.total > 0;
                          const hasMem = app.memory && app.memory.live && app.memory.usedMb != null;
                          const memPct = hasMem ? (app.memory!.usedMb! / app.memory!.maxMb) : 0;
                          const memColor =
                            memPct > 0.8 ? "bg-red-500" : memPct > 0.6 ? "bg-orange-500" : "bg-green-500";

                          return (
                            <div
                              key={app.name}
                              className="py-1.5 border-b border-border/50 last:border-0"
                            >
                              {/* App header row */}
                              <div className="flex justify-between items-center text-xs">
                                <span className="flex items-center gap-1.5 font-medium">
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full shrink-0",
                                      app.running === true
                                        ? "bg-green-500"
                                        : app.running === false
                                          ? "bg-red-500"
                                          : "bg-muted-foreground"
                                    )}
                                  />
                                  {app.label}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  {app.dynoSize || ""}
                                  {app.running === false && (
                                    <span className="text-red-500 dark:text-red-400 ml-1">off</span>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleRestartApp(app.name, app.label); }}
                                    disabled={restartingApp === app.name}
                                    className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50"
                                    title={`Restart ${app.label}`}
                                  >
                                    <RotateCcw className={cn("h-3 w-3", restartingApp === app.name && "animate-spin")} />
                                  </button>
                                </span>
                              </div>

                              {/* Boot time (last restart) */}
                              {app.bootedAt && (
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  Booted {timeAgo(app.bootedAt)}
                                </div>
                              )}

                              {/* Threads + Memory bars (compact) */}
                              {(hasThreads || hasMem) && (
                                <div className="mt-1.5 space-y-1">
                                  {hasThreads && (
                                    <div className="flex items-center gap-2 text-[10px]">
                                      <span className="text-muted-foreground w-12 shrink-0">Threads</span>
                                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className={cn(
                                            "h-full rounded-full transition-all",
                                            !app.running
                                              ? "bg-red-500"
                                              : (app.threads!.used / app.threads!.total) > 0.8
                                                ? "bg-red-500"
                                                : (app.threads!.used / app.threads!.total) > 0.6
                                                  ? "bg-orange-500"
                                                  : "bg-green-500"
                                          )}
                                          style={{
                                            width: app.running
                                              ? `${Math.min((app.threads!.used / app.threads!.total) * 100, 100)}%`
                                              : "100%",
                                          }}
                                        />
                                      </div>
                                      <span className="tabular-nums w-8 text-right text-muted-foreground">
                                        {app.threads!.used}/{app.threads!.total}
                                      </span>
                                    </div>
                                  )}

                                  {hasMem && (
                                    <div className="flex items-center gap-2 text-[10px]">
                                      <span className="text-muted-foreground w-12 shrink-0">Memory</span>
                                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className={cn("h-full rounded-full transition-all", memColor)}
                                          style={{ width: `${Math.min(memPct * 100, 100)}%` }}
                                        />
                                      </div>
                                      <span className="tabular-nums w-8 text-right text-muted-foreground">
                                        {app.memory!.usedMb}
                                      </span>
                                    </div>
                                  )}

                                  {app.dbConnections != null && app.dbConnections > 0 && (
                                    <div className="flex items-center gap-2 text-[10px]">
                                      <span className="text-muted-foreground w-12 shrink-0">DB</span>
                                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                                        <div
                                          className="h-full rounded-full transition-all bg-blue-500"
                                          style={{ width: `${Math.min((app.dbConnections / (data?.dbConnections?.max || 500)) * 100, 100)}%` }}
                                        />
                                      </div>
                                      <span className="tabular-nums w-8 text-right text-muted-foreground">
                                        {app.dbConnections}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <>
                          {/* Fallback: combined view when workerApps not available */}
                          {data.threadCapacity && data.threadCapacity.total > 0 && (
                            <ResourceBar
                              label="Worker Threads"
                              used={data.threadCapacity.used}
                              max={data.threadCapacity.total}
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
                        </>
                      )}

                      {/* DB Connections total (shared database) */}
                      {data.dbConnections && (
                        <div className="pt-1.5 mt-1 border-t border-border/50">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-muted-foreground">DB Total</span>
                            <span className="tabular-nums text-muted-foreground">
                              {data.dbConnections.active}/{data.dbConnections.max}
                            </span>
                          </div>
                          <div className="mt-0.5 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                (data.dbConnections.active / data.dbConnections.max) > 0.8
                                  ? "bg-red-500"
                                  : (data.dbConnections.active / data.dbConnections.max) > 0.6
                                    ? "bg-orange-500"
                                    : "bg-green-500"
                              )}
                              style={{ width: `${Math.min((data.dbConnections.active / data.dbConnections.max) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Throughput sparkline */}
                  {data.throughputHistory && data.throughputHistory.length > 0 && (
                    <div className="px-3 py-2 border-b border-border">
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

                  {/* Processes */}
                  {processEntries.length > 0 && (
                    <div className="px-3 py-2 border-b border-border">
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
                    <div className="px-3 py-2 border-b border-border">
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
                    <div className="px-3 py-2 border-b border-border">
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
                </div>
              )}
            </div>
          </div>
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
    </>
  );
}
