"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { SupplierQuoteCell } from "./SupplierQuoteCell";
import { POLineRow } from "./POLineRow";
import { TwoDescriptionEditor } from "./TwoDescriptionEditor";
import { DocumentTypeTreePicker } from "./DocumentTypeTreePicker";
import { DefaultSuppliersList } from "./DefaultSuppliersList";
import type { CustomQuoteLineNode, QuoteLevel } from "./types";

interface CostCentreSectionProps {
  jobId?: string | number;
  line: CustomQuoteLineNode;
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleQuoteLevel: (lineId: number, level: QuoteLevel) => void;
  onUpdateLine: (lineId: number, field: string, value: unknown) => void;
  // Supplier/job-specific props — optional for template mode
  onAddSupplier?: (lineId: number) => void;
  onAddChildLine?: (parentLineId: number) => void;
  onSendRfq?: (supplierId: number) => void;
  onMarkSent?: (supplierId: number) => void;
  onRecordResponse?: (supplierId: number) => void;
  onAccept?: (supplierId: number) => void;
  onReject?: (supplierId: number) => void;
  onAllocate?: (supplierId: number) => void;
  onDropFile?: (supplierId: number, file: File) => void;
}

export function CostCentreSection({
  jobId,
  line,
  expanded,
  onToggleExpanded,
  onToggleQuoteLevel,
  onUpdateLine,
  onAddSupplier,
  onAddChildLine,
  onSendRfq,
  onMarkSent,
  onRecordResponse,
  onAccept,
  onReject,
  onAllocate,
  onDropFile,
}: CostCentreSectionProps) {

  // Whether supplier workflow UI is available (job mode vs template mode)
  const hasSupplierUI = !!(onAddSupplier && onSendRfq);

  // Total from accepted suppliers or PO children
  const ccTotal = line.quoteLevel === "cost_centre"
    ? line.suppliers
        .filter((s) => s.status === "accepted" || s.status === "responded")
        .reduce((sum, s) => sum + (s.priceQuoted || 0), 0)
    : line.children.reduce((sum, child) => {
        const best = child.suppliers
          .filter((s) => s.status === "accepted" || s.status === "responded")
          .reduce((min, s) => {
            if (s.priceQuoted == null) return min;
            return min == null ? s.priceQuoted : Math.min(min, s.priceQuoted);
          }, null as number | null);
        return sum + (best || 0);
      }, 0);

  // Track live doc type names from the picker (avoids stale line.documentTypeNames)
  const [liveDocTypeNames, setLiveDocTypeNames] = useState<string[]>(line.documentTypeNames);
  const handleDocTypeNamesChange = useCallback((names: string[]) => {
    setLiveDocTypeNames(names);
  }, []);

  const isCCLevel = line.quoteLevel === "cost_centre";
  const isNotRequired = line.quoteLevel === "not_required";

  return (
    <div className={`border rounded-lg mb-3 ${isNotRequired ? "bg-muted/30 opacity-60" : "bg-card"}`}>
      {/* CC Header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50" onClick={onToggleExpanded}>
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}

        <span className={`font-semibold ${isNotRequired ? "line-through text-muted-foreground" : ""}`}>{line.name}</span>

        {/* Quote level toggle */}
        <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant={isCCLevel ? "default" : "outline"}
            className="h-6 px-2 text-xs"
            onClick={(e) => { e.stopPropagation(); onToggleQuoteLevel(line.id, "cost_centre"); }}
          >
            CC Level
          </Button>
          <Button
            size="sm"
            variant={!isCCLevel && !isNotRequired ? "default" : "outline"}
            className="h-6 px-2 text-xs"
            onClick={(e) => { e.stopPropagation(); onToggleQuoteLevel(line.id, "po"); }}
          >
            PO Level
          </Button>
          <Button
            size="sm"
            variant={isNotRequired ? "destructive" : "outline"}
            className="h-6 px-2 text-xs"
            onClick={(e) => { e.stopPropagation(); onToggleQuoteLevel(line.id, "not_required"); }}
          >
            Not Required
          </Button>
        </div>

        {ccTotal > 0 && (
          <span className="text-sm font-mono text-green-600 dark:text-green-400 ml-auto mr-2">
            ${ccTotal.toLocaleString()}
          </span>
        )}

        <div onClick={(e) => e.stopPropagation()}>
          <InlineBudget
            value={line.budgetAmount}
            onSave={(val) => onUpdateLine(line.id, "budget_amount", val)}
          />
        </div>

        {!isNotRequired && line.documentTypeNames.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {line.documentTypeNames.length} doc type{line.documentTypeNames.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Expanded content (hidden when not required) */}
      {expanded && !isNotRequired && (
        <div className="px-4 pb-3">
          {/* Document type selector — always shown */}
          <div className="mb-3">
            <DocumentTypeTreePicker
              selectedIds={line.documentTypeIds}
              onChange={(ids) => onUpdateLine(line.id, "document_type_ids", ids)}
              onSelectedNamesChange={handleDocTypeNamesChange}
            />
          </div>

          {/* Default suppliers — template mode (no supplier workflow) */}
          {!hasSupplierUI && line.defaultSupplierIds !== undefined && (
            <div className="mb-3">
              <DefaultSuppliersList
                supplierIds={line.defaultSupplierIds}
                onUpdate={(ids) => onUpdateLine(line.id, "default_supplier_ids", ids)}
              />
            </div>
          )}

          {/* CC-level: suppliers on the CC line itself — job mode only */}
          {hasSupplierUI && isCCLevel && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground">CC-Level Suppliers</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => onAddSupplier!(line.id)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Supplier
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {line.suppliers.map((supplier) => (
                  <SupplierQuoteCell
                    key={supplier.id}
                    supplier={supplier}
                    onSendRfq={onSendRfq!}
                    onMarkSent={onMarkSent!}
                    onRecordResponse={onRecordResponse!}
                    onAccept={(id) => {
                      // For CC-level, accepted supplier needs allocation
                      onAllocate?.(id);
                    }}
                    onReject={onReject!}
                    onDropFile={onDropFile}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Descriptions — always shown when expanded */}
          <TwoDescriptionEditor
            tenderDescription={line.tenderDescription}
            poDescription={line.poDescription}
            rfqInstructions={line.rfqInstructions}
            onUpdate={(field, value) => onUpdateLine(line.id, field, value)}
            jobId={jobId}
            documentTypeIds={line.documentTypeIds}
            documentTypeNames={liveDocTypeNames}
            poLineNames={line.children.filter((c) => c.quoteLevel !== "not_required").map((c) => c.name)}
          />

          {/* PO Children */}
          <div className="mt-2">
            {line.children.map((child) => (
              <POLineRow
                key={child.id}
                jobId={jobId}
                line={child}
                onUpdateLine={onUpdateLine}
                onToggleQuoteLevel={onToggleQuoteLevel}
                onAddSupplier={onAddSupplier}
                onSendRfq={onSendRfq}
                onMarkSent={onMarkSent}
                onRecordResponse={onRecordResponse}
                onAccept={onAccept}
                onReject={onReject}
                onDropFile={onDropFile}
              />
            ))}

            {onAddChildLine && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs ml-6 mt-1"
                onClick={() => onAddChildLine(line.id)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add PO Line
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Inline editable budget — click to edit, blur/enter to save */
function InlineBudget({ value, onSave }: {
  value: number | null | undefined;
  onSave: (val: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft(value ? String(value) : "");
    setEditing(true);
  };

  const save = () => {
    setEditing(false);
    const num = parseFloat(draft);
    const newVal = isNaN(num) ? null : num;
    if (newVal !== (value ?? null)) onSave(newVal);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-muted-foreground">$</span>
        <input
          type="number"
          className="w-24 h-6 text-xs text-right border rounded px-1 bg-background"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          autoFocus
        />
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className="shrink-0 text-xs font-mono tabular-nums px-2 py-0.5 rounded hover:bg-muted text-right"
      title="Click to set budget/PC price"
    >
      {value ? `Budget: $${value.toLocaleString("en-AU", { minimumFractionDigits: 2 })}` : (
        <span className="text-muted-foreground italic">Set price</span>
      )}
    </button>
  );
}
