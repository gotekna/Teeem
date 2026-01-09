"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

// Types
interface WhsStats {
  swms: { total: number; approved: number; pending: number };
  inspections: { total: number; completed: number; upcoming: number };
  incidents: { total: number; lti: number; nearMiss: number };
  inductions: { total: number; valid: number; expiring: number };
  actionItems: { total: number; open: number; overdue: number };
}

interface StatCardProps {
  title: string;
  total: number;
  subtitle: string;
  subtitleValue: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  link: string;
}

const StatCard = ({
  title,
  total,
  subtitle,
  subtitleValue,
  icon: Icon,
  color,
  link,
}: StatCardProps) => (
  <Link href={link}>
    <Card className="transition-shadow hover:shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`mt-2 text-3xl font-bold ${color}`}>{total}</p>
            {subtitle && (
              <p className="mt-2 text-sm text-muted-foreground">
                {subtitle}: <span className="font-semibold">{subtitleValue}</span>
              </p>
            )}
          </div>
          <Icon className={`h-12 w-12 opacity-50 ${color}`} />
        </div>
      </CardContent>
    </Card>
  </Link>
);

export default function WhsDashboardPage() {
  const [stats, setStats] = useState<WhsStats>({
    swms: { total: 0, approved: 0, pending: 0 },
    inspections: { total: 0, completed: 0, upcoming: 0 },
    incidents: { total: 0, lti: 0, nearMiss: 0 },
    inductions: { total: 0, valid: 0, expiring: 0 },
    actionItems: { total: 0, open: 0, overdue: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // Fetch all data in parallel
      const [swmsRes, inspectionsRes, incidentsRes, inductionsRes, actionsRes] =
        await Promise.all([
          api.get<{ data: { data: Array<{ status: string }> } }>("/api/v1/whs_swms"),
          api.get<{ data: { data: Array<{ status: string }> } }>("/api/v1/whs_inspections"),
          api.get<{ data: { data: Array<{ incident_category: string }> } }>("/api/v1/whs_incidents"),
          api.get<{ data: { data: Array<{ status: string }> } }>("/api/v1/whs_inductions"),
          api.get<{ data: { data: Array<{ status: string }> } }>("/api/v1/whs_action_items"),
        ]);

      // Calculate statistics
      const swmsData = swmsRes?.data?.data || [];
      const inspectionsData = inspectionsRes?.data?.data || [];
      const incidentsData = incidentsRes?.data?.data || [];
      const inductionsData = inductionsRes?.data?.data || [];
      const actionsData = actionsRes?.data?.data || [];

      setStats({
        swms: {
          total: swmsData.length,
          approved: swmsData.filter((s) => s.status === "approved").length,
          pending: swmsData.filter((s) => s.status === "pending_approval").length,
        },
        inspections: {
          total: inspectionsData.length,
          completed: inspectionsData.filter((i) => i.status === "completed").length,
          upcoming: inspectionsData.filter((i) => i.status === "scheduled").length,
        },
        incidents: {
          total: incidentsData.length,
          lti: incidentsData.filter((i) => i.incident_category === "lti").length,
          nearMiss: incidentsData.filter((i) => i.incident_category === "near_miss").length,
        },
        inductions: {
          total: inductionsData.length,
          valid: inductionsData.filter((i) => i.status === "valid").length,
          expiring: inductionsData.filter((i) => i.status === "expiring_soon").length,
        },
        actionItems: {
          total: actionsData.length,
          open: actionsData.filter((a) => a.status === "open").length,
          overdue: actionsData.filter((a) => a.status === "overdue").length,
        },
      });
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Spinner size={32} className="mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl font-bold">
          <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
          WHS Dashboard
        </h1>
        <p className="mt-2 text-muted-foreground">
          Queensland Construction Workplace Health & Safety Management
        </p>
      </div>

      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="SWMS Documents"
          total={stats.swms.total}
          subtitle="Approved"
          subtitleValue={stats.swms.approved}
          icon={DocumentTextIcon}
          color="text-blue-600"
          link="/whs/swms"
        />

        <StatCard
          title="Site Inspections"
          total={stats.inspections.total}
          subtitle="Completed"
          subtitleValue={stats.inspections.completed}
          icon={ClipboardDocumentCheckIcon}
          color="text-green-600"
          link="/whs/inspections"
        />

        <StatCard
          title="Incidents Reported"
          total={stats.incidents.total}
          subtitle="LTI / Near Miss"
          subtitleValue={`${stats.incidents.lti} / ${stats.incidents.nearMiss}`}
          icon={ExclamationTriangleIcon}
          color="text-orange-600"
          link="/whs/incidents"
        />

        <StatCard
          title="Worker Inductions"
          total={stats.inductions.total}
          subtitle="Valid Certificates"
          subtitleValue={stats.inductions.valid}
          icon={AcademicCapIcon}
          color="text-purple-600"
          link="/whs/inductions"
        />

        <StatCard
          title="Action Items"
          total={stats.actionItems.total}
          subtitle="Open / Overdue"
          subtitleValue={`${stats.actionItems.open} / ${stats.actionItems.overdue}`}
          icon={CheckCircleIcon}
          color="text-indigo-600"
          link="/whs/action-items"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
            <div className="space-y-3">
              <Link
                href="/whs/swms"
                className="block rounded-lg bg-blue-50 px-4 py-3 transition-colors hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
              >
                <p className="font-medium text-blue-900 dark:text-blue-200">Create New SWMS</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Safe Work Method Statement
                </p>
              </Link>
              <Link
                href="/whs/inspections"
                className="block rounded-lg bg-green-50 px-4 py-3 transition-colors hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30"
              >
                <p className="font-medium text-green-900 dark:text-green-200">
                  Schedule Inspection
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">Site safety inspection</p>
              </Link>
              <Link
                href="/whs/incidents"
                className="block rounded-lg bg-orange-50 px-4 py-3 transition-colors hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30"
              >
                <p className="font-medium text-orange-900 dark:text-orange-200">Report Incident</p>
                <p className="text-sm text-orange-700 dark:text-orange-300">Log workplace incident</p>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="mb-4 text-lg font-semibold">WHS Modules</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/whs/swms"
                className="rounded-lg bg-muted p-4 text-center transition-colors hover:bg-muted/80"
              >
                <DocumentTextIcon className="mx-auto mb-2 h-8 w-8 text-blue-600" />
                <p className="text-sm font-medium">SWMS</p>
              </Link>
              <Link
                href="/whs/inspections"
                className="rounded-lg bg-muted p-4 text-center transition-colors hover:bg-muted/80"
              >
                <ClipboardDocumentCheckIcon className="mx-auto mb-2 h-8 w-8 text-green-600" />
                <p className="text-sm font-medium">Inspections</p>
              </Link>
              <Link
                href="/whs/incidents"
                className="rounded-lg bg-muted p-4 text-center transition-colors hover:bg-muted/80"
              >
                <ExclamationTriangleIcon className="mx-auto mb-2 h-8 w-8 text-orange-600" />
                <p className="text-sm font-medium">Incidents</p>
              </Link>
              <Link
                href="/whs/inductions"
                className="rounded-lg bg-muted p-4 text-center transition-colors hover:bg-muted/80"
              >
                <AcademicCapIcon className="mx-auto mb-2 h-8 w-8 text-purple-600" />
                <p className="text-sm font-medium">Inductions</p>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
