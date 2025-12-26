"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useTransition, useMemo, memo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { formatDistanceToNow, format } from "date-fns";
import { ComposeEmailModal } from "@/components/emails/ComposeEmailModal";
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
import { EmailSummary } from "@/components/emails/EmailSummary";
import { EmailContactMatch } from "@/components/emails/EmailContactMatch";
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
import type { EmailListItem as WebSocketEmail } from "@/lib/email-types";
import { cn } from "@/lib/utils";
import { emailCache, isIndexedDBAvailable } from "@/lib/email-cache";
import { useToast } from "@/components/ui/use-toast";

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
  name: string;
  type: string;
  unread_count?: number;
  total_items?: number;
  depth?: number;
  parent_id?: string;
}

// Map folder type to icon
const FOLDER_ICONS: Record<string, typeof Inbox> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  archive: Archive,
  trash: Trash2,
  junk: Trash2,
  important: Star,
  folder: FileText,
};

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
    <div data-email-id={email.id}>
      {/* Main email row */}
      <div
        className={cn(
          "group px-3 py-2.5 cursor-pointer border-l-2",
          isSelected
            ? "bg-primary/10 border-l-primary"
            : isChecked
            ? "bg-primary/5 border-l-primary/50"
            : "hover:bg-muted/50 border-l-transparent",
          !email.is_read && !isSelected && !isChecked && "bg-blue-50/50 dark:bg-blue-950/20"
        )}
        onClick={(e) => onClick(email, e)}
      >
        <div className="flex items-start gap-2">
          {/* Thread expand/collapse chevron OR checkbox */}
          <div className="shrink-0 pt-0.5 w-4 flex items-center justify-center">
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

          <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
            {/* Unread indicator dot */}
            {!email.is_read && (
              <div className="shrink-0 pt-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={cn(
                  "text-sm truncate",
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
              </div>
              <p className={cn(
                "text-sm truncate",
                !email.is_read ? "font-semibold text-foreground" : "font-normal text-muted-foreground"
              )}>
                {email.subject || "(No subject)"}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {email.snippet || email.body_preview}
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
            <div className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 group-hover:hidden">
              {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
            </div>
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
                        !threadEmail.is_read ? "font-semibold" : "font-medium"
                      )}>
                        {threadEmail.from_name || threadEmail.from_email || threadEmail.from_address}
                      </span>
                      {threadEmail.has_attachments && (
                        <Paperclip className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {threadEmail.snippet || threadEmail.body_preview}
                    </p>
                  </div>
                  <div className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                    {format(new Date(threadEmail.received_at), "MMM d, h:mm a")}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
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

// Memoized folder button component for performance
const FolderButton = memo(function FolderButton({
  folder,
  accountId,
  isSelected,
  onSelect,
  enableDrop = false,
}: {
  folder: EmailFolder;
  accountId: string;
  isSelected: boolean;
  onSelect: (accountId: string, folder: EmailFolder) => void;
  enableDrop?: boolean;
}) {
  const Icon = FOLDER_ICONS[folder.type] || FOLDER_ICONS.folder;
  const depth = folder.depth || 0;

  const buttonContent = (
    <button
      onClick={() => onSelect(accountId, folder)}
      className={cn(
        "w-full flex items-center gap-2 py-1.5 text-sm hover:bg-muted/50 rounded-sm",
        isSelected && "bg-primary/10 text-primary font-medium"
      )}
      style={{ paddingLeft: `${12 + depth * 16}px`, paddingRight: '12px' }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left truncate">{folder.name}</span>
      {folder.unread_count !== undefined && folder.unread_count > 0 && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0.5 min-w-[20px] text-center shrink-0">
          {folder.unread_count}
        </Badge>
      )}
    </button>
  );

  if (enableDrop) {
    return (
      <DroppableFolder folderId={folder.id} folderName={folder.name}>
        {buttonContent}
      </DroppableFolder>
    );
  }

  return buttonContent;
});

export default function EmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const accountParam = searchParams.get("account");

  const [emails, setEmails] = useState<Email[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [accountFolders, setAccountFolders] = useState<Record<string, EmailFolder[]>>({});
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    per_page: 50,
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

  const [selectedAccount, setSelectedAccount] = useState<string>(cachedState?.accountId || "");
  const [selectedFolder, setSelectedFolder] = useState<string>(cachedState?.folderName || "Inbox");
  const [selectedFolderId, setSelectedFolderId] = useState<string>(cachedState?.folderId || "INBOX");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(
    cachedState?.accountId ? new Set([cachedState.accountId]) : new Set()
  );
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ to: string; cc?: string; subject: string; body?: string; messageId?: string; fromAccountId?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Split Inbox State - default to folders (Inbox) for faster loading
  const [viewMode, setViewMode] = useState<"split" | "folders">(cachedState?.viewMode || "folders");
  const splitInbox = useSplitInbox({ accountId: selectedAccount });

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
    if (!selectedAccount) {
      setEmails([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Start with filters from hook
      const params = toURLParams();
      params.set("page", String(page));
      params.set("per_page", "50");
      params.set("my_emails", "true");

      // Filter by specific account
      if (selectedAccount === "outlook") {
        params.append("source_type", "outlook");
      } else if (selectedAccount.startsWith("ms365_")) {
        // MS365 org accounts: extract microsoft_credential_id from "ms365_X_hash" format
        const parts = selectedAccount.split("_");
        params.append("microsoft_credential_id", parts[1]);
      } else {
        params.append("imap_credential_id", selectedAccount);
      }

      // Filter by folder if one is selected
      if (selectedFolderId) {
        params.append("folder_id", selectedFolderId);
      }

      const response = await api.get<{ emails: Email[]; pagination: Pagination }>(
        `/api/v1/email_warehouse?${params.toString()}`
      );

      setEmails(response.emails || []);
      setPagination(response.pagination);
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setLoading(false);
    }
  }, [toURLParams, selectedAccount, selectedFolderId]);

  const fetchFolders = async (accountId: string, account?: EmailAccount) => {
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
    try {
      // Build URL with mailbox_email for ms365 accounts
      let url = `/api/v1/imap_credentials/folders?account_id=${accountId}`;
      if (acct?.type === "ms365" && acct?.email_address) {
        url += `&mailbox_email=${encodeURIComponent(acct.email_address)}`;
      }

      const response = await api.get<{ success: boolean; data: EmailFolder[] }>(url);
      if (response.success && response.data) {
        setAccountFolders(prev => ({
          ...prev,
          [accountId]: response.data
        }));

        // Auto-select inbox folder if this is the selected account and no folder is selected
        // (Don't override cached folder selection)
        if (accountId === selectedAccount && !selectedFolderId) {
          const inboxFolder = response.data.find(f => f.type === "inbox");
          if (inboxFolder) {
            setSelectedFolder(inboxFolder.name);
            setSelectedFolderId(inboxFolder.id);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch folders:", error);
      // Set empty array to prevent retry loops
      setAccountFolders(prev => ({
        ...prev,
        [accountId]: []
      }));
    } finally {
      setLoadingFolders(prev => {
        const next = new Set(prev);
        next.delete(accountId);
        return next;
      });
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await api.get<{ success: boolean; data: EmailAccount[] }>(
        "/api/v1/imap_credentials/all_accounts"
      );
      const activeAccounts = (response.data || []).filter(a => a.is_active);
      setAccounts(activeAccounts);

      // Check if URL has account param, otherwise use default
      if (activeAccounts.length > 0) {
        let accountToSelect: EmailAccount | undefined;

        if (accountParam) {
          // Find account matching URL param
          accountToSelect = activeAccounts.find(a => String(a.id) === accountParam);
        }

        if (!accountToSelect) {
          // Fall back to default or first account
          accountToSelect = activeAccounts.find(a => a.is_default) || activeAccounts[0];
        }

        const accountId = String(accountToSelect.id);
        setSelectedAccount(accountId);
        setExpandedAccounts(new Set([accountId]));
        // Fetch folders for selected account (pass account for ms365 type)
        fetchFolders(accountId, accountToSelect);
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
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
        setExpandedAccounts(new Set([accountId]));
        fetchFolders(accountId, matchingAccount);
      }
    }
  }, [accountParam, accounts]);

  useEffect(() => {
    if (selectedAccount) {
      fetchEmails();
    }
  }, [selectedAccount, fetchEmails]);

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

  const handleEmailClick = useCallback(async (email: Email) => {
    if (!email || !email.id) {
      console.error("Invalid email object:", email);
      return;
    }

    // Set selected email immediately so UI updates
    setSelectedEmail(email);

    // Fetch full email content if not loaded
    if (!email.body_html && !email.body_text) {
      try {
        const response = await api.get<Email | { email: Email }>(`/api/v1/email_warehouse/${email.id}`);
        // Handle both wrapped and unwrapped response formats
        const fullEmail = (response as { email?: Email }).email || response as Email;
        if (fullEmail && fullEmail.id) {
          setSelectedEmail(fullEmail);
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

    // Normal click - open email (clear selection if clicking to view)
    setLastClickedEmailId(email.id);
    handleEmailClick(email);
  }, [lastClickedEmailId, selection, currentEmails, handleEmailClick]);

  // Handle checkbox change for multi-select
  const handleCheckboxChange = useCallback((email: Email) => {
    selection.toggle(email.id);
    setLastClickedEmailId(email.id);
  }, [selection]);

  const handleReply = (email: Email) => {
    setReplyTo({
      to: email.from_email || email.from_address,
      subject: email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
      fromAccountId: selectedAccount, // Reply from the same account that received the email
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

    setReplyTo({
      to,
      cc: ccRecipients.join(", "),
      subject: email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
      fromAccountId: selectedAccount,
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
    <div className="flex h-full -mx-4 -mt-4">
      {/* Left Sidebar - Mailboxes & Folders */}
      <div className="w-64 border-r bg-muted/30 flex flex-col shrink-0">
        <div className="p-3 border-b">
          <Button className="w-full" onClick={handleCompose}>
            <Plus className="h-4 w-4 mr-2" />
            New Email
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {!selectedAccount ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Select a mailbox</p>
              <p className="text-xs mt-1">Choose from Email in the sidebar</p>
            </div>
          ) : (
            (() => {
              const account = accounts.find(a => String(a.id) === selectedAccount);
              if (!account) return null;
              return (
                <div className="mb-1">
                  {/* Account Header */}
                  <div className="px-3 py-2 text-sm font-medium flex items-center gap-2">
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
                      (accountFolders[selectedAccount] || []).map((folder) => (
                        <FolderButton
                          key={folder.id}
                          folder={folder}
                          accountId={selectedAccount}
                          isSelected={selectedFolderId === folder.id}
                          onSelect={selectAccountFolder}
                          enableDrop={true}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Rules & Settings Links */}
        <div className="p-3 border-t space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => router.push("/email/rules")}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Email Rules
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => router.push("/email/settings")}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Main Content Area - List + Reading Pane */}
      <div className={cn(
        "flex-1 flex min-w-0",
        readingPanePosition === "bottom" ? "flex-col" : "flex-row"
      )}>
        {/* Email List */}
        <div className={cn(
          "flex flex-col border-r",
          readingPanePosition === "off" ? "flex-1" :
          readingPanePosition === "bottom" ? "h-1/2 shrink-0" : "w-[400px] shrink-0"
        )}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b shrink-0 bg-background">
          <div className="flex items-center gap-2 min-w-0">
            <ViewModeToggle mode={viewMode} onModeChange={setViewMode} />
            {viewMode === "folders" && (
              <>
                <span className="font-medium truncate text-sm">
                  {getSelectedAccountName()}
                </span>
                {selectedFolder && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {selectedFolder}
                  </Badge>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted-foreground mr-1">
              {viewMode === "split"
                ? splitInbox.counts[splitInbox.selectedCategory] || 0
                : pagination.total}
            </span>
            {/* WebSocket connection status */}
            <div
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
                isConnected
                  ? "text-green-600 dark:text-green-400"
                  : "text-muted-foreground"
              )}
              title={isConnected ? "Real-time updates active" : "Connecting..."}
            >
              {isConnected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              {wsIsSyncing && (
                <span className="text-[10px]">syncing</span>
              )}
            </div>
            {/* New email count badge */}
            {newEmailCount > 0 && (
              <Badge variant="default" className="text-xs px-1.5 py-0 h-5 bg-blue-500">
                +{newEmailCount}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowShortcutsHelp(true)}
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="h-3.5 w-3.5" />
            </Button>
            {/* Thread sort dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title={`Thread sort: ${THREAD_SORT_OPTIONS.find(o => o.value === threads.sortOption)?.label}`}
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {THREAD_SORT_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={() => threads.setSortOption(option.value)}
                    className={threads.sortOption === option.value ? "bg-muted" : ""}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={viewMode === "split" ? handleSplitSync : handleSync}
              disabled={syncing || wsIsSyncing || splitInbox.loading || (viewMode === "folders" && !selectedAccount)}
              title={viewMode === "split" ? "Sync all accounts" : "Sync account"}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", (syncing || wsIsSyncing || splitInbox.loading) && "animate-spin")} />
            </Button>
            {/* Reading pane position toggle */}
            <ReadingPaneToggle
              position={readingPanePosition}
              onPositionChange={setReadingPanePosition}
            />
          </div>
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
            {/* Stale/Offline Indicator */}
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

        {/* Search with filters - Only in folder mode */}
        {viewMode === "folders" && (
          <div className="px-3 py-2 border-b shrink-0">
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
            !selectedAccount ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Mail className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Select a mailbox</p>
              </div>
            ) : loading ? (
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
      </div>

      {/* Reading Pane - Hidden when position is "off" */}
      {readingPanePosition !== "off" && (
      <div className={cn(
        "flex flex-col min-w-0 bg-background",
        readingPanePosition === "bottom" ? "h-1/2 border-t" : "flex-1"
      )}>
        {selectedEmail ? (
          <>
            {/* Email Header */}
            <div className="px-6 py-4 border-b shrink-0">
              <h1 className="text-xl font-semibold mb-3">
                {selectedEmail.subject || "(No subject)"}
              </h1>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-primary">
                      {(selectedEmail.from_name || selectedEmail.from_email || "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">
                      {selectedEmail.from_name || selectedEmail.from_email || selectedEmail.from_address}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedEmail.from_email || selectedEmail.from_address}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      To: {(selectedEmail.to_addresses || selectedEmail.to_emails)?.join(", ")}
                    </p>
                    {/* Contact Matching */}
                    <div className="mt-2">
                      <EmailContactMatch
                        emailId={selectedEmail.id}
                        primaryContact={selectedEmail.primary_contact}
                        contacts={selectedEmail.contacts || []}
                        onContactsChanged={() => handleEmailClick(selectedEmail)}
                      />
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedEmail.received_at), "PPpp")}
                  </p>
                  <div className="flex items-center gap-2 mt-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => handleForward(selectedEmail)}>
                      <Forward className="h-4 w-4 mr-1" />
                      Forward
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleReplyAll(selectedEmail)}>
                      <ReplyAll className="h-4 w-4 mr-1" />
                      Reply All
                    </Button>
                    <Button size="sm" onClick={() => handleReply(selectedEmail)}>
                      <Reply className="h-4 w-4 mr-1" />
                      Reply
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Attachments */}
            {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
              <div className="px-6 py-3 border-b shrink-0">
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
            <div className="flex-1 overflow-auto px-6 py-4">
              {selectedEmail.body_html ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm font-sans">
                  {selectedEmail.body_text || selectedEmail.snippet}
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
      </div>
      )}

      </div>{/* End Main Content Area wrapper */}

      {/* Compose Modal */}
      <ComposeEmailModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultTo={replyTo?.to || ""}
        defaultCc={replyTo?.cc || ""}
        defaultSubject={replyTo?.subject || ""}
        defaultBody={replyTo?.body || ""}
        defaultFromAccountId={replyTo?.fromAccountId}
        onSent={() => {
          fetchEmails();
          setReplyTo(null);
        }}
      />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp
        open={showShortcutsHelp}
        onOpenChange={setShowShortcutsHelp}
      />
    </div>
    </EmailDragDropProvider>
  );
}
