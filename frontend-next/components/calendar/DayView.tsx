"use client";

import * as React from "react";
import { useAtom, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Lock, Pause, AlertTriangle, ExternalLink } from "lucide-react";
import {
  selectedDateAtom,
  eventsByDateAtom,
  selectedEventAtom,
  eventDetailOpenAtom,
  calendarViewAtom,
  isToday,
  type CalendarEvent,
} from "@/lib/calendar-atoms";
import Link from "next/link";

export function DayView() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useAtom(selectedDateAtom);
  const [eventsByDate] = useAtom(eventsByDateAtom);
  const setSelectedEvent = useSetAtom(selectedEventAtom);
  const setEventDetailOpen = useSetAtom(eventDetailOpenAtom);
  const setView = useSetAtom(calendarViewAtom);

  // Get events for selected date
  const dateStr = selectedDate.toISOString().split("T")[0];
  const events = eventsByDate[dateStr] || [];

  // Sort events by status priority (overdue first, then started, then not started)
  const sortedEvents = [...events].sort((a, b) => {
    if (a.is_overdue && !b.is_overdue) return -1;
    if (!a.is_overdue && b.is_overdue) return 1;
    if (a.status === "started" && b.status !== "started") return -1;
    if (a.status !== "started" && b.status === "started") return 1;
    return 0;
  });

  // Handle back to month view
  const handleBack = () => {
    setView("month");
    router.push("/calendar");
  };

  // Handle event click
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setEventDetailOpen(true);
  };

  // Handle event double-click (go to full page)
  const handleEventDoubleClick = (event: CalendarEvent) => {
    router.push(`/tasks?taskId=${event.id}`);
  };

  // Format date for header
  const formatDateHeader = (date: Date): string => {
    return date.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Get status color
  const getStatusColor = (status: string, isOverdue: boolean): string => {
    if (isOverdue) return "border-red-500 bg-red-50 dark:bg-red-950/20";
    switch (status) {
      case "completed":
        return "border-green-500 bg-green-50 dark:bg-green-950/20";
      case "started":
        return "border-blue-500 bg-blue-50 dark:bg-blue-950/20";
      default:
        return "border-gray-300 bg-gray-50 dark:bg-gray-800/50";
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b bg-background">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Month
        </Button>
        <div className="flex-1">
          <h2 className={cn(
            "text-lg font-semibold",
            isToday(selectedDate) && "text-blue-600 dark:text-blue-400"
          )}>
            {formatDateHeader(selectedDate)}
            {isToday(selectedDate) && (
              <Badge variant="secondary" className="ml-2">Today</Badge>
            )}
          </h2>
        </div>
        <div className="text-sm text-muted-foreground">
          {events.length} task{events.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-auto p-4">
        {sortedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p className="text-lg">No tasks scheduled for this day</p>
            <p className="text-sm mt-1">Double-click to create a meeting</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl mx-auto">
            {sortedEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => handleEventClick(event)}
                onDoubleClick={() => handleEventDoubleClick(event)}
                className={cn(
                  "border-l-4 rounded-lg p-4 cursor-pointer transition-all",
                  "hover:shadow-md",
                  getStatusColor(event.status, event.is_overdue)
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Event name and icons */}
                    <div className="flex items-center gap-2">
                      {event.is_hold && (
                        <Pause className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                      )}
                      {event.lock_type && (
                        <Lock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      )}
                      {event.is_overdue && (
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      <h3 className="font-medium truncate">{event.name}</h3>
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

                    {/* Description */}
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {/* Dates */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>
                        {new Date(event.start_date).toLocaleDateString()} -{" "}
                        {new Date(event.end_date).toLocaleDateString()}
                      </span>
                      {event.assigned_user_name && (
                        <span>Assigned: {event.assigned_user_name}</span>
                      )}
                    </div>

                    {/* Hold reason */}
                    {event.is_hold && event.hold_reason && (
                      <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-400">
                        On hold: {event.hold_reason}
                      </div>
                    )}
                  </div>

                  {/* Right side - status and progress */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <Badge
                      variant={
                        event.status === "completed"
                          ? "default"
                          : event.status === "started"
                          ? "secondary"
                          : "outline"
                      }
                      className={cn(
                        event.status === "completed" && "bg-green-500",
                        event.status === "started" && "bg-blue-500 text-white"
                      )}
                    >
                      {event.status.replace("_", " ")}
                    </Badge>

                    {event.is_overdue && (
                      <Badge variant="destructive">
                        {event.days_overdue} day{event.days_overdue !== 1 ? "s" : ""} overdue
                      </Badge>
                    )}

                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            event.status === "completed"
                              ? "bg-green-500"
                              : event.status === "started"
                              ? "bg-blue-500"
                              : "bg-gray-400"
                          )}
                          style={{ width: `${event.progress_percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {event.progress_percentage}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
