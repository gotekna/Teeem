"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Link2,
  Wand2,
  User,
  CreditCard,
  Receipt,
  ExternalLink,
  Download,
  Eye,
  FileWarning,
  ImageIcon,
  Maximize2,
  X,
  ScanText,
  Wallet,
} from "lucide-react";
import { api, getApiBaseUrl } from "@/lib/api";
import { PDFViewer, FieldHighlight } from "@/components/ui/pdf-viewer";
import { CheckCircle2, XCircle as XCircle2, MapPin } from "lucide-react";

// Normalize ABN for comparison (remove spaces, dashes, and non-digit characters)
const normalizeAbn = (abn: string | null | undefined): string => {
  if (!abn) return "";
  return abn.replace(/[^0-9]/g, "");
};

// Check if two ABNs match
const abnMatches = (abn1: string | null | undefined, abn2: string | null | undefined): boolean | null => {
  const normalized1 = normalizeAbn(abn1);
  const normalized2 = normalizeAbn(abn2);

  // If either is empty, we can't determine a match
  if (!normalized1 || !normalized2) return null;

  return normalized1 === normalized2;
};

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
  // New fields for lawyer/trust invoices
  payment_reference?: string;       // e.g., "AM:200261" - their matter reference
  balance_due?: number;             // Actual amount to pay (after trust deductions)
  trust_deduction?: number;         // Amount deducted from trust (e.g., $10,000)
  supplier_bank_bsb?: string;       // Extracted BSB from invoice
  supplier_bank_account?: string;   // Extracted account number from invoice
  case_reference?: string;          // Case/matter reference (e.g., "[W2G]")
  matter_description?: string;      // Matter description from invoice
  [key: string]: unknown;
}

interface OcrWord {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  page: number;
  pixel_x: number;
  pixel_y: number;
  pixel_width: number;
  pixel_height: number;
}

interface OcrExtractionResult {
  text: string;
  words: OcrWord[];
  pages: Array<{
    page: number;
    text: string;
    words: OcrWord[];
    image_width: number;
    image_height: number;
  }>;
  extracted_at: string;
  ocr_engine: string;
  ocr_version: string;
  error?: string;
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

interface BillDetail {
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
  ocr_extraction_result: OcrExtractionResult | null;
  comparison_data: ComparisonData | null;
  xero_tenant_name: string | null;
  corporate_company: {
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
    tax_number: string;
    bank_bsb: string;
    bank_account_number: string;
    // Trust account fields for lawyers, accountants, real estate agents, etc.
    has_trust_account?: boolean;
    trust_bsb?: string;
    trust_account_number?: string;
    trust_account_name?: string;
    payment_terms?: string; // e.g., "7 days", "Net 30", "EOM+30"
  } | null;
  matched_purchase_order: {
    id: number;
    purchase_order_number: string;
    total: number;
    status: string;
    payment_terms?: string; // e.g., "Net 30", "7 days", "EOM+30"
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
}

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400",
  extracting: "bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400",
  extracted: "bg-cyan-100 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-400",
  matching: "bg-indigo-100 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-400",
  approval_pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-500",
  approved: "bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400",
  processing: "bg-purple-100 text-purple-700 dark:bg-purple-400/10 dark:text-purple-400",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-400",
  error: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-400",
};

const matchStatusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  matched: "bg-green-100 text-green-700",
  no_po_required: "bg-blue-100 text-blue-700",
  variance: "bg-yellow-100 text-yellow-700",
  no_match: "bg-red-100 text-red-700",
};

