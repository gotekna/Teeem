"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDistanceToNow, format } from "date-fns";
import { ComposeEmailModal } from "@/components/emails/ComposeEmailModal";
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
  type: "outlook" | "imap";
  name: string;
  email_address: string;
  provider: string;
  is_active: boolean;
  is_default?: boolean;
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

// Folder structure for each mailbox
const FOLDERS = [
  { id: "inbox", name: "Inbox", icon: Inbox },
  { id: "sent", name: "Sent", icon: Send },
  { id: "drafts", name: "Drafts", icon: FileText },
  { id: "archive", name: "Archive", icon: Archive },
  { id: "trash", name: "Trash", icon: Trash2 },
];

export default function EmailPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
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
  const [selectedFolder, setSelectedFolder] = useState<string>("inbox");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ to: string; subject: string; messageId?: string } | null>(null);

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

  const fetchAccounts = async () => {
    try {
      const response = await api.get<{ success: boolean; data: EmailAccount[] }>(
        "/api/v1/imap_credentials/all_accounts"
      );
      const activeAccounts = (response.data || []).filter(a => a.is_active);
      setAccounts(activeAccounts);

      // Auto-expand and select first account
      if (activeAccounts.length > 0) {
        const defaultAccount = activeAccounts.find(a => a.is_default) || activeAccounts[0];
        setSelectedAccount(String(defaultAccount.id));
        setExpandedAccounts(new Set([String(defaultAccount.id)]));
      }
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

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

  const handleEmailClick = async (email: Email) => {
    setSelectedEmail(email);
    setSheetOpen(true);

    if (!email.body_html && !email.body_text) {
      try {
        const fullEmail = await api.get<Email>(`/api/v1/email_warehouse/${email.id}`);
        setSelectedEmail(fullEmail);
      } catch (error) {
        console.error("Failed to fetch email:", error);
      }
    }
  };

  const handleReply = (email: Email) => {
    setReplyTo({
      to: email.from_email || email.from_address,
      subject: email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
    });
    setComposeOpen(true);
  };

  const handleCompose = () => {
    setReplyTo(null);
    setComposeOpen(true);
  };

  const toggleAccountExpanded = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  const selectAccountFolder = (accountId: string, folderId: string) => {
    setSelectedAccount(accountId);
    setSelectedFolder(folderId);
  };

  const getSelectedAccountName = () => {
    const account = accounts.find(a => String(a.id) === selectedAccount);
    return account?.email_address || "Select mailbox";
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
          {accounts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No mailboxes connected</p>
              <p className="text-xs mt-1">Go to Admin → System → Email Accounts</p>
            </div>
          ) : (
            accounts.map((account) => (
              <div key={String(account.id)} className="mb-1">
                {/* Account Header */}
                <button
                  onClick={() => toggleAccountExpanded(String(account.id))}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors",
                    selectedAccount === String(account.id) && "bg-muted"
                  )}
                >
                  {expandedAccounts.has(String(account.id)) ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronUp className="h-4 w-4 shrink-0 rotate-180" />
                  )}
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1 text-left">{account.email_address}</span>
                </button>

                {/* Folders */}
                {expandedAccounts.has(String(account.id)) && (
                  <div className="ml-4 border-l pl-2">
                    {FOLDERS.map((folder) => {
                      const Icon = folder.icon;
                      const isSelected = selectedAccount === String(account.id) && selectedFolder === folder.id;
                      return (
                        <button
                          key={folder.id}
                          onClick={() => selectAccountFolder(String(account.id), folder.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors rounded-sm",
                            isSelected && "bg-primary/10 text-primary font-medium"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{folder.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content - Email List */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0 bg-background">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">
              {getSelectedAccountName()}
            </h1>
            {selectedAccount && (
              <Badge variant="secondary" className="capitalize">
                {selectedFolder}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              {pagination.total} emails
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || !selectedAccount}>
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              Sync
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4 px-4 py-2 border-b shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchEmails(1)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Email List */}
        <div className="flex-1 overflow-auto">
          {!selectedAccount ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mb-4 opacity-50" />
              <p>Select a mailbox to view emails</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner />
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Inbox className="h-12 w-12 mb-4 opacity-50" />
              <p>No emails in {selectedFolder}</p>
            </div>
          ) : (
            <div className="divide-y">
              {emails.map((email) => (
                <div
                  key={email.id}
                  className="px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleEmailClick(email)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium truncate ${!email.is_read ? "font-semibold" : ""}`}>
                          {email.from_name || email.from_email || email.from_address}
                        </span>
                        {email.has_attachments && (
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        {email.job_number && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {email.job_number}
                          </Badge>
                        )}
                      </div>
                      <p className={`text-sm truncate ${!email.is_read ? "font-medium" : ""}`}>
                        {email.subject || "(No subject)"}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {email.snippet || email.body_preview}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDistanceToNow(new Date(email.received_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t shrink-0">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.total_pages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => fetchEmails(pagination.page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.total_pages}
                onClick={() => fetchEmails(pagination.page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Email Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedEmail && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg font-medium pr-8">
                  {selectedEmail.subject || "(No subject)"}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex items-start justify-between">
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
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(selectedEmail.received_at), "PPpp")}
                    </p>
                  </div>
                </div>

                {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-md">
                    {selectedEmail.attachments.map((att) => (
                      <Badge key={att.id} variant="secondary" className="flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        {att.name}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="border-t pt-4">
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

                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={() => handleReply(selectedEmail)}>
                    Reply
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Compose Modal */}
      <ComposeEmailModal
        open={composeOpen}
        onOpenChange={setComposeOpen}
        defaultTo={replyTo?.to || ""}
        defaultSubject={replyTo?.subject || ""}
        onSent={() => {
          fetchEmails();
          setReplyTo(null);
        }}
      />
    </div>
  );
}
