"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  Search,
  ExternalLink,
  Paperclip,
  ChevronLeft,
  RefreshCw,
  Loader2,
  Clock,
  Send,
  Inbox,
  X,
} from "lucide-react";
import { formatDistanceToNow, format, isToday, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

interface Email {
  id: number;
  subject: string;
  from_email: string;
  from_name: string | null;
  to_emails: string[];
  received_at: string;
  body_text: string;
  body_html: string;
  has_attachments: boolean;
  is_read: boolean;
  is_sent: boolean;
  job_id: number | null;
  job_code: string | null;
  attachment_count?: number;
}

interface MailboxDrawerProps {
  mailbox: string;
  jobId?: number;  // Optional job filter
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * MailboxDrawer - Sheet component showing emails from a specific mailbox
 *
 * Used in File Warehouse when clicking on a mailbox folder:
 * - Single-click opens this drawer
 * - Double-click opens /email?mailbox=xxx in new window
 */
export function MailboxDrawer({ mailbox, jobId, open, onOpenChange }: MailboxDrawerProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch emails for this mailbox
  const fetchEmails = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (!mailbox) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("mailbox", mailbox);
      params.set("page", pageNum.toString());
      params.set("per_page", "50");
      if (jobId) {
        params.set("job_id", jobId.toString());
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }

      const response = await api.get<{
        success: boolean;
        data: {
          emails: Email[];
          total_count: number;
          total_pages: number;
          current_page: number;
        };
      }>(`/api/v1/synced_emails?${params.toString()}`);

      if (response?.success && response.data) {
        if (append) {
          setEmails(prev => [...prev, ...response.data.emails]);
        } else {
          setEmails(response.data.emails);
        }
        setTotalCount(response.data.total_count);
        setHasMore(response.data.current_page < response.data.total_pages);
      }
    } catch (error) {
      console.error("Failed to fetch emails:", error);
    } finally {
      setLoading(false);
    }
  }, [mailbox, jobId, searchQuery]);

  // Fetch on open
  useEffect(() => {
    if (open && mailbox) {
      setPage(1);
      setSelectedEmail(null);
      fetchEmails(1, false);
    }
  }, [open, mailbox, fetchEmails]);

  // Search debounce
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setPage(1);
      fetchEmails(1, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, open, fetchEmails]);

  // Load more
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchEmails(nextPage, true);
  }, [loading, hasMore, page, fetchEmails]);

  // Format date for email list
  const formatEmailDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, "h:mm a");
    }
    const daysDiff = differenceInDays(new Date(), date);
    if (daysDiff < 7) {
      return format(date, "EEE");
    }
    return format(date, "MMM d");
  };

  // Filtered emails based on search (client-side)
  const filteredEmails = useMemo(() => {
    if (!searchQuery) return emails;
    const query = searchQuery.toLowerCase();
    return emails.filter(
      email =>
        email.subject?.toLowerCase().includes(query) ||
        email.from_email?.toLowerCase().includes(query) ||
        email.from_name?.toLowerCase().includes(query) ||
        email.body_text?.toLowerCase().includes(query)
    );
  }, [emails, searchQuery]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right-wide" className="flex flex-col p-0 bg-background">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedEmail ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedEmail(null)}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              ) : null}
              <SheetTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
                {mailbox}
                {jobId && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Job #{jobId}
                  </Badge>
                )}
              </SheetTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fetchEmails(1, false)}
                disabled={loading}
                className="h-8 w-8"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(`/email?mailbox=${encodeURIComponent(mailbox)}`, "_blank")}
                className="h-8 w-8"
                title="Open in full email view"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <SheetDescription className="sr-only">
            Viewing emails from {mailbox}
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {selectedEmail ? (
            // Email detail view
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b bg-muted/30">
                <h3 className="font-semibold text-lg line-clamp-2">{selectedEmail.subject || "(No subject)"}</h3>
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    {selectedEmail.is_sent ? (
                      <Send className="h-3 w-3" />
                    ) : (
                      <Inbox className="h-3 w-3" />
                    )}
                    <span className="font-medium text-foreground">
                      {selectedEmail.from_name || selectedEmail.from_email}
                    </span>
                  </div>
                  {selectedEmail.from_name && (
                    <span className="text-xs">&lt;{selectedEmail.from_email}&gt;</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {format(new Date(selectedEmail.received_at), "PPpp")}
                  {selectedEmail.has_attachments && (
                    <div className="flex items-center gap-1 ml-2">
                      <Paperclip className="h-3 w-3" />
                      {selectedEmail.attachment_count || "Attachments"}
                    </div>
                  )}
                  {selectedEmail.job_code && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {selectedEmail.job_code}
                    </Badge>
                  )}
                </div>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4">
                  {selectedEmail.body_html ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-sm">
                      {selectedEmail.body_text}
                    </pre>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            // Email list view
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search */}
              <div className="px-4 py-2 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search emails..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {totalCount.toLocaleString()} emails
                </div>
              </div>

              {/* Email list */}
              <ScrollArea className="flex-1">
                {loading && emails.length === 0 ? (
                  <div className="p-4 space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex gap-3 p-3 border rounded-lg">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredEmails.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <Mail className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-sm">No emails found</p>
                    {searchQuery && (
                      <p className="text-xs mt-1">Try a different search term</p>
                    )}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredEmails.map((email) => (
                      <div
                        key={email.id}
                        className={cn(
                          "flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors",
                          !email.is_read && "bg-primary/5"
                        )}
                        onClick={() => setSelectedEmail(email)}
                      >
                        <div className={cn(
                          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                          email.is_sent
                            ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {email.is_sent ? (
                            <Send className="h-4 w-4" />
                          ) : (
                            (email.from_name?.[0] || email.from_email?.[0] || "?").toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "font-medium text-sm truncate",
                              !email.is_read && "font-semibold"
                            )}>
                              {email.is_sent ? "To: " : ""}{email.from_name || email.from_email}
                            </span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatEmailDate(email.received_at)}
                            </span>
                          </div>
                          <p className={cn(
                            "text-sm truncate",
                            !email.is_read ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {email.subject || "(No subject)"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {email.body_text?.slice(0, 100)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {email.has_attachments && (
                            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {email.job_code && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {email.job_code}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Load more button */}
                    {hasMore && (
                      <div className="p-4 flex justify-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={loadMore}
                          disabled={loading}
                        >
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            "Load more"
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
