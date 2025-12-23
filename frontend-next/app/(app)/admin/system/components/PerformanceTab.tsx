"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  RefreshCw,
  Activity,
  Database,
  Globe,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Zap,
  Eye,
  MousePointer,
  Move,
  Timer,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// Types matching the Performance Observatory API
interface PerformanceOverview {
  total_requests: number;
  avg_response_time: number | null;
  p50_response_time: number | null;
  p95_response_time: number | null;
  p99_response_time: number | null;
  error_rate: number;
  error_count: number;
  requests_per_minute: number;
}

interface WebVital {
  metric_name: string;
  count: number;
  avg_value: number;
  p75_value: number;
  good_count: number;
  needs_improvement_count: number;
  poor_count: number;
  good_percent: number;
  needs_improvement_percent: number;
  poor_percent: number;
}

interface TopEndpoint {
  endpoint: string;
  request_count: number;
  avg_duration: number;
  p95: number;
}

interface SlowQuerySummary {
  table_name: string;
  query_count: number;
  avg_duration: number;
}

interface TrendPoint {
  hour: string;
  request_count: number;
  avg_duration: number;
  error_count: number;
}

interface PerformanceData {
  success: boolean;
  data: {
    overview: PerformanceOverview;
    web_vitals: WebVital[];
    top_endpoints: TopEndpoint[];
    slow_queries: SlowQuerySummary[];
    trends: TrendPoint[];
  };
  period: {
    since: string;
    until: string;
  };
}

