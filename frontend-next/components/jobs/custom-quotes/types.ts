// Types for Custom Quotes system (CC → PO cascading tree)
// Matches backend JSON from custom_quotes_controller (camelCase)

export interface CustomQuoteTemplate {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  position: number;
  poTemplatePackId: number | null;
  lineCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomQuoteSupplierSummary {
  id: number;
  supplierId: number;
  supplierName: string | null;
  contactPersonId: number | null;
  contactEmail: string | null;
  status: SupplierStatus;
  priceQuoted: number | null;
  quoteNumber: string | null;
  dateSent: string | null;
  dateReceived: string | null;
  validTo: string | null;
  timeframe: string | null;
  isBestPrice: boolean;
  purchaseOrderId: number | null;
  warehouseDocumentId: number | null;
}

export interface CustomQuoteLineNode {
  id: number;
  name: string;
  quoteLevel: QuoteLevel;
  costCentreId: number | null;
  smScheduleMasterId: number | null;
  smTaskId: number | null;
  tenderDescription: string | null;
  poDescription: string | null;
  rfqInstructions: string | null;
  budgetAmount: number | null;
  position: number;
  suppliers: CustomQuoteSupplierSummary[];
  children: CustomQuoteLineNode[];
}

export interface CustomQuoteData {
  id: number;
  jobId: number;
  name: string;
  status: QuoteStatus;
  templateName: string | null;
  totalQuoted: number;
  totalAllocated: number;
  variance: number;
  createdBy: string | null;
  tree: CustomQuoteLineNode[];
}

export interface CustomQuoteSummary {
  id: number;
  name: string;
  status: QuoteStatus;
  templateName: string | null;
  totalQuoted: number;
  totalAllocated: number;
  variance: number;
  lineCount: number;
  createdBy: string | null;
  createdAt: string;
}

export interface AllocationData {
  id: number;
  lineId: number;
  lineName: string;
  allocatedAmount: number;
  notes: string | null;
  purchaseOrderId: number | null;
}

export type QuoteLevel = "cost_centre" | "po" | "not_required";
export type QuoteStatus = "draft" | "in_progress" | "completed";
export type SupplierStatus = "draft" | "sent" | "responded" | "accepted" | "rejected";

export const STATUS_COLORS: Record<SupplierStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  responded: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-300",
};

export const STATUS_LABELS: Record<SupplierStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  responded: "Responded",
  accepted: "Accepted",
  rejected: "Rejected",
};

export const QUOTE_LEVEL_LABELS: Record<QuoteLevel, string> = {
  cost_centre: "CC Level",
  po: "PO Level",
  not_required: "Not Required",
};
