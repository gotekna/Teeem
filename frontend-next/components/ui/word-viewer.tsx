"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  Download,
  Printer,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "./button";
import { Spinner } from "./spinner";

export interface WordData {
  text: string;
  html: string;
  paragraphs: string[];
  paragraph_count: number;
}

export interface WordViewerProps {
  data: WordData;
  filename?: string;
  className?: string;
  onPrint?: () => void;
}

export function WordViewer({
  data,
  filename,
  className,
  onPrint,
}: WordViewerProps) {
  const [copied, setCopied] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }

    // Default print behavior
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${filename || "Document"}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px;
            }
            p { margin-bottom: 1em; }
          </style>
        </head>
        <body>
          ${data.html || data.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([data.text], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename?.replace(/\.[^.]+$/, "") || "document"}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!data || (!data.text && !data.html && !data.paragraphs?.length)) {
    return (
      <div className={cn("flex items-center justify-center h-64", className)}>
        <div className="text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No document content available</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 p-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium truncate max-w-[200px]">
            {filename || "Document"}
          </span>
          <span className="text-xs text-muted-foreground">
            ({data.paragraph_count || data.paragraphs?.length || 0} paragraphs)
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Copy Text */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 text-xs"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 mr-1 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </>
            )}
          </Button>

          {/* Print */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrint}
            className="h-7 text-xs"
          >
            <Printer className="h-3 w-3 mr-1" />
            Print
          </Button>

          {/* Download TXT */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTxt}
            className="h-7 text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            TXT
          </Button>
        </div>
      </div>

      {/* Document Content */}
      <div
        ref={contentRef}
        className="flex-1 overflow-auto p-6 bg-white dark:bg-background"
      >
        <div className="max-w-3xl mx-auto prose prose-sm dark:prose-invert">
          {data.html ? (
            // Render HTML content (sanitized on backend)
            <div dangerouslySetInnerHTML={{ __html: data.html }} />
          ) : (
            // Render paragraphs as formatted text
            data.paragraphs?.map((paragraph, index) => (
              <p key={index} className="mb-4 text-sm leading-relaxed">
                {paragraph}
              </p>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 border-t bg-muted/20 text-center shrink-0">
        <span className="text-xs text-muted-foreground">
          {data.text.length.toLocaleString()} characters
        </span>
      </div>
    </div>
  );
}

// Escape HTML for safe rendering
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Loading state component
export function WordViewerLoading({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center h-full", className)}>
      <Spinner size={32} className="mb-2 text-blue-600" />
      <p className="text-sm text-muted-foreground">Loading document...</p>
    </div>
  );
}

// Error state component
export function WordViewerError({
  error,
  className,
}: {
  error: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center h-full", className)}>
      <FileText className="h-12 w-12 text-red-400 mb-2" />
      <p className="text-sm text-red-600 font-medium">Failed to load document</p>
      <p className="text-xs text-muted-foreground mt-1">{error}</p>
    </div>
  );
}

export default WordViewer;
