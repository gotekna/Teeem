"use client";

import * as React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  PenLine,
  AtSign,
  Calendar,
  TextCursor,
  Trash2,
  GripVertical,
} from "lucide-react";
import type {
  Signer,
  SignatureField,
  SignatureFieldType,
  AnnotationTool,
} from "@/components/ui/pdf-editor/types";
import {
  DEFAULT_FIELD_DIMENSIONS,
  SIGNER_COLORS,
} from "@/components/ui/pdf-editor/types";
import { SignerPanel } from "@/components/ui/pdf-editor/signer-panel";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// Initialize pdf.js worker
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface ESignaturePdfEditorProps {
  url: string;
  signers: Signer[];
  selectedSigner: Signer | null;
  onSelectSigner: (signer: Signer | null) => void;
  fields: SignatureField[];
  onFieldsChange: (fields: SignatureField[]) => void;
  // Optional signer management callbacks
  onAddSigner?: (email: string, name?: string) => void;
  onRemoveSigner?: (signerId: string) => void;
  onReorderSigners?: (signers: Signer[]) => void;
}

const FIELD_TOOLS: { type: SignatureFieldType; icon: React.ReactNode; label: string }[] = [
  { type: "signature", icon: <PenLine className="h-4 w-4" />, label: "Signature" },
  { type: "initials", icon: <AtSign className="h-4 w-4" />, label: "Initials" },
  { type: "date", icon: <Calendar className="h-4 w-4" />, label: "Date" },
  { type: "text", icon: <TextCursor className="h-4 w-4" />, label: "Text" },
];

