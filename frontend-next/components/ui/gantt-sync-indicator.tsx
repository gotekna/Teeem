"use client";

import { cn } from "@/lib/utils";
import { Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useAtomValue } from "jotai";
import { isOnlineAtom } from "@/lib/offline";

interface GanttSyncIndicatorProps {
  /** When the data was last synced */
  lastSyncedAt: Date | null;
  /** Human-readable "X mins ago" display */
  lastSyncedDisplay: string;
  /** Whether the cached data is stale (old but usable) */
  isStale?: boolean;
  /** Whether data is being loaded */
  isLoading?: boolean;
  /** Whether data is from offline cache */
  isOfflineCached?: boolean;
  className?: string;
}

/**
 * Gantt Sync Indicator
 *
 * Shows sync status for Gantt data:
 * - Online with fresh data: green checkmark
 * - Online with stale data: yellow warning
 * - Offline with cached data: grey cloud-off
 * - Loading: spinning refresh
 */
export function GanttSyncIndicator({
  lastSyncedAt,
  lastSyncedDisplay,
  isStale = false,
  isLoading = false,
  isOfflineCached = false,
  className,
}: GanttSyncIndicatorProps) {
  const isOnline = useAtomValue(isOnlineAtom);

  // Determine status and styling
  let icon: React.ReactNode;
  let statusText: string;
  let statusClass: string;

  if (isLoading) {
    icon = <RefreshCw className="h-3.5 w-3.5 animate-spin" />;
    statusText = "Syncing...";
    statusClass = "text-blue-600 dark:text-blue-400";
  } else if (!isOnline) {
    icon = <CloudOff className="h-3.5 w-3.5" />;
    statusText = lastSyncedAt
      ? `Offline \u2022 ${lastSyncedDisplay}`
      : "Offline \u2022 No cached data";
    statusClass = "text-slate-500 dark:text-slate-400";
  } else if (isStale) {
    icon = <AlertCircle className="h-3.5 w-3.5" />;
    statusText = `Synced ${lastSyncedDisplay}`;
    statusClass = "text-amber-600 dark:text-amber-400";
  } else if (lastSyncedAt) {
    icon = <CheckCircle2 className="h-3.5 w-3.5" />;
    statusText = `Synced ${lastSyncedDisplay}`;
    statusClass = "text-green-600 dark:text-green-400";
  } else {
    icon = <Cloud className="h-3.5 w-3.5" />;
    statusText = "Online";
    statusClass = "text-slate-500 dark:text-slate-400";
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        statusClass,
        className
      )}
      title={
        lastSyncedAt
          ? `Last synced: ${lastSyncedAt.toLocaleString()}`
          : "Not yet synced"
      }
    >
      {icon}
      <span>{statusText}</span>
      {!isOnline && isOfflineCached && (
        <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide dark:bg-slate-700">
          Cached
        </span>
      )}
    </div>
  );
}

/**
 * Compact version for toolbars
 */
export function GanttSyncIndicatorCompact({
  lastSyncedAt,
  isStale = false,
  isLoading = false,
  className,
}: Omit<GanttSyncIndicatorProps, "lastSyncedDisplay">) {
  const isOnline = useAtomValue(isOnlineAtom);

  let icon: React.ReactNode;
  let statusClass: string;
  let title: string;

  if (isLoading) {
    icon = <RefreshCw className="h-4 w-4 animate-spin" />;
    statusClass = "text-blue-600 dark:text-blue-400";
    title = "Syncing...";
  } else if (!isOnline) {
    icon = <CloudOff className="h-4 w-4" />;
    statusClass = "text-slate-500 dark:text-slate-400";
    title = lastSyncedAt
      ? `Offline - Last synced ${lastSyncedAt.toLocaleString()}`
      : "Offline - No cached data";
  } else if (isStale) {
    icon = <AlertCircle className="h-4 w-4" />;
    statusClass = "text-amber-600 dark:text-amber-400";
    title = `Data may be stale - synced ${lastSyncedAt?.toLocaleString()}`;
  } else {
    icon = <Cloud className="h-4 w-4" />;
    statusClass = "text-green-600 dark:text-green-400";
    title = lastSyncedAt
      ? `Synced ${lastSyncedAt.toLocaleString()}`
      : "Online";
  }

  return (
    <div className={cn("inline-flex items-center", statusClass, className)} title={title}>
      {icon}
    </div>
  );
}
