"use client";

import * as React from "react";
import { isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { useGantt } from "./context";

export function GanttToday() {
  const { timelineStart, timelineEnd, getDatePosition } = useGantt();
  const today = new Date();

  // Check if today is within the timeline range
  const isVisible = isWithinInterval(today, {
    start: timelineStart,
    end: timelineEnd,
  });

  if (!isVisible) return null;

  const position = getDatePosition(today);

  return (
    <div
      className="absolute top-0 bottom-0 z-30 pointer-events-none"
      style={{ left: position }}
    >
      {/* Marker dot */}
      <div className="absolute -top-1 -translate-x-1/2">
        <div className="w-3 h-3 rounded-full bg-accent-today border-2 border-background" />
      </div>

      {/* Vertical line */}
      <div className="w-0.5 h-full bg-accent-today/70" />
    </div>
  );
}
