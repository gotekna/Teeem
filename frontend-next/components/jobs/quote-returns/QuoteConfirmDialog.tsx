"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { format, parseISO } from "date-fns";
import { DATE_DISPLAY } from "@/lib/constants/date-formats";
import { FileText, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { ConfirmDetails, QuoteReturn } from "./types";

interface QuoteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  quoteReturn: QuoteReturn;
  onAccepted: () => void;
}

export function QuoteConfirmDialog({
  open,
  onClose,
  quoteReturn,
  onAccepted,
}: QuoteConfirmDialogProps) {
  const [details, setDetails] = useState<ConfirmDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setConfirmed(false);
    setNotes("");

    api
      .get<{ success: boolean; data: ConfirmDetails }>(
        `/api/v1/quote_returns/${quoteReturn.id}/confirm_details`
      )
      .then((res) => {
        setDetails(res?.data ?? null);
      })
      .catch((err) => {
        console.error("[QuoteConfirmDialog] Failed to load details:", err);
        toast.error("Failed to load quote details");
      })
      .finally(() => setLoading(false));
  }, [open, quoteReturn.id]);

  const handleAccept = async () => {
    setConfirming(true);
    try {
      const res = await api.post<{
        success: boolean;
        message: string;
        data: { purchaseOrders: Array<{ poNumber: string }> };
      }>(`/api/v1/quote_returns/${quoteReturn.id}/accept`, {
        confirmationNotes: notes || undefined,
      });
      toast.success(res?.message || "Quote accepted, PO created");
      onAccepted();
      onClose();
    } catch (err) {
      console.error("[QuoteConfirmDialog] Accept failed:", err);
      toast.error("Failed to accept quote");
    } finally {
      setConfirming(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val == null) return "—";
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Confirm Quote Match</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : details ? (
          <div className="space-y-4">
            {/* Side-by-side comparison */}
            <div className="grid grid-cols-2 gap-4">
              {/* Left: What we requested */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                  What We Requested
                </h3>

                {details.requested.taskName && (
                  <div>
                    <span className="text-xs text-muted-foreground">Task / Item</span>
                    <p className="text-sm font-medium">{details.requested.taskName}</p>
                  </div>
                )}

                {details.requested.description && (
                  <div>
                    <span className="text-xs text-muted-foreground">Description</span>
                    <p className="text-sm whitespace-pre-wrap">{details.requested.description}</p>
                  </div>
                )}

                {details.requested.budget != null && (
                  <div>
                    <span className="text-xs text-muted-foreground">Budget</span>
                    <p className="text-sm font-medium">{formatCurrency(details.requested.budget)}</p>
                  </div>
                )}

                {details.requested.documentTypeNames && details.requested.documentTypeNames.length > 0 && (
                  <div>
                    <span className="text-xs text-muted-foreground">Document Types</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {details.requested.documentTypeNames.map((dt) => (
                        <Badge key={dt} variant="outline" className="text-xs">
                          {dt}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {details.requested.rfqInstructions && (
                  <div>
                    <span className="text-xs text-muted-foreground">Instructions</span>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                      {details.requested.rfqInstructions}
                    </p>
                  </div>
                )}
              </div>

              {/* Right: What they quoted */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                  What They Quoted
                </h3>

                <div>
                  <span className="text-xs text-muted-foreground">Supplier</span>
                  <p className="text-sm font-medium">{details.quoted.supplierName || "Unknown"}</p>
                </div>

                <div>
                  <span className="text-xs text-muted-foreground">Price</span>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(details.quoted.price)}
                  </p>
                  {details.requested.budget != null && details.quoted.price != null && (
                    <p className="text-xs text-muted-foreground">
                      {details.quoted.price <= details.requested.budget
                        ? `Under budget by ${formatCurrency(details.requested.budget - details.quoted.price)}`
                        : `Over budget by ${formatCurrency(details.quoted.price - details.requested.budget)}`}
                    </p>
                  )}
                </div>

                {details.quoted.quoteNumber && (
                  <div>
                    <span className="text-xs text-muted-foreground">Quote #</span>
                    <p className="text-sm">{details.quoted.quoteNumber}</p>
                  </div>
                )}

                {details.quoted.validTo && (
                  <div>
                    <span className="text-xs text-muted-foreground">Valid To</span>
                    <p className="text-sm">{format(parseISO(details.quoted.validTo), DATE_DISPLAY)}</p>
                  </div>
                )}

                {details.quoted.timeframe && (
                  <div>
                    <span className="text-xs text-muted-foreground">Timeframe</span>
                    <p className="text-sm">{details.quoted.timeframe}</p>
                  </div>
                )}

                {details.quoted.responseNotes && (
                  <div>
                    <span className="text-xs text-muted-foreground">Notes</span>
                    <p className="text-sm whitespace-pre-wrap">{details.quoted.responseNotes}</p>
                  </div>
                )}

                {details.quoted.documentUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => window.open(details.quoted.documentUrl!, "_blank")}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    View Quote PDF
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>

            {/* Notes field */}
            <div>
              <label className="text-sm font-medium" htmlFor="confirm-notes">
                Notes (optional)
              </label>
              <Textarea
                id="confirm-notes"
                placeholder="Any notes about this confirmation..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>

            {/* Confirmation checkbox */}
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <Checkbox
                id="confirm-match"
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
              />
              <label htmlFor="confirm-match" className="text-sm font-medium cursor-pointer">
                I confirm this quote matches our request
              </label>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">
            Failed to load quote details.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={confirming}>
            Cancel
          </Button>
          <Button
            onClick={handleAccept}
            disabled={!confirmed || confirming || loading}
          >
            {confirming ? (
              <>
                <Spinner className="h-4 w-4 mr-1" />
                Creating PO...
              </>
            ) : (
              "Confirm & Create PO"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
