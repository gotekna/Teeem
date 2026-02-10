"use client";

import React, { useEffect, useState, useMemo } from "react";
import { PdfFrame } from "@/components/ui/pdf-chrome";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building2,
  DollarSign,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Link2,
  Receipt,
  ExternalLink,
  ImageIcon,
  X,
  ScanText,
  Wallet,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { PDFViewer, FieldHighlight } from "@/components/ui/pdf-viewer";
import { CheckCircle2, XCircle as XCircle2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface FieldLocation {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

interface AIExtractionResult {
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  supplier_name?: string;
  supplier_abn?: string;
  billing_company_name?: string;
  billing_company_abn?: string;
  line_items?: Array<{
    description?: string;
    quantity?: number;
    unit_price?: number;
    amount?: number;
  }>;
  payment_terms?: string;
  purchase_order_number?: string;
  notes?: string;
  field_locations?: Record<string, FieldLocation>;
  payment_reference?: string;
  balance_due?: number;
  trust_deduction?: number;
  supplier_bank_bsb?: string;
  supplier_bank_account?: string;
  case_reference?: string;
  matter_description?: string;
  [key: string]: unknown;
}

interface FieldComparison {
  ai_value: string | number;
  ocr_match: string | null;
  coordinates: FieldLocation | null;
  match_confidence: number;
  exact_match: boolean;
  ocr_words: string[];
}

interface ComparisonData {
  fields: Record<string, FieldComparison>;
  overall_match_rate: number;
  timestamp: string;
}

export interface BillDetail {
  id: number;
  invoice_number: string;
  supplier_name_raw: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  due_date: string;
  invoice_date: string;
  status: string;
  match_status: string;
  variance_amount: number | null;
  variance_percent: number | null;
  ai_confidence: number | null;
  source: string;
  email_subject: string | null;
  email_from: string | null;
  email_received_at: string | null;
  notes: string | null;
  rejection_reason: string | null;
  approved_at: string | null;
  remaining_balance: number;
  status_color: string;
  extracted_at: string | null;
  ai_extraction_result: AIExtractionResult | null;
  ocr_extraction_result: unknown;
  comparison_data: ComparisonData | null;
  xero_tenant_name: string | null;
  corporate: {
    id: number;
    name: string;
    code: string;
    abn: string;
  } | null;
  detected_company: {
    id: number;
    name: string;
    code: string;
    abn: string;
  } | null;
  supplier: {
    id: number;
    display_name: string;
    abn: string;
    bank_bsb: string;
    bank_account_number: string;
    has_trust_account?: boolean;
    trust_bsb?: string;
    trust_account_number?: string;
    trust_account_name?: string;
    payment_terms?: string;
  } | null;
  matched_purchase_order: {
    id: number;
    purchase_order_number: string;
    total: number;
    status: string;
    payment_terms?: string;
    supplier: {
      id: number;
      display_name: string;
    };
  } | null;
  approved_by: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  bill_payments: Array<{
    id: number;
    amount: number;
    status: string;
    payee_name: string;
    bill_payment_batch: {
      id: number;
      batch_reference: string;
      status: string;
    } | null;
  }>;
  "has_invoice_file?": boolean;
  invoice_file_content_type: string | null;
  invoice_file_filename: string | null;
  contact_comparison_data: {
    fields: Record<string, {
      extracted: string | null;
      stored: string | null;
      display_name: string;
      status: "match" | "different" | "add";
    }>;
    has_updates: boolean;
    compared_at: string;
  } | null;
}

// ============================================================================
// Constants
// ============================================================================

const statusColors: Record<string, string> = {
  pending: "bg-muted text-foreground dark:bg-muted/50 dark:text-muted-foreground",
  extracting: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 dark:bg-blue-400/10 dark:text-blue-400",
  extracted: "bg-cyan-100 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-400",
  matching: "bg-indigo-100 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-400",
  approval_pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
  approved: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-400/10 dark:text-green-400",
  processing: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 dark:bg-purple-400/10 dark:text-purple-400",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
  rejected: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 dark:bg-red-400/10 dark:text-red-400",
  error: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 dark:bg-red-400/10 dark:text-red-400",
};

// ============================================================================
// Helpers
// ============================================================================

const normalizeAbn = (abn: string | null | undefined): string => {
  if (!abn) return "";
  return abn.replace(/[^0-9]/g, "");
};

const abnMatches = (abn1: string | null | undefined, abn2: string | null | undefined): boolean | null => {
  const normalized1 = normalizeAbn(abn1);
  const normalized2 = normalizeAbn(abn2);
  if (!normalized1 || !normalized2) return null;
  return normalized1 === normalized2;
};

const formatCurrency = (amount: number | null | undefined) => {
  if (amount == null) return "-";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount);
};

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-AU");
};

