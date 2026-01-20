"use client";

import { useAtom, useAtomValue } from "jotai";
import { WifiOff, X, RefreshCw, Cloud, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isOnlineAtom,
  showOfflineBannerAtom,
  syncStatusMessageAtom,
  pendingSyncCountAtom,
  isSyncingAtom,
} from "@/lib/offline";

interface OfflineBannerProps {
  className?: string;
}

/**
 * Offline Mode Banner
 *
 * Displays a sticky banner when the app is offline.
 * Shows sync status and pending item count.
 */
export function OfflineBanner({ className }: OfflineBannerProps) {
  const isOnline = useAtomValue(isOnlineAtom);
  const [showBanner, setShowBanner] = useAtom(showOfflineBannerAtom);
  const statusMessage = useAtomValue(syncStatusMessageAtom);
  const pendingCount = useAtomValue(pendingSyncCountAtom);
  const isSyncing = useAtomValue(isSyncingAtom);

  // Don't show if online and no pending items
  if (isOnline && pendingCount === 0) {
    return null;
  }

  // Don't show if user dismissed and we're online
  if (!showBanner && isOnline) {
    return null;
  }

  // Always show when offline, regardless of dismiss state
  const shouldShow = !isOnline || (pendingCount > 0 && showBanner);
  if (!shouldShow) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 px-4 py-3",
        "flex items-center justify-between gap-3",
        "text-sm font-medium",
        isOnline
          ? "bg-amber-50 text-amber-900 border-t border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800"
          : "bg-slate-800 text-white border-t border-slate-700 dark:bg-slate-900",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {isOnline ? (
          isSyncing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Cloud className="h-4 w-4" />
          )
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
        <span>{statusMessage}</span>
      </div>

      <div className="flex items-center gap-2">
        {pendingCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-white/20 px-2 py-0.5 text-xs">
            {pendingCount} pending
          </span>
        )}

        {/* Only show dismiss button if online with pending items */}
        {isOnline && (
          <button
            onClick={() => setShowBanner(false)}
            className="p-1 rounded hover:bg-white/20 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Compact offline indicator for headers/toolbars.
 * Shows a small icon when offline.
 */
export function OfflineIndicator({ className }: { className?: string }) {
  const isOnline = useAtomValue(isOnlineAtom);
  const pendingCount = useAtomValue(pendingSyncCountAtom);
  const isSyncing = useAtomValue(isSyncingAtom);

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
        isOnline
          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 dark:bg-amber-900/50 dark:text-amber-300"
          : "bg-slate-700 text-white dark:bg-slate-800",
        className
      )}
      title={isOnline ? `${pendingCount} items pending sync` : "Offline"}
    >
      {isOnline ? (
        isSyncing ? (
          <RefreshCw className="h-3 w-3 animate-spin" />
        ) : (
          <Cloud className="h-3 w-3" />
        )
      ) : (
        <CloudOff className="h-3 w-3" />
      )}
      {!isOnline && <span>Offline</span>}
      {isOnline && pendingCount > 0 && <span>{pendingCount}</span>}
    </div>
  );
}

/**
 * Sync status component for settings or detailed views.
 */
export function SyncStatus({ className }: { className?: string }) {
  const isOnline = useAtomValue(isOnlineAtom);
  const statusMessage = useAtomValue(syncStatusMessageAtom);
  const pendingCount = useAtomValue(pendingSyncCountAtom);
  const isSyncing = useAtomValue(isSyncingAtom);

  return (
    <div className={cn("flex items-center gap-3 text-sm", className)}>
      <div
        className={cn(
          "flex items-center gap-2",
          isOnline ? "text-green-600 dark:text-green-400" : "text-slate-500"
        )}
      >
        {isOnline ? (
          isSyncing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Cloud className="h-4 w-4" />
          )
        ) : (
          <CloudOff className="h-4 w-4" />
        )}
        <span>{statusMessage}</span>
      </div>

      {pendingCount > 0 && (
        <span className="text-muted-foreground">
          ({pendingCount} item{pendingCount === 1 ? "" : "s"} waiting)
        </span>
      )}
    </div>
  );
}
