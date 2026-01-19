"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  Download,
  FileText,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import { safePercent } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";

interface AgingBucket {
  label: string;
  amount: number;
  count: number;
  percentage: number;
}

interface CustomerAging {
  contact_id: number;
  contact_name: string;
  current: number;
  days_30: number;
  days_60: number;
  days_90: number;
  days_over_90: number;
  total: number;
  oldest_invoice_date: string | null;
  invoice_count: number;
}

interface AgingSummary {
  total_outstanding: number;
  current: number;
  overdue: number;
  average_days_outstanding: number;
  aging_buckets: AgingBucket[];
  top_customers: CustomerAging[];
}

interface AgedReport {
  summary: AgingSummary;
  by_customer: CustomerAging[];
  generated_at: string;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AgedReportsTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportType, setReportType] = useState<"receivables" | "payables">("receivables");
  const [report, setReport] = useState<AgedReport | null>(null);
  const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0]);

  const fetchReport = useCallback(async () => {
    try {
      const endpoint = reportType === "receivables"
        ? "/api/v1/gl/aged_reports/receivables"
        : "/api/v1/gl/aged_reports/payables";

      const response = await api.get<{ success: boolean; data: AgedReport }>(
        `${endpoint}?as_of_date=${asOfDate}`
      );

      if (response?.success) {
        setReport(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch aged report:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [reportType, asOfDate]);

  useEffect(() => {
    setLoading(true);
    fetchReport();
  }, [fetchReport]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchReport();
  };

  const handleExport = async () => {
    try {
      const endpoint = reportType === "receivables"
        ? "/api/v1/gl/aged_reports/receivables/export"
        : "/api/v1/gl/aged_reports/payables/export";

      const response = await api.get<Blob>(`${endpoint}?as_of_date=${asOfDate}&format=csv`, {
        responseType: "blob",
      } as never);

      const url = window.URL.createObjectURL(response);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aged_${reportType}_${asOfDate}.csv`;
      a.click();
    } catch (error) {
      console.error("Failed to export report:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const summary = report?.summary;

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Tabs value={reportType} onValueChange={(v) => setReportType(v as "receivables" | "payables")}>
            <TabsList>
              <TabsTrigger value="receivables" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Receivables (AR)
              </TabsTrigger>
              <TabsTrigger value="payables" className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Payables (AP)
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.total_outstanding)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.top_customers?.length || 0} {reportType === "receivables" ? "customers" : "suppliers"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current (0-30 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.current)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.total_outstanding > 0
                  ? `${((summary.current / summary.total_outstanding) * 100).toFixed(1)}% of total`
                  : "0%"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overdue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.overdue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.total_outstanding > 0
                  ? `${((summary.overdue / summary.total_outstanding) * 100).toFixed(1)}% of total`
                  : "0%"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Days Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.average_days_outstanding?.toFixed(0) || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">days average</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Aging Buckets */}
      {summary?.aging_buckets && summary.aging_buckets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Aging Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              {summary.aging_buckets.map((bucket, idx) => (
                <div key={idx} className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-sm font-medium text-muted-foreground mb-1">
                    {bucket.label}
                  </div>
                  <div className={`text-xl font-bold ${idx > 2 ? "text-red-600" : idx > 1 ? "text-orange-600" : ""}`}>
                    {formatCurrency(bucket.amount)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {bucket.count} invoices ({safePercent(bucket.percentage)})
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${idx > 2 ? "bg-red-500" : idx > 1 ? "bg-orange-500" : idx > 0 ? "bg-yellow-500" : "bg-green-500"}`}
                      style={{ width: `${bucket.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer/Supplier Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {reportType === "receivables" ? (
              <Users className="h-5 w-5" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
            {reportType === "receivables" ? "By Customer" : "By Supplier"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!report?.by_customer || report.by_customer.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No outstanding {reportType}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{reportType === "receivables" ? "Customer" : "Supplier"}</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">1-30 Days</TableHead>
                  <TableHead className="text-right">31-60 Days</TableHead>
                  <TableHead className="text-right">61-90 Days</TableHead>
                  <TableHead className="text-right">90+ Days</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Invoices</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.by_customer.map((customer) => (
                  <TableRow key={customer.contact_id}>
                    <TableCell className="font-medium">
                      {customer.contact_name}
                      {customer.days_over_90 > 0 && (
                        <Badge variant="destructive" className="ml-2">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Overdue
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(customer.current)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(customer.days_30)}</TableCell>
                    <TableCell className="text-right text-orange-600">{formatCurrency(customer.days_60)}</TableCell>
                    <TableCell className="text-right text-orange-700">{formatCurrency(customer.days_90)}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">{formatCurrency(customer.days_over_90)}</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(customer.total)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{customer.invoice_count}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
