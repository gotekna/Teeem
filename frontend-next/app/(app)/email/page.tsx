"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useTransition, useMemo, memo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useLayoutMode } from "@/contexts/LayoutModeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Mail,
  Search,
  RefreshCw,
  Plus,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Send,
  FileText,
  Trash2,
  Archive,
  Star,
  ChevronDown,
  ChevronUp,
  Settings2,
  Keyboard,
  Wifi,
  WifiOff,
  Reply,
  ReplyAll,
  Forward,
  ArrowUpDown,
  FolderPlus,
  MoreVertical,
  CheckCheck,
  ListTodo,
  UserPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { PAGE_SIZE_LIST } from "@/lib/constants/pagination-constants";
import { formatDistanceToNow, format, isToday, differenceInDays } from "date-fns";
import { ComposeEmailModal } from "@/components/emails/ComposeEmailModal";
import { DraftsList } from "@/components/emails/DraftsList";
import {
  SplitInboxTabs,
  ViewModeToggle,
  useSplitInbox,
  type SplitInboxCategory,
} from "@/components/emails/SplitInboxTabs";
import { StaleIndicator } from "@/components/emails/StaleIndicator";
import { KeyboardShortcutsHelp } from "@/components/emails/KeyboardShortcutsHelp";
import { BulkActionBar } from "@/components/emails/BulkActionBar";
import { ThreadCountBadge } from "@/components/emails/ThreadCountBadge";
import { QuickEmailActions } from "@/components/emails/QuickEmailActions";
import { EmailContextMenu } from "@/components/emails/EmailContextMenu";
import { EmailSummary } from "@/components/emails/EmailSummary";
import { useEmailKeyboardShortcuts } from "@/hooks/useEmailKeyboardShortcuts";
import { useEmailSelection } from "@/hooks/useEmailSelection";
import { useEmailBulkActions } from "@/hooks/useEmailBulkActions";
import { useEmailThreads, type ThreadEmail, THREAD_SORT_OPTIONS } from "@/hooks/useEmailThreads";
import {
  EmailDragDropProvider,
  DraggableEmail,
  DroppableFolder,
  useEmailDragDropContext,
} from "@/hooks/useEmailDragDrop";
import { useEmailFilters } from "@/hooks/useEmailFilters";
import { EmailSearchFilters } from "@/components/emails/EmailSearchFilters";
import { useEmailState } from "@/components/emails/EmailActions";
import { useEmailWebSocket } from "@/hooks/useEmailWebSocket";
import { ClassificationBadge, type EmailClassificationType } from "@/components/emails/ClassificationBadge";
import { ReadingPaneToggle, useReadingPanePosition, type ReadingPanePosition } from "@/components/emails/ReadingPaneToggle";
import { CreateFolderDialog } from "@/components/emails/FolderManagementDialog";
import { FolderTree, type FolderTreeItem } from "@/components/ui/folder-tree";
import type { EmailListItem as WebSocketEmail } from "@/lib/email-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { emailCache, isIndexedDBAvailable } from "@/lib/email-cache";
import { useToast } from "@/components/ui/use-toast";
import { api as apiClient } from "@/lib/api";

// Helper to decode HTML entities and clean up email snippets
function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return "";

  let decoded = text;

  // Use a textarea to decode HTML entities safely
  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    decoded = textarea.value;
  } else {
    // Fallback for SSR - decode common entities
    decoded = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/");
  }

  // Strip CSS that leaked into snippets
  // Some emails have CSS in their text/plain or snippet from poor HTML parsing

  // Detect if this looks like CSS (has property:value patterns inside braces)
  // e.g., "} h1 {color:#1b1b1b; font-family:..."
  if (/\{[^}]*[a-z-]+\s*:[^}]*[;}]?/i.test(decoded) || /^[}\s]/.test(decoded)) {
    // Has CSS patterns - strip aggressively

    // Remove everything that looks like CSS
    // Pattern: optional }, then selector, then { properties }
    let prevDecoded = "";
    while (prevDecoded !== decoded && decoded.length > 0) {
      prevDecoded = decoded;

      // Strip leading } or whitespace
      decoded = decoded.replace(/^[}\s]+/, "");

      // Strip complete CSS rules: selector { properties }
      decoded = decoded.replace(/^[^{]*\{[^}]*\}\s*/g, "");
    }

    // If what remains still has { without }, it's truncated CSS - clear it
    if (decoded.includes("{")) {
      decoded = "";
    }
  }

  // Clean up multiple spaces
  decoded = decoded.replace(/\s+/g, " ").trim();

  return decoded;
}

// Smart date formatter for email list:
// - Today: Show time only (e.g., "2:35 PM")
// - Last 7 days: Show day + time (e.g., "Thu 2:35 PM")
// - Older: Show date only (e.g., "09/01/2026")
function formatEmailDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const daysDiff = differenceInDays(now, date);

  if (isToday(date)) {
    // Today: just time
    return format(date, "h:mm a");
  } else if (daysDiff < 7) {
    // Last 7 days: day + time
    return format(date, "EEE h:mm a");
  } else {
    // Older: just date
    return format(date, "dd/MM/yyyy");
  }
}

interface Email {
  id: number;
  subject: string;
  from_address: string;
  from_email: string;
  from_name: string | null;
  to_addresses: string[];
  to_emails: string[];
  cc_emails?: string[];
  received_at: string;
  snippet: string;
  body_preview: string | null;
  body_html: string | null;
  body_text: string | null;
  has_attachments: boolean;
  is_read: boolean;
  source_type: string;
  imap_credential_id: number | null;
  job_id: number | null;
  job_number: string | null;
  attachments?: Array<{
    id: number;
    name: string;
    content_type: string;
    size: number;
  }>;
  // Threading fields
  internet_message_id?: string;
  conversation_id?: string;
  thread_count?: number;
  is_latest_in_thread?: boolean;
  thread?: Email[];
  // AI Summary fields
  ai_summary?: string | null;
  // Contact matching fields
  primary_contact_id?: number | null;
  primary_contact?: {
    id: number;
    display_name: string;
    email?: string;
    phone?: string;
    company_name?: string;
  } | null;
  contacts?: Array<{
    id: number;
    display_name: string;
    email?: string;
    phone?: string;
    company_name?: string;
  }>;
  // Classification fields
  classification_type?: EmailClassificationType;
  classification_confidence?: number;
  // Direction and importance
  direction?: "sent" | "received" | "cc" | "bcc";
  importance?: "high" | "normal" | "low";
}