export default function BillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const billId = params.id as string;

  const [bill, setBill] = useState<BillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfExpandedOpen, setPdfExpandedOpen] = useState(false);
  const [highlightedField, setHighlightedField] = useState<string | null>(null);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [mismatchDetailsOpen, setMismatchDetailsOpen] = useState(false);

  // Build highlights array from OCR coordinates (exact) or AI field_locations (estimated)
  // Show ALL fields with coordinates, and emphasize the focused field
  const pdfHighlights: FieldHighlight[] = React.useMemo(() => {
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

    // First, collect all fields from comparison_data (OCR exact matches)
    const comparisonFields = bill.comparison_data?.fields || {};
    Object.entries(comparisonFields).forEach(([fieldName, fieldData]: [string, any]) => {
      const coords = fieldData?.coordinates;
      if (coords && coords.x !== undefined) {
        highlights.push({
          id: fieldName,
          x: coords.x,
          y: coords.y,
          width: coords.width,
          height: coords.height,
          page: coords.page || 1,
          label: `${fieldLabels[fieldName] || fieldName}`,
          color: "#10b981", // green for OCR
          focused: fieldName === highlightedField
        });
      }
    });

    // Then, add AI-estimated locations for fields not found in OCR
    const aiLocations = bill.ai_extraction_result?.field_locations || {};
    Object.entries(aiLocations).forEach(([fieldName, location]: [string, any]) => {
      // Skip if already added from OCR
      if (comparisonFields[fieldName]?.coordinates) return;

      if (location && location.x !== undefined) {
        highlights.push({
          id: fieldName,
          x: location.x,
          y: location.y,
          width: location.width,
          height: location.height,
          page: location.page || 1,
          label: `${fieldLabels[fieldName] || fieldName}`,
          color: "#eab308", // yellow for AI
          focused: fieldName === highlightedField
        });
      }
    });

    return highlights;
  }, [highlightedField, bill?.comparison_data, bill?.ai_extraction_result?.field_locations, bill]);

  // Helper to check if a field has location data (OCR or AI)
  const hasLocation = (fieldName: string): boolean => {
    const hasOcr = !!bill?.comparison_data?.fields[fieldName]?.coordinates;
    const hasAi = !!bill?.ai_extraction_result?.field_locations?.[fieldName];
    return hasOcr || hasAi;
  };

  // Toggle highlight for a field
  const toggleHighlight = (fieldName: string) => {
    if (highlightedField === fieldName) {
      setHighlightedField(null);
    } else {
      setHighlightedField(fieldName);
    }
  };

  const loadBill = async () => {
    setLoading(true);
    try {
      const response = await api.get<BillDetail>(`/api/v1/bill_inbox/${billId}`);
      setBill(response);
    } catch (error) {
      console.error("Failed to load bill:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPdf = async () => {
    if (!bill?.["has_invoice_file?"]) return;

    setPdfLoading(true);
    setPdfError(null);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${getApiBaseUrl()}/api/v1/bill_inbox/${billId}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load PDF");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch (error) {
      console.error("Failed to load PDF:", error);
      setPdfError(error instanceof Error ? error.message : "Failed to load PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  useEffect(() => {
    loadBill();
  }, [billId]);

  useEffect(() => {
    // Load PDF when bill data is available and has a file
    if (bill?.["has_invoice_file?"]) {
      loadPdf();
    }

    // Cleanup blob URL on unmount
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [bill?.id, bill?.["has_invoice_file?"]]);

  const handleExtract = async () => {
    if (!bill) return;
    setActionLoading(true);
    try {
      await api.post(`/api/v1/bill_inbox/${bill.id}/extract`);
      await loadBill();
    } catch (error) {
      console.error("Extract failed:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMatch = async () => {
    if (!bill) return;
    setActionLoading(true);
    try {
      await api.post(`/api/v1/bill_inbox/${bill.id}/match`);
      await loadBill();
    } catch (error) {
      console.error("Match failed:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!bill) return;
    setActionLoading(true);
    try {
      await api.post(`/api/v1/bill_inbox/${bill.id}/approve`);
      await loadBill();
    } catch (error) {
      console.error("Approve failed:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!bill) return;
    setActionLoading(true);
    try {
      await api.post(`/api/v1/bill_inbox/${bill.id}/reject`, {
        reason: rejectReason,
      });
      setRejectDialogOpen(false);
      setRejectReason("");
      await loadBill();
    } catch (error) {
      console.error("Reject failed:", error);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/finance/bills">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Bills
          </Link>
        </Button>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Bill not found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              This bill may have been deleted or doesn't exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOverdue = bill.due_date && new Date(bill.due_date) < new Date() && bill.status !== "paid";
  const totalPaid = bill.bill_payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

  const handleDownload = () => {
    if (pdfBlobUrl) {
      const link = document.createElement("a");
      link.href = pdfBlobUrl;
      link.download = bill.invoice_file_filename || `invoice-${bill.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOpenInApp = async () => {
    // Opens in system default app (Preview on Mac, etc)
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${getApiBaseUrl()}/api/v1/bill_inbox/${billId}/download?disposition=attachment`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to download file");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Create a link and click it to trigger download/open
      const link = document.createElement("a");
      link.href = url;
      link.download = bill?.invoice_file_filename || `invoice-${billId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup after a delay
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Failed to open in app:", error);
    }
  };

  return (
    <div className="flex gap-4 p-2 w-full overflow-hidden -mt-4">
      {/* LEFT HALF - Header + Details (flexible width) */}
      <div className="flex-1 min-w-0 flex flex-col gap-2 overflow-hidden h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex items-center justify-between p-1 shrink-0 bg-muted/30 rounded">
        {/* Left - Pay From / Pay To */}
        <div className="flex items-center gap-2">
          {/* Company Box - Pay From */}
          <div className="px-3 py-1 bg-blue-600 text-white rounded min-w-[200px]">
            <div className="text-[10px] uppercase tracking-wide opacity-80">Pay From</div>
            <div className="font-bold text-sm truncate" title={bill.corporate_company?.name || bill.xero_tenant_name || "Not Assigned"}>
              {bill.corporate_company?.name || bill.xero_tenant_name || "Not Assigned"}
            </div>
          </div>
          {/* Arrow */}
          <ArrowLeft className="h-5 w-5 text-gray-500 rotate-180" />
          {/* Supplier Box - Pay To */}
          <div className="px-3 py-1 bg-green-600 text-white rounded min-w-[200px]">
            <div className="text-[10px] uppercase tracking-wide opacity-80">Pay To</div>
            <div className="font-bold text-sm truncate" title={bill.supplier?.display_name || bill.supplier_name_raw || "Unknown Supplier"}>
              {bill.supplier?.display_name || bill.supplier_name_raw || "Unknown Supplier"}
            </div>
          </div>
        </div>
        {/* Right - Invoice/PO/Match */}
        <div className="flex items-center gap-1">
          {/* Invoice Number Box */}
          <div className="px-2 py-1 bg-gray-700 text-white rounded min-w-[80px]">
            <div className="text-[10px] uppercase tracking-wide opacity-80">Invoice #</div>
            <div className="font-bold text-sm font-mono">{bill.invoice_number || "-"}</div>
          </div>
          {/* PO Number Box */}
          <div className="px-2 py-1 bg-purple-600 text-white rounded min-w-[80px]">
            <div className="text-[10px] uppercase tracking-wide opacity-80">PO #</div>
            <div className="font-bold text-sm font-mono">{bill.matched_purchase_order?.purchase_order_number || bill.ai_extraction_result?.purchase_order_number || "-"}</div>
          </div>
          {/* Match % Box with Rematch Button */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMismatchDetailsOpen(!mismatchDetailsOpen)}
              className={`px-2 py-1 rounded min-w-[70px] transition-all hover:scale-105 ${
                bill.ai_confidence && bill.ai_confidence >= 0.9 ? 'bg-green-600 hover:bg-green-700' :
                bill.ai_confidence && bill.ai_confidence >= 0.7 ? 'bg-yellow-500 hover:bg-yellow-600' :
                'bg-orange-500 hover:bg-orange-600'
              } text-white cursor-pointer`}
              title="Click to see what's not matching"
            >
              <div className="text-[10px] uppercase tracking-wide opacity-80">Match %</div>
              <div className="font-bold text-sm font-mono">
                {bill.ai_confidence ? `${Math.round((bill.ai_confidence <= 1 ? bill.ai_confidence * 100 : bill.ai_confidence))}%` : "-"}
              </div>
            </button>
            <Button
              size="sm"
              variant="outline"
              className="h-[42px] px-2 text-xs border-2 hover:bg-blue-50"
              onClick={handleMatch}
              disabled={actionLoading}
              title="Re-run matching algorithm"
            >
              <Link2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Payment Confirmation - Above Grid */}
      {(() => {
        // Supplier bank accounts - some suppliers (like lawyers) have both Trust and Business accounts
        // TODO: Get these from supplier record - supplier.trust_bsb, supplier.trust_account_number
        const hasTrustAccount = bill.supplier?.trust_bsb || bill.supplier?.has_trust_account;
        const supplierTrustBSB = bill.supplier?.trust_bsb || "XXX-XXX";
        const supplierTrustAccount = bill.supplier?.trust_account_number || "XXXXXXXX";
        const supplierBusinessBSB = bill.supplier?.bank_bsb || "";
        const supplierBusinessAccount = bill.supplier?.bank_account_number || "";

        // Payment terms from supplier or extracted from invoice
        const supplierTerms = bill.ai_extraction_result?.payment_terms || bill.supplier?.payment_terms || "Net 30";

        // For split payments - amounts going to each account
        // TODO: Get from line items or bill allocation
        const trustLineItems = bill.ai_extraction_result?.line_items?.filter(item =>
          item.description?.toLowerCase().includes('disbursement') ||
          item.description?.toLowerCase().includes('trust')
        ) || [];
        const trustAmount = trustLineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
        const businessAmount = (bill.total_amount || 0) - trustAmount;
        const hasSplitPayment = hasTrustAccount && trustAmount > 0 && businessAmount > 0;

        return (
          <Card className="shrink-0">
            <CardContent className="py-1.5 px-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  {hasSplitPayment ? (
                    <>
                      {/* Split Payment - Trust + Business */}
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded border border-purple-300">
                        <Wallet className="h-3 w-3 text-purple-600" />
                        <span className="text-purple-700 font-medium">Trust:</span>
                        <span className="font-mono font-bold text-purple-700">${trustAmount.toLocaleString('en-AU', {minimumFractionDigits: 2})}</span>
                        <span className="text-purple-500 text-[10px]">→ {supplierTrustBSB}/{supplierTrustAccount}</span>
                      </div>
                      <span className="text-muted-foreground">+</span>
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded border border-blue-300">
                        <Building2 className="h-3 w-3 text-blue-600" />
                        <span className="text-blue-700 font-medium">Fees:</span>
                        <span className="font-mono font-bold text-blue-700">${businessAmount.toLocaleString('en-AU', {minimumFractionDigits: 2})}</span>
                        <span className="text-blue-500 text-[10px]">→ {supplierBusinessBSB}/{supplierBusinessAccount}</span>
                      </div>
                    </>
                  ) : hasTrustAccount ? (
                    <>
                      {/* Single payment to Trust OR Business account */}
                      <span className="font-mono font-bold text-emerald-700">${(bill.ai_extraction_result?.balance_due || bill.remaining_balance || bill.total_amount || 0).toLocaleString('en-AU', {minimumFractionDigits: 2})}</span>
                      {bill.ai_extraction_result?.trust_deduction && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-200 dark:bg-purple-900/50 rounded text-[10px] border border-purple-400">
                          <Wallet className="h-3 w-3 text-purple-700" />
                          <span className="text-purple-700 font-semibold">Trust: -${bill.ai_extraction_result.trust_deduction.toLocaleString('en-AU', {minimumFractionDigits: 2})}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 rounded text-[10px]">
                        <Wallet className="h-3 w-3 text-purple-600" />
                        <span className="text-purple-600">Trust: {supplierTrustBSB}/{supplierTrustAccount}</span>
                      </div>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px]">
                        <Building2 className="h-3 w-3 text-gray-500" />
                        <span className="text-gray-500">Bus: {supplierBusinessBSB}/{supplierBusinessAccount}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Single payment - standard supplier */}
                      <span className="font-mono font-bold text-emerald-700">${(bill.ai_extraction_result?.balance_due || bill.remaining_balance || bill.total_amount || 0).toLocaleString('en-AU', {minimumFractionDigits: 2})}</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="font-mono text-muted-foreground">{supplierBusinessBSB ? `${supplierBusinessBSB}/${supplierBusinessAccount}` : "No bank"}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">|</span>
                  <span>{bill.due_date ? new Date(bill.due_date).toLocaleDateString("en-AU") : "-"}</span>
                  <span className="text-muted-foreground">|</span>
                  <span className="text-blue-600 font-medium">{supplierTerms}</span>
                  <Badge className={`${statusColors[bill.status] || statusColors.pending} text-[10px] px-1.5 py-0`}>{bill.status.replace("_", " ")}</Badge>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="outline" size="sm" className="h-6 px-2 text-xs" disabled={actionLoading}>Amend</Button>
                  {bill.status === "approval_pending" && (
                    <>
                      <Button variant="outline" size="sm" className="h-6 px-2 text-xs text-red-600" onClick={() => setRejectDialogOpen(true)} disabled={actionLoading}>Reject</Button>
                      {hasSplitPayment ? (
                        <>
                          <Button size="sm" className="h-6 px-2 text-xs bg-purple-600 hover:bg-purple-700" onClick={handleApprove} disabled={actionLoading}>
                            <Wallet className="h-3 w-3 mr-1" />
                            Pay Trust ${trustAmount.toLocaleString()}
                          </Button>
                          <Button size="sm" className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700" onClick={handleApprove} disabled={actionLoading}>
                            <Building2 className="h-3 w-3 mr-1" />
                            Pay Fees ${businessAmount.toLocaleString()}
                          </Button>
                        </>
                      ) : hasTrustAccount ? (
                        <>
                          <Button size="sm" className="h-6 px-2 text-xs bg-purple-600 hover:bg-purple-700" onClick={handleApprove} disabled={actionLoading}>
                            <Wallet className="h-3 w-3 mr-1" />
                            Pay to Trust
                          </Button>
                          <Button size="sm" className="h-6 px-2 text-xs bg-gray-600 hover:bg-gray-700" onClick={handleApprove} disabled={actionLoading}>
                            <Building2 className="h-3 w-3 mr-1" />
                            Pay to Business
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700" onClick={handleApprove} disabled={actionLoading}>Approve & Send to Bank</Button>
                      )}
                    </>
                  )}
                  {bill.status === "approved" && <Button size="sm" className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700" disabled={actionLoading}>Send to Bank</Button>}
                  {bill.status === "pending" && <Button size="sm" className="h-6 px-2 text-xs" onClick={handleExtract} disabled={actionLoading}>Extract</Button>}
                  {bill.status === "extracted" && <Button size="sm" className="h-6 px-2 text-xs" onClick={handleMatch} disabled={actionLoading}>Match</Button>}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Mismatch Details - Collapsible */}
      {mismatchDetailsOpen && (
        <Card className="shrink-0">
          <CardHeader className="py-2 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Match Details - What's Not 100%
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setMismatchDetailsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="py-2 px-3 space-y-2">
            {/* Overall Match Score */}
            <div className={`p-2 rounded ${
              bill.ai_confidence && bill.ai_confidence >= 0.9 ? 'bg-green-50 border border-green-300' :
              bill.ai_confidence && bill.ai_confidence >= 0.7 ? 'bg-yellow-50 border border-yellow-300' :
              'bg-orange-50 border border-orange-300'
            }`}>
              <p className="text-xs font-semibold mb-1">AI Extraction Confidence</p>
              <p className="text-sm">
                {bill.ai_confidence ? `${Math.round((bill.ai_confidence <= 1 ? bill.ai_confidence * 100 : bill.ai_confidence))}%` : "Unknown"}
                {bill.ai_confidence && bill.ai_confidence < 1 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    ({bill.ai_confidence < 0.9 ? 'Review recommended' : bill.ai_confidence < 0.95 ? 'Good confidence' : 'High confidence'})
                  </span>
                )}
              </p>
            </div>

            {/* Field Mismatches */}
            <Separator />
            <p className="text-xs font-semibold">Field-Level Issues:</p>

            <div className="space-y-1 text-xs">
              {/* ABN Mismatch */}
              {(() => {
                const match = abnMatches(bill.ai_extraction_result?.supplier_abn, bill.supplier?.tax_number);
                if (match === false) {
                  return (
                    <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded">
                      <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-red-700">Supplier ABN Mismatch</p>
                        <p className="text-red-600 mt-0.5">
                          Invoice: {bill.ai_extraction_result?.supplier_abn || 'N/A'}<br />
                          Expected: {bill.supplier?.tax_number || 'N/A'}
                        </p>
                      </div>
                    </div>
                  );
                }
                if (match === null && bill.ai_extraction_result?.supplier_abn && !bill.supplier?.tax_number) {
                  return (
                    <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-amber-700">Missing Supplier ABN</p>
                        <p className="text-amber-600 mt-0.5">
                          Invoice has ABN ({bill.ai_extraction_result.supplier_abn}), but supplier record doesn't
                        </p>
                      </div>
                    </div>
                  );
                }
              })()}

              {/* Bank Details Mismatch */}
              {(() => {
                const extractedBSB = bill.ai_extraction_result?.supplier_bank_bsb?.replace(/[\s-]/g, '');
                const storedBSB = bill.supplier?.bank_bsb?.replace(/[\s-]/g, '');
                const extractedAcc = bill.ai_extraction_result?.supplier_bank_account?.replace(/[\s-]/g, '');
                const storedAcc = bill.supplier?.bank_account_number?.replace(/[\s-]/g, '');
                const bsbMatch = !extractedBSB || !storedBSB || extractedBSB === storedBSB;
                const accMatch = !extractedAcc || !storedAcc || extractedAcc === storedAcc;

                if (!bsbMatch || !accMatch) {
                  return (
                    <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded">
                      <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-red-700">Bank Details Mismatch</p>
                        <p className="text-red-600 mt-0.5">
                          Invoice: {bill.ai_extraction_result?.supplier_bank_bsb || '-'}/{bill.ai_extraction_result?.supplier_bank_account || '-'}<br />
                          Expected: {bill.supplier?.bank_bsb || '-'}/{bill.supplier?.bank_account_number || '-'}
                        </p>
                      </div>
                    </div>
                  );
                }
              })()}

              {/* PO Variance */}
              {bill.matched_purchase_order && bill.variance_amount !== null && bill.variance_amount !== 0 && (
                <div className={`flex items-start gap-2 p-2 rounded ${
                  Math.abs(bill.variance_percent || 0) > 5
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-amber-50 border border-amber-200'
                }`}>
                  <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${
                    Math.abs(bill.variance_percent || 0) > 5 ? 'text-red-500' : 'text-amber-500'
                  }`} />
                  <div className="flex-1">
                    <p className={`font-medium ${
                      Math.abs(bill.variance_percent || 0) > 5 ? 'text-red-700' : 'text-amber-700'
                    }`}>
                      Purchase Order Variance
                    </p>
                    <p className={`mt-0.5 ${
                      Math.abs(bill.variance_percent || 0) > 5 ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      PO: ${bill.matched_purchase_order.total?.toLocaleString('en-AU', {minimumFractionDigits: 2})}<br />
                      Invoice: ${(bill.total_amount || 0).toLocaleString('en-AU', {minimumFractionDigits: 2})}<br />
                      Difference: {bill.variance_amount > 0 ? '+' : ''}${bill.variance_amount.toLocaleString('en-AU', {minimumFractionDigits: 2})}
                      {bill.variance_percent && ` (${bill.variance_percent.toFixed(1)}%)`}
                    </p>
                  </div>
                </div>
              )}

              {/* Missing Bill To Company */}
              {!bill.ai_extraction_result?.billing_company_name && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-700">Missing Bill To Company</p>
                    <p className="text-amber-600 mt-0.5">
                      Could not extract "Bill To" company name from invoice
                    </p>
                  </div>
                </div>
              )}

              {/* Missing Payment Reference */}
              {!bill.ai_extraction_result?.payment_reference && bill.supplier?.has_trust_account && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-700">Missing Payment Reference</p>
                    <p className="text-amber-600 mt-0.5">
                      No payment reference extracted (required for trust account payments)
                    </p>
                  </div>
                </div>
              )}

              {/* No PO Match */}
              {!bill.matched_purchase_order && bill.match_status === "no_match" && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-amber-700">No Purchase Order Matched</p>
                    <p className="text-amber-600 mt-0.5">
                      {bill.ai_extraction_result?.purchase_order_number
                        ? `Extracted PO #${bill.ai_extraction_result.purchase_order_number} not found in system`
                        : 'No PO reference found on invoice'}
                    </p>
                  </div>
                </div>
              )}

              {/* All Good */}
              {bill.ai_confidence && bill.ai_confidence >= 0.95 &&
               abnMatches(bill.ai_extraction_result?.supplier_abn, bill.supplier?.tax_number) !== false &&
               bill.ai_extraction_result?.billing_company_name &&
               (!bill.matched_purchase_order || (bill.variance_amount === null || bill.variance_amount === 0)) &&
               (() => {
                 const extractedBSB = bill.ai_extraction_result?.supplier_bank_bsb?.replace(/[\s-]/g, '');
                 const storedBSB = bill.supplier?.bank_bsb?.replace(/[\s-]/g, '');
                 const extractedAcc = bill.ai_extraction_result?.supplier_bank_account?.replace(/[\s-]/g, '');
                 const storedAcc = bill.supplier?.bank_account_number?.replace(/[\s-]/g, '');
                 const bsbMatch = !extractedBSB || !storedBSB || extractedBSB === storedBSB;
                 const accMatch = !extractedAcc || !storedAcc || extractedAcc === storedAcc;
                 return bsbMatch && accMatch;
               })() && (
                <div className="flex items-start gap-2 p-2 bg-green-50 border border-green-200 rounded">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-green-700">All Checks Passed</p>
                    <p className="text-green-600 mt-0.5">
                      High extraction confidence, all fields match expected values
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* OCR vs AI Comparison Table */}
            {bill.comparison_data && bill.comparison_data.fields && Object.keys(bill.comparison_data.fields).length > 0 && (
              <>
                <Separator />
                <p className="text-xs font-semibold flex items-center gap-2">
                  <ScanText className="h-4 w-4" />
                  OCR vs AI Field Comparison
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    {bill.comparison_data.overall_match_rate}% Overall Match
                  </Badge>
                </p>

                <div className="space-y-1 text-xs max-h-64 overflow-auto">
                  {Object.entries(bill.comparison_data.fields).map(([fieldName, comparison]: [string, any]) => {
                    const fieldLabels: Record<string, string> = {
                      invoice_number: "Invoice #",
                      invoice_date: "Invoice Date",
                      due_date: "Due Date",
                      subtotal: "Subtotal",
                      tax_amount: "Tax/GST",
                      total_amount: "Total",
                      supplier_name: "Supplier Name",
                      supplier_abn: "Supplier ABN",
                      billing_company_name: "Bill To Company",
                      billing_company_abn: "Bill To ABN",
                      payment_reference: "Payment Ref",
                      balance_due: "Balance Due",
                    };

                    const isExactMatch = comparison.exact_match;
                    const hasFuzzyMatch = comparison.match_confidence > 0.7 && !isExactMatch;
                    const hasNoMatch = comparison.match_confidence <= 0.7;

                    return (
                      <div
                        key={fieldName}
                        className={`p-2 rounded border ${
                          isExactMatch ? 'bg-green-50 border-green-300' :
                          hasFuzzyMatch ? 'bg-yellow-50 border-yellow-300' :
                          'bg-gray-50 border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-xs">{fieldLabels[fieldName] || fieldName}</span>
                          <div className="flex items-center gap-1">
                            {isExactMatch && (
                              <Badge className="bg-green-600 text-white text-[9px] px-1 py-0">
                                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                Exact Match
                              </Badge>
                            )}
                            {hasFuzzyMatch && (
                              <Badge className="bg-yellow-500 text-white text-[9px] px-1 py-0">
                                {Math.round(comparison.match_confidence * 100)}% Match
                              </Badge>
                            )}
                            {hasNoMatch && (
                              <Badge variant="outline" className="text-gray-500 text-[9px] px-1 py-0">
                                No OCR Match
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-muted-foreground">AI:</span>
                            <span className="ml-1 font-mono">{String(comparison.ai_value)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">OCR:</span>
                            <span className="ml-1 font-mono">
                              {comparison.ocr_match || <span className="text-gray-400 italic">not found</span>}
                            </span>
                          </div>
                        </div>
                        {comparison.coordinates && (
                          <div className="mt-1 text-[9px] text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" />
                            Exact location: Page {comparison.coordinates.page}, ({Math.round(comparison.coordinates.x * 100)}%, {Math.round(comparison.coordinates.y * 100)}%)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes - Collapsible */}
      {bill.notes && (
        <div className="border border-gray-300 rounded shrink-0">
          <button
            onClick={() => setNotesExpanded(!notesExpanded)}
            className="w-full flex items-center justify-between px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <span>Notes</span>
            <span className="text-gray-400">{notesExpanded ? '▲' : '▼'}</span>
          </button>
          {notesExpanded && (
            <div className="px-2 py-1 text-xs text-gray-600 border-t max-h-20 overflow-auto">
              <p className="whitespace-pre-wrap">{bill.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Details Grid - in left half - flex-1 to fill space */}
      <div className="grid grid-cols-2 gap-2 flex-1 min-h-0">
        {/* Invoice Details - A4 Portrait */}
        <Card className="overflow-auto aspect-[1/1.414] max-h-[calc(100vh-220px)]">
          <CardHeader className="py-2 px-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoice Details
              </span>
              {bill.ai_extraction_result?.field_locations && Object.keys(bill.ai_extraction_result.field_locations).length > 0 && (
                <span className="text-[10px] font-normal text-muted-foreground flex items-center gap-1">
                  <ScanText className="h-3 w-3" />
                  Click fields to see on PDF
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-3 py-0 text-xs">
            {/* Row 1: Invoice # and Date */}
            <div className="grid grid-cols-2 gap-2">
              <div
                className={`p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02] ${
                  bill.ai_extraction_result?.invoice_number
                    ? 'bg-green-100 dark:bg-green-900/40 border-2 border-green-400 shadow-sm'
                    : 'bg-gray-50 dark:bg-gray-800 border border-gray-200'
                } ${highlightedField === 'invoice_number' ? 'ring-4 ring-yellow-400 ring-offset-2 animate-pulse scale-105 shadow-lg' : ''}`}
                onClick={() => setHighlightedField(highlightedField === 'invoice_number' ? null : 'invoice_number')}
                title="Click to highlight on PDF"
              >
                <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  Invoice #
                  {bill.ai_extraction_result?.invoice_number && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                  {bill.comparison_data?.fields?.invoice_number?.coordinates && (
                    <Badge className="bg-green-600 text-white text-[8px] px-1 py-0 ml-auto">OCR</Badge>
                  )}
                  {!bill.comparison_data?.fields?.invoice_number?.coordinates && bill.ai_extraction_result?.field_locations?.invoice_number && (
                    <Badge className="bg-yellow-500 text-white text-[8px] px-1 py-0 ml-auto">AI Est.</Badge>
                  )}
                </p>
                <p className="font-mono font-bold">{bill.invoice_number || "-"}</p>
              </div>
              <div
                className={`p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02] ${
                  bill.ai_extraction_result?.invoice_date
                    ? 'bg-green-100 dark:bg-green-900/40 border-2 border-green-400 shadow-sm'
                    : 'bg-gray-50 dark:bg-gray-800 border border-gray-200'
                } ${highlightedField === 'invoice_date' ? 'ring-4 ring-yellow-400 ring-offset-2 animate-pulse scale-105 shadow-lg' : ''}`}
                onClick={() => setHighlightedField(highlightedField === 'invoice_date' ? null : 'invoice_date')}
                title="Click to highlight on PDF"
              >
                <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  Invoice Date
                  {bill.ai_extraction_result?.invoice_date && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                </p>
                <p className="font-bold">{bill.invoice_date ? new Date(bill.invoice_date).toLocaleDateString("en-AU") : "-"}</p>
              </div>
            </div>

            {/* Row 2: Due Date and Supplier ABN */}
            <div className="grid grid-cols-2 gap-2">
              <div
                className={`p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02] ${
                  isOverdue
                    ? 'bg-red-100 dark:bg-red-900/40 border-2 border-red-400 shadow-sm'
                    : bill.ai_extraction_result?.due_date
                    ? 'bg-green-100 dark:bg-green-900/40 border-2 border-green-400 shadow-sm'
                    : 'bg-gray-50 dark:bg-gray-800 border border-gray-200'
                } ${highlightedField === 'due_date' ? 'ring-4 ring-yellow-400 ring-offset-2 animate-pulse scale-105 shadow-lg' : ''}`}
                onClick={() => setHighlightedField(highlightedField === 'due_date' ? null : 'due_date')}
                title="Click to highlight on PDF"
              >
                <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  Due Date
                  {bill.ai_extraction_result?.due_date && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                </p>
                <p className={`font-bold ${isOverdue ? "text-red-600" : ""}`}>
                  {bill.due_date ? new Date(bill.due_date).toLocaleDateString("en-AU") : "-"}
                  {isOverdue && <span className="ml-1 text-[10px] font-normal">(Overdue)</span>}
                </p>
              </div>
              <div
                className={`p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02] ${
                  bill.ai_extraction_result?.supplier_abn
                    ? 'bg-green-100 dark:bg-green-900/40 border-2 border-green-400 shadow-sm'
                    : 'bg-gray-50 dark:bg-gray-800 border border-gray-200'
                } ${highlightedField === 'supplier_abn' ? 'ring-4 ring-yellow-400 ring-offset-2 animate-pulse scale-105 shadow-lg' : ''}`}
                onClick={() => setHighlightedField(highlightedField === 'supplier_abn' ? null : 'supplier_abn')}
                title="Click to highlight on PDF"
              >
                <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  Supplier ABN
                  {bill.ai_extraction_result?.supplier_abn && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                  {bill.comparison_data?.fields?.supplier_abn?.coordinates && (
                    <Badge className="bg-green-600 text-white text-[8px] px-1 py-0 ml-auto">OCR</Badge>
                  )}
                  {!bill.comparison_data?.fields?.supplier_abn?.coordinates && bill.ai_extraction_result?.field_locations?.supplier_abn && (
                    <Badge className="bg-yellow-500 text-white text-[8px] px-1 py-0 ml-auto">AI Est.</Badge>
                  )}
                </p>
                <div className="flex items-center gap-1">
                  <p className="font-mono font-bold">
                    {(() => {
                      const abn = bill.ai_extraction_result?.supplier_abn || bill.supplier?.tax_number || "";
                      if (!abn) return "-";
                      const clean = abn.replace(/\s/g, '');
                      return clean.length === 11 ? `${clean.slice(0,2)} ${clean.slice(2,5)} ${clean.slice(5,8)} ${clean.slice(8)}` : abn;
                    })()}
                  </p>
                  {(() => {
                    const match = abnMatches(bill.ai_extraction_result?.supplier_abn, bill.supplier?.tax_number);
                    if (match === true) return <CheckCircle2 className="h-3 w-3 text-green-600" />;
                    if (match === false) return <XCircle2 className="h-3 w-3 text-red-500" />;
                    return null;
                  })()}
                </div>
              </div>
            </div>

            {/* Row 3: Bill To Company + Payment Reference */}
            <div className="grid grid-cols-2 gap-2">
              <div
                className={`p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02] ${
                  bill.ai_extraction_result?.billing_company_name
                    ? 'bg-green-100 dark:bg-green-900/40 border-2 border-green-400'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300'
                } ${highlightedField === 'billing_company_name' ? 'ring-4 ring-yellow-400 ring-offset-2 animate-pulse scale-105 shadow-lg' : ''}`}
                onClick={() => setHighlightedField(highlightedField === 'billing_company_name' ? null : 'billing_company_name')}
              >
                <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  Bill To
                  {bill.ai_extraction_result?.billing_company_name
                    ? <CheckCircle2 className="h-3 w-3 text-green-600" />
                    : <AlertTriangle className="h-3 w-3 text-amber-500" />}
                </p>
                <p className="font-bold truncate" title={bill.ai_extraction_result?.billing_company_name || bill.detected_company?.name || "-"}>
                  {bill.ai_extraction_result?.billing_company_name || bill.detected_company?.name || bill.corporate_company?.name || "-"}
                </p>
              </div>
              <div
                className={`p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02] ${
                  bill.ai_extraction_result?.payment_reference
                    ? 'bg-green-100 dark:bg-green-900/40 border-2 border-green-400'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300'
                } ${highlightedField === 'payment_reference' ? 'ring-4 ring-yellow-400 ring-offset-2 animate-pulse scale-105 shadow-lg' : ''}`}
                onClick={() => setHighlightedField(highlightedField === 'payment_reference' ? null : 'payment_reference')}
              >
                <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  Payment Ref
                  {bill.ai_extraction_result?.payment_reference
                    ? <CheckCircle2 className="h-3 w-3 text-green-600" />
                    : <AlertTriangle className="h-3 w-3 text-amber-500" />}
                </p>
                <p className="font-mono font-bold">{bill.ai_extraction_result?.payment_reference || "-"}</p>
              </div>
            </div>

            {/* Row 4: Case/Matter Reference */}
            {(bill.ai_extraction_result?.case_reference || bill.ai_extraction_result?.matter_description) && (
              <div
                className={`p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02] bg-blue-100 dark:bg-blue-900/40 border-2 border-blue-400
                ${highlightedField === 'case_reference' ? 'ring-4 ring-yellow-400 ring-offset-2 animate-pulse scale-105 shadow-lg' : ''}`}
                onClick={() => setHighlightedField(highlightedField === 'case_reference' ? null : 'case_reference')}
              >
                <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  Case/Matter
                  <CheckCircle2 className="h-3 w-3 text-blue-600" />
                </p>
                <p className="font-bold text-blue-700 truncate">
                  {bill.ai_extraction_result?.case_reference} {bill.ai_extraction_result?.matter_description}
                </p>
              </div>
            )}

            {/* Row 5: Bank Account Verification */}
            {(bill.ai_extraction_result?.supplier_bank_bsb || bill.supplier?.bank_bsb) && (
              <div
                className={`p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02] ${
                  (() => {
                    const extractedBSB = bill.ai_extraction_result?.supplier_bank_bsb?.replace(/[\s-]/g, '');
                    const storedBSB = bill.supplier?.bank_bsb?.replace(/[\s-]/g, '');
                    const extractedAcc = bill.ai_extraction_result?.supplier_bank_account?.replace(/[\s-]/g, '');
                    const storedAcc = bill.supplier?.bank_account_number?.replace(/[\s-]/g, '');
                    const bsbMatch = !extractedBSB || !storedBSB || extractedBSB === storedBSB;
                    const accMatch = !extractedAcc || !storedAcc || extractedAcc === storedAcc;
                    return bsbMatch && accMatch
                      ? 'bg-green-100 dark:bg-green-900/40 border-2 border-green-400'
                      : 'bg-red-100 dark:bg-red-900/40 border-2 border-red-400';
                  })()
                } ${highlightedField === 'supplier_bank_bsb' ? 'ring-4 ring-yellow-400 ring-offset-2 animate-pulse scale-105 shadow-lg' : ''}`}
                onClick={() => setHighlightedField(highlightedField === 'supplier_bank_bsb' ? null : 'supplier_bank_bsb')}
              >
                <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                  Bank Details
                  {(() => {
                    const extractedBSB = bill.ai_extraction_result?.supplier_bank_bsb?.replace(/[\s-]/g, '');
                    const storedBSB = bill.supplier?.bank_bsb?.replace(/[\s-]/g, '');
                    const extractedAcc = bill.ai_extraction_result?.supplier_bank_account?.replace(/[\s-]/g, '');
                    const storedAcc = bill.supplier?.bank_account_number?.replace(/[\s-]/g, '');
                    const bsbMatch = !extractedBSB || !storedBSB || extractedBSB === storedBSB;
                    const accMatch = !extractedAcc || !storedAcc || extractedAcc === storedAcc;
                    return bsbMatch && accMatch
                      ? <CheckCircle2 className="h-3 w-3 text-green-600" />
                      : <XCircle2 className="h-3 w-3 text-red-500" />;
                  })()}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono">
                    Invoice: {bill.ai_extraction_result?.supplier_bank_bsb || '-'}/{bill.ai_extraction_result?.supplier_bank_account || '-'}
                  </span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-mono">
                    Stored: {bill.supplier?.bank_bsb || '-'}/{bill.supplier?.bank_account_number || '-'}
                  </span>
                </div>
              </div>
            )}

            <Separator className="my-2" />

            {/* Amounts */}
            <div className="space-y-1">
              <div
                className={`flex justify-between p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02] ${
                  bill.ai_extraction_result?.subtotal
                    ? 'bg-green-100 dark:bg-green-900/40 border-2 border-green-400'
                    : 'bg-gray-50 dark:bg-gray-800 border border-gray-200'
                } ${highlightedField === 'subtotal' ? 'ring-4 ring-yellow-400 ring-offset-2 animate-pulse scale-105 shadow-lg' : ''}`}
                onClick={() => setHighlightedField(highlightedField === 'subtotal' ? null : 'subtotal')}
              >
                <span className="text-muted-foreground flex items-center gap-1">
                  Subtotal
                  {bill.ai_extraction_result?.subtotal && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                </span>
                <span className="font-mono font-bold">${(bill.subtotal || 0).toLocaleString('en-AU', {minimumFractionDigits: 2})}</span>
              </div>
              <div
                className={`flex justify-between p-1.5 rounded cursor-pointer transition-all hover:scale-[1.02] ${
                  bill.ai_extraction_result?.tax_amount
                    ? 'bg-green-100 dark:bg-green-900/40 border-2 border-green-400'
                    : 'bg-gray-50 dark:bg-gray-800 border border-gray-200'
                } ${highlightedField === 'tax_amount' ? 'ring-4 ring-yellow-400 ring-offset-2 animate-pulse scale-105 shadow-lg' : ''}`}
                onClick={() => setHighlightedField(highlightedField === 'tax_amount' ? null : 'tax_amount')}
              >
                <span className="text-muted-foreground flex items-center gap-1">
                  GST
                  {bill.ai_extraction_result?.tax_amount && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                </span>
                <span className="font-mono font-bold">${(bill.tax_amount || 0).toLocaleString('en-AU', {minimumFractionDigits: 2})}</span>
              </div>
              <Separator className="my-1" />
              <div
                className={`flex justify-between p-2 font-bold text-sm rounded cursor-pointer transition-all hover:scale-[1.02] ${
                  bill.ai_extraction_result?.total_amount
                    ? 'bg-green-200 dark:bg-green-900/50 border-2 border-green-500 shadow-md'
                    : 'bg-gray-100 dark:bg-gray-800 border border-gray-200'
                } ${highlightedField === 'total_amount' ? 'ring-4 ring-yellow-400 ring-offset-2 animate-pulse scale-105 shadow-lg' : ''}`}
                onClick={() => setHighlightedField(highlightedField === 'total_amount' ? null : 'total_amount')}
              >
                <span className="flex items-center gap-1">
                  Total
                  {bill.ai_extraction_result?.total_amount && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                  {bill.comparison_data?.fields?.total_amount?.coordinates && (
                    <Badge className="bg-green-600 text-white text-[8px] px-1 py-0">OCR</Badge>
                  )}
                  {!bill.comparison_data?.fields?.total_amount?.coordinates && bill.ai_extraction_result?.field_locations?.total_amount && (
                    <Badge className="bg-yellow-500 text-white text-[8px] px-1 py-0">AI Est.</Badge>
                  )}
                </span>
                <span className="font-mono text-lg">${(bill.total_amount || 0).toLocaleString('en-AU', {minimumFractionDigits: 2})}</span>
              </div>

              {/* Trust Deduction - shown when funds deducted from trust */}
              {bill.ai_extraction_result?.trust_deduction && bill.ai_extraction_result.trust_deduction > 0 && (
                <div
                  className="flex justify-between p-2 rounded cursor-pointer transition-all hover:scale-[1.02] bg-purple-100 dark:bg-purple-900/40 border-2 border-purple-400 shadow-sm"
                  style={highlightedField === 'trust_deduction' ? {
                    boxShadow: '0 0 0 4px rgba(234, 179, 8, 0.5)',
                    transform: 'scale(1.05)',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  } : {}}
                  onClick={() => setHighlightedField(highlightedField === 'trust_deduction' ? null : 'trust_deduction')}
                >
                  <span className="flex items-center gap-1 text-purple-700 font-medium">
                    <Wallet className="h-4 w-4" />
                    Less Funds in Trust
                    <CheckCircle2 className="h-3 w-3 text-purple-600" />
                  </span>
                  <span className="font-mono font-bold text-purple-700">-${bill.ai_extraction_result.trust_deduction.toLocaleString('en-AU', {minimumFractionDigits: 2})}</span>
                </div>
              )}

              {/* Balance Due - shown when different from total (e.g., after trust deduction) */}
              {bill.ai_extraction_result?.balance_due && bill.ai_extraction_result.balance_due !== bill.total_amount && (
                <div
                  className="flex justify-between p-2 rounded cursor-pointer transition-all hover:scale-[1.02] bg-emerald-200 dark:bg-emerald-900/50 border-2 border-emerald-500 shadow-md font-bold text-sm"
                  style={highlightedField === 'balance_due' ? {
                    boxShadow: '0 0 0 4px rgba(234, 179, 8, 0.5)',
                    transform: 'scale(1.05)',
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  } : {}}
                  onClick={() => setHighlightedField(highlightedField === 'balance_due' ? null : 'balance_due')}
                >
                  <span className="flex items-center gap-1 text-emerald-800">
                    <DollarSign className="h-4 w-4" />
                    Balance Due
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </span>
                  <span className="font-mono text-lg text-emerald-800">${bill.ai_extraction_result.balance_due.toLocaleString('en-AU', {minimumFractionDigits: 2})}</span>
                </div>
              )}

              {totalPaid > 0 && (
                <>
                  <div className="flex justify-between text-green-600 p-1">
                    <span>Paid</span>
                    <span className="font-mono">-${totalPaid.toLocaleString('en-AU', {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="flex justify-between font-medium p-1 bg-blue-50 dark:bg-blue-900/20 rounded">
                    <span>Remaining</span>
                    <span className="font-mono">${(bill.remaining_balance || 0).toLocaleString('en-AU', {minimumFractionDigits: 2})}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Purchase Order */}
        {(() => {
          // Determine match status color
          const hasMatch = !!bill.matched_purchase_order;
          const variancePercent = bill.variance_percent ? Math.abs(bill.variance_percent) : 0;
          const isExactMatch = hasMatch && (bill.variance_amount === null || bill.variance_amount === 0);
          const needsClarification = hasMatch && variancePercent > 0 && variancePercent <= 5;
          const isMismatch = hasMatch && variancePercent > 5;

          const borderColor = isExactMatch ? 'border-green-500' :
                             needsClarification ? 'border-amber-500' :
                             isMismatch ? 'border-red-500' :
                             'border-gray-300';
          const bgColor = isExactMatch ? 'bg-green-50 dark:bg-green-900/20' :
                         needsClarification ? 'bg-amber-50 dark:bg-amber-900/20' :
                         isMismatch ? 'bg-red-50 dark:bg-red-900/20' :
                         '';
          const headerBg = isExactMatch ? 'bg-green-600' :
                          needsClarification ? 'bg-amber-500' :
                          isMismatch ? 'bg-red-600' :
                          'bg-gray-500';
          const statusText = isExactMatch ? 'MATCHED' :
                            needsClarification ? 'REVIEW NEEDED' :
                            isMismatch ? 'MISMATCH' :
                            'NO PO';
          const StatusIcon = isExactMatch ? CheckCircle :
                            needsClarification ? AlertTriangle :
                            isMismatch ? XCircle :
                            FileText;

          return (
            <Card className={`border-2 ${borderColor} ${bgColor} overflow-auto aspect-[1/1.414] max-h-[calc(100vh-220px)]`}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Purchase Order
                  </span>
                  {hasMatch && (
                    <Badge className={`${isExactMatch ? 'bg-green-600' : needsClarification ? 'bg-amber-500' : 'bg-red-600'} text-white`}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusText}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {bill.matched_purchase_order ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-1.5 bg-gray-50 dark:bg-gray-800 rounded">
                        <p className="text-[10px] text-muted-foreground uppercase">PO Number</p>
                        <Link
                          href={`/purchase_orders/${bill.matched_purchase_order.id}`}
                          className="font-bold text-sm text-blue-600 hover:underline inline-flex items-center gap-1 font-mono"
                        >
                          {bill.matched_purchase_order.purchase_order_number}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                      <div className="p-1.5 bg-gray-50 dark:bg-gray-800 rounded">
                        <p className="text-[10px] text-muted-foreground uppercase">Payment Terms</p>
                        <p className="font-medium text-sm text-blue-600">
                          {bill.matched_purchase_order.payment_terms || bill.supplier?.payment_terms || "Net 30"}
                        </p>
                      </div>
                    </div>

                    <Separator className="my-2" />

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-1.5 bg-gray-50 dark:bg-gray-800 rounded">
                        <p className="text-[10px] text-muted-foreground uppercase">PO Total</p>
                        <p className="font-mono font-bold text-sm">${bill.matched_purchase_order.total?.toLocaleString('en-AU', {minimumFractionDigits: 2})}</p>
                      </div>
                      <div className="p-1.5 bg-gray-50 dark:bg-gray-800 rounded">
                        <p className="text-[10px] text-muted-foreground uppercase">Invoice Total</p>
                        <p className="font-mono font-bold text-sm">${(bill.total_amount || 0).toLocaleString('en-AU', {minimumFractionDigits: 2})}</p>
                      </div>
                    </div>

                    {bill.variance_amount !== null && bill.variance_amount !== 0 && (
                      <>
                        <Separator className="my-2" />
                        <div className={`p-2 rounded ${isMismatch ? "bg-red-100 dark:bg-red-900/30 border border-red-300" : "bg-amber-100 dark:bg-amber-900/30 border border-amber-300"}`}>
                          <p className="text-[10px] text-muted-foreground uppercase">Variance</p>
                          <p className={`font-mono font-bold text-sm ${isMismatch ? "text-red-600" : "text-amber-600"}`}>
                            {bill.variance_amount > 0 ? "+" : ""}${bill.variance_amount.toLocaleString('en-AU', {minimumFractionDigits: 2})}
                            {bill.variance_percent && ` (${bill.variance_percent.toFixed(1)}%)`}
                          </p>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No Purchase Order matched</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {bill.ai_extraction_result?.purchase_order_number
                        ? `Extracted PO #: ${bill.ai_extraction_result.purchase_order_number}`
                        : "No PO reference found on invoice"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Email Info */}
        {bill.source === "email" && bill.email_subject && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Email Source
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Subject</p>
                <p className="font-medium">{bill.email_subject}</p>
              </div>
              {bill.email_from && (
                <div>
                  <p className="text-sm text-muted-foreground">From</p>
                  <p className="font-medium">{bill.email_from}</p>
                </div>
              )}
              {bill.email_received_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Received</p>
                  <p className="font-medium">
                    {new Date(bill.email_received_at).toLocaleString("en-AU")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Approval Info */}
        {(bill.approved_by || bill.rejection_reason) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {bill.rejection_reason ? "Rejection" : "Approval"} Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {bill.approved_by && (
                <div>
                  <p className="text-sm text-muted-foreground">Approved By</p>
                  <p className="font-medium">
                    {bill.approved_by.first_name} {bill.approved_by.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{bill.approved_by.email}</p>
                </div>
              )}
              {bill.approved_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Approved At</p>
                  <p className="font-medium">
                    {new Date(bill.approved_at).toLocaleString("en-AU")}
                  </p>
                </div>
              )}
              {bill.rejection_reason && (
                <div>
                  <p className="text-sm text-muted-foreground">Rejection Reason</p>
                  <p className="font-medium text-red-600">{bill.rejection_reason}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payments */}
        {bill.bill_payments && bill.bill_payments.length > 0 && (
          <Card className="col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payments
              </CardTitle>
              <CardDescription>
                {bill.bill_payments.length} payment(s) totaling ${totalPaid.toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bill.bill_payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{payment.payee_name}</p>
                      {payment.bill_payment_batch && (
                        <p className="text-sm text-muted-foreground">
                          Batch: {payment.bill_payment_batch.batch_reference}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-medium">
                        ${payment.amount.toLocaleString()}
                      </p>
                      <Badge variant="outline" className="capitalize">
                        {payment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        </div>{/* End Details Grid */}
      </div>{/* End Left Half */}

      {/* RIGHT HALF - PDF Preview (A4 portrait aspect ratio) */}
      <div className="shrink-0 sticky top-0 h-[calc(100vh-80px)] aspect-[1/1.414]">
        <Card className="h-full w-full">
          <CardContent className="p-2 h-full">
            {pdfLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30 h-full">
                <Spinner />
                <p className="text-sm text-muted-foreground mt-4">Loading invoice...</p>
              </div>
            ) : pdfBlobUrl && !pdfError ? (
              <div className="relative w-full h-full border rounded-lg overflow-hidden">
                {bill.invoice_file_content_type === "application/pdf" ? (
                  <PDFViewer
                    url={`${getApiBaseUrl()}/api/v1/bill_inbox/${billId}/download`}
                    className="w-full h-full"
                    fallbackUrl={pdfBlobUrl}
                    onError={(e) => setPdfError(e.message)}
                    highlights={pdfHighlights}
                  />
                ) : bill.invoice_file_content_type?.startsWith("image/") ? (
                  <div className="w-full h-full flex items-center justify-center bg-muted/30 p-4">
                    <img
                      src={pdfBlobUrl}
                      alt="Invoice"
                      className="max-w-full max-h-full object-contain rounded"
                    />
                  </div>
                ) : (
                  <iframe
                    src={pdfBlobUrl}
                    className="w-full h-full"
                    title="Invoice Preview"
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30 h-full">
                <FileWarning className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">
                  {pdfError ? "Error Loading Invoice" : "No Invoice File"}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  {pdfError
                    ? pdfError
                    : bill.notes?.includes("FileNotFoundError")
                    ? "The invoice file could not be found in storage."
                    : "No invoice file has been attached to this bill."}
                </p>
                {(bill.status === "error" || pdfError) && bill["has_invoice_file?"] && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => loadPdf()}
                    disabled={pdfLoading}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Retry Loading
                  </Button>
                )}
                {bill.status === "error" && (
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={handleExtract}
                    disabled={actionLoading}
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Re-extract Data
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>{/* End Right Half */}

      {/* PDF Expanded Dialog */}
      <Dialog open={pdfExpandedOpen} onOpenChange={setPdfExpandedOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] h-[95vh] max-h-[95vh] p-0">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5" />
                <div>
                  <h2 className="font-semibold">{bill.invoice_file_filename || "Invoice Document"}</h2>
                  <p className="text-sm text-muted-foreground">
                    {bill.invoice_number} - {bill.supplier?.display_name || bill.supplier_name_raw}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleOpenInApp}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPdfExpandedOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-muted/30">
              {bill.invoice_file_content_type === "application/pdf" ? (
                <PDFViewer
                  url={`${getApiBaseUrl()}/api/v1/bill_inbox/${billId}/download`}
                  className="w-full h-full"
                  fallbackUrl={pdfBlobUrl || undefined}
                  onError={(e) => setPdfError(e.message)}
                />
              ) : bill.invoice_file_content_type?.startsWith("image/") ? (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img
                    src={pdfBlobUrl || ""}
                    alt="Invoice"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  src={pdfBlobUrl}
                  className="w-full h-full"
                  title="Invoice Preview"
                />
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Bill</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this bill.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading || !rejectReason.trim()}
            >
              Reject Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
