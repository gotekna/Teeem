"use client";

import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ClipboardList } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import type { QuoteSummaryData } from "./types";
import { TradeSection } from "./TradeSection";

interface QuoteTrackerBoardProps {
  data: QuoteSummaryData;
  loading: boolean;
  onSendRfq: (id: number) => Promise<void>;
  onRecordResponse: (id: number, price: number, timeframe?: string, notes?: string) => Promise<void>;
  onAccept: (id: number) => Promise<void>;
  onSendAllForTrade: (tradeId: number) => Promise<void>;
}

export function QuoteTrackerBoard({
  data,
  loading,
  onSendRfq,
  onRecordResponse,
  onAccept,
  onSendAllForTrade,
}: QuoteTrackerBoardProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (data.trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ClipboardList className="h-8 w-8 mb-3 opacity-50" />
        <p className="font-medium">No quotes yet</p>
        <p className="text-sm mt-1">Apply a template above to start tracking quotes for this job</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Trade Sections */}
      {data.trades.map((trade) => (
        <TradeSection
          key={trade.smTradeId ?? "uncategorized"}
          trade={trade}
          onSendRfq={onSendRfq}
          onRecordResponse={onRecordResponse}
          onAccept={onAccept}
          onSendAllForTrade={onSendAllForTrade}
        />
      ))}

      {/* Total Footer */}
      {data.totalEstimated > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-lg border">
          <span className="font-semibold text-sm">Estimated Total (Best Prices)</span>
          <span className="font-bold text-lg text-green-700 dark:text-green-400">
            {formatCurrency(data.totalEstimated)}
          </span>
        </div>
      )}
    </div>
  );
}
