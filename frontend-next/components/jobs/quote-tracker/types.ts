// Types matching backend JSON response from job_quote_controller (camelCase)

export interface QuoteTrackerRow {
  id: number;
  jobId: number;
  smScheduleMasterId: number | null;
  smTaskId: number | null;
  smTradeId: number | null;
  taskName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  contactId: number | null;
  contactName: string | null;
  contactEmail: string | null;
  status: "draft" | "sent" | "responded" | "accepted" | "rejected";
  requestedDate: string | null;
  received: boolean;
  dateReceived: string | null;
  quoteNumber: string | null;
  priceQuoted: number | null;
  validTo: string | null;
  instructions: string | null;
  estimatingNotes: string | null;
  sentAt: string | null;
  sentByName: string | null;
  isBestPrice: boolean;
  purchaseOrderId: number | null;
  purchaseOrderNumber: string | null;
  quoteTemplateId: number | null;
  responseNotes: string | null;
  timeframe: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskSummary {
  smScheduleMasterId: number | null;
  smTradeId: number | null;
  taskName: string | null;
  costCentre: number | null;
  totalSuppliers: number;
  respondedCount: number;
  sentCount: number;
  bestPrice: number | null;
  suppliers: QuoteTrackerRow[];
}

export interface QuoteSummaryData {
  jobId: number;
  jobName: string;
  totalTasks: number;
  totalEstimated: number;
  tasks: TaskSummary[];
}

export interface QuoteTemplateOption {
  id: number;
  name: string;
  tradeCount: number;
  supplierCount: number;
}

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  responded: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-300",
};

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  responded: "Responded",
  accepted: "Accepted",
  rejected: "Rejected",
};
