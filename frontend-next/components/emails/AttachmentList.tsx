"use client";

import { useState, useCallback } from "react";
import {
  Paperclip,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { formatFileSize } from "@/utils/formatters";

// File type detection helpers
function isSpreadsheetFile(name: string, contentType?: string): boolean {
  const ext = name?.split(".").pop()?.toLowerCase() || "";
  const type = contentType?.toLowerCase() || "";
  return (
    ["xlsx", "xls", "csv"].includes(ext) ||
    type.includes("spreadsheet") ||
    type.includes("excel")
  );
}

function isWordDocFile(name: string, contentType?: string): boolean {
  const ext = name?.split(".").pop()?.toLowerCase() || "";
  const type = contentType?.toLowerCase() || "";
  return (
    ["doc", "docx"].includes(ext) ||
    type.includes("word") ||
    type.includes("msword") ||
    type.includes("wordprocessingml")
  );
}

// Cache for presigned URLs (attachment key -> url)
const presignedUrlCache = new Map<string, { url: string; expiresAt: number }>();

// Check if URL is a presigned URL
function isPresignedUrl(url: string): boolean {
  return url.includes("X-Amz-Signature") || url.includes("blob.core.windows.net");
}

export interface Attachment {
  id?: number | null;
  name: string;
  content_type?: string;
  size?: number;
  url?: string;
  outlook_attachment_id?: string;
  // For inline images: content_id matches cid: references in HTML
  content_id?: string;
  inline_url?: string;
}

interface AttachmentListProps {
  attachments: Attachment[];
  emailId?: number;
  className?: string;
}

function getFileIcon(contentType?: string, name?: string) {
  const type = contentType?.toLowerCase() || "";
  const ext = name?.split(".").pop()?.toLowerCase() || "";

  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    return FileImage;
  }
  if (type.includes("spreadsheet") || ["xlsx", "xls", "csv"].includes(ext)) {
    return FileSpreadsheet;
  }
  if (type.includes("pdf") || type.includes("document") || ["pdf", "doc", "docx"].includes(ext)) {
    return FileText;
  }
  return File;
}

// Check if attachment is a signature/embedded image that should be hidden
// Disabled: User wants to see all attachments including signature images
function isSignatureAttachment(_attachment: Attachment): boolean {
  // No filtering - show all attachments
  return false;
}

