"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { api } from "@/lib/api";
import { formatDistanceToNow, format } from "date-fns";
import { ComposeEmailModal } from "@/components/emails/ComposeEmailModal";

interface Email {
  id: number;
  subject: string;
  from_address: string;
  from_name: string | null;
  to_addresses: string[];
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

interface ImapCredential {
  id: number;
  name: string;
  email_address: string;
  provider: string;
  is_active: boolean;
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export default function EmailPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [accounts, setAccounts] = useState<ImapCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    per_page: 50,
    total: 0,
    total_pages: 0,
  });

  const [search, setSearch] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<{ to: string; subject: string; messageId?: string } | null>(null);

  const fetchEmails = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "50",
      });

      if (search) {
        params.append("search", search);
      }

      // Filter by IMAP credential if selected
      if (selectedAccount && selectedAccount !== "all" && selectedAccount !== "outlook") {
        params.append("imap_credential_id", selectedAccount);
      }

      const response = await api.get<{ emails: Email[]; pagination: Pagination }>(
        `/api/v1/email_warehouse?${params.toString()}`
      );

      // Filter by source if outlook selected
      let filteredEmails = response.emails || [];
      if (selectedAccount === "outlook") {
        filteredEmails = filteredEmails.filter(e => e.source_type === "outlook");
      } else if (selectedAccount && selectedAccount !== "all") {
        filteredEmails = filteredEmails.filter(
          e => e.source_type === "imap" && String(e.imap_credential_id) === selectedAccount
        );
      }

      setEmails(filteredEmails);
      setPagination(response.pagination);
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setLoading(false);
    }
  }, [search, selectedAccount]);

  const fetchAccounts = async () => {
    try {
      const response = await api.get<{ success: boolean; data: ImapCredential[] }>(
        "/api/v1/imap_credentials"
      );
      setAccounts((response.data || []).filter(a => a.is_active));
    } catch (error) {
      console.error("Failed to fetch accounts:", error);
    }
  };

  useEffect(() => {
    fetchEmails();
    fetchAccounts();
  }, [fetchEmails]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Sync both Outlook and IMAP
      await Promise.all([
        api.post("/api/v1/email_warehouse/sync").catch(() => {}),
        ...accounts.map(a =>
          api.post(`/api/v1/imap_credentials/${a.id}/sync`).catch(() => {})
        ),
      ]);
      // Refresh after a short delay
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

    // Fetch full email with body if not already loaded
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
      to: email.from_address,
      subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
    });
    setComposeOpen(true);
  };

  const handleCompose = () => {
    setReplyTo(null);
    setComposeOpen(true);
  };

  const getSourceBadge = (email: Email) => {
    if (email.source_type === "outlook") {
      return <Badge variant="outline" className="text-xs">Outlook</Badge>;
    }
    const account = accounts.find(a => a.id === email.imap_credential_id);
    return (
      <Badge variant="secondary" className="text-xs">
        {account?.name || account?.email_address || "IMAP"}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6" />
          <div>
            <h1 className="text-xl font-semibold font-serif">Email</h1>
            <p className="text-sm text-muted-foreground">
              {pagination.total} emails
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sync
          </Button>
          <Button size="sm" onClick={handleCompose}>
            <Plus className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 px-4 py-3 border-b shrink-0">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchEmails(1)}
            className="pl-9"
          />
        </div>
        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            <SelectItem value="outlook">Outlook (Microsoft 365)</SelectItem>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={String(account.id)}>
                {account.name || account.email_address}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => fetchEmails(1)}>
          Search
        </Button>
      </div>

      {/* Email List */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Mail className="h-12 w-12 mb-4" />
            <p>No emails found</p>
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
                        {email.from_name || email.from_address}
                      </span>
                      {getSourceBadge(email)}
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
                      {selectedEmail.from_name || selectedEmail.from_address}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedEmail.from_address}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      To: {selectedEmail.to_addresses?.join(", ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(selectedEmail.received_at), "PPpp")}
                    </p>
                    {getSourceBadge(selectedEmail)}
                  </div>
                </div>

                {/* Attachments */}
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

                {/* Email Body */}
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

                {/* Actions */}
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
