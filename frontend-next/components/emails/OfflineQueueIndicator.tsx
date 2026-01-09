"use client";

import { Cloud, CloudOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface OfflineQueueIndicatorProps {
  /**
   * Number of pending offline actions.
   */
  count: number;

  /**
   * Whether actions are currently being processed.
   */
  isProcessing?: boolean;

  /**
   * Whether currently offline.
   */
  isOffline?: boolean;

  /**
   * Additional className.
   */
  className?: string;
}

/**
 * Shows pending offline actions count and sync status.
 *
 * Displays:
 * - Number of pending changes
 * - Processing indicator
 * - Offline status
 */
export function OfflineQueueIndicator({
  count,
  isProcessing = false,
  isOffline = false,
  className,
}: OfflineQueueIndicatorProps) {
  // Don't show if nothing pending and online
  if (count === 0 && !isOffline && !isProcessing) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-xs",
              isOffline
                ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                : isProcessing
                ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400"
                : "bg-muted text-muted-foreground",
              className
            )}
          >
            {isProcessing ? (
              <Spinner size={12} />
            ) : isOffline ? (
              <CloudOff className="h-3 w-3" />
            ) : (
              <Cloud className="h-3 w-3" />
            )}

            {count > 0 && (
              <Badge
                variant="secondary"
                className={cn(
                  "h-4 min-w-[16px] px-1 text-[10px]",
                  isOffline && "bg-amber-200 dark:bg-amber-900"
                )}
              >
                {count}
              </Badge>
            )}

            <span className="hidden sm:inline">
              {isProcessing
                ? "Syncing..."
                : isOffline
                ? "Offline"
                : count > 0
                ? `${count} pending`
                : ""}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {isProcessing ? (
            <p>Syncing changes to server...</p>
          ) : isOffline ? (
            <p>
              You&apos;re offline.
              {count > 0 && ` ${count} change${count > 1 ? "s" : ""} will sync when back online.`}
            </p>
          ) : count > 0 ? (
            <p>{count} change{count > 1 ? "s" : ""} pending sync</p>
          ) : (
            <p>All changes synced</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default OfflineQueueIndicator;
