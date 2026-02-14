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

interface SigningReviewStepProps {
  token: string;
  documentTitle: string;
  onContinue: () => void;
  onDecline: (reason: string) => void;
}

export function SigningReviewStep({
  token,
  documentTitle,
  onContinue,
  onDecline,
}: SigningReviewStepProps) {
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
    <div className="flex flex-col">
      {/* Action buttons - ABOVE the PDF so always visible */}
      <div className="flex justify-between items-center mb-4 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
        <div>
          <p className="font-medium text-sm">Please review the document below</p>
          <p className="text-xs text-muted-foreground">Scroll through the PDF, then click to continue</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeclineDialog(true)}
          >
            Decline
          </Button>
          <Button size="lg" onClick={onContinue} className="font-semibold">
            I Have Reviewed — Continue to Sign →
          </Button>
        </div>
      </div>

      {/* Document header with zoom/download */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium text-sm">{documentTitle}</span>
        </div>
        <div className="flex items-center gap-2">
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

      {/* PDF Viewer */}
      <div
        className="overflow-auto bg-muted dark:bg-slate-800 rounded-lg mb-4"
        onScroll={handleScroll}
      >
        {pdfUrl ? (
          <div className="flex justify-center p-4">
            <iframe
              src={`${pdfUrl}#toolbar=0`}
              className="w-full bg-white shadow-lg rounded"
              style={{
                height: "600px",
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
    </div>
  );
}
