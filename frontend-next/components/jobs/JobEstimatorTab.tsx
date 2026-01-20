"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Sparkles,
  ClipboardList,
  Wrench,
  AlertTriangle,
  Lightbulb,
  Clock,
  FileText,
  ChefHat,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";

interface EstimatedScope {
  complexity?: string;
  duration_estimate?: string;
  key_trades?: string[];
  major_materials?: string[];
  potential_challenges?: string[];
}

interface Analysis {
  job_summary?: string;
  key_points?: string[];
  estimated_scope?: EstimatedScope;
  recommendations?: string[];
  source?: string;
}

interface Job {
  id: number;
  name: string;
  estimator_analysis?: Analysis;
}

interface JobEstimatorTabProps {
  jobId: string | number;
  job?: Job | null;
}

export function JobEstimatorTab({ jobId, job }: JobEstimatorTabProps) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load estimator data from PDF extraction if available
  useEffect(() => {
    if (job?.estimator_analysis) {
      setAnalysis({
        ...job.estimator_analysis,
        source: "pdf_extraction",
      });
    }
  }, [job]);

  const handleAnalyze = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.post<{ success: boolean; analysis?: Analysis; error?: string }>(
        `/api/v1/jobs/${jobId}/analyze`
      );

      if (response?.success && response.analysis) {
        setAnalysis(response.analysis);
      } else {
        setError(response?.error || "Failed to analyze job");
      }
    } catch (err) {
      console.error("Job analysis error:", err);
      setError(err instanceof Error ? err.message : "An error occurred while analyzing the job");
    } finally {
      setLoading(false);
    }
  };

  const getComplexityVariant = (complexity?: string) => {
    switch (complexity?.toLowerCase()) {
      case "low":
        return "bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400";
      case "medium":
        return "bg-status-warning text-status-warning-foreground dark:bg-yellow-900/30 dark:text-yellow-400";
      case "high":
        return "bg-status-error text-status-error-foreground dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-muted text-foreground dark:bg-card dark:text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Recipes Link */}
      <Card className="border-primary/20 hover:border-primary/40 transition-colors">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <ChefHat className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-medium">Recipes</h2>
                <p className="text-sm text-muted-foreground">
                  Manage cost recipes for materials, labour, and assemblies
                </p>
              </div>
            </div>
            <Link href="/recipes">
              <Button variant="outline" className="gap-2">
                Open Recipes
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* AI Estimator Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-medium flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                AI Job Estimator
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Get AI-powered insights and analysis of this job's scope, requirements, and key
                points
              </p>
              {analysis?.source === "pdf_extraction" && (
                <div className="mt-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
                  <FileText className="h-4 w-4 mr-1" />
                  Auto-extracted from proposal PDFs
                </div>
              )}
            </div>
            <Button onClick={handleAnalyze} disabled={loading}>
              {loading ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {analysis?.source === "pdf_extraction" ? "Re-analyze Job" : "Analyze Job"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-destructive">Analysis Error</h3>
                <p className="mt-1 text-sm text-destructive/80">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!analysis && !loading && !error && (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium">No Analysis Yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Click "Analyze Job" to get AI-powered insights about this job
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && !analysis && (
        <Card>
          <CardContent className="py-12 text-center">
            <Spinner size={48} className="mx-auto text-primary" />
            <h3 className="mt-4 text-sm font-medium">Analyzing Job...</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This may take a moment while we process the job data
            </p>
          </CardContent>
        </Card>
      )}

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          {/* Job Summary */}
          <Card className="bg-gradient-to-br from-primary/5 to-blue-500/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Job Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground">{analysis.job_summary}</p>
            </CardContent>
          </Card>

          {/* 10 Key Points */}
          {analysis.key_points && analysis.key_points.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  10 Key Points About This Job
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {analysis.key_points.map((point, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="text-sm flex-1">{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Estimated Scope */}
          {analysis.estimated_scope && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Complexity & Duration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Scope Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {analysis.estimated_scope.complexity && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Complexity
                      </span>
                      <div className="mt-1">
                        <Badge className={getComplexityVariant(analysis.estimated_scope.complexity)}>
                          {analysis.estimated_scope.complexity}
                        </Badge>
                      </div>
                    </div>
                  )}
                  {analysis.estimated_scope.duration_estimate && (
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Estimated Duration
                      </span>
                      <div className="mt-1 flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{analysis.estimated_scope.duration_estimate}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Key Trades */}
              {analysis.estimated_scope.key_trades && analysis.estimated_scope.key_trades.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Key Trades Required</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysis.estimated_scope.key_trades.map((trade, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-400"
                        >
                          {trade}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Major Materials */}
              {analysis.estimated_scope.major_materials &&
                analysis.estimated_scope.major_materials.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Major Materials</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {analysis.estimated_scope.major_materials.map((material, index) => (
                          <li key={index} className="text-sm flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{material}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

              {/* Potential Challenges */}
              {analysis.estimated_scope.potential_challenges &&
                analysis.estimated_scope.potential_challenges.length > 0 && (
                  <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                        Potential Challenges
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {analysis.estimated_scope.potential_challenges.map((challenge, index) => (
                          <li key={index} className="text-sm flex items-start gap-2">
                            <span className="text-yellow-600 dark:text-yellow-400 mt-1">⚠</span>
                            <span>{challenge}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
            </div>
          )}

          {/* Recommendations */}
          {analysis.recommendations && analysis.recommendations.length > 0 && (
            <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-green-600 dark:text-green-400" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysis.recommendations.map((recommendation, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default JobEstimatorTab;
