"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  BarChart3,
  GitCompare,
  Target,
  Lightbulb,
  Archive,
  Star,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Calendar,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatPercentChangeWithFallback } from "@/utils/formatters";

interface BudgetScenario {
  id: number;
  name: string;
  scenario_type: string;
  fiscal_year: number;
  description?: string;
  assumptions: Record<string, string>;
  revenue_adjustment_pct: number | null;
  expense_adjustment_pct: number | null;
  status: string;
  is_default: boolean;
  created_by?: string;
  created_at: string;
  summary?: {
    total_revenue: number;
    total_expenses: number;
    net_income: number;
    budget_count: number;
  };
}

interface VarianceItem {
  account_code: string;
  account_name: string;
  period: string;
  budget: number;
  actual: number;
  variance: number;
  variance_pct: number;
  status: string;
}

interface ComparisonData {
  scenario1: {
    id: number;
    name: string;
    type: string;
    summary: BudgetScenario["summary"];
  };
  scenario2: {
    id: number;
    name: string;
    type: string;
    summary: BudgetScenario["summary"];
  };
  comparison: Record<
    string,
    {
      account_name: string;
      this_amount: number;
      other_amount: number;
      difference: number;
      difference_pct: number;
    }
  >;
}

const SCENARIO_TYPES = [
  { value: "base", label: "Base", description: "Standard operating budget" },
  { value: "optimistic", label: "Optimistic", description: "Best case scenario" },
  { value: "pessimistic", label: "Pessimistic", description: "Worst case scenario" },
  { value: "stretch", label: "Stretch", description: "Ambitious growth targets" },
  { value: "custom", label: "Custom", description: "User-defined scenario" },
];

