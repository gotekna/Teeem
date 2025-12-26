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
  DialogFooter,
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
  Brain,
  BookOpen,
  CheckCircle,
  XCircle,
  Plus,
  Lightbulb,
  TrendingUp,
  Clock,
  FileText,
  Zap,
  Eye,
  Sparkles,
  Target,
  BarChart3,
} from "lucide-react";
import { api } from "@/lib/api";

// Types
interface SampleTransaction {
  amount: number;
  date: string;
}

interface RuleSuggestion {
  suggested_name: string;
  match_type: string;
  match_value: string;
  account_id: number;
  account_name: string;
  account_code: string;
  transaction_type: string;
  pattern_count: number;
  confidence: number;
  sample_transactions: SampleTransaction[];
}

interface TopAccount {
  name: string;
  code: string;
  count: number;
}

interface RecentLearning {
  id: number;
  description: string;
  amount: number;
  account: string;
  learned_at: string;
}

interface Stats {
  total_learnings: number;
  unique_patterns: number;
  rules_created: number;
  top_accounts: TopAccount[];
  recent_learnings: RecentLearning[];
}

interface CreatedRule {
  id: number;
  name: string;
  match_type: string;
  match_value: string;
  account_name: string;
  auto_created: boolean;
  confidence: number;
}

export default function BankRulesLearningTab() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<RuleSuggestion | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: Stats }>(
        "/api/v1/gl/bank_rules_learning/stats"
      );
      if (response?.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    setError(null);
    try {
      const response = await api.get<{ success: boolean; data: { suggestions: RuleSuggestion[]; count: number } }>(
        "/api/v1/gl/bank_rules_learning/suggestions?limit=20"
      );
      if (response?.success) {
        setSuggestions(response.data.suggestions || []);
      }
    } catch (err) {
      console.error("Failed to fetch suggestions:", err);
      setError("Failed to load rule suggestions");
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  // Create rule from suggestion
  const createRule = async (suggestion: RuleSuggestion) => {
    setCreateLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await api.post<{ success: boolean; data: CreatedRule; message: string }>(
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
        setSuccessMessage(`Rule "${response.data.name}" created successfully!`);
        // Remove the suggestion from the list
        setSuggestions((prev) => prev.filter((s) => s.match_value !== suggestion.match_value));
        setPreviewOpen(false);
        setSelectedSuggestion(null);
        // Refresh stats
        await fetchStats();
      }
    } catch (err) {
      console.error("Failed to create rule:", err);
      setError("Failed to create rule");
    } finally {
      setCreateLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchSuggestions()]);
      setLoading(false);
    };
    init();
  }, [fetchStats, fetchSuggestions]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Get confidence badge color
  const getConfidenceBadge = (confidence: number) => {
    const pct = Math.round(confidence * 100);
    if (pct >= 90) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <Target className="h-3 w-3 mr-1" />
          {pct}%
        </Badge>
      );
    }
    if (pct >= 80) {
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          <TrendingUp className="h-3 w-3 mr-1" />
          {pct}%
        </Badge>
      );
    }
    if (pct >= 70) {
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
          <Lightbulb className="h-3 w-3 mr-1" />
          {pct}%
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400">
        {pct}%
      </Badge>
    );
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
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
      {/* Success Message */}
      {successMessage && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Total Learnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_learnings || 0}</div>
            <p className="text-xs text-muted-foreground">Manual categorizations recorded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Unique Patterns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.unique_patterns || 0}</div>
            <p className="text-xs text-muted-foreground">Distinct transaction patterns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Auto-Created Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.rules_created || 0}</div>
            <p className="text-xs text-muted-foreground">Rules created from AI suggestions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Pending Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suggestions.length}</div>
            <p className="text-xs text-muted-foreground">Ready to create rules</p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rule Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                AI Rule Suggestions
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSuggestions}
                disabled={loadingSuggestions}
              >
                {loadingSuggestions ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {suggestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No suggestions yet</p>
                <p className="text-sm mt-1">Categorize more transactions to train the AI</p>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((suggestion, idx) => (
                  <div
                    key={`${suggestion.match_value}-${idx}`}
                    className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getConfidenceBadge(suggestion.confidence)}
                          <Badge variant="outline" className="text-xs">
                            {suggestion.pattern_count} matches
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              suggestion.transaction_type === "credit"
                                ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {suggestion.transaction_type}
                          </Badge>
                        </div>
                        <p className="text-sm font-mono truncate" title={suggestion.match_value}>
                          {suggestion.match_value}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">{suggestion.account_code}</span> - {suggestion.account_name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedSuggestion(suggestion);
                                  setPreviewOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Preview rule details</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button
                          size="sm"
                          onClick={() => createRule(suggestion)}
                          disabled={createLoading}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Create
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Accounts & Recent Learnings */}
        <div className="space-y-6">
          {/* Top Accounts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Top Learned Accounts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.top_accounts && stats.top_accounts.length > 0 ? (
                <div className="space-y-2">
                  {stats.top_accounts.slice(0, 5).map((account, idx) => (
                    <div
                      key={`${account.code}-${idx}`}
                      className="flex items-center justify-between p-2 rounded bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground w-12">
                          {account.code}
                        </span>
                        <span className="text-sm">{account.name}</span>
                      </div>
                      <Badge variant="secondary">{account.count}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No learned accounts yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Learnings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Learnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.recent_learnings && stats.recent_learnings.length > 0 ? (
                <div className="space-y-2">
                  {stats.recent_learnings.slice(0, 5).map((learning) => (
                    <div
                      key={learning.id}
                      className="flex items-center justify-between p-2 rounded bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono truncate" title={learning.description}>
                          {learning.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{learning.account}</span>
                          <span>•</span>
                          <span>{formatTimeAgo(learning.learned_at)}</span>
                        </div>
                      </div>
                      <span
                        className={`text-sm font-medium ml-2 ${
                          learning.amount >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {formatCurrency(learning.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No recent learnings
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Rule Preview
            </DialogTitle>
            <DialogDescription>
              Review the suggested rule before creating it
            </DialogDescription>
          </DialogHeader>

          {selectedSuggestion && (
            <div className="space-y-4">
              {/* Rule Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {getConfidenceBadge(selectedSuggestion.confidence)}
                  <Badge variant="outline">
                    {selectedSuggestion.pattern_count} occurrences
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Rule Name</p>
                    <p className="text-sm font-medium">{selectedSuggestion.suggested_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Match Type</p>
                    <p className="text-sm font-medium capitalize">{selectedSuggestion.match_type}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">Match Pattern</p>
                  <p className="text-sm font-mono bg-muted p-2 rounded">{selectedSuggestion.match_value}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Target Account</p>
                    <p className="text-sm font-medium">
                      {selectedSuggestion.account_code} - {selectedSuggestion.account_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Transaction Type</p>
                    <Badge
                      variant="outline"
                      className={
                        selectedSuggestion.transaction_type === "credit"
                          ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }
                    >
                      {selectedSuggestion.transaction_type}
                    </Badge>
                  </div>
                </div>

                {/* Sample Transactions */}
                {selectedSuggestion.sample_transactions && selectedSuggestion.sample_transactions.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Sample Transactions</p>
                    <div className="space-y-1">
                      {selectedSuggestion.sample_transactions.map((txn, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                        >
                          <span className="text-muted-foreground">{formatDate(txn.date)}</span>
                          <span
                            className={`font-medium ${
                              txn.amount >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {formatCurrency(txn.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedSuggestion && createRule(selectedSuggestion)}
              disabled={createLoading}
            >
              {createLoading ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
