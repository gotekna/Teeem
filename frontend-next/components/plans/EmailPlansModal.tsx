"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Send,
  FileText,
  User,
  Building2,
  HardHat,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { EmailContactAutocomplete } from "@/components/emails/EmailContactAutocomplete";
import type { EmailContact } from "@/lib/email-types";

const CONTACT_SEARCH_MIN_CHARS = 2;
const CONTACT_SEARCH_DEBOUNCE_MS = 300;

interface JobPlan {
  id: number;
  display_name: string;
  current_revision?: {
    revision_label: string;
    has_file: boolean;
    file_name: string | null;
  } | null;
}

interface SuggestedRecipient {
  id: number;
  name: string;
  email: string;
  role: string;
  type: "client" | "supervisor" | "contractor" | "contact";
}

interface EmailPlansModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: number;
  jobTitle: string;
  selectedPlans: JobPlan[];
  onSent?: () => void;
}

export function EmailPlansModal({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  selectedPlans,
  onSent,
}: EmailPlansModalProps) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [suggestedRecipients, setSuggestedRecipients] = useState<SuggestedRecipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [additionalRecipients, setAdditionalRecipients] = useState<string[]>([]);
  const [senderEmail, setSenderEmail] = useState<string>("");

  // Contact search state for autocomplete
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Search contacts for autocomplete
  const searchContacts = async (search: string) => {
    if (!search || search.length < CONTACT_SEARCH_MIN_CHARS) {
      setContacts([]);
      return;
    }
    setContactsLoading(true);
    try {
      const response = await api.get<{ contacts: EmailContact[] }>(
        `/api/v1/contacts?search=${encodeURIComponent(search)}&with_email=true&include_companies=true&include_jobs=true&per_page=20`
      );
      const typedResponse = response as { contacts: EmailContact[] };
      setContacts((typedResponse.contacts || []).filter(c =>
        c.email || (c.contact_emails && c.contact_emails.length > 0)
      ));
    } catch (err) {
      console.error("Failed to search contacts:", err);
    } finally {
      setContactsLoading(false);
    }
  };

  // Debounced contact search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (contactSearch) {
        searchContacts(contactSearch);
      } else {
        setContacts([]);
      }
    }, CONTACT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [contactSearch]);

  // Fetch suggested recipients when modal opens
  useEffect(() => {
    if (open) {
      fetchSuggestedRecipients();
      // Set default subject
      const planNames = selectedPlans.map(p => p.display_name).join(", ");
      setSubject(`Plans for ${jobTitle}: ${planNames}`);
      setBody(`Hi,\n\nPlease find attached the following plans for ${jobTitle}:\n\n${selectedPlans.map(p => `- ${p.display_name}${p.current_revision ? ` (Rev ${p.current_revision.revision_label})` : ""}`).join("\n")}\n\nPlease let us know if you have any questions.\n\nBest regards`);
      setSelectedRecipients([]);
      setAdditionalRecipients([]);
      setError(null);
    }
  }, [open, jobId, jobTitle, selectedPlans]);

  const fetchSuggestedRecipients = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: SuggestedRecipient[]; sender_email?: string }>(
        `/api/v1/jobs/${jobId}/job_plans/suggested_recipients`
      );
      if (response.success) {
        setSuggestedRecipients(response.data || []);
        if (response.sender_email) {
          setSenderEmail(response.sender_email);
        }
      }
    } catch (err) {
      console.error("Failed to fetch suggested recipients:", err);
      setSuggestedRecipients([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleRecipient = (email: string) => {
    setSelectedRecipients(prev =>
      prev.includes(email)
        ? prev.filter(e => e !== email)
        : [...prev, email]
    );
  };

  const getRecipientIcon = (type: string) => {
    switch (type) {
      case "client":
        return <User className="h-4 w-4" />;
      case "supervisor":
        return <HardHat className="h-4 w-4" />;
      case "contractor":
        return <Building2 className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const handleSend = async () => {
    setError(null);

    // Combine suggested recipients selection with additional recipients from autocomplete
    const allRecipients = [...selectedRecipients, ...additionalRecipients];

    if (allRecipients.length === 0) {
      setError("Please select at least one recipient");
      return;
    }

    if (!subject.trim()) {
      setError("Please enter a subject");
      return;
    }

    // Check if any plans have files
    const plansWithFiles = selectedPlans.filter(p => p.current_revision?.has_file);
    if (plansWithFiles.length === 0) {
      setError("None of the selected plans have files attached");
      return;
    }

    setSending(true);
    try {
      const response = await api.post<{ success: boolean; message: string; error?: string }>(
        `/api/v1/jobs/${jobId}/job_plans/email`,
        {
          plan_ids: selectedPlans.map(p => p.id),
          recipients: allRecipients,
          subject,
          body,
        }
      );

      if (response?.success) {
        onOpenChange(false);
        onSent?.();
      } else {
        setError(response?.error || "Failed to send email");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email Plans</DialogTitle>
          <DialogDescription>
            Send {selectedPlans.length} plan{selectedPlans.length !== 1 ? "s" : ""} to recipients.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* From Email */}
            {senderEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Label className="text-muted-foreground">From:</Label>
                <span className="font-medium">{senderEmail}</span>
              </div>
            )}

            {/* Selected Plans Summary */}
            <div className="space-y-2">
              <Label>Plans to Send</Label>
              <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
                {selectedPlans.map(plan => (
                  <Badge key={plan.id} variant="secondary" className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {plan.display_name}
                    {plan.current_revision && (
                      <span className="text-xs opacity-70">
                        Rev {plan.current_revision.revision_label}
                      </span>
                    )}
                    {!plan.current_revision?.has_file && (
                      <span className="text-xs text-red-500 dark:text-red-400">(no file)</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Suggested Recipients */}
            {suggestedRecipients.length > 0 && (
              <div className="space-y-2">
                <Label>Suggested Recipients</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {suggestedRecipients.map(recipient => (
                    <div
                      key={recipient.email}
                      className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleRecipient(recipient.email)}
                    >
                      <Checkbox
                        checked={selectedRecipients.includes(recipient.email)}
                        onCheckedChange={() => toggleRecipient(recipient.email)}
                      />
                      <div className="flex items-center gap-2 text-muted-foreground">
                        {getRecipientIcon(recipient.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{recipient.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {recipient.email}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {recipient.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Additional Recipients - with contact autocomplete */}
            <div className="space-y-2">
              <Label>Additional Recipients</Label>
              <EmailContactAutocomplete
                value={additionalRecipients.join(", ")}
                onChange={(value) => {
                  // Parse comma-separated emails into array
                  const emails = value.split(",").map(e => e.trim()).filter(Boolean);
                  setAdditionalRecipients(emails);
                }}
                contacts={contacts}
                isLoading={contactsLoading}
                onSearch={setContactSearch}
                placeholder="Search contacts or enter email..."
                minSearchChars={CONTACT_SEARCH_MIN_CHARS}
              />
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Email subject..."
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                rows={8}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Type your message..."
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-md bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || loading}>
            {sending ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
