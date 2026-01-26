"use client";

import { useState, useEffect, useCallback, useMemo, ElementType } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PlayIcon,
} from "@heroicons/react/24/outline";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { useToast } from "@/components/ui/use-toast";
import {
  StatCard,
  ProgressRing,
  TrendChart,
  DonutChart,
  HorizontalBarChart,
  CostBreakdownTable,
} from "@/components/ui/gantt";

// ============================================
// Types
// ============================================

interface TabConfig {
  id: string;
  name: string;
  icon: ElementType;
}

interface TaskCounts {
  total: number;
  completed: number;
  in_progress: number;
  not_started: number;
  on_hold: number;
}

interface ScheduleHealth {
  overdue: number;
  due_this_week: number;
  health_score: number;
}

interface Progress {
  percentage: number;
  completed: number;
}

interface Timeline {
  days_remaining?: number;
}

interface ProjectSummary {
  task_counts: TaskCounts;
  schedule_health: ScheduleHealth;
  progress: Progress;
  timeline: Timeline;
}

interface TradeBreakdown {
  trade: string;
  progress: number;
}

interface DashboardData {
  project_summary: ProjectSummary;
  trade_breakdown: TradeBreakdown[];
}

interface UtilizationTotals {
  capacity: number;
  allocated: number;
  logged: number;
  utilization: number;
}

interface UtilizationAlert {
  severity: "warning" | "info" | "error";
  message: string;
  resource_name?: string;
}

interface Resource {
  id: number;
  name: string;
  type: string;
  capacity: number;
  allocated: number;
  logged: number;
  utilization: number;
  status: "over" | "high" | "optimal" | "low";
}

interface UtilizationData {
  totals: UtilizationTotals;
  alerts: UtilizationAlert[];
  resources: Resource[];
}

interface CostSummary {
  total_cost: number;
  budget?: number;
  variance?: number;
}

interface HoursSummary {
  total: number;
  overtime: number;
}

interface TopTask {
  task_name: string;
  hours: number;
  cost: number;
}

interface CostData {
  summary: CostSummary;
  hours_summary: HoursSummary;
  by_trade: Record<string, number>;
  top_tasks: TopTask[];
}

interface TrendWeek {
  week_label: string;
  hours_logged: number;
}

interface ForecastTask {
  name: string;
}

interface ForecastDay {
  date: string;
  day_name: string;
  is_weekend: boolean;
  tasks: ForecastTask[];
  tasks_starting: number;
  allocated_hours: number;
  resources_needed: number;
}

interface ForecastSummary {
  total_tasks_starting: number;
  total_allocated_hours: number;
  resources_involved: number;
}

interface ForecastData {
  summary: ForecastSummary;
  days: ForecastDay[];
}

interface DateRange {
  start: string;
  end: string;
}

// Tab definitions
const TABS: TabConfig[] = [
  { id: "overview", name: "Overview", icon: ChartBarIcon },
  { id: "utilization", name: "Utilization", icon: UserGroupIcon },
  { id: "costs", name: "Costs", icon: CurrencyDollarIcon },
  { id: "forecast", name: "Forecast", icon: CalendarDaysIcon },
];

// Alert component
interface AlertProps {
  type: "warning" | "info" | "error";
  message: string;
  resourceName?: string;
}

