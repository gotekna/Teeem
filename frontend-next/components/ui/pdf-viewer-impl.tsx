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
  const [pdfData, setPdfData] = React.useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [numPages, setNumPages] = React.useState<number>(0);
  const [pageNumber, setPageNumber] = React.useState<number>(1);
  const [scale, setScale] = React.useState<number | null>(null); // null = auto-fit
  const [pageSize, setPageSize] = React.useState<{ width: number; height: number } | null>(null);
  const [containerWidth, setContainerWidth] = React.useState<number>(0);
  const [containerHeight, setContainerHeight] = React.useState<number>(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const pageRef = React.useRef<HTMLDivElement>(null);

  // Create a stable copy of PDF data to prevent ArrayBuffer detachment issues
  // The ArrayBuffer can only be transferred to the worker once, so we need to
  // ensure we always pass a fresh copy when the Document component re-renders
  const pdfFile = React.useMemo(() => {
    if (!pdfData) return null;
    // Create a fresh copy of the data to avoid "ArrayBuffer already detached" errors
    return { data: new Uint8Array(pdfData) };
  }, [pdfData]);

  // Store onError in a ref to avoid re-fetching when callback changes
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  // Track container dimensions for auto-fit
  React.useEffect(() => {
    const updateDimensions = () => {
      if (contentRef.current) {
        // Subtract padding from available space:
        // - horizontal: p-4 = 16px left + 16px right = 32px
        // - vertical: pt-12 = 48px top + p-4 bottom = 16px = 64px total
        const width = contentRef.current.clientWidth - 32;
        const height = contentRef.current.clientHeight - 64;
        setContainerWidth(width);
        setContainerHeight(height);
      }
    };

    updateDimensions();

    // Also measure after a short delay to catch late layout calculations
    const timeoutId = setTimeout(updateDimensions, 100);

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, []);

  // Fetch PDF with credentials for authenticated API endpoints
  // Only re-fetch when URL changes, not when callbacks change
  React.useEffect(() => {
    // Reset scale to null when URL changes so new PDF auto-fits
    setScale(null);
    setPageSize(null);

    const fetchPDF = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);

        // Get JWT token from localStorage for authenticated API calls
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const headers: Record<string, string> = {
          'Accept': 'application/pdf',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
          credentials: 'include',
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
  }, [url]); // Only depend on URL - use ref for callbacks

  const onDocumentLoadSuccess = async ({ numPages, getPage }: { numPages: number; getPage: (pageNum: number) => Promise<unknown> }) => {
    setNumPages(numPages);
    setPageNumber(1);

    // Get first page dimensions to calculate initial fit scale BEFORE rendering
    try {
      const page = await getPage(1) as { view: number[] };
      if (page?.view) {
        // PDF view array: [x, y, width, height]
        const pdfWidth = page.view[2] - page.view[0];
        const pdfHeight = page.view[3] - page.view[1];
        setPageSize({ width: pdfWidth, height: pdfHeight });

        // Calculate fit scale immediately if we have container dimensions
        if (containerWidth > 0 && containerHeight > 0) {
          const scaleForWidth = containerWidth / pdfWidth;
          const scaleForHeight = containerHeight / pdfHeight;
          const fitScale = Math.min(scaleForWidth, scaleForHeight);
          setScale(fitScale);
        }
      }
    } catch (err) {
      console.warn("Could not get page dimensions:", err);
      // Fall back to scale 1.0, will auto-fit after render
    }
  };

  const onPageRenderSuccess = (page: { width: number; height: number }) => {
    const newPageSize = { width: page.width, height: page.height };
    setPageSize(newPageSize);

    // Force auto-fit recalculation now that we know the PDF dimensions
    // This handles the case where container was measured before PDF loaded
    if (scale === null && containerWidth > 0 && containerHeight > 0) {
      const scaleForWidth = containerWidth / newPageSize.width;
      const scaleForHeight = containerHeight / newPageSize.height;
      const fitScale = Math.min(scaleForWidth, scaleForHeight);
      setScale(fitScale);
    }
  };

  // Filter highlights for current page
  const currentPageHighlights = highlights.filter(h => h.page === pageNumber);

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF load error:", error);
    setLoadError(error.message);
    if (onError) {
      onError(error);
    }
  };

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  // Calculate effective scale for display
  const effectiveScale = scale ?? 1.0;

  const zoomIn = () => {
    setScale((prev) => Math.min((prev ?? 1.0) + 0.25, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max((prev ?? 1.0) - 0.25, 0.5));
  };

  // Calculate optimal scale to fit PDF in container (contain mode)
  const calculateFitScale = React.useCallback(() => {
    if (!pageSize || containerWidth <= 0 || containerHeight <= 0) {
      return null; // Can't calculate yet
    }

    const scaleForWidth = containerWidth / pageSize.width;
    const scaleForHeight = containerHeight / pageSize.height;

    // Use smaller scale to ensure PDF fits both dimensions (contain mode)
    return Math.min(scaleForWidth, scaleForHeight);
  }, [pageSize, containerWidth, containerHeight]);

  // Auto-fit when page first renders
  React.useEffect(() => {
    if (scale === null && pageSize && containerWidth > 0 && containerHeight > 0) {
      const fitScale = calculateFitScale();
      if (fitScale) {
        setScale(fitScale);
      }
    }
  }, [scale, pageSize, containerWidth, containerHeight, calculateFitScale]);

  const fitToPage = () => {
    const fitScale = calculateFitScale();
    if (fitScale) {
      setScale(fitScale);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

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
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm min-w-[60px] text-center">
            {pageNumber} / {numPages}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
          >
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
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fitToPage}>
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Content - full height now */}
      <div className="flex-1 overflow-auto flex justify-center p-4 pt-12 bg-muted/30" ref={contentRef}>
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
          <div className="relative" ref={pageRef}>
            <Page
              pageNumber={pageNumber}
              scale={scale ?? 1.0}
              loading={
                <div className="flex items-center justify-center h-96">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              }
              className="shadow-lg"
              onRenderSuccess={onPageRenderSuccess}
            />
            {/* Highlight overlays */}
            {pageSize && currentPageHighlights.length > 0 && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  width: pageSize.width,
                  height: pageSize.height
                }}
              >
                {currentPageHighlights.map((highlight, idx) => {
                  // Determine styling based on focused state
                  const isFocused = highlight.focused === true;
                  const isDimmed = highlight.focused === false;
                  const isDefault = highlight.focused === undefined;

                  // Focused: thick border, full opacity, pulse
                  // Dimmed: thin border, low opacity, no animation
                  // Default: medium styling (backwards compatible)
                  const borderWidth = isFocused ? 3 : (isDimmed ? 1 : 2);
                  const bgOpacity = isFocused ? 0.4 : (isDimmed ? 0.15 : 0.3);
                  const shouldPulse = isFocused || isDefault;

                  return (
                    <div
                      key={highlight.id || idx}
                      className={cn(
                        "absolute rounded transition-all duration-300",
                        shouldPulse && "animate-pulse"
                      )}
                      style={{
                        left: `${highlight.x * 100}%`,
                        top: `${highlight.y * 100}%`,
                        width: `${highlight.width * 100}%`,
                        height: `${highlight.height * 100}%`,
                        borderColor: highlight.color || '#eab308',
                        borderWidth: `${borderWidth}px`,
                        borderStyle: 'solid',
                        backgroundColor: highlight.color
                          ? `${highlight.color}${Math.round(bgOpacity * 255).toString(16).padStart(2, '0')}`
                          : `rgba(234, 179, 8, ${bgOpacity})`,
                      }}
                    >
                      {highlight.label && (isFocused || isDefault) && (
                        <span
                          className="absolute -top-6 left-0 text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
                          style={{
                            backgroundColor: highlight.color || '#eab308',
                            color: 'white'
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
