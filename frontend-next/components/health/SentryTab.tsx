"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  RefreshCw,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Info,
  Ban,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  count: number;
  user_count: number;
  level: string;
  status: string;
  first_seen: string;
  last_seen: string;
  permalink: string;
  short_id: string;
  metadata: {
    type: string | null;
    value: string | null;
  };
}

interface SentryData {
  issues: SentryIssue[];
  total_issues: number;
  total_events: number;
  critical_count: number;
}

interface SentryApiResponse {
  success: boolean;
  data: SentryData;
  cached?: boolean;
  error?: string;
}

function getLevelIcon(level: string) {
  switch (level) {
    case "fatal":
      return <Ban className="h-4 w-4" />;
    case "error":
      return <AlertCircle className="h-4 w-4" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
}

function getLevelColor(level: string) {
  switch (level) {
    case "fatal":
      return "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30";
    case "error":
      return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20";
    case "warning":
      return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20";
    default:
      return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20";
  }
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function SentryTab() {
  const [data, setData] = React.useState<SentryData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resolvingId, setResolvingId] = React.useState<string | null>(null);

  const fetchIssues = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);

    try {
      const response = await api.get<SentryApiResponse>(
        `/api/v1/sentry/issues${isRefresh ? "?refresh=true" : ""}`
      );
      if (response?.success) {
        setData(response.data);
      } else {
        setError(response?.error || "Failed to load Sentry issues");
      }
    } catch (err) {
      setError("Failed to connect to Sentry API");
      console.error("Sentry fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const handleResolve = async (issueId: string) => {
    setResolvingId(issueId);
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/sentry/issues/${issueId}/resolve`
      );
      if (response?.success) {
        // Remove from list optimistically
        setData((prev) =>
          prev
            ? {
                ...prev,
                issues: prev.issues.filter((i) => i.id !== issueId),
                total_issues: prev.total_issues - 1,
                critical_count: prev.critical_count - (prev.issues.find((i) => i.id === issueId)?.level === "error" || prev.issues.find((i) => i.id === issueId)?.level === "fatal" ? 1 : 0),
              }
            : null
        );
      }
    } catch (err) {
      console.error("Failed to resolve issue:", err);
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return <LoadingOverlay height="h-96" />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => fetchIssues()}>Retry</Button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unresolved Issues</p>
                <p className="text-2xl font-bold font-mono">{data.total_issues}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Events (14d)</p>
                <p className="text-2xl font-bold font-mono">{data.total_events.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", data.critical_count > 0 ? "bg-red-100 dark:bg-red-900/20" : "bg-green-100 dark:bg-green-900/20")}>
                {data.critical_count > 0 ? (
                  <Ban className="h-5 w-5 text-red-600 dark:text-red-400" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Errors / Fatal</p>
                <p className="text-2xl font-bold font-mono">{data.critical_count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refresh Bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.issues.length} unresolved issue{data.issues.length !== 1 ? "s" : ""} sorted by frequency
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchIssues(true)}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Issues Table */}
      {data.issues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-medium">All clear!</p>
            <p className="text-sm text-muted-foreground">No unresolved Sentry issues</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Level</th>
                  <th className="px-4 py-3 font-medium">Issue</th>
                  <th className="px-4 py-3 font-medium text-right">Events</th>
                  <th className="px-4 py-3 font-medium text-right">Users</th>
                  <th className="px-4 py-3 font-medium">First Seen</th>
                  <th className="px-4 py-3 font-medium">Last Seen</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.issues.map((issue) => (
                  <tr
                    key={issue.id}
                    className="border-b last:border-b-0 hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className={cn("gap-1 text-xs", getLevelColor(issue.level))}
                      >
                        {getLevelIcon(issue.level)}
                        {issue.level}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-md">
                        <p className="font-medium text-sm truncate" title={issue.title}>
                          {issue.short_id}: {issue.title}
                        </p>
                        {issue.culprit && (
                          <p className="text-xs text-muted-foreground truncate" title={issue.culprit}>
                            {issue.culprit}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-sm">{issue.count.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-sm">{issue.user_count}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground" title={new Date(issue.first_seen).toLocaleString()}>
                        {formatTimeAgo(issue.first_seen)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground" title={new Date(issue.last_seen).toLocaleString()}>
                        {formatTimeAgo(issue.last_seen)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleResolve(issue.id)}
                          disabled={resolvingId === issue.id}
                        >
                          {resolvingId === issue.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3 w-3" />
                          )}
                          <span className="ml-1">Resolve</span>
                        </Button>
                        <a
                          href={issue.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
