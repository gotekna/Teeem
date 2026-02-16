"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  Heart,
  Building2,
  AlertCircle,
  Users,
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
} from "@/components/health";
import { DuplicateContactsTab } from "@/components/settings/xero/DuplicateContactsTab";

// Matches /api/v1/health/unified response shape
interface UnifiedHealthResponse {
  success: boolean;
  overall_score: number;
  status: "healthy" | "warning" | "critical";
  last_checked: string;
  cached?: boolean;

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
      info_issues: number;
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

  infrastructure: Array<{
    id: string;
    name: string;
    status: "healthy" | "warning" | "critical";
    value?: string | number;
    max_value?: string;
    percentage?: number;
    message?: string;
  }>;

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

interface DataHealthTabProps {
  subTab?: string;
  basePath?: string;
}

export function DataHealthTab({ subTab, basePath = "/settings/company/data-health" }: DataHealthTabProps) {
  const router = useRouter();
  const [healthData, setHealthData] = React.useState<UnifiedHealthResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  // URL is SSoT for sub-tab state, default to "overview"
  const activeSubTab = subTab || "overview";
  const setActiveSubTab = React.useCallback((tab: string) => {
    router.push(`${basePath}/${tab}`, { scroll: false });
  }, [router, basePath]);

  const fetchHealthData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.get<UnifiedHealthResponse>(
        `/api/v1/health/unified${isRefresh ? "?refresh=true" : ""}`
      );
      setHealthData(data);
    } catch (error) {
      console.error("Failed to fetch health data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  // Transform API data for components
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

  const handleQuickWinFix = async (quickWin: QuickWin) => {
    try {
      if (quickWin.autoFixable) {
        await api.post("/api/v1/health/fix", {
          fix_type: quickWin.fixType,
          item_ids: quickWin.itemIds || [],
          auto: true,
        });
        await fetchHealthData(true);
      }
    } catch (error) {
      console.error("Failed to fix:", error);
    }
  };

  const overallScore = healthData?.overall_score ?? healthData?.data_health?.overall_health ?? 0;
  const summary = healthData?.data_health?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Data Health</h2>
          <p className="text-muted-foreground mt-1">
            Monitor data quality, integrations, and system health across all modules.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchHealthData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Overview
            {summary && summary.total_issues > 0 && (
              <Badge variant="destructive" className="ml-1">
                {summary.total_issues}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contacts
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size={32} className="text-muted-foreground" />
            </div>
          ) : !healthData ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">Failed to load health data</p>
              <Button onClick={() => fetchHealthData()}>Retry</Button>
            </div>
          ) : (
            <>
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
                          {summary?.total_checks ?? 0} checks |{" "}
                          {summary?.passed_checks ?? 0} passed |{" "}
                          {summary?.total_issues ?? 0} issues
                          {summary?.critical_issues ? ` (${summary.critical_issues} critical)` : ""}
                        </p>
                      </div>
                    </div>
                    {healthData.cached && (
                      <Badge variant="secondary" className="text-xs">cached</Badge>
                    )}
                  </div>
                  <Progress value={overallScore} className="mt-4 h-3" />
                </CardContent>
              </Card>

              {/* Stats Row */}
              {healthData.stats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: "Jobs", value: healthData.stats.jobs_count },
                    { label: "Contacts", value: healthData.stats.contacts_count },
                    { label: "Pricebook", value: healthData.stats.pricebook_items_count },
                    { label: "Companies", value: healthData.stats.companies_count },
                    { label: "Pending Jobs", value: healthData.stats.pending_jobs },
                    { label: "Failed Jobs", value: healthData.stats.failed_jobs, critical: healthData.stats.failed_jobs > 0 },
                  ].map((stat) => (
                    <Card key={stat.label} className="p-3">
                      <div className={cn(
                        "text-2xl font-bold font-mono",
                        stat.critical ? "text-red-600 dark:text-red-400" : ""
                      )}>
                        {(stat.value ?? 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Quick Wins */}
              <QuickWinsCard
                quickWins={quickWins}
                onFix={handleQuickWinFix}
                loading={refreshing}
              />

              {/* Data Health + Integrations Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <HealthCategoryCard
                  title="Data Health"
                  icon={<Building2 className="h-4 w-4" />}
                  categories={dataHealthCategories}
                />
                <IntegrationsPanel
                  integrations={integrations}
                  loading={refreshing}
                />
              </div>

              {/* Infrastructure */}
              <InfrastructurePanel metrics={infrastructureMetrics} loading={refreshing} />
            </>
          )}
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts">
          <DuplicateContactsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
