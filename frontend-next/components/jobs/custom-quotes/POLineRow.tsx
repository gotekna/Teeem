"use client";

import { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupplierQuoteCell } from "./SupplierQuoteCell";
import { TwoDescriptionEditor } from "./TwoDescriptionEditor";
import { DocumentTypeTreePicker } from "./DocumentTypeTreePicker";
import { DefaultSuppliersList } from "./DefaultSuppliersList";
import type { CustomQuoteLineNode, QuoteLevel } from "./types";

interface POLineRowProps {
  jobId?: string | number;
  line: CustomQuoteLineNode;
  onUpdateLine: (lineId: number, field: string, value: unknown) => void;
  onToggleQuoteLevel: (lineId: number, level: QuoteLevel) => void;
  // Supplier/job-specific props — optional for template mode
  onAddSupplier?: (lineId: number) => void;
  onSendRfq?: (supplierId: number) => void;
  onMarkSent?: (supplierId: number) => void;
  onRecordResponse?: (supplierId: number) => void;
  onAccept?: (supplierId: number) => void;
  onReject?: (supplierId: number) => void;
  onDropFile?: (supplierId: number, file: File) => void;
}

export function POLineRow({
  jobId,
  line,
  onUpdateLine,
  onToggleQuoteLevel,
  onAddSupplier,
  onSendRfq,
  onMarkSent,
  onRecordResponse,
  onAccept,
  onReject,
  onDropFile,
}: POLineRowProps) {
  // Whether supplier workflow UI is available (job mode vs template mode)
  const hasSupplierUI = !!(onAddSupplier && onSendRfq);

  const [liveDocTypeNames, setLiveDocTypeNames] = useState<string[]>(line.documentTypeNames);
  const handleDocTypeNamesChange = useCallback((names: string[]) => {
    setLiveDocTypeNames(names);
  }, []);

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

        {!isNotRequired && line.documentTypeNames.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {line.documentTypeNames.join(", ")}
          </span>
        )}

        {!isNotRequired && (
          <InlineBudget
            value={line.budgetAmount}
            onSave={(val) => onUpdateLine(line.id, "budget_amount", val)}
          />
        )}

        {!isNotRequired && allocated > 0 && (
          <span className="text-xs text-green-600 dark:text-green-400">
            Allocated: ${allocated.toLocaleString()}
          </span>
        )}

        {!isNotRequired && hasSupplierUI && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs ml-auto"
            onClick={() => onAddSupplier!(line.id)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Supplier
          </Button>
        )}
      </div>

      {/* Document type selector — always shown */}
      {!isNotRequired && (
        <div className="mt-2">
          <DocumentTypeTreePicker
            selectedIds={line.documentTypeIds}
            onChange={(ids) => onUpdateLine(line.id, "document_type_ids", ids)}
            onSelectedNamesChange={handleDocTypeNamesChange}
          />
        </div>
      )}

      {/* Default suppliers — template mode */}
      {!isNotRequired && !hasSupplierUI && line.defaultSupplierIds !== undefined && (
        <div className="mt-2">
          <DefaultSuppliersList
            supplierIds={line.defaultSupplierIds}
            onUpdate={(ids) => onUpdateLine(line.id, "default_supplier_ids", ids)}
          />
        </div>
      )}

      {/* Supplier cards — job mode only */}
      {!isNotRequired && hasSupplierUI && line.suppliers.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {line.suppliers.map((supplier) => (
            <SupplierQuoteCell
              key={supplier.id}
              supplier={supplier}
              onSendRfq={onSendRfq!}
              onMarkSent={onMarkSent!}
              onRecordResponse={onRecordResponse!}
              onAccept={onAccept!}
              onReject={onReject!}
              onDropFile={onDropFile}
            />
          ))}
        </div>
      )}

      {/* Descriptions — always shown */}
      {!isNotRequired && (
        <TwoDescriptionEditor
          tenderDescription={line.tenderDescription}
          poDescription={line.poDescription}
          rfqInstructions={line.rfqInstructions}
          onUpdate={(field, value) => onUpdateLine(line.id, field, value)}
          jobId={jobId}
          documentTypeIds={line.documentTypeIds}
          documentTypeNames={liveDocTypeNames}
        />
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
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
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
      onClick={(e) => { e.stopPropagation(); startEdit(); }}
      className="shrink-0 text-xs font-mono tabular-nums px-2 py-0.5 rounded hover:bg-muted text-right"
      title="Click to set budget/PC price"
    >
      {value ? `Budget: $${value.toLocaleString("en-AU", { minimumFractionDigits: 2 })}` : (
        <span className="text-muted-foreground italic">Set price</span>
      )}
    </button>
  );
}
