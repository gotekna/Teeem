"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  RefreshCw,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  Receipt,
  Percent,
  AlertTriangle,
  ArrowRight,
  Wallet,
  PiggyBank,
  CircleDollarSign,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrencyWhole, formatPercentageWithFallback } from "@/utils/formatters";

// Types for Claims API response
interface ClaimsSummary {
  contract_value: number;
  total_expected: number;
  total_invoiced: number;
  total_paid: number;
  remaining: number;
  paid_percentage: number;
  total_retainage_held: number;
  total_retainage_released: number;
  net_receivable: number;
  // Variation fields
  approved_variations: number;
  unapproved_variations: number;
  revised_contract_value: number;
  variation_count: number;
}

interface ClaimsResponse {
  success: boolean;
  data: {
    stages: unknown[];
    summary: ClaimsSummary;
    available_invoices: unknown[];
  };
}

// Types for Expenses (Purchase Orders)
interface PurchaseOrderRecord {
  id: number | string;
  po_number?: string;
  supplier?: string | { id: number; display?: string; name?: string };
  budget?: number | null;
  total?: number | null;
  xero_amount_paid?: number | null;
  xero_still_to_be_paid?: number | null;
  diff_po_with_allowance_versus_budget?: number | null;
  payment_status?: string | null;
  stage_from_task?: string | number | null;
  trade_from_task?: string | number | null;
  status?: string | null;
  [key: string]: unknown;
}

interface ExpensesTotals {
  totalBudget: number;
  totalSpent: number;
  totalPaid: number;
  totalRemaining: number;
  totalVariance: number;
  poCount: number;
}

