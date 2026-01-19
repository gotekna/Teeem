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
  Brain,
  CheckCircle,
  XCircle,
  Lightbulb,
  Sparkles,
  TrendingUp,
  FileText,
  DollarSign,
  Check,
  X,
  Edit3,
  Plus,
  Zap,
  Target,
  BookOpen,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/utils/formatters";

interface BankTransaction {
  id: number;
  description: string;
  reference: string;
  amount: number;
  transaction_date: string;
}

interface Category {
  id: number;
  name: string;
  category_type: string;
  default_account?: {
    id: number;
    name: string;
    code: string;
  };
}

interface Account {
  id: number;
  name: string;
  code: string;
}

interface Prediction {
  id: number;
  status: string;
  confidence: number;
  reasoning: string;
  created_at: string;
  bank_transaction: BankTransaction;
  predicted_category: Category | null;
  predicted_account: Account | null;
}

interface RuleSuggestion {
  suggested_name: string;
  match_type: string;
  match_value: string;
  account_id: number;
  account_name: string;
  account_code: string;
  transaction_type: string;
  confidence: number;
  pattern_count: number;
  sample_descriptions: string[];
}

interface AccuracyStats {
  total_predictions: number;
  accepted: number;
  rejected: number;
  corrected: number;
  pending: number;
  accuracy_rate: number;
  high_confidence_accuracy: number;
}

interface LearningStats {
  total_categorizations: number;
  unique_patterns: number;
  suggested_rules_pending: number;
  rules_created_from_learning: number;
  avg_confidence: number;
}

