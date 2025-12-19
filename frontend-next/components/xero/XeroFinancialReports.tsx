"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  RefreshCw,
  BarChart3,
  Database,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { XeroReportRow } from "./types";

interface XeroReport {
  rows: XeroReportRow[];
}

interface XeroProfitLossCardProps {
  companyId: string;
}

/**
 * XeroProfitLossCard - Displays Profit & Loss report from Xero
 *
 * Features:
 * - Date range selection (from/to)
 * - Loads report data on demand
 * - Renders sections, rows, and summary rows
 */
export function XeroProfitLossCard({ companyId }: XeroProfitLossCardProps) {
  const [report, setReport] = React.useState<XeroReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dateRange, setDateRange] = React.useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0], // Jan 1 of current year
    to: new Date().toISOString().split("T")[0], // Today
  });

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        report: XeroReport;
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/profit_loss`, {
        params: { from_date: dateRange.from, to_date: dateRange.to }
      });

      if (response?.success && response.report) {
        setReport(response.report);
      } else {
        setError(response?.error || "Failed to load report");
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const errorMessage = axiosError?.response?.data?.error || "Failed to load Profit & Loss report from Xero";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Profit & Loss Report</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="w-36"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="w-36"
            />
            <Button onClick={loadReport} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Load</span>
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

        {!report && !loading && !error && (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a date range and click Load to view the Profit & Loss report</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {report && report.rows && (
          <ReportTable rows={report.rows} />
        )}
      </CardContent>
    </Card>
  );
}

interface XeroBalanceSheetCardProps {
  companyId: string;
}

/**
 * XeroBalanceSheetCard - Displays Balance Sheet report from Xero
 *
 * Features:
 * - Single date selection (as of date)
 * - Loads report data on demand
 * - Renders sections, rows, and summary rows
 */
export function XeroBalanceSheetCard({ companyId }: XeroBalanceSheetCardProps) {
  const [report, setReport] = React.useState<XeroReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [asOfDate, setAsOfDate] = React.useState(new Date().toISOString().split("T")[0]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        report: XeroReport;
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/balance_sheet`, {
        params: { date: asOfDate }
      });

      if (response?.success && response.report) {
        setReport(response.report);
      } else {
        setError(response?.error || "Failed to load report");
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const errorMessage = axiosError?.response?.data?.error || "Failed to load Balance Sheet from Xero";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Balance Sheet</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">As of:</span>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-36"
            />
            <Button onClick={loadReport} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Load</span>
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

        {!report && !loading && !error && (
          <div className="text-center py-12 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a date and click Load to view the Balance Sheet</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {report && report.rows && (
          <ReportTable rows={report.rows} />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * ReportTable - Shared component for rendering Xero financial report rows
 */
function ReportTable({ rows }: { rows: XeroReportRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, idx) => {
            if (row.row_type === "Header") {
              return (
                <tr key={idx} className="bg-muted/50 font-semibold">
                  {row.cells?.map((cell, cellIdx) => (
                    <td key={cellIdx} className="py-2 px-3">{cell.value}</td>
                  ))}
                </tr>
              );
            }
            if (row.row_type === "Section" && row.title) {
              return (
                <tr key={idx} className="bg-muted/30 font-medium">
                  <td colSpan={10} className="py-2 px-3">{row.title}</td>
                </tr>
              );
            }
            if (row.row_type === "Row" && row.cells) {
              return (
                <tr key={idx} className="border-b hover:bg-muted/20">
                  {row.cells.map((cell, cellIdx) => (
                    <td key={cellIdx} className={cn("py-1.5 px-3", cellIdx > 0 && "text-right font-mono")}>
                      {cell.value}
                    </td>
                  ))}
                </tr>
              );
            }
            if (row.row_type === "SummaryRow" && row.cells) {
              return (
                <tr key={idx} className="border-t-2 font-semibold bg-muted/20">
                  {row.cells.map((cell, cellIdx) => (
                    <td key={cellIdx} className={cn("py-2 px-3", cellIdx > 0 && "text-right font-mono")}>
                      {cell.value}
                    </td>
                  ))}
                </tr>
              );
            }
            return null;
          })}
        </tbody>
      </table>
    </div>
  );
}
