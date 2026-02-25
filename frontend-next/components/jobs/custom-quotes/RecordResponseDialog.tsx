"use client";

import { useState, useCallback } from "react";
import { FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

interface AttachedDocument {
  warehouseDocumentId: number;
  filename: string;
}

interface RecordResponseDialogProps {
  open: boolean;
  onClose: () => void;
  supplierName: string;
  attachedDocument?: AttachedDocument | null;
  onSubmit: (data: {
    price_quoted: number;
    quote_number?: string;
    valid_to?: string;
    response_notes?: string;
    warehouse_document_id?: number;
  }) => Promise<void>;
}

export function RecordResponseDialog({
  open,
  onClose,
  supplierName,
  attachedDocument,
  onSubmit,
}: RecordResponseDialogProps) {
  const [price, setPrice] = useState("");
  const [quoteNumber, setQuoteNumber] = useState("");
  const [validTo, setValidTo] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!price) return;
    setSubmitting(true);
    try {
      await onSubmit({
        price_quoted: parseFloat(price),
        quote_number: quoteNumber || undefined,
        valid_to: validTo || undefined,
        response_notes: notes || undefined,
        warehouse_document_id: attachedDocument?.warehouseDocumentId,
      });
      // Reset form
      setPrice("");
      setQuoteNumber("");
      setValidTo("");
      setNotes("");
    } finally {
      setSubmitting(false);
    }
  }, [price, quoteNumber, validTo, notes, attachedDocument, onSubmit]);

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !submitting) {
      onClose();
      setPrice("");
      setQuoteNumber("");
      setValidTo("");
      setNotes("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Response — {supplierName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {attachedDocument && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-sm text-blue-700 dark:text-blue-300 truncate">
                {attachedDocument.filename}
              </span>
            </div>
          )}
          <div>
            <Label>Price Quoted *</Label>
            <div className="relative mt-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="pl-6"
                placeholder="0.00"
                step="0.01"
                autoFocus
              />
            </div>
          </div>
          <div>
            <Label>Quote Number</Label>
            <Input
              value={quoteNumber}
              onChange={(e) => setQuoteNumber(e.target.value)}
              className="mt-1"
              placeholder="Q-001"
            />
          </div>
          <div>
            <Label>Valid To</Label>
            <Input
              type="date"
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={2}
              placeholder="Optional notes..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!price || submitting}>
            {submitting ? <Spinner className="h-4 w-4 mr-2" /> : null}
            Record Response
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
