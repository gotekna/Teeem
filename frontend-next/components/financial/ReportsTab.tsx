"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  RefreshCw,
  FileText,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Landmark,
  DollarSign,
  Download,
} from "lucide-react";
import { api } from "@/lib/api";

interface ReportLine {
  account_code: string;
  account_name: string;
  amount: number;
  prior_amount?: number;
  variance?: number;
  variance_pct?: number;
}

interface ReportSection {
  name: string;
  lines: ReportLine[];
  total: number;
  prior_total?: number;
}

interface ProfitLossReport {
  from_date: string;
  to_date: string;
  revenue: ReportSection;
  cost_of_goods_sold: ReportSection;
  gross_profit: number;
  operating_expenses: ReportSection;
  operating_income: number;
  other_income: ReportSection;
  other_expenses: ReportSection;
  net_income: number;
}

interface BalanceSheetReport {
  as_of_date: string;
  assets: ReportSection;
  liabilities: ReportSection;
  equity: ReportSection;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
}

interface TrialBalanceReport {
  as_of_date: string;
  accounts: Array<{
    code: string;
    name: string;
    type: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  total_debits: number;
  total_credits: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function ReportsTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeReport, setActiveReport] = useState("profit-loss");
  const [profitLoss, setProfitLoss] = useState<ProfitLossReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReport | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [plRes, bsRes, tbRes] = await Promise.all([
        api.get<{ success: boolean; data: ProfitLossReport }>("/api/v1/gl/reports/profit_loss"),
        api.get<{ success: boolean; data: BalanceSheetReport }>("/api/v1/gl/reports/balance_sheet"),
        api.get<{ success: boolean; data: TrialBalanceReport }>("/api/v1/gl/reports/trial_balance"),
      ]);

      if (plRes?.success) setProfitLoss(plRes.data);
      if (bsRes?.success) setBalanceSheet(bsRes.data);
      if (tbRes?.success) setTrialBalance(tbRes.data);
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Net Income
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(profitLoss?.net_income || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(profitLoss?.net_income || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">year to date</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(profitLoss?.revenue?.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">gross income</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Total Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(balanceSheet?.total_assets || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">current balance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Total Equity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(balanceSheet?.total_equity || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">net worth</p>
          </CardContent>
        </Card>
      </div>

      {/* Reports Tabs */}
      <Tabs value={activeReport} onValueChange={setActiveReport}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="profit-loss" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Profit & Loss
            </TabsTrigger>
            <TabsTrigger value="balance-sheet" className="flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Balance Sheet
            </TabsTrigger>
            <TabsTrigger value="trial-balance" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Trial Balance
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Profit & Loss */}
        <TabsContent value="profit-loss">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Profit & Loss Statement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!profitLoss ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No profit & loss data available</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Revenue Section */}
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Revenue</h3>
                    <Table>
                      <TableBody>
                        {profitLoss.revenue?.lines?.map((line) => (
                          <TableRow key={line.account_code}>
                            <TableCell className="pl-4">{line.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(line.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold bg-muted/50">
                          <TableCell>Total Revenue</TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {formatCurrency(profitLoss.revenue?.total || 0)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Expenses Section */}
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Operating Expenses</h3>
                    <Table>
                      <TableBody>
                        {profitLoss.operating_expenses?.lines?.map((line) => (
                          <TableRow key={line.account_code}>
                            <TableCell className="pl-4">{line.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(line.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold bg-muted/50">
                          <TableCell>Total Expenses</TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {formatCurrency(profitLoss.operating_expenses?.total || 0)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Net Income */}
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center text-xl font-bold">
                      <span>Net Income</span>
                      <span className={profitLoss.net_income >= 0 ? "text-green-600" : "text-red-600"}>
                        {formatCurrency(profitLoss.net_income)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="balance-sheet">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5" />
                Balance Sheet
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!balanceSheet ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No balance sheet data available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Assets */}
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Assets</h3>
                    <Table>
                      <TableBody>
                        {balanceSheet.assets?.lines?.map((line) => (
                          <TableRow key={line.account_code}>
                            <TableCell className="pl-4">{line.account_name}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(line.amount)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-semibold bg-muted/50">
                          <TableCell>Total Assets</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(balanceSheet.total_assets)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Liabilities & Equity */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-lg mb-2">Liabilities</h3>
                      <Table>
                        <TableBody>
                          {balanceSheet.liabilities?.lines?.map((line) => (
                            <TableRow key={line.account_code}>
                              <TableCell className="pl-4">{line.account_name}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(line.amount)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell>Total Liabilities</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(balanceSheet.total_liabilities)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    <div>
                      <h3 className="font-semibold text-lg mb-2">Equity</h3>
                      <Table>
                        <TableBody>
                          {balanceSheet.equity?.lines?.map((line) => (
                            <TableRow key={line.account_code}>
                              <TableCell className="pl-4">{line.account_name}</TableCell>
                              <TableCell className="text-right font-mono">{formatCurrency(line.amount)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold bg-muted/50">
                            <TableCell>Total Equity</TableCell>
                            <TableCell className="text-right font-mono text-blue-600">{formatCurrency(balanceSheet.total_equity)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trial Balance */}
        <TabsContent value="trial-balance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Trial Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!trialBalance ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No trial balance data available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trialBalance.accounts?.map((account) => (
                      <TableRow key={account.code}>
                        <TableCell className="font-mono">{account.code}</TableCell>
                        <TableCell>{account.name}</TableCell>
                        <TableCell className="capitalize text-sm text-muted-foreground">{account.type}</TableCell>
                        <TableCell className="text-right font-mono">
                          {account.debit > 0 ? formatCurrency(account.debit) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {account.credit > 0 ? formatCurrency(account.credit) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatCurrency(account.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold bg-muted/50">
                      <TableCell colSpan={3}>Totals</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(trialBalance.total_debits)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(trialBalance.total_credits)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
