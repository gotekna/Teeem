"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MonthlyPLData {
  id: number;
  month: string;
  revenue: number;
  expenses: number;
  net_profit: number;
}

interface XeroProfitLossMonthlyProps {
  companyId: string;
}

/**
 * XeroProfitLossMonthly - Displays monthly P&L summaries in a table format
 *
 * Features:
 * - Loads monthly P&L data from Xero (last 3 financial years by default)
 * - Displays Month, Revenue, Expenses, Net Profit columns
 * - Color-coded profit/loss values
 * - Sorted by most recent month first
 */
export function XeroProfitLossMonthly({ companyId }: XeroProfitLossMonthlyProps) {
  const [data, setData] = React.useState<MonthlyPLData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fromDate, setFromDate] = React.useState<string>("");
  const [toDate, setToDate] = React.useState<string>("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        data: MonthlyPLData[];
        from_date?: string;
        to_date?: string;
        months_count?: number;
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/profit_loss_monthly`);

      if (response?.success && response.data) {
        setData(response.data);
        setFromDate(response.from_date || "");
        setToDate(response.to_date || "");
      } else {
        setError(response?.error || "Failed to load monthly P&L data");
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const errorMessage = axiosError?.response?.data?.error || "Failed to load monthly P&L data from Xero";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on mount
  React.useEffect(() => {
    loadData();
  }, [companyId]);

  // Format currency for display
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate totals
  const totals = React.useMemo(() => {
    return data.reduce(
      (acc, row) => ({
        revenue: acc.revenue + row.revenue,
        expenses: acc.expenses + row.expenses,
        net_profit: acc.net_profit + row.net_profit,
      }),
      { revenue: 0, expenses: 0, net_profit: 0 }
    );
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Profit & Loss
            </CardTitle>
            {fromDate && toDate && (
              <p className="text-sm text-muted-foreground mt-1">
                {fromDate} to {toDate}
              </p>
            )}
          </div>
          <Button onClick={loadData} disabled={loading} size="sm" variant="outline">
            {loading ? <Spinner size={16} /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {loading && data.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Spinner size={32} className="text-muted-foreground" />
          </div>
        )}

        {!loading && data.length === 0 && !error && (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No monthly P&L data available</p>
            <p className="text-sm mt-2">Make sure your Xero connection has the accounting.reports.read scope</p>
          </div>
        )}

        {data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 font-semibold">
                  <th className="py-3 px-4 text-left">Month</th>
                  <th className="py-3 px-4 text-right">Revenue</th>
                  <th className="py-3 px-4 text-right">Expenses</th>
                  <th className="py-3 px-4 text-right">Net Profit</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-muted/20">
                    <td className="py-2.5 px-4 font-medium">{row.month}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-green-600 dark:text-green-400">
                      {formatCurrency(row.revenue)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-red-600 dark:text-red-400">
                      {formatCurrency(row.expenses)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 font-semibold",
                          row.net_profit >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {row.net_profit >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {formatCurrency(row.net_profit)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-semibold">
                  <td className="py-3 px-4">Total ({data.length} months)</td>
                  <td className="py-3 px-4 text-right font-mono text-green-600 dark:text-green-400">
                    {formatCurrency(totals.revenue)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-red-600 dark:text-red-400">
                    {formatCurrency(totals.expenses)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        totals.net_profit >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      {totals.net_profit >= 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {formatCurrency(totals.net_profit)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default XeroProfitLossMonthly;
