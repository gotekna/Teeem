"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Video, MapPin } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

interface MeetingFormData {
  title: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  job_id: string;
  is_virtual: boolean;
  location: string;
  meeting_link: string;
}

export default function NewMeetingPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState<MeetingFormData>({
    title: "",
    description: "",
    date: "",
    start_time: "09:00",
    end_time: "10:00",
    job_id: "",
    is_virtual: false,
    location: "",
    meeting_link: "",
  });

  const handleChange = (field: keyof MeetingFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const startDateTime = `${formData.date}T${formData.start_time}:00`;
      const endDateTime = `${formData.date}T${formData.end_time}:00`;

      const response = await api.post("/api/v1/meetings", {
        meeting: {
          title: formData.title,
          description: formData.description,
          start_time: startDateTime,
          end_time: endDateTime,
          job_id: formData.job_id ? parseInt(formData.job_id) : null,
          is_virtual: formData.is_virtual,
          location: formData.is_virtual ? null : formData.location,
          meeting_link: formData.is_virtual ? formData.meeting_link : null,
        },
      });

      router.push("/meetings");
    } catch (error) {
      console.error("Failed to schedule meeting:", error);
      router.push("/meetings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <BackButton fallbackHref="/meetings" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Schedule Meeting</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule a new site or virtual meeting
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Details */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Meeting Details</CardTitle>
              <CardDescription>Basic meeting information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Meeting Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Site Inspection - Project Alpha"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job_id">Related Job</Label>
                <Select
                  value={formData.job_id}
                  onValueChange={(value) => handleChange("job_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a job (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Project Alpha - Commercial Building</SelectItem>
                    <SelectItem value="2">Residential Complex - Phase 2</SelectItem>
                    <SelectItem value="3">Office Renovation - Tech Hub</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleChange("date", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_time">Start Time *</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => handleChange("start_time", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">End Time *</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => handleChange("end_time", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Meeting agenda and notes..."
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
              <CardDescription>Where will the meeting take place?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Virtual Meeting</Label>
                  <p className="text-sm text-muted-foreground">
                    This is an online meeting
                  </p>
                </div>
                <Switch
                  checked={formData.is_virtual}
                  onCheckedChange={(checked) => handleChange("is_virtual", checked)}
                />
              </div>

              {formData.is_virtual ? (
                <div className="space-y-2">
                  <Label htmlFor="meeting_link" className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Meeting Link
                  </Label>
                  <Input
                    id="meeting_link"
                    placeholder="e.g., https://meet.google.com/..."
                    value={formData.meeting_link}
                    onChange={(e) => handleChange("meeting_link", e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </Label>
                  <Input
                    id="location"
                    placeholder="e.g., 123 Main Street, Sydney NSW"
                    value={formData.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 mt-6">
          <Button type="button" variant="outline" asChild>
            <Link href="/meetings">Cancel</Link>
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Spinner size={16} className="mr-2" />
                Scheduling...
              </>
            ) : (
              "Schedule Meeting"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
