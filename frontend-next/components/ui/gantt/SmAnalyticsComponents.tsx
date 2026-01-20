"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  LightBulbIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
} from "@heroicons/react/24/outline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";

import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

// ============================================
// Types & Interfaces
// ============================================

interface CriticalPathTask {
  id: number;
  name: string;
  duration: number;
}

interface CriticalPathSummary {
  critical_tasks: number;
  average_float: number;
}

interface CriticalPathData {
  critical_path: CriticalPathTask[];
  project_duration: number;
  summary: CriticalPathSummary;
}

interface CriticalPathResponse {
  critical_path: CriticalPathData;
}

interface EvmCoreValues {
  pv: number;
  ev: number;
  ac: number;
}

interface EvmIndices {
  spi: number;
  cpi: number;
}

interface EvmVariances {
  sv: number;
  cv: number;
}

interface EvmForecasts {
  eac: number;
  etc: number;
  vac: number;
}

interface EvmProgress {
  percent_complete: number;
  schedule_status: string;
  cost_status: string;
}

interface EvmData {
  core_values: EvmCoreValues;
  indices: EvmIndices;
  variances: EvmVariances;
  forecasts: EvmForecasts;
  progress: EvmProgress;
  health: string;
}

interface EvmResponse {
  evm: EvmData;
}

interface AiSuggestion {
  type: string;
  priority: number;
  message: string;
  impact?: string;
}

interface AiPrediction {
  task_name: string;
  risk_level: "critical" | "high" | "medium" | "low";
  risk_score: number;
  estimated_delay_days: number;
  factors?: string[];
}

interface AiSuggestionsResponse {
  suggestions: AiSuggestion[];
}

interface AiPredictionsResponse {
  predictions: AiPrediction[];
}

interface Baseline {
  id: number;
  name: string;
  baseline_date: string;
  task_count: number;
  is_active: boolean;
}

interface BaselineComparisonSummary {
  delayed_tasks: number;
  ahead_tasks: number;
  on_track_tasks: number;
}

interface BaselineComparison {
  summary: BaselineComparisonSummary;
}

interface BaselinesResponse {
  baselines: Baseline[];
}

interface BaselineComparisonResponse {
  comparison: BaselineComparison;
}

interface ImportResponse {
  tasks_imported: number;
}

// Component Props
interface CriticalPathViewProps {
  constructionId: string | number;
}

interface EvmDashboardProps {
  constructionId: string | number;
}

interface AiSuggestionsPanelProps {
  constructionId: string | number;
}

interface BaselineComparisonProps {
  constructionId: string | number;
}

interface ImportExportPanelProps {
  constructionId: string | number;
  constructionName?: string;
}

// ============================================
// Critical Path Display
// ============================================

