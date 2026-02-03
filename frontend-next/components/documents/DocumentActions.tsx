"use client";

import * as React from "react";
import { Download, Link, Mail, FolderInput, MoreHorizontal, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/use-toast";
import { copyToClipboard } from "@/utils/formatters";

export interface DocumentFile {
  id?: number;
  fileName: string;
  uiName?: string;
  fileUrl: string | null;
  storagePath?: string | null;
  mimeType?: string;
  source?: "job" | "corporate" | "people" | "task" | "s3";
}

interface DocumentActionsProps {
  document: DocumentFile;
  onMoved?: () => void;
  showMove?: boolean;
  /** Render as dropdown menu (default) or inline buttons */
  variant?: "dropdown" | "inline";
  /** Size for inline buttons */
  size?: "sm" | "default" | "icon";
}

/**
 * SSoT: File actions component for File Warehouse
 * Provides OneDrive-like actions: Download, Copy Link, Email, Move
 */
export function DocumentActions({
  document,
  onMoved,
  showMove = false,
  variant = "dropdown",
  size = "icon",
}: DocumentActionsProps) {
  const [copied, setCopied] = React.useState(false);

  const handleDownload = () => {
    if (!document.fileUrl) {
      toast({
        title: "Download unavailable",
        description: "No download URL available for this file",
        variant: "destructive",
      });
      return;
    }

    // Create a hidden link and trigger download
    const link = window.document.createElement("a");
    link.href = document.fileUrl;
    link.download = document.uiName || document.fileName;
    link.click();
  };

  const handleCopyLink = async () => {
    if (!document.fileUrl) {
      toast({
        title: "Copy unavailable",
        description: "No URL available for this file",
        variant: "destructive",
      });
      return;
    }

    try {
      await copyToClipboard(document.fileUrl);
      setCopied(true);
      toast({
        title: "Link copied",
        description: "Download link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Could not copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleEmail = () => {
    if (!document.fileUrl) {
      toast({
        title: "Email unavailable",
        description: "No download URL available for this file",
        variant: "destructive",
      });
      return;
    }

    // Open email compose with file link in body
    const subject = encodeURIComponent(`File: ${document.uiName || document.fileName}`);
    const body = encodeURIComponent(
      `Here is the file you requested:\n\n${document.uiName || document.fileName}\n${document.fileUrl}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const handleMove = () => {
    // TODO: Open move dialog
    toast({
      title: "Move",
      description: "Move functionality coming soon",
    });
    onMoved?.();
  };

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size={size}
          onClick={handleDownload}
          title="Download"
          disabled={!document.fileUrl}
        >
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size={size}
          onClick={handleCopyLink}
          title="Copy Link"
          disabled={!document.fileUrl}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500 dark:text-green-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size={size}
          onClick={handleEmail}
          title="Email"
          disabled={!document.fileUrl}
        >
          <Mail className="h-4 w-4" />
        </Button>
        {showMove && (
          <Button
            variant="ghost"
            size={size}
            onClick={handleMove}
            title="Move to..."
          >
            <FolderInput className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={size}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleDownload} disabled={!document.fileUrl}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink} disabled={!document.fileUrl}>
          {copied ? (
            <Check className="mr-2 h-4 w-4 text-green-500 dark:text-green-400" />
          ) : (
            <Link className="mr-2 h-4 w-4" />
          )}
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEmail} disabled={!document.fileUrl}>
          <Mail className="mr-2 h-4 w-4" />
          Email
        </DropdownMenuItem>
        {showMove && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleMove}>
              <FolderInput className="mr-2 h-4 w-4" />
              Move to...
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
