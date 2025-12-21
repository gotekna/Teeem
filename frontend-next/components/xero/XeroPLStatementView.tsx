"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  RefreshCw,
  Download,
  FileText,
  Plus,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";

interface PLReport {
  id: number;
  company_id: number;
  company_name: string;
  company_code: string;
  financial_year: string;
  report_date: string | null;
  period_start: string | null;
  period_end: string | null;
  total_revenue: number | null;
  total_expenses: number | null;
  net_profit: number | null;
  file_name: string | null;
  file_size: number | null;
  status: "pending" | "generating" | "completed" | "failed";
  error_message: string | null;
  generated_at: string | null;
  download_url?: string;
  created_at: string;
  updated_at: string;
}

interface PLReportsSummary {
  total_reports: number;
  completed: number;
  pending: number;
  failed: number;
  financial_years: string[];
}

interface XeroPLStatementViewProps {
  companyId: string;
}

/**
 * XeroPLStatementView - Displays P&L PDF reports in a table format
 *
 * Features:
 * - Lists all generated P&L reports for the company
 * - Shows status (completed, pending, generating, failed)
 * - Generate new reports for financial years
 * - Download completed reports
 */
export function XeroPLStatementView({ companyId }: XeroPLStatementViewProps) {
  const [reports, setReports] = React.useState<PLReport[]>([]);
  const [summary, setSummary] = React.useState<PLReportsSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        data: PLReport[];
        summary: PLReportsSummary;
        error?: string;
      }>(`/api/v1/companies/${companyId}/profit_loss_reports`);

      if (response?.success) {
        setReports(response.data);
        setSummary(response.summary);
      } else {
        setError(response?.error || "Failed to load P&L reports");
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError?.response?.data?.error || "Failed to load P&L reports");
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (financialYear: string) => {
    try {
      setGenerating(financialYear);
      const response = await api.post<{
        success: boolean;
        data: PLReport;
        error?: string;
      }>(`/api/v1/companies/${companyId}/profit_loss_reports/generate`, {
        financial_year: financialYear,
      });

      if (response?.success) {
        await loadReports();
      } else {
        setError(response?.error || "Failed to generate report");
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError?.response?.data?.error || "Failed to generate report");
    } finally {
      setGenerating(null);
    }
  };

  const downloadReport = async (report: PLReport) => {
    if (!report.download_url) {
      // Need to fetch the full report to get download URL
      try {
        const response = await api.get<{
          success: boolean;
          data: PLReport;
        }>(`/api/v1/companies/${companyId}/profit_loss_reports/${report.id}`);

        if (response?.success && response.data.download_url) {
          window.open(response.data.download_url, "_blank");
        } else {
          setError("Report download not available");
        }
      } catch {
        setError("Failed to get download link");
      }
    } else {
      window.open(report.download_url, "_blank");
    }
  };

  React.useEffect(() => {
    loadReports();
  }, [companyId]);

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "d MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "generating":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Generating
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Generate available FYs (current and past 3 years)
  const getAvailableFYs = () => {
    const today = new Date();
    const currentFY = today.getMonth() >= 6 ? today.getFullYear() + 1 : today.getFullYear();
    const fys = [];
    for (let i = 0; i < 4; i++) {
      fys.push(`FY${currentFY - i}`);
    }
    return fys;
  };

  const existingFYs = reports.map((r) => r.financial_year);
  const missingFYs = getAvailableFYs().filter((fy) => !existingFYs.includes(fy));

  // Define columns for TeeemTableView (no Foundation backing - explicit columns)
  const columns: TableColumn[] = [
    { key: "financial_year", label: "Financial Year", width: 120, sortable: true },
    { key: "period", label: "Period", width: 180 },
    { key: "total_revenue", label: "Revenue", width: 120, sortable: true, column_type: "currency", showSum: true },
    { key: "total_expenses", label: "Expenses", width: 120, sortable: true, column_type: "currency", showSum: true },
    { key: "net_profit", label: "Net Profit", width: 130, sortable: true, column_type: "currency", showSum: true },
    { key: "status", label: "Status", width: 110, column_type: "badge" },
    { key: "generated_at", label: "Generated", width: 130, column_type: "date" },
  ];

  // Transform reports to table rows
  const tableRows: TableRow[] = reports.map((report) => ({
    id: report.id,
    financial_year: report.financial_year,
    period: report.period_start && report.period_end
      ? `${formatDate(report.period_start)} - ${formatDate(report.period_end)}`
      : "—",
    total_revenue: report.total_revenue,
    total_expenses: report.total_expenses,
    net_profit: report.net_profit,
    status: report.status?.toUpperCase(),
    generated_at: report.generated_at,
    file_size: report.file_size,
    download_url: report.download_url,
    _original: report,
  }));

  // Handle row actions
  const handleRowClick = (row: TableRow) => {
    const report = row._original as PLReport;
    if (report.status === "completed") {
      downloadReport(report);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Profit & Loss Statements
            </CardTitle>
            {summary && (
              <p className="text-sm text-muted-foreground mt-1">
                {summary.total_reports} reports ({summary.completed} completed)
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {missingFYs.length > 0 && (
              <Button
                onClick={() => generateReport(missingFYs[0])}
                disabled={generating !== null}
                size="sm"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Generate {missingFYs[0]}
              </Button>
            )}
            <Button onClick={loadReports} disabled={loading} size="sm" variant="outline">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading && reports.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          /* TeeemTableView handles empty state and table rendering */
          <div className="-mx-4">
            <TeeemTableView
              entries={tableRows}
              columns={columns}
              tableName="P&L Statements"
              onRowClick={handleRowClick}
              viewOnly={true}
              enableExport={true}
            />
          </div>
        )}

        {/* Generate additional FYs */}
        {reports.length > 0 && missingFYs.length > 1 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">Generate additional reports:</p>
            <div className="flex flex-wrap gap-2">
              {missingFYs.slice(1).map((fy) => (
                <Button
                  key={fy}
                  variant="outline"
                  size="sm"
                  onClick={() => generateReport(fy)}
                  disabled={generating !== null}
                >
                  {generating === fy ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  {fy}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default XeroPLStatementView;
