"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  ArrowRight,
  Eye,
  ThumbsUp,
  ThumbsDown,
  History,
  Shield,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";

interface Bill {
  id: number;
  invoice_number: string;
  contact_id: number;
  contact_name: string;
  total: number;
  invoice_date: string;
  due_date: string | null;
  status: string;
  reference: string | null;
  description: string | null;
  source: string;
}

interface DuplicatePair {
  bill1: Bill;
  bill2: Bill;
  score: number;
  match_type: "exact_invoice_number" | "same_amount" | "fuzzy";
  reasoning: string;
}

interface DuplicateReview {
  id: number;
  bill1: Bill;
  bill2: Bill;
  status: string;
  action_taken: string | null;
  kept_bill_id: number | null;
  voided_bill_id: number | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  detection_score: number | null;
  match_type: string | null;
  created_at: string;
}

interface ScanStats {
  reviews: {
    total: number;
    confirmed_duplicates: number;
    not_duplicates: number;
    pending: number;
  };
  scan: {
    bills_scanned: number;
    potential_duplicates: number;
    high_risk: number;
    medium_risk: number;
  };
}

export default function DuplicateBillsTab() {
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [reviews, setReviews] = useState<DuplicateReview[]>([]);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"duplicates" | "reviews">("duplicates");

  // Dialog state
  const [selectedPair, setSelectedPair] = useState<DuplicatePair | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [keepBillId, setKeepBillId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch stats
      const statsResponse = await api.get<{
        success: boolean;
        data: ScanStats;
      }>("/api/v1/gl/duplicate_bills/stats");

      if (statsResponse?.success) {
        setStats(statsResponse.data);
      }

      // Fetch reviews
      const reviewsResponse = await api.get<{
        success: boolean;
        data: DuplicateReview[];
      }>("/api/v1/gl/duplicate_bills/reviews");

      if (reviewsResponse?.success) {
        setReviews(reviewsResponse.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch duplicate bill data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const response = await api.get<{
        success: boolean;
        data: {
          total_bills_scanned: number;
          potential_duplicates: number;
          duplicates: DuplicatePair[];
          scanned_at: string;
        };
      }>("/api/v1/gl/duplicate_bills");

      if (response?.success) {
        setDuplicates(response.data.duplicates || []);
      }
    } catch (err) {
      console.error("Failed to scan for duplicates:", err);
      setError(err instanceof Error ? err.message : "Failed to scan");
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    runScan();
  }, [fetchData, runScan]);

  const handleMarkNotDuplicate = async () => {
    if (!selectedPair) return;

    setSubmitting(true);
    try {
      const response = await api.post<{ success: boolean; message: string }>(
        "/api/v1/gl/duplicate_bills/mark_not_duplicate",
        {
          bill1_id: selectedPair.bill1.id,
          bill2_id: selectedPair.bill2.id,
          notes: reviewNotes,
          score: selectedPair.score,
          match_type: selectedPair.match_type,
        }
      );

      if (response?.success) {
        // Remove from duplicates list
        setDuplicates((prev) =>
          prev.filter(
            (d) =>
              !(d.bill1.id === selectedPair.bill1.id && d.bill2.id === selectedPair.bill2.id)
          )
        );
        setReviewDialogOpen(false);
        setSelectedPair(null);
        setReviewNotes("");
        fetchData(); // Refresh reviews
      }
    } catch (err) {
      console.error("Failed to mark as not duplicate:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDuplicate = async () => {
    if (!selectedPair || !keepBillId) return;

    const voidBillId =
      keepBillId === selectedPair.bill1.id ? selectedPair.bill2.id : selectedPair.bill1.id;

    setSubmitting(true);
    try {
      const response = await api.post<{ success: boolean; message: string }>(
        "/api/v1/gl/duplicate_bills/confirm_duplicate",
        {
          bill1_id: selectedPair.bill1.id,
          bill2_id: selectedPair.bill2.id,
          keep_id: keepBillId,
          void_id: voidBillId,
          action_taken: "void",
          notes: reviewNotes,
          score: selectedPair.score,
          match_type: selectedPair.match_type,
        }
      );

      if (response?.success) {
        // Remove from duplicates list
        setDuplicates((prev) =>
          prev.filter(
            (d) =>
              !(d.bill1.id === selectedPair.bill1.id && d.bill2.id === selectedPair.bill2.id)
          )
        );
        setConfirmDialogOpen(false);
        setSelectedPair(null);
        setReviewNotes("");
        setKeepBillId(null);
        fetchData(); // Refresh reviews
      }
    } catch (err) {
      console.error("Failed to confirm duplicate:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-AU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          {score}% High Risk
        </Badge>
      );
    }
    if (score >= 70) {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 gap-1">
          <AlertCircle className="h-3 w-3" />
          {score}% Medium
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        {score}% Low
      </Badge>
    );
  };

  const getMatchTypeBadge = (matchType: string) => {
    switch (matchType) {
      case "exact_invoice_number":
        return <Badge variant="destructive">Exact Match</Badge>;
      case "same_amount":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Same Amount</Badge>;
      default:
        return <Badge variant="secondary">Fuzzy Match</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed_duplicate":
        return <Badge variant="destructive" className="gap-1"><CheckCircle className="h-3 w-3" />Confirmed</Badge>;
      case "not_duplicate":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1"><ThumbsUp className="h-3 w-3" />Not Duplicate</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.scan.bills_scanned}</div>
              <p className="text-xs text-muted-foreground">Bills Scanned</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{stats.scan.high_risk}</div>
              <p className="text-xs text-muted-foreground">High Risk</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.scan.medium_risk}</div>
              <p className="text-xs text-muted-foreground">Medium Risk</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">{stats.reviews.not_duplicates}</div>
              <p className="text-xs text-muted-foreground">Cleared</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.reviews.confirmed_duplicates}</div>
              <p className="text-xs text-muted-foreground">Confirmed Dupes</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={activeView === "duplicates" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("duplicates")}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Potential Duplicates ({duplicates.length})
        </Button>
        <Button
          variant={activeView === "reviews" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("reviews")}
        >
          <History className="h-4 w-4 mr-2" />
          Review History ({reviews.length})
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={runScan} disabled={scanning}>
          <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning..." : "Rescan"}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Potential Duplicates Table */}
      {activeView === "duplicates" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Potential Duplicate Bills
              </span>
              <Badge variant="secondary">{duplicates.length} pairs to review</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {duplicates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium text-green-700">No Duplicates Found</p>
                <p className="text-sm mt-1">
                  All bills have been scanned. No potential duplicates detected.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Risk</TableHead>
                    <TableHead>Bill 1</TableHead>
                    <TableHead className="text-center w-12"></TableHead>
                    <TableHead>Bill 2</TableHead>
                    <TableHead>Match Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicates.map((dup, idx) => (
                    <TableRow key={`${dup.bill1.id}-${dup.bill2.id}`} className={dup.score >= 90 ? "bg-red-50/50" : ""}>
                      <TableCell>{getScoreBadge(dup.score)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Link
                            href={`/finance/invoices/${dup.bill1.id}`}
                            className="flex items-center gap-1 text-blue-600 hover:underline font-mono text-sm"
                          >
                            <FileText className="h-3 w-3" />
                            {dup.bill1.invoice_number || "No #"}
                          </Link>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {dup.bill1.contact_name}
                          </p>
                          <p className="text-xs font-mono">{formatCurrency(dup.bill1.total)}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(dup.bill1.invoice_date)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <ArrowRight className="h-4 w-4 text-muted-foreground mx-auto" />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Link
                            href={`/finance/invoices/${dup.bill2.id}`}
                            className="flex items-center gap-1 text-blue-600 hover:underline font-mono text-sm"
                          >
                            <FileText className="h-3 w-3" />
                            {dup.bill2.invoice_number || "No #"}
                          </Link>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {dup.bill2.contact_name}
                          </p>
                          <p className="text-xs font-mono">{formatCurrency(dup.bill2.total)}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(dup.bill2.invoice_date)}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getMatchTypeBadge(dup.match_type)}</TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground max-w-[200px]">{dup.reasoning}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => {
                                    setSelectedPair(dup);
                                    setReviewNotes("");
                                    setReviewDialogOpen(true);
                                  }}
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Not a duplicate</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setSelectedPair(dup);
                                    setReviewNotes("");
                                    setKeepBillId(null);
                                    setConfirmDialogOpen(true);
                                  }}
                                >
                                  <ThumbsDown className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Confirm duplicate</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Review History Table */}
      {activeView === "reviews" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Review History
              </span>
              <Badge variant="secondary">{reviews.length} reviews</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reviews.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No reviews yet.</p>
                <p className="text-sm mt-1">
                  Review potential duplicates to build your history.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bill 1</TableHead>
                    <TableHead>Bill 2</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Reviewed By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell>
                        <Link
                          href={`/finance/invoices/${review.bill1.id}`}
                          className="text-blue-600 hover:underline font-mono text-sm"
                        >
                          {review.bill1.invoice_number}
                        </Link>
                        <p className="text-xs text-muted-foreground">{review.bill1.contact_name}</p>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/finance/invoices/${review.bill2.id}`}
                          className="text-blue-600 hover:underline font-mono text-sm"
                        >
                          {review.bill2.invoice_number}
                        </Link>
                        <p className="text-xs text-muted-foreground">{review.bill2.contact_name}</p>
                      </TableCell>
                      <TableCell>{getStatusBadge(review.status)}</TableCell>
                      <TableCell>
                        {review.action_taken ? (
                          <Badge variant="outline">{review.action_taken}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{review.reviewed_by || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {review.reviewed_at ? formatDate(review.reviewed_at) : "-"}
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground max-w-[150px] truncate">
                          {review.notes || "-"}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mark as Not Duplicate Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-green-600" />
              Mark as Not Duplicate
            </DialogTitle>
            <DialogDescription>
              Confirm these bills are NOT duplicates. They will be removed from the duplicate detection list.
            </DialogDescription>
          </DialogHeader>

          {selectedPair && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-mono font-medium">{selectedPair.bill1.invoice_number}</p>
                  <p className="text-sm text-muted-foreground">{selectedPair.bill1.contact_name}</p>
                  <p className="text-sm font-mono">{formatCurrency(selectedPair.bill1.total)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-mono font-medium">{selectedPair.bill2.invoice_number}</p>
                  <p className="text-sm text-muted-foreground">{selectedPair.bill2.contact_name}</p>
                  <p className="text-sm font-mono">{formatCurrency(selectedPair.bill2.total)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Why are these not duplicates?"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMarkNotDuplicate}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {submitting ? <Spinner className="h-4 w-4 mr-2" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
              Confirm Not Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Duplicate Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirm Duplicate Bill
            </AlertDialogTitle>
            <AlertDialogDescription>
              Select which bill to KEEP. The other bill will be voided.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {selectedPair && (
            <div className="space-y-4 py-4">
              <p className="text-sm font-medium">Which bill should be kept?</p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setKeepBillId(selectedPair.bill1.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    keepBillId === selectedPair.bill1.id
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-mono font-medium">{selectedPair.bill1.invoice_number}</p>
                  <p className="text-sm text-muted-foreground">{selectedPair.bill1.contact_name}</p>
                  <p className="text-sm font-mono">{formatCurrency(selectedPair.bill1.total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(selectedPair.bill1.invoice_date)}</p>
                  {keepBillId === selectedPair.bill1.id && (
                    <Badge className="mt-2 bg-green-600">Keep This</Badge>
                  )}
                </button>
                <button
                  onClick={() => setKeepBillId(selectedPair.bill2.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    keepBillId === selectedPair.bill2.id
                      ? "border-green-500 bg-green-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <p className="font-mono font-medium">{selectedPair.bill2.invoice_number}</p>
                  <p className="text-sm text-muted-foreground">{selectedPair.bill2.contact_name}</p>
                  <p className="text-sm font-mono">{formatCurrency(selectedPair.bill2.total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(selectedPair.bill2.invoice_date)}</p>
                  {keepBillId === selectedPair.bill2.id && (
                    <Badge className="mt-2 bg-green-600">Keep This</Badge>
                  )}
                </button>
              </div>

              {keepBillId && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-red-700">
                    <strong>Bill {keepBillId === selectedPair.bill1.id ? selectedPair.bill2.invoice_number : selectedPair.bill1.invoice_number}</strong> will be marked as voided.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="confirm-notes">Notes (optional)</Label>
                <Textarea
                  id="confirm-notes"
                  placeholder="Additional notes about this duplicate..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDuplicate}
              disabled={submitting || !keepBillId}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? <Spinner className="h-4 w-4 mr-2" /> : null}
              Void Duplicate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
