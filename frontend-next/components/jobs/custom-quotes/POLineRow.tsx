"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupplierQuoteCell } from "./SupplierQuoteCell";
import { TwoDescriptionEditor } from "./TwoDescriptionEditor";
import type { CustomQuoteLineNode, QuoteLevel } from "./types";
import type { DocumentTypeOption } from "./useCustomQuote";

interface POLineRowProps {
  line: CustomQuoteLineNode;
  documentTypes: DocumentTypeOption[];
  onUpdateLine: (lineId: number, field: string, value: string) => void;
  onToggleQuoteLevel: (lineId: number, level: QuoteLevel) => void;
  onAddSupplier: (lineId: number) => void;
  onSendRfq: (supplierId: number) => void;
  onRecordResponse: (supplierId: number) => void;
  onAccept: (supplierId: number) => void;
  onReject: (supplierId: number) => void;
}

export function POLineRow({
  line,
  documentTypes,
  onUpdateLine,
  onToggleQuoteLevel,
  onAddSupplier,
  onSendRfq,
  onRecordResponse,
  onAccept,
  onReject,
}: POLineRowProps) {
  const isNotRequired = line.quoteLevel === "not_required";
  const allocated = line.suppliers
    .filter((s) => s.status === "accepted")
    .reduce((sum, s) => sum + (s.priceQuoted || 0), 0);

  return (
    <div className={`ml-6 py-2 border-l-2 border-muted pl-4 ${isNotRequired ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium ${isNotRequired ? "line-through text-muted-foreground" : ""}`}>{line.name}</span>

        <Button
          size="sm"
          variant={isNotRequired ? "destructive" : "outline"}
          className="h-5 px-2 text-[10px]"
          onClick={() => onToggleQuoteLevel(line.id, isNotRequired ? "po" : "not_required")}
        >
          {isNotRequired ? "Not Required" : "N/R"}
        </Button>

        {!isNotRequired && (
          <select
            value={line.documentTypeId || ""}
            onChange={(e) => onUpdateLine(line.id, "document_type_id", e.target.value)}
            className="h-5 px-1 text-[10px] border rounded bg-background text-foreground"
          >
            <option value="">Doc Type...</option>
            {documentTypes.map((dt) => (
              <option key={dt.id} value={String(dt.id)}>{dt.name}</option>
            ))}
          </select>
        )}

        {!isNotRequired && line.budgetAmount != null && (
          <span className="text-xs text-muted-foreground">
            Budget: ${line.budgetAmount.toLocaleString()}
          </span>
        )}

        {!isNotRequired && allocated > 0 && (
          <span className="text-xs text-green-600 dark:text-green-400">
            Allocated: ${allocated.toLocaleString()}
          </span>
        )}

        {!isNotRequired && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs ml-auto"
            onClick={() => onAddSupplier(line.id)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Supplier
          </Button>
        )}
      </div>

      {/* Supplier cards + descriptions hidden when not required */}
      {!isNotRequired && line.suppliers.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {line.suppliers.map((supplier) => (
            <SupplierQuoteCell
              key={supplier.id}
              supplier={supplier}
              onSendRfq={onSendRfq}
              onRecordResponse={onRecordResponse}
              onAccept={onAccept}
              onReject={onReject}
            />
          ))}
        </div>
      )}

      {!isNotRequired && (
        <TwoDescriptionEditor
          tenderDescription={line.tenderDescription}
          poDescription={line.poDescription}
          rfqInstructions={line.rfqInstructions}
          onUpdate={(field, value) => onUpdateLine(line.id, field, value)}
        />
      )}
    </div>
  );
}
