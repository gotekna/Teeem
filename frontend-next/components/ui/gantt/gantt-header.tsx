"use client";

import * as React from "react";
import {
  format,
  addDays,
  addMonths,
  addQuarters,
  differenceInDays,
  differenceInMonths,
  differenceInQuarters,
  startOfMonth,
  startOfQuarter,
  isToday,
  isSameMonth,
  isSameQuarter,
} from "date-fns";
import { cn } from "@/lib/utils";
import { useGantt } from "./context";

export function GanttHeader() {
  const {
    range,
    timelineStart,
    timelineEnd,
    columnWidth,
    sidebarWidth,
  } = useGantt();

  const columns = React.useMemo(() => {
    const cols: { date: Date; label: string; sublabel?: string; isToday?: boolean }[] = [];

    if (range === "daily") {
      const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;
      for (let i = 0; i < totalDays; i++) {
        const date = addDays(timelineStart, i);
        cols.push({
          date,
          label: format(date, "d"),
          sublabel: format(date, "EEE"),
          isToday: isToday(date),
        });
      }
    } else if (range === "monthly") {
      let current = startOfMonth(timelineStart);
      while (current <= timelineEnd) {
        cols.push({
          date: current,
          label: format(current, "MMM"),
          sublabel: format(current, "yyyy"),
          isToday: isSameMonth(current, new Date()),
        });
        current = addMonths(current, 1);
      }
    } else {
      let current = startOfQuarter(timelineStart);
      while (current <= timelineEnd) {
        cols.push({
          date: current,
          label: `Q${Math.floor(current.getMonth() / 3) + 1}`,
          sublabel: format(current, "yyyy"),
          isToday: isSameQuarter(current, new Date()),
        });
        current = addQuarters(current, 1);
      }
    }

    return cols;
  }, [range, timelineStart, timelineEnd]);

  // Calculate total width for header columns
  const totalWidth = React.useMemo(() => {
    return columns.length * columnWidth;
  }, [columns.length, columnWidth]);

  return (
    <div className="flex border-b border-border bg-background">
      {/* Sidebar header spacer - sticky left */}
      <div
        className="shrink-0 border-r border-border bg-secondary/50 sticky left-0 z-10"
        style={{ width: sidebarWidth }}
      >
        <div className="h-12 flex items-center px-4">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Tasks
          </span>
        </div>
      </div>

      {/* Timeline header columns */}
      <div className="flex h-12" style={{ width: totalWidth }}>
        {columns.map((col, i) => (
          <div
            key={col.date.toISOString()}
            className={cn(
              "shrink-0 flex flex-col items-center justify-center border-r border-border",
              col.isToday && "bg-primary/5"
            )}
            style={{ width: columnWidth }}
          >
            <span
              className={cn(
                "text-[11px] font-medium",
                col.isToday ? "text-primary" : "text-foreground"
              )}
            >
              {col.label}
            </span>
            {col.sublabel && (
              <span className="text-[10px] text-muted-foreground">
                {col.sublabel}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
