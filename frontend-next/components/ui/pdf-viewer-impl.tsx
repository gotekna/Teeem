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
  Pencil,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "./button";
import { getCachedPdf, cachePdf } from "@/lib/pdf-cache";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { api } from "@/lib/api";
import { usePdfPanZoom } from "@/hooks/usePdfPanZoom";
import dynamic from "next/dynamic";

// Lazy-load markup overlay (pulls in Fabric.js ~500KB + TakeoffCanvas)
const PdfMarkupOverlay = dynamic(
  () => import("./pdf-markup-overlay").then((mod) => mod.PdfMarkupOverlay),
  { ssr: false }
);

// =============================================================================
// Types
// =============================================================================

interface RenderedPage {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  width: number;   // Logical width (CSS pixels, without DPR)
  height: number;  // Logical height (CSS pixels, without DPR)
}

/**
 * PDF Viewer Implementation - Canvas-based with Markup Support
 *
 * Architecture:
 * 1. Check browser cache for PDF blob (instant if cached)
 * 2. If not cached, fetch from server with auth + progress tracking
 * 3. Cache the blob for future instant loads
 * 4. Render pages to canvas via PDF.js for Fabric.js overlay compatibility
 * 5. Use usePdfPanZoom hook for zoom/pan/ctrl+scroll/fit-to-view
 *
 * Phase 1: Canvas rendering + zoom/pan (replaces iframe)
 * Phase 2: Optional markup mode with TakeoffCanvas overlay
 */
