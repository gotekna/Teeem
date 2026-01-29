"use client";

import { useState, useEffect, ElementType, useMemo, useCallback } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  ChartBarIcon,
  CpuChipIcon,
  ClockIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import {
  CriticalPathView,
  EvmDashboard,
  AiSuggestionsPanel,
  BaselineComparisonComponent,
  ImportExportPanel,
} from "@/components/ui/gantt";

// ============================================
// Types
// ============================================

interface Construction {
  id: number;
  name: string;
}

interface ConstructionResponse {
  construction?: Construction;
  id?: number;
  name?: string;
}

interface EvmSummary {
  spi?: number;
  cpi?: number;
  percent_complete?: number;
}

interface CriticalPathSummary {
  duration_days?: number;
}

interface Summary {
  evm?: EvmSummary;
  critical_path?: CriticalPathSummary;
}

interface SummaryResponse {
  summary: Summary;
}

interface TabConfig {
  id: string;
  label: string;
  icon: ElementType;
}

// ============================================
// Main Component
// ============================================

export default function SmAnalyticsPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const constructionId = params.id as string;

  // Path-based tab: /jobs/123/analytics/overview, /jobs/123/analytics/evm
  const activeTab = useMemo(() => {
    const parts = (pathname ?? "").replace(`/jobs/${constructionId}/analytics`, "").split("/").filter(Boolean);
    return parts[0] || null;
  }, [pathname, constructionId]);

  // Redirect to default tab if none specified
  useEffect(() => {
    if (activeTab === null) {
      router.replace(`/jobs/${constructionId}/analytics/overview`, { scroll: false });
    }
  }, [activeTab, router, constructionId]);

  const setTab = useCallback((tab: string) => {
    router.push(`/jobs/${constructionId}/analytics/${tab}`, { scroll: false });
  }, [router, constructionId]);

  const [construction, setConstruction] = useState<Construction | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [constructionRes, summaryRes] = await Promise.all([
          api.get<ConstructionResponse>(`/api/v1/jobs/${constructionId}`),
          api.get<SummaryResponse>(`/api/v1/jobs/${constructionId}/sm_analytics/summary`),
        ]);
        setConstruction(constructionRes.construction || (constructionRes as unknown as Construction));
        setSummary(summaryRes.summary);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [constructionId]);

  const tabs: TabConfig[] = [
    { id: "overview", label: "Overview", icon: ChartBarIcon },
    { id: "critical-path", label: "Critical Path", icon: ClockIcon },
    { id: "ai", label: "AI Insights", icon: CpuChipIcon },
    { id: "integrations", label: "Integrations", icon: Cog6ToothIcon },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Fixed Header with Tabs */}
      <div className="flex-shrink-0 border-b bg-background px-6 py-4">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Analytics & Insights</h1>
          <p className="text-muted-foreground">{construction?.name}</p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Project Duration</div>
                <div className="text-2xl font-bold">
                  {summary.critical_path?.duration_days || 0} days
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Schedule Performance</div>
                <div
                  className={`text-2xl font-bold ${
                    (summary.evm?.spi ?? 0) >= 1
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {summary.evm?.spi?.toFixed(2) || "-"} SPI
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Cost Performance</div>
                <div
                  className={`text-2xl font-bold ${
                    (summary.evm?.cpi ?? 0) >= 1
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {summary.evm?.cpi?.toFixed(2) || "-"} CPI
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Completion</div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {summary.evm?.percent_complete?.toFixed(0) || 0}%
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="-mb-px border-b">
          <nav className="flex gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-none p-6">
        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === "overview" && (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <EvmDashboard constructionId={constructionId} />
                <CriticalPathView constructionId={constructionId} />
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <AiSuggestionsPanel constructionId={constructionId} />
                <BaselineComparisonComponent constructionId={constructionId} />
              </div>
            </>
          )}

          {activeTab === "critical-path" && (
            <div className="space-y-6">
              <CriticalPathView constructionId={constructionId} />
              <BaselineComparisonComponent constructionId={constructionId} />
            </div>
          )}

          {activeTab === "ai" && (
            <div className="grid gap-6 md:grid-cols-2">
              <AiSuggestionsPanel constructionId={constructionId} />
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">AI Features</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Scheduling optimization suggestions
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Delay risk predictions
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Resource conflict detection
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Critical path analysis
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-yellow-500" />
                        Duration estimation (based on historical data)
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="grid gap-6 md:grid-cols-2">
              <ImportExportPanel
                constructionId={constructionId}
                constructionName={construction?.name}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Calendar Sync</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full justify-start gap-3">
                    <img
                      src="https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png"
                      alt="Google"
                      className="h-6 w-6"
                    />
                    <span className="text-sm">Sync with Google Calendar</span>
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-3">
                    <img
                      src="https://res.cdn.office.net/assets/mail/pwa/v1/pngs/outlook-icon-144-fluent.png"
                      alt="Outlook"
                      className="h-6 w-6"
                    />
                    <span className="text-sm">Sync with Outlook Calendar</span>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Calendar sync requires OAuth authorization
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="task-reminders">Task reminders</Label>
                    <Checkbox id="task-reminders" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="schedule-updates">Schedule updates</Label>
                    <Checkbox id="schedule-updates" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="delay-alerts">Delay alerts</Label>
                    <Checkbox id="delay-alerts" defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="push-notifications">Push notifications</Label>
                    <Checkbox id="push-notifications" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
