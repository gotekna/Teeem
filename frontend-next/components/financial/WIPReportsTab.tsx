"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import {
  HardHat,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  Archive,
  Eye,
  ArrowLeft,
  Building,
  Percent,
  Calculator,
  Receipt,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface WIPSummary {
  report_date: string;
  total_contract_value: number;
  total_costs_to_date: number;
  total_revenue_recognized: number;
  total_wip_asset: number;
  total_wip_liability: number;
  net_wip_position: number;
  overall_completion_pct: number;
  loss_job_count: number;
  over_budget_count: number;
}

interface WIPReportJob {
  id: number;
  job_id: number;
  job: {
    id: number;
    name: string;
    reference?: string;
    status: string;
  };
  contract_value: number;
  approved_variations: number;
  revised_contract_value: number;
  costs_to_date: number;
  estimated_costs_to_complete: number;
  total_estimated_costs: number;
  completion_percentage: number;
  revenue_recognized: number;
  revenue_recognized_prior: number;
  revenue_this_period: number;
  billings_to_date: number;
  unbilled_revenue: number;
  costs_in_excess_of_billings: number;
  billings_in_excess_of_costs: number;
  gross_profit: number;
  gross_profit_pct: number;
  estimated_profit_at_completion: number;
  status: string;
  completion_method: string;
}

interface WIPReport {
  id: number;
  reference: string;
  report_date: string;
  period_start: string;
  period_end: string;
  status: string;
  notes?: string;
  total_contract_value: number;
  total_costs_to_date: number;
  total_estimated_costs: number;
  total_revenue_recognized: number;
  total_billings_to_date: number;
  total_wip_asset: number;
  total_wip_liability: number;
  created_by?: { id: number; name: string; email: string };
  created_at: string;
  jobs?: WIPReportJob[];
}

