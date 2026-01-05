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
import { RichTextEditor, plainTextToHtml } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Send,
  Paperclip,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar as CalendarIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import { useUndoSend } from "@/hooks/useUndoSend";
import { useAutoSaveDraft, useEmailDrafts } from "@/hooks/useEmailDrafts";
import { useAuth } from "@/contexts/AuthContext";
import { generateEmailSignature, hasSignature } from "@/lib/email-signature";
import {
  CONTACT_SEARCH_DEBOUNCE_MS,
  CONTACT_SEARCH_MIN_CHARS,
  CONTACT_SEARCH_MAX_RESULTS,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_TOTAL_ATTACHMENTS_SIZE_BYTES,
  formatFileSize,
} from "@/lib/email-constants";
import type { EmailDraft, EmailAccount, EmailContact } from "@/lib/email-types";
import { Calendar } from "@/components/ui/calendar";
import { FileText, LayoutTemplate } from "lucide-react";
import { TemplatePicker, type EmailTemplate } from "./TemplateManager";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { format, addHours, setHours, setMinutes } from "date-fns";

// Use EmailContact as Contact for backwards compatibility
type Contact = EmailContact;

interface ComposeEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTo?: string;
  defaultCc?: string; // For Reply All
  defaultSubject?: string;
  defaultBody?: string;
  replyToMessageId?: string;
  defaultFromAccountId?: string; // Account ID to send from (for replies)
  /** Resume from a saved draft */
  draft?: EmailDraft;
  onSent?: () => void;
}

