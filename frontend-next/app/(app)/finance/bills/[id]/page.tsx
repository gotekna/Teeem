"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
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
  [key: string]: unknown;
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

  // Build highlights array from field_locations
  const pdfHighlights: FieldHighlight[] = React.useMemo(() => {
    if (!highlightedField || !bill?.ai_extraction_result?.field_locations) return [];

    const location = bill.ai_extraction_result.field_locations[highlightedField];
    if (!location) return [];

    const fieldLabels: Record<string, string> = {
      supplier_name: "Supplier Name",
      supplier_abn: "Supplier ABN",
      invoice_number: "Invoice #",
      invoice_date: "Invoice Date",
      due_date: "Due Date",
      total_amount: "Total Amount",
      subtotal: "Subtotal",
      tax_amount: "Tax/GST",
      bill_to_name: "Bill To",
      bill_to_abn: "Bill To ABN",
    };

    return [{
      x: location.x,
      y: location.y,
      width: location.width,
      height: location.height,
      page: location.page || 1,
      label: fieldLabels[highlightedField] || highlightedField,
      color: "#eab308" // yellow
    }];
  }, [highlightedField, bill?.ai_extraction_result?.field_locations]);

  // Helper to check if a field has location data
  const hasLocation = (fieldName: string): boolean => {
    return !!bill?.ai_extraction_result?.field_locations?.[fieldName];
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
        <Loader />
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
          {/* Match % Box */}
          <div className={`px-2 py-1 rounded min-w-[70px] ${
            bill.ai_confidence && bill.ai_confidence >= 0.9 ? 'bg-green-600' :
            bill.ai_confidence && bill.ai_confidence >= 0.7 ? 'bg-yellow-500' :
            'bg-orange-500'
          } text-white`}>
            <div className="text-[10px] uppercase tracking-wide opacity-80">Match %</div>
            <div className="font-bold text-sm font-mono">
              {bill.ai_confidence ? `${Math.round((bill.ai_confidence <= 1 ? bill.ai_confidence * 100 : bill.ai_confidence))}%` : "-"}
            </div>
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
                      <span className="font-mono font-bold text-emerald-700">${(bill.remaining_balance || bill.total_amount || 0).toLocaleString('en-AU', {minimumFractionDigits: 2})}</span>
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
                      <span className="font-mono font-bold text-emerald-700">${(bill.remaining_balance || bill.total_amount || 0).toLocaleString('en-AU', {minimumFractionDigits: 2})}</span>
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
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              Invoice Details
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

            {/* Row 3: Billing Company ABN */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-1.5 bg-gray-50 dark:bg-gray-800 rounded">
                <p className="text-[10px] text-muted-foreground uppercase">Bill To (Company)</p>
                <p className="font-medium truncate">{bill.detected_company?.name || bill.corporate_company?.name || "-"}</p>
              </div>
              <div className="p-1.5 bg-gray-50 dark:bg-gray-800 rounded">
                <p className="text-[10px] text-muted-foreground uppercase">Company ABN</p>
                <p className="font-mono font-medium">
                  {(() => {
                    const abn = bill.detected_company?.abn || bill.corporate_company?.abn || "";
                    if (!abn) return "-";
                    const clean = abn.replace(/\s/g, '');
                    return clean.length === 11 ? `${clean.slice(0,2)} ${clean.slice(2,5)} ${clean.slice(5,8)} ${clean.slice(8)}` : abn;
                  })()}
                </p>
              </div>
            </div>

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
                } ${highlightedField === 'gst' ? 'ring-4 ring-yellow-400 ring-offset-2 animate-pulse scale-105 shadow-lg' : ''}`}
                onClick={() => setHighlightedField(highlightedField === 'gst' ? null : 'gst')}
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
                } ${highlightedField === 'total' ? 'ring-4 ring-yellow-400 ring-offset-2 animate-pulse scale-105 shadow-lg' : ''}`}
                onClick={() => setHighlightedField(highlightedField === 'total' ? null : 'total')}
              >
                <span className="flex items-center gap-1">
                  Total
                  {bill.ai_extraction_result?.total_amount && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                </span>
                <span className="font-mono text-lg">${(bill.total_amount || 0).toLocaleString('en-AU', {minimumFractionDigits: 2})}</span>
              </div>
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
                <Loader />
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
