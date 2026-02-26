"use client";

/**
 * EmailDocumentsDialog - THE ONE component for emailing documents
 *
 * Provides the full email flow:
 * 1. Options dialog (attach / link / skip per document)
 * 2. Share link generation for "link" documents
 * 3. ComposeEmailModal with pre-populated attachments and body
 *
 * Used by: Library page, Job Photo Documents, and any future email-documents flow.
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ComposeEmailModal } from "@/components/emails/ComposeEmailModal";
import type { PreUploadedAttachment } from "@/lib/email-types";
import { api } from "@/lib/api";
import { formatFileEmailBody } from "@/lib/formatters/email-file-links";
import { formatFileSize } from "@/utils/formatters";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import {
  FileText,
  ImageIcon,
  Paperclip,
  Link,
  EyeOff,
  Mail,
  Layers,
} from "lucide-react";

/** Generic document shape for emailing - works with Library docs, photos, etc. */
export interface EmailableDocument {
  id: number;
  name: string;
  storagePath?: string | null;
  fileSize?: number;
  mimeType?: string;
}

interface EmailDocumentsDialogProps {
  /** Documents to email */
  documents: EmailableDocument[];
  /** Controls dialog visibility */
  open: boolean;
  /** Called when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Called after email is sent or dialog is fully closed */
  onComplete?: () => void;
  /** Default email subject */
  defaultSubject?: string;
}

type EmailOption = "attach" | "link" | "both" | "skip";

