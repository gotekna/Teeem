"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Send,
  Check,
  DollarSign,
  FileText,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import type { QuoteTrackerRow } from "./types";
import { STATUS_COLORS, STATUS_LABELS } from "./types";

interface SupplierRowProps {
  tracker: QuoteTrackerRow;
  onSendRfq: (id: number) => Promise<void>;
  onRecordResponse: (id: number, price: number, timeframe?: string, notes?: string) => Promise<void>;
  onAccept: (id: number) => Promise<void>;
}

export function SupplierRow({ tracker, onSendRfq, onRecordResponse, onAccept }: SupplierRowProps) {
  const [enteringPrice, setEnteringPrice] = useState(false);
  const [priceValue, setPriceValue] = useState("");
  const [timeframeValue, setTimeframeValue] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const handleSend = async () => {
    setActionLoading(true);
    try {
      await onSendRfq(tracker.id);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitPrice = async () => {
    const price = parseFloat(priceValue);
    if (isNaN(price) || price <= 0) return;
    setActionLoading(true);
    try {
      await onRecordResponse(tracker.id, price, timeframeValue || undefined);
      setEnteringPrice(false);
      setPriceValue("");
      setTimeframeValue("");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      await onAccept(tracker.id);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center px-3 py-2 rounded",
        tracker.isBestPrice && tracker.status !== "accepted"
          ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
          : "hover:bg-muted/50"
      )}
    >
      {/* Supplier Name + Contact */}
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">
          {tracker.supplierName || "Unknown Supplier"}
        </div>
        {tracker.contactName && (
          <div className="text-xs text-muted-foreground truncate">
            {tracker.contactName}
            {tracker.contactEmail && ` (${tracker.contactEmail})`}
          </div>
        )}
      </div>

      {/* Status Badge */}
      <Badge className={cn("text-xs shrink-0", STATUS_COLORS[tracker.status])}>
        {STATUS_LABELS[tracker.status]}
      </Badge>

      {/* Sent Date */}
      <div className="text-xs text-muted-foreground w-20 text-right shrink-0">
        {tracker.sentAt
          ? new Date(tracker.sentAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })
          : "—"}
      </div>

      {/* Price */}
      <div className="w-28 text-right shrink-0">
        {enteringPrice ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={priceValue}
              onChange={(e) => setPriceValue(e.target.value)}
              placeholder="Price"
              className="h-7 text-xs w-20"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmitPrice();
                if (e.key === "Escape") setEnteringPrice(false);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleSubmitPrice}
              disabled={actionLoading}
            >
              {actionLoading ? <Spinner className="h-3 w-3" /> : <Check className="h-3 w-3" />}
            </Button>
          </div>
        ) : tracker.priceQuoted != null ? (
          <span className={cn("text-sm font-medium", tracker.isBestPrice && "text-green-700 dark:text-green-400")}>
            {formatCurrency(tracker.priceQuoted)}
            {tracker.isBestPrice && tracker.status !== "accepted" && (
              <span className="text-xs ml-1 text-green-600 dark:text-green-400">Best</span>
            )}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Timeframe */}
      <div className="w-20 text-xs text-muted-foreground text-right shrink-0 truncate">
        {tracker.timeframe || "—"}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {tracker.status === "draft" && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleSend}
            disabled={actionLoading}
          >
            {actionLoading ? <Spinner className="h-3 w-3 mr-1" /> : <Send className="h-3 w-3 mr-1" />}
            Send
          </Button>
        )}
        {(tracker.status === "draft" || tracker.status === "sent") && !enteringPrice && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setEnteringPrice(true)}
          >
            <DollarSign className="h-3 w-3 mr-1" />
            Price
          </Button>
        )}
        {tracker.status === "responded" && tracker.priceQuoted != null && (
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs"
            onClick={handleAccept}
            disabled={actionLoading}
          >
            {actionLoading ? <Spinner className="h-3 w-3 mr-1" /> : <Check className="h-3 w-3 mr-1" />}
            Accept
          </Button>
        )}
        {tracker.purchaseOrderNumber && (
          <Badge variant="outline" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            {tracker.purchaseOrderNumber}
          </Badge>
        )}
      </div>
    </div>
  );
}
