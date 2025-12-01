"use client";

import { Clock } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Label } from "./label";

interface TimeRangeInputProps {
  startTime?: string;
  endTime?: string;
  onStartTimeChange?: (time: string) => void;
  onEndTimeChange?: (time: string) => void;
  startLabel?: string;
  endLabel?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
}

const TimeRangeInput = React.forwardRef<HTMLDivElement, TimeRangeInputProps>(
  (
    {
      startTime = "",
      endTime = "",
      onStartTimeChange,
      onEndTimeChange,
      startLabel = "Start Time",
      endLabel = "End Time",
      className,
      disabled = false,
      error,
    },
    ref,
  ) => {
    return (
      <div ref={ref} className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1.5 flex-1">
            <Label
              htmlFor="start-time"
              className="text-brand-sm text-text-secondary"
            >
              {startLabel}
            </Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => onStartTimeChange?.(e.target.value)}
                disabled={disabled}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex items-center pt-6">
            <span className="text-text-muted text-brand-md">to</span>
          </div>

          <div className="flex flex-col gap-1.5 flex-1">
            <Label
              htmlFor="end-time"
              className="text-brand-sm text-text-secondary"
            >
              {endLabel}
            </Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                id="end-time"
                type="time"
                value={endTime}
                onChange={(e) => onEndTimeChange?.(e.target.value)}
                disabled={disabled}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-brand-sm text-status-error-foreground">{error}</p>
        )}
      </div>
    );
  },
);
TimeRangeInput.displayName = "TimeRangeInput";

export { TimeRangeInput };
