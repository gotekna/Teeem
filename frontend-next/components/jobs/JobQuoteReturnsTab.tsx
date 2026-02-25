"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Check,
  X,
  FileText,
  ClipboardCheck,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { QuoteConfirmDialog } from "./quote-returns/QuoteConfirmDialog";
import type {
  QuoteReturn,
  QuoteReturnsData,
  QuoteReturnStatus,
} from "./quote-returns/types";
import { STATUS_COLORS, STATUS_LABELS } from "./quote-returns/types";

interface JobQuoteReturnsTabProps {
  jobId: string | number;
}

export default function JobQuoteReturnsTab({ jobId }: JobQuoteReturnsTabProps) {
  const [data, setData] = useState<QuoteReturnsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<QuoteReturn | null>(null);
  const [filter, setFilter] = useState<QuoteReturnStatus | "all">("all");

  const loadReturns = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: QuoteReturnsData }>(
        `/api/v1/jobs/${jobId}/quote_returns`
      );
      setData(res?.data ?? null);
    } catch (err) {
      console.error("[JobQuoteReturnsTab] Failed to load:", err);
      toast.error("Failed to load quote returns");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  const handleReject = async (qr: QuoteReturn) => {
    try {
      await api.post(`/api/v1/quote_returns/${qr.id}/reject`);
      toast.success("Quote rejected");
      loadReturns();
    } catch (err) {
      console.error("[JobQuoteReturnsTab] Reject failed:", err);
      toast.error("Failed to reject quote");
    }
  };

  const filteredReturns =
    data?.returns.filter((r) => filter === "all" || r.status === filter) ?? [];

  const formatCurrency = (val: number | null | undefined) => {
    if (val == null) return "—";
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isExpired = (validTo: string | null) => {
    if (!validTo) return false;
    return new Date(validTo) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (!data || data.returns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <ClipboardCheck className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-lg font-medium">No Quote Returns Yet</p>
        <p className="text-sm mt-1">
          Supplier responses from Quote Tracker and Custom Quotes will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary Bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Total Returns</span>
          <Badge variant="secondary">{data.summary.totalReturns}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Accepted</span>
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            {data.summary.acceptedCount}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Pending</span>
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            {data.summary.respondedCount}
          </Badge>
        </div>
        <div className="ml-auto text-sm">
          <span className="text-muted-foreground">Accepted Value: </span>
          <span className="font-semibold">
            {formatCurrency(data.summary.totalAcceptedValue)}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b">
        {(["all", "responded", "accepted", "rejected"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : STATUS_LABELS[f]}
            <Badge variant="outline" className="ml-1 text-xs h-4 px-1">
              {f === "all"
                ? data.returns.length
                : data.returns.filter((r) => r.status === f).length}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr className="border-b">
              <th className="text-left px-4 py-2 font-medium">Supplier</th>
              <th className="text-left px-3 py-2 font-medium">Item / Task</th>
              <th className="text-left px-3 py-2 font-medium">CC / Trade</th>
              <th className="text-right px-3 py-2 font-medium">Price</th>
              <th className="text-left px-3 py-2 font-medium">Received</th>
              <th className="text-left px-3 py-2 font-medium">Quote #</th>
              <th className="text-left px-3 py-2 font-medium">Valid To</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Confirmed</th>
              <th className="text-center px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReturns.map((qr) => (
              <tr
                key={qr.id}
                className={`border-b hover:bg-muted/30 ${
                  qr.status === "rejected" ? "opacity-50" : ""
                }`}
              >
                <td className="px-4 py-2 font-medium truncate max-w-[160px]">
                  {qr.supplierName || "Unknown"}
                </td>
                <td className="px-3 py-2 truncate max-w-[160px]">
                  {qr.itemName || "—"}
                </td>
                <td className="px-3 py-2 truncate max-w-[120px] text-muted-foreground">
                  {qr.parentName || "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  <span
                    className={
                      qr.isBestPrice
                        ? "text-green-600 dark:text-green-400 font-bold"
                        : ""
                    }
                  >
                    {formatCurrency(qr.priceQuoted)}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {qr.dateReceived
                    ? new Date(qr.dateReceived).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-3 py-2">{qr.quoteNumber || "—"}</td>
                <td className="px-3 py-2">
                  {qr.validTo ? (
                    <span
                      className={
                        isExpired(qr.validTo)
                          ? "text-red-600 dark:text-red-400"
                          : ""
                      }
                    >
                      {new Date(qr.validTo).toLocaleDateString()}
                      {isExpired(qr.validTo) && " (expired)"}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${STATUS_COLORS[qr.status]}`}
                  >
                    {STATUS_LABELS[qr.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {qr.confirmedBy ? (
                    <span title={qr.confirmedAt ? new Date(qr.confirmedAt).toLocaleString() : ""}>
                      {qr.confirmedBy}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    {qr.status === "responded" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                          onClick={() => setConfirmDialog(qr)}
                          title="Select this quote"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Select
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={() => handleReject(qr)}
                          title="Reject this quote"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {qr.status === "accepted" && qr.purchaseOrderNumber && (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        PO {qr.purchaseOrderNumber}
                      </span>
                    )}
                    {qr.warehouseDocumentId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="View quote document"
                        onClick={() =>
                          window.open(
                            `/api/v1/warehouse_documents/${qr.warehouseDocumentId}/download`,
                            "_blank"
                          )
                        }
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredReturns.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            No {filter !== "all" ? STATUS_LABELS[filter].toLowerCase() : ""} returns found.
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <QuoteConfirmDialog
          open={true}
          onClose={() => setConfirmDialog(null)}
          quoteReturn={confirmDialog}
          onAccepted={loadReturns}
        />
      )}
    </div>
  );
}
