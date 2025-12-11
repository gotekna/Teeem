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
  } | null;
  matched_purchase_order: {
    id: number;
    purchase_order_number: string;
    total: number;
    status: string;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/finance/bills">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight font-serif">
                {bill.invoice_number || "No Invoice #"}
              </h1>
              <Badge className={statusColors[bill.status] || statusColors.pending}>
                {bill.status.replace("_", " ")}
              </Badge>
              <Badge className={matchStatusColors[bill.match_status] || matchStatusColors.pending}>
                {bill.match_status?.replace("_", " ") || "pending"}
              </Badge>
              {bill.xero_tenant_name && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                  Xero: {bill.xero_tenant_name}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {bill.supplier?.display_name || bill.supplier_name_raw || "Unknown Supplier"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bill.status === "pending" && (
            <Button onClick={handleExtract} disabled={actionLoading}>
              <Wand2 className="h-4 w-4 mr-2" />
              Extract Data
            </Button>
          )}
          {bill.status === "extracted" && (
            <Button onClick={handleMatch} disabled={actionLoading}>
              <Link2 className="h-4 w-4 mr-2" />
              Match to PO
            </Button>
          )}
          {bill.status === "approval_pending" && (
            <>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={() => setRejectDialogOpen(true)}
                disabled={actionLoading}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={handleApprove}
                disabled={actionLoading}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* PDF Preview - Takes up 1 column on large screens, full height */}
        <Card className="lg:col-span-1 lg:row-span-3 lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {bill.invoice_file_content_type?.startsWith("image/") ? (
                  <ImageIcon className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
                Invoice Document
              </span>
              {pdfBlobUrl && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPdfExpandedOpen(true)} title="View fullscreen">
                    <Maximize2 className="h-4 w-4 mr-1" />
                    Expand
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleOpenInApp} title="Open in Preview/PDF app">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              )}
            </CardTitle>
            {bill.invoice_file_filename && (
              <CardDescription>{bill.invoice_file_filename}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {pdfLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30" style={{ height: "calc(100vh - 250px)", minHeight: "600px" }}>
                <Loader />
                <p className="text-sm text-muted-foreground mt-4">Loading invoice...</p>
              </div>
            ) : pdfBlobUrl && !pdfError ? (
              <div className="relative w-full border rounded-lg overflow-hidden" style={{ height: "calc(100vh - 250px)", minHeight: "600px" }}>
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
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30" style={{ height: "calc(100vh - 250px)", minHeight: "400px" }}>
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

        {/* Details Column - Takes up 2 columns on large screens */}
        <div className="lg:col-span-2 grid gap-6 md:grid-cols-2">
        {/* Invoice Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Invoice Number</p>
                <p className="font-medium font-mono">{bill.invoice_number || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Invoice Date</p>
                <p className="font-medium">
                  {bill.invoice_date
                    ? new Date(bill.invoice_date).toLocaleDateString("en-AU")
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className={`font-medium ${isOverdue ? "text-red-600" : ""}`}>
                  {bill.due_date
                    ? new Date(bill.due_date).toLocaleDateString("en-AU")
                    : "-"}
                  {isOverdue && (
                    <span className="ml-2 text-xs">(Overdue)</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Source</p>
                <p className="font-medium capitalize">{bill.source || "email"}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-mono">${(bill.subtotal || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax (GST)</span>
                <span className="font-mono">${(bill.tax_amount || 0).toLocaleString()}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="font-mono">${(bill.total_amount || 0).toLocaleString()}</span>
              </div>
              {totalPaid > 0 && (
                <>
                  <div className="flex justify-between text-green-600">
                    <span>Paid</span>
                    <span className="font-mono">-${totalPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Remaining</span>
                    <span className="font-mono">${(bill.remaining_balance || 0).toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>

            {bill.ai_confidence != null && (
              <div className="pt-2">
                <p className="text-sm text-muted-foreground">AI Confidence</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full">
                    <div
                      className="h-2 bg-blue-500 rounded-full"
                      style={{ width: `${bill.ai_confidence <= 1 ? bill.ai_confidence * 100 : bill.ai_confidence}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {bill.ai_confidence <= 1 ? Math.round(bill.ai_confidence * 100) : bill.ai_confidence}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Supplier & Company */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Supplier & Company
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Supplier</p>
              {bill.supplier ? (
                <div className="mt-1">
                  <Link
                    href={`/contacts/${bill.supplier.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {bill.supplier.display_name}
                  </Link>
                  {bill.supplier.tax_number && (
                    <p className="text-sm text-muted-foreground">
                      ABN: {bill.supplier.tax_number}
                    </p>
                  )}
                  {bill.supplier.bank_bsb && (
                    <p className="text-sm text-muted-foreground">
                      BSB: {bill.supplier.bank_bsb} / Acc: {bill.supplier.bank_account_number}
                    </p>
                  )}
                </div>
              ) : (
                <p className="font-medium">{bill.supplier_name_raw || "Unknown"}</p>
              )}
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground">Billing Company (on invoice)</p>
              {bill.detected_company ? (
                <div className="mt-1">
                  <p className="font-medium">{bill.detected_company.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Code: {bill.detected_company.code}
                  </p>
                  {bill.detected_company.abn && (
                    <p className="text-sm text-muted-foreground">
                      ABN: {bill.detected_company.abn}
                    </p>
                  )}
                </div>
              ) : bill.ai_extraction_result?.billing_company_name ? (
                <div className="mt-1">
                  <p className="font-medium">{bill.ai_extraction_result.billing_company_name}</p>
                  {bill.ai_extraction_result.billing_company_abn && (
                    <p className="text-sm text-muted-foreground">
                      ABN: {bill.ai_extraction_result.billing_company_abn}
                    </p>
                  )}
                  <p className="text-xs text-yellow-600 mt-1">Not matched to company</p>
                </div>
              ) : (
                <p className="text-muted-foreground">Not detected</p>
              )}
            </div>

            <Separator />

            <div>
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Pay From</p>
              </div>
              {bill.corporate_company ? (
                <div className="mt-1 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                  <p className="font-medium text-green-700 dark:text-green-400">{bill.corporate_company.name}</p>
                  <p className="text-sm text-green-600 dark:text-green-500">
                    Code: {bill.corporate_company.code}
                  </p>
                  {bill.corporate_company.abn && (
                    <p className="text-sm text-green-600 dark:text-green-500">
                      ABN: {bill.corporate_company.abn}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-1 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                  <p className="text-yellow-700 dark:text-yellow-400">Not assigned</p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-500">Assign a company to process payment</p>
                </div>
              )}
            </div>

            {bill.matched_purchase_order && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Matched Purchase Order</p>
                  <div className="mt-1">
                    <Link
                      href={`/purchase_orders/${bill.matched_purchase_order.id}`}
                      className="font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      {bill.matched_purchase_order.purchase_order_number}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      Total: ${bill.matched_purchase_order.total?.toLocaleString()}
                    </p>
                    {bill.variance_amount !== null && bill.variance_amount !== 0 && (
                      <p className={`text-sm ${bill.variance_amount > 0 ? "text-yellow-600" : "text-green-600"}`}>
                        Variance: {bill.variance_amount > 0 ? "+" : ""}
                        ${bill.variance_amount.toLocaleString()}
                        {bill.variance_percent && ` (${bill.variance_percent.toFixed(1)}%)`}
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

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

        {/* Extracted Data */}
        {bill.ai_extraction_result && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScanText className="h-5 w-5" />
                AI Extracted Data
              </CardTitle>
              {bill.extracted_at && (
                <CardDescription>
                  Extracted {new Date(bill.extracted_at).toLocaleString("en-AU")}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {bill.ai_extraction_result.invoice_number && (
                  <div
                    className={`cursor-pointer rounded p-1.5 -m-1.5 transition-colors ${highlightedField === 'invoice_number' ? 'bg-yellow-100 dark:bg-yellow-900/30' : hasLocation('invoice_number') ? 'hover:bg-muted' : ''}`}
                    onClick={() => hasLocation('invoice_number') && toggleHighlight('invoice_number')}
                  >
                    <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      Invoice #
                      {hasLocation('invoice_number') && <MapPin className="h-3 w-3 text-yellow-500" />}
                    </p>
                    <p className="font-mono text-sm">{bill.ai_extraction_result.invoice_number}</p>
                  </div>
                )}
                {bill.ai_extraction_result.invoice_date && (
                  <div
                    className={`cursor-pointer rounded p-1.5 -m-1.5 transition-colors ${highlightedField === 'invoice_date' ? 'bg-yellow-100 dark:bg-yellow-900/30' : hasLocation('invoice_date') ? 'hover:bg-muted' : ''}`}
                    onClick={() => hasLocation('invoice_date') && toggleHighlight('invoice_date')}
                  >
                    <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      Invoice Date
                      {hasLocation('invoice_date') && <MapPin className="h-3 w-3 text-yellow-500" />}
                    </p>
                    <p className="text-sm">{bill.ai_extraction_result.invoice_date}</p>
                  </div>
                )}
                {bill.ai_extraction_result.due_date && (
                  <div
                    className={`cursor-pointer rounded p-1.5 -m-1.5 transition-colors ${highlightedField === 'due_date' ? 'bg-yellow-100 dark:bg-yellow-900/30' : hasLocation('due_date') ? 'hover:bg-muted' : ''}`}
                    onClick={() => hasLocation('due_date') && toggleHighlight('due_date')}
                  >
                    <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      Due Date
                      {hasLocation('due_date') && <MapPin className="h-3 w-3 text-yellow-500" />}
                    </p>
                    <p className="text-sm">{bill.ai_extraction_result.due_date}</p>
                  </div>
                )}
                {bill.ai_extraction_result.supplier_name && (
                  <div
                    className={`cursor-pointer rounded p-1.5 -m-1.5 transition-colors ${highlightedField === 'supplier_name' ? 'bg-yellow-100 dark:bg-yellow-900/30' : hasLocation('supplier_name') ? 'hover:bg-muted' : ''}`}
                    onClick={() => hasLocation('supplier_name') && toggleHighlight('supplier_name')}
                  >
                    <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      Supplier Name
                      {hasLocation('supplier_name') && <MapPin className="h-3 w-3 text-yellow-500" />}
                    </p>
                    <p className="text-sm">{bill.ai_extraction_result.supplier_name}</p>
                  </div>
                )}
                {bill.ai_extraction_result.supplier_abn && (
                  <div
                    className={`cursor-pointer rounded p-1.5 -m-1.5 transition-colors ${highlightedField === 'supplier_abn' ? 'bg-yellow-100 dark:bg-yellow-900/30' : hasLocation('supplier_abn') ? 'hover:bg-muted' : ''}`}
                    onClick={() => hasLocation('supplier_abn') && toggleHighlight('supplier_abn')}
                  >
                    <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      Supplier ABN
                      {hasLocation('supplier_abn') && <MapPin className="h-3 w-3 text-yellow-500" />}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm">{bill.ai_extraction_result.supplier_abn}</p>
                      {(() => {
                        const match = abnMatches(bill.ai_extraction_result.supplier_abn, bill.supplier?.tax_number);
                        if (match === true) {
                          return (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="h-3 w-3" />
                              100% Match
                            </span>
                          );
                        } else if (match === false) {
                          return (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                              <XCircle2 className="h-3 w-3" />
                              Mismatch
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {bill.supplier?.tax_number && abnMatches(bill.ai_extraction_result.supplier_abn, bill.supplier.tax_number) === false && (
                      <p className="text-xs text-red-500 mt-1">
                        Stored: {bill.supplier.tax_number}
                      </p>
                    )}
                  </div>
                )}
                {bill.ai_extraction_result.billing_company_name && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Billing Company</p>
                    <p className="text-sm">{bill.ai_extraction_result.billing_company_name}</p>
                  </div>
                )}
                {bill.ai_extraction_result.billing_company_abn && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Billing ABN</p>
                    <p className="font-mono text-sm">{bill.ai_extraction_result.billing_company_abn}</p>
                  </div>
                )}
                {bill.ai_extraction_result.purchase_order_number && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">PO Reference</p>
                    <p className="font-mono text-sm">{bill.ai_extraction_result.purchase_order_number}</p>
                  </div>
                )}
                {bill.ai_extraction_result.subtotal != null && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Subtotal</p>
                    <p className="font-mono text-sm">${Number(bill.ai_extraction_result.subtotal).toLocaleString()}</p>
                  </div>
                )}
                {bill.ai_extraction_result.tax_amount != null && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Tax/GST</p>
                    <p className="font-mono text-sm">${Number(bill.ai_extraction_result.tax_amount).toLocaleString()}</p>
                  </div>
                )}
                {bill.ai_extraction_result.total_amount != null && (
                  <div
                    className={`cursor-pointer rounded p-1.5 -m-1.5 transition-colors ${highlightedField === 'total_amount' ? 'bg-yellow-100 dark:bg-yellow-900/30' : hasLocation('total_amount') ? 'hover:bg-muted' : ''}`}
                    onClick={() => hasLocation('total_amount') && toggleHighlight('total_amount')}
                  >
                    <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      Total
                      {hasLocation('total_amount') && <MapPin className="h-3 w-3 text-yellow-500" />}
                    </p>
                    <p className="font-mono text-sm font-medium">${Number(bill.ai_extraction_result.total_amount).toLocaleString()}</p>
                  </div>
                )}
                {bill.ai_extraction_result.payment_terms && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Payment Terms</p>
                    <p className="text-sm">{bill.ai_extraction_result.payment_terms}</p>
                  </div>
                )}
              </div>
              {bill.ai_extraction_result.line_items && bill.ai_extraction_result.line_items.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Line Items ({bill.ai_extraction_result.line_items.length})</p>
                  <div className="space-y-2">
                    {bill.ai_extraction_result.line_items.slice(0, 5).map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm p-2 bg-muted/30 rounded">
                        <span className="truncate flex-1 mr-4">{item.description || "Item " + (idx + 1)}</span>
                        <span className="font-mono">${Number(item.amount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                    {bill.ai_extraction_result.line_items.length > 5 && (
                      <p className="text-xs text-muted-foreground">+ {bill.ai_extraction_result.line_items.length - 5} more items</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Payments */}
        {bill.bill_payments && bill.bill_payments.length > 0 && (
          <Card className="md:col-span-2">
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

        {/* Notes */}
        {bill.notes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{bill.notes}</p>
            </CardContent>
          </Card>
        )}
        </div>{/* End Details Column */}
      </div>

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
