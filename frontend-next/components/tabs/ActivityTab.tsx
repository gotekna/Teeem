"use client";

/**
 * ActivityTab - Shows activity timeline for a corporate entity
 *
 * Follows the JobActivityTab pattern exactly.
 * Fetches from GET /api/v1/companies/:id/activities with pagination.
 */

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  PlusCircle,
  Pencil,
  UserPlus,
  UserMinus,
  FileText,
  Landmark,
  Package,
  Info,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { PAGE_SIZE_LIST } from "@/lib/constants/pagination-constants";

interface CorporateActivityData {
  id: number;
  activity_type: string;
  description: string;
  formatted_activity_type: string;
  performed_by_name: string;
  time_ago: string;
  icon_name: string;
  icon_color: string;
  change_details: Record<string, { old: string; new: string } | string> | null;
  created_at: string;
}

interface ActivityTabProps {
  entityId?: string;
  companyId?: string;
}

// Icon mapping based on backend icon_name
const getActivityIcon = (iconName: string) => {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    "plus-circle": PlusCircle,
    "pencil": Pencil,
    "user-plus": UserPlus,
    "user-minus": UserMinus,
    "document-text": FileText,
    "landmark": Landmark,
    "arrow-path-rounded-square": RefreshCw,
    "package": Package,
    "information-circle": Info,
  };
  return icons[iconName] || Info;
};

// Color mapping (dark mode aware)
const getIconColorClasses = (color: string) => {
  const colors: Record<string, string> = {
    green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    indigo: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    red: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300",
    orange: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    cyan: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400",
    sky: "bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400",
    gray: "bg-muted text-muted-foreground",
  };
  return colors[color] || colors.gray;
};

export function ActivityTab({ entityId, companyId }: ActivityTabProps) {
  const id = companyId || entityId;
  const [activities, setActivities] = useState<CorporateActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const loadActivities = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<{
        success: boolean;
        activities: CorporateActivityData[];
        meta?: { total_pages: number; total_count: number };
        error?: string;
      }>(`/api/v1/companies/${id}/activities`, {
        params: { page, per_page: PAGE_SIZE_LIST },
      });

      if (response?.success) {
        setActivities(response.activities || []);
        setTotalPages(response.meta?.total_pages || 1);
        setTotalCount(response.meta?.total_count || 0);
      } else {
        setError(response.error || "Failed to load activities");
      }
    } catch (err) {
      console.error("Failed to load activities:", err);
      setError("Failed to load activities");
    } finally {
      setLoading(false);
    }
  }, [id, page]);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const handleRefresh = () => {
    setPage(1);
    loadActivities();
  };

  if (!id) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No company ID provided
      </div>
    );
  }

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={handleRefresh}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Activity Timeline</h3>
          <p className="text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? "activity" : "activities"} recorded
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Activity Timeline */}
      {activities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h4 className="text-lg font-medium mb-2">No activities yet</h4>
            <p className="text-muted-foreground">
              Activities will be recorded here as changes are made to this company.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <ul className="space-y-0">
              {activities.map((activity, idx) => {
                const Icon = getActivityIcon(activity.icon_name);
                const isLast = idx === activities.length - 1;

                return (
                  <li key={activity.id} className="relative pb-8">
                    {/* Timeline line */}
                    {!isLast && (
                      <span
                        className="absolute left-5 top-10 -ml-px h-full w-0.5 bg-border"
                        aria-hidden="true"
                      />
                    )}

                    <div className="relative flex items-start space-x-4">
                      {/* Icon */}
                      <div className="relative">
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center ring-8 ring-background ${getIconColorClasses(
                            activity.icon_color
                          )}`}
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div>
                          <p className="text-sm font-medium">
                            {activity.description || activity.formatted_activity_type}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{activity.performed_by_name}</span>
                            <span>&middot;</span>
                            <span title={new Date(activity.created_at).toLocaleString()}>
                              {activity.time_ago}
                            </span>
                          </div>
                        </div>

                        {/* Change details (old → new values) */}
                        {activity.change_details &&
                          Object.keys(activity.change_details).length > 0 && (
                            <div className="mt-2 space-y-1">
                              {Object.entries(activity.change_details).map(
                                ([field, value]) => {
                                  if (
                                    typeof value === "object" &&
                                    value !== null &&
                                    "old" in value &&
                                    "new" in value
                                  ) {
                                    return (
                                      <div
                                        key={field}
                                        className="flex items-center gap-2 text-xs"
                                      >
                                        <span className="text-muted-foreground capitalize">
                                          {field.replace(/_/g, " ")}:
                                        </span>
                                        <span className="px-2 py-0.5 bg-muted rounded">
                                          {String(value.old || "—")}
                                        </span>
                                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                                          {String(value.new || "—")}
                                        </span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <p
                                      key={field}
                                      className="text-xs text-muted-foreground"
                                    >
                                      <span className="capitalize">
                                        {field.replace(/_/g, " ")}:
                                      </span>{" "}
                                      {String(value)}
                                    </p>
                                  );
                                }
                              )}
                            </div>
                          )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 pt-4 border-t flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || loading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ActivityTab;
