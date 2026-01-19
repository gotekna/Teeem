"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { api, getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

// Types
interface BalanceSheet {
  assets: { total: number; details: Record<string, number> };
  liabilities: { total: number; details: Record<string, number> };
  equity: { total: number; details: Record<string, number> };
  balanced: boolean;
}

interface ProfitLoss {
  revenue: { total: number; details: Record<string, number> };
  expenses: { total: number; details: Record<string, number> };
  net_profit: number;
  profit_margin: number;
}

interface JobProfitability {
  construction_id: number;
  job_name: string;
  income: number;
  expenses: number;
  net_profit: number;
  profit_margin: number;
}

const formatCurrency = (amount: number) => {
  return `$${(amount || 0).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export default function FinancialReportsPage() {
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();

  // URL is SSoT for tab state (path-based navigation)
  const activeTab = useMemo(() => {
    const parts = pathname.replace("/financial/reports", "").split("/").filter(Boolean);
    return parts[0] || "balance_sheet";
  }, [pathname]);

  // Redirect to default tab if no tab in URL
  useEffect(() => {
    if (!pathname.includes("/financial/reports/")) {
      router.replace("/financial/reports/balance_sheet", { scroll: false });
    }
  }, [pathname, router]);

  const handleTabChange = useCallback((tabId: string) => {
    router.push(`/financial/reports/${tabId}`, { scroll: false });
  }, [router]);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [profitLoss, setProfitLoss] = useState<ProfitLoss | null>(null);
  const [jobProfitability, setJobProfitability] = useState<JobProfitability[]>([]);
  const [loading, setLoading] = useState(false);

  // Date filters
  const [balanceSheetDate, setBalanceSheetDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [plFromDate, setPlFromDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0]
  );
  const [plToDate, setPlToDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [jobFromDate, setJobFromDate] = useState("");
  const [jobToDate, setJobToDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const fetchBalanceSheet = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; balance_sheet: BalanceSheet }>(
        "/api/v1/financial_reports/balance_sheet",
        { params: { as_of_date: balanceSheetDate } }
      );
      if (response?.success) {
        setBalanceSheet(response.balance_sheet);
      }
    } catch (err) {
      console.error("Failed to load balance sheet:", err);
    } finally {
      setLoading(false);
    }
  }, [balanceSheetDate]);

  const fetchProfitLoss = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; profit_loss: ProfitLoss }>(
        "/api/v1/financial_reports/profit_loss",
        { params: { from_date: plFromDate, to_date: plToDate } }
      );
      if (response?.success) {
        setProfitLoss(response.profit_loss);
      }
    } catch (err) {
      console.error("Failed to load profit & loss:", err);
    } finally {
      setLoading(false);
    }
  }, [plFromDate, plToDate]);

  const fetchJobProfitability = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { to_date: jobToDate };
      if (jobFromDate) params.from_date = jobFromDate;

      const response = await api.get<{ success: boolean; jobs: JobProfitability[] }>(
        "/api/v1/financial_reports/job_profitability",
        { params }
      );
      if (response?.success) {
        setJobProfitability(response.jobs);
      }
    } catch (err) {
      console.error("Failed to load job profitability:", err);
    } finally {
      setLoading(false);
    }
  }, [jobFromDate, jobToDate]);

  useEffect(() => {
    if (activeTab === "balance_sheet") {
      fetchBalanceSheet();
    } else if (activeTab === "profit_loss") {
      fetchProfitLoss();
    } else if (activeTab === "job_profitability") {
      fetchJobProfitability();
    }
  }, [activeTab, fetchBalanceSheet, fetchProfitLoss, fetchJobProfitability]);

  const handleExport = async (type: string) => {
    try {
      let url = "";
      let filename = "";
      let params: Record<string, string> = {};

      if (type === "balance_sheet") {
        url = "/api/v1/financial_exports/balance_sheet";
        params = { as_of_date: balanceSheetDate };
        filename = `balance_sheet_${balanceSheetDate}.csv`;
      } else if (type === "profit_loss") {
        url = "/api/v1/financial_exports/profit_loss";
        params = { from_date: plFromDate, to_date: plToDate };
        filename = `profit_loss_${plFromDate}_${plToDate}.csv`;
      } else if (type === "job_profitability") {
        url = "/api/v1/financial_exports/job_profitability";
        params = { to_date: jobToDate };
        if (jobFromDate) params.from_date = jobFromDate;
        filename = `job_profitability_${new Date().toISOString().split("T")[0]}.csv`;
      }

      const response = await fetch(
        `${getApiBaseUrl()}${url}?${new URLSearchParams(params)}`,
        {
          headers: {
            Authorization: `Bearer ${getStorageItem<string>(STORAGE_KEYS.TOKEN, '', false)}`,
          },
        }
      );

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Error exporting:", err);
      toast({
        title: "Export failed",
        description: "Failed to export report",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Financial Reports</h1>
        <p className="mt-2 text-muted-foreground">
          View balance sheets, profit & loss statements, and job profitability reports
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="balance_sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="profit_loss">Profit & Loss</TabsTrigger>
          <TabsTrigger value="job_profitability">Job Profitability</TabsTrigger>
        </TabsList>

        {/* Balance Sheet */}
        <TabsContent value="balance_sheet">
          <Card className="mb-6">
            <CardContent className="flex items-center justify-between pt-6">
              <div className="flex items-center gap-4">
                <Label>As of Date:</Label>
                <Input
                  type="date"
                  value={balanceSheetDate}
                  onChange={(e) => setBalanceSheetDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-auto"
                />
              </div>
              <Button onClick={() => handleExport("balance_sheet")}>
                <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size={32} className="text-muted-foreground" />
            </div>
          ) : balanceSheet ? (
            <Card>
              <CardHeader>
                <CardTitle>Balance Sheet as of {balanceSheetDate}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Assets */}
                <div>
                  <h4 className="mb-3 rounded bg-muted p-2 font-semibold">Assets</h4>
                  {Object.entries(balanceSheet.assets?.details || {}).map(
                    ([account, amount]) => (
                      <div key={account} className="flex justify-between px-4 py-2 text-sm">
                        <span className="text-muted-foreground">{account}</span>
                        <span className="font-medium">{formatCurrency(amount)}</span>
                      </div>
                    )
                  )}
                  <div className="mt-2 flex justify-between border-t px-4 py-2 font-bold">
                    <span>Total Assets</span>
                    <span>{formatCurrency(balanceSheet.assets?.total)}</span>
                  </div>
                </div>

                {/* Liabilities */}
                <div>
                  <h4 className="mb-3 rounded bg-muted p-2 font-semibold">Liabilities</h4>
                  {Object.entries(balanceSheet.liabilities?.details || {}).map(
                    ([account, amount]) => (
                      <div key={account} className="flex justify-between px-4 py-2 text-sm">
                        <span className="text-muted-foreground">{account}</span>
                        <span className="font-medium">{formatCurrency(amount)}</span>
                      </div>
                    )
                  )}
                  <div className="mt-2 flex justify-between border-t px-4 py-2 font-bold">
                    <span>Total Liabilities</span>
                    <span>{formatCurrency(balanceSheet.liabilities?.total)}</span>
                  </div>
                </div>

                {/* Equity */}
                <div>
                  <h4 className="mb-3 rounded bg-muted p-2 font-semibold">Equity</h4>
                  {Object.entries(balanceSheet.equity?.details || {}).map(
                    ([account, amount]) => (
                      <div key={account} className="flex justify-between px-4 py-2 text-sm">
                        <span className="text-muted-foreground">{account}</span>
                        <span className="font-medium">{formatCurrency(amount)}</span>
                      </div>
                    )
                  )}
                  <div className="mt-2 flex justify-between border-t px-4 py-2 font-bold">
                    <span>Total Equity</span>
                    <span>{formatCurrency(balanceSheet.equity?.total)}</span>
                  </div>
                </div>

                {/* Balance Check */}
                <div className="border-t-2 pt-4">
                  <div className="flex justify-between px-4 py-2 text-lg font-bold">
                    <span>Total Liabilities + Equity</span>
                    <span>
                      {formatCurrency(
                        (balanceSheet.liabilities?.total || 0) +
                          (balanceSheet.equity?.total || 0)
                      )}
                    </span>
                  </div>
                  {balanceSheet.balanced ? (
                    <p className="mt-2 text-center text-sm text-green-600">
                      ✓ Balance Sheet is balanced
                    </p>
                  ) : (
                    <p className="mt-2 text-center text-sm text-red-600">
                      ✗ Balance Sheet does not balance
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              No balance sheet data available
            </div>
          )}
        </TabsContent>

        {/* Profit & Loss */}
        <TabsContent value="profit_loss">
          <Card className="mb-6">
            <CardContent className="flex items-center justify-between pt-6">
              <div className="flex items-center gap-4">
                <Label>From:</Label>
                <Input
                  type="date"
                  value={plFromDate}
                  onChange={(e) => setPlFromDate(e.target.value)}
                  max={plToDate}
                  className="w-auto"
                />
                <Label>To:</Label>
                <Input
                  type="date"
                  value={plToDate}
                  onChange={(e) => setPlToDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-auto"
                />
              </div>
              <Button onClick={() => handleExport("profit_loss")}>
                <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size={32} className="text-muted-foreground" />
            </div>
          ) : profitLoss ? (
            <Card>
              <CardHeader>
                <CardTitle>Profit & Loss Statement</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {plFromDate} to {plToDate}
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Revenue */}
                <div>
                  <h4 className="mb-3 rounded bg-green-50 p-2 font-semibold dark:bg-green-900/20">
                    Revenue
                  </h4>
                  {Object.entries(profitLoss.revenue?.details || {}).map(
                    ([category, amount]) => (
                      <div key={category} className="flex justify-between px-4 py-2 text-sm">
                        <span className="text-muted-foreground">{category}</span>
                        <span className="font-medium text-green-600">{formatCurrency(amount)}</span>
                      </div>
                    )
                  )}
                  <div className="mt-2 flex justify-between border-t px-4 py-2 font-bold">
                    <span>Total Revenue</span>
                    <span className="text-green-600">
                      {formatCurrency(profitLoss.revenue?.total)}
                    </span>
                  </div>
                </div>

                {/* Expenses */}
                <div>
                  <h4 className="mb-3 rounded bg-red-50 p-2 font-semibold dark:bg-red-900/20">
                    Expenses
                  </h4>
                  {Object.entries(profitLoss.expenses?.details || {}).map(
                    ([category, amount]) => (
                      <div key={category} className="flex justify-between px-4 py-2 text-sm">
                        <span className="text-muted-foreground">{category}</span>
                        <span className="font-medium text-red-600">{formatCurrency(amount)}</span>
                      </div>
                    )
                  )}
                  <div className="mt-2 flex justify-between border-t px-4 py-2 font-bold">
                    <span>Total Expenses</span>
                    <span className="text-red-600">
                      {formatCurrency(profitLoss.expenses?.total)}
                    </span>
                  </div>
                </div>

                {/* Net Profit */}
                <div className="border-t-2 pt-4">
                  <div className="flex justify-between px-4 py-2 text-lg font-bold">
                    <span>Net Profit</span>
                    <span
                      className={
                        (profitLoss.net_profit || 0) >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {formatCurrency(profitLoss.net_profit)}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-2 text-sm">
                    <span className="text-muted-foreground">Profit Margin</span>
                    <span
                      className={
                        (profitLoss.profit_margin || 0) >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {profitLoss.profit_margin}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              No profit & loss data available
            </div>
          )}
        </TabsContent>

        {/* Job Profitability */}
        <TabsContent value="job_profitability">
          <Card className="mb-6">
            <CardContent className="flex items-center justify-between pt-6">
              <div className="flex items-center gap-4">
                <Label>From (optional):</Label>
                <Input
                  type="date"
                  value={jobFromDate}
                  onChange={(e) => setJobFromDate(e.target.value)}
                  max={jobToDate}
                  className="w-auto"
                />
                <Label>To:</Label>
                <Input
                  type="date"
                  value={jobToDate}
                  onChange={(e) => setJobToDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-auto"
                />
              </div>
              <Button onClick={() => handleExport("job_profitability")}>
                <ArrowDownTrayIcon className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardContent>
          </Card>

          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size={32} className="text-muted-foreground" />
            </div>
          ) : jobProfitability.length > 0 ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Name</TableHead>
                    <TableHead className="text-right">Income</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Net Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobProfitability.map((job) => (
                    <TableRow key={job.construction_id}>
                      <TableCell className="font-medium">{job.job_name}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(job.income)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(job.expenses)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          (job.net_profit || 0) >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(job.net_profit)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          (job.profit_margin || 0) >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {job.profit_margin}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              No job profitability data available
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