export function ESignaturePdfEditor({
  url,
  signers,
  selectedSigner,
  onSelectSigner,
  fields,
  onFieldsChange,
  onAddSigner,
  onRemoveSigner,
  onReorderSigners,
}: ESignaturePdfEditorProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number } | null>(null);
  const [selectedTool, setSelectedTool] = useState<SignatureFieldType | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const onPageLoadSuccess = useCallback((page: any) => {
    setPdfDimensions({
      width: page.width,
      height: page.height,
    });
  }, []);

  // Get fields for current page
  const currentPageFields = fields.filter((f) => f.pageNumber === currentPage);

  // Handle clicking on the PDF to place a field
  const handlePageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!selectedTool || !selectedSigner || !pdfDimensions || !pageRef.current) return;

      const rect = pageRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Convert to percentage
      const scaledWidth = pdfDimensions.width * scale;
      const scaledHeight = pdfDimensions.height * scale;

      const xPercent = (x / scaledWidth) * 100;
      const yPercent = (y / scaledHeight) * 100;

      // Get default dimensions for this field type
      const dimensions = DEFAULT_FIELD_DIMENSIONS[selectedTool];

      // Create new field
      const newField: SignatureField = {
        id: `field-${Date.now()}`,
        type: selectedTool,
        pageId: `page-${currentPage}`,
        pageNumber: currentPage,
        signerId: selectedSigner.id,
        signerEmail: selectedSigner.email,
        signerColor: selectedSigner.color,
        xPercent: Math.max(0, Math.min(100 - dimensions.width, xPercent)),
        yPercent: Math.max(0, Math.min(100 - dimensions.height, yPercent)),
        widthPercent: dimensions.width,
        heightPercent: dimensions.height,
        required: true,
      };

      onFieldsChange([...fields, newField]);
      setSelectedFieldId(newField.id);
    },
    [selectedTool, selectedSigner, pdfDimensions, scale, currentPage, fields, onFieldsChange]
  );

  // Handle field deletion
  const handleDeleteField = useCallback(
    (fieldId: string) => {
      onFieldsChange(fields.filter((f) => f.id !== fieldId));
      if (selectedFieldId === fieldId) {
        setSelectedFieldId(null);
      }
    },
    [fields, onFieldsChange, selectedFieldId]
  );

  // Handle field drag start
  const handleFieldMouseDown = useCallback(
    (e: React.MouseEvent, field: SignatureField) => {
      e.stopPropagation();
      if (!pdfDimensions || !pageRef.current) return;

      const rect = pageRef.current.getBoundingClientRect();
      const scaledWidth = pdfDimensions.width * scale;
      const scaledHeight = pdfDimensions.height * scale;

      // Calculate offset from mouse to field top-left corner
      const fieldX = (field.xPercent / 100) * scaledWidth;
      const fieldY = (field.yPercent / 100) * scaledHeight;

      setDragOffset({
        x: e.clientX - rect.left - fieldX,
        y: e.clientY - rect.top - fieldY,
      });

      setSelectedFieldId(field.id);
      setIsDragging(true);
    },
    [pdfDimensions, scale]
  );

  // Handle field dragging
  useEffect(() => {
    if (!isDragging || !selectedFieldId || !pdfDimensions || !pageRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = pageRef.current!.getBoundingClientRect();
      const scaledWidth = pdfDimensions.width * scale;
      const scaledHeight = pdfDimensions.height * scale;

      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;

      const field = fields.find((f) => f.id === selectedFieldId);
      if (!field) return;

      const xPercent = Math.max(0, Math.min(100 - field.widthPercent, (x / scaledWidth) * 100));
      const yPercent = Math.max(0, Math.min(100 - field.heightPercent, (y / scaledHeight) * 100));

      onFieldsChange(
        fields.map((f) =>
          f.id === selectedFieldId ? { ...f, xPercent, yPercent } : f
        )
      );
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, selectedFieldId, pdfDimensions, scale, dragOffset, fields, onFieldsChange]);

  // Render a field on the PDF
  const renderField = (field: SignatureField) => {
    if (!pdfDimensions) return null;

    const isSelected = selectedFieldId === field.id;
    const FieldIcon = FIELD_TOOLS.find((t) => t.type === field.type)?.icon || <PenLine className="h-4 w-4" />;

    return (
      <div
        key={field.id}
        className={cn(
          "absolute border-2 rounded cursor-move transition-all flex items-center justify-center gap-1 group",
          isSelected ? "ring-2 ring-offset-1 ring-primary" : ""
        )}
        style={{
          left: `${field.xPercent}%`,
          top: `${field.yPercent}%`,
          width: `${field.widthPercent}%`,
          height: `${field.heightPercent}%`,
          backgroundColor: `${field.signerColor}20`,
          borderColor: field.signerColor,
          borderStyle: "dashed",
        }}
        onMouseDown={(e) => handleFieldMouseDown(e, field)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedFieldId(field.id);
        }}
      >
        <div
          className="flex items-center gap-1 px-1 text-xs"
          style={{ color: field.signerColor }}
        >
          {FieldIcon}
          <span className="truncate max-w-[60%]">
            {field.label || field.type}
          </span>
        </div>

        {/* Delete button */}
        <button
          className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteField(field.id);
          }}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    );
  };

  return (
    <div className="flex h-full">
      {/* Main editor area */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="border-b px-4 py-2 flex items-center justify-between shrink-0">
          {/* Field tools */}
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground mr-2">Add field:</span>
            {FIELD_TOOLS.map(({ type, icon, label }) => (
              <Button
                key={type}
                variant={selectedTool === type ? "default" : "outline"}
                size="sm"
                className="h-8"
                onClick={() => setSelectedTool(selectedTool === type ? null : type)}
                disabled={!selectedSigner}
                style={
                  selectedTool === type && selectedSigner
                    ? { backgroundColor: selectedSigner.color, borderColor: selectedSigner.color }
                    : undefined
                }
              >
                {icon}
                <span className="ml-1 hidden sm:inline">{label}</span>
              </Button>
            ))}
          </div>

          {/* Zoom and page controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2 min-w-[60px] text-center">
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

            <div className="w-px h-6 bg-border mx-2" />

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
              disabled={scale <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setScale((s) => Math.min(2, s + 0.25))}
              disabled={scale >= 2}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-muted dark:bg-card p-4"
        >
          <div className="flex justify-center">
            <div
              ref={pageRef}
              className="relative inline-block shadow-lg"
              onClick={handlePageClick}
              style={{ cursor: selectedTool && selectedSigner ? "crosshair" : "default" }}
            >
              <Document
                file={url}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center justify-center h-64 w-[600px] bg-white">
                    <Spinner size={32} className="text-muted-foreground" />
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
                    {currentPageFields.map(renderField)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        {selectedSigner && selectedTool && (
          <div
            className="px-4 py-2 text-sm text-center text-white shrink-0"
            style={{ backgroundColor: selectedSigner.color }}
          >
            Click on the document to place a {selectedTool} field for {selectedSigner.name || selectedSigner.email}
          </div>
        )}

        {!selectedSigner && (
          <div className="px-4 py-2 text-sm text-center text-muted-foreground bg-muted shrink-0">
            Select a signer from the panel to start placing signature fields
          </div>
        )}
      </div>

      {/* Right panel - Signers */}
      <SignerPanel
        signers={signers}
        selectedSigner={selectedSigner}
        onAddSigner={onAddSigner || (() => {})}
        onRemoveSigner={onRemoveSigner || (() => {})}
        onSelectSigner={onSelectSigner}
        onReorderSigners={onReorderSigners || (() => {})}
        fields={fields}
      />
    </div>
  );
}
