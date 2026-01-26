"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Send, MessageSquare, Bookmark, Check, Briefcase, User, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { PAGE_SIZE_REFERENCE } from "@/lib/constants/pagination-constants";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  content: string;
  user_id: number;
  user?: {
    id: number;
    name: string;
    email: string;
  };
  created_at: string;
  formatted_timestamp: string;
  saved_to_job?: boolean;
  job_id?: number;
}

interface Job {
  id: number;
  title: string;
}

type EntityType = "job" | "contact" | "case";

interface EntityChatProps {
  entityType: EntityType;
  entityId: number;
  entityName?: string;
  showOnlineUsers?: boolean;
  className?: string;
  maxHeight?: string;
  fullHeight?: boolean;
}

export function EntityChat({
  entityType,
  entityId,
  entityName,
  showOnlineUsers = true,
  className,
  maxHeight = "400px",
  fullHeight = false,
}: EntityChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [savingMessageId, setSavingMessageId] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [openPopoverId, setOpenPopoverId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get entity icon based on type
  const getEntityIcon = () => {
    switch (entityType) {
      case "job":
        return <Briefcase className="h-3 w-3" />;
      case "contact":
        return <User className="h-3 w-3" />;
      case "case":
        return <FileText className="h-3 w-3" />;
    }
  };

  const getParamKey = () => {
    switch (entityType) {
      case "job":
        return "job_id";
      case "contact":
        return "contact_id";
      case "case":
        return "case_id";
    }
  };

  useEffect(() => {
    loadMessages();
    // Poll for new messages every 5 seconds
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
     
  }, [entityType, entityId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const paramKey = getParamKey();
      const response = await api.get<Message[]>(
        `/api/v1/chat_messages?${paramKey}=${entityId}`
      );
      setMessages(response || []);
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const paramKey = getParamKey();
      await api.post("/api/v1/chat_messages", {
        chat_message: {
          content: newMessage,
          [paramKey]: entityId,
        },
      });
      setNewMessage("");
      await loadMessages();
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  // Load jobs for the picker
  const loadJobs = async () => {
    if (jobs.length > 0) return; // Already loaded
    setJobsLoading(true);
    try {
      // SSoT: Uses PAGE_SIZE_REFERENCE from pagination-constants.ts
      const response = await api.get<{ constructions: Job[] }>("/api/v1/jobs", {
        params: { status: "Active", per_page: PAGE_SIZE_REFERENCE },
      });
      setJobs(response?.constructions || []);
    } catch (error) {
      console.error("Failed to load jobs:", error);
    } finally {
      setJobsLoading(false);
    }
  };

  // Save message to a job
  const handleSaveToJob = async (messageId: number, jobId: number) => {
    setSavingMessageId(messageId);
    try {
      await api.post(`/api/v1/chat_messages/${messageId}/save_to_job`, {
        job_id: jobId,
      });
      // Update the local message state
      setMessages(
        messages.map((msg) =>
          msg.id === messageId
            ? { ...msg, saved_to_job: true, job_id: jobId }
            : msg
        )
      );
      setOpenPopoverId(null);
    } catch (error) {
      console.error("Failed to save message to job:", error);
    } finally {
      setSavingMessageId(null);
    }
  };

  // Filter jobs based on search
  const filteredJobs = jobs.filter((job) =>
    job.title.toLowerCase().includes(jobSearch.toLowerCase())
  );

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  // Simple chat panel for entity pages (jobs, contacts, cases)
  // No team sidebar - that's only on main /chat page
  return (
    <Card className={cn("flex flex-col min-h-0", fullHeight && "h-full", className)}>
      <CardHeader className="py-2 px-3 shrink-0 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            Chat
          </CardTitle>
        </div>
        {/* Context bar showing where we are */}
        {entityName && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
            {getEntityIcon()}
            <span className="truncate">{entityName}</span>
          </div>
        )}
      </CardHeader>
      <CardContent
        className="flex-1 p-0 flex flex-col min-h-0"
        style={fullHeight ? undefined : { maxHeight }}
      >
        {loading ? (
          <div className="flex items-center justify-center flex-1 py-4">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground py-4">
            <div className="text-center">
              <MessageSquare className="h-6 w-6 mx-auto mb-1 opacity-20" />
              <p className="text-xs">No messages yet</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 px-3">
            <div className="space-y-2 py-2">
              {messages.map((message) => (
                <div key={message.id} className="flex gap-2 group">
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="text-[10px]">
                      {message.user?.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium">
                        {message.user?.name || "Unknown"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {message.formatted_timestamp || formatTime(message.created_at)}
                      </span>
                      {/* Saved indicator */}
                      {message.saved_to_job && (
                        <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-0.5">
                          <Check className="h-2.5 w-2.5" />
                          Saved
                        </span>
                      )}
                    </div>
                    <div className="flex items-start gap-1">
                      <p className="text-xs text-foreground break-words flex-1">
                        {message.content}
                      </p>
                      {/* Save to job button - show on hover if not already saved */}
                      {!message.saved_to_job && (
                        <Popover
                          open={openPopoverId === message.id}
                          onOpenChange={(open) => {
                            if (open) {
                              setOpenPopoverId(message.id);
                              loadJobs();
                              setJobSearch("");
                            } else {
                              setOpenPopoverId(null);
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-secondary rounded shrink-0"
                              title="Save to job"
                            >
                              <Bookmark className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2" align="end">
                            <div className="space-y-2">
                              <p className="text-xs font-medium">Save to job</p>
                              {/* If we're on a job page, show quick save option */}
                              {entityType === "job" && entityId && entityName && (
                                <button
                                  onClick={() => handleSaveToJob(message.id, entityId)}
                                  disabled={savingMessageId === message.id}
                                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  <Briefcase className="h-3 w-3" />
                                  <span className="truncate">{entityName}</span>
                                  <span className="text-muted-foreground ml-auto">(current)</span>
                                </button>
                              )}
                              {/* Job search */}
                              <Input
                                placeholder="Search jobs..."
                                value={jobSearch}
                                onChange={(e) => setJobSearch(e.target.value)}
                                className="h-7 text-xs"
                              />
                              {/* Job list */}
                              <div className="max-h-32 overflow-y-auto space-y-0.5">
                                {jobsLoading ? (
                                  <div className="flex justify-center py-2">
                                    <Spinner />
                                  </div>
                                ) : filteredJobs.length === 0 ? (
                                  <p className="text-xs text-muted-foreground text-center py-2">
                                    No jobs found
                                  </p>
                                ) : (
                                  filteredJobs
                                    .filter((job) => entityType !== "job" || job.id !== entityId)
                                    .map((job) => (
                                      <button
                                        key={job.id}
                                        onClick={() => handleSaveToJob(message.id, job.id)}
                                        disabled={savingMessageId === message.id}
                                        className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-secondary truncate disabled:opacity-50"
                                      >
                                        {job.title}
                                      </button>
                                    ))
                                )}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        )}

        {/* Message Input */}
        <form onSubmit={handleSend} className="p-2 border-t shrink-0">
          <div className="flex items-center gap-1">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sending}
              className="flex-1 h-8 text-sm"
            />
            <Button type="submit" size="sm" className="h-8 px-3" disabled={!newMessage.trim() || sending}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