export function EmailDocumentsDialog({
  documents,
  open,
  onOpenChange,
  onComplete,
  defaultSubject,
}: EmailDocumentsDialogProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  // Step 1: Options dialog state
  const [emailOptions, setEmailOptions] = React.useState<Record<number, EmailOption>>({});
  const [preparingEmail, setPreparingEmail] = React.useState(false);

  // Step 2: Compose modal state
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [attachments, setAttachments] = React.useState<PreUploadedAttachment[]>([]);
  const [emailBody, setEmailBody] = React.useState("");

  // Reset options when documents change
  React.useEffect(() => {
    if (open && documents.length > 0) {
      const defaults: Record<number, EmailOption> = {};
      documents.forEach((d) => {
        defaults[d.id] = "attach";
      });
      setEmailOptions(defaults);
      setEmailBody("");
    }
  }, [open, documents]);

  const isImage = (doc: EmailableDocument) =>
    doc.mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(doc.name);

  // Handle "Compose Email" click - generate links if needed, then open compose
  const handleComposeEmail = React.useCallback(async () => {
    // "both" counts as both attach AND link
    const attachDocs = documents.filter((d) => emailOptions[d.id] === "attach" || emailOptions[d.id] === "both");
    const linkDocs = documents.filter((d) => emailOptions[d.id] === "link" || emailOptions[d.id] === "both");

    if (attachDocs.length === 0 && linkDocs.length === 0) {
      // All skipped - just open compose with no attachments
      onOpenChange(false);
      setAttachments([]);
      setEmailBody("");
      setComposeOpen(true);
      return;
    }

    let bodyHtml = "";

    // Generate share links for "link" documents
    if (linkDocs.length > 0) {
      setPreparingEmail(true);
      try {
        const linkResults = await Promise.all(
          linkDocs.map(async (doc) => {
            const [dlRes, openRes] = await Promise.all([
              api.post<{ success: boolean; shareUrl: string }>(
                `/api/v1/documents/${doc.id}/share_link`
              ),
              api.post<{ success: boolean; shareUrl: string }>(
                `/api/v1/documents/${doc.id}/share_link`,
                { open: true }
              ),
            ]);
            return {
              doc,
              downloadUrl: dlRes?.success ? dlRes.shareUrl : null,
              openUrl: openRes?.success ? openRes.shareUrl : null,
            };
          })
        );

        const validResults = linkResults.filter((r) => r.downloadUrl || r.openUrl);
        const appOrigin = typeof window !== "undefined" ? window.location.origin : "";

        let viewerUrl = "";
        if (validResults.length > 0) {
          const viewerFiles = validResults.map((r) => ({
            name: r.doc.name,
            downloadUrl: r.downloadUrl || "",
            openUrl: r.openUrl || r.downloadUrl || "",
            contentType: r.doc.mimeType || undefined,
          }));

          const ctxRes = await api.post<{ success: boolean; id?: string }>(
            "/api/v1/viewer_contexts",
            { context: { files: viewerFiles, currentIndex: 0 } }
          );

          if (ctxRes?.success && ctxRes.id) {
            viewerUrl = `${appOrigin}/view/ctx/${ctxRes.id}`;
          }
        }

        let zipUrl: string | undefined;
        if (validResults.length > 1) {
          try {
            const zipRes = await api.post<{
              success: boolean;
              share_url?: string;
              download_method?: string;
              content?: string;
            }>("/api/v1/documents/bulk_zip", {
              document_ids: validResults.map((r) => r.doc.id),
            });
            if (zipRes?.success && zipRes.share_url) {
              zipUrl = zipRes.share_url;
            } else if (zipRes?.success && zipRes.download_method === "base64" && zipRes.content) {
              const byteCharacters = atob(zipRes.content);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/zip" });
              zipUrl = URL.createObjectURL(blob);
            }
          } catch {
            // Not critical - email works without ZIP link
          }
        }

        if (validResults.length > 0) {
          bodyHtml = formatFileEmailBody({
            files: validResults.map((r, idx) => {
              const openHref =
                viewerUrl && validResults.length > 1
                  ? `${viewerUrl}?idx=${idx}`
                  : r.openUrl || r.downloadUrl || "";
              return {
                name: r.doc.name,
                downloadUrl: r.downloadUrl || undefined,
                openUrl: openHref || undefined,
              };
            }),
            zipUrl,
            zipFileCount: validResults.length,
            user: currentUser
              ? {
                  name: currentUser.name,
                  email: currentUser.email,
                  mobile_phone: currentUser.mobile_phone,
                  job_title: currentUser.job_title,
                }
              : undefined,
          });
        }
      } catch {
        toast({
          title: "Link Generation Failed",
          description: "Could not generate share links. Documents will be attached instead.",
          variant: "destructive",
        });
        // Fall back to attach for link docs
        linkDocs.forEach((d) => {
          emailOptions[d.id] = "attach";
        });
      } finally {
        setPreparingEmail(false);
      }
    }

    // Build attachments list from "attach" and "both" documents
    // Supports both S3 (storagePath) and SharePoint-only (documentId) files
    const finalAttachDocs = documents.filter((d) => emailOptions[d.id] === "attach" || emailOptions[d.id] === "both");
    const preUploaded: PreUploadedAttachment[] = finalAttachDocs
      .filter((d) => d.storagePath || d.id)
      .map((d) => ({
        filename: d.name,
        storageKey: d.storagePath || "",
        documentId: d.storagePath ? undefined : d.id,
        fileSize: d.fileSize,
        contentType: d.mimeType,
      }));

    setAttachments(preUploaded);
    setEmailBody(bodyHtml);
    onOpenChange(false);
    setComposeOpen(true);
  }, [documents, emailOptions, toast, currentUser, onOpenChange]);

  const subject =
    defaultSubject ||
    (documents.length === 1 ? documents[0].name : `${documents.length} Documents`);

  return (
    <>
      {/* Step 1: Attach / Link / Skip options dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Email Documents</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-auto">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Choose how to include each document.
              </p>
              <div className="flex items-center gap-1">
                {(["attach", "link", "both", "skip"] as const).map((opt) => (
                  <Button
                    key={opt}
                    size="sm"
                    variant={
                      Object.values(emailOptions).every((v) => v === opt) ? "default" : "outline"
                    }
                    className="text-xs h-7 px-2"
                    onClick={() => {
                      const updated: Record<number, EmailOption> = {};
                      documents.forEach((d) => {
                        updated[d.id] = opt;
                      });
                      setEmailOptions(updated);
                    }}
                  >
                    {opt === "attach" && <Paperclip className="h-3 w-3 mr-1" />}
                    {opt === "link" && <Link className="h-3 w-3 mr-1" />}
                    {opt === "both" && <Layers className="h-3 w-3 mr-1" />}
                    {opt === "skip" && <EyeOff className="h-3 w-3 mr-1" />}
                    All {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            {documents.map((doc) => {
              const option = emailOptions[doc.id] || "attach";
              const Icon = isImage(doc) ? ImageIcon : FileText;
              return (
                <div key={doc.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                  <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    {doc.fileSize != null && doc.fileSize > 0 && (
                      <p className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)}</p>
                    )}
                    <RadioGroup
                      value={option}
                      onValueChange={(val) =>
                        setEmailOptions((prev) => ({
                          ...prev,
                          [doc.id]: val as EmailOption,
                        }))
                      }
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="attach" id={`attach-${doc.id}`} />
                        <Label
                          htmlFor={`attach-${doc.id}`}
                          className="text-xs font-normal flex items-center gap-1 cursor-pointer"
                        >
                          <Paperclip className="h-3 w-3" />
                          Attach
                        </Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="link" id={`link-${doc.id}`} />
                        <Label
                          htmlFor={`link-${doc.id}`}
                          className="text-xs font-normal flex items-center gap-1 cursor-pointer"
                        >
                          <Link className="h-3 w-3" />
                          Link
                        </Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="both" id={`both-${doc.id}`} />
                        <Label
                          htmlFor={`both-${doc.id}`}
                          className="text-xs font-normal flex items-center gap-1 cursor-pointer"
                        >
                          <Layers className="h-3 w-3" />
                          Both
                        </Label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <RadioGroupItem value="skip" id={`skip-${doc.id}`} />
                        <Label
                          htmlFor={`skip-${doc.id}`}
                          className="text-xs font-normal flex items-center gap-1 cursor-pointer"
                        >
                          <EyeOff className="h-3 w-3" />
                          Skip
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleComposeEmail} disabled={preparingEmail}>
              {preparingEmail ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              {preparingEmail ? "Generating Links..." : "Compose Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2: Compose email modal */}
      <ComposeEmailModal
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open);
          if (!open) onComplete?.();
        }}
        defaultSubject={subject}
        defaultBody={emailBody}
        skipSignature={true}
        initialPreUploadedAttachments={attachments}
      />
    </>
  );
}
