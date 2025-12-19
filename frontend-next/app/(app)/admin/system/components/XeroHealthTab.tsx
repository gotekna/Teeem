"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Shield,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

// Types
interface HealthStatus {
  connected: boolean;
  display_status: string;
  message: string;
  expires_at: string | null;
  needs_attention: boolean;
  action_required: string | null;
  xero_tenant_name: string | null;
  xero_tenant_id: string | null;
}

interface Credential {
  id: number;
  health: HealthStatus;
}

interface HealthEvent {
  id: number;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  trigger: string | null;
  message: string;
  tenant_name: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface Warning {
  credential_id: number;
  tenant_name: string;
  warning_type: string;
  severity: "critical" | "warning";
  message: string;
  risk_score?: number;
}

interface Analytics {
  failure_rate_24h: number;
  mean_time_to_recovery: number | null;
  events_last_24h: number;
  status_changes_last_24h: number;
  failures_last_24h: number;
  recoveries_last_24h: number;
}

interface Predictions {
  credentials: Array<{
    id: number;
    tenant_name: string;
    risk_score: number;
    health_score: number;
  }>;
  high_risk_count: number;
  elevated_risk_count: number;
  healthy_count: number;
}

export function XeroHealthTab() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [dashboard, setDashboard] = React.useState<{
    overall_status: string;
    total_credentials: number;
    connected_count: number;
    needs_attention_count: number;
    credentials: Credential[];
  } | null>(null);
  const [events, setEvents] = React.useState<HealthEvent[]>([]);
  const [warnings, setWarnings] = React.useState<Warning[]>([]);
  const [analytics, setAnalytics] = React.useState<Analytics | null>(null);
  const [predictions, setPredictions] = React.useState<Predictions | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      const [dashboardData, eventsData, warningsData, analyticsData, predictionsData] = await Promise.all([
        api.get<{ success: boolean; overall_status: string; total_credentials: number; connected_count: number; needs_attention_count: number; credentials: Credential[] }>("/api/v1/xero/health/dashboard"),
        api.get<{ success: boolean; events: HealthEvent[] }>("/api/v1/xero/health/events"),
        api.get<{ success: boolean; warnings: Warning[] }>("/api/v1/xero/health/warnings"),
        api.get<{ success: boolean; analytics: Analytics }>("/api/v1/xero/health/analytics"),
        api.get<{ success: boolean; predictions: Predictions }>("/api/v1/xero/health/predictions"),
      ]);

