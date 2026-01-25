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
  /** Indices into files array for attachments belonging to this question */
  attachmentIndices?: number[];
}

/**
 * Strip HTML tags from text (for displaying answers without raw HTML)
 */
function stripHtmlTags(html: string): string {
  // Remove HTML tags but preserve line breaks
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
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
 * Parse a single MIME part and extract headers and body
 */
function parseMimePart(partContent: string): { headers: Record<string, string>; body: string } {
  // Normalize line endings and trim leading whitespace (parts after boundary split often start with newline)
  const normalizedContent = partContent.replace(/\r\n/g, '\n').replace(/^\n+/, '');
  const lines = normalizedContent.split('\n');
  const headers: Record<string, string> = {};
  let headerEnd = -1;
  let currentHeader = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Empty line or line with only whitespace marks end of headers
    if (line.trim() === "") {
      headerEnd = i;
      break;
    }
    // Continuation line (starts with whitespace)
    if (/^\s+/.test(line) && currentHeader) {
      headers[currentHeader] += " " + line.trim();
    } else {
      // Header line
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        currentHeader = match[1].toLowerCase();
        headers[currentHeader] = match[2];
      }
    }
  }

  // If no empty line found, assume all content is body (no headers)
  const bodyStartIndex = headerEnd >= 0 ? headerEnd + 1 : 0;
  return {
    headers,
    body: lines.slice(bodyStartIndex).join("\n")
  };
}

/**
 * Decode quoted-printable content
 */
function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Check if content type indicates HTML (case-insensitive)
 */
function isHtmlContentType(contentType: string): boolean {
  return contentType.toLowerCase().includes("text/html");
}

/**
 * Check if content type indicates plain text (case-insensitive)
 */
function isPlainTextContentType(contentType: string): boolean {
  return contentType.toLowerCase().includes("text/plain");
}

/**
 * Check if content type indicates image (case-insensitive)
 */
function isImageContentType(contentType: string): boolean {
  return contentType.toLowerCase().includes("image/");
}

/**
 * Check if content type indicates multipart (case-insensitive)
 */
function isMultipartContentType(contentType: string): boolean {
  return contentType.toLowerCase().includes("multipart");
}

/**
 * Check if transfer encoding is quoted-printable (case-insensitive)
 */
function isQuotedPrintable(encoding: string): boolean {
  return encoding.toLowerCase().includes("quoted-printable");
}

/**
 * Extract and normalize Content-ID from header value
 * Handles formats like: <image001.jpg@01DAE8A3.1F7B3200>
 */
function extractContentId(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  // Remove angle brackets and trim whitespace
  const cid = headerValue.replace(/[<>]/g, "").trim();
  return cid || null;
}

/**
 * Process a MIME part and extract content/images
 */
function processMimePart(
  partContent: string,
  cidMap: Record<string, string>
): { htmlPart: string; textPart: string } {
  let htmlPart = "";
  let textPart = "";

  const { headers, body } = parseMimePart(partContent);
  const contentType = headers["content-type"] || "";
  const contentId = extractContentId(headers["content-id"]);
  const transferEncoding = (headers["content-transfer-encoding"] || "").toLowerCase();

  console.log(`[EML Parser] Processing part - Type: ${contentType.substring(0, 50)}, CID: ${contentId || 'none'}, Encoding: ${transferEncoding || 'none'}`);

  // Handle nested multipart
  if (isMultipartContentType(contentType)) {
    const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/i);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nestedParts = body.split(new RegExp(`--${escapedBoundary}`));

      for (const nestedPart of nestedParts) {
        if (nestedPart.trim() === "" || nestedPart.trim() === "--") continue;
        const result = processMimePart(nestedPart, cidMap);
        if (result.htmlPart && !htmlPart) htmlPart = result.htmlPart;
        if (result.textPart && !textPart) textPart = result.textPart;
      }
    }
  } else if (isHtmlContentType(contentType)) {
    htmlPart = isQuotedPrintable(transferEncoding) ? decodeQuotedPrintable(body) : body;
  } else if (isPlainTextContentType(contentType)) {
    textPart = isQuotedPrintable(transferEncoding) ? decodeQuotedPrintable(body) : body;
  } else if (isImageContentType(contentType)) {
    // Extract inline image
    if (!contentId) {
      console.log(`[EML Parser] Found image (${contentType}) but NO Content-ID - skipping`);
    } else {
      const mimeType = contentType.split(";")[0].trim().toLowerCase();
      // Remove all whitespace from base64 data (line breaks, spaces, etc.)
      const imageData = body.replace(/[\s\r\n]/g, "");
      // Only add if we have actual data
      if (imageData.length > 0) {
        cidMap[contentId] = `data:${mimeType};base64,${imageData}`;
        // Also add without the @domain part for matching flexibility
        const atIndex = contentId.indexOf("@");
        if (atIndex > 0) {
          cidMap[contentId.substring(0, atIndex)] = `data:${mimeType};base64,${imageData}`;
        }
        console.log(`[EML Parser] Found inline image: ${contentId}, size: ${imageData.length}, type: ${mimeType}`);
      } else {
        console.log(`[EML Parser] Found image with CID ${contentId} but body is empty`);
      }
    }
  }

  return { htmlPart, textPart };
}

