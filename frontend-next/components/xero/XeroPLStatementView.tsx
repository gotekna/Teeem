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

        {loading && reports.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && reports.length === 0 && !error && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No P&L reports generated yet</p>
            <p className="text-sm mt-2">
              Click "Generate" to create a P&L statement for a financial year
            </p>
            {missingFYs.length > 0 && (
              <Button onClick={() => generateReport(missingFYs[0])} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Generate {missingFYs[0]} Report
              </Button>
            )}
          </div>
        )}

        {reports.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 font-semibold">
                  <th className="py-3 px-4 text-left">Financial Year</th>
                  <th className="py-3 px-4 text-left">Period</th>
                  <th className="py-3 px-4 text-right">Revenue</th>
                  <th className="py-3 px-4 text-right">Expenses</th>
                  <th className="py-3 px-4 text-right">Net Profit</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-left">Generated</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="border-b hover:bg-muted/20">
                    <td className="py-2.5 px-4 font-medium">{report.financial_year}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-sm">
                      {report.period_start && report.period_end
                        ? `${formatDate(report.period_start)} - ${formatDate(report.period_end)}`
                        : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-green-600 dark:text-green-400">
                      {formatCurrency(report.total_revenue)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-red-600 dark:text-red-400">
                      {formatCurrency(report.total_expenses)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {report.net_profit !== null ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-semibold",
                            report.net_profit >= 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          )}
                        >
                          {report.net_profit >= 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : (
                            <TrendingDown className="h-4 w-4" />
                          )}
                          {formatCurrency(report.net_profit)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">{getStatusBadge(report.status)}</td>
                    <td className="py-2.5 px-4 text-sm text-muted-foreground">
                      {formatDate(report.generated_at)}
                      {report.file_size && (
                        <span className="text-xs ml-2">({formatFileSize(report.file_size)})</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {report.status === "completed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadReport(report)}
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {(report.status === "failed" || report.status === "pending") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => generateReport(report.financial_year)}
                            disabled={generating === report.financial_year}
                            title="Regenerate"
                          >
                            {generating === report.financial_year ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
