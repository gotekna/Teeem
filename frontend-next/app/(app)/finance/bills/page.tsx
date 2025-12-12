"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Eye,
  Wand2,
  Link2,
  ArrowLeft,
  Clock,
  Inbox,
  Filter,
} from "lucide-react";
import { api } from "@/lib/api";

interface BillInbox {
  id: number;
  invoice_number: string;
  supplier_name_raw: string;
  total_amount: number;
  due_date: string;
  invoice_date: string;
  status: string;
  match_status: string;
  variance_amount: number | null;
  ai_confidence: number | null;
  corporate_company: {
    id: number;
    name: string;
    code: string;
  } | null;
  supplier: {
    id: number;
    display_name: string;
    tax_number: string;
  } | null;
  matched_purchase_order: {
    id: number;
    purchase_order_number: string;
    total: number;
  } | null;
}

interface BillsResponse {
  bills: BillInbox[];
  meta: {
    total_count: number;
    total_pages: number;
    current_page: number;
  };
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

export default function BillInboxPage() {
  const [bills, setBills] = useState<BillInbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [matchFilter, setMatchFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Dialog states
  const [selectedBill, setSelectedBill] = useState<BillInbox | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadBills = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("per_page", "25");
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (matchFilter !== "all") params.set("match_status", matchFilter);
      if (searchQuery) params.set("search", searchQuery);

      const response = await api.get<BillsResponse>(`/api/v1/bill_inbox?${params}`);
      setBills(response.bills || []);
      setTotalPages(response.meta?.total_pages || 1);
      setTotalCount(response.meta?.total_count || 0);
    } catch (error) {
      console.error("Failed to load bills:", error);
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, matchFilter, searchQuery]);

  useEffect(() => {
    loadBills();
  }, [loadBills]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Trigger email sync job
      await api.post("/api/v1/bill_inbox_sync_job/run");
      await loadBills();
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setSyncing(false);
    }
  };

  const handleExtract = async (billId: number) => {
    setActionLoading(true);
    try {
      await api.post(`/api/v1/bill_inbox/${billId}/extract`);
      await loadBills();
    } catch (error) {
      console.error("Extract failed:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMatch = async (billId: number) => {
    setActionLoading(true);
    try {
      await api.post(`/api/v1/bill_inbox/${billId}/match`);
      await loadBills();
    } catch (error) {
      console.error("Match failed:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (billId: number) => {
    setActionLoading(true);
    try {
      await api.post(`/api/v1/bill_inbox/${billId}/approve`);
      await loadBills();
    } catch (error) {
      console.error("Approve failed:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedBill) return;
    setActionLoading(true);
    try {
      await api.post(`/api/v1/bill_inbox/${selectedBill.id}/reject`, {
        reason: rejectReason,
      });
      setRejectDialogOpen(false);
      setRejectReason("");
      setSelectedBill(null);
      await loadBills();
    } catch (error) {
      console.error("Reject failed:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPdf = async (billId: number) => {
    // Open PDF in system default app (Preview on Mac, etc)
    try {
      const token = localStorage.getItem("token");
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(
        `${baseUrl}/api/v1/bill_inbox/${billId}/download?disposition=attachment`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to download file");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      // Get filename from response headers or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="?([^";\n]+)"?/);
      const filename = filenameMatch?.[1] || `invoice-${billId}.pdf`;

      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Failed to open PDF:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/finance">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Bill Inbox</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {totalCount} bills from Pay@tekna.com.au
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Emails"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="extracting">Extracting</SelectItem>
                <SelectItem value="extracted">Extracted</SelectItem>
                <SelectItem value="approval_pending">Awaiting Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={matchFilter}
              onValueChange={(v) => {
                setMatchFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <Link2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Match Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Matches</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="no_po_required">No PO Required</SelectItem>
                <SelectItem value="variance">Variance</SelectItem>
                <SelectItem value="no_match">No Match</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bills Table */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Spinner />
        </div>
      ) : bills.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No bills found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Bills from Pay@tekna.com.au will appear here after sync.
            </p>
            <Button className="mt-4" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              Sync Emails
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Match</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">
                      {bill.invoice_number || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {bill.supplier?.display_name || bill.supplier_name_raw || "Unknown"}
                  </TableCell>
                  <TableCell>
                    {bill.corporate_company?.code || "-"}
                  </TableCell>
                  <TableCell>
                    {bill.invoice_date
                      ? new Date(bill.invoice_date).toLocaleDateString("en-AU")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        bill.due_date && new Date(bill.due_date) < new Date()
                          ? "text-red-600 font-medium"
                          : ""
                      }
                    >
                      {bill.due_date
                        ? new Date(bill.due_date).toLocaleDateString("en-AU")
                        : "-"}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono">
                    ${(bill.total_amount || 0).toLocaleString()}
                    {bill.variance_amount && bill.variance_amount !== 0 && (
                      <span className="text-xs text-yellow-600 ml-1">
                        ({bill.variance_amount > 0 ? "+" : ""}
                        {bill.variance_amount.toLocaleString()})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[bill.status] || statusColors.pending}>
                      {bill.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={matchStatusColors[bill.match_status] || matchStatusColors.pending}
                    >
                      {bill.match_status?.replace("_", " ") || "pending"}
                    </Badge>
                    {bill.matched_purchase_order && (
                      <Link
                        href={`/purchase_orders/${bill.matched_purchase_order.id}`}
                        className="text-xs text-blue-600 hover:underline ml-2"
                      >
                        {bill.matched_purchase_order.purchase_order_number}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {bill.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExtract(bill.id)}
                          disabled={actionLoading}
                          title="Extract Invoice Data"
                        >
                          <Wand2 className="h-4 w-4" />
                        </Button>
                      )}
                      {bill.status === "extracted" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMatch(bill.id)}
                          disabled={actionLoading}
                          title="Match to PO"
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                      )}
                      {bill.status === "approval_pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700"
                            onClick={() => handleApprove(bill.id)}
                            disabled={actionLoading}
                            title="Approve"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => {
                              setSelectedBill(bill);
                              setRejectDialogOpen(true);
                            }}
                            disabled={actionLoading}
                            title="Reject"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenPdf(bill.id)}
                        title="Open PDF in Preview"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        title="View Details"
                      >
                        <Link href={`/finance/bills/${bill.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

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
                setSelectedBill(null);
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
