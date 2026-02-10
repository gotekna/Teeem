"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
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
  Calendar,
  Clock,
  Mail,
  FileText,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Send,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/utils/formatters";

interface ScheduledReport {
  id: number;
  name: string;
  report_type: string;
  report_type_label: string;
  frequency: string;
  format: string;
  day_of_week: number | null;
  day_of_month: number | null;
  send_at: string | null;
  recipients: string[];
  active: boolean;
  last_sent_at: string | null;
  next_send_at: string | null;
  send_count: number;
  last_error: string | null;
  created_by: string;
  created_at: string;
}

interface ReportHistory {
  id: number;
  name: string;
  report_type: string;
  last_sent_at: string;
  recipients: string[];
  send_count: number;
}

export default function ScheduledReportsTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [history, setHistory] = useState<ReportHistory[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const fetchData = useCallback(async () => {
    try {
      const activeParam = filter === "all" ? "" : `?active=${filter === "active"}`;
      const [reportsRes, historyRes] = await Promise.all([
        api.get<{ success: boolean; data: ScheduledReport[] }>(`/api/v1/gl/scheduled_reports${activeParam}`),
        api.get<{ success: boolean; data: ReportHistory[] }>("/api/v1/gl/scheduled_reports/history"),
      ]);

      if (reportsRes?.success) setReports(reportsRes.data || []);
      if (historyRes?.success) setHistory(historyRes.data || []);
    } catch (error) {
      console.error("Failed to fetch scheduled reports:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handlePause = async (report: ScheduledReport) => {
    try {
      await api.post(`/api/v1/gl/scheduled_reports/${report.id}/pause`);
      fetchData();
    } catch (error) {
      console.error("Failed to pause report:", error);
    }
  };

  const handleResume = async (report: ScheduledReport) => {
    try {
      await api.post(`/api/v1/gl/scheduled_reports/${report.id}/resume`);
      fetchData();
    } catch (error) {
      console.error("Failed to resume report:", error);
    }
  };

  const handleSendNow = async (report: ScheduledReport) => {
    try {
      await api.post(`/api/v1/gl/scheduled_reports/${report.id}/send_now`);
      fetchData();
    } catch (error) {
      console.error("Failed to send report:", error);
    }
  };

  const getFrequencyLabel = (report: ScheduledReport) => {
    switch (report.frequency) {
      case "daily":
        return `Daily at ${report.send_at || "9:00 AM"}`;
      case "weekly":
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return `Weekly on ${days[report.day_of_week || 1]}`;
      case "monthly":
        return `Monthly on day ${report.day_of_month || 1}`;
      case "quarterly":
        return "Quarterly";
      case "yearly":
        return "Yearly";
      default:
        return report.frequency;
    }
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  const activeCount = reports.filter(r => r.active).length;
  const totalSent = reports.reduce((sum, r) => sum + r.send_count, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Schedules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
            <p className="text-xs text-muted-foreground mt-1">configured reports</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">running schedules</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paused
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{reports.length - activeCount}</div>
            <p className="text-xs text-muted-foreground mt-1">paused schedules</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSent}</div>
            <p className="text-xs text-muted-foreground mt-1">reports delivered</p>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Reports List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Reports
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Paused</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No scheduled reports</p>
              <p className="text-sm mt-1">Create a schedule to automate report delivery</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Last Sent</TableHead>
                  <TableHead>Next Send</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <div className="font-medium">{report.name}</div>
                      {report.last_error && (
                        <div className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {report.last_error}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{report.report_type_label}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{getFrequencyLabel(report)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{report.format.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{report.recipients.length}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDateTime(report.last_sent_at)}</TableCell>
                    <TableCell>{formatDateTime(report.next_send_at)}</TableCell>
                    <TableCell className="text-center">
                      {report.active ? (
                        <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Pause className="h-3 w-3 mr-1" />
                          Paused
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSendNow(report)}
                          title="Send Now"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        {report.active ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePause(report)}
                            title="Pause"
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResume(report)}
                            title="Resume"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Recent Deliveries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead className="text-right">Total Sends</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.slice(0, 10).map((item) => (
                  <TableRow key={`${item.id}-${item.last_sent_at}`}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.report_type}</Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(item.last_sent_at)}</TableCell>
                    <TableCell>{item.recipients.join(", ")}</TableCell>
                    <TableCell className="text-right">{item.send_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
