"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useTransition, useMemo, memo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
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
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDistanceToNow, format } from "date-fns";
import { ComposeEmailModal } from "@/components/emails/ComposeEmailModal";
import {
  SplitInboxTabs,
  ViewModeToggle,
  useSplitInbox,
  type SplitInboxCategory,
} from "@/components/emails/SplitInboxTabs";
import { cn } from "@/lib/utils";

interface Email {
  id: number;
  subject: string;
  from_address: string;
  from_email: string;
  from_name: string | null;
  to_addresses: string[];
  to_emails: string[];
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
  onClick,
}: {
  email: Email;
  isSelected: boolean;
  onClick: (email: Email) => void;
}) {
  return (
    <div
      className={cn(
        "px-3 py-2.5 cursor-pointer border-l-2",
        isSelected
          ? "bg-primary/10 border-l-primary"
          : "hover:bg-muted/50 border-l-transparent",
        !email.is_read && "bg-blue-50/50 dark:bg-blue-950/20"
      )}
      onClick={() => onClick(email)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={cn(
              "text-sm truncate",
              !email.is_read ? "font-semibold" : "font-medium"
            )}>
              {email.from_name || email.from_email || email.from_address}
            </span>
            {email.has_attachments && (
              <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
          </div>
          <p className={cn(
            "text-sm truncate",
            !email.is_read ? "font-medium" : ""
          )}>
            {email.subject || "(No subject)"}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {email.snippet || email.body_preview}
          </p>
        </div>
        <div className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
          {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
        </div>
      </div>
    </div>
  );
});

// Memoized folder button component for performance
const FolderButton = memo(function FolderButton({
  folder,
  accountId,
  isSelected,
  onSelect,
}: {
  folder: EmailFolder;
  accountId: string;
  isSelected: boolean;
  onSelect: (accountId: string, folder: EmailFolder) => void;
}) {
  const Icon = FOLDER_ICONS[folder.type] || FOLDER_ICONS.folder;
  const depth = folder.depth || 0;

  return (
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

  const [search, setSearch] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ to: string; subject: string; messageId?: string; fromAccountId?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Split Inbox State
  const [viewMode, setViewMode] = useState<"split" | "folders">("split");
  const splitInbox = useSplitInbox();

  const fetchEmails = useCallback(async (page = 1) => {
    if (!selectedAccount) {
      setEmails([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "50",
        my_emails: "true",
      });

      if (search) {
        params.append("search", search);
      }

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
  }, [search, selectedAccount]);

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

        // Auto-select inbox folder if this is the selected account
        if (accountId === selectedAccount) {
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

  const handleReply = (email: Email) => {
    setReplyTo({
      to: email.from_email || email.from_address,
      subject: email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
      fromAccountId: selectedAccount, // Reply from the same account that received the email
    });
    setComposeOpen(true);
  };

  const handleCompose = () => {
    setReplyTo(null);
    setComposeOpen(true);
  };

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

  return (
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
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </div>

        {/* Rules Link */}
        <div className="p-3 border-t">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => router.push("/email/rules")}
          >
            <Settings2 className="h-4 w-4 mr-2" />
            Email Rules
          </Button>
        </div>
      </div>

      {/* Middle - Email List */}
      <div className="w-[400px] border-r flex flex-col shrink-0">
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
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={viewMode === "split" ? splitInbox.refresh : handleSync}
              disabled={syncing || splitInbox.loading || (viewMode === "folders" && !selectedAccount)}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", (syncing || splitInbox.loading) && "animate-spin")} />
            </Button>
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
          </div>
        )}

        {/* Search - Only in folder mode */}
        {viewMode === "folders" && (
          <div className="px-3 py-2 border-b shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search emails..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchEmails(1)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
        )}

        {/* Email List */}
        <div className="flex-1 overflow-auto">
          {viewMode === "split" ? (
            // Split Inbox View
            splitInbox.loading && !splitInbox.data ? (
              <div className="flex items-center justify-center py-12">
                <Spinner />
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
                    onClick={handleEmailClick}
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
                    onClick={handleEmailClick}
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

      {/* Right - Reading Pane */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
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
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedEmail.received_at), "PPpp")}
                  </p>
                  <div className="flex items-center gap-2 mt-2 justify-end">
                    <Button size="sm" onClick={() => handleReply(selectedEmail)}>
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

      {/* Compose Modal */}
      <ComposeEmailModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultTo={replyTo?.to || ""}
        defaultSubject={replyTo?.subject || ""}
        defaultFromAccountId={replyTo?.fromAccountId}
        onSent={() => {
          fetchEmails();
          setReplyTo(null);
        }}
      />
    </div>
  );
}
