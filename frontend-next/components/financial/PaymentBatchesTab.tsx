"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  Plus,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  Send,
  Trash2,
  Building2,
  DollarSign,
  CreditCard,
  FileDown,
  AlertCircle,
  Eye,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface PaymentBatchItem {
  id: number;
  contact: { id: number; name: string };
  invoice: { id: number; invoice_number: string } | null;
  amount: number;
  reference: string;
}

interface PaymentBatch {
  id: number;
  status: "draft" | "pending_approval" | "approved" | "processing" | "completed" | "failed";
  payment_date: string;
  total_amount: number;
  item_count: number;
  bank_account: { id: number; name: string; account_number: string } | null;
  created_by: { id: number; name: string };
  approved_by: { id: number; name: string } | null;
  aba_generated_at: string | null;
  aba_file_name: string | null;
  items?: PaymentBatchItem[];
  created_at: string;
}

interface BatchSummary {
  by_status: {
    draft: number;
    pending_approval: number;
    approved: number;
    completed: number;
  };
  pending_amount: number;
  approved_amount: number;
  this_month: number;
}

export default function PaymentBatchesTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [batches, setBatches] = useState<PaymentBatch[]>([]);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [filter, setFilter] = useState<"all" | "draft" | "pending_approval" | "approved" | "completed">("all");
  const [selectedBatch, setSelectedBatch] = useState<PaymentBatch | null>(null);
  const [showBatchDialog, setShowBatchDialog] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const statusParam = filter === "all" ? "" : `?status=${filter}`;
      const [batchesRes, summaryRes] = await Promise.all([
        api.get<{ success: boolean; data: PaymentBatch[] }>(`/api/v1/gl/payment_batches${statusParam}`),
        api.get<{ success: boolean; data: BatchSummary }>("/api/v1/gl/payment_batches/summary"),
      ]);

      if (batchesRes?.success) setBatches(batchesRes.data || []);
      if (summaryRes?.success) setSummary(summaryRes.data);
    } catch (error) {
      console.error("Failed to fetch payment batches:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleViewBatch = async (batch: PaymentBatch) => {
    try {
      const response = await api.get<{ success: boolean; data: PaymentBatch }>(
        `/api/v1/gl/payment_batches/${batch.id}`
      );
      if (response?.success) {
        setSelectedBatch(response.data);
        setShowBatchDialog(true);
      }
    } catch (error) {
      console.error("Failed to fetch batch details:", error);
    }
  };

  const handleSubmit = async (batch: PaymentBatch) => {
    try {
      await api.post(`/api/v1/gl/payment_batches/${batch.id}/submit`);
      fetchData();
    } catch (error) {
      console.error("Failed to submit batch:", error);
    }
  };

  const handleApprove = async (batch: PaymentBatch) => {
    try {
      await api.post(`/api/v1/gl/payment_batches/${batch.id}/approve`);
      fetchData();
    } catch (error) {
      console.error("Failed to approve batch:", error);
    }
  };

  const handleGenerateAba = async (batch: PaymentBatch) => {
    try {
      await api.post(`/api/v1/gl/payment_batches/${batch.id}/generate_aba`);
      fetchData();
    } catch (error) {
      console.error("Failed to generate ABA:", error);
    }
  };

  const handleDownloadAba = async (batch: PaymentBatch) => {
    try {
      const response = await api.get<Blob>(
        `/api/v1/gl/payment_batches/${batch.id}/download_aba`,
        { responseType: "blob" } as never
      );
      const url = window.URL.createObjectURL(response);
      const a = document.createElement("a");
      a.href = url;
      a.download = batch.aba_file_name || `batch_${batch.id}.aba`;
      a.click();
    } catch (error) {
      console.error("Failed to download ABA:", error);
    }
  };

  const handleComplete = async (batch: PaymentBatch) => {
    try {
      await api.post(`/api/v1/gl/payment_batches/${batch.id}/complete`);
      fetchData();
    } catch (error) {
      console.error("Failed to complete batch:", error);
    }
  };

  const handleDelete = async (batch: PaymentBatch) => {
    if (!confirm("Are you sure you want to delete this batch?")) return;
    try {
      await api.delete(`/api/v1/gl/payment_batches/${batch.id}`);
      fetchData();
    } catch (error) {
      console.error("Failed to delete batch:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <Badge variant="secondary">
            <FileText className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      case "pending_approval":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Clock className="h-3 w-3 mr-1" />
            Pending Approval
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Draft Batches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.by_status.draft}</div>
              <p className="text-xs text-muted-foreground mt-1">in preparation</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Approval
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {summary.by_status.pending_approval}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(summary.pending_amount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ready to Process
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {summary.by_status.approved}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(summary.approved_amount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed (This Month)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary.this_month)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.by_status.completed} batches
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Batches List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Batches
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No payment batches</p>
              <p className="text-sm mt-1">
                {filter === "all" ? "No batches found" : `No ${filter.replace("_", " ")} batches`}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead>Bank Account</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">ABA</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                      <div className="font-medium">Batch #{batch.id}</div>
                      <div className="text-xs text-muted-foreground">
                        by {batch.created_by?.name || "Unknown"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {batch.bank_account ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="text-sm">{batch.bank_account.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {batch.bank_account.account_number}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{batch.item_count}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(batch.total_amount)}
                    </TableCell>
                    <TableCell>{formatDate(batch.payment_date)}</TableCell>
                    <TableCell>{getStatusBadge(batch.status)}</TableCell>
                    <TableCell className="text-center">
                      {batch.aba_generated_at ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownloadAba(batch)}
                          title="Download ABA File"
                        >
                          <FileDown className="h-4 w-4 text-green-600" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewBatch(batch)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {batch.status === "draft" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSubmit(batch)}
                              title="Submit for Approval"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleDelete(batch)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {batch.status === "pending_approval" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(batch)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        )}
                        {batch.status === "approved" && !batch.aba_generated_at && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerateAba(batch)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Generate ABA
                          </Button>
                        )}
                        {batch.status === "approved" && batch.aba_generated_at && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleComplete(batch)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Batch Detail Dialog */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Batch #{selectedBatch?.id} Details
            </DialogTitle>
            <DialogDescription>
              {selectedBatch && getStatusBadge(selectedBatch.status)}
            </DialogDescription>
          </DialogHeader>

          {selectedBatch && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Total Amount</div>
                  <div className="text-xl font-bold">{formatCurrency(selectedBatch.total_amount)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Payment Date</div>
                  <div className="text-lg font-medium">{formatDate(selectedBatch.payment_date)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Created By</div>
                  <div className="text-lg font-medium">{selectedBatch.created_by?.name}</div>
                </div>
              </div>

              {selectedBatch.items && selectedBatch.items.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Payment Items ({selectedBatch.items.length})</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payee</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBatch.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.contact?.name}</TableCell>
                          <TableCell>{item.invoice?.invoice_number || "-"}</TableCell>
                          <TableCell>{item.reference || "-"}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatchDialog(false)}>
              Close
            </Button>
            {selectedBatch?.aba_generated_at && (
              <Button onClick={() => handleDownloadAba(selectedBatch)}>
                <Download className="h-4 w-4 mr-2" />
                Download ABA
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
