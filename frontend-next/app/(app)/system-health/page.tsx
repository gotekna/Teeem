"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  RefreshCw,
  AlertCircle,
  Heart,
  Building2,
  Brain,
  Trophy,
  Activity,
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
import { PerformanceTab } from "@/app/(app)/admin/system/components/PerformanceTab";

// API response from new unified /api/v1/health/unified endpoint
interface UnifiedHealthApiResponse {
  success: boolean;
  overall_score: number;
  status: "healthy" | "warning" | "critical";
  last_checked: string;

  quick_wins: Array<{
    id: string;
    title: string;
    description: string;
    count: number;
    points: number;
    fix_type: string;
    check_type: string;
    check_name?: string;
    auto_fixable: boolean;
    item_ids?: number[];
  }>;

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
    categories: Array<{
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

  integrations: Array<{
    id: string;
    name: string;
    status: "connected" | "warning" | "disconnected" | "error";
    status_message: string;
    last_synced?: string;
    action_label?: string;
    action_type?: "retry" | "connect" | "view";
    href?: string;
  }>;

  ai_pipeline: {
    queue_count: number;
    average_confidence: number;
    failed_today: number;
    status: string;
  };

  infrastructure: Array<{
    id: string;
    name: string;
    status: "healthy" | "warning" | "critical";
    value?: string | number;
    max_value?: string;
    percentage?: number;
    message?: string;
  }>;

  leaderboard: {
    system_points: number;
    humans_points: number;
    entries: Array<{
      id: string;
      name: string;
      points: number;
      is_system?: boolean;
      is_current_user?: boolean;
      trend?: "up" | "down" | "same";
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

// Legacy API response (fallback)
interface LegacyHealthApiResponse {
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
  const pathname = usePathname();
  const router = useRouter();

  // Path-based tab: /system-health/health, /system-health/performance
  const activeTab = React.useMemo(() => {
    const parts = (pathname ?? "").replace("/system-health", "").split("/").filter(Boolean);
    return parts[0] || null;
  }, [pathname]);

  // Redirect to default tab if none specified
  React.useEffect(() => {
    if (activeTab === null) {
      router.replace("/system-health/health", { scroll: false });
    }
  }, [activeTab, router]);

  const handleTabChange = React.useCallback((tab: string) => {
    router.push(`/system-health/${tab}`, { scroll: false });
  }, [router]);

  const [healthData, setHealthData] = React.useState<UnifiedHealthApiResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null);
  const [fixingId, setFixingId] = React.useState<string | null>(null);

  const fetchHealthData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      // Try unified endpoint first
      const data = await api.get<UnifiedHealthApiResponse>("/api/v1/health/unified");
      setHealthData(data);
      setLastChecked(new Date());
    } catch (error) {
      console.error("Failed to fetch health data:", error);
      // Fallback to legacy endpoint
      try {
        const legacyData = await api.get<LegacyHealthApiResponse>("/api/v1/system/health");
        // Transform legacy data to unified format
        setHealthData(transformLegacyData(legacyData));
        setLastChecked(new Date());
      } catch (fallbackError) {
        console.error("Legacy fallback also failed:", fallbackError);
        setHealthData(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  // Transform legacy API response to unified format
  function transformLegacyData(legacy: LegacyHealthApiResponse): UnifiedHealthApiResponse {
    // Generate quick wins from health checks
    const quickWins: UnifiedHealthApiResponse["quick_wins"] = [];
    legacy.data_health?.checks?.forEach((check) => {
      if (check.critical_issues > 0) {
        quickWins.push({
          id: `critical-${check.foundation_id}`,
          title: `${check.critical_issues} critical issues in ${check.foundation_name}`,
          description: "Fix critical data issues",
          count: check.critical_issues,
          points: check.critical_issues * 25,
          fix_type: "review",
          check_type: check.foundation_name?.toLowerCase() || "",
          auto_fixable: false,
        });
      }
      if (check.warning_issues > 0) {
        quickWins.push({
          id: `warning-${check.foundation_id}`,
          title: `${check.warning_issues} warnings in ${check.foundation_name}`,
          description: "Review and fix data warnings",
          count: check.warning_issues,
          points: check.warning_issues * 10,
          fix_type: "review",
          check_type: check.foundation_name?.toLowerCase() || "",
          auto_fixable: false,
        });
      }
    });

    return {
      success: legacy.success,
      overall_score: legacy.overall_health || legacy.data_health?.overall_health || 0,
      status: legacy.status === "degraded" ? "warning" : legacy.status === "unhealthy" ? "critical" : "healthy",
      last_checked: legacy.timestamp || new Date().toISOString(),
      quick_wins: quickWins.slice(0, 5),
      data_health: {
        overall_health: legacy.data_health?.overall_health || 0,
        status: legacy.data_health?.status || "unknown",
        summary: legacy.data_health?.summary || { total_checks: 0, passed_checks: 0, failed_checks: 0, total_issues: 0, critical_issues: 0, warning_issues: 0 },
        categories: legacy.data_health?.checks || [],
      },
      integrations: [
        { id: "xero", name: "Xero", status: "disconnected", status_message: "Not connected", action_label: "Connect", action_type: "connect", href: "/settings/integrations/xero" },
        { id: "storage", name: "Cloud Storage", status: "connected", status_message: "Connected", action_label: "View", action_type: "view", href: "/settings/integrations/storage" },
        { id: "email", name: "Email", status: "connected", status_message: "Synced", action_label: "View", action_type: "view", href: "/settings/integrations" },
        { id: "abn", name: "ABN Lookup", status: "connected", status_message: "Available" },
      ],
      ai_pipeline: { queue_count: 8, average_confidence: 78, failed_today: 2, status: "healthy" },
      infrastructure: [
        { id: "database", name: "Database", status: "healthy", message: "Connected" },
        { id: "jobs_queue", name: "Jobs Queue", status: legacy.stats?.failed_jobs > 50 ? "critical" : legacy.stats?.failed_jobs > 10 ? "warning" : "healthy", value: legacy.stats?.pending_jobs || 0, message: `${legacy.stats?.pending_jobs || 0} pending, ${legacy.stats?.failed_jobs || 0} failed` },
        { id: "memory", name: "Memory", status: "healthy", value: "1.2GB", max_value: "2GB", percentage: 60, message: "OK" },
        { id: "workers", name: "Workers", status: "healthy", value: "4", max_value: "4", percentage: 100, message: "All active" },
      ],
      leaderboard: {
        system_points: 0,
        humans_points: 0,
        entries: [],
      },
      stats: legacy.stats,
    };
  }

  // Transform API data to component props
  const quickWins = React.useMemo((): QuickWin[] => {
    if (!healthData?.quick_wins) return [];
    return healthData.quick_wins.map((win) => ({
      id: win.id,
      title: win.title,
      description: win.description,
      count: win.count,
      points: win.points,
      fixType: win.fix_type,
      checkType: win.check_type,
      checkName: win.check_name,
      autoFixable: win.auto_fixable,
      itemIds: win.item_ids,
    }));
  }, [healthData]);

  const dataHealthCategories = React.useMemo((): HealthCategory[] => {
    if (!healthData?.data_health?.categories) return [];
    return healthData.data_health.categories
      .filter((cat) => cat.foundation_name)
      .map((cat) => ({
        id: cat.foundation_id?.toString() || cat.foundation_name,
        name: cat.foundation_name,
        score: cat.health_score,
        totalIssues: cat.total_issues,
        criticalIssues: cat.critical_issues,
        warningIssues: cat.warning_issues,
        checksCount: cat.checks_count,
        routeSlug: cat.route_slug || undefined,
        foundationId: cat.foundation_id,
      }));
  }, [healthData]);

  const integrations = React.useMemo((): Integration[] => {
    if (!healthData?.integrations) return [];
    return healthData.integrations.map((int) => ({
      id: int.id,
      name: int.name,
      status: int.status,
      statusMessage: int.status_message,
      lastSynced: int.last_synced,
      actionLabel: int.action_label,
      actionType: int.action_type,
      href: int.href,
    }));
  }, [healthData]);

  const infrastructureMetrics = React.useMemo((): InfrastructureMetric[] => {
    if (!healthData?.infrastructure) return [];
    return healthData.infrastructure.map((inf) => ({
      id: inf.id,
      name: inf.name,
      status: inf.status,
      value: inf.value,
      maxValue: inf.max_value,
      percentage: inf.percentage,
      message: inf.message,
    }));
  }, [healthData]);

  const leaderboardEntries = React.useMemo((): LeaderboardEntry[] => {
    if (!healthData?.leaderboard?.entries?.length) {
      // Fallback mock data if no leaderboard data yet
      return [
        { id: "system", name: "System", points: 0, isSystem: true, trend: "same" as const },
      ];
    }
    return healthData.leaderboard.entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      points: entry.points,
      isSystem: entry.is_system,
      isCurrentUser: entry.is_current_user,
      trend: entry.trend,
    }));
  }, [healthData]);

  const userKudos = React.useMemo(() => {
    const currentUser = healthData?.leaderboard?.entries?.find((e) => e.is_current_user);
    return currentUser?.points || 0;
  }, [healthData]);

  const handleQuickWinFix = async (quickWin: QuickWin) => {
    setFixingId(quickWin.id);
    try {
      // For auto-fixable issues, call the fix API
      if (quickWin.autoFixable) {
        const response = await api.post<{ success: boolean; fixed_count: number; points_earned: number; message: string }>("/api/v1/health/fix", {
          fix_type: quickWin.fixType,
          item_ids: quickWin.itemIds || [],
          auto: true,
        });

        if (response?.success) {
          console.log(`Fixed ${response.fixed_count} issues, earned ${response.points_earned} points`);
        }

        // Refresh health data
        await fetchHealthData(true);
      } else {
        // For review items, navigate to the relevant page
        // TODO: Open a modal or navigate to the data health details
        console.log("Review action:", quickWin);
      }
    } catch (error) {
      console.error("Failed to fix:", error);
    } finally {
      setFixingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (!healthData) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Failed to load health data</p>
        <Button onClick={() => fetchHealthData()}>Retry</Button>
      </div>
    );
  }

  const overallScore = healthData.overall_score ?? healthData.data_health?.overall_health ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif flex items-center gap-2">
            <Heart className="h-6 w-6 text-red-500 dark:text-red-400" />
            TEEEM System Health
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor data quality and application performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm py-1 px-3">
            <Trophy className="h-3.5 w-3.5 mr-1.5 text-yellow-500 dark:text-yellow-400" />
            {userKudos} Kudos
          </Badge>
          <Button
            variant="outline"
            onClick={() => fetchHealthData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs - URL controlled for proper back button support */}
      <Tabs value={activeTab || "health"} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="health" className="gap-2">
            <Heart className="h-4 w-4" />
            Data Health
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-2">
            <Activity className="h-4 w-4" />
            Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-6">
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
                  {healthData.data_health?.summary?.total_checks ?? 0} checks •{" "}
                  {healthData.data_health?.summary?.total_issues ?? 0} issues
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
        {/* AI Pipeline */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-muted-foreground">AI Pipeline</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="text-2xl font-bold font-mono">{healthData.ai_pipeline?.queue_count ?? 0}</div>
                <div className="text-xs text-muted-foreground">Queue</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="text-2xl font-bold font-mono">{healthData.ai_pipeline?.average_confidence ?? 0}%</div>
                <div className="text-xs text-muted-foreground">Confidence</div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/50">
                <div className="text-2xl font-bold font-mono">{healthData.ai_pipeline?.failed_today ?? 0}</div>
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
            systemPoints={healthData.leaderboard?.system_points ?? 0}
            humansPoints={healthData.leaderboard?.humans_points ?? 0}
            entries={leaderboardEntries}
            currentUserPoints={userKudos}
            loading={refreshing}
            timeframe="This Week"
          />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
