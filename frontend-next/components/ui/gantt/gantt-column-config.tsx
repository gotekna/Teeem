"use client";

import * as React from "react";
import { Settings2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type ColumnConfig = {
  taskNumber: boolean;
  taskName: boolean;
  predecessors: boolean;
  supplier: boolean;
  duration: boolean;
  startDate: boolean;
  endDate: boolean;
  status: boolean;
  progress: boolean;
  lock: boolean;
};

export const defaultColumnConfig: ColumnConfig = {
  taskNumber: true,
  taskName: true,
  predecessors: true,
  supplier: true,
  duration: true,
  startDate: true,
  endDate: true,
  status: true,
  progress: true,
  lock: true,
};

type ColumnDefinition = {
  id: keyof ColumnConfig;
  label: string;
  required?: boolean;
};

const columns: ColumnDefinition[] = [
  { id: "taskNumber", label: "#", required: false },
  { id: "taskName", label: "Task Name", required: true },
  { id: "predecessors", label: "Predecessors" },
  { id: "supplier", label: "Supplier" },
  { id: "duration", label: "Duration" },
  { id: "startDate", label: "Start Date" },
  { id: "endDate", label: "End Date" },
  { id: "status", label: "Status" },
  { id: "progress", label: "Progress" },
  { id: "lock", label: "Lock" },
];

type GanttColumnConfigProps = {
  config: ColumnConfig;
  onConfigChange: (config: ColumnConfig) => void;
  className?: string;
};

export function GanttColumnConfig({
  config,
  onConfigChange,
  className,
}: GanttColumnConfigProps) {
  const visibleCount = Object.values(config).filter(Boolean).length;

  const handleToggle = (columnId: keyof ColumnConfig) => {
    onConfigChange({
      ...config,
      [columnId]: !config[columnId],
    });
  };

  const showAll = () => {
    const allVisible = { ...config };
    columns.forEach((col) => {
      allVisible[col.id] = true;
    });
    onConfigChange(allVisible);
  };

  const hideOptional = () => {
    const minimal = { ...config };
    columns.forEach((col) => {
      minimal[col.id] = col.required || false;
    });
    onConfigChange(minimal);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-1.5 text-[11px]", className)}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Columns
          <span className="text-muted-foreground">({visibleCount})</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[200px] p-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between px-2 pb-2 border-b border-border">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Visible Columns
            </span>
            <div className="flex gap-1">
              <button
                onClick={showAll}
                className="text-[10px] text-primary hover:underline"
              >
                All
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                onClick={hideOptional}
                className="text-[10px] text-primary hover:underline"
              >
                Minimal
              </button>
            </div>
          </div>

          {columns.map((column) => (
            <label
              key={column.id}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary cursor-pointer",
                column.required && "opacity-60"
              )}
            >
              <Checkbox
                checked={config[column.id]}
                onCheckedChange={() => handleToggle(column.id)}
                disabled={column.required}
                className="h-3.5 w-3.5"
              />
              <span className="text-[12px] flex-1">{column.label}</span>
              {config[column.id] ? (
                <Eye className="h-3 w-3 text-muted-foreground" />
              ) : (
                <EyeOff className="h-3 w-3 text-muted-foreground" />
              )}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
