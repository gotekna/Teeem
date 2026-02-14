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
import { api, getApiBaseUrl } from "@/lib/api";
import {
  FileText,
  ExternalLink,
  Check,
  Pencil,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PDFViewer } from "@/components/ui/pdf-viewer";
import { PDFEditor } from "@/components/ui/pdf-editor";
import { ExcelViewer, ExcelViewerLoading, ExcelViewerError, type ExcelData } from "@/components/ui/excel-viewer";
import { WordViewer, WordViewerLoading, WordViewerError, type WordData } from "@/components/ui/word-viewer";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import ClassificationPanel from "@/components/documents/ClassificationPanel";
import type { ClassificationData, ClassificationDocumentType } from "@/lib/types/classification-types";

// ── Local Types ──

interface Company {
  id: number;
  name: string;
  code?: string;
  bas_frequency?: "quarterly" | "monthly";
}

interface CompanyDocument {
  id: number | string;
  file_name?: string;
  display_name?: string;
  download_name?: string;
  file_url?: string;
  file_size?: number;
  folder?: string;
  folder_path?: string;
  document_type?: string;
  financial_years?: number[] | string;
  ref_date?: string;
  filed_date?: string;
  source?: string;
  company_id?: number;
  company?: Company;
  asset_id?: number;
  asset?: { id: number; name?: string; description?: string; abbreviation?: string; display_name?: string };
  storage_item_id?: string;
  storage_file_id?: string;
  user_validated_at?: string;
  user_validated_by_id?: number;
  user_validated_by_name?: string;
  ai_verification_status?: "pending" | "processing" | "verified" | "mismatch" | "error" | string;
  ai_suggested_name?: string;
  ai_suggested_folder?: string;
  ai_suggested_type?: string;
  ai_suggested_fy?: number[] | string;
  ai_confidence_score?: number;
  ai_analysis_notes?: string;
  ai_extracted_description?: string;
  ai_extracted_date?: string;
  ai_source_page?: number;
  ai_source_quote?: string;
  ai_contains_multiple_documents?: boolean;
  ai_split_recommendation?: Array<{
    pages: string;
    type: string;
    suggested_name: string;
  }>;
}

interface DocumentEditModalProps {
  document: CompanyDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentUpdate?: () => Promise<void>;
  companies?: Company[];
}

// ── Helpers ──

function getFileType(filename?: string) {
  if (!filename) return "unknown";
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext || "")) return "image";
  if (["doc", "docx"].includes(ext || "")) return "word";
  if (["xls", "xlsx"].includes(ext || "")) return "excel";
  return "unknown";
}

