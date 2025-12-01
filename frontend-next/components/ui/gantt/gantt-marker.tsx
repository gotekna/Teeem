"use client";

import * as React from "react";
import { format, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";
import { useGantt } from "./context";
import type { GanttMarker as GanttMarkerType } from "./types";

type GanttMarkerProps = {
  marker: GanttMarkerType;
};

export function GanttMarker({ marker }: GanttMarkerProps) {
  const { timelineStart, timelineEnd, getDatePosition } = useGantt();
  const [isHovered, setIsHovered] = React.useState(false);

  // Check if marker is within the timeline range
  const isVisible = isWithinInterval(marker.date, {
    start: timelineStart,
    end: timelineEnd,
  });

  if (!isVisible) return null;

  const position = getDatePosition(marker.date);

  return (
    <div
      className="absolute top-0 bottom-0 z-20"
      style={{ left: position }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Marker diamond */}
      <div className="absolute -top-1 -translate-x-1/2">
        <div
          className={cn(
            "w-3 h-3 rotate-45 border-2 border-background",
            marker.color ?? "bg-orange-500"
          )}
        />
      </div>

      {/* Dashed line */}
      <div
        className={cn(
          "w-0.5 h-full border-l-2 border-dashed",
          marker.color ? marker.color.replace("bg-", "border-") : "border-orange-500/50"
        )}
      />

      {/* Tooltip */}
      {isHovered && (
        <div className="absolute top-4 left-2 z-50">
          <div className="bg-popover text-popover-foreground text-[11px] px-3 py-2 shadow-lg border border-border whitespace-nowrap">
            <p className="font-medium">{marker.label}</p>
            <p className="text-muted-foreground font-mono">
              {format(marker.date, "MMM d, yyyy")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

type GanttMarkersProps = {
  markers: GanttMarkerType[];
};

export function GanttMarkers({ markers }: GanttMarkersProps) {
  return (
    <>
      {markers.map((marker) => (
        <GanttMarker key={marker.id} marker={marker} />
      ))}
    </>
  );
}
