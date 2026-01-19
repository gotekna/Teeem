"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  Clock,
  MapPin,
  Camera,
  User,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Timer,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDistanceToNow, format } from "date-fns";
import { formatCurrency } from "@/utils/formatters";

interface WorkerProfile {
  id: number;
  display_name: string;
  worker_type: string;
  profile_photo_url?: string;
}

interface SitePresenceSession {
  id: number;
  worker_profile_id: number;
  job_id: number;
  checkin_at: string;
  checkout_at?: string;
  status: string;
  total_hours?: number;
  billable_hours?: number;
  break_minutes?: number;
  latitude_checkin?: number;
  longitude_checkin?: number;
  distance_from_site_checkin?: number;
  gps_verified_checkin: boolean;
  face_verified_checkin: boolean;
  face_confidence_checkin?: number;
  approval_status: string;
  worker_notes?: string;
  supervisor_notes?: string;
  worker_profile?: WorkerProfile;
}

interface LabourCostEntry {
  id: number;
  entry_date: string;
  regular_hours: number;
  overtime_1_5x_hours: number;
  overtime_2x_hours: number;
  total_hours: number;
  base_labour_cost: number;
  employment_cost: number;
  overhead_cost: number;
  total_cost: number;
  entry_source: string;
  billing_status: string;
  worker_profile?: WorkerProfile;
}

interface JobSitePresenceTabProps {
  jobId: string | number;
  onUpdate?: () => void;
}

