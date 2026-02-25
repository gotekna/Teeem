"use client";

import { useState, useCallback } from "react";
import { CostCentreSection } from "./CostCentreSection";
import { AllocationDialog } from "./AllocationDialog";
import { CustomQuoteSummaryBar } from "./CustomQuoteSummaryBar";
import type { CustomQuoteData, CustomQuoteLineNode, QuoteLevel, AllocationData } from "./types";
import type { DocumentTypeOption } from "./useCustomQuote";

interface CustomQuoteTreeProps {
  quote: CustomQuoteData;
  documentTypes: DocumentTypeOption[];
  onUpdateLine: (lineId: number, field: string, value: string) => void;
  onToggleQuoteLevel: (lineId: number, level: QuoteLevel) => void;
  onAddSupplier: (lineId: number) => void;
  onAddChildLine: (parentLineId: number) => void;
  onSendRfq: (supplierId: number) => void;
  onRecordResponse: (supplierId: number) => void;
  onAccept: (supplierId: number) => void;
  onReject: (supplierId: number) => void;
  onCreateAllocations: (supplierId: number, allocations: Array<{ lineId: number; amount: number }>) => void;
  onFetchAllocations: (supplierId: number) => Promise<AllocationData[]>;
}

export function CustomQuoteTree({
  quote,
  documentTypes,
  onUpdateLine,
  onToggleQuoteLevel,
  onAddSupplier,
  onAddChildLine,
  onSendRfq,
  onRecordResponse,
  onAccept,
  onReject,
  onCreateAllocations,
  onFetchAllocations,
}: CustomQuoteTreeProps) {
  const [allocationDialog, setAllocationDialog] = useState<{
    supplierId: number;
    supplierName: string;
    quotedAmount: number;
    poLines: CustomQuoteLineNode[];
    existingAllocations: AllocationData[];
  } | null>(null);

  const handleAllocate = useCallback(async (supplierId: number) => {
    // Find the supplier and its parent CC line
    for (const ccLine of quote.tree) {
      const supplier = ccLine.suppliers.find((s) => s.id === supplierId);
      if (supplier && supplier.priceQuoted != null) {
        const existingAllocations = await onFetchAllocations(supplierId);
        setAllocationDialog({
          supplierId,
          supplierName: supplier.supplierName || "Unknown",
          quotedAmount: supplier.priceQuoted,
          poLines: ccLine.children,
          existingAllocations,
        });
        return;
      }
    }
  }, [quote.tree, onFetchAllocations]);

  const handleSaveAllocations = useCallback((allocations: Array<{ lineId: number; amount: number }>) => {
    if (allocationDialog) {
      onCreateAllocations(allocationDialog.supplierId, allocations);
      setAllocationDialog(null);
    }
  }, [allocationDialog, onCreateAllocations]);

  if (quote.tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No cost centres yet. Apply a template or add lines manually.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <CustomQuoteSummaryBar quote={quote} />

      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {quote.tree.map((ccLine) => (
          <CostCentreSection
            key={ccLine.id}
            line={ccLine}
            documentTypes={documentTypes}
            onToggleQuoteLevel={onToggleQuoteLevel}
            onUpdateLine={onUpdateLine}
            onAddSupplier={onAddSupplier}
            onAddChildLine={onAddChildLine}
            onSendRfq={onSendRfq}
            onRecordResponse={onRecordResponse}
            onAccept={onAccept}
            onReject={onReject}
            onAllocate={handleAllocate}
          />
        ))}
      </div>

      {allocationDialog && (
        <AllocationDialog
          open={true}
          onClose={() => setAllocationDialog(null)}
          supplierName={allocationDialog.supplierName}
          quotedAmount={allocationDialog.quotedAmount}
          poLines={allocationDialog.poLines}
          existingAllocations={allocationDialog.existingAllocations}
          onSave={handleSaveAllocations}
        />
      )}
    </div>
  );
}
