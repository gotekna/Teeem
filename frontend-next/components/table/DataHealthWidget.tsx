"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

/**
 * Health check item from the API
 */
interface HealthCheckItem {
  id: number | string;
  display?: string;
  item_name?: string;
  contacts?: unknown[];
}

/**
 * Health check definition from the API
 */
interface HealthCheck {
  id: number;
  name: string;
  description?: string;
  severity: "critical" | "warning" | "info";
  check_type: string;
  count: number;
  items?: HealthCheckItem[];
  action_path?: string;
}

/**
 * Health data response from the API
 */
interface HealthData {
  overall_health: number;
  total_issues: number;
  has_issues: boolean;
  checks: HealthCheck[];
}

/**
 * Props for the DataHealthWidget component
 */
interface DataHealthWidgetProps {
  foundationId: number;
  compact?: boolean;
  onIssueClick?: (item: HealthCheckItem, check: HealthCheck) => void;
  onDataChanged?: () => void;
}

/**
 * DataHealthWidget - Universal health check component for any table
 *
 * Dynamically loads health checks from the API based on the table's
 * registered health checks in the database.
 */
export function DataHealthWidget({
  foundationId,
  compact = false,
  onIssueClick,
  onDataChanged,
}: DataHealthWidgetProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [expanded, setExpanded] = useState(!compact);
  const [expandedCheck, setExpandedCheck] = useState<number | null>(null);

  // Load health data from API
  const loadHealthData = useCallback(async () => {
    if (!foundationId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.get<HealthData>(
        `/api/v1/foundations/${foundationId}/health`
      );
      setHealthData(data);
    } catch (err) {
      console.error("Failed to load health data:", err);
      setError(err instanceof Error ? err.message : "Failed to load health data");
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  }, [foundationId]);

  useEffect(() => {
    loadHealthData();
  }, [loadHealthData]);

  // Get color based on severity
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "red";
      case "warning":
        return "orange";
      case "info":
        return "blue";
      default:
        return "gray";
    }
  };

  // Get color based on health score
  const getHealthColor = (score: number) => {
    if (score === 100) return "green";
    if (score >= 75) return "orange";
    return "red";
  };

  // Toggle check expansion
  const toggleCheckExpansion = (checkId: number) => {
    setExpandedCheck(expandedCheck === checkId ? null : checkId);
  };

  // Handle item click
  const handleItemClick = (item: HealthCheckItem, check: HealthCheck) => {
    if (onIssueClick) {
      onIssueClick(item, check);
      return;
    }

    // Default navigation based on action_path
    if (check.action_path && item.id) {
      const path = check.action_path.replace(":id", String(item.id));
      router.push(path);
    }
  };

  // Don't render anything if no health checks exist for this table
  if (!loading && (!healthData || healthData.checks?.length === 0)) {
    return null;
  }

  // Don't render if no issues
  if (!loading && healthData && !healthData.has_issues) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-background border rounded-lg p-4">
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Checking data health...
          </span>
        </div>
      </div>
    );
  }

  // Error state - silently fail
  if (error || !healthData) {
    return null;
  }

  const overallColor = getHealthColor(healthData.overall_health);
  const checksWithIssues = healthData.checks?.filter((c) => c.count > 0) || [];

  return (
    <div className="bg-background border rounded-lg overflow-hidden">
      {/* Header */}
      <Collapsible open={expanded} onOpenChange={setExpanded}>
        <CollapsibleTrigger showIcon={false} className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-lg",
                  overallColor === "green" && "bg-green-100 dark:bg-green-900/30",
                  overallColor === "orange" && "bg-orange-100 dark:bg-orange-900/30",
                  overallColor === "red" && "bg-red-100 dark:bg-red-900/30"
                )}
              >
                {overallColor === "green" ? (
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertTriangle
                    className={cn(
                      "h-6 w-6",
                      overallColor === "orange" && "text-orange-600 dark:text-orange-400",
                      overallColor === "red" && "text-red-600 dark:text-red-400"
                    )}
                  />
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold">Data Health</h3>
                <p className="text-xs text-muted-foreground">
                  {healthData.total_issues.toLocaleString()} issues found • Click to fix
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "text-2xl font-bold",
                  overallColor === "green" && "text-green-600 dark:text-green-400",
                  overallColor === "orange" && "text-orange-600 dark:text-orange-400",
                  overallColor === "red" && "text-red-600 dark:text-red-400"
                )}
              >
                {healthData.overall_health}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  loadHealthData();
                }}
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </Button>
              {expanded ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
        </CollapsibleTrigger>

        {/* Expanded Details */}
        <CollapsibleContent>
          <div className="border-t divide-y">
            {checksWithIssues.map((check) => {
              const color = getSeverityColor(check.severity);
              const isExpanded = expandedCheck === check.id;
              const hasItems = check.count > 0;

              return (
                <div key={check.id}>
                  {/* Check Row */}
                  <div
                    className={cn(
                      "px-4 py-3 flex items-center justify-between",
                      hasItems && "cursor-pointer hover:bg-muted/50"
                    )}
                    onClick={() => hasItems && toggleCheckExpansion(check.id)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {hasItems ? (
                        isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )
                      ) : (
                        <div className="w-4 flex-shrink-0" />
                      )}
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          color === "orange" && "bg-orange-500",
                          color === "red" && "bg-red-500",
                          color === "blue" && "bg-blue-500",
                          color === "gray" && "bg-gray-500"
                        )}
                      />
                      <div className="min-w-0">
                        <span className="text-sm block truncate">{check.name}</span>
                        {check.description && (
                          <span className="text-xs text-muted-foreground block truncate">
                            {check.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          color === "orange" && "text-orange-600 dark:text-orange-400",
                          color === "red" && "text-red-600 dark:text-red-400",
                          color === "blue" && "text-blue-600 dark:text-blue-400",
                          color === "gray" && "text-muted-foreground"
                        )}
                      >
                        {check.count} {check.count === 1 ? "issue" : "issues"}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs uppercase",
                          color === "red" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                          color === "orange" && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
                          color === "blue" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                          color === "gray" && "bg-secondary text-secondary-foreground"
                        )}
                      >
                        {check.severity}
                      </Badge>
                    </div>
                  </div>

                  {/* Expanded Items List */}
                  {isExpanded && check.items && check.items.length > 0 && (
                    <div className="bg-muted/50 border-t">
                      <div className="max-h-64 overflow-y-auto">
                        <div className="divide-y">
                          {check.items.map((item, idx) => (
                            <div
                              key={item.id || idx}
                              className="px-4 py-2 hover:bg-muted cursor-pointer flex items-center justify-between"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(item, check);
                              }}
                            >
                              <span className="text-sm truncate">
                                {item.display || item.item_name || `Item ${item.id}`}
                              </span>
                              <Button size="sm" className="ml-2 flex-shrink-0">
                                Fix
                              </Button>
                            </div>
                          ))}
                          {check.count > check.items.length && (
                            <div className="px-4 py-2 text-center text-xs text-muted-foreground">
                              + {check.count - check.items.length} more items
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Link to full health page */}
            <div className="px-4 py-2 text-center border-t">
              <Link
                href="/system-health"
                className="text-sm text-primary hover:underline"
              >
                View all health checks →
              </Link>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default DataHealthWidget;
