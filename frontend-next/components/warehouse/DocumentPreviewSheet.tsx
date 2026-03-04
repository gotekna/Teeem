"use client";

/**
 * DocumentPreviewSheet
 *
 * SSoT: THE ONE drawer-based document preview for embedded contexts (Job, Contact, etc.).
 * Used when a full right-panel layout (like /warehouse) isn't available.
 *
 * Standard UX:
 *   Single click → opens this sheet
 *   Double click → opens in new window (caller handles, onOpenInNewWindow callback)
 */

import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink, File } from "lucide-react";
import { PDFViewer } from "@/components/ui/pdf-viewer";
import type { DocumentItem } from "@/components/warehouse/types";

interface DocumentPreviewSheetProps {
  doc: DocumentItem | null;
  onClose: () => void;
  onOpenInNewWindow: (doc: DocumentItem) => void;
}

export function DocumentPreviewSheet({ doc, onClose, onOpenInNewWindow }: DocumentPreviewSheetProps) {
  const isPDF =
    doc?.mimeType?.includes("pdf") ||
    doc?.fileName?.toLowerCase().endsWith(".pdf") ||
    doc?.uiName?.toLowerCase().endsWith(".pdf");

  const isImage = doc?.isImage || doc?.mimeType?.startsWith("image/");

  const renderPreview = () => {
    if (!doc?.fileUrl) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
          <File className="h-16 w-16 text-muted-foreground" />
          <p className="text-muted-foreground">No preview available</p>
          <Button variant="outline" onClick={() => doc && onOpenInNewWindow(doc)}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in New Window
          </Button>
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <img
            src={doc.fileUrl}
            alt={doc.uiName || doc.fileName}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      );
    }

    if (isPDF) {
      return <PDFViewer url={doc.fileUrl} className="h-full" />;
    }

    // Other file types — show placeholder with open button
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <File className="h-16 w-16 text-muted-foreground" />
        <p className="font-medium">{doc.uiName || doc.fileName}</p>
        <p className="text-sm text-muted-foreground">Preview not available for this file type</p>
        <Button onClick={() => onOpenInNewWindow(doc)}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Open in New Window
        </Button>
      </div>
    );
  };

  return (
    <Sheet open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col p-0" side="right-wide">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <SheetTitle className="flex-1 truncate text-sm font-medium">
              {doc?.uiName || doc?.fileName || "Document"}
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-7 w-7"
              onClick={() => doc && onOpenInNewWindow(doc)}
              title="Open in new window"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-auto">
          {renderPreview()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
