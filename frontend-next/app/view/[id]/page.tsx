"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
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
  MessageSquareText
} from "lucide-react";

// Context encoded in URL - contains Q&A and all files
interface ViewerContext {
  files: Array<{
    name: string;
    downloadUrl: string;
    openUrl: string;
  }>;
  currentIndex: number;
  question?: string;
  answer?: string;
}

// Decode base64url to context
function decodeContext(encoded: string): ViewerContext | null {
  try {
    // Base64url decode
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch (e) {
    console.error("Failed to decode context:", e);
    return null;
  }
}

// Encode context to base64url
export function encodeContext(context: ViewerContext): string {
  const json = JSON.stringify(context);
  const base64 = btoa(json);
  // Make URL-safe
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Detect file type from filename
function getFileType(filename: string): "pdf" | "image" | "eml" | "other" {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (ext === "eml") return "eml";
  return "other";
}

// Parse EML content into structured email data
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
          let partBodyStart = partLines.findIndex(l => l === "") + 1;
          htmlPart = partLines.slice(partBodyStart).join("\n");
        } else if (part.includes("Content-Type: text/plain")) {
          const partLines = part.split(/\r?\n/);
          let partBodyStart = partLines.findIndex(l => l === "") + 1;
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

function ViewerContent() {
  const params = useParams();
  const id = params.id as string;

  const [context, setContext] = useState<ViewerContext | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [emlData, setEmlData] = useState<ReturnType<typeof parseEmlContent> | null>(null);
  const [emlLoading, setEmlLoading] = useState(false);
  const [showContext, setShowContext] = useState(true);

  // Decode context from URL
  useEffect(() => {
    if (id) {
      const decoded = decodeContext(id);
      if (decoded) {
        setContext(decoded);
        setCurrentIndex(decoded.currentIndex || 0);
      }
    }
  }, [id]);

  const currentFile = context?.files[currentIndex];
  const fileType = currentFile ? getFileType(currentFile.name) : "other";
  const hasMultipleFiles = context && context.files.length > 1;
  const hasQA = context?.question || context?.answer;

  // Set document title
  useEffect(() => {
    if (currentFile) {
      document.title = currentFile.name;
    }
  }, [currentFile]);

  // Fetch and parse EML content
  useEffect(() => {
    if (fileType === "eml" && currentFile?.openUrl && !emlLoading) {
      setEmlLoading(true);
      setEmlData(null);
      fetch(currentFile.openUrl)
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch email");
          return res.text();
        })
        .then(content => {
          const parsed = parseEmlContent(content);
          setEmlData(parsed);
          document.title = parsed.subject;
        })
        .catch(err => {
          console.error("EML fetch error:", err);
          setError("Unable to load email content");
        })
        .finally(() => setEmlLoading(false));
    }
  }, [fileType, currentFile?.openUrl, emlLoading]);

  // Navigate to next/prev file
  const goToFile = (index: number) => {
    if (context && index >= 0 && index < context.files.length) {
      setCurrentIndex(index);
      setEmlData(null);
      setError(null);
    }
  };

  if (!context || !currentFile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Invalid Link</h1>
          <p className="text-gray-600">This document link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          {fileType === "pdf" ? (
            <FileText className="h-5 w-5 text-red-400 shrink-0" />
          ) : fileType === "image" ? (
            <ImageIcon className="h-5 w-5 text-blue-400 shrink-0" />
          ) : fileType === "eml" ? (
            <Mail className="h-5 w-5 text-blue-400 shrink-0" />
          ) : (
            <FileText className="h-5 w-5 text-gray-400 shrink-0" />
          )}
          <h1 className="text-lg font-medium truncate">{emlData?.subject || currentFile.name}</h1>
          {hasMultipleFiles && (
            <span className="text-sm text-gray-400 shrink-0">
              ({currentIndex + 1} of {context.files.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasQA && (
            <button
              onClick={() => setShowContext(!showContext)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                showContext ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              title="Toggle Q&A context"
            >
              <MessageSquareText className="h-4 w-4" />
            </button>
          )}
          <a
            href={currentFile.downloadUrl}
            download={currentFile.name}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </a>
          <a
            href={currentFile.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </header>

      {/* Q&A Context Panel */}
      {hasQA && showContext && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
          <div className="max-w-4xl mx-auto space-y-3">
            {context.question && (
              <div className="flex gap-3">
                <MessageSquare className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Question</span>
                  <p className="text-gray-200">{context.question}</p>
                </div>
              </div>
            )}
            {context.answer && (
              <div className="flex gap-3">
                <MessageSquareText className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Answer</span>
                  <p className="text-gray-200">{context.answer}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* File Navigation - thumbnails/list */}
      {hasMultipleFiles && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => goToFile(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <ChevronLeft className="h-4 w-4 text-white" />
            </button>

            <div className="flex gap-2 overflow-x-auto py-1">
              {context.files.map((file, index) => (
                <button
                  key={index}
                  onClick={() => goToFile(index)}
                  className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                    index === currentIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {file.name.length > 25 ? file.name.substring(0, 22) + '...' : file.name}
                </button>
              ))}
            </div>

            <button
              onClick={() => goToFile(currentIndex + 1)}
              disabled={currentIndex === context.files.length - 1}
              className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <ChevronRight className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* Document viewer */}
      <main className="flex-1 flex items-center justify-center p-4">
        {error ? (
          <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Unable to Preview</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <a
              href={currentFile.downloadUrl}
              download={currentFile.name}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md transition-colors"
            >
              <Download className="h-5 w-5" />
              Download File
            </a>
          </div>
        ) : fileType === "pdf" ? (
          <iframe
            src={currentFile.openUrl}
            className="w-full h-full rounded-lg shadow-2xl"
            style={{ minHeight: "calc(100vh - 200px)" }}
            onError={() => setError("Unable to load PDF preview")}
          />
        ) : fileType === "image" ? (
          <div className="max-w-full max-h-full overflow-auto">
            <img
              src={currentFile.openUrl}
              alt={currentFile.name}
              className="max-w-full h-auto rounded-lg shadow-2xl"
              style={{ maxHeight: "calc(100vh - 200px)" }}
              onError={() => setError("Unable to load image")}
            />
          </div>
        ) : fileType === "eml" ? (
          emlLoading ? (
            <div className="text-white">Loading email...</div>
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
        ) : (
          <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Preview Not Available</h2>
            <p className="text-gray-600 mb-4">
              This file type cannot be previewed in the browser.
            </p>
            <a
              href={currentFile.downloadUrl}
              download={currentFile.name}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md transition-colors"
            >
              <Download className="h-5 w-5" />
              Download {currentFile.name}
            </a>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-400 text-center py-2 text-sm">
        Shared via Teeem
      </footer>
    </div>
  );
}

export default function EnhancedDocumentViewer() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-white">Loading...</div>
        </div>
      }
    >
      <ViewerContent />
    </Suspense>
  );
}
