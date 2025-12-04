"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader } from "@/components/ui/loader";
import { Send, MessageSquare, Users } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { OnlineUsersSidebar, OnlineUser } from "./OnlineUsersSidebar";

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
}

type EntityType = "job" | "contact" | "case";

interface EntityChatProps {
  entityType: EntityType;
  entityId: number;
  entityName?: string;
  showOnlineUsers?: boolean;
  className?: string;
  maxHeight?: string;
}

export function EntityChat({
  entityType,
  entityId,
  entityName,
  showOnlineUsers = true,
  className,
  maxHeight = "400px",
}: EntityChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleUserSelect = async (user: OnlineUser) => {
    // Start a DM with this user and include entity context
    const paramKey = getParamKey();
    setNewMessage(`@${user.name} `);
    setShowUsers(false);
  };

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

  return (
    <div className={cn("flex gap-4", className)}>
      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {entityName ? `Chat - ${entityName}` : "Internal Chat"}
          </CardTitle>
          {showOnlineUsers && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUsers(!showUsers)}
              className="md:hidden"
            >
              <Users className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex-1 p-0 flex flex-col" style={{ maxHeight }}>
          {loading ? (
            <div className="flex items-center justify-center flex-1 py-8">
              <Loader />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground py-8">
              <div className="text-center">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs">Start the conversation</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-3 py-4">
                {messages.map((message) => (
                  <div key={message.id} className="flex gap-2">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-xs">
                        {message.user?.name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .substring(0, 2) || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {message.user?.name || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {message.formatted_timestamp || formatTime(message.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mt-0.5 break-words">
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          )}

          {/* Message Input */}
          <form onSubmit={handleSend} className="p-4 border-t">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={sending}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={!newMessage.trim() || sending}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Online Users Sidebar - Desktop */}
      {showOnlineUsers && (
        <div className="hidden md:block w-48">
          <OnlineUsersSidebar onSelectUser={handleUserSelect} compact />
        </div>
      )}

      {/* Online Users Sidebar - Mobile Overlay */}
      {showOnlineUsers && showUsers && (
        <div className="md:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="absolute right-0 top-0 h-full w-64 bg-background border-l p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium">Team Members</span>
              <Button variant="ghost" size="sm" onClick={() => setShowUsers(false)}>
                Close
              </Button>
            </div>
            <OnlineUsersSidebar
              onSelectUser={(user) => {
                handleUserSelect(user);
                setShowUsers(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