// ============================================================================
// Props
// ============================================================================

export interface BillsInvoiceViewerProps {
  /** The bill to display. If null, shows empty state */
  bill: BillDetail | null;
  /** Optional: List of bills for the selector dropdown */
  bills?: BillDetail[];
  /** Optional: Callback when user selects a different bill */
  onBillSelect?: (bill: BillDetail) => void;
  /** Optional: Callback to refresh data */
  onRefresh?: () => void;
  /** Optional: Show "LIVE DATA" badge */
  showLiveDataBadge?: boolean;
  /** Optional: Loading state */
  loading?: boolean;
  /** Optional: Action handlers - if not provided, buttons won't show */
  onApprove?: () => void;
  onReject?: () => void;
  onAmend?: () => void;
  onMatch?: () => void;
  onExtract?: () => void;
  /** Optional: Is an action in progress? */
  actionLoading?: boolean;
  /** Optional: Custom height for the viewer */
  height?: string;
}

// ============================================================================
// Component
// ============================================================================

export function BillsInvoiceViewer({
  bill,
  bills,
  onBillSelect,
  onRefresh,
  showLiveDataBadge = false,
  loading = false,
  onApprove,
  onReject,
  onAmend,
  onMatch,
  onExtract,
  actionLoading = false,
  height = "calc(100vh-200px)",
}: BillsInvoiceViewerProps) {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const [mismatchDetailsOpen, setMismatchDetailsOpen] = useState(false);

  // Load PDF when bill changes
  useEffect(() => {
    if (bill?.["has_invoice_file?"]) {
      loadPdf(bill.id);
    } else {
      setPdfBlobUrl(null);
    }

    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [bill?.id, bill?.["has_invoice_file?"]]);

  const loadPdf = async (billId: number) => {
    setPdfLoading(true);
    try {
      const blob = await api.getBlob(`/api/v1/bill_inbox/${billId}/download`);
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch (error) {
      console.error("Failed to load PDF:", error);
    } finally {
      setPdfLoading(false);
    }
  };

  // Build highlights from OCR/AI data
  const pdfHighlights: FieldHighlight[] = useMemo(() => {
    if (!bill) return [];

    const fieldLabels: Record<string, string> = {
      supplier_name: "Supplier Name",
      supplier_abn: "Supplier ABN",
      invoice_number: "Invoice #",
      invoice_date: "Invoice Date",
      due_date: "Due Date",
      total_amount: "Total Amount",
      subtotal: "Subtotal",
      tax_amount: "Tax/GST",
      billing_company_name: "Bill To",
      billing_company_abn: "Bill To ABN",
      payment_reference: "Payment Ref",
      balance_due: "Balance Due",
      trust_deduction: "Trust",
      supplier_bank_bsb: "Bank BSB",
      supplier_bank_account: "Bank Account",
    };

    const highlights: FieldHighlight[] = [];

    // OCR coordinates (exact matches)
    const comparisonFields = bill.comparison_data?.fields || {};
    Object.entries(comparisonFields).forEach(([fieldName, fieldData]) => {
      const coords = fieldData?.coordinates;
      if (coords && coords.x !== undefined) {
        highlights.push({
          id: fieldName,
          x: coords.x,
          y: coords.y,
          width: coords.width,
          height: coords.height,
          page: coords.page || 1,
          label: fieldLabels[fieldName] || fieldName,
          color: "#10b981", // green for OCR
          focused: fieldName === highlightedField
        });
      }
    });

    // AI-estimated locations
    const aiLocations = bill.ai_extraction_result?.field_locations || {};
    Object.entries(aiLocations).forEach(([fieldName, location]) => {
      if (comparisonFields[fieldName]?.coordinates) return; // Skip if OCR has it

      if (location && location.x !== undefined) {
        highlights.push({
          id: fieldName,
          x: location.x,
          y: location.y,
          width: location.width,
          height: location.height,
          page: location.page || 1,
          label: fieldLabels[fieldName] || fieldName,
          color: "#eab308", // yellow for AI
          focused: fieldName === highlightedField
        });
      }
    });

    return highlights;
  }, [highlightedField, bill]);

  // Loading state
  if (loading) {
    return (
      <LoadingOverlay />
    );
  }

  // Empty state
  if (!bill) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Receipt className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
        <h3 className="text-lg font-medium">No Bills Found</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Add bills to the system via Finance → Bills to see them here.
        </p>
        {onRefresh && (
          <Button variant="outline" className="mt-4" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        )}
      </div>
    );
  }

  const ai = bill.ai_extraction_result || {};
  const matchRate = bill.comparison_data?.overall_match_rate;
  const isOverdue = bill.due_date && new Date(bill.due_date) < new Date() && bill.status !== "paid";

  return (
    <div className="flex gap-4 p-2 w-full overflow-hidden" style={{ height }}>
      {/* LEFT HALF - Header + Details */}
      <div className="flex-1 min-w-0 flex flex-col gap-2 overflow-hidden">
        {/* Bill Selector (if multiple bills provided) */}
        {bills && bills.length > 1 && onBillSelect && (
          <div className="flex items-center gap-2 shrink-0">
            <select
              className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={bill.id}
              onChange={(e) => {
                const b = bills.find(b => b.id === Number(e.target.value));
                if (b) onBillSelect(b);
              }}
            >
              {bills.map(b => (
                <option key={b.id} value={b.id}>
                  #{b.invoice_number || b.id} - {b.supplier_name_raw || "Unknown"} - {formatCurrency(b.total_amount)}
                </option>
              ))}
            </select>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Header Bar */}
        <div className="flex items-center justify-between p-1 shrink-0 bg-muted/30 rounded">
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-blue-600 text-white rounded min-w-[140px]">
              <div className="text-[10px] uppercase tracking-wide opacity-80">Pay From</div>
              <div className="font-bold text-sm truncate">{bill.corporate?.name || bill.xero_tenant_name || "Company"}</div>
            </div>
            <ArrowLeft className="h-5 w-5 text-muted-foreground rotate-180" />
            <div className="px-3 py-1 bg-green-600 text-white rounded min-w-[140px]">
              <div className="text-[10px] uppercase tracking-wide opacity-80">Pay To</div>
              <div className="font-bold text-sm truncate">{bill.supplier?.display_name || bill.supplier_name_raw || "Supplier"}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="px-2 py-1 bg-muted-foreground text-white rounded min-w-[80px]">
              <div className="text-[10px] uppercase tracking-wide opacity-80">Invoice #</div>
              <div className="font-bold text-sm font-mono">{bill.invoice_number || "-"}</div>
            </div>
            {bill.matched_purchase_order && (
              <div className="px-2 py-1 bg-purple-600 text-white rounded min-w-[80px]">
                <div className="text-[10px] uppercase tracking-wide opacity-80">PO #</div>
                <div className="font-bold text-sm font-mono">{bill.matched_purchase_order.purchase_order_number}</div>
              </div>
            )}
            {matchRate != null && (
              <button
                onClick={() => setMismatchDetailsOpen(!mismatchDetailsOpen)}
                className={cn(
                  "px-2 py-1 text-white rounded min-w-[70px] cursor-pointer transition-all hover:scale-105",
                  matchRate >= 90 ? "bg-green-600 hover:bg-green-700" :
                  matchRate >= 70 ? "bg-yellow-500 hover:bg-yellow-600" :
                  "bg-orange-500 hover:bg-orange-600"
                )}
              >
                <div className="text-[10px] uppercase tracking-wide opacity-80">Match %</div>
                <div className="font-bold text-sm font-mono">{Math.round(matchRate)}%</div>
              </button>
            )}
            {onMatch && (
              <Button
                size="sm"
                variant="outline"
                className="h-[42px] px-2 text-xs border-2 hover:bg-blue-50"
                onClick={onMatch}
                disabled={actionLoading}
              >
                <Link2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Payment Confirmation Bar */}
        <Card className="shrink-0">
          <CardContent className="py-1.5 px-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="font-mono font-bold text-emerald-700">{formatCurrency(bill.remaining_balance || bill.total_amount)}</span>
                {ai.trust_deduction && ai.trust_deduction > 0 && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-200 dark:bg-purple-900/50 rounded text-[10px] border border-purple-400">
                    <Wallet className="h-3 w-3 text-purple-700" />
                    <span className="text-purple-700 font-semibold">Trust: -{formatCurrency(ai.trust_deduction)}</span>
                  </div>
                )}
                <span className="text-muted-foreground">|</span>
                <span>{formatDate(bill.due_date)}</span>
                <Badge className={cn("text-[10px] px-1.5 py-0", statusColors[bill.status] || "bg-muted")}>{(bill.status || 'draft').replace("_", " ")}</Badge>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {onAmend && <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={onAmend} disabled={actionLoading}>Amend</Button>}
                {onReject && bill.status === "approval_pending" && (
                  <Button variant="outline" size="sm" className="h-6 px-2 text-xs text-red-600 dark:text-red-400" onClick={onReject} disabled={actionLoading}>Reject</Button>
                )}
                {onApprove && bill.status === "approval_pending" && (
                  <Button size="sm" className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700" onClick={onApprove} disabled={actionLoading}>Approve</Button>
                )}
                {onExtract && bill.status === "pending" && (
                  <Button size="sm" className="h-6 px-2 text-xs" onClick={onExtract} disabled={actionLoading}>Extract</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mismatch Details */}
        {mismatchDetailsOpen && (
          <Card className="shrink-0">
            <CardHeader className="py-2 px-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Match Details
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setMismatchDetailsOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="py-2 px-3 space-y-2 text-xs">
              {/* ABN Mismatch */}
              {(() => {
                const match = abnMatches(bill.ai_extraction_result?.supplier_abn, bill.supplier?.abn);
                if (match === false) {
                  return (
                    <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded">
                      <XCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-700">Supplier ABN Mismatch</p>
                        <p className="text-red-600 dark:text-red-400 mt-0.5">
                          Invoice: {bill.ai_extraction_result?.supplier_abn || 'N/A'}<br />
                          Expected: {bill.supplier?.abn || 'N/A'}
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* PO Variance */}
              {bill.matched_purchase_order && bill.variance_amount !== null && bill.variance_amount !== 0 && (
                <div className={cn(
                  "flex items-start gap-2 p-2 rounded",
                  Math.abs(bill.variance_percent || 0) > 5 ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200"
                )}>
                  <AlertTriangle className={cn("h-4 w-4 shrink-0 mt-0.5", Math.abs(bill.variance_percent || 0) > 5 ? "text-red-500 dark:text-red-400" : "text-amber-500")} />
                  <div>
                    <p className={cn("font-medium", Math.abs(bill.variance_percent || 0) > 5 ? "text-red-700" : "text-amber-700")}>
                      Purchase Order Variance
                    </p>
                    <p className={cn("mt-0.5", Math.abs(bill.variance_percent || 0) > 5 ? "text-red-600 dark:text-red-400" : "text-amber-600")}>
                      PO: {formatCurrency(bill.matched_purchase_order.total)}<br />
                      Invoice: {formatCurrency(bill.total_amount)}<br />
                      Difference: {bill.variance_amount > 0 ? '+' : ''}{formatCurrency(bill.variance_amount)}
                      {bill.variance_percent && ` (${bill.variance_percent.toFixed(1)}%)`}
                    </p>
                  </div>
                </div>
              )}

              {/* All good */}
              {matchRate && matchRate >= 95 && (
                <div className="flex items-start gap-2 p-2 bg-green-50 border border-green-200 rounded">
                  <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-700">All Checks Passed</p>
                    <p className="text-green-600 dark:text-green-400 mt-0.5">High extraction confidence, all fields match</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-2 flex-1 min-h-0 overflow-auto">
          {/* Invoice Details Card */}
          <Card className="overflow-auto">
            <CardHeader className="py-2 px-3">
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Invoice Details
                </span>
                {showLiveDataBadge && <Badge variant="outline" className="text-[10px]">LIVE DATA</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-3 py-0 text-xs">
              {/* Invoice # and Date */}
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={cn(
                    "p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02]",
                    bill.ai_extraction_result?.invoice_number ? "bg-green-100 dark:bg-green-900/40 border-2 border-green-400" : "bg-muted border border-border",
                    highlightedField === "invoice_number" && "ring-4 ring-yellow-400"
                  )}
                  onClick={() => setHighlightedField(highlightedField === "invoice_number" ? null : "invoice_number")}
                >
                  <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                    Invoice # {bill.ai_extraction_result?.invoice_number && <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />}
                  </p>
                  <p className="font-mono font-bold">{bill.invoice_number || ai.invoice_number || "-"}</p>
                </div>
                <div
                  className={cn(
                    "p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02]",
                    bill.ai_extraction_result?.invoice_date ? "bg-green-100 dark:bg-green-900/40 border-2 border-green-400" : "bg-muted border border-border",
                    highlightedField === "invoice_date" && "ring-4 ring-yellow-400"
                  )}
                  onClick={() => setHighlightedField(highlightedField === "invoice_date" ? null : "invoice_date")}
                >
                  <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                    Invoice Date {bill.ai_extraction_result?.invoice_date && <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />}
                  </p>
                  <p className="font-bold">{formatDate(bill.invoice_date)}</p>
                </div>
              </div>

              {/* Due Date and ABN */}
              <div className="grid grid-cols-2 gap-2">
                <div
                  className={cn(
                    "p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02]",
                    isOverdue ? "bg-red-100 border-2 border-red-400" :
                    bill.ai_extraction_result?.due_date ? "bg-green-100 dark:bg-green-900/40 border-2 border-green-400" : "bg-muted border border-border",
                    highlightedField === "due_date" && "ring-4 ring-yellow-400"
                  )}
                  onClick={() => setHighlightedField(highlightedField === "due_date" ? null : "due_date")}
                >
                  <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                    Due Date {bill.ai_extraction_result?.due_date && <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />}
                  </p>
                  <p className={cn("font-bold", isOverdue && "text-red-600 dark:text-red-400")}>
                    {formatDate(bill.due_date)}
                    {isOverdue && <span className="ml-1 text-[10px] font-normal">(Overdue)</span>}
                  </p>
                </div>
                <div
                  className={cn(
                    "p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02]",
                    bill.ai_extraction_result?.supplier_abn ? "bg-green-100 dark:bg-green-900/40 border-2 border-green-400" : "bg-muted border border-border",
                    highlightedField === "supplier_abn" && "ring-4 ring-yellow-400"
                  )}
                  onClick={() => setHighlightedField(highlightedField === "supplier_abn" ? null : "supplier_abn")}
                >
                  <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                    Supplier ABN {bill.ai_extraction_result?.supplier_abn && <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />}
                  </p>
                  <p className="font-mono font-bold">{bill.supplier?.abn || ai.supplier_abn || "-"}</p>
                </div>
              </div>

              <Separator className="my-2" />

              {/* Amounts */}
              <div className="space-y-1">
                <div
                  className={cn(
                    "flex justify-between p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02]",
                    bill.ai_extraction_result?.subtotal ? "bg-green-100 dark:bg-green-900/40 border-2 border-green-400" : "bg-muted border border-border",
                    highlightedField === "subtotal" && "ring-4 ring-yellow-400"
                  )}
                  onClick={() => setHighlightedField(highlightedField === "subtotal" ? null : "subtotal")}
                >
                  <span className="text-muted-foreground flex items-center gap-1">Subtotal {bill.ai_extraction_result?.subtotal && <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />}</span>
                  <span className="font-mono font-bold">{formatCurrency(bill.subtotal)}</span>
                </div>
                <div
                  className={cn(
                    "flex justify-between p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02]",
                    bill.ai_extraction_result?.tax_amount ? "bg-green-100 dark:bg-green-900/40 border-2 border-green-400" : "bg-muted border border-border",
                    highlightedField === "tax_amount" && "ring-4 ring-yellow-400"
                  )}
                  onClick={() => setHighlightedField(highlightedField === "tax_amount" ? null : "tax_amount")}
                >
                  <span className="text-muted-foreground flex items-center gap-1">GST {bill.ai_extraction_result?.tax_amount && <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />}</span>
                  <span className="font-mono font-bold">{formatCurrency(bill.tax_amount)}</span>
                </div>
                <Separator className="my-1" />
                <div
                  className={cn(
                    "flex justify-between p-2 font-bold text-sm rounded cursor-pointer transition-all hover:scale-[1.02]",
                    bill.ai_extraction_result?.total_amount ? "bg-green-200 dark:bg-green-900/50 border-2 border-green-500" : "bg-muted border border-border",
                    highlightedField === "total_amount" && "ring-4 ring-yellow-400"
                  )}
                  onClick={() => setHighlightedField(highlightedField === "total_amount" ? null : "total_amount")}
                >
                  <span className="flex items-center gap-1">Total {bill.ai_extraction_result?.total_amount && <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}</span>
                  <span className="font-mono text-lg">{formatCurrency(bill.total_amount)}</span>
                </div>

                {/* Trust Deduction */}
                {ai.trust_deduction && ai.trust_deduction > 0 && (
                  <div className="flex justify-between p-2 rounded bg-purple-100 dark:bg-purple-900/40 border-2 border-purple-400">
                    <span className="flex items-center gap-1 text-purple-700 font-medium">
                      <Wallet className="h-4 w-4" /> Less Funds in Trust
                    </span>
                    <span className="font-mono font-bold text-purple-700">-{formatCurrency(ai.trust_deduction)}</span>
                  </div>
                )}

                {/* Balance Due */}
                <div className="flex justify-between p-2 rounded bg-emerald-200 dark:bg-emerald-900/50 border-2 border-emerald-500 font-bold text-sm">
                  <span className="flex items-center gap-1 text-emerald-800">
                    <DollarSign className="h-4 w-4" /> Balance Due
                  </span>
                  <span className="font-mono text-lg text-emerald-800">{formatCurrency(bill.remaining_balance || bill.total_amount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Purchase Order Card */}
          <Card className={cn("overflow-auto", bill.matched_purchase_order ? "border-2 border-green-500 bg-green-50 dark:bg-green-900/20" : "")}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Purchase Order
                </span>
                {bill.matched_purchase_order ? (
                  <Badge className="bg-green-600 text-white">
                    <CheckCircle className="h-3 w-3 mr-1" /> MATCHED
                  </Badge>
                ) : (
                  <Badge variant="secondary">No PO</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {bill.matched_purchase_order ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-1.5 bg-muted dark:bg-card rounded">
                      <p className="text-[10px] text-muted-foreground uppercase">PO Number</p>
                      <Link
                        href={`/purchase_orders/${bill.matched_purchase_order.id}`}
                        className="font-bold text-sm text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-mono"
                      >
                        {bill.matched_purchase_order.purchase_order_number}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="p-1.5 bg-muted dark:bg-card rounded">
                      <p className="text-[10px] text-muted-foreground uppercase">Payment Terms</p>
                      <p className="font-medium text-sm text-blue-600 dark:text-blue-400">{bill.matched_purchase_order.payment_terms || bill.supplier?.payment_terms || "-"}</p>
                    </div>
                  </div>
                  <Separator className="my-2" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-1.5 bg-muted dark:bg-card rounded">
                      <p className="text-[10px] text-muted-foreground uppercase">PO Total</p>
                      <p className="font-mono font-bold text-sm">{formatCurrency(bill.matched_purchase_order.total)}</p>
                    </div>
                    <div className="p-1.5 bg-muted dark:bg-card rounded">
                      <p className="text-[10px] text-muted-foreground uppercase">Invoice Total</p>
                      <p className="font-mono font-bold text-sm">{formatCurrency(bill.total_amount)}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "p-2 rounded border",
                    bill.variance_amount === 0 || bill.variance_amount === null ? "bg-green-100 border-green-300" : "bg-yellow-100 border-yellow-300"
                  )}>
                    <p className="text-[10px] text-muted-foreground uppercase">Variance</p>
                    <p className={cn(
                      "font-mono font-bold text-sm",
                      bill.variance_amount === 0 || bill.variance_amount === null ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"
                    )}>
                      {formatCurrency(bill.variance_amount || 0)} ({bill.variance_percent?.toFixed(1) || 0}%)
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No purchase order matched to this invoice</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* RIGHT HALF - PDF Preview */}
      <div className="flex-1 min-w-[400px] sticky top-0" style={{ height }}>
        <Card className="h-full w-full">
          <CardContent className="p-2 h-full">
            {pdfLoading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Spinner />
                <p className="text-sm text-muted-foreground mt-4">Loading invoice...</p>
              </div>
            ) : pdfBlobUrl ? (
              <PdfFrame className="relative w-full h-full rounded-lg">
                <PDFViewer
                  url={pdfBlobUrl}
                  className="w-full h-full"
                  showToolbar={true}
                  highlights={pdfHighlights}
                />
              </PdfFrame>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center border rounded-lg bg-muted/30">
                <ImageIcon className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                <h3 className="text-lg font-medium">No PDF Available</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  This bill doesn&apos;t have an attached invoice file.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default BillsInvoiceViewer;