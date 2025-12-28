"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
// Badge imported but kept for potential future use
import { Loader2, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import { TableRow } from "@/components/table/types";
import { cn } from "@/lib/utils";

interface FeatureChapter {
  id: number;
  display_name: string;
}

interface FeatureTracker extends TableRow {
  id: number;
  feature_name: string;
  feature_chapter: { id: number; display_value: string } | null;
  detail_point_1: string;
  detail_point_2: string;
  detail_point_3: string;
  dev_progress: number;
  teeem_has: boolean;
  simpro_has: boolean;
  buildertrend_has: boolean;
  buildexact_has: boolean;
  databuild_has: boolean;
  clickhome_has: boolean;
  wunderbuilt_has: boolean;
  smarterbuild_has: boolean;
  jacks_has: boolean;
  clickup_has: boolean;
  evolve_has: boolean;
}

interface CompetitorStat {
  key: string;
  name: string;
  count: number;
  total: number;
  percentage: number;
  color: string;
}

interface Stats {
  total: number;
  avg_progress: number;
  competitors: CompetitorStat[];
}

// SSoT: Columns are now fetched from Foundation API (ID: 375)
// Removed hardcoded COLUMNS and ExtendedColumn interface - 2024-12-27

// Color mapping for competitor bars
const COMPETITOR_COLORS: Record<string, string> = {
  green: "bg-green-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  pink: "bg-pink-500",
  yellow: "bg-yellow-500",
  gray: "bg-gray-500",
  red: "bg-red-500",
  indigo: "bg-indigo-500",
};

export default function FeaturesTrackingTable() {
  const [features, setFeatures] = useState<FeatureTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = async () => {
    try {
      setLoading(true);
      const response = await api.get<{
        success: boolean;
        feature_trackers: Array<FeatureTracker & { feature_chapter: FeatureChapter | null }>;
        feature_chapters: FeatureChapter[];
        stats: Stats;
      }>("/api/v1/feature_trackers");

      if (response?.success) {
        // Transform feature_chapter to lookup format { id, display_value }
        // TeeemTableView expects display_value for lookup columns
        const processedFeatures = response.feature_trackers.map((f) => ({
          ...f,
          feature_chapter: f.feature_chapter
            ? {
                id: f.feature_chapter.id,
                display_value: f.feature_chapter.display_name,
              }
            : null,
        }));
        setFeatures(processedFeatures);
        setStats(response.stats);
      } else {
        setError("Failed to load features");
      }
    } catch (err) {
      console.error("Error loading features:", err);
      setError(err instanceof Error ? err.message : "Failed to load features");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-destructive">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="h-full space-y-4">
      {/* Summary Stats Row */}
      {stats && (
        <div className="space-y-4">
          {/* Top row - Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Total Features</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">TEEEM Progress</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {stats.avg_progress}%
                </p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <p className="text-xs text-green-600 dark:text-green-400 mb-1">TEEEM Features</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {stats.competitors?.find((c) => c.key === "teeem")?.count || 0}/{stats.total}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4">
                <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Market Leader</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {stats.competitors?.[0]?.name || "-"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Competitor Comparison Bars */}
          {stats.competitors && stats.competitors.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">Competitor Feature Comparison</h3>
                <div className="space-y-2">
                  {stats.competitors.map((competitor, index) => {
                    const isTEEEM = competitor.key === "teeem";
                    const isLeader = index === 0;
                    const bgColor = COMPETITOR_COLORS[competitor.color] || "bg-gray-500";

                    return (
                      <div key={competitor.key} className="flex items-center gap-3">
                        {/* Rank */}
                        <div
                          className={cn(
                            "w-6 text-xs font-medium",
                            isLeader
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {isLeader ? <Trophy className="h-4 w-4" /> : `#${index + 1}`}
                        </div>

                        {/* Name */}
                        <div
                          className={cn(
                            "w-28 text-sm font-medium truncate",
                            isTEEEM
                              ? "text-blue-600 dark:text-blue-400 font-bold"
                              : "text-foreground"
                          )}
                        >
                          {competitor.name}
                        </div>

                        {/* Progress Bar */}
                        <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all duration-500",
                              isTEEEM ? "bg-blue-500" : bgColor
                            )}
                            style={{ width: `${competitor.percentage}%` }}
                          />
                        </div>

                        {/* Stats */}
                        <div
                          className={cn(
                            "w-20 text-right text-sm font-medium",
                            isTEEEM ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
                          )}
                        >
                          {competitor.count}/{competitor.total}
                        </div>

                        {/* Percentage */}
                        <div
                          className={cn(
                            "w-16 text-right text-sm font-bold",
                            isTEEEM
                              ? "text-blue-600 dark:text-blue-400"
                              : isLeader
                                ? "text-green-600 dark:text-green-400"
                                : "text-foreground"
                          )}
                        >
                          {competitor.percentage}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TeeemTableView */}
      <TeeemTableView
        tableName="Feature Tracking"
        foundationId="feature_trackers"
        entries={features}
        // columns prop removed - TeeemTableView auto-fetches from Foundation API (SSoT)
        viewOnly={true}
        enableExport={true}
        initialGroupByColumn="feature_chapter"
      />
    </div>
  );
}
