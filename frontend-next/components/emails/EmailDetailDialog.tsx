"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import {
  Reply,
  ReplyAll,
  Forward,
  Briefcase,
  ExternalLink,
  Calendar,
  User,
  Users,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { AttachmentList, type Attachment } from "./AttachmentList";
import { ComposeEmailModal } from "./ComposeEmailModal";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import { cn } from "@/lib/utils";

/**
 * Strips existing quoted content from email body text.
 * When replying, we only want to quote the NEW content from the email,
 * not the entire thread history that's already embedded in body_text.
 */
function stripQuotedContent(text: string): string {
  if (!text) return "";

  // Normalize line endings (Windows \r\n and old Mac \r to Unix \n)
  let cleanText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Find common quote markers and truncate there
  // (?:^|\n) matches at start of string OR after newline
  // .+? uses non-greedy matching
  const quotePatterns: [RegExp, string][] = [
    [/(?:^|\n)\s*---\s*Original Message\s*---/i, "Original Message"],
    [/(?:^|\n)\s*On .+? wrote:/i, "On ... wrote:"],
    [/(?:^|\n)\s*From:\s+.+?\n\s*Sent:\s+/i, "From/Sent"],
    [/(?:^|\n)\s*From:\s+.+?\n\s*Date:\s+/i, "From/Date"],
    [/(?:^|\n)\s*_{10,}/, "Underscores"],
    [/(?:^|\n)\s*-{10,}/, "Dashes"],
  ];

  let earliestIndex = cleanText.length;

  // Find the earliest quote marker
  for (const [pattern] of quotePatterns) {
    const match = cleanText.match(pattern);
    if (match?.index !== undefined && match.index < earliestIndex) {
      earliestIndex = match.index;
    }
  }

  // Also check for lines starting with > (quoted text) - but only if they appear in a block
  const quotedLineMatch = cleanText.match(/(?:^|\n)\s*>{1,}[^\n]+(?:\n\s*>{1,}[^\n]+){2,}/);
  if (quotedLineMatch?.index !== undefined && quotedLineMatch.index < earliestIndex) {
    earliestIndex = quotedLineMatch.index;
  }

  if (earliestIndex < cleanText.length) {
    cleanText = cleanText.slice(0, earliestIndex).trim();
  }

  return cleanText;
}

/**
 * Resolves cid: URLs in email HTML to actual image URLs.
 * Emails with embedded images use cid: (Content-ID) URLs that browsers can't resolve.
 * If we have synced attachments with inline_url, replace cid: with actual URLs.
 * Otherwise, replace with transparent pixel to prevent console errors.
 */
function resolveInlineImages(html: string, attachments?: Attachment[]): string {
  if (!html) return html;

  // Build a map of content_id -> inline_url for quick lookup
  const cidToUrl = new Map<string, string>();
  if (attachments) {
    for (const att of attachments) {
      if (att.content_id && att.inline_url) {
        // Store both the full content_id and just the filename part
        cidToUrl.set(att.content_id, att.inline_url);
        // Also store by filename (before @) for flexible matching
        const filename = att.content_id.split('@')[0];
        if (filename) {
          cidToUrl.set(filename, att.inline_url);
        }
      }
    }
  }

  // Replace cid: references with actual URLs or transparent pixel
  return html.replace(/src\s*=\s*["']cid:([^"']+)["']/gi, (match, cidRef) => {
    // Try to find matching URL by full content_id or filename
    const url = cidToUrl.get(cidRef) || cidToUrl.get(cidRef.split('@')[0]);
    if (url) {
      return `src="${url}"`;
    }
    // Fallback: transparent 1x1 pixel to prevent console errors
    return 'src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"';
  });
}

// Email detail from API
interface EmailDetailData {
  id: number;
  subject: string | null;
  from_email: string;
  from_name: string | null;
  display_from?: string;
  to_emails: string[];
  cc_emails?: string[];
  received_at: string;
  sent_at?: string | null;
  has_attachments: boolean;
  attachment_count: number;
  body_html?: string | null;
  body_text?: string | null;
  job_id: number | null;
  job_number?: string | null;
  attachments?: Attachment[];
  // Thread
  internet_message_id?: string;
  thread?: EmailDetailData[];
  thread_count?: number;
  // Mailbox info for replies
  mailbox_owner_email?: string;
}

interface Job {
  id: number;
  job_number: string;
  title: string;
}

interface EmailDetailDialogProps {
  emailId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobAssigned?: (jobId: number) => void;
  /** Contact email for highlighting which address was used */
  highlightEmail?: string;
}

