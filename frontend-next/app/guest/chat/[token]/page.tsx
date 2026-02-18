"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { Send, MessageSquare } from "lucide-react";
import { POLLING_CHAT_GUEST_MS } from "@/lib/constants/timeout-constants";
import { getApiBaseUrl } from "@/lib/api";

interface GuestMessage {
  id: number;
  content: string;
  sender_name: string;
  is_guest: boolean;
  is_host: boolean;
  created_at: string;
  formatted_timestamp: string;
}

interface SessionInfo {
  status: string;
  host_name: string;
  host_initials: string;
  guest_name: string | null;
  expires_at: string;
  active: boolean;
  job_name?: string;
}

export default function GuestChatPage() {
  const params = useParams();
  const token = params.token as string;

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [messages, setMessages] = useState<GuestMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [guestName, setGuestName] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch session info
  useEffect(() => {
    if (!token) return;
    fetchSession();
  }, [token]);

  // Poll for messages when joined
  useEffect(() => {
    if (!joined) return;
    const interval = setInterval(fetchMessages, POLLING_CHAT_GUEST_MS);
    return () => clearInterval(interval);
  }, [joined]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchSession = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/chat_guest_sessions/${token}`);
      const data = await res.json();
      if (data.success) {
        setSession(data.data);
        if (data.data.status === "active" && data.data.guest_name) {
          setJoined(true);
          setGuestName(data.data.guest_name);
          fetchMessages();
        }
      } else {
        setError(data.error || "Invalid or expired link");
      }
    } catch (err) {
      console.error("[GuestChat] Failed to load session:", err);
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!guestName.trim()) return;
    setJoining(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/chat_guest_sessions/${token}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: guestName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setJoined(true);
        setSession((prev) => prev ? { ...prev, status: "active", guest_name: guestName.trim() } : prev);
        fetchMessages();
      }
    } catch (err) {
      console.error("[GuestChat] Failed to join session:", err);
      setError("Failed to join. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/chat_guest_sessions/${token}/messages`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (err) {
      console.error("[GuestChat] Message polling failed:", err);
    }
  }, [token]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    const content = newMessage.trim();
    setNewMessage("");
    setSending(true);

    // Optimistic update
    const tempMsg: GuestMessage = {
      id: Date.now(),
      content,
      sender_name: guestName,
      is_guest: true,
      is_host: false,
      created_at: new Date().toISOString(),
      formatted_timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/v1/chat_guest_sessions/${token}/send_message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.success) {
        // Replace optimistic message with real one
        setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? data.data : m)));
      }
    } catch (err) {
      console.error("[GuestChat] Failed to send message:", err);
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Chat Unavailable</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Join screen - guest enters their name
  if (!joined && session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <Avatar className="h-16 w-16 mx-auto mb-3">
                <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                  {session.host_initials || "T"}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-lg font-semibold">{session.host_name}</h2>
              <p className="text-sm text-muted-foreground">invited you to chat</p>
              {session.job_name && (
                <p className="text-xs text-muted-foreground mt-1">Re: {session.job_name}</p>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Your name</label>
                <Input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter your name"
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  autoFocus
                />
              </div>
              <Button className="w-full" onClick={handleJoin} disabled={!guestName.trim() || joining}>
                {joining ? "Joining..." : "Join Chat"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">
              Powered by Teeem
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Chat interface
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shrink-0">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-sm bg-primary text-primary-foreground">
            {session?.host_initials || "T"}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-sm font-semibold">{session?.host_name}</h1>
          <p className="text-xs text-muted-foreground">Chat with {guestName}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Say hello!</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.is_guest ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 ${
                msg.is_guest
                  ? "bg-primary text-primary-foreground"
                  : "bg-white border"
              }`}
            >
              {!msg.is_guest && (
                <p className="text-xs font-medium mb-1 opacity-70">{msg.sender_name}</p>
              )}
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <p className={`text-[10px] mt-1 ${msg.is_guest ? "opacity-70" : "text-muted-foreground"}`}>
                {msg.formatted_timestamp}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            autoFocus
          />
          <Button size="icon" onClick={handleSend} disabled={!newMessage.trim() || sending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Powered by Teeem
        </p>
      </div>
    </div>
  );
}