export function ComposeEmailModal({
  open,
  onOpenChange,
  defaultTo = "",
  defaultCc = "",
  defaultSubject = "",
  defaultBody = "",
  replyToMessageId,
  defaultFromAccountId,
  draft,
  onSent,
}: ComposeEmailModalProps) {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const [formData, setFormData] = useState({
    credential_id: "",
    from_address: "", // Selected from address (main email or alias)
    to: defaultTo,
    cc: "",
    bcc: "",
    subject: defaultSubject,
    body: defaultBody,
  });

  // Draft management
  const { deleteDraft } = useEmailDrafts();

  const [attachments, setAttachments] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [ccSearch, setCcSearch] = useState("");
  const [bccSearch, setBccSearch] = useState("");

  // Schedule send state
  const [isScheduled, setIsScheduled] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("09:00");

  // Undo send hook
  const { queueSend } = useUndoSend();

  // Get current user for signature generation
  const { user: currentUser } = useAuth();

  // Company settings for signature logo
  const [companySettings, setCompanySettings] = useState<{ logo_dark?: string } | null>(null);

  // Auto-save draft hook
  const autoSave = useAutoSaveDraft({
    enabled: open && !sending,
    data: {
      credential_id: formData.credential_id,
      from_address: formData.from_address,
      to: formData.to,
      cc: formData.cc,
      bcc: formData.bcc,
      subject: formData.subject,
      body: formData.body,
      reply_to_message_id: replyToMessageId,
      attachment_names: attachments.map((f) => f.name),
    },
    existingDraftId: draft?.id,
  });

  // Search contacts by name/email
  const searchContacts = async (search: string) => {
    if (!search || search.length < CONTACT_SEARCH_MIN_CHARS) {
      setContacts([]);
      return;
    }
    setContactsLoading(true);
    try {
      const response = await api.get<{ contacts: Contact[] }>(
        `/api/v1/contacts?search=${encodeURIComponent(search)}&with_email=true&per_page=${CONTACT_SEARCH_MAX_RESULTS}`
      );
      const typedResponse = response as { contacts: Contact[] };
      setContacts((typedResponse.contacts || []).filter(c => c.email));
    } catch (err) {
      console.error("Failed to search contacts:", err);
    } finally {
      setContactsLoading(false);
    }
  };

  // Debounced search - triggered by any of the search inputs
  useEffect(() => {
    const activeSearch = contactSearch || ccSearch || bccSearch;
    const timer = setTimeout(() => {
      if (activeSearch) {
        searchContacts(activeSearch);
      } else {
        setContacts([]);
      }
    }, CONTACT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [contactSearch, ccSearch, bccSearch]);

  // Generate signature from current user data (SSoT: branded Tekna signature)
  const getUserSignature = (): string => {
    if (!currentUser) return "";
    return generateEmailSignature(
      {
        name: currentUser.name,
        email: currentUser.email,
        mobile_phone: currentUser.mobile_phone as string | undefined,
        job_title: currentUser.job_title as string | undefined,
      },
      companySettings ? { logo_dark: companySettings.logo_dark } : undefined
    );
  };

  // Fetch company settings for logo
  useEffect(() => {
    const fetchCompanySettings = async () => {
      try {
        const response = await api.get<{ success: boolean; data: { logo_dark?: string } }>(
          "/api/v1/company_settings"
        );
        if (response?.data) {
          setCompanySettings(response.data);
        }
      } catch (err) {
        console.debug("Company settings unavailable for signature");
      }
    };
    if (open && !companySettings) {
      fetchCompanySettings();
    }
  }, [open, companySettings]);

  // Fetch accounts when modal opens
  useEffect(() => {
    if (open) {
      fetchAccounts();
      setContacts([]);
      setContactSearch("");
      setCcSearch("");
      setBccSearch("");
      setShowCloseConfirm(false);

      // If resuming from a draft, use draft data
      if (draft) {
        setFormData({
          credential_id: draft.credential_id,
          from_address: draft.from_address || "",
          to: draft.to,
          cc: draft.cc,
          bcc: draft.bcc,
          subject: draft.subject,
          body: draft.body,
        });
        // Show CC/BCC if draft has those fields
        if (draft.cc || draft.bcc) {
          setShowCcBcc(true);
        }
      } else {
        // Convert plain text body to HTML if it doesn't look like HTML already
        const bodyAsHtml = defaultBody && !defaultBody.includes("<")
          ? plainTextToHtml(defaultBody)
          : defaultBody;
        setFormData({
          credential_id: "",
          from_address: "",
          to: defaultTo,
          cc: defaultCc,
          bcc: "",
          subject: defaultSubject,
          body: bodyAsHtml,
        });
        // Show CC/BCC fields if defaultCc is provided (Reply All)
        if (defaultCc) {
          setShowCcBcc(true);
        }
      }

      setAttachments([]);
      setError(null);
      // Reset schedule state
      setIsScheduled(false);
      setScheduledDate(undefined);
      setScheduledTime("09:00");
    }
  }, [open, defaultTo, defaultCc, defaultSubject, defaultBody, draft]);

  // Add signature when account is selected and user/company data is available
  useEffect(() => {
    if (!formData.credential_id || accounts.length === 0 || !currentUser) return;

    const signature = getUserSignature();

    if (signature) {
      // Only add signature if body doesn't already contain one
      setFormData((prev) => {
        if (hasSignature(prev.body)) return prev;
        return { ...prev, body: prev.body + signature };
      });
    }
  }, [formData.credential_id, accounts, currentUser, companySettings]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: EmailAccount[] }>("/api/v1/imap_credentials/all_accounts");
      const typedResponse = response as { success: boolean; data: EmailAccount[] };
      const activeAccounts = (typedResponse.data || []).filter(
        (a) => a.is_active
      );
      setAccounts(activeAccounts);

      // If a specific account was requested (e.g., for replies), use that
      // Otherwise, fall back to default account or first account
      let accountToSelect: EmailAccount | undefined;

      if (defaultFromAccountId) {
        accountToSelect = activeAccounts.find((a) => String(a.id) === defaultFromAccountId);
      }

      if (!accountToSelect) {
        accountToSelect = activeAccounts.find((a) => a.is_default) || activeAccounts[0];
      }

      if (accountToSelect) {
        setFormData((prev) => ({
          ...prev,
          credential_id: String(accountToSelect!.id),
          from_address: accountToSelect!.email_address,
        }));
      }
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Validate individual file sizes
    const oversizedFiles = files.filter((f) => f.size > MAX_ATTACHMENT_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      const names = oversizedFiles.map((f) => f.name).join(", ");
      setError(
        `File(s) too large: ${names}. Maximum size is ${formatFileSize(MAX_ATTACHMENT_SIZE_BYTES)} per file.`
      );
      return;
    }

    // Calculate total size including existing attachments
    const existingSize = attachments.reduce((sum, f) => sum + f.size, 0);
    const newSize = files.reduce((sum, f) => sum + f.size, 0);
    const totalSize = existingSize + newSize;

    if (totalSize > MAX_TOTAL_ATTACHMENTS_SIZE_BYTES) {
      setError(
        `Total attachments too large (${formatFileSize(totalSize)}). Maximum total is ${formatFileSize(MAX_TOTAL_ATTACHMENTS_SIZE_BYTES)}.`
      );
      return;
    }

    setError(null);
    setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Build scheduled datetime from date and time
  const getScheduledDateTime = (): Date | null => {
    if (!scheduledDate) return null;

    const [hours, minutes] = scheduledTime.split(":").map(Number);
    let dateTime = new Date(scheduledDate);
    dateTime = setHours(dateTime, hours);
    dateTime = setMinutes(dateTime, minutes);
    return dateTime;
  };

  const handleSend = async () => {
    setError(null);

    if (!formData.credential_id) {
      setError("Please select an email account");
      return;
    }

    if (!formData.to.trim()) {
      setError("Please enter a recipient");
      return;
    }

    if (!formData.subject.trim()) {
      setError("Please enter a subject");
      return;
    }

    // Validate scheduled time if scheduling
    if (isScheduled) {
      const scheduledDateTime = getScheduledDateTime();
      if (!scheduledDateTime) {
        setError("Please select a date for scheduled send");
        return;
      }
      if (scheduledDateTime <= new Date()) {
        setError("Scheduled time must be in the future");
        return;
      }
      // Block scheduled send with attachments (not supported yet)
      if (attachments.length > 0) {
        setError("Scheduled emails cannot include attachments. Please remove attachments or send immediately.");
        return;
      }
    }

    setSending(true);
    try {
      if (isScheduled) {
        // Schedule the email
        const scheduledDateTime = getScheduledDateTime()!;

        const payload = {
          credential_id: formData.credential_id,
          from_address: formData.from_address || undefined,
          to: [formData.to],
          cc: formData.cc ? [formData.cc] : [],
          bcc: formData.bcc ? [formData.bcc] : [],
          subject: formData.subject,
          body: formData.body,
          reply_to_message_id: replyToMessageId,
          scheduled_for: scheduledDateTime.toISOString(),
        };

        await api.post("/api/v1/imap_credentials/schedule_email", payload);
      } else {
        // Queue with undo capability (see UNDO_DELAY_SECONDS in email-constants.ts)
        queueSend({
          credential_id: formData.credential_id,
          from_address: formData.from_address || undefined,
          to: formData.to,
          cc: formData.cc || undefined,
          bcc: formData.bcc || undefined,
          subject: formData.subject,
          body: formData.body,
          reply_to_message_id: replyToMessageId,
          attachments: attachments,
        });
      }

      // Discard the draft since email was sent
      autoSave.discard();

      onOpenChange(false);
      onSent?.();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || isScheduled ? "Failed to schedule email" : "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const selectedAccount = accounts.find((a) => String(a.id) === formData.credential_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 gap-0 overflow-hidden">
        {/* Outlook-style Header with Send Button */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-background">
          <Button
            onClick={handleSend}
            disabled={sending || !formData.to || !formData.credential_id}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {sending ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                {isScheduled ? "Scheduling..." : "Sending..."}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {isScheduled ? "Schedule" : "Send"}
              </>
            )}
          </Button>

          {/* Attachments */}
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button type="button" variant="ghost" size="sm" asChild>
              <span>
                <Paperclip className="h-4 w-4" />
              </span>
            </Button>
          </label>

          {/* Templates */}
          <TemplatePicker
            open={templatePickerOpen}
            onOpenChange={setTemplatePickerOpen}
            onSelect={(template, applied) => {
              setFormData((prev) => ({
                ...prev,
                subject: applied.subject && !prev.subject.trim() ? applied.subject : prev.subject,
                body: prev.body.trim() ? `${prev.body}<br><br>${applied.body_html}` : applied.body_html,
              }));
              setTemplatePickerOpen(false);
            }}
            trigger={
              <Button type="button" variant="ghost" size="sm">
                <LayoutTemplate className="h-4 w-4" />
              </Button>
            }
          />

          {/* Schedule toggle */}
          <div className="flex items-center gap-2 ml-auto">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Switch
              id="schedule-toggle"
              checked={isScheduled}
              onCheckedChange={setIsScheduled}
            />
            {isScheduled && scheduledDate && (
              <span className="text-xs text-muted-foreground">
                {format(getScheduledDateTime()!, "MMM d, h:mm a")}
              </span>
            )}
          </div>

          {/* From Account (compact) */}
          {accounts.length > 1 && (
            <Select
              value={formData.credential_id}
              onValueChange={(value) => {
                const account = accounts.find((a) => String(a.id) === value);
                setFormData({
                  ...formData,
                  credential_id: value,
                  from_address: account?.email_address || "",
                });
              }}
            >
              <SelectTrigger className="w-auto h-8 text-xs">
                <SelectValue placeholder="Account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.name || account.email_address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground mb-4">
              No email accounts connected. Add an account in Admin → System → Email Accounts.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* To Field - Outlook style */}
            <div className="flex items-center border-b px-4 py-2">
              <span className="text-sm text-muted-foreground w-12 flex-shrink-0">To</span>
              <div className="flex-1">
                <ComboboxDropdown
                  items={contacts.map((c) => ({
                    id: c.email || "",
                    label: `${c.display_name} (${c.email})`,
                  }))}
                  selectedItem={
                    formData.to
                      ? { id: formData.to, label: formData.to }
                      : undefined
                  }
                  onSelect={(item) => setFormData({ ...formData, to: item.id })}
                  placeholder="Enter recipient..."
                  searchInTrigger={true}
                  onInputChange={setContactSearch}
                  disableInternalFilter={true}
                  onCreate={(value) => setFormData({ ...formData, to: value })}
                  renderOnCreate={(value) => (
                    <span>Use: <strong>{value}</strong></span>
                  )}
                  isLoading={contactsLoading}
                  emptyResults={contactSearch.length < CONTACT_SEARCH_MIN_CHARS ? `Type ${CONTACT_SEARCH_MIN_CHARS}+ characters...` : "No contacts found"}
                  clearable={true}
                  onClear={() => setFormData({ ...formData, to: "" })}
                  headless={true}
                  className="border-0 shadow-none"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setShowCcBcc(!showCcBcc)}
              >
                {showCcBcc ? "Hide" : "Cc Bcc"}
              </Button>
            </div>

            {/* Cc Field */}
            {showCcBcc && (
              <div className="flex items-center border-b px-4 py-2">
                <span className="text-sm text-muted-foreground w-12 flex-shrink-0">Cc</span>
                <div className="flex-1">
                  <ComboboxDropdown
                    items={contacts.map((c) => ({
                      id: c.email || "",
                      label: `${c.display_name} (${c.email})`,
                    }))}
                    selectedItem={
                      formData.cc
                        ? { id: formData.cc, label: formData.cc }
                        : undefined
                    }
                    onSelect={(item) => {
                      setFormData({ ...formData, cc: item.id });
                      setCcSearch("");
                    }}
                    placeholder="Add Cc..."
                    searchInTrigger={true}
                    onInputChange={setCcSearch}
                    disableInternalFilter={true}
                    onCreate={(value) => {
                      setFormData({ ...formData, cc: value });
                      setCcSearch("");
                    }}
                    renderOnCreate={(value) => (
                      <span>Use: <strong>{value}</strong></span>
                    )}
                    isLoading={contactsLoading && ccSearch.length >= CONTACT_SEARCH_MIN_CHARS}
                    emptyResults={ccSearch.length < CONTACT_SEARCH_MIN_CHARS ? `Type ${CONTACT_SEARCH_MIN_CHARS}+ characters...` : "No contacts found"}
                    clearable={true}
                    onClear={() => setFormData({ ...formData, cc: "" })}
                    headless={true}
                    className="border-0 shadow-none"
                  />
                </div>
              </div>
            )}

            {/* Bcc Field */}
            {showCcBcc && (
              <div className="flex items-center border-b px-4 py-2">
                <span className="text-sm text-muted-foreground w-12 flex-shrink-0">Bcc</span>
                <div className="flex-1">
                  <ComboboxDropdown
                    items={contacts.map((c) => ({
                      id: c.email || "",
                      label: `${c.display_name} (${c.email})`,
                    }))}
                    selectedItem={
                      formData.bcc
                        ? { id: formData.bcc, label: formData.bcc }
                        : undefined
                    }
                    onSelect={(item) => {
                      setFormData({ ...formData, bcc: item.id });
                      setBccSearch("");
                    }}
                    placeholder="Add Bcc..."
                    searchInTrigger={true}
                    onInputChange={setBccSearch}
                    disableInternalFilter={true}
                    onCreate={(value) => {
                      setFormData({ ...formData, bcc: value });
                      setBccSearch("");
                    }}
                    renderOnCreate={(value) => (
                      <span>Use: <strong>{value}</strong></span>
                    )}
                    isLoading={contactsLoading && bccSearch.length >= CONTACT_SEARCH_MIN_CHARS}
                    emptyResults={bccSearch.length < CONTACT_SEARCH_MIN_CHARS ? `Type ${CONTACT_SEARCH_MIN_CHARS}+ characters...` : "No contacts found"}
                    clearable={true}
                    onClear={() => setFormData({ ...formData, bcc: "" })}
                    headless={true}
                    className="border-0 shadow-none"
                  />
                </div>
              </div>
            )}

            {/* Subject - Outlook style underlined */}
            <div className="flex items-center border-b px-4 py-2">
              <Input
                placeholder="Add a subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="border-0 shadow-none text-base px-0 focus-visible:ring-0"
              />
            </div>

            {/* Attachments bar */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-4 py-2 border-b bg-muted/30">
                {attachments.map((file, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    {file.name}
                    <span className="text-xs text-muted-foreground ml-1">
                      ({formatFileSize(file.size)})
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Body - Large area */}
            <div className="flex-1 min-h-[350px] p-4">
              <RichTextEditor
                value={formData.body}
                onChange={(value) => setFormData({ ...formData, body: value })}
                placeholder="Type / to insert files and more"
                minHeight={320}
                onSlashCommand={(command) => {
                  if (command === "template") {
                    setTemplatePickerOpen(true);
                  }
                }}
              />
            </div>

            {/* Schedule picker (when enabled) */}
            {isScheduled && (
              <div className="flex items-center gap-3 px-4 py-3 border-t bg-muted/30">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Schedule for:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-[140px] justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate ? format(scheduledDate, "MMM d, yyyy") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-sm text-muted-foreground">at</span>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-[100px] h-8"
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="px-4 py-3 bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400 border-t">
                {error}
              </div>
            )}

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
