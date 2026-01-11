"use client";

/**
 * CaseTimelineTab - Timeline view for case events
 *
 * Displays chronological events related to a case including:
 * - Emails, documents, transactions, meetings, filings
 * - Auto-build feature to generate timeline from warehouse data
 *
 * Extracted from cases/[id]/page.tsx for maintainability.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Clock,
  RefreshCw,
  Activity,
  Mail,
  FileText,
  DollarSign,
  Users,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: number;
  event_date: string;
  event_type: string;
  title: string;
  description: string | null;
  source: string | null;
  icon: string | null;
  color: string | null;
  metadata: unknown;
  created_at: string;
}

interface CaseTimelineTabProps {
  caseId: string;
}

function getTimelineIcon(eventType: string) {
  switch (eventType) {
    case "email":
      return <Mail className="h-4 w-4" />;
    case "document":
      return <FileText className="h-4 w-4" />;
    case "transaction":
      return <DollarSign className="h-4 w-4" />;
    case "meeting":
      return <Users className="h-4 w-4" />;
    case "filing":
      return <Briefcase className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

function getTimelineColor(eventType: string) {
  switch (eventType) {
    case "email":
      return "bg-purple-500";
    case "document":
      return "bg-blue-500";
    case "transaction":
      return "bg-green-500";
    case "meeting":
      return "bg-amber-500";
    case "filing":
      return "bg-red-500";
    default:
      return "bg-muted0";
  }
}

export function CaseTimelineTab({ caseId }: CaseTimelineTabProps) {
  const [timelineEvents, setTimelineEvents] = React.useState<TimelineEvent[]>([]);
  const [loading, setLoading] = React.useState(true);

  const loadTimeline = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: TimelineEvent[] }>(
        `/api/v1/cases/${caseId}/timeline`
      );
      setTimelineEvents(response.data || []);
    } catch (error) {
      console.error("Failed to load timeline:", error);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  const buildTimeline = async () => {
    try {
      setLoading(true);
      const response = await api.post<{ success: boolean; data: TimelineEvent[] }>(
        `/api/v1/cases/${caseId}/build_timeline`
      );
      setTimelineEvents(response?.data || []);
    } catch (error) {
      console.error("Failed to build timeline:", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Timeline ({timelineEvents.length} events)</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadTimeline()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => buildTimeline()}>
            <Activity className="h-4 w-4 mr-2" />
            Auto-Build
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Spinner size={24} className="text-muted-foreground" />
          </div>
        ) : timelineEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No timeline events yet</p>
            <p className="text-sm mt-1">
              Click &quot;Auto-Build&quot; to generate a timeline from warehouse data
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

            {/* Timeline events */}
            <div className="space-y-6">
              {timelineEvents.map((event) => (
                <div key={event.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div
                    className={cn(
                      "absolute left-2 w-5 h-5 rounded-full flex items-center justify-center text-white",
                      getTimelineColor(event.event_type)
                    )}
                  >
                    {getTimelineIcon(event.event_type)}
                  </div>

                  {/* Event content */}
                  <div className="bg-muted/30 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground uppercase">
                            {format(new Date(event.event_date), "d MMM yyyy")}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {event.event_type}
                          </Badge>
                        </div>
                        <h4 className="font-medium">{event.title}</h4>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {event.description}
                          </p>
                        )}
                        {event.source && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Source: {event.source}
                          </p>
                        )}
                      </div>
                      {event.metadata && Object.keys(event.metadata as object).length > 0 ? (
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CaseTimelineTab;