      setDashboard({
        overall_status: dashboardData.overall_status,
        total_credentials: dashboardData.total_credentials,
        connected_count: dashboardData.connected_count,
        needs_attention_count: dashboardData.needs_attention_count,
        credentials: dashboardData.credentials,
      });
      setEvents(eventsData.events);
      setWarnings(warningsData.warnings);
      setAnalytics(analyticsData.analytics);
      setPredictions(predictionsData.predictions);
    } catch (error) {
      console.error("Failed to load health data:", error);
      toast({ title: "Error", description: "Failed to load health data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post("/api/v1/xero/health/check", {});
      await loadData();
      toast({ title: "Success", description: "Health check completed" });
    } catch (error) {
      console.error("Failed to run health check:", error);
      toast({ title: "Error", description: "Failed to run health check", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "disconnected":
        return <XCircle className="h-5 w-5 text-gray-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      connected: "default",
      warning: "secondary",
      error: "destructive",
      disconnected: "outline",
    };
    return (
      <Badge variant={variants[status] || "outline"} className={cn(
        status === "connected" && "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
        status === "warning" && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
      )}>
        {status}
      </Badge>
    );
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatMTTR = (seconds: number | null) => {
    if (seconds === null) return "N/A";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Xero Connection Health</h2>
          <p className="text-muted-foreground">Real-time monitoring and predictive health analysis</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Run Health Check
        </Button>
      </div>

      {/* Overall Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overall Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon(dashboard?.overall_status || "unknown")}
                  <span className="text-2xl font-bold capitalize">{dashboard?.overall_status}</span>
                </div>
              </div>
              <Shield className={cn(
                "h-10 w-10",
                dashboard?.overall_status === "connected" && "text-green-500",
                dashboard?.overall_status === "warning" && "text-yellow-500",
                dashboard?.overall_status === "error" && "text-red-500",
                dashboard?.overall_status === "disconnected" && "text-gray-400"
              )} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Connected</p>
                <p className="text-2xl font-bold">{dashboard?.connected_count} / {dashboard?.total_credentials}</p>
              </div>
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Need Attention</p>
                <p className="text-2xl font-bold">{dashboard?.needs_attention_count || 0}</p>
              </div>
              <AlertTriangle className={cn(
                "h-10 w-10",
                (dashboard?.needs_attention_count || 0) > 0 ? "text-yellow-500" : "text-gray-300"
              )} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failure Rate (24h)</p>
                <p className="text-2xl font-bold">{((analytics?.failure_rate_24h || 0) * 100).toFixed(1)}%</p>
              </div>
              {(analytics?.failure_rate_24h || 0) > 0.1 ? (
                <TrendingDown className="h-10 w-10 text-red-500" />
              ) : (
                <TrendingUp className="h-10 w-10 text-green-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Early Warnings ({warnings.length})
            </CardTitle>
            <CardDescription>Potential issues that need attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {warnings.map((warning, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg",
                    warning.severity === "critical" ? "bg-red-50 dark:bg-red-900/20" : "bg-yellow-50 dark:bg-yellow-900/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {warning.severity === "critical" ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium">{warning.tenant_name}</p>
                      <p className="text-sm text-muted-foreground">{warning.message}</p>
                    </div>
                  </div>
                  <Badge variant={warning.severity === "critical" ? "destructive" : "secondary"}>
                    {warning.warning_type.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Predictions & Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Scores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Credential Health Scores
            </CardTitle>
            <CardDescription>Predictive risk analysis for each connection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {predictions?.credentials.map((cred) => (
                <div key={cred.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{cred.tenant_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            cred.health_score >= 70 ? "bg-green-500" :
                            cred.health_score >= 40 ? "bg-yellow-500" : "bg-red-500"
                          )}
                          style={{ width: `${cred.health_score}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground">{cred.health_score}%</span>
                    </div>
                  </div>
                  <Badge variant={cred.risk_score >= 70 ? "destructive" : cred.risk_score >= 40 ? "secondary" : "default"}>
                    Risk: {cred.risk_score}
                  </Badge>
                </div>
              ))}
              {(!predictions?.credentials || predictions.credentials.length === 0) && (
                <p className="text-muted-foreground text-center py-4">No credentials found</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Analytics Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Analytics (Last 24h)
            </CardTitle>
            <CardDescription>Key metrics and recovery statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Events</p>
                <p className="text-2xl font-bold">{analytics?.events_last_24h || 0}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Status Changes</p>
                <p className="text-2xl font-bold">{analytics?.status_changes_last_24h || 0}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Failures</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{analytics?.failures_last_24h || 0}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Recoveries</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{analytics?.recoveries_last_24h || 0}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted col-span-2">
                <p className="text-sm text-muted-foreground">Mean Time to Recovery</p>
                <p className="text-2xl font-bold">{formatMTTR(analytics?.mean_time_to_recovery || null)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credentials Detail */}
      <Card>
        <CardHeader>
          <CardTitle>All Credentials</CardTitle>
          <CardDescription>Current health status of all Xero connections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dashboard?.credentials.map((cred) => (
              <div
                key={cred.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {getStatusIcon(cred.health.display_status)}
                  <div>
                    <p className="font-medium">{cred.health.xero_tenant_name || `Credential ${cred.id}`}</p>
                    <p className="text-sm text-muted-foreground">{cred.health.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(cred.health.display_status)}
                  {cred.health.expires_at && (
                    <span className="text-sm text-muted-foreground">
                      Expires: {new Date(cred.health.expires_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {(!dashboard?.credentials || dashboard.credentials.length === 0) && (
              <p className="text-muted-foreground text-center py-8">No Xero credentials configured</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Events</CardTitle>
          <CardDescription>Latest health events and state transitions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.slice(0, 20).map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between py-2 px-3 hover:bg-muted/50 rounded-md transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-xs">
                    {event.event_type.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-sm">{event.message}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {event.tenant_name && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded">{event.tenant_name}</span>
                  )}
                  <span>{formatTimeAgo(event.created_at)}</span>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-muted-foreground text-center py-8">No events recorded yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
