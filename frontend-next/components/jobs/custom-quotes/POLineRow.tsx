"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupplierQuoteCell } from "./SupplierQuoteCell";
import { TwoDescriptionEditor } from "./TwoDescriptionEditor";
import type { CustomQuoteLineNode } from "./types";

interface POLineRowProps {
  line: CustomQuoteLineNode;
  onUpdateLine: (lineId: number, field: string, value: string) => void;
  onAddSupplier: (lineId: number) => void;
  onSendRfq: (supplierId: number) => void;
  onRecordResponse: (supplierId: number) => void;
  onAccept: (supplierId: number) => void;
  onReject: (supplierId: number) => void;
}

export function POLineRow({
  line,
  onUpdateLine,
  onAddSupplier,
  onSendRfq,
  onRecordResponse,
  onAccept,
  onReject,
}: POLineRowProps) {
  const allocated = line.suppliers
    .filter((s) => s.status === "accepted")
    .reduce((sum, s) => sum + (s.priceQuoted || 0), 0);

  return (
    <div className="ml-6 py-2 border-l-2 border-muted pl-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{line.name}</span>

        {line.budgetAmount != null && (
          <span className="text-xs text-muted-foreground">
            Budget: ${line.budgetAmount.toLocaleString()}
          </span>
        )}

        {allocated > 0 && (
          <span className="text-xs text-green-600 dark:text-green-400">
            Allocated: ${allocated.toLocaleString()}
          </span>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs ml-auto"
          onClick={() => onAddSupplier(line.id)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Supplier
        </Button>
      </div>

      {/* Supplier cards */}
      {line.suppliers.length > 0 && (
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

      {/* Descriptions */}
      <TwoDescriptionEditor
        tenderDescription={line.tenderDescription}
        poDescription={line.poDescription}
        rfqInstructions={line.rfqInstructions}
        onUpdate={(field, value) => onUpdateLine(line.id, field, value)}
      />
    </div>
  );
}
