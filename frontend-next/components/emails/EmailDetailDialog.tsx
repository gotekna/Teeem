"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
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
  Mail,
  Calendar,
  User,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { AttachmentList, type Attachment } from "./AttachmentList";
import { ComposeEmailModal } from "./ComposeEmailModal";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import { cn } from "@/lib/utils";

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
  thread?: EmailDetailData[];
  thread_count?: number;
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
          `/api/v1/email_warehouse/${emailId}`,
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
      await api.post(`/api/v1/email_warehouse/${emailId}/assign_to_job`, {
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

    const quotedBody = `\n\n--- Original Message ---\nFrom: ${email.display_from || email.from_email}\nDate: ${format(new Date(email.received_at), "PPpp")}\nSubject: ${email.subject || ""}\n\n${email.body_text || ""}`;

    switch (replyMode) {
      case "reply":
        return {
          defaultTo: email.from_email,
          defaultSubject: replySubject,
          defaultBody: quotedBody,
        };
      case "replyAll":
        const allRecipients = [
          email.from_email,
          ...(email.to_emails || []),
          ...(email.cc_emails || []),
        ].filter((e, i, arr) => arr.indexOf(e) === i); // Unique
        return {
          defaultTo: email.from_email,
          defaultCc: allRecipients.filter((e) => e !== email.from_email).join(", "),
          defaultSubject: replySubject,
          defaultBody: quotedBody,
        };
      case "forward":
        return {
          defaultSubject: forwardSubject,
          defaultBody: quotedBody,
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
        <DialogContent className="max-w-[90vw] max-h-[90vh] h-[90vh] flex flex-col p-0" aria-describedby={undefined}>
          {loading ? (
            <DialogHeader className="px-6 py-4 border-b shrink-0">
              <DialogTitle>Loading Email...</DialogTitle>
            </DialogHeader>
          ) : error ? (
            <DialogHeader className="px-6 py-4 border-b shrink-0">
              <DialogTitle>Error</DialogTitle>
            </DialogHeader>
          ) : null}
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
              {/* Header */}
              <DialogHeader className="px-6 py-4 border-b shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <DialogTitle className="text-xl font-semibold truncate">
                      {email.subject || "(no subject)"}
                    </DialogTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReply("reply")}
                    >
                      <Reply className="h-4 w-4 mr-1" />
                      Reply
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReply("replyAll")}
                    >
                      <ReplyAll className="h-4 w-4 mr-1" />
                      Reply All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReply("forward")}
                    >
                      <Forward className="h-4 w-4 mr-1" />
                      Forward
                    </Button>
                    {!email.job_id ? (
                      <div className="w-64">
                        <ComboboxDropdown
                          placeholder="Search jobs to assign..."
                          items={jobs.map((j) => ({
                            id: j.id.toString(),
                            label: `#${j.job_number} - ${j.title}`,
                          }))}
                          onInputChange={fetchJobs}
                          onSelect={(item) => assignToJob(parseInt(item.id))}
                          isLoading={loadingJobs || assigningJob}
                          disableInternalFilter={true}
                          emptyResults="Type 2+ chars to search jobs"
                        />
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        asChild
                      >
                        <a href={`/jobs/${email.job_id}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Job #{email.job_number}
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>

              {/* Email Meta */}
              <div className="px-6 py-3 border-b bg-muted/30 space-y-2 shrink-0">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">From:</span>
                  <span className="text-sm">
                    {email.display_from || email.from_email}
                  </span>
                  {usedEmail?.direction === "from" && (
                    <Badge variant="outline" className="text-xs">Contact Email</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium">To:</span>
                  <span className="text-sm">
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
                        {usedEmail?.direction === "to" && e.toLowerCase() === highlightEmail?.toLowerCase() && (
                          <Badge variant="outline" className="text-xs ml-1">Contact</Badge>
                        )}
                      </span>
                    ))}
                  </span>
                </div>
                {email.cc_emails && email.cc_emails.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">CC:</span>
                    <span className="text-sm">
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
                <div className="px-6 py-3 border-b shrink-0">
                  <AttachmentList
                    attachments={email.attachments}
                    emailId={email.id}
                  />
                </div>
              )}

              {/* Body */}
              <div className="flex-1 overflow-auto px-6 py-4">
                {email.body_html ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: email.body_html }}
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
                    <h3 className="font-medium text-muted-foreground">
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
