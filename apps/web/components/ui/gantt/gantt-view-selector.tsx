"use client";

import * as React from "react";
import { Layers, Users, Wrench, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type GanttGroupMode = "hierarchy" | "supplier" | "trade" | "flat";

type ViewModeConfig = {
  id: GanttGroupMode;
  label: string;
  description: string;
  icon: React.ReactNode;
};

const viewModes: ViewModeConfig[] = [
  {
    id: "hierarchy",
    label: "Hierarchy",
    description: "Group by parent/child structure",
    icon: <Layers className="h-4 w-4" />,
  },
  {
    id: "supplier",
    label: "By Supplier",
    description: "Group tasks by assigned supplier",
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: "trade",
    label: "By Trade",
    description: "Group tasks by trade type",
    icon: <Wrench className="h-4 w-4" />,
  },
  {
    id: "flat",
    label: "Flat List",
    description: "Show all tasks without grouping",
    icon: <List className="h-4 w-4" />,
  },
];

type GanttViewSelectorProps = {
  value: GanttGroupMode;
  onChange: (mode: GanttGroupMode) => void;
  className?: string;
};

export function GanttViewSelector({
  value,
  onChange,
  className,
}: GanttViewSelectorProps) {
  const currentMode = viewModes.find((m) => m.id === value) || viewModes[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-2 text-[11px]", className)}
        >
          {currentMode.icon}
          {currentMode.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {viewModes.map((mode) => (
          <DropdownMenuItem
            key={mode.id}
            onClick={() => onChange(mode.id)}
            className={cn(
              "flex items-start gap-3 py-2",
              value === mode.id && "bg-secondary"
            )}
          >
            <span className="mt-0.5 text-muted-foreground">{mode.icon}</span>
            <div className="flex-1">
              <p className="text-[12px] font-medium">{mode.label}</p>
              <p className="text-[10px] text-muted-foreground">
                {mode.description}
              </p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
