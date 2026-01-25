"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Mail,
  User,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  MessageSquareText,
  FileSpreadsheet,
  FileIcon as LucideFileIcon
} from "lucide-react";
import { ExcelDocumentPreview } from "@/components/ui/excel-document-preview";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

export type FileType = "pdf" | "image" | "eml" | "excel" | "word" | "other";

export interface ViewerFile {
  name: string;
  downloadUrl: string;
  openUrl: string;
}

export interface QAPair {
  question: string;
  answer?: string;
  fileIndex?: number;
}

export interface DocumentViewerProps {
  /** File URL for viewing (use openUrl for inline display) */
  url: string;
  /** File name for display and type detection */
  fileName: string;
  /** Optional separate download URL (if different from view URL) */
  downloadUrl?: string;
  /** Optional list of all files for navigation */
  files?: ViewerFile[];
  /** Current file index when using file navigation */
  currentIndex?: number;
  /** Callback when file changes (for navigation) */
  onFileChange?: (index: number) => void;
  /** Q&A pairs to display in sidebar */
  qaContext?: QAPair[];
  /** Show header with controls (default: true) */
  showHeader?: boolean;
  /** Show footer (default: true) */
  showFooter?: boolean;
  /** Show sidebar with Q&A and file list (default: auto based on content) */
  showSidebar?: boolean;
  /** Custom class name */
  className?: string;
  /** Theme: 'light' | 'dark' (default: 'dark') */
  theme?: "light" | "dark";
  /** Footer text (default: 'Shared via Teeem') */
  footerText?: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Detect file type from filename extension
 */
export function getFileType(filename: string): FileType {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (ext === "eml") return "eml";
  if (["xlsx", "xls", "xlsm", "xlsb"].includes(ext)) return "excel";
  if (["docx", "doc"].includes(ext)) return "word";
  return "other";
}

/**
 * Get icon component for file type
 */
export function getFileIcon(filename: string, className?: string) {
  const type = getFileType(filename);
  const iconClass = cn("h-4 w-4 shrink-0", className);
  switch (type) {
    case "pdf":
      return <FileText className={cn(iconClass, "text-red-400")} />;
    case "image":
      return <ImageIcon className={cn(iconClass, "text-blue-400")} />;
    case "eml":
      return <Mail className={cn(iconClass, "text-blue-400")} />;
    case "excel":
      return <FileSpreadsheet className={cn(iconClass, "text-green-400")} />;
    case "word":
      return <LucideFileIcon className={cn(iconClass, "text-blue-500")} />;
    default:
      return <FileText className={cn(iconClass, "text-gray-400")} />;
  }
}

/**
 * Parse EML content into structured email data
 */
function parseEmlContent(content: string): {
  from: string;
  to: string;
  cc?: string;
  subject: string;
  date: string;
  body: string;
  isHtml: boolean;
} {
  const lines = content.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let headerEnd = 0;
  let currentHeader = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "") {
      headerEnd = i;
      break;
    }
    if (/^\s+/.test(line) && currentHeader) {
      headers[currentHeader] += " " + line.trim();
    } else {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        currentHeader = match[1].toLowerCase();
        headers[currentHeader] = match[2];
      }
    }
  }

  let body = lines.slice(headerEnd + 1).join("\n");
  let isHtml = false;

  const contentType = headers["content-type"] || "";
  if (contentType.includes("text/html")) {
    isHtml = true;
  }

  if (contentType.includes("multipart")) {
    const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      let htmlPart = "";
      let textPart = "";

      for (const part of parts) {
        if (part.includes("Content-Type: text/html")) {
          const partLines = part.split(/\r?\n/);
          const partBodyStart = partLines.findIndex(l => l === "") + 1;
          htmlPart = partLines.slice(partBodyStart).join("\n");
        } else if (part.includes("Content-Type: text/plain")) {
          const partLines = part.split(/\r?\n/);
          const partBodyStart = partLines.findIndex(l => l === "") + 1;
          textPart = partLines.slice(partBodyStart).join("\n");
        }
      }

      if (htmlPart) {
        body = htmlPart;
        isHtml = true;
      } else if (textPart) {
        body = textPart;
        isHtml = false;
      }
    }
  }

  if (headers["content-transfer-encoding"]?.includes("quoted-printable") || body.includes("=\n")) {
    body = body
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  body = body.replace(/--[^\n]+--\s*$/g, "").trim();

  return {
    from: headers["from"] || "Unknown",
    to: headers["to"] || "Unknown",
    cc: headers["cc"],
    subject: headers["subject"] || "(No Subject)",
    date: headers["date"] || "Unknown Date",
    body,
    isHtml,
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * DocumentViewer - Universal document viewer with support for PDF, Images, Excel, and EML files
 *
 * Features:
 * - Auto-detects file type from extension
 * - Inline PDF and Image viewing
 * - Excel spreadsheet preview using TeeemXL
 * - EML email parsing and display
 * - Optional Q&A sidebar context
 * - Optional file navigation for multiple files
 * - Dark/light theme support
 *
 * @example
 * // Basic usage
 * <DocumentViewer url={fileUrl} fileName="document.pdf" />
 *
 * @example
 * // With file navigation and Q&A context
 * <DocumentViewer
 *   url={currentFile.openUrl}
 *   fileName={currentFile.name}
 *   downloadUrl={currentFile.downloadUrl}
 *   files={allFiles}
 *   currentIndex={0}
 *   onFileChange={(idx) => setCurrentIndex(idx)}
 *   qaContext={[{ question: "What is this?", answer: "A document" }]}
 * />
 */
export function DocumentViewer({
  url,
  fileName,
  downloadUrl,
  files,
  currentIndex = 0,
  onFileChange,
  qaContext,
  showHeader = true,
  showFooter = true,
  showSidebar,
  className,
  theme = "dark",
  footerText = "Shared via Teeem",
}: DocumentViewerProps) {
  const [error, setError] = useState<string | null>(null);
  const [emlData, setEmlData] = useState<ReturnType<typeof parseEmlContent> | null>(null);
  const [emlLoading, setEmlLoading] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const fileType = getFileType(fileName);
  const hasMultipleFiles = files && files.length > 1;
  const hasQA = qaContext && qaContext.length > 0;
  const hasSidebar = showSidebar ?? (hasQA || hasMultipleFiles);
  const effectiveDownloadUrl = downloadUrl || url;

  // Fetch and parse EML content
  useEffect(() => {
    if (fileType === "eml" && url && !emlLoading) {
      setEmlLoading(true);
      setEmlData(null);
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch email");
          return res.text();
        })
        .then(content => {
          const parsed = parseEmlContent(content);
          setEmlData(parsed);
        })
        .catch(err => {
          console.error("EML fetch error:", err);
          setError("Unable to load email content");
        })
        .finally(() => setEmlLoading(false));
    }
  }, [fileType, url, emlLoading]);

  // Reset state when file changes
  useEffect(() => {
    setEmlData(null);
    setError(null);
  }, [url, fileName]);

  const goToFile = (index: number) => {
    if (files && index >= 0 && index < files.length && onFileChange) {
      onFileChange(index);
    }
  };

  const isDark = theme === "dark";

  return (
    <div className={cn(
      "flex flex-col h-full",
      isDark ? "bg-gray-900" : "bg-gray-100",
      className
    )}>
      {/* Header */}
      {showHeader && (
        <header className={cn(
          "px-4 py-3 flex items-center justify-between shadow-lg shrink-0",
          isDark ? "bg-gray-800 text-white" : "bg-white text-gray-900 border-b"
        )}>
          <div className="flex items-center gap-3 min-w-0">
            {getFileIcon(fileName, "h-5 w-5")}
            <h1 className="text-lg font-medium truncate">{emlData?.subject || fileName}</h1>
            {hasMultipleFiles && (
              <span className={cn("text-sm shrink-0", isDark ? "text-gray-400" : "text-gray-500")}>
                ({currentIndex + 1} of {files!.length})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasSidebar && (
              <button
                onClick={() => setSidebarVisible(!sidebarVisible)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
                  sidebarVisible
                    ? "bg-blue-600 text-white"
                    : isDark ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                )}
                title="Toggle sidebar"
              >
                <MessageSquareText className="h-4 w-4" />
              </button>
            )}
            <a
              href={effectiveDownloadUrl}
              download={fileName}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Download</span>
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md transition-colors",
                isDark ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
              )}
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </header>
      )}

      {/* Two-column layout: Sidebar + Document */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar - Q&A Context + File Navigation */}
        {hasSidebar && sidebarVisible && (
          <aside className={cn(
            "w-80 border-r flex flex-col shrink-0 overflow-hidden",
            isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            {/* Q&A Context */}
            {hasQA && (
              <div className={cn(
                "p-4 space-y-4 border-b overflow-y-auto max-h-[50vh]",
                isDark ? "border-gray-700" : "border-gray-200"
              )}>
                {qaContext!.map((qa, index) => (
                  <div key={index} className="space-y-2">
                    {qaContext!.length > 1 && (
                      <div className={cn("text-xs uppercase tracking-wide", isDark ? "text-gray-500" : "text-gray-400")}>
                        Question {index + 1}
                      </div>
                    )}
                    <div className="flex gap-3">
                      <MessageSquare className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        {qaContext!.length === 1 && (
                          <span className={cn("text-xs uppercase tracking-wide", isDark ? "text-gray-500" : "text-gray-400")}>Question</span>
                        )}
                        <p className={cn("text-sm", isDark ? "text-gray-200" : "text-gray-800")}>{qa.question}</p>
                      </div>
                    </div>
                    {qa.answer && (
                      <div className="flex gap-3">
                        <MessageSquareText className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className={cn("text-xs uppercase tracking-wide", isDark ? "text-gray-500" : "text-gray-400")}>Answer</span>
                          <p className={cn("text-sm whitespace-pre-wrap", isDark ? "text-gray-200" : "text-gray-800")}>{qa.answer}</p>
                        </div>
                      </div>
                    )}
                    {index < qaContext!.length - 1 && (
                      <div className={cn("border-b mt-3", isDark ? "border-gray-600" : "border-gray-300")} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* File Navigation - Vertical list */}
            {hasMultipleFiles && (
              <div className="flex-1 overflow-y-auto p-2">
                <div className={cn("text-xs uppercase tracking-wide px-2 py-1 mb-2", isDark ? "text-gray-500" : "text-gray-400")}>
                  Files ({files!.length})
                </div>
                <div className="space-y-1">
                  {files!.map((file, index) => (
                    <button
                      key={index}
                      onClick={() => goToFile(index)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                        index === currentIndex
                          ? "bg-blue-600 text-white"
                          : isDark ? "bg-gray-700/50 text-gray-300 hover:bg-gray-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      )}
                    >
                      {getFileIcon(file.name)}
                      <span className="truncate">{file.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Prev/Next Navigation */}
            {hasMultipleFiles && (
              <div className={cn("p-2 border-t flex gap-2", isDark ? "border-gray-700" : "border-gray-200")}>
                <button
                  onClick={() => goToFile(currentIndex - 1)}
                  disabled={currentIndex === 0}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 p-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed",
                    isDark ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  )}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </button>
                <button
                  onClick={() => goToFile(currentIndex + 1)}
                  disabled={currentIndex === files!.length - 1}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 p-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed",
                    isDark ? "bg-gray-700 hover:bg-gray-600 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  )}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </aside>
        )}

        {/* Document viewer - takes remaining space */}
        <main className="flex-1 flex items-center justify-center p-4 min-w-0">
          {error ? (
            <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Unable to Preview</h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <a
                href={effectiveDownloadUrl}
                download={fileName}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md transition-colors"
              >
                <Download className="h-5 w-5" />
                Download File
              </a>
            </div>
          ) : fileType === "pdf" ? (
            <iframe
              src={url}
              className="w-full h-full rounded-lg shadow-2xl"
              style={{ minHeight: "calc(100vh - 200px)" }}
              onError={() => setError("Unable to load PDF preview")}
            />
          ) : fileType === "image" ? (
            <div className="max-w-full max-h-full overflow-auto">
              <img
                src={url}
                alt={fileName}
                className="max-w-full h-auto rounded-lg shadow-2xl"
                style={{ maxHeight: "calc(100vh - 200px)" }}
                onError={() => setError("Unable to load image")}
              />
            </div>
          ) : fileType === "eml" ? (
            emlLoading ? (
              <div className={isDark ? "text-white" : "text-gray-800"}>Loading email...</div>
            ) : emlData ? (
              <div className="w-full max-w-4xl bg-white rounded-lg shadow-2xl overflow-hidden" style={{ maxHeight: "calc(100vh - 200px)" }}>
                {/* Email headers */}
                <div className="bg-gray-50 border-b border-gray-200 p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm text-gray-500">From:</span>
                      <p className="text-gray-900 truncate">{emlData.from}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm text-gray-500">To:</span>
                      <p className="text-gray-900 truncate">{emlData.to}</p>
                    </div>
                  </div>
                  {emlData.cc && (
                    <div className="flex items-start gap-3">
                      <Users className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm text-gray-500">CC:</span>
                        <p className="text-gray-900 truncate">{emlData.cc}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm text-gray-500">Date:</span>
                      <p className="text-gray-900">{emlData.date}</p>
                    </div>
                  </div>
                </div>
                {/* Email body */}
                <div className="p-4 overflow-auto" style={{ maxHeight: "calc(100vh - 400px)" }}>
                  {emlData.isHtml ? (
                    <iframe
                      srcDoc={emlData.body}
                      className="w-full border-0"
                      style={{ minHeight: "400px", height: "100%" }}
                      sandbox="allow-same-origin"
                      title="Email content"
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-gray-800 text-sm">
                      {emlData.body}
                    </pre>
                  )}
                </div>
              </div>
            ) : null
          ) : fileType === "excel" ? (
            <div className="w-full h-full bg-white rounded-lg shadow-2xl overflow-hidden" style={{ minHeight: "calc(100vh - 200px)" }}>
              <ExcelDocumentPreview
                url={url}
                className="h-full"
              />
            </div>
          ) : (
            <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Preview Not Available</h2>
              <p className="text-gray-600 mb-4">
                This file type cannot be previewed in the browser.
              </p>
              <a
                href={effectiveDownloadUrl}
                download={fileName}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md transition-colors"
              >
                <Download className="h-5 w-5" />
                Download {fileName}
              </a>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      {showFooter && (
        <footer className={cn(
          "text-center py-2 text-sm shrink-0",
          isDark ? "bg-gray-800 text-gray-400" : "bg-white text-gray-500 border-t"
        )}>
          {footerText}
        </footer>
      )}
    </div>
  );
}

export default DocumentViewer;
