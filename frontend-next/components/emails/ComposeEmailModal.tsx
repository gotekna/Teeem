"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
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
import { SmartInput } from "@/components/ui/smart-input";
import { Label } from "@/components/ui/label";
import { RichTextEditor, plainTextToHtml } from "@/components/ui/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Send,
  Paperclip,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Save,
} from "lucide-react";
import { api } from "@/lib/api";
import { EmailContactAutocomplete } from "./EmailContactAutocomplete";
import { useUndoSend } from "@/hooks/useUndoSend";
import { useAutoSaveDraft, useEmailDrafts } from "@/hooks/useEmailDrafts";
import { useAuth } from "@/contexts/AuthContext";
import {
  generateSignatureByStyle,
  hasSignature,
  hasSignaturePlaceholder,
  replaceSignaturePlaceholder,
  type SignatureStyleId,
  DEFAULT_SIGNATURE_STYLE,
} from "@/lib/email-signature";
import {
  CONTACT_SEARCH_DEBOUNCE_MS,
  CONTACT_SEARCH_MIN_CHARS,
  CONTACT_SEARCH_MAX_RESULTS,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_TOTAL_ATTACHMENTS_SIZE_BYTES,
} from "@/lib/email-constants";
import { formatFileSize } from "@/utils/formatters";
import type { EmailDraft, EmailAccount, EmailContact } from "@/lib/email-types";
import { LayoutTemplate } from "lucide-react";
import { TemplatePicker, type EmailTemplate } from "./TemplateManager";
import { format, setHours, setMinutes } from "date-fns";

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
  /** Pre-loaded file attachments (e.g., from Task response) */
  initialAttachments?: File[];
  /** SM Task ID to link sent email to task */
  smTaskId?: number;
  /** Skip signature generation (when body already includes signature) */
  skipSignature?: boolean;
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
  initialAttachments,
  smTaskId,
  skipSignature = false,
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
  const [sendMenuOpen, setSendMenuOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  // Memoize slash command handler to prevent TipTap extension recreation
  const handleSlashCommand = useCallback((command: "template") => {
    if (command === "template") {
      setTemplatePickerOpen(true);
    }
  }, []);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("09:00");

  // Undo send hook
  const { queueSend } = useUndoSend();

  // Get current user for signature generation
  const { user: currentUser } = useAuth();

  // Company settings for signature
  const [companySettings, setCompanySettings] = useState<{
    logo_dark?: string;
    logo_url?: string;
    company_name?: string;
    address?: string;
    website?: string;
    phone?: string;
    brand_colors?: { primary?: string; primaryForeground?: string };
  } | null>(null);

  // Store signature separately (not in editor) to preserve HTML formatting
  const [signatureHtml, setSignatureHtml] = useState<string>("");

  // Frequent contacts for quick-add chips
  interface FrequentContact {
    id: number;
    display_name: string;
    email: string;
    email_count: number;
    primary_company?: { id: number; name: string } | null;
  }
  const [frequentContacts, setFrequentContacts] = useState<FrequentContact[]>([]);
  const [frequentContactsLoading, setFrequentContactsLoading] = useState(false);

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

  // Search contacts by name/email (include company info for grouping, job info for context)
  // with_email=true returns contact_emails array for multi-email contacts
  // include_jobs=true returns recent_job for job context
  const searchContacts = async (search: string) => {
    if (!search || search.length < CONTACT_SEARCH_MIN_CHARS) {
      setContacts([]);
      return;
    }
    setContactsLoading(true);
    try {
      const response = await api.get<{ contacts: Contact[] }>(
        `/api/v1/contacts?search=${encodeURIComponent(search)}&with_email=true&include_companies=true&include_jobs=true&per_page=${CONTACT_SEARCH_MAX_RESULTS}`
      );
      const typedResponse = response as { contacts: Contact[] };
      // Filter to contacts that have at least one email (primary or in contact_emails)
      setContacts((typedResponse.contacts || []).filter(c =>
        c.email || (c.contact_emails && c.contact_emails.length > 0)
      ));
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

  // Generate signature from current user data (SSoT: uses user's preferred signature style)
  const getUserSignature = (): string => {
    if (!currentUser) return "";

    // Get user's preferred signature style or fall back to default
    const signatureStyle = ((currentUser as { email_signature_style?: string }).email_signature_style as SignatureStyleId)
      || DEFAULT_SIGNATURE_STYLE;

    return generateSignatureByStyle(
      signatureStyle,
      {
        name: currentUser.name,
        email: currentUser.email,
        mobile_phone: currentUser.mobile_phone as string | undefined,
        job_title: currentUser.job_title as string | undefined,
      },
      companySettings ? {
        name: companySettings.company_name,
        logo_dark: companySettings.logo_dark,
        logo_light: companySettings.logo_url,
        address: companySettings.address,
        website: companySettings.website,
        phone: companySettings.phone,
        brand_color: companySettings.brand_colors?.primary,
        brand_color_foreground: companySettings.brand_colors?.primaryForeground,
      } : undefined
    );
  };

  // Fetch company settings for signature
  useEffect(() => {
    const fetchCompanySettings = async () => {
      try {
        interface CompanySettingsData {
          logo_dark?: string;
          logo_url?: string;
          company_name?: string;
          address?: string;
          website?: string;
          phone?: string;
          brand_colors?: { primary?: string; primaryForeground?: string };
        }
        const response = await api.get<{ success: boolean; data: CompanySettingsData }>(
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

  // Fetch frequent contacts for quick-add chips
  const fetchFrequentContacts = useCallback(async () => {
    setFrequentContactsLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: FrequentContact[] }>(
        '/api/v1/contacts/frequent'
      );
      if (response.data) {
        setFrequentContacts(response.data);
      }
    } catch (err) {
      console.debug('Failed to fetch frequent contacts:', err);
    } finally {
      setFrequentContactsLoading(false);
    }
  }, []);

  // Fetch accounts when modal opens
  useEffect(() => {
    if (open) {
      fetchAccounts();
      fetchFrequentContacts();
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

      setAttachments(initialAttachments || []);
      setError(null);
      setSignatureHtml(""); // Reset signature (will be regenerated when account selected)
      // Reset schedule state
      setIsScheduled(false);
      setScheduledDate(undefined);
      setScheduledTime("09:00");
    }
  }, [open, defaultTo, defaultCc, defaultSubject, defaultBody, draft, initialAttachments]);


  // Generate signature when account is selected and user/company data is available
  useEffect(() => {
    if (!formData.credential_id || accounts.length === 0 || !currentUser) return;

    // Don't add signature to body if it already has one (e.g., from draft)
    if (hasSignature(formData.body)) {
      setSignatureHtml(""); // Clear separate signature since it's in body
      return;
    }

    const signature = getUserSignature();
    setSignatureHtml(signature);
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
      // Handle signature insertion
      // Option 1: Body has placeholder (from Task response) - REPLACE with styled signature
      // Option 2: Normal compose - INSERT signature before blockquote or at end
      let fullBody = formData.body;

      if (signatureHtml && hasSignaturePlaceholder(fullBody)) {
        // Replace the simple placeholder with the user's styled signature
        fullBody = replaceSignaturePlaceholder(fullBody, signatureHtml);
      } else if (signatureHtml && !skipSignature) {
        // Normal flow: insert signature before quoted thread (blockquote)
        const blockquoteIndex = fullBody.indexOf('<blockquote');
        if (blockquoteIndex !== -1) {
          // Insert signature before quoted content
          fullBody = fullBody.slice(0, blockquoteIndex) + signatureHtml + fullBody.slice(blockquoteIndex);
        } else {
          // No quoted content, append signature at end
          fullBody = fullBody + signatureHtml;
        }
      }

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
          body: fullBody,
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
          body: fullBody,
          reply_to_message_id: replyToMessageId,
          attachments: attachments,
          sm_task_id: smTaskId,  // Link sent email to SM task
        });
      }

      // Discard the draft since email was sent
      autoSave.discard();

      onOpenChange(false);
      onSent?.();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || isScheduled ? "Failed to schedule email" : "Failed to send email");
      // Force-save draft on send failure so user doesn't lose their work
      await autoSave.save();
    } finally {
      setSending(false);
    }
  };

  const selectedAccount = accounts.find((a) => String(a.id) === formData.credential_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1400px] h-[90vh] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Compose Email</DialogTitle>
        {/* Outlook-style Header with Send Button */}
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-background">
          {/* Send button with dropdown */}
          <div className="relative flex">
            <Button
              onClick={handleSend}
              disabled={sending || !formData.to || !formData.credential_id}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-r-none"
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
            <Button
              type="button"
              disabled={sending}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-l-none border-l border-blue-500 px-2"
              onClick={() => setSendMenuOpen(!sendMenuOpen)}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            {sendMenuOpen && (
              <div className="absolute top-full left-0 mt-1 w-40 bg-background border rounded-md shadow-lg z-50">
                <button
                  type="button"
                  className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent rounded-t-md"
                  onClick={() => {
                    setIsScheduled(false);
                    setSendMenuOpen(false);
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </button>
                <button
                  type="button"
                  className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent rounded-b-md"
                  onClick={() => {
                    setIsScheduled(true);
                    setSendMenuOpen(false);
                  }}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Schedule send
                </button>
              </div>
            )}
          </div>

          {/* Save Draft Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              await autoSave.save();
              onOpenChange(false);
            }}
            disabled={sending || autoSave.isSaving || !autoSave.hasContent}
            title="Save as draft and close"
          >
            {autoSave.isSaving ? (
              <Spinner className="h-4 w-4 mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Draft
          </Button>

          {/* From Account - native select for reliability inside dialogs */}
          {accounts.length > 0 && (
            <select
              value={formData.credential_id}
              onChange={(e) => {
                const account = accounts.find(a => String(a.id) === e.target.value);
                if (account) {
                  setFormData({
                    ...formData,
                    credential_id: String(account.id),
                    from_address: account.email_address || "",
                  });
                }
              }}
              className="h-9 px-3 text-sm border rounded-md bg-background max-w-[250px]"
            >
              {accounts.map((account) => (
                <option key={account.id} value={String(account.id)}>
                  {account.email_address}
                </option>
              ))}
            </select>
          )}

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

          {/* Schedule date/time picker (shown when scheduled) */}
          {isScheduled && (
            <div className="flex items-center gap-2 ml-auto mr-8">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : ""}
                onChange={(e) => setScheduledDate(e.target.value ? new Date(e.target.value) : undefined)}
                min={format(new Date(), "yyyy-MM-dd")}
                className="w-[130px] h-8 text-xs"
              />
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-[110px] h-8 text-xs"
              />
            </div>
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
          <div className="flex flex-col flex-1 min-h-0">
            {/* To Field - Outlook style */}
            <div className="flex items-center border-b px-4 py-2">
              <span className="text-sm text-muted-foreground w-12 flex-shrink-0">To</span>
              <div className="flex-1 relative">
                <EmailContactAutocomplete
                  value={formData.to}
                  onChange={(value) => setFormData({ ...formData, to: value })}
                  contacts={contacts}
                  isLoading={contactsLoading}
                  onSearch={setContactSearch}
                  minSearchChars={CONTACT_SEARCH_MIN_CHARS}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setShowCcBcc(!showCcBcc)}
              >
                Bcc
              </Button>
            </div>

            {/* Cc Field - Always visible */}
            <div className="flex items-center border-b px-4 py-2">
              <span className="text-sm text-muted-foreground w-12 flex-shrink-0">Cc</span>
              <div className="flex-1 relative">
                <EmailContactAutocomplete
                  value={formData.cc}
                  onChange={(value) => setFormData({ ...formData, cc: value })}
                  contacts={contacts}
                  isLoading={contactsLoading}
                  onSearch={setCcSearch}
                  minSearchChars={CONTACT_SEARCH_MIN_CHARS}
                />
              </div>
            </div>

            {/* Bcc Field */}
            {showCcBcc && (
              <div className="flex items-center border-b px-4 py-2">
                <span className="text-sm text-muted-foreground w-12 flex-shrink-0">Bcc</span>
                <div className="flex-1 relative">
                  <EmailContactAutocomplete
                    value={formData.bcc}
                    onChange={(value) => setFormData({ ...formData, bcc: value })}
                    contacts={contacts}
                    isLoading={contactsLoading}
                    onSearch={setBccSearch}
                    minSearchChars={CONTACT_SEARCH_MIN_CHARS}
                  />
                </div>
              </div>
            )}

            {/* Frequent Contacts - Quick-add chips */}
            {frequentContacts.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20">
                <span className="text-xs text-muted-foreground shrink-0">Quick add:</span>
                <div className="flex flex-wrap gap-1.5 overflow-x-auto">
                  {frequentContacts.slice(0, 8).map((contact) => {
                    // Check if already in To or CC
                    const isInTo = formData.to.toLowerCase().includes(contact.email.toLowerCase());
                    const isInCc = formData.cc.toLowerCase().includes(contact.email.toLowerCase());
                    const isAdded = isInTo || isInCc;

                    return (
                      <div key={contact.id} className="relative group">
                        <button
                          type="button"
                          onClick={() => {
                            if (isAdded) return;
                            // Add to To field
                            const newTo = formData.to
                              ? `${formData.to}, ${contact.email}`
                              : contact.email;
                            setFormData({ ...formData, to: newTo });
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (isAdded) return;
                            // Right-click adds to CC
                            const newCc = formData.cc
                              ? `${formData.cc}, ${contact.email}`
                              : contact.email;
                            setFormData({ ...formData, cc: newCc });
                          }}
                          disabled={isAdded}
                          className={`
                            flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors
                            ${isAdded
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 cursor-default'
                              : 'bg-muted hover:bg-primary/10 hover:text-primary cursor-pointer'}
                          `}
                          title={isAdded
                            ? `Already added to ${isInTo ? 'To' : 'CC'}`
                            : `Click to add to To, right-click to add to CC`}
                        >
                          <span className="truncate max-w-[120px]">
                            {contact.display_name.split(' ')[0]}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {contact.email_count}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Subject - Outlook style underlined */}
            <div className="flex items-center border-b px-4 py-2">
              <SmartInput
                placeholder="Add a subject"
                value={formData.subject}
                onChange={(value: string) => setFormData({ ...formData, subject: value })}
                context="email_subject"
                className="flex-1 w-full border-0 shadow-none text-base px-0 h-8 focus-visible:ring-0"
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
                      className="ml-1 hover:text-red-500 dark:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Body - Large scrollable area */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4">
              <div className="min-h-[400px]">
                <RichTextEditor
                  value={formData.body}
                  onChange={(value) => setFormData({ ...formData, body: value })}
                  placeholder="Type / to insert files and more"
                  minHeight={400}
                  onSlashCommand={handleSlashCommand}
                  enableWritingChecker={true}
                  writingContext="email_body"
                />

                {/* Signature Preview - rendered separately to preserve HTML formatting */}
                {/* Hidden when skipSignature is true (signature already in body) */}
                {signatureHtml && !skipSignature && (
                  <div
                    className="mt-4 pointer-events-none"
                    dangerouslySetInnerHTML={{ __html: signatureHtml }}
                  />
                )}
              </div>
            </div>

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
