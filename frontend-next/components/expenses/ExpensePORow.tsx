"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  getSupplierName,
  getTaskName,
  isOverBilled,
  getCostToComplete,
  type PurchaseOrderRecord,
} from "@/lib/expenses-utils";
import { FileText, CheckCircle2, Circle, AlertTriangle, Lock, LockOpen } from "lucide-react";

interface ExpensePORowProps {
  po: PurchaseOrderRecord;
  depth: number;
  className?: string;
}

/**
 * ExpensePORow - Individual purchase order row (redesigned)
 *
 * Columns (left to right):
 * 1. PO Number
 * 2. Task
 * 3. Supplier
 * 4. Budget
 * 5. PO Value (total)
 * 6. Invoiced
 * 7. Paid to Date
 * 8. Cost to Complete
 * 9. Overrun
 * 10. Complete checkbox
 * 11. Over-billed indicator (triggers red row)
 */
export function ExpensePORow({ po, depth, className }: ExpensePORowProps) {
  const router = useRouter();

  // Extract values
  const budget = Number(po.budget) || 0;
  const total = Number(po.total) || 0;
  const invoiced = Number(po.total_billed) || 0;
  const paid = Number(po.xero_amount_paid) || 0;
  const costToComplete = getCostToComplete(po);
  const overrun = Number(po.diff_po_with_allowance_versus_budget) || 0;
  const isComplete = po.xero_complete === true;
  const overBilled = isOverBilled(po);

  const poNumber = po.po_number || `PO-${po.id}`;
  const supplier = getSupplierName(po);
  const task = getTaskName(po);

  // Calculate indent based on depth
  const indentPx = (depth + 1) * 24;

  // Double-click to open PO detail page
  const handleDoubleClick = () => {
    const slug = po.po_number?.replace("PO-", "") || po.id;
    router.push(`/purchase_orders/${slug}`);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-2 px-3 text-sm cursor-pointer",
        "border-b border-border dark:border-border",
        "hover:bg-muted dark:hover:bg-muted/50",
        "transition-colors",
        // Red highlight for over-billed
        overBilled && "bg-red-50 dark:bg-red-900/20 border-l-4 border-l-red-500",
        className
      )}
      style={{ paddingLeft: `${indentPx}px` }}
      onDoubleClick={handleDoubleClick}
      title="Double-click to open PO"
    >
      {/* Tree connector line */}
      <div className="flex items-center gap-1 text-muted-foreground shrink-0">
        <span className="text-muted-foreground dark:text-muted-foreground">│</span>
        <FileText className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* PO Number with Lock Icon */}
      <div className="w-[100px] shrink-0 flex items-center gap-1">
        {po.budget_locked_at ? (
          <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        ) : (
          <LockOpen className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
        )}
        <span className="font-mono text-xs font-medium text-foreground dark:text-muted-foreground">
          {poNumber}
        </span>
      </div>

      {/* Task */}
      <div className="w-[160px] shrink-0 truncate" title={task}>
        <span className="text-xs text-muted-foreground">{task}</span>
      </div>

      {/* Supplier */}
      <div className="flex-1 min-w-[100px] truncate">
        <span className="text-muted-foreground dark:text-muted-foreground">{supplier}</span>
      </div>

      {/* Budget */}
      <div className="w-[80px] shrink-0 text-right tabular-nums">
        <span className={cn(
          "text-xs",
          budget > 0 ? "text-foreground" : "text-muted-foreground"
        )}>
          {budget > 0 ? formatCurrency(budget) : '-'}
        </span>
      </div>

      {/* PO Value (total) */}
      <div className="w-[80px] shrink-0 text-right tabular-nums">
        <span className="font-medium">{formatCurrency(total)}</span>
      </div>

      {/* Invoiced */}
      <div className="w-[80px] shrink-0 text-right tabular-nums">
        <span className={cn(
          "text-xs",
          invoiced > 0 ? "text-foreground" : "text-muted-foreground"
        )}>
          {invoiced > 0 ? formatCurrency(invoiced) : '-'}
        </span>
      </div>

      {/* Paid to Date */}
      <div className="w-[80px] shrink-0 text-right tabular-nums">
        <span className={cn(
          "text-xs",
          paid > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
        )}>
          {paid > 0 ? formatCurrency(paid) : '-'}
        </span>
      </div>

      {/* Cost to Complete */}
      <div className="w-[80px] shrink-0 text-right tabular-nums">
        <span className={cn(
          "text-xs",
          costToComplete > 0 ? "text-foreground" : "text-muted-foreground"
        )}>
          {costToComplete > 0 ? formatCurrency(costToComplete) : '-'}
        </span>
      </div>

      {/* Overrun (negative = over budget) */}
      <div className="w-[80px] shrink-0 text-right tabular-nums">
        <span className={cn(
          "text-xs font-medium",
          overrun < 0 && "text-red-600 dark:text-red-400",
          overrun > 0 && "text-green-600 dark:text-green-400",
          overrun === 0 && "text-muted-foreground"
        )}>
          {overrun !== 0 ? formatCurrency(overrun) : '-'}
        </span>
      </div>

      {/* Complete checkbox */}
      <div className="w-[50px] shrink-0 flex justify-center">
        {isComplete ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Over-billed indicator */}
      <div className="w-[40px] shrink-0 flex justify-center">
        {overBilled && (
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
        )}
      </div>
    </div>
  );
}

