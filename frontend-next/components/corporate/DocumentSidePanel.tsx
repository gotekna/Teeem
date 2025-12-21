"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import {
  FileText,
  ExternalLink,
  Maximize2,
  Loader2,
  X,
} from "lucide-react";

interface CompanyDocument {
  id: number | string;
  title?: string;
  display_title?: string;
  file_name?: string;
  file_url?: string;
  file_size?: number;
  folder?: string;
  document_type?: string;
  financial_years?: number[] | string;
  source?: string;
  company?: { id: number; name: string; code: string };
  onedrive_file_id?: string;
  ai_confidence_score?: number;
  ai_verification_status?: string;
}

interface DocumentSidePanelProps {
  document: CompanyDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExpandToFullscreen?: () => void;
}

export default function DocumentSidePanel({
  document,
  open,
  onOpenChange,
  onExpandToFullscreen,
}: DocumentSidePanelProps) {
  // Preview URL state
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  // Fetch embeddable preview URL for OneDrive files
  React.useEffect(() => {
    const fetchPreviewUrl = async () => {
      if (!document?.onedrive_file_id || !open) {
        setPreviewUrl(null);
        return;
      }

      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const response = await api.get<{
          success: boolean;
          preview_url?: string;
          error?: string;
        }>(`/api/v1/company_documents/${document.id}/preview`);

        if (response?.success && response.preview_url) {
          setPreviewUrl(response.preview_url);
        } else {
          setPreviewError(response.error || "Preview not available");
          setPreviewUrl(null);
        }
      } catch (_error: unknown) {
        // Don't log OneDrive credential errors - expected in local dev
        const errorMessage = _error instanceof Error ? _error.message : String(_error);
        if (!errorMessage.includes("OneDrive credentials not available")) {
          console.error("Failed to fetch preview URL:", _error);
        }
        setPreviewError("Preview not available");
        setPreviewUrl(null);
      } finally {
        setPreviewLoading(false);
      }
    };

    fetchPreviewUrl();
  }, [document?.id, document?.onedrive_file_id, open]);

  if (!document) return null;

  const fileName = document.file_name || document.title || "Document";
  const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";
  const fileType = ["pdf"].includes(fileExtension)
    ? "pdf"
    : ["jpg", "jpeg", "png", "gif", "webp"].includes(fileExtension)
    ? "image"
    : ["doc", "docx"].includes(fileExtension)
    ? "word"
    : ["xls", "xlsx"].includes(fileExtension)
    ? "excel"
    : "other";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="w-[600px] sm:max-w-[600px] p-0"
        title={fileName}
        aria-describedby="document-preview-description"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex-1 min-w-0 mr-4">
              <h3 className="font-semibold text-sm truncate">{fileName}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {document.folder && (
                  <Badge variant="outline" className="text-xs">
                    {document.folder}
                  </Badge>
                )}
                {document.source && (
                  <Badge variant="secondary" className="text-xs">
                    {document.source}
                  </Badge>
                )}
                {document.ai_confidence_score != null && (
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium ${
                      document.ai_confidence_score >= 90
                        ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700"
                        : document.ai_confidence_score >= 70
                        ? "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700"
                        : "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700"
                    }`}
                    title="AI classification confidence score"
                  >
                    AI {Math.round(document.ai_confidence_score)}%
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onExpandToFullscreen && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onExpandToFullscreen}
                  title="Open fullscreen"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              )}
              {document.file_url && (
                <Button variant="ghost" size="icon" asChild title="Open in new tab">
                  <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Preview Area */}
          <div
            id="document-preview-description"
            className="flex-1 bg-muted overflow-hidden"
          >
            {previewLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Loader2 className="h-12 w-12 animate-spin mb-4" />
                <p className="text-sm">Loading preview...</p>
              </div>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title="Document Preview"
                allow="fullscreen"
              />
            ) : fileType === "pdf" && document.file_url && !document.onedrive_file_id ? (
              <iframe
                src={document.file_url}
                className="w-full h-full border-0"
                title="Document Preview"
              />
            ) : fileType === "image" && document.file_url ? (
              <div className="flex items-center justify-center h-full p-4">
                <img
                  src={document.file_url}
                  alt={fileName}
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                <FileText className="h-16 w-16 mb-4" />
                <p className="text-lg font-medium mb-2">
                  {previewError || "Preview not available"}
                </p>
                <p className="text-sm text-center mb-4">
                  {document.onedrive_file_id
                    ? "Could not load SharePoint preview"
                    : "This file type cannot be previewed inline"}
                </p>
                <div className="flex gap-2">
                  {document.file_url && (
                    <Button asChild size="sm">
                      <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open in New Tab
                      </a>
                    </Button>
                  )}
                  {onExpandToFullscreen && (
                    <Button variant="outline" size="sm" onClick={onExpandToFullscreen}>
                      <Maximize2 className="h-4 w-4 mr-2" />
                      Edit Details
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="p-2 border-t bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">
              Double-click document to edit details
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
