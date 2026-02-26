"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { CustomQuoteSetup } from "./custom-quotes/CustomQuoteSetup";
import { CustomQuoteTree } from "./custom-quotes/CustomQuoteTree";
import { SaveAsTemplateDialog } from "./custom-quotes/SaveAsTemplateDialog";
import { SendCQRFQDialog } from "./custom-quotes/SendCQRFQDialog";
import { RecordResponseDialog } from "./custom-quotes/RecordResponseDialog";
import { useCustomQuote, useCustomQuoteTemplates } from "./custom-quotes/useCustomQuote";
import { useSupplierDocumentUpload } from "./custom-quotes/useSupplierDocumentUpload";
import type { QuoteLevel, CustomQuoteSupplierSummary, CustomQuoteLineNode } from "./custom-quotes/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SupplierPicker, type Supplier } from "@/components/ui/supplier-picker";

interface JobCustomQuotesTabProps {
  jobId: string | number;
}

/**
 * JobCustomQuotesTab - Cost-centre-level quoting with CC → PO tree
 *
 * Location: Estimating > Custom Quotes tab
 *
 * One custom quote per job. Workflow:
 * 1. Apply template, create blank, or populate from schedule
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
    markSent,
    acceptQuote,
    rejectQuote,
    saveAsTemplate,
    overwriteTemplate,
    fetchAllocations,
    createAllocation,
    refresh,
  } = useCustomQuote(jobId);

  const { templates, loading: templatesLoading, fetchTemplates } = useCustomQuoteTemplates();

  const { uploading, uploadForSupplier } = useSupplierDocumentUpload();

  // Dialog states
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [sendRfqSuppliers, setSendRfqSuppliers] = useState<CustomQuoteSupplierSummary[] | null>(null);
  const [addSupplierDialog, setAddSupplierDialog] = useState<{ lineId: number } | null>(null);
  const [recordResponseDialog, setRecordResponseDialog] = useState<{
    supplierId: number;
    supplierName: string;
    attachedDocument?: { warehouseDocumentId: number; filename: string } | null;
    parentLine?: CustomQuoteLineNode | null;
  } | null>(null);

  // Initial load
  useEffect(() => {
    fetchQuotes();
    fetchTemplates();
  }, [fetchQuotes, fetchTemplates]);

  // Auto-load the single quote for this job
  useEffect(() => {
    if (quotes.length > 0 && !activeQuote) {
      fetchQuoteTree(quotes[0].id);
    }
  }, [quotes, activeQuote, fetchQuoteTree]);

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

  const handleToggleQuoteLevel = useCallback(async (lineId: number, level: QuoteLevel) => {
    await updateLine(lineId, { quote_level: level });
    await refresh();
  }, [updateLine, refresh]);

  const handleUpdateLine = useCallback(async (lineId: number, field: string, value: unknown) => {
    await updateLine(lineId, { [field]: value });
  }, [updateLine]);

  const handleAddSupplierConfirm = useCallback(async (supplier: Supplier | null) => {
    if (addSupplierDialog && supplier) {
      await addSupplier(addSupplierDialog.lineId, supplier.id);
      setAddSupplierDialog(null);
      await refresh();
    }
  }, [addSupplierDialog, addSupplier, refresh]);

  const handleAddChildLine = useCallback(async (parentLineId: number) => {
    const success = await addChildLine(parentLineId, "New PO Line");
    if (success) await refresh();
  }, [addChildLine, refresh]);

  const handleSendRfq = useCallback((supplierId: number) => {
    if (!activeQuote) return;
    // Find the supplier in the tree
    for (const ccLine of activeQuote.tree) {
      const found = ccLine.suppliers.find((s) => s.id === supplierId);
      if (found) {
        setSendRfqSuppliers([found]);
        return;
      }
      for (const child of ccLine.children) {
        const foundChild = child.suppliers.find((s) => s.id === supplierId);
        if (foundChild) {
          setSendRfqSuppliers([foundChild]);
          return;
        }
      }
    }
  }, [activeQuote]);

  const handleMarkSent = useCallback(async (supplierId: number) => {
    const result = await markSent(supplierId);
    if (result) await refresh();
  }, [markSent, refresh]);

  // Find supplier name from tree by ID
  const findSupplierName = useCallback((supplierId: number): string => {
    if (!activeQuote) return "Supplier";
    for (const cc of activeQuote.tree) {
      const found = cc.suppliers.find((s) => s.id === supplierId);
      if (found) return found.supplierName || "Supplier";
      for (const child of cc.children) {
        const childFound = child.suppliers.find((s) => s.id === supplierId);
        if (childFound) return childFound.supplierName || "Supplier";
      }
    }
    return "Supplier";
  }, [activeQuote]);

  // Find the CC parent line that contains a supplier (for allocation context)
  const findSupplierParentLine = useCallback((supplierId: number): CustomQuoteLineNode | null => {
    if (!activeQuote) return null;
    for (const cc of activeQuote.tree) {
      // Supplier directly on CC line
      if (cc.suppliers.some((s) => s.id === supplierId)) return cc;
      // Supplier on a child PO line — parent is still the CC
      for (const child of cc.children) {
        if (child.suppliers.some((s) => s.id === supplierId)) return cc;
      }
    }
    return null;
  }, [activeQuote]);

  const handleRecordResponse = useCallback((supplierId: number) => {
    setRecordResponseDialog({
      supplierId,
      supplierName: findSupplierName(supplierId),
      parentLine: findSupplierParentLine(supplierId),
    });
  }, [findSupplierName, findSupplierParentLine]);

  const handleRecordResponseSubmit = useCallback(async (data: {
    price_quoted: number;
    quote_number?: string;
    valid_to?: string;
    response_notes?: string;
    warehouse_document_id?: number;
    allocations?: Array<{ lineId: number; amount: number }>;
  }) => {
    if (!recordResponseDialog) return;
    const { allocations: allocs, ...responseData } = data;
    await recordResponse(recordResponseDialog.supplierId, responseData);
    // Create allocations if provided (CC-level quotes)
    if (allocs && allocs.length > 0) {
      for (const alloc of allocs) {
        await createAllocation(recordResponseDialog.supplierId, alloc.lineId, alloc.amount);
      }
    }
    setRecordResponseDialog(null);
    await refresh();
  }, [recordResponseDialog, recordResponse, createAllocation, refresh]);

  // Drag-drop: upload PDF then open Record Response dialog with doc attached
  const handleDropFile = useCallback(async (supplierId: number, file: File) => {
    const result = await uploadForSupplier(supplierId, file);
    if (result) {
      toast.success(`Uploaded ${result.filename}`);
      setRecordResponseDialog({
        supplierId,
        supplierName: findSupplierName(supplierId),
        attachedDocument: result,
        parentLine: findSupplierParentLine(supplierId),
      });
    }
  }, [uploadForSupplier, findSupplierName, findSupplierParentLine]);

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
      await fetchTemplates();
    }
  }, [activeQuote, saveAsTemplate, fetchTemplates]);

  const handleOverwriteTemplate = useCallback(async () => {
    if (activeQuote) {
      const ok = await overwriteTemplate(activeQuote.id);
      if (ok) await fetchTemplates();
    }
  }, [activeQuote, overwriteTemplate, fetchTemplates]);

  if (loading && !activeQuote) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full -mx-4">
      {/* Setup bar: template picker / save options */}
      <CustomQuoteSetup
        jobId={jobId}
        templates={templates}
        templatesLoading={templatesLoading}
        onApplyTemplate={handleApplyTemplate}
        onCreateBlank={handleCreateBlank}
        onPopulateFromSchedule={handlePopulateFromSchedule}
        onSaveAsTemplate={() => setSaveTemplateOpen(true)}
        onOverwriteTemplate={handleOverwriteTemplate}
        activeTemplateName={activeQuote?.templateName ?? null}
        hasActiveQuote={!!activeQuote}
        hasLinkedTemplate={!!activeQuote?.templateId}
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
          onMarkSent={handleMarkSent}
          onRecordResponse={handleRecordResponse}
          onAccept={handleAccept}
          onReject={handleReject}
          onCreateAllocations={handleCreateAllocations}
          onFetchAllocations={fetchAllocations}
          onDropFile={handleDropFile}
          uploading={uploading}
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <p className="text-lg font-medium">No cost centres yet.</p>
          <p className="text-sm mt-1">Apply a template or add lines manually.</p>
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
          <SupplierPicker
            value={null}
            onSelect={handleAddSupplierConfirm}
            placeholder="Search suppliers..."
          />
        </DialogContent>
      </Dialog>

      {/* Send RFQ Dialog */}
      {sendRfqSuppliers && (
        <SendCQRFQDialog
          open={true}
          onOpenChange={(o) => !o && setSendRfqSuppliers(null)}
          suppliers={sendRfqSuppliers}
          jobId={jobId}
          onSent={async () => {
            setSendRfqSuppliers(null);
            await refresh();
          }}
        />
      )}

      {/* Record Response Sheet */}
      <RecordResponseDialog
        open={!!recordResponseDialog}
        onClose={() => setRecordResponseDialog(null)}
        supplierName={recordResponseDialog?.supplierName || ""}
        supplierId={recordResponseDialog?.supplierId || 0}
        attachedDocument={recordResponseDialog?.attachedDocument}
        parentLine={recordResponseDialog?.parentLine}
        onSubmit={handleRecordResponseSubmit}
      />
    </div>
  );
}

export default JobCustomQuotesTab;
