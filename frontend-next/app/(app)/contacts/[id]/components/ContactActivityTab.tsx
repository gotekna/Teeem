"use client";

import { useState, useEffect } from "react";
import { History, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// Activity types from backend ContactActivity model
interface ContactActivity {
  id: string;
  activity_type: string;
  description: string;
  metadata: {
    action?: string;
    changes?: Record<string, { from: unknown; to: unknown }>;
    xero_contact_id?: string;
    xero_name?: string;
    synced_at?: string;
    [key: string]: unknown;
  };
  occurred_at: string;
  created_at: string;
  performed_by?: {
    type: string;
    id: number;
    name?: string;
  } | null;
}

interface ContactActivityTabProps {
  contactId: number;
}

export function ContactActivityTab({ contactId }: ContactActivityTabProps) {
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{ activities: ContactActivity[] }>(
        `/api/v1/contacts/${contactId}/activities`
      );
      setActivities(response.activities || []);
    } catch (err) {
      console.error("Failed to load activities:", err);
      setError("Failed to load activity history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [contactId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Activity History
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadActivities}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-red-600 dark:text-red-400 text-center py-8">{error}</p>
        ) : activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            No activity history for this contact yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Sub-component for individual activity card
interface ActivityCardProps {
  activity: ContactActivity;
}

function ActivityCard({ activity }: ActivityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = activity.metadata?.changes && Object.keys(activity.metadata.changes).length > 0;

  // Format activity type for display
  const getActivityTypeDisplay = (type: string) => {
    const typeMap: Record<string, { label: string; color: string }> = {
      created: { label: "Created", color: "bg-status-success text-status-success-foreground dark:bg-green-900 dark:text-green-300" },
      updated: { label: "Updated", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900 dark:text-blue-300" },
      synced_from_xero: { label: "Xero Sync", color: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 dark:bg-purple-900 dark:text-purple-300" },
      synced_to_xero: { label: "Pushed to Xero", color: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 dark:bg-indigo-900 dark:text-indigo-300" },
      purchase_order_created: { label: "PO Created", color: "bg-status-warning text-status-warning-foreground dark:bg-amber-900 dark:text-amber-300" },
      supplier_linked: { label: "Supplier Linked", color: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300" },
      contact_merged: { label: "Merged", color: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 dark:bg-orange-900 dark:text-orange-300" },
      sms_sent: { label: "SMS Sent", color: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300" },
      sms_received: { label: "SMS Received", color: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300 dark:bg-cyan-900 dark:text-cyan-300" },
    };
    return typeMap[type] || { label: type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), color: "bg-muted text-foreground dark:bg-card dark:text-muted-foreground" };
  };

  const typeDisplay = getActivityTypeDisplay(activity.activity_type);

  // Format value for display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "(empty)";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) return value.join(", ") || "(empty)";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  // Format field name for display
  const formatFieldName = (field: string): string => {
    return field
      .replace(/_/g, " ")
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("text-xs", typeDisplay.color)}>
              {typeDisplay.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(activity.occurred_at).toLocaleString("en-AU", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
          <p className="mt-1 text-sm">{activity.description}</p>

          {/* Expandable changes section */}
          {hasChanges && (
            <div className="mt-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                {Object.keys(activity.metadata.changes!).length} field(s) changed
              </button>

              {expanded && (
                <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-muted">
                  {Object.entries(activity.metadata.changes!).map(([field, change]) => (
                    <div key={field} className="text-xs">
                      <span className="font-medium">{formatFieldName(field)}:</span>{" "}
                      <span className="text-red-600 dark:text-red-400 line-through">
                        {formatValue(change.from)}
                      </span>
                      {" → "}
                      <span className="text-green-600 dark:text-green-400">
                        {formatValue(change.to)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Show Xero info if available */}
          {activity.metadata?.xero_name && (
            <p className="mt-1 text-xs text-muted-foreground">
              Xero contact: {activity.metadata.xero_name}
            </p>
          )}
        </div>

        {/* Performer info */}
        {activity.performed_by && (
          <div className="text-xs text-muted-foreground text-right shrink-0">
            by {activity.performed_by.name || `User #${activity.performed_by.id}`}
          </div>
        )}
      </div>
    </div>
  );
}
