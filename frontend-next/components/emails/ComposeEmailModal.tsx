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
} from "lucide-react";
import { api } from "@/lib/api";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";

interface Contact {
  id: number;
  display_name: string;
  email: string | null;
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

// Christmas signature for robert@teeem.au
const CHRISTMAS_SIGNATURE = `

--
🎄 Merry Christmas & Happy New Year! 🎄

Robert Harder
Product Owner
📱 0407 397 541
🌐 teeem.com.au

Wishing you joy, peace and prosperity in 2025!
`;

interface ComposeEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  replyToMessageId?: string;
  onSent?: () => void;
}

export function ComposeEmailModal({
  open,
  onOpenChange,
  defaultTo = "",
  defaultSubject = "",
  defaultBody = "",
  replyToMessageId,
  onSent,
}: ComposeEmailModalProps) {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);

  const [formData, setFormData] = useState({
    credential_id: "",
    to: defaultTo,
    cc: "",
    bcc: "",
    subject: defaultSubject,
    body: defaultBody,
  });

  const [attachments, setAttachments] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  // Search contacts by name/email
  const searchContacts = async (search: string) => {
    if (!search || search.length < 2) {
      setContacts([]);
      return;
    }
    setContactsLoading(true);
    try {
      const response = await api.get<{ contacts: Contact[] }>(
        `/api/v1/contacts?search=${encodeURIComponent(search)}&with_email=true&per_page=20`
      );
      setContacts((response.contacts || []).filter(c => c.email));
    } catch (err) {
      console.error("Failed to search contacts:", err);
    } finally {
      setContactsLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (contactSearch) {
        searchContacts(contactSearch);
      } else {
        setContacts([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch]);

  // Get signature for account (if applicable)
  const getSignatureForAccount = (account: EmailAccount | undefined): string => {
    if (!account) return "";
    // Christmas signature for robert@teeem.au
    if (account.email_address?.toLowerCase() === "robert@teeem.au") {
      return CHRISTMAS_SIGNATURE;
    }
    return "";
  };

  // Fetch accounts when modal opens
  useEffect(() => {
    if (open) {
      fetchAccounts();
      setContacts([]);
      setContactSearch("");
      setFormData({
        credential_id: "",
        to: defaultTo,
        cc: "",
        bcc: "",
        subject: defaultSubject,
        body: defaultBody,
      });
      setAttachments([]);
      setError(null);
    }
  }, [open, defaultTo, defaultSubject, defaultBody]);

  // Update signature when account changes
  useEffect(() => {
    if (!formData.credential_id || accounts.length === 0) return;

    const account = accounts.find((a) => String(a.id) === formData.credential_id);
    const signature = getSignatureForAccount(account);

    if (signature) {
      // Only add signature if body doesn't already contain it
      setFormData((prev) => {
        if (prev.body.includes("🎄 Merry Christmas")) return prev;
        return { ...prev, body: prev.body + signature };
      });
    }
  }, [formData.credential_id, accounts]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: EmailAccount[] }>("/api/v1/imap_credentials/all_accounts");
      const activeAccounts = (response.data || []).filter(
        (a) => a.is_active
      );
      setAccounts(activeAccounts);

      // Auto-select default account (Outlook) or first account
      const defaultAccount = activeAccounts.find((a) => a.is_default) || activeAccounts[0];
      if (defaultAccount) {
        setFormData((prev) => ({ ...prev, credential_id: String(defaultAccount.id) }));
      }
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
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

    setSending(true);
    try {
      const formPayload = new FormData();
      formPayload.append("credential_id", formData.credential_id);
      formPayload.append("to", formData.to);
      formPayload.append("subject", formData.subject);
      formPayload.append("body", formData.body);

      if (formData.cc) {
        formPayload.append("cc", formData.cc);
      }
      if (formData.bcc) {
        formPayload.append("bcc", formData.bcc);
      }
      if (replyToMessageId) {
        formPayload.append("reply_to_message_id", replyToMessageId);
      }

      attachments.forEach((file) => {
        formPayload.append("attachments[]", file);
      });

      await api.postFormData("/api/v1/imap_credentials/send_email", formPayload);

      onOpenChange(false);
      onSent?.();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || "Failed to send email");
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
                <Select
                  value={formData.credential_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, credential_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={String(account.id)}>
                        <span className="flex items-center gap-2">
                          {account.name || account.email_address}
                          <span className="text-muted-foreground">
                            ({account.email_address})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* To */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>To</Label>
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
                  emptyResults={contactSearch.length < 2 ? "Type 2+ characters to search..." : "No contacts found"}
                  clearable={true}
                  onClear={() => setFormData({ ...formData, to: "" })}
                />
              </div>

              {/* CC/BCC */}
              {showCcBcc && (
                <>
                  <div className="space-y-2">
                    <Label>CC</Label>
                    <Input
                      placeholder="cc@example.com"
                      value={formData.cc}
                      onChange={(e) => setFormData({ ...formData, cc: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>BCC</Label>
                    <Input
                      placeholder="bcc@example.com"
                      value={formData.bcc}
                      onChange={(e) => setFormData({ ...formData, bcc: e.target.value })}
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
                <Textarea
                  placeholder="Type your message..."
                  rows={8}
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                />
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Attachments</Label>
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
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((file, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {file.name}
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
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-md bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                {sending ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