const PERIOD_OPTIONS = [
  { value: "1h", label: "Last 1 hour" },
  { value: "6h", label: "Last 6 hours" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

const VITAL_CONFIG: Record<string, { icon: React.ElementType; label: string; unit: string; goodThreshold: number; poorThreshold: number }> = {
  LCP: { icon: Eye, label: "Largest Contentful Paint", unit: "ms", goodThreshold: 2500, poorThreshold: 4000 },
  CLS: { icon: Move, label: "Cumulative Layout Shift", unit: "", goodThreshold: 0.1, poorThreshold: 0.25 },
  INP: { icon: MousePointer, label: "Interaction to Next Paint", unit: "ms", goodThreshold: 200, poorThreshold: 500 },
  TTFB: { icon: Timer, label: "Time to First Byte", unit: "ms", goodThreshold: 800, poorThreshold: 1800 },
  FID: { icon: MousePointer, label: "First Input Delay", unit: "ms", goodThreshold: 100, poorThreshold: 300 },
};

export function PerformanceTab() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [period, setPeriod] = React.useState("24h");
  const [data, setData] = React.useState<PerformanceData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadPerformanceData();
  }, [period]);

  const loadPerformanceData = async () => {
    try {
      setError(null);
      const response = await api.get<PerformanceData>(`/api/v1/performance?period=${period}`);
      setData(response);
    } catch (err) {
      console.error("Failed to load performance data:", err);
      setError("Failed to load performance data. The Performance Observatory may not be deployed yet.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPerformanceData();
    setRefreshing(false);
    toast({ title: "Refreshed", description: "Performance data updated" });
  };

  const getResponseTimeStatus = (ms: number | null): "good" | "warning" | "critical" => {
    if (ms === null) return "good";
    if (ms < 200) return "good";
    if (ms < 500) return "warning";
    return "critical";
  };

  const getStatusColor = (status: "good" | "warning" | "critical") => {
    switch (status) {
      case "good":
        return "text-green-600 dark:text-green-400";
      case "warning":
        return "text-yellow-600 dark:text-yellow-400";
      case "critical":
        return "text-red-600 dark:text-red-400";
    }
  };

  const formatDuration = (ms: number | null): string => {
    if (ms === null) return "—";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getVitalRating = (vital: WebVital): "good" | "needs-improvement" | "poor" => {
    if (vital.good_percent >= 75) return "good";
    if (vital.poor_percent >= 25) return "poor";
    return "needs-improvement";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Performance Observatory</h2>
            <p className="text-sm text-muted-foreground">
              Real-time application performance monitoring
            </p>
          </div>
        </div>
        <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Performance data not available</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">{error}</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                  Run the migration and deploy to start collecting performance data:
                </p>
                <code className="block mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded text-xs font-mono">
                  heroku run rails db:migrate --app teeemlive
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const overview = data?.data.overview;
  const webVitals = data?.data.web_vitals || [];
  const topEndpoints = data?.data.top_endpoints || [];
  const slowQueries = data?.data.slow_queries || [];
  const trends = data?.data.trends || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Performance Observatory</h2>
          <p className="text-sm text-muted-foreground">
            Real-time application performance monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Total Requests</span>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold">
                {overview.total_requests.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {overview.requests_per_minute.toFixed(1)} req/min
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Avg Response Time</span>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className={cn("text-2xl font-bold", getStatusColor(getResponseTimeStatus(overview.avg_response_time)))}>
                {formatDuration(overview.avg_response_time)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                P95: {formatDuration(overview.p95_response_time)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">P99 Latency</span>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className={cn("text-2xl font-bold", getStatusColor(getResponseTimeStatus(overview.p99_response_time)))}>
                {formatDuration(overview.p99_response_time)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                P50: {formatDuration(overview.p50_response_time)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Error Rate</span>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className={cn(
                "text-2xl font-bold",
                overview.error_rate === 0 ? "text-green-600" : overview.error_rate < 1 ? "text-yellow-600" : "text-red-600"
              )}>
                {overview.error_rate.toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {overview.error_count} errors
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Web Vitals */}
      {webVitals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              Core Web Vitals
            </CardTitle>
            <CardDescription>
              Frontend performance metrics from real user sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {webVitals.map((vital) => {
                const config = VITAL_CONFIG[vital.metric_name];
                if (!config) return null;
                const Icon = config.icon;
                const rating = getVitalRating(vital);

                return (
                  <div
                    key={vital.metric_name}
                    className={cn(
                      "p-4 rounded-lg border",
                      rating === "good" && "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20",
                      rating === "needs-improvement" && "border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20",
                      rating === "poor" && "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4" />
                      <span className="font-medium">{vital.metric_name}</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ml-auto text-xs",
                          rating === "good" && "bg-green-100 text-green-800",
                          rating === "needs-improvement" && "bg-yellow-100 text-yellow-800",
                          rating === "poor" && "bg-red-100 text-red-800"
                        )}
                      >
                        {rating === "good" ? "Good" : rating === "needs-improvement" ? "Needs Work" : "Poor"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{config.label}</p>
                    <div className="text-xl font-bold">
                      {vital.metric_name === "CLS"
                        ? vital.p75_value.toFixed(3)
                        : `${Math.round(vital.p75_value)}${config.unit}`}
                    </div>
                    <p className="text-xs text-muted-foreground">P75 ({vital.count} samples)</p>

                    {/* Distribution bar */}
                    <div className="mt-3 h-2 rounded-full overflow-hidden flex bg-gray-200 dark:bg-gray-700">
                      <div
                        className="bg-green-500"
                        style={{ width: `${vital.good_percent}%` }}
                      />
                      <div
                        className="bg-yellow-500"
                        style={{ width: `${vital.needs_improvement_percent}%` }}
                      />
                      <div
                        className="bg-red-500"
                        style={{ width: `${vital.poor_percent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{vital.good_percent.toFixed(0)}% good</span>
                      <span>{vital.poor_percent.toFixed(0)}% poor</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Web Vitals message */}
      {webVitals.length === 0 && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">No Web Vitals data yet</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Web Vitals (LCP, CLS, INP, TTFB) will appear here once users start browsing the app.
                  The frontend automatically reports these metrics.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Endpoints by P95 */}
      {topEndpoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-5 w-5 text-muted-foreground" />
              Slowest Endpoints (by P95)
            </CardTitle>
            <CardDescription>
              API endpoints with highest 95th percentile response times
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Avg</TableHead>
                  <TableHead className="text-right">P95</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topEndpoints.map((endpoint, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-sm">{endpoint.endpoint}</TableCell>
                    <TableCell className="text-right">{endpoint.request_count.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn("font-medium", getStatusColor(getResponseTimeStatus(endpoint.avg_duration)))}>
                        {formatDuration(endpoint.avg_duration)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={cn("font-medium", getStatusColor(getResponseTimeStatus(endpoint.p95)))}>
                        {formatDuration(endpoint.p95)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Slow Queries */}
      {slowQueries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              Tables with Slow Queries
            </CardTitle>
            <CardDescription>
              Database tables with queries exceeding 100ms threshold
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Table</TableHead>
                  <TableHead className="text-right">Slow Queries</TableHead>
                  <TableHead className="text-right">Avg Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slowQueries.map((query, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-sm">{query.table_name}</TableCell>
                    <TableCell className="text-right">{query.query_count}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-red-600 dark:text-red-400 font-medium">
                        {formatDuration(query.avg_duration)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Hourly Trends */}
      {trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              Request Trends
            </CardTitle>
            <CardDescription>
              Hourly request volume and response times
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trends.slice(-12).map((trend, index) => {
                const maxRequests = Math.max(...trends.map(t => t.request_count));
                const percentage = maxRequests > 0 ? (trend.request_count / maxRequests) * 100 : 0;
                const hour = new Date(trend.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16">{hour}</span>
                    <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded transition-all",
                          trend.error_count > 0 ? "bg-red-500" : "bg-blue-500"
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {trend.request_count} req
                    </span>
                    <span className={cn(
                      "text-xs w-16 text-right font-medium",
                      getStatusColor(getResponseTimeStatus(trend.avg_duration))
                    )}>
                      {formatDuration(trend.avg_duration)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No data message */}
      {overview?.total_requests === 0 && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">No performance data collected yet</p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Performance data will appear here as users make requests to the application.
                  Data is sampled at 10% in production for minimal overhead.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Tips */}
      <Card className="bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Performance Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 mt-0.5 text-green-500 flex-shrink-0" />
            <p>
              <strong>Good:</strong> API P95 &lt; 200ms, Web Vitals all green, Error rate &lt; 0.1%
            </p>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-500 flex-shrink-0" />
            <p>
              <strong>Investigate:</strong> P95 &gt; 500ms suggests N+1 queries or missing indexes
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Database className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
            <p>
              <strong>Slow Queries:</strong> Queries &gt; 100ms are captured automatically. Check for missing indexes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
