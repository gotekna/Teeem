"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  Building2,
  Clock,
  DollarSign,
  Users,
  ShieldCheck,
  Receipt,
  Plus,
  Send,
  Download,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import QuickEnrolDialog from "@/components/sda/QuickEnrolDialog";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SdaDashboardStats {
  totalDwellings: number;
  pendingEnrolments: number;
  monthlyRevenue: number;
  occupancyRate: number;
  complianceScore: number;
  claimsThisMonth: number;
  monthlyRevenueTrend?: number;
  occupancyTrend?: number;
}

interface RevenueBySdaCategory {
  category: string;
  amount: number;
  count: number;
}

interface EnrolmentPipelineStage {
  stage: string;
  count: number;
  label: string;
}

interface SdaDashboardData {
  stats: SdaDashboardStats;
  revenueBySdaCategory: RevenueBySdaCategory[];
  enrolmentPipeline: EnrolmentPipelineStage[];
}

// ─── SDA Category Colours ────────────────────────────────────────────────────

const SDA_CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  HPS: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-200 dark:border-purple-800",
  },
  FA: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  IL: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-200 dark:border-green-800",
  },
  Robust: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
  },
};

function getCategoryStyle(category: string) {
  return (
    SDA_CATEGORY_STYLES[category] ?? {
      bg: "bg-secondary",
      text: "text-secondary-foreground",
      border: "border-border",
    }
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  description?: string;
  trend?: number;
  href?: string;
}

function StatCard({ title, value, icon: Icon, iconBg, iconColor, description, trend, href }: StatCardProps) {
  const router = useRouter();
  const handleClick = () => {
    if (href) router.push(href);
  };

  return (
    <Card
      className={href ? "cursor-pointer hover:bg-secondary/30 transition-colors" : ""}
      onClick={href ? handleClick : undefined}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold font-mono">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend !== undefined && (
              <div
                className={`flex items-center gap-1 text-xs font-medium ${
                  trend >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {trend >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(trend)}% vs last month
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg ${iconBg}`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SdaDashboardPage() {
  const [data, setData] = useState<SdaDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [quickEnrolOpen, setQuickEnrolOpen] = useState(false);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get<{ success: boolean; data: SdaDashboardData }>(
          "/api/v1/sda/dashboard"
        );
        if (res?.data) setData(res.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const stats = data?.stats;

  const statCards: StatCardProps[] = stats
    ? [
        {
          title: "Total SDA Dwellings",
          value: stats.totalDwellings,
          icon: Building2,
          iconBg: "bg-blue-100 dark:bg-blue-900/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          description: "Enrolled & active",
          href: "/properties/sda/properties",
        },
        {
          title: "Pending Enrolments",
          value: stats.pendingEnrolments,
          icon: Clock,
          iconBg: "bg-amber-100 dark:bg-amber-900/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          description: "Awaiting NDIA approval",
          href: "/properties/sda/enrolments",
        },
        {
          title: "Monthly Revenue",
          value: `$${Math.round(stats.monthlyRevenue).toLocaleString()}`,
          icon: DollarSign,
          iconBg: "bg-green-100 dark:bg-green-900/30",
          iconColor: "text-green-600 dark:text-green-400",
          description: "SDA rental income",
          trend: stats.monthlyRevenueTrend,
        },
        {
          title: "Occupancy Rate",
          value: `${stats.occupancyRate}%`,
          icon: Users,
          iconBg: "bg-purple-100 dark:bg-purple-900/30",
          iconColor: "text-purple-600 dark:text-purple-400",
          description: "Current occupancy",
          trend: stats.occupancyTrend,
        },
        {
          title: "Compliance Score",
          value: `${stats.complianceScore}%`,
          icon: ShieldCheck,
          iconBg:
            stats.complianceScore >= 90
              ? "bg-green-100 dark:bg-green-900/30"
              : stats.complianceScore >= 70
              ? "bg-amber-100 dark:bg-amber-900/30"
              : "bg-red-100 dark:bg-red-900/30",
          iconColor:
            stats.complianceScore >= 90
              ? "text-green-600 dark:text-green-400"
              : stats.complianceScore >= 70
              ? "text-amber-600 dark:text-amber-400"
              : "text-red-600 dark:text-red-400",
          description: "Portfolio compliance",
          href: "/properties/sda/compliance",
        },
        {
          title: "Claims This Month",
          value: stats.claimsThisMonth,
          icon: Receipt,
          iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
          iconColor: "text-indigo-600 dark:text-indigo-400",
          description: "NDIS claims submitted",
          href: "/properties/sda/claims",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setQuickEnrolOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Quick Enrol
        </Button>
        <Button variant="outline" size="sm">
          <Send className="h-3.5 w-3.5 mr-1.5" />
          Submit Monthly Claims
        </Button>
        <Button variant="outline" size="sm">
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Download Report
        </Button>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-7 w-20" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-11 w-11 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load dashboard stats</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </div>
      )}

      {/* Bottom row: Revenue by Category + Enrolment Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by SDA Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by SDA Category</CardTitle>
            <CardDescription>Monthly rental income breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-6 w-14 rounded" />
                    <div className="flex-1">
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : !data?.revenueBySdaCategory?.length ? (
              <div className="py-6 text-center">
                <DollarSign className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No revenue data available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const maxAmount = Math.max(
                    ...data.revenueBySdaCategory.map((c) => c.amount)
                  );
                  return data.revenueBySdaCategory.map((cat) => {
                    const style = getCategoryStyle(cat.category);
                    const pct = maxAmount > 0 ? (cat.amount / maxAmount) * 100 : 0;
                    return (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`${style.bg} ${style.text} border ${style.border} text-xs`}
                              variant="outline"
                            >
                              {cat.category}
                            </Badge>
                            <span className="text-muted-foreground text-xs">
                              {cat.count} {cat.count === 1 ? "dwelling" : "dwellings"}
                            </span>
                          </div>
                          <span className="font-mono font-medium text-xs">
                            ${Math.round(cat.amount).toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${style.bg.replace("/30", "")}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Enrolment Pipeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Enrolment Pipeline</CardTitle>
              <CardDescription>Properties in enrolment process</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <a href="/properties/sda/enrolments" className="text-xs flex items-center gap-1">
                View All
                <ArrowRight className="h-3 w-3" />
              </a>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-6 w-8 rounded-full" />
                  </div>
                ))}
              </div>
            ) : !data?.enrolmentPipeline?.length ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No enrolments in pipeline</p>
              </div>
            ) : (
              <div className="space-y-1">
                {data.enrolmentPipeline.map((stage, idx) => {
                  const isLast = idx === data.enrolmentPipeline.length - 1;
                  return (
                    <div key={stage.stage} className="relative">
                      <div className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {/* Funnel step indicator */}
                          <div
                            className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              isLast
                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <span className="text-sm">{stage.label}</span>
                        </div>
                        <Badge
                          variant={stage.count > 0 ? "default" : "secondary"}
                          className="font-mono text-xs"
                        >
                          {stage.count}
                        </Badge>
                      </div>
                      {/* Connector line */}
                      {!isLast && (
                        <div className="absolute left-[22px] top-full w-px h-1 bg-border" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Enrol Dialog */}
      <QuickEnrolDialog
        open={quickEnrolOpen}
        onOpenChange={setQuickEnrolOpen}
        onSuccess={() => {
          setQuickEnrolOpen(false);
          // Refresh dashboard data
          setLoading(true);
          setError(false);
          api
            .get<{ success: boolean; data: SdaDashboardData }>("/api/v1/sda/dashboard")
            .then((res) => {
              if (res?.data) setData(res.data);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
        }}
      />
    </div>
  );
}
