"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ExpandChevron } from "@/components/ui/expand-chevron";
import {
  formatCurrency,
  getBudgetStatus,
  getPercentage,
  formatPercent,
  STATUS_COLORS,
  type ExpenseGroup,
} from "@/lib/expenses-utils";
import { ExpensePORow, ExpensePORowHeader } from "./ExpensePORow";
import { AlertTriangle, CheckCircle2, AlertCircle, Minus } from "lucide-react";

interface ExpenseGroupNodeProps {
  group: ExpenseGroup;
  depth: number;
  defaultExpanded?: boolean;
  expandedKeys: Set<string>;
  onToggle: (key: string) => void;
}

/**
 * ExpenseGroupNode - Recursive tree node for Stage/Trade levels
 *
 * Shows:
 * - Expand/collapse chevron
 * - Group name (Stage or Trade)
 * - PO count badge
 * - Budget progress bar with color coding
 * - Status icon
 *
 * Children are either:
 * - More ExpenseGroupNode (for nested trades under stages)
 * - ExpensePORow (for leaf level POs)
 */
export function ExpenseGroupNode({
  group,
  depth,
  defaultExpanded = true,
  expandedKeys,
  onToggle,
}: ExpenseGroupNodeProps) {
  const isExpanded = expandedKeys.has(group.key);
  const status = getBudgetStatus(group.spent, group.budget);
  const percent = getPercentage(group.spent, group.budget);
  const colors = STATUS_COLORS[status];

  // Calculate indent
  const indentPx = depth * 24;

  // Status icon based on budget status
  const StatusIcon = {
    overBudget: AlertTriangle,
    warning: AlertCircle,
    underBudget: CheckCircle2,
    noBudget: Minus,
  }[status];

  const hasChildren = group.children.length > 0 || group.pos.length > 0;

  return (
    <div className="select-none">
      {/* Group Header */}
      <div
        className={cn(
          "flex items-center gap-3 py-2.5 px-3 cursor-pointer",
          "border-b border-border dark:border-border",
          "hover:bg-muted dark:hover:bg-muted/50",
          "transition-colors",
          depth === 0 && "bg-muted/50 dark:bg-card/30"
        )}
        style={{ paddingLeft: `${indentPx + 12}px` }}
        onClick={() => onToggle(group.key)}
      >
        {/* Expand Chevron */}
        <ExpandChevron
          expanded={isExpanded}
          size={18}
          className={cn(
            "text-muted-foreground",
            !hasChildren && "invisible"
          )}
        />

        {/* Group Label */}
        <div className="flex items-center gap-2 min-w-[200px]">
          <span className={cn(
            "font-medium",
            depth === 0 ? "text-base" : "text-sm"
          )}>
            {group.label}
          </span>
          <Badge variant="secondary" className="text-xs font-normal">
            {group.poCount} PO{group.poCount !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Budget Info */}
        <div className="flex items-center gap-4">
          {/* Spent / Budget text */}
          <div className="flex items-baseline gap-1.5 min-w-[150px] justify-end">
            <span className={cn("font-semibold tabular-nums", colors.text)}>
              {formatCurrency(group.spent)}
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground tabular-nums">
              {formatCurrency(group.budget)}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-[120px]">
            <div className="relative h-2 overflow-hidden rounded-full bg-muted dark:bg-muted">
              <div
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  colors.bar
                )}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
          </div>

          {/* Percentage */}
          <span
            className={cn(
              "min-w-[50px] text-right text-sm font-medium tabular-nums",
              colors.text
            )}
          >
            {group.budget > 0 ? formatPercent(percent) : "—"}
          </span>

          {/* Status Icon */}
          <StatusIcon
            className={cn("h-5 w-5", colors.icon)}
          />
        </div>
      </div>

      {/* Children (when expanded) */}
      {isExpanded && hasChildren && (
        <div>
          {/* Nested Groups (Trade level) */}
          {group.children.map((child) => (
            <ExpenseGroupNode
              key={child.key}
              group={child}
              depth={depth + 1}
              expandedKeys={expandedKeys}
              onToggle={onToggle}
            />
          ))}

          {/* Leaf POs (when this is the leaf level) */}
          {group.isLeafLevel && group.pos.length > 0 && (
            <>
              <ExpensePORowHeader depth={depth + 1} />
              {group.pos.map((po) => (
                <ExpensePORow
                  key={po.id}
                  po={po}
                  depth={depth + 1}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
