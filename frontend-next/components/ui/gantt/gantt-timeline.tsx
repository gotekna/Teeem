"use client";

import * as React from "react";
import {
  addDays,
  addMonths,
  addQuarters,
  differenceInDays,
  startOfMonth,
  startOfQuarter,
  isToday,
  isSameMonth,
  isSameQuarter,
} from "date-fns";
import { cn } from "@/lib/utils";
import { useGantt } from "./context";

type GanttTimelineProps = {
  children?: React.ReactNode;
};

export function GanttTimeline({ children }: GanttTimelineProps) {
  const { range, timelineStart, timelineEnd, columnWidth } =
    useGantt();

  // Calculate total width
  const totalWidth = React.useMemo(() => {
    if (range === "daily") {
      const days = differenceInDays(timelineEnd, timelineStart) + 1;
      return days * columnWidth;
    } else if (range === "monthly") {
      let count = 0;
      let current = startOfMonth(timelineStart);
      while (current <= timelineEnd) {
        count++;
        current = addMonths(current, 1);
      }
      return count * columnWidth;
    } else {
      let count = 0;
      let current = startOfQuarter(timelineStart);
      while (current <= timelineEnd) {
        count++;
        current = addQuarters(current, 1);
      }
      return count * columnWidth;
    }
  }, [range, timelineStart, timelineEnd, columnWidth]);

  // Generate grid columns for background
  const gridColumns = React.useMemo(() => {
    const cols: { date: Date; isToday: boolean }[] = [];

    if (range === "daily") {
      const totalDays = differenceInDays(timelineEnd, timelineStart) + 1;
      for (let i = 0; i < totalDays; i++) {
        const date = addDays(timelineStart, i);
        cols.push({ date, isToday: isToday(date) });
      }
    } else if (range === "monthly") {
      let current = startOfMonth(timelineStart);
      while (current <= timelineEnd) {
        cols.push({ date: current, isToday: isSameMonth(current, new Date()) });
        current = addMonths(current, 1);
      }
    } else {
      let current = startOfQuarter(timelineStart);
      while (current <= timelineEnd) {
        cols.push({ date: current, isToday: isSameQuarter(current, new Date()) });
        current = addQuarters(current, 1);
      }
    }

    return cols;
  }, [range, timelineStart, timelineEnd]);

  return (
    <div className="relative" style={{ width: totalWidth }}>
      {/* Grid background */}
      <div className="absolute inset-0 flex pointer-events-none">
        {gridColumns.map((col, i) => (
          <div
            key={col.date.toISOString()}
            className={cn(
              "shrink-0 border-r border-border",
              col.isToday && "bg-primary/5"
            )}
            style={{ width: columnWidth }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative">{children}</div>
    </div>
  );
}

type GanttTimelineRowProps = {
  children?: React.ReactNode;
};

export function GanttTimelineRow({ children }: GanttTimelineRowProps) {
  const { rowHeight } = useGantt();

  return (
    <div
      className="relative border-b border-border"
      style={{ height: rowHeight }}
    >
      {children}
    </div>
  );
}
