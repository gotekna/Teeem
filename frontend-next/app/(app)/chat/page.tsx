
"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { copyToClipboard } from "@/utils/formatters";
import { useAuth } from "@/contexts/AuthContext";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";
import {
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
  ChevronDown,
  Link,
  Bot,
  Sparkles,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import { API } from "@/lib/constants/api-endpoints";
import { renderMessageContent } from "@/components/chat/SupportChatWidget";
import { uploadFile } from "@/lib/upload-utils";
import { PAGE_SIZE_REFERENCE } from "@/lib/constants/pagination-constants";
import { POLLING_INTERVAL_MS } from "@/lib/constants/timeout-constants";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import { ScreenShareViewer } from "@/components/screen-share/ScreenShareViewer";
import { useSetAtom } from "jotai";
import { screenShareViewerOpenAtom } from "@/lib/screen-share-atoms";
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

// ─── Sidebar item types for unified view ───
interface SidebarDMItem {
  kind: "dm";
  userId: number;
  userName: string;
  userEmail: string;
  presenceStatus: "online" | "away" | "offline";
  isOnline: boolean;
  lastSeenAt: string | null;
  conversation: Conversation | null;
}

interface SidebarGroupItem {
  kind: "group";
  conversation: Conversation;
}

export default function ChatPage() {
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
  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Group dialog
  const [showNewGroupDialog, setShowNewGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<number[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Guest chat link state
  const [guestShareUrl, setGuestShareUrl] = useState<string | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [creatingShareLink, setCreatingShareLink] = useState(false);

  // Screen share state
  const [screenShareTarget, setScreenShareTarget] = useState<{ id: number; name: string } | null>(null);
  const setScreenShareViewerOpen = useSetAtom(screenShareViewerOpenAtom);

  // Group members panel
  const [showMembersPanel, setShowMembersPanel] = useState(false);

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

    const interval = setInterval(loadOnlineUsers, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Load conversations (initial + poll for unread badge updates)
  useEffect(() => {
    let isInitial = true;
    const loadConversations = async () => {
      if (isInitial) setLoading(true);
      try {
        const response = await api.get<{ conversations: Conversation[] }>("/api/v1/chat_messages/conversations");
        setConversations(response.conversations || []);
      } catch (error) {
        console.error("Failed to load conversations:", error);
        if (isInitial) setConversations(getMockConversations());
      }
      if (isInitial) {
        setLoading(false);
        isInitial = false;
      }
    };
    loadConversations();

    const interval = setInterval(loadConversations, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const loadMessages = useCallback(async (conversationId: number | string, isInitialLoad = false) => {
    if (!user) return;

    if (isInitialLoad) {
      setLoadingMessages(true);
    }

    try {
      // Support conversation uses a different endpoint
      if (conversationId === "support") {
        interface SupportMessage {
          id: number;
          content: string;
          user_id: number | null;
          sender_name: string;
          is_ai: boolean;
          created_at: string;
          formatted_timestamp: string;
        }

        const response = await api.get<{ success: boolean; data: SupportMessage[] }>("/api/v1/chat_messages/support_history");
        const msgs = response?.data || [];

        const newMessages = msgs.map((msg) => ({
          id: msg.id,
          conversation_id: "support" as string | number,
          sender_id: msg.user_id || 0,
          sender_name: msg.is_ai ? "Teeem AI" : "You",
          sender_avatar: null,
          content: msg.content,
          message_type: "text" as const,
          file_url: null,
          file_name: null,
          created_at: msg.created_at,
          read_by: [] as number[],
          is_own: !msg.is_ai,
        }));

        setMessages(prevMessages => {
          const prevIds = prevMessages.map(m => m.id).sort().join(',');
          const newIds = newMessages.map(m => m.id).sort().join(',');
          return prevIds !== newIds ? newMessages : prevMessages;
        });

        if (isInitialLoad) setLoadingMessages(false);
        return;
      }

      const apiParams: Record<string, string | number> = {};

      if (typeof conversationId === "string" && conversationId.startsWith("dm-")) {
        const parts = conversationId.split("-");
        if (parts[1] === "new") {
          apiParams.user_id = parts[2];
        } else {
          const userId1 = parseInt(parts[1], 10);
          const userId2 = parseInt(parts[2], 10);
          apiParams.user_id = userId1 === user.id ? userId2 : userId1;
        }
      } else if (typeof conversationId === "string" && conversationId.startsWith("guest-")) {
        apiParams.chat_guest_session_id = conversationId.replace("guest-", "");
      } else if (typeof conversationId === "string" && conversationId.startsWith("group-")) {
        apiParams.chat_conversation_id = conversationId.replace("group-", "");
      } else if (typeof conversationId === "number") {
        apiParams.conversation_id = conversationId;
      } else if (typeof conversationId === "string") {
        apiParams.conversation_id = conversationId;
      }

      interface ApiMessage {
        id: number;
        user_id: number | null;
        content: string;
        created_at: string;
        user?: { name?: string } | null;
        message_type?: "text" | "image" | "file";
        file_url?: string | null;
        file_name?: string | null;
        storage_item_id?: string | null;
        storage_reference?: string | null;
        has_file?: boolean;
        sender_display_name?: string;
        guest_sender_name?: string;
        is_guest?: boolean;
      }

      const response = await api.get<ApiMessage[]>("/api/v1/chat_messages", { params: apiParams });

      const newMessages = (response || []).map((msg) => ({
        id: msg.id,
        conversation_id: conversationId,
        sender_id: msg.user_id || 0,
        sender_name: msg.sender_display_name || msg.user?.name || msg.guest_sender_name || "Unknown",
        sender_avatar: null,
        content: msg.content,
        message_type: msg.message_type || "text",
        file_url: msg.file_url || null,
        file_name: msg.file_name || null,
        storage_item_id: msg.storage_item_id || msg.storage_reference || null,
        created_at: msg.created_at,
        read_by: msg.user_id ? [msg.user_id] : [],
        is_own: msg.user_id === user.id,
      }));

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

    // Reset members panel when switching conversations
    setShowMembersPanel(false);

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

    async function markAsRead() {
      try {
        await api.post("/api/v1/chat_messages/mark_as_read", {
          conversation_id: conversationId,
        });
        setConversations(prev => prev.map(c =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        ));
      } catch (error) {
        console.error("Failed to mark as read:", error);
      }
    }

    fetchMessages();
    markAsRead();

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

  // Load entities for save-to-entity - lazy load when dialog opens
  const loadEntities = useCallback(async () => {
    try {
      const jobsResponse = await api.get<{ constructions: Construction[] }>(API.jobs.list, {
        params: { status: "Active", per_page: PAGE_SIZE_REFERENCE },
      });
      setConstructions(jobsResponse?.constructions || []);

      const contactsResponse = await api.get<{ contacts: Contact[] }>(API.contacts.list, {
        params: { per_page: PAGE_SIZE_REFERENCE },
      });
      setContacts(contactsResponse?.contacts || []);
    } catch (error) {
      console.error("Failed to load entities:", error);
    }
  }, []);

  const entitiesLoaded = useRef(false);
  useEffect(() => {
    if (showSaveDialog && !entitiesLoaded.current) {
      entitiesLoaded.current = true;
      loadEntities();
    }
  }, [showSaveDialog, loadEntities]);

  const handleSaveToEntity = async (
    messageId: number,
    entityType: EntityType,
    entityId: number
  ) => {
    setSavingMessageId(messageId);
    try {
      const payload: Record<string, number> = {};
      if (entityType === "job") {
        payload.job_id = entityId;
      } else if (entityType === "contact") {
        payload.contact_id = entityId;
      } else if (entityType === "case") {
        payload.case_id = entityId;
      }

      await api.post(`/api/v1/chat_messages/${messageId}/save_to_${entityType}`, payload);

      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                ...(entityType === "job" && { saved_to_job: true, job_id: entityId }),
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

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          setPastedImage(blob);
          const reader = new FileReader();
          reader.onload = (e) => {
            setImagePreview(e.target?.result as string);
          };
          reader.readAsDataURL(blob);
        }
        return;
      }
    }
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
    e.target.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: "screen" } as MediaTrackConstraints,
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      await new Promise((resolve) => { video.onloadedmetadata = resolve; });

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);

      stream.getTracks().forEach((track) => track.stop());

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `screenshot-${Date.now()}.png`, { type: "image/png" });
          setPastedImage(file);
          const reader = new FileReader();
          reader.onload = (e) => { setImagePreview(e.target?.result as string); };
          reader.readAsDataURL(file);
        }
      }, "image/png");
    } catch (error) {
      console.error("Screen capture failed:", error);
    }
  };

  // State for AI "thinking" indicator
  const [aiThinking, setAiThinking] = useState(false);

  const handleSend = async () => {
    if ((!newMessage.trim() && !pastedImage) || !selectedConversation || !user) return;

    // Support conversation: send to AI endpoint
    if (selectedConversation.type === "support") {
      const content = newMessage.trim();
      if (!content) return;

      // Optimistic: add user message immediately
      const tempUserMsg: ChatMessage = {
        id: Date.now(),
        conversation_id: "support",
        sender_id: user.id,
        sender_name: "You",
        sender_avatar: null,
        content,
        message_type: "text",
        file_url: null,
        file_name: null,
        created_at: new Date().toISOString(),
        read_by: [user.id],
        is_own: true,
      };
      setMessages((prev) => [...prev, tempUserMsg]);
      setNewMessage("");
      setAiThinking(true);

      try {
        interface SupportResponse {
          success: boolean;
          data: {
            user_message: { id: number; content: string; user_id: number; sender_name: string; is_ai: boolean; created_at: string; formatted_timestamp: string };
            ai_message: { id: number; content: string; user_id: number | null; sender_name: string; is_ai: boolean; created_at: string; formatted_timestamp: string };
          };
        }

        const response = await api.post<SupportResponse>("/api/v1/chat_messages/support", { content, current_page: "/chat" });
        if (response?.data) {
          const { user_message, ai_message } = response.data;
          // Replace temp message with real one and add AI response
          setMessages((prev) => [
            ...prev.filter((m) => m.id !== tempUserMsg.id),
            {
              id: user_message.id,
              conversation_id: "support",
              sender_id: user_message.user_id || user.id,
              sender_name: "You",
              sender_avatar: null,
              content: user_message.content,
              message_type: "text",
              file_url: null,
              file_name: null,
              created_at: user_message.created_at,
              read_by: [],
              is_own: true,
            },
            {
              id: ai_message.id,
              conversation_id: "support",
              sender_id: 0,
              sender_name: "Teeem AI",
              sender_avatar: null,
              content: ai_message.content,
              message_type: "text",
              file_url: null,
              file_name: null,
              created_at: ai_message.created_at,
              read_by: [],
              is_own: false,
            },
          ]);
        }
      } catch (error) {
        console.error("Failed to send support message:", error);
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
        setNewMessage(content);
      } finally {
        setAiThinking(false);
      }
      return;
    }

    let recipientId: number | undefined;
    let chatConversationId: number | undefined;
    let chatGuestSessionId: number | undefined;

    // Determine target: group conversation, guest session, or DM recipient
    if (selectedConversation.type === "guest" && typeof selectedConversation.id === "string" && selectedConversation.id.startsWith("guest-")) {
      chatGuestSessionId = parseInt(selectedConversation.id.replace("guest-", ""), 10);
    } else if (selectedConversation.type === "group" && typeof selectedConversation.id === "string" && selectedConversation.id.startsWith("group-")) {
      chatConversationId = parseInt(selectedConversation.id.replace("group-", ""), 10);
    } else if (typeof selectedConversation.id === "string" && selectedConversation.id.startsWith("dm-")) {
      const parts = selectedConversation.id.split("-");
      if (parts[1] === "new") {
        recipientId = parseInt(parts[2], 10);
      } else {
        const userId1 = parseInt(parts[1], 10);
        const userId2 = parseInt(parts[2], 10);
        recipientId = userId1 === user.id ? userId2 : userId1;
      }
    } else {
      recipientId = selectedConversation.participants.find(p => p.id !== user?.id)?.id;
    }

    // Handle image upload
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
        const uploadResult = await uploadFile(pastedImage, 'chat');
        if (!uploadResult.success || !uploadResult.key) {
          throw new Error(uploadResult.error || "Failed to upload image");
        }

        await api.post("/api/v1/chat_messages", {
          chat_message: {
            content: newMessage || "[Image]",
            message_type: "image",
            storage_key: uploadResult.key,
            recipient_user_id: recipientId,
            chat_conversation_id: chatConversationId,
            chat_guest_session_id: chatGuestSessionId,
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
          chat_conversation_id: chatConversationId,
          chat_guest_session_id: chatGuestSessionId,
        },
      });
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // Start a new DM conversation with a user
  const startConversation = (selectedUser: OnlineUser) => {
    if (!user) return;

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

    const existingConv = conversations.find(c =>
      c.type === "direct" && c.participants.some(p => p.id === selectedUser.id)
    );

    const isStaleConversation = existingConv?.last_message?.created_at
      ? (Date.now() - new Date(existingConv.last_message.created_at).getTime()) > 15 * 60 * 1000
      : true;

    if (existingConv) {
      setSelectedConversation(existingConv);
    } else {
      setConversations(prev => [newConversation, ...prev]);
      setSelectedConversation(newConversation);
    }

    if (!existingConv || isStaleConversation) {
      const firstName = selectedUser.name.split(' ')[0];
      setNewMessage(`Hi ${firstName}`);
    }
  };

  // Create a shareable guest chat link
  const handleCreateShareLink = async () => {
    setCreatingShareLink(true);
    try {
      const response = await api.post<{ token: string; share_url: string }>("/api/v1/chat_guest_sessions");
      if (response) {
        setGuestShareUrl(response.share_url);
        setShowShareDialog(true);
      }
    } catch (err) {
      console.error("Failed to create share link:", err);
    } finally {
      setCreatingShareLink(false);
    }
  };

  // Create a new group conversation
  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedGroupMembers.length === 0 || !user) return;

    setCreatingGroup(true);
    try {
      const response = await api.post<{
        id: number;
        name: string;
        participants: Array<{ id: number; name: string; is_online: boolean }>;
      }>("/api/v1/chat_conversations", {
        chat_conversation: {
          name: newGroupName.trim(),
          participant_ids: selectedGroupMembers,
        },
      });

      if (!response) return;

      const groupConv: Conversation = {
        id: `group-${response.id}`,
        type: "group",
        name: response.name,
        participants: response.participants.map(p => ({
          id: p.id,
          name: p.name,
          avatar_url: null,
          is_online: p.is_online,
        })),
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

      setConversations(prev => [groupConv, ...prev]);
      setSelectedConversation(groupConv);
      setShowNewGroupDialog(false);
      setNewGroupName("");
      setSelectedGroupMembers([]);
      setGroupSearchQuery("");
    } catch (error) {
      console.error("Failed to create group:", error);
    }
    setCreatingGroup(false);
  };

  // ─── Build unified sidebar items ───
  const sidebarItems = useMemo((): { dmItems: SidebarDMItem[]; groupItems: SidebarGroupItem[] } => {
    const dmConvByUserId = new Map<number, Conversation>();
    for (const conv of conversations) {
      if (conv.type === "direct") {
        const otherParticipant = conv.participants.find(p => p.id !== user?.id);
        if (otherParticipant) {
          dmConvByUserId.set(otherParticipant.id, conv);
        }
      }
    }

    const dmItems: SidebarDMItem[] = onlineUsers.map(ou => ({
      kind: "dm" as const,
      userId: ou.id,
      userName: ou.name,
      userEmail: ou.email,
      presenceStatus: ou.presence_status,
      isOnline: ou.is_online,
      lastSeenAt: ou.last_seen_at,
      conversation: dmConvByUserId.get(ou.id) ?? null,
    }));

    // Sort: unread first, then conversations by time, then online status
    dmItems.sort((a, b) => {
      // Unread conversations always sort first
      const aUnread = (a.conversation?.unread_count ?? 0) > 0 ? 1 : 0;
      const bUnread = (b.conversation?.unread_count ?? 0) > 0 ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;

      const aHasConv = a.conversation?.last_message ? 1 : 0;
      const bHasConv = b.conversation?.last_message ? 1 : 0;
      if (aHasConv !== bHasConv) return bHasConv - aHasConv;
      if (aHasConv && bHasConv) {
        const aTime = new Date(a.conversation!.last_message!.created_at).getTime();
        const bTime = new Date(b.conversation!.last_message!.created_at).getTime();
        return bTime - aTime;
      }
      const presenceOrder = { online: 0, away: 1, offline: 2 };
      const presenceDiff = presenceOrder[a.presenceStatus] - presenceOrder[b.presenceStatus];
      if (presenceDiff !== 0) return presenceDiff;
      return a.userName.localeCompare(b.userName);
    });

    const groupItems: SidebarGroupItem[] = conversations
      .filter(c => c.type === "group")
      .map(c => ({ kind: "group" as const, conversation: c }));

    return { dmItems, groupItems };
  }, [conversations, onlineUsers, user?.id]);

  // Filter sidebar items by search
  const filteredDMItems = useMemo(() => {
    if (!searchQuery) return sidebarItems.dmItems;
    const q = searchQuery.toLowerCase();
    return sidebarItems.dmItems.filter(item =>
      item.userName.toLowerCase().includes(q) ||
      item.userEmail.toLowerCase().includes(q)
    );
  }, [sidebarItems.dmItems, searchQuery]);

  const filteredGroupItems = useMemo(() => {
    if (!searchQuery) return sidebarItems.groupItems;
    const q = searchQuery.toLowerCase();
    return sidebarItems.groupItems.filter(item =>
      item.conversation.name.toLowerCase().includes(q)
    );
  }, [sidebarItems.groupItems, searchQuery]);

  const isDMSelected = (item: SidebarDMItem) => {
    if (!selectedConversation) return false;
    if (item.conversation) return selectedConversation.id === item.conversation.id;
    return selectedConversation.id === `dm-new-${item.userId}`;
  };

  const isGroupSelected = (item: SidebarGroupItem) => {
    if (!selectedConversation) return false;
    return selectedConversation.id === item.conversation.id;
  };

  const handleDMClick = (item: SidebarDMItem) => {
    if (item.conversation) {
      setSelectedConversation(item.conversation);
    } else {
      const ou: OnlineUser = {
        id: item.userId,
        name: item.userName,
        email: item.userEmail,
        presence_status: item.presenceStatus,
        is_online: item.isOnline,
        last_seen_at: null,
      };
      startConversation(ou);
    }
  };

  // Filter users for new group dialog
  const filteredGroupDialogUsers = onlineUsers.filter(u =>
    u.name.toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(groupSearchQuery.toLowerCase())
  );

  if (loading && loadingUsers) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between py-2 px-1 shrink-0">
        <h1 className="text-lg font-semibold">Messages</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Chat
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              setSearchQuery("");
              const searchEl = document.getElementById("chat-sidebar-search");
              searchEl?.focus();
            }}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Direct Message
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowNewGroupDialog(true)}>
              <Users className="h-4 w-4 mr-2" />
              New Group
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCreateShareLink} disabled={creatingShareLink}>
              <Link className="h-4 w-4 mr-2" />
              {creatingShareLink ? "Creating..." : "Share Chat Link"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Share Chat Link Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Chat Link</DialogTitle>
            <DialogDescription>
              Anyone with this link can chat with you. No account needed.
            </DialogDescription>
          </DialogHeader>
          {guestShareUrl && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Input value={guestShareUrl} readOnly className="text-sm" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    copyToClipboard(guestShareUrl);
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Link expires in 7 days. You can close it anytime from your chat list.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Group Dialog */}
      <Dialog open={showNewGroupDialog} onOpenChange={setShowNewGroupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a Group Chat</DialogTitle>
            <DialogDescription>
              Name your group and select members
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Group name..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              autoFocus
            />
            <SearchInput
              value={groupSearchQuery}
              onChange={setGroupSearchQuery}
              placeholder="Search team members..."
            />
            <ScrollArea className="h-[250px]">
              <div className="space-y-1">
                {filteredGroupDialogUsers.map((u) => {
                  const isSelected = selectedGroupMembers.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                        isSelected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-secondary"
                      )}
                      onClick={() => {
                        setSelectedGroupMembers(prev =>
                          isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                        );
                      }}
                    >
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {u.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background",
                            u.presence_status === "online" && "bg-green-500",
                            u.presence_status === "away" && "bg-yellow-500",
                            u.presence_status === "offline" && "bg-muted-foreground"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            {selectedGroupMembers.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {selectedGroupMembers.length} member{selectedGroupMembers.length !== 1 ? "s" : ""} selected
              </div>
            )}
            <Button
              className="w-full"
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim() || selectedGroupMembers.length === 0 || creatingGroup}
            >
              {creatingGroup ? <Spinner className="mr-2" /> : null}
              Create Group
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chat Interface - 2 column layout */}
      <div className="grid grid-cols-12 gap-2 flex-1 min-h-0">
        {/* Unified Sidebar */}
        <Card className="col-span-4 flex flex-col min-h-0">
          <CardHeader className="py-2 px-3 shrink-0">
            <SearchInput
              id="chat-sidebar-search"
              placeholder="Search people & groups..."
              value={searchQuery}
              onChange={setSearchQuery}
              inputClassName="h-8 text-sm"
            />
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="px-2 pb-2">
                {/* Teeem Support - Always pinned at top */}
                {(!searchQuery || "teeem support ai".includes(searchQuery.toLowerCase())) && (
                  <div
                    className={cn(
                      "flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors mb-1",
                      selectedConversation?.id === "support"
                        ? "bg-primary/10 ring-1 ring-primary/20"
                        : "hover:bg-secondary"
                    )}
                    onClick={() => {
                      const existing = conversations.find(c => c.id === "support");
                      if (existing) {
                        setSelectedConversation(existing);
                      } else {
                        const supportConv: Conversation = {
                          id: "support",
                          type: "support",
                          name: "Teeem Support",
                          participants: [
                            { id: user?.id || 0, name: "You", avatar_url: null, is_online: true },
                            { id: 0, name: "Teeem AI", avatar_url: null, is_online: true },
                          ],
                          last_message: null,
                          unread_count: 0,
                          is_pinned: true,
                          is_support: true,
                          job_id: null,
                          job_name: null,
                          entity_type: null,
                          entity_id: null,
                          entity_name: null,
                          updated_at: new Date().toISOString(),
                        };
                        setSelectedConversation(supportConv);
                      }
                    }}
                  >
                    <div className="relative">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        Teeem Support
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 font-normal">AI</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {conversations.find(c => c.id === "support")?.last_message?.content || "Ask me anything about Teeem"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Direct Messages Section */}
                <div className="px-2 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Direct Messages
                  </span>
                </div>
                {loadingUsers && conversations.length === 0 ? (
                  <div className="flex items-center justify-center py-6">
                    <Spinner />
                  </div>
                ) : filteredDMItems.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-xs">
                    No matches found
                  </div>
                ) : (
                  filteredDMItems.map((item) => (
                    <SidebarDMEntry
                      key={item.userId}
                      item={item}
                      isSelected={isDMSelected(item)}
                      onClick={() => handleDMClick(item)}
                      onScreenShare={(userId, userName) => {
                        setScreenShareTarget({ id: userId, name: userName });
                        setScreenShareViewerOpen(true);
                      }}
                    />
                  ))
                )}

                {/* Groups Section */}
                {(filteredGroupItems.length > 0 || !searchQuery) && (
                  <>
                    <div className="px-2 py-1.5 mt-3">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Groups
                      </span>
                    </div>
                    {filteredGroupItems.length === 0 ? (
                      <div className="text-center py-3 text-muted-foreground text-xs">
                        {searchQuery ? "No groups match" : "No groups yet"}
                      </div>
                    ) : (
                      filteredGroupItems.map((item) => (
                        <SidebarGroupEntry
                          key={String(item.conversation.id)}
                          item={item}
                          isSelected={isGroupSelected(item)}
                          onClick={() => setSelectedConversation(item.conversation)}
                        />
                      ))
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Screen Share Viewer Modal */}
        {screenShareTarget && (
          <ScreenShareViewer
            targetUserId={screenShareTarget.id}
            targetUserName={screenShareTarget.name}
          />
        )}

        {/* Messages Area */}
        <Card className="col-span-8 flex flex-col min-h-0">
          {selectedConversation ? (
            <>
              {/* Conversation Header */}
              <CardHeader className="py-2 px-3 border-b shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {selectedConversation.type === "support" ? (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                    ) : selectedConversation.type === "group" ? (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                    ) : (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-sm">
                          {selectedConversation.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div>
                      <div className="text-sm font-medium flex items-center gap-2">
                        {selectedConversation.name}
                        {selectedConversation.type === "support" && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 font-normal">AI</Badge>
                        )}
                        {selectedConversation.type === "group" && (
                          <button
                            className="flex items-center gap-1 text-xs text-muted-foreground font-normal hover:text-foreground transition-colors"
                            onClick={() => setShowMembersPanel(prev => !prev)}
                          >
                            {selectedConversation.participants.length} members
                            <ChevronDown className={cn(
                              "h-3 w-3 transition-transform",
                              showMembersPanel && "rotate-180"
                            )} />
                          </button>
                        )}
                        {selectedConversation.job_name && (
                          <Badge variant="outline" className="text-xs py-0">
                            <Briefcase className="h-2.5 w-2.5 mr-1" />
                            {selectedConversation.job_name}
                          </Badge>
                        )}
                      </div>
                      {/* Support: Show AI status */}
                      {selectedConversation.type === "support" && (
                        <div className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          <span className="text-[11px] text-muted-foreground">AI-powered support - always online</span>
                        </div>
                      )}
                      {/* DM: Show online status under name */}
                      {selectedConversation.type === "direct" && (() => {
                        const otherParticipant = selectedConversation.participants.find(p => p.id !== user?.id);
                        const onlineUser = otherParticipant && onlineUsers.find(u => u.id === otherParticipant.id);
                        if (!onlineUser) return null;
                        return (
                          <div className="flex items-center gap-1">
                            <span className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              onlineUser.presence_status === "online" && "bg-green-500",
                              onlineUser.presence_status === "away" && "bg-yellow-500",
                              onlineUser.presence_status === "offline" && "bg-muted-foreground"
                            )} />
                            <span className="text-[11px] text-muted-foreground capitalize">
                              {onlineUser.presence_status}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Screen Share button - only for DM with online users */}
                    {selectedConversation.type === "direct" && (() => {
                      const otherParticipant = selectedConversation.participants.find(p => p.id !== user?.id);
                      const isOnline = otherParticipant && onlineUsers.some(u => u.id === otherParticipant.id && u.is_online);
                      if (!otherParticipant || !isOnline) return null;
                      return (
                        <Button
                          variant="ghost"
                          size="icon"
                          title={`Screen share with ${otherParticipant.name}`}
                          onClick={() => {
                            setScreenShareTarget({ id: otherParticipant.id, name: otherParticipant.name });
                            setScreenShareViewerOpen(true);
                          }}
                        >
                          <Monitor className="h-4 w-4" />
                        </Button>
                      );
                    })()}
                    {/* Toggle members panel for groups */}
                    {selectedConversation.type === "group" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title={showMembersPanel ? "Hide members" : "Show members"}
                        onClick={() => setShowMembersPanel(prev => !prev)}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                    )}
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
                        {selectedConversation.type === "group" && (
                          <DropdownMenuItem onClick={() => setShowMembersPanel(prev => !prev)}>
                            <Users className="h-4 w-4 mr-2" />
                            {showMembersPanel ? "Hide Members" : "Show Members"}
                          </DropdownMenuItem>
                        )}
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
                </div>
                {/* Expandable members panel for group chats */}
                {selectedConversation.type === "group" && showMembersPanel && (
                  <div className="mt-2 pt-2 border-t">
                    <div className="flex flex-wrap gap-2">
                      {selectedConversation.participants.map((p) => {
                        const onlineUser = onlineUsers.find(u => u.id === p.id);
                        const presenceStatus = onlineUser?.presence_status || (p.is_online ? "online" : "offline");
                        const lastSeen = onlineUser?.last_seen_at;
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-2 bg-secondary/50 rounded-lg px-2.5 py-1.5"
                          >
                            <div className="relative">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px]">
                                  {p.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className={cn(
                                "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background",
                                presenceStatus === "online" && "bg-green-500",
                                presenceStatus === "away" && "bg-yellow-500",
                                presenceStatus === "offline" && "bg-muted-foreground"
                              )} />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">
                                {p.id === user?.id ? "You" : p.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {presenceStatus === "online" ? (
                                  <span className="text-green-600 dark:text-green-400">Online</span>
                                ) : lastSeen ? (
                                  `Last seen ${formatTime(lastSeen)}`
                                ) : (
                                  <span className="capitalize">{presenceStatus}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                      {/* Support welcome message when empty */}
                      {messages.length === 0 && selectedConversation?.type === "support" && (
                        <div className="flex justify-start">
                          <div className="flex gap-2 max-w-[70%]">
                            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                              <Sparkles className="h-3.5 w-3.5 text-white" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                                Teeem AI
                                <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3 font-normal">AI</Badge>
                              </div>
                              <div className="rounded-lg px-3 py-2 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50">
                                <p className="text-sm">Hi! I&apos;m your Teeem AI assistant. I can help you with:</p>
                                <ul className="text-sm mt-1.5 space-y-0.5 list-disc list-inside text-muted-foreground">
                                  <li>Finding features and navigating Teeem</li>
                                  <li>How to create jobs, contacts, and documents</li>
                                  <li>Schedule Master and Gantt charts</li>
                                  <li>Email, chat, and integrations</li>
                                </ul>
                                <p className="text-sm mt-1.5">Just type your question below!</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {messages.map((message) => (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          conversation={selectedConversation}
                          onSaveToEntity={(messageId, entityType) => {
                            setSavingMessageId(messageId);
                            setSaveEntityType(entityType);
                            setShowSaveDialog(true);
                          }}
                        />
                      ))}
                      {/* AI thinking indicator */}
                      {aiThinking && selectedConversation?.type === "support" && (
                        <div className="flex justify-start">
                          <div className="flex gap-2 max-w-[70%]">
                            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                              <Sparkles className="h-3.5 w-3.5 text-white" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground mb-1">Teeem AI</div>
                              <div className="rounded-lg px-3 py-2 bg-secondary">
                                <div className="flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
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
                    placeholder={selectedConversation?.type === "support" ? "Ask Teeem AI a question..." : "Type a message or paste a screenshot..."}
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
                    disabled={aiThinking}
                  />
                  <Button size="sm" className="h-8" onClick={handleSend} disabled={aiThinking || (!newMessage.trim() && !pastedImage)}>
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

// ─── Sidebar DM Entry ───
function SidebarDMEntry({
  item,
  isSelected,
  onClick,
  onScreenShare,
}: {
  item: SidebarDMItem;
  isSelected: boolean;
  onClick: () => void;
  onScreenShare: (userId: number, userName: string) => void;
}) {
  const hasConversation = !!item.conversation?.last_message;
  const hasUnread = (item.conversation?.unread_count ?? 0) > 0;

  return (
    <div
      className={cn(
        "group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors mb-0.5",
        isSelected ? "bg-secondary" : hasUnread ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-secondary/50",
        !hasConversation && !hasUnread && "opacity-60"
      )}
      onClick={onClick}
    >
      <div className="relative">
        <Avatar className={cn("h-8 w-8", hasUnread && "ring-2 ring-primary/30")}>
          <AvatarFallback className="text-xs">
            {item.userName.split(" ").map((n) => n[0]).join("").substring(0, 2)}
          </AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background",
            item.presenceStatus === "online" && "bg-green-500",
            item.presenceStatus === "away" && "bg-yellow-500",
            item.presenceStatus === "offline" && "bg-muted-foreground"
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-sm truncate",
            hasUnread ? "font-semibold text-foreground" : "font-medium"
          )}>
            {item.userName}
          </span>
          <div className="flex items-center gap-1">
            {hasUnread && (
              <Badge className="bg-primary text-primary-foreground h-5 min-w-[20px] px-1.5 text-[11px] font-semibold shrink-0">
                {item.conversation!.unread_count}
              </Badge>
            )}
            {item.conversation?.last_message && (
              <span className={cn(
                "text-[10px]",
                hasUnread ? "text-primary font-medium" : "text-muted-foreground"
              )}>
                {formatTime(item.conversation.last_message.created_at)}
              </span>
            )}
          </div>
        </div>
        {hasConversation ? (
          <span className={cn(
            "text-xs truncate block",
            hasUnread ? "text-foreground/80 font-medium" : "text-muted-foreground"
          )}>
            {item.conversation!.last_message!.content}
          </span>
        ) : (
          <div className="text-xs text-muted-foreground">
            {item.presenceStatus === "online" ? (
              <span className="text-green-600 dark:text-green-400">Online</span>
            ) : item.lastSeenAt ? (
              <span>Last seen {formatLastSeen(item.lastSeenAt)}</span>
            ) : (
              <span className="capitalize">{item.presenceStatus}</span>
            )}
          </div>
        )}
      </div>
      {item.isOnline && (
        <button
          className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded hover:bg-primary/10 shrink-0"
          title={`Screen share with ${item.userName}`}
          onClick={(e) => {
            e.stopPropagation();
            onScreenShare(item.userId, item.userName);
          }}
        >
          <Monitor className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Sidebar Group Entry ───
function SidebarGroupEntry({
  item,
  isSelected,
  onClick,
}: {
  item: SidebarGroupItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const conv = item.conversation;
  const hasUnread = conv.unread_count > 0;

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors mb-0.5",
        isSelected ? "bg-secondary" : hasUnread ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-secondary/50"
      )}
      onClick={onClick}
    >
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
        hasUnread ? "bg-primary/20 ring-2 ring-primary/30" : "bg-primary/10"
      )}>
        <Users className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-sm truncate",
            hasUnread ? "font-semibold text-foreground" : "font-medium"
          )}>
            {conv.name}
          </span>
          <div className="flex items-center gap-1">
            {hasUnread && (
              <Badge className="bg-primary text-primary-foreground h-5 min-w-[20px] px-1.5 text-[11px] font-semibold shrink-0">
                {conv.unread_count}
              </Badge>
            )}
            {conv.last_message && (
              <span className={cn(
                "text-[10px]",
                hasUnread ? "text-primary font-medium" : "text-muted-foreground"
              )}>
                {formatTime(conv.last_message.created_at)}
              </span>
            )}
          </div>
        </div>
        <span className={cn(
          "text-xs truncate block",
          hasUnread ? "text-foreground/80 font-medium" : "text-muted-foreground"
        )}>
          {conv.last_message?.content || `${conv.participants.length} members`}
        </span>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  conversation,
  onSaveToEntity,
}: {
  message: ChatMessage;
  conversation?: Conversation | null;
  onSaveToEntity?: (messageId: number, entityType: EntityType) => void;
}) {
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [showReadReceipts, setShowReadReceipts] = useState(false);
  const msgRouter = useRouter();

  // Compute read receipts from conversation participants
  const readReceipts = useMemo(() => {
    if (!conversation?.participants || !message.is_own) return [];
    const msgTime = new Date(message.created_at).getTime();
    return conversation.participants
      .filter((p) => p.id !== message.sender_id)
      .map((p) => {
        const readAt = p.last_read_at ? new Date(p.last_read_at).getTime() : 0;
        return {
          id: p.id,
          name: p.name,
          hasSeen: readAt >= msgTime,
          readAt: p.last_read_at,
        };
      });
  }, [conversation?.participants, message.created_at, message.sender_id, message.is_own]);

  const isAiMessage = conversation?.type === "support" && message.sender_name === "Teeem AI";
  const handleMsgNavigate = useCallback((path: string) => msgRouter.push(path), [msgRouter]);

  return (
    <div className={cn("flex", message.is_own ? "justify-end" : "justify-start")}>
      <div className={cn("flex gap-2 max-w-[70%]", message.is_own && "flex-row-reverse")}>
        {!message.is_own && (
          isAiMessage ? (
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
          ) : (
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="text-xs">
                {message.sender_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
          )
        )}
        <div className="min-w-0 flex-1">
          {!message.is_own && (
            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
              {message.sender_name}
              {isAiMessage && (
                <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3 font-normal">AI</Badge>
              )}
            </div>
          )}
          <div
            className={cn(
              "rounded-lg overflow-hidden group relative break-words",
              message.message_type === "image" ? "p-0" : "px-3 py-2",
              message.is_own
                ? "bg-primary text-primary-foreground"
                : isAiMessage
                  ? "bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50"
                  : "bg-secondary"
            )}
          >
            {message.message_type === "image" ? (
              <div>
                {message.file_url ? (
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
                              await copyToClipboard(message.file_url!);
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
                  <div className="flex items-center gap-2 px-3 py-2">
                    <FileIcon className="h-4 w-4 shrink-0" />
                    <span className="text-sm break-words">{message.file_name}</span>
                    {!message.storage_item_id && (
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
              <p className="text-sm break-words whitespace-pre-wrap">
                {isAiMessage ? renderMessageContent(message.content, handleMsgNavigate) : message.content}
              </p>
            )}
          </div>
          <div
            className={cn(
              "flex items-center gap-2 mt-1 text-xs text-muted-foreground",
              message.is_own && "justify-end"
            )}
          >
            <span>{formatTime(message.created_at)}</span>
            {message.is_own && readReceipts.length > 0 ? (
              <Popover open={showReadReceipts} onOpenChange={setShowReadReceipts}>
                <PopoverTrigger asChild>
                  <button
                    className="inline-flex items-center gap-0.5 hover:opacity-70 transition-opacity"
                    title="Read receipts"
                  >
                    {readReceipts.some((r) => r.hasSeen) ? (
                      <CheckCheck className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    <ChevronDown className={cn(
                      "h-2.5 w-2.5 transition-transform",
                      showReadReceipts && "rotate-180"
                    )} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-56 p-2"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="text-xs font-medium text-muted-foreground mb-1.5 px-1">Read receipts</div>
                  <div className="space-y-1">
                    {readReceipts.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 px-1 py-1 rounded">
                        <div className="relative">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[9px]">
                              {r.name.split(" ").map((n) => n[0]).join("").substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          {r.hasSeen && (
                            <CheckCheck className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-blue-500 bg-background rounded-full" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate">{r.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {r.hasSeen && r.readAt ? (
                              <span className="text-blue-600 dark:text-blue-400">
                                Seen {formatTime(r.readAt)}
                              </span>
                            ) : (
                              <span>Not seen yet</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : message.is_own ? (
              message.read_by.length > 1 ? (
                <CheckCheck className="h-3 w-3 text-blue-500 dark:text-blue-400" />
              ) : (
                <Check className="h-3 w-3" />
              )
            ) : null}
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

function formatLastSeen(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return `today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffDays === 1 || (diffHours < 48 && date.getDate() === now.getDate() - 1)) {
    return `yesterday at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffDays < 7) {
    return `${date.toLocaleDateString([], { weekday: "short" })} at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
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
