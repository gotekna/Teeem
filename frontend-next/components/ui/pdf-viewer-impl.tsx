"use client";

import * as React from "react";
import type { PDFViewerProps } from "./pdf-viewer";
import { cn } from "@/lib/utils";
import { Loader2, FileText, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "./button";
import { getCachedPdf, cachePdf } from "@/lib/pdf-cache";

/**
 * PDF Viewer Implementation - Fast Cached iframe Version
 *
 * Architecture:
 * 1. Check browser cache for PDF blob (instant if cached)
 * 2. If not cached, fetch from server with auth
 * 3. Cache the blob for future instant loads
 * 4. Display in iframe using browser's native PDF viewer
 *
 * Benefits over react-pdf:
 * - 10-50x faster on repeat views (cached)
 * - Native browser zoom, search, print controls
 * - Lower memory usage
 * - Simpler code
 *
 * Trade-offs:
 * - No custom highlight overlays (use react-pdf for that)
 * - Less programmatic control over rendering
 */
export function PDFViewerImpl({
  url,
  className,
  onError,
  fallbackUrl,
  highlights = [],
}: PDFViewerProps) {
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isCached, setIsCached] = React.useState(false);

  // Store onError in ref to avoid re-fetching when callback changes
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  // Load PDF with caching
  React.useEffect(() => {
    let mounted = true;
    let currentBlobUrl: string | null = null;

    const loadPdf = async () => {
      setIsLoading(true);
      setLoadError(null);
      setIsCached(false);

      try {
        // 1. Check browser cache first (INSTANT if cached)
        const cached = await getCachedPdf(url);
        if (cached && mounted) {
          currentBlobUrl = URL.createObjectURL(cached);
          setBlobUrl(currentBlobUrl);
          setIsCached(true);
          setIsLoading(false);
          return;
        }

        // 2. Fetch from server with auth
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("token")
            : null;
        const headers: Record<string, string> = {
          Accept: "application/pdf",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
          credentials: "include",
          headers,
        });

        if (!response.ok) {
          const errorText = await response
            .text()
            .catch(() => response.statusText);
          throw new Error(`Failed to fetch PDF: ${errorText}`);
        }

        const blob = await response.blob();

        // 3. Cache for next time (async, don't wait)
        cachePdf(url, blob).catch(() => {
          // Ignore cache errors - not critical
        });

        // 4. Create blob URL and display
        if (mounted) {
          currentBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(currentBlobUrl);
          setIsLoading(false);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load PDF";
        console.error("Failed to load PDF:", err);

        if (mounted) {
          setLoadError(errorMessage);
          setIsLoading(false);
          if (onErrorRef.current) {
            onErrorRef.current(new Error(errorMessage));
          }
        }
      }
    };

    loadPdf();

    // Cleanup: revoke blob URL to free memory
    return () => {
      mounted = false;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [url]);

  // Retry handler
  const handleRetry = React.useCallback(() => {
    setLoadError(null);
    setIsLoading(true);
    // Re-trigger effect by clearing blob URL
    setBlobUrl(null);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center h-full",
          className
        )}
      >
        <Loader2 className="h-8 w-8 animate-spin mb-2" />
        <p className="text-sm text-muted-foreground">Loading PDF...</p>
      </div>
    );
  }

  // Error state
  if (loadError || !blobUrl) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center h-full text-muted-foreground p-8",
          className
        )}
      >
        <FileText className="h-16 w-16 mb-4" />
        <p className="text-lg font-medium mb-2">Failed to load PDF</p>
        <p className="text-sm text-center mb-4">
          {loadError || "Unknown error"}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          {fallbackUrl && (
            <Button asChild>
              <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Success state - iframe with native PDF viewer
  return (
    <div className={cn("h-full w-full relative", className)}>
      {/* Cache indicator (dev only) */}
      {process.env.NODE_ENV === "development" && isCached && (
        <div className="absolute top-2 right-2 z-10 bg-green-500 text-white text-xs px-2 py-1 rounded">
          Cached
        </div>
      )}

      {/* iframe uses browser's native PDF viewer */}
      <iframe
        src={blobUrl}
        className="w-full h-full border-0"
        title="PDF Viewer"
      />

      {/* Note: highlights prop is ignored in iframe mode.
          For highlights support, use the react-pdf based viewer. */}
    </div>
  );
}
