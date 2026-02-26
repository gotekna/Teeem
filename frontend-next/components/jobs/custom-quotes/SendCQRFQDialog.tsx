"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Paperclip, Mail, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { CustomQuoteSupplierSummary } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Types (shared with SendRFQDialog pattern)
// ─────────────────────────────────────────────────────────────────────────────

interface EmailAccount {
  id: number;
  type: "imap" | "ms365";
  email: string;
  label: string;
}

interface EmailTemplateOption {
  id: number;
  name: string;
  subject: string;
  category: string;
}

interface RfqDocument {
  id: number;
  name: string;
  folder: string | null;
  contentType: string | null;
  size: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface SendCQRFQDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: CustomQuoteSupplierSummary[];
  jobId: number | string;
  onSent: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SendCQRFQDialog({
  open,
  onOpenChange,
  suppliers,
  jobId,
  onSent,
}: SendCQRFQDialogProps) {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [templates, setTemplates] = useState<EmailTemplateOption[]>([]);
  const [documents, setDocuments] = useState<RfqDocument[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([]);
  const [customMessage, setCustomMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const isBulk = suppliers.length > 1;

  // ─────────────────────────────────────────────────────────────────────────
  // Load data on open
  // ─────────────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [accountsRes, templatesRes, docsRes] = await Promise.all([
        api.get<{ success: boolean; data: EmailAccount[] }>("/api/v1/rfq_email_accounts"),
        api.get<{ success: boolean; data: EmailTemplateOption[] }>("/api/v1/rfq_email_templates"),
        api.get<{ success: boolean; data: RfqDocument[] }>(`/api/v1/jobs/${jobId}/rfq_documents`),
      ]);

      const accts = accountsRes?.data || [];
      setAccounts(accts);
      if (accts.length > 0) {
        setSelectedAccount(`${accts[0].type}:${accts[0].id}:${accts[0].email}`);
      }

      setTemplates(templatesRes?.data || []);
      setDocuments(docsRes?.data || []);
    } catch (err) {
      console.error("[SendCQRFQDialog] Failed to load data:", err);
      toast.error("Failed to load email options");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, loadData]);

  // ─────────────────────────────────────────────────────────────────────────
  // Send
  // ─────────────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!selectedAccount) {
      toast.error("Please select an email account");
      return;
    }

    const [accountType, credentialId, mailboxEmail] = selectedAccount.split(":");

    try {
      setSending(true);

      if (isBulk) {
        const res = await api.post<{ success: boolean; data: { sent: number; failed: number } }>(
          "/api/v1/custom_quote_suppliers/bulk_send_rfq",
          {
            supplier_ids: suppliers.map((s) => s.id),
            account_type: accountType,
            credential_id: credentialId,
            mailbox_email: accountType === "ms365" ? mailboxEmail : undefined,
            email_template_id: selectedTemplate || undefined,
            document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
            custom_message: customMessage || undefined,
          }
        );
        toast.success(`Sent ${res?.data?.sent || 0} RFQs`);
      } else {
        await api.post(
          `/api/v1/custom_quote_suppliers/${suppliers[0].id}/send_rfq`,
          {
            account_type: accountType,
            credential_id: credentialId,
            mailbox_email: accountType === "ms365" ? mailboxEmail : undefined,
            email_template_id: selectedTemplate || undefined,
            document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
            custom_message: customMessage || undefined,
          }
        );
        toast.success("RFQ sent");
      }

      onOpenChange(false);
      onSent();
    } catch (err: any) {
      console.error("[SendCQRFQDialog] Send failed:", err);
      toast.error(err?.response?.data?.error || "Failed to send RFQ");
    } finally {
      setSending(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Document toggle
  // ─────────────────────────────────────────────────────────────────────────

  const toggleDoc = (docId: number) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {isBulk ? `Send RFQs (${suppliers.length} suppliers)` : "Send RFQ"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Recipients */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                {isBulk ? `Recipients (${suppliers.length})` : "To"}
              </Label>
              <div className="flex flex-wrap gap-1">
                {suppliers.map((s) => (
                  <Badge key={s.id} variant="secondary" className="text-xs">
                    {s.supplierName || "Unknown"}
                    {s.contactEmail && (
                      <span className="text-muted-foreground ml-1">{s.contactEmail}</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Email account */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Send from</Label>
              {accounts.length === 0 ? (
                <p className="text-sm text-destructive">
                  No email accounts configured. Set up IMAP or MS365 in Settings &gt; Connections.
                </p>
              ) : (
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select email account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem
                        key={`${acc.type}:${acc.id}:${acc.email}`}
                        value={`${acc.type}:${acc.id}:${acc.email}`}
                      >
                        {acc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Email template */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Email template</Label>
              <Select value={selectedTemplate || "default"} onValueChange={(v) => setSelectedTemplate(v === "default" ? "" : v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Default RFQ email" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default RFQ email</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom message */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Additional message (optional)
              </Label>
              <Textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Any additional instructions or notes..."
                className="h-20 text-sm"
              />
            </div>

            {/* Attachments */}
            {documents.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  Attach documents ({selectedDocIds.length} selected)
                </Label>
                <div className="max-h-32 overflow-auto border rounded-md divide-y">
                  {documents.map((doc) => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedDocIds.includes(doc.id)}
                        onCheckedChange={() => toggleDoc(doc.id)}
                      />
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate flex-1">{doc.name}</span>
                      {doc.size && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {(doc.size / 1024).toFixed(0)}KB
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={sending || accounts.length === 0}
              >
                {sending ? (
                  <Spinner className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1" />
                )}
                {isBulk ? `Send ${suppliers.length} RFQs` : "Send RFQ"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