function Alert({ type, message, resourceName }: AlertProps) {
  const styles = {
    warning: "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300",
    info: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300",
    error: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300",
  };

  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${styles[type]}`}>
      {resourceName && <span className="font-medium">{resourceName}:</span>} {message}
    </div>
  );
}

export default function SmDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const constructionId = params.id as string;

  // URL is SSoT for tab state (path-based navigation)
  const activeTab = useMemo(() => {
    const basePath = `/jobs/${constructionId}/dashboard`;
    const parts = pathname.replace(basePath, "").split("/").filter(Boolean);
    return parts[0] || "overview";
  }, [pathname, constructionId]);

  // Redirect to default tab if no tab in URL
  useEffect(() => {
    if (!pathname.includes(`/jobs/${constructionId}/dashboard/`)) {
      router.replace(`/jobs/${constructionId}/dashboard/overview`, { scroll: false });
    }
  }, [pathname, router, constructionId]);

  const handleTabChange = useCallback((tabId: string) => {
    router.push(`/jobs/${constructionId}/dashboard/${tabId}`, { scroll: false });
  }, [constructionId, router]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [utilizationData, setUtilizationData] = useState<UtilizationData | null>(null);
  const [costData, setCostData] = useState<CostData | null>(null);
  const [trendsData, setTrendsData] = useState<TrendWeek[]>([]);
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);

  // Date range for reports
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  });

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get<DashboardData>("/api/v1/sm_reports/dashboard", {
        params: { construction_id: constructionId },
      });
      setDashboardData(res);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
  }, [constructionId]);

  // Fetch utilization data
  const fetchUtilization = useCallback(async () => {
    try {
      const res = await api.get<UtilizationData>("/api/v1/sm_reports/utilization", {
        params: {
          construction_id: constructionId,
          start_date: dateRange.start,
          end_date: dateRange.end,
        },
      });
      setUtilizationData(res);
    } catch (err) {
      console.error("Utilization fetch error:", err);
    }
  }, [constructionId, dateRange]);

  // Fetch cost data
  const fetchCosts = useCallback(async () => {
    try {
      const res = await api.get<CostData>("/api/v1/sm_reports/costs", {
        params: {
          construction_id: constructionId,
          start_date: dateRange.start,
          end_date: dateRange.end,
        },
      });
      setCostData(res);
    } catch (err) {
      console.error("Costs fetch error:", err);
    }
  }, [constructionId, dateRange]);

  // Fetch trends data
  const fetchTrends = useCallback(async () => {
    try {
      const res = await api.get<{ weeks: TrendWeek[] }>("/api/v1/sm_reports/trends", {
        params: { construction_id: constructionId, weeks: 8 },
      });
      setTrendsData(res.weeks || []);
    } catch (err) {
      console.error("Trends fetch error:", err);
    }
  }, [constructionId]);

  // Fetch forecast data
  const fetchForecast = useCallback(async () => {
    try {
      const res = await api.get<ForecastData>("/api/v1/sm_reports/forecast", {
        params: { construction_id: constructionId, days: 14 },
      });
      setForecastData(res);
    } catch (err) {
      console.error("Forecast fetch error:", err);
    }
  }, [constructionId]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([
          fetchDashboard(),
          fetchUtilization(),
          fetchCosts(),
          fetchTrends(),
          fetchForecast(),
        ]);
      } catch {
        setError("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchDashboard, fetchUtilization, fetchCosts, fetchTrends, fetchForecast]);

  // Export handler
  const handleExport = async (type: string) => {
    try {
      const token = getStorageItem<string | null>(STORAGE_KEYS.TOKEN, null, false);

      const params = new URLSearchParams({
        construction_id: constructionId,
        type,
        format: "csv",
        start_date: dateRange.start,
        end_date: dateRange.end,
      });

      const response = await fetch(`${getApiBaseUrl()}/api/v1/sm_reports/export?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sm_${type}_report.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      toast({ title: "Error", description: "Failed to export report", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  const projectSummary = dashboardData?.project_summary;
  const tradeBreakdown = dashboardData?.trade_breakdown || [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/30">
      {/* Fixed Header with Tabs */}
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChartBarIcon className="h-8 w-8 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-semibold">SM Gantt Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Project analytics and resource reports
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Date range picker */}
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
                className="w-36"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
                className="w-36"
              />
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => Promise.all([fetchUtilization(), fetchCosts()])}
              title="Refresh"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("utilization")}>
                  Utilization CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("costs")}>
                  Costs CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("trends")}>
                  Trends CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary bg-background text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none p-6">
        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            {error}
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === "overview" && projectSummary && (
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Tasks"
                value={projectSummary.task_counts.total}
                subtitle={`${projectSummary.task_counts.completed} completed`}
                icon={CalendarDaysIcon}
                color="blue"
              />
              <StatCard
                title="In Progress"
                value={projectSummary.task_counts.in_progress}
                icon={PlayIcon}
                color="amber"
              />
              <StatCard
                title="Overdue"
                value={projectSummary.schedule_health.overdue}
                subtitle={`${projectSummary.schedule_health.due_this_week} due this week`}
                icon={ExclamationTriangleIcon}
                color={projectSummary.schedule_health.overdue > 0 ? "red" : "green"}
              />
              <StatCard
                title="On Hold"
                value={projectSummary.task_counts.on_hold}
                icon={ClockIcon}
                color="indigo"
              />
            </div>

            {/* Progress and charts */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Progress ring */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Overall Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center">
                    <ProgressRing
                      value={projectSummary.progress.percentage}
                      size={160}
                      color={projectSummary.progress.percentage >= 80 ? "#22c55e" : "#3b82f6"}
                    />
                  </div>
                  <div className="mt-4 text-center text-sm text-muted-foreground">
                    {projectSummary.progress.completed} of {projectSummary.task_counts.total} tasks
                    completed
                  </div>
                </CardContent>
              </Card>

              {/* Task status donut */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Task Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <DonutChart
                    data={[
                      {
                        label: "Completed",
                        value: projectSummary.task_counts.completed,
                        color: "#22c55e",
                      },
                      {
                        label: "In Progress",
                        value: projectSummary.task_counts.in_progress,
                        color: "#3b82f6",
                      },
                      {
                        label: "Not Started",
                        value: projectSummary.task_counts.not_started,
                        color: "#9ca3af",
                      },
                    ]}
                    size={120}
                  />
                </CardContent>
              </Card>

              {/* Schedule health */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Schedule Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex justify-center">
                    <ProgressRing
                      value={projectSummary.schedule_health.health_score}
                      size={120}
                      color={
                        projectSummary.schedule_health.health_score >= 80
                          ? "#22c55e"
                          : projectSummary.schedule_health.health_score >= 50
                            ? "#f59e0b"
                            : "#ef4444"
                      }
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">Health Score</div>
                    {projectSummary.timeline.days_remaining && (
                      <div className="mt-2 text-sm">
                        {projectSummary.timeline.days_remaining} days remaining
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Trends and trades */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Weekly trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Weekly Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  {trendsData && trendsData.length > 0 ? (
                    <TrendChart
                      data={trendsData.map((w) => ({
                        label: w.week_label,
                        value: w.hours_logged,
                      }))}
                      height={200}
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center text-muted-foreground">
                      No trend data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Trade breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Progress by Trade</CardTitle>
                </CardHeader>
                <CardContent>
                  {tradeBreakdown.length > 0 ? (
                    <HorizontalBarChart
                      data={tradeBreakdown.slice(0, 6).map((t) => ({
                        label: t.trade,
                        value: t.progress,
                        color: t.progress >= 80 ? "green" : t.progress >= 50 ? "blue" : "gray",
                      }))}
                      maxValue={100}
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center text-muted-foreground">
                      No trade data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Utilization Tab */}
        {activeTab === "utilization" && utilizationData && (
          <div className="space-y-6">
            {/* Totals */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <StatCard
                title="Total Capacity"
                value={`${utilizationData.totals?.capacity || 0}h`}
                icon={ClockIcon}
                color="gray"
              />
              <StatCard
                title="Allocated"
                value={`${utilizationData.totals?.allocated || 0}h`}
                icon={UserGroupIcon}
                color="blue"
              />
              <StatCard
                title="Logged"
                value={`${utilizationData.totals?.logged || 0}h`}
                icon={CheckCircleIcon}
                color="green"
              />
              <StatCard
                title="Utilization"
                value={`${utilizationData.totals?.utilization || 0}%`}
                icon={ChartBarIcon}
                color={utilizationData.totals?.utilization > 80 ? "amber" : "blue"}
              />
            </div>

            {/* Alerts */}
            {utilizationData.alerts && utilizationData.alerts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Alerts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {utilizationData.alerts.map((alert, i) => (
                    <Alert
                      key={i}
                      type={alert.severity}
                      message={alert.message}
                      resourceName={alert.resource_name}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Resource list */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resource Utilization</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resource</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Capacity</TableHead>
                      <TableHead className="text-right">Allocated</TableHead>
                      <TableHead className="text-right">Logged</TableHead>
                      <TableHead className="text-right">Utilization</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(utilizationData.resources || []).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Link
                            href={`/admin/resources?resource=${r.id}`}
                            className="text-primary hover:underline"
                          >
                            {r.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.type}</TableCell>
                        <TableCell className="text-right">{r.capacity}h</TableCell>
                        <TableCell className="text-right">{r.allocated}h</TableCell>
                        <TableCell className="text-right">{r.logged}h</TableCell>
                        <TableCell className="text-right font-medium">{r.utilization}%</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="secondary"
                            className={
                              r.status === "over"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 dark:bg-red-950 dark:text-red-400"
                                : r.status === "high"
                                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 dark:bg-amber-950 dark:text-amber-400"
                                  : r.status === "optimal"
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-950 dark:text-green-400"
                                    : ""
                            }
                          >
                            {r.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Costs Tab */}
        {activeTab === "costs" && costData && (
          <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <StatCard
                title="Total Cost"
                value={`$${costData.summary?.total_cost?.toLocaleString() || 0}`}
                icon={CurrencyDollarIcon}
                color="blue"
              />
              {costData.summary?.budget && (
                <StatCard
                  title="Budget"
                  value={`$${costData.summary.budget.toLocaleString()}`}
                  icon={CurrencyDollarIcon}
                  color="gray"
                />
              )}
              {costData.summary?.variance !== undefined && costData.summary?.variance !== null && (
                <StatCard
                  title="Variance"
                  value={`$${Math.abs(costData.summary.variance).toLocaleString()}`}
                  subtitle={costData.summary.variance >= 0 ? "Under budget" : "Over budget"}
                  icon={CurrencyDollarIcon}
                  color={costData.summary.variance >= 0 ? "green" : "red"}
                />
              )}
              <StatCard
                title="Total Hours"
                value={`${costData.hours_summary?.total || 0}h`}
                subtitle={`${costData.hours_summary?.overtime || 0}h overtime`}
                icon={ClockIcon}
                color="indigo"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Cost by trade */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cost by Trade</CardTitle>
                </CardHeader>
                <CardContent>
                  {costData.by_trade && Object.keys(costData.by_trade).length > 0 ? (
                    <HorizontalBarChart
                      data={Object.entries(costData.by_trade)
                        .slice(0, 8)
                        .map(([trade, cost]) => ({
                          label: trade,
                          value: cost,
                        }))}
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center text-muted-foreground">
                      No cost data by trade
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top tasks by cost */}
              {costData.top_tasks && costData.top_tasks.length > 0 && (
                <CostBreakdownTable
                  title="Top Tasks by Cost"
                  data={costData.top_tasks.map((t) => ({
                    label: t.task_name,
                    hours: t.hours,
                    cost: t.cost,
                  }))}
                />
              )}
            </div>
          </div>
        )}

        {/* Forecast Tab */}
        {activeTab === "forecast" && forecastData && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <StatCard
                title="Tasks Starting"
                value={forecastData.summary?.total_tasks_starting || 0}
                subtitle="Next 14 days"
                icon={CalendarDaysIcon}
                color="blue"
              />
              <StatCard
                title="Hours Allocated"
                value={`${forecastData.summary?.total_allocated_hours || 0}h`}
                icon={ClockIcon}
                color="indigo"
              />
              <StatCard
                title="Resources Needed"
                value={forecastData.summary?.resources_involved || 0}
                icon={UserGroupIcon}
                color="green"
              />
            </div>

            {/* Day-by-day forecast */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Upcoming Schedule</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {(forecastData.days || []).map((day, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-4 py-3 ${
                        day.is_weekend ? "bg-muted/50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-20">
                          <div className="text-sm font-medium">{day.day_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(day.date).toLocaleDateString("en-AU", {
                              day: "numeric",
                              month: "short",
                            })}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {day.tasks.slice(0, 3).map((task, ti) => (
                            <Badge key={ti} variant="secondary">
                              {task.name}
                            </Badge>
                          ))}
                          {day.tasks.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{day.tasks.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-muted-foreground">Tasks:</span>{" "}
                          <span className="font-medium">{day.tasks_starting}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Hours:</span>{" "}
                          <span className="font-medium">{day.allocated_hours}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Resources:</span>{" "}
                          <span className="font-medium">{day.resources_needed}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
