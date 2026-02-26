"use client";

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import {
  CheckCircle2,
  PenLine,
  AtSign,
  Calendar,
  TextCursor,
  MessageSquare,
  ToggleLeft,
  ThumbsUp,
  ThumbsDown,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  AlertCircle,
} from "lucide-react";
import { SignatureCaptureStep } from "./signature-capture-step";
import { cn } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/api";

// Sort fields in natural reading order: by page, then top-to-bottom, then left-to-right
function sortFieldsByReadingOrder(fields: SignatureField[]): SignatureField[] {
  return [...fields].sort((a, b) => {
    if (a.page_number !== b.page_number) return a.page_number - b.page_number;
    if (Math.abs(a.y_percent - b.y_percent) > 3) return a.y_percent - b.y_percent;
    return a.x_percent - b.x_percent;
  });
}

// Initialize pdf.js worker
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface SignatureField {
  id: number;
  field_type: "signature" | "initials" | "date" | "text" | "comment" | "yes_no";
  page_number: number;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  label?: string;
  required: boolean;
  date_format?: string;
  placeholder?: string;
  completed: boolean;
  value?: string;
}

interface PositionedSigningStepProps {
  token: string;
  documentTitle: string;
  fields: SignatureField[];
  signerName: string;
  onComplete: (completed: boolean) => void;
  onDecline: (reason: string) => void;
  /** API base URL - passed from parent to ensure consistent URL across signing flow */
  apiUrl?: string;
}

const FIELD_ICONS: Record<string, typeof PenLine> = {
  signature: PenLine,
  initials: AtSign,
  date: Calendar,
  text: TextCursor,
  comment: MessageSquare,
  yes_no: ToggleLeft,
};

