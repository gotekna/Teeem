"use client";

import * as React from "react";
import { useAtom, useSetAtom } from "jotai";
import { cn } from "@/lib/utils";
import {
  selectedDateAtom,
  eventsByDateAtom,
  selectedEventAtom,
  eventDetailOpenAtom,
  isToday,
  isSameDay,
  type CalendarEvent,
} from "@/lib/calendar-atoms";
import { CalendarEventBar } from "./CalendarEventBar";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MonthView() {
  const [selectedDate] = useAtom(selectedDateAtom);
  const [eventsByDate] = useAtom(eventsByDateAtom);
  const setSelectedEvent = useSetAtom(selectedEventAtom);
  const setEventDetailOpen = useSetAtom(eventDetailOpenAtom);

  // Generate calendar grid
  const calendarDays = React.useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    // Start from the Sunday of the week containing the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Generate 6 weeks (42 days)
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }

    return days;
  }, [selectedDate]);

  // Handle event click
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setEventDetailOpen(true);
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = date.toISOString().split("T")[0];
    return eventsByDate[dateStr] || [];
  };

  // Check if date is in current month
  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === selectedDate.getMonth();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6">
        {calendarDays.map((date, index) => {
          const events = getEventsForDate(date);
          const isInMonth = isCurrentMonth(date);
          const isTodayDate = isToday(date);
          const maxVisibleEvents = 3;
          const overflowCount = events.length - maxVisibleEvents;

          return (
            <div
              key={index}
              className={cn(
                "border-b border-r min-h-[100px] p-1",
                !isInMonth && "bg-muted/30",
                isTodayDate && "bg-blue-50 dark:bg-blue-950/20"
              )}
            >
              {/* Date number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    !isInMonth && "text-muted-foreground",
                    isTodayDate &&
                      "bg-blue-600 text-white dark:bg-blue-500"
                  )}
                >
                  {date.getDate()}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-0.5">
                {events.slice(0, maxVisibleEvents).map((event) => (
                  <CalendarEventBar
                    key={event.id}
                    event={event}
                    onClick={() => handleEventClick(event)}
                  />
                ))}

                {/* Overflow indicator */}
                {overflowCount > 0 && (
                  <button
                    className="w-full text-xs text-muted-foreground hover:text-foreground text-left px-1"
                    onClick={() => {
                      // Could open a popover with all events
                      console.log(`+${overflowCount} more`);
                    }}
                  >
                    +{overflowCount} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
