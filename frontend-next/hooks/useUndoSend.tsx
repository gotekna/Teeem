"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { uploadFile } from "@/lib/upload-utils";
import { UNDO_DELAY_SECONDS } from "@/lib/email-constants";
import type { QueuedEmail, SendEmailParams } from "@/lib/email-types";

/**
 * Hook for sending emails with undo capability.
 * Delays actual sending by a configurable amount of time,
 * showing a toast with countdown and "Undo" button.
 */
export function useUndoSend() {
  const [pendingEmails, setPendingEmails] = useState<Map<string, QueuedEmail>>(new Map());
  const toastRefs = useRef<Map<string, { dismiss: () => void; update: (props: any) => void }>>(new Map());

  const cancelSend = useCallback((emailId: string) => {
    const email = pendingEmails.get(emailId);
    if (email) {
      // Clear the timers
      clearTimeout(email.timeoutId);
      clearInterval(email.intervalId);

      // Remove from pending
      setPendingEmails((prev) => {
        const next = new Map(prev);
        next.delete(emailId);
        return next;
      });

      // Dismiss the toast
      const toastRef = toastRefs.current.get(emailId);
      if (toastRef) {
        toastRef.dismiss();
        toastRefs.current.delete(emailId);
      }

      // Show cancelled toast
      toast({
        title: "Send cancelled",
        description: "Your email was not sent.",
      });
    }
  }, [pendingEmails]);

  const actualSend = useCallback(async (email: QueuedEmail) => {
    // Clear the interval
    clearInterval(email.intervalId);

    // Dismiss the countdown toast
    const toastRef = toastRefs.current.get(email.id);
    if (toastRef) {
      toastRef.dismiss();
      toastRefs.current.delete(email.id);
    }

    // Remove from pending
    setPendingEmails((prev) => {
      const next = new Map(prev);
      next.delete(email.id);
      return next;
    });

    try {
      // SSoT: Upload attachments via presigned URL first
      const attachmentStorageKeys: string[] = [];
      for (const file of email.attachments) {
        const uploadResult = await uploadFile(file, 'documents');
        if (uploadResult.success && uploadResult.key) {
          attachmentStorageKeys.push(uploadResult.key);
        }
      }

      // Send email with storage keys instead of files
      await api.post("/api/v1/imap_credentials/send_email", {
        credential_id: email.credential_id,
        to: email.to,
        subject: email.subject,
        body: email.body,
        from_address: email.from_address,
        cc: email.cc,
        bcc: email.bcc,
        reply_to_message_id: email.reply_to_message_id,
        attachment_storage_keys: attachmentStorageKeys.length > 0 ? attachmentStorageKeys : undefined,
        sm_task_id: email.sm_task_id,  // Link sent email to SM task
      });

      toast({
        title: "Email sent",
        description: `Your email to ${email.to} was sent successfully.`,
      });
    } catch (error) {
      console.error("Failed to send email:", error);
      toast({
        title: "Failed to send",
        description: "Your email could not be sent. Please try again.",
        variant: "destructive",
      });
    }
  }, []);

  const queueSend = useCallback((params: SendEmailParams): string => {
    const emailId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let countdown = UNDO_DELAY_SECONDS;

    // Create the queued email object (without timers initially)
    const queuedEmail: QueuedEmail = {
      id: emailId,
      ...params,
      attachments: params.attachments || [],
      countdown,
      timeoutId: null as unknown as NodeJS.Timeout,
      intervalId: null as unknown as NodeJS.Timeout,
    };

    // Show toast with undo action
    const { dismiss, update, id: toastId } = toast({
      title: "Sending email...",
      description: `Sending in ${countdown} seconds`,
      duration: (UNDO_DELAY_SECONDS + 1) * 1000,
      action: (
        <ToastAction
          altText="Undo"
          onClick={() => cancelSend(emailId)}
        >
          Undo
        </ToastAction>
      ),
    });

    toastRefs.current.set(emailId, { dismiss, update });

    // Update countdown every second
    const intervalId = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        update({
          id: toastId,
          title: "Sending email...",
          description: `Sending in ${countdown} second${countdown !== 1 ? "s" : ""}`,
          action: (
            <ToastAction
              altText="Undo"
              onClick={() => cancelSend(emailId)}
            >
              Undo
            </ToastAction>
          ),
        });
      }
    }, 1000);

    // Set timeout to actually send
    const timeoutId = setTimeout(() => {
      actualSend(queuedEmail);
    }, UNDO_DELAY_SECONDS * 1000);

    // Update the queued email with timers
    queuedEmail.timeoutId = timeoutId;
    queuedEmail.intervalId = intervalId;

    // Add to pending emails
    setPendingEmails((prev) => {
      const next = new Map(prev);
      next.set(emailId, queuedEmail);
      return next;
    });

    return emailId;
  }, [cancelSend, actualSend]);

  return {
    queueSend,
    cancelSend,
    pendingCount: pendingEmails.size,
    hasPending: pendingEmails.size > 0,
  };
}

export default useUndoSend;
