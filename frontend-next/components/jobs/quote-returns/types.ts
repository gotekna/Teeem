// Types for Quote Returns tab - unified view of supplier quote responses
// Combines data from QuoteTracker and CustomQuoteSupplier systems

export interface QuoteReturn {
  id: string; // Composite: "qt_123" or "cqs_456"
  source: "quote_tracker" | "custom_quote";
  sourceId: number;
  supplierName: string | null;
  supplierId: number | null;
  itemName: string | null;
  parentName: string | null; // Cost Centre or Trade grouping
  priceQuoted: number | null;
  dateReceived: string | null;
  quoteNumber: string | null;
  validTo: string | null;
  status: QuoteReturnStatus;
  isBestPrice: boolean;
  responseNotes: string | null;
  warehouseDocumentId: number | null;
  tenderDescription: string | null;
  purchaseOrderId: number | null;
  purchaseOrderNumber: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
}

export type QuoteReturnStatus = "responded" | "accepted" | "rejected";

export interface QuoteReturnsSummary {
  totalReturns: number;
  acceptedCount: number;
  rejectedCount: number;
  respondedCount: number;
  totalAcceptedValue: number;
}

export interface QuoteReturnsData {
  jobId: number;
  returns: QuoteReturn[];
  summary: QuoteReturnsSummary;
}

export interface ConfirmDetailsRequested {
  description: string | null;
  budget: number | null;
  taskName: string | null;
  documentTypeNames?: string[];
  rfqInstructions: string | null;
}

export interface ConfirmDetailsQuoted {
  supplierName: string | null;
  price: number | null;
  quoteNumber: string | null;
  validTo: string | null;
  responseNotes: string | null;
  timeframe: string | null;
  documentUrl: string | null;
}

export interface ConfirmDetails {
  requested: ConfirmDetailsRequested;
  quoted: ConfirmDetailsQuoted;
}

export const STATUS_COLORS: Record<QuoteReturnStatus, string> = {
  responded: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-300",
};

export const STATUS_LABELS: Record<QuoteReturnStatus, string> = {
  responded: "Responded",
  accepted: "Accepted",
  rejected: "Rejected",
};