export default function WIPReportsTab() {
  const [reports, setReports] = useState<WIPReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<WIPReport | null>(null);
  const [summary, setSummary] = useState<WIPSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [showNewReportDialog, setShowNewReportDialog] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [creatingReport, setCreatingReport] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{ success: boolean; data: WIPReport[] }>(
        "/api/v1/gl/wip_reports"
      );
      if (response.success) {
        setReports(response.data);
      }
    } catch (err) {
      setError("Failed to load WIP reports");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: WIPSummary | null }>(
        "/api/v1/gl/wip_reports/summary"
      );
      if (response.success && response.data) {
        setSummary(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch summary", err);
    }
  }, []);

  const fetchReportDetails = async (id: number) => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: WIPReport }>(
        `/api/v1/gl/wip_reports/${id}`
      );
      if (response.success) {
        setSelectedReport(response.data);
      }
    } catch (err) {
      setError("Failed to load report details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    fetchSummary();
  }, [fetchReports, fetchSummary]);

  const handleCreateReport = async () => {
    setCreatingReport(true);
    try {
      const response = await api.post<{ success: boolean; data?: WIPReport; error?: string }>(
        "/api/v1/gl/wip_reports",
        { report_date: new Date().toISOString().split("T")[0] }
      );
      if (response?.success && response.data) {
        setShowNewReportDialog(false);
        fetchReports();
        fetchReportDetails(response.data.id);
      }
    } catch (err) {
      console.error("Failed to create report", err);
    } finally {
      setCreatingReport(false);
    }
  };

  const handleRecalculate = async () => {
    if (!selectedReport) return;
    setLoading(true);
    try {
      await api.post<{ success: boolean }>(
        `/api/v1/gl/wip_reports/${selectedReport.id}/recalculate`,
        {}
      );
      fetchReportDetails(selectedReport.id);
    } catch (err) {
      console.error("Failed to recalculate", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedReport) return;
    try {
      await api.post<{ success: boolean }>(
        `/api/v1/gl/wip_reports/${selectedReport.id}/finalize`,
        {}
      );
      setShowFinalizeDialog(false);
      fetchReportDetails(selectedReport.id);
      fetchReports();
      fetchSummary();
    } catch (err) {
      console.error("Failed to finalize", err);
    }
  };

  const handleArchive = async (reportId: number) => {
    try {
      await api.post<{ success: boolean }>(
        `/api/v1/gl/wip_reports/${reportId}/archive`,
        {}
      );
      fetchReports();
      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error("Failed to archive", err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-600">
            <Clock className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      case "final":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            <Lock className="h-3 w-3 mr-1" />
            Final
          </Badge>
        );
      case "archived":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Archive className="h-3 w-3 mr-1" />
            Archived
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
            Active
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Complete
          </Badge>
        );
      case "loss_expected":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Loss Expected
          </Badge>
        );
      case "on_hold":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            On Hold
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatPercent = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    return `${value.toFixed(1)}%`;
  };

  // Show report details view
  if (selectedReport) {
    const netWIPPosition =
      (selectedReport.total_wip_asset || 0) - (selectedReport.total_wip_liability || 0);
    const overallCompletion =
      selectedReport.total_estimated_costs && selectedReport.total_estimated_costs > 0
        ? (selectedReport.total_costs_to_date / selectedReport.total_estimated_costs) * 100
        : 0;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSelectedReport(null)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                {selectedReport.reference}
                {getStatusBadge(selectedReport.status)}
              </h2>
              <p className="text-sm text-muted-foreground">
                Report Date: {formatDate(selectedReport.report_date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedReport.status === "draft" && (
              <>
                <Button variant="outline" onClick={handleRecalculate} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  Recalculate
                </Button>
                <Button onClick={() => setShowFinalizeDialog(true)}>
                  <Lock className="h-4 w-4 mr-2" />
                  Finalize
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Contract Value</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(selectedReport.total_contract_value)}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Costs to Date</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(selectedReport.total_costs_to_date)}
                  </p>
                </div>
                <Receipt className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue Recognized</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(selectedReport.total_revenue_recognized)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completion</p>
                  <p className="text-2xl font-bold">{formatPercent(overallCompletion)}</p>
                </div>
                <Percent className="h-8 w-8 text-muted-foreground" />
              </div>
              <Progress value={Math.min(overallCompletion, 100)} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* WIP Position */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                <ArrowUpRight className="h-5 w-5" />
                <span className="font-medium">Costs in Excess of Billings (Asset)</span>
              </div>
              <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                {formatCurrency(selectedReport.total_wip_asset)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Work completed but not yet billed
              </p>
            </CardContent>
          </Card>
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                <ArrowDownRight className="h-5 w-5" />
                <span className="font-medium">Billings in Excess of Costs (Liability)</span>
              </div>
              <p className="text-3xl font-bold text-red-700 dark:text-red-300">
                {formatCurrency(selectedReport.total_wip_liability)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Billed but work not yet done</p>
            </CardContent>
          </Card>
          <Card className={netWIPPosition >= 0 ? "border-blue-200" : "border-amber-200"}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-5 w-5" />
                <span className="font-medium">Net WIP Position</span>
              </div>
              <p
                className={`text-3xl font-bold ${
                  netWIPPosition >= 0 ? "text-blue-600" : "text-amber-600"
                }`}
              >
                {formatCurrency(netWIPPosition)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {netWIPPosition >= 0 ? "Net asset position" : "Net liability position"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Jobs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Project Details
            </CardTitle>
            <CardDescription>
              {selectedReport.jobs?.length || 0} construction projects included
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedReport.jobs && selectedReport.jobs.length > 0 ? (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Contract Value</TableHead>
                      <TableHead className="text-right">Costs to Date</TableHead>
                      <TableHead className="text-right">% Complete</TableHead>
                      <TableHead className="text-right">Revenue Rec.</TableHead>
                      <TableHead className="text-right">Billings</TableHead>
                      <TableHead className="text-right">WIP</TableHead>
                      <TableHead className="text-right">Margin %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedReport.jobs.map((job) => (
                      <TableRow
                        key={job.id}
                        className={job.status === "loss_expected" ? "bg-red-50 dark:bg-red-900/10" : ""}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">{job.job?.name || `Job #${job.job_id}`}</p>
                            {job.job?.reference && (
                              <p className="text-xs text-muted-foreground">{job.job.reference}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getJobStatusBadge(job.status)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(job.revised_contract_value)}
                          {job.approved_variations > 0 && (
                            <p className="text-xs text-muted-foreground">
                              +{formatCurrency(job.approved_variations)} var.
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(job.costs_to_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress value={job.completion_percentage} className="w-16 h-2" />
                            <span className="w-12 text-right">
                              {formatPercent(job.completion_percentage)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(job.revenue_recognized)}
                          {job.revenue_this_period > 0 && (
                            <p className="text-xs text-green-600">
                              +{formatCurrency(job.revenue_this_period)} this period
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(job.billings_to_date)}
                          {job.unbilled_revenue > 0 && (
                            <p className="text-xs text-amber-600">
                              {formatCurrency(job.unbilled_revenue)} unbilled
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {job.costs_in_excess_of_billings > 0 ? (
                            <span className="text-green-600">
                              {formatCurrency(job.costs_in_excess_of_billings)}
                            </span>
                          ) : job.billings_in_excess_of_costs > 0 ? (
                            <span className="text-red-600">
                              ({formatCurrency(job.billings_in_excess_of_costs)})
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              job.gross_profit_pct >= 0 ? "text-green-600" : "text-red-600"
                            }
                          >
                            {formatPercent(job.gross_profit_pct)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No construction projects in this report</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Finalize Dialog */}
        <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Finalize WIP Report
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to finalize this report? Once finalized, it cannot be edited.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Finalizing will lock all values and make this the official WIP report for the
                  period. The report will be used for revenue recognition calculations.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowFinalizeDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleFinalize}>
                <Lock className="h-4 w-4 mr-2" />
                Finalize Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Reports list view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <HardHat className="h-5 w-5" />
            Construction WIP Reports
          </h2>
          <p className="text-sm text-muted-foreground">
            Track revenue recognition using percentage of completion method
          </p>
        </div>
        <Button onClick={() => setShowNewReportDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Report
        </Button>
      </div>

      {/* Summary from Latest Final Report */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Contract Value</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(summary.total_contract_value)}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Net WIP Position</p>
                  <p
                    className={`text-2xl font-bold ${
                      summary.net_wip_position >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {formatCurrency(summary.net_wip_position)}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overall Completion</p>
                  <p className="text-2xl font-bold">
                    {formatPercent(summary.overall_completion_pct)}
                  </p>
                </div>
                <Percent className="h-8 w-8 text-muted-foreground" />
              </div>
              <Progress value={Math.min(summary.overall_completion_pct, 100)} className="mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Alerts</p>
                <div className="flex gap-2">
                  {summary.loss_job_count > 0 && (
                    <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {summary.loss_job_count} Loss
                    </Badge>
                  )}
                  {summary.over_budget_count > 0 && (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                      <TrendingDown className="h-3 w-3 mr-1" />
                      {summary.over_budget_count} Over Budget
                    </Badge>
                  )}
                  {summary.loss_job_count === 0 && summary.over_budget_count === 0 && (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      All Healthy
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reports Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>WIP Reports</span>
            <Button variant="outline" size="sm" onClick={fetchReports}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-8 w-8" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <HardHat className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No WIP reports</p>
              <p className="text-sm mt-1">
                Generate your first WIP report to track construction project revenue
              </p>
              <Button className="mt-4" onClick={() => setShowNewReportDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Report
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Report Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Contract Value</TableHead>
                  <TableHead className="text-right">Revenue Rec.</TableHead>
                  <TableHead className="text-right">WIP Asset</TableHead>
                  <TableHead className="text-right">WIP Liability</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-mono font-medium">{report.reference}</TableCell>
                    <TableCell>{formatDate(report.report_date)}</TableCell>
                    <TableCell>{getStatusBadge(report.status)}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(report.total_contract_value)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(report.total_revenue_recognized)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(report.total_wip_asset)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(report.total_wip_liability)}
                    </TableCell>
                    <TableCell>{report.created_by?.name || "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => fetchReportDetails(report.id)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {report.status !== "archived" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleArchive(report.id)}
                            title="Archive"
                          >
                            <Archive className="h-4 w-4" />
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

      {/* About WIP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            About WIP Reporting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Work in Progress (WIP) reporting tracks revenue recognition for long-term construction
            contracts using the percentage of completion method (ASC 606 / AASB 15).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight className="h-5 w-5 text-green-600" />
                <h4 className="font-medium">Costs in Excess of Billings</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                An asset representing work performed but not yet billed to the client
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownRight className="h-5 w-5 text-red-600" />
                <h4 className="font-medium">Billings in Excess of Costs</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                A liability representing amounts billed before the work is performed
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Percent className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium">Percentage of Completion</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Calculated as Costs to Date ÷ Total Estimated Costs (cost-to-cost method)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Report Dialog */}
      <Dialog open={showNewReportDialog} onOpenChange={setShowNewReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Generate WIP Report
            </DialogTitle>
            <DialogDescription>
              Generate a new WIP report for all active construction projects
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="font-medium text-blue-800 dark:text-blue-200">Report Date</span>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                The report will be generated as of today&apos;s date and include all active
                construction projects.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              The report will automatically calculate:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Percentage of completion for each project</li>
              <li>Revenue recognition based on cost-to-cost method</li>
              <li>WIP asset and liability positions</li>
              <li>Gross profit margins and expected losses</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewReportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateReport} disabled={creatingReport}>
              {creatingReport ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Generate Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