export default function AICategorizationTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [ruleSuggestions, setRuleSuggestions] = useState<RuleSuggestion[]>([]);
  const [accuracyStats, setAccuracyStats] = useState<AccuracyStats | null>(null);
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Active view
  const [activeView, setActiveView] = useState<"predictions" | "rules" | "categories">("predictions");

  // Filter
  const [predictionFilter, setPredictionFilter] = useState<string>("pending");

  // Correct dialog state
  const [correctDialogOpen, setCorrectDialogOpen] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<Prediction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      // Fetch predictions
      const predictionsUrl = predictionFilter === "pending"
        ? "/api/v1/gl/ai/predictions?pending_only=true&limit=50"
        : predictionFilter === "high_confidence"
        ? "/api/v1/gl/ai/predictions?high_confidence=true&limit=50"
        : "/api/v1/gl/ai/predictions?limit=50";

      const predictionsResponse = await api.get<{
        success: boolean;
        data: Prediction[];
      }>(predictionsUrl);

      if (predictionsResponse?.success) {
        setPredictions(predictionsResponse.data || []);
      }

      // Fetch accuracy stats
      const accuracyResponse = await api.get<{
        success: boolean;
        data: AccuracyStats;
      }>("/api/v1/gl/ai/predictions/accuracy");

      if (accuracyResponse?.success) {
        setAccuracyStats(accuracyResponse.data);
      }

      // Fetch rule suggestions
      const suggestionsResponse = await api.get<{
        success: boolean;
        data: { suggestions: RuleSuggestion[]; count: number };
      }>("/api/v1/gl/bank_rules_learning/suggestions?limit=20");

      if (suggestionsResponse?.success) {
        setRuleSuggestions(suggestionsResponse.data.suggestions || []);
      }

      // Fetch learning stats
      const learningResponse = await api.get<{
        success: boolean;
        data: LearningStats;
      }>("/api/v1/gl/bank_rules_learning/stats");

      if (learningResponse?.success) {
        setLearningStats(learningResponse.data);
      }

      // Fetch categories
      const categoriesResponse = await api.get<{
        success: boolean;
        data: Category[];
      }>("/api/v1/gl/ai/categories?active_only=true");

      if (categoriesResponse?.success) {
        setCategories(categoriesResponse.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch AI categorization data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    }
  }, [predictionFilter]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    init();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleAccept = async (prediction: Prediction) => {
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/gl/ai/predictions/${prediction.id}/accept`,
        {}
      );

      if (response?.success) {
        await fetchData();
      } else {
        setError(response?.error || "Failed to accept prediction");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept prediction");
    }
  };

  const openRejectDialog = (prediction: Prediction) => {
    setSelectedPrediction(prediction);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedPrediction) return;

    setSubmitting(true);
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/gl/ai/predictions/${selectedPrediction.id}/reject`,
        { reason: rejectReason }
      );

      if (response?.success) {
        setRejectDialogOpen(false);
        await fetchData();
      } else {
        setError(response?.error || "Failed to reject prediction");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject prediction");
    } finally {
      setSubmitting(false);
    }
  };

  const openCorrectDialog = (prediction: Prediction) => {
    setSelectedPrediction(prediction);
    setSelectedCategoryId("");
    setCorrectDialogOpen(true);
  };

  const handleCorrect = async () => {
    if (!selectedPrediction || !selectedCategoryId) return;

    setSubmitting(true);
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/gl/ai/predictions/${selectedPrediction.id}/correct`,
        { category_id: selectedCategoryId }
      );

      if (response?.success) {
        setCorrectDialogOpen(false);
        await fetchData();
      } else {
        setError(response?.error || "Failed to correct prediction");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to correct prediction");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRule = async (suggestion: RuleSuggestion) => {
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        "/api/v1/gl/bank_rules_learning/create_rule",
        {
          suggested_name: suggestion.suggested_name,
          match_type: suggestion.match_type,
          match_value: suggestion.match_value,
          account_id: suggestion.account_id,
          transaction_type: suggestion.transaction_type,
          confidence: suggestion.confidence,
          pattern_count: suggestion.pattern_count,
        }
      );

      if (response?.success) {
        await fetchData();
      } else {
        setError(response?.error || "Failed to create rule");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create rule");
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    const pct = Math.round(confidence * 100);
    if (pct >= 90) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          {pct}%
        </Badge>
      );
    } else if (pct >= 70) {
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          {pct}%
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-muted text-muted-foreground dark:bg-card dark:text-muted-foreground">
          {pct}%
        </Badge>
      );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            Pending
          </Badge>
        );
      case "accepted":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case "corrected":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <Edit3 className="h-3 w-3 mr-1" />
            Corrected
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getAmountColor = (amount: number) => {
    return amount >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
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

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          <Button variant="outline" onClick={handleRefresh}>
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
      <div className="grid grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-600" />
              <div className="text-2xl font-bold text-green-600">
                {accuracyStats?.accuracy_rate?.toFixed(0) || 0}%
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Accuracy Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">
              {accuracyStats?.pending || 0}
            </div>
            <p className="text-xs text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">
              {accuracyStats?.accepted || 0}
            </div>
            <p className="text-xs text-muted-foreground">Accepted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">
              {accuracyStats?.corrected || 0}
            </div>
            <p className="text-xs text-muted-foreground">Corrected</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-purple-600">
              {ruleSuggestions.length}
            </div>
            <p className="text-xs text-muted-foreground">Rule Suggestions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {learningStats?.total_categorizations || 0}
            </div>
            <p className="text-xs text-muted-foreground">Learned Patterns</p>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle and Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={activeView === "predictions" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("predictions")}
        >
          <Brain className="h-4 w-4 mr-2" />
          AI Predictions
        </Button>
        <Button
          variant={activeView === "rules" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("rules")}
        >
          <Lightbulb className="h-4 w-4 mr-2" />
          Rule Suggestions
          {ruleSuggestions.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {ruleSuggestions.length}
            </Badge>
          )}
        </Button>
        <Button
          variant={activeView === "categories" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("categories")}
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Categories
        </Button>
        <div className="flex-1" />
        {activeView === "predictions" && (
          <Select value={predictionFilter} onValueChange={setPredictionFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending Only</SelectItem>
              <SelectItem value="high_confidence">High Confidence</SelectItem>
              <SelectItem value="all">All Predictions</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Predictions Table */}
      {activeView === "predictions" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Categorization Predictions
              </span>
              <Badge variant="secondary">{predictions.length} predictions</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {predictions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No predictions to review</p>
                <p className="text-sm mt-1">
                  AI predictions will appear here when bank transactions are imported.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Suggested Category</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Reasoning</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {predictions.map((prediction) => (
                    <TableRow key={prediction.id}>
                      <TableCell>
                        {getStatusBadge(prediction.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col max-w-[250px]">
                          <span className="font-medium truncate">
                            {prediction.bank_transaction?.description || "-"}
                          </span>
                          {prediction.bank_transaction?.reference && (
                            <span className="text-xs text-muted-foreground truncate">
                              Ref: {prediction.bank_transaction.reference}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono ${getAmountColor(prediction.bank_transaction?.amount || 0)}`}>
                          {prediction.bank_transaction?.amount !== undefined
                            ? (prediction.bank_transaction.amount >= 0 ? "+" : "-") +
                              formatCurrency(prediction.bank_transaction.amount)
                            : "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {prediction.bank_transaction?.transaction_date
                          ? formatDate(prediction.bank_transaction.transaction_date)
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {prediction.predicted_category ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{prediction.predicted_category.name}</span>
                            {prediction.predicted_account && (
                              <span className="text-xs text-muted-foreground">
                                {prediction.predicted_account.code} - {prediction.predicted_account.name}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getConfidenceBadge(prediction.confidence)}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-muted-foreground truncate max-w-[150px] block cursor-help">
                                {prediction.reasoning || "-"}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-[300px]">{prediction.reasoning}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right">
                        {prediction.status === "pending" && (
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => handleAccept(prediction)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Accept</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => openRejectDialog(prediction)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Reject</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => openCorrectDialog(prediction)}
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Correct</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rule Suggestions Table */}
      {activeView === "rules" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Suggested Rules from Patterns
              </span>
              <Badge variant="secondary">{ruleSuggestions.length} suggestions</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ruleSuggestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No rule suggestions yet</p>
                <p className="text-sm mt-1">
                  As you categorize transactions, the AI will learn patterns and suggest rules.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Suggested Rule</TableHead>
                    <TableHead>Match Type</TableHead>
                    <TableHead>Pattern</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Occurrences</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ruleSuggestions.map((suggestion, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">
                        {suggestion.suggested_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {suggestion.match_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-[200px] truncate">
                        {suggestion.match_value}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono text-sm">{suggestion.account_code}</span>
                          <span className="text-xs text-muted-foreground">{suggestion.account_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            suggestion.transaction_type === "credit"
                              ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }
                        >
                          {suggestion.transaction_type === "credit" ? "Income" : "Expense"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getConfidenceBadge(suggestion.confidence)}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">{suggestion.pattern_count}x</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs">
                                <div className="font-medium mb-1">Sample transactions:</div>
                                {suggestion.sample_descriptions?.slice(0, 3).map((desc, i) => (
                                  <div key={i} className="truncate max-w-[250px]">- {desc}</div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleCreateRule(suggestion)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Create Rule
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Categories Table */}
      {activeView === "categories" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Transaction Categories
              </span>
              <Badge variant="secondary">{categories.length} categories</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No categories defined</p>
                <p className="text-sm mt-1">
                  Categories help organize transactions for AI categorization.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Default Account</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">
                        {category.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {category.category_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {category.default_account ? (
                          <span className="text-sm">
                            {category.default_account.code} - {category.default_account.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Reject Prediction
            </DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this AI suggestion (optional but helps improve accuracy).
            </DialogDescription>
          </DialogHeader>

          {selectedPrediction && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <div><strong>Transaction:</strong> {selectedPrediction.bank_transaction?.description}</div>
                <div><strong>Suggested:</strong> {selectedPrediction.predicted_category?.name || "-"}</div>
              </div>

              <div>
                <Label htmlFor="reject-reason">Reason (optional)</Label>
                <Textarea
                  id="reject-reason"
                  placeholder="Why is this categorization wrong?"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={submitting}>
              {submitting ? <Spinner className="h-4 w-4 mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Correct Dialog */}
      <Dialog open={correctDialogOpen} onOpenChange={setCorrectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Correct Prediction
            </DialogTitle>
            <DialogDescription>
              Select the correct category for this transaction. This helps train the AI.
            </DialogDescription>
          </DialogHeader>

          {selectedPrediction && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <div><strong>Transaction:</strong> {selectedPrediction.bank_transaction?.description}</div>
                <div><strong>Amount:</strong> {selectedPrediction.bank_transaction?.amount !== undefined
                  ? formatCurrency(selectedPrediction.bank_transaction.amount)
                  : "-"}</div>
                <div><strong>AI Suggested:</strong> {selectedPrediction.predicted_category?.name || "-"}</div>
              </div>

              <div>
                <Label htmlFor="correct-category">Correct Category</Label>
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger id="correct-category" className="mt-1">
                    <SelectValue placeholder="Select correct category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                        {cat.default_account && (
                          <span className="text-muted-foreground ml-2">
                            ({cat.default_account.code})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCorrect} disabled={submitting || !selectedCategoryId}>
              {submitting ? <Spinner className="h-4 w-4 mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Submit Correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
