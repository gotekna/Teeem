"use client";

import * as React from "react";
import { pdfjs } from "react-pdf";

// Set up PDF.js worker - use the version from react-pdf
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export interface TakeoffPdfPage {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  thumbnail: string; // Base64 data URL for thumbnails
}

interface UseTakeoffPdfReturn {
  pages: TakeoffPdfPage[];
  currentPage: TakeoffPdfPage | null;
  pageCount: number;
  isLoading: boolean;
  error: string | null;
  setCurrentPageNumber: (pageNumber: number) => void;
  currentPageNumber: number;
}

/**
 * Hook for loading PDF documents for takeoff measurements.
 *
 * Unlike the generic PDF viewer, this:
 * - Renders pages at higher resolution for accurate measurements
 * - Provides canvas elements directly for Fabric.js integration
 * - Generates thumbnails for page navigation
 */
export function useTakeoffPdf(url: string | null): UseTakeoffPdfReturn {
  const [pages, setPages] = React.useState<TakeoffPdfPage[]>([]);
  const [currentPageNumber, setCurrentPageNumber] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load PDF
  React.useEffect(() => {
    if (!url) {
      setPages([]);
      return;
    }

    let cancelled = false;

    const loadPdf = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Detect presigned S3 URLs - must NOT send credentials
        const isPresignedS3 =
          url.includes("X-Amz-Signature=") || url.includes("wasabisys.com");

        // Fetch PDF bytes
        const response = await fetch(url, {
          credentials: isPresignedS3 ? "omit" : "include",
          headers: { Accept: "application/pdf" },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const pdfBytes = new Uint8Array(arrayBuffer);

        // Load with pdfjs for rendering
        const loadingTask = pdfjs.getDocument({ data: pdfBytes });
        const pdfDoc = await loadingTask.promise;

        if (cancelled) return;

        // Render each page
        const loadedPages: TakeoffPdfPage[] = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);

          // Render at 2x scale for crisp display and accurate measurements
          // Multiply by devicePixelRatio for Retina/high-DPI displays
          const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
          const scale = 2 * dpr;
          const viewport = page.getViewport({ scale });

          // Create canvas for this page
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d")!;
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: context,
            viewport: viewport,
            canvas: canvas,
          }).promise;

          // Generate smaller thumbnail for navigation
          const thumbScale = 0.15 * dpr;
          const thumbViewport = page.getViewport({ scale: thumbScale });
          const thumbCanvas = document.createElement("canvas");
          const thumbContext = thumbCanvas.getContext("2d")!;
          thumbCanvas.width = thumbViewport.width;
          thumbCanvas.height = thumbViewport.height;

          await page.render({
            canvasContext: thumbContext,
            viewport: thumbViewport,
            canvas: thumbCanvas,
          }).promise;

          // Return logical dimensions (without DPR/scale multiplier)
          // so zoom calculations and Fabric.js work in CSS pixel space.
          // The canvas itself is high-res for sharp rendering.
          const baseViewport = page.getViewport({ scale: 2 });
          loadedPages.push({
            pageNumber: i,
            canvas,
            width: baseViewport.width,
            height: baseViewport.height,
            thumbnail: thumbCanvas.toDataURL("image/jpeg", 0.7),
          });

          if (cancelled) return;
        }

        setPages(loadedPages);
        setCurrentPageNumber(1);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Failed to load PDF";
        console.error("Failed to load PDF for takeoff:", err);
        setError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [url]);

  const currentPage = React.useMemo(() => {
    return pages.find((p) => p.pageNumber === currentPageNumber) || null;
  }, [pages, currentPageNumber]);

  return {
    pages,
    currentPage,
    pageCount: pages.length,
    isLoading,
    error,
    setCurrentPageNumber,
    currentPageNumber,
  };
}
