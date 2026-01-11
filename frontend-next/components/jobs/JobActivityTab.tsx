"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  PlusCircle,
  Pencil,
  ArrowLeftRight,
  UserPlus,
  UserMinus,
  FileText,
  Banknote,
  FileUp,
  Mail,
  MessageSquare,
  Info,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { PAGE_SIZE_LIST } from "@/lib/constants/pagination-constants";

interface Activity {
  id: number;
  activity_type: string;
  description: string;
  occurred_at: string;
  time_ago: string;
  performed_by: string;
  icon: string;
  icon_color: string;
  related_url?: string;
  metadata?: {
    old_status?: string;
    new_status?: string;
    old_stage?: string;
    new_stage?: string;
    supplier_name?: string;
    contact_name?: string;
  };
}

interface JobActivityTabProps {
  jobId: string | number;
}

// Icon mapping based on activity type
const getActivityIcon = (iconName: string) => {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    "plus-circle": PlusCircle,
    "pencil": Pencil,
    "arrow-path": ArrowLeftRight,
    "user-plus": UserPlus,
    "user-minus": UserMinus,
    "document-text": FileText,
    "banknotes": Banknote,
    "document-arrow-up": FileUp,
    "arrow-path-rounded-square": ArrowLeftRight,
    "envelope": Mail,
    "chat-bubble-left": MessageSquare,
    "information-circle": Info,
  };
  return icons[iconName] || Info;
};

// Color mapping
const getIconColorClasses = (color: string) => {
  const colors: Record<string, string> = {
    green: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400",
    purple: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
    red: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    orange: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    cyan: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
    sky: "bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400",
    gray: "bg-muted text-muted-foreground dark:bg-gray-700 dark:text-muted-foreground",
  };
  return colors[color] || colors.gray;
};

export function JobActivityTab({ jobId }: JobActivityTabProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (jobId) {
      loadActivities();
    }
     
  }, [jobId, page]);

  const loadActivities = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get<{
        success: boolean;
        activities: Activity[];
        meta?: {
          total_pages: number;
          total_count: number;
        };
        error?: string;
      // SSoT: Uses PAGE_SIZE_LIST from pagination-constants.ts
      }>(`/api/v1/jobs/${jobId}/activities`, {
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
  };

  const handleRefresh = () => {
    setPage(1);
    loadActivities();
  };

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
              Activities will be recorded here as changes are made to this job.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <ul className="space-y-0">
              {activities.map((activity, idx) => {
                const Icon = getActivityIcon(activity.icon);
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
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium">
                              {activity.description}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{activity.performed_by}</span>
                              <span>•</span>
                              <span title={new Date(activity.occurred_at).toLocaleString()}>
                                {activity.time_ago}
                              </span>
                            </div>
                          </div>

                          {/* Related URL link */}
                          {activity.related_url && (
                            <a
                              href={activity.related_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              View Document
                            </a>
                          )}
                        </div>

                        {/* Metadata details */}
                        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                          <div className="mt-2">
                            {activity.activity_type === "status_changed" &&
                              activity.metadata.old_status && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="px-2 py-0.5 bg-muted rounded">
                                    {activity.metadata.old_status}
                                  </span>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                                    {activity.metadata.new_status}
                                  </span>
                                </div>
                              )}

                            {activity.activity_type === "stage_changed" && (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="px-2 py-0.5 bg-muted rounded">
                                  {activity.metadata.old_stage || "None"}
                                </span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                                  {activity.metadata.new_stage}
                                </span>
                              </div>
                            )}

                            {(activity.activity_type === "purchase_order_created" ||
                              activity.activity_type === "purchase_order_sent") &&
                              activity.metadata.supplier_name && (
                                <p className="text-xs text-muted-foreground">
                                  Supplier: {activity.metadata.supplier_name}
                                </p>
                              )}

                            {(activity.activity_type === "invoice_received" ||
                              activity.activity_type === "bill_received") &&
                              activity.metadata.contact_name && (
                                <p className="text-xs text-muted-foreground">
                                  From: {activity.metadata.contact_name}
                                </p>
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

export default JobActivityTab;
