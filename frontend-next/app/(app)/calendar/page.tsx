"use client";

import * as React from "react";
import { useAtom, useSetAtom } from "jotai";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Users,
  BarChart3,
  List,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  calendarViewAtom,
  calendarModeAtom,
  selectedDateAtom,
  dateRangeAtom,
  calendarFiltersAtom,
  calendarEventsAtom,
  eventsByDateAtom,
  calendarLoadingAtom,
  calendarSummaryAtom,
  getMonthName,
  type CalendarEvent,
  type CalendarSummary,
} from "@/lib/calendar-atoms";
import { MonthView } from "@/components/calendar/MonthView";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";

interface CalendarResponse {
  success: boolean;
  events: CalendarEvent[];
  events_by_date: Record<string, CalendarEvent[]>;
  meta: {
    total_count: number;
    overdue_count: number;
    today_count: number;
    this_week_count: number;
  };
}

interface SummaryResponse {
  success: boolean;
  summary: CalendarSummary;
}

export default function CalendarPage() {
  const [view, setView] = useAtom(calendarViewAtom);
  const [mode, setMode] = useAtom(calendarModeAtom);
  const [selectedDate, setSelectedDate] = useAtom(selectedDateAtom);
  const [dateRange] = useAtom(dateRangeAtom);
  const [filters] = useAtom(calendarFiltersAtom);
  const setEvents = useSetAtom(calendarEventsAtom);
  const setEventsByDate = useSetAtom(eventsByDateAtom);
  const [loading, setLoading] = useAtom(calendarLoadingAtom);
  const setSummary = useSetAtom(calendarSummaryAtom);
  const [summary, setSummaryLocal] = React.useState<CalendarSummary | null>(null);

  // Load calendar data
  const loadCalendarData = React.useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end,
        view_mode: mode,
        include_unassigned: String(filters.includeUnassigned),
      });

      if (filters.userIds.length > 0) {
        filters.userIds.forEach((id) => params.append("user_ids[]", String(id)));
      }
      if (filters.roleIds.length > 0) {
        filters.roleIds.forEach((id) => params.append("role_ids[]", String(id)));
      }
      if (filters.jobId) {
        params.append("job_id", String(filters.jobId));
      }
      if (filters.statuses.length > 0) {
        filters.statuses.forEach((s) => params.append("statuses[]", s));
      }

      const response = await api.get<CalendarResponse>(
        `/api/v1/calendar/events?${params.toString()}`
      );

      if (response.success) {
        setEvents(response.events);
        setEventsByDate(response.events_by_date);
      }
    } catch (error) {
      console.error("Failed to load calendar data:", error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, mode, filters, setEvents, setEventsByDate, setLoading]);

  // Load summary
  const loadSummary = React.useCallback(async () => {
    try {
      const response = await api.get<SummaryResponse>("/api/v1/calendar/summary");
      if (response.success) {
        setSummary(response.summary);
        setSummaryLocal(response.summary);
      }
    } catch (error) {
      console.error("Failed to load summary:", error);
    }
  }, [setSummary]);

  // Initial load
  React.useEffect(() => {
    loadCalendarData();
  }, [loadCalendarData]);

  React.useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Navigation
  const goToPrevious = () => {
    const newDate = new Date(selectedDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (view === "week") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setSelectedDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(selectedDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (view === "week") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Calendar</h1>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={goToPrevious}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={goToNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Current period */}
          <span className="text-lg font-medium">{getMonthName(selectedDate)}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={mode === "personal" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMode("personal")}
              className="rounded-r-none"
            >
              <CalendarIcon className="h-4 w-4 mr-1" />
              My Tasks
            </Button>
            <Button
              variant={mode === "team" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMode("team")}
              className="rounded-none border-x"
            >
              <Users className="h-4 w-4 mr-1" />
              Team
            </Button>
            <Button
              variant={mode === "resource" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setMode("resource")}
              className="rounded-l-none"
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Capacity
            </Button>
          </div>

          {/* View type toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={view === "month" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("month")}
              className="rounded-r-none"
            >
              Month
            </Button>
            <Button
              variant={view === "week" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("week")}
              className="rounded-none border-x"
            >
              Week
            </Button>
            <Button
              variant={view === "schedule" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("schedule")}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          {/* Refresh */}
          <Button variant="outline" size="icon" onClick={loadCalendarData} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Summary badges */}
      {summary && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          {summary.overdue > 0 && (
            <Badge variant="destructive">{summary.overdue} overdue</Badge>
          )}
          <Badge variant="outline">{summary.due_today} today</Badge>
          <Badge variant="outline">{summary.due_this_week} this week</Badge>
          <Badge variant="secondary">{summary.in_progress} in progress</Badge>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Calendar grid */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              {view === "month" && <MonthView />}
              {view === "week" && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Week view coming soon...
                </div>
              )}
              {view === "schedule" && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Schedule view coming soon...
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar */}
        <CalendarSidebar />
      </div>
    </div>
  );
}
