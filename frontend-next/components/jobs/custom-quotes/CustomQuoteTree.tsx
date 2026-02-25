"use client";

import { useState, useCallback, useMemo } from "react";
import { ChevronsDownUp, ChevronsUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CostCentreSection } from "./CostCentreSection";
import { AllocationDialog } from "./AllocationDialog";
import { CustomQuoteSummaryBar } from "./CustomQuoteSummaryBar";
import type { CustomQuoteData, CustomQuoteLineNode, QuoteLevel, AllocationData } from "./types";

interface CustomQuoteTreeProps {
  quote: CustomQuoteData;
  onUpdateLine: (lineId: number, field: string, value: unknown) => void;
  onToggleQuoteLevel: (lineId: number, level: QuoteLevel) => void;
  onAddSupplier: (lineId: number) => void;
  onAddChildLine: (parentLineId: number) => void;
  onSendRfq: (supplierId: number) => void;
  onMarkSent: (supplierId: number) => void;
  onRecordResponse: (supplierId: number) => void;
  onAccept: (supplierId: number) => void;
  onReject: (supplierId: number) => void;
  onCreateAllocations: (supplierId: number, allocations: Array<{ lineId: number; amount: number }>) => void;
  onFetchAllocations: (supplierId: number) => Promise<AllocationData[]>;
}

export function CustomQuoteTree({
  quote,
  onUpdateLine,
  onToggleQuoteLevel,
  onAddSupplier,
  onAddChildLine,
  onSendRfq,
  onMarkSent,
  onRecordResponse,
  onAccept,
  onReject,
  onCreateAllocations,
  onFetchAllocations,
}: CustomQuoteTreeProps) {
  // Expand/collapse all CC sections
  const [expandedCCs, setExpandedCCs] = useState<Set<number>>(new Set());
  const [ccSearch, setCcSearch] = useState("");

  const anyExpanded = expandedCCs.size > 0;

  const expandAllCCs = useCallback(() => {
    setExpandedCCs(new Set(quote.tree.map((cc) => cc.id)));
  }, [quote.tree]);

  const collapseAllCCs = useCallback(() => {
    setExpandedCCs(new Set());
  }, []);

  const toggleCCExpanded = useCallback((ccId: number) => {
    setExpandedCCs((prev) => {
      const next = new Set(prev);
      if (next.has(ccId)) next.delete(ccId);
      else next.add(ccId);
      return next;
    });
  }, []);

  // Filter CC lines by search
  const filteredTree = useMemo(() => {
    if (!ccSearch.trim()) return quote.tree;
    const q = ccSearch.toLowerCase();
    return quote.tree.filter((cc) =>
      cc.name.toLowerCase().includes(q) ||
      cc.children.some((child) => child.name.toLowerCase().includes(q))
    );
  }, [quote.tree, ccSearch]);

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
      {/* Expand/collapse + search bar + summary */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b">
        <button
          type="button"
          onClick={anyExpanded ? collapseAllCCs : expandAllCCs}
          className="shrink-0 px-2 py-0.5 text-[10px] rounded text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          {anyExpanded ? (
            <>
              <ChevronsDownUp className="h-3 w-3 inline mr-0.5" />
              Collapse
            </>
          ) : (
            <>
              <ChevronsUpDown className="h-3 w-3 inline mr-0.5" />
              Expand
            </>
          )}
        </button>
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            value={ccSearch}
            onChange={(e) => setCcSearch(e.target.value)}
            placeholder="Search cost centres..."
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      <CustomQuoteSummaryBar quote={quote} />

      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {filteredTree.map((ccLine) => (
          <CostCentreSection
            key={ccLine.id}
            line={ccLine}
            expanded={expandedCCs.has(ccLine.id)}
            onToggleExpanded={() => toggleCCExpanded(ccLine.id)}
            onToggleQuoteLevel={onToggleQuoteLevel}
            onUpdateLine={onUpdateLine}
            onAddSupplier={onAddSupplier}
            onAddChildLine={onAddChildLine}
            onSendRfq={onSendRfq}
            onMarkSent={onMarkSent}
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
