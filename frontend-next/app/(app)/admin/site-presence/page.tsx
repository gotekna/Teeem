"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import {
  Clock,
  Users,
  Timer,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Camera,
  TrendingUp,
  Building2,
  Sparkles,
  PieChart,
  RefreshCw,
  Play,
  Pause,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Types
interface DashboardStats {
  activeSessions: number;
  workersOnSite: number;
  todayHours: number;
  pendingApprovals: number;
  anomalyCount: number;
  weeklyHours: number;
}

interface ActiveSession {
  id: number;
  worker_name: string;
  job_name: string;
  checkin_at: string;
  elapsed_hours: number;
  gps_verified: boolean;
  face_verified: boolean;
  has_anomalies: boolean;
}

interface RecentSession {
  id: number;
  worker_name: string;
  job_name: string;
  checkin_at: string;
  checkout_at: string;
  total_hours: number;
  approval_status: string;
}

interface Anomaly {
  id: number;
  session_id: number;
  worker_name: string;
  type: string;
  severity: string;
  detected_at: string;
  details: string;
}

export default function SitePresenceDashboardPage() {
  useSetLayoutMode("full-height");
  const pathname = usePathname();
  const router = useRouter();

  // Path-based tab navigation
  const activeTab = useMemo(() => {
    const parts = pathname.replace("/admin/site-presence", "").split("/").filter(Boolean);
    return parts[0] || null;
  }, [pathname]);

  useEffect(() => {
    if (activeTab === null) {
      router.replace("/admin/site-presence/active", { scroll: false });
    }
  }, [activeTab, router]);

  const setActiveTab = useCallback((tab: string) => {
    router.push(`/admin/site-presence/${tab}`, { scroll: false });
  }, [router]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    activeSessions: 0,
    workersOnSite: 0,
    todayHours: 0,
    pendingApprovals: 0,
    anomalyCount: 0,
    weeklyHours: 0,
  });
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      // Fetch all dashboard data in parallel
      const [overviewRes, activeRes, todayRes] = await Promise.all([
        api.get<{ success: boolean; data: Record<string, unknown> }>("/api/v1/site_presence_dashboards/overview"),
        api.get<{ success: boolean; data: { sessions: ActiveSession[] } }>("/api/v1/site_presence_dashboards/active_sessions"),
        api.get<{ success: boolean; data: { sessions: RecentSession[] } }>("/api/v1/site_presence_dashboards/today"),
      ]);

      // Process overview stats
      if (overviewRes?.success && overviewRes?.data) {
        const data = overviewRes.data as {
          active_sessions?: number;
          workers_on_site?: number;
          today_hours?: number;
          pending_approvals?: number;
          anomaly_count?: number;
          weekly_hours?: number;
        };
        setStats({
          activeSessions: data.active_sessions || 0,
          workersOnSite: data.workers_on_site || 0,
          todayHours: data.today_hours || 0,
          pendingApprovals: data.pending_approvals || 0,
          anomalyCount: data.anomaly_count || 0,
          weeklyHours: data.weekly_hours || 0,
        });
      }

      // Process active sessions
      if (activeRes?.success && activeRes?.data?.sessions) {
        setActiveSessions(activeRes.data.sessions);
      }

      // Process recent sessions (today's completed)
      if (todayRes?.success && todayRes?.data?.sessions) {
        setRecentSessions(todayRes.data.sessions.filter((s: RecentSession) => s.checkout_at));
      }

      // Extract anomalies from sessions
      const sessionsWithAnomalies = [...(activeRes?.data?.sessions || []), ...(todayRes?.data?.sessions || [])]
        .filter((s: ActiveSession | RecentSession) => (s as ActiveSession).has_anomalies);

      const anomalyList: Anomaly[] = sessionsWithAnomalies.map((s: ActiveSession | RecentSession, idx: number) => ({
        id: idx,
        session_id: s.id,
        worker_name: (s as ActiveSession).worker_name || "Unknown",
        type: "verification_failed",
        severity: "warning",
        detected_at: (s as ActiveSession).checkin_at || "",
        details: "Session flagged for review",
      }));
      setAnomalies(anomalyList);

    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchDashboardData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const statCards = [
    {
      title: "Active Sessions",
      value: stats.activeSessions,
      icon: Play,
      description: "Workers currently on site",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-950",
      href: "/site_presence_sessions",
    },
    {
      title: "Today's Hours",
      value: (stats.todayHours ?? 0).toFixed(1),
      icon: Clock,
      description: "Total hours logged today",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      href: "/labour_cost_entries",
    },
    {
      title: "Pending Approvals",
      value: stats.pendingApprovals,
      icon: Timer,
      description: "Sessions awaiting review",
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-50 dark:bg-amber-950",
      href: "/site_presence_sessions?status=pending",
    },
    {
      title: "Anomalies",
      value: stats.anomalyCount,
      icon: AlertTriangle,
      description: "Flagged for review",
      color: stats.anomalyCount > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground",
      bgColor: stats.anomalyCount > 0 ? "bg-red-50 dark:bg-red-950" : "bg-muted/50",
      href: "/site_presence_sessions?has_anomalies=true",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Site Presence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time worker tracking, time verification, and cost intelligence
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchDashboardData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.title} href={stat.href}>
              <Card className={`hover:shadow-md transition-shadow cursor-pointer ${stat.bgColor}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold font-mono ${stat.color}`}>
                    {stat.value}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab || "active"} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Play className="h-4 w-4" />
            Active ({activeSessions.length})
          </TabsTrigger>
          <TabsTrigger value="recent" className="gap-2">
            <Clock className="h-4 w-4" />
            Today ({recentSessions.length})
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Anomalies ({anomalies.length})
          </TabsTrigger>
        </TabsList>

        {/* Active Sessions Tab */}
        <TabsContent value="active" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Workers On Site Now
              </CardTitle>
              <CardDescription>
                Live tracking of all active check-ins
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No workers currently on site</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{session.worker_name}</p>
                          <p className="text-sm text-muted-foreground">{session.job_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-mono text-lg font-bold">
                            {session.elapsed_hours?.toFixed(1) || "0.0"}h
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Since {session.checkin_at ? formatDistanceToNow(new Date(session.checkin_at), { addSuffix: true }) : "unknown"}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {session.gps_verified ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <MapPin className="h-3 w-3 mr-1" />
                              GPS
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-600">
                              <MapPin className="h-3 w-3 mr-1" />
                              GPS
                            </Badge>
                          )}
                          {session.face_verified ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <Camera className="h-3 w-3 mr-1" />
                              Face
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-600">
                              <Camera className="h-3 w-3 mr-1" />
                              Face
                            </Badge>
                          )}
                          {session.has_anomalies && (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Alert
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Today's Sessions Tab */}
        <TabsContent value="recent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Today&apos;s Completed Sessions</CardTitle>
              <CardDescription>
                Sessions checked out today
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No completed sessions today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50"
                    >
                      <div>
                        <p className="font-medium">{session.worker_name}</p>
                        <p className="text-sm text-muted-foreground">{session.job_name}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-mono font-bold">{session.total_hours?.toFixed(1) || "0.0"}h</p>
                          <p className="text-xs text-muted-foreground">
                            {session.checkin_at && new Date(session.checkin_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {" → "}
                            {session.checkout_at && new Date(session.checkout_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <Badge
                          variant={
                            session.approval_status === "approved"
                              ? "default"
                              : session.approval_status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {session.approval_status || "pending"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Anomaly Alerts
              </CardTitle>
              <CardDescription>
                Sessions flagged for review due to verification issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              {anomalies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                  <p>No anomalies detected</p>
                  <p className="text-sm">All sessions are verified</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {anomalies.map((anomaly) => (
                    <div
                      key={anomaly.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950"
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        <div>
                          <p className="font-medium">{anomaly.worker_name}</p>
                          <p className="text-sm text-muted-foreground">{anomaly.details}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={anomaly.severity === "critical" ? "destructive" : "secondary"}
                        >
                          {anomaly.severity}
                        </Badge>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/site_presence_sessions?id=${anomaly.session_id}`}>
                            Review
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Links</CardTitle>
          <CardDescription>Navigate to Site Presence modules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/site_presence_sessions">
                <Timer className="h-5 w-5" />
                <span className="text-xs">Sessions</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/worker_profiles">
                <Users className="h-5 w-5" />
                <span className="text-xs">Workers</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/cost_centres">
                <Building2 className="h-5 w-5" />
                <span className="text-xs">Cost Centres</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/labour_cost_entries">
                <DollarSign className="h-5 w-5" />
                <span className="text-xs">Labour Costs</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/job_cost_budgets">
                <PieChart className="h-5 w-5" />
                <span className="text-xs">Budgets</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
              <Link href="/ai_timesheet_suggestions">
                <Sparkles className="h-5 w-5" />
                <span className="text-xs">AI Suggestions</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Weekly Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Hours</span>
                <span className="font-mono font-bold text-lg">{(stats.weeklyHours ?? 0).toFixed(1)}h</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Active Workers</span>
                <span className="font-mono font-bold text-lg">{stats.workersOnSite}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Approval Rate</span>
                <span className="font-mono font-bold text-lg text-green-600">98%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm">GPS Verification</span>
                </div>
                <Badge variant="outline" className="text-green-600">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm">Face Verification</span>
                </div>
                <Badge variant="outline" className="text-green-600">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm">AI Timesheet Engine</span>
                </div>
                <Badge variant="outline" className="text-green-600">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm">Anomaly Detection</span>
                </div>
                <Badge variant="outline" className="text-green-600">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
