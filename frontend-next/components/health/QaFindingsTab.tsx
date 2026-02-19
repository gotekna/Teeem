"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  Ban,
  FileCode,
  Lightbulb,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Severity = "critical" | "major" | "minor" | "info";
type FindingStatus = "open" | "fixed" | "wont_fix" | "in_progress";
type FindingCategory =
  | "render-error"
  | "console-error"
  | "breadcrumb-missing"
  | "url-state-lost"
  | "scroll-blocked"
  | "dark-mode-broken"
  | "responsive-broken"
  | "modal-broken"
  | "performance"
  | "data-integrity";

interface QaFinding {
  id: string;
  severity: Severity;
  category: FindingCategory;
  user_story_id: string;
  page: string;
  description: string;
  console_errors?: string[];
  probable_file?: string;
  breadcrumb_expected?: string;
  breadcrumb_actual?: string | null;
  fix_hint?: string;
  status: FindingStatus;
  found_at: string;
  found_iteration?: number;
  snapshot_file?: string;
  screenshot_file?: string;
}

interface QaPrdJson {
  meta: {
    run_id: string | null;
    iteration: number;
  };
  findings: QaFinding[];
}

function getSeverityIcon(severity: Severity) {
  switch (severity) {
    case "critical":
      return <Ban className="h-4 w-4" />;
    case "major":
      return <AlertCircle className="h-4 w-4" />;
    case "minor":
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Info className="h-4 w-4" />;
  }
}

function getSeverityColor(severity: Severity) {
  switch (severity) {
    case "critical":
      return "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30";
    case "major":
      return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20";
    case "minor":
      return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20";
    default:
      return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20";
  }
}

function getCategoryBadge(category: FindingCategory) {
  const colors: Record<string, string> = {
    "render-error": "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
    "console-error": "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
    "breadcrumb-missing": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400",
    "url-state-lost": "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400",
    "scroll-blocked": "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    "dark-mode-broken": "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400",
    "responsive-broken": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400",
    "modal-broken": "bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400",
    "performance": "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    "data-integrity": "bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400",
  };
  return (
    <Badge variant="secondary" className={cn("text-[10px]", colors[category] || "")}>
      {category}
    </Badge>
  );
}

