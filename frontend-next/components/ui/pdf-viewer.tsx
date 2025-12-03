"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Loader2, FileText, ExternalLink } from "lucide-react";
import { Button } from "./button";

export interface PDFViewerProps {
  url: string;
  className?: string;
  showToolbar?: boolean;
  showThumbnails?: boolean;
  onError?: (error: Error) => void;
  fallbackUrl?: string;
}

// Loading component shown while PDF viewer loads
function PDFViewerLoading({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center h-full", className)}>
      <Loader2 className="h-8 w-8 animate-spin mb-2" />
      <p className="text-sm text-muted-foreground">Loading PDF viewer...</p>
    </div>
  );
}

// Error component
function PDFViewerError({
  error,
  fallbackUrl,
  className
}: {
  error: string;
  fallbackUrl?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground p-8", className)}>
      <FileText className="h-16 w-16 mb-4" />
      <p className="text-lg font-medium mb-2">Failed to load PDF</p>
      <p className="text-sm text-center mb-4">{error}</p>
      {fallbackUrl && (
        <Button asChild>
          <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in New Tab
          </a>
        </Button>
      )}
    </div>
  );
}

// Dynamically import the actual PDF viewer implementation
const PDFViewerImpl = dynamic(
  () => import("./pdf-viewer-impl").then((mod) => mod.PDFViewerImpl),
  {
    ssr: false,
    loading: () => <PDFViewerLoading />,
  }
);

export function PDFViewer(props: PDFViewerProps) {
  const [error, setError] = React.useState<string | null>(null);

  const handleError = React.useCallback((e: Error) => {
    setError(e.message || "Failed to load PDF");
    props.onError?.(e);
  }, [props.onError]);

  if (error) {
    return (
      <PDFViewerError
        error={error}
        fallbackUrl={props.fallbackUrl}
        className={props.className}
      />
    );
  }

  return (
    <PDFViewerImpl
      {...props}
      onError={handleError}
    />
  );
}
