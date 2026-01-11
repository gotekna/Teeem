"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  formatCurrency,
  getSupplierName,
  type PurchaseOrderRecord,
} from "@/lib/expenses-utils";
import { PaymentProgressBar } from "./BudgetProgressBar";
import { CheckCircle2, Clock, AlertCircle, FileText } from "lucide-react";

interface ExpensePORowProps {
  po: PurchaseOrderRecord;
  depth: number;
  className?: string;
}

const PAYMENT_STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof CheckCircle2; color: string }
> = {
  complete: {
    label: "Paid",
    icon: CheckCircle2,
    color: "text-green-600 dark:text-green-400",
  },
  part_payment: {
    label: "Partial",
    icon: Clock,
    color: "text-yellow-600 dark:text-yellow-400",
  },
  pending: {
    label: "Pending",
    icon: AlertCircle,
    color: "text-muted-foreground dark:text-muted-foreground",
  },
  manual_review: {
    label: "Review",
    icon: AlertCircle,
    color: "text-orange-600 dark:text-orange-400",
  },
};

/**
 * ExpensePORow - Individual purchase order row
 *
 * Shows:
 * - PO Number
 * - Supplier name
 * - Total amount
 * - Payment progress bar
 * - Payment status badge
 */
export function ExpensePORow({ po, depth, className }: ExpensePORowProps) {
  const total = Number(po.total) || 0;
  const paid = Number(po.xero_amount_paid) || 0;
  const paymentStatus = po.payment_status || "pending";
  const statusConfig = PAYMENT_STATUS_CONFIG[paymentStatus] || PAYMENT_STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  const poNumber = po.po_number || `PO-${po.id}`;
  const supplier = getSupplierName(po);

  // Calculate indent based on depth (level 2 is depth 2, so 3 levels of indent)
  const indentPx = (depth + 1) * 24;

  return (
    <div
      className={cn(
        "flex items-center gap-4 py-2 px-3 text-sm",
        "border-b border-border dark:border-border",
        "hover:bg-muted dark:hover:bg-muted/50",
        "transition-colors",
        className
      )}
      style={{ paddingLeft: `${indentPx}px` }}
    >
      {/* Tree connector line */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-muted-foreground dark:text-muted-foreground">│</span>
        <FileText className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* PO Number */}
      <div className="min-w-[90px]">
        <span className="font-mono text-xs font-medium text-foreground dark:text-muted-foreground">
          {poNumber}
        </span>
      </div>

      {/* Supplier */}
      <div className="flex-1 min-w-[150px] truncate">
        <span className="text-muted-foreground dark:text-muted-foreground">{supplier}</span>
      </div>

      {/* Total Amount */}
      <div className="min-w-[90px] text-right tabular-nums">
        <span className="font-medium">{formatCurrency(total)}</span>
      </div>

      {/* Payment Progress */}
      <div className="min-w-[120px]">
        <PaymentProgressBar paid={paid} total={total} />
      </div>

      {/* Paid Amount */}
      <div className="min-w-[90px] text-right tabular-nums text-muted-foreground">
        {formatCurrency(paid)}
      </div>

      {/* Status Badge */}
      <div className="min-w-[80px] flex justify-end">
        <Badge
          variant="secondary"
          className={cn(
            "gap-1 font-normal",
            paymentStatus === "complete" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
            paymentStatus === "part_payment" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
            paymentStatus === "pending" && "bg-muted text-muted-foreground dark:bg-card dark:text-muted-foreground",
            paymentStatus === "manual_review" && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {statusConfig.label}
        </Badge>
      </div>
    </div>
  );
}
