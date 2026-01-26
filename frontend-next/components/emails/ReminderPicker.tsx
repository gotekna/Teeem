"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import {
  Bell,
  BellOff,
  Calendar as CalendarIcon,
  Clock,
  Sun,
  Sunrise,
  ChevronRight,
  X,
} from "lucide-react";
import { format, addHours, addDays, setHours, setMinutes, isBefore, startOfTomorrow, nextMonday } from "date-fns";

// Types
export interface ReminderState {
  remind_at: string | null;
  reminder_sent: boolean;
}

// Preset options for quick reminder setting
const REMINDER_PRESETS = [
  {
    key: "1_hour",
    label: "In 1 hour",
    icon: Clock,
    getTime: () => addHours(new Date(), 1),
  },
  {
    key: "4_hours",
    label: "In 4 hours",
    icon: Clock,
    getTime: () => addHours(new Date(), 4),
  },
  {
    key: "tomorrow_9am",
    label: "Tomorrow at 9am",
    icon: Sunrise,
    getTime: () => setMinutes(setHours(startOfTomorrow(), 9), 0),
  },
  {
    key: "next_week",
    label: "Next Monday at 9am",
    icon: CalendarIcon,
    getTime: () => setMinutes(setHours(nextMonday(new Date()), 9), 0),
  },
];

// API Functions
async function setReminder(emailId: number, remindAt: Date): Promise<ReminderState> {
  const response = await api.post<{ data: ReminderState }>(
    `/api/v1/email_user_states/for_email/${emailId}/set_reminder`,
    { remind_at: remindAt.toISOString() }
  );
  return (response as { data: ReminderState }).data;
}

async function clearReminder(emailId: number): Promise<ReminderState> {
  const response = await api.delete<{ data: ReminderState }>(
    `/api/v1/email_user_states/for_email/${emailId}/clear_reminder`
  );
  return (response as { data: ReminderState }).data;
}

// Reminder Badge Component
interface ReminderBadgeProps {
  remindAt: string;
  onClear?: () => void;
  size?: "sm" | "md";
  className?: string;
}

export function ReminderBadge({ remindAt, onClear, size = "md", className }: ReminderBadgeProps) {
  const reminderDate = new Date(remindAt);
  const isToday = new Date().toDateString() === reminderDate.toDateString();
  const isPast = isBefore(reminderDate, new Date());

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1",
        isPast
          ? "bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400"
          : "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400",
        size === "sm" ? "text-xs px-1.5 py-0" : "text-xs px-2 py-0.5",
        className
      )}
    >
      <Bell className="h-3 w-3" />
      <span>
        {isPast
          ? "Overdue"
          : isToday
          ? format(reminderDate, "h:mm a")
          : format(reminderDate, "MMM d, h:mm a")}
      </span>
      {onClear && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="ml-0.5 hover:opacity-70"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}

// Custom Time Picker
interface CustomTimePickerProps {
  onSelect: (date: Date) => void;
  onCancel: () => void;
}

function CustomTimePicker({ onSelect, onCancel }: CustomTimePickerProps) {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [hour, setHour] = useState("9");
  const [minute, setMinute] = useState("00");
  const [ampm, setAmpm] = useState("AM");

  const handleConfirm = () => {
    if (!selectedDate) return;

    let h = parseInt(hour);
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;

    const finalDate = setMinutes(setHours(selectedDate, h), parseInt(minute));

    if (isBefore(finalDate, new Date())) {
      toast({ title: "Invalid Time", description: "Please select a future time", variant: "destructive" });
      return;
    }

    onSelect(finalDate);
  };

  return (
    <div className="space-y-4">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={setSelectedDate}
        disabled={(date) => isBefore(date, new Date())}
        className="rounded-md border"
      />

      <div className="flex items-center gap-2">
        <Label className="text-sm">Time:</Label>
        <Select value={hour} onValueChange={setHour}>
          <SelectTrigger className="w-16">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <SelectItem key={h} value={h.toString()}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>:</span>
        <Select value={minute} onValueChange={setMinute}>
          <SelectTrigger className="w-16">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["00", "15", "30", "45"].map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ampm} onValueChange={setAmpm}>
          <SelectTrigger className="w-16">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleConfirm}>
          Set Reminder
        </Button>
      </div>
    </div>
  );
}

// Main Reminder Picker Component
interface ReminderPickerProps {
  emailId: number;
  currentRemindAt?: string | null;
  onReminderSet?: (remindAt: string | null) => void;
  trigger?: React.ReactNode;
}

