"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import {
  FileText,
  ExternalLink,
  Maximize2,
  X,
} from "lucide-react";

interface CompanyDocument {
  id: number | string;
  file_name?: string;
  display_name?: string;
  file_url?: string;
  file_size?: number;
  folder?: string;
  document_type?: string;
  financial_years?: number[] | string;
  source?: string;
  company?: { id: number; name: string; code: string };
  storage_item_id?: string;
  storage_file_id?: string;
  // Confidence scores (0-100)
  ocr_confidence?: number;
  ocr_method?: string; // 'text_extraction' | 'vision'
  ai_confidence_score?: number;
  ai_verification_status?: string;
  human_confidence?: number;
  user_validated_at?: string;
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

  // Fetch presigned preview URL for all documents (S3/Wasabi and SharePoint)
  React.useEffect(() => {
    const fetchPreviewUrl = async () => {
      if (!document?.id || !open) {
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
  }, [document?.id, open]);

  if (!document) return null;

  const fileName = document.file_name || "Document";
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
                {/* OCR Confidence Badge */}
                {document.ocr_confidence != null ? (
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium ${
                      document.ocr_confidence >= 90
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700"
                        : document.ocr_confidence >= 70
                        ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-600"
                        : "bg-blue-50/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:bg-blue-900/10 dark:text-blue-300 dark:border-blue-500"
                    }`}
                    title={`OCR text extraction confidence (${document.ocr_method || 'unknown'})`}
                  >
                    OCR {Math.round(document.ocr_confidence)}%
                  </Badge>
                ) : document.ocr_method === "vision" ? (
                  <Badge
                    variant="outline"
                    className="text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700"
                    title="Document processed using AI vision (no text extraction)"
                  >
                    OCR Vision
                  </Badge>
                ) : null}

                {/* AI Classification Confidence Badge */}
                {document.ai_confidence_score != null && (
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium ${
                      document.ai_confidence_score >= 90
                        ? "bg-status-success text-status-success-foreground border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700"
                        : document.ai_confidence_score >= 70
                        ? "bg-status-warning text-status-warning-foreground border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700"
                        : "bg-status-error text-status-error-foreground border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700"
                    }`}
                    title="AI classification confidence score"
                  >
                    AI {Math.round(document.ai_confidence_score)}%
                  </Badge>
                )}

                {/* Human Validation Confidence Badge */}
                {document.human_confidence != null ? (
                  <Badge
                    variant="outline"
                    className={`text-xs font-medium ${
                      document.human_confidence >= 90
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700"
                        : document.human_confidence >= 70
                        ? "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700"
                        : "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-700"
                    }`}
                    title="Human validation confidence score"
                  >
                    Human {Math.round(document.human_confidence)}%
                  </Badge>
                ) : document.user_validated_at ? (
                  <Badge
                    variant="outline"
                    className="text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700"
                    title="Validated by human"
                  >
                    Human ✓
                  </Badge>
                ) : null}
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
                <Spinner size={48} className="mb-4" />
                <p className="text-sm">Loading preview...</p>
              </div>
            ) : previewUrl && (fileType === "pdf" || fileType === "image") ? (
              fileType === "image" ? (
                <div className="flex items-center justify-center h-full p-4">
                  <img
                    src={previewUrl}
                    alt={fileName}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Document Preview"
                  allow="fullscreen"
                />
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                <FileText className="h-16 w-16 mb-4" />
                <p className="text-lg font-medium mb-2">
                  {previewError || "Preview not available"}
                </p>
                <p className="text-sm text-center mb-4">
                  This file type cannot be previewed inline
                </p>
                <div className="flex gap-2">
                  {previewUrl && (
                    <Button asChild size="sm">
                      <a href={previewUrl} target="_blank" rel="noopener noreferrer">
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
