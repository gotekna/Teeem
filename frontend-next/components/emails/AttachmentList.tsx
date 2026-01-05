"use client";

import { useState } from "react";
import {
  Paperclip,
  Download,
  FileText,
  FileImage,
  FileSpreadsheet,
  File,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

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

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

// Check if file type can be previewed in browser
function isPreviewable(contentType?: string, name?: string): boolean {
  const type = contentType?.toLowerCase() || "";
  const ext = name?.split(".").pop()?.toLowerCase() || "";

  // Images and PDFs can be previewed
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    return true;
  }
  if (type === "application/pdf" || ext === "pdf") {
    return true;
  }
  return false;
}

export function AttachmentList({ attachments, emailId, className }: AttachmentListProps) {
  const [loading, setLoading] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  // Open attachment - preview if possible, otherwise download
  const handleOpen = async (attachment: Attachment) => {
    const attachmentId = attachment.id || attachment.outlook_attachment_id;
    if (!emailId || !attachmentId) return;

    setLoading(attachment.name);
    try {
      const blob = await api.getBlob(
        `/api/v1/email_warehouse/${emailId}/attachments/${attachmentId}/download`
      );
      const url = window.URL.createObjectURL(blob);

      if (isPreviewable(attachment.content_type, attachment.name)) {
        // Open in new tab for preview
        window.open(url, "_blank");
      } else {
        // Download for non-previewable files
        const a = document.createElement("a");
        a.href = url;
        a.download = attachment.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      // Clean up after a delay (let browser open the URL first)
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("Failed to open attachment:", error);
    } finally {
      setLoading(null);
    }
  };

  // Force download (even for previewable files)
  const handleDownload = async (attachment: Attachment, e: React.MouseEvent) => {
    e.stopPropagation();
    const attachmentId = attachment.id || attachment.outlook_attachment_id;
    if (!emailId || !attachmentId) return;

    setLoading(attachment.name);
    try {
      const blob = await api.getBlob(
        `/api/v1/email_warehouse/${emailId}/attachments/${attachmentId}/download`
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
        <span>{attachments.length} Attachment{attachments.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment, idx) => {
          const Icon = getFileIcon(attachment.content_type, attachment.name);
          const isLoading = loading === attachment.name;
          const canPreview = isPreviewable(attachment.content_type, attachment.name);
          const hasId = emailId && (attachment.id || attachment.outlook_attachment_id);

          return (
            <div
              key={attachment.id || idx}
              onClick={hasId ? () => handleOpen(attachment) : undefined}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 transition-colors",
                hasId && "cursor-pointer hover:bg-muted hover:border-primary/50",
                isLoading && "opacity-50"
              )}
              title={canPreview ? "Click to preview" : "Click to download"}
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
                  onClick={(e) => handleDownload(attachment, e)}
                  disabled={isLoading}
                  title="Download"
                >
                  <Download className={cn("h-4 w-4", isLoading && "animate-pulse")} />
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