export function AttachmentList({ attachments, emailId, className }: AttachmentListProps) {
  const [loading, setLoading] = useState<string | null>(null);

  // Filter out signature/embedded images
  const visibleAttachments = attachments?.filter(a => !isSignatureAttachment(a)) || [];

  if (visibleAttachments.length === 0) {
    return null;
  }

  // Get presigned URL for attachment (with caching)
  const getPresignedUrl = useCallback(async (attachment: Attachment): Promise<string | null> => {
    const attachmentId = attachment.id || attachment.outlook_attachment_id;
    if (!emailId || !attachmentId) return null;

    const cacheKey = `${emailId}-${attachmentId}`;
    const cached = presignedUrlCache.get(cacheKey);

    // Return cached URL if not expired (with 60s buffer)
    if (cached && cached.expiresAt > Date.now() + 60000) {
      return cached.url;
    }

    try {
      // Try to get presigned URL (fast path - direct S3 download)
      const response = await api.get(
        `/api/v1/synced_emails/${emailId}/attachments/${attachmentId}/presigned_url?filename=${encodeURIComponent(attachment.name)}`
      ) as { success?: boolean; url?: string; expires_in?: number; fallback_to_proxy?: boolean };

      if (response.success && response.url) {
        // Cache the presigned URL
        const expiresIn = response.expires_in || 900;
        presignedUrlCache.set(cacheKey, {
          url: response.url,
          expiresAt: Date.now() + expiresIn * 1000,
        });
        return response.url;
      }
    } catch (err) {
      console.warn("[AttachmentList] Presigned URL failed, will use proxy:", err);
    }

    return null;
  }, [emailId]);

  // Fetch attachment content (presigned URL or proxy fallback)
  const fetchAttachmentBlob = useCallback(async (attachment: Attachment): Promise<Blob> => {
    const attachmentId = attachment.id || attachment.outlook_attachment_id;

    // Step 1: Try presigned URL (fast path - no double transfer!)
    const presignedUrl = await getPresignedUrl(attachment);
    if (presignedUrl && isPresignedUrl(presignedUrl)) {
      const response = await fetch(presignedUrl);
      if (response.ok) {
        return response.blob();
      }
    }

    // Step 2: Fall back to api.getBlob() proxy (slow path)
    console.log("[AttachmentList] Using proxy fallback for:", attachment.name);
    return api.getBlob(
      `/api/v1/synced_emails/${emailId}/attachments/${attachmentId}/download?filename=${encodeURIComponent(attachment.name)}`
    );
  }, [emailId, getPresignedUrl]);

  // Open attachment in new window (double-click action)
  // For spreadsheets: Opens in TeeemXL
  // For Word docs: Opens in TeeemWord
  // For others: Opens in browser
  const handleOpenInNewWindow = async (attachment: Attachment) => {
    const attachmentId = attachment.id || attachment.outlook_attachment_id;
    if (!emailId || !attachmentId) return;

    setLoading(attachment.name);
    try {
      // Check if it's a spreadsheet - import to TeeemXL via backend
      if (isSpreadsheetFile(attachment.name, attachment.content_type)) {
        const response = await api.post<{
          success: boolean;
          data?: { id: number };
          error?: string;
        }>("/api/v1/teeem_spreadsheets/import_from_attachment", {
          email_id: emailId,
          attachment_id: attachmentId,
        });

        if (response?.success && response.data?.id) {
          // Open TeeemXL with the imported spreadsheet
          window.open(`/admin/system/teeem-xl?id=${response.data.id}`, "_blank");
        } else {
          console.error("Failed to import spreadsheet:", response?.error);
          // Fallback to blob preview
          const blob = await fetchAttachmentBlob(attachment);
          const url = window.URL.createObjectURL(blob);
          window.open(url, "_blank");
          setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        }
        return;
      }

      // Check if it's a Word doc - download blob and navigate to TeeemWord
      if (isWordDocFile(attachment.name, attachment.content_type)) {
        const blob = await fetchAttachmentBlob(attachment);

        // Store the blob in sessionStorage as base64 for TeeemWord to import
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          const fileName = attachment.name;

          // Create a new TeeemDocument first
          const docResponse = await api.post<{
            success: boolean;
            data?: { id: number };
          }>("/api/v1/teeem_documents", {
            teeem_document: {
              name: fileName.replace(/\.(docx?|doc)$/i, ""),
            },
          });

          if (docResponse?.success && docResponse.data?.id) {
            // Store the file data for TeeemWord to pick up
            sessionStorage.setItem("teeem_word_import", JSON.stringify({
              base64,
              fileName,
              documentId: docResponse.data.id,
            }));

            // Open TeeemWord - it will detect the import data and auto-import
            window.open(`/admin/system/teeem-word?id=${docResponse.data.id}&import=true`, "_blank");
          } else {
            // Fallback to blob preview
            const url = window.URL.createObjectURL(blob);
            window.open(url, "_blank");
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
          }
        };
        reader.readAsDataURL(blob);
        return;
      }

      // Default: Open blob in browser
      const blob = await fetchAttachmentBlob(attachment);
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Failed to open attachment:", error);
    } finally {
      setLoading(null);
    }
  };

  // Preview attachment in popup (single-click action)
  // For spreadsheets: Opens in TeeemXL
  // For Word docs: Opens in TeeemWord
  // For others: Opens in popup window
  const handlePreviewInPopup = async (attachment: Attachment) => {
    const attachmentId = attachment.id || attachment.outlook_attachment_id;
    if (!emailId || !attachmentId) return;

    setLoading(attachment.name);
    try {
      // Check if it's a spreadsheet - import to TeeemXL via backend
      if (isSpreadsheetFile(attachment.name, attachment.content_type)) {
        const response = await api.post<{
          success: boolean;
          data?: { id: number };
          error?: string;
        }>("/api/v1/teeem_spreadsheets/import_from_attachment", {
          email_id: emailId,
          attachment_id: attachmentId,
        });

        if (response?.success && response.data?.id) {
          // Open TeeemXL with the imported spreadsheet in popup
          window.open(
            `/admin/system/teeem-xl?id=${response.data.id}`,
            "preview",
            "width=1200,height=800,menubar=no,toolbar=no,location=no,status=no"
          );
        } else {
          console.error("Failed to import spreadsheet:", response?.error);
          // Fallback to blob preview
          const blob = await fetchAttachmentBlob(attachment);
          const url = window.URL.createObjectURL(blob);
          window.open(url, "preview", "width=900,height=700,menubar=no,toolbar=no,location=no,status=no");
          setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        }
        return;
      }

      // Check if it's a Word doc - download blob and navigate to TeeemWord
      if (isWordDocFile(attachment.name, attachment.content_type)) {
        const blob = await fetchAttachmentBlob(attachment);

        // Store the blob in sessionStorage as base64 for TeeemWord to import
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          const fileName = attachment.name;

          // Create a new TeeemDocument first
          const docResponse = await api.post<{
            success: boolean;
            data?: { id: number };
          }>("/api/v1/teeem_documents", {
            teeem_document: {
              name: fileName.replace(/\.(docx?|doc)$/i, ""),
            },
          });

          if (docResponse?.success && docResponse.data?.id) {
            // Store the file data for TeeemWord to pick up
            sessionStorage.setItem("teeem_word_import", JSON.stringify({
              base64,
              fileName,
              documentId: docResponse.data.id,
            }));

            // Open TeeemWord in popup - it will detect the import data and auto-import
            window.open(
              `/admin/system/teeem-word?id=${docResponse.data.id}&import=true`,
              "preview",
              "width=1200,height=800,menubar=no,toolbar=no,location=no,status=no"
            );
          } else {
            // Fallback to blob preview
            const url = window.URL.createObjectURL(blob);
            window.open(url, "preview", "width=900,height=700,menubar=no,toolbar=no,location=no,status=no");
            setTimeout(() => window.URL.revokeObjectURL(url), 1000);
          }
        };
        reader.readAsDataURL(blob);
        return;
      }

      // Default: Open blob in popup window
      const blob = await fetchAttachmentBlob(attachment);
      const url = window.URL.createObjectURL(blob);
      window.open(url, "preview", "width=900,height=700,menubar=no,toolbar=no,location=no,status=no");
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Failed to preview attachment:", error);
    } finally {
      setLoading(null);
    }
  };

  // Download attachment
  const handleDownload = async (attachment: Attachment, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const attachmentId = attachment.id || attachment.outlook_attachment_id;
    if (!emailId || !attachmentId) return;

    setLoading(attachment.name);
    try {
      const blob = await fetchAttachmentBlob(attachment);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to download attachment:", error);
    } finally {
      setLoading(null);
    }
  };

  // Download all attachments as a zip file
  const handleDownloadAll = async () => {
    if (!emailId || visibleAttachments.length === 0) return;

    setLoading("all");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Fetch all attachments in parallel
      const results = await Promise.allSettled(
        visibleAttachments.map(async (att) => {
          const blob = await fetchAttachmentBlob(att);
          return { name: att.name, blob };
        })
      );

      // Add successful downloads to zip
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.blob) {
          zip.file(result.value.name, result.value.blob);
        }
      }

      // Generate and download zip
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attachments-${emailId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to download all attachments:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Paperclip className="h-4 w-4" />
        <span>{visibleAttachments.length} Attachment{visibleAttachments.length !== 1 ? "s" : ""}</span>
        {visibleAttachments.length > 1 && emailId && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleDownloadAll}
            disabled={loading === "all"}
          >
            <Download className={cn("h-3 w-3 mr-1", loading === "all" && "animate-spin")} />
            Download All
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {visibleAttachments.map((attachment, idx) => {
          const Icon = getFileIcon(attachment.content_type, attachment.name);
          const isLoading = loading === attachment.name;
          const hasId = emailId && (attachment.id || attachment.outlook_attachment_id);

          return (
            <div
              key={attachment.id || idx}
              className="flex items-center gap-1 text-sm group"
            >
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <button
                onClick={hasId ? () => handlePreviewInPopup(attachment) : undefined}
                onDoubleClick={hasId ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenInNewWindow(attachment);
                } : undefined}
                className={cn(
                  "truncate text-left max-w-[200px]",
                  hasId && "text-primary hover:underline cursor-pointer",
                  !hasId && "text-foreground",
                  isLoading && "opacity-50"
                )}
                title="Click to preview, double-click to open in new tab"
                disabled={!hasId}
              >
                {attachment.name}
              </button>
              {hasId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); handleDownload(attachment, e); }}
                  disabled={isLoading}
                  title="Download"
                >
                  <Download className={cn("h-3 w-3", isLoading && "animate-spin")} />
                </Button>
              )}
              {attachment.size && (
                <span className="text-xs text-muted-foreground">
                  ({formatFileSize(attachment.size)})
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
