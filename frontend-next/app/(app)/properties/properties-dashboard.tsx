"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  Home,
  Users,
  CalendarClock,
  Accessibility,
  Plus,
  Building2,
  List,
  ArrowRight,
  AlertCircle,
  Settings2,
} from "lucide-react";

interface PropertyStats {
  total: number;
  sdaEnrolled: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  activeTenancies: number;
  upcomingInspections: number;
}

interface RecentProperty {
  id: number;
  name: string;
  street_address: string;
  property_code: string;
  property_type: { id: number; name: string } | null;
  property_status: { id: number; name: string; color: string } | null;
}

export default function PropertiesDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<PropertyStats | null>(null);
  const [recent, setRecent] = useState<RecentProperty[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get<{ success: boolean; data: PropertyStats }>("/api/v1/properties/stats");
        if (res?.data) setStats(res.data);
      } catch {
        setStatsError(true);
      } finally {
        setStatsLoading(false);
      }
    };

    const fetchRecent = async () => {
      try {
        const res = await api.get<{ success: boolean; data: RecentProperty[] }>("/api/v1/properties?limit=8");
        if (res?.data) setRecent(res.data.slice(0, 8));
        else if (Array.isArray(res)) setRecent((res as RecentProperty[]).slice(0, 8));
      } catch {
        // Non-critical
      } finally {
        setRecentLoading(false);
      }
    };

    fetchStats();
    fetchRecent();
  }, []);

  const statCards = stats
    ? [
        {
          title: "Total Properties",
          value: stats.total,
          icon: Home,
          color: "text-blue-600 dark:text-blue-400",
          bg: "bg-blue-100 dark:bg-blue-900/30",
        },
        {
          title: "Active Tenancies",
          value: stats.activeTenancies,
          icon: Users,
          color: "text-green-600 dark:text-green-400",
          bg: "bg-green-100 dark:bg-green-900/30",
        },
        {
          title: "Upcoming Inspections",
          value: stats.upcomingInspections,
          icon: CalendarClock,
          color: "text-amber-600 dark:text-amber-400",
          bg: "bg-amber-100 dark:bg-amber-900/30",
        },
        {
          title: "SDA Enrolled",
          value: stats.sdaEnrolled,
          icon: Accessibility,
          color: "text-purple-600 dark:text-purple-400",
          bg: "bg-purple-100 dark:bg-purple-900/30",
        },
      ]
    : [];

  return (
    <div className="space-y-6 -mt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Property Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your property portfolio
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/properties/list">
              <List className="h-3.5 w-3.5 mr-1.5" />
              View All
            </Link>
          </Button>
          <Button size="sm" onClick={() => router.push("/properties/list")}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Property
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div>
                    <Skeleton className="h-3 w-24 mb-2" />
                    <Skeleton className="h-7 w-12" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : statsError ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Unable to load property stats</p>
            </CardContent>
          </Card>
        ) : (
          statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${stat.bg}`}>
                      <Icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold font-mono">{stat.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Middle row: Quick Actions + Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" size="sm" asChild>
              <Link href="/properties/list">
                <Plus className="h-3.5 w-3.5 mr-2" />
                Add New Property
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => router.push("/properties/list")}>
              <Building2 className="h-3.5 w-3.5 mr-2" />
              Create from Job
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm" asChild>
              <Link href="/properties/list">
                <List className="h-3.5 w-3.5 mr-2" />
                View All Properties
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm" asChild>
              <Link href="/properties/setup">
                <Settings2 className="h-3.5 w-3.5 mr-2" />
                Module Setup
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* By Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            ) : stats && Object.keys(stats.byStatus).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(stats.byStatus)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm">{status}</span>
                      <Badge variant="secondary" className="font-mono">{count}</Badge>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No status data</p>
            )}
          </CardContent>
        </Card>

        {/* By Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Type</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            ) : stats && Object.keys(stats.byType).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(stats.byType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm">{type}</span>
                      <Badge variant="secondary" className="font-mono">{count}</Badge>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No type data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Properties */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Properties</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/properties/list" className="text-xs">
              View All
              <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48 mb-1" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="py-8 text-center">
              <Home className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No properties yet</p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href="/properties/list">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add First Property
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {recent.map((property) => (
                <Link
                  key={property.id}
                  href={`/properties/${property.id}`}
                  className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-secondary/50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {property.property_code && (
                        <span className="text-xs font-mono text-muted-foreground">{property.property_code}</span>
                      )}
                      <span className="text-sm font-medium truncate">
                        {property.name || property.street_address || "Unnamed Property"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {property.street_address && property.name && (
                        <span className="text-xs text-muted-foreground truncate">{property.street_address}</span>
                      )}
                      {property.property_type && (
                        <span className="text-xs text-muted-foreground">{property.property_type.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {property.property_status && (
                      <Badge
                        variant="secondary"
                        className="text-xs"
                        style={property.property_status.color ? { backgroundColor: property.property_status.color + "20", color: property.property_status.color } : undefined}
                      >
                        {property.property_status.name}
                      </Badge>
                    )}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
