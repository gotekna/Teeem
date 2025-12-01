"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Shield,
  Building2,
  FileText,
  Settings,
  ChevronRight,
  UserPlus,
  Briefcase,
  Tags,
  Workflow,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { api } from "@/lib/api";

interface AdminStats {
  total_users: number;
  active_users: number;
  roles_count: number;
  job_types_count: number;
  job_statuses_count: number;
}

export default function AdminPage() {
  const router = useRouter();
  const { can } = usePermission();
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.get<AdminStats>("/api/v1/admin/stats");
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch admin stats:", error);
        // Mock data for development
        setStats({
          total_users: 12,
          active_users: 10,
          roles_count: 5,
          job_types_count: 8,
          job_statuses_count: 6,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const adminSections = [
    {
      title: "User Management",
      description: "Manage users, invitations, and permissions",
      icon: Users,
      href: "/admin/users",
      stats: `${stats?.active_users || 0} active users`,
      color: "bg-blue-100 text-blue-600",
    },
    {
      title: "Roles & Permissions",
      description: "Configure access control and permissions",
      icon: Shield,
      href: "/admin/roles",
      stats: `${stats?.roles_count || 0} roles configured`,
      color: "bg-purple-100 text-purple-600",
    },
    {
      title: "Job Types",
      description: "Define job types and categories",
      icon: Briefcase,
      href: "/admin/job-types",
      stats: `${stats?.job_types_count || 0} job types`,
      color: "bg-green-100 text-green-600",
    },
    {
      title: "Job Statuses",
      description: "Configure job workflow statuses",
      icon: Workflow,
      href: "/admin/job-statuses",
      stats: `${stats?.job_statuses_count || 0} statuses`,
      color: "bg-orange-100 text-orange-600",
    },
    {
      title: "Price Books",
      description: "Manage pricing and cost libraries",
      icon: Tags,
      href: "/admin/price-books",
      stats: "Cost management",
      color: "bg-cyan-100 text-cyan-600",
    },
    {
      title: "Templates",
      description: "Document and email templates",
      icon: FileText,
      href: "/admin/templates",
      stats: "Forms & documents",
      color: "bg-pink-100 text-pink-600",
    },
    {
      title: "Schedule Master Setup",
      description: "Configure default schedules and tasks",
      icon: Settings,
      href: "/admin/sm-setup",
      stats: "Default schedules",
      color: "bg-indigo-100 text-indigo-600",
    },
    {
      title: "Organization",
      description: "Company settings and branding",
      icon: Building2,
      href: "/settings",
      stats: "Company profile",
      color: "bg-gray-100 text-gray-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Administration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your organization settings and configuration
          </p>
        </div>
        <Button onClick={() => router.push("/admin/users/invite")}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Users</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.total_users || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Active Users</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.active_users || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">Roles</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.roles_count || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Job Types</span>
            </div>
            <p className="text-2xl font-bold mt-1">{stats?.job_types_count || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Admin Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {adminSections.map((section) => (
          <Card
            key={section.href}
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => router.push(section.href)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${section.color}`}>
                    <section.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-medium">{section.title}</h3>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{section.stats}</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
