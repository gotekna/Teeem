"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import FeaturesTrackingTable from "./components/FeaturesTrackingTable";

interface DashboardStats {
  activeJobs: number;
  pendingPOs: number;
  totalRevenue: number;
  totalContacts: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats] = useState<DashboardStats>({
    activeJobs: 12,
    pendingPOs: 8,
    totalRevenue: 245000,
    totalContacts: 156,
  });

  const statCards = [
    {
      title: "Active Jobs",
      value: stats.activeJobs,
      icon: Briefcase,
      description: "Jobs in progress",
      trend: "+2 this week",
      href: "/jobs",
    },
    {
      title: "Pending POs",
      value: stats.pendingPOs,
      icon: FileText,
      description: "Awaiting approval",
      trend: "3 due today",
      href: "/purchase_orders",
    },
    {
      title: "Revenue (YTD)",
      value: `$${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      description: "Year to date",
      trend: "+12% vs last year",
      href: "/financial",
    },
    {
      title: "Total Contacts",
      value: stats.totalContacts,
      icon: Users,
      description: "Clients & suppliers",
      trend: "+5 this month",
      href: "/contacts",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back, {user?.name || "User"}. Here's what's happening today.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="competitor" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Competitor Comparison
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title} className="hover:bg-secondary/30 transition-colors cursor-pointer">
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
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Activity</CardTitle>
                <CardDescription>Latest updates from your team</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      icon: CheckCircle,
                      title: "PO-2024-0042 approved",
                      time: "2 hours ago",
                      status: "success",
                    },
                    {
                      icon: Clock,
                      title: "Job #1234 schedule updated",
                      time: "4 hours ago",
                      status: "info",
                    },
                    {
                      icon: FileText,
                      title: "New estimate received",
                      time: "Yesterday",
                      status: "warning",
                    },
                    {
                      icon: Users,
                      title: "New supplier added",
                      time: "2 days ago",
                      status: "default",
                    },
                  ].map((activity, i) => {
                    const Icon = activity.icon;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className="p-2 bg-secondary">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{activity.title}</p>
                          <p className="text-xs text-muted-foreground">{activity.time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upcoming Schedule</CardTitle>
                <CardDescription>Tasks and deadlines this week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      title: "Site inspection - Project Alpha",
                      date: "Today, 2:00 PM",
                      type: "Meeting",
                    },
                    {
                      title: "PO deadline - Steel delivery",
                      date: "Tomorrow",
                      type: "Deadline",
                    },
                    {
                      title: "Client review - Beta Corp",
                      date: "Friday, 10:00 AM",
                      type: "Meeting",
                    },
                    {
                      title: "Invoice due - INV-2024-089",
                      date: "Next Monday",
                      type: "Payment",
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {item.date}
                        </p>
                      </div>
                      <Badge variant="secondary">{item.type}</Badge>
                    </div>
                  ))}
                </div>
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
      </Tabs>
    </div>
  );
}
