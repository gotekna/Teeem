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
  ExternalLink,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type Severity = "critical" | "major" | "minor" | "info";
type FindingStatus = "open" | "fixed" | "wont_fix" | "in_progress";

interface QaFinding {
  id: string;
  severity: Severity;
  agent: string;
  page: string;
  element: string;
  description: string;
  status: FindingStatus;
  found_at: string;
  fixed_at?: string;
  screenshot?: string;
}

interface QaFindingsData {
  findings: QaFinding[];
  run_id: string;
  last_run: string;
  total_findings: number;
  critical_count: number;
  major_count: number;
  minor_count: number;
  info_count: number;
  fixed_count: number;
}

interface QaFindingsApiResponse {
  success: boolean;
  data: QaFindingsData;
  error?: string;
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

function getAgentBadge(agent: string) {
  const colors: Record<string, string> = {
    "QA": "border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400",
    "UX": "border-purple-300 text-purple-600 dark:border-purple-700 dark:text-purple-400",
    "Design": "border-pink-300 text-pink-600 dark:border-pink-700 dark:text-pink-400",
    "Performance": "border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400",
    "Data": "border-green-300 text-green-600 dark:border-green-700 dark:text-green-400",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", colors[agent] || "")}>
      {agent}
    </Badge>
  );
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

// Static findings data — updated by QA Ralph loop runs
// When the Ralph loop finds issues, they get added here
const STATIC_FINDINGS: QaFindingsData = {
  run_id: "qa-run-2026-02-18-001",
  last_run: new Date().toISOString(),
  total_findings: 0,
  critical_count: 0,
  major_count: 0,
  minor_count: 0,
  info_count: 0,
  fixed_count: 0,
  findings: [],
};

export function QaFindingsTab() {
  const [data, setData] = React.useState<QaFindingsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | Severity | "fixed">("all");

  React.useEffect(() => {
    // Try API first, fall back to static data
    const fetchFindings = async () => {
      try {
        const response = await api.get<QaFindingsApiResponse>("/api/v1/health/qa-findings");
        if (response?.success) {
          setData(response.data);
        } else {
          // Use static data as fallback
          setData(STATIC_FINDINGS);
        }
      } catch {
        // API not available yet — use static data
        setData(STATIC_FINDINGS);
      } finally {
        setLoading(false);
      }
    };
    fetchFindings();
  }, []);

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

  if (!data) return null;

  const openFindings = data.findings.filter((f) => f.status === "open" || f.status === "in_progress");
  const filteredFindings = data.findings.filter((f) => {
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
                <p className="text-sm text-muted-foreground">Open Findings</p>
                <p className="text-2xl font-bold font-mono">{openFindings.length}</p>
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
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold font-mono">{data.critical_count}</p>
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
                <p className="text-2xl font-bold font-mono">{data.major_count}</p>
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
                <p className="text-2xl font-bold font-mono">{data.minor_count}</p>
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
                <p className="text-2xl font-bold font-mono">{data.fixed_count}</p>
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
            Critical ({data.critical_count})
          </Button>
          <Button variant={filter === "major" ? "default" : "outline"} size="sm" onClick={() => setFilter("major")}>
            Major ({data.major_count})
          </Button>
          <Button variant={filter === "minor" ? "default" : "outline"} size="sm" onClick={() => setFilter("minor")}>
            Minor ({data.minor_count})
          </Button>
          <Button variant={filter === "fixed" ? "default" : "outline"} size="sm" onClick={() => setFilter("fixed")}>
            Fixed ({data.fixed_count})
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Run: {data.run_id} • Last: {formatTimeAgo(data.last_run)}
        </p>
      </div>

      {/* Findings Table */}
      {filteredFindings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-medium">
              {filter === "all" ? "No open findings!" : `No ${filter} findings`}
            </p>
            <p className="text-sm text-muted-foreground">
              {filter === "all"
                ? "QA agents haven't found any issues yet. Run the Ralph loop to start testing."
                : "No findings match this filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Severity</th>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Finding</th>
                  <th className="px-4 py-3 font-medium">Page</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Found</th>
                </tr>
              </thead>
              <tbody>
                {filteredFindings.map((finding) => (
                  <tr
                    key={finding.id}
                    className="border-b last:border-b-0 hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className={cn("gap-1 text-xs", getSeverityColor(finding.severity))}
                      >
                        {getSeverityIcon(finding.severity)}
                        {finding.severity}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {getAgentBadge(finding.agent)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-md">
                        <p className="font-medium text-sm truncate" title={finding.description}>
                          {finding.description}
                        </p>
                        {finding.element && (
                          <p className="text-xs text-muted-foreground truncate" title={finding.element}>
                            Element: {finding.element}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-muted-foreground">{finding.page}</span>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(finding.status)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground" title={new Date(finding.found_at).toLocaleString()}>
                        {formatTimeAgo(finding.found_at)}
                      </span>
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