/**
 * ExpensePORowHeader - Column headers for PO rows
 */
export function ExpensePORowHeader({ depth }: { depth: number }) {
  const indentPx = (depth + 1) * 24;

  return (
    <div
      className="flex items-center gap-2 py-1.5 px-3 text-xs font-medium text-muted-foreground border-b border-border bg-muted/30 dark:bg-muted/10"
      style={{ paddingLeft: `${indentPx}px` }}
    >
      {/* Spacer for tree connector */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="opacity-0">│</span>
        <span className="w-4" />
      </div>

      <div className="w-[100px] shrink-0">PO #</div>
      <div className="w-[160px] shrink-0">Task</div>
      <div className="flex-1 min-w-[100px]">Supplier</div>
      <div className="w-[80px] shrink-0 text-right">Budget</div>
      <div className="w-[80px] shrink-0 text-right">PO Value</div>
      <div className="w-[80px] shrink-0 text-right">Invoiced</div>
      <div className="w-[80px] shrink-0 text-right">Paid</div>
      <div className="w-[80px] shrink-0 text-right">To Complete</div>
      <div className="w-[80px] shrink-0 text-right">Overrun</div>
      <div className="w-[50px] shrink-0 text-center">Done</div>
      <div className="w-[40px] shrink-0 text-center">!</div>
    </div>
  );
}

/**
 * ExpensePORowTotals - Totals row at bottom of PO list
 */
export function ExpensePORowTotals({
  depth,
  budget,
  total,
  invoiced,
  paid,
  costToComplete,
  overrun,
  poCount,
}: {
  depth: number;
  budget: number;
  total: number;
  invoiced: number;
  paid: number;
  costToComplete: number;
  overrun: number;
  poCount: number;
}) {
  const indentPx = (depth + 1) * 24;

  return (
    <div
      className="flex items-center gap-2 py-2 px-3 text-xs font-semibold bg-muted/50 dark:bg-muted/20 border-t-2 border-border"
      style={{ paddingLeft: `${indentPx}px` }}
    >
      {/* Spacer for tree connector */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="opacity-0">│</span>
        <span className="w-4" />
      </div>

      <div className="w-[100px] shrink-0 text-muted-foreground">
        {poCount} PO{poCount !== 1 ? 's' : ''}
      </div>
      <div className="w-[160px] shrink-0"></div>
      <div className="flex-1 min-w-[100px] text-right font-medium">Totals:</div>
      <div className="w-[80px] shrink-0 text-right tabular-nums">
        {budget > 0 ? formatCurrency(budget) : '-'}
      </div>
      <div className="w-[80px] shrink-0 text-right tabular-nums font-medium">
        {formatCurrency(total)}
      </div>
      <div className="w-[80px] shrink-0 text-right tabular-nums">
        {invoiced > 0 ? formatCurrency(invoiced) : '-'}
      </div>
      <div className="w-[80px] shrink-0 text-right tabular-nums text-green-600 dark:text-green-400">
        {paid > 0 ? formatCurrency(paid) : '-'}
      </div>
      <div className="w-[80px] shrink-0 text-right tabular-nums">
        {costToComplete > 0 ? formatCurrency(costToComplete) : '-'}
      </div>
      <div className={cn(
        "w-[80px] shrink-0 text-right tabular-nums font-medium",
        overrun < 0 && "text-red-600 dark:text-red-400",
        overrun > 0 && "text-green-600 dark:text-green-400"
      )}>
        {overrun !== 0 ? formatCurrency(overrun) : '-'}
      </div>
      <div className="w-[50px] shrink-0"></div>
      <div className="w-[40px] shrink-0"></div>
    </div>
  );
}
