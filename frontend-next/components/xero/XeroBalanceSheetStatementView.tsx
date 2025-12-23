"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  FileText,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";

interface BSReport {
  id: number;
  display_name: string;              // "Balance Sheet December 2025 FY2026"
  company_id: number;
  company_name: string;
  company_code: string;
  financial_year: string;
  period: string | null;           // "Jan25", "Feb25", etc.
  period_end_date: string | null;  // Date for sorting
  period_label: string | null;     // "January 2025" (human-readable)
  report_date: string | null;
  total_assets: number | null;
  total_liabilities: number | null;
  net_assets: number | null;
  file_name: string | null;
  file_size: number | null;
  status: "pending" | "generating" | "completed" | "failed";
  error_message: string | null;
  generated_at: string | null;
  download_url?: string;
  created_at: string;
  updated_at: string;
}

interface BSReportsSummary {
  total_reports: number;
  completed: number;
  pending: number;
  failed: number;
  financial_years: string[];
}

interface XeroBalanceSheetStatementViewProps {
  companyId: string;
}

/**
 * XeroBalanceSheetStatementView - Displays Balance Sheet PDF reports in a table format
 *
 * Features:
 * - Lists all generated Balance Sheet reports for the company
 * - Shows status (completed, pending, generating, failed)
 * - Generate new reports for financial years
 * - Download completed reports
 */
export function XeroBalanceSheetStatementView({ companyId }: XeroBalanceSheetStatementViewProps) {
  const [reports, setReports] = React.useState<BSReport[]>([]);
  const [summary, setSummary] = React.useState<BSReportsSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        data: BSReport[];
        summary: BSReportsSummary;
        error?: string;
      }>(`/api/v1/companies/${companyId}/balance_sheet_reports`);

      if (response?.success) {
        setReports(response.data);
        setSummary(response.summary);
      } else {
        setError(response?.error || "Failed to load Balance Sheet reports");
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError?.response?.data?.error || "Failed to load Balance Sheet reports");
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (financialYear: string) => {
    try {
      setGenerating(financialYear);
      const response = await api.post<{
        success: boolean;
        data: BSReport;
        error?: string;
      }>(`/api/v1/companies/${companyId}/balance_sheet_reports/generate`, {
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

  const generateHistorical = async () => {
    try {
      setGenerating("historical");
      const response = await api.post<{
        success: boolean;
        data: BSReport[];
        summary: { created: number; skipped: number; errors: Array<{ period: string; error: string }> };
        message?: string;
        error?: string;
      }>(`/api/v1/companies/${companyId}/balance_sheet_reports/generate_historical`);

      if (response?.success) {
        setReports(response.data);
        // Show success message
        if (response.message) {
          // Could use a toast here, but for now just log
          console.log(response.message);
        }
      } else {
        setError(response?.error || "Failed to generate historical reports");
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError?.response?.data?.error || "Failed to generate historical reports");
    } finally {
      setGenerating(null);
    }
  };

  const downloadReport = async (report: BSReport) => {
    if (!report.download_url) {
      // Need to fetch the full report to get download URL
      try {
        const response = await api.get<{
          success: boolean;
          data: BSReport;
        }>(`/api/v1/companies/${companyId}/balance_sheet_reports/${report.id}`);

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

  // Use Foundation-backed table (ID 489: balance_sheet_reports)
  // Columns are configured via Foundation API - no explicit columns needed

  // Sort reports by report_date descending (latest first)
  const sortedReports = [...reports].sort((a, b) => {
    const dateA = a.report_date ? new Date(a.report_date).getTime() : 0;
    const dateB = b.report_date ? new Date(b.report_date).getTime() : 0;
    return dateB - dateA; // Descending (latest first)
  });

  // Transform reports to table rows
  const tableRows: TableRow[] = sortedReports.map((report) => ({
    id: report.id,
    display_name: report.display_name,
    financial_year: report.financial_year,
    period_end_date: report.period_end_date,
    report_date: report.report_date,
    total_assets: report.total_assets,
    total_liabilities: report.total_liabilities,
    net_assets: report.net_assets,
    status: report.status?.toUpperCase(),
    generated_at: report.generated_at,
    file_size: report.file_size,
    download_url: report.download_url,
    _original: report,
  }));

  // Handle row actions
  const handleRowClick = (row: TableRow) => {
    const report = row._original as BSReport;
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
              Balance Sheet Statements
            </CardTitle>
            {summary && (
              <p className="text-sm text-muted-foreground mt-1">
                {summary.total_reports} reports ({summary.completed} completed)
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={generateHistorical}
              disabled={generating !== null}
              size="sm"
            >
              {generating === "historical" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Generate All Historical
            </Button>
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
              foundationIdNumeric={489}
              tableName="Balance Sheet Report Statements"
              onRowClick={handleRowClick}
              viewOnly={true}
              enableExport={true}
            />
          </div>
        )}

      </CardContent>
    </Card>
  );
}

export default XeroBalanceSheetStatementView;
