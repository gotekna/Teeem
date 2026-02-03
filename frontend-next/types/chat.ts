/**
 * UNIFIED CHAT TYPES - SINGLE SOURCE OF TRUTH
 * All chat implementations must use these types
 */

export interface ChatMessage {
  id: number;
  conversation_id: number | string;
  sender_id: number;
  sender_name: string;
  sender_avatar: string | null;
  content: string;
  message_type: "text" | "image" | "file";
  file_url: string | null;
  file_name: string | null;
  // SSoT: storage_item_id is the provider-agnostic column
  // sharepoint_file_id kept for backwards compatibility during migration
  storage_item_id?: string | null;
  sharepoint_file_id?: string | null;
  created_at: string;
  formatted_timestamp?: string;
  read_by: number[];
  is_own: boolean;

  // Entity context (for saving/linking messages)
  saved_to_job?: boolean;
  job_id?: number;
  contact_id?: number;
  case_id?: number;

  user?: {
    id: number;
    name?: string;
    email: string;
  };
}

export interface Participant {
  id: number;
  name: string;
  avatar_url: string | null;
  is_online: boolean;
}

export type ConversationType = "direct" | "group" | "job" | "contact" | "case" | "channel";

export interface Conversation {
  id: number | string;
  type: ConversationType;
  name: string;
  participants: Participant[];
  last_message: ChatMessage | null;
  unread_count: number;
  is_pinned: boolean;
  updated_at: string;

  // Entity context
  entity_type: "job" | "contact" | "case" | null;
  entity_id: number | null;
  entity_name: string | null;

  // Legacy job support (kept for backwards compatibility)
  job_id: number | null;
  job_name: string | null;

  // Channel support
  channel?: string;
}

export interface OnlineUser {
  id: number;
  name: string;
  email: string;
  presence_status: "online" | "away" | "offline";
  is_online: boolean;
  last_seen_at: string | null;
}

export interface Construction {
  id: number;
  title: string;
}

export interface Contact {
  id: number;
  name: string;
}

export interface Case {
  id: number;
  title: string;
}

export type EntityType = "job" | "contact" | "case";

export interface ChatContext {
  // One of these will be set based on context
  channel?: string;
  entityType?: EntityType;
  entityId?: number;
  entityName?: string;
  userId?: number;
  conversationId?: number | string;
}
