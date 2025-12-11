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
  const [scale, setScale] = React.useState<number>(1.0);
  const [pageSize, setPageSize] = React.useState<{ width: number; height: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const pageRef = React.useRef<HTMLDivElement>(null);

  // Create a stable copy of PDF data to prevent ArrayBuffer detachment issues
  // The ArrayBuffer can only be transferred to the worker once, so we need to
  // ensure we always pass a fresh copy when the Document component re-renders
  const pdfFile = React.useMemo(() => {
    if (!pdfData) return null;
    // Create a fresh copy of the data to avoid "ArrayBuffer already detached" errors
    return { data: new Uint8Array(pdfData) };
  }, [pdfData]);

  // Fetch PDF with credentials for authenticated API endpoints
  React.useEffect(() => {
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
        if (onError) {
          onError(new Error(errorMessage));
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPDF();
  }, [url, onError]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const onPageRenderSuccess = (page: { width: number; height: number }) => {
    setPageSize({ width: page.width, height: page.height });
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

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const fitToWidth = () => {
    setScale(1.0);
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
    <div className={cn("h-full w-full flex flex-col", className)} ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm min-w-[80px] text-center">
            {pageNumber} / {numPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="outline" size="icon" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={fitToWidth}>
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-auto flex justify-center p-4 bg-muted/30">
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
              scale={scale}
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
                  width: pageSize.width * scale,
                  height: pageSize.height * scale
                }}
              >
                {currentPageHighlights.map((highlight, idx) => (
                  <div
                    key={idx}
                    className="absolute border-2 border-yellow-500 bg-yellow-300/30 rounded transition-all duration-300 animate-pulse"
                    style={{
                      left: `${highlight.x * 100}%`,
                      top: `${highlight.y * 100}%`,
                      width: `${highlight.width * 100}%`,
                      height: `${highlight.height * 100}%`,
                      borderColor: highlight.color || '#eab308',
                      backgroundColor: highlight.color ? `${highlight.color}33` : 'rgba(234, 179, 8, 0.3)',
                    }}
                  >
                    {highlight.label && (
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
                ))}
              </div>
            )}
          </div>
        </Document>
      </div>
    </div>
  );
}
