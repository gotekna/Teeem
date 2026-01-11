"use client";

import { useState, useEffect } from "react";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  UserGroupIcon,
  DocumentTextIcon,
  BellIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";

// Types
interface NotificationSettings {
  send_reminder: boolean;
  reminder_hours?: number;
}

interface AgendaItem {
  title: string;
  duration_minutes: number;
}

interface CustomField {
  label: string;
  type: string;
}

interface MeetingType {
  id: number;
  name: string;
  description?: string;
  category?: string;
  is_active: boolean;
  is_system_default: boolean;
  default_duration_minutes: number;
  minimum_participants?: number;
  maximum_participants?: number;
  required_participant_types?: string[];
  optional_participant_types?: string[];
  default_agenda_items?: AgendaItem[];
  required_fields?: string[];
  custom_fields?: CustomField[];
  required_documents?: string[];
  notification_settings?: NotificationSettings;
}

const CATEGORY_COLORS: Record<string, string> = {
  sales: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  construction: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  board: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  safety: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  team: "bg-muted text-foreground dark:bg-muted dark:text-muted-foreground",
};

export default function MeetingTypesPage() {
  useSetLayoutMode("full-height");

  const { toast } = useToast();
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [selectedType, setSelectedType] = useState<MeetingType | null>(null);

  useEffect(() => {
    loadMeetingTypes();
  }, []);

  const loadMeetingTypes = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: MeetingType[]; error?: string }>(
        "/api/v1/meeting_types"
      );

      if (response?.success) {
        setMeetingTypes(response.data || []);
      } else {
        setError(response?.error || "Failed to load meeting types");
      }
    } catch (err) {
      console.error("Error loading meeting types:", err);
      setError("Failed to load meeting types");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (meetingType: MeetingType) => {
    try {
      const response = await api.patch<{ success: boolean; error?: string }>(
        `/api/v1/meeting_types/${meetingType.id}`,
        {
          meeting_type: {
            is_active: !meetingType.is_active,
          },
        }
      );

      if (response?.success) {
        toast({
          title: `Meeting type ${meetingType.is_active ? "deactivated" : "activated"}`,
        });
        loadMeetingTypes();
      } else {
        toast({
          title: "Error",
          description: response?.error || "Failed to update meeting type",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error updating meeting type:", err);
      toast({
        title: "Error",
        description: "Failed to update meeting type",
        variant: "destructive",
      });
    }
  };

  const handleDeleteType = async (meetingType: MeetingType) => {
    if (meetingType.is_system_default) {
      toast({
        title: "Cannot delete",
        description: "Cannot delete system default meeting type",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete "${meetingType.name}"?`)) return;

    try {
      const response = await api.delete<{ success: boolean; error?: string }>(
        `/api/v1/meeting_types/${meetingType.id}`
      );

      if (response?.success) {
        toast({ title: "Meeting type deleted successfully" });
        loadMeetingTypes();
        if (selectedType?.id === meetingType.id) {
          setSelectedType(null);
        }
      } else {
        toast({
          title: "Error",
          description: response?.error || "Failed to delete meeting type",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error deleting meeting type:", err);
      toast({
        title: "Error",
        description: "Failed to delete meeting type",
        variant: "destructive",
      });
    }
  };

  const categories = [...new Set(meetingTypes.map((t) => t.category).filter(Boolean))] as string[];

  const filteredMeetingTypes = meetingTypes.filter((type) => {
    if (filterCategory !== "all" && type.category !== filterCategory) {
      return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        type.name.toLowerCase().includes(query) ||
        type.description?.toLowerCase().includes(query) ||
        type.category?.toLowerCase().includes(query)
      );
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meeting Types Configuration</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure meeting types with specific rules, participants, and requirements
          </p>
        </div>
        <Button
          onClick={() =>
            toast({ title: "Coming soon", description: "Create custom meeting type coming soon" })
          }
        >
          <PlusIcon className="mr-2 h-5 w-5" />
          New Meeting Type
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 flex gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search meeting types..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Meeting Types List */}
        <Card>
          <CardHeader>
            <CardTitle>Meeting Types ({filteredMeetingTypes.length})</CardTitle>
          </CardHeader>
          <ScrollArea className="max-h-[500px]">
            <CardContent className="divide-y p-0">
              {filteredMeetingTypes.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  No meeting types match your filters
                </div>
              ) : (
                filteredMeetingTypes.map((type) => (
                  <div
                    key={type.id}
                    onClick={() => setSelectedType(type)}
                    className={`cursor-pointer px-4 py-4 transition-colors ${
                      selectedType?.id === type.id ? "bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <h4 className="truncate text-sm font-medium">{type.name}</h4>
                          {type.is_system_default && (
                            <ShieldCheckIcon
                              className="h-4 w-4 text-muted-foreground"
                              title="System Default"
                            />
                          )}
                        </div>

                        <div className="mb-2 flex items-center gap-2">
                          {type.category && (
                            <Badge
                              variant="secondary"
                              className={CATEGORY_COLORS[type.category] || ""}
                            >
                              {type.category}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {type.default_duration_minutes} min
                          </span>
                        </div>

                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {type.description}
                        </p>
                      </div>

                      <div className="ml-4 flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleActive(type);
                          }}
                          className={
                            type.is_active
                              ? "text-green-600 hover:bg-green-50"
                              : "text-muted-foreground"
                          }
                          title={type.is_active ? "Active" : "Inactive"}
                        >
                          {type.is_active ? (
                            <CheckCircleIcon className="h-5 w-5" />
                          ) : (
                            <XCircleIcon className="h-5 w-5" />
                          )}
                        </Button>

                        {!type.is_system_default && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteType(type);
                            }}
                            className="text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Meeting Type Details */}
        <Card>
          <CardHeader>
            <CardTitle>{selectedType ? selectedType.name : "Details"}</CardTitle>
          </CardHeader>
          {!selectedType ? (
            <CardContent className="py-8 text-center text-muted-foreground">
              Select a meeting type to view details
            </CardContent>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <CardContent className="divide-y p-0">
                {/* Description */}
                <div className="px-4 py-4">
                  <h4 className="mb-2 text-sm font-medium">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedType.description || "No description"}
                  </p>
                </div>

                {/* Duration & Participants */}
                <div className="px-4 py-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <ClockIcon className="h-4 w-4" />
                    Duration & Participants
                  </h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Default Duration:</dt>
                      <dd className="font-medium">{selectedType.default_duration_minutes} minutes</dd>
                    </div>
                    {selectedType.minimum_participants && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Min Participants:</dt>
                        <dd className="font-medium">{selectedType.minimum_participants}</dd>
                      </div>
                    )}
                    {selectedType.maximum_participants && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Max Participants:</dt>
                        <dd className="font-medium">{selectedType.maximum_participants}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Required Participants */}
                {selectedType.required_participant_types &&
                  selectedType.required_participant_types.length > 0 && (
                    <div className="px-4 py-4">
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <UserGroupIcon className="h-4 w-4" />
                        Required Participants
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedType.required_participant_types.map((type, idx) => (
                          <Badge key={idx} variant="destructive">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Optional Participants */}
                {selectedType.optional_participant_types &&
                  selectedType.optional_participant_types.length > 0 && (
                    <div className="px-4 py-4">
                      <h4 className="mb-2 text-sm font-medium">Optional Participants</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedType.optional_participant_types.map((type, idx) => (
                          <Badge key={idx} variant="secondary">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Default Agenda */}
                {selectedType.default_agenda_items &&
                  selectedType.default_agenda_items.length > 0 && (
                    <div className="px-4 py-4">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                        <DocumentTextIcon className="h-4 w-4" />
                        Default Agenda
                      </h4>
                      <ol className="space-y-2">
                        {selectedType.default_agenda_items.map((item, idx) => (
                          <li key={idx} className="flex justify-between text-sm">
                            <span>
                              {idx + 1}. {item.title}
                            </span>
                            <span className="text-muted-foreground">{item.duration_minutes} min</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                {/* Notifications */}
                {selectedType.notification_settings && (
                  <div className="px-4 py-4">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                      <BellIcon className="h-4 w-4" />
                      Notifications
                    </h4>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Send Reminder:</dt>
                        <dd className="font-medium">
                          {selectedType.notification_settings.send_reminder ? "Yes" : "No"}
                        </dd>
                      </div>
                      {selectedType.notification_settings.reminder_hours && (
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Reminder Before:</dt>
                          <dd className="font-medium">
                            {selectedType.notification_settings.reminder_hours} hours
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
              </CardContent>
            </ScrollArea>
          )}
        </Card>
      </div>
    </div>
  );
}
