"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  Loader2,
  AlertCircle,
  Heart,
  Building2,
  Brain,
  Trophy,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

import {
  QuickWinsCard,
  QuickWin,
  HealthCategoryCard,
  HealthCategory,
  IntegrationsPanel,
  Integration,
  InfrastructurePanel,
  InfrastructureMetric,
  HealthLeaderboard,
  LeaderboardEntry,
} from "@/components/health";

// API response from /api/v1/system/health
interface SystemHealthApiResponse {
  success: boolean;
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  overall_health: number;
  infrastructure: Record<string, { status: string; message?: string }>;
  data_health: {
    overall_health: number;
    status: string;
    summary: {
      total_checks: number;
      passed_checks: number;
      failed_checks: number;
      total_issues: number;
      critical_issues: number;
      warning_issues: number;
    };
    checks: Array<{
      foundation_id: number;
      foundation_name: string;
      route_slug: string | null;
      health_score: number;
      total_issues: number;
      critical_issues: number;
      warning_issues: number;
      checks_count: number;
    }>;
  };
  stats: {
    jobs_count: number;
    contacts_count: number;
    pricebook_items_count: number;
    companies_count: number;
    pending_jobs: number;
    failed_jobs: number;
  };
}

interface XeroStatus {
  connected: boolean;
  organisation_name?: string;
}

interface XeroSyncHealth {
  invoices?: { last_synced_at?: string; records_synced?: number };
  contacts?: { last_synced_at?: string; records_synced?: number };
}

