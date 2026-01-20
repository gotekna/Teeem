"use client";

import { useState } from "react";
import {
  Paperclip,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { formatFileSize } from "@/utils/formatters";

export interface Attachment {
  id?: number | null;
  name: string;
  content_type?: string;
  size?: number;
  url?: string;
  outlook_attachment_id?: string;
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
function isSignatureAttachment(attachment: Attachment): boolean {
  const name = attachment.name?.toLowerCase() || "";
  const type = attachment.content_type?.toLowerCase() || "";
  const size = attachment.size || 0;

  // Only check images
  if (!type.startsWith("image/")) return false;

  // Signature patterns
  if (/^image\d{3}\.(png|jpg|jpeg|gif)$/i.test(name)) return true;
  if (/^outlook-signature[_-]/i.test(name)) return true;
  if (/^[a-f0-9]{32}\.(png|jpg|jpeg|gif)$/i.test(name)) return true;
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(png|jpg|jpeg|gif)$/i.test(name)) return true;

  // Very small images (< 10KB) are likely icons
  if (size > 0 && size < 10000) return true;

  return false;
}

export function AttachmentList({ attachments, emailId, className }: AttachmentListProps) {
  const [loading, setLoading] = useState<string | null>(null);

  // Filter out signature/embedded images
  const visibleAttachments = attachments?.filter(a => !isSignatureAttachment(a)) || [];

  if (visibleAttachments.length === 0) {
    return null;
  }

  // Open attachment in new window (double-click action)
  const handleOpenInNewWindow = async (attachment: Attachment) => {
    const attachmentId = attachment.id || attachment.outlook_attachment_id;
    if (!emailId || !attachmentId) return;

    setLoading(attachment.name);
    try {
      // SSoT: Include filename so backend can match local warehouse files
      const blob = await api.getBlob(
        `/api/v1/synced_email/${emailId}/attachments/${attachmentId}/download?filename=${encodeURIComponent(attachment.name)}`
      );
      const url = window.URL.createObjectURL(blob);

      // Always open in new tab
      window.open(url, "_blank");

      // Clean up after a delay (let browser open the URL first)
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Failed to open attachment:", error);
    } finally {
      setLoading(null);
    }
  };

  // Download attachment (single-click action)
  const handleDownload = async (attachment: Attachment, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const attachmentId = attachment.id || attachment.outlook_attachment_id;
    if (!emailId || !attachmentId) return;

    setLoading(attachment.name);
    try {
      // SSoT: Include filename so backend can match local warehouse files
      const blob = await api.getBlob(
        `/api/v1/synced_email/${emailId}/attachments/${attachmentId}/download?filename=${encodeURIComponent(attachment.name)}`
      );
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

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Paperclip className="h-4 w-4" />
        <span>{visibleAttachments.length} Attachment{visibleAttachments.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleAttachments.map((attachment, idx) => {
          const Icon = getFileIcon(attachment.content_type, attachment.name);
          const isLoading = loading === attachment.name;
          const hasId = emailId && (attachment.id || attachment.outlook_attachment_id);

          return (
            <div
              key={attachment.id || idx}
              onClick={hasId ? () => handleDownload(attachment) : undefined}
              onDoubleClick={hasId ? () => handleOpenInNewWindow(attachment) : undefined}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 transition-colors",
                hasId && "cursor-pointer hover:bg-muted hover:border-primary/50",
                isLoading && "opacity-50"
              )}
              title="Click to download, double-click to open in new window"
            >
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate max-w-[200px]">
                  {attachment.name}
                </p>
                {attachment.size && (
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(attachment.size)}
                  </p>
                )}
              </div>
              {hasId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => { e.stopPropagation(); handleOpenInNewWindow(attachment); }}
                  disabled={isLoading}
                  title="Open in new window"
                >
                  <ExternalLink className={cn("h-4 w-4", isLoading && "animate-pulse")} />
                </Button>
              )}
              {attachment.url && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
