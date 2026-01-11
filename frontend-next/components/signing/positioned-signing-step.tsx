"use client";

import * as React from "react";
import { useState, useCallback } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  CheckCircle2,
  PenLine,
  AtSign,
  Calendar,
  TextCursor,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  AlertCircle,
} from "lucide-react";
import { SignatureCaptureStep } from "./signature-capture-step";
import { cn } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/api";

// Initialize pdf.js worker
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface SignatureField {
  id: number;
  field_type: "signature" | "initials" | "date" | "text";
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
}

const FIELD_ICONS = {
  signature: PenLine,
  initials: AtSign,
  date: Calendar,
  text: TextCursor,
};

export function PositionedSigningStep({
  token,
  documentTitle,
  fields: initialFields,
  signerName,
  onComplete,
  onDecline,
}: PositionedSigningStepProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number } | null>(null);
  const [fields, setFields] = useState<SignatureField[]>(initialFields);
  const [selectedField, setSelectedField] = useState<SignatureField | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captureMode, setCaptureMode] = useState<"signature" | "initials" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const apiUrl = getApiBaseUrl();
  const pdfUrl = `${apiUrl}/api/v1/sign/${token}/document`;

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfError(null);
  }, []);

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

  // Handle field click
  const handleFieldClick = (field: SignatureField) => {
    if (field.completed) return;
    setSelectedField(field);

    if (field.field_type === "signature") {
      setCaptureMode("signature");
    } else if (field.field_type === "initials") {
      setCaptureMode("initials");
    }
  };

  // Complete a field
  const completeField = async (fieldId: number, value: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/v1/sign/${token}/fields/${fieldId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.errors?.[0] || "Failed to complete field");
      }

      // Update local state
      setFields((prev) =>
        prev.map((f) =>
          f.id === fieldId
            ? { ...f, completed: true, value: data.field.value }
            : f
        )
      );

      setSelectedField(null);
      setCaptureMode(null);

      // Check if all required fields are complete
      if (data.all_fields_complete) {
        // All fields done, submit the signature
        await submitSignature();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete field");
    }
  };

  // Handle signature/initials capture
  const handleSignatureCapture = async (signatureData: string) => {
    if (!selectedField) return;
    await completeField(selectedField.id, signatureData);
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

  // Render a field overlay on the PDF
  const renderFieldOverlay = (field: SignatureField) => {
    if (!pdfDimensions) return null;

    const Icon = FIELD_ICONS[field.field_type];
    const isCompleted = field.completed;

    const style: React.CSSProperties = {
      position: "absolute",
      left: `${field.x_percent}%`,
      top: `${field.y_percent}%`,
      width: `${field.width_percent}%`,
      height: `${field.height_percent}%`,
      transform: `scale(${scale})`,
      transformOrigin: "top left",
    };

    return (
      <button
        key={field.id}
        className={cn(
          "absolute border-2 rounded transition-all flex items-center justify-center gap-1",
          isCompleted
            ? "bg-green-500/20 border-green-500 cursor-default"
            : "bg-blue-500/20 border-blue-500 border-dashed hover:bg-blue-500/30 cursor-pointer animate-pulse"
        )}
        style={style}
        onClick={() => handleFieldClick(field)}
        disabled={isCompleted}
      >
        {isCompleted ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <>
            <Icon className="h-4 w-4 text-blue-600" />
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
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="mb-4 p-4 bg-muted rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            {completedRequired.length} of {requiredFields.length} required fields completed
          </span>
          {allRequiredComplete && (
            <Badge variant="default" className="bg-green-500">
              Ready to submit
            </Badge>
          )}
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
      <div className="flex-1 relative border rounded-lg overflow-hidden bg-muted dark:bg-card">
        {/* Controls */}
        <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between bg-white/90 dark:bg-background/90 rounded-lg p-2 shadow-sm">
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

        {/* PDF Document */}
        <div className="h-full overflow-auto p-4 pt-16">
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
            {fields.map((field) => {
              const Icon = FIELD_ICONS[field.field_type];
              return (
                <Button
                  key={field.id}
                  variant={field.completed ? "secondary" : "outline"}
                  size="sm"
                  className={cn(
                    "text-xs",
                    field.completed && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
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
        <div className="mt-4 flex justify-end">
          <Button onClick={submitSignature} disabled={isSubmitting} size="lg">
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

      {/* Signature capture dialog */}
      <Dialog open={captureMode === "signature"} onOpenChange={() => setCaptureMode(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Draw your signature</DialogTitle>
            <DialogDescription>
              Use your mouse or finger to draw your signature below
            </DialogDescription>
          </DialogHeader>
          <SignatureCaptureStep
            token={token}
            signerName={signerName}
            onComplete={(_, signatureData) => {
              if (signatureData) {
                handleSignatureCapture(signatureData);
              }
            }}
            onBack={() => setCaptureMode(null)}
            embedded
          />
        </DialogContent>
      </Dialog>

      {/* Initials capture dialog */}
      <Dialog open={captureMode === "initials"} onOpenChange={() => setCaptureMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add your initials</DialogTitle>
            <DialogDescription>
              Draw or type your initials below
            </DialogDescription>
          </DialogHeader>
          <SignatureCaptureStep
            token={token}
            signerName={signerName}
            onComplete={(_, signatureData) => {
              if (signatureData) {
                handleSignatureCapture(signatureData);
              }
            }}
            onBack={() => setCaptureMode(null)}
            embedded
            initialsMode
          />
        </DialogContent>
      </Dialog>

      {/* Text/Date field dialog */}
      <Dialog
        open={selectedField !== null && !["signature", "initials"].includes(selectedField?.field_type || "")}
        onOpenChange={() => setSelectedField(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedField?.field_type === "date" ? "Enter date" : "Enter text"}
            </DialogTitle>
            <DialogDescription>
              {selectedField?.label || `Please enter ${selectedField?.field_type === "date" ? "the date" : "your response"}`}
            </DialogDescription>
          </DialogHeader>
          <TextFieldInput
            field={selectedField}
            onSubmit={handleTextFieldSubmit}
            onCancel={() => setSelectedField(null)}
          />
        </DialogContent>
      </Dialog>
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
          {field.field_type === "date" ? "Date" : "Value"}
          {field.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          id="field-value"
          type={field.field_type === "date" ? "date" : "text"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={field.placeholder || undefined}
          required={field.required}
          autoFocus
        />
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
