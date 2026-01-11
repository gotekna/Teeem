"use client";

import * as React from "react";
import { useAtom } from "jotai";
import { atom } from "jotai";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { toast } from "sonner";

// Atoms for meeting creation
export const createMeetingOpenAtom = atom<boolean>(false);
export const createMeetingDateAtom = atom<Date>(new Date());

interface MeetingType {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  default_duration_minutes: number | null;
}

interface CreateMeetingSheetProps {
  onSuccess?: () => void;
}

export function CreateMeetingSheet({ onSuccess }: CreateMeetingSheetProps) {
  const [open, setOpen] = useAtom(createMeetingOpenAtom);
  const [prefillDate] = useAtom(createMeetingDateAtom);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [meetingTypeId, setMeetingTypeId] = React.useState<string>("");
  const [date, setDate] = React.useState("");
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("10:00");

  const [meetingTypes, setMeetingTypes] = React.useState<MeetingType[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Load meeting types
  React.useEffect(() => {
    const loadMeetingTypes = async () => {
      try {
        setLoading(true);
        const response = await api.get<{ success: boolean; data: MeetingType[] }>(
          "/api/v1/meeting_types?active_only=true"
        );
        if (response.success) {
          setMeetingTypes(response.data);
          // Set default meeting type if available
          if (response.data.length > 0 && !meetingTypeId) {
            setMeetingTypeId(response.data[0].id.toString());
          }
        }
      } catch (error) {
        console.error("Failed to load meeting types:", error);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      loadMeetingTypes();
    }
  }, [open]);

  // Set date from prefillDate when sheet opens
  React.useEffect(() => {
    if (open) {
      const dateStr = prefillDate.toISOString().split("T")[0];
      setDate(dateStr);
    }
  }, [open, prefillDate]);

  // Update end time when meeting type changes (use default duration)
  React.useEffect(() => {
    if (meetingTypeId) {
      const selectedType = meetingTypes.find(t => t.id.toString() === meetingTypeId);
      if (selectedType?.default_duration_minutes && startTime) {
        const [hours, minutes] = startTime.split(":").map(Number);
        const startDate = new Date();
        startDate.setHours(hours, minutes, 0, 0);
        startDate.setMinutes(startDate.getMinutes() + selectedType.default_duration_minutes);
        const newEndTime = `${startDate.getHours().toString().padStart(2, "0")}:${startDate.getMinutes().toString().padStart(2, "0")}`;
        setEndTime(newEndTime);
      }
    }
  }, [meetingTypeId, startTime, meetingTypes]);

  // Reset form when closed
  React.useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setLocation("");
      setMeetingTypeId("");
      setStartTime("09:00");
      setEndTime("10:00");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter a meeting title");
      return;
    }

    if (!date || !startTime || !endTime) {
      toast.error("Please select date and times");
      return;
    }

    if (!meetingTypeId) {
      toast.error("Please select a meeting type");
      return;
    }

    try {
      setSaving(true);

      // Combine date and time into ISO strings
      const startDateTime = new Date(`${date}T${startTime}:00`);
      const endDateTime = new Date(`${date}T${endTime}:00`);

      const response = await api.post<{ success: boolean; data: any; error?: string }>(
        "/api/v1/meetings",
        {
          meeting: {
            title: title.trim(),
            description: description.trim() || null,
            location: location.trim() || null,
            meeting_type_id: parseInt(meetingTypeId),
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            status: "scheduled",
          },
        }
      );

      if (response.success) {
        toast.success("Meeting created successfully");
        setOpen(false);
        onSuccess?.();
      } else {
        toast.error(response.error || "Failed to create meeting");
      }
    } catch (error) {
      console.error("Failed to create meeting:", error);
      toast.error("Failed to create meeting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>New Meeting</SheetTitle>
          <SheetDescription>
            Schedule a new meeting for your calendar
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size={32} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Meeting title"
                autoFocus
              />
            </div>

            {/* Meeting Type */}
            <div className="space-y-2">
              <Label htmlFor="meetingType">Meeting Type *</Label>
              <Select value={meetingTypeId} onValueChange={setMeetingTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {meetingTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      {type.name}
                      {type.category && ` (${type.category})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Meeting room or address"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Meeting details..."
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? <Spinner size={16} className="mr-2" /> : null}
                Create Meeting
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
