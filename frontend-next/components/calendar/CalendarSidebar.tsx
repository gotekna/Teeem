"use client";

import * as React from "react";
import { useAtom, useSetAtom } from "jotai";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  selectedDateAtom,
  selectedEventAtom,
  eventDetailOpenAtom,
  calendarSummaryAtom,
  type CalendarEvent,
} from "@/lib/calendar-atoms";
import Link from "next/link";

export function CalendarSidebar() {
  const [selectedDate, setSelectedDate] = useAtom(selectedDateAtom);
  const [selectedEvent] = useAtom(selectedEventAtom);
  const [eventDetailOpen, setEventDetailOpen] = useAtom(eventDetailOpenAtom);
  const [summary] = useAtom(calendarSummaryAtom);

  return (
    <>
      {/* Sidebar */}
      <div className="w-64 border-l bg-background p-4 space-y-4 hidden lg:block">
        {/* Mini calendar */}
        <Card>
          <CardContent className="p-2">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md"
            />
          </CardContent>
        </Card>

        {/* Quick stats */}
        {summary && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Overdue</span>
                <Badge variant={summary.overdue > 0 ? "destructive" : "secondary"}>
                  {summary.overdue}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Due Today</span>
                <Badge variant="outline">{summary.due_today}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">This Week</span>
                <Badge variant="outline">{summary.due_this_week}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">In Progress</span>
                <Badge variant="secondary">{summary.in_progress}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Not Started</span>
                <Badge variant="outline">{summary.not_started}</Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Event detail sheet */}
      <Sheet open={eventDetailOpen} onOpenChange={setEventDetailOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Task Details</SheetTitle>
          </SheetHeader>

          {selectedEvent && <EventDetail event={selectedEvent} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function EventDetail({ event }: { event: CalendarEvent }) {
  return (
    <div className="space-y-4 mt-4">
      {/* Task name */}
      <div>
        <h3 className="text-lg font-semibold">{event.name}</h3>
        {event.description && (
          <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
        )}
      </div>

      {/* Job info */}
      {event.job_name && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Job:</span>
          <Link
            href={`/jobs/${event.job_id}`}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            {event.job_code} - {event.job_name}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-xs text-muted-foreground block">Start Date</span>
          <span className="text-sm font-medium">
            {new Date(event.start_date).toLocaleDateString()}
          </span>
        </div>
        <div>
          <span className="text-xs text-muted-foreground block">End Date</span>
          <span className="text-sm font-medium">
            {new Date(event.end_date).toLocaleDateString()}
          </span>
        </div>
        {event.required_by && (
          <div>
            <span className="text-xs text-muted-foreground block">Required By</span>
            <span className="text-sm font-medium">
              {new Date(event.required_by).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
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
          {(event.status || 'not_started').replace("_", " ")}
        </Badge>
        {event.is_overdue && (
          <Badge variant="destructive">
            {event.days_overdue} day{event.days_overdue !== 1 ? "s" : ""} overdue
          </Badge>
        )}
      </div>

      {/* Progress */}
      <div>
        <span className="text-xs text-muted-foreground block mb-1">Progress</span>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                event.status === "completed"
                  ? "bg-green-500"
                  : event.status === "started"
                  ? "bg-blue-500"
                  : "bg-muted-foreground"
              )}
              style={{ width: `${event.progress_percentage}%` }}
            />
          </div>
          <span className="text-sm font-medium">{event.progress_percentage}%</span>
        </div>
      </div>

      {/* Assigned to */}
      {event.assigned_user_name && (
        <div>
          <span className="text-xs text-muted-foreground block">Assigned To</span>
          <span className="text-sm font-medium">{event.assigned_user_name}</span>
        </div>
      )}

      {/* Hold info */}
      {event.is_hold && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-md">
          <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
            On Hold
          </span>
          {event.hold_reason && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
              {event.hold_reason}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <Button asChild className="flex-1">
          <Link href={`/tasks?taskId=${event.id}`}>Open Task</Link>
        </Button>
        {event.job_id && (
          <Button variant="outline" asChild>
            <Link href={`/gantt-schedule?job=${event.job_id}`}>View Gantt</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
