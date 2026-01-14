"use client";

import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Trash2,
  Plus,
  Sparkles,
  Save,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

// Initialize pdf.js worker
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export interface SignatureFieldConfig {
  signatory_type: "director" | "secretary" | "witness" | "authorized_signatory" | "unknown";
  signatory_name: string | null;
  page_number: number;
  x_percent: number;
  y_percent: number;
  width_percent: number;
  height_percent: number;
  has_existing_signature?: boolean;
}

interface SignatureFieldConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentTypeId: number;
  documentTypeName: string;
  /** Base64-encoded PDF content for preview */
  pdfContent?: string;
  /** Initial field config from DocumentType */
  initialConfig?: SignatureFieldConfig[];
  /** Callback when config is saved */
  onSave: (config: SignatureFieldConfig[]) => void;
}

const SIGNATORY_TYPES = [
  { value: "director", label: "Director", color: "bg-blue-500" },
  { value: "secretary", label: "Secretary", color: "bg-green-500" },
  { value: "witness", label: "Witness", color: "bg-purple-500" },
  { value: "authorized_signatory", label: "Authorised Signatory", color: "bg-orange-500" },
  { value: "unknown", label: "Other", color: "bg-gray-500" },
] as const;

export function SignatureFieldConfigModal({
  open,
  onOpenChange,
  documentTypeId,
  documentTypeName,
  pdfContent,
  initialConfig = [],
  onSave,
}: SignatureFieldConfigModalProps) {
  const [fields, setFields] = useState<SignatureFieldConfig[]>(initialConfig);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(0.8);
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number } | null>(null);
  const [selectedFieldIndex, setSelectedFieldIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const pageRef = useRef<HTMLDivElement>(null);

  // Reset fields when modal opens with initial config
  useEffect(() => {
    if (open) {
      setFields(initialConfig);
      setCurrentPage(1);
      setSelectedFieldIndex(null);
    }
  }, [open, initialConfig]);

  // Detect signature fields using AI
  const handleDetectFields = async () => {
    if (!pdfContent) {
      toast.error("No PDF content available for detection");
      return;
    }

    setIsDetecting(true);
    try {
      const response = await api.post<{ success: boolean; fields?: SignatureFieldConfig[]; error?: string }>(
        `/document_types/${documentTypeId}/detect_signature_fields`,
        { pdf_content: pdfContent }
      );

      if (response && response.success && response.fields) {
        setFields(response.fields);
        toast.success(`Detected ${response.fields.length} signature field(s)`);
      } else {
        toast.error(response?.error || "Failed to detect signature fields");
      }
    } catch (error) {
      console.error("Detection error:", error);
      toast.error("Failed to detect signature fields");
    } finally {
      setIsDetecting(false);
    }
  };

  // Add a new field manually
  const handleAddField = () => {
    const newField: SignatureFieldConfig = {
      signatory_type: "director",
      signatory_name: null,
      page_number: currentPage,
      x_percent: 70,
      y_percent: 80,
      width_percent: 20,
      height_percent: 8,
      has_existing_signature: false,
    };
    setFields([...fields, newField]);
    setSelectedFieldIndex(fields.length);
  };

  // Delete a field
  const handleDeleteField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
    setSelectedFieldIndex(null);
  };

  // Save configuration
  const handleSave = async () => {
    setIsSaving(true);
    try {
      onSave(fields);
      toast.success("Signature field configuration saved");
      onOpenChange(false);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save configuration");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle clicking on PDF to reposition selected field
  const handlePageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (selectedFieldIndex === null || !pdfDimensions || !pageRef.current) return;

      const rect = pageRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const scaledWidth = pdfDimensions.width * scale;
      const scaledHeight = pdfDimensions.height * scale;

      const xPercent = (x / scaledWidth) * 100;
      const yPercent = (y / scaledHeight) * 100;

      const field = fields[selectedFieldIndex];
      const updatedFields = [...fields];
      updatedFields[selectedFieldIndex] = {
        ...field,
        page_number: currentPage,
        x_percent: Math.max(field.width_percent / 2, Math.min(100 - field.width_percent / 2, xPercent)),
        y_percent: Math.max(field.height_percent / 2, Math.min(100 - field.height_percent / 2, yPercent)),
      };
      setFields(updatedFields);
    },
    [selectedFieldIndex, pdfDimensions, scale, currentPage, fields]
  );

  // Get fields for current page
  const currentPageFields = fields.filter((f) => f.page_number === currentPage);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const onPageLoadSuccess = useCallback((page: any) => {
    setPdfDimensions({ width: page.width, height: page.height });
  }, []);

  const pdfDataUrl = pdfContent ? `data:application/pdf;base64,${pdfContent}` : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Configure Signature Fields</DialogTitle>
          <DialogDescription>
            Set up signature field positions for &quot;{documentTypeName}&quot; template.
            These positions will be used when converting Word documents to PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 gap-4 min-h-0">
          {/* PDF Preview */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-2 px-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {numPages || "..."}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                  disabled={currentPage >= numPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground w-12 text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setScale((s) => Math.min(2, s + 0.1))}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 border rounded-lg overflow-auto bg-muted/30">
              {pdfDataUrl ? (
                <div className="p-4 flex justify-center">
                  <div
                    ref={pageRef}
                    className="relative cursor-crosshair"
                    onClick={handlePageClick}
                  >
                    <Document file={pdfDataUrl} onLoadSuccess={onDocumentLoadSuccess}>
                      <Page
                        pageNumber={currentPage}
                        scale={scale}
                        onLoadSuccess={onPageLoadSuccess}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                      />
                    </Document>

                    {/* Render field overlays */}
                    {pdfDimensions &&
                      currentPageFields.map((field, idx) => {
                        const globalIndex = fields.indexOf(field);
                        const typeConfig = SIGNATORY_TYPES.find((t) => t.value === field.signatory_type);
                        const isSelected = selectedFieldIndex === globalIndex;

                        return (
                          <div
                            key={globalIndex}
                            className={cn(
                              "absolute border-2 border-dashed rounded cursor-move transition-colors",
                              isSelected ? "border-primary bg-primary/10" : "border-muted-foreground/50 bg-muted/20",
                              field.has_existing_signature && "opacity-50"
                            )}
                            style={{
                              left: `${(field.x_percent - field.width_percent / 2) * scale}%`,
                              top: `${(field.y_percent - field.height_percent / 2) * scale}%`,
                              width: `${field.width_percent * scale}%`,
                              height: `${field.height_percent * scale}%`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFieldIndex(globalIndex);
                            }}
                          >
                            <div className={cn("absolute -top-5 left-0 text-xs px-1 rounded", typeConfig?.color, "text-white")}>
                              {typeConfig?.label || "Unknown"}
                            </div>
                            {field.has_existing_signature && (
                              <Badge variant="secondary" className="absolute -bottom-5 left-0 text-xs">
                                Signed
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <p>Upload a PDF to configure signature fields</p>
                </div>
              )}
            </div>
          </div>

          {/* Field List Panel */}
          <div className="w-64 flex flex-col border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Signature Fields</h3>
              <Button variant="ghost" size="icon" onClick={handleAddField}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {pdfContent && (
              <Button
                variant="outline"
                onClick={handleDetectFields}
                disabled={isDetecting}
                className="mb-4"
              >
                {isDetecting ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Detecting...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    AI Detect Fields
                  </>
                )}
              </Button>
            )}

            <div className="flex-1 overflow-auto space-y-2">
              {fields.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No fields configured. Click &quot;AI Detect&quot; or add manually.
                </p>
              ) : (
                fields.map((field, index) => {
                  const typeConfig = SIGNATORY_TYPES.find((t) => t.value === field.signatory_type);
                  const isSelected = selectedFieldIndex === index;

                  return (
                    <div
                      key={index}
                      className={cn(
                        "p-2 rounded border cursor-pointer transition-colors",
                        isSelected ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
                      )}
                      onClick={() => {
                        setSelectedFieldIndex(index);
                        setCurrentPage(field.page_number);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", typeConfig?.color)} />
                          <span className="text-sm font-medium">{typeConfig?.label}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteField(index);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Page {field.page_number} • ({Math.round(field.x_percent)}%, {Math.round(field.y_percent)}%)
                      </div>
                      {field.signatory_name && (
                        <div className="text-xs text-muted-foreground">{field.signatory_name}</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