export function JobSitePresenceTab({ jobId, onUpdate }: JobSitePresenceTabProps) {
  const [sessions, setSessions] = useState<SitePresenceSession[]>([]);
  const [labourCosts, setLabourCosts] = useState<LabourCostEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("sessions");
  const [summary, setSummary] = useState({
    totalSessions: 0,
    totalHours: 0,
    totalCost: 0,
    activeSessions: 0,
    pendingApproval: 0,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sessionsRes, costsRes] = await Promise.all([
        api.get<{ success: boolean; sessions: SitePresenceSession[] }>(
          `/api/v1/site_presence_sessions?job_id=${jobId}`
        ),
        api.get<{ success: boolean; entries: LabourCostEntry[] }>(
          `/api/v1/labour_cost_entries?job_id=${jobId}`
        ),
      ]);

      if (sessionsRes?.success) {
        setSessions(sessionsRes.sessions || []);

        // Calculate summary
        const activeSessions = sessionsRes.sessions.filter(s => s.status === "active").length;
        const pendingApproval = sessionsRes.sessions.filter(s => s.approval_status === "pending").length;
        const totalHours = sessionsRes.sessions.reduce((sum, s) => sum + (s.total_hours || 0), 0);

        setSummary(prev => ({
          ...prev,
          totalSessions: sessionsRes.sessions.length,
          totalHours,
          activeSessions,
          pendingApproval,
        }));
      }

      if (costsRes?.success) {
        setLabourCosts(costsRes.entries || []);
        const totalCost = (costsRes.entries || []).reduce((sum, e) => sum + (e.total_cost || 0), 0);
        setSummary(prev => ({ ...prev, totalCost }));
      }
    } catch (error) {
      console.error("Failed to fetch site presence data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const getStatusBadge = (session: SitePresenceSession) => {
    if (session.status === "active") {
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Active</Badge>;
    }
    if (session.approval_status === "pending") {
      return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pending Approval</Badge>;
    }
    if (session.approval_status === "approved") {
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Approved</Badge>;
    }
    if (session.approval_status === "rejected") {
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Rejected</Badge>;
    }
    return <Badge variant="outline">Completed</Badge>;
  };

  const getBillingStatusBadge = (status: string) => {
    switch (status) {
      case "unbilled":
        return <Badge variant="outline">Unbilled</Badge>;
      case "pending_invoice":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pending Invoice</Badge>;
      case "invoiced":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Invoiced</Badge>;
      case "written_off":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Written Off</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Sessions</span>
            </div>
            <p className="text-2xl font-bold mt-1">{summary.totalSessions}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Hours</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatHours(summary.totalHours)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Labour Cost</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(summary.totalCost)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Active Now</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-500">{summary.activeSessions}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-500">{summary.pendingApproval}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="sessions">Sessions ({sessions.length})</TabsTrigger>
            <TabsTrigger value="costs">Labour Costs ({labourCosts.length})</TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <TabsContent value="sessions" className="mt-4">
          {sessions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No site presence sessions yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Workers can check in using the mobile app
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <Card key={session.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {session.worker_profile?.display_name || `Worker #${session.worker_profile_id}`}
                            </span>
                            {getStatusBadge(session)}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(session.checkin_at), "MMM d, yyyy")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(session.checkin_at), "h:mm a")}
                              {session.checkout_at && ` - ${format(new Date(session.checkout_at), "h:mm a")}`}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {session.total_hours !== undefined && (
                          <p className="text-lg font-semibold">{formatHours(session.total_hours)}</p>
                        )}
                        {session.status === "active" && (
                          <p className="text-sm text-green-500">
                            {formatDistanceToNow(new Date(session.checkin_at), { addSuffix: false })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Verification badges */}
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t">
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className={`h-4 w-4 ${session.gps_verified_checkin ? "text-green-500" : "text-yellow-500"}`} />
                        <span className={session.gps_verified_checkin ? "text-green-500" : "text-yellow-500"}>
                          {session.gps_verified_checkin ? "GPS Verified" : "GPS Pending"}
                        </span>
                        {session.distance_from_site_checkin !== undefined && (
                          <span className="text-muted-foreground">
                            ({Math.round(session.distance_from_site_checkin)}m)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        {session.face_verified_checkin ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-green-500">
                              Face Verified
                              {session.face_confidence_checkin && ` (${Math.round(session.face_confidence_checkin * 100)}%)`}
                            </span>
                          </>
                        ) : (
                          <>
                            <Camera className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">No Face Check</span>
                          </>
                        )}
                      </div>
                    </div>

                    {session.worker_notes && (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        &ldquo;{session.worker_notes}&rdquo;
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="costs" className="mt-4">
          {labourCosts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No labour cost entries yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Costs are calculated when sessions are completed
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {labourCosts.map((entry) => (
                <Card key={entry.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {entry.worker_profile?.display_name || "Worker"}
                          </span>
                          {getBillingStatusBadge(entry.billing_status)}
                          <Badge variant="outline" className="text-xs">
                            {entry.entry_source}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {format(new Date(entry.entry_date), "EEEE, MMMM d, yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">{formatCurrency(entry.total_cost)}</p>
                        <p className="text-sm text-muted-foreground">{formatHours(entry.total_hours)}</p>
                      </div>
                    </div>

                    {/* Hours breakdown */}
                    <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t text-sm">
                      <div>
                        <p className="text-muted-foreground">Regular</p>
                        <p className="font-medium">{formatHours(entry.regular_hours)}</p>
                      </div>
                      {entry.overtime_1_5x_hours > 0 && (
                        <div>
                          <p className="text-muted-foreground">OT 1.5x</p>
                          <p className="font-medium text-yellow-500">{formatHours(entry.overtime_1_5x_hours)}</p>
                        </div>
                      )}
                      {entry.overtime_2x_hours > 0 && (
                        <div>
                          <p className="text-muted-foreground">OT 2x</p>
                          <p className="font-medium text-orange-500">{formatHours(entry.overtime_2x_hours)}</p>
                        </div>
                      )}
                    </div>

                    {/* Cost breakdown */}
                    <div className="grid grid-cols-4 gap-4 mt-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Base</p>
                        <p className="font-medium">{formatCurrency(entry.base_labour_cost)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Employment</p>
                        <p className="font-medium">{formatCurrency(entry.employment_cost)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Overhead</p>
                        <p className="font-medium">{formatCurrency(entry.overhead_cost)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-bold">{formatCurrency(entry.total_cost)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
