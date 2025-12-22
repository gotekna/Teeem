"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  RefreshCw,
  BarChart3,
  Database,
  Building2,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { XeroReportRow } from "./types";

interface Subsidiary {
  id: number;
  name: string;
  code?: string;
  has_xero_connection?: boolean;
}

interface CompanyReport {
  company_id: number;
  company_name: string;
  success: boolean;
  error?: string;
  rows?: XeroReportRow[];
}

interface XeroConsolidatedCardProps {
  companyId: string;
  companyName?: string;
}

/**
 * XeroConsolidatedCard - Consolidated financial reports for head companies
 *
 * Shows P&L and Balance Sheet data combined from all subsidiaries.
 * Only useful for head companies (companies with subsidiaries).
 */
export function XeroConsolidatedCard({ companyId, companyName }: XeroConsolidatedCardProps) {
  const [subsidiaries, setSubsidiaries] = React.useState<Subsidiary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingReports, setLoadingReports] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<"profit-loss" | "balance-sheet">("profit-loss");

  // Report data
  const [plReports, setPlReports] = React.useState<CompanyReport[]>([]);
  const [bsReports, setBsReports] = React.useState<CompanyReport[]>([]);

  // Date range for P&L
  const [plDateRange, setPlDateRange] = React.useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  // Date for Balance Sheet
  const [bsDate, setBsDate] = React.useState(new Date().toISOString().split("T")[0]);

  // Load subsidiaries
  React.useEffect(() => {
    loadSubsidiaries();
  }, [companyId]);

  const loadSubsidiaries = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get company details including subsidiaries
      const response = await api.get<{
        success: boolean;
        data: {
          id: number;
          name: string;
          subsidiaries?: Subsidiary[];
        };
      }>(`/api/v1/companies/${companyId}`);

      if (response.success && response.data) {
        const subs = response.data.subsidiaries || [];
        // Add parent company to the list
        setSubsidiaries([
          { id: response.data.id, name: response.data.name, has_xero_connection: true },
          ...subs,
        ]);
      } else {
        setError("Failed to load company data");
      }
    } catch (err) {
      setError("Failed to load subsidiaries");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadProfitLossReports = async () => {
    if (subsidiaries.length === 0) return;

    setLoadingReports(true);
    const reports: CompanyReport[] = [];

    for (const sub of subsidiaries) {
      try {
        const response = await api.get<{
          success: boolean;
          report?: { rows: XeroReportRow[] };
          error?: string;
        }>(`/api/v1/companies/${sub.id}/xero/profit_loss`, {
          params: { from_date: plDateRange.from, to_date: plDateRange.to }
        });

        if (response.success && response.report) {
          reports.push({
            company_id: sub.id,
            company_name: sub.name,
            success: true,
            rows: response.report.rows,
          });
        } else {
          reports.push({
            company_id: sub.id,
            company_name: sub.name,
            success: false,
            error: response.error || "Failed to load",
          });
        }
      } catch (err) {
        reports.push({
          company_id: sub.id,
          company_name: sub.name,
          success: false,
          error: "Not connected to Xero",
        });
      }
    }

    setPlReports(reports);
    setLoadingReports(false);
  };

  const loadBalanceSheetReports = async () => {
    if (subsidiaries.length === 0) return;

    setLoadingReports(true);
    const reports: CompanyReport[] = [];

    for (const sub of subsidiaries) {
      try {
        const response = await api.get<{
          success: boolean;
          report?: { rows: XeroReportRow[] };
          error?: string;
        }>(`/api/v1/companies/${sub.id}/xero/balance_sheet`, {
          params: { date: bsDate }
        });

        if (response.success && response.report) {
          reports.push({
            company_id: sub.id,
            company_name: sub.name,
            success: true,
            rows: response.report.rows,
          });
        } else {
          reports.push({
            company_id: sub.id,
            company_name: sub.name,
            success: false,
            error: response.error || "Failed to load",
          });
        }
      } catch (err) {
        reports.push({
          company_id: sub.id,
          company_name: sub.name,
          success: false,
          error: "Not connected to Xero",
        });
      }
    }

    setBsReports(reports);
    setLoadingReports(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (subsidiaries.length <= 1) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No Subsidiaries Found</p>
            <p className="text-sm mt-2">
              This company has no subsidiaries. Consolidated reports are only available for head companies with subsidiary entities.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Consolidated Reports
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Combined financial data from {subsidiaries.length} entities
            </p>
          </div>
          <div className="flex items-center gap-2">
            {subsidiaries.map((sub) => (
              <Badge
                key={sub.id}
                variant={sub.has_xero_connection ? "default" : "secondary"}
                className="text-xs"
              >
                {sub.name.substring(0, 15)}{sub.name.length > 15 ? "..." : ""}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "profit-loss" | "balance-sheet")}>
          <TabsList className="mb-4">
            <TabsTrigger value="profit-loss" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Profit & Loss
            </TabsTrigger>
            <TabsTrigger value="balance-sheet" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Balance Sheet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profit-loss">
            <div className="space-y-4">
              {/* Date range selector */}
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <Input
                  type="date"
                  value={plDateRange.from}
                  onChange={(e) => setPlDateRange({ ...plDateRange, from: e.target.value })}
                  className="w-36"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={plDateRange.to}
                  onChange={(e) => setPlDateRange({ ...plDateRange, to: e.target.value })}
                  className="w-36"
                />
                <Button onClick={loadProfitLossReports} disabled={loadingReports} size="sm">
                  {loadingReports ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="ml-2">Load All</span>
                </Button>
              </div>

              {/* Results */}
              {plReports.length === 0 && !loadingReports && (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a date range and click "Load All" to view consolidated P&L</p>
                </div>
              )}

              {loadingReports && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading reports from all companies...</span>
                </div>
              )}

              {plReports.length > 0 && (
                <ConsolidatedReportTable reports={plReports} reportType="P&L" />
              )}
            </div>
          </TabsContent>

          <TabsContent value="balance-sheet">
            <div className="space-y-4">
              {/* Date selector */}
              <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                <span className="text-sm text-muted-foreground">As of:</span>
                <Input
                  type="date"
                  value={bsDate}
                  onChange={(e) => setBsDate(e.target.value)}
                  className="w-36"
                />
                <Button onClick={loadBalanceSheetReports} disabled={loadingReports} size="sm">
                  {loadingReports ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="ml-2">Load All</span>
                </Button>
              </div>

              {/* Results */}
              {bsReports.length === 0 && !loadingReports && (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a date and click "Load All" to view consolidated Balance Sheet</p>
                </div>
              )}

              {loadingReports && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Loading reports from all companies...</span>
                </div>
              )}

              {bsReports.length > 0 && (
                <ConsolidatedReportTable reports={bsReports} reportType="Balance Sheet" />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/**
 * ConsolidatedReportTable - Shows financial data from multiple companies side by side
 */
function ConsolidatedReportTable({ reports, reportType }: { reports: CompanyReport[]; reportType: string }) {
  const successfulReports = reports.filter((r) => r.success);
  const failedReports = reports.filter((r) => !r.success);

  // Build a combined row structure
  // We'll use the first successful report as the template
  const templateReport = successfulReports[0];

  if (!templateReport || !templateReport.rows) {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">No Data Available</span>
          </div>
          <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
            None of the companies returned valid {reportType} data.
          </p>
        </div>

        {/* Show failed companies */}
        {failedReports.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Failed to load:</p>
            {failedReports.map((r) => (
              <div key={r.company_id} className="flex items-center gap-2 text-sm text-red-600">
                <XCircle className="h-4 w-4" />
                <span>{r.company_name}: {r.error}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status summary */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>{successfulReports.length} loaded</span>
        </div>
        {failedReports.length > 0 && (
          <div className="flex items-center gap-1 text-red-600">
            <XCircle className="h-4 w-4" />
            <span>{failedReports.length} failed</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="py-2 px-3 text-left font-medium">Account</th>
              {successfulReports.map((r) => (
                <th key={r.company_id} className="py-2 px-3 text-right font-medium min-w-[120px]">
                  {r.company_name.substring(0, 12)}
                  {r.company_name.length > 12 ? "..." : ""}
                </th>
              ))}
              <th className="py-2 px-3 text-right font-medium bg-primary/10 min-w-[120px]">
                Consolidated
              </th>
            </tr>
          </thead>
          <tbody>
            {templateReport.rows.map((row, idx) => {
              if (row.row_type === "Section" && row.title) {
                return (
                  <tr key={idx} className="bg-muted/30">
                    <td colSpan={successfulReports.length + 2} className="py-2 px-3 font-medium">
                      {row.title}
                    </td>
                  </tr>
                );
              }

              if (row.row_type === "Row" && row.cells && row.cells.length >= 2) {
                const accountName = row.cells[0]?.value || "";

                // Get values from each company's report
                const values = successfulReports.map((r) => {
                  const matchingRow = r.rows?.find(
                    (rr) => rr.row_type === "Row" && rr.cells?.[0]?.value === accountName
                  );
                  const valueStr = matchingRow?.cells?.[1]?.value || "0";
                  // Parse numeric value (remove formatting)
                  const numValue = parseFloat(valueStr.replace(/[^0-9.-]/g, "")) || 0;
                  return numValue;
                });

                const total = values.reduce((sum, v) => sum + v, 0);

                return (
                  <tr key={idx} className="border-b hover:bg-muted/20">
                    <td className="py-1.5 px-3">{accountName}</td>
                    {values.map((val, i) => (
                      <td key={i} className="py-1.5 px-3 text-right font-mono">
                        {formatCurrency(val)}
                      </td>
                    ))}
                    <td className="py-1.5 px-3 text-right font-mono font-medium bg-primary/5">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                );
              }

              if (row.row_type === "SummaryRow" && row.cells && row.cells.length >= 2) {
                const summaryName = row.cells[0]?.value || "";

                const values = successfulReports.map((r) => {
                  const matchingRow = r.rows?.find(
                    (rr) => rr.row_type === "SummaryRow" && rr.cells?.[0]?.value === summaryName
                  );
                  const valueStr = matchingRow?.cells?.[1]?.value || "0";
                  const numValue = parseFloat(valueStr.replace(/[^0-9.-]/g, "")) || 0;
                  return numValue;
                });

                const total = values.reduce((sum, v) => sum + v, 0);

                return (
                  <tr key={idx} className="border-t-2 font-semibold bg-muted/20">
                    <td className="py-2 px-3">{summaryName}</td>
                    {values.map((val, i) => (
                      <td key={i} className="py-2 px-3 text-right font-mono">
                        {formatCurrency(val)}
                      </td>
                    ))}
                    <td className="py-2 px-3 text-right font-mono font-bold bg-primary/10">
                      {formatCurrency(total)}
                    </td>
                  </tr>
                );
              }

              return null;
            })}
          </tbody>
        </table>
      </div>

      {/* Failed companies */}
      {failedReports.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
            Could not load data from:
          </p>
          <div className="space-y-1">
            {failedReports.map((r) => (
              <div key={r.company_id} className="text-sm text-red-600 dark:text-red-400">
                • {r.company_name}: {r.error}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatCurrency(value: number): string {
  if (value === 0) return "-";
  const formatted = Math.abs(value).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `(${formatted})` : formatted;
}

export default XeroConsolidatedCard;
