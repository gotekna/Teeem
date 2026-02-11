"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import type { GanttTask } from "@/lib/gantt/types";

interface GanttTaskQuickEditProps {
  task: GanttTask;
  position: { x: number; y: number };
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskId: string, updates: { start_date: string; duration_days: number; hold: boolean; hold_date: string }) => void;
}

export function GanttTaskQuickEdit({ task, position, isOpen, onClose, onSave }: GanttTaskQuickEditProps) {
  const taskDuration = (task.rowData as any)?.duration_days || 1;
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(task.startDate);
  const [duration, setDuration] = React.useState(taskDuration);
  const [saving, setSaving] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Reset form when task changes
  React.useEffect(() => {
    setSelectedDate(task.startDate);
    setDuration((task.rowData as any)?.duration_days || 1);
  }, [task.id, task.startDate, task.rowData]);

  // Close on click outside
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay to avoid closing immediately from the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Format date as YYYY-MM-DD in local timezone (same as executeDragMove)
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleSave = async () => {
    if (!selectedDate) return;
    setSaving(true);
    try {
      const dateStr = formatDate(selectedDate);
      await onSave(task.id, {
        start_date: dateStr,
        duration_days: duration,
        hold: true,
        hold_date: dateStr,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = (() => {
    if (!selectedDate || !task.startDate) return false;
    const dateChanged = formatDate(selectedDate) !== formatDate(task.startDate);
    const durationChanged = duration !== taskDuration;
    return dateChanged || durationChanged;
  })();

  // Position the popover - keep it on screen
  const popoverStyle: React.CSSProperties = {
    position: "fixed",
    left: Math.min(position.x, window.innerWidth - 340),
    top: Math.min(position.y + 10, window.innerHeight - 450),
    zIndex: 9999,
  };

  return (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="bg-popover text-popover-foreground rounded-lg border shadow-lg w-[310px] animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="text-sm font-medium truncate flex-1 mr-2">
          {task.name}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Body */}
      <div className="p-3 space-y-3">
        {/* Duration row */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Start Date</Label>
            <div className="text-sm font-medium mt-0.5">
              {selectedDate?.toLocaleDateString("en-AU", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              }) || "Not set"}
            </div>
          </div>
          <div className="w-20">
            <Label htmlFor="quick-duration" className="text-xs text-muted-foreground">Duration</Label>
            <div className="flex items-center gap-1 mt-0.5">
              <Input
                id="quick-duration"
                type="number"
                min={1}
                max={365}
                value={duration}
                onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                className="h-7 text-sm"
              />
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && setSelectedDate(date)}
          defaultMonth={selectedDate}
          className="rounded-md border p-0 [--cell-size:1.75rem] [&_button[data-selected-single=true]]:bg-accent [&_button[data-selected-single=true]]:text-accent-foreground [&_button[data-selected-single=true]]:ring-1 [&_button[data-selected-single=true]]:ring-primary/40"
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
