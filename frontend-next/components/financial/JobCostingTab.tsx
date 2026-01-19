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
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  Briefcase,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  AlertTriangle,
  Award,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/utils/formatters";

interface JobCosting {
  job_id: number;
  job_name: string;
  job_number: string;
  status: string;
  contract_value: number;
  total_revenue: number;
  total_costs: number;
  gross_profit: number;
  gross_margin: number;
  budget_total: number;
  budget_remaining: number;
  budget_variance: number;
  percent_complete: number;
  wip_value: number;
}

interface JobRanking {
  top_performers: JobCosting[];
  at_risk: JobCosting[];
}

interface SummaryData {
  jobs: JobCosting[];
  totals: {
    total_contract_value: number;
    total_revenue: number;
    total_costs: number;
    total_profit: number;
    average_margin: number;
    total_wip: number;
  };
  rankings: JobRanking;
}

interface WipReport {
  jobs: Array<{
    job_id: number;
    job_name: string;
    job_number: string;
    wip_value: number;
    costs_incurred: number;
    revenue_recognized: number;
    percent_complete: number;
  }>;
  totals: {
    total_wip: number;
    total_costs: number;
    total_revenue: number;
  };
}

interface BudgetVariance {
  jobs: Array<{
    job_id: number;
    job_name: string;
    job_number: string;
    budget_total: number;
    actual_costs: number;
    variance: number;
    variance_percent: number;
    status: "under" | "on_track" | "over";
  }>;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function JobCostingTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [wipReport, setWipReport] = useState<WipReport | null>(null);
  const [budgetVariance, setBudgetVariance] = useState<BudgetVariance | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, wipRes, varianceRes] = await Promise.all([
        api.get<{ success: boolean; data: SummaryData }>("/api/v1/gl/job_costing/summary"),
        api.get<{ success: boolean; data: WipReport }>("/api/v1/gl/job_costing/wip_report"),
        api.get<{ success: boolean; data: BudgetVariance }>("/api/v1/gl/job_costing/budget_variance"),
      ]);

      if (summaryRes?.success) setSummary(summaryRes.data);
      if (wipRes?.success) setWipReport(wipRes.data);
      if (varianceRes?.success) setBudgetVariance(varianceRes.data);
    } catch (error) {
      console.error("Failed to fetch job costing data:", error);
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

  const getMarginBadge = (margin: number) => {
    if (margin >= 30) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Excellent</Badge>;
    } else if (margin >= 15) {
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Good</Badge>;
    } else if (margin >= 0) {
      return <Badge variant="secondary">Low</Badge>;
    } else {
      return <Badge variant="destructive">Loss</Badge>;
    }
  };

  const getVarianceStatus = (status: string) => {
    switch (status) {
      case "under":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Under Budget</Badge>;
      case "on_track":
        return <Badge variant="secondary">On Track</Badge>;
      case "over":
        return <Badge variant="destructive">Over Budget</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
      {summary?.totals && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Contract Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totals.total_contract_value)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.jobs?.length || 0} active jobs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.totals.total_revenue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">recognized</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                Total Costs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(summary.totals.total_costs)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">incurred</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Gross Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.totals.total_profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(summary.totals.total_profit)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatPercent(summary.totals.average_margin)} margin
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                WIP Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totals.total_wip)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">work in progress</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rankings Cards */}
      {summary?.rankings && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Performers */}
          {summary.rankings.top_performers && summary.rankings.top_performers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-600">
                  <Award className="h-4 w-4" />
                  Top Performers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {summary.rankings.top_performers.slice(0, 5).map((job, idx) => (
                    <li key={job.job_id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0">
                          {idx + 1}
                        </Badge>
                        <span className="font-medium">{job.job_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-600">{formatPercent(job.gross_margin)}</span>
                        <ArrowUpRight className="h-3 w-3 text-green-600" />
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* At Risk Jobs */}
          {summary.rankings.at_risk && summary.rankings.at_risk.length > 0 && (
            <Card className="border-orange-200 dark:border-orange-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="h-4 w-4" />
                  At Risk Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {summary.rankings.at_risk.slice(0, 5).map((job) => (
                    <li key={job.job_id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{job.job_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={job.gross_margin < 0 ? "text-red-600" : "text-orange-600"}>
                          {formatPercent(job.gross_margin)}
                        </span>
                        <ArrowDownRight className="h-3 w-3 text-red-600" />
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Detail Tabs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Job Costing Analysis
          </CardTitle>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                All Jobs
              </TabsTrigger>
              <TabsTrigger value="wip" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                WIP Report
              </TabsTrigger>
              <TabsTrigger value="budget" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Budget Variance
              </TabsTrigger>
            </TabsList>

            {/* All Jobs Tab */}
            <TabsContent value="overview" className="mt-4">
              {!summary?.jobs || summary.jobs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No jobs found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead className="text-right">Contract</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Costs</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-center">Margin</TableHead>
                      <TableHead className="text-center">Complete</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.jobs.map((job) => (
                      <TableRow key={job.job_id}>
                        <TableCell>
                          <div className="font-medium">{job.job_name}</div>
                          <div className="text-xs text-muted-foreground">{job.job_number}</div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(job.contract_value)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(job.total_revenue)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(job.total_costs)}</TableCell>
                        <TableCell className={`text-right font-medium ${job.gross_profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(job.gross_profit)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getMarginBadge(job.gross_margin)}
                          <div className="text-xs text-muted-foreground mt-1">{formatPercent(job.gross_margin)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={job.percent_complete} className="w-16 h-2" />
                            <span className="text-xs">{formatPercent(job.percent_complete)}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* WIP Report Tab */}
            <TabsContent value="wip" className="mt-4">
              {!wipReport?.jobs || wipReport.jobs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No WIP data available</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex gap-4">
                    <Card className="flex-1">
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Total WIP Value</div>
                        <div className="text-xl font-bold">{formatCurrency(wipReport.totals.total_wip)}</div>
                      </CardContent>
                    </Card>
                    <Card className="flex-1">
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Total Costs Incurred</div>
                        <div className="text-xl font-bold text-red-600">{formatCurrency(wipReport.totals.total_costs)}</div>
                      </CardContent>
                    </Card>
                    <Card className="flex-1">
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Total Revenue Recognized</div>
                        <div className="text-xl font-bold text-green-600">{formatCurrency(wipReport.totals.total_revenue)}</div>
                      </CardContent>
                    </Card>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead className="text-right">WIP Value</TableHead>
                        <TableHead className="text-right">Costs Incurred</TableHead>
                        <TableHead className="text-right">Revenue Recognized</TableHead>
                        <TableHead className="text-center">% Complete</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {wipReport.jobs.map((job) => (
                        <TableRow key={job.job_id}>
                          <TableCell>
                            <div className="font-medium">{job.job_name}</div>
                            <div className="text-xs text-muted-foreground">{job.job_number}</div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(job.wip_value)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(job.costs_incurred)}</TableCell>
                          <TableCell className="text-right text-green-600">{formatCurrency(job.revenue_recognized)}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              <Progress value={job.percent_complete} className="w-16 h-2" />
                              <span className="text-xs">{formatPercent(job.percent_complete)}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </TabsContent>

            {/* Budget Variance Tab */}
            <TabsContent value="budget" className="mt-4">
              {!budgetVariance?.jobs || budgetVariance.jobs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No budget data available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Actual Costs</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead className="text-center">Variance %</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgetVariance.jobs.map((job) => (
                      <TableRow key={job.job_id}>
                        <TableCell>
                          <div className="font-medium">{job.job_name}</div>
                          <div className="text-xs text-muted-foreground">{job.job_number}</div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(job.budget_total)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(job.actual_costs)}</TableCell>
                        <TableCell className={`text-right font-medium ${job.variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {job.variance >= 0 ? "+" : ""}{formatCurrency(job.variance)}
                        </TableCell>
                        <TableCell className={`text-center ${job.variance_percent >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {job.variance_percent >= 0 ? "+" : ""}{formatPercent(job.variance_percent)}
                        </TableCell>
                        <TableCell className="text-center">
                          {getVarianceStatus(job.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
