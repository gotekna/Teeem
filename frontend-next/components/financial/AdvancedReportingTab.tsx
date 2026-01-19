"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  Building2,
  Tags,
  Target,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  FileText,
  Users,
  Calendar,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/utils/formatters";

interface Department {
  id: number;
  name: string;
  code: string;
  parent: { id: number; name: string } | null;
  manager: { id: number; name: string } | null;
  active: boolean;
  budget_amount: number | null;
}

interface TrackingClass {
  id: number;
  name: string;
  code: string;
  class_type: string;
  parent: { id: number; name: string } | null;
  active: boolean;
}

interface KPI {
  id: number;
  name: string;
  code: string;
  category: string;
  value: number;
  formatted: string;
  status: "good" | "warning" | "critical" | "neutral";
  target: number | null;
}

interface PeriodSnapshot {
  id: number;
  period_type: string;
  period_start: string;
  period_end: string;
  label: string | null;
  finalized: boolean;
  created_at: string;
}

interface DocumentRequest {
  id: number;
  title: string;
  contact: { id: number; name: string };
  due_date: string;
  status: string;
  documents_count: number;
  completed_count: number;
  created_at: string;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdvancedReportingTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("kpis");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [trackingClasses, setTrackingClasses] = useState<TrackingClass[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [snapshots, setSnapshots] = useState<PeriodSnapshot[]>([]);
  const [documentRequests, setDocumentRequests] = useState<DocumentRequest[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [deptRes, classRes, kpiRes, snapRes, docRes] = await Promise.all([
        api.get<{ success: boolean; data: Department[] }>("/api/v1/gl/advanced_reporting/departments"),
        api.get<{ success: boolean; data: TrackingClass[] }>("/api/v1/gl/advanced_reporting/tracking_classes"),
        api.get<{ success: boolean; data: KPI[] }>("/api/v1/gl/advanced_reporting/kpi_dashboard"),
        api.get<{ success: boolean; data: PeriodSnapshot[] }>("/api/v1/gl/advanced_reporting/snapshots"),
        api.get<{ success: boolean; data: DocumentRequest[] }>("/api/v1/gl/advanced_reporting/document_requests"),
      ]);

      if (deptRes?.success) setDepartments(deptRes.data || []);
      if (classRes?.success) setTrackingClasses(classRes.data || []);
      if (kpiRes?.success) setKpis(kpiRes.data || []);
      if (snapRes?.success) setSnapshots(snapRes.data || []);
      if (docRes?.success) setDocumentRequests(docRes.data || []);
    } catch (error) {
      console.error("Failed to fetch advanced reporting data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getKpiStatusBadge = (status: string) => {
    switch (status) {
      case "good":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Good</Badge>;
      case "warning":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">Warning</Badge>;
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      default:
        return <Badge variant="secondary">-</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Departments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {departments.filter(d => d.active).length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Tags className="h-4 w-4" />
              Tracking Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trackingClasses.length}</div>
            <p className="text-xs text-muted-foreground mt-1">for segmentation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Active KPIs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {kpis.filter(k => k.status === "good").length} on target
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Period Snapshots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{snapshots.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {snapshots.filter(s => s.finalized).length} finalized
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Doc Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documentRequests.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {documentRequests.filter(d => d.status === "pending").length} pending
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Advanced Reporting
          </CardTitle>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="kpis" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                KPI Dashboard
              </TabsTrigger>
              <TabsTrigger value="departments" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Departments
              </TabsTrigger>
              <TabsTrigger value="tracking" className="flex items-center gap-2">
                <Tags className="h-4 w-4" />
                Tracking Classes
              </TabsTrigger>
              <TabsTrigger value="snapshots" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Period Snapshots
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Document Requests
              </TabsTrigger>
            </TabsList>

            {/* KPI Dashboard */}
            <TabsContent value="kpis" className="mt-4">
              {kpis.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No KPIs configured</p>
                  <p className="text-sm mt-1">Set up KPIs to track key business metrics</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {kpis.map((kpi) => (
                    <Card key={kpi.id} className={kpi.status === "critical" ? "border-red-200 dark:border-red-800" : kpi.status === "warning" ? "border-yellow-200 dark:border-yellow-800" : ""}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">{kpi.name}</CardTitle>
                          {getKpiStatusBadge(kpi.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">{kpi.category}</p>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{kpi.formatted}</div>
                        {kpi.target && (
                          <div className="mt-2">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>Target: {kpi.target}</span>
                              <span>{((kpi.value / kpi.target) * 100).toFixed(0)}%</span>
                            </div>
                            <Progress value={Math.min((kpi.value / kpi.target) * 100, 100)} className="h-2" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Departments */}
            <TabsContent value="departments" className="mt-4">
              {departments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No departments configured</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Parent</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map((dept) => (
                      <TableRow key={dept.id}>
                        <TableCell className="font-mono">{dept.code}</TableCell>
                        <TableCell className="font-medium">{dept.name}</TableCell>
                        <TableCell>{dept.parent?.name || "-"}</TableCell>
                        <TableCell>
                          {dept.manager ? (
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              {dept.manager.name}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {dept.budget_amount ? formatCurrency(dept.budget_amount) : "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {dept.active ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Tracking Classes */}
            <TabsContent value="tracking" className="mt-4">
              {trackingClasses.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Tags className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No tracking classes configured</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Parent</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trackingClasses.map((tc) => (
                      <TableRow key={tc.id}>
                        <TableCell className="font-mono">{tc.code}</TableCell>
                        <TableCell className="font-medium">{tc.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{tc.class_type}</Badge>
                        </TableCell>
                        <TableCell>{tc.parent?.name || "-"}</TableCell>
                        <TableCell className="text-center">
                          {tc.active ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Period Snapshots */}
            <TabsContent value="snapshots" className="mt-4">
              {snapshots.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No period snapshots created</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshots.map((snapshot) => (
                      <TableRow key={snapshot.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(snapshot.period_start)} - {formatDate(snapshot.period_end)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{snapshot.period_type}</Badge>
                        </TableCell>
                        <TableCell>{snapshot.label || "-"}</TableCell>
                        <TableCell>{formatDate(snapshot.created_at)}</TableCell>
                        <TableCell className="text-center">
                          {snapshot.finalized ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Finalized
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Draft</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Document Requests */}
            <TabsContent value="documents" className="mt-4">
              {documentRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No document requests</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-center">Progress</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">{request.title}</TableCell>
                        <TableCell>{request.contact?.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {formatDate(request.due_date)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 justify-center">
                            <Progress
                              value={request.documents_count > 0 ? (request.completed_count / request.documents_count) * 100 : 0}
                              className="w-20 h-2"
                            />
                            <span className="text-xs">{request.completed_count}/{request.documents_count}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={request.status === "completed" ? "default" : request.status === "overdue" ? "destructive" : "secondary"}>
                            {request.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
