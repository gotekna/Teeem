"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Eye,
  Sparkles,
  Settings2,
  TrendingUp,
  Clock,
  ChevronRight,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

interface ServiceConfig {
  id: number;
  service_type: string;
  display_name: string;
  ocr_enabled: boolean;
  ai_threshold: number;
  ai_model: string;
  ai_always: boolean;
  active: boolean;
  accuracy: number | null;
  total_processed: number;
  correct_count: number;
  corrected_count: number;
}

interface ProcessingLog {
  id: number;
  service_type: string;
  input_identifier: string | null;
  final_type: string | null;
  final_confidence: number | null;
  decision_method: string;
  user_corrected: boolean;
  corrected_to: string | null;
  corrected_at: string | null;
  total_duration_ms: number | null;
  created_at: string;
}

interface LearningSummary {
  services: {
    service_type: string;
    display_name: string;
    accuracy: number | null;
    total: number;
    corrected: number | null;
    current_threshold: number;
    suggested_threshold: number | null;
    recommendation: string | null;
    needs_attention: boolean;
  }[];
  summary: {
    total_services: number;
    active_services: number;
    services_needing_attention: number;
    total_processed: number;
    total_corrected: number;
    overall_accuracy: number | null;
  };
}

const AI_MODELS = [
  { value: "haiku", label: "Haiku (Fast)" },
  { value: "sonnet", label: "Sonnet (Balanced)" },
  { value: "opus", label: "Opus (Best)" },
];

