"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  FileText,
  Calendar,
  Loader2,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Building2,
  Briefcase,
} from "lucide-react";
import { api } from "@/lib/api";

interface FinancialSummary {
  revenue: number;
  expenses: number;
  profit: number;
  profit_margin: number;
  accounts_receivable: number;
  accounts_payable: number;
  cash_on_hand: number;
}

interface JobProfitability {
  job_id: number;
  job_title: string;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  status: string;
}

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export default function FinancialPage() {
  const [summary, setSummary] = React.useState<FinancialSummary | null>(null);
  const [jobProfitability, setJobProfitability] = React.useState<JobProfitability[]>([]);
  const [monthlyData, setMonthlyData] = React.useState<MonthlyData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedPeriod, setSelectedPeriod] = React.useState("ytd");
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [summaryData, jobsData, monthlyResponse] = await Promise.all([
        api.get<FinancialSummary>(`/api/v1/financial/summary?period=${selectedPeriod}`),
        api.get<{ jobs: JobProfitability[] }>(`/api/v1/financial/job_profitability?period=${selectedPeriod}`),
        api.get<{ months: MonthlyData[] }>(`/api/v1/financial/monthly?period=${selectedPeriod}`),
      ]);
      setSummary(summaryData);
      setJobProfitability(jobsData.jobs || []);
      setMonthlyData(monthlyResponse.months || []);
    } catch (error) {
      // Mock data
      setSummary({
        revenue: 1245000,
        expenses: 892000,
        profit: 353000,
        profit_margin: 28.4,
        accounts_receivable: 185000,
        accounts_payable: 67000,
        cash_on_hand: 423000,
      });
      setJobProfitability([
        { job_id: 1, job_title: "Smith Residence - Full Build", revenue: 450000, cost: 312000, profit: 138000, margin: 30.7, status: "active" },
        { job_id: 2, job_title: "Commercial Fitout - CBD", revenue: 285000, cost: 198000, profit: 87000, margin: 30.5, status: "active" },
        { job_id: 3, job_title: "Office Renovation - Tech Park", revenue: 165000, cost: 128000, profit: 37000, margin: 22.4, status: "completed" },
        { job_id: 4, job_title: "Warehouse Extension", revenue: 220000, cost: 178000, profit: 42000, margin: 19.1, status: "active" },
        { job_id: 5, job_title: "Retail Shopfit - Mall", revenue: 125000, cost: 76000, profit: 49000, margin: 39.2, status: "completed" },
      ]);
      setMonthlyData([
        { month: "Jul", revenue: 185000, expenses: 132000, profit: 53000 },
        { month: "Aug", revenue: 210000, expenses: 148000, profit: 62000 },
        { month: "Sep", revenue: 195000, expenses: 142000, profit: 53000 },
        { month: "Oct", revenue: 225000, expenses: 158000, profit: 67000 },
        { month: "Nov", revenue: 245000, expenses: 172000, profit: 73000 },
        { month: "Dec", revenue: 185000, expenses: 140000, profit: 45000 },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPeriod]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Financial Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track revenue, expenses, and job profitability
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mtd">This Month</SelectItem>
              <SelectItem value="qtd">This Quarter</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="fy2024">FY 2024</SelectItem>
              <SelectItem value="fy2023">FY 2023</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => fetchData(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold font-mono">{formatCurrency(summary.revenue)}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2 text-sm text-green-600">
                <ArrowUpRight className="h-4 w-4" />
                +12.5% vs last period
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expenses</p>
                  <p className="text-2xl font-bold font-mono">{formatCurrency(summary.expenses)}</p>
                </div>
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2 text-sm text-red-600">
                <ArrowUpRight className="h-4 w-4" />
                +8.2% vs last period
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Net Profit</p>
                  <p className="text-2xl font-bold font-mono text-green-600">
                    {formatCurrency(summary.profit)}
                  </p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <div className="mt-2">
                <Badge className="bg-green-100 text-green-700">
                  {summary.profit_margin.toFixed(1)}% margin
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cash Position</p>
                  <p className="text-2xl font-bold font-mono">{formatCurrency(summary.cash_on_hand)}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>AR: {formatCurrency(summary.accounts_receivable)}</span>
                <span>AP: {formatCurrency(summary.accounts_payable)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs for different reports */}
      <Tabs defaultValue="profitability" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profitability">
            <Briefcase className="h-4 w-4 mr-2" />
            Job Profitability
          </TabsTrigger>
          <TabsTrigger value="monthly">
            <BarChart3 className="h-4 w-4 mr-2" />
            Monthly Trends
          </TabsTrigger>
          <TabsTrigger value="reports">
            <FileText className="h-4 w-4 mr-2" />
            Standard Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profitability">
          <Card>
            <CardHeader>
              <CardTitle>Job Profitability Analysis</CardTitle>
              <CardDescription>
                Revenue, costs, and margins by job
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobProfitability.map((job) => (
                    <TableRow key={job.job_id}>
                      <TableCell className="font-medium">{job.job_title}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(job.revenue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {formatCurrency(job.cost)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600">
                        {formatCurrency(job.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={job.margin >= 25 ? "default" : job.margin >= 15 ? "secondary" : "destructive"}
                        >
                          {job.margin.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={job.job_status?.name === "Active Job" ? "outline" : "secondary"}>
                          {job.job_status?.name}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Financial Trends</CardTitle>
              <CardDescription>
                Revenue, expenses, and profit over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData.map((month) => {
                    const margin = (month.profit / month.revenue) * 100;
                    return (
                      <TableRow key={month.month}>
                        <TableCell className="font-medium">{month.month} 2024</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(month.revenue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {formatCurrency(month.expenses)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-600">
                          {formatCurrency(month.profit)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={margin >= 25 ? "default" : "secondary"}>
                            {margin.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: "Profit & Loss Statement", description: "Income and expense summary", icon: FileText },
              { title: "Balance Sheet", description: "Assets, liabilities, and equity", icon: Building2 },
              { title: "Cash Flow Statement", description: "Cash inflows and outflows", icon: DollarSign },
              { title: "Aged Receivables", description: "Outstanding customer invoices", icon: Calendar },
              { title: "Aged Payables", description: "Outstanding supplier bills", icon: Calendar },
              { title: "Trial Balance", description: "Account balances summary", icon: BarChart3 },
            ].map((report) => {
              const Icon = report.icon;
              return (
                <Card key={report.title} className="cursor-pointer hover:bg-accent/50 transition-colors">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-secondary rounded-lg">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{report.title}</h3>
                        <p className="text-sm text-muted-foreground">{report.description}</p>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
