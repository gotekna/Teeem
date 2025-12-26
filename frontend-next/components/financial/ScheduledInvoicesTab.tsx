"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Plus,
  Calendar,
  Clock,
  Mail,
  FileText,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Trash2,
  Edit,
  Send,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";

interface ScheduledInvoice {
  id: number;
  invoice_id: number;
  invoice_number: string;
  contact_name: string;
  amount: number;
  scheduled_date: string;
  scheduled_time: string | null;
  send_email: boolean;
  email_template_id: number | null;
  status: "pending" | "sent" | "failed" | "cancelled";
  sent_at: string | null;
  error_message: string | null;
  created_by: string;
  created_at: string;
}

interface ScheduleStats {
  pending: number;
  sent_today: number;
  failed: number;
  scheduled_this_week: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScheduledInvoicesTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schedules, setSchedules] = useState<ScheduledInvoice[]>([]);
  const [stats, setStats] = useState<ScheduleStats | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "sent" | "failed">("pending");
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduledInvoice | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [schedulesRes, statsRes] = await Promise.all([
        api.get<{ success: boolean; data: ScheduledInvoice[] }>(
          `/api/v1/gl/scheduled_invoices?status=${filter === "all" ? "" : filter}`
        ),
        api.get<{ success: boolean; data: ScheduleStats }>("/api/v1/gl/scheduled_invoices/stats"),
      ]);

      if (schedulesRes?.success) setSchedules(schedulesRes.data || []);
      if (statsRes?.success) setStats(statsRes.data);
    } catch (error) {
      console.error("Failed to fetch scheduled invoices:", error);
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

  const handleCancel = async (schedule: ScheduledInvoice) => {
    try {
      await api.post(`/api/v1/gl/scheduled_invoices/${schedule.id}/cancel`);
      fetchData();
    } catch (error) {
      console.error("Failed to cancel schedule:", error);
    }
  };

  const handleSendNow = async (schedule: ScheduledInvoice) => {
    try {
      await api.post(`/api/v1/gl/scheduled_invoices/${schedule.id}/send_now`);
      fetchData();
    } catch (error) {
      console.error("Failed to send invoice:", error);
    }
  };

  const handleRetry = async (schedule: ScheduledInvoice) => {
    try {
      await api.post(`/api/v1/gl/scheduled_invoices/${schedule.id}/retry`);
      fetchData();
    } catch (error) {
      console.error("Failed to retry:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "sent":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Sent
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="secondary">
            <Pause className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
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
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground mt-1">scheduled to send</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sent Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.sent_today}</div>
              <p className="text-xs text-muted-foreground mt-1">invoices delivered</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <p className="text-xs text-muted-foreground mt-1">need attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.scheduled_this_week}</div>
              <p className="text-xs text-muted-foreground mt-1">upcoming</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scheduled Invoices List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Invoices
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No scheduled invoices</p>
              <p className="text-sm mt-1">
                {filter === "pending"
                  ? "No invoices scheduled for delivery"
                  : `No ${filter} invoices found`}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Scheduled For</TableHead>
                  <TableHead className="text-center">Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>
                      <div className="font-medium">{schedule.invoice_number}</div>
                    </TableCell>
                    <TableCell>{schedule.contact_name}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(schedule.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {formatDate(schedule.scheduled_date)}
                        {schedule.scheduled_time && (
                          <span className="text-muted-foreground ml-1">
                            {schedule.scheduled_time}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {schedule.send_email ? (
                        <Mail className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(schedule.status)}
                      {schedule.error_message && (
                        <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={schedule.error_message}>
                          {schedule.error_message}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {schedule.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSendNow(schedule)}
                              title="Send Now"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleCancel(schedule)}
                              title="Cancel"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {schedule.status === "failed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetry(schedule)}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Retry
                          </Button>
                        )}
                        {schedule.status === "sent" && schedule.sent_at && (
                          <span className="text-xs text-muted-foreground">
                            Sent {formatDateTime(schedule.sent_at)}
                          </span>
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
    </div>
  );
}
