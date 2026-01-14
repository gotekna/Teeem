"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  TrendingUp,
  Download,
  RefreshCw,
  FileText,
  Users,
} from "lucide-react";
import { useProfitReport } from "@/hooks/useEmailSubscriptions";
import { cn } from "@/lib/utils";
import type { ProfitReport } from "@/lib/email-reseller-types";

// Get available months for selection
function getAvailableMonths(): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
    months.push({ value, label });
  }

  return months;
}

export default function ReportsPage() {
  const { report, loading, fetchReport } = useProfitReport();
  const [selectedMonth, setSelectedMonth] = React.useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [refreshing, setRefreshing] = React.useState(false);

  const months = React.useMemo(() => getAvailableMonths(), []);

  // Calculate date range from selected month
  const getDateRange = (monthStr: string) => {
    const [year, month] = monthStr.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    return {
      start: startDate.toISOString().split("T")[0],
      end: endDate.toISOString().split("T")[0],
    };
  };

  // Fetch report on month change
  React.useEffect(() => {
    const { start, end } = getDateRange(selectedMonth);
    fetchReport(start, end);
  }, [selectedMonth, fetchReport]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const { start, end } = getDateRange(selectedMonth);
    await fetchReport(start, end);
    setRefreshing(false);
  };

  const handleExport = () => {
    if (!report) return;

    // Build CSV content
    const headers = ["Customer", "Domain", "Mailboxes", "Retail", "Wholesale", "Margin", "Margin %"];
    const rows = report.by_subscription.map((sub) => [
      sub.contact_name,
      sub.domain,
      sub.mailbox_count,
      sub.retail.toFixed(2),
      sub.wholesale.toFixed(2),
      sub.margin.toFixed(2),
      `${sub.margin_percentage.toFixed(1)}%`,
    ]);

    // Add totals row
    rows.push([
      "TOTAL",
      "",
      report.summary.mailbox_count,
      report.summary.total_retail.toFixed(2),
      report.summary.total_wholesale.toFixed(2),
      report.summary.total_margin.toFixed(2),
      `${report.summary.margin_percentage.toFixed(1)}%`,
    ]);

    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    // Download
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `profit-report-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Profit Report</h2>
          <p className="text-sm text-muted-foreground">
            Revenue and margin analysis for email subscriptions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!report}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Retail</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(report?.summary.total_retail || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              From {report?.summary.subscription_count || 0} subscriptions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wholesale Cost</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(report?.summary.total_wholesale || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {report?.summary.mailbox_count || 0} mailboxes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(report?.summary.total_margin || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Your profit this period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margin %</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(report?.summary.margin_percentage || 0).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Average margin rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue by Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead className="text-right">Mailboxes</TableHead>
                <TableHead className="text-right">Retail</TableHead>
                <TableHead className="text-right">Wholesale</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!report || report.by_subscription.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No data for this period
                  </TableCell>
                </TableRow>
              ) : (
                report.by_subscription.map((sub) => (
                  <TableRow key={sub.subscription_id}>
                    <TableCell className="font-medium">{sub.contact_name}</TableCell>
                    <TableCell>{sub.domain}</TableCell>
                    <TableCell className="text-right">{sub.mailbox_count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(sub.retail)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatCurrency(sub.wholesale)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(sub.margin)}
                    </TableCell>
                    <TableCell className="text-right">{sub.margin_percentage.toFixed(1)}%</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {report && report.by_subscription.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">TOTAL</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-bold">
                    {report.summary.mailbox_count}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(report.summary.total_retail)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-muted-foreground">
                    {formatCurrency(report.summary.total_wholesale)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-green-600">
                    {formatCurrency(report.summary.total_margin)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {report.summary.margin_percentage.toFixed(1)}%
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      {/* Annual Projection */}
      {report && report.summary.total_margin > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Annual Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Projected Annual Revenue</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(report.summary.total_retail * 12)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projected Annual Cost</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(report.summary.total_wholesale * 12)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projected Annual Profit</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(report.summary.total_margin * 12)}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              * Based on current month's figures. Actual results may vary.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
