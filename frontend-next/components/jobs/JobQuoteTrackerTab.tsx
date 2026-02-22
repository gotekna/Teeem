"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { LayoutGrid, Table as TableIcon } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import TeeemTableView from "@/components/table/TeeemTableView";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";
import { TemplateApplyBar } from "./quote-tracker/TemplateApplyBar";
import { QuoteTrackerBoard } from "./quote-tracker/QuoteTrackerBoard";
import { SendRFQDialog } from "./quote-tracker/SendRFQDialog";
import type { QuoteSummaryData, QuoteTrackerRow } from "./quote-tracker/types";

interface JobQuoteTrackerTabProps {
  jobId: string | number;
}

/**
 * JobQuoteTrackerTab - Track supplier quotes for a job with RFQ workflow
 *
 * SSoT: Foundation = 'quote-tracker'
 * Location: Estimating > Quote Tracker tab
 *
 * Two views:
 * - Board: Grouped by trade, shows status, best price highlights, accept → PO
 * - Table: Traditional TeeemTableView for detailed inline editing
 */
export function JobQuoteTrackerTab({ jobId }: JobQuoteTrackerTabProps) {
  const [view, setView] = useState<"board" | "table">("board");
  const [summaryData, setSummaryData] = useState<QuoteSummaryData>({
    jobId: Number(jobId),
    jobName: "",
    totalTrades: 0,
    totalEstimated: 0,
    trades: [],
  });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // SendRFQDialog state
  const [rfqDialogOpen, setRfqDialogOpen] = useState(false);
  const [rfqDialogTrackers, setRfqDialogTrackers] = useState<QuoteTrackerRow[]>([]);

  // ─────────────────────────────────────────────────────────────────────────
  // Load summary data (board view)
  // ─────────────────────────────────────────────────────────────────────────

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: QuoteSummaryData }>(
        `/api/v1/jobs/${jobId}/quote_summary`
      );
      if (response?.data) {
        setSummaryData(response.data);
      }
    } catch (err) {
      console.error("[JobQuoteTrackerTab] Failed to load summary:", err);
      toast.error("Failed to load quote summary");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary, refreshKey]);

  const refresh = () => {
    setRefreshKey(k => k + 1);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  // Opens the SendRFQDialog for a single tracker
  const handleSendRfq = async (trackerId: number) => {
    const tracker = summaryData.trades
      .flatMap(t => t.suppliers)
      .find(s => s.id === trackerId);

    if (tracker) {
      setRfqDialogTrackers([tracker]);
      setRfqDialogOpen(true);
    }
  };

  // Opens the SendRFQDialog for all draft trackers in a trade
  const handleSendAllForTrade = async (tradeId: number) => {
    const trade = summaryData.trades.find(t => t.smTradeId === tradeId);
    if (!trade) return;

    const draftTrackers = trade.suppliers.filter(s => s.status === "draft");
    if (draftTrackers.length === 0) return;

    setRfqDialogTrackers(draftTrackers);
    setRfqDialogOpen(true);
  };

  const handleRecordResponse = async (trackerId: number, price: number, timeframe?: string, notes?: string) => {
    try {
      await api.post(`/api/v1/quote_trackers/${trackerId}/record_response`, {
        price_quoted: price,
        timeframe,
        response_notes: notes,
      });
      toast.success("Response recorded");
      loadSummary();
    } catch (err) {
      console.error("[JobQuoteTrackerTab] Record response failed:", err);
      toast.error("Failed to record response");
    }
  };

  const handleAccept = async (trackerId: number) => {
    try {
      const response = await api.post<{ success: boolean; message: string }>(
        `/api/v1/quote_trackers/${trackerId}/accept`
      );
      toast.success(response?.message || "Quote accepted, PO created");
      loadSummary();
    } catch (err) {
      console.error("[JobQuoteTrackerTab] Accept failed:", err);
      toast.error("Failed to accept quote");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const hasExistingQuotes = summaryData.trades.length > 0;

  return (
    <div className="flex flex-col h-full -mx-4">
      {/* Template Apply Bar */}
      <TemplateApplyBar
        jobId={jobId}
        hasExistingQuotes={hasExistingQuotes}
        onApplied={refresh}
      />

      {/* View Toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {summaryData.totalTrades > 0 ? `${summaryData.totalTrades} trades` : "Quote Tracker"}
        </h2>
        <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
          <Button
            variant={view === "board" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => setView("board")}
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-1" />
            Board
          </Button>
          <Button
            variant={view === "table" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => setView("table")}
          >
            <TableIcon className="h-3.5 w-3.5 mr-1" />
            Table
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {view === "board" ? (
          <QuoteTrackerBoard
            data={summaryData}
            loading={loading}
            onSendRfq={handleSendRfq}
            onRecordResponse={handleRecordResponse}
            onAccept={handleAccept}
            onSendAllForTrade={handleSendAllForTrade}
          />
        ) : (
          <div className="flex flex-col h-full">
            <TeeemTableView
              foundationId={FOUNDATION_SLUGS.QUOTE_TRACKER}
              autoFetchRecords={true}
              initialFilters={[
                {
                  id: "job-filter",
                  column: "job_id",
                  operator: "=",
                  value: String(jobId),
                },
              ]}
              tableName="Quote Tracker"
            />
          </div>
        )}
      </div>

      {/* Send RFQ Dialog */}
      <SendRFQDialog
        open={rfqDialogOpen}
        onOpenChange={setRfqDialogOpen}
        trackers={rfqDialogTrackers}
        jobId={Number(jobId)}
        onSent={refresh}
      />
    </div>
  );
}

export default JobQuoteTrackerTab;