export function ReminderPicker({
  emailId,
  currentRemindAt,
  onReminderSet,
  trigger,
}: ReminderPickerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [remindAt, setRemindAt] = useState<string | null>(currentRemindAt || null);

  const handleSetReminder = async (date: Date) => {
    setLoading(true);
    try {
      const result = await setReminder(emailId, date);
      setRemindAt(result.remind_at);
      onReminderSet?.(result.remind_at);
      setOpen(false);
      setShowCustom(false);
    } catch (error) {
      console.error("Failed to set reminder:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearReminder = async () => {
    setLoading(true);
    try {
      await clearReminder(emailId);
      setRemindAt(null);
      onReminderSet?.(null);
      setOpen(false);
    } catch (error) {
      console.error("Failed to clear reminder:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-8 gap-1">
            <Bell className="h-4 w-4" />
            Remind
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        {showCustom ? (
          <div className="p-3">
            <CustomTimePicker
              onSelect={handleSetReminder}
              onCancel={() => setShowCustom(false)}
            />
          </div>
        ) : (
          <>
            <div className="p-3 border-b">
              <p className="text-sm font-medium">Remind me about this</p>
              {remindAt && (
                <div className="mt-2">
                  <ReminderBadge
                    remindAt={remindAt}
                    onClear={handleClearReminder}
                  />
                </div>
              )}
            </div>

            <div className="p-2 space-y-1">
              {REMINDER_PRESETS.map((preset) => {
                const PresetIcon = preset.icon;
                const time = preset.getTime();

                return (
                  <button
                    key={preset.key}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted rounded-md transition-colors text-left disabled:opacity-50"
                    onClick={() => handleSetReminder(time)}
                    disabled={loading}
                  >
                    <div className="text-muted-foreground">
                      <PresetIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{preset.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(time, "EEEE, MMM d 'at' h:mm a")}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                );
              })}
            </div>

            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => setShowCustom(true)}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Pick date & time
              </Button>
            </div>

            {remindAt && (
              <div className="border-t p-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground hover:text-destructive"
                  onClick={handleClearReminder}
                  disabled={loading}
                >
                  <BellOff className="h-4 w-4 mr-2" />
                  Clear reminder
                </Button>
              </div>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Reminder Button Component (standalone)
interface ReminderButtonProps {
  emailId: number;
  remindAt?: string | null;
  onReminderChange?: (remindAt: string | null) => void;
  size?: "sm" | "md";
}

export function ReminderButton({
  emailId,
  remindAt: initialRemindAt,
  onReminderChange,
  size = "md",
}: ReminderButtonProps) {
  const [remindAt, setRemindAt] = useState<string | null>(initialRemindAt || null);
  const [loading, setLoading] = useState(false);

  const handleReminderSet = (newRemindAt: string | null) => {
    setRemindAt(newRemindAt);
    onReminderChange?.(newRemindAt);
  };

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const buttonSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  return (
    <ReminderPicker
      emailId={emailId}
      currentRemindAt={remindAt}
      onReminderSet={handleReminderSet}
      trigger={
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  buttonSize,
                  remindAt && "text-purple-500 dark:text-purple-400"
                )}
                disabled={loading}
              >
                {loading ? (
                  <Spinner className={iconSize} />
                ) : remindAt ? (
                  <Bell className={cn(iconSize, "fill-current")} />
                ) : (
                  <Bell className={iconSize} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {remindAt
                ? `Reminder: ${format(new Date(remindAt), "MMM d 'at' h:mm a")}`
                : "Set reminder"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      }
    />
  );
}

// Hook for reminder state management
export function useEmailReminder(emailId?: number, initialRemindAt?: string | null) {
  const [remindAt, setRemindAt] = useState<string | null>(initialRemindAt || null);
  const [loading, setLoading] = useState(false);

  const set = useCallback(
    async (date: Date) => {
      if (!emailId) return;

      setLoading(true);
      try {
        const result = await setReminder(emailId, date);
        setRemindAt(result.remind_at);
        return result;
      } finally {
        setLoading(false);
      }
    },
    [emailId]
  );

  const clear = useCallback(async () => {
    if (!emailId) return;

    setLoading(true);
    try {
      await clearReminder(emailId);
      setRemindAt(null);
    } finally {
      setLoading(false);
    }
  }, [emailId]);

  return {
    remindAt,
    hasReminder: !!remindAt,
    loading,
    setReminder: set,
    clearReminder: clear,
  };
}

export default ReminderPicker;
