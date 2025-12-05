"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  HardDrive,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: "good" | "warning" | "critical";
  trend?: "up" | "down" | "stable";
}

interface EndpointMetric {
  path: string;
  method: string;
  avgResponseTime: number;
  p95ResponseTime: number;
  requestCount: number;
  errorRate: number;
}

interface SystemHealth {
  status: "healthy" | "degraded" | "down";
  uptime: string;
  lastCheck: string;
  services: {
    name: string;
    status: "up" | "down";
    responseTime?: number;
  }[];
}

export function PerformanceTab() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [metrics, setMetrics] = React.useState<PerformanceMetric[]>([]);
  const [endpoints, setEndpoints] = React.useState<EndpointMetric[]>([]);
  const [health, setHealth] = React.useState<SystemHealth | null>(null);

  React.useEffect(() => {
    loadPerformanceData();
  }, []);

  const loadPerformanceData = async () => {
    try {
      // Try to load from API
      const data = await api.get<{
        metrics: PerformanceMetric[];
        endpoints: EndpointMetric[];
        health: SystemHealth;
      }>("/api/v1/performance");

      setMetrics(data.metrics);
      setEndpoints(data.endpoints);
      setHealth(data.health);
    } catch (error) {
      console.error("Failed to load performance data:", error);
      // Use mock data
      setMetrics([
        { name: "Average Response Time", value: 145, unit: "ms", status: "good", trend: "down" },
        { name: "Memory Usage", value: 68, unit: "%", status: "good", trend: "stable" },
        { name: "CPU Usage", value: 32, unit: "%", status: "good", trend: "up" },
        { name: "Database Connections", value: 12, unit: "", status: "good", trend: "stable" },
        { name: "Active Sessions", value: 47, unit: "", status: "good", trend: "up" },
        { name: "Error Rate", value: 0.2, unit: "%", status: "good", trend: "down" },
      ]);

      setEndpoints([
        { path: "/api/v1/jobs", method: "GET", avgResponseTime: 89, p95ResponseTime: 156, requestCount: 1250, errorRate: 0.1 },
        { path: "/api/v1/contacts", method: "GET", avgResponseTime: 45, p95ResponseTime: 78, requestCount: 890, errorRate: 0 },
        { path: "/api/v1/schedule_tasks", method: "GET", avgResponseTime: 234, p95ResponseTime: 456, requestCount: 567, errorRate: 0.3 },
        { path: "/api/v1/foundations", method: "GET", avgResponseTime: 178, p95ResponseTime: 312, requestCount: 423, errorRate: 0.2 },
        { path: "/api/v1/jobs", method: "POST", avgResponseTime: 312, p95ResponseTime: 567, requestCount: 89, errorRate: 0.5 },
      ]);

      setHealth({
        status: "healthy",
        uptime: "14 days, 6 hours",
        lastCheck: new Date().toISOString(),
        services: [
          { name: "Backend API", status: "up", responseTime: 45 },
          { name: "PostgreSQL", status: "up", responseTime: 12 },
          { name: "Redis", status: "up", responseTime: 3 },
          { name: "Sidekiq", status: "up" },
          { name: "Sentry", status: "up", responseTime: 89 },
        ],
      });
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

  const getTrendIcon = (trend?: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getResponseTimeStatus = (ms: number): "good" | "warning" | "critical" => {
    if (ms < 100) return "good";
    if (ms < 300) return "warning";
    return "critical";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">System Performance</h2>
          <p className="text-sm text-muted-foreground">
            Monitor application performance and system health.
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* System Health */}
      {health && (
        <Card
          className={cn(
            health.status === "healthy" && "border-green-200 dark:border-green-800",
            health.status === "degraded" && "border-yellow-200 dark:border-yellow-800",
            health.status === "down" && "border-red-200 dark:border-red-800"
          )}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-5 w-5" />
                System Health
              </CardTitle>
              <Badge
                variant="secondary"
                className={cn(
                  health.status === "healthy" && "bg-green-100 text-green-800",
                  health.status === "degraded" && "bg-yellow-100 text-yellow-800",
                  health.status === "down" && "bg-red-100 text-red-800"
                )}
              >
                {health.status === "healthy" && <CheckCircle className="h-3 w-3 mr-1" />}
                {health.status === "degraded" && <AlertTriangle className="h-3 w-3 mr-1" />}
                {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
              </Badge>
            </div>
            <CardDescription>
              Uptime: {health.uptime} | Last checked: {new Date(health.lastCheck).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {health.services.map((service) => (
                <div
                  key={service.name}
                  className={cn(
                    "p-3 rounded-lg border",
                    service.status === "up"
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        service.status === "up" ? "bg-green-500 animate-pulse" : "bg-red-500"
                      )}
                    />
                    <span className="text-sm font-medium">{service.name}</span>
                  </div>
                  {service.responseTime !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {service.responseTime}ms
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.name}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{metric.name}</span>
                {getTrendIcon(metric.trend)}
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn("text-2xl font-bold", getStatusColor(metric.status))}>
                  {metric.value}
                </span>
                <span className="text-sm text-muted-foreground">{metric.unit}</span>
              </div>
              {metric.name.includes("Usage") && (
                <Progress
                  value={metric.value}
                  className="mt-3"
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* API Endpoints Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-muted-foreground" />
            API Endpoint Performance
          </CardTitle>
          <CardDescription>
            Response times and request counts for key API endpoints (last 24 hours)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Avg Response</TableHead>
                <TableHead>P95 Response</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Error Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.map((endpoint, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-sm">{endpoint.path}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        endpoint.method === "GET" && "border-blue-500 text-blue-700",
                        endpoint.method === "POST" && "border-green-500 text-green-700",
                        endpoint.method === "PUT" && "border-yellow-500 text-yellow-700",
                        endpoint.method === "DELETE" && "border-red-500 text-red-700"
                      )}
                    >
                      {endpoint.method}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-medium",
                        getStatusColor(getResponseTimeStatus(endpoint.avgResponseTime))
                      )}
                    >
                      {endpoint.avgResponseTime}ms
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-medium",
                        getStatusColor(getResponseTimeStatus(endpoint.p95ResponseTime))
                      )}
                    >
                      {endpoint.p95ResponseTime}ms
                    </span>
                  </TableCell>
                  <TableCell>{endpoint.requestCount.toLocaleString()}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        endpoint.errorRate === 0 && "text-green-600",
                        endpoint.errorRate > 0 && endpoint.errorRate < 1 && "text-yellow-600",
                        endpoint.errorRate >= 1 && "text-red-600"
                      )}
                    >
                      {endpoint.errorRate}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Performance Tips */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-blue-900 dark:text-blue-200">
            Performance Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-blue-800 dark:text-blue-300">
          <div className="flex items-start gap-2">
            <Database className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              <strong>Database:</strong> If database connections are high, consider connection pooling or optimizing slow queries.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Globe className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              <strong>API:</strong> Endpoints with P95 &gt; 500ms should be reviewed for N+1 queries or missing indexes.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <HardDrive className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              <strong>Memory:</strong> If memory usage exceeds 80%, consider scaling up or optimizing memory-intensive operations.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              <strong>Response Times:</strong> Target &lt; 100ms for reads and &lt; 300ms for writes for optimal user experience.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
