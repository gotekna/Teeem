"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Layout mode is handled by parent page wrapper (TabbedDetailPage)
// This tab uses FullHeightTabContent for internal padding
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Mail,
  Phone,
  Send,
  Search,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { EntityChat } from "@/components/chat/EntityChat";
import { Spinner } from "@/components/ui/spinner";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useToast } from "@/components/ui/use-toast";
import { getInitials } from "@/utils/formatters";

interface Message {
  id: number;
  content: string;
  user_name?: string;
  created_at: string;
}

interface Email {
  id: number;
  subject: string | null;
  from_email: string;
  display_from?: string;
  to_emails: string[];
  cc_emails?: string[];
  body_text?: string;
  body_html?: string;
  preview_body?: string;
  received_at: string;
  has_attachments?: boolean;
  attachment_count?: number;
  thread_count?: number;
  match_type?: string;
}

interface SuggestedEmail {
  email: Email;
  reason: string;
  suggested_job?: {
    id: number;
    name: string;
    match_reason: string;
  };
}

interface SyncStatus {
  total_emails_synced: number;
  last_sync_at: string | null;
}

interface JobCommunicationsTabProps {
  jobId: string | number;
  jobTitle?: string;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    const minutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    return minutes === 0 ? "Just now" : `${minutes}m ago`;
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}h ago`;
  } else if (diffInHours < 168) {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
}

// Internal Messages Component
function InternalMessagesSection({ jobId }: { jobId: string | number }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    // Poll for new messages every 5 seconds
    const interval = setInterval(() => {
      loadMessages();
    }, 5000);
    return () => clearInterval(interval);
     
  }, [jobId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async () => {
    try {
      const response = await api.get<Message[] | { messages: Message[] }>(
        `/api/v1/jobs/${jobId}/saved_messages`
      );
      const msgList = Array.isArray(response) ? response : response?.messages || [];
      setMessages(msgList);
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      await api.post(`/api/v1/jobs/${jobId}/saved_messages`, {
        message: {
          content: newMessage,
        },
      });
      setNewMessage("");
      await loadMessages();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({ title: "Error", description: "Failed to send message. Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const filteredMessages = messages.filter(
    (msg) =>
      msg.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      msg.user_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Internal Messages</CardTitle>
            <span className="text-sm text-muted-foreground">({filteredMessages.length})</span>
          </div>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Spinner size={32} className="text-muted-foreground" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium">No messages</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchTerm ? "No messages match your search." : "Start by sending a message below."}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto mb-4">
            {filteredMessages.map((message) => (
              <div key={message.id} className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(message.user_name) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{message.user_name || "Team Member"}</p>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(message.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Message Input */}
        <form onSubmit={handleSendMessage} className="mt-4">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              disabled={sending}
              className="flex-1"
            />
            <Button type="submit" disabled={!newMessage.trim() || sending}>
              {sending ? (
                <Spinner size={16} />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Email Section Component with email warehouse integration - SSoT TeeemTableView pattern
function EmailsSection({ jobId }: { jobId: string | number }) {
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [suggestedEmails, setSuggestedEmails] = useState<SuggestedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllInThread, setShowAllInThread] = useState(false);
  const [suggestionsExpanded, setSuggestionsExpanded] = useState(false); // Collapsed by default


  useEffect(() => {
    loadEmails();
  }, [jobId, showAllInThread]);

  const loadEmails = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ emails: Email[]; suggested: SuggestedEmail[] }>(
        `/api/v1/synced_email/for_job/${jobId}`,
        {
          params: {
            include_suggestions: true,
            show_all_in_thread: showAllInThread,
          },
        }
      );
      setEmails(response?.emails || []);
      setSuggestedEmails(response?.suggested || []);
    } catch (error) {
      console.error("Failed to load emails:", error);
      setEmails([]);
      setSuggestedEmails([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignSuggested = async (suggestion: SuggestedEmail, targetJobId?: number) => {
    try {
      const assignToJobId = targetJobId || jobId;
      await api.post(`/api/v1/synced_email/${suggestion.email.id}/assign_to_job`, {
        job_id: assignToJobId,
        assign_thread: true,
      });
      await loadEmails();
    } catch (error) {
      console.error("Failed to assign email:", error);
      toast({ title: "Error", description: "Failed to assign email to job", variant: "destructive" });
    }
  };

  const handleDismissSuggestion = async (suggestion: SuggestedEmail) => {
    try {
      await api.post(`/api/v1/synced_email/${suggestion.email.id}/dismiss_suggestion`, {
        job_id: jobId,
      });
      await loadEmails();
    } catch (error) {
      console.error("Failed to dismiss suggestion:", error);
    }
  };

  // Handle row double-click to open email in standard email page
  const handleRowDoubleClick = (row: { id: string | number }) => {
    window.open(`/email?id=${row.id}`, '_blank');
  };

  return (
    <div className="h-full flex flex-col">

      {/* Suggested emails section - collapsible */}
      {suggestedEmails.length > 0 && (
        <div className="border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 mb-4 shrink-0">
          <button
            onClick={() => setSuggestionsExpanded(!suggestionsExpanded)}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              {suggestionsExpanded ? (
                <ChevronDown className="h-4 w-4 text-yellow-700 dark:text-yellow-300" />
              ) : (
                <ChevronRight className="h-4 w-4 text-yellow-700 dark:text-yellow-300" />
              )}
              <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Suggested Emails ({suggestedEmails.length})
              </span>
            </div>
            <span className="text-xs text-yellow-600 dark:text-yellow-400">
              {suggestionsExpanded ? "Click to collapse" : "Click to expand"}
            </span>
          </button>
          {suggestionsExpanded && (
            <div className="px-4 pb-4">
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                These emails might belong to this job based on contact matches or address mentions.
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
            {suggestedEmails.slice(0, 10).map((suggestion) => (
              <div
                key={suggestion.email.id}
                className={`p-2 bg-card rounded border ${
                  suggestion.suggested_job
                    ? "border-orange-300 dark:border-orange-700"
                    : "border-yellow-200 dark:border-yellow-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium truncate">
                      {suggestion.email.subject || "(No Subject)"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      From: {suggestion.email.from_email} • {suggestion.reason}
                    </p>
                    {suggestion.suggested_job && (
                      <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                        Likely belongs to: <span className="font-medium">{suggestion.suggested_job.name}</span>
                        <span className="text-muted-foreground ml-1">({suggestion.suggested_job.match_reason})</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {suggestion.suggested_job ? (
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAssignSuggested(suggestion, suggestion.suggested_job!.id)}
                          className="text-xs whitespace-nowrap"
                        >
                          Add to {suggestion.suggested_job.name.split(" ")[0]}...
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAssignSuggested(suggestion)}
                          className="text-xs text-muted-foreground"
                        >
                          Add here instead
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAssignSuggested(suggestion)}
                        className="text-primary"
                      >
                        Add to Job
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDismissSuggestion(suggestion)}
                      className="text-xs text-muted-foreground hover:text-red-500 dark:text-red-400"
                      title="Not relevant to this job"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              </div>
            ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Emails table - SSoT TeeemTableView */}
      {/* FRC: Keep table mounted during loading to preserve fullscreen state */}
      <div className="flex-1 min-h-0">
        {!loading && emails.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center py-8">
                No emails matched to this job yet. Emails with job contacts or "id:XX" in the subject will auto-match.
              </p>
            </CardContent>
          </Card>
        ) : (
          <TeeemTableView
            loadingMore={loading}
            tableName="Job Emails"
            disableSavedViews={true}
            leftActions={
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={showAllInThread}
                  onChange={(e) => setShowAllInThread(e.target.checked)}
                  className="rounded border-border"
                />
                Show all in thread
              </label>
            }
            columns={[
              {
                key: "from",
                label: "From",
                column_type: "text",
                width: 160,
                filterable: true,
              },
              {
                key: "to",
                label: "To",
                column_type: "text",
                width: 160,
                filterable: true,
              },
              {
                key: "subject",
                label: "Subject",
                column_type: "text",
                width: 300,
                filterable: true,
              },
              {
                key: "received_at",
                label: "Date",
                column_type: "date_and_time",
                width: 150,
                sortable: true,
              },
              {
                key: "attachments",
                label: "Files",
                column_type: "whole_number",
                width: 70,
                filterable: true,
              },
            ]}
            entries={emails.map((email) => {
              return {
                id: email.id,
                from: email.from_email || "-",
                to: email.to_emails?.join(", ") || "-",
                subject: email.subject || "(no subject)",
                received_at: email.received_at,
                attachments: email.has_attachments ? (email.attachment_count || 1) : 0,
                // Keep original fields for potential future use
                from_email: email.from_email,
                to_emails: email.to_emails,
                cc_emails: email.cc_emails,
              };
            })}
            viewOnly={true}
            onRowDoubleClick={handleRowDoubleClick}
          />
        )}
      </div>
    </div>
  );
}

// SMS placeholder component
function SmsSection() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-base font-medium">SMS Integration</h3>
        <p className="text-sm text-muted-foreground mt-1">
          SMS history and integration will be displayed here.
        </p>
      </CardContent>
    </Card>
  );
}

export function JobCommunicationsTab({ jobId, jobTitle }: JobCommunicationsTabProps) {
  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="emails" className="flex flex-col flex-1 min-h-0">
        <TabsList>
          <TabsTrigger value="emails" className="gap-2">
            <Mail className="h-4 w-4" />
            Emails
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Internal Messages
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <Phone className="h-4 w-4" />
            SMS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="emails" className="flex-1 min-h-0 mt-4">
          <EmailsSection jobId={jobId} />
        </TabsContent>

        <TabsContent value="messages" className="flex-1 min-h-0 mt-4">
          <EntityChat
            entityType="job"
            entityId={typeof jobId === "string" ? parseInt(jobId, 10) : jobId}
            entityName={jobTitle}
            showOnlineUsers={true}
            className="h-full"
          />
        </TabsContent>

        <TabsContent value="sms" className="flex-1 min-h-0 mt-4">
          <SmsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default JobCommunicationsTab;
