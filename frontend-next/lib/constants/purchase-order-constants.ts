/**
 * Purchase Order Constants (SSoT)
 *
 * Shared types, status options, and helpers used by PO detail page,
 * POSummaryView, and POInvoiceModal.
 */

// ============================================================================
// Interfaces
// ============================================================================

export interface POSupplier {
  id: number;
  display_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  supplied_pricebook_item_ids?: number[];
  bill_due_day?: number;
  bill_due_type?: string;
  payment_terms?: string;
}

export interface POPricebookItem {
  id: number;
  item_code: string;
  item_name: string;
  active_price?: number;
  current_price?: number;
  unit_of_measure?: string;
  gst_code?: string;
  default_supplier?: {
    id: number;
    display_name?: string;
    name?: string;
  };
}

export interface POLineItem {
  id?: number;
  pricebook_item_id?: number;
  pricebook_item?: POPricebookItem;
  description: string;
  quantity: number;
  unit_price: number;
  gst_code?: string;
  notes?: string;
  line_number?: number;
  _destroy?: boolean;
}

export interface POJob {
  id: number;
  title: string;
  site_supervisor_info?: {
    id: number;
    display_name: string;
  } | null;
}

export interface POSmTask {
  id: number;
  name: string;
  task_number: number;
  sequence_order: number;
  sm_schedule_master_id: number;
  start_date?: string;
}

export interface PurchaseOrder {
  id: number;
  purchase_order_number: string;
  description?: string;
  status: string;
  sub_total: number;
  tax: number;
  total: number;
  budget?: number;
  required_date?: string;
  due_date?: string;
  ordered_date?: string;
  special_instructions?: string;
  delivery_address?: string;
  supplier?: POSupplier;
  supplier_id?: number;
  job?: POJob;
  job_id?: number;
  line_items: POLineItem[];
  sm_tasks?: POSmTask[];
  is_labour_po?: boolean;
  labour_budget?: number;
  labour_actual?: number;
  budget_locked?: boolean;
  budget_locked_by_name?: string;
  budget_locked_at?: string;
}

// ============================================================================
// Status Options
// ============================================================================

export const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
  { value: "received", label: "Received" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const STATUS_BADGE_VARIANTS: Record<string, string> = {
  draft: "bg-muted text-foreground border-border",
  pending: "bg-status-warning text-status-warning-foreground border-yellow-300",
  approved: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300",
  sent: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300",
  received: "bg-status-success text-status-success-foreground border-green-300",
  invoiced: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 border-indigo-300",
  paid: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-300",
  cancelled: "bg-status-error text-status-error-foreground border-red-300",
};

// ============================================================================
// GST Codes
// ============================================================================

export const GST_CODES = [
  { value: "GST", label: "GST", rate: 0.10 },
  { value: "GST Free", label: "GST Free", rate: 0.00 },
  { value: "Input Taxed", label: "Input Taxed", rate: 0.00 },
] as const;

export function getGstRate(gstCode: string | undefined): number {
  const code = GST_CODES.find((c) => c.value === gstCode);
  return code?.rate ?? 0.10;
}
