"use client";

import * as React from "react";
import type { PDFViewerProps } from "./pdf-viewer";
import { cn } from "@/lib/utils";
import {
  FileText,
  ExternalLink,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
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
  const [pageCount, setPageCount] = React.useState<number>(1);
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [displayedPage, setDisplayedPage] = React.useState<number>(1);
  const [isPageTransitioning, setIsPageTransitioning] = React.useState(false);
  const [containerKey, setContainerKey] = React.useState<number>(0);
  // Zoom state: 100 = 100%, "page-fit" = fit to width
  // Default to 100% for sharp, readable text (page-fit causes blurriness)
  const [zoom, setZoom] = React.useState<number | "page-fit">(100);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Store onError in ref to avoid re-fetching when callback changes
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  // Helper to get page count from PDF blob using PDF.js (via react-pdf)
  const getPageCount = async (blob: Blob): Promise<number> => {
    try {
      // Dynamically import pdfjs from react-pdf
      const { pdfjs } = await import("react-pdf");
      pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await blob.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      return pdf.numPages;
    } catch {
      // If PDF.js fails, assume single page
      return 1;
    }
  };

  // Load PDF with caching
  React.useEffect(() => {
    let mounted = true;
    let currentBlobUrl: string | null = null;

    const loadPdf = async () => {
      setIsLoading(true);
      setLoadError(null);
      setIsCached(false);
      setCurrentPage(1);
      setDisplayedPage(1);
      setIsPageTransitioning(false);
      setPageCount(1);

      try {
        let blob: Blob;

        // 1. Check browser cache first (INSTANT if cached)
        const cached = await getCachedPdf(url);
        if (cached && mounted) {
          // Ensure correct MIME type even for cached blobs
          blob = cached.type === "application/pdf"
            ? cached
            : new Blob([cached], { type: "application/pdf" });
          currentBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(currentBlobUrl);
          setIsCached(true);

          // Get page count async
          const pages = await getPageCount(blob);
          if (mounted) setPageCount(pages);

          setIsLoading(false);
          return;
        }

        // 2. Fetch from server
        // For presigned S3 URLs (contain X-Amz-Signature), don't send auth headers
        // Presigned URLs are self-authenticating and extra headers break the signature
        const isPresignedS3 = url.includes("X-Amz-Signature=") || url.includes("wasabisys.com");

        const headers: Record<string, string> = {
          Accept: "application/pdf",
        };

        // Only add auth for our backend URLs, not for presigned S3 URLs
        if (!isPresignedS3) {
          const token =
            typeof window !== "undefined"
              ? localStorage.getItem("token")
              : null;
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
        }

        const response = await fetch(url, {
          // Don't send credentials for cross-origin presigned URLs
          credentials: isPresignedS3 ? "omit" : "include",
          // Must use "cors" mode for cross-origin requests
          mode: isPresignedS3 ? "cors" : "same-origin",
          headers,
        });

        if (!response.ok) {
          const errorText = await response
            .text()
            .catch(() => response.statusText);
          throw new Error(`Failed to fetch PDF: ${errorText}`);
        }

        const rawBlob = await response.blob();

        // Ensure correct MIME type for PDF display in iframe
        // Some servers return application/octet-stream which causes browser to download
        blob = rawBlob.type === "application/pdf"
          ? rawBlob
          : new Blob([rawBlob], { type: "application/pdf" });

        // 3. Cache for next time (async, don't wait)
        cachePdf(url, blob).catch(() => {
          // Ignore cache errors - not critical
        });

        // 4. Create blob URL and display
        if (mounted) {
          currentBlobUrl = URL.createObjectURL(blob);
          setBlobUrl(currentBlobUrl);

          // Get page count async
          const pages = await getPageCount(blob);
          if (mounted) setPageCount(pages);

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

  // Handle new page iframe load - complete the crossfade
  // MUST be defined before any early returns to maintain consistent hook count
  const handleNewPageLoad = React.useCallback(() => {
    // Small delay to ensure iframe has rendered content
    setTimeout(() => {
      setDisplayedPage(currentPage);
      setIsPageTransitioning(false);
    }, 50);
  }, [currentPage]);

  // ResizeObserver to re-fit PDF when container size changes
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || !blobUrl) return;

    let resizeTimeout: NodeJS.Timeout | null = null;
    let lastWidth = container.clientWidth;
    let lastHeight = container.clientHeight;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Only trigger if size changed significantly (>5px threshold to avoid micro-changes)
        if (Math.abs(width - lastWidth) > 5 || Math.abs(height - lastHeight) > 5) {
          lastWidth = width;
          lastHeight = height;
          // Debounce to avoid excessive re-renders during resize drag
          if (resizeTimeout) clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            // Increment key to force iframe remount, which re-applies page-fit zoom
            setContainerKey((k) => k + 1);
          }, 150);
        }
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, [blobUrl]);

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center h-full",
          className
        )}
      >
        <Spinner size={32} className="mb-2" />
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

  // Page navigation handlers with crossfade transition
  const goToPage = (page: number) => {
    if (page >= 1 && page <= pageCount && page !== currentPage && !isPageTransitioning) {
      setIsPageTransitioning(true);
      setCurrentPage(page);
    }
  };

  const prevPage = () => goToPage(currentPage - 1);
  const nextPage = () => goToPage(currentPage + 1);

  // Zoom handlers
  const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200];
  const zoomIn = () => {
    if (zoom === "page-fit") {
      setZoom(100);
    } else {
      const currentIndex = ZOOM_LEVELS.indexOf(zoom);
      if (currentIndex < ZOOM_LEVELS.length - 1) {
        setZoom(ZOOM_LEVELS[currentIndex + 1]);
      }
    }
  };
  const zoomOut = () => {
    if (zoom === "page-fit") {
      setZoom(75);
    } else {
      const currentIndex = ZOOM_LEVELS.indexOf(zoom);
      if (currentIndex > 0) {
        setZoom(ZOOM_LEVELS[currentIndex - 1]);
      }
    }
  };
  const fitToWidth = () => setZoom("page-fit");

  // Build zoom string for iframe
  const zoomParam = zoom === "page-fit" ? "page-fit" : zoom.toString();

  // Build iframe URLs with zoom and hidden toolbar for max PDF size
  const displayedIframeSrc = blobUrl ? `${blobUrl}#page=${displayedPage}&zoom=${zoomParam}&toolbar=0&navpanes=0` : "";
  const newPageIframeSrc = blobUrl ? `${blobUrl}#page=${currentPage}&zoom=${zoomParam}&toolbar=0&navpanes=0` : "";

  // Success state - iframe with native PDF viewer
  return (
    <div ref={containerRef} className={cn("h-full w-full relative", className)}>
      {/* Floating controls: page navigation + zoom */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        {/* Page navigation - only show for multi-page PDFs */}
        {pageCount > 1 && (
          <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm border rounded-md shadow-sm px-1 py-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={prevPage}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[80px] text-center">
              {currentPage} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={nextPage}
              disabled={currentPage >= pageCount}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Zoom controls - always visible */}
        <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm border rounded-md shadow-sm px-1 py-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={zoomOut}
            disabled={zoom !== "page-fit" && zoom <= ZOOM_LEVELS[0]}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[50px] text-center">
            {zoom === "page-fit" ? "Fit" : `${zoom}%`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={zoomIn}
            disabled={zoom !== "page-fit" && zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fitToWidth}
            disabled={zoom === "page-fit"}
            title="Fit to width"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cache indicator (dev only) */}
      {process.env.NODE_ENV === "development" && isCached && (
        <div className="absolute top-2 right-2 z-10 bg-green-500 text-white text-xs px-2 py-1 rounded">
          Cached
        </div>
      )}

      {/* Crossfade PDF page navigation - two stacked iframes */}
      {/* Base iframe: shows currently displayed page */}
      <iframe
        key={`${containerKey}-displayed-${displayedPage}`}
        src={displayedIframeSrc}
        className="absolute inset-0 w-full h-full border-0"
        title="PDF Viewer"
      />

      {/* Transition iframe: loads new page on top, fades in when ready */}
      {isPageTransitioning && currentPage !== displayedPage && (
        <iframe
          key={`${containerKey}-loading-${currentPage}`}
          src={newPageIframeSrc}
          className="absolute inset-0 w-full h-full border-0 transition-opacity duration-150 ease-in-out opacity-100"
          style={{ backgroundColor: 'var(--background)' }}
          title="PDF Viewer Loading"
          onLoad={handleNewPageLoad}
        />
      )}

      {/* Note: highlights prop is ignored in iframe mode.
          For highlights support, use the react-pdf based viewer. */}
    </div>
  );
}
