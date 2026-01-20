"use client";

import * as React from "react";
import { useAtom, useSetAtom } from "jotai";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Lock, Pause, AlertTriangle, ExternalLink } from "lucide-react";
import {
  selectedDateAtom,
  calendarEventsAtom,
  selectedEventAtom,
  eventDetailOpenAtom,
  type CalendarEvent,
} from "@/lib/calendar-atoms";
import Link from "next/link";

export function ScheduleView() {
  const [selectedDate] = useAtom(selectedDateAtom);
  const [events] = useAtom(calendarEventsAtom);
  const setSelectedEvent = useSetAtom(selectedEventAtom);
  const setEventDetailOpen = useSetAtom(eventDetailOpenAtom);

  // Group events by date
  const eventsByDate = React.useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};

    // Sort events by start date
    const sortedEvents = [...events].sort((a, b) =>
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );

    sortedEvents.forEach(event => {
      const dateStr = event.start_date;
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(event);
    });

    return grouped;
  }, [events]);

  // Get sorted date keys
  const sortedDates = Object.keys(eventsByDate).sort();

  // Handle event click
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setEventDetailOpen(true);
  };

  // Handle event double-click (open in new tab)
  const handleEventDoubleClick = (event: CalendarEvent) => {
    window.open(`/tasks?taskId=${event.id}`, '_blank');
  };

  // Format date for section header
  const formatDateHeader = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    }

    return date.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  // Get status color
  const getStatusBorder = (status: string, isOverdue: boolean): string => {
    if (isOverdue) return "border-l-red-500";
    switch (status) {
      case "completed":
        return "border-l-green-500";
      case "started":
        return "border-l-blue-500";
      default:
        return "border-l-border";
    }
  };

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <p className="text-lg">No tasks in this period</p>
        <p className="text-sm mt-1">Try changing the date range or filters</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="max-w-3xl mx-auto w-full p-4 space-y-6">
        {sortedDates.map(dateStr => (
          <div key={dateStr}>
            {/* Date header */}
            <h3 className="text-sm font-semibold text-muted-foreground mb-2 sticky top-0 bg-background py-2">
              {formatDateHeader(dateStr)}
            </h3>

            {/* Events for this date */}
            <div className="space-y-2">
              {eventsByDate[dateStr].map(event => (
                <div
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  onDoubleClick={() => handleEventDoubleClick(event)}
                  className={cn(
                    "border-l-4 rounded-r-lg p-3 cursor-pointer transition-all",
                    "hover:shadow-md bg-card border border-l-0",
                    getStatusBorder(event.status, event.is_overdue)
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Task name and icons */}
                      <div className="flex items-center gap-2">
                        {event.is_hold && (
                          <Pause className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                        )}
                        {event.lock_type && (
                          <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        {event.is_overdue && (
                          <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400 flex-shrink-0" />
                        )}
                        <span className="font-medium truncate">{event.name}</span>
                      </div>

                      {/* Job info */}
                      {event.job_name && (
                        <Link
                          href={`/jobs/${event.job_id}`}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {event.job_code} - {event.job_name}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}

                      {/* Date range */}
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}
                        {event.assigned_user_name && (
                          <span className="ml-3">• {event.assigned_user_name}</span>
                        )}
                      </div>
                    </div>

                    {/* Right side - status */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge
                        variant={
                          event.status === "completed"
                            ? "default"
                            : event.status === "started"
                            ? "secondary"
                            : "outline"
                        }
                        className={cn(
                          "text-xs",
                          event.status === "completed" && "bg-green-500",
                          event.status === "started" && "bg-blue-500 text-white"
                        )}
                      >
                        {event.status.replace("_", " ")}
                      </Badge>

                      {event.is_overdue && (
                        <span className="text-xs text-red-500 dark:text-red-400">
                          {event.days_overdue}d overdue
                        </span>
                      )}

                      <span className="text-xs text-muted-foreground">
                        {event.progress_percentage}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
