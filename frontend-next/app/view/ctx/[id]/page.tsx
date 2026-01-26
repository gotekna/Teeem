"use client";

/**
 * Server-stored Context Viewer
 *
 * Fetches viewer context from API to avoid URL length limits.
 * Used when enhanced viewer URL would exceed browser limits.
 *
 * URL format: /view/ctx/{contextId}?idx=0
 * - contextId: Short ID returned by POST /api/v1/viewer_contexts
 * - idx: Current file index (optional, defaults to 0)
 */

import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { FileText, Loader2 } from "lucide-react";
import { DocumentViewer, ViewerFile, QAPair } from "@/components/ui/document-viewer";

// Context structure from API
interface ViewerContext {
  files: ViewerFile[];
  currentIndex?: number;
  allQA?: QAPair[];
}

function ViewerContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const contextId = params.id as string;
  const indexParam = searchParams.get("idx");

  const [context, setContext] = useState<ViewerContext | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch context from API
  useEffect(() => {
    if (!contextId) return;

    const fetchContext = async () => {
      try {
        // Use production API for external viewers
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://teeem-production-121159e1ff9d.herokuapp.com';
        const response = await fetch(`${apiBase}/api/v1/viewer_contexts/${contextId}`);
        const data = await response.json();

        if (data.success && data.context) {
          setContext(data.context);
          // Use index from URL param, fallback to stored index, then 0
          const idx = indexParam ? parseInt(indexParam, 10) : (data.context.currentIndex || 0);
          setCurrentIndex(idx);
        } else {
          setError(data.error || "Context not found or expired");
        }
      } catch (err) {
        console.error("[ViewerContext] Failed to fetch context:", err);
        setError("Failed to load viewer context");
      } finally {
        setLoading(false);
      }
    };

    fetchContext();
  }, [contextId, indexParam]);

  // Set document title
  useEffect(() => {
    if (context?.files[currentIndex]) {
      document.title = context.files[currentIndex].name;
    }
  }, [context, currentIndex]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="flex items-center gap-3 text-white">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading document...</span>
        </div>
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-800 mb-2">
            {error || "Invalid Link"}
          </h1>
          <p className="text-gray-600">
            This document link may have expired. Links are valid for 24 hours.
          </p>
        </div>
      </div>
    );
  }

  const currentFile = context.files[currentIndex];

  if (!currentFile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-800 mb-2">File Not Found</h1>
          <p className="text-gray-600">The requested file index is out of range.</p>
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
      qaContext={context.allQA || []}
      theme="dark"
      className="min-h-screen"
    />
  );
}

export default function ContextViewerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="flex items-center gap-3 text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      }
    >
      <ViewerContent />
    </Suspense>
  );
}