function getHealthColor(score: number): string {
  if (score >= 90) return "text-green-600 dark:text-green-400";
  if (score >= 70) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function getHealthBg(score: number): string {
  if (score >= 90) return "from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20";
  if (score >= 70) return "from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20";
  return "from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20";
}

export default function SystemHealthPage() {
  const [systemHealth, setSystemHealth] = React.useState<SystemHealthApiResponse | null>(null);
  const [xeroStatus, setXeroStatus] = React.useState<XeroStatus | null>(null);
  const [xeroSyncHealth, setXeroSyncHealth] = React.useState<XeroSyncHealth | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null);

  // Mock data for kudos (will be replaced by API in Phase 2)
  const [userKudos] = React.useState(280);

  const fetchHealthData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.get<SystemHealthApiResponse>("/api/v1/system/health");
      setSystemHealth(data);
      setLastChecked(new Date());
    } catch (error) {
      console.error("Failed to fetch health data:", error);
      setSystemHealth(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchIntegrationsData = React.useCallback(async () => {
    try {
      const status = await api.get<XeroStatus>("/api/v1/xero/status");
      setXeroStatus(status);

      if (status.connected) {
        const syncHealth = await api.get<XeroSyncHealth>("/api/v1/xero/sync_health");
        setXeroSyncHealth(syncHealth);
      }
    } catch (error) {
      console.error("Failed to fetch integrations:", error);
    }
  }, []);

  React.useEffect(() => {
    fetchHealthData();
    fetchIntegrationsData();
  }, [fetchHealthData, fetchIntegrationsData]);

  // Transform data for components
  const quickWins = React.useMemo((): QuickWin[] => {
    if (!systemHealth?.data_health?.checks) return [];

    const wins: QuickWin[] = [];

    // Generate quick wins from health checks with issues
    systemHealth.data_health.checks.forEach((check) => {
      if (check.critical_issues > 0) {
        wins.push({
          id: `critical-${check.foundation_id}`,
          title: `${check.critical_issues} critical issues in ${check.foundation_name}`,
          description: `Fix critical data issues`,
          count: check.critical_issues,
          points: check.critical_issues * 25,
          fixType: "review",
          checkType: check.foundation_name.toLowerCase(),
        });
      }
      if (check.warning_issues > 0) {
        wins.push({
          id: `warning-${check.foundation_id}`,
          title: `${check.warning_issues} warnings in ${check.foundation_name}`,
          description: `Review and fix data warnings`,
          count: check.warning_issues,
          points: check.warning_issues * 10,
          fixType: "review",
          checkType: check.foundation_name.toLowerCase(),
        });
      }
    });

    // Add Xero reconnect if disconnected
    if (xeroStatus && !xeroStatus.connected) {
      wins.unshift({
        id: "xero-connect",
        title: "Connect Xero",
        description: "Sync your accounting data",
        count: 1,
        points: 50,
        fixType: "connect",
        checkType: "xero",
      });
    }

    return wins.slice(0, 5);
  }, [systemHealth, xeroStatus]);

  const dataHealthCategories = React.useMemo((): HealthCategory[] => {
    if (!systemHealth?.data_health?.checks) return [];

    return systemHealth.data_health.checks
      .filter((check) => check.foundation_name)
      .map((check) => ({
        id: check.foundation_id?.toString() || check.foundation_name,
        name: check.foundation_name,
        score: check.health_score,
        totalIssues: check.total_issues,
        criticalIssues: check.critical_issues,
        warningIssues: check.warning_issues,
        checksCount: check.checks_count,
        routeSlug: check.route_slug || undefined,
        foundationId: check.foundation_id,
      }));
  }, [systemHealth]);

  const integrations = React.useMemo((): Integration[] => {
    const list: Integration[] = [];

    // Xero
    list.push({
      id: "xero",
      name: "Xero",
      status: xeroStatus?.connected ? "connected" : "disconnected",
      statusMessage: xeroStatus?.connected
        ? xeroStatus.organisation_name || "Connected"
        : "Not connected",
      lastSynced: xeroSyncHealth?.invoices?.last_synced_at,
      actionLabel: xeroStatus?.connected ? "View" : "Connect",
      actionType: xeroStatus?.connected ? "view" : "connect",
      href: "/settings/integrations/xero",
    });

    // OneDrive (placeholder - will need actual API)
    list.push({
      id: "onedrive",
      name: "OneDrive",
      status: "connected", // Placeholder
      statusMessage: "Connected",
      actionLabel: "View",
      actionType: "view",
      href: "/settings/integrations",
    });

    // Email (placeholder)
    list.push({
      id: "email",
      name: "Email",
      status: "connected", // Placeholder
      statusMessage: "Synced",
      actionLabel: "View",
      actionType: "view",
      href: "/settings/integrations",
    });

    // ABN Lookup
    list.push({
      id: "abn",
      name: "ABN Lookup",
      status: "connected",
      statusMessage: "Available",
    });

    return list;
  }, [xeroStatus, xeroSyncHealth]);

  const infrastructureMetrics = React.useMemo((): InfrastructureMetric[] => {
    if (!systemHealth) return [];

    const metrics: InfrastructureMetric[] = [];

    // Database
    const dbStatus = systemHealth.infrastructure?.database;
    metrics.push({
      id: "database",
      name: "Database",
      status: dbStatus?.status === "healthy" ? "healthy" : "warning",
      message: dbStatus?.message || "Connected",
    });

    // Jobs Queue
    metrics.push({
      id: "jobs_queue",
      name: "Jobs Queue",
      status: systemHealth.stats?.failed_jobs > 10 ? "warning" :
        systemHealth.stats?.failed_jobs > 50 ? "critical" : "healthy",
      value: systemHealth.stats?.pending_jobs || 0,
      message: `${systemHealth.stats?.pending_jobs || 0} pending, ${systemHealth.stats?.failed_jobs || 0} failed`,
    });

    // Memory (placeholder)
    metrics.push({
      id: "memory",
      name: "Memory",
      status: "healthy",
      value: "1.2GB",
      maxValue: "2GB",
      percentage: 60,
      message: "OK",
    });

    // Workers (placeholder)
    metrics.push({
      id: "workers",
      name: "Workers",
      status: "healthy",
      value: "4",
      maxValue: "4",
      percentage: 100,
      message: "All active",
    });

    return metrics;
  }, [systemHealth]);

  // Mock leaderboard data (will be replaced by API in Phase 4)
  const leaderboardEntries = React.useMemo((): LeaderboardEntry[] => {
    return [
      { id: "system", name: "System", points: 450, isSystem: true, trend: "up" },
      { id: "user-1", name: "Sarah (IT)", points: 180, trend: "up" },
      { id: "current", name: "You", points: userKudos, isCurrentUser: true, trend: "same" },
      { id: "user-2", name: "Mike (Sales)", points: 80, trend: "down" },
      { id: "user-3", name: "Jake (Dev)", points: 50, trend: "up" },
    ];
  }, [userKudos]);

  const handleQuickWinFix = async (quickWin: QuickWin) => {
    // TODO: Implement actual fix logic in Phase 3
    console.log("Fixing:", quickWin);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Refresh health data
    await fetchHealthData(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!systemHealth) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Failed to load health data</p>
        <Button onClick={() => fetchHealthData()}>Retry</Button>
      </div>
    );
  }

  const overallScore = systemHealth.data_health?.overall_health ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500" />
            TEEEM Health Check
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and fix data quality issues across the system
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm py-1 px-3">
            <Trophy className="h-3.5 w-3.5 mr-1.5 text-yellow-500" />
            {userKudos} Kudos
          </Badge>
          <Button
            variant="outline"
            onClick={() => {
              fetchHealthData(true);
              fetchIntegrationsData();
            }}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Health Score */}
      <Card className={cn("bg-gradient-to-br", getHealthBg(overallScore))}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn("text-5xl font-bold font-mono", getHealthColor(overallScore))}>
                {overallScore}%
              </div>
              <div>
                <p className="font-medium text-lg">Overall Health</p>
                <p className="text-sm text-muted-foreground">
                  {systemHealth.data_health?.summary?.total_checks ?? 0} checks •{" "}
                  {systemHealth.data_health?.summary?.total_issues ?? 0} issues
                </p>
              </div>
            </div>
            {lastChecked && (
              <p className="text-xs text-muted-foreground">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </div>
          <Progress value={overallScore} className="mt-4 h-3" />
        </CardContent>
      </Card>

      {/* Quick Wins */}
      <QuickWinsCard
        quickWins={quickWins}
        onFix={handleQuickWinFix}
        loading={refreshing}
      />

      {/* Main Grid: Data Health + Integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data Health */}
        <HealthCategoryCard
          title="Data Health"
          icon={<Building2 className="h-4 w-4" />}
          categories={dataHealthCategories}
        />

        {/* Integrations */}
        <IntegrationsPanel
          integrations={integrations}
          loading={refreshing}
        />
      </div>

      {/* Secondary Grid: AI Pipeline + Infrastructure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Pipeline (placeholder) */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-4 w-4" />
              <h3 className="font-medium">AI Pipeline</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="text-2xl font-bold font-mono">8</div>
                <div className="text-xs text-muted-foreground">Queue</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="text-2xl font-bold font-mono">78%</div>
                <div className="text-xs text-muted-foreground">Confidence</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="text-2xl font-bold font-mono">2</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-4">
              Process Queue
            </Button>
          </CardContent>
        </Card>

        {/* Infrastructure */}
        <InfrastructurePanel metrics={infrastructureMetrics} loading={refreshing} />
      </div>

      {/* Leaderboard */}
      <HealthLeaderboard
        systemPoints={450}
        humansPoints={leaderboardEntries
          .filter((e) => !e.isSystem)
          .reduce((sum, e) => sum + e.points, 0)}
        entries={leaderboardEntries}
        currentUserPoints={userKudos}
        loading={refreshing}
        timeframe="This Week"
      />
    </div>
  );
}
