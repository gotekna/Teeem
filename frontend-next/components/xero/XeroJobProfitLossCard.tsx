"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { XeroReportRow } from "./types";

interface XeroJobPLReport {
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
  job?: { id: number | string; name?: string };
}

/** Australian FY helper: FY starting Jul of given year */
function fyRange(startYear: number) {
  return {
    from: `${startYear}-07-01`,
    to: `${startYear + 1}-06-30`,
    label: `FY ${startYear}/${String(startYear + 1).slice(-2)}`,
  };
}

/** Build date presets (Australian FY = 1 Jul - 30 Jun) */
function getPresets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const fyStart = m >= 6 ? y : y - 1; // FY starts in July (month 6)

  const monthStart = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const monthEnd = `${y}-${String(m + 1).padStart(2, "0")}-${lastDay}`;

  const prevM = m === 0 ? 11 : m - 1;
  const prevY = m === 0 ? y - 1 : y;
  const prevLastDay = new Date(prevY, prevM + 1, 0).getDate();
  const prevMonthStart = `${prevY}-${String(prevM + 1).padStart(2, "0")}-01`;
  const prevMonthEnd = `${prevY}-${String(prevM + 1).padStart(2, "0")}-${prevLastDay}`;

  // Quarter (Australian: Jul-Sep, Oct-Dec, Jan-Mar, Apr-Jun)
  const qStarts = [6, 9, 0, 3]; // month indices for AU quarter starts
  const qIdx = qStarts.findLastIndex((qs) => m >= qs);
  const qStartMonth = qStarts[qIdx];
  const qStartYear = qStartMonth > m ? y - 1 : y;
  const qEndMonth = qStartMonth + 2;
  const qEndYear = qEndMonth > 11 ? qStartYear + 1 : qStartYear;
  const qEndLastDay = new Date(qEndYear, (qEndMonth % 12) + 1, 0).getDate();
  const thisQStart = `${qStartYear}-${String(qStartMonth + 1).padStart(2, "0")}-01`;
  const thisQEnd = `${qEndYear}-${String((qEndMonth % 12) + 1).padStart(2, "0")}-${qEndLastDay}`;

  const fy = fyRange(fyStart);
  const lastFy = fyRange(fyStart - 1);

  return [
    { key: "this_fy", label: `This Financial Year (${fy.label})`, from: fy.from, to: fy.to },
    { key: "last_fy", label: `Last Financial Year (${lastFy.label})`, from: lastFy.from, to: lastFy.to },
    { key: "this_month", label: "This Month", from: monthStart, to: monthEnd },
    { key: "last_month", label: "Last Month", from: prevMonthStart, to: prevMonthEnd },
    { key: "this_quarter", label: "This Quarter", from: thisQStart, to: thisQEnd },
    { key: "all_time", label: "All Time", from: "2015-01-01", to: fy.to },
  ];
}

export function XeroJobProfitLossCard({ jobId, job }: XeroJobProfitLossCardProps) {
  const [report, setReport] = React.useState<XeroJobPLReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = React.useState("this_fy");
  const [periods, setPeriods] = React.useState(3);
  const [incGst, setIncGst] = React.useState(false);

  const presets = React.useMemo(() => getPresets(), []);
  const resolvedJobId = jobId || job?.id;

  const currentPreset = presets.find((p) => p.key === selectedPreset) || presets[0];

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
          from_date: currentPreset.from,
          to_date: currentPreset.to,
          periods,
          inc_gst: incGst,
        },
      });

      if (response?.success && response.report) {
        setReport(response.report);
      } else {
        setError(response?.error || "Failed to load report");
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError?.response?.data?.error || "Failed to load Profit & Loss report");
    } finally {
      setLoading(false);
    }
  }, [resolvedJobId, currentPreset.from, currentPreset.to, periods, incGst]);

  // Auto-load on mount and when preset/periods change
  React.useEffect(() => {
    if (resolvedJobId) {
      loadReport();
    }
  }, [resolvedJobId, loadReport]);

  return (
    <Card>
      <CardContent className="pt-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {presets.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Compare</span>
            <select
              value={periods}
              onChange={(e) => setPeriods(Number(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value={0}>No comparison</option>
              <option value={1}>+ 1 prior period</option>
              <option value={2}>+ 2 prior periods</option>
              <option value={3}>+ 3 prior periods</option>
              <option value={4}>+ 4 prior periods</option>
            </select>
          </div>
          <Button onClick={loadReport} disabled={loading} size="sm" variant="outline">
            {loading ? <Spinner size={16} /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
          <label className="flex items-center gap-2 cursor-pointer select-none ml-2">
            <input
              type="checkbox"
              checked={incGst}
              onChange={(e) => setIncGst(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">Inc. GST</span>
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-4">
            {error}
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
            {report.titles && report.titles.length > 0 && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold">{report.titles[0]}</h3>
                {report.titles.slice(1).map((title, idx) => (
                  <p key={idx} className="text-sm text-muted-foreground">{title}</p>
                ))}
              </div>
            )}
            <PLReportTable rows={report.rows} />
          </div>
        )}

        {/* Empty state */}
        {!report && !loading && !error && (
          <p className="text-center py-8 text-muted-foreground">Select a period to view the report</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Renders the P&L report rows as a financial statement table */
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
