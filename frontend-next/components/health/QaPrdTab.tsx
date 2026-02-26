"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Palette,
  Gauge,
  Database,
  LayoutList,
  Save,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StoryStatus = "pending" | "in_progress" | "completed";
type PageStatus = "passed" | "failed";

interface JsCheck {
  hasContent?: boolean;
  breadcrumb?: string | null;
  url?: string;
  scrollable?: boolean;
  consoleErrors?: number;
  bodyBg?: string;
}

interface PageResult {
  status: PageStatus;
  tested_at: string;
  iteration: number;
  js_check?: JsCheck;
  finding_id?: string;
}

interface QaUserStoryJson {
  id: string;
  title: string;
  icon: string;
  description: string;
  status: StoryStatus;
  page_manifest: string[];
  page_results: Record<string, PageResult>;
}

interface QaPrdJson {
  version: number;
  meta: {
    run_id: string | null;
    started_at: string | null;
    completed_at: string | null;
    last_updated: string | null;
    iteration: number;
    ship_ready: boolean;
    total_pages: number;
    total_stories: number;
  };
  protocol_reminder: string;
  user_stories: QaUserStoryJson[];
  findings: Array<{
    id: string;
    severity: string;
    category: string;
    page: string;
    description: string;
    status: string;
  }>;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  "layout-list": <LayoutList className="h-4 w-4" />,
  "clipboard-check": <ClipboardCheck className="h-4 w-4" />,
  "palette": <Palette className="h-4 w-4" />,
  "gauge": <Gauge className="h-4 w-4" />,
  "database": <Database className="h-4 w-4" />,
  "save": <Save className="h-4 w-4" />,
};

function getStoryStatusIcon(status: StoryStatus, passed: number, total: number) {
  if (status === "completed" || (passed === total && total > 0)) {
    return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />;
  }
  if (status === "in_progress") {
    return <Circle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 animate-pulse" />;
  }
  return <Circle className="h-5 w-5 text-muted-foreground/30" />;
}

function getStoryStatusBadge(status: StoryStatus) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">Done</Badge>;
    case "in_progress":
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-[10px]">Testing</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px]">Pending</Badge>;
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

