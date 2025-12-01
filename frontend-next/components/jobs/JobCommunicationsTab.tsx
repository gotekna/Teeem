"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageCircle,
  Mail,
  Phone,
  Send,
  Search,
  Loader2,
  User,
} from "lucide-react";
import { api } from "@/lib/api";

interface Message {
  id: number;
  content: string;
  user_name?: string;
  created_at: string;
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

// Email placeholder component
function EmailsSection({ jobId }: { jobId: string | number }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-base font-medium">Email Integration</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Email history and integration will be displayed here.
        </p>
      </CardContent>
    </Card>
  );
}

// SMS placeholder component
function SmsSection({ jobId }: { jobId: string | number }) {
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
    <div className="space-y-6">
      <Tabs defaultValue="messages">
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

        <TabsContent value="messages" className="mt-6">
          <InternalMessagesSection jobId={jobId} />
        </TabsContent>

        <TabsContent value="emails" className="mt-6">
          <EmailsSection jobId={jobId} />
        </TabsContent>

        <TabsContent value="sms" className="mt-6">
          <SmsSection jobId={jobId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default JobCommunicationsTab;
