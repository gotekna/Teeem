/**
 * Email Cache Types
 *
 * SSoT for all IndexedDB storage types used in offline-first email architecture.
 */

import type { SplitInboxCategory } from "@/components/emails/SplitInboxTabs";

// =============================================================================
// Cached Email Types
// =============================================================================

/**
 * Email list item with cache metadata.
 * Stored in 'emails' object store (~1KB each).
 * This type is compatible with both API responses and the page's Email type.
 */
export interface CachedEmail {
  id: number;
  subject: string;
  from_email: string;
  from_name: string | null;
  from_address?: string;
  to_emails?: string[];
  to_addresses?: string[];
  received_at: string;
  has_attachments: boolean;
  snippet: string;
  body_preview?: string | null;
  body_html?: string | null;
  body_text?: string | null;
  is_read: boolean;
  is_starred?: boolean;
  is_pinned?: boolean;
  is_archived?: boolean;
  job_id?: number | null;
  job_number?: string | null;
  conversation_id?: string | null;
  thread_count?: number;
  is_latest_in_thread?: boolean;
  source_type?: string;
  imap_credential_id?: number | null;

  // Cache metadata
  _cachedAt: number;        // Timestamp when cached
  _category: SplitInboxCategory;  // Which category this email belongs to
}

/**
 * Email content/body for detail view.
 * Stored in 'emailContent' object store (~50-200KB each).
 */
export interface CachedEmailContent {
  id: number;
  body_html: string | null;
  body_text: string | null;
  attachments: Array<{
    id: number;
    filename: string;
    content_type: string;
    size: number;
  }>;
  _fetchedAt: number;
}

// =============================================================================
// Split Inbox Metadata Types
// =============================================================================

/**
 * Metadata for a split inbox category.
 * Stored in 'splitInboxMeta' object store.
 */
export interface CategoryMeta {
  category: SplitInboxCategory;
  count: number;
  unread_count: number;
  emailIds: number[];       // IDs of emails in this category (ordered by received_at desc)
  lastFetched: number;      // Timestamp of last API fetch
}

// =============================================================================
// Offline Actions Queue Types
// =============================================================================

export type OfflineActionType =
  | "mark_read"
  | "mark_unread"
  | "star"
  | "unstar"
  | "pin"
  | "unpin"
  | "archive"
  | "unarchive";

/**
 * Pending offline action to be synced when back online.
 * Stored in 'offlineActions' object store.
 */
export interface OfflineAction {
  id: string;               // UUID
  action: OfflineActionType;
  emailId: number;
  payload?: Record<string, unknown>;
  createdAt: number;        // Timestamp
  retries: number;          // Number of sync attempts
  lastError?: string;       // Last error message if sync failed
}

// =============================================================================
// Sync Metadata Types
// =============================================================================

export type SyncMetaKey = "lastSync" | "lastFullSync" | "deltaToken";

/**
 * Sync tracking metadata.
 * Stored in 'syncMeta' object store.
 */
export interface SyncMeta {
  key: SyncMetaKey;
  value: string | number;
  updatedAt: number;
}

// =============================================================================
// Database Schema Types (for idb)
// =============================================================================

export interface EmailCacheDBSchema {
  emails: {
    key: number;
    value: CachedEmail;
    indexes: {
      byReceivedAt: number;
      byCategory: SplitInboxCategory;
      byConversationId: string;
    };
  };
  emailContent: {
    key: number;
    value: CachedEmailContent;
  };
  splitInboxMeta: {
    key: SplitInboxCategory;
    value: CategoryMeta;
  };
  offlineActions: {
    key: string;
    value: OfflineAction;
    indexes: {
      byCreatedAt: number;
    };
  };
  syncMeta: {
    key: SyncMetaKey;
    value: SyncMeta;
  };
}

// =============================================================================
// Hook Return Types
// =============================================================================

export interface EmailCacheOperations {
  // Email operations
  getEmails(category?: SplitInboxCategory): Promise<CachedEmail[]>;
  getEmail(id: number): Promise<CachedEmail | null>;
  addEmail(email: CachedEmail): Promise<void>;
  addEmails(emails: CachedEmail[]): Promise<void>;
  updateEmail(id: number, changes: Partial<CachedEmail>): Promise<void>;
  deleteEmail(id: number): Promise<void>;

  // Category operations
  getCategoryMeta(category: SplitInboxCategory): Promise<CategoryMeta | null>;
  setCategoryMeta(meta: CategoryMeta): Promise<void>;

  // Sync operations
  getLastSync(): Promise<number | null>;
  setLastSync(timestamp: number): Promise<void>;

  // Offline actions
  queueAction(action: Omit<OfflineAction, "id" | "createdAt" | "retries">): Promise<string>;
  getPendingActions(): Promise<OfflineAction[]>;
  removeAction(id: string): Promise<void>;

  // Utilities
  clear(): Promise<void>;
}

// =============================================================================
// Configuration Constants
// =============================================================================

export const CACHE_CONFIG = {
  /** How long before data is considered stale (in ms) */
  STALE_THRESHOLD_MS: 2 * 60 * 1000,  // 2 minutes (aggressive, as user requested)

  /** Max emails to store per category */
  MAX_EMAILS_PER_CATEGORY: 500,

  /** Max email content items to cache */
  MAX_EMAIL_CONTENT: 100,

  /** Max offline actions before warning */
  MAX_OFFLINE_ACTIONS: 100,

  /** Database name */
  DB_NAME: "teeem-email-cache",

  /** Database version */
  DB_VERSION: 1,
} as const;
