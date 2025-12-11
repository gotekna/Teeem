"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { api, getApiBaseUrl } from "@/lib/api";
import { PDFViewer } from "@/components/ui/pdf-viewer";

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
  corporate_company: {
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
        {/* PDF Preview - Takes up 1 column on large screens */}
        <Card className="lg:col-span-1 lg:row-span-2">
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
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30" style={{ height: "600px" }}>
                <Loader />
                <p className="text-sm text-muted-foreground mt-4">Loading invoice...</p>
              </div>
            ) : pdfBlobUrl && !pdfError ? (
              <div className="relative w-full border rounded-lg overflow-hidden" style={{ height: "600px" }}>
                {bill.invoice_file_content_type === "application/pdf" ? (
                  <PDFViewer
                    url={`${getApiBaseUrl()}/api/v1/bill_inbox/${billId}/download`}
                    className="w-full h-full"
                    fallbackUrl={pdfBlobUrl}
                    onError={(e) => setPdfError(e.message)}
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
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30" style={{ height: "400px" }}>
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

            {bill.ai_confidence && (
              <div className="pt-2">
                <p className="text-sm text-muted-foreground">AI Confidence</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full">
                    <div
                      className="h-2 bg-blue-500 rounded-full"
                      style={{ width: `${bill.ai_confidence}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{bill.ai_confidence}%</span>
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
              <p className="text-sm text-muted-foreground">Billing Company</p>
              {bill.corporate_company ? (
                <div className="mt-1">
                  <p className="font-medium">{bill.corporate_company.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Code: {bill.corporate_company.code}
                  </p>
                  {bill.corporate_company.abn && (
                    <p className="text-sm text-muted-foreground">
                      ABN: {bill.corporate_company.abn}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Not assigned</p>
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