interface JobProfitTabProps {
  jobId: number;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

function calculateExpensesTotals(records: PurchaseOrderRecord[]): ExpensesTotals {
  return {
    totalBudget: records.reduce((sum, po) => sum + toNumber(po.budget), 0),
    totalSpent: records.reduce((sum, po) => sum + toNumber(po.total), 0),
    totalPaid: records.reduce((sum, po) => sum + toNumber(po.xero_amount_paid), 0),
    totalRemaining: records.reduce((sum, po) => sum + toNumber(po.xero_still_to_be_paid), 0),
    totalVariance: records.reduce((sum, po) => sum + toNumber(po.diff_po_with_allowance_versus_budget), 0),
    poCount: records.length,
  };
}

export function JobProfitTab({ jobId }: JobProfitTabProps) {
  const [claimsSummary, setClaimsSummary] = React.useState<ClaimsSummary | null>(null);
  const [expensesTotals, setExpensesTotals] = React.useState<ExpensesTotals | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch claims summary and purchase orders in parallel
      const [claimsResponse, foundationResponse] = await Promise.all([
        // Claims API for revenue data
        api.get<ClaimsResponse>(`/api/v1/jobs/${jobId}/claim_stages`),
        // Foundation API to get purchase orders foundation
        api.get<{ success: boolean; foundation: { id: number; slug: string } }>("/api/v1/foundations/purchase-orders"),
      ]);

      // Process claims data
      if (claimsResponse?.success && claimsResponse.data?.summary) {
        setClaimsSummary(claimsResponse.data.summary);
      } else {
        setClaimsSummary({
          contract_value: 0,
          total_expected: 0,
          total_invoiced: 0,
          total_paid: 0,
          remaining: 0,
          paid_percentage: 0,
          total_retainage_held: 0,
          total_retainage_released: 0,
          net_receivable: 0,
          approved_variations: 0,
          unapproved_variations: 0,
          revised_contract_value: 0,
          variation_count: 0,
        });
      }

      // Fetch purchase orders for this job
      if (foundationResponse?.success && foundationResponse.foundation?.id) {
        const foundationId = foundationResponse.foundation.id;
        const poResponse = await api.get<{
          success: boolean;
          records: PurchaseOrderRecord[];
        }>(`/api/v1/foundations/${foundationId}/records`, {
          params: {
            filters: JSON.stringify([{ column: "job_id", operator: "=", value: String(jobId) }]),
            per_page: 1000,
          },
        });

        if (poResponse?.success && poResponse.records) {
          setExpensesTotals(calculateExpensesTotals(poResponse.records));
        } else {
          setExpensesTotals({
            totalBudget: 0,
            totalSpent: 0,
            totalPaid: 0,
            totalRemaining: 0,
            totalVariance: 0,
            poCount: 0,
          });
        }
      } else {
        setExpensesTotals({
          totalBudget: 0,
          totalSpent: 0,
          totalPaid: 0,
          totalRemaining: 0,
          totalVariance: 0,
          poCount: 0,
        });
      }
    } catch (err) {
      console.error("Failed to load profit data:", err);
      setError("Failed to load profit data");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive bg-destructive/10">
        <CardContent className="pt-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={loadData} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Calculate profit metrics
  const contractValue = claimsSummary?.contract_value || 0;
  const revisedContractValue = claimsSummary?.revised_contract_value || contractValue;
  const revenue = claimsSummary?.total_invoiced || 0;
  const costs = expensesTotals?.totalSpent || 0;
  const grossProfit = revisedContractValue - costs;
  const profitMargin = revisedContractValue > 0 ? (grossProfit / revisedContractValue) * 100 : 0;

  // Cash flow metrics
  const cashIn = claimsSummary?.total_paid || 0;
  const cashOut = expensesTotals?.totalPaid || 0;
  const netCashFlow = cashIn - cashOut;

  // Contract vs actual
  const budgetedCosts = expensesTotals?.totalBudget || 0;
  const expectedProfit = revisedContractValue - budgetedCosts;
  const profitVariance = grossProfit - expectedProfit;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Job Profit & Loss
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Revenue from Claims • Costs from Purchase Orders
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Profit Summary Card */}
      <Card className={cn(
        "relative overflow-hidden",
        grossProfit >= 0
          ? "bg-gradient-to-br from-emerald-500 to-emerald-700"
          : "bg-gradient-to-br from-red-500 to-red-700"
      )}>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-3 mb-2">
            {grossProfit >= 0 ? (
              <TrendingUp className="h-8 w-8 text-white/80" />
            ) : (
              <TrendingDown className="h-8 w-8 text-white/80" />
            )}
            <span className="text-white/80 font-medium text-lg">Gross Profit</span>
          </div>
          <div className="text-4xl font-bold text-white mb-2">
            {formatCurrencyWhole(grossProfit)}
          </div>
          <div className="flex items-center gap-4 text-white/80">
            <span className="flex items-center gap-1">
              <Percent className="h-4 w-4" />
              {formatPercentageWithFallback(profitMargin, "0%")} margin
            </span>
            {profitVariance !== 0 && (
              <span className={cn(
                "flex items-center gap-1 text-sm",
                profitVariance > 0 ? "text-green-200" : "text-red-200"
              )}>
                {profitVariance > 0 ? "+" : ""}{formatCurrencyWhole(profitVariance)} vs budget
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Revenue vs Costs Flow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* Revenue Card */}
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="bg-blue-50 dark:bg-blue-900/20 pb-3">
            <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              Revenue (Claims)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Invoiced</span>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {formatCurrencyWhole(revenue)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Contract Value</span>
              <span className="font-medium">{formatCurrencyWhole(contractValue)}</span>
            </div>
            {(claimsSummary?.approved_variations || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">+ Approved Variations</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {formatCurrencyWhole(claimsSummary?.approved_variations)}
                </span>
              </div>
            )}
            {(claimsSummary?.unapproved_variations || 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending Variations</span>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {formatCurrencyWhole(claimsSummary?.unapproved_variations)}
                </span>
              </div>
            )}
            {(claimsSummary?.approved_variations || 0) > 0 && (
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground font-medium">Revised Contract</span>
                <span className="font-bold">{formatCurrencyWhole(claimsSummary?.revised_contract_value || contractValue)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining to Invoice</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {formatCurrencyWhole(claimsSummary?.remaining || 0)}
              </span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Invoiced Progress</span>
                <span className="font-medium">
                  {(claimsSummary?.revised_contract_value || contractValue) > 0
                    ? Math.round((revenue / (claimsSummary?.revised_contract_value || contractValue)) * 100)
                    : 0}%
                </span>
              </div>
              <Progress
                value={(claimsSummary?.revised_contract_value || contractValue) > 0
                  ? (revenue / (claimsSummary?.revised_contract_value || contractValue)) * 100
                  : 0}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Arrow */}
        <div className="hidden md:flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ArrowRight className="h-8 w-8" />
            <span className="text-xs">minus</span>
          </div>
        </div>

        {/* Costs Card */}
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="bg-orange-50 dark:bg-orange-900/20 pb-3">
            <CardTitle className="text-orange-700 dark:text-orange-300 flex items-center gap-2 text-base">
              <Receipt className="h-5 w-5" />
              Costs (Expenses)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Committed</span>
              <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrencyWhole(costs)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Budget</span>
              <span className="font-medium">{formatCurrencyWhole(budgetedCosts)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Variance</span>
              <span className={cn(
                "font-medium",
                (expensesTotals?.totalVariance || 0) <= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              )}>
                {(expensesTotals?.totalVariance || 0) > 0 ? "+" : ""}
                {formatCurrencyWhole(expensesTotals?.totalVariance || 0)}
              </span>
            </div>
            <div className="pt-2 border-t">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Cost vs Revenue</span>
                <span className={cn(
                  "font-medium",
                  revenue > 0 && (costs / revenue) > 0.9
                    ? "text-red-600 dark:text-red-400"
                    : "text-green-600 dark:text-green-400"
                )}>
                  {revenue > 0 ? Math.round((costs / revenue) * 100) : 0}%
                </span>
              </div>
              <Progress
                value={revenue > 0 ? Math.min((costs / revenue) * 100, 100) : 0}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-5 w-5 text-muted-foreground" />
            Cash Flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6">
            {/* Cash In */}
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Cash In</div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCurrencyWhole(cashIn)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {(Number(claimsSummary?.paid_percentage) || 0).toFixed(0)}% collected
              </div>
            </div>
            {/* Cash Out */}
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Cash Out</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCurrencyWhole(cashOut)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {costs > 0 ? Math.round((cashOut / costs) * 100) : 0}% paid
              </div>
            </div>
            {/* Net Position */}
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-1">Net Position</div>
              <div className={cn(
                "text-2xl font-bold",
                netCashFlow >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              )}>
                {formatCurrencyWhole(netCashFlow)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {netCashFlow >= 0 ? "Cash positive" : "Cash negative"}
              </div>
            </div>
          </div>

          {/* Cash Flow Bar */}
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1 text-right text-sm">
                <span className="text-green-600 dark:text-green-400">Received</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <div className="flex-1 text-left text-sm">
                <span className="text-red-600 dark:text-red-400">Paid Out</span>
              </div>
            </div>
            <div className="h-4 flex rounded-full overflow-hidden bg-muted">
              <div
                className="bg-green-500 h-full"
                style={{ width: `${cashIn + cashOut > 0 ? (cashIn / (cashIn + cashOut)) * 100 : 50}%` }}
              />
              <div
                className="bg-red-500 h-full"
                style={{ width: `${cashIn + cashOut > 0 ? (cashOut / (cashIn + cashOut)) * 100 : 50}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Contract Value</span>
            </div>
            <div className="text-xl font-bold">{formatCurrencyWhole(contractValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <PiggyBank className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Expected Profit</span>
            </div>
            <div className={cn(
              "text-xl font-bold",
              expectedProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}>
              {formatCurrencyWhole(expectedProfit)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Purchase Orders</span>
            </div>
            <div className="text-xl font-bold">{expensesTotals?.poCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Profit Margin</span>
            </div>
            <div className={cn(
              "text-xl font-bold",
              profitMargin >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}>
              {formatPercentageWithFallback(profitMargin, "0%")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Outstanding Amounts */}
      {((claimsSummary?.remaining || 0) > 0 || (expensesTotals?.totalRemaining || 0) > 0) && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Outstanding Amounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-muted-foreground">To Invoice (Claims)</div>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrencyWhole(claimsSummary?.remaining || 0)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">To Pay (Suppliers)</div>
                <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrencyWhole(expensesTotals?.totalRemaining || 0)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
