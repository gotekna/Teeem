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

export interface Attachment {
  id?: number;
  name: string;
  content_type?: string;
  size?: number;
  url?: string;
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

export function AttachmentList({ attachments, emailId, className }: AttachmentListProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const handleDownload = async (attachment: Attachment) => {
    if (!emailId || !attachment.id) return;

    setDownloading(attachment.name);
    try {
      // Download via API
      const response = await fetch(
        `/api/v1/email_warehouse/${emailId}/attachments/${attachment.id}/download`,
        { credentials: "include" }
      );

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
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
      setDownloading(null);
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
          const isDownloading = downloading === attachment.name;

          return (
            <div
              key={attachment.id || idx}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
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
              {emailId && attachment.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleDownload(attachment)}
                  disabled={isDownloading}
                >
                  <Download className={cn("h-4 w-4", isDownloading && "animate-pulse")} />
                </Button>
              )}
              {attachment.url && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  asChild
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
