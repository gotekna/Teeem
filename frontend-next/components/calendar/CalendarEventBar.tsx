"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { type CalendarEvent, getStatusColorClass } from "@/lib/calendar-atoms";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Lock, Pause, AlertTriangle } from "lucide-react";

interface CalendarEventBarProps {
  event: CalendarEvent;
  onClick?: () => void;
  className?: string;
}

export function CalendarEventBar({
  event,
  onClick,
  className,
}: CalendarEventBarProps) {
  const router = useRouter();
  const colorClass = getStatusColorClass(event.status, event.is_overdue);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            onDoubleClick={() => window.open(`/tasks?taskId=${event.id}`, '_blank')}
            className={cn(
              "w-full text-left text-xs px-1.5 py-0.5 rounded truncate",
              "hover:opacity-80 transition-opacity cursor-pointer",
              "flex items-center gap-1",
              colorClass,
              "text-white",
              className
            )}
          >
            {/* Status indicators */}
            {event.is_hold && <Pause className="h-3 w-3 flex-shrink-0" />}
            {event.lock_type && <Lock className="h-3 w-3 flex-shrink-0" />}
            {event.is_overdue && <AlertTriangle className="h-3 w-3 flex-shrink-0" />}

            {/* Event name */}
            <span className="truncate">{event.name}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{event.name}</p>
            {event.job_name && (
              <p className="text-xs text-muted-foreground">
                {event.job_code} - {event.job_name}
              </p>
            )}
            <div className="flex items-center gap-2 text-xs">
              <span>
                {new Date(event.start_date).toLocaleDateString()} -{" "}
                {new Date(event.end_date).toLocaleDateString()}
              </span>
            </div>
            {event.assigned_user_name && (
              <p className="text-xs">Assigned: {event.assigned_user_name}</p>
            )}
            {event.is_overdue && (
              <p className="text-xs text-red-500 dark:text-red-400">
                Overdue by {event.days_overdue} day{event.days_overdue !== 1 ? "s" : ""}
              </p>
            )}
            {event.is_hold && event.hold_reason && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400">On hold: {event.hold_reason}</p>
            )}
            <div className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-white",
                  event.status === "completed"
                    ? "bg-green-500"
                    : event.status === "started"
                    ? "bg-blue-500"
                    : "bg-muted-foreground"
                )}
              >
                {(event.status || 'not_started').replace("_", " ")}
              </span>
              <span>{event.progress_percentage}%</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
