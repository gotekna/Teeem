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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  RefreshCw,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Brain,
  Link2,
  TrendingUp,
  Percent,
  ArrowRight,
  Search,
  Zap,
  Target,
  ThumbsUp,
  ThumbsDown,
  Eye,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { safePercent } from "@/lib/utils";

// Types
interface Bill {
  id: number;
  invoice_number: string;
  supplier_name: string;
  supplier_id: number | null;
  total_amount: number;
  invoice_date: string | null;
  status: string;
  match_status: string | null;
  matched_po_id: number | null;
  matched_po_number: string | null;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_name: string;
  supplier_id: number | null;
  total: number;
  job_name: string | null;
  status: string;
  created_at: string;
}

interface MatchSuggestion {
  purchase_order: PurchaseOrder;
  confidence: number;
  reason: string;
  source: string;
  variance: {
    amount: number;
    percent: number;
    direction: string;
  };
}

interface Stats {
  ai_attempts: {
    total: number;
    today: number;
    this_week: number;
  };
  learnings: {
    total_feedback: number;
    acceptance_rate: number;
    accepted: number;
    rejected: number;
  };
  ai_enabled: boolean;
}

export default function POInvoiceMatchingTab() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [unmatchedBills, setUnmatchedBills] = useState<Bill[]>([]);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsDialogOpen, setSuggestionsDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: Stats }>(
        "/api/v1/gl/po_invoice_matcher/stats"
      );
      if (response?.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  // Fetch unmatched bills
  const fetchUnmatchedBills = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: { bills: Bill[]; count: number } }>(
        "/api/v1/gl/po_invoice_matcher/unmatched"
      );
      if (response?.success) {
        setUnmatchedBills(response.data.bills || []);
      }
    } catch (err) {
      console.error("Failed to fetch unmatched bills:", err);
    }
  }, []);

  // Fetch suggestions for a bill
  const fetchSuggestions = async (bill: Bill) => {
    setSelectedBill(bill);
    setLoadingSuggestions(true);
    setSuggestionsDialogOpen(true);
    setSuggestions([]);
    setError(null);

    try {
      const response = await api.get<{
        success: boolean;
        data: {
          bill: Bill;
          suggestions: MatchSuggestion[];
          count: number;
          best_confidence: number;
        };
      }>(`/api/v1/gl/po_invoice_matcher/${bill.id}/suggestions`);

      if (response?.success) {
        setSuggestions(response.data.suggestions || []);
      }
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
      setError("Failed to load match suggestions");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Confirm a match
  const confirmMatch = async (bill: Bill, po: PurchaseOrder) => {
    setActionLoading(po.id);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; message: string }>(
        `/api/v1/gl/po_invoice_matcher/${bill.id}/confirm`,
        { purchase_order_id: po.id }
      );

      if (response?.success) {
        // Refresh data
        await Promise.all([fetchStats(), fetchUnmatchedBills()]);
        setSuggestionsDialogOpen(false);
        setSelectedBill(null);
      }
    } catch (err) {
      console.error("Failed to confirm match:", err);
      setError("Failed to confirm match");
    } finally {
      setActionLoading(null);
    }
  };

  // Reject a match
  const rejectMatch = async (bill: Bill, po: PurchaseOrder) => {
    setActionLoading(po.id);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; message: string }>(
        `/api/v1/gl/po_invoice_matcher/${bill.id}/reject`,
        { purchase_order_id: po.id }
      );

      if (response?.success) {
        // Remove rejected suggestion from list
        setSuggestions((prev) => prev.filter((s) => s.purchase_order.id !== po.id));
        await fetchStats();
      }
    } catch (err) {
      console.error("Failed to reject match:", err);
      setError("Failed to record rejection");
    } finally {
      setActionLoading(null);
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchUnmatchedBills()]);
      setLoading(false);
    };
    init();
  }, [fetchStats, fetchUnmatchedBills]);

  // Get confidence badge color
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <Target className="h-3 w-3 mr-1" />
          {confidence}%
        </Badge>
      );
    }
    if (confidence >= 70) {
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          <TrendingUp className="h-3 w-3 mr-1" />
          {confidence}%
        </Badge>
      );
    }
    if (confidence >= 50) {
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          <AlertCircle className="h-3 w-3 mr-1" />
          {confidence}%
        </Badge>
      );
    }
    return (
      <Badge className="bg-muted text-foreground dark:bg-card dark:text-muted-foreground">
        {confidence}%
      </Badge>
    );
  };

  // Get source badge
  const getSourceBadge = (source: string) => {
    switch (source) {
      case "po_number":
        return (
          <Badge variant="outline" className="text-xs">
            <Link2 className="h-3 w-3 mr-1" />
            PO Number
          </Badge>
        );
      case "supplier_amount":
        return (
          <Badge variant="outline" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            Supplier + Amount
          </Badge>
        );
      case "abn_amount":
        return (
          <Badge variant="outline" className="text-xs">
            <Search className="h-3 w-3 mr-1" />
            ABN + Amount
          </Badge>
        );
      case "ai_suggestion":
        return (
          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            <Brain className="h-3 w-3 mr-1" />
            AI Suggested
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {source}
          </Badge>
        );
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Unmatched Bills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unmatchedBills.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting PO match</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Attempts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.ai_attempts?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.ai_attempts?.today || 0} today, {stats?.ai_attempts?.this_week || 0} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Acceptance Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.learnings?.acceptance_rate ? `${(stats.learnings.acceptance_rate * 100).toFixed(0)}%` : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.learnings?.accepted || 0} accepted, {stats?.learnings?.rejected || 0} rejected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" />
              AI Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {stats?.ai_enabled ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-lg font-semibold text-green-600 dark:text-green-400">Enabled</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-lg font-semibold text-muted-foreground">Disabled</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.learnings?.total_feedback || 0} total feedback records
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Unmatched Bills Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Bills Awaiting PO Match
            </span>
            <Button variant="outline" size="sm" onClick={() => Promise.all([fetchStats(), fetchUnmatchedBills()])}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {unmatchedBills.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-sm mt-1">No bills awaiting PO matching</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unmatchedBills.map((bill) => (
                  <TableRow key={bill.id}>
                    <TableCell className="font-mono font-medium">
                      {bill.invoice_number || "-"}
                    </TableCell>
                    <TableCell>{bill.supplier_name || "Unknown"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(bill.total_amount)}
                    </TableCell>
                    <TableCell>{formatDate(bill.invoice_date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {bill.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              onClick={() => fetchSuggestions(bill)}
                            >
                              <Search className="h-4 w-4 mr-1" />
                              Find Match
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Find PO matches using rules and AI</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Match Suggestions Dialog */}
      <Dialog open={suggestionsDialogOpen} onOpenChange={setSuggestionsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              PO Match Suggestions
            </DialogTitle>
            <DialogDescription>
              {selectedBill && (
                <div className="flex items-center gap-4 mt-2">
                  <span className="font-mono">{selectedBill.invoice_number}</span>
                  <ArrowRight className="h-4 w-4" />
                  <span>{selectedBill.supplier_name}</span>
                  <span className="font-semibold">{formatCurrency(selectedBill.total_amount)}</span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <XCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {loadingSuggestions ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner className="h-8 w-8 mb-4" />
              <p className="text-muted-foreground">Analyzing matches...</p>
              <p className="text-xs text-muted-foreground mt-1">Using rules and AI to find the best PO match</p>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No matches found</p>
              <p className="text-sm mt-1">Try manually searching for the PO</p>
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions.map((suggestion, idx) => (
                <Card
                  key={suggestion.purchase_order.id}
                  className={idx === 0 ? "border-2 border-green-500 dark:border-green-600" : ""}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          {idx === 0 && (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Best Match
                            </Badge>
                          )}
                          {getConfidenceBadge(suggestion.confidence)}
                          {getSourceBadge(suggestion.source)}
                        </div>

                        <div className="flex items-center gap-4 mt-2">
                          <div>
                            <p className="text-xs text-muted-foreground">PO Number</p>
                            <p className="font-mono font-semibold">{suggestion.purchase_order.po_number}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Supplier</p>
                            <p className="font-medium">{suggestion.purchase_order.supplier_name || "Unknown"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">PO Amount</p>
                            <p className="font-semibold">{formatCurrency(suggestion.purchase_order.total)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Variance</p>
                            <p className={`font-medium ${
                              (suggestion.variance?.percent ?? 0) < 5
                                ? "text-green-600 dark:text-green-400"
                                : (suggestion.variance?.percent ?? 0) < 15
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-red-600 dark:text-red-400"
                            }`}>
                              {safePercent(suggestion.variance?.percent)} {suggestion.variance?.direction ?? ''}
                            </p>
                          </div>
                          {suggestion.purchase_order.job_name && (
                            <div>
                              <p className="text-xs text-muted-foreground">Job</p>
                              <p className="text-sm">{suggestion.purchase_order.job_name}</p>
                            </div>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground mt-2">
                          <span className="font-medium">Reason:</span> {suggestion.reason}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => rejectMatch(selectedBill!, suggestion.purchase_order)}
                                disabled={actionLoading === suggestion.purchase_order.id}
                              >
                                {actionLoading === suggestion.purchase_order.id ? (
                                  <Spinner className="h-4 w-4" />
                                ) : (
                                  <ThumbsDown className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Not a match (helps AI learn)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <Button
                          size="sm"
                          onClick={() => confirmMatch(selectedBill!, suggestion.purchase_order)}
                          disabled={actionLoading === suggestion.purchase_order.id}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {actionLoading === suggestion.purchase_order.id ? (
                            <Spinner className="h-4 w-4 mr-1" />
                          ) : (
                            <ThumbsUp className="h-4 w-4 mr-1" />
                          )}
                          Confirm
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
