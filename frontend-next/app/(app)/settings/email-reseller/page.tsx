"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Users,
  Mail,
  DollarSign,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrencyWhole } from "@/utils/formatters";
import type {
  EmailResellerDashboardStats,
  EmailMigration,
  EmailSubscription,
} from "@/lib/email-reseller-types";

interface DashboardData {
  stats: EmailResellerDashboardStats;
  active_migrations: EmailMigration[];
  recent_activity: {
    type: 'subscription_created' | 'migration_completed' | 'invoice_paid' | 'migration_started';
    message: string;
    timestamp: string;
  }[];
}

export default function EmailResellerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [data, setData] = React.useState<DashboardData | null>(null);

  const fetchDashboard = React.useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      // Fetch all dashboard data in parallel
      const [statsRes, migrationsRes, subscriptionsRes] = await Promise.all([
        api.get<{ success: boolean; data: EmailResellerDashboardStats }>(
          "/api/v1/email_subscriptions/dashboard_stats"
        ),
        api.get<{ success: boolean; data: EmailMigration[] }>(
          "/api/v1/email_subscriptions/active_migrations"
        ),
        api.get<{ success: boolean; data: EmailSubscription[] }>(
          "/api/v1/email_subscriptions?limit=5&order=created_at_desc"
        ),
      ]);

      // Build recent activity from subscriptions
      const recentActivity = (subscriptionsRes.data || []).slice(0, 5).map((sub) => ({
        type: 'subscription_created' as const,
        message: `New subscription: ${sub.contact_name} (${sub.domain})`,
        timestamp: sub.created_at,
      }));

      setData({
        stats: statsRes.data || {
          active_subscriptions: 0,
          total_mailboxes: 0,
          monthly_revenue: 0,
          margin_percentage: 0,
          pending_migrations: 0,
          active_migrations: 0,
          completed_migrations_today: 0,
        },
        active_migrations: migrationsRes.data || [],
        recent_activity: recentActivity,
      });
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      // Set empty data on error
      setData({
        stats: {
          active_subscriptions: 0,
          total_mailboxes: 0,
          monthly_revenue: 0,
          margin_percentage: 0,
          pending_migrations: 0,
          active_migrations: 0,
          completed_migrations_today: 0,
        },
        active_migrations: [],
        recent_activity: [],
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  const estimateTimeRemaining = (migration: EmailMigration) => {
    if (migration.progress === 0 || !migration.started_at) return "Calculating...";
    const startTime = new Date(migration.started_at).getTime();
    const elapsed = Date.now() - startTime;
    const totalEstimate = (elapsed / migration.progress) * 100;
    const remaining = totalEstimate - elapsed;
    const mins = Math.ceil(remaining / 60000);
    if (mins < 60) return `~${mins} min`;
    return `~${Math.ceil(mins / 60)} hr`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={() => router.push("/settings/email-reseller/subscriptions")}>
            <Plus className="h-4 w-4 mr-2" />
            New Subscription
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchDashboard(true)}
          disabled={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_subscriptions || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.pending_migrations || 0} pending migrations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mailboxes</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_mailboxes || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across all subscriptions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyWhole(stats?.monthly_revenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">/month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.margin_percentage || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrencyWhole((stats?.monthly_revenue || 0) * (stats?.margin_percentage || 0) / 100)} profit
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Migrations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Active Migrations</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {data?.active_migrations.length || 0} migrations in progress
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/settings/email-reseller/migrations")}
          >
            View All
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardHeader>
        <CardContent>
          {data?.active_migrations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No active migrations</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data?.active_migrations.slice(0, 3).map((migration) => (
                <div
                  key={migration.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{migration.source_email}</p>
                      <p className="text-sm text-muted-foreground">
                        {migration.contact_name || "Unknown"} • {migration.migration_type.replace("_", " ")}
                      </p>
                    </div>
                    <Badge
                      variant={migration.status === "in_progress" ? "default" : "secondary"}
                    >
                      {migration.status === "in_progress" ? "In Progress" : migration.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{migration.progress}%</span>
                      <span className="text-muted-foreground">
                        {estimateTimeRemaining(migration)}
                      </span>
                    </div>
                    <Progress value={migration.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {migration.processed_items.toLocaleString()} / {migration.total_items.toLocaleString()} items
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.recent_activity.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data?.recent_activity.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {activity.type === "subscription_created" && (
                      <Plus className="h-4 w-4 text-green-500" />
                    )}
                    {activity.type === "migration_completed" && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    {activity.type === "invoice_paid" && (
                      <DollarSign className="h-4 w-4 text-blue-500" />
                    )}
                    {activity.type === "migration_started" && (
                      <ArrowRight className="h-4 w-4 text-orange-500" />
                    )}
                    <span className="text-sm">{activity.message}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatTimeAgo(activity.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
