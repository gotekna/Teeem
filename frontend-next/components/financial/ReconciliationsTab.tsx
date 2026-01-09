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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  RefreshCw,
  Landmark,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Link2,
  Play,
  Lock,
  Brain,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api";

interface Reconciliation {
  id: number;
  account: { id: number; name: string; code: string };
  statement_date: string;
  period_start: string;
  period_end: string;
  statement_opening_balance: number;
  statement_closing_balance: number;
  gl_closing_balance: number;
  reconciled_balance: number;
  difference: number;
  status: string;
  status_badge: string;
  reconciled: boolean;
  can_edit: boolean;
  can_complete: boolean;
  completed_at: string | null;
  completed_by: string | null;
  stats: {
    matched_count: number;
    unmatched_count: number;
    adjustment_count: number;
    total_lines: number;
  };
  display_name: string;
  created_at: string;
}

interface ReconciliationRule {
  id: number;
  name: string;
  rule_type: string;
  match_field: string;
  match_operator: string;
  match_value: string;
  target_account: { id: number; name: string } | null;
  times_used: number;
  last_used_at: string | null;
  active: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ReconciliationsTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [rules, setRules] = useState<ReconciliationRule[]>([]);
  const [filter, setFilter] = useState<"all" | "in_progress" | "completed">("all");

  const fetchData = useCallback(async () => {
    try {
      const statusParam = filter === "all" ? "" : `?status=${filter}`;
      const [reconRes, rulesRes] = await Promise.all([
        api.get<{ success: boolean; data: Reconciliation[] }>(`/api/v1/gl/reconciliations${statusParam}`),
        api.get<{ success: boolean; data: ReconciliationRule[] }>("/api/v1/gl/reconciliations/rules?active=true"),
      ]);

      if (reconRes?.success) setReconciliations(reconRes.data || []);
      if (rulesRes?.success) setRules(rulesRes.data || []);
    } catch (error) {
      console.error("Failed to fetch reconciliations:", error);
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

  const handleAutoMatch = async (recon: Reconciliation) => {
    try {
      await api.post(`/api/v1/gl/reconciliations/${recon.id}/auto_match`);
      fetchData();
    } catch (error) {
      console.error("Failed to auto-match:", error);
    }
  };

  const handleComplete = async (recon: Reconciliation) => {
    try {
      await api.post(`/api/v1/gl/reconciliations/${recon.id}/complete`);
      fetchData();
    } catch (error) {
      console.error("Failed to complete reconciliation:", error);
    }
  };

  const getStatusBadge = (recon: Reconciliation) => {
    if (recon.reconciled && recon.status === "completed") {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
          <Lock className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    } else if (recon.difference === 0) {
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          <CheckCircle className="h-3 w-3 mr-1" />
          Balanced
        </Badge>
      );
    } else if (recon.status === "in_progress") {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
          <Clock className="h-3 w-3 mr-1" />
          In Progress
        </Badge>
      );
    } else {
      return <Badge variant="secondary">{recon.status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const completedCount = reconciliations.filter(r => r.status === "completed").length;
  const inProgressCount = reconciliations.filter(r => r.status === "in_progress").length;
  const balancedCount = reconciliations.filter(r => r.difference === 0 && r.status !== "completed").length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Reconciliations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reconciliations.length}</div>
            <p className="text-xs text-muted-foreground mt-1">bank accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{inProgressCount}</div>
            <p className="text-xs text-muted-foreground mt-1">need attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ready to Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{balancedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">balanced & ready</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">locked & finalized</p>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliations List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Bank Reconciliations
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
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
          {reconciliations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Landmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No reconciliations found</p>
              <p className="text-sm mt-1">Start a new bank reconciliation to match transactions</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Statement</TableHead>
                  <TableHead className="text-right">GL Balance</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead className="text-center">Progress</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliations.map((recon) => {
                  const matchedPercent = recon.stats.total_lines > 0
                    ? (recon.stats.matched_count / recon.stats.total_lines) * 100
                    : 0;

                  return (
                    <TableRow key={recon.id}>
                      <TableCell>
                        <div className="font-medium">{recon.account.name}</div>
                        <div className="text-xs text-muted-foreground">{recon.account.code}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {formatDate(recon.period_start)} - {formatDate(recon.period_end)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(recon.statement_closing_balance)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(recon.gl_closing_balance)}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${recon.difference === 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(recon.difference)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-center">
                          <Progress value={matchedPercent} className="w-16 h-2" />
                          <span className="text-xs text-muted-foreground">
                            {recon.stats.matched_count}/{recon.stats.total_lines}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(recon)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {recon.can_edit && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleAutoMatch(recon)}
                                title="Auto-Match with AI"
                              >
                                <Brain className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {recon.can_complete && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleComplete(recon)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Complete
                            </Button>
                          )}
                          {recon.status === "completed" && recon.completed_by && (
                            <span className="text-xs text-muted-foreground">
                              by {recon.completed_by}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reconciliation Rules */}
      {rules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="h-5 w-5" />
              Auto-Match Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Match Condition</TableHead>
                  <TableHead>Target Account</TableHead>
                  <TableHead className="text-right">Times Used</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.rule_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rule.match_field} {rule.match_operator} &quot;{rule.match_value}&quot;
                    </TableCell>
                    <TableCell>{rule.target_account?.name || "-"}</TableCell>
                    <TableCell className="text-right">{rule.times_used}</TableCell>
                    <TableCell className="text-center">
                      {rule.active ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