export function PositionedSigningStep({
  token,
  documentTitle,
  fields: initialFields,
  signerName,
  onComplete,
  onDecline,
  apiUrl: apiUrlProp,
}: PositionedSigningStepProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number } | null>(null);
  const [fields, setFields] = useState<SignatureField[]>(initialFields);
  const [selectedField, setSelectedField] = useState<SignatureField | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captureMode, setCaptureMode] = useState<"signature" | "initials" | null>(null);
  const [confirmMode, setConfirmMode] = useState<"signature" | "initials" | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [savedInitials, setSavedInitials] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const hasAutoOpened = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Refs to avoid stale closures in navigateToField callbacks
  const savedSignatureRef = useRef<string | null>(null);
  const savedInitialsRef = useRef<string | null>(null);

  // Fields sorted in reading order for sequential navigation
  const sortedFields = React.useMemo(() => sortFieldsByReadingOrder(fields), [fields]);

  const apiUrl = apiUrlProp || getApiBaseUrl();
  const pdfUrl = `${apiUrl}/api/v1/sign/${token}/document`;

  // Find the next incomplete required field in reading order
  const findNextIncompleteField = useCallback(
    (afterFieldId?: number): SignatureField | null => {
      const sorted = sortFieldsByReadingOrder(fields);
      const required = sorted.filter((f) => f.required && !f.completed);
      if (required.length === 0) return null;

      if (afterFieldId !== undefined) {
        // Find fields that come after the given field in reading order
        const currentIndex = sorted.findIndex((f) => f.id === afterFieldId);
        if (currentIndex >= 0) {
          const remaining = sorted.slice(currentIndex + 1).filter((f) => f.required && !f.completed);
          if (remaining.length > 0) return remaining[0];
        }
        // Wrap around: return first incomplete
        return required[0];
      }
      return required[0];
    },
    [fields]
  );

  // Scroll the PDF viewer to make a field visible (centered vertically)
  const scrollToField = useCallback((field: SignatureField) => {
    const container = scrollContainerRef.current;
    if (!container || !pdfDimensions) return;
    // Field is at y_percent of the rendered page. Account for scale and padding.
    const pageHeight = pdfDimensions.height * scale;
    const fieldY = (field.y_percent / 100) * pageHeight;
    // Scroll so field is ~40% from the top of the visible area
    const targetScroll = fieldY - container.clientHeight * 0.4;
    container.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
  }, [pdfDimensions, scale]);

  // Navigate to a field: change page, scroll to badge, then open dialog.
  // If we already have a saved signature/initials, show the quick-confirm dialog instead.
  // Uses refs (not state) so the latest saved signature is always available even in stale closures.
  const navigateToField = useCallback(
    (field: SignatureField) => {
      setCurrentPage(field.page_number);
      setCaptureError(null);
      setCaptureLoading(false);

      // Delay dialog opening so the page renders and scrolls to the field first
      setTimeout(() => {
        scrollToField(field);

        // Show dialog after scroll animation
        setTimeout(() => {
          setSelectedField(field);
          if (field.field_type === "signature") {
            if (savedSignatureRef.current) {
              setConfirmMode("signature");
            } else {
              setCaptureMode("signature");
            }
          } else if (field.field_type === "initials") {
            if (savedInitialsRef.current) {
              setConfirmMode("initials");
            } else {
              setCaptureMode("initials");
            }
          }
        }, 400);
      }, 200);
    },
    [scrollToField]
  );

  // Auto-open the first incomplete field once the PDF is loaded
  const onDocumentLoadSuccess = useCallback(({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
    setPdfError(null);

    // Auto-navigate to first incomplete field after PDF loads
    if (!hasAutoOpened.current) {
      hasAutoOpened.current = true;
      // Small delay so PDF dimensions are available
      setTimeout(() => {
        const firstIncomplete = findNextIncompleteField();
        if (firstIncomplete) {
          navigateToField(firstIncomplete);
        } else {
          // All fields already complete — navigate to the last field's page so
          // the signer can review their signatures before clicking Submit
          const sorted = sortFieldsByReadingOrder(fields);
          if (sorted.length > 0) {
            const lastField = sorted[sorted.length - 1];
            setCurrentPage(lastField.page_number);
            setTimeout(() => scrollToField(lastField), 300);
          }
        }
      }, 500);
    }
  }, [findNextIncompleteField, navigateToField, fields, scrollToField]);

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error("Failed to load PDF:", error);
    if (error.message.includes("OneDrive not connected")) {
      setPdfError("The document storage is not connected. Please contact the sender.");
    } else {
      setPdfError("Failed to load the document. Please try again or contact the sender.");
    }
  }, []);

  const onPageLoadSuccess = useCallback((page: any) => {
    setPdfDimensions({
      width: page.width,
      height: page.height,
    });
  }, []);

  // Get fields for current page
  const currentPageFields = fields.filter((f) => f.page_number === currentPage);

  // Calculate completion stats
  const requiredFields = fields.filter((f) => f.required);
  const completedRequired = requiredFields.filter((f) => f.completed);
  const allRequiredComplete = completedRequired.length === requiredFields.length;

  // Handle field click - if signature already captured, show confirm; otherwise full capture
  const handleFieldClick = (field: SignatureField) => {
    if (field.completed) return;
    setSelectedField(field);

    if (field.field_type === "signature") {
      if (savedSignatureRef.current) {
        setConfirmMode("signature");
      } else {
        setCaptureMode("signature");
      }
    } else if (field.field_type === "initials") {
      if (savedInitialsRef.current) {
        setConfirmMode("initials");
      } else {
        setCaptureMode("initials");
      }
    }
  };

  // Complete a field
  const completeField = async (fieldId: number, value: string) => {
    setCaptureError(null);
    setCaptureLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/sign/${token}/fields/${fieldId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If field is already completed, treat as success - mark it done and move on
        const errorMsg = data.errors?.[0] || "";
        if (response.status === 422 && errorMsg.toLowerCase().includes("already been completed")) {
          // Field was saved by a previous attempt that returned 500
          const updatedFields = fields.map((f) =>
            f.id === fieldId ? { ...f, completed: true } : f
          );
          setFields(updatedFields);
          setSelectedField(null);
          setCaptureMode(null);
          setConfirmMode(null);
          setCaptureLoading(false);

          // Auto-navigate to next incomplete field
          const sorted = sortFieldsByReadingOrder(updatedFields);
          const required = sorted.filter((f) => f.required && !f.completed);
          if (required.length > 0) {
            const currentIndex = sorted.findIndex((f) => f.id === fieldId);
            const remaining = currentIndex >= 0
              ? sorted.slice(currentIndex + 1).filter((f) => f.required && !f.completed)
              : required;
            const nextField = remaining.length > 0 ? remaining[0] : required[0];
            setTimeout(() => navigateToField(nextField), 300);
          } else {
            await submitSignature();
          }
          return;
        }
        throw new Error(errorMsg || "Failed to complete field");
      }

      // Update local state
      const updatedFields = fields.map((f) =>
        f.id === fieldId
          ? { ...f, completed: true, value: data.field.value }
          : f
      );
      setFields(updatedFields);

      setSelectedField(null);
      setCaptureMode(null);
      setConfirmMode(null);
      setCaptureLoading(false);

      // Check if all required fields are complete
      if (data.all_fields_complete) {
        // All fields done, submit the signature
        await submitSignature();
      } else {
        // Auto-navigate to the next incomplete field after a brief pause
        const sorted = sortFieldsByReadingOrder(updatedFields);
        const required = sorted.filter((f) => f.required && !f.completed);
        if (required.length > 0) {
          // Find next field after current one in reading order
          const currentIndex = sorted.findIndex((f) => f.id === fieldId);
          const remaining = currentIndex >= 0
            ? sorted.slice(currentIndex + 1).filter((f) => f.required && !f.completed)
            : required;
          const nextField = remaining.length > 0 ? remaining[0] : required[0];
          setTimeout(() => {
            navigateToField(nextField);
          }, 300);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to complete field";
      setCaptureError(msg);
      setError(msg);
      setCaptureLoading(false);
    }
  };

  // Handle signature/initials capture - save for reuse at subsequent fields
  const handleSignatureCapture = async (signatureData: string) => {
    if (!selectedField) return;
    // Save to both state (for rendering) and ref (for callbacks) so we can
    // reuse at subsequent fields with just a Confirm click
    if (selectedField.field_type === "signature") {
      setSavedSignature(signatureData);
      savedSignatureRef.current = signatureData;
    } else if (selectedField.field_type === "initials") {
      setSavedInitials(signatureData);
      savedInitialsRef.current = signatureData;
    }
    await completeField(selectedField.id, signatureData);
  };

  // Handle quick-confirm: apply the saved signature/initials to the current field
  const handleConfirmSavedSignature = async () => {
    if (!selectedField) return;
    const data = confirmMode === "initials" ? savedInitialsRef.current : savedSignatureRef.current;
    if (!data) return;
    await completeField(selectedField.id, data);
  };

  // Handle text/date field submission
  const handleTextFieldSubmit = async (value: string) => {
    if (!selectedField) return;
    await completeField(selectedField.id, value);
  };

  // Submit the final signature
  const submitSignature = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/sign/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_data: "POSITIONED_FIELDS_COMPLETE",
          signature_type: "positioned",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.errors?.[0] || "Failed to submit signature");
      }

      onComplete(data.request_completed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit signature");
      setIsSubmitting(false);
    }
  };

  // Determine which field is "next" for visual highlighting
  const nextField = findNextIncompleteField();

  // Render a field overlay on the PDF
  const renderFieldOverlay = (field: SignatureField) => {
    if (!pdfDimensions) return null;

    const Icon = FIELD_ICONS[field.field_type];
    const isCompleted = field.completed;
    const isNext = nextField?.id === field.id;

    const style: React.CSSProperties = {
      position: "absolute",
      left: `${field.x_percent}%`,
      top: `${field.y_percent}%`,
      width: `${field.width_percent}%`,
      height: `${field.height_percent}%`,
    };

    return (
      <button
        key={field.id}
        className={cn(
          "absolute border-2 rounded transition-all flex items-center justify-center gap-1",
          isCompleted
            ? "bg-green-500/20 border-green-500 cursor-default"
            : isNext
              ? "bg-blue-500/30 border-blue-600 border-solid hover:bg-blue-500/40 cursor-pointer animate-pulse ring-2 ring-blue-400 ring-offset-1"
              : "bg-blue-500/20 border-blue-500 border-dashed hover:bg-blue-500/30 cursor-pointer"
        )}
        style={style}
        onClick={() => handleFieldClick(field)}
        disabled={isCompleted}
      >
        {isCompleted ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
        ) : (
          <>
            <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            {field.label && (
              <span className="text-xs text-blue-700 font-medium truncate max-w-[80%]">
                {field.label}
              </span>
            )}
          </>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col">
      {/* Progress bar */}
      <div className="mb-4 p-4 bg-muted rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {completedRequired.length} of {requiredFields.length} required fields completed
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeclineDialog(true)}
            >
              Decline
            </Button>
            {allRequiredComplete && (
              <Badge variant="default" className="bg-green-500">
                Ready to submit
              </Badge>
            )}
          </div>
        </div>
        <div className="w-full bg-muted-foreground/20 rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all"
            style={{
              width: `${(completedRequired.length / Math.max(requiredFields.length, 1)) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* PDF Viewer with overlays */}
      <div className="border rounded-lg bg-muted dark:bg-card">
        {/* Controls */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white/90 dark:bg-background/90 rounded-t-lg p-2 border-b">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2">
              {currentPage} / {numPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
              disabled={scale <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2">{Math.round(scale * 100)}%</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setScale((s) => Math.min(2, s + 0.25))}
              disabled={scale >= 2}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PDF Document - scrollable area */}
        <div ref={scrollContainerRef} className="overflow-auto p-4" style={{ maxHeight: "65vh", overscrollBehavior: "contain" }}>
          <div className="relative inline-block mx-auto">
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={
                <div className="flex items-center justify-center h-64">
                  <Spinner size={32} />
                </div>
              }
              error={
                <div className="flex flex-col items-center justify-center h-64 text-center p-4">
                  <AlertCircle className="h-12 w-12 text-destructive mb-4" />
                  <p className="font-medium text-destructive">Failed to load document</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {pdfError || "Please try again or contact the sender."}
                  </p>
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                scale={scale}
                onLoadSuccess={onPageLoadSuccess}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>

            {/* Field overlays */}
            {pdfDimensions && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  width: pdfDimensions.width * scale,
                  height: pdfDimensions.height * scale,
                }}
              >
                <div className="relative w-full h-full pointer-events-auto">
                  {currentPageFields.map(renderFieldOverlay)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Field navigation sidebar */}
      <Card className="mt-4">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Fields to complete</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex flex-wrap gap-2">
            {sortedFields.map((field) => {
              const Icon = FIELD_ICONS[field.field_type];
              const isNext = nextField?.id === field.id;
              return (
                <Button
                  key={field.id}
                  variant={field.completed ? "secondary" : isNext ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "text-xs",
                    field.completed && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:text-green-400",
                    isNext && !field.completed && "ring-2 ring-blue-400"
                  )}
                  onClick={() => {
                    setCurrentPage(field.page_number);
                    if (!field.completed) handleFieldClick(field);
                  }}
                >
                  {field.completed ? (
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                  ) : (
                    <Icon className="h-3 w-3 mr-1" />
                  )}
                  {field.label || `${field.field_type} (p${field.page_number})`}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Submit button */}
      {allRequiredComplete && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
          <div>
            <p className="font-medium text-green-800 dark:text-green-300">All fields completed</p>
            <p className="text-sm text-green-600 dark:text-green-400">Review the document above, then submit when ready.</p>
          </div>
          <Button onClick={submitSignature} disabled={isSubmitting} size="lg" className="bg-green-600 hover:bg-green-700 text-white">
            {isSubmitting ? (
              <>
                <Spinner size={16} className="mr-2" />
                Submitting...
              </>
            ) : (
              "Submit Signature"
            )}
          </Button>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Signature capture dialog (first time - draw/type/upload) */}
      <Dialog open={captureMode === "signature"} onOpenChange={() => { setCaptureMode(null); setSelectedField(null); setCaptureError(null); setCaptureLoading(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Draw your signature</DialogTitle>
            <DialogDescription>
              Use your mouse or finger to draw your signature below
            </DialogDescription>
          </DialogHeader>
          {captureError && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {captureError}
            </div>
          )}
          {captureLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Spinner size={32} />
              <p className="text-sm text-muted-foreground mt-3">Applying signature...</p>
            </div>
          ) : (
            <SignatureCaptureStep
              token={token}
              signerName={signerName}
              onComplete={(_, signatureData) => {
                if (signatureData) {
                  handleSignatureCapture(signatureData);
                }
              }}
              onBack={() => { setCaptureMode(null); setSelectedField(null); setCaptureError(null); }}
              embedded
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Initials capture dialog (first time - draw/type/upload) */}
      <Dialog open={captureMode === "initials"} onOpenChange={() => { setCaptureMode(null); setSelectedField(null); setCaptureError(null); setCaptureLoading(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add your initials</DialogTitle>
            <DialogDescription>
              Draw or type your initials below
            </DialogDescription>
          </DialogHeader>
          {captureError && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {captureError}
            </div>
          )}
          {captureLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Spinner size={32} />
              <p className="text-sm text-muted-foreground mt-3">Applying initials...</p>
            </div>
          ) : (
            <SignatureCaptureStep
              token={token}
              signerName={signerName}
              onComplete={(_, signatureData) => {
                if (signatureData) {
                  handleSignatureCapture(signatureData);
                }
              }}
              onBack={() => { setCaptureMode(null); setSelectedField(null); setCaptureError(null); }}
              embedded
              initialsMode
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Quick-confirm dialog (subsequent signature/initials - just confirm placement) */}
      <Dialog open={confirmMode !== null} onOpenChange={() => { setConfirmMode(null); setSelectedField(null); setCaptureError(null); setCaptureLoading(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirmMode === "initials" ? "Confirm your initials" : "Confirm your signature"}
            </DialogTitle>
            <DialogDescription>
              {selectedField?.label
                ? `Apply to: ${selectedField.label}`
                : `Apply your ${confirmMode === "initials" ? "initials" : "signature"} at this location`}
            </DialogDescription>
          </DialogHeader>
          {captureError && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {captureError}
            </div>
          )}
          {captureLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Spinner size={32} />
              <p className="text-sm text-muted-foreground mt-3">Applying...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Signature preview */}
              <div className="border rounded-lg p-4 bg-white dark:bg-muted flex items-center justify-center min-h-[80px]">
                {(confirmMode === "initials" ? savedInitials : savedSignature) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={confirmMode === "initials" ? savedInitials! : savedSignature!}
                    alt={confirmMode === "initials" ? "Your initials" : "Your signature"}
                    className="max-h-[60px] max-w-full object-contain"
                  />
                )}
              </div>
              <div className="flex justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // Let them redraw
                    setConfirmMode(null);
                    if (confirmMode === "initials") {
                      setSavedInitials(null);
                      savedInitialsRef.current = null;
                      setCaptureMode("initials");
                    } else {
                      setSavedSignature(null);
                      savedSignatureRef.current = null;
                      setCaptureMode("signature");
                    }
                  }}
                >
                  Redraw
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setConfirmMode(null); setSelectedField(null); }}>
                    Skip
                  </Button>
                  <Button onClick={handleConfirmSavedSignature}>
                    Confirm
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Text/Date/Comment field dialog */}
      <Dialog
        open={selectedField !== null && !["signature", "initials", "yes_no"].includes(selectedField?.field_type || "") && confirmMode === null && captureMode === null}
        onOpenChange={() => setSelectedField(null)}
      >
        <DialogContent className={selectedField?.field_type === "comment" ? "max-w-lg" : undefined}>
          <DialogHeader>
            <DialogTitle>
              {selectedField?.field_type === "date" ? "Enter date" : selectedField?.field_type === "comment" ? "Add your comment" : "Enter text"}
            </DialogTitle>
            <DialogDescription>
              {selectedField?.label || `Please enter ${selectedField?.field_type === "date" ? "the date" : selectedField?.field_type === "comment" ? "your comment or response" : "your response"}`}
            </DialogDescription>
          </DialogHeader>
          <TextFieldInput
            field={selectedField}
            onSubmit={handleTextFieldSubmit}
            onCancel={() => setSelectedField(null)}
          />
        </DialogContent>
      </Dialog>

      {/* Yes/No field dialog */}
      <Dialog
        open={selectedField !== null && selectedField?.field_type === "yes_no" && confirmMode === null && captureMode === null}
        onOpenChange={() => setSelectedField(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{selectedField?.label || "Yes or No?"}</DialogTitle>
            <DialogDescription>
              Please select your response
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 h-16 text-lg bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleTextFieldSubmit("Yes")}
            >
              <ThumbsUp className="h-5 w-5 mr-2" />
              Yes
            </Button>
            <Button
              className="flex-1 h-16 text-lg bg-red-600 hover:bg-red-700 text-white"
              onClick={() => handleTextFieldSubmit("No")}
            >
              <ThumbsDown className="h-5 w-5 mr-2" />
              No
            </Button>
          </div>
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={() => setSelectedField(null)}>
              Skip
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              onClick={() => {
                if (declineReason.trim()) {
                  onDecline(declineReason);
                  setShowDeclineDialog(false);
                }
              }}
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

// Text/Date field input component
function TextFieldInput({
  field,
  onSubmit,
  onCancel,
}: {
  field: SignatureField | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");

  if (!field) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() || !field.required) {
      onSubmit(value.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="field-value">
          {field.field_type === "date" ? "Date" : field.field_type === "comment" ? "Comment" : "Value"}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {field.field_type === "comment" ? (
          <Textarea
            id="field-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={field.placeholder || "Type your comment here..."}
            required={field.required}
            autoFocus
            rows={4}
            className="resize-y"
          />
        ) : (
          <Input
            id="field-value"
            type={field.field_type === "date" ? "date" : "text"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={field.placeholder || undefined}
            required={field.required}
            autoFocus
          />
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={field.required && !value.trim()}>
          Confirm
        </Button>
      </div>
    </form>
  );
}
