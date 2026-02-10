"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
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
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/utils/formatters";

interface AgingBucket {
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
  total: number;
}

interface WeeklyForecast {
  week_start: string;
  week_end: string;
  week_number: number;
  opening_balance: number;
  inflows: number;
  outflows: number;
  net_flow: number;
  closing_balance: number;
  lowest_balance: number;
}

interface ForecastSummary {
  opening_balance: number;
  closing_balance: number;
  total_inflows: number;
  total_outflows: number;
  net_change: number;
  lowest_balance: number;
  lowest_balance_date: string;
}

interface Warning {
  type: string;
  date: string;
  message: string;
  severity: "warning" | "critical";
}

interface CashFlowForecast {
  period: { start: string; end: string };
  opening_balance: number;
  weekly: WeeklyForecast[];
  summary: ForecastSummary;
  warnings: Warning[];
}

interface CollectionWeek {
  week_start: string;
  week_end: string;
  invoices_count: number;
  total_due: number;
  expected_collection: number;
  average_probability: number;
}

interface PaymentWeek {
  week_start: string;
  week_end: string;
  bills_count: number;
  total_due: number;
  critical_count: number;
  high_priority_total: number;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
}

export default function CashFlowTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("forecast");
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null);
  const [aging, setAging] = useState<{ receivables: AgingBucket; payables: AgingBucket; net_position: number } | null>(null);
  const [collections, setCollections] = useState<{ by_week: CollectionWeek[]; totals: { total_outstanding: number; expected_collection: number } } | null>(null);
  const [payments, setPayments] = useState<{ by_week: PaymentWeek[]; totals: { total_outstanding: number; overdue: number } } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [forecastRes, agingRes, collectionsRes, paymentsRes] = await Promise.all([
        api.get<{ success: boolean; data: CashFlowForecast }>("/api/v1/gl/cash_flow/weekly"),
        api.get<{ success: boolean; data: typeof aging }>("/api/v1/gl/cash_flow/aging"),
        api.get<{ success: boolean; data: typeof collections }>("/api/v1/gl/cash_flow/collection_forecast"),
        api.get<{ success: boolean; data: typeof payments }>("/api/v1/gl/cash_flow/payment_schedule"),
      ]);

      if (forecastRes?.success) setForecast(forecastRes.data);
      if (agingRes?.success) setAging(agingRes.data);
      if (collectionsRes?.success) setCollections(collectionsRes.data);
      if (paymentsRes?.success) setPayments(paymentsRes.data);
    } catch (error) {
      console.error("Failed to fetch cash flow data:", error);
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
    return <LoadingOverlay />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Current Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(forecast?.opening_balance || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">starting position</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
              Expected Inflows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(forecast?.summary?.total_inflows || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">90-day forecast</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />
              Expected Outflows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(forecast?.summary?.total_outflows || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">90-day forecast</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Lowest Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(forecast?.summary?.lowest_balance || 0) < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
              {formatCurrency(forecast?.summary?.lowest_balance || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {forecast?.summary?.lowest_balance_date
                ? formatDate(forecast.summary.lowest_balance_date)
                : "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Warnings */}
      {forecast?.warnings && forecast.warnings.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-4 w-4" />
              Cash Flow Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {forecast.warnings.map((warning, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <Badge
                    variant={warning.severity === "critical" ? "destructive" : "outline"}
                    className="shrink-0"
                  >
                    {warning.severity}
                  </Badge>
                  <span>
                    {warning.message}
                    {warning.date && (
                      <span className="text-muted-foreground ml-1">
                        ({formatDate(warning.date)})
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cash Flow Forecast
          </CardTitle>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="forecast" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Weekly Forecast
              </TabsTrigger>
              <TabsTrigger value="collections" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Collections
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Payments
              </TabsTrigger>
              <TabsTrigger value="aging" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Aging Summary
              </TabsTrigger>
            </TabsList>

            {/* Weekly Forecast Tab */}
            <TabsContent value="forecast" className="mt-4">
              {!forecast?.weekly || forecast.weekly.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No forecast data available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week</TableHead>
                      <TableHead className="text-right">Opening</TableHead>
                      <TableHead className="text-right text-green-600 dark:text-green-400">Inflows</TableHead>
                      <TableHead className="text-right text-red-600 dark:text-red-400">Outflows</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Closing</TableHead>
                      <TableHead className="text-right">Lowest</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forecast.weekly.map((week) => (
                      <TableRow key={week.week_start}>
                        <TableCell>
                          <div className="font-medium">Week {week.week_number}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(week.week_start)} - {formatDate(week.week_end)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(week.opening_balance)}</TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400">+{formatCurrency(week.inflows)}</TableCell>
                        <TableCell className="text-right text-red-600 dark:text-red-400">-{formatCurrency(week.outflows)}</TableCell>
                        <TableCell className={`text-right font-medium ${week.net_flow >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {week.net_flow >= 0 ? "+" : ""}{formatCurrency(week.net_flow)}
                        </TableCell>
                        <TableCell className="text-right font-bold">{formatCurrency(week.closing_balance)}</TableCell>
                        <TableCell className={`text-right ${week.lowest_balance < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                          {formatCurrency(week.lowest_balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            {/* Collections Tab */}
            <TabsContent value="collections" className="mt-4">
              {!collections?.by_week || collections.by_week.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No collection forecast available</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex gap-4">
                    <Card className="flex-1">
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Total Outstanding</div>
                        <div className="text-xl font-bold">{formatCurrency(collections.totals.total_outstanding)}</div>
                      </CardContent>
                    </Card>
                    <Card className="flex-1">
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Expected Collection</div>
                        <div className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(collections.totals.expected_collection)}</div>
                      </CardContent>
                    </Card>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Week</TableHead>
                        <TableHead className="text-center">Invoices</TableHead>
                        <TableHead className="text-right">Total Due</TableHead>
                        <TableHead className="text-right">Expected</TableHead>
                        <TableHead className="text-center">Probability</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collections.by_week.map((week) => (
                        <TableRow key={week.week_start}>
                          <TableCell>
                            {formatDate(week.week_start)} - {formatDate(week.week_end)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{week.invoices_count}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(week.total_due)}</TableCell>
                          <TableCell className="text-right text-green-600 dark:text-green-400">{formatCurrency(week.expected_collection)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={week.average_probability >= 80 ? "default" : week.average_probability >= 50 ? "secondary" : "outline"}>
                              {week.average_probability}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </TabsContent>

            {/* Payments Tab */}
            <TabsContent value="payments" className="mt-4">
              {!payments?.by_week || payments.by_week.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No payment schedule available</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex gap-4">
                    <Card className="flex-1">
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Total Outstanding</div>
                        <div className="text-xl font-bold">{formatCurrency(payments.totals.total_outstanding)}</div>
                      </CardContent>
                    </Card>
                    <Card className="flex-1">
                      <CardContent className="pt-4">
                        <div className="text-sm text-muted-foreground">Overdue</div>
                        <div className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(payments.totals.overdue)}</div>
                      </CardContent>
                    </Card>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Week</TableHead>
                        <TableHead className="text-center">Bills</TableHead>
                        <TableHead className="text-right">Total Due</TableHead>
                        <TableHead className="text-center">Critical</TableHead>
                        <TableHead className="text-right">High Priority</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.by_week.map((week) => (
                        <TableRow key={week.week_start}>
                          <TableCell>
                            {formatDate(week.week_start)} - {formatDate(week.week_end)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{week.bills_count}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(week.total_due)}</TableCell>
                          <TableCell className="text-center">
                            {week.critical_count > 0 && (
                              <Badge variant="destructive">{week.critical_count}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-orange-600 dark:text-orange-400">{formatCurrency(week.high_priority_total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </TabsContent>

            {/* Aging Summary Tab */}
            <TabsContent value="aging" className="mt-4">
              {!aging ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No aging data available</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Net Position */}
                  <Card className={aging.net_position >= 0 ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800"}>
                    <CardContent className="pt-4 text-center">
                      <div className="text-sm text-muted-foreground">Net Position (AR - AP)</div>
                      <div className={`text-3xl font-bold ${aging.net_position >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {formatCurrency(aging.net_position)}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Receivables */}
                    <div>
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        Receivables (AR)
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
                          <span>Current</span>
                          <span className="font-medium">{formatCurrency(aging.receivables.current)}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-muted/50 rounded">
                          <span>1-30 days</span>
                          <span className="font-medium">{formatCurrency(aging.receivables.days_1_30)}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                          <span>31-60 days</span>
                          <span className="font-medium text-yellow-600 dark:text-yellow-400">{formatCurrency(aging.receivables.days_31_60)}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                          <span>61-90 days</span>
                          <span className="font-medium text-orange-600 dark:text-orange-400">{formatCurrency(aging.receivables.days_61_90)}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded">
                          <span>90+ days</span>
                          <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(aging.receivables.days_90_plus)}</span>
                        </div>
                        <div className="flex justify-between p-2 border-t font-bold">
                          <span>Total</span>
                          <span>{formatCurrency(aging.receivables.total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Payables */}
                    <div>
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                        Payables (AP)
                      </h3>
                      <div className="space-y-2">
                        <div className="flex justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
                          <span>Current</span>
                          <span className="font-medium">{formatCurrency(aging.payables.current)}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-muted/50 rounded">
                          <span>1-30 days</span>
                          <span className="font-medium">{formatCurrency(aging.payables.days_1_30)}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                          <span>31-60 days</span>
                          <span className="font-medium text-yellow-600 dark:text-yellow-400">{formatCurrency(aging.payables.days_31_60)}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                          <span>61-90 days</span>
                          <span className="font-medium text-orange-600 dark:text-orange-400">{formatCurrency(aging.payables.days_61_90)}</span>
                        </div>
                        <div className="flex justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded">
                          <span>90+ days</span>
                          <span className="font-medium text-red-600 dark:text-red-400">{formatCurrency(aging.payables.days_90_plus)}</span>
                        </div>
                        <div className="flex justify-between p-2 border-t font-bold">
                          <span>Total</span>
                          <span>{formatCurrency(aging.payables.total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
