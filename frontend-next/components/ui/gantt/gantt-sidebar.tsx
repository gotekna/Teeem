"use client";

import * as React from "react";
import { format, differenceInDays } from "date-fns";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGantt } from "./context";
import type { GanttFeature, GanttGroup } from "./types";

type GanttSidebarProps = {
  children?: React.ReactNode;
};

export function GanttSidebar({ children }: GanttSidebarProps) {
  const { sidebarWidth } = useGantt();

  return (
    <div
      className="shrink-0 border-r border-border bg-background"
      style={{ width: sidebarWidth }}
    >
      {children}
    </div>
  );
}

type GanttSidebarGroupProps = {
  group: GanttGroup;
  defaultExpanded?: boolean;
  children?: React.ReactNode;
};

export function GanttSidebarGroup({
  group,
  defaultExpanded = true,
  children,
}: GanttSidebarGroupProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const { rowHeight } = useGantt();

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 h-10 bg-secondary/30 hover:bg-secondary/50 transition-colors border-b border-border"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-[11px] font-medium truncate">{group.name}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {group.features.length}
        </span>
      </button>
      {expanded && children}
    </div>
  );
}

type GanttSidebarItemProps = {
  feature: GanttFeature;
  onClick?: () => void;
};

export function GanttSidebarItem({ feature, onClick }: GanttSidebarItemProps) {
  const { rowHeight } = useGantt();
  const duration = differenceInDays(feature.endAt, feature.startAt) + 1;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 border-b border-border hover:bg-secondary/30 transition-colors text-left"
      style={{ height: rowHeight }}
    >
      <div
        className={cn("w-2 h-2 shrink-0", feature.status.color)}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium truncate">{feature.name}</p>
        <p className="text-[10px] text-muted-foreground font-mono">
          {duration} {duration === 1 ? "day" : "days"}
        </p>
      </div>
    </button>
  );
}
