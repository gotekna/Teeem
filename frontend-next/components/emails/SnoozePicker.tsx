"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  Clock,
  Sun,
  Moon,
  Calendar as CalendarIcon,
  AlarmClock,
  X,
  ChevronRight,
} from "lucide-react";
import { format, addHours, addDays, setHours, setMinutes, isBefore } from "date-fns";

// Types
export interface SnoozePreset {
  key: string;
  label: string;
  description: string;
  time: string;
}

export interface EmailSnooze {
  id: number;
  email_id: number;
  user_id: number;
  snooze_until: string;
  is_active: boolean;
  reason: string | null;
  woken_at: string | null;
  time_remaining: number | null;
  time_remaining_in_words: string | null;
  created_at: string;
  email?: {
    id: number;
    subject: string;
    from_email: string;
    from_name: string | null;
    received_at: string;
    has_attachments: boolean;
    snippet: string;
  };
}

// API Functions
async function fetchPresets(): Promise<SnoozePreset[]> {
  const response = await api.get<{ data: { presets: SnoozePreset[] } }>("/api/v1/email_snoozes/presets");
  return (response as { data: { presets: SnoozePreset[] } }).data.presets || [];
}

async function fetchSnoozedEmails(): Promise<EmailSnooze[]> {
  const response = await api.get<{ data: { snoozes: EmailSnooze[] } }>("/api/v1/email_snoozes");
  return (response as { data: { snoozes: EmailSnooze[] } }).data.snoozes || [];
}

async function checkEmailSnooze(emailId: number): Promise<{ is_snoozed: boolean; snooze: EmailSnooze | null }> {
  const response = await api.get<{ data: { is_snoozed: boolean; snooze: EmailSnooze | null } }>(`/api/v1/email_snoozes/for_email/${emailId}`);
  return (response as { data: { is_snoozed: boolean; snooze: EmailSnooze | null } }).data;
}

async function snoozeEmail(
  emailId: number,
  options: { preset?: string; snooze_until?: string; reason?: string }
): Promise<EmailSnooze> {
  const response = await api.post<{ data: EmailSnooze }>("/api/v1/email_snoozes", {
    email_id: emailId,
    ...options,
  });
  return (response as { data: EmailSnooze }).data;
}

async function cancelSnooze(snoozeId: number): Promise<void> {
  await api.delete(`/api/v1/email_snoozes/${snoozeId}/cancel`);
}

async function extendSnooze(
  snoozeId: number,
  options: { preset?: string; snooze_until?: string }
): Promise<EmailSnooze> {
  const response = await api.patch<{ data: EmailSnooze }>(`/api/v1/email_snoozes/${snoozeId}/extend`, options);
  return (response as { data: EmailSnooze }).data;
}

// Snooze Badge Component
interface SnoozeBadgeProps {
  snooze: EmailSnooze;
  onCancel?: () => void;
  size?: "sm" | "md";
  className?: string;
}

export function SnoozeBadge({ snooze, onCancel, size = "md", className }: SnoozeBadgeProps) {
  const snoozeDate = new Date(snooze.snooze_until);
  const isToday = new Date().toDateString() === snoozeDate.toDateString();

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400",
        size === "sm" ? "text-xs px-1.5 py-0" : "text-xs px-2 py-0.5",
        className
      )}
    >
      <AlarmClock className="h-3 w-3" />
      <span>
        {isToday
          ? format(snoozeDate, "h:mm a")
          : format(snoozeDate, "MMM d, h:mm a")}
      </span>
      {onCancel && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="ml-0.5 hover:opacity-70"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );
}

// Preset Button Component
interface PresetButtonProps {
  preset: SnoozePreset;
  onClick: () => void;
  disabled?: boolean;
}