const METHOD_LABELS: Record<string, { label: string; color: string }> = {
  ocr_only: { label: "OCR Only", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  ocr_plus_ai: { label: "OCR + AI", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  ai_only: { label: "AI Only", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  ai_validated: { label: "AI Validated", color: "bg-green-500/10 text-green-700 dark:text-green-400" },
  failed: { label: "Failed", color: "bg-red-500/10 text-red-700 dark:text-red-400" },
};

export function AiProcessingTab() {
  const [configs, setConfigs] = React.useState<ServiceConfig[]>([]);
  const [logs, setLogs] = React.useState<ProcessingLog[]>([]);
  const [learningSummary, setLearningSummary] = React.useState<LearningSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [configsRes, logsRes, learningRes] = await Promise.all([
        api.get<{ success: boolean; data: ServiceConfig[] }>("/api/v1/ai_processing/configs"),
        api.get<{ success: boolean; data: ProcessingLog[] }>("/api/v1/ai_processing/logs?per_page=20"),
        api.get<{ success: boolean; data: LearningSummary }>("/api/v1/ai_processing/learning_summary"),
      ]);

      if (configsRes.success) {
        setConfigs(configsRes.data);
      }
      if (logsRes.success) {
        setLogs(logsRes.data);
      }
      if (learningRes.success) {
        setLearningSummary(learningRes.data);
      }
    } catch (err) {
      console.error("Failed to load AI processing data:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const updateConfig = async (id: number, updates: Partial<ServiceConfig>) => {
    try {
      setSaving(id);
      const response = await api.patch<{ success: boolean; data: ServiceConfig }>(
        `/api/v1/ai_processing/configs/${id}`,
        { ai_service_config: updates }
      );

      if (response.success) {
        setConfigs((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...response.data } : c))
        );
      }
    } catch (err) {
      console.error("Failed to update config:", err);
    } finally {
      setSaving(null);
    }
  };

  const totalProcessed = configs.reduce((sum, c) => sum + c.total_processed, 0);
  const totalCorrected = configs.reduce((sum, c) => sum + c.corrected_count, 0);
  const overallAccuracy = totalProcessed > 0
    ? ((totalProcessed - totalCorrected) / totalProcessed * 100).toFixed(1)
    : null;

  if (loading && configs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">AI Processing Pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Configure OCR and AI settings for each service
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Pipeline Flow Diagram */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Pipeline Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 text-sm">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-blue-700 dark:text-blue-400">PDF</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <Eye className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-green-700 dark:text-green-400">OCR</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Settings2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span className="text-purple-700 dark:text-purple-400">Pattern Match</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Brain className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-amber-700 dark:text-amber-400">AI (if needed)</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-indigo-700 dark:text-indigo-400">Result</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{totalProcessed}</div>
            <p className="text-xs text-muted-foreground">Total Processed (30d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {overallAccuracy ? `${overallAccuracy}%` : "—"}
            </div>
            <p className="text-xs text-muted-foreground">Overall Accuracy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {totalCorrected}
            </div>
            <p className="text-xs text-muted-foreground">Corrections Made</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{configs.length}</div>
            <p className="text-xs text-muted-foreground">Active Services</p>
          </CardContent>
        </Card>
      </div>

      {/* Service Configurations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Service Configuration</CardTitle>
          <CardDescription>
            Configure OCR and AI settings per service. Changes are saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {configs.map((config) => (
              <div
                key={config.id}
                className="flex items-center gap-4 p-4 rounded-lg border bg-card"
              >
                {/* Service Name & Accuracy */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{config.display_name}</span>
                    {config.accuracy !== null && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          config.accuracy >= 90
                            ? "bg-green-500/10 text-green-700 dark:text-green-400"
                            : config.accuracy >= 80
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            : "bg-red-500/10 text-red-700 dark:text-red-400"
                        )}
                      >
                        {config.accuracy.toFixed(1)}% accuracy
                      </Badge>
                    )}
                    {saving === config.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {config.total_processed} processed • {config.corrected_count} corrected
                  </p>
                </div>

                {/* OCR Toggle */}
                <div className="flex items-center gap-2">
                  <Label htmlFor={`ocr-${config.id}`} className="text-xs text-muted-foreground">
                    OCR
                  </Label>
                  <Switch
                    id={`ocr-${config.id}`}
                    checked={config.ocr_enabled}
                    onCheckedChange={(checked) =>
                      updateConfig(config.id, { ocr_enabled: checked })
                    }
                    disabled={saving === config.id}
                  />
                </div>

                {/* AI Threshold */}
                <div className="flex items-center gap-2">
                  <Label htmlFor={`threshold-${config.id}`} className="text-xs text-muted-foreground whitespace-nowrap">
                    AI if &lt;
                  </Label>
                  {config.ai_always ? (
                    <Badge variant="secondary" className="text-xs">Always</Badge>
                  ) : (
                    <Input
                      id={`threshold-${config.id}`}
                      type="number"
                      min={0}
                      max={100}
                      className="w-16 h-8 text-center"
                      value={config.ai_threshold}
                      onChange={(e) => {
                        const value = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                        updateConfig(config.id, { ai_threshold: value });
                      }}
                      disabled={saving === config.id || config.ai_always}
                    />
                  )}
                  {!config.ai_always && <span className="text-xs text-muted-foreground">%</span>}
                </div>

                {/* AI Model */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Model</Label>
                  <Select
                    value={config.ai_model}
                    onValueChange={(value) => updateConfig(config.id, { ai_model: value })}
                    disabled={saving === config.id}
                  >
                    <SelectTrigger className="w-28 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_MODELS.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={config.active}
                    onCheckedChange={(checked) =>
                      updateConfig(config.id, { active: checked })
                    }
                    disabled={saving === config.id}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Learning Insights */}
      {learningSummary && learningSummary.summary.services_needing_attention > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base">Learning Insights</CardTitle>
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 dark:text-amber-400">
                {learningSummary.summary.services_needing_attention} recommendation{learningSummary.summary.services_needing_attention > 1 ? "s" : ""}
              </Badge>
            </div>
            <CardDescription>
              Based on correction patterns, these services may benefit from threshold adjustments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {learningSummary.services
                .filter((s) => s.needs_attention && s.recommendation)
                .map((service) => (
                  <div
                    key={service.service_type}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                  >
                    <Brain className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{service.display_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {service.current_threshold}%
                          <ArrowRight className="h-3 w-3 mx-1" />
                          {service.suggested_threshold}%
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {service.recommendation}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const config = configs.find((c) => c.service_type === service.service_type);
                        if (config && service.suggested_threshold !== null) {
                          updateConfig(config.id, { ai_threshold: service.suggested_threshold });
                        }
                      }}
                    >
                      Apply
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Processing Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Processing</CardTitle>
          <CardDescription>Last 20 items processed through the pipeline</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No processing logs yet
              </p>
            ) : (
              logs.map((log) => {
                const method = METHOD_LABELS[log.decision_method] || {
                  label: log.decision_method,
                  color: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
                };

                return (
                  <div
                    key={log.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border",
                      log.user_corrected && "border-amber-500/50 bg-amber-500/5"
                    )}
                  >
                    {/* Status Icon */}
                    {log.user_corrected ? (
                      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    )}

                    {/* File/Input */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {log.input_identifier || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.final_type || "No type identified"}
                        {log.user_corrected && log.corrected_to && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {" "}→ {log.corrected_to}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Confidence */}
                    {log.final_confidence !== null && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0",
                          log.final_confidence >= 90
                            ? "border-green-500/50 text-green-700 dark:text-green-400"
                            : log.final_confidence >= 80
                            ? "border-amber-500/50 text-amber-700 dark:text-amber-400"
                            : "border-red-500/50 text-red-700 dark:text-red-400"
                        )}
                      >
                        {log.final_confidence}%
                      </Badge>
                    )}

                    {/* Method */}
                    <Badge variant="secondary" className={cn("shrink-0", method.color)}>
                      {method.label}
                    </Badge>

                    {/* Duration */}
                    {log.total_duration_ms && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {log.total_duration_ms}ms
                      </span>
                    )}

                    {/* Time */}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
