"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { FileText, ExternalLink, RefreshCw } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "./button";

export interface FieldHighlight {
  x: number;      // percentage 0-1
  y: number;      // percentage 0-1
  width: number;  // percentage 0-1
  height: number; // percentage 0-1
  page: number;
  label?: string;
  color?: string;
  focused?: boolean;  // true = emphasized, false = dimmed
  id?: string;        // field identifier for tracking
}

export interface PDFViewerProps {
  url: string;
  className?: string;
  showToolbar?: boolean;
  showThumbnails?: boolean;
  onError?: (error: Error) => void;
  fallbackUrl?: string;
  highlights?: FieldHighlight[];
}

// Loading component shown while PDF viewer loads
function PDFViewerLoading({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center h-full", className)}>
      <Spinner size={32} className="mb-2" />
      <p className="text-sm text-muted-foreground">Loading PDF viewer...</p>
    </div>
  );
}

// Error component
function PDFViewerError({
  error,
  fallbackUrl,
  onRetry,
  className
}: {
  error: string;
  fallbackUrl?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground p-8", className)}>
      <FileText className="h-16 w-16 mb-4" />
      <p className="text-lg font-medium mb-2">Failed to load PDF</p>
      <p className="text-sm text-center mb-4">{error}</p>
      <div className="flex items-center gap-2">
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
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
  const [retryKey, setRetryKey] = React.useState(0);

  const handleError = React.useCallback((e: Error) => {
    setError(e.message || "Failed to load PDF");
    props.onError?.(e);
     
  }, [props.onError]);

  const handleRetry = React.useCallback(() => {
    setError(null);
    setRetryKey((k) => k + 1); // Force remount of PDFViewerImpl
  }, []);

  if (error) {
    return (
      <PDFViewerError
        error={error}
        fallbackUrl={props.fallbackUrl}
        onRetry={handleRetry}
        className={props.className}
      />
    );
  }

  return (
    <PDFViewerImpl
      key={retryKey}
      {...props}
      onError={handleError}
    />
  );
}
