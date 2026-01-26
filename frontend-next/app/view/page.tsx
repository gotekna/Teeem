"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { Download, ExternalLink, FileText, Image as ImageIcon, Mail, User, Users, Calendar } from "lucide-react";

// Detect file type from filename or URL
function getFileType(filename: string, url?: string | null): "pdf" | "image" | "eml" | "excel" | "other" {
  // Try filename first
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (ext === "eml") return "eml";
  if (["xlsx", "xls", "csv"].includes(ext)) return "excel";

  // Fallback: try to detect from URL path (before query params)
  if (url) {
    try {
      const urlPath = new URL(url).pathname.toLowerCase();
      if (urlPath.endsWith(".pdf")) return "pdf";
      if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/.test(urlPath)) return "image";
      if (urlPath.endsWith(".eml")) return "eml";
      if (/\.(xlsx|xls|csv)$/.test(urlPath)) return "excel";
    } catch {
      // Invalid URL, ignore
    }
  }

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

  // Parse headers (headers end at first blank line)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "") {
      headerEnd = i;
      break;
    }
    // Continuation of previous header (starts with whitespace)
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

  // Get body content
  let body = lines.slice(headerEnd + 1).join("\n");
  let isHtml = false;

  // Check content type for HTML
  const contentType = headers["content-type"] || "";
  if (contentType.includes("text/html")) {
    isHtml = true;
  }

  // Handle multipart messages - extract first text part
  if (contentType.includes("multipart")) {
    const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

      // Find HTML part first, then text part
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

  // Decode quoted-printable if needed
  if (headers["content-transfer-encoding"]?.includes("quoted-printable") || body.includes("=\n")) {
    body = body
      .replace(/=\r?\n/g, "") // Remove soft line breaks
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  // Clean up the boundary markers from body
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
  const searchParams = useSearchParams();
  const url = searchParams.get("url");
  const name = searchParams.get("name") || "Document";
  const downloadUrl = searchParams.get("download"); // Separate download URL if provided
  const typeHint = searchParams.get("type"); // Explicit file type hint (pdf, image, eml, excel)

  const [error, setError] = useState<string | null>(null);
  const [emlData, setEmlData] = useState<ReturnType<typeof parseEmlContent> | null>(null);
  const [emlLoading, setEmlLoading] = useState(false);

  // Determine file type: explicit hint > filename extension > URL path
  const fileType = (typeHint as "pdf" | "image" | "eml" | "excel" | "other") || getFileType(name, url);

  // Set document title
  useEffect(() => {
    document.title = name;
  }, [name]);

  // Fetch and parse EML content
  useEffect(() => {
    if (fileType === "eml" && url && !emlData && !emlLoading) {
      setEmlLoading(true);
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch email");
          return res.text();
        })
        .then(content => {
          const parsed = parseEmlContent(content);
          setEmlData(parsed);
          // Update title to email subject
          document.title = parsed.subject;
        })
        .catch(err => {
          console.error("EML fetch error:", err);
          setError("Unable to load email content");
        })
        .finally(() => setEmlLoading(false));
    }
  }, [fileType, url, emlData, emlLoading]);

  if (!url) {
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
      {/* Header with filename and download button */}
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
          <h1 className="text-lg font-medium truncate">{emlData?.subject || name}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={downloadUrl || url}
            download={name}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
          </a>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </header>

      {/* Document viewer */}
      <main className="flex-1 flex items-center justify-center p-4">
        {error ? (
          <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Unable to Preview</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <a
              href={downloadUrl || url}
              download={name}
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
            style={{ minHeight: "calc(100vh - 120px)" }}
            onError={() => setError("Unable to load PDF preview")}
          />
        ) : fileType === "image" ? (
          <div className="max-w-full max-h-full overflow-auto">
            <img
              src={url}
              alt={name}
              className="max-w-full h-auto rounded-lg shadow-2xl"
              style={{ maxHeight: "calc(100vh - 120px)" }}
              onError={() => setError("Unable to load image")}
            />
          </div>
        ) : fileType === "eml" ? (
          emlLoading ? (
            <div className="text-white">Loading email...</div>
          ) : emlData ? (
            <div className="w-full max-w-4xl bg-white rounded-lg shadow-2xl overflow-hidden" style={{ maxHeight: "calc(100vh - 120px)" }}>
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
              <div className="p-4 overflow-auto" style={{ maxHeight: "calc(100vh - 300px)" }}>
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
              href={downloadUrl || url}
              download={name}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md transition-colors"
            >
              <Download className="h-5 w-5" />
              Download {name}
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

export default function PublicDocumentViewer() {
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
