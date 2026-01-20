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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Target,
  CheckCircle,
  Clock,
  DollarSign,
  Building2,
  Briefcase,
  Play,
  FileText,
  AlertTriangle,
  Calendar,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface BillingMilestone {
  id: number;
  name: string;
  description: string | null;
  job_id: number;
  job_name: string;
  contact_id: number;
  contact_name: string;
  amount: number;
  is_percentage: boolean;
  percentage_of_contract: number | null;
  target_date: string | null;
  completed_date: string | null;
  status: string;
  progress_status: string;
  days_until_target: number | null;
  auto_invoice: boolean;
  invoice_id: number | null;
  invoiced_at: string | null;
  completed_by: string | null;
  completion_notes: string | null;
  sort_order: number;
  created_at: string;
}

export default function BillingMilestonesTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [milestones, setMilestones] = useState<BillingMilestone[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await api.get<{ success: boolean; data: BillingMilestone[] }>(
        `/api/v1/gl/billing_milestones?${params}`
      );

      if (response?.success) setMilestones(response.data || []);
    } catch (error) {
      console.error("Failed to fetch milestones:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleStart = async (milestone: BillingMilestone) => {
    try {
      await api.post(`/api/v1/gl/billing_milestones/${milestone.id}/start`);
      fetchData();
    } catch (error) {
      console.error("Failed to start milestone:", error);
    }
  };

  const handleComplete = async (milestone: BillingMilestone) => {
    try {
      await api.post(`/api/v1/gl/billing_milestones/${milestone.id}/complete`);
      fetchData();
    } catch (error) {
      console.error("Failed to complete milestone:", error);
    }
  };

  const handleGenerateInvoice = async (milestone: BillingMilestone) => {
    try {
      await api.post(`/api/v1/gl/billing_milestones/${milestone.id}/generate_invoice`);
      fetchData();
    } catch (error) {
      console.error("Failed to generate invoice:", error);
    }
  };

  const handleCancel = async (milestone: BillingMilestone) => {
    try {
      await api.post(`/api/v1/gl/billing_milestones/${milestone.id}/cancel`);
      fetchData();
    } catch (error) {
      console.error("Failed to cancel milestone:", error);
    }
  };

  const getStatusBadge = (milestone: BillingMilestone) => {
    switch (milestone.status) {
      case "pending":
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-400">
            <Play className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "invoiced":
        return (
          <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400">
            <FileText className="h-3 w-3 mr-1" />
            Invoiced
          </Badge>
        );
      case "paid":
        return (
          <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 dark:bg-purple-900/30 dark:text-purple-400">
            <DollarSign className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="secondary">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{milestone.status}</Badge>;
    }
  };

  const getProgressBadge = (milestone: BillingMilestone) => {
    if (!milestone.target_date || milestone.status === "completed" || milestone.status === "invoiced") {
      return null;
    }

    if (milestone.days_until_target !== null) {
      if (milestone.days_until_target < 0) {
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Overdue ({Math.abs(milestone.days_until_target)}d)
          </Badge>
        );
      } else if (milestone.days_until_target <= 7) {
        return (
          <Badge className="bg-status-warning text-status-warning-foreground dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="h-3 w-3 mr-1" />
            Due Soon ({milestone.days_until_target}d)
          </Badge>
        );
      }
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const pendingMilestones = milestones.filter((m) => m.status === "pending" || m.status === "in_progress");
  const completedMilestones = milestones.filter((m) => m.status === "completed");
  const billableMilestones = milestones.filter((m) => m.status === "completed" && !m.invoice_id);
  const totalBillable = billableMilestones.reduce((sum, m) => sum + m.amount, 0);
  const totalPending = pendingMilestones.reduce((sum, m) => sum + m.amount, 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingMilestones.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatCurrency(totalPending)} value
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{completedMilestones.length}</div>
            <p className="text-xs text-muted-foreground mt-1">ready for billing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Billable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(totalBillable)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {billableMilestones.length} milestones
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {milestones.filter((m) => m.days_until_target !== null && m.days_until_target < 0 && m.status !== "completed").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">past target date</p>
          </CardContent>
        </Card>
      </div>

      {/* Milestones List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Billing Milestones
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {milestones.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No billing milestones found</p>
              <p className="text-sm mt-1">Create milestones to track project billing stages</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Milestone</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Target Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestones.map((milestone) => (
                  <TableRow key={milestone.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{milestone.name}</p>
                        {milestone.description && (
                          <p className="text-xs text-muted-foreground">{milestone.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <span>{milestone.job_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{milestone.contact_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {milestone.target_date ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{formatDate(milestone.target_date)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(milestone.amount)}
                      {milestone.is_percentage && milestone.percentage_of_contract && (
                        <div className="text-xs text-muted-foreground">
                          ({milestone.percentage_of_contract}% of contract)
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(milestone)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getProgressBadge(milestone)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {milestone.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => handleStart(milestone)}>
                            <Play className="h-4 w-4 mr-1" />
                            Start
                          </Button>
                        )}
                        {milestone.status === "in_progress" && (
                          <Button size="sm" variant="outline" onClick={() => handleComplete(milestone)}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                        {milestone.status === "completed" && !milestone.invoice_id && (
                          <Button size="sm" onClick={() => handleGenerateInvoice(milestone)}>
                            <FileText className="h-4 w-4 mr-1" />
                            Invoice
                          </Button>
                        )}
                        {(milestone.status === "pending" || milestone.status === "in_progress") && (
                          <Button size="sm" variant="ghost" onClick={() => handleCancel(milestone)}>
                            <XCircle className="h-4 w-4" />
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
    </div>
  );
}