export function EmailDetailDialog({
  emailId,
  open,
  onOpenChange,
  onJobAssigned,
  highlightEmail,
}: EmailDetailDialogProps) {
  const [email, setEmail] = useState<EmailDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reply modal state
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyMode, setReplyMode] = useState<"reply" | "replyAll" | "forward">("reply");

  // Job assignment state
  const [assigningJob, setAssigningJob] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Fetch email detail
  useEffect(() => {
    if (!open || !emailId) {
      setEmail(null);
      return;
    }

    const fetchEmail = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<EmailDetailData>(
          `/api/v1/synced_emails/${emailId}`,
          { params: { include_body: true, include_thread: true } }
        );
        setEmail(response);
      } catch (err) {
        console.error("Failed to fetch email:", err);
        setError("Failed to load email");
      } finally {
        setLoading(false);
      }
    };

    fetchEmail();
  }, [emailId, open]);

  // Fetch jobs for assignment
  const fetchJobs = async (search: string) => {
    if (!search || search.length < 2) {
      setJobs([]);
      return;
    }
    setLoadingJobs(true);
    try {
      const response = await api.get<{ records: Job[] }>(
        "/api/v1/foundations/jobs/records",
        { params: { search, per_page: 20 } }
      );
      setJobs(response.records || []);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Assign to job
  const assignToJob = async (jobId: number) => {
    if (!emailId) return;
    setAssigningJob(true);
    try {
      await api.post(`/api/v1/synced_emails/${emailId}/assign_to_job`, {
        job_id: jobId,
      });
      // Update local state
      if (email) {
        const job = jobs.find((j) => j.id === jobId);
        setEmail({
          ...email,
          job_id: jobId,
          job_number: job?.job_number || null,
        });
      }
      onJobAssigned?.(jobId);
    } catch (err) {
      console.error("Failed to assign job:", err);
    } finally {
      setAssigningJob(false);
    }
  };

  // Reply handlers
  const handleReply = (mode: "reply" | "replyAll" | "forward") => {
    setReplyMode(mode);
    setReplyOpen(true);
  };

  // Get reply defaults
  const getReplyDefaults = () => {
    if (!email) return {};

    const replySubject = email.subject?.startsWith("Re:")
      ? email.subject
      : `Re: ${email.subject || ""}`;

    const forwardSubject = email.subject?.startsWith("Fwd:")
      ? email.subject
      : `Fwd: ${email.subject || ""}`;

    // Strip existing quoted content so we only quote this email's NEW content, not entire thread history
    const originalContent = stripQuotedContent(email.body_text || "");

    // Build attachments section if there are attachments (appears before signature)
    let attachmentsHtml = "";
    if (email.has_attachments && email.attachments && email.attachments.length > 0) {
      const attachmentNames = email.attachments.map(a => a.name).join(", ");
      attachmentsHtml = `<p><strong>Attachments:</strong> ${attachmentNames}</p>`;
    }

    // Build quoted body as HTML with blockquote so signature inserts before it
    const quotedHeader = `--- Original Message ---<br>From: ${email.display_from || email.from_email}<br>Date: ${format(new Date(email.received_at), "PPpp")}<br>Subject: ${email.subject || ""}`;
    const quotedContentHtml = originalContent.split("\n").map(line => line || "<br>").join("<br>");
    const quotedBody = `${attachmentsHtml}<blockquote style="margin: 1em 0; padding-left: 1em; border-left: 2px solid #ccc;">${quotedHeader}<br><br>${quotedContentHtml}</blockquote>`;

    // SSoT: Use the mailbox that received this email as the From address for replies
    const mailboxEmail = email.mailbox_owner_email?.toLowerCase();

    switch (replyMode) {
      case "reply":
        return {
          defaultTo: email.from_email,
          defaultSubject: replySubject,
          defaultBody: quotedBody,
          replyToMessageId: email.internet_message_id,
          defaultFromEmail: email.mailbox_owner_email,
        };
      case "replyAll":
        const allRecipients = [
          email.from_email,
          ...(email.to_emails || []),
          ...(email.cc_emails || []),
        ].filter((e, i, arr) => arr.indexOf(e) === i); // Unique
        // Exclude the sender (goes in To) and our mailbox (will be From)
        const ccRecipients = allRecipients.filter(
          (e) => e !== email.from_email && e.toLowerCase() !== mailboxEmail
        );
        return {
          defaultTo: email.from_email,
          defaultCc: ccRecipients.join(", "),
          defaultSubject: replySubject,
          defaultBody: quotedBody,
          replyToMessageId: email.internet_message_id,
          defaultFromEmail: email.mailbox_owner_email,
        };
      case "forward":
        return {
          defaultSubject: forwardSubject,
          defaultBody: quotedBody,
          defaultFromEmail: email.mailbox_owner_email,
        };
      default:
        return {};
    }
  };

  // Check which email address was used
  const getUsedContactEmail = () => {
    if (!email || !highlightEmail) return null;
    const lowerHighlight = highlightEmail.toLowerCase();

    if (email.from_email?.toLowerCase() === lowerHighlight) {
      return { email: email.from_email, direction: "from" as const };
    }
    const toMatch = email.to_emails?.find((e) => e.toLowerCase() === lowerHighlight);
    if (toMatch) {
      return { email: toMatch, direction: "to" as const };
    }
    const ccMatch = email.cc_emails?.find((e) => e.toLowerCase() === lowerHighlight);
    if (ccMatch) {
      return { email: ccMatch, direction: "cc" as const };
    }
    return null;
  };

  const usedEmail = getUsedContactEmail();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[1200px] max-h-[90vh] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden" hideClose aria-describedby={undefined}>
          <DialogTitle className="sr-only">
            {email?.subject || "Email Details"}
          </DialogTitle>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Spinner />
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center text-destructive">
              {error}
            </div>
          ) : email ? (
            <>
              {/* Outlook-style Toolbar Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReply("reply")}
                >
                  <Reply className="h-4 w-4 mr-2" />
                  Reply
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReply("replyAll")}
                >
                  <ReplyAll className="h-4 w-4 mr-2" />
                  Reply All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleReply("forward")}
                >
                  <Forward className="h-4 w-4 mr-2" />
                  Forward
                </Button>

                {/* Job Assignment / View - right aligned */}
                <div className="ml-auto flex items-center gap-2">
                  {!email.job_id ? (
                    <div className="w-56">
                      <ComboboxDropdown
                        placeholder="Link to job..."
                        items={jobs.map((j) => ({
                          id: j.id.toString(),
                          label: `#${j.job_number} - ${j.title}`,
                        }))}
                        onInputChange={fetchJobs}
                        onSelect={(item) => assignToJob(parseInt(item.id))}
                        isLoading={loadingJobs || assigningJob}
                        disableInternalFilter={true}
                        emptyResults="Type 2+ chars to search"
                      />
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      asChild
                    >
                      <a href={`/jobs/${email.job_id}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Job #{email.job_number}
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onOpenChange(false)}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </div>
              </div>

              {/* Subject Line */}
              <div className="px-4 py-3 border-b shrink-0">
                <h1 className="text-lg font-semibold break-words">
                  {email.subject || "(no subject)"}
                </h1>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(email.received_at), "PPpp")}
                  </div>
                  {email.job_id && email.job_number && (
                    <Badge variant="secondary" className="gap-1">
                      <Briefcase className="h-3 w-3" />
                      Job #{email.job_number}
                    </Badge>
                  )}
                </div>
              </div>

              {/* From / To - Outlook inline style */}
              <div className="px-4 py-2 border-b space-y-1 shrink-0">
                <div className="flex items-center text-sm">
                  <span className="text-muted-foreground w-12 flex-shrink-0">From</span>
                  <span className="font-medium">
                    {email.display_from || email.from_email}
                  </span>
                  {usedEmail?.direction === "from" && (
                    <Badge variant="outline" className="text-xs ml-2">Contact Email</Badge>
                  )}
                </div>
                <div className="flex items-center text-sm">
                  <span className="text-muted-foreground w-12 flex-shrink-0">To</span>
                  <span>
                    {email.to_emails?.map((e, i) => (
                      <span key={e}>
                        {i > 0 && ", "}
                        <span className={cn(
                          usedEmail?.direction === "to" && e.toLowerCase() === highlightEmail?.toLowerCase()
                            ? "font-medium text-primary"
                            : ""
                        )}>
                          {e}
                        </span>
                      </span>
                    ))}
                  </span>
                </div>
                {email.cc_emails && email.cc_emails.length > 0 && (
                  <div className="flex items-center text-sm">
                    <span className="text-muted-foreground w-12 flex-shrink-0">Cc</span>
                    <span>
                      {email.cc_emails.map((e, i) => (
                        <span key={e}>
                          {i > 0 && ", "}
                          <span className={cn(
                            usedEmail?.direction === "cc" && e.toLowerCase() === highlightEmail?.toLowerCase()
                              ? "font-medium text-primary"
                              : ""
                          )}>
                            {e}
                          </span>
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>

              {/* Attachments */}
              {email.has_attachments && email.attachments && email.attachments.length > 0 && (
                <div className="px-4 py-2 border-b bg-muted/30 shrink-0">
                  <AttachmentList
                    attachments={email.attachments}
                    emailId={email.id}
                  />
                </div>
              )}

              {/* Body */}
              <div className="flex-1 overflow-auto px-4 py-4">
                {email.body_html ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: resolveInlineImages(email.body_html, email.attachments) }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm font-sans">
                    {email.body_text || "(no content)"}
                  </pre>
                )}

                {/* Thread */}
                {email.thread && email.thread.length > 1 && (
                  <div className="mt-8 space-y-4">
                    <Separator />
                    <h3 className="text-sm font-medium text-muted-foreground">
                      Conversation ({email.thread.length} messages)
                    </h3>
                    {email.thread
                      .filter((t) => t.id !== email.id)
                      .map((threadEmail) => (
                        <div
                          key={threadEmail.id}
                          className="p-4 rounded-lg border bg-muted/30"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">
                              {threadEmail.display_from || threadEmail.from_email}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(threadEmail.received_at), "PPp")}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {threadEmail.body_text?.slice(0, 300) || "(no content)"}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Reply Modal */}
      <ComposeEmailModal
        open={replyOpen}
        onOpenChange={setReplyOpen}
        {...getReplyDefaults()}
        onSent={() => {
          setReplyOpen(false);
        }}
      />
    </>
  );
}
