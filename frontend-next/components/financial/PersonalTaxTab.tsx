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
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  Calculator,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Home,
  Car,
  Briefcase,
  Calendar,
  Download,
  FileText,
  HelpCircle,
  Building2,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface TaxSummary {
  financial_year: string;
  taxable_income: number;
  tax_payable: number;
  medicare_levy: number;
  total_tax: number;
  average_rate: number;
  marginal_rate: number;
  gross_income: number;
  total_deductions: number;
}

interface IncomeItem {
  key: string;
  label: string;
  amount: number;
  description?: string;
}

interface DeductionItem {
  key: string;
  label: string;
  amount: number;
  category: string;
  description?: string;
}

interface DueDate {
  date: string;
  description: string;
  tip?: string;
}

interface TaxData {
  summary: TaxSummary;
  income_items: Record<string, { label: string; amount: number; transactions?: number }>;
  deduction_items: Record<string, { label: string; amount: number; category: string }>;
  due_dates: DueDate[];
}

export default function PersonalTaxTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [taxData, setTaxData] = useState<TaxData | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [activeTab, setActiveTab] = useState("summary");

  const getCurrentFinancialYear = () => {
    const today = new Date();
    const year = today.getMonth() >= 6 ? today.getFullYear() + 1 : today.getFullYear();
    return `FY${year}`;
  };

  const fetchData = useCallback(async () => {
    const fy = selectedYear || getCurrentFinancialYear();

    try {
      const [summaryRes, incomeRes, deductionsRes, datesRes] = await Promise.all([
        api.get<{ success: boolean; data: TaxSummary }>(`/api/v1/gl/personal_tax/summary?financial_year=${fy}`),
        api.get<{ success: boolean; data: { items: Record<string, unknown>; total: number } }>(`/api/v1/gl/personal_tax/income?financial_year=${fy}`),
        api.get<{ success: boolean; data: { items: Record<string, unknown>; total: number } }>(`/api/v1/gl/personal_tax/deductions?financial_year=${fy}`),
        api.get<{ success: boolean; data: { dates: DueDate[] } }>(`/api/v1/gl/personal_tax/due_dates?financial_year=${fy}`),
      ]);

      const data: TaxData = {
        summary: summaryRes?.data || {} as TaxSummary,
        income_items: (incomeRes?.data?.items || {}) as TaxData["income_items"],
        deduction_items: (deductionsRes?.data?.items || {}) as TaxData["deduction_items"],
        due_dates: datesRes?.data?.dates || [],
      };

      setTaxData(data);

      if (!selectedYear) {
        setSelectedYear(fy);
      }
    } catch (error) {
      console.error("Failed to fetch tax data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    setLoading(true);
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

  const incomeItems = taxData?.income_items ? Object.entries(taxData.income_items).map(([key, value]) => ({
    key,
    ...(value as { label: string; amount: number }),
  })) : [];

  const deductionItems = taxData?.deduction_items ? Object.entries(taxData.deduction_items).map(([key, value]) => ({
    key,
    ...(value as { label: string; amount: number; category: string }),
  })) : [];

  const summary = taxData?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Personal Tax Return</h2>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4].map((offset) => {
                const today = new Date();
                const year = today.getMonth() >= 6 ? today.getFullYear() + 1 - offset : today.getFullYear() - offset;
                return (
                  <SelectItem key={year} value={`FY${year}`}>
                    FY{year}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Gross Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.gross_income || 0)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Deductions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.total_deductions || 0)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Taxable Income
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.taxable_income || 0)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Tax Payable
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(summary.total_tax || 0)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Effective Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(summary.average_rate || 0).toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Marginal: {(summary.marginal_rate || 0)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="deductions">Deductions</TabsTrigger>
          <TabsTrigger value="calculators">Calculators</TabsTrigger>
          <TabsTrigger value="tips">Tips & Dates</TabsTrigger>
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          {summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Tax Calculation Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span>Gross Income</span>
                    <span className="font-medium">{formatCurrency(summary.gross_income || 0)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>Less: Total Deductions</span>
                    <span className="font-medium text-green-600">-{formatCurrency(summary.total_deductions || 0)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b font-medium">
                    <span>Taxable Income</span>
                    <span>{formatCurrency(summary.taxable_income || 0)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>Income Tax</span>
                    <span>{formatCurrency(summary.tax_payable || 0)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>Medicare Levy (2%)</span>
                    <span>{formatCurrency(summary.medicare_levy || 0)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-lg font-bold">
                    <span>Total Tax Payable</span>
                    <span className="text-orange-600">{formatCurrency(summary.total_tax || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tax Rates Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tax Rates FY2025</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Taxable Income</TableHead>
                    <TableHead>Tax on this income</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>$0 - $18,200</TableCell>
                    <TableCell>Nil</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>$18,201 - $45,000</TableCell>
                    <TableCell>16c for each $1 over $18,200</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>$45,001 - $135,000</TableCell>
                    <TableCell>$4,288 plus 30c for each $1 over $45,000</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>$135,001 - $190,000</TableCell>
                    <TableCell>$31,288 plus 37c for each $1 over $135,000</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>$190,001 and over</TableCell>
                    <TableCell>$51,638 plus 45c for each $1 over $190,000</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Income Tab */}
        <TabsContent value="income" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Income Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incomeItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Income Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomeItems.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell>{item.label}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold">
                      <TableCell>Total Income</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(incomeItems.reduce((sum, i) => sum + i.amount, 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No income items recorded</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deductions Tab */}
        <TabsContent value="deductions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Deduction Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deductionItems.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deduction</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deductionItems.map((item) => (
                      <TableRow key={item.key}>
                        <TableCell>{item.label}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold">
                      <TableCell colSpan={2}>Total Deductions</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(deductionItems.reduce((sum, i) => sum + i.amount, 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No deduction items recorded</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calculators Tab */}
        <TabsContent value="calculators" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Car Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm font-medium mb-2">Cents per km method</div>
                    <p className="text-sm text-muted-foreground">85 cents per km, max 5,000km = $4,250</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm font-medium mb-2">Logbook method</div>
                    <p className="text-sm text-muted-foreground">Actual expenses x business use %</p>
                  </div>
                  <Button variant="outline" className="w-full">
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate Car Expenses
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Home Office
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm font-medium mb-2">Fixed rate method</div>
                    <p className="text-sm text-muted-foreground">67 cents per hour worked from home</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm font-medium mb-2">Actual cost method</div>
                    <p className="text-sm text-muted-foreground">Calculate actual running expenses</p>
                  </div>
                  <Button variant="outline" className="w-full">
                    <Calculator className="h-4 w-4 mr-2" />
                    Calculate Home Office
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tips & Dates Tab */}
        <TabsContent value="tips" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Key Due Dates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div>
                    <div className="font-medium">Financial Year End</div>
                    <div className="text-sm text-muted-foreground">End of tax year</div>
                  </div>
                  <Badge>30 June</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div>
                    <div className="font-medium">Self-lodgement deadline</div>
                    <div className="text-sm text-muted-foreground">If lodging yourself</div>
                  </div>
                  <Badge>31 October</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div>
                    <div className="font-medium">Tax agent deadline</div>
                    <div className="text-sm text-muted-foreground">If registered by 31 Oct</div>
                  </div>
                  <Badge>15 May</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Common Deductions Guide
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Car className="h-5 w-5 text-primary" />
                    <span className="font-medium">Car Expenses</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Travel between work locations (not home to work)</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Home className="h-5 w-5 text-primary" />
                    <span className="font-medium">Home Office</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Expenses for working from home</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    <span className="font-medium">Work Clothing</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Occupation-specific or protective clothing</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-medium">Self-Education</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Courses to maintain current employment skills</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
