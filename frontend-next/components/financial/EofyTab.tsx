"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  RefreshCw,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lock,
  Unlock,
  FileText,
  DollarSign,
  TrendingUp,
  Building2,
  ClipboardCheck,
  Calculator,
  Download,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface ChecklistItem {
  key: string;
  label: string;
  category: string;
  critical: boolean;
  completed: boolean;
  auto_check: boolean;
  notes: string | null;
  updated_at: string | null;
}

interface EofyStatus {
  financial_year: string;
  status: string;
  is_closed: boolean;
  progress: {
    completed: number;
    total: number;
    percentage: number;
    critical_completed: number;
    critical_total: number;
  };
  next_steps: string[];
}

interface EofyYear {
  financial_year: string;
  label: string;
  start_date: string;
  end_date: string;
  status: string;
  is_current: boolean;
  is_closed: boolean;
  progress: number;
}

interface DashboardData {
  financial_year: string;
  status: string;
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
  key_figures: {
    revenue: number;
    net_profit: number;
    total_assets: number;
    total_liabilities: number;
    estimated_tax: number;
  };
  checklist_summary: {
    total: number;
    completed: number;
    critical_remaining: number;
  };
  due_dates: Array<{ label: string; date: string; is_past: boolean }>;
}

export default function EofyTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [years, setYears] = useState<EofyYear[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");

  const fetchData = useCallback(async () => {
    if (!selectedYear) return;

    try {
      const [dashboardRes, checklistRes] = await Promise.all([
        api.get<{ success: boolean; data: DashboardData }>(`/api/v1/gl/eofy/dashboard?financial_year=${selectedYear}`),
        api.get<{ success: boolean; data: { items: ChecklistItem[] } }>(`/api/v1/gl/eofy/checklist?financial_year=${selectedYear}`),
      ]);

      if (dashboardRes?.success) setDashboard(dashboardRes.data || null);
      if (checklistRes?.success) setChecklist(checklistRes.data?.items || []);
    } catch (error) {
      console.error("Failed to fetch EOFY data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear]);

  const fetchYears = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: { years: EofyYear[]; current_year: string } }>("/api/v1/gl/eofy/years");
      if (res?.success) {
        setYears(res.data?.years || []);
        if (!selectedYear && res.data?.current_year) {
          setSelectedYear(res.data.current_year);
        }
      }
    } catch (error) {
      console.error("Failed to fetch years:", error);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchYears();
  }, [fetchYears]);

  useEffect(() => {
    if (selectedYear) {
      setLoading(true);
      fetchData();
    }
  }, [selectedYear, fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleChecklistToggle = async (item: ChecklistItem) => {
    try {
      await api.post(`/api/v1/gl/eofy/checklist/${item.key}?financial_year=${selectedYear}`, {
        completed: !item.completed,
      });
      fetchData();
    } catch (error) {
      console.error("Failed to update checklist:", error);
    }
  };

  const handleRunChecks = async () => {
    try {
      await api.post(`/api/v1/gl/eofy/run_checks?financial_year=${selectedYear}`);
      fetchData();
    } catch (error) {
      console.error("Failed to run checks:", error);
    }
  };

  const getStatusBadge = (status: string, isClosed: boolean) => {
    if (isClosed) {
      return (
        <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
          <Lock className="h-3 w-3 mr-1" />
          Closed
        </Badge>
      );
    }

    switch (status) {
      case "not_started":
        return <Badge variant="secondary">Not Started</Badge>;
      case "in_progress":
        return (
          <Badge className="bg-status-warning text-status-warning-foreground dark:bg-yellow-900/30 dark:text-yellow-400">
            <AlertCircle className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      case "ready_to_close":
        return (
          <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Ready to Close
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const groupedChecklist = checklist.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header with Year Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">End of Financial Year</h2>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year.financial_year} value={year.financial_year}>
                  {year.financial_year} {year.is_current && "(Current)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {dashboard && getStatusBadge(dashboard.status, years.find(y => y.financial_year === selectedYear)?.is_closed || false)}
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Progress Overview */}
      {dashboard && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Checklist Progress</span>
                  <span className="font-medium">{dashboard.progress.completed}/{dashboard.progress.total} items</span>
                </div>
                <Progress value={dashboard.progress.percentage} className="h-3" />
              </div>
              {dashboard.checklist_summary.critical_remaining > 0 && (
                <Badge variant="destructive">
                  {dashboard.checklist_summary.critical_remaining} critical items remaining
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="tax">Tax Return</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          {dashboard && (
            <>
              {/* Key Figures */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(dashboard.key_figures.revenue)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Net Profit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${dashboard.key_figures.net_profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatCurrency(dashboard.key_figures.net_profit)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Total Assets
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(dashboard.key_figures.total_assets)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Liabilities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(dashboard.key_figures.total_liabilities)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Est. Tax
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {formatCurrency(dashboard.key_figures.estimated_tax)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Due Dates */}
              {dashboard.due_dates && dashboard.due_dates.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Key Due Dates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {dashboard.due_dates.map((dd, idx) => (
                        <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${dd.is_past ? "bg-red-50 dark:bg-red-900/20" : "bg-muted"}`}>
                          <span className="text-sm font-medium">{dd.label}</span>
                          <span className={`text-sm ${dd.is_past ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                            {formatDate(dd.date)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Years Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Financial Years
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Year</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-center">Progress</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {years.map((year) => (
                        <TableRow key={year.financial_year} className={year.is_current ? "bg-blue-50 dark:bg-blue-900/20" : ""}>
                          <TableCell className="font-medium">
                            {year.financial_year}
                            {year.is_current && <Badge variant="outline" className="ml-2">Current</Badge>}
                          </TableCell>
                          <TableCell>{year.label}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 justify-center">
                              <Progress value={year.progress} className="w-24 h-2" />
                              <span className="text-xs text-muted-foreground">{Math.round(year.progress)}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {getStatusBadge(year.status, year.is_closed)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Checklist Tab */}
        <TabsContent value="checklist" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleRunChecks}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Auto-Checks
            </Button>
          </div>

          {Object.entries(groupedChecklist).map(([category, items]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  {category}
                  <Badge variant="outline" className="ml-2">
                    {items.filter(i => i.completed).length}/{items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.key}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        item.completed ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" : "bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={() => handleChecklistToggle(item)}
                          disabled={item.auto_check}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={item.completed ? "line-through text-muted-foreground" : ""}>
                              {item.label}
                            </span>
                            {item.critical && (
                              <Badge variant="destructive" className="text-xs">Critical</Badge>
                            )}
                            {item.auto_check && (
                              <Badge variant="outline" className="text-xs">Auto</Badge>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                          )}
                        </div>
                      </div>
                      {item.completed ? (
                        <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : item.critical ? (
                        <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { id: "profit_loss", label: "Profit & Loss", icon: TrendingUp },
              { id: "balance_sheet", label: "Balance Sheet", icon: Building2 },
              { id: "trial_balance", label: "Trial Balance", icon: FileText },
              { id: "gst_summary", label: "GST Summary", icon: Calculator },
              { id: "depreciation", label: "Depreciation Schedule", icon: FileText },
              { id: "payg", label: "PAYG Summary", icon: DollarSign },
            ].map((report) => (
              <Card key={report.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <report.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium">{report.label}</h3>
                      <p className="text-xs text-muted-foreground">{selectedYear}</p>
                    </div>
                    <Button size="sm" variant="ghost">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                EOFY Report Package
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Download the complete EOFY report package including all financial statements,
                supporting schedules, and tax preparation documents.
              </p>
              <div className="flex gap-2">
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF Package
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax Return Tab */}
        <TabsContent value="tax" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Tax Return Preparation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Review your estimated tax position and prepare data for your company tax return.
              </p>

              {dashboard && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">Taxable Income</div>
                    <div className="text-xl font-bold">{formatCurrency(dashboard.key_figures.net_profit)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">Estimated Tax (25%)</div>
                    <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{formatCurrency(dashboard.key_figures.estimated_tax)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">Effective Rate</div>
                    <div className="text-xl font-bold">
                      {dashboard.key_figures.net_profit > 0
                        ? `${((dashboard.key_figures.estimated_tax / dashboard.key_figures.net_profit) * 100).toFixed(1)}%`
                        : "N/A"
                      }
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline">View Tax Summary</Button>
                <Button variant="outline">Calculate with Adjustments</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
