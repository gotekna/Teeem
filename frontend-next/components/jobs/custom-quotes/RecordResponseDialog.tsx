"use client";

import { useState, useCallback, useEffect } from "react";
import { FileText, Sparkles, X, SplitSquareHorizontal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { PDFViewer } from "@/components/ui/pdf-viewer";
import { useQuoteExtraction } from "./useQuoteExtraction";
import { useDocumentPreview } from "./useDocumentPreview";
import type { CustomQuoteLineNode } from "./types";

interface AttachedDocument {
  warehouseDocumentId: number;
  filename: string;
}

export interface RecordResponseDialogProps {
  open: boolean;
  onClose: () => void;
  supplierName: string;
  supplierId: number;
  attachedDocument?: AttachedDocument | null;
  /** Parent CC line — used to show PO allocation when quote_level is cost_centre */
  parentLine?: CustomQuoteLineNode | null;
  onSubmit: (data: {
    price_quoted: number;
    quote_number?: string;
    valid_to?: string;
    response_notes?: string;
    warehouse_document_id?: number;
    allocations?: Array<{ lineId: number; amount: number }>;
  }) => Promise<void>;
}

export function RecordResponseDialog({
  open,
  onClose,
  supplierName,
  supplierId,
  attachedDocument,
  parentLine,
  onSubmit,
}: RecordResponseDialogProps) {
  // Form state
  const [price, setPrice] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("");
  const [validTo, setValidTo] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [aiFilled, setAiFilled] = useState(false);

  // Allocation state (CC-level only)
  const [allocations, setAllocations] = useState<Record<number, string>>({});

  // AI extraction + PDF preview
  const { extracting, extraction, extract, reset: resetExtraction } = useQuoteExtraction();
  const { preview, loading: previewLoading, loadPreview, reset: resetPreview } = useDocumentPreview();

  const hasDocument = !!attachedDocument;
  // Show PDF panel when a document is attached — decoupled from hasDocument for future extensibility
  const [showPdfPanel, setShowPdfPanel] = useState(false);
  const isCCLevel = parentLine?.quoteLevel === "cost_centre" && parentLine.children.length > 0;

  // Sync PDF panel visibility with document state
  useEffect(() => {
    setShowPdfPanel(hasDocument);
  }, [hasDocument]);

  // Load PDF preview + start AI extraction when sheet opens with a document
  useEffect(() => {
    if (open && hasDocument && supplierId) {
      loadPreview(supplierId);
      extract(supplierId);
    }
  }, [open, hasDocument, supplierId, loadPreview, extract]);

  // Auto-fill form fields when AI extraction completes
  useEffect(() => {
    if (!extraction) return;
    if (extraction.priceQuoted != null && !price) {
      setPrice(String(extraction.priceQuoted));
    }
    if (extraction.quoteNumber && !quoteNumber) {
      setQuoteNumber(extraction.quoteNumber);
    }
    if (extraction.validTo && !validTo) {
      setValidTo(extraction.validTo);
    }
    if (extraction.notesSummary && !notes) {
      setNotes(extraction.notesSummary);
    }
    setAiFilled(true);
  }, [extraction]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize allocation amounts when parentLine or price changes
  useEffect(() => {
    if (!isCCLevel) return;
    const initial: Record<number, string> = {};
    for (const child of parentLine!.children) {
      initial[child.id] = allocations[child.id] || "";
    }
    setAllocations(initial);
  }, [parentLine?.children?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = useCallback(() => {
    setPrice("");
    setQuoteNumber("");
    setValidTo("");
    setNotes("");
    setSubmitting(false);
    setAiFilled(false);
    setAllocations({});
    resetExtraction();
    resetPreview();
  }, [resetExtraction, resetPreview]);

  const handleSubmit = useCallback(async () => {
    if (!price) return;
    setSubmitting(true);
    try {
      const allocationData = isCCLevel
        ? Object.entries(allocations)
            .filter(([, val]) => parseFloat(val) > 0)
            .map(([lineId, val]) => ({ lineId: Number(lineId), amount: parseFloat(val) }))
        : undefined;

      await onSubmit({
        price_quoted: parseFloat(price),
        quote_number: quoteNumber || undefined,
        valid_to: validTo || undefined,
        response_notes: notes || undefined,
        warehouse_document_id: attachedDocument?.warehouseDocumentId,
        allocations: allocationData,
      });
      resetForm();
    } finally {
      setSubmitting(false);
    }
  }, [price, quoteNumber, validTo, notes, attachedDocument, isCCLevel, allocations, onSubmit, resetForm]);

  const handleClose = useCallback(() => {
    if (!submitting) {
      onClose();
      resetForm();
    }
  }, [submitting, onClose, resetForm]);

  // Allocation calculations
  const totalAllocated = Object.values(allocations).reduce(
    (sum, val) => sum + (parseFloat(val) || 0),
    0
  );
  const priceNum = parseFloat(price) || 0;
  const remaining = priceNum - totalAllocated;

  const handleAutoAllocate = useCallback(() => {
    if (!isCCLevel || !priceNum) return;
    const children = parentLine!.children;
    // Split evenly, with the remainder going to the last line
    const perLine = Math.floor((priceNum / children.length) * 100) / 100;
    const newAllocations: Record<number, string> = {};
    let allocated = 0;
    children.forEach((child, i) => {
      if (i === children.length - 1) {
        newAllocations[child.id] = String(Math.round((priceNum - allocated) * 100) / 100);
      } else {
        newAllocations[child.id] = String(perLine);
        allocated += perLine;
      }
    });
    setAllocations(newAllocations);
  }, [isCCLevel, priceNum, parentLine]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent
        side={showPdfPanel ? "right-95" : "right-wide"}
        title={`Record Response — ${supplierName}`}
        className="flex flex-col overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="flex flex-row items-center justify-between shrink-0 pb-4 border-b">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Record Response — {supplierName}</h2>
            {aiFilled && !extracting && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <Sparkles className="h-3 w-3" />
                AI-filled
              </span>
            )}
            {extracting && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Spinner className="h-3 w-3" />
                Extracting...
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </SheetHeader>

        {/* Body — two-column when PDF, single column otherwise */}
        <div className={`flex-1 overflow-hidden flex ${showPdfPanel ? "flex-row gap-4" : "flex-col"} mt-4`}>
          {/* Left panel: PDF viewer */}
          {showPdfPanel && (
            <div className="flex-1 min-w-0 rounded-lg border bg-muted/30 overflow-hidden">
              {previewLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : preview?.url ? (
                <PDFViewer url={preview.url} className="h-full w-full" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileText className="h-12 w-12 mb-2" />
                  <p className="text-sm">{attachedDocument?.filename || "Document"}</p>
                  <p className="text-xs mt-1">Preview not available</p>
                </div>
              )}
            </div>
          )}

          {/* Right panel: Form + Allocation */}
          <div className={`${showPdfPanel ? "w-[380px] shrink-0" : "flex-1 max-w-md mx-auto w-full"} overflow-y-auto space-y-4 pr-1`}>
            {/* Document badge (when no inline PDF panel is shown) */}
            {!showPdfPanel && attachedDocument?.filename && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-sm text-blue-700 dark:text-blue-300 truncate">
                  {attachedDocument.filename}
                </span>
              </div>
            )}

            {/* Price Quoted */}
            <div>
              <Label className="flex items-center gap-1">
                Price Quoted *
                {aiFilled && extraction?.priceQuoted != null && (
                  <Sparkles className="h-3 w-3 text-blue-500" />
                )}
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={`pl-6 ${aiFilled && extraction?.priceQuoted != null ? "border-blue-300 dark:border-blue-700" : ""}`}
                  placeholder="0.00"
                  step="0.01"
                  autoFocus={!showPdfPanel}
                />
              </div>
            </div>

            {/* Quote Number */}
            <div>
              <Label className="flex items-center gap-1">
                Quote Number
                {aiFilled && extraction?.quoteNumber && (
                  <Sparkles className="h-3 w-3 text-blue-500" />
                )}
              </Label>
              <Input
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value)}
                className={`mt-1 ${aiFilled && extraction?.quoteNumber ? "border-blue-300 dark:border-blue-700" : ""}`}
                placeholder="Q-001"
              />
            </div>

            {/* Valid To */}
            <div>
              <Label className="flex items-center gap-1">
                Valid To
                {aiFilled && extraction?.validTo && (
                  <Sparkles className="h-3 w-3 text-blue-500" />
                )}
              </Label>
              <Input
                type="date"
                value={validTo}
                onChange={(e) => setValidTo(e.target.value)}
                className={`mt-1 ${aiFilled && extraction?.validTo ? "border-blue-300 dark:border-blue-700" : ""}`}
              />
            </div>

            {/* Notes */}
            <div>
              <Label className="flex items-center gap-1">
                Notes
                {aiFilled && extraction?.notesSummary && (
                  <Sparkles className="h-3 w-3 text-blue-500" />
                )}
              </Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${aiFilled && extraction?.notesSummary ? "border-blue-300 dark:border-blue-700" : ""}`}
                rows={3}
                placeholder="Payment terms, lead time, inclusions/exclusions..."
              />
            </div>

            {/* Tender Context (CC-level) */}
            {parentLine?.tenderDescription && (
              <div className="rounded-md bg-muted/50 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tender Description</p>
                <p className="text-sm">{parentLine.tenderDescription}</p>
              </div>
            )}

            {/* PO Line Allocation (CC-level only) */}
            {isCCLevel && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SplitSquareHorizontal className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">PO Line Allocation</Label>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleAutoAllocate} disabled={!priceNum}>
                    Split Evenly
                  </Button>
                </div>

                {parentLine?.budgetAmount != null && (
                  <p className="text-xs text-muted-foreground">
                    CC: {parentLine.name} (${parentLine.budgetAmount.toLocaleString()} budget)
                  </p>
                )}

                <div className="space-y-2">
                  {parentLine!.children.map((child) => {
                    const amt = parseFloat(allocations[child.id] || "0") || 0;
                    const pct = priceNum > 0 ? Math.round((amt / priceNum) * 100) : 0;
                    return (
                      <div key={child.id} className="flex items-center gap-2">
                        <span className="text-sm flex-1 truncate">{child.name}</span>
                        <div className="relative w-28">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                          <Input
                            type="number"
                            value={allocations[child.id] || ""}
                            onChange={(e) =>
                              setAllocations((prev) => ({ ...prev, [child.id]: e.target.value }))
                            }
                            className="pl-5 text-sm h-8"
                            placeholder="0"
                            step="0.01"
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between pt-2 border-t text-sm">
                  <span>Total:</span>
                  <span className="font-medium">
                    ${totalAllocated.toLocaleString()} / ${priceNum.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Remaining:</span>
                  <span
                    className={`font-medium ${
                      remaining < 0 ? "text-red-600" : remaining > 0 ? "text-amber-600" : "text-green-600"
                    }`}
                  >
                    ${Math.abs(remaining).toLocaleString()}
                    {remaining < 0 ? " over" : remaining > 0 ? " unallocated" : ""}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="shrink-0 pt-4 border-t mt-4">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!price || submitting || (isCCLevel && remaining < 0)}>
            {submitting ? <Spinner className="h-4 w-4 mr-2" /> : null}
            Record Response
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
