"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  display_name: string;              // "NAB December 2025"
  bank_account_id: string;
  bank_account_name: string;
  bank_code: string;
  account_number: string;
  company_id: number | null;
  company_code: string;
  financial_year: string;
  month: number | null;
  year: number | null;
  report_type: string;
  period_display: string;
  period_start: string | null;
  period_end: string | null;
  transaction_count: number;
  total_in: number | null;
  total_out: number | null;
  net_change: number | null;
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
  bank_accounts: string[];
  financial_years: string[];
}

interface XeroBankStatementReportViewProps {
  companyId: string;
}

/**
 * XeroBankStatementReportView - Displays Bank Statement PDF reports in a table format
 *
 * Features:
 * - Lists all generated Bank Statement reports for a company
 * - Shows status (completed, pending, generating, failed)
 * - Generate all missing reports for all bank accounts
 * - Download completed reports
 */
export function XeroBankStatementReportView({ companyId }: XeroBankStatementReportViewProps) {
  const [reports, setReports] = React.useState<BSReport[]>([]);
  const [summary, setSummary] = React.useState<BSReportsSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
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
      }>(`/api/v1/companies/${companyId}/bank_statement_reports`);

      if (response?.success) {
        setReports(response.data);
        setSummary(response.summary);
      } else {
        setError(response?.error || "Failed to load Bank Statement reports");
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError?.response?.data?.error || "Failed to load Bank Statement reports");
    } finally {
      setLoading(false);
    }
  };

  const generateHistorical = async () => {
    try {
      setGenerating(true);
      setError(null);
      const response = await api.post<{
        success: boolean;
        data: BSReport[];
        summary: { created: number; skipped: number; errors: Array<{ period: string; error: string }> };
        message?: string;
        error?: string;
      }>(`/api/v1/companies/${companyId}/bank_statement_reports/generate_historical`);

      if (response?.success) {
        setReports(response.data);
        // Show success message
        if (response.message) {
          console.log(response.message);
        }
      } else {
        setError(response?.error || "Failed to generate reports");
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError?.response?.data?.error || "Failed to generate reports");
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = async (report: BSReport) => {
    if (!report.download_url) {
      // Need to fetch the full report to get download URL
      try {
        const response = await api.get<{
          success: boolean;
          data: BSReport;
        }>(`/api/v1/companies/${companyId}/bank_statement_reports/${report.id}`);

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

  // Use Foundation-backed table (ID 487: bank_statement_reports)
  // Columns are configured via Foundation API - no explicit columns needed

  // Group reports by bank account
  const reportsByBank = React.useMemo(() => {
    const grouped: Record<string, BSReport[]> = {};
    reports.forEach((report) => {
      const key = report.bank_account_name || "Unknown";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(report);
    });
    // Sort each bank's reports by period_end descending (latest first)
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort((a, b) => {
        const dateA = a.period_end ? new Date(a.period_end).getTime() : 0;
        const dateB = b.period_end ? new Date(b.period_end).getTime() : 0;
        return dateB - dateA;
      });
    });
    return grouped;
  }, [reports]);

  const bankNames = Object.keys(reportsByBank).sort();
  const [activeBank, setActiveBank] = React.useState<string>("");

  // Set initial active bank when data loads
  React.useEffect(() => {
    if (bankNames.length > 0 && !activeBank) {
      setActiveBank(bankNames[0]);
    }
  }, [bankNames, activeBank]);

  // Transform reports to table rows for a specific bank
  const getTableRows = (bankReports: BSReport[]): TableRow[] => {
    return bankReports.map((report) => ({
      id: report.id,
      display_name: report.display_name,
      financial_year: report.financial_year,
      period_end: report.period_end,
      transaction_count: report.transaction_count,
      total_in: report.total_in,
      total_out: report.total_out,
      net_change: report.net_change,
      status: report.status?.toUpperCase(),
      generated_at: report.generated_at,
      file_size: report.file_size,
      download_url: report.download_url,
      _original: report,
    }));
  };

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
              Bank Statement Reports
            </CardTitle>
            {summary && (
              <p className="text-sm text-muted-foreground mt-1">
                {summary.total_reports} reports ({summary.completed} completed) across {bankNames.length} bank{bankNames.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={generateHistorical}
              disabled={generating}
              size="sm"
            >
              {generating ? (
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
        ) : bankNames.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No bank statement reports found. Click "Generate All Historical" to create reports for all linked bank accounts.
          </div>
        ) : (
          /* Tabs for each bank account */
          <Tabs value={activeBank} onValueChange={setActiveBank} className="-mx-4">
            <div className="px-4 border-b">
              <TabsList className="h-auto flex-wrap gap-1 bg-transparent p-0 pb-2">
                {bankNames.map((bankName) => (
                  <TabsTrigger
                    key={bankName}
                    value={bankName}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-md px-3 py-1.5 text-sm"
                  >
                    {bankName}
                    <span className="ml-1.5 text-xs opacity-70">
                      ({reportsByBank[bankName]?.length || 0})
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {bankNames.map((bankName) => (
              <TabsContent key={bankName} value={bankName} className="mt-0">
                <TeeemTableView
                  entries={getTableRows(reportsByBank[bankName] || [])}
                  foundationIdNumeric={487}
                  tableName={`${bankName} Statements`}
                  onRowClick={handleRowClick}
                  viewOnly={true}
                  enableExport={true}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}

      </CardContent>
    </Card>
  );
}

export default XeroBankStatementReportView;
