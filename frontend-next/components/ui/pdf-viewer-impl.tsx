"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFViewerProps } from "./pdf-viewer";
import { cn } from "@/lib/utils";
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { Button } from "./button";

// Import styles for react-pdf
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up PDF.js worker - use CDN for the secure version
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function PDFViewerImpl({
  url,
  className,
  showThumbnails = false,
  onError,
  highlights = [],
}: PDFViewerProps) {
  // PDF loading state
  const [pdfData, setPdfData] = React.useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [numPages, setNumPages] = React.useState<number>(0);
  const [pageNumber, setPageNumber] = React.useState<number>(1);

  // === KEY ARCHITECTURE: Separate concerns ===
  // 1. ORIGINAL PDF dimensions (from metadata, set once per document)
  const [originalPdfSize, setOriginalPdfSize] = React.useState<{ width: number; height: number } | null>(null);

  // 2. Container dimensions (tracked continuously via ResizeObserver)
  const [containerSize, setContainerSize] = React.useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // 3. User zoom override (null = auto-fit mode)
  const [userZoom, setUserZoom] = React.useState<number | null>(null);

  // Refs
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  // === DERIVED: Calculate fit scale from inputs ===
  // This recalculates automatically when originalPdfSize or containerSize changes
  const fitScale = React.useMemo(() => {
    if (!originalPdfSize || containerSize.width <= 0 || containerSize.height <= 0) {
      return null; // Can't calculate yet
    }
    const scaleForWidth = containerSize.width / originalPdfSize.width;
    const scaleForHeight = containerSize.height / originalPdfSize.height;
    // Use smaller scale to ensure PDF fits both dimensions (contain mode)
    return Math.min(scaleForWidth, scaleForHeight);
  }, [originalPdfSize, containerSize]);

  // Effective scale: user zoom takes precedence, otherwise use auto-fit
  const effectiveScale = userZoom ?? fitScale;

  // Create a stable copy of PDF data to prevent ArrayBuffer detachment issues
  const pdfFile = React.useMemo(() => {
    if (!pdfData) return null;
    return { data: new Uint8Array(pdfData) };
  }, [pdfData]);

  // === ResizeObserver: Track container dimensions continuously ===
  React.useEffect(() => {
    const updateSize = () => {
      if (contentRef.current) {
        // Use getBoundingClientRect for accurate dimensions
        const rect = contentRef.current.getBoundingClientRect();
        // Account for padding via computed styles (not hardcoded values)
        const styles = getComputedStyle(contentRef.current);
        const paddingX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
        const paddingY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
        setContainerSize({
          width: rect.width - paddingX,
          height: rect.height - paddingY,
        });
      }
    };

    // Measure immediately
    updateSize();

    // Also measure after a short delay to catch late layout calculations
    const timeoutId = setTimeout(updateSize, 50);

    // Watch for changes continuously
    const observer = new ResizeObserver(updateSize);
    if (contentRef.current) {
      observer.observe(contentRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, []);

  // === Reset state when URL changes (new PDF) ===
  React.useEffect(() => {
    // Reset to auto-fit mode for new PDF
    setUserZoom(null);
    setOriginalPdfSize(null);
    setPageNumber(1);

    const fetchPDF = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
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
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(`Failed to fetch PDF: ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        setPdfData(new Uint8Array(arrayBuffer));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load PDF";
        console.error("Failed to load PDF:", err);
        setLoadError(errorMessage);
        if (onErrorRef.current) {
          onErrorRef.current(new Error(errorMessage));
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPDF();
  }, [url]);

  // === Document load: Get ORIGINAL PDF dimensions from metadata ===
  const onDocumentLoadSuccess = async (pdfDocument: {
    numPages: number;
    getPage: (pageNum: number) => Promise<{ view: number[] }>;
  }) => {
    setNumPages(pdfDocument.numPages);

    // Get ORIGINAL dimensions from PDF metadata (not rendered dimensions)
    try {
      const page = await pdfDocument.getPage(1);
      if (page?.view) {
        // PDF view array: [x1, y1, x2, y2]
        const pdfWidth = page.view[2] - page.view[0];
        const pdfHeight = page.view[3] - page.view[1];
        setOriginalPdfSize({ width: pdfWidth, height: pdfHeight });
      }
    } catch (err) {
      console.warn("Could not get page dimensions:", err);
      // If we can't get dimensions, we'll still try to render and get them from onRenderSuccess
    }
  };

  // === Page render success: Backup dimension capture ===
  // Only used if we couldn't get dimensions from metadata
  const onPageRenderSuccess = React.useCallback(
    (page: { width: number; height: number; originalWidth: number; originalHeight: number }) => {
      // Only set if we don't already have original dimensions
      if (!originalPdfSize && page.originalWidth && page.originalHeight) {
        setOriginalPdfSize({
          width: page.originalWidth,
          height: page.originalHeight,
        });
      }
    },
    [originalPdfSize]
  );

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF load error:", error);
    setLoadError(error.message);
    if (onError) {
      onError(error);
    }
  };

  // Filter highlights for current page
  const currentPageHighlights = highlights.filter((h) => h.page === pageNumber);

  // Navigation
  const goToPrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber((prev) => Math.min(prev + 1, numPages));

  // Zoom controls
  const zoomIn = () => setUserZoom((prev) => Math.min((prev ?? fitScale ?? 1.0) + 0.25, 3.0));
  const zoomOut = () => setUserZoom((prev) => Math.max((prev ?? fitScale ?? 1.0) - 0.25, 0.25));
  const fitToPage = () => setUserZoom(null); // Reset to auto-fit mode

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Error state
  if (loadError || !pdfFile) {
    return (
      <div className={cn("flex items-center justify-center h-full text-muted-foreground", className)}>
        <p>{loadError || "Failed to load PDF"}</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full w-full flex flex-col relative", className)} ref={containerRef}>
      {/* Floating Toolbar - overlay in top corners */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
        {/* Page navigation - top left */}
        <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-lg shadow-sm border px-1 py-1 pointer-events-auto">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPrevPage} disabled={pageNumber <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm min-w-[60px] text-center">
            {pageNumber} / {numPages}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNextPage} disabled={pageNumber >= numPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {/* Zoom controls - top right */}
        <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-lg shadow-sm border px-1 py-1 pointer-events-auto">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fitToPage} title="Fit to page">
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto flex justify-center items-start p-4 pt-12 bg-muted/30" ref={contentRef}>
        <Document
          file={pdfFile}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          }
          error={
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Error loading PDF</p>
            </div>
          }
        >
          <div className="relative">
            {/* Only render Page once we have a valid scale */}
            {effectiveScale != null ? (
              <Page
                pageNumber={pageNumber}
                scale={effectiveScale}
                loading={
                  <div className="flex items-center justify-center h-96">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                }
                className="shadow-lg"
                onRenderSuccess={onPageRenderSuccess}
              />
            ) : (
              <div className="flex items-center justify-center h-96">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {/* Highlight overlays */}
            {originalPdfSize && effectiveScale && currentPageHighlights.length > 0 && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  width: originalPdfSize.width * effectiveScale,
                  height: originalPdfSize.height * effectiveScale,
                }}
              >
                {currentPageHighlights.map((highlight, idx) => {
                  const isFocused = highlight.focused === true;
                  const isDimmed = highlight.focused === false;
                  const isDefault = highlight.focused === undefined;
                  const borderWidth = isFocused ? 3 : isDimmed ? 1 : 2;
                  const bgOpacity = isFocused ? 0.4 : isDimmed ? 0.15 : 0.3;
                  const shouldPulse = isFocused || isDefault;

                  return (
                    <div
                      key={highlight.id || idx}
                      className={cn("absolute rounded transition-all duration-300", shouldPulse && "animate-pulse")}
                      style={{
                        left: `${highlight.x * 100}%`,
                        top: `${highlight.y * 100}%`,
                        width: `${highlight.width * 100}%`,
                        height: `${highlight.height * 100}%`,
                        borderColor: highlight.color || "#eab308",
                        borderWidth: `${borderWidth}px`,
                        borderStyle: "solid",
                        backgroundColor: highlight.color
                          ? `${highlight.color}${Math.round(bgOpacity * 255)
                              .toString(16)
                              .padStart(2, "0")}`
                          : `rgba(234, 179, 8, ${bgOpacity})`,
                      }}
                    >
                      {highlight.label && (isFocused || isDefault) && (
                        <span
                          className="absolute -top-6 left-0 text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
                          style={{
                            backgroundColor: highlight.color || "#eab308",
                            color: "white",
                          }}
                        >
                          {highlight.label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Document>
      </div>
    </div>
  );
}
