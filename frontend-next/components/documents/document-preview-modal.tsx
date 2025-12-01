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
import { Separator } from "@/components/ui/separator";
import {
  Download,
  ExternalLink,
  Sparkles,
  Calendar,
  Building2,
  FileText,
  CheckCircle,
  Clock,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
} from "lucide-react";

interface Document {
  id: number;
  name: string;
  display_title?: string;
  type: string;
  size: number;
  url?: string;
  document_type?: {
    id: number;
    name: string;
    abbreviation: string;
  };
  fiscal_year?: string;
  company_name?: string;
  verified: boolean;
  verified_at?: string;
  verified_by?: string;
  uploaded_at: string;
  uploaded_by: string;
}

interface DocumentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document | null;
  onVerify: () => void;
  onDownload: () => void;
  onOpenExternal: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileTypeForPreview(type: string): "pdf" | "image" | "other" {
  if (type.includes("pdf")) return "pdf";
  if (type.includes("image")) return "image";
  return "other";
}

export function DocumentPreviewModal({
  open,
  onOpenChange,
  document,
  onVerify,
  onDownload,
  onOpenExternal,
}: DocumentPreviewModalProps) {
  const [loading, setLoading] = React.useState(true);
  const [zoom, setZoom] = React.useState(100);
  const [rotation, setRotation] = React.useState(0);

  React.useEffect(() => {
    if (open) {
      setLoading(true);
      setZoom(100);
      setRotation(0);
      // Simulate loading
      const timer = setTimeout(() => setLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [open, document]);

  if (!document) return null;

  const fileType = getFileTypeForPreview(document.type);
  const displayName = document.display_title || document.name;

  // Expand abbreviations in display title
  const expandedTitle = document.display_title
    ? expandAbbreviations(document.display_title)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {displayName}
              </DialogTitle>
              {expandedTitle && expandedTitle !== displayName && (
                <p className="text-sm text-muted-foreground">{expandedTitle}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {document.verified ? (
                <Badge className="bg-green-100 text-green-700">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />
                  Pending Review
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Metadata Bar */}
        <div className="flex items-center gap-4 py-2 text-sm text-muted-foreground flex-shrink-0 flex-wrap">
          {document.document_type && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="font-mono text-xs">
                {document.document_type.abbreviation}
              </Badge>
              {document.document_type.name}
            </div>
          )}
          {document.fiscal_year && (
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              FY{document.fiscal_year}
            </div>
          )}
          {document.company_name && (
            <div className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              {document.company_name}
            </div>
          )}
          <div className="flex items-center gap-1">
            <FileText className="h-4 w-4" />
            {formatFileSize(document.size)}
          </div>
        </div>

        <Separator className="flex-shrink-0" />

        {/* Preview Toolbar */}
        <div className="flex items-center justify-between py-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => Math.max(25, z - 25))}
              disabled={zoom <= 25}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono w-12 text-center">{zoom}%</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom((z) => Math.min(200, z + 25))}
              disabled={zoom >= 200}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-6 mx-2" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRotation((r) => (r + 90) % 360)}
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onOpenExternal}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            {!document.verified && (
              <Button variant="outline" size="sm" onClick={onVerify}>
                <Sparkles className="h-4 w-4 mr-2" />
                AI Verify
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={onOpenExternal}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in OneDrive
            </Button>
          </div>
        </div>

        <Separator className="flex-shrink-0" />

        {/* Preview Area */}
        <div className="flex-1 overflow-auto bg-secondary/30 rounded-lg flex items-center justify-center">
          {loading ? (
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Loading preview...</p>
            </div>
          ) : fileType === "pdf" ? (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transition: "transform 0.2s ease",
              }}
            >
              {document.url ? (
                <iframe
                  src={document.url}
                  className="w-full h-full border-0"
                  title={displayName}
                />
              ) : (
                <div className="text-center p-8">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="font-medium">PDF Preview</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Preview not available. Click "Open in OneDrive" to view.
                  </p>
                </div>
              )}
            </div>
          ) : fileType === "image" ? (
            <div
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transition: "transform 0.2s ease",
              }}
            >
              {document.url ? (
                <img
                  src={document.url}
                  alt={displayName}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-center p-8">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="font-medium">Image Preview</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Preview not available.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-8">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium">Preview not available</p>
              <p className="text-sm text-muted-foreground mt-1">
                This file type cannot be previewed. Download or open in OneDrive to view.
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button variant="outline" onClick={onDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button onClick={onOpenExternal}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in OneDrive
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with verification info */}
        {document.verified && document.verified_at && (
          <div className="flex-shrink-0 pt-2 text-xs text-muted-foreground">
            Verified by {document.verified_by} on{" "}
            {new Date(document.verified_at).toLocaleDateString("en-AU")}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Helper to expand common abbreviations
function expandAbbreviations(title: string): string {
  const abbreviations: Record<string, string> = {
    CTR: "Company Tax Return",
    BAS: "Business Activity Statement",
    FS: "Financial Statement",
    AR: "Annual Report",
    MM: "Meeting Minutes",
    CON: "Contract",
    INV: "Invoice",
    REC: "Receipt",
    FY: "Financial Year",
    PO: "Purchase Order",
    SWMS: "Safe Work Method Statement",
    WHS: "Work Health & Safety",
    ABN: "Australian Business Number",
    ACN: "Australian Company Number",
  };

  let expanded = title;
  for (const [abbr, full] of Object.entries(abbreviations)) {
    // Only expand if it's a standalone word (not part of another word)
    const regex = new RegExp(`\\b${abbr}\\b`, "g");
    expanded = expanded.replace(regex, full);
  }
  return expanded;
}