function sanitizeFilename(filename: string): string {
  if (!filename) return '';
  let sanitized = filename.replace(/["*:<>?/\\|]/g, '');
  sanitized = sanitized.replace(/\s+/g, ' ');
  sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
  return sanitized || 'Untitled';
}

// ── Component ──

export default function DocumentEditModal({
  document: initialDocument,
  open,
  onOpenChange,
  onDocumentUpdate,
  companies = [],
}: DocumentEditModalProps) {
  const { toast } = useToast();
  const [document, setDocument] = React.useState<CompanyDocument>(initialDocument);
  const [validating, setValidating] = React.useState(false);
  const [validated, setValidated] = React.useState(initialDocument?.user_validated_at != null);
  const [aiVerifying, setAiVerifying] = React.useState(false);
  const [applyingSuggestion, setApplyingSuggestion] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Document types from database (passed to ClassificationPanel)
  const [documentTypes, setDocumentTypes] = React.useState<ClassificationDocumentType[]>([]);

  const pollingRef = React.useRef<NodeJS.Timeout | null>(null);

  // Preview URL state - for OneDrive embedded preview
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  // Universal Document Reader state - for Excel/Word preview
  const [documentData, setDocumentData] = React.useState<{
    type: string;
    content: ExcelData | WordData | null;
    error?: string;
  } | null>(null);
  const [documentDataLoading, setDocumentDataLoading] = React.useState(false);

  // Classification data (OCR + AI breakdown)
  const [classificationData, setClassificationData] = React.useState<ClassificationData | null>(null);
  const [classificationLoading, setClassificationLoading] = React.useState(false);

  // PDF Editor mode
  const [isEditingPdf, setIsEditingPdf] = React.useState(false);

  // ── Effects ──

  // Fetch document types from database
  React.useEffect(() => {
    const fetchDocumentTypes = async () => {
      try {
        const response = await api.get<{ success: boolean; data: ClassificationDocumentType[] }>("/api/v1/document_types");
        if (response?.success && response.data) {
          setDocumentTypes(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch document types:", error);
      }
    };
    fetchDocumentTypes();
  }, []);

  // Fetch classification breakdown (OCR + AI) for the 3-column comparison
  React.useEffect(() => {
    const fetchClassification = async () => {
      if (!document?.id || !open) {
        setClassificationData(null);
        return;
      }

      setClassificationLoading(true);
      try {
        const response = await api.get<ClassificationData>(
          `/api/v1/company_documents/${document.id}/classification`
        );
        if (response?.success) {
          setClassificationData(response);
        }
      } catch (error) {
        console.debug("Classification data not available:", error);
      } finally {
        setClassificationLoading(false);
      }
    };

    fetchClassification();
  }, [document?.id, open]);

  // Fetch embeddable preview URL for cloud storage files
  const storageRef = document?.storage_item_id || document?.storage_file_id;

  React.useEffect(() => {
    const fetchPreviewUrl = async () => {
      if (!storageRef || !open) {
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
          fallback_url?: string;
        }>(`/api/v1/company_documents/${document.id}/preview`);

        if (response?.success && response.preview_url) {
          setPreviewUrl(response.preview_url);
        } else {
          setPreviewError(response.error || "Preview not available");
          setPreviewUrl(null);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("OneDrive credentials not available")) {
          console.error("Failed to fetch preview URL:", error);
        }
        setPreviewError("Preview not available");
        setPreviewUrl(null);
      } finally {
        setPreviewLoading(false);
      }
    };

    fetchPreviewUrl();
  }, [document?.id, storageRef, open]);

  // Fetch document data for Excel/Word files using Universal Document Reader
  React.useEffect(() => {
    const fetchDocumentData = async () => {
      const fType = getFileType(document?.file_name);
      if (!document?.id || !open || (fType !== "excel" && fType !== "word")) {
        setDocumentData(null);
        return;
      }

      setDocumentDataLoading(true);
      setDocumentData(null);

      try {
        const response = await api.get<{
          success: boolean;
          data?: { type: string; filename: string; content: ExcelData | WordData };
          error?: string;
        }>(`/api/v1/documents/${document.id}/preview`);

        if (response?.success && response.data) {
          setDocumentData({ type: response.data.type, content: response.data.content });
        } else {
          setDocumentData({ type: fType, content: null, error: response?.error || "Could not load document" });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Failed to fetch document data:", error);
        setDocumentData({ type: fType, content: null, error: errorMessage });
      } finally {
        setDocumentDataLoading(false);
      }
    };

    fetchDocumentData();
  }, [document?.id, document?.file_name, open]);

  // Update state when initialDocument changes
  React.useEffect(() => {
    setDocument(initialDocument);
    setValidated(initialDocument?.user_validated_at != null);
  }, [initialDocument]);

  // Poll for AI verification results — ClassificationPanel reads from document prop,
  // so we just need to update document state when AI results arrive.
  React.useEffect(() => {
    if (document?.ai_verification_status === "processing") {
      pollingRef.current = setInterval(async () => {
        try {
          const response = await api.get<{ document: CompanyDocument }>(
            `/api/v1/company_documents/${document.id}`
          );
          if (response?.document) {
            setDocument(response.document);
            if (response.document.ai_verification_status !== "processing") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              setAiVerifying(false);
              if (onDocumentUpdate) onDocumentUpdate();
            }
          }
        } catch (error) {
          console.error("Failed to poll document status:", error);
        }
      }, 2000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [document?.id, document?.ai_verification_status]);

  // ── Handlers ──

  const handleValidate = async () => {
    try {
      setValidating(true);
      const response = await api.post<{ success: boolean; validated_at: string; validated_by: string }>(
        `/api/v1/company_documents/${document.id}/validate`
      );
      setValidated(true);
      setDocument(prev => ({
        ...prev,
        user_validated_at: response?.validated_at || new Date().toISOString(),
        user_validated_by_name: response?.validated_by
      }));
      if (onDocumentUpdate) await onDocumentUpdate();
    } catch (error) {
      console.error("Failed to validate document:", error);
      toast({ title: "Error", description: "Failed to validate document", variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

  const handleAiVerify = async () => {
    try {
      setAiVerifying(true);
      const response = await api.post<{ success: boolean }>(
        `/api/v1/company_documents/${document.id}/ai_verify`
      );
      if (response?.success) {
        setDocument((prev) => ({ ...prev, ai_verification_status: "processing" }));
      }
    } catch (error: unknown) {
      console.error("Failed to start AI verification:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start AI verification";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
      setAiVerifying(false);
    }
  };

  const handleReclassify = async () => {
    try {
      setClassificationLoading(true);
      const response = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/company_documents/${document.id}/reclassify`
      );
      if (response?.success) {
        // Re-fetch updated classification data
        const classResponse = await api.get<ClassificationData>(
          `/api/v1/company_documents/${document.id}/classification`
        );
        if (classResponse?.success) {
          setClassificationData(classResponse);
        }
        toast({ title: "Re-classified", description: "Classification has been re-run successfully" });
      }
    } catch (error: unknown) {
      console.error("Failed to reclassify:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to re-classify document";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setClassificationLoading(false);
    }
  };

  const handleApplySuggestion = async () => {
    try {
      setApplyingSuggestion(true);
      const response = await api.post<{ success: boolean; document: CompanyDocument }>(
        `/api/v1/company_documents/${document.id}/apply_ai_suggestion`
      );
      if (response?.success && response.document) {
        setDocument(response.document);
        setValidated(true);

        try {
          await api.post(`/api/v1/company_documents/${document.id}/feedback`, {
            feedback: {
              action: "accepted",
              final_name: response.document.file_name,
              final_folder: response.document.folder,
            },
          });
        } catch {
          // Feedback is optional
        }

        if (onDocumentUpdate) await onDocumentUpdate();
      }
    } catch (error: unknown) {
      console.error("Failed to apply suggestion:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to apply suggestion";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setApplyingSuggestion(false);
    }
  };

  const handleSave = async (data: {
    title: string;
    companyId: string;
    folder: string;
    documentType: string;
    financialYears: number[];
    description: string;
    refDate: string;
    notes: string;
  }) => {
    const sanitizedTitle = sanitizeFilename(document.display_name || document.file_name || "");
    try {
      setSaving(true);
      const response = await api.post<{ success: boolean; document: CompanyDocument }>(
        `/api/v1/company_documents/${document.id}/relocate`,
        {
          relocate: {
            title: sanitizedTitle,
            company_id: data.companyId || null,
            folder: data.folder || null,
            document_type: data.documentType || null,
            financial_years: data.financialYears,
            ref_date: data.refDate || null,
            notes: data.notes || null,
          },
        }
      );
      if (response?.success) {
        if (document.ai_suggested_name) {
          try {
            await api.post(`/api/v1/company_documents/${document.id}/feedback`, {
              feedback: {
                action: "modified",
                final_name: sanitizedTitle,
                final_folder: data.folder,
                final_fy: data.financialYears.join(","),
              },
            });
          } catch { /* non-critical */ }
        }
        if (response?.document) setDocument(response.document);
        if (onDocumentUpdate) await onDocumentUpdate();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save document";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Computed ──

  const fileType = getFileType(document?.file_name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-[100vw] !w-[100vw] !max-h-[calc(100vh-36px)] !h-[calc(100vh-36px)] !top-0 !translate-y-0 !rounded-none overflow-hidden p-0 flex flex-col"
        aria-describedby={undefined}
        hideClose
      >
        {/* Header - compact */}
        <DialogHeader className="px-4 py-2 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <DialogTitle className="truncate text-sm font-medium mb-0 flex-1">
              {document.display_name || document.file_name}
              {isEditingPdf && <span className="ml-2 text-xs text-orange-500 dark:text-orange-400">(Editing)</span>}
            </DialogTitle>
            {fileType === "pdf" && (previewUrl || document.file_url) && (
              <Button
                variant={isEditingPdf ? "default" : "outline"}
                size="sm"
                className="h-6 px-2"
                onClick={() => setIsEditingPdf(!isEditingPdf)}
              >
                <Pencil className="h-3 w-3 mr-1" />
                <span className="text-xs">{isEditingPdf ? "View Mode" : "Edit PDF"}</span>
              </Button>
            )}
            {validated && (
              <Badge variant="outline" className="text-[10px] border-green-500 text-green-600 dark:text-green-400">
                <Check className="h-3 w-3 mr-0.5" />Validated
                {document.user_validated_by_name && (
                  <span className="ml-1 text-muted-foreground">by {document.user_validated_by_name}</span>
                )}
                {document.user_validated_at && (
                  <span className="ml-1 text-muted-foreground">{new Date(document.user_validated_at).toLocaleDateString()}</span>
                )}
              </Badge>
            )}
            {validated && (
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setValidated(false)}>
                <Pencil className="h-3 w-3 mr-1" />
                <span className="text-xs">Edit</span>
              </Button>
            )}
            {document.file_url && (
              <Button variant="ghost" size="sm" asChild className="h-6 px-2">
                <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  <span className="text-xs">Open</span>
                </a>
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => onOpenChange(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </DialogHeader>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left Section - ClassificationPanel (hidden when validated) */}
          {!validated && (
            <div className="w-1/2 border-r">
              <ClassificationPanel
                document={document}
                classificationData={classificationData}
                classificationLoading={classificationLoading}
                documentTypes={documentTypes}
                companies={companies}
                mode="review"
                aiProcessing={aiVerifying || document.ai_verification_status === "processing"}
                onValidate={handleValidate}
                onSave={handleSave}
                onApplyAI={handleApplySuggestion}
                onRerunAI={handleAiVerify}
                onRerunOCR={handleReclassify}
                onOpenPdfEditor={() => setIsEditingPdf(true)}
              />
            </div>
          )}

          {/* Right Half - Document Preview or Editor (full width when validated) */}
          <div className={cn(validated ? "w-full" : "w-1/2", "bg-muted flex flex-col overflow-hidden")}>
              {isEditingPdf && fileType === "pdf" && document.id ? (
                <PDFEditor
                  url={`${getApiBaseUrl()}/api/v1/company_documents/${document.id}/content`}
                  fileName={document.file_name || "document.pdf"}
                  onSave={async (pdfBytes, fileName) => {
                    try {
                      const base64 = btoa(
                        new Uint8Array(pdfBytes).reduce(
                          (data, byte) => data + String.fromCharCode(byte),
                          ''
                        )
                      );

                      const response = await api.post<{ success: boolean; document?: CompanyDocument; error?: string }>(
                        `/api/v1/company_documents/${document.id}/upload_edited`,
                        {
                          file_data: base64,
                          file_name: fileName,
                          create_new: false,
                        }
                      );

                      if (response?.success) {
                        if (response?.document) setDocument(response.document);
                        if (onDocumentUpdate) await onDocumentUpdate();
                        setIsEditingPdf(false);
                      } else {
                        console.error("Failed to save PDF:", response?.error);
                        toast({ title: "Error", description: `Failed to save: ${response?.error || 'Unknown error'}`, variant: "destructive" });
                      }
                    } catch (error) {
                      console.error("Error saving PDF:", error);
                      toast({ title: "Error", description: "Failed to save PDF. Please try again.", variant: "destructive" });
                    }
                  }}
                  onClose={() => setIsEditingPdf(false)}
                  className="flex-1"
                />
              ) : previewLoading ? (
                <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
                  <Spinner size={48} className="mb-4" />
                  <p className="text-sm">Loading preview...</p>
                </div>
              ) : fileType === "pdf" && document.id ? (
                <PDFViewer
                  url={`${getApiBaseUrl()}/api/v1/company_documents/${document.id}/content`}
                  className="flex-1"
                  showThumbnails={false}
                  fallbackUrl={document.file_url}
                />
              ) : fileType === "image" && document.file_url ? (
                <div className="flex items-center justify-center flex-1 p-4 overflow-auto">
                  <img
                    src={document.file_url}
                    alt={document.file_name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : fileType === "excel" ? (
                documentDataLoading ? (
                  <ExcelViewerLoading className="flex-1" />
                ) : documentData?.error ? (
                  <ExcelViewerError error={documentData.error} className="flex-1" />
                ) : documentData?.content ? (
                  <ExcelViewer
                    data={documentData.content as ExcelData}
                    filename={document.file_name}
                    className="flex-1"
                  />
                ) : (
                  <ExcelViewerLoading className="flex-1" />
                )
              ) : fileType === "word" ? (
                documentDataLoading ? (
                  <WordViewerLoading className="flex-1" />
                ) : documentData?.error ? (
                  <WordViewerError error={documentData.error} className="flex-1" />
                ) : documentData?.content ? (
                  <WordViewer
                    data={documentData.content as WordData}
                    filename={document.file_name}
                    className="flex-1"
                  />
                ) : (
                  <WordViewerLoading className="flex-1" />
                )
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full flex-1 border-0"
                  title="Document Preview"
                  allow="fullscreen"
                />
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground p-8">
                  <FileText className="h-16 w-16 mb-4" />
                  <p className="text-lg font-medium mb-2">
                    {previewError || "Preview not available"}
                  </p>
                  <p className="text-sm mb-4 text-center">
                    {storageRef
                      ? "Could not load cloud storage preview."
                      : "This file type cannot be previewed inline."}
                  </p>
                  {document.file_url && (
                    <Button asChild>
                      <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open in New Tab
                      </a>
                    </Button>
                  )}
                </div>
              )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
