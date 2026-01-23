 
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import {
  Search,
  Send,
  MessageSquare,
  Users,
  Pin,
  MoreHorizontal,
  Paperclip,
  Image as ImageIcon,
  File as FileIcon,
  Check,
  CheckCheck,
  Briefcase,
  Plus,
  Monitor,
  X,
  Bookmark,
  Building2,
  UserCircle,
  FolderOpen,
  Copy,
  Maximize2,
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
import { uploadFile } from "@/lib/upload-utils";
import { PAGE_SIZE_REFERENCE } from "@/lib/constants/pagination-constants";
import { cn } from "@/lib/utils";
import type {
  ChatMessage,
  Conversation,
  OnlineUser,
  Participant,
  Construction,
  Contact,
  Case,
  EntityType,
} from "@/types/chat";

export default function ChatPage() {
  // Use full-height layout mode
  useSetLayoutMode("full-height");

  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save to entity functionality
  const [constructions, setConstructions] = useState<Construction[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savingMessageId, setSavingMessageId] = useState<number | null>(null);
  const [saveEntityType, setSaveEntityType] = useState<EntityType | null>(null);

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

  const loadMessages = useCallback(async (conversationId: number | string, isInitialLoad = false) => {
    if (!user) return;

    // Only show loading spinner on initial load, not during polling
    if (isInitialLoad) {
      setLoadingMessages(true);
    }

    try {
      // Determine API parameters based on conversation type
      const apiParams: Record<string, string | number> = {};

      // Handle DM format: "dm-34-45" or "dm-new-45"
      // Format is dm-{smallerId}-{largerId}, need to find the OTHER user's ID
      if (typeof conversationId === "string" && conversationId.startsWith("dm-")) {
        const parts = conversationId.split("-");
        if (parts[1] === "new") {
          // New conversation: "dm-new-36" → recipient is 36
          apiParams.user_id = parts[2];
        } else {
          // Existing conversation: "dm-34-36" → find the ID that's NOT current user
          const userId1 = parseInt(parts[1], 10);
          const userId2 = parseInt(parts[2], 10);
          apiParams.user_id = userId1 === user.id ? userId2 : userId1;
        }
      }
      // Handle numeric conversation ID
      else if (typeof conversationId === "number") {
        apiParams.conversation_id = conversationId;
      }
      // Handle string conversation ID (could be job, contact, case)
      else if (typeof conversationId === "string") {
        apiParams.conversation_id = conversationId;
      }

      // API response has different shape than our ChatMessage interface
      interface ApiMessage {
        id: number;
        user_id: number;
        content: string;
        created_at: string;
        user?: { name?: string };
        message_type?: "text" | "image" | "file";
        file_url?: string | null;
        file_name?: string | null;
        // SSoT: storage_item_id is provider-agnostic, sharepoint_file_id is legacy
        storage_item_id?: string | null;
        sharepoint_file_id?: string | null;
        has_file?: boolean;
      }

      const response = await api.get<ApiMessage[]>("/api/v1/chat_messages", { params: apiParams });

      // Transform backend response to our ChatMessage format
      const newMessages = (response || []).map((msg) => ({
        id: msg.id,
        conversation_id: conversationId,
        sender_id: msg.user_id,
        sender_name: msg.user?.name || "Unknown",
        sender_avatar: null,
        content: msg.content,
        message_type: msg.message_type || "text",
        file_url: msg.file_url || null,
        file_name: msg.file_name || null,
        // SSoT: Prefer storage_item_id, fall back to sharepoint_file_id
        storage_item_id: msg.storage_item_id || msg.sharepoint_file_id || null,
        sharepoint_file_id: msg.sharepoint_file_id || null, // Keep for backwards compat
        created_at: msg.created_at,
        read_by: [msg.user_id],
        is_own: msg.user_id === user.id,
      }));

      // Only update if messages actually changed (prevents flashing)
      // Compare count AND IDs to detect new messages
      setMessages(prevMessages => {
        const prevIds = prevMessages.map(m => m.id).sort().join(',');
        const newIds = newMessages.map(m => m.id).sort().join(',');
        const hasChanged = prevIds !== newIds || prevMessages.length !== newMessages.length;
        return hasChanged ? newMessages : prevMessages;
      });
    } catch (error) {
      console.error("Failed to load messages:", error);
      setMessages(getMockMessages(Number(conversationId) || 1));
    }

    if (isInitialLoad) {
      setLoadingMessages(false);
    }
  }, [user]);

  useEffect(() => {
    if (!selectedConversation) return;

    const conversationId = selectedConversation.id;
    let cancelled = false;
    let isFirstFetch = true;

    async function fetchMessages() {
      try {
        await loadMessages(conversationId, isFirstFetch);
        isFirstFetch = false;
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load messages in effect:", error);
        }
      }
    }

    // Mark conversation as read when viewed
    async function markAsRead() {
      try {
        await api.post("/api/v1/chat_messages/mark_as_read", {});
        // Update local unread count to 0 for this conversation
        setConversations(prev => prev.map(c =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        ));
      } catch (error) {
        console.error("Failed to mark as read:", error);
      }
    }

    // Initial fetch with loading spinner
    fetchMessages();
    markAsRead();

    // Poll for new messages every 10 seconds (silent updates, avoid rate limiting)
    const pollInterval = setInterval(() => {
      if (!cancelled) {
        fetchMessages();
      }
    }, 10000);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [selectedConversation, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load entities for save-to-entity functionality - lazy load when dialog opens
  const loadEntities = useCallback(async () => {
    try {
      // Load jobs
      // SSoT: Uses PAGE_SIZE_REFERENCE from pagination-constants.ts
      const jobsResponse = await api.get<{ constructions: Construction[] }>("/api/v1/jobs", {
        params: { status: "Active", per_page: PAGE_SIZE_REFERENCE },
      });
      setConstructions(jobsResponse?.constructions || []);

      // Load contacts
      // SSoT: Uses PAGE_SIZE_REFERENCE from pagination-constants.ts
      const contactsResponse = await api.get<{ contacts: Contact[] }>("/api/v1/contacts", {
        params: { per_page: PAGE_SIZE_REFERENCE },
      });
      setContacts(contactsResponse?.contacts || []);

      // Load cases (if you have a cases endpoint)
      // const casesResponse = await api.get<{ cases: Case[] }>("/api/v1/cases", {
      //   params: { per_page: 100 },
      // });
      // setCases(casesResponse?.cases || []);
    } catch (error) {
      console.error("Failed to load entities:", error);
    }
  }, []);

  // Lazy load entities when save dialog opens (not on page mount)
  const entitiesLoaded = useRef(false);
  useEffect(() => {
    if (showSaveDialog && !entitiesLoaded.current) {
      entitiesLoaded.current = true;
      loadEntities();
    }
  }, [showSaveDialog, loadEntities]);

  // Save message to entity
  const handleSaveToEntity = async (
    messageId: number,
    entityType: EntityType,
    entityId: number
  ) => {
    setSavingMessageId(messageId);
    try {
      const payload: Record<string, number> = {};
      if (entityType === "job") {
        payload.construction_id = entityId;
      } else if (entityType === "contact") {
        payload.contact_id = entityId;
      } else if (entityType === "case") {
        payload.case_id = entityId;
      }

      await api.post(`/api/v1/chat_messages/${messageId}/save_to_${entityType}`, payload);

      // Update message in state
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                ...(entityType === "job" && { saved_to_job: true, construction_id: entityId }),
                ...(entityType === "contact" && { contact_id: entityId }),
                ...(entityType === "case" && { case_id: entityId }),
              }
            : msg
        )
      );

      setShowSaveDialog(false);
      setSavingMessageId(null);
      setSaveEntityType(null);
    } catch (error) {
      console.error(`Failed to save message to ${entityType}:`, error);
      setSavingMessageId(null);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // Check for image in clipboard
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          setPastedImage(blob);
          // Create preview
          const reader = new FileReader();
          reader.onload = (e) => {
            setImagePreview(e.target?.result as string);
          };
          reader.readAsDataURL(blob);
        }
        return;
      }
    }
    // If no image, allow default text paste behavior
  };

  const clearImagePreview = () => {
    setPastedImage(null);
    setImagePreview(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPastedImage(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ""; // Reset for re-selection
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPastedImage(file);
      // For non-image files, just set a placeholder preview indicator
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setImagePreview(ev.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setImagePreview(null); // No preview for non-image files
      }
    }
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setPastedImage(file);
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setImagePreview(ev.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setImagePreview(null);
      }
    }
  };

  const handleScreenCapture = async () => {
    try {
      // Request screen capture from browser
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: "screen",
        } as MediaTrackConstraints,
      });

      // Create video element to capture frame
      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      // Wait for video to load
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      // Create canvas and capture frame
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);

      // Stop the stream
      stream.getTracks().forEach((track) => track.stop());

      // Convert canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `screenshot-${Date.now()}.png`, {
            type: "image/png",
          });
          setPastedImage(file);

          // Create preview
          const reader = new FileReader();
          reader.onload = (e) => {
            setImagePreview(e.target?.result as string);
          };
          reader.readAsDataURL(file);
        }
      }, "image/png");
    } catch (error) {
      console.error("Screen capture failed:", error);
      // User likely cancelled the screen share prompt
    }
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !pastedImage) || !selectedConversation || !user) return;

    // Get recipient user ID from the conversation ID or participants
    let recipientId: number | undefined;

    if (typeof selectedConversation.id === "string" && selectedConversation.id.startsWith("dm-")) {
      // Conversation ID format: "dm-34-36" or "dm-new-36"
      const parts = selectedConversation.id.split("-");
      if (parts[1] === "new") {
        // New conversation: "dm-new-36" → recipient is 36
        recipientId = parseInt(parts[2], 10);
      } else {
        // Existing conversation: "dm-34-36" → find the ID that's NOT current user
        const userId1 = parseInt(parts[1], 10);
        const userId2 = parseInt(parts[2], 10);
        recipientId = userId1 === user.id ? userId2 : userId1;
      }
    } else {
      recipientId = selectedConversation.participants.find(p => p.id !== user?.id)?.id;
    }

    // Handle image upload if present
    if (pastedImage) {
      const tempMessage: ChatMessage = {
        id: Date.now(),
        conversation_id: selectedConversation.id,
        sender_id: user.id,
        sender_name: "You",
        sender_avatar: null,
        content: newMessage || "[Image]",
        message_type: "image",
        file_url: imagePreview,
        file_name: pastedImage.name,
        created_at: new Date().toISOString(),
        read_by: [user.id],
        is_own: true,
      };

      setMessages((prev) => [...prev, tempMessage]);
      setNewMessage("");
      clearImagePreview();

      try {
        // SSoT: Upload image via presigned URL (bypasses Heroku 30s timeout)
        const uploadResult = await uploadFile(pastedImage, 'chat');

        if (!uploadResult.success || !uploadResult.key) {
          throw new Error(uploadResult.error || "Failed to upload image");
        }

        // Send message with storage_key
        await api.post("/api/v1/chat_messages", {
          chat_message: {
            content: newMessage || "[Image]",
            message_type: "image",
            storage_key: uploadResult.key,
            recipient_user_id: recipientId,
          }
        });
      } catch (error) {
        console.error("Failed to send image:", error);
      }
      return;
    }

    // Handle text message
    const tempMessage: ChatMessage = {
      id: Date.now(),
      conversation_id: selectedConversation.id,
      sender_id: user.id,
      sender_name: "You",
      sender_avatar: null,
      content: newMessage,
      message_type: "text",
      file_url: null,
      file_name: null,
      created_at: new Date().toISOString(),
      read_by: [user.id],
      is_own: true,
    };

    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");

    try {
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
  const startConversation = (selectedUser: OnlineUser) => {
    if (!user) return;

    // Create a temporary conversation for this user
    const newConversation: Conversation = {
      id: `dm-new-${selectedUser.id}`,
      type: "direct",
      name: selectedUser.name,
      participants: [
        { id: user.id, name: "You", avatar_url: null, is_online: true },
        { id: selectedUser.id, name: selectedUser.name, avatar_url: null, is_online: selectedUser.is_online },
      ],
      last_message: null,
      unread_count: 0,
      is_pinned: false,
      job_id: null,
      job_name: null,
      entity_type: null,
      entity_id: null,
      entity_name: null,
      updated_at: new Date().toISOString(),
    };

    // Check if conversation already exists
    const existingConv = conversations.find(c =>
      c.type === "direct" && c.participants.some(p => p.id === selectedUser.id)
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
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Compact Header */}
      <div className="flex items-center justify-between py-2 px-1 shrink-0">
        <h1 className="text-lg font-semibold">Messages</h1>
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
                            user.presence_status === "offline" && "bg-muted-foreground"
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
                          user.presence_status === "online" && "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
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
      <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">
        {/* Online Users Sidebar */}
        <Card className="col-span-2 flex flex-col min-h-0">
          <CardHeader className="py-2 px-3 shrink-0">
            <CardTitle className="text-xs font-medium flex items-center gap-1">
              <Users className="h-3 w-3" />
              Team ({onlineUsers.filter(u => u.is_online).length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="px-3 pb-3 space-y-1">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner />
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
                            user.presence_status === "offline" && "bg-muted-foreground"
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
        <Card className="col-span-3 flex flex-col min-h-0">
          <CardHeader className="py-2 px-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-8 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
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
        <Card className="col-span-7 flex flex-col min-h-0">
          {selectedConversation ? (
            <>
              {/* Conversation Header */}
              <CardHeader className="py-2 px-3 border-b shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-sm">
                        {selectedConversation.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .substring(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        {selectedConversation.name}
                        {selectedConversation.job_name && (
                          <Badge variant="outline" className="text-xs py-0">
                            <Briefcase className="h-2.5 w-2.5 mr-1" />
                            {selectedConversation.job_name}
                          </Badge>
                        )}
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
                      <DropdownMenuItem
                        onClick={() => setMessages([])}
                        className="text-destructive"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Clear Chat
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 p-3 overflow-hidden min-h-0">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Spinner />
                  </div>
                ) : (
                  <ScrollArea className="h-full pr-2">
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          onSaveToEntity={(messageId, entityType) => {
                            setSavingMessageId(messageId);
                            setSaveEntityType(entityType);
                            setShowSaveDialog(true);
                          }}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                )}
              </CardContent>

              {/* Save to Entity Dialog */}
              <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      Save Message to {saveEntityType === "job" ? "Job" : saveEntityType === "contact" ? "Contact" : "Case"}
                    </DialogTitle>
                    <DialogDescription>
                      Select a {saveEntityType} to save this message to
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-1">
                      {saveEntityType === "job" &&
                        constructions.map((job) => (
                          <Button
                            key={job.id}
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => handleSaveToEntity(savingMessageId!, "job", job.id)}
                            disabled={savingMessageId === null}
                          >
                            <Building2 className="h-4 w-4 mr-2" />
                            {job.title}
                          </Button>
                        ))}
                      {saveEntityType === "contact" &&
                        contacts.map((contact) => (
                          <Button
                            key={contact.id}
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => handleSaveToEntity(savingMessageId!, "contact", contact.id)}
                            disabled={savingMessageId === null}
                          >
                            <UserCircle className="h-4 w-4 mr-2" />
                            {contact.name}
                          </Button>
                        ))}
                      {saveEntityType === "case" &&
                        cases.map((caseItem) => (
                          <Button
                            key={caseItem.id}
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => handleSaveToEntity(savingMessageId!, "case", caseItem.id)}
                            disabled={savingMessageId === null}
                          >
                            <FolderOpen className="h-4 w-4 mr-2" />
                            {caseItem.title}
                          </Button>
                        ))}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>

              {/* Message Input */}
              <div className="p-2 border-t shrink-0">
                {/* Image Preview */}
                {/* Hidden file inputs */}
                <input
                  type="file"
                  ref={imageInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {/* Image preview */}
                {imagePreview && (
                  <div className="mb-2 relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Pasted screenshot"
                      className="max-h-32 rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                      onClick={clearImagePreview}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {/* Non-image file preview */}
                {pastedImage && !imagePreview && (
                  <div className="mb-2 relative inline-flex items-center gap-2 bg-secondary rounded-lg px-3 py-2">
                    <FileIcon className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate max-w-[200px]">{pastedImage.name}</span>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-5 w-5 rounded-full ml-1"
                      onClick={clearImagePreview}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div
                  className={cn(
                    "flex items-center gap-1 w-full rounded-md transition-all",
                    isDragging && "ring-2 ring-primary bg-primary/5"
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Attach file">
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={handleScreenCapture}>
                        <Monitor className="h-4 w-4 mr-2" />
                        Capture Screen/Window
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Upload Image
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                        <FileIcon className="h-4 w-4 mr-2" />
                        Upload File
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Input
                    placeholder="Type a message or paste a screenshot..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    onPaste={handlePaste}
                    className="flex-1 h-8"
                  />
                  <Button size="sm" className="h-8" onClick={handleSend} disabled={!newMessage.trim() && !pastedImage}>
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
        "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors mb-0.5",
        isSelected ? "bg-secondary" : "hover:bg-secondary/50"
      )}
      onClick={onClick}
    >
      <div className="relative">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">
            {conversation.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .substring(0, 2)}
          </AvatarFallback>
        </Avatar>
        {conversation.type === "job" && (
          <div className="absolute -bottom-0.5 -right-0.5 bg-blue-500 rounded-full p-0.5">
            <Briefcase className="h-2 w-2 text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">{conversation.name}</span>
          <span className="text-[10px] text-muted-foreground">
            {formatTime(conversation.updated_at)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground truncate">
            {conversation.last_message?.content || "No messages yet"}
          </span>
          {conversation.unread_count > 0 && (
            <Badge className="bg-primary h-4 px-1 ml-1 text-[10px]">
              {conversation.unread_count}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onSaveToEntity,
}: {
  message: ChatMessage;
  onSaveToEntity?: (messageId: number, entityType: EntityType) => void;
}) {
  const [showSaveMenu, setShowSaveMenu] = useState(false);

  return (
    <div className={cn("flex", message.is_own ? "justify-end" : "justify-start")}>
      <div className={cn("flex gap-2 max-w-[70%]", message.is_own && "flex-row-reverse")}>
        {!message.is_own && (
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs">
              {message.sender_name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="min-w-0 flex-1">
          {!message.is_own && (
            <div className="text-xs text-muted-foreground mb-1">{message.sender_name}</div>
          )}
          <div
            className={cn(
              "rounded-lg overflow-hidden group relative break-words",
              message.message_type === "image" ? "p-0" : "px-3 py-2",
              message.is_own
                ? "bg-primary text-primary-foreground"
                : "bg-secondary"
            )}
          >
            {message.message_type === "image" ? (
              <div>
                {message.file_url ? (
                  // Check if it's actually an image or a PDF/document
                  message.file_name?.toLowerCase().endsWith('.pdf') ? (
                    <a
                      href={message.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 hover:underline"
                    >
                      <FileIcon className="h-4 w-4 shrink-0" />
                      <span className="text-sm break-words">{message.file_name}</span>
                    </a>
                  ) : (
                    <div className="relative group">
                      <Dialog>
                        <DialogTrigger asChild>
                          <img
                            src={message.file_url}
                            alt={message.file_name || "Shared image"}
                            className="max-w-full max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </DialogTrigger>
                        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
                          <DialogHeader className="sr-only">
                            <DialogTitle>Image Preview</DialogTitle>
                            <DialogDescription>Full size image preview</DialogDescription>
                          </DialogHeader>
                          <img
                            src={message.file_url}
                            alt={message.file_name || "Shared image"}
                            className="w-full h-full object-contain"
                          />
                        </DialogContent>
                      </Dialog>
                      {/* Action buttons overlay */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              const response = await fetch(message.file_url!);
                              const blob = await response.blob();
                              await navigator.clipboard.write([
                                new ClipboardItem({ [blob.type]: blob })
                              ]);
                            } catch {
                              // Fallback: copy URL to clipboard
                              await navigator.clipboard.writeText(message.file_url!);
                            }
                          }}
                          className="p-1.5 bg-black/60 hover:bg-black/80 rounded text-white"
                          title="Copy image"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <button
                              className="p-1.5 bg-black/60 hover:bg-black/80 rounded text-white"
                              title="Expand image"
                            >
                              <Maximize2 className="h-4 w-4" />
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
                            <DialogHeader className="sr-only">
                              <DialogTitle>Image Preview</DialogTitle>
                              <DialogDescription>Full size image preview</DialogDescription>
                            </DialogHeader>
                            <img
                              src={message.file_url}
                              alt={message.file_name || "Shared image"}
                              className="w-full h-full object-contain"
                            />
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  )
                ) : message.file_name ? (
                  // Fallback when file_url is not available yet (uploading to storage)
                  <div className="flex items-center gap-2 px-3 py-2">
                    <FileIcon className="h-4 w-4 shrink-0" />
                    <span className="text-sm break-words">{message.file_name}</span>
                    {!message.storage_item_id && !message.sharepoint_file_id && (
                      <span className="text-xs text-muted-foreground">(uploading...)</span>
                    )}
                  </div>
                ) : null}
                {message.content && message.content !== "[Image]" && (
                  <p className="text-sm px-3 py-2 break-words whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            ) : message.message_type === "file" ? (
              <div className="flex items-center gap-2">
                <FileIcon className="h-4 w-4 shrink-0" />
                <span className="text-sm break-words">{message.file_name}</span>
              </div>
            ) : (
              <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
            )}
          </div>
          <div
            className={cn(
              "flex items-center gap-2 mt-1 text-xs text-muted-foreground",
              message.is_own && "justify-end"
            )}
          >
            <span>{formatTime(message.created_at)}</span>
            {message.is_own && (
              message.read_by.length > 1 ? (
                <CheckCheck className="h-3 w-3 text-blue-500 dark:text-blue-400" />
              ) : (
                <Check className="h-3 w-3" />
              )
            )}
            {onSaveToEntity && !message.saved_to_job && !message.contact_id && !message.case_id && (
              <DropdownMenu open={showSaveMenu} onOpenChange={setShowSaveMenu}>
                <DropdownMenuTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground">
                    <Bookmark className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onSaveToEntity(message.id, "job")}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Save to Job
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSaveToEntity(message.id, "contact")}>
                    <UserCircle className="h-4 w-4 mr-2" />
                    Save to Contact
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSaveToEntity(message.id, "case")}>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Save to Case
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {message.saved_to_job && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Bookmark className="h-3 w-3 fill-current" />
                <span className="text-xs">Saved to job</span>
              </span>
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
      entity_type: "job",
      entity_id: 1,
      entity_name: "Harrison Residence",
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
      entity_type: null,
      entity_id: null,
      entity_name: null,
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
      entity_type: null,
      entity_id: null,
      entity_name: null,
      updated_at: new Date(Date.now() - 7200000).toISOString(),
    },
  ];
}

function getMockMessages(conversationId: number): ChatMessage[] {
  const messages: Record<number, ChatMessage[]> = {
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
