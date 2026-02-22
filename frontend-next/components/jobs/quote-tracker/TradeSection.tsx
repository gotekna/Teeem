"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Send } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import type { TaskSummary } from "./types";
import { SupplierRow } from "./SupplierRow";

interface TradeSectionProps {
  trade: TaskSummary;
  onSendRfq: (id: number) => Promise<void>;
  onRecordResponse: (id: number, price: number, timeframe?: string, notes?: string) => Promise<void>;
  onAccept: (id: number) => Promise<void>;
  onSendAllForTask: (taskId: number) => Promise<void>;
}

export function TradeSection({
  trade,
  onSendRfq,
  onRecordResponse,
  onAccept,
  onSendAllForTask,
}: TradeSectionProps) {
  const [expanded, setExpanded] = useState(true);

  const draftCount = trade.suppliers.filter(s => s.status === "draft").length;
  const hasUnsent = draftCount > 0;
  const taskId = trade.smScheduleMasterId ?? trade.smTradeId;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Task Header */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}

        <span className="font-medium text-sm flex-1">
          {trade.taskName || "Uncategorized"}
        </span>

        {/* Status Summary */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {trade.respondedCount}/{trade.totalSuppliers} responded
          </span>

          {trade.bestPrice != null && (
            <Badge variant="outline" className="text-xs text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
              Best: {formatCurrency(trade.bestPrice)}
            </Badge>
          )}

          {/* Send All button for unsent */}
          {hasUnsent && taskId != null && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onSendAllForTask(taskId);
              }}
            >
              <Send className="h-3 w-3 mr-1" />
              Send {draftCount} Unsent
            </Button>
          )}
        </div>
      </div>

      {/* Supplier Rows */}
      {expanded && (
        <div className="divide-y">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center px-3 py-1.5 text-xs text-muted-foreground bg-muted/20">
            <span>Supplier</span>
            <span className="w-20">Status</span>
            <span className="w-20 text-right">Sent</span>
            <span className="w-28 text-right">Price</span>
            <span className="w-20 text-right">Timeframe</span>
            <span className="w-24">Actions</span>
          </div>

          {trade.suppliers.map((tracker) => (
            <SupplierRow
              key={tracker.id}
              tracker={tracker}
              onSendRfq={onSendRfq}
              onRecordResponse={onRecordResponse}
              onAccept={onAccept}
            />
          ))}
        </div>
      )}
    </div>
  );
}
