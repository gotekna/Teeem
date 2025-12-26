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

  // Get signature for account from database (as HTML)
  const getSignatureForAccount = (account: EmailAccount | undefined): string => {
    if (!account?.email_signature) return "";
    // Return signature with proper separator as HTML
    const signatureLines = account.email_signature.split("\n").join("<br>");
    return `<br><br><p>--<br>${signatureLines}</p>`;
  };

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

  // Update signature when account changes
  useEffect(() => {
    if (!formData.credential_id || accounts.length === 0) return;

    const account = accounts.find((a) => String(a.id) === formData.credential_id);
    const signature = getSignatureForAccount(account);

    if (signature) {
      // Only add signature if body doesn't already contain it (check for HTML separator)
      setFormData((prev) => {
        if (prev.body.includes("--<br>")) return prev;
        return { ...prev, body: prev.body + signature };
      });
    }
  }, [formData.credential_id, accounts]);

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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Compose Email</DialogTitle>
          <DialogDescription>
            Send an email from your connected account.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : accounts.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No email accounts connected. Add an account in Admin → System → Email Accounts.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              {/* From Account */}
              <div className="space-y-2">
                <Label>From</Label>
                <div className="flex gap-2">
                  {/* Account selector */}
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
                    <SelectTrigger className={selectedAccount?.email_aliases?.length ? "w-1/2" : "w-full"}>
                      <SelectValue placeholder="Select account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={String(account.id)}>
                          <span className="flex items-center gap-2">
                            {account.name || account.email_address}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* From address selector (shows when account has aliases) */}
                  {selectedAccount?.email_aliases?.length ? (
                    <Select
                      value={formData.from_address}
                      onValueChange={(value) =>
                        setFormData({ ...formData, from_address: value })
                      }
                    >
                      <SelectTrigger className="w-1/2">
                        <SelectValue placeholder="Send as..." />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Main email address */}
                        <SelectItem value={selectedAccount.email_address}>
                          {selectedAccount.email_address}
                        </SelectItem>
                        {/* Aliases */}
                        {selectedAccount.email_aliases.map((alias) => (
                          <SelectItem key={alias} value={alias}>
                            {alias} <span className="text-muted-foreground ml-1">(alias)</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
                {selectedAccount && !selectedAccount?.email_aliases?.length && (
                  <p className="text-xs text-muted-foreground">
                    Sending as {formData.from_address || selectedAccount.email_address}
                  </p>
                )}
              </div>

              {/* To */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>To</Label>
                    {formData.to && (
                      <Badge variant="secondary" className="h-4 text-[10px] px-1.5">
                        {formData.to.split(",").filter(e => e.trim()).length}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setShowCcBcc(!showCcBcc)}
                    >
                      {showCcBcc ? (
                        <>
                          <ChevronUp className="h-3 w-3 mr-1" />
                          Hide CC/BCC
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3 w-3 mr-1" />
                          Show CC/BCC
                        </>
                      )}
                    </Button>
                    {/* Show recipient counts when collapsed */}
                    {!showCcBcc && formData.cc && (
                      <Badge variant="secondary" className="h-5 text-xs">
                        CC: {formData.cc.split(",").filter(e => e.trim()).length}
                      </Badge>
                    )}
                    {!showCcBcc && formData.bcc && (
                      <Badge variant="secondary" className="h-5 text-xs">
                        BCC: {formData.bcc.split(",").filter(e => e.trim()).length}
                      </Badge>
                    )}
                  </div>
                </div>
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
                  placeholder="Search contacts or type email..."
                  searchInTrigger={true}
                  onInputChange={setContactSearch}
                  disableInternalFilter={true}
                  onCreate={(value) => setFormData({ ...formData, to: value })}
                  renderOnCreate={(value) => (
                    <span>Use: <strong>{value}</strong></span>
                  )}
                  isLoading={contactsLoading}
                  emptyResults={contactSearch.length < CONTACT_SEARCH_MIN_CHARS ? `Type ${CONTACT_SEARCH_MIN_CHARS}+ characters to search...` : "No contacts found"}
                  clearable={true}
                  onClear={() => setFormData({ ...formData, to: "" })}
                />
              </div>

              {/* CC/BCC */}
              {showCcBcc && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>CC</Label>
                      {formData.cc && (
                        <Badge variant="secondary" className="h-4 text-[10px] px-1.5">
                          {formData.cc.split(",").filter(e => e.trim()).length}
                        </Badge>
                      )}
                    </div>
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
                      placeholder="Search contacts or type email..."
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
                      emptyResults={ccSearch.length < CONTACT_SEARCH_MIN_CHARS ? `Type ${CONTACT_SEARCH_MIN_CHARS}+ characters to search...` : "No contacts found"}
                      clearable={true}
                      onClear={() => setFormData({ ...formData, cc: "" })}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>BCC</Label>
                      {formData.bcc && (
                        <Badge variant="secondary" className="h-4 text-[10px] px-1.5">
                          {formData.bcc.split(",").filter(e => e.trim()).length}
                        </Badge>
                      )}
                    </div>
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
                      placeholder="Search contacts or type email..."
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
                      emptyResults={bccSearch.length < CONTACT_SEARCH_MIN_CHARS ? `Type ${CONTACT_SEARCH_MIN_CHARS}+ characters to search...` : "No contacts found"}
                      clearable={true}
                      onClear={() => setFormData({ ...formData, bcc: "" })}
                    />
                  </div>
                </>
              )}

              {/* Subject */}
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  placeholder="Email subject..."
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <Label>Message</Label>
                <RichTextEditor
                  value={formData.body}
                  onChange={(value) => setFormData({ ...formData, body: value })}
                  placeholder="Type your message..."
                  minHeight={180}
                  onSlashCommand={(command) => {
                    if (command === "template") {
                      setTemplatePickerOpen(true);
                    }
                  }}
                />
                {/* Signature Preview - only show when body doesn't already contain signature */}
                {selectedAccount?.email_signature && !formData.body.includes("--<br>") && (
                  <div className="mt-2 p-2 rounded-md bg-muted/50 border border-dashed">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">Signature (will be appended)</span>
                    </div>
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                      --{"\n"}{selectedAccount.email_signature}
                    </div>
                  </div>
                )}
              </div>

              {/* Templates & Attachments toolbar */}
              <div className="flex items-center gap-2 pt-2">
                {/* Template Picker (controlled for slash command support) */}
                <TemplatePicker
                  open={templatePickerOpen}
                  onOpenChange={setTemplatePickerOpen}
                  onSelect={(template, applied) => {
                    // Insert template content into the editor
                    setFormData((prev) => ({
                      ...prev,
                      // Only update subject if template has one and current is empty
                      subject: applied.subject && !prev.subject.trim()
                        ? applied.subject
                        : prev.subject,
                      // Append template body to existing content (or replace if empty)
                      body: prev.body.trim()
                        ? `${prev.body}<br><br>${applied.body_html}`
                        : applied.body_html,
                    }));
                    setTemplatePickerOpen(false);
                  }}
                  trigger={
                    <Button type="button" variant="outline" size="sm">
                      <LayoutTemplate className="h-4 w-4 mr-1" />
                      Templates
                    </Button>
                  }
                />

                {/* Attachments */}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>
                      <Paperclip className="h-4 w-4 mr-1" />
                      Add File
                    </span>
                  </Button>
                </label>
              </div>

              {/* Attachments list */}
              <div className="space-y-2">
                {attachments.length > 0 && (
                  <>
                    <div className="flex flex-wrap gap-2">
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
                    <p className="text-xs text-muted-foreground">
                      Total: {formatFileSize(attachments.reduce((sum, f) => sum + f.size, 0))} / {formatFileSize(MAX_TOTAL_ATTACHMENTS_SIZE_BYTES)}
                    </p>
                  </>
                )}
                {isScheduled && attachments.length > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Note: Attachments are not yet supported for scheduled emails
                  </p>
                )}
              </div>

              {/* Schedule Send */}
              <div className="space-y-3 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="schedule-toggle" className="font-normal cursor-pointer">
                      Schedule send
                    </Label>
                  </div>
                  <Switch
                    id="schedule-toggle"
                    checked={isScheduled}
                    onCheckedChange={setIsScheduled}
                  />
                </div>

                {isScheduled && (
                  <div className="flex items-center gap-3 pl-6">
                    {/* Date picker */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-[140px] justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduledDate ? (
                            format(scheduledDate, "MMM d, yyyy")
                          ) : (
                            <span className="text-muted-foreground">Pick date</span>
                          )}
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

                    {/* Time picker */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">at</span>
                      <Input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-[100px] h-8"
                      />
                    </div>

                    {/* Preview */}
                    {scheduledDate && (
                      <span className="text-xs text-muted-foreground">
                        ({format(getScheduledDateTime()!, "EEE, MMM d 'at' h:mm a")})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-md bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              {/* Close confirmation when there are unsaved changes */}
              {showCloseConfirm ? (
                <>
                  <div className="flex-1 text-sm text-muted-foreground">
                    Save this draft?
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      autoSave.discard();
                      setShowCloseConfirm(false);
                      onOpenChange(false);
                    }}
                  >
                    Discard
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      autoSave.save();
                      setShowCloseConfirm(false);
                      onOpenChange(false);
                    }}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Save draft
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCloseConfirm(false)}
                  >
                    Keep editing
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      // If there's content to save, show confirmation
                      if (autoSave.hasContent && autoSave.isDirty) {
                        setShowCloseConfirm(true);
                      } else {
                        // No content or no changes, just close
                        autoSave.discard();
                        onOpenChange(false);
                      }
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSend} disabled={sending}>
                    {sending ? (
                      <>
                        <Spinner className="h-4 w-4 mr-2" />
                        {isScheduled ? "Scheduling..." : "Sending..."}
                      </>
                    ) : isScheduled ? (
                      <>
                        <Clock className="h-4 w-4 mr-2" />
                        Schedule
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send
                      </>
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
