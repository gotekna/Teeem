"use client";

import * as React from "react";
import { Viewer, Worker, SpecialZoomLevel } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import type { PDFViewerProps } from "./pdf-viewer";
import { cn } from "@/lib/utils";

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

  return (
    <div className={cn("h-full w-full", className)}>
      <Worker workerUrl={WORKER_URL}>
        <div className="h-full w-full [&_.rpv-core__viewer]:h-full [&_.rpv-default-layout__container]:h-full">
          <Viewer
            fileUrl={url}
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
