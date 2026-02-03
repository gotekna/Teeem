"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Pause,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Per-tenant status from backend (Feb 2026: Ultra Transparency)
export interface TenantSyncStatus {
  tenant_id: string;
  tenant_name: string;
  total: number;
  synced: number;
  pending: number;
  percentage: number;
  status: "syncing" | "complete" | "rate_limited" | "disconnected" | "degraded";
  reason: string;
  detail?: string;
  rate_limit_daily_pct?: number;
  lockout_remaining_secs?: number;
}

interface OrgSyncStatusProps {
  orgs: TenantSyncStatus[];
  className?: string;
}

// Status badge component
function StatusBadge({ status, reason }: { status: TenantSyncStatus["status"]; reason: string }) {
  switch (status) {
    case "complete":
      return (
        <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {reason}
        </Badge>
      );
    case "syncing":
      return (
        <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          Syncing
        </Badge>
      );
    case "rate_limited":
      return (
        <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
          <Pause className="h-3 w-3 mr-1" />
          {reason}
        </Badge>
      );
    case "degraded":
      return (
        <Badge className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {reason}
        </Badge>
      );
    case "disconnected":
      return (
        <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
          <XCircle className="h-3 w-3 mr-1" />
          {reason}
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          {reason}
        </Badge>
      );
  }
}

// Format lockout countdown
function formatLockoutTime(seconds: number): string {
  if (seconds <= 0) return "";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

export function OrgSyncStatus({ orgs, className }: OrgSyncStatusProps) {
  // Sort orgs: syncing first, then rate_limited, then complete
  const sortedOrgs = React.useMemo(() => {
    if (!orgs || orgs.length === 0) return [];
    const order: Record<string, number> = {
      syncing: 1,
      rate_limited: 2,
      degraded: 3,
      disconnected: 4,
      complete: 5,
    };
    return [...orgs].sort((a, b) => (order[a.status] || 99) - (order[b.status] || 99));
  }, [orgs]);

  // Summary counts
  const summary = React.useMemo(() => {
    if (!orgs || orgs.length === 0) return { syncing: 0, complete: 0, rateLimited: 0, needsAttention: 0 };
    const syncing = orgs.filter((o) => o.status === "syncing").length;
    const complete = orgs.filter((o) => o.status === "complete").length;
    const rateLimited = orgs.filter((o) => o.status === "rate_limited").length;
    const needsAttention = orgs.filter((o) => o.status === "disconnected" || o.status === "degraded").length;
    return { syncing, complete, rateLimited, needsAttention };
  }, [orgs]);

  if (!orgs || orgs.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with summary */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-muted-foreground">Per-Organization Status</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {summary.syncing > 0 && (
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3 text-blue-500 animate-spin" />
              {summary.syncing} syncing
            </span>
          )}
          {summary.rateLimited > 0 && (
            <span className="flex items-center gap-1">
              <Pause className="h-3 w-3 text-amber-500" />
              {summary.rateLimited} paused
            </span>
          )}
          {summary.complete > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              {summary.complete} done
            </span>
          )}
          {summary.needsAttention > 0 && (
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              {summary.needsAttention} need attention
            </span>
          )}
        </div>
      </div>

      {/* Org cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {sortedOrgs.map((org) => (
          <div
            key={org.tenant_id}
            className={cn(
              "p-3 border rounded-lg",
              org.status === "complete" && "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900",
              org.status === "syncing" && "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900",
              org.status === "rate_limited" && "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900",
              (org.status === "disconnected" || org.status === "degraded") && "bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
            )}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm truncate max-w-[180px]" title={org.tenant_name}>
                {org.tenant_name}
              </span>
              <StatusBadge status={org.status} reason={org.reason} />
            </div>

            {/* Progress row */}
            <div className="flex items-center gap-3">
              <Progress
                value={org.percentage}
                className={cn(
                  "h-2 flex-1",
                  org.status === "complete" && "[&>div]:bg-green-500",
                  org.status === "syncing" && "[&>div]:bg-blue-500",
                  org.status === "rate_limited" && "[&>div]:bg-amber-500",
                  (org.status === "disconnected" || org.status === "degraded") && "[&>div]:bg-red-500"
                )}
              />
              <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                {org.percentage}%
              </span>
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>
                {org.synced.toLocaleString()} / {org.total.toLocaleString()} PDFs
              </span>
              {org.pending > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {org.pending.toLocaleString()} pending
                </span>
              )}
            </div>

            {/* Detail/blocker info */}
            {org.status === "rate_limited" && (
              <div className="mt-2 pt-2 border-t border-amber-200 dark:border-amber-800 text-xs">
                <div className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                  <Clock className="h-3 w-3" />
                  {org.detail}
                  {org.lockout_remaining_secs && org.lockout_remaining_secs > 0 && (
                    <span className="font-medium ml-1">
                      ({formatLockoutTime(org.lockout_remaining_secs)})
                    </span>
                  )}
                </div>
                {org.rate_limit_daily_pct && org.rate_limit_daily_pct > 0 && (
                  <div className="mt-1 text-muted-foreground">
                    Daily usage: {org.rate_limit_daily_pct.toFixed(0)}%
                  </div>
                )}
              </div>
            )}

            {(org.status === "disconnected" || org.status === "degraded") && org.detail && (
              <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {org.detail}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
