"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import {
  Briefcase,
  FileText,
  DollarSign,
  Users,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle,
  BarChart3,
  LayoutDashboard,
  Shield,
  Zap,
  Smile,
  Target,
  Network,
  AlertCircle,
} from "lucide-react";
import FeaturesTrackingTable from "./components/FeaturesTrackingTable";
import ArchitectureMap from "./components/ArchitectureMap";

interface DashboardStats {
  activeJobs: number;
  activeJobsTrend: string;
  pendingPos: number;
  overduePos: number;
  revenueYtd: number;
  revenueTrendPct: number;
  totalContacts: number;
  contactsTrend: string;
}

interface ActivityItem {
  type: string;
  title: string;
  time: string;
  timeAgo: string;
  icon: string;
}

interface UpcomingItem {
  type: string;
  title: string;
  date: string;
  dateLabel: string;
  category: string;
}

const ICON_MAP: Record<string, typeof CheckCircle> = {
  check_circle: CheckCircle,
  briefcase: Briefcase,
  users: Users,
  file_text: FileText,
  clock: Clock,
};

export default function DashboardPage() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Path-based tab: /dashboard/overview, /dashboard/competitor, /dashboard/architecture/costs
  // URL always shows current tab for clarity
  const pathParts = useMemo(() => {
    return (pathname ?? "").replace("/dashboard", "").split("/").filter(Boolean);
  }, [pathname]);

  const activeTab = pathParts[0] || null; // null means no tab in URL yet
  const subTab = pathParts[1] || null; // sub-tab for architecture, etc.

  // Redirect to default tab if none specified
  useEffect(() => {
    if (activeTab === null) {
      router.replace("/dashboard/overview", { scroll: false });
    }
    // Redirect /dashboard/architecture to /dashboard/architecture/beginner
    if (activeTab === "architecture" && !subTab) {
      router.replace("/dashboard/architecture/beginner", { scroll: false });
    }
  }, [activeTab, subTab, router]);

  const setActiveTab = useCallback((tab: string) => {
    // When switching to architecture, include default sub-tab in URL
    if (tab === "architecture") {
      router.push(`/dashboard/architecture/beginner`, { scroll: false });
    } else {
      router.push(`/dashboard/${tab}`, { scroll: false });
    }
  }, [router]);

  // Real data from API
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingItem[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  // Fetch all dashboard data in parallel
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get<{ success: boolean; data: DashboardStats }>("/api/v1/app_dashboard/stats");
        if (res?.data) setStats(res.data);
      } catch (err) {
        console.error("[Dashboard] Failed to fetch stats:", err);
        setStatsError(true);
      } finally {
        setStatsLoading(false);
      }
    };

    const fetchActivity = async () => {
      try {
        const res = await api.get<{ success: boolean; data: ActivityItem[] }>("/api/v1/app_dashboard/activity");
        if (res?.data) setActivity(res.data);
      } catch (err) {
        console.error("[Dashboard] Failed to fetch activity feed:", err);
        // Activity feed is non-critical — show empty
      } finally {
        setActivityLoading(false);
      }
    };

    const fetchUpcoming = async () => {
      try {
        const res = await api.get<{ success: boolean; data: UpcomingItem[] }>("/api/v1/app_dashboard/upcoming");
        if (res?.data) setUpcoming(res.data);
      } catch (err) {
        console.error("[Dashboard] Failed to fetch upcoming items:", err);
        // Upcoming is non-critical — show empty
      } finally {
        setUpcomingLoading(false);
      }
    };

    fetchStats();
    fetchActivity();
    fetchUpcoming();
  }, []);

  const statCards = stats ? [
    {
      title: "Active Jobs",
      value: stats.activeJobs,
      icon: Briefcase,
      description: "Jobs in progress",
      trend: stats.activeJobsTrend,
      href: "/jobs",
    },
    {
      title: "Pending POs",
      value: stats.pendingPos,
      icon: FileText,
      description: "Awaiting approval",
      trend: stats.overduePos > 0 ? `${stats.overduePos} overdue` : "None overdue",
      href: "/purchase_orders",
    },
    {
      title: "Revenue (YTD)",
      value: `$${Math.round(stats.revenueYtd).toLocaleString()}`,
      icon: DollarSign,
      description: "Year to date",
      trend: stats.revenueTrendPct !== 0
        ? `${stats.revenueTrendPct > 0 ? "+" : ""}${stats.revenueTrendPct}% vs last year`
        : "No comparison data",
      href: "/financial",
    },
    {
      title: "Total Contacts",
      value: stats.totalContacts,
      icon: Users,
      description: "Clients & suppliers",
      trend: stats.contactsTrend,
      href: "/contacts",
    },
  ] : [];

  return (
    <div className="space-y-6 -mt-2"> {/* -mt-2 adjusts for pt-6 vs pt-4 difference */}
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back, {user?.name || "User"}. Here&apos;s what&apos;s happening today.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab || "overview"} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="competitor" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Competitor Comparison
          </TabsTrigger>
          <TabsTrigger value="architecture" className="gap-2">
            <Network className="h-4 w-4" />
            Architecture
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="metrics-cards">
            {statsLoading ? (
              // Loading skeletons
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4 rounded" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16 mb-1" />
                    <Skeleton className="h-3 w-20 mt-1" />
                    <Skeleton className="h-3 w-28 mt-2" />
                  </CardContent>
                </Card>
              ))
            ) : statsError ? (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center">
                  <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Unable to load dashboard stats</p>
                </CardContent>
              </Card>
            ) : (
              statCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <Link key={stat.title} href={stat.href}>
                    <Card className="hover:bg-secondary/30 transition-colors cursor-pointer">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          {stat.title}
                        </CardTitle>
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold font-mono">{stat.value}</div>
                        <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          {stat.trend}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            )}
          </div>

          {/* TEEEM Values */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="text-xl font-bold">Our Values: TEEEM</CardTitle>
              <CardDescription>
                These five principles are at the heart of who we are and how we operate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Trust */}
                <div className="space-y-2 p-4 rounded-lg bg-background/50 border border-border hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-bold text-sm">Trust</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We build trust through being <span className="font-semibold text-foreground">HOT</span>: Honest, Open, and Transparent. We say things straight, share what needs to be shared, and always act with integrity.
                  </p>
                </div>

                {/* Empower */}
                <div className="space-y-2 p-4 rounded-lg bg-background/50 border border-border hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                    <h3 className="font-bold text-sm">Empower</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We give everyone the authority, tools, and backing to make decisions and take action. When people feel trusted and supported, they deliver their best.
                  </p>
                </div>

                {/* Evolve */}
                <div className="space-y-2 p-4 rounded-lg bg-background/50 border border-border hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <h3 className="font-bold text-sm">Evolve</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We are committed to constant growth. We learn fast, embrace change, turn challenges into opportunities, and keep getting better every day.
                  </p>
                </div>

                {/* Enjoy */}
                <div className="space-y-2 p-4 rounded-lg bg-background/50 border border-border hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Smile className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    <h3 className="font-bold text-sm">Enjoy</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We believe great results come when we genuinely enjoy what we do. We celebrate wins, look after each other, and keep the workplace positive and human.
                  </p>
                </div>

                {/* Measure */}
                <div className="space-y-2 p-4 rounded-lg bg-background/50 border border-border hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <h3 className="font-bold text-sm">Measure</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We set clear targets, track progress honestly, and use real data to improve. What we measure, we manage—and we always aim higher.
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-center font-medium text-muted-foreground">
                  This is TEEEM. Simple, strong, and true to us.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Activity & Upcoming */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card data-tour="recent-items">
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Latest updates from your team</CardDescription>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <Skeleton className="h-8 w-8 rounded" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-3/4 mb-1" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : activity.length === 0 ? (
                  <div className="py-6 text-center">
                    <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activity.map((item, i) => {
                      const Icon = ICON_MAP[item.icon] || Clock;
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <div className="p-2 bg-secondary rounded">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.timeAgo}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming */}
            <Card data-tour="tasks-widget">
              <CardHeader>
                <CardTitle className="text-lg">Upcoming Schedule</CardTitle>
                <CardDescription>Tasks and deadlines this week</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between py-2">
                        <div className="flex-1">
                          <Skeleton className="h-4 w-3/4 mb-1" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </div>
                    ))}
                  </div>
                ) : upcoming.length === 0 ? (
                  <div className="py-6 text-center">
                    <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Nothing scheduled this week</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {upcoming.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            {item.dateLabel}
                          </p>
                        </div>
                        <Badge variant="secondary">{item.category}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/jobs/new">
                    <Briefcase className="h-4 w-4 mr-2" />
                    New Job
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/purchase_orders/new">
                    <FileText className="h-4 w-4 mr-2" />
                    Create PO
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/contacts/new">
                    <Users className="h-4 w-4 mr-2" />
                    Add Contact
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/meetings/new">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Meeting
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Competitor Comparison Tab */}
        <TabsContent value="competitor">
          <FeaturesTrackingTable />
        </TabsContent>

        {/* Architecture Tab */}
        <TabsContent value="architecture">
          <ArchitectureMap activeSubTab={subTab} onSubTabChange={(tab) => router.push(`/dashboard/architecture/${tab}`, { scroll: false })} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
