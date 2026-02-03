/**
 * Email Types - Single Source of Truth (SSoT)
 *
 * All email-related TypeScript types should be imported from this file.
 * This prevents duplication and ensures consistency across the codebase.
 */

import type { AccountType } from "./email-constants";

// =============================================================================
// CONTACT TYPES
// =============================================================================

/**
 * Individual email address for a contact.
 */
export interface ContactEmail {
  id: number;
  email: string;
  is_primary: boolean;
  label: string | null;
}

/**
 * Basic contact for email recipient selection.
 */
export interface EmailContact {
  id: number;
  display_name: string;
  /** Primary email (convenience field - use contact_emails for full list) */
  email: string | null;
  /** All emails for this contact (when include_emails=true) */
  contact_emails?: ContactEmail[];
  /** Company the contact belongs to (for grouping in autocomplete) */
  primary_company?: {
    id: number;
    name: string;
  };
  /** All jobs linked to this contact (when include_jobs=true) */
  jobs?: Array<{
    id: number;
    name: string;
    job_code: string | null;
    location: string | null;
    role: string | null;
  }>;
  /** True if contact was found via job colleague expansion (shares job with search match) */
  found_via_job?: boolean;
  /** Jobs shared with the original search match (when found_via_job=true) */
  related_jobs?: Array<{
    id: number;
    name: string;
    location: string | null;
  }>;
}

// =============================================================================
// ACCOUNT TYPES
// =============================================================================

/**
 * Email account configuration.
 * Represents IMAP, Outlook, or MS365 email accounts.
 */
export interface EmailAccount {
  id: number | string;
  type: AccountType;
  name: string;
  email_address: string;
  provider: string;
  is_active: boolean;
  is_default?: boolean;
  email_signature?: string | null;
  email_aliases?: string[];
  // FRC (Feb 2026): Cross-tenant sharing fields
  is_shared?: boolean; // True if current user is not the owner
  is_cross_tenant?: boolean; // True if credential owner is in a different tenant
  owner_name?: string; // Name of the credential owner
  owner_tenant_name?: string; // Tenant name of the credential owner
}

// =============================================================================
// DRAFT TYPES
// =============================================================================

/**
 * Email draft stored in localStorage.
 */
export interface EmailDraft {
  id: string;
  credential_id: string;
  from_address?: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  reply_to_message_id?: string;
  /** Attachment names only (can't serialize File objects) */
  attachment_names: string[];
  created_at: string;
  updated_at: string;
}

/**
 * Draft data without metadata (for saving).
 */
export type EmailDraftData = Omit<EmailDraft, "id" | "created_at" | "updated_at">;

// =============================================================================
// SEND TYPES
// =============================================================================

/**
 * Pre-uploaded attachment that already exists in storage.
 * Used for documents that have been downloaded for display but don't need re-uploading.
 * (Ultra fix Jan 2026)
 */
export interface PreUploadedAttachment {
  /** Display name shown in attachment bar */
  filename: string;
  /** Storage key to pass directly to backend (no re-upload needed) */
  storageKey: string;
  /** Optional: file size for display */
  fileSize?: number;
  /** Optional: content type for icon display */
  contentType?: string;
}

/**
 * Parameters for sending an email.
 */
export interface SendEmailParams {
  credential_id: string;
  from_address?: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  reply_to_message_id?: string;
  attachments?: File[];
  sm_task_id?: number;  // Optional: Link sent email to SM task
  // SSoT: Pre-uploaded attachments already in S3 (Ultra fix Jan 2026)
  // Pass with filename and storageKey - avoids re-downloading and re-uploading
  preUploadedAttachments?: PreUploadedAttachment[];
}

/**
 * Queued email waiting to be sent (with undo capability).
 */
export interface QueuedEmail extends Omit<SendEmailParams, "attachments" | "preUploadedAttachments"> {
  id: string;
  attachments: File[];
  // SSoT: Pre-uploaded attachments (pass directly to backend with filenames)
  preUploadedAttachments: PreUploadedAttachment[];
  timeoutId: NodeJS.Timeout;
  countdown: number;
  intervalId: NodeJS.Timeout;
}

/**
 * Parameters for scheduling an email.
 */
export interface ScheduleEmailParams extends Omit<SendEmailParams, "attachments"> {
  scheduled_for: string; // ISO date string
}

// =============================================================================
// COMPOSE FORM TYPES
// =============================================================================

/**
 * Compose email form state.
 */
export interface ComposeEmailFormData {
  credential_id: string;
  from_address: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
}

// =============================================================================
// AUTO-SAVE TYPES
// =============================================================================

/**
 * Configuration for auto-save hook.
 */
export interface AutoSaveConfig {
  /** Whether auto-save is enabled */
  enabled: boolean;
  /** Current form data */
  data: {
    credential_id: string;
    from_address?: string;
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    body: string;
    reply_to_message_id?: string;
    attachment_names?: string[];
  };
  /** Existing draft ID to update */
  existingDraftId?: string;
  /** Callback when draft is saved */
  onSave?: (draftId: string) => void;
}

