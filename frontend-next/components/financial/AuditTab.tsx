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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  FileText,
  History,
  Camera,
  Download,
  User,
  Calendar,
  Activity,
  Shield,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";

interface AuditLog {
  id: number;
  action: string;
  auditable_type: string;
  auditable_id: number;
  user: { id: number; name: string } | null;
  changes: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AuditSnapshot {
  id: number;
  snapshot_type: string;
  reference: string;
  snapshot_date: string;
  data_summary: {
    accounts: number;
    transactions: number;
    balance: number;
  };
  created_by: { id: number; name: string } | null;
  created_at: string;
}

interface AuditSummary {
  total_logs: number;
  today: number;
  this_week: number;
  by_action: Record<string, number>;
  by_type: Record<string, number>;
  snapshots: {
    daily: number;
    monthly: number;
    eofy: number;
    last_snapshot: string | null;
  };
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AuditTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [snapshots, setSnapshots] = useState<AuditSnapshot[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [activeTab, setActiveTab] = useState("logs");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (actionFilter !== "all") params.append("action", actionFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);
      const queryString = params.toString() ? `?${params.toString()}` : "";

      const [logsRes, snapshotsRes, summaryRes] = await Promise.all([
        api.get<{ success: boolean; data: AuditLog[] }>(`/api/v1/gl/audit/logs${queryString}`),
        api.get<{ success: boolean; data: AuditSnapshot[] }>("/api/v1/gl/audit/snapshots"),
        api.get<{ success: boolean; data: AuditSummary }>("/api/v1/gl/audit/summary"),
      ]);

      if (logsRes?.success) setLogs(logsRes.data || []);
      if (snapshotsRes?.success) setSnapshots(snapshotsRes.data || []);
      if (summaryRes?.success) setSummary(summaryRes.data || null);
    } catch (error) {
      console.error("Failed to fetch audit data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [actionFilter, typeFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCreateSnapshot = async (type: string) => {
    try {
      await api.post("/api/v1/gl/audit/snapshots", { snapshot_type: type });
      fetchData();
    } catch (error) {
      console.error("Failed to create snapshot:", error);
    }
  };

  const handleExportSnapshot = async (snapshot: AuditSnapshot) => {
    try {
      window.open(`/api/v1/gl/audit/snapshots/${snapshot.id}/export`, "_blank");
    } catch (error) {
      console.error("Failed to export snapshot:", error);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "create":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            Create
          </Badge>
        );
      case "update":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            Update
          </Badge>
        );
      case "delete":
        return (
          <Badge variant="destructive">Delete</Badge>
        );
      case "login":
        return (
          <Badge variant="outline">Login</Badge>
        );
      case "approve":
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
            Approve
          </Badge>
        );
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const getSnapshotTypeBadge = (type: string) => {
    switch (type) {
      case "daily":
        return <Badge variant="outline">Daily</Badge>;
      case "monthly":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            Monthly
          </Badge>
        );
      case "eofy":
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
            EOFY
          </Badge>
        );
      default:
        return <Badge variant="secondary">{type}</Badge>;
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
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_logs || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">audit entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary?.today || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">actions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary?.this_week || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">actions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Snapshots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary?.snapshots?.daily || 0) +
                (summary?.snapshots?.monthly || 0) +
                (summary?.snapshots?.eofy || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {formatDate(summary?.snapshots?.last_snapshot || null)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="logs">Audit Logs</TabsTrigger>
          <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
          <TabsTrigger value="activity">Activity Summary</TabsTrigger>
        </TabsList>

        {/* Audit Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Audit Trail
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                    <SelectItem value="approve">Approve</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Invoice">Invoice</SelectItem>
                    <SelectItem value="Transaction">Transaction</SelectItem>
                    <SelectItem value="Account">Account</SelectItem>
                    <SelectItem value="Contact">Contact</SelectItem>
                    <SelectItem value="Job">Job</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No audit logs</p>
                  <p className="text-sm mt-1">Activity will be recorded here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Record ID</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{formatDateTime(log.created_at)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{log.user?.name || "System"}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.auditable_type}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          #{log.auditable_id}
                        </TableCell>
                        <TableCell>
                          {log.changes && Object.keys(log.changes).length > 0 ? (
                            <span className="text-xs text-muted-foreground">
                              {Object.keys(log.changes).length} field(s) changed
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Snapshots Tab */}
        <TabsContent value="snapshots" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Audit Snapshots
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => handleCreateSnapshot("daily")}>
                  <Camera className="h-4 w-4 mr-2" />
                  Daily Snapshot
                </Button>
                <Button variant="outline" onClick={() => handleCreateSnapshot("monthly")}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Monthly Snapshot
                </Button>
                <Button onClick={() => handleCreateSnapshot("eofy")}>
                  <Shield className="h-4 w-4 mr-2" />
                  EOFY Snapshot
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {snapshots.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No snapshots</p>
                  <p className="text-sm mt-1">Create a snapshot to preserve the current state</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Snapshot Date</TableHead>
                      <TableHead className="text-right">Accounts</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshots.map((snapshot) => (
                      <TableRow key={snapshot.id}>
                        <TableCell className="font-medium font-mono">
                          {snapshot.reference}
                        </TableCell>
                        <TableCell>{getSnapshotTypeBadge(snapshot.snapshot_type)}</TableCell>
                        <TableCell>{formatDate(snapshot.snapshot_date)}</TableCell>
                        <TableCell className="text-right">
                          {snapshot.data_summary?.accounts || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {snapshot.data_summary?.transactions || 0}
                        </TableCell>
                        <TableCell>{snapshot.created_by?.name || "System"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleExportSnapshot(snapshot)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Summary Tab */}
        <TabsContent value="activity" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Actions by Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary?.by_action && Object.entries(summary.by_action).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(summary.by_action).map(([action, count]) => (
                      <div key={action} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getActionBadge(action)}
                        </div>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No activity data</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Activity by Entity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {summary?.by_type && Object.entries(summary.by_type).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(summary.by_type).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <Badge variant="outline">{type}</Badge>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No activity data</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Snapshot Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted text-center">
                  <div className="text-2xl font-bold">{summary?.snapshots?.daily || 0}</div>
                  <p className="text-sm text-muted-foreground">Daily</p>
                </div>
                <div className="p-4 rounded-lg bg-muted text-center">
                  <div className="text-2xl font-bold">{summary?.snapshots?.monthly || 0}</div>
                  <p className="text-sm text-muted-foreground">Monthly</p>
                </div>
                <div className="p-4 rounded-lg bg-muted text-center">
                  <div className="text-2xl font-bold">{summary?.snapshots?.eofy || 0}</div>
                  <p className="text-sm text-muted-foreground">EOFY</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
