"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { FileText } from "lucide-react";
import { DocumentViewer, ViewerFile, QAPair } from "@/components/ui/document-viewer";

// Context encoded in URL - contains Q&A and all files
interface ViewerContext {
  files: ViewerFile[];
  currentIndex: number;
  // Legacy single Q&A (backwards compat)
  question?: string;
  answer?: string;
  // All Q&As from email
  allQA?: QAPair[];
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

// Encode context to base64url (exported for use in TaskFullscreenView)
export function encodeContext(context: ViewerContext): string {
  const json = JSON.stringify(context);
  const base64 = btoa(json);
  // Make URL-safe
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function ViewerContent() {
  const params = useParams();
  const id = params.id as string;

  const [context, setContext] = useState<ViewerContext | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

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

  // Set document title
  useEffect(() => {
    if (context?.files[currentIndex]) {
      document.title = context.files[currentIndex].name;
    }
  }, [context, currentIndex]);

  const currentFile = context?.files[currentIndex];

  // Build Q&A array for the DocumentViewer
  const qaContext: QAPair[] = context?.allQA ||
    (context?.question ? [{ question: context.question, answer: context.answer }] : []);

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
    <DocumentViewer
      url={currentFile.openUrl}
      fileName={currentFile.name}
      downloadUrl={currentFile.downloadUrl}
      files={context.files}
      currentIndex={currentIndex}
      onFileChange={setCurrentIndex}
      qaContext={qaContext}
      theme="dark"
      className="min-h-screen"
    />
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
