"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PDFEditor } from "@/components/ui/pdf-editor";
import { ExternalLink, X } from "lucide-react";

interface DocumentViewerModalProps {
  url: string;
  fileName: string;
  fileType: 'pdf' | 'image' | 'other';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (pdfBytes: Uint8Array, fileName: string) => Promise<void>;
}

/**
 * Simple document viewer modal with markup/annotation support.
 * - PDFs: Full annotation tools via PDFEditor (highlight, draw, circle, etc.)
 * - Images: Preview with option to open in new tab
 * - Other files: Download/open option
 */
export function DocumentViewerModal({
  url,
  fileName,
  fileType,
  open,
  onOpenChange,
  onSave,
}: DocumentViewerModalProps) {
  if (fileType === 'pdf') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0 gap-0">
          <DialogTitle className="sr-only">{fileName || 'PDF Viewer'}</DialogTitle>
          <PDFEditor
            url={url}
            fileName={fileName}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (fileType === 'image') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-4">
          <DialogTitle className="sr-only">{fileName || 'Image Viewer'}</DialogTitle>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium truncate">{fileName}</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Open in New Tab
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center overflow-auto">
              <img
                src={url}
                alt={fileName}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Other file types - show download option
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle className="sr-only">{fileName || 'File Preview'}</DialogTitle>
        <div className="flex flex-col items-center gap-4 py-4">
          <p className="text-sm text-muted-foreground text-center">
            Preview not available for this file type.
          </p>
          <p className="text-sm font-medium">{fileName}</p>
          <Button onClick={() => window.open(url, '_blank')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in New Tab
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Helper to detect file type from filename
 */
export function getFileType(fileName?: string): 'pdf' | 'image' | 'other' {
  if (!fileName) return 'other';
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext || '')) return 'image';
  return 'other';
}
