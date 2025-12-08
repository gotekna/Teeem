"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  RefreshCw,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import { TableColumn, TableRow } from "@/components/table/types";

// Types for flat report structure
interface BankStatementReport {
  id: number;
  bank_account_id: string;
  bank_account_name: string;
  bank_code: string;
  account_number: string;
  company_code: string;
  financial_year: string;
  month: number | null;
  month_name: string;
  period_display: string;
  transaction_count: number;
  total_in: number;
  total_out: number;
  net_change: number;
  generated_at: string;
  file_name: string;
  status: string;
}

interface GenerateResult {
  created: number;
  regenerated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

interface Props {
  companyId?: string;
}

export function BankStatementReportsView({ companyId }: Props) {
  const [reports, setReports] = useState<BankStatementReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<GenerateResult | null>(null);

  // Define columns for TeeemTableView
  const columns: TableColumn[] = [
    {
      key: "bank_account_name",
      label: "Bank Account",
      column_type: "text",
      width: 180,
      sortable: true,
      filterable: true,
    },
    {
      key: "bank_code",
      label: "Bank",
      column_type: "text",
      width: 80,
      sortable: true,
      filterable: true,
    },
    {
      key: "financial_year",
      label: "FY",
      column_type: "text",
      width: 80,
      sortable: true,
      filterable: true,
    },
    {
      key: "month_name",
      label: "Month",
      column_type: "text",
      width: 100,
      sortable: true,
      filterable: true,
    },
    {
      key: "transaction_count",
      label: "Transactions",
      column_type: "number",
      width: 100,
      sortable: true,
    },
    {
      key: "total_in",
      label: "Money In",
      column_type: "currency",
      width: 120,
      sortable: true,
    },
    {
      key: "total_out",
      label: "Money Out",
      column_type: "currency",
      width: 120,
      sortable: true,
    },
    {
      key: "net_change",
      label: "Net",
      column_type: "currency",
      width: 120,
      sortable: true,
    },
    {
      key: "generated_at",
      label: "Generated",
      column_type: "datetime",
      width: 140,
      sortable: true,
    },
  ];

  // Load reports on mount
  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: BankStatementReport[] }>(
        "/api/v1/bank_statement_reports"
      );

      if (response?.success) {
        setReports(response.data);
      }
    } catch (error) {
      console.error("Failed to load reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAll = async () => {
    try {
      setGenerating(true);
      setLastResult(null);
      const response = await api.post<{ success: boolean; data: GenerateResult }>(
        "/api/v1/bank_statement_reports/generate_all"
      );

      if (response?.success) {
        setLastResult(response.data);
        // Reload reports to show new ones
        await loadReports();
      }
    } catch (error) {
      console.error("Failed to generate reports:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (reportId: number) => {
    try {
      setDownloading(reportId);

      // Get report details with download URL
      const response = await api.get<{ success: boolean; data: { download_url: string; file_name: string } }>(
        `/api/v1/bank_statement_reports/${reportId}`
      );

      if (response?.success && response.data.download_url) {
        // Open Cloudinary URL in new tab (will trigger download)
        window.open(response.data.download_url, "_blank");
      }
    } catch (error) {
      console.error("Failed to download report:", error);
    } finally {
      setDownloading(null);
    }
  };

  // Transform reports to entries for TeeemTableView
  const entries: TableRow[] = reports.map((report) => ({
    id: report.id,
    bank_account_name: report.bank_account_name,
    bank_code: report.bank_code || "-",
    financial_year: report.financial_year,
    month_name: report.month_name || "Annual",
    transaction_count: report.transaction_count || 0,
    total_in: report.total_in || 0,
    total_out: report.total_out || 0,
    net_change: report.net_change || 0,
    generated_at: report.generated_at,
    file_name: report.file_name,
  }));

  // Custom cell renderer for currency with colors and download action
  const customCellRenderer = (entry: TableRow, columnKey: string): React.ReactNode | null => {
    if (columnKey === "total_in" && typeof entry.total_in === "number") {
      return (
        <span className="text-green-600">
          {new Intl.NumberFormat("en-AU", {
            style: "currency",
            currency: "AUD",
          }).format(entry.total_in)}
        </span>
      );
    }
    if (columnKey === "total_out" && typeof entry.total_out === "number") {
      return (
        <span className="text-red-600">
          {new Intl.NumberFormat("en-AU", {
            style: "currency",
            currency: "AUD",
          }).format(entry.total_out)}
        </span>
      );
    }
    if (columnKey === "net_change" && typeof entry.net_change === "number") {
      const value = entry.net_change;
      return (
        <span className={value >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
          {new Intl.NumberFormat("en-AU", {
            style: "currency",
            currency: "AUD",
          }).format(value)}
        </span>
      );
    }
    return null;
  };

  // Handle row click to download
  const handleRowClick = (row: TableRow) => {
    handleDownload(row.id as number);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading stored reports...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Generate button */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Stored Bank Statement Reports
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                PDF reports stored for ATO compliance - organized by bank account, FY, and month
              </p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleGenerateAll}
                    disabled={generating}
                    variant="default"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Generate All Reports
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Generate PDFs for all bank accounts, FYs, and months</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>

        {/* Generation result */}
        {lastResult && (
          <CardContent className="pt-0">
            <div className={cn(
              "p-3 rounded-lg text-sm",
              lastResult.failed > 0 ? "bg-yellow-50 text-yellow-800" : "bg-green-50 text-green-800"
            )}>
              <div className="flex items-center gap-2 mb-1">
                {lastResult.failed > 0 ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span className="font-medium">Generation Complete</span>
              </div>
              <div className="flex gap-4 text-xs">
                <span>Created: {lastResult.created}</span>
                <span>Regenerated: {lastResult.regenerated}</span>
                <span>Skipped: {lastResult.skipped}</span>
                {lastResult.failed > 0 && <span className="text-red-600">Failed: {lastResult.failed}</span>}
              </div>
              {lastResult.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-600">
                  {lastResult.errors.slice(0, 3).map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                  {lastResult.errors.length > 3 && (
                    <div>...and {lastResult.errors.length - 3} more errors</div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Reports table using TeeemTableView */}
      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No reports generated yet</p>
              <p className="text-sm mt-1">
                Click "Generate All Reports" to create PDFs for all bank transaction periods
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <TeeemTableView
          columns={columns}
          entries={entries}
          tableName="Bank Statement Reports"
          viewOnly={true}
          initialGroupByColumn="bank_account_name"
          customCellRenderer={customCellRenderer}
          onRowClick={handleRowClick}
          customActions={
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs text-muted-foreground">
                    Click row to download PDF
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click any row to download the PDF report</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          }
        />
      )}

      {/* Legal note */}
      <p className="text-xs text-muted-foreground text-center">
        Reports are reconstructed from Xero bank feed data and retained per s262A ITAA 1936.
        Not official bank statements.
      </p>
    </div>
  );
}
