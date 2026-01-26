"use client";

import * as React from "react";
import { useAtom, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import {
  selectedDateAtom,
  eventsByDateAtom,
  selectedEventAtom,
  eventDetailOpenAtom,
  isToday,
  type CalendarEvent,
} from "@/lib/calendar-atoms";
import { CalendarEventBar } from "./CalendarEventBar";
import {
  createEventOpenAtom,
  createEventDateAtom,
} from "./CreateEventDialog";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekView() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useAtom(selectedDateAtom);
  const [eventsByDate] = useAtom(eventsByDateAtom);
  const setSelectedEvent = useSetAtom(selectedEventAtom);
  const setEventDetailOpen = useSetAtom(eventDetailOpenAtom);
  const setEventOpen = useSetAtom(createEventOpenAtom);
  const setEventDate = useSetAtom(createEventDateAtom);

  // Generate week days starting from Sunday of selected week
  const weekDays = React.useMemo(() => {
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - start.getDay()); // Go to Sunday

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      days.push(day);
    }
    return days;
  }, [selectedDate]);

  // Handle event click
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setEventDetailOpen(true);
  };

  // Double-click day to navigate to day view (path-based URL)
  const handleDayDoubleClick = (date: Date) => {
    // Update selected date state, then navigate to day view
    setSelectedDate(date);
    router.push(`/calendar/day`, { scroll: false });
  };

  // Create event for date
  const handleCreateEvent = (date: Date) => {
    setEventDate(date);
    setEventOpen(true);
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = date.toISOString().split("T")[0];
    return eventsByDate[dateStr] || [];
  };

  // Format date for header
  const formatDateHeader = (date: Date): string => {
    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {weekDays.map((date, index) => {
          const isTodayDate = isToday(date);
          return (
            <div
              key={index}
              className={cn(
                "px-2 py-3 text-center border-r last:border-r-0",
                isTodayDate && "bg-blue-50 dark:bg-blue-950/20"
              )}
            >
              <div className="text-sm font-medium text-muted-foreground">
                {DAYS_OF_WEEK[index]}
              </div>
              <div
                className={cn(
                  "text-lg font-semibold mt-1",
                  isTodayDate && "text-blue-600 dark:text-blue-400"
                )}
              >
                {date.getDate()}
              </div>
              <div className="text-xs text-muted-foreground">
                {date.toLocaleDateString("en-AU", { month: "short" })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Week grid */}
      <div className="flex-1 grid grid-cols-7 overflow-hidden">
        {weekDays.map((date, index) => {
          const events = getEventsForDate(date);
          const isTodayDate = isToday(date);

          return (
            <div
              key={index}
              onDoubleClick={() => handleDayDoubleClick(date)}
              className={cn(
                "border-r last:border-r-0 p-2 overflow-y-auto cursor-pointer group",
                isTodayDate && "bg-blue-50/50 dark:bg-blue-950/10"
              )}
            >
              {/* Add event button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateEvent(date);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity w-full mb-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded flex items-center justify-center gap-1"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>

              {/* Events */}
              <div className="space-y-1">
                {events.map((event) => (
                  <CalendarEventBar
                    key={event.id}
                    event={event}
                    onClick={() => handleEventClick(event)}
                  />
                ))}
              </div>

              {/* Empty state */}
              {events.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  No tasks
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
