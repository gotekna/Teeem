"use client";

import * as React from "react";
import { Viewer, Worker, SpecialZoomLevel } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import type { PDFViewerProps } from "./pdf-viewer";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// Import styles
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

// PDF.js worker URL - use CDN for reliability
const WORKER_URL = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

export function PDFViewerImpl({
  url,
  className,
  showThumbnails = false,
  onError,
}: PDFViewerProps) {
  const [pdfData, setPdfData] = React.useState<Uint8Array | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

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

  // Initialize the default layout plugin
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: showThumbnails
      ? (defaultTabs) => defaultTabs
      : () => [], // Hide sidebar if no thumbnails needed
    toolbarPlugin: {
      fullScreenPlugin: {
        onEnterFullScreen: (zoom) => {
          zoom(SpecialZoomLevel.PageFit);
        },
        onExitFullScreen: (zoom) => {
          zoom(SpecialZoomLevel.PageFit);
        },
      },
    },
  });

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (loadError || !pdfData) {
    return (
      <div className={cn("flex items-center justify-center h-full text-muted-foreground", className)}>
        <p>{loadError || "Failed to load PDF"}</p>
      </div>
    );
  }

  return (
    <div className={cn("h-full w-full", className)}>
      <Worker workerUrl={WORKER_URL}>
        <div className="h-full w-full [&_.rpv-core__viewer]:h-full [&_.rpv-default-layout__container]:h-full">
          <Viewer
            fileUrl={pdfData}
            plugins={[defaultLayoutPluginInstance]}
            defaultScale={SpecialZoomLevel.PageFit}
            renderError={(error) => {
              // Defer the callback to avoid updating state during render
              if (onError) {
                setTimeout(() => onError(new Error(error.message || "Failed to load PDF")), 0);
              }
              return (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p>Error loading PDF</p>
                </div>
              );
            }}
          />
        </div>
      </Worker>
    </div>
  );
}
