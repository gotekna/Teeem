"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Users,
  HardHat,
  ClipboardCheck,
  Loader2,
  Plus,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";

interface WHSStats {
  active_swms: number;
  pending_inductions: number;
  incidents_this_month: number;
  compliance_score: number;
  expiring_licenses: number;
}

interface WHSIncident {
  id: number;
  title: string;
  job_title: string;
  severity: string;
  status: string;
  reported_at: string;
  reported_by: string;
}

interface SWMS {
  id: number;
  name: string;
  job_title: string;
  status: string;
  valid_until: string;
  workers_count: number;
}

function getSeverityBadge(severity: string) {
  switch (severity?.toLowerCase()) {
    case "high":
      return <Badge variant="destructive">High</Badge>;
    case "medium":
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Medium</Badge>;
    case "low":
      return <Badge variant="secondary">Low</Badge>;
    default:
      return <Badge variant="outline">{severity}</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status?.toLowerCase()) {
    case "active":
    case "approved":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>;
    case "pending":
      return <Badge variant="secondary">Pending</Badge>;
    case "expired":
      return <Badge variant="destructive">Expired</Badge>;
    case "investigating":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Investigating</Badge>;
    case "resolved":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Resolved</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function WHSPage() {
  const router = useRouter();
  const [stats, setStats] = React.useState<WHSStats | null>(null);
  const [incidents, setIncidents] = React.useState<WHSIncident[]>([]);
  const [swms, setSwms] = React.useState<SWMS[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchWHSData = async () => {
      try {
        const [statsData, incidentsData, swmsData] = await Promise.all([
          api.get<WHSStats>("/api/v1/whs/stats"),
          api.get<{ incidents: WHSIncident[] }>("/api/v1/whs/incidents"),
          api.get<{ swms: SWMS[] }>("/api/v1/whs/swms"),
        ]);
        setStats(statsData);
        setIncidents(incidentsData.incidents || []);
        setSwms(swmsData.swms || []);
      } catch (error) {
        console.error("Failed to fetch WHS data:", error);
        // Mock data for development
        setStats({
          active_swms: 12,
          pending_inductions: 3,
          incidents_this_month: 1,
          compliance_score: 94,
          expiring_licenses: 2,
        });
        setIncidents([]);
        setSwms([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWHSData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">
            Workplace Health & Safety
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage safety compliance, SWMS, and incident reporting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push("/whs/incidents")}>
            <AlertTriangle className="h-4 w-4 mr-2" />
            Report Incident
          </Button>
          <Button onClick={() => router.push("/whs/swms/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Create SWMS
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => router.push("/whs/swms")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <ClipboardCheck className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium">SWMS Management</h3>
                  <p className="text-sm text-muted-foreground">
                    Safe Work Method Statements
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => router.push("/whs/inductions")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium">Site Inductions</h3>
                  <p className="text-sm text-muted-foreground">
                    Worker induction records
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => router.push("/whs/inspections")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <ClipboardCheck className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-medium">Site Inspections</h3>
                  <p className="text-sm text-muted-foreground">
                    Safety audits & checklists
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Quick Actions Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => router.push("/whs/incidents")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-medium">Incident Reports</h3>
                  <p className="text-sm text-muted-foreground">
                    Track & investigate incidents
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => router.push("/whs/licenses")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <HardHat className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium">License Tracking</h3>
                  <p className="text-sm text-muted-foreground">
                    Worker certifications & licenses
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => router.push("/whs/action-items")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-medium">Action Items</h3>
                  <p className="text-sm text-muted-foreground">
                    Outstanding safety actions
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Incidents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Incidents</CardTitle>
              <CardDescription>Reported safety incidents</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push("/whs/incidents")}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {incidents.length > 0 ? (
              <div className="space-y-4">
                {incidents.slice(0, 5).map((incident) => (
                  <div
                    key={incident.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <div>
                        <p className="font-medium">{incident.title}</p>
                        <p className="text-sm text-muted-foreground">{incident.job_title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getSeverityBadge(incident.severity)}
                      {getStatusBadge(incident.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
                <p className="text-muted-foreground">No incidents reported</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active SWMS */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Active SWMS</CardTitle>
              <CardDescription>Safe Work Method Statements</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push("/whs/swms")}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {swms.length > 0 ? (
              <div className="space-y-4">
                {swms.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.job_title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {item.workers_count} workers
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Valid until {new Date(item.valid_until).toLocaleDateString("en-AU")}
                        </p>
                      </div>
                      {getStatusBadge(item.status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No SWMS found</p>
                <Button className="mt-2" variant="outline" size="sm">
                  Create SWMS
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
