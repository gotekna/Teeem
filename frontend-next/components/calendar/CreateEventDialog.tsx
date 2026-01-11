"use client";

import * as React from "react";
import { useAtom } from "jotai";
import { atom } from "jotai";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { X, Users, MapPin, Clock, AlignLeft, Check, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

// Atoms for event creation
export const createEventOpenAtom = atom<boolean>(false);
export const createEventDateAtom = atom<Date>(new Date());

interface User {
  id: number;
  name: string;
  email: string;
}

interface Contact {
  id: number;
  name: string;
  email: string | null;
  company_name: string | null;
}

interface MeetingType {
  id: number;
  name: string;
}

interface CreateEventDialogProps {
  onSuccess?: () => void;
}

export function CreateEventDialog({ onSuccess }: CreateEventDialogProps) {
  const [open, setOpen] = useAtom(createEventOpenAtom);
  const [prefillDate] = useAtom(createEventDateAtom);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [date, setDate] = React.useState("");
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("09:30");

  // Participants
  const [selectedUsers, setSelectedUsers] = React.useState<User[]>([]);
  const [selectedContacts, setSelectedContacts] = React.useState<Contact[]>([]);
  const [attendeesOpen, setAttendeesOpen] = React.useState(false);

  const [users, setUsers] = React.useState<User[]>([]);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [meetingTypes, setMeetingTypes] = React.useState<MeetingType[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Load data when dialog opens
  React.useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const [usersRes, contactsRes, typesRes] = await Promise.all([
          api.get<{ success: boolean; data: User[] }>("/api/v1/users?active=true"),
          api.get<{ success: boolean; data: Contact[] }>("/api/v1/contacts?limit=500"),
          api.get<{ success: boolean; data: MeetingType[] }>("/api/v1/meeting_types?active_only=true"),
        ]);

        if (usersRes?.success) setUsers(usersRes.data);
        if (contactsRes?.success) setContacts(contactsRes.data);
        if (typesRes?.success) setMeetingTypes(typesRes.data);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      loadData();
    }
  }, [open]);

  // Set date from prefillDate when dialog opens
  React.useEffect(() => {
    if (open) {
      const dateStr = prefillDate.toISOString().split("T")[0];
      setDate(dateStr);
    }
  }, [open, prefillDate]);

  // Reset form when closed
  React.useEffect(() => {
    if (!open) {
      setTitle("");
      setDescription("");
      setLocation("");
      setStartTime("09:00");
      setEndTime("09:30");
      setSelectedUsers([]);
      setSelectedContacts([]);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter an event title");
      return;
    }

    if (!date || !startTime || !endTime) {
      toast.error("Please select date and times");
      return;
    }

    try {
      setSaving(true);

      const startDateTime = new Date(`${date}T${startTime}:00`);
      const endDateTime = new Date(`${date}T${endTime}:00`);

      // Build participants array
      const participants = [
        ...selectedUsers.map((u, idx) => ({
          user_id: u.id,
          is_organizer: idx === 0,
          is_required: true,
        })),
        ...selectedContacts.map(c => ({
          contact_id: c.id,
          is_organizer: false,
          is_required: true,
        })),
      ];

      const response = await api.post<{ success: boolean; data: any; error?: string }>(
        "/api/v1/meetings",
        {
          meeting: {
            title: title.trim(),
            description: description.trim() || null,
            location: location.trim() || null,
            meeting_type_id: meetingTypes[0]?.id, // Use first available type
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            status: "scheduled",
          },
          participants: participants.length > 0 ? participants : undefined,
        }
      );

      if (response?.success) {
        toast.success("Event created");
        setOpen(false);
        onSuccess?.();
      } else {
        toast.error(response?.error || "Failed to create event");
      }
    } catch (error) {
      console.error("Failed to create event:", error);
      toast.error("Failed to create event");
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = (user: User) => {
    setSelectedUsers(prev =>
      prev.some(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    );
  };

  const toggleContact = (contact: Contact) => {
    setSelectedContacts(prev =>
      prev.some(c => c.id === contact.id)
        ? prev.filter(c => c.id !== contact.id)
        : [...prev, contact]
    );
  };

  const removeAttendee = (type: "user" | "contact", id: number) => {
    if (type === "user") {
      setSelectedUsers(prev => prev.filter(u => u.id !== id));
    } else {
      setSelectedContacts(prev => prev.filter(c => c.id !== id));
    }
  };

  // Format date for display
  const formatDateDisplay = () => {
    if (!date) return "";
    const d = new Date(date);
    const dayName = d.toLocaleDateString("en-AU", { weekday: "short" });
    const day = d.getDate();
    const month = d.toLocaleDateString("en-AU", { month: "short" });
    const year = d.getFullYear();
    return `${dayName} ${day}/${month.replace(".", "")}/${year.toString().slice(-2)} ${startTime} - ${endTime}`;
  };

  // Combined list of all people for search
  const allPeople = [
    ...users.map(u => ({ type: "user" as const, ...u })),
    ...contacts.map(c => ({ type: "contact" as const, ...c })),
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base font-medium">New event</DialogTitle>
          <Button
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? <Spinner size={14} className="mr-1" /> : null}
            Save
          </Button>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size={32} />
          </div>
        ) : (
          <div className="px-4 py-3 space-y-4">
            {/* Title */}
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add title"
                className="border-0 border-b rounded-none px-0 focus-visible:ring-0 text-lg font-medium"
                autoFocus
              />
            </div>

            {/* Attendees */}
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-2" />
              <div className="flex-1">
                <Popover open={attendeesOpen} onOpenChange={setAttendeesOpen}>
                  <PopoverTrigger asChild>
                    <div className="min-h-[36px] border-b pb-2 cursor-pointer">
                      {selectedUsers.length === 0 && selectedContacts.length === 0 ? (
                        <span className="text-muted-foreground">Invite attendees</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {selectedUsers.map((user) => (
                            <Badge
                              key={`user-${user.id}`}
                              variant="secondary"
                              className="flex items-center gap-1"
                            >
                              {user.name}
                              <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeAttendee("user", user.id);
                                }}
                              />
                            </Badge>
                          ))}
                          {selectedContacts.map((contact) => (
                            <Badge
                              key={`contact-${contact.id}`}
                              variant="outline"
                              className="flex items-center gap-1"
                            >
                              {contact.name}
                              <X
                                className="h-3 w-3 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeAttendee("contact", contact.id);
                                }}
                              />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search people..." />
                      <CommandList>
                        <CommandEmpty>No people found.</CommandEmpty>
                        <CommandGroup heading="Team Members">
                          {users.map((user) => (
                            <CommandItem
                              key={`user-${user.id}`}
                              onSelect={() => toggleUser(user)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedUsers.some(u => u.id === user.id)
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{user.name}</span>
                                <span className="text-xs text-muted-foreground">{user.email}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <CommandGroup heading="Contacts">
                          {contacts.slice(0, 20).map((contact) => (
                            <CommandItem
                              key={`contact-${contact.id}`}
                              onSelect={() => toggleContact(contact)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedContacts.some(c => c.id === contact.id)
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{contact.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {contact.company_name || contact.email || "External"}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Date/Time */}
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 flex items-center gap-2 border-b pb-2">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border-0 p-0 h-auto focus-visible:ring-0 w-auto"
                />
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="border-0 p-0 h-auto focus-visible:ring-0 w-[80px]"
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="border-0 p-0 h-auto focus-visible:ring-0 w-[80px]"
                />
              </div>
            </div>

            {/* Location */}
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add a room or location"
                className="border-0 border-b rounded-none px-0 focus-visible:ring-0"
              />
            </div>

            {/* Description */}
            <div className="flex items-start gap-3">
              <AlignLeft className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-2" />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add description"
                className="border-0 border-b rounded-none px-0 focus-visible:ring-0 resize-none min-h-[80px]"
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