function PresetButton({ preset, onClick, disabled }: PresetButtonProps) {
  const time = new Date(preset.time);
  const icon = getPresetIcon(preset.key);

  return (
    <button
      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted rounded-md transition-colors text-left disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      <div className="text-muted-foreground">{icon}</div>
      <div className="flex-1">
        <div className="font-medium text-sm">{preset.label}</div>
        <div className="text-xs text-muted-foreground">
          {format(time, "EEEE, MMM d 'at' h:mm a")}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function getPresetIcon(key: string) {
  switch (key) {
    case "later_today":
      return <Sun className="h-4 w-4" />;
    case "tomorrow":
      return <Moon className="h-4 w-4" />;
    case "this_weekend":
    case "next_week":
      return <CalendarIcon className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

// Custom Time Picker
interface CustomTimePickerProps {
  onSelect: (date: Date) => void;
  onCancel: () => void;
}

function CustomTimePicker({ onSelect, onCancel }: CustomTimePickerProps) {
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
      alert("Please select a future time");
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
          Snooze
        </Button>
      </div>
    </div>
  );
}

// Main Snooze Picker Component
interface SnoozePickerProps {
  emailId: number;
  onSnooze?: (snooze: EmailSnooze) => void;
  onCancel?: () => void;
  trigger?: React.ReactNode;
}

export function SnoozePicker({ emailId, onSnooze, onCancel, trigger }: SnoozePickerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [presets, setPresets] = useState<SnoozePreset[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const [currentSnooze, setCurrentSnooze] = useState<EmailSnooze | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [presetsData, snoozeData] = await Promise.all([
        fetchPresets(),
        checkEmailSnooze(emailId),
      ]);
      setPresets(presetsData);
      setCurrentSnooze(snoozeData.snooze);
    } catch (error) {
      console.error("Failed to load snooze data:", error);
    } finally {
      setLoading(false);
    }
  }, [emailId]);

  useEffect(() => {
    if (open) {
      loadData();
      setShowCustom(false);
    }
  }, [open, loadData]);

  const handleSnoozeWithPreset = async (preset: SnoozePreset) => {
    setSnoozing(true);
    try {
      const snooze = await snoozeEmail(emailId, { preset: preset.key });
      setCurrentSnooze(snooze);
      onSnooze?.(snooze);
      setOpen(false);
    } catch (error) {
      console.error("Failed to snooze:", error);
    } finally {
      setSnoozing(false);
    }
  };

  const handleSnoozeCustom = async (date: Date) => {
    setSnoozing(true);
    try {
      const snooze = await snoozeEmail(emailId, {
        snooze_until: date.toISOString(),
      });
      setCurrentSnooze(snooze);
      onSnooze?.(snooze);
      setOpen(false);
    } catch (error) {
      console.error("Failed to snooze:", error);
    } finally {
      setSnoozing(false);
    }
  };

  const handleCancelSnooze = async () => {
    if (!currentSnooze) return;

    try {
      await cancelSnooze(currentSnooze.id);
      setCurrentSnooze(null);
      onCancel?.();
      setOpen(false);
    } catch (error) {
      console.error("Failed to cancel snooze:", error);
    }
  };

  // Quick presets (first 4)
  const quickPresets = presets.filter((p) =>
    ["later_today", "tomorrow", "this_weekend", "next_week"].includes(p.key)
  );

  // Duration presets
  const durationPresets = presets.filter((p) => p.key.startsWith("in_"));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-8 gap-1">
            <Clock className="h-4 w-4" />
            Snooze
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Spinner className="h-5 w-5" />
          </div>
        ) : showCustom ? (
          <div className="p-3">
            <CustomTimePicker
              onSelect={handleSnoozeCustom}
              onCancel={() => setShowCustom(false)}
            />
          </div>
        ) : (
          <>
            <div className="p-3 border-b">
              <p className="text-sm font-medium">Snooze until...</p>
              {currentSnooze && (
                <div className="mt-2">
                  <SnoozeBadge snooze={currentSnooze} onCancel={handleCancelSnooze} />
                </div>
              )}
            </div>

            <div className="p-2 space-y-1">
              {quickPresets.map((preset) => (
                <PresetButton
                  key={preset.key}
                  preset={preset}
                  onClick={() => handleSnoozeWithPreset(preset)}
                  disabled={snoozing}
                />
              ))}
            </div>

            <div className="border-t p-2">
              <p className="text-xs text-muted-foreground px-3 py-1">Or snooze for...</p>
              <div className="grid grid-cols-3 gap-1 mt-1">
                {durationPresets.slice(0, 3).map((preset) => (
                  <Button
                    key={preset.key}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleSnoozeWithPreset(preset)}
                    disabled={snoozing}
                  >
                    {preset.label.replace("In ", "")}
                  </Button>
                ))}
              </div>
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
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Snoozed Emails List Component
interface SnoozedEmailsListProps {
  onEmailClick?: (emailId: number) => void;
}

export function SnoozedEmailsList({ onEmailClick }: SnoozedEmailsListProps) {
  const [loading, setLoading] = useState(true);
  const [snoozes, setSnoozes] = useState<EmailSnooze[]>([]);

  const loadSnoozes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSnoozedEmails();
      setSnoozes(data);
    } catch (error) {
      console.error("Failed to load snoozed emails:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnoozes();
  }, [loadSnoozes]);

  const handleCancel = async (snooze: EmailSnooze) => {
    try {
      await cancelSnooze(snooze.id);
      setSnoozes((prev) => prev.filter((s) => s.id !== snooze.id));
    } catch (error) {
      console.error("Failed to cancel snooze:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  if (snoozes.length === 0) {
    return (
      <div className="text-center py-8">
        <AlarmClock className="h-12 w-12 mx-auto text-muted-foreground/50" />
        <p className="mt-4 text-muted-foreground">No snoozed emails</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {snoozes.map((snooze) => (
        <div
          key={snooze.id}
          className={cn(
            "p-4 hover:bg-muted/50 transition-colors",
            onEmailClick && "cursor-pointer"
          )}
          onClick={() => snooze.email && onEmailClick?.(snooze.email.id)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">
                  {snooze.email?.from_name || snooze.email?.from_email || "Unknown"}
                </span>
                <SnoozeBadge snooze={snooze} size="sm" />
              </div>
              {snooze.email?.subject && (
                <p className="text-sm truncate mt-0.5">{snooze.email.subject}</p>
              )}
              {snooze.email?.snippet && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {snooze.email.snippet}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel(snooze);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Hook for using snooze functionality
export function useEmailSnooze(emailId?: number) {
  const [snooze, setSnooze] = useState<EmailSnooze | null>(null);
  const [loading, setLoading] = useState(false);

  const checkSnooze = useCallback(async () => {
    if (!emailId) return;

    setLoading(true);
    try {
      const data = await checkEmailSnooze(emailId);
      setSnooze(data.snooze);
    } catch (error) {
      console.error("Failed to check snooze:", error);
    } finally {
      setLoading(false);
    }
  }, [emailId]);

  useEffect(() => {
    checkSnooze();
  }, [checkSnooze]);

  const snoozeWithPreset = useCallback(
    async (preset: string) => {
      if (!emailId) return;

      const result = await snoozeEmail(emailId, { preset });
      setSnooze(result);
      return result;
    },
    [emailId]
  );

  const snoozeUntil = useCallback(
    async (date: Date) => {
      if (!emailId) return;

      const result = await snoozeEmail(emailId, { snooze_until: date.toISOString() });
      setSnooze(result);
      return result;
    },
    [emailId]
  );

  const cancel = useCallback(async () => {
    if (!snooze) return;

    await cancelSnooze(snooze.id);
    setSnooze(null);
  }, [snooze]);

  return {
    snooze,
    isSnoozed: !!snooze,
    loading,
    refresh: checkSnooze,
    snoozeWithPreset,
    snoozeUntil,
    cancel,
  };
}

export default SnoozePicker;
