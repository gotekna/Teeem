"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { CustomQuoteSetup } from "./custom-quotes/CustomQuoteSetup";
import { CustomQuoteTree } from "./custom-quotes/CustomQuoteTree";
import { SaveAsTemplateDialog } from "./custom-quotes/SaveAsTemplateDialog";
import { useCustomQuote } from "./custom-quotes/useCustomQuote";
import type { QuoteLevel } from "./custom-quotes/types";
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
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import { api } from "@/lib/api";

interface JobCustomQuotesTabProps {
  jobId: string | number;
}

/**
 * JobCustomQuotesTab - Cost-centre-level quoting with CC → PO tree
 *
 * Location: Estimating > Custom Quotes tab
 *
 * Workflow:
 * 1. Apply template or create blank quote
 * 2. Configure CC/PO tree with quote level per CC
 * 3. Add suppliers, send RFQs, record responses
 * 4. Accept quotes (PO-level → direct PO, CC-level → allocate to POs)
 */
export function JobCustomQuotesTab({ jobId }: JobCustomQuotesTabProps) {
  const {
    quotes,
    activeQuote,
    loading,
    fetchQuotes,
    fetchQuoteTree,
    createQuote,
    updateLine,
    addSupplier,
    addChildLine,
    recordResponse,
    acceptQuote,
    rejectQuote,
    saveAsTemplate,
    fetchAllocations,
    createAllocation,
    refresh,
  } = useCustomQuote(jobId);

  // Dialog states
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [addSupplierDialog, setAddSupplierDialog] = useState<{ lineId: number } | null>(null);
  const [recordResponseDialog, setRecordResponseDialog] = useState<{ supplierId: number } | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierItems, setSupplierItems] = useState<ComboboxItem[]>([]);
  const [responsePrice, setResponsePrice] = useState("");
  const [responseQuoteNumber, setResponseQuoteNumber] = useState("");

  // Initial load
  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  // Auto-load first quote if exists
  useEffect(() => {
    if (quotes.length > 0 && !activeQuote) {
      fetchQuoteTree(quotes[0].id);
    }
  }, [quotes, activeQuote, fetchQuoteTree]);

  // Supplier search
  const searchSuppliers = useCallback(async (search: string) => {
    if (search.length < 2) return;
    try {
      const res = await api.get<{ success: boolean; records: Array<{ id: number; name: string }> }>(
        `/api/v1/foundations/contacts/records?search=${encodeURIComponent(search)}&limit=20`
      );
      if (res?.records) {
        setSupplierItems(
          res.records.map((c) => ({ id: String(c.id), label: c.name }))
        );
      }
    } catch {
      // ignore search errors
    }
  }, []);

  // Handlers
  const handleApplyTemplate = useCallback(async (templateId: number) => {
    await createQuote(templateId);
    await fetchQuotes();
  }, [createQuote, fetchQuotes]);

  const handleCreateBlank = useCallback(async () => {
    await createQuote();
    await fetchQuotes();
  }, [createQuote, fetchQuotes]);

  const handlePopulateFromSchedule = useCallback(async () => {
    await createQuote(undefined, undefined, 'schedule_master');
    await fetchQuotes();
  }, [createQuote, fetchQuotes]);

  const handleSelectQuote = useCallback((quoteId: number) => {
    fetchQuoteTree(quoteId);
  }, [fetchQuoteTree]);

  const handleToggleQuoteLevel = useCallback(async (lineId: number, level: QuoteLevel) => {
    await updateLine(lineId, { quote_level: level });
    await refresh();
  }, [updateLine, refresh]);

  const handleUpdateLine = useCallback(async (lineId: number, field: string, value: unknown) => {
    await updateLine(lineId, { [field]: value });
  }, [updateLine]);

  const handleAddSupplierConfirm = useCallback(async (supplierId: string) => {
    if (addSupplierDialog) {
      await addSupplier(addSupplierDialog.lineId, Number(supplierId));
      setAddSupplierDialog(null);
      await refresh();
    }
  }, [addSupplierDialog, addSupplier, refresh]);

  const handleAddChildLine = useCallback(async (parentLineId: number) => {
    const success = await addChildLine(parentLineId, "New PO Line");
    if (success) await refresh();
  }, [addChildLine, refresh]);

  const handleSendRfq = useCallback(async (supplierId: number) => {
    toast.info("RFQ sending will open the Send RFQ dialog (coming in Phase 3)");
  }, []);

  const handleRecordResponse = useCallback((supplierId: number) => {
    setRecordResponseDialog({ supplierId });
    setResponsePrice("");
    setResponseQuoteNumber("");
  }, []);

  const handleRecordResponseConfirm = useCallback(async () => {
    if (recordResponseDialog && responsePrice) {
      await recordResponse(recordResponseDialog.supplierId, {
        price_quoted: parseFloat(responsePrice),
        quote_number: responseQuoteNumber || undefined,
      });
      setRecordResponseDialog(null);
      await refresh();
    }
  }, [recordResponseDialog, responsePrice, responseQuoteNumber, recordResponse, refresh]);

  const handleAccept = useCallback(async (supplierId: number) => {
    const ok = await acceptQuote(supplierId);
    if (ok) await refresh();
  }, [acceptQuote, refresh]);

  const handleReject = useCallback(async (supplierId: number) => {
    const ok = await rejectQuote(supplierId);
    if (ok) await refresh();
  }, [rejectQuote, refresh]);

  const handleCreateAllocations = useCallback(async (
    supplierId: number,
    allocations: Array<{ lineId: number; amount: number }>
  ) => {
    for (const alloc of allocations) {
      await createAllocation(supplierId, alloc.lineId, alloc.amount);
    }
    await refresh();
  }, [createAllocation, refresh]);

  const handleSaveTemplate = useCallback(async (name: string) => {
    if (activeQuote) {
      await saveAsTemplate(activeQuote.id, name);
    }
  }, [activeQuote, saveAsTemplate]);

  if (loading && !activeQuote) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-4">
      {/* Setup bar: template picker, existing quotes, save */}
      <CustomQuoteSetup
        jobId={jobId}
        quotes={quotes}
        onApplyTemplate={handleApplyTemplate}
        onCreateBlank={handleCreateBlank}
        onPopulateFromSchedule={handlePopulateFromSchedule}
        onSelectQuote={handleSelectQuote}
        onSaveAsTemplate={() => setSaveTemplateOpen(true)}
        hasActiveQuote={!!activeQuote}
      />

      {/* Tree view */}
      {activeQuote ? (
        <CustomQuoteTree
          quote={activeQuote}
          onUpdateLine={handleUpdateLine}
          onToggleQuoteLevel={handleToggleQuoteLevel}
          onAddSupplier={(lineId) => setAddSupplierDialog({ lineId })}
          onAddChildLine={handleAddChildLine}
          onSendRfq={handleSendRfq}
          onRecordResponse={handleRecordResponse}
          onAccept={handleAccept}
          onReject={handleReject}
          onCreateAllocations={handleCreateAllocations}
          onFetchAllocations={fetchAllocations}
        />
      ) : (
        <div className="flex items-center justify-center h-48 text-muted-foreground">
          Select an existing quote or apply a template to get started.
        </div>
      )}

      {/* Save as Template Dialog */}
      <SaveAsTemplateDialog
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        onSave={handleSaveTemplate}
        defaultName={activeQuote?.name ? `Template - ${activeQuote.name}` : ""}
      />

      {/* Add Supplier Dialog */}
      <Dialog open={!!addSupplierDialog} onOpenChange={(o) => !o && setAddSupplierDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Supplier</DialogTitle>
          </DialogHeader>
          <ComboboxDropdown
            items={supplierItems}
            onSelect={(item) => handleAddSupplierConfirm(item.id)}
            placeholder="Search suppliers..."
            onInputChange={(search: string) => {
              setSupplierSearch(search);
              searchSuppliers(search);
            }}
            disableInternalFilter
          />
        </DialogContent>
      </Dialog>

      {/* Record Response Dialog */}
      <Dialog open={!!recordResponseDialog} onOpenChange={(o) => !o && setRecordResponseDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Supplier Response</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Price Quoted</Label>
              <div className="relative mt-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={responsePrice}
                  onChange={(e) => setResponsePrice(e.target.value)}
                  className="pl-6"
                  placeholder="0.00"
                  step="0.01"
                  autoFocus
                />
              </div>
            </div>
            <div>
              <Label>Quote Number (optional)</Label>
              <Input
                value={responseQuoteNumber}
                onChange={(e) => setResponseQuoteNumber(e.target.value)}
                className="mt-1"
                placeholder="Q-001"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordResponseDialog(null)}>Cancel</Button>
            <Button onClick={handleRecordResponseConfirm} disabled={!responsePrice}>
              Record Response
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default JobCustomQuotesTab;