interface EmailAccount {
  id: number | string;
  type: "outlook" | "imap" | "ms365";
  name: string;
  email_address: string | null;
  provider: string;
  is_active: boolean;
  is_default?: boolean;
  org_credential_id?: number;
  needs_mailbox_config?: boolean;
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

interface EmailFolder {
  id: string;
  name: string;  // Full path for filtering (e.g., "Inbox/Investments")
  display_name?: string;  // Display name from API (snake_case)
  displayName?: string;  // Display name for FolderTree (camelCase)
  type: string;
  unread_count?: number;
  total_items?: number;
  depth?: number;
  parent_id?: string;
}

// Memoized email list item for performance
const EmailListItem = memo(function EmailListItem({
  email,
  isSelected,
  isChecked,
  hasSelections,
  onClick,
  onCheckboxChange,
  onQuickAction,
  onSnooze,
  onReply,
  onReplyAll,
  onForward,
  // Thread props
  threadCount = 0,
  isExpanded = false,
  onToggleThread,
  threadEmails = [],
  isLoadingThread = false,
  // Drag-drop props
  accountId,
  accountType = "outlook",
  sourceFolder,
  enableDrag = false,
}: {
  email: Email;
  isSelected: boolean;
  isChecked: boolean;
  hasSelections: boolean;
  onClick: (email: Email, event: React.MouseEvent) => void;
  onCheckboxChange: (email: Email) => void;
  onQuickAction?: () => void;
  onSnooze?: (email: Email) => void;
  onReply?: (email: Email) => void;
  onReplyAll?: (email: Email) => void;
  onForward?: (email: Email) => void;
  // Thread props
  threadCount?: number;
  isExpanded?: boolean;
  onToggleThread?: (email: Email) => void;
  threadEmails?: ThreadEmail[];
  isLoadingThread?: boolean;
  // Drag-drop props
  accountId?: string;
  accountType?: "imap" | "outlook" | "ms365";
  sourceFolder?: string;
  enableDrag?: boolean;
}) {
  const hasThread = threadCount > 1;

  const content = (
    <EmailContextMenu
      emailId={email.id}
      isRead={email.is_read}
      fromEmail={email.from_email || email.from_address}
      fromName={email.from_name || undefined}
      subject={email.subject}
      onReply={() => onReply?.(email)}
      onReplyAll={() => onReplyAll?.(email)}
      onForward={() => onForward?.(email)}
      onSnooze={() => onSnooze?.(email)}
      onAction={onQuickAction}
    >
    <div data-email-id={email.id}>
      {/* Main email row */}
      <div
        className={cn(
          "group px-0.5 py-1.5 cursor-pointer border-l-2",
          isSelected
            ? "bg-primary/10 border-l-primary"
            : isChecked
            ? "bg-primary/5 border-l-primary/50"
            : "hover:bg-muted/50 border-l-transparent",
          !email.is_read && !isSelected && !isChecked && "bg-blue-50/50 dark:bg-blue-950/20"
        )}
        onClick={(e) => onClick(email, e)}
      >
        <div className="flex items-start gap-0.5">
          {/* Thread expand/collapse chevron OR checkbox */}
          <div className="shrink-0 pt-0.5 w-3.5 flex items-center justify-center">
            {hasThread && !hasSelections ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleThread?.(email);
                }}
                className="p-0 hover:bg-muted rounded"
              >
                {isLoadingThread ? (
                  <div className="h-3.5 w-3.5 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                ) : isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            ) : (
              <div
                className={cn(
                  hasSelections ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  "transition-opacity"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onCheckboxChange(email);
                }}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={() => onCheckboxChange(email)}
                  className="h-4 w-4"
                />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 flex items-start gap-0.5">
            {/* Unread indicator dot */}
            {!email.is_read && (
              <div className="shrink-0 pt-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={cn(
                  "text-sm truncate flex-1 min-w-0",
                  !email.is_read ? "font-bold text-foreground" : "font-normal text-muted-foreground"
                )}>
                  {email.from_name || email.from_email || email.from_address}
                </span>
                {email.has_attachments && (
                  <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                {/* Classification badge */}
                <ClassificationBadge
                  classificationType={email.classification_type}
                  confidence={email.classification_confidence}
                  compact
                />
                {/* Thread count badge */}
                <ThreadCountBadge count={threadCount} isExpanded={isExpanded} />
                {/* Timestamp - inline with sender */}
                <span className={cn(
                  "text-xs whitespace-nowrap shrink-0 group-hover:hidden",
                  !email.is_read ? "font-medium text-muted-foreground" : "text-muted-foreground"
                )}>
                  {formatEmailDate(email.received_at)}
                </span>
              </div>
              <p className={cn(
                "text-sm truncate",
                !email.is_read ? "font-bold text-foreground" : "font-normal text-muted-foreground"
              )}>
                {email.subject || "(No subject)"}
              </p>
              <p className={cn(
                "text-xs truncate mt-0.5",
                !email.is_read ? "font-semibold text-muted-foreground" : "font-normal text-muted-foreground/70"
              )}>
                {decodeHtmlEntities(email.snippet || email.body_preview)}
              </p>
            </div>
            {/* Quick actions on hover */}
            <QuickEmailActions
              emailId={email.id}
              isRead={email.is_read}
              onAction={onQuickAction}
              onSnooze={() => onSnooze?.(email)}
              onReply={() => onReply?.(email)}
              onForward={() => onForward?.(email)}
              className="shrink-0"
            />
          </div>
        </div>
      </div>

      {/* Expanded thread emails */}
      {isExpanded && threadEmails.length > 0 && (
        <div className="border-l-2 border-l-muted ml-3">
          {threadEmails
            .filter((te) => te.id !== email.id) // Don't show the main email again
            .map((threadEmail) => (
              <div
                key={threadEmail.id}
                data-email-id={threadEmail.id}
                className={cn(
                  "px-3 py-2 cursor-pointer hover:bg-muted/30 border-b border-border/50",
                  !threadEmail.is_read && "bg-blue-50/30 dark:bg-blue-950/10"
                )}
                onClick={(e) => onClick(threadEmail as Email, e)}
              >
                <div className="flex items-start gap-2 pl-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-xs truncate",
                        !threadEmail.is_read ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                      )}>
                        {threadEmail.from_name || threadEmail.from_email || threadEmail.from_address}
                      </span>
                      {threadEmail.has_attachments && (
                        <Paperclip className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    <p className={cn(
                      "text-xs truncate",
                      !threadEmail.is_read ? "font-semibold text-muted-foreground" : "text-muted-foreground/70"
                    )}>
                      {decodeHtmlEntities(threadEmail.snippet || threadEmail.body_preview)}
                    </p>
                  </div>
                  <div className={cn(
                    "text-xs whitespace-nowrap shrink-0",
                    !threadEmail.is_read ? "font-medium text-muted-foreground" : "text-muted-foreground"
                  )}>
                    {formatEmailDate(threadEmail.received_at)}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
    </EmailContextMenu>
  );

  // Wrap with DraggableEmail if drag is enabled and we have account info
  if (enableDrag && accountId) {
    return (
      <DraggableEmail
        email={email}
        accountId={accountId}
        accountType={accountType}
        sourceFolder={sourceFolder}
      >
        {content}
      </DraggableEmail>
    );
  }

  return content;
});

export default function EmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const accountParam = searchParams.get("account");
  const emailIdParam = searchParams.get("id");
  const standaloneParam = searchParams.get("standalone");
  const isStandalone = standaloneParam === "true";

  // Fullscreen mode for standalone email tab (hides sidebar)
  const { setMode } = useLayoutMode();
  useEffect(() => {
    if (isStandalone) {
      setMode("fullscreen");
      return () => setMode("padded");
    }
  }, [isStandalone, setMode]);

  const [emails, setEmails] = useState<Email[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [accountFolders, setAccountFolders] = useState<Record<string, EmailFolder[]>>({});
  const [folderOrder, setFolderOrder] = useState<Record<string, string[]>>({});
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingContact, setCreatingContact] = useState(false);
  // SSoT: Uses PAGE_SIZE_LIST from pagination-constants.ts
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    per_page: PAGE_SIZE_LIST,
    total: 0,
    total_pages: 0,
  });

  // Search filters
  const emailFilters = useEmailFilters();

  // Load cached state from localStorage for instant loading
  const getCachedEmailState = () => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('teeem_email_state');
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  };
  const cachedState = getCachedEmailState();

  // "all" = combined view from all accounts, "" = select mailbox, otherwise = specific account id
  const [selectedAccount, setSelectedAccount] = useState<string>(cachedState?.accountId || "all");
  const [selectedFolder, setSelectedFolder] = useState<string>(cachedState?.folderName || "Inbox");
  const [selectedFolderId, setSelectedFolderId] = useState<string>(cachedState?.folderId || "ALL_INBOX");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(
    cachedState?.accountId ? new Set([cachedState.accountId]) : new Set()
  );
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [popoutEmail, setPopoutEmail] = useState<Email | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<import("@/lib/email-types").EmailDraft | null>(null);
  const [replyTo, setReplyTo] = useState<{ to: string; cc?: string; subject: string; body?: string; messageId?: string; fromAccountId?: string; replyToMessageId?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Split Inbox State - default to folders (Inbox) for faster loading
  const [viewMode, setViewMode] = useState<"split" | "folders">(cachedState?.viewMode || "folders");
  // Only fetch split inbox data when in split view mode (performance optimization)
  const splitInbox = useSplitInbox({ accountId: selectedAccount, enabled: viewMode === "split" });

  // Keyboard Shortcuts
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const { toast } = useToast();
  const emailState = useEmailState(selectedEmail?.id);

  // Multi-select state
  const selection = useEmailSelection();
  const [lastClickedEmailId, setLastClickedEmailId] = useState<number | null>(null);

  // Thread expansion state
  const threads = useEmailThreads();

  // Reading pane position
  const { position: readingPanePosition, setPosition: setReadingPanePosition } = useReadingPanePosition();

  // WebSocket for real-time email updates
  const handleNewEmail = useCallback(async (email: WebSocketEmail) => {
    // Update cache if available
    if (isIndexedDBAvailable()) {
      try {
        // Determine category based on email properties (simplified - backend will have proper categorization)
        const category = "other" as const; // Default to other, refresh will re-categorize
        await emailCache.putEmail({
          ...email,
          _cachedAt: Date.now(),
          _category: category,
        });
      } catch (err) {
        console.error("[Email] Failed to cache new email:", err);
      }
    }

    // Add new email to the top of the list
    if (viewMode === "split") {
      // Refresh split inbox to re-categorize the email
      splitInbox.refresh();
    } else {
      // Add to folder view
      setEmails(prev => [email as unknown as Email, ...prev]);
      setPagination(prev => ({ ...prev, total: prev.total + 1 }));
    }

    // Show notification
    toast({
      title: "New email",
      description: `From: ${email.from_name || email.from_email}`,
    });
  }, [viewMode, splitInbox, toast]);

  const handleNewEmails = useCallback(async (emails: WebSocketEmail[], count: number) => {
    // Update cache if available
    if (isIndexedDBAvailable()) {
      try {
        const cachedEmails = emails.map(email => ({
          ...email,
          _cachedAt: Date.now(),
          _category: "other" as const, // Default to other, refresh will re-categorize
        }));
        await emailCache.putEmails(cachedEmails);
      } catch (err) {
        console.error("[Email] Failed to cache new emails:", err);
      }
    }

    if (viewMode === "split") {
      splitInbox.refresh();
    } else {
      setEmails(prev => [...emails as unknown as Email[], ...prev]);
      setPagination(prev => ({ ...prev, total: prev.total + count }));
    }

    toast({
      title: `${count} new email${count > 1 ? 's' : ''}`,
      description: "Your inbox has been updated",
    });
  }, [viewMode, splitInbox, toast]);

  const handleStateChange = useCallback(async (emailId: number, changes: Record<string, unknown>) => {
    // Update cache if available
    if (isIndexedDBAvailable()) {
      try {
        await emailCache.updateEmail(emailId, changes);
      } catch (err) {
        console.error("[Email] Failed to update cached email:", err);
      }
    }

    // Update email in list
    setEmails(prev => prev.map(e =>
      e.id === emailId
        ? { ...e, ...changes, is_read: changes.is_read !== undefined ? changes.is_read as boolean : e.is_read }
        : e
    ));

    // Update in split inbox
    if (viewMode === "split") {
      // Force refresh to update categorization if needed
      if ('is_archived' in changes || 'is_starred' in changes) {
        splitInbox.refresh();
      }
    }

    // Update selected email if it's the one that changed
    if (selectedEmail?.id === emailId) {
      setSelectedEmail(prev => prev ? { ...prev, ...changes } : null);
    }
  }, [viewMode, splitInbox, selectedEmail]);

  const handleEmailDeleted = useCallback(async (emailId: number) => {
    // Update cache if available
    if (isIndexedDBAvailable()) {
      try {
        await emailCache.deleteEmail(emailId);
      } catch (err) {
        console.error("[Email] Failed to delete cached email:", err);
      }
    }

    setEmails(prev => prev.filter(e => e.id !== emailId));
    setPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));

    if (viewMode === "split") {
      splitInbox.refresh();
    }

    // Clear selection if deleted email was selected
    if (selectedEmail?.id === emailId) {
      setSelectedEmail(null);
    }
  }, [viewMode, splitInbox, selectedEmail]);

  const handleSyncStarted = useCallback((syncType: "incremental" | "full") => {
    setSyncing(true);
  }, []);

  const handleSyncCompleted = useCallback((stats: { new_count: number; updated_count: number; duration_seconds: number }) => {
    setSyncing(false);
    if (stats.new_count > 0) {
      toast({
        title: "Sync complete",
        description: `${stats.new_count} new email${stats.new_count > 1 ? 's' : ''} synced`,
      });
    }
  }, [toast]);

  const { isConnected, isSyncing: wsIsSyncing, newEmailCount } = useEmailWebSocket({
    onNewEmail: handleNewEmail,
    onNewEmails: handleNewEmails,
    onStateChange: handleStateChange,
    onEmailDeleted: handleEmailDeleted,
    onSyncStarted: handleSyncStarted,
    onSyncCompleted: handleSyncCompleted,
    enabled: true,
  });

  // Get current email list based on view mode
  const currentEmails = useMemo(() => {
    return viewMode === "split" ? (splitInbox.currentEmails as Email[]) : emails;
  }, [viewMode, splitInbox.currentEmails, emails]);

  // Handle thread toggle
  const handleToggleThread = useCallback(async (email: Email) => {
    if (!email.conversation_id) return;

    const isCurrentlyExpanded = threads.isExpanded(email.conversation_id);
    threads.toggleThread(email.conversation_id);

    // Fetch thread if expanding and not cached
    if (!isCurrentlyExpanded && !threads.getThread(email.conversation_id)) {
      await threads.fetchThread(email.id);
    }
  }, [threads]);

  // Bulk actions - refresh list and clear selection on success
  const handleBulkSuccess = useCallback(() => {
    selection.clear();
    // Refresh based on current view mode
    if (viewMode === "split") {
      splitInbox.refresh();
    }
    // Folder view refresh will happen through the normal fetchEmails flow
  }, [selection, viewMode, splitInbox]);

  const bulkActions = useEmailBulkActions({
    selectedIds: selection.selectedIds,
    onSuccess: handleBulkSuccess,
  });

  // Keyboard shortcut handlers
  const handleKeyboardArchive = useCallback(async () => {
    if (!selectedEmail) return;
    await emailState.toggleArchive();
    toast({ title: "Email archived" });
  }, [selectedEmail, emailState, toast]);

  const handleKeyboardStar = useCallback(async () => {
    if (!selectedEmail) return;
    await emailState.toggleStar();
    toast({ title: emailState.state?.is_starred ? "Star removed" : "Email starred" });
  }, [selectedEmail, emailState, toast]);

  const handleKeyboardPin = useCallback(async () => {
    if (!selectedEmail) return;
    await emailState.togglePin();
    toast({ title: emailState.state?.is_pinned ? "Pin removed" : "Email pinned" });
  }, [selectedEmail, emailState, toast]);

  const handleKeyboardVip = useCallback(async () => {
    if (!selectedEmail) return;
    try {
      await api.post("/api/v1/vip_senders/toggle", {
        email_address: selectedEmail.from_email || selectedEmail.from_address,
      });
      toast({ title: "VIP status toggled" });
    } catch {
      toast({ title: "Failed to toggle VIP", variant: "destructive" });
    }
  }, [selectedEmail, toast]);

  const handleKeyboardReply = useCallback(() => {
    if (selectedEmail) {
      handleReply(selectedEmail);
    }
  }, [selectedEmail]);

  const handleKeyboardForward = useCallback(() => {
    if (selectedEmail) {
      handleForward(selectedEmail);
    }
  }, [selectedEmail]);

  const handleKeyboardCompose = useCallback(() => {
    setReplyTo(null);
    setComposeOpen(true);
  }, []);

  // Initialize keyboard shortcuts
  useEmailKeyboardShortcuts({
    emails: currentEmails,
    selectedEmail,
    onSelectEmail: (email) => {
      if (email) {
        handleEmailClick(email);
      } else {
        setSelectedEmail(null);
      }
    },
    onArchive: handleKeyboardArchive,
    onStar: handleKeyboardStar,
    onPin: handleKeyboardPin,
    onVip: handleKeyboardVip,
    onReply: handleKeyboardReply,
    onForward: handleKeyboardForward,
    onCompose: handleKeyboardCompose,
    onShowHelp: () => setShowShortcutsHelp(true),
    // Bulk selection shortcuts
    onToggleSelection: (email) => selection.toggle(email.id),
    onSelectAll: () => selection.selectAll(currentEmails),
    onClearSelection: selection.clear,
    hasSelection: selection.hasSelection,
    enabled: !composeOpen && !showShortcutsHelp,
  });

  // Extract stable function reference to prevent infinite loops
  const toURLParams = emailFilters.toURLParams;

  const fetchEmails = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      // Start with filters from hook
      const params = toURLParams();
      params.set("page", String(page));
      params.set("per_page", "50");
      params.set("my_emails", "true");

      // Filter by specific account (skip filtering if "all" for combined view)
      if (selectedAccount && selectedAccount !== "all") {
        if (selectedAccount === "outlook") {
          params.append("source_type", "outlook");
        } else if (selectedAccount.startsWith("ms365_")) {
          // MS365 org accounts: extract microsoft_credential_id from "ms365_X_hash" format
          const parts = selectedAccount.split("_");
          params.append("microsoft_credential_id", parts[1]);
        } else {
          params.append("imap_credential_id", selectedAccount);
        }
      }

      // Filter by folder name (warehouse stores human-readable names like "Inbox", not MS365 IDs)
      // For "All Inbox", just filter by Inbox folder name across all accounts
      if (selectedFolder) {
        params.append("folder_name", selectedFolder);
      }

      const url = `/api/v1/email_warehouse?${params.toString()}`;
      const response = await api.get<{ emails: Email[]; pagination: Pagination }>(url);

      setEmails(response.emails || []);
      setPagination(response.pagination);
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setLoading(false);
    }
  }, [toURLParams, selectedAccount, selectedFolder]);

  const fetchFolders = async (accountId: string, account?: EmailAccount, forceSelectInbox = false) => {
    if (accountFolders[accountId] || loadingFolders.has(accountId)) {
      return; // Already loaded or loading
    }

    // Find account if not provided
    const acct = account || accounts.find(a => String(a.id) === accountId);

    // Skip if account needs mailbox configuration
    if (acct?.needs_mailbox_config) {
      return;
    }

    setLoadingFolders(prev => new Set(prev).add(accountId));

    // Build URL with mailbox_email for ms365 accounts
    let foldersUrl = `/api/v1/imap_credentials/folders?account_id=${accountId}`;
    if (acct?.type === "ms365" && acct?.email_address) {
      foldersUrl += `&mailbox_email=${encodeURIComponent(acct.email_address)}`;
    }

    // Fetch folders and folder_order in PARALLEL for speed
    const [foldersResult, orderResult] = await Promise.allSettled([
      api.get<{ success: boolean; data: EmailFolder[] }>(foldersUrl),
      api.get<{ success: boolean; data: { folder_ids: string[] } }>(
        `/api/v1/imap_credentials/folder_order?account_id=${accountId}`
      ),
    ]);

    // Process folders result
    if (foldersResult.status === "fulfilled" && foldersResult.value.success && foldersResult.value.data) {
      const folders = foldersResult.value.data.map(f => ({
        ...f,
        displayName: f.display_name || f.name,
      }));
      setAccountFolders(prev => ({
        ...prev,
        [accountId]: folders
      }));

      // Auto-select inbox folder when:
      // - forceSelectInbox is true (user just clicked this mailbox), OR
      // - The folder ID doesn't match any folder in this account
      const inboxFolder = foldersResult.value.data.find(f => f.type === "inbox");
      const currentFolderExists = foldersResult.value.data.some(f => f.id === selectedFolderId);

      if (inboxFolder && (forceSelectInbox || !currentFolderExists)) {
        setSelectedFolder(inboxFolder.name);
        setSelectedFolderId(inboxFolder.id);
      }
    } else {
      // Set empty array to prevent retry loops
      setAccountFolders(prev => ({
        ...prev,
        [accountId]: []
      }));
    }

    // Process folder order result
    if (orderResult.status === "fulfilled" && orderResult.value.success && orderResult.value.data?.folder_ids?.length > 0) {
      setFolderOrder(prev => ({
        ...prev,
        [accountId]: orderResult.value.data.folder_ids
      }));
    }

    setLoadingFolders(prev => {
      const next = new Set(prev);
      next.delete(accountId);
      return next;
    });
  };

  // Save folder order to backend (called when user drags to reorder)
  const saveFolderOrder = useCallback(async (accountId: string, folderIds: string[]) => {
    // Update local state immediately for optimistic UI
    setFolderOrder(prev => ({
      ...prev,
      [accountId]: folderIds
    }));

    // Save to backend
    try {
      await api.post("/api/v1/imap_credentials/save_folder_order", {
        account_id: accountId,
        folder_ids: folderIds
      });
    } catch (error) {
      console.error("Failed to save folder order:", error);
      // Revert on error? For now just log - user can try again
    }
  }, []);

  // Track if initial account load is complete (to handle cache vs URL param)
  const [accountsLoaded, setAccountsLoaded] = useState(false);

  const fetchAccounts = async () => {
    try {
      const response = await api.get<{ success: boolean; data: EmailAccount[] }>(
        "/api/v1/imap_credentials/all_accounts"
      );
      const activeAccounts = (response.data || []).filter(a => a.is_active);
      setAccounts(activeAccounts);

      // Determine which account to show based on URL param
      let targetAccountId = "all";

      if (activeAccounts.length > 0) {
        if (accountParam) {
          // Find account matching URL param
          const accountToSelect = activeAccounts.find(a => String(a.id) === accountParam);
          if (accountToSelect) {
            targetAccountId = String(accountToSelect.id);
            // Reset folder to Inbox when loading specific account from URL
            setSelectedFolder("Inbox");
            setSelectedFolderId("");
            setExpandedAccounts(new Set([targetAccountId]));
            // Fetch folders for selected account (pass account for ms365 type)
            fetchFolders(targetAccountId, accountToSelect, true);
          }
        }
      }

      // Always set the account and mark as loaded
      // This triggers fetchEmails via the useEffect below
      setSelectedAccount(targetAccountId);
      setAccountsLoaded(true);
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
      setAccountsLoaded(true); // Mark loaded even on error to prevent infinite loops
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Handle URL account param changes (e.g., clicking different mailbox in nav)
  useEffect(() => {
    if (accountParam && accounts.length > 0) {
      const matchingAccount = accounts.find(a => String(a.id) === accountParam);
      if (matchingAccount && String(matchingAccount.id) !== selectedAccount) {
        const accountId = String(matchingAccount.id);
        setSelectedAccount(accountId);
        // Immediately set folder to Inbox when switching accounts via URL
        setSelectedFolder("Inbox");
        setSelectedFolderId("");
        setExpandedAccounts(new Set([accountId]));
        fetchFolders(accountId, matchingAccount, true);
      }
    } else if (!accountParam && accounts.length > 0 && selectedAccount !== "all") {
      // No account param but we have a specific account selected - switch to All Inbox
      setSelectedAccount("all");
    }
  }, [accountParam, accounts]);

  useEffect(() => {
    // Fetch emails when account changes OR when accounts finish loading
    if (accountsLoaded) {
      fetchEmails();
    }
  }, [selectedAccount, fetchEmails, accountsLoaded]);

  // Cache email state for instant loading on next visit
  useEffect(() => {
    if (selectedAccount && selectedFolderId) {
      try {
        localStorage.setItem('teeem_email_state', JSON.stringify({
          accountId: selectedAccount,
          folderName: selectedFolder,
          folderId: selectedFolderId,
          viewMode,
        }));
      } catch { /* ignore storage errors */ }
    }
  }, [selectedAccount, selectedFolder, selectedFolderId, viewMode]);

  // Load specific email when id param is provided (e.g., from task attachment link)
  useEffect(() => {
    if (emailIdParam) {
      const loadEmailById = async () => {
        try {
          setLoading(true);
          const response = await api.get<Email>(`/api/v1/email_warehouse/${emailIdParam}`);
          if (response) {
            setSelectedEmail(response);
            // Clear loading - we have the email to show
            setLoading(false);
          }
        } catch (error) {
          console.error("Failed to load email by ID:", error);
          setLoading(false);
        }
      };
      loadEmailById();
    }
  }, [emailIdParam]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const syncPromises = [];

      // Sync Outlook if selected
      if (selectedAccount === "outlook") {
        syncPromises.push(api.post("/api/v1/email_warehouse/sync").catch(() => {}));
      } else {
        // Sync IMAP account
        syncPromises.push(
          api.post(`/api/v1/imap_credentials/${selectedAccount}/sync`).catch(() => {})
        );
      }

      await Promise.all(syncPromises);
      setTimeout(() => {
        fetchEmails();
        setSyncing(false);
      }, 3000);
    } catch (error) {
      console.error("Failed to sync:", error);
      setSyncing(false);
    }
  };

  // Sync ALL accounts (for Split Inbox mode)
  const handleSplitSync = async () => {
    setSyncing(true);
    try {
      const syncPromises: Promise<unknown>[] = [];

      // Always trigger the main sync endpoint (handles all IMAP accounts)
      syncPromises.push(api.post("/api/v1/imap_credentials/sync_all").catch(() => {}));

      // Also sync Outlook if accounts are loaded
      if (accounts.some(a => a.type === "outlook")) {
        syncPromises.push(api.post("/api/v1/email_warehouse/sync").catch(() => {}));
      }

      await Promise.all(syncPromises);

      // Wait for sync to complete, then refresh
      setTimeout(() => {
        splitInbox.refresh();
        setSyncing(false);
      }, 3000);
    } catch (error) {
      console.error("Failed to sync:", error);
      setSyncing(false);
    }
  };

  // Mark all emails in current folder as read
  const handleMarkFolderRead = async () => {
    if (!selectedAccount || selectedAccount === "all") {
      toast({ title: "Select a mailbox first", variant: "destructive" });
      return;
    }

    const account = accounts.find(a => String(a.id) === selectedAccount);
    if (!account?.email_address) {
      toast({ title: "Mailbox email not found", variant: "destructive" });
      return;
    }

    try {
      const response = await api.post<{ success: boolean; data: { affected_count: number }; message: string }>(
        "/api/v1/email_user_states/mark_folder_read",
        {
          mailbox_email: account.email_address,
          folder_name: selectedFolder,
        }
      );

      if (response?.success) {
        toast({ title: response.message || "Folder marked as read" });
        // Refresh emails to show updated read status
        fetchEmails();
      }
    } catch (error) {
      console.error("Failed to mark folder as read:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to mark folder as read";
      toast({ title: errorMessage, variant: "destructive" });
    }
  };

  const handleEmailClick = useCallback(async (email: Email, openPopout = false) => {
    if (!email || !email.id) {
      console.error("Invalid email object:", email);
      return;
    }

    // Set selected email immediately so UI updates
    if (openPopout) {
      setPopoutEmail(email);
    } else {
      setSelectedEmail(email);
    }

    // Mark as read if unread
    if (!email.is_read) {
      try {
        await apiClient.post(`/api/v1/email_user_states/for_email/${email.id}/toggle_read`);
        // Update email in list to show as read
        setEmails(prev => prev.map(e =>
          e.id === email.id ? { ...e, is_read: true } : e
        ));
        // Update the email object itself
        email.is_read = true;
        if (openPopout) {
          setPopoutEmail({ ...email, is_read: true });
        } else {
          setSelectedEmail({ ...email, is_read: true });
        }
      } catch (error) {
        console.error("Failed to mark email as read:", error);
      }
    }

    // Fetch full email content if not loaded
    if (!email.body_html && !email.body_text) {
      try {
        const response = await api.get<Email | { email: Email }>(`/api/v1/email_warehouse/${email.id}`);
        // Handle both wrapped and unwrapped response formats
        const fullEmail = (response as { email?: Email }).email || response as Email;
        if (fullEmail && fullEmail.id) {
          // Keep is_read as true since we just marked it
          fullEmail.is_read = true;
          if (openPopout) {
            setPopoutEmail(fullEmail);
          } else {
            setSelectedEmail(fullEmail);
          }
        }
      } catch (error) {
        console.error("Failed to fetch email:", error);
        // Keep showing the preview data even if full fetch fails
      }
    }
  }, []);

  // Handle email row click with shift+click support for range selection
  const handleEmailRowClick = useCallback((email: Email, event: React.MouseEvent) => {
    // Shift+click for range selection
    if (event.shiftKey && lastClickedEmailId !== null) {
      selection.selectRange(lastClickedEmailId, email.id, currentEmails);
      setLastClickedEmailId(email.id);
      return;
    }

    // Double-click to open in pop-out
    if (event.detail === 2) {
      setLastClickedEmailId(email.id);
      handleEmailClick(email, true);
      return;
    }

    // Normal click - open email in reading pane
    setLastClickedEmailId(email.id);
    handleEmailClick(email, false);
  }, [lastClickedEmailId, selection, currentEmails, handleEmailClick]);

  // Handle checkbox change for multi-select
  const handleCheckboxChange = useCallback((email: Email) => {
    selection.toggle(email.id);
    setLastClickedEmailId(email.id);
  }, [selection]);

  const handleReply = (email: Email) => {
    // Build quoted original message as HTML to preserve formatting
    const originalBody = email.body_html || email.body_text || "";
    // Start with empty paragraph for typing, then quoted content below
    const quotedBody = `<p></p>
<div style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 5px; color: #555;">
<p style="margin: 0 0 8px 0;"><strong>--- Original Message ---</strong><br>
<strong>From:</strong> ${email.from_email || email.from_address}<br>
<strong>Date:</strong> ${email.received_at ? format(new Date(email.received_at), "PPpp") : "Unknown"}<br>
<strong>Subject:</strong> ${email.subject || ""}</p>
${originalBody}
</div>`;

    setReplyTo({
      to: email.from_email || email.from_address,
      subject: email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
      body: quotedBody,
      fromAccountId: selectedAccount, // Reply from the same account that received the email
      replyToMessageId: email.internet_message_id, // For email threading
    });
    setComposeOpen(true);
  };

  const handleReplyAll = (email: Email) => {
    // Get the current user's email from the selected account
    const currentAccount = accounts.find(a => String(a.id) === selectedAccount);
    const currentUserEmail = currentAccount?.email_address?.toLowerCase();

    // Reply to sender
    const to = email.from_email || email.from_address;

    // CC includes original To recipients (minus current user) + original CC
    const originalTo = (email.to_emails || email.to_addresses || [])
      .filter(e => e.toLowerCase() !== currentUserEmail);
    const originalCc = (email.cc_emails || [])
      .filter((e: string) => e.toLowerCase() !== currentUserEmail);
    const ccRecipients = [...new Set([...originalTo, ...originalCc])]; // Dedupe

    // Build quoted original message as HTML to preserve formatting
    const originalBody = email.body_html || email.body_text || "";
    // Start with empty paragraph for typing, then quoted content below
    const quotedBody = `<p></p>
<div style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 5px; color: #555;">
<p style="margin: 0 0 8px 0;"><strong>--- Original Message ---</strong><br>
<strong>From:</strong> ${email.from_email || email.from_address}<br>
<strong>Date:</strong> ${email.received_at ? format(new Date(email.received_at), "PPpp") : "Unknown"}<br>
<strong>Subject:</strong> ${email.subject || ""}</p>
${originalBody}
</div>`;

    setReplyTo({
      to,
      cc: ccRecipients.join(", "),
      subject: email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
      body: quotedBody,
      fromAccountId: selectedAccount,
      replyToMessageId: email.internet_message_id, // For email threading
    });
    setComposeOpen(true);
  };

  const handleCompose = () => {
    setReplyTo(null);
    setComposeOpen(true);
  };

  const handleForward = (email: Email) => {
    // Build forwarded message header
    const forwardHeader = `---------- Forwarded message ----------
From: ${email.from_email || email.from_address}
Date: ${email.received_at ? format(new Date(email.received_at), "PPpp") : "Unknown"}
Subject: ${email.subject}
To: ${email.to_emails?.join(", ") || ""}

`;
    // Use body_text for plain text forwarding (html will be stripped)
    const originalBody = email.body_text || email.body_html || "";

    setReplyTo({
      to: "", // Forward to new recipient
      subject: email.subject?.startsWith("Fwd:") ? email.subject : `Fwd: ${email.subject}`,
      body: forwardHeader + originalBody,
      fromAccountId: selectedAccount,
    });
    setComposeOpen(true);
  };

  // Create a task from email (same as forwarding to newtask@tekna.com.au)
  const handleCreateTaskFromEmail = async (email: Email) => {
    if (creatingTask) return;

    setCreatingTask(true);
    try {
      const response = await api.post<{ success: boolean; sm_task: { id: number; name: string }; error?: string }>(
        `/api/v1/sm_tasks/from_email/${email.id}`
      );

      if (!response) {
        throw new Error("No response from server");
      }

      if (response.success && response.sm_task) {
        toast({
          title: "Task Created",
          description: `Task "${response.sm_task.name}" created successfully`,
        });
        // Open Task Hub in a new tab (standalone tasks go to /tasks, not /sm-tasks)
        window.open(`/tasks`, "_blank");
      } else {
        throw new Error(response.error || "Failed to create task");
      }
    } catch (error) {
      console.error("Failed to create task:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create task from email",
        variant: "destructive",
      });
    } finally {
      setCreatingTask(false);
    }
  };

  // Quick create contact from email sender
  const handleQuickCreateContact = async (email: Email) => {
    if (creatingContact) return;

    setCreatingContact(true);
    try {
      const response = await api.post<{
        success: boolean;
        contact: { id: number; display_name: string; email: string };
        company?: { id: number; name: string };
        message: string;
        already_existed?: boolean;
      }>(`/api/v1/email_warehouse/${email.id}/quick_create_contact`);

      if (response?.success) {
        toast({
          title: response.already_existed ? "Contact Linked" : "Contact Created",
          description: response.message,
        });
        // Refresh the email to show updated contact
        handleEmailClick(email);
      }
    } catch (error) {
      console.error("Failed to create contact:", error);
      const errorMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : "Failed to create contact";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setCreatingContact(false);
    }
  };

  // Handle snooze email (show toast for now, can integrate SnoozePicker later)
  const handleSnoozeEmail = useCallback((email: Email) => {
    toast({
      title: "Snooze",
      description: `Snooze feature coming soon for "${email.subject}"`,
    });
  }, [toast]);

  const toggleAccountExpanded = (accountId: string, account?: EmailAccount) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
      // Fetch folders when expanding (pass account for ms365 type)
      const acct = account || accounts.find(a => String(a.id) === accountId);
      fetchFolders(accountId, acct);
    }
    setExpandedAccounts(newExpanded);
  };

