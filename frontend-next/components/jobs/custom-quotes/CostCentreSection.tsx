"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { SupplierQuoteCell } from "./SupplierQuoteCell";
import { POLineRow } from "./POLineRow";
import { TwoDescriptionEditor } from "./TwoDescriptionEditor";
import { DocumentTypeTreePicker } from "./DocumentTypeTreePicker";
import type { CustomQuoteLineNode, QuoteLevel } from "./types";

interface CostCentreSectionProps {
  line: CustomQuoteLineNode;
  onToggleQuoteLevel: (lineId: number, level: QuoteLevel) => void;
  onUpdateLine: (lineId: number, field: string, value: unknown) => void;
  onAddSupplier: (lineId: number) => void;
  onAddChildLine: (parentLineId: number) => void;
  onSendRfq: (supplierId: number) => void;
  onRecordResponse: (supplierId: number) => void;
  onAccept: (supplierId: number) => void;
  onReject: (supplierId: number) => void;
  onAllocate: (supplierId: number) => void;
}

export function CostCentreSection({
  line,
  onToggleQuoteLevel,
  onUpdateLine,
  onAddSupplier,
  onAddChildLine,
  onSendRfq,
  onRecordResponse,
  onAccept,
  onReject,
  onAllocate,
}: CostCentreSectionProps) {
  const [expanded, setExpanded] = useState(false);

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

  const isCCLevel = line.quoteLevel === "cost_centre";
  const isNotRequired = line.quoteLevel === "not_required";

  return (
    <div className={`border rounded-lg mb-3 ${isNotRequired ? "bg-muted/30 opacity-60" : "bg-card"}`}>
      {/* CC Header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50" onClick={() => setExpanded(!expanded)}>
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

        {line.budgetAmount != null && (
          <span className="text-xs text-muted-foreground">
            Budget: ${line.budgetAmount.toLocaleString()}
          </span>
        )}

        {!isNotRequired && line.documentTypeNames.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {line.documentTypeNames.length} doc type{line.documentTypeNames.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Expanded content (hidden when not required) */}
      {expanded && !isNotRequired && (
        <div className="px-4 pb-3">
          {/* Document type selector */}
          <div className="mb-3">
            <DocumentTypeTreePicker
              selectedIds={line.documentTypeIds}
              onChange={(ids) => onUpdateLine(line.id, "document_type_ids", ids)}
            />
          </div>

          {/* CC-level: suppliers on the CC line itself */}
          {isCCLevel && (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-muted-foreground">CC-Level Suppliers</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => onAddSupplier(line.id)}
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
                    onSendRfq={onSendRfq}
                    onRecordResponse={onRecordResponse}
                    onAccept={(id) => {
                      // For CC-level, accepted supplier needs allocation
                      onAllocate(id);
                    }}
                    onReject={onReject}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Descriptions only for CC-level quoting */}
          {isCCLevel && (
            <TwoDescriptionEditor
              tenderDescription={line.tenderDescription}
              poDescription={line.poDescription}
              rfqInstructions={line.rfqInstructions}
              onUpdate={(field, value) => onUpdateLine(line.id, field, value)}
            />
          )}

          {/* PO Children */}
          <div className="mt-2">
            {line.children.map((child) => (
              <POLineRow
                key={child.id}
                line={child}
                onUpdateLine={onUpdateLine}
                onToggleQuoteLevel={onToggleQuoteLevel}
                onAddSupplier={onAddSupplier}
                onSendRfq={onSendRfq}
                onRecordResponse={onRecordResponse}
                onAccept={onAccept}
                onReject={onReject}
              />
            ))}

            <Button
              size="sm"
              variant="ghost"
              className="text-xs ml-6 mt-1"
              onClick={() => onAddChildLine(line.id)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add PO Line
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
