"use client";

import { RefreshCw, WifiOff, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface StaleIndicatorProps {
  /**
   * Whether the data is stale (older than threshold).
   */
  isStale: boolean;

  /**
   * When the data was last fetched.
   */
  lastFetched: Date | null;

  /**
   * Whether the browser is offline.
   */
  isOffline: boolean;

  /**
   * Whether a refresh is in progress.
   */
  isRefreshing?: boolean;

  /**
   * Callback to trigger a refresh.
   */
  onRefresh?: () => void;

  /**
   * Additional className for the container.
   */
  className?: string;
}

/**
 * Indicator shown when email data is stale or offline.
 *
 * Shows different states:
 * - Offline: "You're offline - showing cached emails"
 * - Stale: "Last updated X minutes ago" with refresh button
 * - Refreshing: Spinner animation
 */
export function StaleIndicator({
  isStale,
  lastFetched,
  isOffline,
  isRefreshing = false,
  onRefresh,
  className,
}: StaleIndicatorProps) {
  // Don't show if data is fresh and online
  if (!isStale && !isOffline) return null;

  const formatTimeSince = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 120) return "1 minute ago";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 7200) return "1 hour ago";
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return "over a day ago";
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-1.5 text-xs rounded-md",
        isOffline
          ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
          : "bg-muted/50 text-muted-foreground",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        {isOffline ? (
          <>
            <WifiOff className="h-3.5 w-3.5" />
            <span>You&apos;re offline - showing cached emails</span>
          </>
        ) : (
          <>
            <Clock className="h-3.5 w-3.5" />
            <span>
              Last updated {lastFetched ? formatTimeSince(lastFetched) : "unknown"}
            </span>
          </>
        )}
      </div>

      {!isOffline && onRefresh && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={cn(
              "h-3 w-3 mr-1",
              isRefreshing && "animate-spin"
            )}
          />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      )}
    </div>
  );
}

export default StaleIndicator;
