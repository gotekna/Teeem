"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EmailAttachmentLink - SSoT component for clickable email subjects
 *
 * Consistent behavior across the app:
 * - Single click: Opens email in drawer/viewer
 * - Double click: Opens email in new tab
 * - Download icon: Downloads .eml file (if downloadUrl provided)
 *
 * Usage:
 *   <EmailAttachmentLink
 *     emailId={123}
 *     subject="Re: Invoice Question"
 *     onSelect={(id) => setSelectedEmailId(id)}
 *     downloadUrl="/api/v1/synced_emails/123/download_eml"
 *   />
 */

interface EmailAttachmentLinkProps {
  /** Email ID for opening */
  emailId: number;
  /** Email subject to display */
  subject: string;
  /** Callback when email is selected (single click) */
  onSelect: (emailId: number) => void;
  /** URL to download .eml file (shows download button if provided) */
  downloadUrl?: string;
  /** Optional className for the container */
  className?: string;
  /** Optional className for the link */
  linkClassName?: string;
  /** Truncate subject to this many characters (default: no truncation) */
  maxLength?: number;
}

export function EmailAttachmentLink({
  emailId,
  subject,
  onSelect,
  downloadUrl,
  className,
  linkClassName,
  maxLength,
}: EmailAttachmentLinkProps) {
  const displaySubject = maxLength && subject.length > maxLength
    ? `${subject.slice(0, maxLength)}...`
    : subject;

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!downloadUrl) return;

    try {
      const response = await fetch(downloadUrl, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      const data = await response.json();
      if (data.success && data.content) {
        // Decode base64 and download
        const blob = new Blob(
          [Uint8Array.from(atob(data.content), c => c.charCodeAt(0))],
          { type: 'message/rfc822' }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = data.filename || `${subject}.eml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download email:', error);
    }
  };

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {/* Download .eml button */}
      {downloadUrl && (
        <button
          onClick={handleDownload}
          className="text-muted-foreground hover:text-foreground"
          title="Download as .eml"
        >
          <Download className="h-3 w-3" />
        </button>
      )}
      {/* Email subject link */}
      <button
        onClick={() => onSelect(emailId)}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(`/emails?open=${emailId}`, '_blank');
        }}
        className={cn(
          "text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:underline font-medium text-left truncate",
          linkClassName
        )}
        title={`${subject}\n\nClick to view, double-click to open in new tab`}
      >
        {displaySubject}
      </button>
    </span>
  );
}

export default EmailAttachmentLink;
