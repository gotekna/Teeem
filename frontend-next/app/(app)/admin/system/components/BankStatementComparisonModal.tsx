"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api";

interface BankStatementComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: {
    id: number;
    bank_name: string;
    bank_code: string;
    has_reference_image: boolean;
    reference_image_path: string | null;
  } | null;
}

export function BankStatementComparisonModal({
  open,
  onOpenChange,
  template,
}: BankStatementComparisonModalProps) {
  const [generatedPdfUrl, setGeneratedPdfUrl] = React.useState<string | null>(null);
  const [referenceUrl, setReferenceUrl] = React.useState<string | null>(null);
  const [referenceError, setReferenceError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [referenceZoom, setReferenceZoom] = React.useState(100);
  const [generatedZoom, setGeneratedZoom] = React.useState(100);

  const apiUrl = getApiBaseUrl();

  // Load both PDFs when modal opens
  React.useEffect(() => {
    if (open && template) {
      loadContent();
    }
    return () => {
      // Clean up blob URLs when modal closes
      if (generatedPdfUrl) URL.revokeObjectURL(generatedPdfUrl);
      if (referenceUrl && referenceUrl.startsWith("blob:")) URL.revokeObjectURL(referenceUrl);
    };
  }, [open, template?.id]);

  const loadContent = async () => {
    if (!template) return;
    setLoading(true);
    setReferenceZoom(100);
    setGeneratedZoom(100);
    setReferenceError(null);
    setReferenceUrl(null);

    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      // Load generated PDF
      const pdfResponse = await fetch(
        `${apiUrl}/api/v1/bank_statement_templates/${template.id}/test_pdf`,
        { credentials: "include", headers }
      );

      if (pdfResponse.ok) {
        const pdfBlob = await pdfResponse.blob();
        setGeneratedPdfUrl(URL.createObjectURL(pdfBlob));
      }

      // Load reference image if available
      if (template.has_reference_image) {
        const refResponse = await fetch(
          `${apiUrl}/api/v1/bank_statement_templates/${template.id}/reference_image`,
          { credentials: "include", headers }
        );

        if (refResponse.ok) {
          const refBlob = await refResponse.blob();
          setReferenceUrl(URL.createObjectURL(refBlob));
        } else {
          // Parse error response
          try {
            const errorData = await refResponse.json();
            setReferenceError(errorData.error || "Failed to load reference image");
          } catch {
            setReferenceError(`Failed to load reference (${refResponse.status})`);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load comparison content:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenInNewTab = () => {
    if (generatedPdfUrl) {
      window.open(generatedPdfUrl, "_blank");
    }
  };

  const adjustZoom = (side: "reference" | "generated", delta: number) => {
    if (side === "reference") {
      setReferenceZoom((prev) => Math.min(200, Math.max(50, prev + delta)));
    } else {
      setGeneratedZoom((prev) => Math.min(200, Math.max(50, prev + delta)));
    }
  };

  const resetZoom = (side: "reference" | "generated") => {
    if (side === "reference") {
      setReferenceZoom(100);
    } else {
      setGeneratedZoom(100);
    }
  };

  // Determine if reference is an image or PDF
  const isReferenceImage = template?.reference_image_path?.match(/\.(png|jpg|jpeg|gif)$/i);
  const isReferencePdf = template?.reference_image_path?.match(/\.pdf$/i);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              Compare: {template?.bank_name} Statement
              <Badge variant="outline" className="font-mono text-xs">
                {template?.bank_code}
              </Badge>
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open PDF in New Tab
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner size={32} className="text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
            {/* Reference Image Side */}
            <div className="flex flex-col border rounded-lg overflow-hidden">
              <div className="shrink-0 px-3 py-2 bg-muted flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Reference</span>
                  {template?.has_reference_image ? (
                    <Badge variant="secondary" className="text-xs">
                      {template.reference_image_path}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      No reference available
                    </Badge>
                  )}
                </div>
                {template?.has_reference_image && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => adjustZoom("reference", -25)}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-xs w-12 text-center">{referenceZoom}%</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => adjustZoom("reference", 25)}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => resetZoom("reference")}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-auto bg-neutral-100 dark:bg-neutral-900">
                {referenceUrl ? (
                  isReferenceImage ? (
                    <div className="p-4 flex justify-center">
                      <img
                        src={referenceUrl}
                        alt="Reference statement"
                        style={{ width: `${referenceZoom}%`, maxWidth: "none" }}
                        className="shadow-lg"
                      />
                    </div>
                  ) : isReferencePdf ? (
                    <iframe
                      src={referenceUrl}
                      className="w-full h-full"
                      title="Reference PDF"
                      style={{ transform: `scale(${referenceZoom / 100})`, transformOrigin: "top left" }}
                    />
                  ) : (
                    <div className="p-4 flex justify-center">
                      <img
                        src={referenceUrl}
                        alt="Reference statement"
                        style={{ width: `${referenceZoom}%`, maxWidth: "none" }}
                        className="shadow-lg"
                      />
                    </div>
                  )
                ) : (
                  <div className="flex-1 flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center p-8">
                      {referenceError ? (
                        <>
                          <p className="text-lg font-medium text-destructive">Failed to Load Reference</p>
                          <p className="text-sm mt-2">{referenceError}</p>
                          <p className="text-xs mt-4 text-muted-foreground">
                            Check Admin → System → SharePoint settings
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-medium">No Reference Available</p>
                          <p className="text-sm mt-2">
                            {template?.bank_code === "default" || template?.bank_code === "stripe"
                              ? "This template uses TEEEM internal branding"
                              : "Add a reference image to enable comparison"}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Generated PDF Side */}
            <div className="flex flex-col border rounded-lg overflow-hidden">
              <div className="shrink-0 px-3 py-2 bg-muted flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">Generated</span>
                  <Badge variant="secondary" className="text-xs">
                    Our Output
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => adjustZoom("generated", -25)}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs w-12 text-center">{generatedZoom}%</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => adjustZoom("generated", 25)}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => resetZoom("generated")}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-neutral-100 dark:bg-neutral-900">
                {generatedPdfUrl ? (
                  <iframe
                    src={generatedPdfUrl}
                    className="w-full h-full"
                    title="Generated PDF"
                    style={{
                      transform: `scale(${generatedZoom / 100})`,
                      transformOrigin: "top left",
                      width: `${10000 / generatedZoom}%`,
                      height: `${10000 / generatedZoom}%`,
                    }}
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center h-full text-muted-foreground">
                    <p>Failed to load generated PDF</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