export function PDFViewerImpl({
  url,
  className,
  onError,
  fallbackUrl,
  highlights = [],
  markupContext,
  onMarkupToggle,
  label,
}: PDFViewerProps) {
  // PDF data
  const [pdfBytes, setPdfBytes] = React.useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [isCached, setIsCached] = React.useState(false);
  const [downloadProgress, setDownloadProgress] = React.useState<number | null>(null);

  // Page rendering
  const [pages, setPages] = React.useState<RenderedPage[]>([]);
  const [currentPageNumber, setCurrentPageNumber] = React.useState(1);
  const [isRenderingPages, setIsRenderingPages] = React.useState(false);

  // Markup mode
  const [markupActive, setMarkupActive] = React.useState(false);

  // Store onError in ref to avoid re-fetching when callback changes
  const onErrorRef = React.useRef(onError);
  onErrorRef.current = onError;

  // Retry key to force re-fetch
  const [retryKey, setRetryKey] = React.useState(0);

  // Current page data
  const currentPage = React.useMemo(
    () => pages.find((p) => p.pageNumber === currentPageNumber) || null,
    [pages, currentPageNumber]
  );
  const pageCount = pages.length;

  // Pan/zoom — SSoT hook
  const {
    zoom,
    effectiveMaxZoom,
    onZoomChange,
    onFitToView,
    zoomToRect,
    containerRef,
    isPanning,
    isSpaceHeld,
  } = usePdfPanZoom({
    pageWidth: currentPage?.width ?? 0,
    pageHeight: currentPage?.height ?? 0,
    fitOnMount: true,
  });

  // Canvas ref for displaying the rendered page
  const displayCanvasRef = React.useRef<HTMLCanvasElement>(null);

  // Right-click area zoom (works without markup mode)
  const [zoomRect, setZoomRect] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const zoomDragRef = React.useRef<{ startX: number; startY: number } | null>(null);

  // =============================================================================
  // Step 1: Fetch PDF bytes (with caching + progress)
  // =============================================================================

  React.useEffect(() => {
    let mounted = true;

    const loadPdf = async () => {
      setIsLoading(true);
      setLoadError(null);
      setIsCached(false);
      setPdfBytes(null);
      setPages([]);
      setCurrentPageNumber(1);
      setDownloadProgress(null);

      try {
        let blob: Blob;

        // 1. Check browser cache first (INSTANT if cached)
        const cached = await getCachedPdf(url);
        if (cached && mounted) {
          blob = cached.type === "application/pdf"
            ? cached
            : new Blob([cached], { type: "application/pdf" });
          setIsCached(true);

          const arrayBuffer = await blob.arrayBuffer();
          if (mounted) {
            setPdfBytes(new Uint8Array(arrayBuffer));
            setIsLoading(false);
          }
          return;
        }

        // 2. Determine the fetch URL
        let fetchUrl = url;
        let isPresignedS3 = url.includes("X-Amz-Signature=") || url.includes("wasabisys.com");

        // Detect our backend download URL pattern and upgrade to presigned URL
        if (url.includes("/api/v1/documents/download") && !isPresignedS3) {
          try {
            const urlObj = new URL(url, window.location.origin);
            const fileId = urlObj.searchParams.get("file_id");

            if (fileId) {
              const presignedResponse = await api.get<{ success: boolean; url: string }>(
                `/api/v1/documents/presigned_url?file_id=${encodeURIComponent(fileId)}`,
                { skipAuthRedirect: true }
              );

              if (presignedResponse?.success && presignedResponse.url) {
                fetchUrl = presignedResponse.url;
                isPresignedS3 = true;
              }
            }
          } catch {
            // Fall back to original URL on any error
          }
        }

        // 3. Build headers
        const headers: Record<string, string> = {
          Accept: "application/pdf",
        };

        if (!isPresignedS3) {
          const token = getStorageItem<string | null>(STORAGE_KEYS.TOKEN, null);
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
        }

        // 4. Fetch the PDF with progress tracking
        const response = await fetch(fetchUrl, {
          credentials: isPresignedS3 ? "omit" : "include",
          mode: "cors",
          headers,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(`Failed to fetch PDF: ${errorText}`);
        }

        // Track download progress
        const contentLength = response.headers.get("Content-Length");
        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
        let rawBlob: Blob;

        if (totalBytes > 0 && response.body) {
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let receivedBytes = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedBytes += value.length;
            if (mounted) {
              setDownloadProgress(Math.round((receivedBytes / totalBytes) * 100));
            }
          }
          rawBlob = new Blob(chunks as BlobPart[]);
        } else {
          rawBlob = await response.blob();
        }

        blob = rawBlob.type === "application/pdf"
          ? rawBlob
          : new Blob([rawBlob], { type: "application/pdf" });

        // 5. Cache for next time
        cachePdf(url, blob).catch(() => {});

        // 6. Convert to bytes for pdfjs
        if (mounted) {
          const arrayBuffer = await blob.arrayBuffer();
          setPdfBytes(new Uint8Array(arrayBuffer));
          setIsLoading(false);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load PDF";
        console.error("Failed to load PDF:", err);
        if (mounted) {
          setLoadError(errorMessage);
          setIsLoading(false);
          onErrorRef.current?.(new Error(errorMessage));
        }
      }
    };

    loadPdf();
    return () => { mounted = false; };
  }, [url, retryKey]);

  // =============================================================================
  // Step 2: Render PDF pages to canvas via PDF.js
  // =============================================================================

  React.useEffect(() => {
    if (!pdfBytes) return;
    let cancelled = false;

    const renderPages = async () => {
      setIsRenderingPages(true);
      try {
        const { pdfjs } = await import("react-pdf");
        pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

        const pdfDoc = await pdfjs.getDocument({ data: pdfBytes }).promise;
        if (cancelled) return;

        const rendered: RenderedPage[] = [];
        const dpr = window.devicePixelRatio || 1;
        // Render at 2x base for crisp display (same as useTakeoffPdf)
        const renderScale = 2 * dpr;

        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const viewport = page.getViewport({ scale: renderScale });

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d")!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context,
            viewport,
            canvas,
          }).promise;

          // Logical dimensions (CSS pixels) — without DPR multiplier
          const baseViewport = page.getViewport({ scale: 2 });
          rendered.push({
            pageNumber: i,
            canvas,
            width: baseViewport.width,
            height: baseViewport.height,
          });

          if (cancelled) return;
        }

        setPages(rendered);
        setCurrentPageNumber(1);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to render PDF";
        console.error("Failed to render PDF pages:", err);
        setLoadError(message);
        onErrorRef.current?.(new Error(message));
      } finally {
        if (!cancelled) setIsRenderingPages(false);
      }
    };

    renderPages();
    return () => { cancelled = true; };
  }, [pdfBytes]);

  // =============================================================================
  // Step 3: Paint current page canvas to display canvas
  // =============================================================================

  React.useEffect(() => {
    const displayCanvas = displayCanvasRef.current;
    if (!displayCanvas || !currentPage) return;

    const ctx = displayCanvas.getContext("2d");
    if (!ctx) return;

    // Match display canvas to source dimensions
    displayCanvas.width = currentPage.canvas.width;
    displayCanvas.height = currentPage.canvas.height;

    // Draw the rendered PDF page
    ctx.drawImage(currentPage.canvas, 0, 0);
  }, [currentPage]);

  // =============================================================================
  // Handlers
  // =============================================================================

  const handleRetry = React.useCallback(() => {
    setLoadError(null);
    setRetryKey((k) => k + 1);
  }, []);

  const goToPage = React.useCallback((page: number) => {
    if (page >= 1 && page <= pageCount) {
      setCurrentPageNumber(page);
    }
  }, [pageCount]);

  const prevPage = React.useCallback(() => goToPage(currentPageNumber - 1), [currentPageNumber, goToPage]);
  const nextPage = React.useCallback(() => goToPage(currentPageNumber + 1), [currentPageNumber, goToPage]);

  const handleMarkupToggle = React.useCallback(() => {
    const next = !markupActive;
    setMarkupActive(next);
    onMarkupToggle?.(next);
  }, [markupActive, onMarkupToggle]);

  // Right-click area zoom handlers (only active when markup is NOT active)
  const handleZoomContextMenu = React.useCallback((e: React.MouseEvent) => {
    if (markupActive) return;
    e.preventDefault();
  }, [markupActive]);

  const handleZoomMouseDown = React.useCallback((e: React.MouseEvent) => {
    if (markupActive || e.button !== 2) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    // Position in page coordinates (unzoomed)
    const pageX = (e.clientX - rect.left + container.scrollLeft) / zoom;
    const pageY = (e.clientY - rect.top + container.scrollTop) / zoom;
    zoomDragRef.current = { startX: pageX, startY: pageY };
    setZoomRect(null);
  }, [markupActive, zoom, containerRef]);

  const handleZoomMouseMove = React.useCallback((e: React.MouseEvent) => {
    if (!zoomDragRef.current || markupActive) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const pageX = (e.clientX - rect.left + container.scrollLeft) / zoom;
    const pageY = (e.clientY - rect.top + container.scrollTop) / zoom;

    const { startX, startY } = zoomDragRef.current;
    const x = Math.min(startX, pageX);
    const y = Math.min(startY, pageY);
    const w = Math.abs(pageX - startX);
    const h = Math.abs(pageY - startY);

    setZoomRect({ x, y, w, h });
  }, [markupActive, zoom, containerRef]);

  const handleZoomMouseUp = React.useCallback((e: React.MouseEvent) => {
    if (!zoomDragRef.current || markupActive || e.button !== 2) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const pageX = (e.clientX - rect.left + container.scrollLeft) / zoom;
    const pageY = (e.clientY - rect.top + container.scrollTop) / zoom;

    const { startX, startY } = zoomDragRef.current;
    const w = Math.abs(pageX - startX);
    const h = Math.abs(pageY - startY);

    // Only zoom if drag was significant (>10px in page coords)
    if (w > 10 && h > 10) {
      zoomToRect({
        x: Math.min(startX, pageX),
        y: Math.min(startY, pageY),
        width: w,
        height: h,
      });
    }

    zoomDragRef.current = null;
    setZoomRect(null);
  }, [markupActive, zoom, containerRef, zoomToRect]);

  // Zoom display label
  const zoomPercent = Math.round(zoom * 100);

  // =============================================================================
  // Render: Loading
  // =============================================================================

  if (isLoading || (isRenderingPages && pages.length === 0)) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full", className)}>
        <Spinner size={32} className="mb-2" />
        <p className="text-sm text-muted-foreground">
          {downloadProgress !== null
            ? `Downloading PDF... ${downloadProgress}%`
            : isRenderingPages
              ? "Rendering pages..."
              : "Loading PDF..."}
        </p>
        {downloadProgress !== null && (
          <div className="w-48 h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-150 ease-out"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  // =============================================================================
  // Render: Error
  // =============================================================================

  if (loadError || !currentPage) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground p-8", className)}>
        <FileText className="h-16 w-16 mb-4" />
        <p className="text-lg font-medium mb-2">Failed to load PDF</p>
        <p className="text-sm text-center mb-4">{loadError || "Unknown error"}</p>
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

  // =============================================================================
  // Render: PDF Canvas
  // =============================================================================

  return (
    <div className={cn("h-full w-full relative overflow-hidden flex flex-col", className)}>
      {/* Floating controls — hidden when markup toolbar is active */}
      <div className={cn("absolute top-3 left-3 z-10 flex items-center gap-2", markupActive && "hidden")}>
        {/* Page navigation */}
        {pageCount > 1 && (
          <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm border rounded-md shadow-sm px-1 py-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevPage} disabled={currentPageNumber <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[80px] text-center">
              {currentPageNumber} / {pageCount}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextPage} disabled={currentPageNumber >= pageCount}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Zoom controls */}
        <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm border rounded-md shadow-sm px-1 py-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onZoomChange(zoom * 0.8)}
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[50px] text-center">
            {zoomPercent}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onZoomChange(zoom * 1.25)}
            disabled={zoom >= effectiveMaxZoom}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs font-medium"
            onClick={onFitToView}
            title="Fit page to view"
          >
            <Maximize2 className="h-3.5 w-3.5 mr-1" />
            Fit
          </Button>
        </div>

        {/* Markup toggle — only when context provided */}
        {markupContext && (
          <Button
            variant={markupActive ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-7 px-2 text-xs font-medium",
              markupActive
                ? "bg-primary text-primary-foreground"
                : "bg-background/90 backdrop-blur-sm border shadow-sm"
            )}
            onClick={handleMarkupToggle}
            title="Toggle markup tools"
          >
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Markup
          </Button>
        )}

        {/* Document label (e.g., revision badge) */}
        {label && (
          <div className="bg-background/90 backdrop-blur-sm border rounded-md shadow-sm px-2 py-0.5">
            <span className="text-xs font-mono font-medium">{label}</span>
          </div>
        )}
      </div>

      {/* Cache indicator (dev only) */}
      {process.env.NODE_ENV === "development" && isCached && (
        <div className="absolute top-2 right-2 z-10 bg-green-500 text-white text-xs px-2 py-1 rounded">
          Cached
        </div>
      )}

      {/* Scrollable canvas container — usePdfPanZoom manages zoom/pan here */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/20 relative"
        style={{ cursor: isPanning ? "grabbing" : isSpaceHeld ? "grab" : "default" }}
        onContextMenu={handleZoomContextMenu}
        onMouseDown={handleZoomMouseDown}
        onMouseMove={handleZoomMouseMove}
        onMouseUp={handleZoomMouseUp}
      >
        <div
          className="relative mx-auto"
          style={{
            width: currentPage.width * zoom,
            height: currentPage.height * zoom,
            // Add padding around the page for scroll space
            margin: "4px auto",
          }}
        >
          {/* PDF canvas — rendered at high-res, displayed at logical × zoom size */}
          <canvas
            ref={displayCanvasRef}
            className="block ring-1 ring-border/50 shadow-sm rounded-sm"
            style={{
              width: currentPage.width * zoom,
              height: currentPage.height * zoom,
            }}
          />

          {/* Right-click area zoom selection overlay */}
          {zoomRect && !markupActive && (
            <div
              className="absolute border-2 border-blue-500 bg-blue-500/15 pointer-events-none z-20"
              style={{
                left: zoomRect.x * zoom,
                top: zoomRect.y * zoom,
                width: zoomRect.w * zoom,
                height: zoomRect.h * zoom,
              }}
            />
          )}

          {/* Markup overlay — TakeoffCanvas + TakeoffToolbar */}
          {markupActive && markupContext && (
            <div className="absolute inset-0 z-10">
              <PdfMarkupOverlay
                markupContext={markupContext}
                pdfPageCanvas={currentPage.canvas}
                pageNumber={currentPageNumber}
                pageWidth={currentPage.width}
                pageHeight={currentPage.height}
                zoom={zoom}
                maxZoom={effectiveMaxZoom}
                onZoomChange={onZoomChange}
                onFitToView={onFitToView}
                onZoomToRect={zoomToRect}
                isPanning={isPanning}
                isSpaceHeld={isSpaceHeld}
                containerRef={containerRef}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
