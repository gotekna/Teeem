"use client";

import * as React from "react";
import Link from "next/link";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Video,
  Plus,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { format, isToday, isTomorrow } from "date-fns";

interface Meeting {
  id: number;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  is_virtual: boolean;
  meeting_link?: string;
  job_title?: string;
  job_id?: number;
  attendees: { id: number; name: string; email: string }[];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatMeetingTime(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${format(startDate, "h:mm a")} - ${format(endDate, "h:mm a")}`;
}

function getMeetingDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEEE, d MMMM");
}

export default function MeetingsPage() {
  useSetLayoutMode("full-height");
  const [meetings, setMeetings] = React.useState<Meeting[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const data = await api.get<{ meetings: Meeting[] }>("/api/v1/meetings");
        setMeetings(data.meetings || []);
      } catch (error) {
        console.error("Failed to fetch meetings:", error);
        setMeetings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, []);

  // Group meetings by date
  const groupedMeetings = React.useMemo(() => {
    const groups: Record<string, Meeting[]> = {};
    meetings.forEach((meeting) => {
      const date = format(new Date(meeting.start_time), "yyyy-MM-dd");
      if (!groups[date]) groups[date] = [];
      groups[date].push(meeting);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [meetings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Meetings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule and manage site meetings
          </p>
        </div>
        <Button asChild>
          <Link href="/meetings/new">
            <Plus className="h-4 w-4 mr-2" />
            Schedule Meeting
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          {groupedMeetings.length > 0 ? (
            <div className="space-y-6">
              {groupedMeetings.map(([date, dateMeetings]) => (
                <div key={date}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    {getMeetingDateLabel(dateMeetings[0].start_time)}
                  </h3>
                  <div className="space-y-3">
                    {dateMeetings.map((meeting) => (
                      <Card
                        key={meeting.id}
                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{meeting.title}</h4>
                                {meeting.is_virtual && (
                                  <Badge variant="secondary">
                                    <Video className="h-3 w-3 mr-1" />
                                    Virtual
                                  </Badge>
                                )}
                              </div>

                              {meeting.job_title && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {meeting.job_title}
                                </p>
                              )}

                              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {formatMeetingTime(meeting.start_time, meeting.end_time)}
                                </span>
                                {meeting.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    {meeting.location}
                                  </span>
                                )}
                              </div>

                              {meeting.attendees.length > 0 && (
                                <div className="flex items-center gap-2 mt-3">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <div className="flex -space-x-2">
                                    {meeting.attendees.slice(0, 5).map((attendee) => (
                                      <Avatar
                                        key={attendee.id}
                                        className="h-6 w-6 border-2 border-background"
                                      >
                                        <AvatarFallback className="text-xs">
                                          {getInitials(attendee.name)}
                                        </AvatarFallback>
                                      </Avatar>
                                    ))}
                                    {meeting.attendees.length > 5 && (
                                      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-background">
                                        +{meeting.attendees.length - 5}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No upcoming meetings</p>
                <p className="text-sm text-muted-foreground">
                  Schedule a meeting to get started
                </p>
                <Button className="mt-4" asChild>
                  <Link href="/meetings/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule Meeting
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Past meetings will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Calendar view coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
