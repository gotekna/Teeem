"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Clock,
  User,
  FileText,
  Eye,
  History,
  Shield,
  Activity,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/utils/formatters";

interface Transaction {
  id: number;
  type: string;
  amount: number;
  date: string;
  account_name: string;
  account_code: string;
  description: string;
  contact_name: string;
}

interface AnomalyCheck {
  type: string;
  score: number;
  reason: string;
}

interface Anomaly {
  transaction: Transaction;
  anomaly_score: number;
  anomaly_level: "high" | "medium" | "low";
  is_anomaly: boolean;
  checks: AnomalyCheck[];
  primary_reason: string;
}

interface AnomalySummary {
  total_anomalies: number;
  high_severity: number;
  medium_severity: number;
  by_type: Record<string, number>;
  total_amount: number;
}

interface TrendItem {
  week: string;
  start_date: string;
  total_transactions: number;
  anomalies: number;
  anomaly_rate: number;
}

interface AnomalyReview {
  id: number;
  transaction_type: string;
  transaction_id: number;
  status: string;
  notes: string;
  anomaly_score: number;
  reviewed_by: string;
  reviewed_at: string;
  created_at: string;
}

// Anomaly type labels
const ANOMALY_TYPE_LABELS: Record<string, string> = {
  unusual_amount: "Unusual Amount",
  unusual_timing: "Unusual Timing",
  unusual_frequency: "High Frequency",
  unusual_vendor: "Unusual Vendor",
  unusual_category: "Unusual Category",
  duplicate_pattern: "Duplicate Pattern",
  round_number: "Round Number",
};

