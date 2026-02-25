"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, Send, CheckSquare } from "lucide-react";
import { STATUS_COLORS, STATUS_LABELS } from "./types";
import type { CustomQuoteSupplierSummary } from "./types";

interface SupplierQuoteCellProps {
  supplier: CustomQuoteSupplierSummary;
  onSendRfq: (supplierId: number) => void;
  onMarkSent: (supplierId: number) => void;
  onRecordResponse: (supplierId: number) => void;
  onAccept: (supplierId: number) => void;
  onReject: (supplierId: number) => void;
}

export function SupplierQuoteCell({
  supplier,
  onSendRfq,
  onMarkSent,
  onRecordResponse,
  onAccept,
  onReject,
}: SupplierQuoteCellProps) {
  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded border bg-card text-sm">
      <span className="font-medium truncate max-w-[120px]" title={supplier.supplierName || ""}>
        {supplier.supplierName || "Unknown"}
      </span>

      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[supplier.status]}`}>
        {STATUS_LABELS[supplier.status]}
      </Badge>

      {supplier.priceQuoted != null && (
        <span className={`font-mono text-xs ${supplier.isBestPrice ? "text-green-600 dark:text-green-400 font-bold" : ""}`}>
          ${supplier.priceQuoted.toLocaleString()}
        </span>
      )}

      <div className="flex items-center gap-1 ml-auto">
        {supplier.status === "draft" && (
          <>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => onSendRfq(supplier.id)} title="Send RFQ email">
              <Send className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => onMarkSent(supplier.id)} title="Mark as sent (no email)">
              <CheckSquare className="h-3 w-3" />
            </Button>
          </>
        )}
        {supplier.status === "sent" && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => onRecordResponse(supplier.id)}>
            Record
          </Button>
        )}
        {supplier.status === "responded" && (
          <>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-green-600" onClick={() => onAccept(supplier.id)}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-red-600" onClick={() => onReject(supplier.id)}>
              <X className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