/**
 * Parse EML content into structured email data with inline image support
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
  console.log(`[EML Parser] Starting parse, content length: ${content.length}`);

  const { headers, body: rawBody } = parseMimePart(content);
  let body = rawBody;
  let isHtml = false;
  const cidMap: Record<string, string> = {}; // Content-ID -> data URL

  const contentType = headers["content-type"] || "";
  console.log(`[EML Parser] Top-level Content-Type: ${contentType}`);

  // Handle multipart messages
  if (isMultipartContentType(contentType)) {
    const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/i);
    console.log(`[EML Parser] Boundary match:`, boundaryMatch ? boundaryMatch[1] : 'NOT FOUND');
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const escapedBoundary = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = rawBody.split(new RegExp(`--${escapedBoundary}`));
      console.log(`[EML Parser] Found ${parts.length} parts`);

      let htmlPart = "";
      let textPart = "";

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.trim() === "" || part.trim() === "--") continue;
        // Log first 200 chars of each part to see what we're working with
        console.log(`[EML Parser] Part ${i}: ${part.substring(0, 200).replace(/\n/g, '\\n')}`);
        const result = processMimePart(part, cidMap);
        if (result.htmlPart && !htmlPart) htmlPart = result.htmlPart;
        if (result.textPart && !textPart) textPart = result.textPart;
      }

      if (htmlPart) {
        body = htmlPart;
        isHtml = true;
      } else if (textPart) {
        body = textPart;
        isHtml = false;
      }
    }
  } else if (isHtmlContentType(contentType)) {
    isHtml = true;
    if (isQuotedPrintable(headers["content-transfer-encoding"] || "")) {
      body = decodeQuotedPrintable(body);
    }
  } else if (isQuotedPrintable(headers["content-transfer-encoding"] || "")) {
    body = decodeQuotedPrintable(body);
  }

  // Always log what image references exist in the HTML (for debugging)
  if (isHtml) {
    const allImgSrcs = body.match(/src=["']([^"']+)["']/gi) || [];
    const cidRefs = body.match(/src=["']cid:([^"']+)["']/gi) || [];
    const httpRefs = allImgSrcs.filter(s => s.includes('http'));
    const dataRefs = allImgSrcs.filter(s => s.includes('data:'));
    console.log(`[EML Parser] Image sources in HTML: ${allImgSrcs.length} total, ${cidRefs.length} cid:, ${httpRefs.length} http(s):, ${dataRefs.length} data:`);
    if (cidRefs.length > 0) console.log(`[EML Parser] cid: refs:`, cidRefs.slice(0, 5));
    if (httpRefs.length > 0) console.log(`[EML Parser] http refs:`, httpRefs.slice(0, 3));
  }

  // Replace cid: references with data URLs
  if (isHtml && Object.keys(cidMap).length > 0) {
    console.log(`[EML Parser] Found ${Object.keys(cidMap).length} images to replace`);

    // First, find all cid: references in the HTML
    const cidRefs = body.match(/src=["']cid:([^"']+)["']/gi) || [];
    console.log(`[EML Parser] Replacing ${cidRefs.length} cid: references`);

    for (const [cid, dataUrl] of Object.entries(cidMap)) {
      // Escape special regex characters in the cid
      const escapedCid = cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Replace both src="cid:xxx" and src='cid:xxx' formats
      const regex = new RegExp(`src=["']cid:${escapedCid}["']`, 'gi');
      const before = body;
      body = body.replace(regex, `src="${dataUrl}"`);
      if (body !== before) {
        console.log(`[EML Parser] Replaced cid:${cid}`);
      }
    }

    // Also try matching just the filename part (without @domain) for any remaining cid: refs
    const remainingCids = body.match(/src=["']cid:([^"'@]+)(?:@[^"']+)?["']/gi) || [];
    for (const ref of remainingCids) {
      // Extract the filename part
      const match = ref.match(/cid:([^"'@]+)/i);
      if (match) {
        const filename = match[1];
        // Check if we have this filename in our cidMap (might be stored with full ID)
        for (const [cid, dataUrl] of Object.entries(cidMap)) {
          if (cid.startsWith(filename) || cid.toLowerCase().startsWith(filename.toLowerCase())) {
            body = body.replace(ref, `src="${dataUrl}"`);
            console.log(`[EML Parser] Replaced cid:${filename} (matched ${cid})`);
            break;
          }
        }
      }
    }
  }

  // Clean up trailing boundary markers
  body = body.replace(/--[^\n]+--\s*$/g, "").trim();

  console.log(`[EML Parser] Final result - isHtml: ${isHtml}, images found: ${Object.keys(cidMap).length}, body length: ${body.length}`);

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

  // Fetch and parse EML content when URL changes
  useEffect(() => {
    if (fileType !== "eml" || !url) {
      return;
    }

    // Use AbortController to cancel fetch if URL changes mid-flight
    const controller = new AbortController();
    setEmlLoading(true);
    setEmlData(null);
    setError(null);

    console.log(`[EML Viewer] Fetching EML from: ${url}`);
    fetch(url, { signal: controller.signal })
      .then(res => {
        console.log(`[EML Viewer] Fetch response status: ${res.status}`);
        if (!res.ok) throw new Error("Failed to fetch email");
        return res.text();
      })
      .then(content => {
        console.log(`[EML Viewer] Received content, length: ${content.length}, first 500 chars: ${content.substring(0, 500)}`);
        const parsed = parseEmlContent(content);
        setEmlData(parsed);
      })
      .catch(err => {
        if (err.name === 'AbortError') return; // Ignore aborted fetches
        console.error("EML fetch error:", err);
        setError("Unable to load email content");
      })
      .finally(() => setEmlLoading(false));

    return () => controller.abort();
  }, [fileType, url]);

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
                          <p className={cn("text-sm whitespace-pre-wrap", isDark ? "text-gray-200" : "text-gray-800")}>{stripHtmlTags(qa.answer)}</p>
                        </div>
                      </div>
                    )}
                    {/* Attachments for this question */}
                    {qa.attachmentIndices && qa.attachmentIndices.length > 0 && files && (
                      <div className="ml-8 mt-2 space-y-1">
                        {qa.attachmentIndices.map((fileIdx) => {
                          const file = files[fileIdx];
                          if (!file) return null;
                          return (
                            <button
                              key={fileIdx}
                              onClick={() => goToFile(fileIdx)}
                              className={cn(
                                "w-full text-left px-2 py-1 rounded text-xs transition-colors flex items-center gap-2",
                                fileIdx === currentIndex
                                  ? "bg-blue-600/20 text-blue-300"
                                  : isDark ? "text-gray-400 hover:bg-gray-700/50 hover:text-gray-200" : "text-gray-500 hover:bg-gray-100"
                              )}
                            >
                              {getFileIcon(file.name, "h-3 w-3")}
                              <span className="truncate">{file.name}</span>
                            </button>
                          );
                        })}
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