export default function AnomalyDetectionTab() {
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [summary, setSummary] = useState<AnomalySummary | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [reviews, setReviews] = useState<AnomalyReview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [daysFilter, setDaysFilter] = useState<number>(30);

  // Review dialog state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewStatus, setReviewStatus] = useState("acknowledged");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Active view
  const [activeView, setActiveView] = useState<"anomalies" | "reviews">("anomalies");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch anomalies
      const anomaliesResponse = await api.get<{
        success: boolean;
        data: {
          anomalies: Anomaly[];
          count: number;
          high_severity: number;
          medium_severity: number;
        };
      }>(`/api/v1/gl/anomalies?days=${daysFilter}&limit=100`);

      if (anomaliesResponse?.success) {
        setAnomalies(anomaliesResponse.data.anomalies || []);
      }

      // Fetch summary
      const summaryResponse = await api.get<{
        success: boolean;
        data: AnomalySummary;
      }>("/api/v1/gl/anomalies/summary");

      if (summaryResponse?.success) {
        setSummary(summaryResponse.data);
      }

      // Fetch trend
      const trendResponse = await api.get<{
        success: boolean;
        data: { trend: TrendItem[] };
      }>("/api/v1/gl/anomalies/trend?weeks=8");

      if (trendResponse?.success) {
        setTrend(trendResponse.data.trend || []);
      }

      // Fetch reviews
      const reviewsResponse = await api.get<{
        success: boolean;
        data: { reviews: AnomalyReview[]; count: number };
      }>("/api/v1/gl/anomalies/reviews?limit=50");

      if (reviewsResponse?.success) {
        setReviews(reviewsResponse.data.reviews || []);
      }
    } catch (err) {
      console.error("Failed to fetch anomaly data:", err);
      setError(err instanceof Error ? err.message : "Failed to load anomaly data");
    } finally {
      setLoading(false);
    }
  }, [daysFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleScan = async () => {
    setScanning(true);
    await fetchData();
    setScanning(false);
  };

  const openReviewDialog = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly);
    setReviewNotes("");
    setReviewStatus("acknowledged");
    setReviewDialogOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedAnomaly) return;

    setSubmittingReview(true);
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        "/api/v1/gl/anomalies/mark_reviewed",
        {
          transaction_type: selectedAnomaly.transaction.type,
          transaction_id: selectedAnomaly.transaction.id,
          status: reviewStatus,
          notes: reviewNotes,
          anomaly_score: selectedAnomaly.anomaly_score,
        }
      );

      if (response?.success) {
        setReviewDialogOpen(false);
        await fetchData();
      } else {
        setError(response?.error || "Failed to submit review");
      }
    } catch (err) {
      console.error("Failed to submit review:", err);
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const getSeverityBadge = (level: string) => {
    switch (level) {
      case "high":
        return (
          <Badge variant="outline" className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
            <AlertTriangle className="h-3 w-3 mr-1" />
            High
          </Badge>
        );
      case "medium":
        return (
          <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
            <AlertCircle className="h-3 w-3 mr-1" />
            Medium
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground border-border dark:bg-card dark:text-muted-foreground">
            Low
          </Badge>
        );
    }
  };

  const getScoreBadge = (score: number) => {
    const colorClass = score >= 80
      ? "bg-status-error text-status-error-foreground dark:bg-red-900/30 dark:text-red-400"
      : score >= 50
      ? "bg-status-warning text-status-warning-foreground dark:bg-amber-900/30 dark:text-amber-400"
      : "bg-muted text-muted-foreground dark:bg-card dark:text-muted-foreground";

    return (
      <Badge className={colorClass}>
        {score}
      </Badge>
    );
  };

  const getAnomalyTypeIcon = (type: string) => {
    switch (type) {
      case "unusual_amount":
        return <DollarSign className="h-3 w-3" />;
      case "unusual_timing":
        return <Clock className="h-3 w-3" />;
      case "unusual_frequency":
        return <Activity className="h-3 w-3" />;
      case "unusual_category":
        return <FileText className="h-3 w-3" />;
      case "duplicate_pattern":
        return <AlertCircle className="h-3 w-3" />;
      case "round_number":
        return <DollarSign className="h-3 w-3" />;
      default:
        return <AlertTriangle className="h-3 w-3" />;
    }
  };

  const filteredAnomalies = anomalies.filter((a) => {
    if (severityFilter === "all") return true;
    return a.anomaly_level === severityFilter;
  });

  // Calculate trend direction
  const trendDirection = trend.length >= 2
    ? trend[trend.length - 1].anomaly_rate - trend[trend.length - 2].anomaly_rate
    : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{summary.total_anomalies}</div>
              <p className="text-xs text-muted-foreground">Total Anomalies</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.high_severity}</div>
              <p className="text-xs text-muted-foreground">High Severity</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-600">{summary.medium_severity}</div>
              <p className="text-xs text-muted-foreground">Medium Severity</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{reviews.length}</div>
              <p className="text-xs text-muted-foreground">Reviewed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{formatCurrency(summary.total_amount)}</div>
                {trendDirection !== 0 && (
                  trendDirection > 0 ? (
                    <TrendingUp className="h-4 w-4 text-red-500 dark:text-red-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-green-500 dark:text-green-400" />
                  )
                )}
              </div>
              <p className="text-xs text-muted-foreground">Flagged Amount</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trend Chart (Simple Bar Representation) */}
      {trend.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Anomaly Trend (Last 8 Weeks)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-16">
              {trend.map((item, idx) => {
                const maxRate = Math.max(...trend.map(t => t.anomaly_rate), 1);
                const height = (item.anomaly_rate / maxRate) * 100;
                return (
                  <TooltipProvider key={idx}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="flex-1 bg-indigo-200 dark:bg-indigo-800 rounded-t cursor-pointer hover:bg-indigo-300 dark:hover:bg-indigo-700 transition-colors"
                          style={{ height: `${Math.max(height, 4)}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-xs">
                          <div className="font-medium">{item.week}</div>
                          <div>{item.anomalies} anomalies ({item.anomaly_rate}%)</div>
                          <div className="text-muted-foreground">{item.total_transactions} total txns</div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{trend[0]?.week}</span>
              <span>{trend[trend.length - 1]?.week}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Toggle and Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={activeView === "anomalies" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("anomalies")}
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          Anomalies
        </Button>
        <Button
          variant={activeView === "reviews" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("reviews")}
        >
          <History className="h-4 w-4 mr-2" />
          Review History
        </Button>
        <div className="flex-1" />
        {activeView === "anomalies" && (
          <>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="high">High Only</SelectItem>
                <SelectItem value="medium">Medium Only</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(daysFilter)} onValueChange={(v) => setDaysFilter(Number(v))}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Days" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
        <Button variant="outline" size="sm" onClick={handleScan} disabled={scanning}>
          <RefreshCw className={`h-4 w-4 mr-2 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning..." : "Scan"}
        </Button>
      </div>

      {/* Anomalies Table */}
      {activeView === "anomalies" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Detected Anomalies
              </span>
              <Badge variant="secondary">{filteredAnomalies.length} found</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredAnomalies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500 dark:text-green-400" />
                <p className="text-lg font-medium">No anomalies detected</p>
                <p className="text-sm mt-1">
                  All transactions in the last {daysFilter} days appear normal.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Score</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAnomalies.map((anomaly) => (
                    <TableRow key={anomaly.transaction.id}>
                      <TableCell>
                        {getScoreBadge(anomaly.anomaly_score)}
                      </TableCell>
                      <TableCell>
                        {getSeverityBadge(anomaly.anomaly_level)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-muted-foreground">
                            {anomaly.transaction.account_code}
                          </span>
                          <span className="text-sm truncate max-w-[200px]">
                            {anomaly.transaction.account_name}
                          </span>
                          {anomaly.transaction.description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {anomaly.transaction.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {anomaly.transaction.contact_name ? (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            {anomaly.transaction.contact_name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(anomaly.transaction.amount)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {anomaly.transaction.date ? formatDate(anomaly.transaction.date) : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {anomaly.checks.slice(0, 3).map((check, idx) => (
                            <TooltipProvider key={idx}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs cursor-help">
                                    {getAnomalyTypeIcon(check.type)}
                                    <span className="ml-1">{ANOMALY_TYPE_LABELS[check.type] || check.type}</span>
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs max-w-[250px]">{check.reason}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                          {anomaly.checks.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{anomaly.checks.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openReviewDialog(anomaly)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Review anomaly</TooltipContent>
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
                  Review anomalies to track your investigations.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Reviewed By</TableHead>
                    <TableHead>Reviewed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((review) => (
                    <TableRow key={review.id}>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {review.transaction_type} #{review.transaction_id}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getScoreBadge(review.anomaly_score)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            review.status === "false_positive"
                              ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 dark:bg-green-900/30 dark:text-green-400"
                              : review.status === "confirmed"
                              ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                              : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-400"
                          }
                        >
                          {review.status === "false_positive" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {review.status === "confirmed" && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {(review.status || 'pending').replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate">
                        {review.notes || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>{review.reviewed_by}</TableCell>
                      <TableCell className="text-sm">
                        {formatDateTime(review.reviewed_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Review Anomaly
            </DialogTitle>
            <DialogDescription>
              Review this flagged transaction and provide your assessment.
            </DialogDescription>
          </DialogHeader>

          {selectedAnomaly && (
            <div className="space-y-4">
              {/* Transaction Details */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account:</span>
                  <span className="font-medium">
                    {selectedAnomaly.transaction.account_code} - {selectedAnomaly.transaction.account_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-mono font-medium">
                    {formatCurrency(selectedAnomaly.transaction.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{selectedAnomaly.transaction.date ? formatDate(selectedAnomaly.transaction.date) : "-"}</span>
                </div>
                {selectedAnomaly.transaction.contact_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contact:</span>
                    <span>{selectedAnomaly.transaction.contact_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Anomaly Score:</span>
                  {getScoreBadge(selectedAnomaly.anomaly_score)}
                </div>
              </div>

              {/* Flags */}
              <div>
                <Label className="text-sm font-medium">Why it was flagged:</Label>
                <div className="mt-2 space-y-2">
                  {selectedAnomaly.checks.map((check, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-500 mt-0.5">
                        {getAnomalyTypeIcon(check.type)}
                      </span>
                      <span>{check.reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Review Form */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="review-status">Your Assessment</Label>
                  <Select value={reviewStatus} onValueChange={setReviewStatus}>
                    <SelectTrigger id="review-status" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acknowledged">Acknowledged</SelectItem>
                      <SelectItem value="false_positive">False Positive</SelectItem>
                      <SelectItem value="confirmed">Confirmed Issue</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="review-notes">Notes (optional)</Label>
                  <Textarea
                    id="review-notes"
                    placeholder="Add notes about your review..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitReview} disabled={submittingReview}>
              {submittingReview ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit Review
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
