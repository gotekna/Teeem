"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
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
  Loader2,
  RefreshCw,
  Paperclip,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api } from "@/lib/api";
import DOMPurify from "isomorphic-dompurify";
import { EntityChat } from "@/components/chat/EntityChat";

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

function getInitials(name: string | undefined): string {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Internal Messages Component
function InternalMessagesSection({ jobId }: { jobId: string | number }) {
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
      alert("Failed to send message. Please try again.");
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
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                    {getInitials(message.user_name)}
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
                <Loader2 className="h-4 w-4 animate-spin" />
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

// Email Section Component with email warehouse integration
function EmailsSection({ jobId }: { jobId: string | number }) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [suggestedEmails, setSuggestedEmails] = useState<SuggestedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showAllInThread, setShowAllInThread] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    loadEmails();
    loadSyncStatus();
     
  }, [jobId, showAllInThread]);

  const loadEmails = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ emails: Email[]; suggested: SuggestedEmail[] }>(
        `/api/v1/email_warehouse/for_job/${jobId}`,
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

  const loadSyncStatus = async () => {
    try {
      const response = await api.get<SyncStatus>("/api/v1/email_warehouse/sync_status");
      setSyncStatus(response);
    } catch (error) {
      console.error("Failed to load sync status:", error);
    }
  };

  const handleRefresh = async () => {
    await loadEmails();
    await loadSyncStatus();
  };

  const handleAssignSuggested = async (suggestion: SuggestedEmail) => {
    try {
      await api.post(`/api/v1/email_warehouse/${suggestion.email.id}/assign_to_job`, {
        job_id: jobId,
        assign_thread: true,
      });
      await loadEmails();
    } catch (error) {
      console.error("Failed to assign email:", error);
      alert("Failed to assign email to this job");
    }
  };

  const filteredEmails = emails.filter((email) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      email.subject?.toLowerCase().includes(searchLower) ||
      email.from_email?.toLowerCase().includes(searchLower) ||
      email.preview_body?.toLowerCase().includes(searchLower) ||
      email.to_emails?.some((to) => to.toLowerCase().includes(searchLower))
    );
  });

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(selectedEmail?.id === email.id ? null : email);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full">
      {/* Search bar with sync/import buttons */}
      <CardHeader className="border-b bg-muted/50 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Warehouse status */}
        {syncStatus && syncStatus.total_emails_synced > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            <span>{syncStatus.total_emails_synced.toLocaleString()} emails in warehouse</span>
            {syncStatus.last_sync_at && (
              <span className="ml-2">
                • Last sync: {new Date(syncStatus.last_sync_at).toLocaleString()}
              </span>
            )}
          </div>
        )}

        {/* Thread toggle */}
        <div className="mt-2 flex items-center space-x-2">
          <Checkbox
            id="showAllInThread"
            checked={showAllInThread}
            onCheckedChange={(checked) => setShowAllInThread(checked === true)}
          />
          <label
            htmlFor="showAllInThread"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            Show all emails in conversations (instead of latest only)
          </label>
        </div>
      </CardHeader>

      {/* Suggested emails section */}
      {suggestedEmails.length > 0 && (
        <div className="border-b p-4 bg-yellow-50 dark:bg-yellow-900/20">
          <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            Suggested Emails ({suggestedEmails.length})
          </h4>
          <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
            These emails might belong to this job based on contact matches or address mentions.
          </p>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {suggestedEmails.slice(0, 5).map((suggestion) => (
              <div
                key={suggestion.email.id}
                className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-yellow-200 dark:border-yellow-800"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-sm font-medium truncate">
                    {suggestion.email.subject || "(No Subject)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    From: {suggestion.email.from_email} • {suggestion.reason}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAssignSuggested(suggestion)}
                  className="text-primary"
                >
                  Add to Job
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emails list */}
      <CardContent className="flex-1 overflow-y-auto p-4">
        {filteredEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {searchTerm ? "No emails found" : "No emails yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {searchTerm
                ? "Try adjusting your search terms"
                : 'No emails matched to this job yet. Emails with job contacts or "id:XX" in the subject will auto-match.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEmails.map((email) => (
              <div
                key={email.id}
                className="bg-muted/50 rounded-lg overflow-hidden"
              >
                {/* Email header - always visible */}
                <div
                  className="p-4 cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => handleEmailClick(email)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-sm truncate">
                          {email.display_from || email.from_email}
                        </span>
                        {email.has_attachments && (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <Paperclip className="h-3 w-3 mr-1" />
                            {email.attachment_count}
                          </div>
                        )}
                        {email.thread_count && email.thread_count > 1 && (
                          <div className="flex items-center text-xs text-primary">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            {email.thread_count} in thread
                          </div>
                        )}
                        {email.match_type === "auto" && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            Auto-matched
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm font-medium truncate">
                        {email.subject || "(No Subject)"}
                      </div>
                      {(!selectedEmail || selectedEmail.id !== email.id) && (
                        <div className="text-xs text-muted-foreground truncate mt-1">
                          {email.preview_body}
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex-shrink-0 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {email.received_at ? new Date(email.received_at).toLocaleString() : ""}
                      </span>
                      {selectedEmail?.id === email.id ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Recipients preview */}
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>To:</span>
                    <span className="truncate">
                      {email.to_emails?.join(", ") || "Unknown"}
                    </span>
                  </div>
                </div>

                {/* Email body - expandable */}
                {selectedEmail && selectedEmail.id === email.id && (
                  <div className="border-t p-4 bg-background">
                    {/* Full email details */}
                    <div className="space-y-2 mb-4 text-sm">
                      <div>
                        <span className="font-semibold text-muted-foreground">From: </span>
                        <span>{email.from_email}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-muted-foreground">To: </span>
                        <span>{email.to_emails?.join(", ")}</span>
                      </div>
                      {email.cc_emails && email.cc_emails.length > 0 && (
                        <div>
                          <span className="font-semibold text-muted-foreground">CC: </span>
                          <span>{email.cc_emails.join(", ")}</span>
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-muted-foreground">Subject: </span>
                        <span>{email.subject || "(No Subject)"}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-muted-foreground">Date: </span>
                        <span>{new Date(email.received_at).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Email body */}
                    <div className="border-t pt-4">
                      {email.body_html ? (
                        <div
                          className="prose dark:prose-invert max-w-none text-sm"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(email.body_html, {
                              ALLOWED_TAGS: [
                                "p", "br", "strong", "em", "u", "a", "ul", "ol", "li",
                                "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre",
                                "code", "span", "div",
                              ],
                              ALLOWED_ATTR: ["href", "target", "rel", "class", "style"],
                              ALLOW_DATA_ATTR: false,
                              FORBID_TAGS: [
                                "script", "style", "iframe", "object", "embed", "form",
                                "input", "button",
                              ],
                              FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
                            }),
                          }}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap text-sm">
                          {email.body_text}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
  // Use full-height layout mode
  useSetLayoutMode("full-height");

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="messages" className="flex flex-col flex-1 min-h-0">
        <TabsList>
          <TabsTrigger value="messages" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Internal Messages
          </TabsTrigger>
          <TabsTrigger value="emails" className="gap-2">
            <Mail className="h-4 w-4" />
            Emails
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <Phone className="h-4 w-4" />
            SMS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="flex-1 min-h-0 mt-4">
          <EntityChat
            entityType="job"
            entityId={typeof jobId === "string" ? parseInt(jobId, 10) : jobId}
            entityName={jobTitle}
            showOnlineUsers={true}
            className="h-full"
          />
        </TabsContent>

        <TabsContent value="emails" className="flex-1 min-h-0 mt-4">
          <EmailsSection jobId={jobId} />
        </TabsContent>

        <TabsContent value="sms" className="flex-1 min-h-0 mt-4">
          <SmsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default JobCommunicationsTab;