export function QaPrdTab() {
  const [data, setData] = React.useState<QaPrdJson | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [expandedStories, setExpandedStories] = React.useState<Set<string>>(new Set());

  const fetchData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      try {
        const response = await fetch("/api/health/qa-prd");
        if (response.ok) {
          const json = await response.json();
          setData(json);
          setError(null);
          return;
        }
      } catch {
        // API not available, try static file
      }

      const response = await fetch("/qa-prd.json");
      if (response.ok) {
        const json = await response.json();
        setData(json);
        setError(null);
      } else {
        const docsResponse = await fetch("/api/health/qa-prd-file");
        if (docsResponse.ok) {
          const json = await docsResponse.json();
          setData(json);
          setError(null);
        } else {
          setError("Could not load QA PRD data");
        }
      }
    } catch {
      setError("Failed to fetch QA PRD data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  React.useEffect(() => {
    if (data && expandedStories.size === 0) {
      setExpandedStories(new Set(data.user_stories.map((s) => s.id)));
    }
  }, [data, expandedStories.size]);

  const toggleStory = (id: string) => {
    setExpandedStories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return <LoadingOverlay height="h-96" />;
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">{error || "No data available"}</p>
        <Button onClick={() => fetchData()}>Retry</Button>
      </div>
    );
  }

  // v3: Count pages across all stories
  let totalPages = 0;
  let passedPages = 0;
  let failedPages = 0;
  let untestedPages = 0;

  for (const story of data.user_stories) {
    const manifestCount = story.page_manifest?.length || 0;
    totalPages += manifestCount;
    const results = story.page_results || {};
    let storyPassed = 0;
    let storyFailed = 0;
    for (const path of story.page_manifest || []) {
      const result = results[path];
      if (result?.status === "passed") storyPassed++;
      else if (result?.status === "failed") storyFailed++;
    }
    passedPages += storyPassed;
    failedPages += storyFailed;
    untestedPages += manifestCount - storyPassed - storyFailed;
  }

  const completedStories = data.user_stories.filter((s) => s.status === "completed").length;
  const completionPercent = totalPages > 0 ? Math.round((passedPages / totalPages) * 100) : 0;
  const openFindings = data.findings?.filter((f) => f.status === "open").length || 0;

  return (
    <div className="space-y-6">
      {/* Meta Info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {data.meta.run_id ? `Run: ${data.meta.run_id} | ` : ""}
          Iteration: {data.meta.iteration}
          {data.meta.last_updated && ` | Updated: ${formatTimeAgo(data.meta.last_updated)}`}
          {data.meta.started_at && ` | Started: ${formatTimeAgo(data.meta.started_at)}`}
        </span>
        <div className="flex items-center gap-2">
          {data.meta.ship_ready && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Ship Ready</Badge>
          )}
          <Button variant="ghost" size="sm" onClick={() => fetchData(true)} disabled={refreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Pages</p>
            <p className="text-2xl font-bold font-mono">{totalPages}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Passed</p>
            <p className="text-2xl font-bold font-mono text-green-600 dark:text-green-400">{passedPages}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold font-mono text-red-600 dark:text-red-400">{failedPages}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Untested</p>
            <p className="text-2xl font-bold font-mono text-muted-foreground">{untestedPages}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Stories</p>
            <p className="text-2xl font-bold font-mono">{completedStories}/{data.user_stories.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Findings</p>
            <p className={cn("text-2xl font-bold font-mono", openFindings > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>{openFindings}</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Page Coverage</p>
            <p className="text-sm text-muted-foreground font-mono">{completionPercent}%</p>
          </div>
          <Progress value={completionPercent} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">
            {passedPages} of {totalPages} pages passed across {data.user_stories.length} stories
          </p>
        </CardContent>
      </Card>

      {/* User Stories */}
      <div className="space-y-3">
        {data.user_stories.map((story) => {
          const manifest = story.page_manifest || [];
          const results = story.page_results || {};
          const storyTotal = manifest.length;
          let storyPassed = 0;
          let storyFailed = 0;
          for (const path of manifest) {
            const r = results[path];
            if (r?.status === "passed") storyPassed++;
            else if (r?.status === "failed") storyFailed++;
          }
          const storyPercent = storyTotal > 0 ? Math.round((storyPassed / storyTotal) * 100) : 0;
          const isExpanded = expandedStories.has(story.id);

          return (
            <Card key={story.id}>
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleStory(story.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="p-1.5 rounded-md bg-muted shrink-0">
                  {ICON_MAP[story.icon] || <ClipboardCheck className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] shrink-0">{story.id}</Badge>
                    <p className="font-medium text-sm truncate">{story.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{story.description}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-mono">
                      <span className="text-green-600 dark:text-green-400">{storyPassed}</span>
                      {storyFailed > 0 && (
                        <span className="text-red-600 dark:text-red-400"> / {storyFailed} fail</span>
                      )}
                      <span className="text-muted-foreground"> / {storyTotal}</span>
                    </p>
                  </div>
                  <div className="w-16">
                    <Progress value={storyPercent} className="h-1.5" />
                  </div>
                  {getStoryStatusBadge(story.status)}
                  {getStoryStatusIcon(story.status, storyPassed, storyTotal)}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t">
                  <table className="w-full">
                    <tbody>
                      {manifest.map((path) => {
                        const result = results[path];
                        const status = result?.status;
                        const isPassed = status === "passed";
                        const isFailed = status === "failed";

                        return (
                          <tr
                            key={path}
                            className={cn(
                              "border-b last:border-b-0 hover:bg-muted/30 transition-colors",
                              isFailed && "bg-red-50/50 dark:bg-red-950/10"
                            )}
                          >
                            <td className="px-4 py-2.5 w-8">
                              {isPassed ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                              ) : isFailed ? (
                                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                              )}
                            </td>
                            <td className="px-2 py-2.5">
                              <p className={cn(
                                "text-sm font-mono",
                                isPassed && "text-muted-foreground",
                                !result && "text-foreground"
                              )}>
                                {path}
                              </p>
                              {result?.js_check?.breadcrumb && (
                                <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-lg">
                                  {result.js_check.breadcrumb}
                                </p>
                              )}
                              {isFailed && result?.finding_id && (
                                <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">
                                  {result.finding_id}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <div className="flex items-center gap-2 justify-end">
                                {result?.tested_at && (
                                  <span className="text-[10px] text-muted-foreground" title={new Date(result.tested_at).toLocaleString()}>
                                    {formatTimeAgo(result.tested_at)}
                                  </span>
                                )}
                                {result?.iteration && (
                                  <span className="text-[10px] text-muted-foreground font-mono">
                                    i{result.iteration}
                                  </span>
                                )}
                                {isPassed && (
                                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">Pass</Badge>
                                )}
                                {isFailed && (
                                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px]">Fail</Badge>
                                )}
                                {!result && (
                                  <Badge variant="secondary" className="text-[10px]">Untested</Badge>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Findings Summary */}
      {(data.findings?.length || 0) > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium mb-2">Findings ({data.findings.length})</p>
            <p className="text-xs text-muted-foreground">
              See the QA Findings tab for full details.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