export function CriticalPathView({ constructionId }: CriticalPathViewProps) {
  const [data, setData] = useState<CriticalPathData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get<CriticalPathResponse>(
          `/api/v1/jobs/${constructionId}/sm_analytics/critical_path`
        );
        setData(res.critical_path);
      } catch (err) {
        console.error("Failed to fetch critical path:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [constructionId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ChartBarIcon className="h-5 w-5 text-red-500 dark:text-red-400" />
          Critical Path
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/30">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {data.summary?.critical_tasks || 0}
            </div>
            <div className="text-xs text-red-600 dark:text-red-400">Critical Tasks</div>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <div className="text-2xl font-bold">{data.project_duration || 0}</div>
            <div className="text-xs text-muted-foreground">Days Duration</div>
          </div>
          <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/30">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {data.summary?.average_float?.toFixed(1) || 0}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">Avg Float (days)</div>
          </div>
        </div>

        {/* Critical Path Tasks */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Critical Path Sequence:</div>
          <div className="flex flex-wrap gap-2">
            {data.critical_path?.map((task, index) => (
              <div key={task.id} className="flex items-center">
                <Badge variant="destructive" className="px-3 py-1">
                  {task.name}
                  <span className="ml-1 text-xs opacity-80">({task.duration}d)</span>
                </Badge>
                {index < data.critical_path.length - 1 && (
                  <span className="mx-1 text-muted-foreground">&rarr;</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// EVM Dashboard
// ============================================

export function EvmDashboard({ constructionId }: EvmDashboardProps) {
  const [data, setData] = useState<EvmData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get<EvmResponse>(
          `/api/v1/jobs/${constructionId}/sm_analytics/evm`
        );
        setData(res.evm);
      } catch (err) {
        console.error("Failed to fetch EVM:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [constructionId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const getIndexColor = (value: number | undefined) => {
    if (!value) return "text-muted-foreground";
    if (value >= 1) return "text-green-600 dark:text-green-400";
    if (value >= 0.9) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getHealthColor = (health: string | undefined) => {
    if (!health) return "text-muted-foreground";
    if (health === "excellent" || health === "good") return "text-green-600 dark:text-green-400";
    return "text-yellow-600 dark:text-yellow-400";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CurrencyDollarIcon className="h-5 w-5 text-blue-500 dark:text-blue-400" />
          Earned Value Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Indices */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-muted p-3">
            <div className={`text-2xl font-bold ${getIndexColor(data.indices?.spi)}`}>
              {data.indices?.spi?.toFixed(2) || "-"}
            </div>
            <div className="text-xs text-muted-foreground">SPI (Schedule)</div>
            <div className="text-xs text-muted-foreground/70">
              {data.progress?.schedule_status?.replace(/_/g, " ")}
            </div>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <div className={`text-2xl font-bold ${getIndexColor(data.indices?.cpi)}`}>
              {data.indices?.cpi?.toFixed(2) || "-"}
            </div>
            <div className="text-xs text-muted-foreground">CPI (Cost)</div>
            <div className="text-xs text-muted-foreground/70">
              {data.progress?.cost_status?.replace(/_/g, " ")}
            </div>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <div className="text-2xl font-bold">
              {data.progress?.percent_complete?.toFixed(0) || 0}%
            </div>
            <div className="text-xs text-muted-foreground">Complete</div>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <div className={`text-2xl font-bold ${getHealthColor(data.health)}`}>
              {data.health
                ? data.health.charAt(0).toUpperCase() + data.health.slice(1)
                : "-"}
            </div>
            <div className="text-xs text-muted-foreground">Health</div>
          </div>
        </div>

        {/* Values */}
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <span className="text-muted-foreground">Planned Value:</span>
            <span className="ml-2 font-medium">
              ${data.core_values?.pv?.toLocaleString() || 0}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Earned Value:</span>
            <span className="ml-2 font-medium">
              ${data.core_values?.ev?.toLocaleString() || 0}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Actual Cost:</span>
            <span className="ml-2 font-medium">
              ${data.core_values?.ac?.toLocaleString() || 0}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Est. at Completion:</span>
            <span className="ml-2 font-medium">
              ${data.forecasts?.eac?.toLocaleString() || 0}
            </span>
          </div>
        </div>

        {/* Variances */}
        <div className="grid grid-cols-2 gap-4 border-t pt-4 text-sm">
          <div className="flex items-center gap-2">
            {data.variances?.sv >= 0 ? (
              <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 dark:text-green-400" />
            ) : (
              <ArrowTrendingDownIcon className="h-4 w-4 text-red-500 dark:text-red-400" />
            )}
            <span>Schedule Variance: ${data.variances?.sv?.toLocaleString() || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            {data.variances?.cv >= 0 ? (
              <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 dark:text-green-400" />
            ) : (
              <ArrowTrendingDownIcon className="h-4 w-4 text-red-500 dark:text-red-400" />
            )}
            <span>Cost Variance: ${data.variances?.cv?.toLocaleString() || 0}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// AI Suggestions Panel
// ============================================

export function AiSuggestionsPanel({ constructionId }: AiSuggestionsPanelProps) {
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [predictions, setPredictions] = useState<AiPrediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [suggestionsRes, predictionsRes] = await Promise.all([
          api.get<AiSuggestionsResponse>(
            `/api/v1/jobs/${constructionId}/sm_ai/suggestions`
          ),
          api.get<AiPredictionsResponse>(
            `/api/v1/jobs/${constructionId}/sm_ai/predictions`
          ),
        ]);
        setSuggestions(suggestionsRes.suggestions || []);
        setPredictions(predictionsRes.predictions || []);
      } catch (err) {
        console.error("Failed to fetch AI data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [constructionId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  const getPriorityVariant = (priority: number) => {
    if (priority >= 8) return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 dark:bg-red-950 dark:text-red-400";
    if (priority >= 5) return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 dark:bg-yellow-950 dark:text-yellow-400";
    return "bg-muted text-muted-foreground";
  };

  const getRiskVariant = (level: string) => {
    switch (level) {
      case "critical":
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 dark:bg-red-950 dark:text-red-400";
      case "high":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 dark:bg-orange-950 dark:text-orange-400";
      case "medium":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 dark:bg-yellow-950 dark:text-yellow-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <LightBulbIcon className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="suggestions">
          <TabsList className="mb-4">
            <TabsTrigger value="suggestions">
              Suggestions ({suggestions.length})
            </TabsTrigger>
            <TabsTrigger value="predictions">
              Risk Predictions ({predictions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suggestions">
            <ScrollArea className="h-80">
              <div className="space-y-3 pr-4">
                {suggestions.map((s, i) => (
                  <div key={i} className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950/30">
                    <div className="flex items-start gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${getPriorityVariant(
                          s.priority
                        )}`}
                      >
                        {s.type?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="mt-1 text-sm">{s.message}</div>
                    {s.impact && (
                      <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                        {s.impact}
                      </div>
                    )}
                  </div>
                ))}
                {suggestions.length === 0 && (
                  <div className="py-4 text-center text-muted-foreground">
                    No suggestions at this time
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="predictions">
            <ScrollArea className="h-80">
              <div className="space-y-3 pr-4">
                {predictions.map((p, i) => (
                  <div key={i} className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{p.task_name}</span>
                      <span className={`rounded px-2 py-0.5 text-xs ${getRiskVariant(p.risk_level)}`}>
                        {p.risk_level} risk
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Risk score: {((p.risk_score ?? 0) * 100).toFixed(0)}%
                      {p.estimated_delay_days > 0 &&
                        ` • Est. delay: ${p.estimated_delay_days} days`}
                    </div>
                    {p.factors && p.factors.length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Factors: {p.factors.join(", ")}
                      </div>
                    )}
                  </div>
                ))}
                {predictions.length === 0 && (
                  <div className="py-4 text-center text-muted-foreground">
                    No predictions at this time
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ============================================
// Baseline Comparison
// ============================================

export function BaselineComparisonComponent({ constructionId }: BaselineComparisonProps) {
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [comparison, setComparison] = useState<BaselineComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchBaselines = useCallback(async () => {
    try {
      const res = await api.get<BaselinesResponse>(
        `/api/v1/jobs/${constructionId}/sm_analytics/baselines`
      );
      setBaselines(res.baselines || []);
    } catch (err) {
      console.error("Failed to fetch baselines:", err);
    } finally {
      setLoading(false);
    }
  }, [constructionId]);

  const fetchComparison = async (baselineId: number) => {
    try {
      const res = await api.get<BaselineComparisonResponse>(
        `/api/v1/jobs/${constructionId}/sm_analytics/baselines/${baselineId}/compare`
      );
      setComparison(res.comparison);
    } catch (err) {
      console.error("Failed to fetch comparison:", err);
    }
  };

  const createBaseline = async () => {
    setCreating(true);
    try {
      const name = prompt("Baseline name:", `Baseline ${new Date().toLocaleDateString()}`);
      if (!name) {
        setCreating(false);
        return;
      }

      await api.post(`/api/v1/jobs/${constructionId}/sm_analytics/baselines`, { name });
      fetchBaselines();
    } catch (err) {
      console.error("Failed to create baseline:", err);
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    fetchBaselines();
  }, [fetchBaselines]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Baseline Comparison</CardTitle>
          <Button onClick={createBaseline} disabled={creating} size="sm">
            {creating ? (
              <>
                <Spinner size={16} className="mr-2" />
                Creating...
              </>
            ) : (
              "Create Baseline"
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {baselines.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No baselines yet. Create one to track schedule variance.
          </div>
        ) : (
          <div className="space-y-2">
            {baselines.map((baseline) => (
              <div
                key={baseline.id}
                onClick={() => fetchComparison(baseline.id)}
                className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                  baseline.is_active
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-border hover:bg-muted"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{baseline.name}</span>
                    {baseline.is_active && (
                      <Badge variant="secondary" className="text-xs">
                        Active
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {baseline.task_count} tasks
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Created {new Date(baseline.baseline_date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comparison results */}
        {comparison && (
          <div className="mt-4 border-t pt-4">
            <h4 className="mb-3 font-medium">Variance Summary</h4>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded bg-red-50 p-2 text-center dark:bg-red-950/30">
                <div className="text-xl font-bold text-red-600 dark:text-red-400">
                  {comparison.summary?.delayed_tasks || 0}
                </div>
                <div className="text-xs text-red-600 dark:text-red-400">Delayed</div>
              </div>
              <div className="rounded bg-green-50 p-2 text-center dark:bg-green-950/30">
                <div className="text-xl font-bold text-green-600 dark:text-green-400">
                  {comparison.summary?.ahead_tasks || 0}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400">Ahead</div>
              </div>
              <div className="rounded bg-muted p-2 text-center">
                <div className="text-xl font-bold">
                  {comparison.summary?.on_track_tasks || 0}
                </div>
                <div className="text-xs text-muted-foreground">On Track</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Import/Export Panel
// ============================================

export function ImportExportPanel({ constructionId, constructionName }: ImportExportPanelProps) {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("construction_id", String(constructionId));

    try {
      const res = await api.postFormData<ImportResponse>(
        "/api/v1/sm_integrations/import_ms_project",
        formData
      );
      toast({ title: "Success", description: `Imported ${res.tasks_imported} tasks successfully!` });
      window.location.reload();
    } catch (err) {
      console.error("Import failed:", err);
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      toast({ title: "Import Failed", description: error.response?.data?.error || error.message || "Unknown error", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await api.getBlob(
        `/api/v1/sm_integrations/export_ms_project`,
        { params: { construction_id: String(constructionId) } }
      );

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${constructionName?.replace(/\s+/g, "-") || "schedule"}.xml`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      toast({ title: "Error", description: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Import / Export</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          <label className="flex-1 cursor-pointer">
            <input
              type="file"
              accept=".xml"
              onChange={handleImport}
              className="hidden"
              disabled={importing}
            />
            <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-3 transition-colors hover:border-primary hover:bg-muted">
              <DocumentArrowUpIcon className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm">
                {importing ? "Importing..." : "Import MS Project XML"}
              </span>
            </div>
          </label>

          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 py-6"
          >
            <DocumentArrowDownIcon className="mr-2 h-5 w-5" />
            {exporting ? "Exporting..." : "Export MS Project XML"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Default export for backward compatibility
export default {
  CriticalPathView,
  EvmDashboard,
  AiSuggestionsPanel,
  BaselineComparisonComponent,
  ImportExportPanel,
};
