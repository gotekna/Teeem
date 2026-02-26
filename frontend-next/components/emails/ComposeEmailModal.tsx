"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmailComposePane, type EmailComposePaneProps } from "./EmailComposePane";
import type { EmailDraft, PreUploadedAttachment } from "@/lib/email-types";

interface ComposeEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTo?: string;
  defaultCc?: string; // For Reply All
  defaultSubject?: string;
  defaultBody?: string;
  replyToMessageId?: string;
  defaultFromAccountId?: string; // Account ID to send from (for replies)
  defaultFromEmail?: string; // Email address to find account for (alternative to ID)
  /** Resume from a saved draft */
  draft?: EmailDraft;
  /** Pre-loaded file attachments (e.g., from Task response) */
  initialAttachments?: File[];
  /** SSoT: Existing storage keys for files already in S3 (Ultra fix Jan 2026)
   * Pass these directly to backend - avoids re-downloading and re-uploading */
  initialExistingStorageKeys?: string[];
  /** Pre-uploaded attachments with display names (Ultra fix Jan 2026)
   * These show in attachment bar but use storage_key on send (no re-upload) */
  initialPreUploadedAttachments?: PreUploadedAttachment[];
  /** SM Task ID to link sent email to task */
  smTaskId?: number;
  /** Skip signature generation (when body already includes signature) */
  skipSignature?: boolean;
  /** Forward: original email ID for fetching attachments */
  forwardEmailId?: number;
  /** Forward: attachment metadata from the original email */
  forwardAttachments?: Array<{id: number | null; name: string; content_type: string; size: number; outlook_attachment_id?: string}>;
  /** Reply: original email ID (for fetching attachments on demand) */
  originalEmailId?: number;
  /** Reply: attachment metadata from the original email (shown as "Attach Original" button) */
  originalAttachments?: Array<{id: number | null; name: string; content_type: string; size: number; outlook_attachment_id?: string}>;
  onSent?: () => void;
}

export function ComposeEmailModal({
  open,
  onOpenChange,
  defaultTo,
  defaultCc,
  defaultSubject,
  defaultBody,
  replyToMessageId,
  defaultFromAccountId,
  defaultFromEmail,
  draft,
  initialAttachments,
  initialExistingStorageKeys,
  initialPreUploadedAttachments,
  smTaskId,
  skipSignature,
  forwardEmailId,
  forwardAttachments,
  originalEmailId,
  originalAttachments,
  onSent,
}: ComposeEmailModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1400px] h-[90vh] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col" aria-describedby={undefined}>
        <DialogTitle className="sr-only">Compose Email</DialogTitle>
        <EmailComposePane
          isActive={open}
          onClose={() => onOpenChange(false)}
          defaultTo={defaultTo}
          defaultCc={defaultCc}
          defaultSubject={defaultSubject}
          defaultBody={defaultBody}
          replyToMessageId={replyToMessageId}
          defaultFromAccountId={defaultFromAccountId}
          defaultFromEmail={defaultFromEmail}
          draft={draft}
          initialAttachments={initialAttachments}
          initialExistingStorageKeys={initialExistingStorageKeys}
          initialPreUploadedAttachments={initialPreUploadedAttachments}
          smTaskId={smTaskId}
          skipSignature={skipSignature}
          forwardEmailId={forwardEmailId}
          forwardAttachments={forwardAttachments}
          originalEmailId={originalEmailId}
          originalAttachments={originalAttachments}
          onSent={onSent}
        />
      </DialogContent>
    </Dialog>
  );
}
