"use client";

import { useState, useEffect } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";

interface DocumentViewerStepProps {
  token: string;
  documentTitle: string;
  onContinue: () => void;
  onDecline: (reason: string) => void;
}

export function DocumentViewerStep({
  token,
  documentTitle,
  onContinue,
  onDecline,
}: DocumentViewerStepProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  const apiUrl = getApiBaseUrl();

  // Fetch document PDF
  useEffect(() => {
    const fetchDocument = async () => {
      try {
        // The backend returns the PDF content, we'll create a blob URL
        const response = await fetch(`${apiUrl}/api/v1/sign/${token}/document`);

        if (!response.ok) {
          throw new Error("Failed to load document");
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load document");
        setIsLoading(false);
      }
    };

    fetchDocument();

    // Cleanup blob URL on unmount
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [token, apiUrl]);

  // Handle scroll to track if user has viewed full document
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
    if (isAtBottom) {
      setHasScrolledToBottom(true);
    }
  };

  const handleDecline = () => {
    if (declineReason.trim()) {
      onDecline(declineReason);
      setShowDeclineDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner size={32} className="text-primary mb-4" />
        <p className="text-muted-foreground">Loading document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Unable to Load Document</h2>
        <p className="text-muted-foreground text-center">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{documentTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.max(50, zoom - 25))}
              disabled={zoom <= 50}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm w-16 text-center">{zoom}%</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setZoom(Math.min(200, zoom + 25))}
              disabled={zoom >= 200}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>

            {/* Download button */}
            {pdfUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={pdfUrl} download={`${documentTitle}.pdf`}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* PDF Viewer - constrained height so buttons are visible */}
        <div
          className="overflow-auto bg-muted dark:bg-slate-800 rounded-lg"
          style={{ maxHeight: "calc(100vh - 340px)" }}
          onScroll={handleScroll}
        >
          {pdfUrl ? (
            <div className="flex justify-center p-4">
              <iframe
                src={`${pdfUrl}#toolbar=0`}
                className="w-full bg-white shadow-lg rounded"
                style={{
                  height: "800px",
                  maxWidth: `${zoom}%`,
                }}
                title={documentTitle}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[300px]">
              <p className="text-muted-foreground">Document preview not available</p>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons - fixed above the footer, always visible */}
      <div className="fixed bottom-10 left-0 right-0 z-50 bg-white dark:bg-slate-800 border-t shadow-lg">
        <div className="max-w-4xl mx-auto px-6 py-3 flex justify-between items-center">
          <Button
            variant="outline"
            onClick={() => setShowDeclineDialog(true)}
          >
            Decline to Sign
          </Button>
          <Button size="lg" onClick={onContinue} className="font-semibold text-base px-8">
            I Have Reviewed the Document →
          </Button>
        </div>
      </div>

      {/* Decline dialog */}
      <AlertDialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline to Sign</AlertDialogTitle>
            <AlertDialogDescription>
              Please provide a reason for declining to sign this document.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Enter your reason for declining..."
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            className="min-h-[100px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDecline}
              disabled={!declineReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Decline to Sign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
