"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  Plus,
  RefreshCw,
  AlertTriangle,
  Download,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import { format, isValid } from "date-fns";

// Safe date formatter
const safeFormatDate = (dateValue: string | Date | null | undefined, formatStr: string, fallback = "—"): string => {
  if (!dateValue) return fallback;
  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  return isValid(date) ? format(date, formatStr) : fallback;
};

interface PdfReport {
  id: number;
  company_name: string;
  company_code: string;
  financial_year: string;
  status: string;
  cloudinary_url?: string;
  file_name?: string;
  generated_at?: string;
  total_revenue?: number;
  total_expenses?: number;
  net_profit?: number;
  total_assets?: number;
  total_liabilities?: number;
  net_assets?: number;
}

interface XeroReportsPanelProps {
  companyId: string;
}

/**
 * XeroReportsPanel - Combined Reports Panel with inner tabs for P&L and Balance Sheet PDFs
 *
 * Features:
 * - Tab navigation between Profit & Loss and Balance Sheet reports
 * - Generate PDF reports from Xero data
 * - View historical reports by financial year
 * - Download PDFs from Cloudinary
 */
export function XeroReportsPanel({ companyId }: XeroReportsPanelProps) {
  const [activeReportTab, setActiveReportTab] = React.useState<"profit_loss" | "balance_sheet">("profit_loss");

  return (
    <div className="space-y-4">
      {/* Inner tabs for report types */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveReportTab("profit_loss")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeReportTab === "profit_loss"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Profit & Loss
        </button>
        <button
          onClick={() => setActiveReportTab("balance_sheet")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeReportTab === "balance_sheet"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Balance Sheet
        </button>
      </div>

      {/* Report content based on selected tab */}
      {activeReportTab === "profit_loss" && (
        <XeroPdfReportsCard
          companyId={companyId}
          reportType="profit_loss"
          title="Profit & Loss PDF Reports"
          foundationSlug="profit_loss_reports"
        />
      )}
      {activeReportTab === "balance_sheet" && (
        <XeroPdfReportsCard
          companyId={companyId}
          reportType="balance_sheet"
          title="Balance Sheet PDF Reports"
          foundationSlug="balance_sheet_reports"
        />
      )}
    </div>
  );
}

interface XeroPdfReportsCardProps {
  companyId: string;
  reportType: "profit_loss" | "balance_sheet";
  title: string;
  foundationSlug: string; // SSoT: Use slug, not numeric ID (differs per environment)
}

/**
 * XeroPdfReportsCard - Displays and generates PDF financial reports
 *
 * Features:
 * - Generate new reports by financial year
 * - View report status (completed, generating, failed)
 * - Display financial summaries (revenue/expenses or assets/liabilities)
 * - Download generated PDFs
 */
function XeroPdfReportsCard({
  companyId,
  reportType,
  title,
  foundationSlug
}: XeroPdfReportsCardProps) {
  const [reports, setReports] = React.useState<PdfReport[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedYear, setSelectedYear] = React.useState("FY2025");

  // Financial years list
  const financialYears = ["FY2025", "FY2024", "FY2023", "FY2022"];

  React.useEffect(() => {
    loadReports();
  }, [companyId, reportType]);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const endpoint = reportType === "profit_loss"
        ? `/api/v1/companies/${companyId}/profit_loss_reports`
        : `/api/v1/companies/${companyId}/balance_sheet_reports`;

      const response = await api.get<{
        success: boolean;
        data?: PdfReport[];
        error?: string;
      }>(endpoint);

      if (response?.success && response.data) {
        setReports(response.data);
      } else {
        setReports([]);
      }
    } catch (err) {
      setError("Failed to load reports");
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      setGenerating(true);
      setError(null);
      const endpoint = reportType === "profit_loss"
        ? `/api/v1/companies/${companyId}/profit_loss_reports/generate`
        : `/api/v1/companies/${companyId}/balance_sheet_reports/generate`;

      const response = await api.post<{
        success: boolean;
        data?: PdfReport;
        error?: string;
      }>(endpoint, { financial_year: selectedYear });

      if (response?.success) {
        loadReports(); // Refresh the list
      } else {
        setError(response?.error || "Failed to generate report");
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError?.response?.data?.error || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-status-success text-status-success-foreground">Completed</Badge>;
      case "generating":
        return <Badge className="bg-status-warning text-status-warning-foreground">Generating...</Badge>;
      case "failed":
        return <Badge className="bg-status-error text-status-error-foreground">Failed</Badge>;
      default:
        return <Badge className="bg-muted text-foreground">Pending</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>
            PDF reports stored in SharePoint - Foundation: {foundationSlug}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            {financialYears.map(fy => (
              <option key={fy} value={fy}>{fy}</option>
            ))}
          </select>
          <Button
            onClick={generateReport}
            disabled={generating}
            size="sm"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No reports generated yet</p>
            <p className="text-sm mt-2">Click "Generate Report" to create a PDF from Xero</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-2 px-3 font-medium">Financial Year</th>
                  <th className="text-left py-2 px-3 font-medium">Status</th>
                  {reportType === "profit_loss" && (
                    <>
                      <th className="text-right py-2 px-3 font-medium">Revenue</th>
                      <th className="text-right py-2 px-3 font-medium">Expenses</th>
                      <th className="text-right py-2 px-3 font-medium">Net Profit</th>
                    </>
                  )}
                  {reportType === "balance_sheet" && (
                    <>
                      <th className="text-right py-2 px-3 font-medium">Assets</th>
                      <th className="text-right py-2 px-3 font-medium">Liabilities</th>
                      <th className="text-right py-2 px-3 font-medium">Net Assets</th>
                    </>
                  )}
                  <th className="text-left py-2 px-3 font-medium">Generated</th>
                  <th className="text-center py-2 px-3 font-medium">PDF</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{report.financial_year}</td>
                    <td className="py-2 px-3">{getStatusBadge(report.status)}</td>
                    {reportType === "profit_loss" && (
                      <>
                        <td className="py-2 px-3 text-right font-mono text-green-600 dark:text-green-400">
                          {report.total_revenue ? formatCurrency(report.total_revenue) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-red-600 dark:text-red-400">
                          {report.total_expenses ? formatCurrency(report.total_expenses) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">
                          {report.net_profit !== undefined ? (
                            <span className={report.net_profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                              {formatCurrency(report.net_profit)}
                            </span>
                          ) : "—"}
                        </td>
                      </>
                    )}
                    {reportType === "balance_sheet" && (
                      <>
                        <td className="py-2 px-3 text-right font-mono text-green-600 dark:text-green-400">
                          {report.total_assets ? formatCurrency(report.total_assets) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-red-600 dark:text-red-400">
                          {report.total_liabilities ? formatCurrency(report.total_liabilities) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                          {report.net_assets !== undefined ? formatCurrency(report.net_assets) : "—"}
                        </td>
                      </>
                    )}
                    <td className="py-2 px-3 text-muted-foreground">
                      {report.generated_at ? safeFormatDate(report.generated_at, "dd MMM yyyy HH:mm") : "—"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {report.cloudinary_url ? (
                        <a
                          href={report.cloudinary_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Download className="h-4 w-4" />
                          <span className="text-xs">{report.file_name || "Download"}</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default XeroReportsPanel;
