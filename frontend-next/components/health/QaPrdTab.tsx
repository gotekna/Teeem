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
  FlaskConical,
  Palette,
  Gauge,
  Database,
  LayoutList,
  Save,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ItemStatus = "pending" | "passed" | "failed" | "in_progress";

interface QaCriteria {
  id: string;
  text: string;
  status: ItemStatus;
  verified_at: string | null;
  iteration_verified: number | null;
  evidence: string | null;
}

interface QaUserStoryJson {
  id: string;
  title: string;
  agent: string;
  icon: string;
  description: string;
  acceptance_criteria: QaCriteria[];
}

interface QaPrdJson {
  version: number;
  meta: {
    run_id: string | null;
    started_at: string | null;
    completed_at: string | null;
    iteration: number;
    ship_ready: boolean;
  };
  anti_cheat: {
    require_fresh_evidence: boolean;
    max_evidence_age_minutes: number;
    min_screenshots_per_iteration: number;
    rules: string[];
  };
  user_stories: QaUserStoryJson[];
  findings: Array<{
    id: string;
    severity: string;
    user_story_id: string;
    criteria_id: string;
    description: string;
    page: string;
    element: string;
    status: string;
    found_at: string;
  }>;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  "layout-list": <LayoutList className="h-4 w-4" />,
  "clipboard-check": <ClipboardCheck className="h-4 w-4" />,
  "flask-conical": <FlaskConical className="h-4 w-4" />,
  "palette": <Palette className="h-4 w-4" />,
  "gauge": <Gauge className="h-4 w-4" />,
  "database": <Database className="h-4 w-4" />,
  "save": <Save className="h-4 w-4" />,
};

function getStatusIcon(status: ItemStatus) {
  switch (status) {
    case "passed":
      return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />;
    case "failed":
      return <Circle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />;
    case "in_progress":
      return <Circle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 animate-pulse" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
  }
}

function getStatusBadge(status: ItemStatus) {
  switch (status) {
    case "passed":
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">Passed</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px]">Failed</Badge>;
    case "in_progress":
      return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-[10px]">In Progress</Badge>;
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
      // Try API first, fall back to static JSON
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

      // Fall back to static JSON file
      const response = await fetch("/qa-prd.json");
      if (response.ok) {
        const json = await response.json();
        setData(json);
        setError(null);
      } else {
        // Final fallback: load from TEEEM_DOCS via API
        const docsResponse = await fetch("/api/health/qa-prd-file");
        if (docsResponse.ok) {
          const json = await docsResponse.json();
          setData(json);
          setError(null);
        } else {
          setError("Could not load QA PRD data");
        }
      }
    } catch (err) {
      setError("Failed to fetch QA PRD data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Expand all stories on first load
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

  // Calculate summary stats from JSON data
  const allCriteria = data.user_stories.flatMap((s) => s.acceptance_criteria);
  const totalItems = allCriteria.length;
  const passedItems = allCriteria.filter((c) => c.status === "passed").length;
  const failedItems = allCriteria.filter((c) => c.status === "failed").length;
  const inProgressItems = allCriteria.filter((c) => c.status === "in_progress").length;
  const pendingItems = totalItems - passedItems - failedItems - inProgressItems;
  const completionPercent = totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Meta Info */}
      {data.meta.run_id && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Run: {data.meta.run_id} | Iteration: {data.meta.iteration}
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
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Checks</p>
            <p className="text-2xl font-bold font-mono">{totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Passed</p>
            <p className="text-2xl font-bold font-mono text-green-600 dark:text-green-400">{passedItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold font-mono text-red-600 dark:text-red-400">{failedItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold font-mono text-yellow-600 dark:text-yellow-400">{inProgressItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold font-mono text-muted-foreground">{pendingItems}</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">QA Completion</p>
            <p className="text-sm text-muted-foreground font-mono">{completionPercent}%</p>
          </div>
          <Progress value={completionPercent} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">
            {passedItems} of {totalItems} acceptance criteria passed across {data.user_stories.length} user stories
          </p>
        </CardContent>
      </Card>

      {/* User Stories */}
      <div className="space-y-3">
        {data.user_stories.map((story) => {
          const criteria = story.acceptance_criteria;
          const storyPassed = criteria.filter((c) => c.status === "passed").length;
          const storyFailed = criteria.filter((c) => c.status === "failed").length;
          const storyTotal = criteria.length;
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
                  <p className="text-xs text-muted-foreground truncate">{story.agent} — {story.description}</p>
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
                  {storyPassed === storyTotal && storyTotal > 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : storyFailed > 0 ? (
                    <Circle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/30" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t">
                  <table className="w-full">
                    <tbody>
                      {criteria.map((item) => (
                        <tr
                          key={item.id}
                          className={cn(
                            "border-b last:border-b-0 hover:bg-muted/30 transition-colors",
                            item.status === "failed" && "bg-red-50/50 dark:bg-red-950/10"
                          )}
                        >
                          <td className="px-4 py-2.5 w-8">
                            {getStatusIcon(item.status)}
                          </td>
                          <td className="px-2 py-2.5">
                            <p className={cn(
                              "text-sm",
                              item.status === "passed" && "text-muted-foreground line-through",
                              item.status === "pending" && "text-foreground"
                            )}>
                              {item.text}
                            </p>
                            {item.evidence && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-lg" title={item.evidence}>
                                {item.evidence}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            <div className="flex items-center gap-2 justify-end">
                              {item.verified_at && (
                                <span className="text-[10px] text-muted-foreground" title={new Date(item.verified_at).toLocaleString()}>
                                  {formatTimeAgo(item.verified_at)}
                                </span>
                              )}
                              {getStatusBadge(item.status)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Findings Summary */}
      {data.findings.length > 0 && (
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
