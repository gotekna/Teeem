"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  formatCurrency,
  getBudgetStatus,
  getPercentage,
  formatPercent,
  STATUS_COLORS,
} from "@/lib/expenses-utils";
import { BudgetProgressBar } from "./BudgetProgressBar";
import { TrendingUp, TrendingDown, DollarSign, Receipt } from "lucide-react";

interface ExpensesSummaryBarProps {
  totalBudget: number;
  totalSpent: number;
  totalPaid: number;
  totalRemaining: number;
  totalVariance: number;
  poCount: number;
  className?: string;
}

/**
 * ExpensesSummaryBar - Job-level totals summary
 *
 * Shows overall budget status at the top of the Expenses tab:
 * - Total Budget
 * - Total Spent
 * - Total Paid
 * - Remaining
 * - Visual progress bar
 */
export function ExpensesSummaryBar({
  totalBudget,
  totalSpent,
  totalPaid,
  totalRemaining,
  totalVariance,
  poCount,
  className,
}: ExpensesSummaryBarProps) {
  const status = getBudgetStatus(totalSpent, totalBudget);
  const percent = getPercentage(totalSpent, totalBudget);
  const colors = STATUS_COLORS[status];

  const isOverBudget = totalVariance > 0;
  const isUnderBudget = totalVariance < 0;

  return (
    <Card className={cn("p-4 mb-4", className)}>
      {/* Main stats row */}
      <div className="flex flex-wrap items-center gap-6 mb-3">
        {/* Budget */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/30">
            <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Budget</div>
            <div className="text-lg font-semibold tabular-nums">
              {formatCurrency(totalBudget)}
            </div>
          </div>
        </div>

        {/* Spent */}
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-md", colors.bg)}>
            <Receipt className={cn("h-4 w-4", colors.icon)} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Spent</div>
            <div className={cn("text-lg font-semibold tabular-nums", colors.text)}>
              {formatCurrency(totalSpent)}
            </div>
          </div>
        </div>

        {/* Paid */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-900/30">
            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total Paid</div>
            <div className="text-lg font-semibold tabular-nums text-green-700 dark:text-green-300">
              {formatCurrency(totalPaid)}
            </div>
          </div>
        </div>

        {/* Remaining */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-orange-100 dark:bg-orange-900/30">
            <TrendingDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Remaining to Pay</div>
            <div className="text-lg font-semibold tabular-nums text-orange-700 dark:text-orange-300">
              {formatCurrency(totalRemaining)}
            </div>
          </div>
        </div>

        {/* Variance Badge */}
        <div className="ml-auto flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">{poCount} Purchase Orders</div>
            {totalBudget > 0 && (
              <div
                className={cn(
                  "text-sm font-medium",
                  isOverBudget
                    ? "text-red-600 dark:text-red-400"
                    : isUnderBudget
                    ? "text-green-600 dark:text-green-400"
                    : "text-muted-foreground dark:text-muted-foreground"
                )}
              >
                {isOverBudget ? "Over by " : isUnderBudget ? "Under by " : "On "}
                {isOverBudget || isUnderBudget
                  ? formatCurrency(Math.abs(totalVariance))
                  : "Budget"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {totalBudget > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="relative h-3 overflow-hidden rounded-full bg-muted dark:bg-muted">
              <div
                className={cn(
                  "h-full transition-all duration-500 rounded-full",
                  colors.bar
                )}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
          </div>
          <span className={cn("text-sm font-medium tabular-nums min-w-[50px]", colors.text)}>
            {formatPercent(percent)}
          </span>
        </div>
      )}
    </Card>
  );
}