  const selectAccountFolder = useCallback((accountId: string, folder: EmailFolder) => {
    // Update folder selection immediately for instant UI feedback
    setSelectedFolderId(folder.id);
    setSelectedFolder(folder.name);

    // Use transition for account change (triggers email fetch) to avoid blocking UI
    if (selectedAccount !== accountId) {
      startTransition(() => {
        setSelectedAccount(accountId);
      });
    }
  }, [selectedAccount]);

  const getSelectedAccountName = () => {
    if (selectedAccount === "all") return "All Accounts";
    const account = accounts.find(a => String(a.id) === selectedAccount);
    if (!account) return "Select mailbox";
    if (account.type === "ms365") {
      return account.email_address ? `${account.name} - ${account.email_address}` : account.name;
    }
    return account.email_address || account.name;
  };

  // Handler for when email is moved via drag-drop
  const handleDragDropMove = useCallback(() => {
    if (viewMode === "split") {
      splitInbox.refresh();
    } else {
      fetchEmails();
    }
  }, [viewMode, splitInbox, fetchEmails]);

  return (
    <EmailDragDropProvider onMoveComplete={handleDragDropMove}>
    <ResizablePanelGroup
      orientation="horizontal"
      className={cn("h-full", isStandalone ? "pl-4 pt-2" : "-mx-4 -mt-4")}
    >
      {/* Left Sidebar - Mailboxes & Folders */}
      <ResizablePanel
        id="email-sidebar"
        defaultSize="220px"
        minSize="150px"
        maxSize="400px"
        className="bg-muted/30 flex flex-col"
      >
        <div className="p-2 border-b flex items-center gap-1">
          <Button className="flex-1" size="sm" onClick={handleCompose}>
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={viewMode === "split" ? handleSplitSync : handleSync}
            disabled={syncing || wsIsSyncing || splitInbox.loading || (viewMode === "folders" && !selectedAccount)}
            title="Sync"
          >
            <RefreshCw className={cn("h-4 w-4", (syncing || wsIsSyncing || splitInbox.loading) && "animate-spin")} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setShowShortcutsHelp(true)}>
                <Keyboard className="h-4 w-4 mr-2" />
                Keyboard shortcuts
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Sort by
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {THREAD_SORT_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => threads.setSortOption(option.value)}
                      className={threads.sortOption === option.value ? "bg-muted" : ""}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FileText className="h-4 w-4 mr-2" />
                  Reading pane
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={() => setReadingPanePosition("right")}
                    className={readingPanePosition === "right" ? "bg-muted" : ""}
                  >
                    Right
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setReadingPanePosition("bottom")}
                    className={readingPanePosition === "bottom" ? "bg-muted" : ""}
                  >
                    Bottom
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setReadingPanePosition("off")}
                    className={readingPanePosition === "off" ? "bg-muted" : ""}
                  >
                    Off
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleMarkFolderRead}
                disabled={!selectedAccount || selectedAccount === "all"}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Mark folder as read
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/email/rules")}>
                <Settings2 className="h-4 w-4 mr-2" />
                Email Rules
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/email/settings")}>
                <Settings2 className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Drafts Section */}
        <DraftsList
          compact
          className="border-b"
          onResume={(draft) => {
            setResumeDraft(draft);
            setReplyTo(null);
            setComposeOpen(true);
          }}
        />

        <div className="flex-1 overflow-y-auto py-2">
          {/* All Inbox - Combined view from all accounts */}
          <button
            onClick={() => {
              setSelectedAccount("all");
              setSelectedFolder("Inbox");
              setSelectedFolderId("ALL_INBOX");
            }}
            className={cn(
              "w-full flex items-center gap-2 px-1 py-1.5 text-sm hover:bg-muted/50 rounded-sm font-medium",
              selectedAccount === "all" && "bg-primary/10 text-primary"
            )}
          >
            <Inbox className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">All Inbox</span>
          </button>

          <div className="border-b my-2" />

          {/* Mailbox list - always show */}
          <div className="px-1 mb-2">
            <div className="text-xs text-muted-foreground px-0.5 py-1 font-medium">Mailboxes</div>
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => {
                  const accountId = String(account.id);
                  setSelectedAccount(accountId);
                  // Immediately set folder to Inbox when switching accounts
                  // (don't wait for fetchFolders to complete - fixes race condition)
                  setSelectedFolder("Inbox");
                  setSelectedFolderId("");  // Clear old folder ID
                  setExpandedAccounts(new Set([accountId]));
                  fetchFolders(accountId, account, true);  // forceSelectInbox to update folder ID
                }}
                onDoubleClick={() => {
                  // Open mailbox in a new dedicated fullscreen tab
                  window.open(`/email?account=${account.id}&standalone=true`, '_blank');
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-1 py-1 text-sm hover:bg-muted/50 rounded-sm",
                  selectedAccount === String(account.id) && "bg-primary/10 text-primary font-medium"
                )}
              >
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 text-left truncate text-sm">
                  {account.email_address || account.name}
                </span>
              </button>
            ))}
          </div>

          {selectedAccount && selectedAccount !== "all" ? (
            (() => {
              const account = accounts.find(a => String(a.id) === selectedAccount);
              if (!account) return null;
              return (
                <div className="mb-1">
                  {/* Account Header */}
                  <div className="px-1 py-1.5 text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {account.email_address || account.name}
                    </span>
                  </div>

                  {/* Folders */}
                  <div className="mt-1">
                    {account.needs_mailbox_config ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        <p>Mailbox not configured</p>
                        <p className="mt-1">Configure in Admin → System → Microsoft</p>
                      </div>
                    ) : loadingFolders.has(selectedAccount) ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Loading folders...
                      </div>
                    ) : (accountFolders[selectedAccount] || []).length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No folders found
                      </div>
                    ) : (
                      <FolderTree
                        items={accountFolders[selectedAccount] || []}
                        selectedId={selectedFolderId || undefined}
                        onSelect={(item: FolderTreeItem) => {
                          // Convert FolderTreeItem back to EmailFolder format
                          const folder: EmailFolder = {
                            id: item.id,
                            name: item.name,
                            type: item.type,
                            unread_count: item.unreadCount,
                            total_items: item.totalItems,
                            depth: item.depth,
                            parent_id: item.parentId,
                          };
                          selectAccountFolder(selectedAccount, folder);
                        }}
                        persistKey={`email-folders-${selectedAccount}`}
                        enableReorder={true}
                        customOrder={folderOrder[selectedAccount]}
                        onReorder={(ids) => saveFolderOrder(selectedAccount, ids)}
                        renderWrapper={(item, children) => (
                          <DroppableFolder folderId={item.id} folderName={item.name}>
                            {children}
                          </DroppableFolder>
                        )}
                      />
                    )}
                    {/* Create Folder button - only for IMAP accounts */}
                    {account.type === "imap" && (
                      <button
                        onClick={() => setCreateFolderOpen(true)}
                        className="w-full flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-sm mt-1"
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                        <span>Create Folder</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()
          ) : null}
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* Main Content Area - List + Reading Pane */}
      <ResizablePanel id="email-content" minSize="400px" className="flex min-w-0">
        <ResizablePanelGroup
          orientation={readingPanePosition === "bottom" ? "vertical" : "horizontal"}
          className="flex-1"
        >
        {/* Email List */}
        <ResizablePanel
          id="email-list"
          defaultSize="350px"
          minSize="250px"
          maxSize={readingPanePosition === "off" ? undefined : "600px"}
          className="flex flex-col border-r min-w-0 overflow-hidden"
        >
        {/* Header - View toggle and search */}
        <div className="flex items-center gap-2 px-2 py-1.5 border-b shrink-0 bg-background">
          <ViewModeToggle mode={viewMode} onModeChange={setViewMode} />

          {/* Search - Only in folder mode */}
          {viewMode === "folders" && (
            <div className="flex-1 min-w-0">
              <EmailSearchFilters
                filters={emailFilters.filters}
                setFilter={emailFilters.setFilter}
                setSearch={emailFilters.setSearch}
                clearFilters={emailFilters.clearFilters}
                hasActiveFilters={emailFilters.hasActiveFilters}
                activeFilterCount={emailFilters.activeFilterCount}
                activeFilterLabels={emailFilters.getActiveFilterLabels()}
                onSearch={() => fetchEmails(1)}
              />
            </div>
          )}

          {/* New email indicator */}
          {newEmailCount > 0 && (
            <Badge variant="default" className="text-xs px-1.5 py-0 h-5 bg-blue-500 shrink-0">
              +{newEmailCount}
            </Badge>
          )}
        </div>

        {/* Split Inbox Tabs */}
        {viewMode === "split" && (
          <div className="px-3 py-2 border-b shrink-0">
            <SplitInboxTabs
              selectedCategory={splitInbox.selectedCategory}
              onCategoryChange={splitInbox.setSelectedCategory}
              counts={splitInbox.counts}
              unreadCounts={splitInbox.unreadCounts}
              loading={splitInbox.loading}
            />
            <StaleIndicator
              isStale={splitInbox.isStale ?? false}
              lastFetched={splitInbox.lastFetched ?? null}
              isOffline={splitInbox.isOffline ?? false}
              isRefreshing={splitInbox.isFetching ?? syncing}
              onRefresh={handleSplitSync}
              className="mt-2"
            />
          </div>
        )}

        {/* Bulk Action Bar - shows when emails are selected */}
        <BulkActionBar
          selectedCount={selection.count}
          totalCount={currentEmails.length}
          allSelected={selection.count === currentEmails.length && currentEmails.length > 0}
          onToggleSelectAll={() => {
            if (selection.count === currentEmails.length) {
              selection.clear();
            } else {
              selection.selectAll(currentEmails);
            }
          }}
          onClear={selection.clear}
          onArchive={bulkActions.bulkArchive}
          onStar={bulkActions.bulkStar}
          onPin={bulkActions.bulkPin}
          onMarkRead={bulkActions.bulkMarkRead}
          onMarkUnread={bulkActions.bulkMarkUnread}
          isLoading={bulkActions.isLoading}
        />

        {/* Email List */}
        <div className="flex-1 overflow-auto">
          {viewMode === "split" ? (
            // Split Inbox View
            splitInbox.loading && !splitInbox.data ? (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            ) : splitInbox.error ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <WifiOff className="h-8 w-8 mb-2 opacity-50 text-amber-500" />
                <p className="text-sm">{splitInbox.error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={splitInbox.refresh}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Try Again
                </Button>
              </div>
            ) : splitInbox.currentEmails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Inbox className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No emails in {splitInbox.selectedCategory}</p>
              </div>
            ) : (
              <div className="divide-y">
                {splitInbox.currentEmails.map((email) => (
                  <EmailListItem
                    key={email.id}
                    email={email as Email}
                    isSelected={selectedEmail?.id === email.id}
                    isChecked={selection.isSelected(email.id)}
                    hasSelections={selection.hasSelection}
                    onClick={handleEmailRowClick}
                    onCheckboxChange={handleCheckboxChange}
                    onQuickAction={() => fetchEmails()}
                    onSnooze={handleSnoozeEmail}
                    onReply={handleReply}
                    onReplyAll={handleReplyAll}
                    onForward={handleForward}
                    threadCount={(email as Email).thread_count || 0}
                    isExpanded={threads.isExpanded((email as Email).conversation_id || '')}
                    onToggleThread={handleToggleThread}
                    threadEmails={threads.getThread((email as Email).conversation_id || '') || []}
                    isLoadingThread={threads.isLoading((email as Email).conversation_id || '')}
                  />
                ))}
              </div>
            )
          ) : (
            // Folder View
            loading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Inbox className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No emails</p>
              </div>
            ) : (
              <div className="divide-y">
                {emails.map((email) => (
                  <EmailListItem
                    key={email.id}
                    email={email}
                    isSelected={selectedEmail?.id === email.id}
                    isChecked={selection.isSelected(email.id)}
                    hasSelections={selection.hasSelection}
                    onClick={handleEmailRowClick}
                    onCheckboxChange={handleCheckboxChange}
                    onQuickAction={() => fetchEmails()}
                    onSnooze={handleSnoozeEmail}
                    onReply={handleReply}
                    onReplyAll={handleReplyAll}
                    onForward={handleForward}
                    threadCount={email.thread_count || 0}
                    isExpanded={threads.isExpanded(email.conversation_id || '')}
                    onToggleThread={handleToggleThread}
                    threadEmails={threads.getThread(email.conversation_id || '') || []}
                    isLoadingThread={threads.isLoading(email.conversation_id || '')}
                    // Drag-drop props for folder view
                    enableDrag={true}
                    accountId={selectedAccount}
                    accountType={accounts.find(a => String(a.id) === selectedAccount)?.type as "imap" | "outlook" | "ms365" || "outlook"}
                    sourceFolder={selectedFolder}
                  />
                ))}
              </div>
            )
          )}
        </div>

        {/* Pagination - Only in folder mode */}
        {viewMode === "folders" && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t shrink-0">
            <p className="text-xs text-muted-foreground">
              {pagination.page}/{pagination.total_pages}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={pagination.page === 1}
                onClick={() => fetchEmails(pagination.page - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                disabled={pagination.page === pagination.total_pages}
                onClick={() => fetchEmails(pagination.page + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </ResizablePanel>

      {/* Reading Pane - Hidden when position is "off" */}
      {readingPanePosition !== "off" && (
        <>
        <ResizableHandle withHandle />
        <ResizablePanel
          id="reading-pane"
          minSize="300px"
          className="flex flex-col min-w-0 overflow-hidden bg-background"
        >
        {selectedEmail ? (
          <>
            {/* Outlook-style Toolbar Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReply(selectedEmail)}
              >
                <Reply className="h-4 w-4 mr-2" />
                Reply
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleReplyAll(selectedEmail)}
              >
                <ReplyAll className="h-4 w-4 mr-2" />
                Reply All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleForward(selectedEmail)}
              >
                <Forward className="h-4 w-4 mr-2" />
                Forward
              </Button>

              {/* Right-aligned actions: Contact + Task Creation */}
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickCreateContact(selectedEmail)}
                  disabled={creatingContact}
                  title="Create contact from sender"
                >
                  {creatingContact ? (
                    <Spinner className="h-4 w-4 mr-2" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  + Contact
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreateTaskFromEmail(selectedEmail)}
                  disabled={creatingTask}
                >
                  {creatingTask ? (
                    <Spinner className="h-4 w-4 mr-2" />
                  ) : (
                    <ListTodo className="h-4 w-4 mr-2" />
                  )}
                  + Task
                </Button>
              </div>
            </div>

            {/* Subject Line */}
            <div className="px-4 py-3 border-b shrink-0">
              <h1 className="text-base font-semibold">
                {selectedEmail.subject || "(No subject)"}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(selectedEmail.received_at), "PPpp")}
              </p>
            </div>

            {/* From / To - Outlook inline style */}
            <div className="px-4 py-2 border-b space-y-1 shrink-0 text-sm">
              <div className="flex items-start">
                <span className="text-muted-foreground w-10 flex-shrink-0">From</span>
                <span>
                  {selectedEmail.from_name || selectedEmail.from_email || selectedEmail.from_address}
                  {selectedEmail.from_name && selectedEmail.from_email && (
                    <span className="text-muted-foreground ml-1">
                      &lt;{selectedEmail.from_email}&gt;
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-start">
                <span className="text-muted-foreground w-10 flex-shrink-0">To</span>
                <span>{(selectedEmail.to_addresses || selectedEmail.to_emails)?.join(", ")}</span>
              </div>
              {selectedEmail.cc_emails && selectedEmail.cc_emails.length > 0 && (
                <div className="flex items-start">
                  <span className="text-muted-foreground w-10 flex-shrink-0">Cc</span>
                  <span>{selectedEmail.cc_emails.join(", ")}</span>
                </div>
              )}
            </div>

            {/* Attachments */}
            {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
              <div className="px-4 py-2 border-b bg-muted/30 shrink-0">
                <div className="flex flex-wrap gap-2">
                  {selectedEmail.attachments.map((att) => (
                    <Badge key={att.id} variant="secondary" className="flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      {att.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* AI Summary */}
            <EmailSummary
              emailId={selectedEmail.id}
              existingSummary={selectedEmail.ai_summary}
            />

            {/* Email Body */}
            <div className="flex-1 overflow-auto px-4 py-4">
              {selectedEmail.body_html ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm font-sans">
                  {decodeHtmlEntities(selectedEmail.body_text || selectedEmail.snippet)}
                </pre>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Mail className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg">Select an email to read</p>
            <p className="text-sm mt-1">Choose an email from the list to view its contents</p>
          </div>
        )}
      </ResizablePanel>
      </>
      )}

      </ResizablePanelGroup>
      </ResizablePanel>
    </ResizablePanelGroup>

      {/* Compose Modal */}
      <ComposeEmailModal
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open);
          if (!open) {
            setReplyTo(null);
            setResumeDraft(null);
          }
        }}
        defaultTo={replyTo?.to || ""}
        defaultCc={replyTo?.cc || ""}
        defaultSubject={replyTo?.subject || ""}
        defaultBody={replyTo?.body || ""}
        defaultFromAccountId={replyTo?.fromAccountId}
        replyToMessageId={replyTo?.replyToMessageId}
        draft={resumeDraft || undefined}
        onSent={() => {
          fetchEmails();
          setReplyTo(null);
          setResumeDraft(null);
        }}
      />

      {/* Create Folder Dialog - for IMAP accounts */}
      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        accountId={selectedAccount}
        onFolderCreated={() => {
          // Refresh folders for the current account
          const account = accounts.find(a => String(a.id) === selectedAccount);
          if (account) {
            setAccountFolders(prev => ({ ...prev, [selectedAccount]: [] }));
            fetchFolders(selectedAccount, account);
          }
        }}
      />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp
        open={showShortcutsHelp}
        onOpenChange={setShowShortcutsHelp}
      />

      {/* Email Pop-out Dialog */}
      <Dialog open={!!popoutEmail} onOpenChange={(open) => !open && setPopoutEmail(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" aria-describedby="email-popout-description">
          {popoutEmail && (
            <>
              <DialogHeader className="shrink-0">
                <DialogTitle className="text-base font-semibold pr-8">
                  {popoutEmail.subject || "(No subject)"}
                </DialogTitle>
                <DialogDescription id="email-popout-description" className="sr-only">
                  Email from {popoutEmail.from_name || popoutEmail.from_email || popoutEmail.from_address}
                </DialogDescription>
              </DialogHeader>

              {/* From / To */}
              <div className="space-y-1 py-2 border-b shrink-0 text-sm">
                <div className="flex items-start">
                  <span className="text-muted-foreground w-10 flex-shrink-0">From</span>
                  <span>
                    {popoutEmail.from_name || popoutEmail.from_email || popoutEmail.from_address}
                    {popoutEmail.from_name && popoutEmail.from_email && (
                      <span className="text-muted-foreground ml-1">
                        &lt;{popoutEmail.from_email}&gt;
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-start">
                  <span className="text-muted-foreground w-10 flex-shrink-0">To</span>
                  <span>{(popoutEmail.to_addresses || popoutEmail.to_emails)?.join(", ")}</span>
                </div>
                {popoutEmail.cc_emails && popoutEmail.cc_emails.length > 0 && (
                  <div className="flex items-start">
                    <span className="text-muted-foreground w-10 flex-shrink-0">Cc</span>
                    <span>{popoutEmail.cc_emails.join(", ")}</span>
                  </div>
                )}
                <div className="flex items-start">
                  <span className="text-muted-foreground w-10 flex-shrink-0">Date</span>
                  <span className="text-muted-foreground">{format(new Date(popoutEmail.received_at), "PPpp")}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 py-2 border-b shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleReply(popoutEmail);
                    setPopoutEmail(null);
                  }}
                >
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleReplyAll(popoutEmail);
                    setPopoutEmail(null);
                  }}
                >
                  <ReplyAll className="h-4 w-4 mr-2" />
                  Reply All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleForward(popoutEmail);
                    setPopoutEmail(null);
                  }}
                >
                  <Forward className="h-4 w-4 mr-2" />
                  Forward
                </Button>
              </div>

              {/* Attachments */}
              {popoutEmail.attachments && popoutEmail.attachments.length > 0 && (
                <div className="py-2 border-b bg-muted/30 shrink-0">
                  <div className="flex flex-wrap gap-2">
                    {popoutEmail.attachments.map((att) => (
                      <Badge key={att.id} variant="secondary" className="flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        {att.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Body */}
              <div className="flex-1 overflow-auto py-4">
                {popoutEmail.body_html ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: popoutEmail.body_html }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm font-sans">
                    {decodeHtmlEntities(popoutEmail.body_text || popoutEmail.snippet)}
                  </pre>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </EmailDragDropProvider>
  );
}