/**
 * Return type for auto-save hook.
 */
export interface AutoSaveResult {
  draftId: string | undefined;
  save: () => string | undefined;
  discard: () => void;
  isDirty: boolean;
  isSaving: boolean;
  hasContent: boolean;
}

// =============================================================================
// EMAIL STATE TYPES
// =============================================================================

/**
 * Star color options for email starring.
 */
export type StarColor = "yellow" | "blue" | "green" | "red" | "purple" | "orange";

/**
 * Per-user state for an email.
 */
export interface EmailUserState {
  id: number;
  email_warehouse_id: number;
  user_id: number;
  is_pinned: boolean;
  is_starred: boolean;
  star_color: StarColor | null;
  is_archived: boolean;
  is_read: boolean;
  remind_at: string | null;
  reminder_sent: boolean;
  priority: "high" | "normal" | "low";
  notes: string | null;
}

// =============================================================================
// EMAIL WAREHOUSE TYPES
// =============================================================================

/**
 * Email data from the warehouse (list view).
 */
export interface EmailListItem {
  id: number;
  internet_message_id: string;
  subject: string;
  from_email: string;
  from_name: string | null;
  to_emails: string[];
  received_at: string;
  snippet: string;
  body_preview: string;
  has_attachments: boolean;
  attachment_count: number;
  is_read: boolean;
  conversation_id: string | null;
  thread_count?: number;
  // User state (if loaded)
  user_state?: EmailUserState;
}

/**
 * Full email data (detail view).
 */
export interface EmailDetail extends EmailListItem {
  body_html: string | null;
  body_text: string | null;
  cc_emails: string[];
  bcc_emails: string[];
  sent_at: string | null;
  job_id: number | null;
  labels?: EmailLabel[];
}

// =============================================================================
// LABEL TYPES
// =============================================================================

/**
 * Email label for organization.
 */
export interface EmailLabel {
  id: number;
  name: string;
  color: string;
  is_system: boolean;
  position: number;
  email_count: number;
  assigned?: boolean;
}

/**
 * Available label colors.
 */
export interface LabelColor {
  name: string;
  hex: string;
}

// =============================================================================
// TEMPLATE TYPES
// =============================================================================

/**
 * Email template for quick replies and reusable content.
 */
export interface EmailTemplate {
  id: number;
  name: string;
  subject: string;
  body_html: string;
  body_text: string;
  variables: string[];
  category: string;
  category_label: string;
  is_shared: boolean;
  is_favorite: boolean;
  usage_count: number;
  position: number;
  user_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * Template category options.
 */
export interface TemplateCategory {
  value: string;
  label: string;
}

/**
 * System variable available for template substitution.
 */
export interface SystemVariable {
  name: string;
  description: string;
  token: string;
}

// =============================================================================
// SNOOZE TYPES
// =============================================================================

/**
 * Email snooze data.
 */
export interface EmailSnooze {
  id: number;
  email_id: number;
  user_id: number;
  snooze_until: string;
  is_active: boolean;
  reason: string | null;
  woken_at: string | null;
  time_remaining: number;
  time_remaining_in_words: string;
  created_at: string;
}

/**
 * Snooze preset option.
 */
export interface SnoozePreset {
  key: string;
  label: string;
  description: string;
  time: string; // ISO date string
}

// =============================================================================
// REMINDER TYPES
// =============================================================================

/**
 * Reminder state for an email.
 */
export interface ReminderState {
  remind_at: string | null;
  reminder_sent: boolean;
}

// =============================================================================
// FOLDER TYPES
// =============================================================================

/**
 * Email folder for organization.
 */
export interface EmailFolder {
  id: string;
  name: string;
  type: "inbox" | "sent" | "drafts" | "archive" | "trash" | "spam" | "custom";
  parent_id?: string;
  unread_count?: number;
  total_count?: number;
}

// =============================================================================
// VIP TYPES
// =============================================================================

/**
 * VIP sender entry.
 */
export interface VipSender {
  id: number;
  email_address: string;
  display_name: string | null;
  category: "work" | "personal" | "client" | "vendor" | "team" | "other";
  notify_on_email: boolean;
  created_at: string;
}

// =============================================================================
// SPLIT INBOX TYPES
// =============================================================================

/**
 * Split inbox category.
 */
export type SplitInboxCategory = "vip" | "team" | "newsletters" | "other";

/**
 * Category data for split inbox.
 */
export interface CategoryData {
  category: SplitInboxCategory;
  count: number;
  unread_count: number;
  emails: EmailListItem[];
}

/**
 * Full split inbox data.
 */
export interface SplitInboxData {
  vip: CategoryData;
  team: CategoryData;
  newsletters: CategoryData;
  other: CategoryData;
}
