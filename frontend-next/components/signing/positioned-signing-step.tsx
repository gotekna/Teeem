"use client";

import * as React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
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
  User,
  CaseSensitive,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertCircle,
  PanelRight,
  X,
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
  field_type: "signature" | "initials" | "date" | "text" | "comment" | "yes_no" | "signer_name" | "signer_initials";
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
  signer_name: User,
  signer_initials: CaseSensitive,
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
  const [autoFitScale, setAutoFitScale] = useState(1);
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
  const [showSidePanel, setShowSidePanel] = useState(false);
  const hasAutoOpened = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Refs to avoid stale closures in navigateToField callbacks
  const savedSignatureRef = useRef<string | null>(null);
  const savedInitialsRef = useRef<string | null>(null);

  // Fields sorted in reading order for sequential navigation
  const sortedFields = React.useMemo(() => sortFieldsByReadingOrder(fields), [fields]);

  const apiUrl = apiUrlProp || getApiBaseUrl();
  const pdfUrl = `${apiUrl}/api/v1/sign/${token}/document`;

  // Auto-fit PDF to container width, recalculate on resize
  const calculateFitScale = useCallback(() => {
    const container = pdfContainerRef.current;
    if (!container || !pdfDimensions) return;
    const containerWidth = container.clientWidth - 32; // 16px padding each side
    const fitScale = containerWidth / pdfDimensions.width;
    // Clamp between 0.4 and 2.0
    const clamped = Math.min(2.0, Math.max(0.4, fitScale));
    setAutoFitScale(clamped);
    setScale(clamped);
  }, [pdfDimensions]);

  useEffect(() => {
    calculateFitScale();
  }, [calculateFitScale]);

  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => calculateFitScale());
    observer.observe(container);
    return () => observer.disconnect();
  }, [calculateFitScale]);

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
        setTimeout(async () => {
          // Auto-fill name/initials fields silently (no dialog)
          if (field.field_type === "signer_name" || field.field_type === "signer_initials") {
            const value = field.field_type === "signer_name"
              ? signerName
              : signerName.split(/\s+/).map((w) => w[0]?.toUpperCase() || "").join("");
            try {
              const response = await fetch(`${apiUrl}/api/v1/sign/${token}/fields/${field.id}/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ value }),
              });
              if (response.ok) {
                setFields((prev) => prev.map((f) => f.id === field.id ? { ...f, completed: true, value } : f));
              }
            } catch {
              // Fall through to manual handling
            }
            return;
          }

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
    [scrollToField, signerName, apiUrl, token]
  );

  // Auto-open the first incomplete field once the PDF is loaded
  const onDocumentLoadSuccess = useCallback(({ numPages: pages }: { numPages: number }) => {
    setNumPages(pages);
    setPdfError(null);

    // Auto-navigate to first incomplete field after PDF loads
    if (!hasAutoOpened.current) {
      hasAutoOpened.current = true;
      // Small delay so PDF dimensions are available
      setTimeout(async () => {
        // Auto-fill signer_name and signer_initials fields first (no user interaction needed)
        const autoFields = fields.filter(
          (f) => !f.completed && (f.field_type === "signer_name" || f.field_type === "signer_initials")
        );
        for (const field of autoFields) {
          const value = field.field_type === "signer_name"
            ? signerName
            : signerName.split(/\s+/).map((w) => w[0]?.toUpperCase() || "").join("");
          try {
            const response = await fetch(`${apiUrl}/api/v1/sign/${token}/fields/${field.id}/complete`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ value }),
            });
            if (response.ok) {
              setFields((prev) => prev.map((f) => f.id === field.id ? { ...f, completed: true, value } : f));
            }
          } catch {
            // Silently continue - field will remain for manual completion on click
          }
        }

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
  }, [findNextIncompleteField, navigateToField, fields, scrollToField, signerName, apiUrl, token]);

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

    // Auto-fill name/initials fields on click (no dialog needed)
    if (field.field_type === "signer_name") {
      completeField(field.id, signerName);
      return;
    }
    if (field.field_type === "signer_initials") {
      const initials = signerName.split(/\s+/).map((w) => w[0]?.toUpperCase() || "").join("");
      completeField(field.id, initials);
      return;
    }

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

  // Count fields on current page for the page indicator
  const currentPageFieldCount = currentPageFields.length;
  const currentPageCompletedCount = currentPageFields.filter((f) => f.completed).length;

  return (
    <div className="flex h-full">
      {/* Main PDF area - takes all available space */}
      <div ref={pdfContainerRef} className="flex-1 flex flex-col min-w-0 bg-gray-200 dark:bg-gray-900">
        {/* Top toolbar - compact */}
        <div className="flex-shrink-0 flex items-center justify-between bg-white dark:bg-gray-800 px-3 py-1.5 border-b z-10">
          {/* Left: page navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm tabular-nums min-w-[60px] text-center">
              {currentPage} / {numPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {currentPageFieldCount > 0 && (
              <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
                {currentPageCompletedCount}/{currentPageFieldCount} fields on this page
              </span>
            )}
          </div>

          {/* Center: progress indicator (compact) */}
          <div className="hidden sm:flex items-center gap-2 flex-1 max-w-xs mx-4">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all"
                style={{
                  width: `${(completedRequired.length / Math.max(requiredFields.length, 1)) * 100}%`,
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {completedRequired.length}/{requiredFields.length}
            </span>
          </div>

          {/* Right: zoom + panel toggle */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
              disabled={scale <= 0.3}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <button
              className="text-xs tabular-nums min-w-[40px] text-center hover:text-blue-600 cursor-pointer"
              onClick={() => { calculateFitScale(); }}
              title="Fit to width"
            >
              {Math.round(scale * 100)}%
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setScale((s) => Math.min(3, s + 0.1))}
              disabled={scale >= 3}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 lg:hidden"
              onClick={() => setShowSidePanel(!showSidePanel)}
              title="Toggle panel"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PDF Document - fills remaining space */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4" style={{ overscrollBehavior: "contain" }}>
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

      {/* Side panel - always visible on lg+, toggleable overlay on mobile */}
      <div className={cn(
        "flex-shrink-0 bg-white dark:bg-gray-800 border-l flex flex-col overflow-hidden transition-all duration-200",
        // Desktop: always visible, fixed width
        "hidden lg:flex lg:w-72",
        // Mobile: overlay when toggled
        showSidePanel && "!flex fixed inset-y-0 right-0 w-80 z-50 shadow-xl lg:relative lg:shadow-none lg:inset-auto"
      )}>
        {/* Mobile close button */}
        <div className="flex items-center justify-between p-3 border-b lg:hidden">
          <span className="font-medium text-sm">Signing Progress</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowSidePanel(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Progress section */}
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              {completedRequired.length} of {requiredFields.length} fields
            </span>
            {allRequiredComplete && (
              <Badge variant="default" className="bg-green-500 text-xs py-0">
                Ready
              </Badge>
            )}
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{
                width: `${(completedRequired.length / Math.max(requiredFields.length, 1)) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Field list - scrollable */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1.5">
            {sortedFields.map((field) => {
              const Icon = FIELD_ICONS[field.field_type];
              const isNext = nextField?.id === field.id;
              return (
                <button
                  key={field.id}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left text-sm transition-colors",
                    field.completed
                      ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                      : isNext
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 ring-1 ring-blue-300"
                        : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  )}
                  onClick={() => {
                    setCurrentPage(field.page_number);
                    if (!field.completed) handleFieldClick(field);
                    setShowSidePanel(false);
                  }}
                >
                  {field.completed ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                  ) : (
                    <Icon className={cn("h-4 w-4 flex-shrink-0", isNext ? "text-blue-600" : "text-gray-400")} />
                  )}
                  <span className="truncate text-xs">
                    {field.label || `${field.field_type}`}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                    p{field.page_number}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action buttons at bottom */}
        <div className="p-3 border-t space-y-2">
          {allRequiredComplete ? (
            <Button
              onClick={submitSignature}
              disabled={isSubmitting}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Submitting...
                </>
              ) : (
                "Submit Signature"
              )}
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => {
                const next = findNextIncompleteField();
                if (next) {
                  navigateToField(next);
                  setShowSidePanel(false);
                }
              }}
              disabled={!nextField}
            >
              <PenLine className="h-4 w-4 mr-1.5" />
              Sign Next Field
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => setShowDeclineDialog(true)}
          >
            Decline to Sign
          </Button>
        </div>
      </div>

      {/* Mobile backdrop */}
      {showSidePanel && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setShowSidePanel(false)}
        />
      )}

      {/* Error display - floating toast style */}
      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md p-3 bg-destructive text-destructive-foreground rounded-lg shadow-lg text-sm">
          {error}
          <button className="ml-2 underline text-xs" onClick={() => setError(null)}>Dismiss</button>
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