function getStatusBadge(status: FindingStatus) {
  switch (status) {
    case "fixed":
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">Fixed</Badge>;
    case "in_progress":
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-[10px]">In Progress</Badge>;
    case "wont_fix":
      return <Badge variant="secondary" className="text-[10px]">Won&apos;t Fix</Badge>;
    default:
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px]">Open</Badge>;
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

export function QaFindingsTab() {
  const [findings, setFindings] = React.useState<QaFinding[]>([]);
  const [meta, setMeta] = React.useState<QaPrdJson["meta"] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | Severity | "fixed">("all");
  const [refreshing, setRefreshing] = React.useState(false);
  const [expandedFinding, setExpandedFinding] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      let data: QaPrdJson | null = null;

      try {
        const response = await fetch("/qa-prd.json");
        if (response.ok) {
          data = await response.json();
        }
      } catch {
        // Static file not available
      }

      if (!data) {
        try {
          const response = await fetch("/api/health/qa-prd");
          if (response.ok) {
            data = await response.json();
          }
        } catch {
          // API not available
        }
      }

      if (data) {
        setFindings(data.findings || []);
        setMeta(data.meta);
        setError(null);
      } else {
        setFindings([]);
        setMeta(null);
      }
    } catch {
      setError("Failed to fetch findings data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <LoadingOverlay height="h-96" />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  const criticalCount = findings.filter((f) => f.severity === "critical" && f.status !== "fixed").length;
  const majorCount = findings.filter((f) => f.severity === "major" && f.status !== "fixed").length;
  const minorCount = findings.filter((f) => f.severity === "minor" && f.status !== "fixed").length;
  const fixedCount = findings.filter((f) => f.status === "fixed").length;
  const openFindings = findings.filter((f) => f.status === "open" || f.status === "in_progress");

  const filteredFindings = findings.filter((f) => {
    if (filter === "all") return f.status !== "fixed";
    if (filter === "fixed") return f.status === "fixed";
    return f.severity === filter && f.status !== "fixed";
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-bold font-mono">{openFindings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", criticalCount > 0 ? "bg-red-100 dark:bg-red-900/20" : "bg-green-100 dark:bg-green-900/20")}>
                {criticalCount > 0 ? (
                  <Ban className="h-5 w-5 text-red-600 dark:text-red-400" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold font-mono">{criticalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Major</p>
                <p className="text-2xl font-bold font-mono">{majorCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Minor</p>
                <p className="text-2xl font-bold font-mono">{minorCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fixed</p>
                <p className="text-2xl font-bold font-mono">{fixedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            All Open ({openFindings.length})
          </Button>
          <Button variant={filter === "critical" ? "default" : "outline"} size="sm" onClick={() => setFilter("critical")} className={filter === "critical" ? "" : "text-red-600 dark:text-red-400"}>
            Critical ({criticalCount})
          </Button>
          <Button variant={filter === "major" ? "default" : "outline"} size="sm" onClick={() => setFilter("major")}>
            Major ({majorCount})
          </Button>
          <Button variant={filter === "minor" ? "default" : "outline"} size="sm" onClick={() => setFilter("minor")}>
            Minor ({minorCount})
          </Button>
          <Button variant={filter === "fixed" ? "default" : "outline"} size="sm" onClick={() => setFilter("fixed")}>
            Fixed ({fixedCount})
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {meta?.run_id && (
            <p className="text-xs text-muted-foreground">
              Run: {meta.run_id} | Iteration: {meta.iteration}
            </p>
          )}
          <Button variant="ghost" size="sm" onClick={() => fetchData(true)} disabled={refreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-medium">
              {filter === "all" ? "No open findings!" : `No ${filter} findings`}
            </p>
            <p className="text-sm text-muted-foreground">
              {filter === "all"
                ? meta && meta.iteration > 0
                  ? `QA completed ${meta.iteration} iterations with zero issues found. Check the QA PRD tab for full page coverage.`
                  : "QA agents haven't found any issues yet. Run /rqar to start testing."
                : "No findings match this filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredFindings.map((finding) => {
            const isExpanded = expandedFinding === finding.id;

            return (
              <Card key={finding.id}>
                <div
                  className={cn(
                    "px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors",
                    finding.severity === "critical" && finding.status === "open" && "border-l-4 border-l-red-500"
                  )}
                  onClick={() => setExpandedFinding(isExpanded ? null : finding.id)}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="secondary"
                      className={cn("gap-1 text-xs shrink-0", getSeverityColor(finding.severity))}
                    >
                      {getSeverityIcon(finding.severity)}
                      {finding.severity}
                    </Badge>
                    {getCategoryBadge(finding.category)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" title={finding.description}>
                        {finding.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-muted-foreground">{finding.page}</span>
                      {getStatusBadge(finding.status)}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-3 space-y-3 border-t pt-3">
                      {/* Probable File */}
                      {finding.probable_file && (
                        <div className="flex items-start gap-2">
                          <FileCode className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Probable File</p>
                            <p className="text-sm font-mono">{finding.probable_file}</p>
                          </div>
                        </div>
                      )}

                      {/* Fix Hint */}
                      {finding.fix_hint && (
                        <div className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs text-muted-foreground">Fix Hint</p>
                            <p className="text-sm">{finding.fix_hint}</p>
                          </div>
                        </div>
                      )}

                      {/* Console Errors */}
                      {finding.console_errors && finding.console_errors.length > 0 && (
                        <div className="flex items-start gap-2">
                          <Terminal className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">Console Errors</p>
                            <div className="mt-1 space-y-1">
                              {finding.console_errors.map((err, i) => (
                                <p key={i} className="text-xs font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 rounded px-2 py-1 truncate" title={err}>
                                  {err}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Breadcrumb mismatch */}
                      {finding.breadcrumb_expected && (
                        <div className="flex items-start gap-2 text-xs">
                          <span className="text-muted-foreground shrink-0">Breadcrumb:</span>
                          <span className="text-green-600 dark:text-green-400">Expected: {finding.breadcrumb_expected}</span>
                          <span className="text-muted-foreground">|</span>
                          <span className="text-red-600 dark:text-red-400">
                            Actual: {finding.breadcrumb_actual || "null"}
                          </span>
                        </div>
                      )}

                      {/* Meta row */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Story: {finding.user_story_id}</span>
                        {finding.found_iteration && <span>Iteration: {finding.found_iteration}</span>}
                        {finding.found_at && (
                          <span title={new Date(finding.found_at).toLocaleString()}>
                            Found: {formatTimeAgo(finding.found_at)}
                          </span>
                        )}
                        {finding.snapshot_file && (
                          <span className="font-mono truncate max-w-xs" title={finding.snapshot_file}>
                            Snapshot: {finding.snapshot_file.split("/").pop()}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
