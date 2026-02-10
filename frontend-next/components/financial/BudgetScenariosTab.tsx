"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
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
import {
  RefreshCw,
  GitBranch,
  Star,
  CheckCircle,
  Archive,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatPercentChange } from "@/utils/formatters";

interface BudgetScenario {
  id: number;
  name: string;
  scenario_type: string;
  fiscal_year: string;
  description: string | null;
  assumptions: Record<string, unknown>;
  revenue_adjustment_pct: number;
  expense_adjustment_pct: number;
  status: string;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  summary?: {
    total_revenue: number;
    total_expenses: number;
    net_income: number;
  };
}

export default function BudgetScenariosTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scenarios, setScenarios] = useState<BudgetScenario[]>([]);
  const [fiscalYears, setFiscalYears] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (yearFilter !== "all") params.append("fiscal_year", yearFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const [scenariosRes, yearsRes] = await Promise.all([
        api.get<{ success: boolean; data: BudgetScenario[] }>(`/api/v1/gl/budget_scenarios?${params}`),
        api.get<{ success: boolean; data: string[] }>("/api/v1/gl/budget_scenarios/fiscal_years"),
      ]);

      if (scenariosRes?.success) setScenarios(scenariosRes.data || []);
      if (yearsRes?.success) setFiscalYears(yearsRes.data || []);
    } catch (error) {
      console.error("Failed to fetch budget scenarios:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [yearFilter, statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleSetDefault = async (scenario: BudgetScenario) => {
    try {
      await api.post(`/api/v1/gl/budget_scenarios/${scenario.id}/set_default`);
      fetchData();
    } catch (error) {
      console.error("Failed to set default:", error);
    }
  };

  const handleActivate = async (scenario: BudgetScenario) => {
    try {
      await api.post(`/api/v1/gl/budget_scenarios/${scenario.id}/activate`);
      fetchData();
    } catch (error) {
      console.error("Failed to activate:", error);
    }
  };

  const handleArchive = async (scenario: BudgetScenario) => {
    try {
      await api.post(`/api/v1/gl/budget_scenarios/${scenario.id}/archive`);
      fetchData();
    } catch (error) {
      console.error("Failed to archive:", error);
    }
  };

  const getStatusBadge = (scenario: BudgetScenario) => {
    if (scenario.is_default) {
      return (
        <Badge className="bg-status-warning text-status-warning-foreground dark:bg-yellow-900/30 dark:text-yellow-400">
          <Star className="h-3 w-3 mr-1" />
          Default
        </Badge>
      );
    }

    switch (scenario.status) {
      case "active":
        return (
          <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      case "archived":
        return (
          <Badge variant="secondary">
            <Archive className="h-3 w-3 mr-1" />
            Archived
          </Badge>
        );
      default:
        return <Badge variant="outline">{scenario.status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "base":
        return <Badge variant="outline">Base</Badge>;
      case "optimistic":
        return (
          <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
            <TrendingUp className="h-3 w-3 mr-1" />
            Optimistic
          </Badge>
        );
      case "pessimistic":
        return (
          <Badge className="bg-status-error text-status-error-foreground dark:bg-red-900/30 dark:text-red-400">
            <TrendingDown className="h-3 w-3 mr-1" />
            Pessimistic
          </Badge>
        );
      case "stretch":
        return (
          <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 dark:bg-purple-900/30 dark:text-purple-400">
            Stretch
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  const defaultScenario = scenarios.find((s) => s.is_default);
  const activeScenarios = scenarios.filter((s) => s.status === "active");

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Total Scenarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scenarios.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeScenarios.length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Star className="h-4 w-4" />
              Default Scenario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {defaultScenario?.name || "Not set"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {defaultScenario?.fiscal_year}
            </p>
          </CardContent>
        </Card>

        {defaultScenario?.summary && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Budgeted Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(defaultScenario.summary.total_revenue)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPercentChange(defaultScenario.revenue_adjustment_pct)} adjustment
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Income Target
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${defaultScenario.summary.net_income >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {formatCurrency(defaultScenario.summary.net_income)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">projected profit</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Scenarios List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Budget Scenarios
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {fiscalYears.map((year) => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {scenarios.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No budget scenarios found</p>
              <p className="text-sm mt-1">Create scenarios to model different budget assumptions</p>
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create Scenario
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Fiscal Year</TableHead>
                  <TableHead className="text-center">Revenue Adj.</TableHead>
                  <TableHead className="text-center">Expense Adj.</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarios.map((scenario) => (
                  <TableRow key={scenario.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{scenario.name}</p>
                        {scenario.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">
                            {scenario.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(scenario.scenario_type)}</TableCell>
                    <TableCell>{scenario.fiscal_year}</TableCell>
                    <TableCell className="text-center">
                      <span className={scenario.revenue_adjustment_pct >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        {formatPercentChange(scenario.revenue_adjustment_pct)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={scenario.expense_adjustment_pct <= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        {formatPercentChange(scenario.expense_adjustment_pct)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">{getStatusBadge(scenario)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {scenario.created_by || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!scenario.is_default && scenario.status === "active" && (
                          <Button size="sm" variant="outline" onClick={() => handleSetDefault(scenario)}>
                            <Star className="h-4 w-4 mr-1" />
                            Default
                          </Button>
                        )}
                        {scenario.status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => handleActivate(scenario)}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Activate
                          </Button>
                        )}
                        {scenario.status === "active" && !scenario.is_default && (
                          <Button size="sm" variant="ghost" onClick={() => handleArchive(scenario)}>
                            <Archive className="h-4 w-4" />
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
    </div>
  );
}
