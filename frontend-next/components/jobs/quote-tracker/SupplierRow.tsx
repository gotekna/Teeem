"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Send,
  Check,
  DollarSign,
  FileText,
  Mail,
  MessageSquare,
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
  onUpdateInstructions: (id: number, instructions: string) => Promise<void>;
}

export function SupplierRow({ tracker, onSendRfq, onRecordResponse, onAccept, onUpdateInstructions }: SupplierRowProps) {
  const [enteringPrice, setEnteringPrice] = useState(false);
  const [priceValue, setPriceValue] = useState("");
  const [timeframeValue, setTimeframeValue] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructionsValue, setInstructionsValue] = useState(tracker.instructions || "");
  const [savingInstructions, setSavingInstructions] = useState(false);
  const instructionsRef = useRef<HTMLTextAreaElement>(null);

  // Sync if tracker.instructions changes externally (e.g. after reload)
  useEffect(() => {
    setInstructionsValue(tracker.instructions || "");
  }, [tracker.instructions]);

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

  const handleSaveInstructions = async () => {
    const trimmed = instructionsValue.trim();
    // Only save if changed
    if (trimmed === (tracker.instructions || "").trim()) return;
    setSavingInstructions(true);
    try {
      await onUpdateInstructions(tracker.id, trimmed);
    } finally {
      setSavingInstructions(false);
    }
  };

  const hasInstructions = !!tracker.instructions?.trim();

  return (
    <div>
      <div
        className={cn(
          "grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center px-3 py-2 rounded",
          tracker.isBestPrice && tracker.status !== "accepted"
            ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
            : "hover:bg-muted/50"
        )}
      >
        {/* Supplier Name + Email + Contact */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">
              {tracker.supplierName || "Unknown Supplier"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-5 w-5 shrink-0",
                hasInstructions
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground opacity-60 hover:opacity-100"
              )}
              onClick={() => setShowInstructions(!showInstructions)}
              title={hasInstructions ? "Edit RFQ instructions" : "Add RFQ instructions"}
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
          </div>
          {tracker.contactEmail && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{tracker.contactEmail}</span>
            </div>
          )}
          {tracker.contactName && (
            <div className="text-xs text-muted-foreground truncate">
              Contact: {tracker.contactName}
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

      {/* Expandable Instructions Panel */}
      {showInstructions && (
        <div className="px-3 pb-2 pt-1">
          <div className="relative">
            <textarea
              ref={instructionsRef}
              value={instructionsValue}
              onChange={(e) => setInstructionsValue(e.target.value)}
              onBlur={handleSaveInstructions}
              placeholder="RFQ instructions for this supplier (included in the email body)..."
              className="w-full text-sm border rounded-md p-2 pr-8 min-h-[60px] max-h-[150px] resize-y bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              rows={2}
            />
            {savingInstructions && (
              <div className="absolute top-2 right-2">
                <Spinner className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            These instructions will be included in the RFQ email body when sent.
          </p>
        </div>
      )}
    </div>
  );
}
