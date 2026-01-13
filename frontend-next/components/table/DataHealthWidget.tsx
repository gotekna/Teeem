"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  check_name?: string;
  count: number;
  items?: HealthCheckItem[];
  action_path?: string;
  auto_fixable?: boolean;
  fix_type?: string;
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
  foundationId: number | string;
  compact?: boolean;
  forceShow?: boolean; // Always show even if no issues (for explicit open via button)
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
  forceShow = false,
  onIssueClick,
}: DataHealthWidgetProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [expanded, setExpanded] = useState(!compact);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);

  // Update expanded state when compact prop changes
  useEffect(() => {
    setExpanded(!compact);
  }, [compact]);

  // Load health data from API
  const loadHealthData = useCallback(async (forceRefresh = false) => {
    if (!foundationId) return;

    try {
      setLoading(true);
      setError(null);
      // Add refresh=true parameter to force fresh calculation when user clicks refresh
      const url = forceRefresh
        ? `/api/v1/foundations/${foundationId}/health?refresh=true`
        : `/api/v1/foundations/${foundationId}/health`;
      const data = await api.get<HealthData>(url);
      setHealthData(data);
    } catch (err) {
      // Don't spam console for expected "Foundation not found" errors
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (!errorMessage.includes('Foundation not found')) {
        console.error("Failed to load health data:", err);
      }
      setError(errorMessage);
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
  const toggleCheckExpansion = (checkKey: string) => {
    setExpandedCheck(expandedCheck === checkKey ? null : checkKey);
  };

  // Handle item click
  const handleItemClick = (item: HealthCheckItem, check: HealthCheck) => {
    if (onIssueClick) {
      onIssueClick(item, check);
    }
  };

  // State for auto-fix in progress
  const [fixingCheckName, setFixingCheckName] = useState<string | null>(null);

  // Check if a health check supports auto-fix
  const isAutoFixable = (check: HealthCheck) => {
    // Backend-declared auto-fixable
    if (check.auto_fixable) return true;
    // Legacy contact name casing checks
    return check.check_name === "all_caps_names" || check.check_name === "all_lowercase_names";
  };

  // Get fix type for auto-fix API
  const getFixType = (checkName?: string) => {
    if (checkName === "all_caps_names") return "all_caps";
    if (checkName === "all_lowercase_names") return "all_lowercase";
    return "all";
  };

  // Handle auto-fix for health issues
  const handleAutoFix = async (check: HealthCheck) => {
    if (!check.items || check.items.length === 0) return;

    setFixingCheckName(check.check_name || null);

    try {
      // If check has fix_type from backend, use the foundation fix_health endpoint
      if (check.fix_type && foundationId) {
        await api.post(`/api/v1/foundations/${foundationId}/fix_health`, {
          fix_type: check.fix_type,
        });
      } else {
        // Legacy: contact name casing fixes
        const contactIds = check.items.map(item => item.id).filter(id => typeof id === "number");
        if (contactIds.length === 0) return;

        await api.post("/api/v1/contacts/fix_name_casing", {
          contact_ids: contactIds,
          fix_type: getFixType(check.check_name),
        });
      }

      // Refresh health data after fix
      await loadHealthData();
    } catch (err) {
      console.error("Failed to auto-fix:", err);
    } finally {
      setFixingCheckName(null);
    }
  };

  // Don't render anything if no health checks exist for this table
  if (!loading && (!healthData || healthData.checks?.length === 0)) {
    return null;
  }

  // Don't render if no issues (unless forceShow is true)
  if (!forceShow && !loading && healthData && !healthData.has_issues) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-background border rounded-lg p-4">
        <div className="flex items-center justify-center py-2">
          <Spinner size={20} className="text-muted-foreground" />
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
  const allChecks = healthData.checks || [];
  const checksWithIssues = allChecks.filter((c) => c.count > 0);

  return (
    <div className="bg-background border rounded-lg overflow-hidden max-h-[40vh] overflow-y-auto flex-shrink-0">
      {/* Header */}
      <Accordion
        type="single"
        collapsible
        value={expanded ? "health" : ""}
        onValueChange={(v) => setExpanded(v === "health")}
      >
        <AccordionItem value="health" className="border-none">
          <div className="px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <AccordionTrigger className="flex items-center gap-3 flex-1 cursor-pointer p-0 hover:no-underline [&>svg]:hidden">
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
                  {allChecks.length} health check{allChecks.length !== 1 ? 's' : ''} • {healthData.total_issues} issue{healthData.total_issues !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-auto">
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
                {expanded ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </AccordionTrigger>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 ml-2"
              onClick={(e) => {
                e.stopPropagation();
                loadHealthData(true); // Force refresh with fresh health check
              }}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          {/* Expanded Details */}
          <AccordionContent>
          <div className="border-t divide-y">
            {allChecks.map((check, checkIndex) => {
              const color = check.count > 0 ? getSeverityColor(check.severity) : "green";
              const checkKey = check.check_name || check.name || `check-${checkIndex}`;
              const isExpanded = expandedCheck === checkKey;
              const hasItems = check.count > 0;

              return (
                <div key={checkKey}>
                  {/* Check Row */}
                  <div
                    className={cn(
                      "px-4 py-3 flex items-center justify-between",
                      hasItems && "cursor-pointer hover:bg-muted/50"
                    )}
                    onClick={() => hasItems && toggleCheckExpansion(checkKey)}
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
                          color === "gray" && "bg-muted0"
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
                      {check.count === 0 ? (
                        <span className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          Passed
                        </span>
                      ) : (
                        <>
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
                          {/* Auto-fix button for fixable checks */}
                          {isAutoFixable(check) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              disabled={fixingCheckName === check.check_name}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAutoFix(check);
                              }}
                            >
                              {fixingCheckName === check.check_name ? (
                                <>
                                  <Spinner size={12} className="mr-1" />
                                  Fixing...
                                </>
                              ) : (
                                "Fix All"
                              )}
                            </Button>
                          )}
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
                        </>
                      )}
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
                              className="px-4 py-2 hover:bg-muted flex items-center justify-between"
                            >
                              <span className="text-sm truncate cursor-pointer flex-1" onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(item, check);
                              }}>
                                {item.display || item.item_name || `Item ${item.id}`}
                              </span>
                              <Button
                                size="sm"
                                className="ml-2 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleItemClick(item, check);
                                }}
                              >
                                Fix
                              </Button>
                            </div>
                          ))}
                          {check.count > check.items.length && (
                            <div key="more-items" className="px-4 py-2 text-center text-xs text-muted-foreground">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export default DataHealthWidget;

/**
 * HealthIndicatorButton - Compact health indicator for toolbar
 * Shows a small button with hospital cross icon colored by health score
 * Red: <75%, Orange: 75-99%, Green: 100%
 */
interface HealthIndicatorButtonProps {
  foundationId: number | string;
  onClick?: () => void;
}

export function HealthIndicatorButton({
  foundationId,
  onClick,
}: HealthIndicatorButtonProps) {
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<HealthData | null>(null);

  const loadHealthData = useCallback(async () => {
    if (!foundationId) return;

    try {
      setLoading(true);
      const data = await api.get<HealthData>(
        `/api/v1/foundations/${foundationId}/health`
      );
      setHealthData(data);
    } catch (err) {
      // Don't spam console for expected "Foundation not found" errors
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (!errorMessage.includes('Foundation not found')) {
        console.error("Failed to load health data:", err);
      }
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  }, [foundationId]);

  useEffect(() => {
    loadHealthData();
  }, [loadHealthData]);

  // Don't render if no health checks for this table
  if (!loading && (!healthData || healthData.checks?.length === 0)) {
    return null;
  }

  // Get color based on health score
  const getHealthColor = (score: number) => {
    if (score >= 100) return "text-green-600 bg-green-50 border-green-200 hover:bg-green-100";
    if (score >= 75) return "text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100";
    return "text-red-600 bg-red-50 border-red-200 hover:bg-red-100";
  };

  const score = healthData?.overall_health ?? 0;
  const issues = healthData?.total_issues ?? 0;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        "relative gap-1.5 font-medium",
        loading ? "opacity-50" : getHealthColor(score)
      )}
      title={`Data Health: ${score}% (${issues} issues)`}
    >
      {loading ? (
        <Spinner size={16} />
      ) : (
        <>
          {/* Hospital Cross Icon */}
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
          </svg>
          <span>{score}%</span>
        </>
      )}
    </Button>
  );
}
