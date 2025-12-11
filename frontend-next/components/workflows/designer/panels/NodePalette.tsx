"use client";

import React from "react";
import {
  Play,
  Square,
  User,
  Cog,
  GitBranch,
  GitMerge,
  Clock,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BpmnNodeType } from "../types";

interface PaletteItem {
  type: BpmnNodeType;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: "start_event",
    label: "Start Event",
    icon: Play,
    color: "green",
    description: "Beginning of the workflow",
  },
  {
    type: "end_event",
    label: "End Event",
    icon: Square,
    color: "red",
    description: "Completion of the workflow",
  },
  {
    type: "user_task",
    label: "User Task",
    icon: User,
    color: "blue",
    description: "Manual task assigned to a user",
  },
  {
    type: "service_task",
    label: "Service Task",
    icon: Cog,
    color: "purple",
    description: "Automated task execution",
  },
  {
    type: "exclusive_gateway",
    label: "Exclusive Gateway",
    icon: GitBranch,
    color: "amber",
    description: "Decision point - one path",
  },
  {
    type: "parallel_gateway",
    label: "Parallel Gateway",
    icon: GitMerge,
    color: "emerald",
    description: "Split/join parallel paths",
  },
  {
    type: "timer_event",
    label: "Timer Event",
    icon: Clock,
    color: "cyan",
    description: "Wait for time duration",
  },
  {
    type: "data_store_reference",
    label: "Data Store",
    icon: Database,
    color: "slate",
    description: "Reference to a data store",
  },
];

const COLOR_CLASSES: Record<string, string> = {
  green:
    "bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/50",
  red: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/50",
  blue: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/50",
  purple:
    "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/30 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-950/50",
  amber:
    "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950/50",
  emerald:
    "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/50",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-800 dark:hover:bg-cyan-950/50",
  slate:
    "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-950/30 dark:text-slate-400 dark:border-slate-800 dark:hover:bg-slate-950/50",
};

export function NodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: BpmnNodeType) => {
    event.dataTransfer.setData("application/bpmn-node", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="space-y-2">
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
        Drag elements to canvas
      </h3>
      {PALETTE_ITEMS.map((item) => (
        <div
          key={item.type}
          draggable
          onDragStart={(e) => onDragStart(e, item.type)}
          className={cn(
            "flex cursor-grab items-center gap-3 rounded-lg border p-3 transition-colors active:cursor-grabbing",
            COLOR_CLASSES[item.color]
          )}
        >
          <item.icon className="h-5 w-5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{item.label}</p>
            <p className="truncate text-xs opacity-70">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
