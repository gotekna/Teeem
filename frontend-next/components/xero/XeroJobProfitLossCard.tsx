"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw, BarChart3 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { XeroReportRow } from "./types";

interface XeroJobPLReport {
  title?: string;
  titles?: string[];
  from_date: string;
  to_date: string;
  periods: number;
  timeframe: string;
  tracking_option_name?: string;
  rows: XeroReportRow[];
}

interface XeroJobProfitLossCardProps {
  jobId?: string | number;
  job?: { id: number | string; name?: string; xero_tracking_option_name?: string };
}

/**
 * XeroJobProfitLossCard - Shows Xero P&L report filtered by this job's tracking category
 *
 * Displays a multi-year comparison table matching Xero's native P&L layout:
 * Trading Income, Cost of Sales, Operating Expenses, Net Profit
 */
export function XeroJobProfitLossCard({ jobId, job }: XeroJobProfitLossCardProps) {
  const [report, setReport] = React.useState<XeroJobPLReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Default to Australian financial year (1 Jul - 30 Jun)
  const now = new Date();
  const fyStartYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const defaultFrom = `${fyStartYear}-07-01`;
  const defaultTo = `${fyStartYear + 1}-06-30`;

  const [dateRange, setDateRange] = React.useState({ from: defaultFrom, to: defaultTo });
  const [periods, setPeriods] = React.useState(3);

  const resolvedJobId = jobId || job?.id;

  const loadReport = React.useCallback(async () => {
    if (!resolvedJobId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        report: XeroJobPLReport;
        error?: string;
      }>(`/api/v1/jobs/${resolvedJobId}/xero_profit_loss`, {
        params: {
          from_date: dateRange.from,
          to_date: dateRange.to,
          periods,
          timeframe: "YEAR",
        },
      });

      if (response?.success && response.report) {
        setReport(response.report);
      } else {
        setError(response?.error || "Failed to load report");
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const errorMessage =
        axiosError?.response?.data?.error ||
        "Failed to load Profit & Loss report. This job may not have a Xero tracking option linked.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [resolvedJobId, dateRange.from, dateRange.to, periods]);

  // Auto-load on mount
  React.useEffect(() => {
    if (resolvedJobId) {
      loadReport();
    }
  }, [resolvedJobId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Date range:</span>
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
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Compare with</span>
            <select
              value={periods}
              onChange={(e) => setPeriods(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value={0}>No comparison</option>
              <option value={1}>1 year</option>
              <option value={2}>2 years</option>
              <option value={3}>3 years</option>
              <option value={4}>4 years</option>
            </select>
          </div>
          <Button onClick={loadReport} disabled={loading} size="sm" variant="outline">
            {loading ? <Spinner size={16} /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Update</span>
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!report && !loading && !error && (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Loading Profit & Loss report from Xero...</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Spinner size={32} className="text-muted-foreground" />
          </div>
        )}

        {/* Report */}
        {report && !loading && (
          <div>
            {/* Report header */}
            {report.titles && report.titles.length > 0 && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold">{report.titles[0]}</h3>
                {report.titles.slice(1).map((title, idx) => (
                  <p key={idx} className="text-sm text-muted-foreground">{title}</p>
                ))}
                {report.tracking_option_name && (
                  <p className="text-sm text-muted-foreground">
                    JOB ID is {report.tracking_option_name}
                  </p>
                )}
              </div>
            )}

            {/* Report table */}
            <PLReportTable rows={report.rows} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * PLReportTable - Renders the Xero P&L report rows as a financial statement table
 */
function PLReportTable({ rows }: { rows: XeroReportRow[] }) {
  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, idx) => {
            if (row.row_type === "Header") {
              return (
                <tr key={idx} className="bg-muted/50 border-b">
                  {row.cells?.map((cell, cellIdx) => (
                    <th
                      key={cellIdx}
                      className={cn(
                        "py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                        cellIdx > 0 && "text-right"
                      )}
                    >
                      {cell.value}
                    </th>
                  ))}
                </tr>
              );
            }

            if (row.row_type === "Section" && row.title) {
              return (
                <tr key={idx} className="bg-muted/20">
                  <td colSpan={10} className="py-2 px-4 font-semibold text-foreground">
                    {row.title}
                  </td>
                </tr>
              );
            }

            if (row.row_type === "Row" && row.cells) {
              return (
                <tr key={idx} className="border-b border-border/50 hover:bg-muted/10">
                  {row.cells.map((cell, cellIdx) => {
                    const isAmount = cellIdx > 0;
                    const numVal = isAmount ? parseFloat(cell.value?.replace(/,/g, "") || "0") : 0;
                    const isNegative = isAmount && numVal < 0;

                    return (
                      <td
                        key={cellIdx}
                        className={cn(
                          "py-1.5 px-4",
                          cellIdx === 0 && "pl-8",
                          isAmount && "text-right font-mono tabular-nums",
                          isNegative && "text-red-600 dark:text-red-400",
                          !isNegative && isAmount && numVal > 0 && "text-blue-600 dark:text-blue-400"
                        )}
                      >
                        {isAmount ? formatAmount(cell.value) : cell.value}
                      </td>
                    );
                  })}
                </tr>
              );
            }

            if (row.row_type === "SummaryRow" && row.cells) {
              return (
                <tr key={idx} className="border-t-2 border-border font-semibold bg-muted/30">
                  {row.cells.map((cell, cellIdx) => {
                    const isAmount = cellIdx > 0;
                    const numVal = isAmount ? parseFloat(cell.value?.replace(/,/g, "") || "0") : 0;
                    const isNegative = isAmount && numVal < 0;

                    return (
                      <td
                        key={cellIdx}
                        className={cn(
                          "py-2 px-4",
                          isAmount && "text-right font-mono tabular-nums",
                          isNegative && "text-red-600 dark:text-red-400"
                        )}
                      >
                        {isAmount ? formatAmount(cell.value) : cell.value}
                      </td>
                    );
                  })}
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

/** Format amount: add comma separators, handle negatives with brackets */
function formatAmount(value?: string): string {
  if (!value || value === "-" || value.trim() === "") return "-";
  const num = parseFloat(value.replace(/,/g, ""));
  if (isNaN(num)) return value;
  if (num === 0) return "-";

  const formatted = Math.abs(num).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return num < 0 ? `(${formatted})` : formatted;
}

export default XeroJobProfitLossCard;