export default function BudgetingTab() {
  const [activeView, setActiveView] = useState<"scenarios" | "variance" | "compare">("scenarios");
  const [scenarios, setScenarios] = useState<BudgetScenario[]>([]);
  const [fiscalYears, setFiscalYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<BudgetScenario | null>(null);
  const [varianceData, setVarianceData] = useState<VarianceItem[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [showNewScenarioDialog, setShowNewScenarioDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCompareDialog, setShowCompareDialog] = useState(false);

  // Form fields
  const [newScenarioName, setNewScenarioName] = useState("");
  const [newScenarioType, setNewScenarioType] = useState("custom");
  const [newScenarioYear, setNewScenarioYear] = useState<number>(new Date().getFullYear());
  const [newScenarioDescription, setNewScenarioDescription] = useState("");
  const [newRevenueAdjustment, setNewRevenueAdjustment] = useState("");
  const [newExpenseAdjustment, setNewExpenseAdjustment] = useState("");
  const [copyFromBase, setCopyFromBase] = useState(true);

  // Compare selection
  const [compareScenario1, setCompareScenario1] = useState<number | null>(null);
  const [compareScenario2, setCompareScenario2] = useState<number | null>(null);

  const fetchFiscalYears = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: number[] }>(
        "/api/v1/gl/budget_scenarios/fiscal_years"
      );
      if (response.success) {
        setFiscalYears(response.data);
        if (response.data.length > 0 && !selectedYear) {
          setSelectedYear(response.data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch fiscal years", err);
    }
  }, [selectedYear]);

  const fetchScenarios = useCallback(async () => {
    if (!selectedYear) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{ success: boolean; data: BudgetScenario[] }>(
        `/api/v1/gl/budget_scenarios?fiscal_year=${selectedYear}`
      );
      if (response.success) {
        setScenarios(response.data);
      }
    } catch (err) {
      setError("Failed to load budget scenarios");
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  const fetchScenarioDetails = async (id: number) => {
    try {
      const response = await api.get<{ success: boolean; data: BudgetScenario }>(
        `/api/v1/gl/budget_scenarios/${id}`
      );
      if (response.success) {
        setSelectedScenario(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch scenario details", err);
    }
  };

  const fetchVariance = async (scenarioId: number) => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: VarianceItem[] }>(
        `/api/v1/gl/budget_scenarios/${scenarioId}/variance`
      );
      if (response.success) {
        setVarianceData(response.data);
      }
    } catch (err) {
      setError("Failed to load variance data");
    } finally {
      setLoading(false);
    }
  };

  const fetchComparison = async () => {
    if (!compareScenario1 || !compareScenario2) return;
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: ComparisonData }>(
        `/api/v1/gl/budget_scenarios/compare?scenario1_id=${compareScenario1}&scenario2_id=${compareScenario2}`
      );
      if (response.success) {
        setComparisonData(response.data);
        setShowCompareDialog(false);
        setActiveView("compare");
      }
    } catch (err) {
      setError("Failed to compare scenarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiscalYears();
  }, [fetchFiscalYears]);

  useEffect(() => {
    if (selectedYear) {
      fetchScenarios();
    }
  }, [selectedYear, fetchScenarios]);

  const handleCreateScenario = async () => {
    try {
      const response = await api.post<{ success: boolean; data?: BudgetScenario; error?: string }>(
        "/api/v1/gl/budget_scenarios",
        {
          name: newScenarioName,
          scenario_type: newScenarioType,
          fiscal_year: newScenarioYear,
          description: newScenarioDescription,
          revenue_adjustment_pct: newRevenueAdjustment ? parseFloat(newRevenueAdjustment) : null,
          expense_adjustment_pct: newExpenseAdjustment ? parseFloat(newExpenseAdjustment) : null,
          copy_from_base: copyFromBase ? "true" : "false",
        }
      );
      if (response?.success) {
        setShowNewScenarioDialog(false);
        resetNewScenarioForm();
        fetchScenarios();
      }
    } catch (err) {
      console.error("Failed to create scenario", err);
    }
  };

  const handleSetDefault = async (scenario: BudgetScenario) => {
    try {
      await api.post<{ success: boolean }>(
        `/api/v1/gl/budget_scenarios/${scenario.id}/set_default`,
        {}
      );
      fetchScenarios();
    } catch (err) {
      console.error("Failed to set default", err);
    }
  };

  const handleArchive = async (scenario: BudgetScenario) => {
    try {
      await api.post<{ success: boolean }>(
        `/api/v1/gl/budget_scenarios/${scenario.id}/archive`,
        {}
      );
      fetchScenarios();
    } catch (err) {
      console.error("Failed to archive", err);
    }
  };

  const handleDelete = async () => {
    if (!selectedScenario) return;
    try {
      await api.delete<{ success: boolean }>(
        `/api/v1/gl/budget_scenarios/${selectedScenario.id}`
      );
      setShowDeleteDialog(false);
      setSelectedScenario(null);
      fetchScenarios();
    } catch (err) {
      console.error("Failed to delete scenario", err);
    }
  };

  const resetNewScenarioForm = () => {
    setNewScenarioName("");
    setNewScenarioType("custom");
    setNewScenarioYear(new Date().getFullYear());
    setNewScenarioDescription("");
    setNewRevenueAdjustment("");
    setNewExpenseAdjustment("");
    setCopyFromBase(true);
  };

  const getScenarioTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      base: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900 dark:text-blue-300",
      optimistic: "bg-status-success text-status-success-foreground dark:bg-green-900 dark:text-green-300",
      pessimistic: "bg-status-error text-status-error-foreground dark:bg-red-900 dark:text-red-300",
      stretch: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 dark:bg-purple-900 dark:text-purple-300",
      custom: "bg-muted text-foreground dark:bg-card dark:text-muted-foreground",
    };
    return <Badge className={colors[type] || colors.custom}>{type}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "draft":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      case "archived":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Archive className="h-3 w-3 mr-1" />
            Archived
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getVarianceStatusBadge = (status: string) => {
    switch (status) {
      case "excellent":
        return (
          <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900 dark:text-green-300">
            <CheckCircle className="h-3 w-3 mr-1" />
            Excellent
          </Badge>
        );
      case "on_track":
        return (
          <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900 dark:text-blue-300">
            <Target className="h-3 w-3 mr-1" />
            On Track
          </Badge>
        );
      case "warning":
        return (
          <Badge className="bg-status-warning text-status-warning-foreground dark:bg-amber-900 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Warning
          </Badge>
        );
      case "over_budget":
        return (
          <Badge className="bg-status-error text-status-error-foreground dark:bg-red-900 dark:text-red-300">
            <XCircle className="h-3 w-3 mr-1" />
            Over Budget
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Multi-Scenario Budgeting
          </h2>
          <p className="text-sm text-muted-foreground">
            Create and compare budget scenarios for what-if analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedYear?.toString() || ""}
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Fiscal Year" />
            </SelectTrigger>
            <SelectContent>
              {fiscalYears.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  FY {year}
                </SelectItem>
              ))}
              <SelectItem value={new Date().getFullYear().toString()}>
                FY {new Date().getFullYear()} (New)
              </SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowNewScenarioDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Scenario
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
        <TabsList>
          <TabsTrigger value="scenarios" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            Scenarios
          </TabsTrigger>
          <TabsTrigger value="variance" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Variance Report
          </TabsTrigger>
          <TabsTrigger value="compare" className="flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            Compare
          </TabsTrigger>
        </TabsList>

        {/* Scenarios View */}
        <TabsContent value="scenarios" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-8 w-8" />
            </div>
          ) : scenarios.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Calculator className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No budget scenarios</p>
                <p className="text-sm mt-1">Create your first scenario to start budgeting</p>
                <Button className="mt-4" onClick={() => setShowNewScenarioDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Scenario
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scenarios.map((scenario) => (
                <Card
                  key={scenario.id}
                  className={`cursor-pointer transition-shadow hover:shadow-md ${
                    scenario.is_default ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => {
                    fetchScenarioDetails(scenario.id);
                    fetchVariance(scenario.id);
                    setActiveView("variance");
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {scenario.name}
                          {scenario.is_default && (
                            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          )}
                        </CardTitle>
                        <CardDescription>{scenario.description || "No description"}</CardDescription>
                      </div>
                      {getScenarioTypeBadge(scenario.scenario_type)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Status</span>
                        {getStatusBadge(scenario.status)}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Fiscal Year</span>
                        <span className="font-medium">FY {scenario.fiscal_year}</span>
                      </div>
                      {scenario.revenue_adjustment_pct !== null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Revenue Adj.</span>
                          <span
                            className={
                              scenario.revenue_adjustment_pct >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {formatPercentChangeWithFallback(scenario.revenue_adjustment_pct, "-")}
                          </span>
                        </div>
                      )}
                      {scenario.expense_adjustment_pct !== null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Expense Adj.</span>
                          <span
                            className={
                              scenario.expense_adjustment_pct <= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }
                          >
                            {formatPercentChangeWithFallback(scenario.expense_adjustment_pct, "-")}
                          </span>
                        </div>
                      )}
                      <div className="pt-2 border-t flex justify-end gap-1">
                        {!scenario.is_default && scenario.status !== "archived" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetDefault(scenario);
                            }}
                            title="Set as Default"
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCompareScenario1(scenario.id);
                            setShowCompareDialog(true);
                          }}
                          title="Compare"
                        >
                          <GitCompare className="h-4 w-4" />
                        </Button>
                        {!scenario.is_default && scenario.status !== "archived" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchive(scenario);
                            }}
                            title="Archive"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                        {!scenario.is_default && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedScenario(scenario);
                              setShowDeleteDialog(true);
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Variance View */}
        <TabsContent value="variance" className="space-y-4">
          {selectedScenario && (
            <>
              {/* Scenario Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      {selectedScenario.name}
                      {getScenarioTypeBadge(selectedScenario.scenario_type)}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setActiveView("scenarios")}>
                      Back to Scenarios
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedScenario.summary && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                          <TrendingUp className="h-5 w-5" />
                          <span className="text-sm">Total Revenue</span>
                        </div>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                          {formatCurrency(selectedScenario.summary.total_revenue)}
                        </p>
                      </div>
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                          <TrendingDown className="h-5 w-5" />
                          <span className="text-sm">Total Expenses</span>
                        </div>
                        <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                          {formatCurrency(selectedScenario.summary.total_expenses)}
                        </p>
                      </div>
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                          <DollarSign className="h-5 w-5" />
                          <span className="text-sm">Net Income</span>
                        </div>
                        <p
                          className={`text-2xl font-bold ${
                            selectedScenario.summary.net_income >= 0
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-red-700 dark:text-red-300"
                          }`}
                        >
                          {formatCurrency(selectedScenario.summary.net_income)}
                        </p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <FileText className="h-5 w-5" />
                          <span className="text-sm">Budget Lines</span>
                        </div>
                        <p className="text-2xl font-bold">
                          {selectedScenario.summary.budget_count}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Variance Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Budget vs Actual Variance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Spinner className="h-8 w-8" />
                    </div>
                  ) : varianceData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No variance data available</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Budget</TableHead>
                          <TableHead className="text-right">Actual</TableHead>
                          <TableHead className="text-right">Variance</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {varianceData.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <div>
                                <span className="font-mono text-sm">{item.account_code}</span>
                                <p className="text-sm text-muted-foreground">{item.account_name}</p>
                              </div>
                            </TableCell>
                            <TableCell>{item.period}</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.budget)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.actual)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={`flex items-center justify-end gap-1 ${
                                  item.variance >= 0 ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {item.variance >= 0 ? (
                                  <ArrowUpRight className="h-4 w-4" />
                                ) : (
                                  <ArrowDownRight className="h-4 w-4" />
                                )}
                                {formatCurrency(Math.abs(item.variance))}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={
                                  item.variance_pct >= 0 ? "text-green-600" : "text-red-600"
                                }
                              >
                                {formatPercentChangeWithFallback(item.variance_pct, "-")}
                              </span>
                            </TableCell>
                            <TableCell>{getVarianceStatusBadge(item.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {!selectedScenario && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a scenario</p>
                <p className="text-sm mt-1">
                  Choose a budget scenario from the Scenarios tab to view variance analysis
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Compare View */}
        <TabsContent value="compare" className="space-y-4">
          {comparisonData ? (
            <>
              {/* Comparison Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {comparisonData.scenario1.name}
                      {getScenarioTypeBadge(comparisonData.scenario1.type)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {comparisonData.scenario1.summary && (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Revenue</span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(comparisonData.scenario1.summary.total_revenue)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Expenses</span>
                          <span className="font-medium text-red-600">
                            {formatCurrency(comparisonData.scenario1.summary.total_expenses)}
                          </span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="font-medium">Net Income</span>
                          <span
                            className={`font-bold ${
                              comparisonData.scenario1.summary.net_income >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatCurrency(comparisonData.scenario1.summary.net_income)}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {comparisonData.scenario2.name}
                      {getScenarioTypeBadge(comparisonData.scenario2.type)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {comparisonData.scenario2.summary && (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Revenue</span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(comparisonData.scenario2.summary.total_revenue)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Expenses</span>
                          <span className="font-medium text-red-600">
                            {formatCurrency(comparisonData.scenario2.summary.total_expenses)}
                          </span>
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="font-medium">Net Income</span>
                          <span
                            className={`font-bold ${
                              comparisonData.scenario2.summary.net_income >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatCurrency(comparisonData.scenario2.summary.net_income)}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <GitCompare className="h-5 w-5" />
                      Account-by-Account Comparison
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setShowCompareDialog(true)}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      New Comparison
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">{comparisonData.scenario1.name}</TableHead>
                        <TableHead className="text-right">{comparisonData.scenario2.name}</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(comparisonData.comparison).map(([code, data]) => (
                        <TableRow key={code}>
                          <TableCell>
                            <span className="font-mono text-sm">{code}</span>
                            <p className="text-sm text-muted-foreground">{data.account_name}</p>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(data.this_amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(data.other_amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={data.difference >= 0 ? "text-green-600" : "text-red-600"}
                            >
                              {formatCurrency(data.difference)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                data.difference_pct >= 0 ? "text-green-600" : "text-red-600"
                              }
                            >
                              {formatPercentChangeWithFallback(data.difference_pct, "-")}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <GitCompare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Compare Budget Scenarios</p>
                <p className="text-sm mt-1">
                  Select two scenarios to compare their budgets side by side
                </p>
                <Button className="mt-4" onClick={() => setShowCompareDialog(true)}>
                  <GitCompare className="h-4 w-4 mr-2" />
                  Start Comparison
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* New Scenario Dialog */}
      <Dialog open={showNewScenarioDialog} onOpenChange={setShowNewScenarioDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              New Budget Scenario
            </DialogTitle>
            <DialogDescription>
              Create a new budget scenario for what-if analysis
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Scenario Name</Label>
                <Input
                  value={newScenarioName}
                  onChange={(e) => setNewScenarioName(e.target.value)}
                  placeholder="e.g., Growth Scenario"
                />
              </div>
              <div>
                <Label>Fiscal Year</Label>
                <Select
                  value={newScenarioYear.toString()}
                  onValueChange={(v) => setNewScenarioYear(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...Array(5)].map((_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          FY {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Scenario Type</Label>
              <Select value={newScenarioType} onValueChange={setNewScenarioType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIO_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <span className="font-medium">{type.label}</span>
                        <span className="text-muted-foreground ml-2">- {type.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={newScenarioDescription}
                onChange={(e) => setNewScenarioDescription(e.target.value)}
                placeholder="Describe the assumptions for this scenario..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Revenue Adjustment %</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.1"
                    value={newRevenueAdjustment}
                    onChange={(e) => setNewRevenueAdjustment(e.target.value)}
                    placeholder="e.g., 10 for +10%"
                  />
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div>
                <Label>Expense Adjustment %</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.1"
                    value={newExpenseAdjustment}
                    onChange={(e) => setNewExpenseAdjustment(e.target.value)}
                    placeholder="e.g., -5 for -5%"
                  />
                  <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="copy-from-base"
                checked={copyFromBase}
                onChange={(e) => setCopyFromBase(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="copy-from-base" className="font-normal cursor-pointer">
                Copy budget lines from base scenario and apply adjustments
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewScenarioDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateScenario} disabled={!newScenarioName}>
              <Plus className="h-4 w-4 mr-2" />
              Create Scenario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compare Dialog */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              Compare Scenarios
            </DialogTitle>
            <DialogDescription>Select two scenarios to compare</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Scenario 1</Label>
              <Select
                value={compareScenario1?.toString() || ""}
                onValueChange={(v) => setCompareScenario1(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select first scenario" />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name} ({s.scenario_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Scenario 2</Label>
              <Select
                value={compareScenario2?.toString() || ""}
                onValueChange={(v) => setCompareScenario2(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select second scenario" />
                </SelectTrigger>
                <SelectContent>
                  {scenarios
                    .filter((s) => s.id !== compareScenario1)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.name} ({s.scenario_type})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompareDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={fetchComparison}
              disabled={!compareScenario1 || !compareScenario2}
            >
              <GitCompare className="h-4 w-4 mr-2" />
              Compare
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Scenario
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedScenario?.name}&quot;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
