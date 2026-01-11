"use client";

import { cn } from "@/lib/utils";
import {
  getBudgetStatus,
  getPercentage,
  formatCurrency,
  formatPercent,
  STATUS_COLORS,
  type BudgetStatus,
} from "@/lib/expenses-utils";

interface BudgetProgressBarProps {
  spent: number;
  budget: number;
  paid?: number;
  showLabels?: boolean;
  showPercent?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
};

/**
 * BudgetProgressBar - Visual budget vs spent indicator
 *
 * Shows a progress bar with color coding:
 * - Green: Under budget (<90%)
 * - Yellow: Warning zone (90-100%)
 * - Red: Over budget (>100%)
 * - Gray: No budget set
 *
 * The bar fills to show percentage, with over-budget showing full red bar.
 */
export function BudgetProgressBar({
  spent,
  budget,
  paid,
  showLabels = false,
  showPercent = false,
  size = "md",
  className,
}: BudgetProgressBarProps) {
  const status = getBudgetStatus(spent, budget);
  const percent = getPercentage(spent, budget);
  const displayPercent = Math.min(percent, 100); // Cap at 100% for bar width
  const colors = STATUS_COLORS[status];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Labels on left */}
      {showLabels && (
        <div className="flex items-baseline gap-1 text-sm tabular-nums min-w-[120px]">
          <span className={cn("font-medium", colors.text)}>
            {formatCurrency(spent)}
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">
            {formatCurrency(budget)}
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div
        className={cn(
          "relative flex-1 min-w-[60px] overflow-hidden rounded-full",
          "bg-muted dark:bg-muted",
          SIZE_CLASSES[size]
        )}
      >
        {/* Spent/budget bar */}
        <div
          className={cn(
            "h-full transition-all duration-300 rounded-full",
            colors.bar
          )}
          style={{ width: `${displayPercent}%` }}
        />

        {/* Optional: Paid portion overlay (darker shade) */}
        {paid !== undefined && budget > 0 && (
          <div
            className={cn(
              "absolute top-0 left-0 h-full transition-all duration-300 rounded-full",
              "bg-black/20 dark:bg-white/20"
            )}
            style={{ width: `${Math.min((paid / budget) * 100, 100)}%` }}
          />
        )}
      </div>

      {/* Percentage on right */}
      {showPercent && (
        <span
          className={cn(
            "text-sm font-medium tabular-nums min-w-[45px] text-right",
            colors.text
          )}
        >
          {formatPercent(percent)}
        </span>
      )}
    </div>
  );
}

/**
 * Mini version for inline use in PO rows
 */
export function PaymentProgressBar({
  paid,
  total,
  className,
}: {
  paid: number;
  total: number;
  className?: string;
}) {
  const percent = total > 0 ? (paid / total) * 100 : 0;
  const isComplete = percent >= 100;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex-1 min-w-[40px] h-1.5 overflow-hidden rounded-full bg-muted dark:bg-muted">
        <div
          className={cn(
            "h-full transition-all duration-300 rounded-full",
            isComplete
              ? "bg-green-500 dark:bg-green-500"
              : "bg-blue-500 dark:bg-blue-400"
          )}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground min-w-[35px] text-right">
        {Math.round(percent)}%
      </span>
    </div>
  );
}

/**
 * Status badge for budget status
 */
export function BudgetStatusBadge({
  status,
  className,
}: {
  status: BudgetStatus;
  className?: string;
}) {
  const colors = STATUS_COLORS[status];
  const labels: Record<BudgetStatus, string> = {
    underBudget: "On Track",
    warning: "Near Limit",
    overBudget: "Over Budget",
    noBudget: "No Budget",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full",
        colors.bg,
        colors.text,
        className
      )}
    >
      {labels[status]}
    </span>
  );
}
