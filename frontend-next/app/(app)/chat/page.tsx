"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Send,
  MessageSquare,
  Users,
  Pin,
  MoreHorizontal,
  Paperclip,
  Image as ImageIcon,
  File,
  Check,
  CheckCheck,
  Briefcase,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface OnlineUser {
  id: number;
  name: string;
  email: string;
  presence_status: "online" | "away" | "offline";
  is_online: boolean;
  last_seen_at: string | null;
}

interface Conversation {
  id: number | string;
  type: "direct" | "group" | "job";
  name: string;
  participants: Participant[];
  last_message: Message | null;
  unread_count: number;
  is_pinned: boolean;
  job_id: number | null;
  job_name: string | null;
  updated_at: string;
}

interface Participant {
  id: number;
  name: string;
  avatar_url: string | null;
  is_online: boolean;
}

interface Message {
  id: number;
  conversation_id: number | string;
  sender_id: number;
  sender_name: string;
  sender_avatar: string | null;
  content: string;
  message_type: "text" | "image" | "file";
  file_url: string | null;
  file_name: string | null;
  created_at: string;
  read_by: number[];
  is_own: boolean;
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load online users
  useEffect(() => {
    const loadOnlineUsers = async () => {
      setLoadingUsers(true);
      try {
        const response = await api.get<OnlineUser[]>("/api/v1/chat_messages/online_users");
        setOnlineUsers(response);
      } catch (error) {
        console.error("Failed to load online users:", error);
        setOnlineUsers([]);
      }
      setLoadingUsers(false);
    };
    loadOnlineUsers();

    // Refresh online users every 30 seconds
    const interval = setInterval(loadOnlineUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load conversations
  useEffect(() => {
    const loadConversations = async () => {
      setLoading(true);
      try {
        const response = await api.get<{ conversations: Conversation[] }>("/api/v1/chat_messages/conversations");
        setConversations(response.conversations || []);
      } catch (error) {
        console.error("Failed to load conversations:", error);
        setConversations(getMockConversations());
      }
      setLoading(false);
    };
    loadConversations();
  }, []);

  const loadMessages = useCallback(async (conversationId: number | string) => {
    setLoadingMessages(true);
    try {
      // Extract user ID from conversation ID for direct messages
      // Format: "dm-34-45" or "dm-new-45" where 45 is the other user's ID
      let userId: string | null = null;
      if (typeof conversationId === "string" && conversationId.startsWith("dm-")) {
        const parts = conversationId.split("-");
        // For "dm-new-45", userId is the last part
        // For "dm-34-45", we need to find the user that isn't us
        userId = parts[parts.length - 1];
      }

      if (userId) {
        // API response has different shape than our Message interface
        interface ApiMessage {
          id: number;
          user_id: number;
          content: string;
          created_at: string;
          user?: { name?: string };
        }
        const response = await api.get<ApiMessage[]>(`/api/v1/chat_messages?user_id=${userId}`);
        // Transform backend response to our Message format
        const messages = (response || []).map((msg) => ({
          id: msg.id,
          conversation_id: Number(conversationId),
          sender_id: msg.user_id,
          sender_name: msg.user?.name || "Unknown",
          sender_avatar: null,
          content: msg.content,
          message_type: "text" as const,
          file_url: null,
          file_name: null,
          created_at: msg.created_at,
          read_by: [msg.user_id],
          is_own: msg.user_id === 1, // TODO: Replace with actual current user ID
        }));
        setMessages(messages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
      setMessages(getMockMessages(Number(conversationId) || 1));
    }
    setLoadingMessages(false);
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;

    const conversationId = selectedConversation.id;
    let cancelled = false;

    async function fetchMessages() {
      try {
        await loadMessages(conversationId);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load messages in effect:", error);
        }
      }
    }

    fetchMessages();

    return () => {
      cancelled = true;
    };
  }, [selectedConversation, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const tempMessage: Message = {
      id: Date.now(),
      conversation_id: selectedConversation.id,
      sender_id: 1,
      sender_name: "You",
      sender_avatar: null,
      content: newMessage,
      message_type: "text",
      file_url: null,
      file_name: null,
      created_at: new Date().toISOString(),
      read_by: [1],
      is_own: true,
    };

    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");

    try {
      // Get recipient user ID from the conversation ID or participants
      let recipientId: number | undefined;

      if (typeof selectedConversation.id === "string" && selectedConversation.id.startsWith("dm-")) {
        const parts = selectedConversation.id.split("-");
        recipientId = parseInt(parts[parts.length - 1], 10);
      } else {
        recipientId = selectedConversation.participants.find(p => p.id !== 1)?.id;
      }

      await api.post("/api/v1/chat_messages", {
        chat_message: {
          content: newMessage,
          recipient_user_id: recipientId,
        },
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // Start a new conversation with a user
  const startConversation = (user: OnlineUser) => {
    // Create a temporary conversation for this user
    const newConversation: Conversation = {
      id: `dm-new-${user.id}`,
      type: "direct",
      name: user.name,
      participants: [
        { id: 1, name: "You", avatar_url: null, is_online: true },
        { id: user.id, name: user.name, avatar_url: null, is_online: user.is_online },
      ],
      last_message: null,
      unread_count: 0,
      is_pinned: false,
      job_id: null,
      job_name: null,
      updated_at: new Date().toISOString(),
    };

    // Check if conversation already exists
    const existingConv = conversations.find(c =>
      c.type === "direct" && c.participants.some(p => p.id === user.id)
    );

    if (existingConv) {
      setSelectedConversation(existingConv);
    } else {
      setConversations(prev => [newConversation, ...prev]);
      setSelectedConversation(newConversation);
    }

    setShowNewChatDialog(false);
    setUserSearchQuery("");
  };

  // Filter users for search
  const filteredUsers = onlineUsers.filter(user =>
    user.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  // Sort users: online first, then away, then offline
  const sortedOnlineUsers = [...onlineUsers].sort((a, b) => {
    const order = { online: 0, away: 1, offline: 2 };
    return order[a.presence_status] - order[b.presence_status];
  });

  const filteredConversations = conversations.filter((conv) =>
    conv.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinnedConversations = filteredConversations.filter((c) => c.is_pinned);
  const regularConversations = filteredConversations.filter((c) => !c.is_pinned);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Messages</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Internal team communication
          </p>
        </div>
        <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Start a New Conversation</DialogTitle>
              <DialogDescription>
                Select a team member to start a private chat
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search team members..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-[300px]">
                <div className="space-y-1">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-secondary transition-colors"
                      onClick={() => startConversation(user)}
                    >
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {user.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
                            user.presence_status === "online" && "bg-green-500",
                            user.presence_status === "away" && "bg-yellow-500",
                            user.presence_status === "offline" && "bg-gray-400"
                          )}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </div>
                      <Badge
                        variant={user.presence_status === "online" ? "default" : "secondary"}
                        className={cn(
                          "text-xs",
                          user.presence_status === "online" && "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                        )}
                      >
                        {user.presence_status}
                      </Badge>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No users found
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Chat Interface */}
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-220px)]">
        {/* Online Users Sidebar */}
        <Card className="col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team ({onlineUsers.filter(u => u.is_online).length} online)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-340px)]">
              <div className="px-3 pb-3 space-y-1">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader />
                  </div>
                ) : (
                  sortedOnlineUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-secondary transition-colors"
                      onClick={() => startConversation(user)}
                      title={`Chat with ${user.name}`}
                    >
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {user.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background",
                            user.presence_status === "online" && "bg-green-500",
                            user.presence_status === "away" && "bg-yellow-500",
                            user.presence_status === "offline" && "bg-gray-400"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{user.name}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {user.presence_status}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {!loadingUsers && onlineUsers.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    No team members
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Conversations List */}
        <Card className="col-span-3">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-340px)]">
              {pinnedConversations.length > 0 && (
                <div className="px-4 py-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                    <Pin className="h-3 w-3" />
                    Pinned
                  </div>
                  {pinnedConversations.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isSelected={selectedConversation?.id === conv.id}
                      onClick={() => setSelectedConversation(conv)}
                    />
                  ))}
                </div>
              )}
              <div className="px-4 py-2">
                {pinnedConversations.length > 0 && (
                  <div className="text-xs text-muted-foreground mb-2">Recent</div>
                )}
                {regularConversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isSelected={selectedConversation?.id === conv.id}
                    onClick={() => setSelectedConversation(conv)}
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Messages Area */}
        <Card className="col-span-7 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Conversation Header */}
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {selectedConversation.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {selectedConversation.name}
                        {selectedConversation.job_name && (
                          <Badge variant="outline" className="text-xs">
                            <Briefcase className="h-3 w-3 mr-1" />
                            {selectedConversation.job_name}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {selectedConversation.participants.length} participants
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Pin className="h-4 w-4 mr-2" />
                        {selectedConversation.is_pinned ? "Unpin" : "Pin"}
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Users className="h-4 w-4 mr-2" />
                        View Participants
                      </DropdownMenuItem>
                      {selectedConversation.job_id && (
                        <DropdownMenuItem>
                          <Briefcase className="h-4 w-4 mr-2" />
                          Save to Job
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 p-4 overflow-hidden">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader />
                  </div>
                ) : (
                  <ScrollArea className="h-full pr-4">
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                )}
              </CardContent>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    className="flex-1"
                  />
                  <Button onClick={handleSend} disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>Select a conversation to start messaging</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors mb-1",
        isSelected ? "bg-secondary" : "hover:bg-secondary/50"
      )}
      onClick={onClick}
    >
      <div className="relative">
        <Avatar className="h-10 w-10">
          <AvatarFallback>
            {conversation.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .substring(0, 2)}
          </AvatarFallback>
        </Avatar>
        {conversation.type === "job" && (
          <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5">
            <Briefcase className="h-2.5 w-2.5 text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium truncate">{conversation.name}</span>
          <span className="text-xs text-muted-foreground">
            {formatTime(conversation.updated_at)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-sm text-muted-foreground truncate">
            {conversation.last_message?.content || "No messages yet"}
          </span>
          {conversation.unread_count > 0 && (
            <Badge className="bg-primary h-5 px-1.5 ml-2">
              {conversation.unread_count}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <div className={cn("flex", message.is_own ? "justify-end" : "justify-start")}>
      <div className={cn("flex gap-2 max-w-[70%]", message.is_own && "flex-row-reverse")}>
        {!message.is_own && (
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {message.sender_name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
        )}
        <div>
          {!message.is_own && (
            <div className="text-xs text-muted-foreground mb-1">{message.sender_name}</div>
          )}
          <div
            className={cn(
              "rounded-lg px-3 py-2",
              message.is_own
                ? "bg-primary text-primary-foreground"
                : "bg-secondary"
            )}
          >
            {message.message_type === "file" ? (
              <div className="flex items-center gap-2">
                <File className="h-4 w-4" />
                <span className="text-sm">{message.file_name}</span>
              </div>
            ) : (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
          <div
            className={cn(
              "flex items-center gap-1 mt-1 text-xs text-muted-foreground",
              message.is_own && "justify-end"
            )}
          >
            <span>{formatTime(message.created_at)}</span>
            {message.is_own && (
              message.read_by.length > 1 ? (
                <CheckCheck className="h-3 w-3 text-blue-500" />
              ) : (
                <Check className="h-3 w-3" />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }
}

function getMockConversations(): Conversation[] {
  return [
    {
      id: 1,
      type: "job",
      name: "Harrison Residence Team",
      participants: [
        { id: 1, name: "Jake Baird", avatar_url: null, is_online: true },
        { id: 2, name: "Tom Wilson", avatar_url: null, is_online: false },
        { id: 3, name: "Sarah Chen", avatar_url: null, is_online: true },
      ],
      last_message: {
        id: 101,
        conversation_id: 1,
        sender_id: 2,
        sender_name: "Tom Wilson",
        sender_avatar: null,
        content: "Timber delivery confirmed for tomorrow 8am",
        message_type: "text",
        file_url: null,
        file_name: null,
        created_at: new Date(Date.now() - 300000).toISOString(),
        read_by: [2],
        is_own: false,
      },
      unread_count: 2,
      is_pinned: true,
      job_id: 1,
      job_name: "Harrison Residence",
      updated_at: new Date(Date.now() - 300000).toISOString(),
    },
    {
      id: 2,
      type: "direct",
      name: "Mike Roberts",
      participants: [
        { id: 1, name: "Jake Baird", avatar_url: null, is_online: true },
        { id: 4, name: "Mike Roberts", avatar_url: null, is_online: true },
      ],
      last_message: {
        id: 102,
        conversation_id: 2,
        sender_id: 4,
        sender_name: "Mike Roberts",
        sender_avatar: null,
        content: "Can you approve the PO for steel?",
        message_type: "text",
        file_url: null,
        file_name: null,
        created_at: new Date(Date.now() - 1800000).toISOString(),
        read_by: [4],
        is_own: false,
      },
      unread_count: 1,
      is_pinned: false,
      job_id: null,
      job_name: null,
      updated_at: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: 3,
      type: "group",
      name: "Site Supervisors",
      participants: [
        { id: 1, name: "Jake Baird", avatar_url: null, is_online: true },
        { id: 5, name: "Dave Brown", avatar_url: null, is_online: false },
        { id: 6, name: "Chris Lee", avatar_url: null, is_online: true },
        { id: 7, name: "Emma Davis", avatar_url: null, is_online: false },
      ],
      last_message: {
        id: 103,
        conversation_id: 3,
        sender_id: 5,
        sender_name: "Dave Brown",
        sender_avatar: null,
        content: "Safety meeting tomorrow at 7am",
        message_type: "text",
        file_url: null,
        file_name: null,
        created_at: new Date(Date.now() - 7200000).toISOString(),
        read_by: [5, 1],
        is_own: false,
      },
      unread_count: 0,
      is_pinned: true,
      job_id: null,
      job_name: null,
      updated_at: new Date(Date.now() - 7200000).toISOString(),
    },
  ];
}

function getMockMessages(conversationId: number): Message[] {
  const messages: Record<number, Message[]> = {
    1: [
      {
        id: 1001,
        conversation_id: 1,
        sender_id: 2,
        sender_name: "Tom Wilson",
        sender_avatar: null,
        content: "Morning team, just checking in on the framing progress",
        message_type: "text",
        file_url: null,
        file_name: null,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        read_by: [1, 2, 3],
        is_own: false,
      },
      {
        id: 1002,
        conversation_id: 1,
        sender_id: 1,
        sender_name: "You",
        sender_avatar: null,
        content: "All on track. Second floor walls going up today",
        message_type: "text",
        file_url: null,
        file_name: null,
        created_at: new Date(Date.now() - 85000000).toISOString(),
        read_by: [1, 2, 3],
        is_own: true,
      },
      {
        id: 1003,
        conversation_id: 1,
        sender_id: 3,
        sender_name: "Sarah Chen",
        sender_avatar: null,
        content: "Great! I'll have the electrical plans ready for rough-in next week",
        message_type: "text",
        file_url: null,
        file_name: null,
        created_at: new Date(Date.now() - 84000000).toISOString(),
        read_by: [1, 2, 3],
        is_own: false,
      },
      {
        id: 1004,
        conversation_id: 1,
        sender_id: 2,
        sender_name: "Tom Wilson",
        sender_avatar: null,
        content: "Timber delivery confirmed for tomorrow 8am",
        message_type: "text",
        file_url: null,
        file_name: null,
        created_at: new Date(Date.now() - 300000).toISOString(),
        read_by: [2],
        is_own: false,
      },
    ],
  };

  return messages[conversationId] || [];
}
