"use client";

/**
 * CompanyDocumentsTab - Document management for corporate entities
 *
 * Extracted from corporate page for reuse and better organization.
 * Shows documents in a table with AI verification, inline editing,
 * and SharePoint integration.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  XCircle,
  Cloud,
  Plus,
  Sparkles,
  Layers,
  ExternalLink,
  Maximize2,
  X,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { useToast } from "@/components/ui/use-toast";
import { formatFileSize } from "@/utils/formatters";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";
import DocumentEditModal from "@/components/corporate/DocumentEditModal";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { DocumentViewer, getFileType } from "@/components/ui/document-viewer";
import { Spinner } from "@/components/ui/spinner";
import type { Corporate } from "@/lib/types/corporate";
import { DOCUMENT_FOLDER_OPTIONS } from "@/lib/constants/document-types";
import { useConfirm } from "@/contexts/ConfirmationContext";

// Document interface for table
interface CompanyDocument extends TableRow {
  display_title?: string;
  display_name?: string;
  file_name?: string;
  validated?: boolean;
  validation_source?: string;
  financial_years?: string;
  folder?: string;
  document_type?: string;
  source?: string;
  file_size?: number;
  document_date?: string;
  created_at?: string;
  file_url?: string;
  user_validated_at?: string;
  ai_verification_status?: "pending" | "processing" | "verified" | "mismatch" | "error";
  ai_suggested_name?: string;
  ai_suggested_folder?: string;
  ai_suggested_type?: string;
  ai_suggested_fy?: string;
  ai_confidence_score?: number;
  ai_analysis_notes?: string;
  ai_error_message?: string;
  user_validated_by_id?: number;
  user_validated_by_name?: string;
  company_id?: number;
  // Confidence scores for side panel badges
  ocr_confidence?: number;
  ocr_method?: string;
  human_confidence?: number;
}

// SSoT: DOCUMENT_FOLDER_OPTIONS imported from @/lib/constants/document-types

// Document type options
const DOCUMENT_TYPE_OPTIONS = [
  { value: "tax_return", label: "Tax Return" },
  { value: "bas", label: "BAS" },
  { value: "financial_statement", label: "Financial Statement" },
  { value: "annual_report", label: "Annual Report" },
  { value: "minutes", label: "Minutes" },
  { value: "resolution", label: "Resolution" },
  { value: "contract", label: "Contract" },
  { value: "loan", label: "Loan Document" },
  { value: "insurance", label: "Insurance" },
  { value: "asic", label: "ASIC Document" },
  { value: "other", label: "Other" },
];

interface CompanyDocumentsTabProps {
  companyId: string;
  company: Corporate;
  category?: string;
}

export function CompanyDocumentsTab({ companyId, company, category }: CompanyDocumentsTabProps) {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [documents, setDocuments] = React.useState<CompanyDocument[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [companies, setCompanies] = React.useState<Corporate[]>([]);

  // Document preview state - side panel for single click, fullscreen modal for double click
  const [selectedDocument, setSelectedDocument] = React.useState<CompanyDocument | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [sidePanelDocument, setSidePanelDocument] = React.useState<CompanyDocument | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = React.useState(false);
  const [sidePanelPreviewUrl, setSidePanelPreviewUrl] = React.useState<string | null>(null);
  const [sidePanelPreviewLoading, setSidePanelPreviewLoading] = React.useState(false);
  const [sidePanelPreviewError, setSidePanelPreviewError] = React.useState<string | null>(null);

  // Cascade mode - shows documents from folder AND all subfolders
  const [cascadeMode, setCascadeMode] = React.useState(true);

  React.useEffect(() => {
    loadDocuments();
    loadCompanies();
  }, [companyId, category, cascadeMode]);

  // Build backend content proxy URL when side panel document changes
  // Uses /content endpoint to stream bytes through our API (bypasses S3/B2 CORS)
  React.useEffect(() => {
    if (!sidePanelDocument?.id || !isSidePanelOpen) {
      setSidePanelPreviewUrl(null);
      return;
    }

    setSidePanelPreviewLoading(true);
    setSidePanelPreviewError(null);

    try {
      const contentUrl = `${getApiBaseUrl()}/api/v1/company_documents/${sidePanelDocument.id}/content`;
      const token = getStorageItem<string | null>(STORAGE_KEYS.TOKEN, null, false);
      setSidePanelPreviewUrl(`${contentUrl}?token=${encodeURIComponent(token || "")}`);
    } catch {
      setSidePanelPreviewError("Preview not available");
      setSidePanelPreviewUrl(null);
    } finally {
      setSidePanelPreviewLoading(false);
    }
  }, [sidePanelDocument?.id, isSidePanelOpen]);

  const loadCompanies = async () => {
    try {
      const response = await api.get<{ companies: Corporate[] }>("/api/v1/companies");
      setCompanies(response.companies || []);
    } catch (error) {
      console.error("Failed to load companies:", error);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { company_id: companyId };
      if (category && category !== "all") {
        params.tab = category;
        // When filtering by category (folder), include cascade mode
        if (cascadeMode) {
          params.include_descendants = 'true';
        }
      }
      const response = await api.get<{ documents: CompanyDocument[] }>("/api/v1/company_documents", { params });
      const docs = response.documents || [];
      // Transform documents for table display
      const transformed = docs.map((doc) => ({
        ...doc,
        display_title: doc.display_name || doc.file_name,
        file_size_display: formatFileSize(doc.file_size),
        source_display: doc.source === "sharepoint" ? "Cloud Storage" : "Upload",
        financial_years: Array.isArray(doc.financial_years)
          ? (doc.financial_years as unknown as string[]).join(", ")
          : doc.financial_years || "",
        validated: !!(doc.user_validated_at || doc.ai_verification_status === "verified"),
        validation_source: doc.user_validated_at ? "user" : doc.ai_verification_status === "verified" ? "ai" : undefined,
        ai_confidence: doc.ai_confidence_score ? (() => {
          const raw = Number(doc.ai_confidence_score);
          const pct = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
          return `${pct}%`;
        })() : null,
        user_validated_by: doc.user_validated_by_name || null,
        validated_at: doc.user_validated_at ? new Date(doc.user_validated_at).toLocaleDateString() : null,
      }));
      setDocuments(transformed);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setLoading(false);
    }
  };

  // Debounce ref to distinguish single vs double click
  const clickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Single click - open side panel preview (debounced to avoid triggering on double-click)
  const handleSingleClick = (doc: CompanyDocument) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      setSidePanelDocument(doc);
      setIsSidePanelOpen(true);
      clickTimeoutRef.current = null;
    }, 200);
  };

  // Double click - open fullscreen modal for editing
  const handleDoubleClick = (doc: CompanyDocument) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    setIsSidePanelOpen(false);
    setSidePanelDocument(null);
    setSelectedDocument(doc);
    setIsPreviewOpen(true);
  };

  // Expand from side panel to fullscreen modal
  const handleExpandToFullscreen = () => {
    if (sidePanelDocument) {
      setSelectedDocument(sidePanelDocument);
      setIsPreviewOpen(true);
      setIsSidePanelOpen(false);
      setSidePanelDocument(null);
    }
  };

  const handleDelete = async (doc: CompanyDocument) => {
    const confirmed = await confirm({
      title: "Delete Document",
      description: "Are you sure you want to delete this document?",
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/api/v1/company_documents/${doc.id}`);
      await loadDocuments();
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const handleBulkDelete = async (ids: (number | string)[]) => {
    const confirmed = await confirm({
      title: "Delete Documents",
      description: `Delete ${ids.length} documents? This cannot be undone.`,
      confirmLabel: "Delete All",
      variant: "destructive",
    });
    if (!confirmed) return;
    try {
      await Promise.all(ids.map((id) => api.delete(`/api/v1/company_documents/${id}`)));
      await loadDocuments();
    } catch (error) {
      console.error("Failed to bulk delete documents:", error);
    }
  };

  // Handle inline document field update (folder, type, etc.)
  const handleInlineUpdate = async (docId: number | string, field: string, value: string) => {
    try {
      if (field === "folder") {
        await api.post(`/api/v1/company_documents/${docId}/relocate`, {
          relocate: { folder: value }
        });
      } else {
        await api.patch(`/api/v1/company_documents/${docId}`, {
          company_document: { [field]: value }
        });
      }
      await loadDocuments();
    } catch (error) {
      console.error(`Failed to update document ${field}:`, error);
      toast({ title: "Error", description: `Failed to update ${field}`, variant: "destructive" });
    }
  };

  // Custom cell renderer
  const customCellRenderer = (doc: CompanyDocument, columnKey: string) => {
    switch (columnKey) {
      case "validated":
        if (doc.validated) {
          return (
            <div className="flex justify-center" title={doc.validation_source === "user" ? "Validated by user" : "Validated by AI"}>
              <CheckCircle className={cn("h-5 w-5", doc.validation_source === "ai" ? "text-blue-500 dark:text-blue-400" : "text-green-500 dark:text-green-400")} />
            </div>
          );
        }
        return (
          <div className="flex justify-center" title="Not validated">
            <span className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
          </div>
        );
      case "ai_confidence":
        if (doc.ai_verification_status === "processing") {
          return (
            <div className="flex justify-center" title="AI analyzing...">
              <Spinner size={16} className="text-purple-500 dark:text-purple-400" />
            </div>
          );
        }
        if (doc.ai_confidence_score) {
          // Score can be 0-1 (decimal) or 0-100 (percentage) - normalize to 0-100
          const rawScore = Number(doc.ai_confidence_score);
          const score = rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);
          const colorClass = score >= 90 ? "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30"
            : score >= 70 ? "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30"
            : "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30";
          return (
            <div className="flex justify-center" title={`AI confidence: ${score}%\n${doc.ai_analysis_notes || ''}`}>
              <Badge variant="outline" className={cn("text-[10px] px-1 py-0 font-mono", colorClass)}>
                {score}%
              </Badge>
            </div>
          );
        }
        if (doc.ai_verification_status === "error") {
          return (
            <div className="flex justify-center" title={doc.ai_error_message || "AI analysis failed"}>
              <XCircle className="h-4 w-4 text-red-400" />
            </div>
          );
        }
        return (
          <div className="flex justify-center" title="Not analyzed by AI">
            <span className="text-muted-foreground text-xs">-</span>
          </div>
        );
      case "source":
        if (doc.source === "sharepoint") {
          return (
            <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 dark:bg-purple-900/30 dark:text-purple-300">
              <Cloud className="h-3 w-3 mr-1" />
              SharePoint
            </Badge>
          );
        }
        return <Badge variant="outline">Upload</Badge>;
      case "file_size":
        return <span className="text-muted-foreground">{formatFileSize(doc.file_size)}</span>;
      case "folder":
        return (
          <Select
            value={doc.folder || ""}
            onValueChange={(value) => handleInlineUpdate(doc.id, "folder", value)}
          >
            <SelectTrigger
              className="h-7 w-[120px] text-xs border-0 bg-transparent hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue placeholder="Select...">
                {doc.folder ? (
                  <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-300">
                    {doc.folder}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent onClick={(e) => e.stopPropagation()}>
              {DOCUMENT_FOLDER_OPTIONS.map((folder) => (
                <SelectItem key={folder} value={folder}>
                  {folder}
                  {folder === doc.folder && " ✓"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "document_type":
        return (
          <Select
            value={doc.document_type || ""}
            onValueChange={(value) => handleInlineUpdate(doc.id, "document_type", value)}
          >
            <SelectTrigger
              className="h-7 w-[130px] text-xs border-0 bg-transparent hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue placeholder="Select...">
                {doc.document_type ? (
                  <span className="capitalize">{doc.document_type.replace(/_/g, " ")}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent onClick={(e) => e.stopPropagation()}>
              {DOCUMENT_TYPE_OPTIONS.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                  {type.value === doc.document_type && " ✓"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "financial_years":
        const fyValue = doc.financial_years;
        let fyArray: number[] = [];
        if (Array.isArray(fyValue)) {
          fyArray = fyValue.map(y => typeof y === 'number' ? y : parseInt(String(y), 10)).filter(y => !isNaN(y));
        } else if (typeof fyValue === 'string' && fyValue) {
          fyArray = fyValue.split(',').map(s => parseInt(s.trim(), 10)).filter(y => !isNaN(y));
        }

        if (fyArray.length === 0) {
          return <span className="text-muted-foreground text-xs">-</span>;
        }

        return (
          <div className="flex flex-wrap gap-0.5">
            {fyArray.map(year => (
              <Badge
                key={year}
                variant="outline"
                className="text-[10px] px-1 py-0 font-mono bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-300 cursor-pointer hover:bg-blue-100"
                title={`Filter by FY${year.toString().slice(-2)}`}
              >
                FY{year.toString().slice(-2)}
              </Badge>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  // Bulk AI verification state
  const [bulkAiProcessing, setBulkAiProcessing] = React.useState(false);
  const [bulkAiProgress, setBulkAiProgress] = React.useState<{ current: number; total: number } | null>(null);

  // Helper to poll document status until verification completes
  const waitForVerification = async (docId: number | string, maxWaitMs = 120000): Promise<CompanyDocument | null> => {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const response = await api.get<{ document: CompanyDocument }>(
          `/api/v1/company_documents/${docId}`
        );

        if (response?.document) {
          const status = response.document.ai_verification_status;
          if (status !== "processing") {
            return response.document;
          }
        }
      } catch (err) {
        console.error(`Failed to poll document ${docId}:`, err);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return null;
  };

  // Bulk AI verification handler
  const handleBulkAiVerify = async (ids: (number | string)[], clearSelection: () => void) => {
    setBulkAiProcessing(true);
    setBulkAiProgress({ current: 0, total: ids.length });

    try {
      for (let i = 0; i < ids.length; i++) {
        const docId = ids[i];
        setBulkAiProgress({ current: i + 1, total: ids.length });

        try {
          await api.post<{ success: boolean }>(`/api/v1/company_documents/${docId}/ai_verify`);

          setDocuments(prev => prev.map(d =>
            d.id === docId ? { ...d, ai_verification_status: "processing" as const } : d
          ));

          const updatedDoc = await waitForVerification(docId);

          if (updatedDoc) {
            setDocuments(prev => prev.map(d =>
              d.id === docId ? {
                ...d,
                ...updatedDoc,
                ai_confidence: updatedDoc.ai_confidence_score ? (() => {
                  const raw = Number(updatedDoc.ai_confidence_score);
                  return `${raw <= 1 ? Math.round(raw * 100) : Math.round(raw)}%`;
                })() : null,
              } : d
            ));
          }
        } catch (err) {
          console.error(`Failed to AI verify document ${docId}:`, err);
        }
      }

      await loadDocuments();
      clearSelection();
    } catch (error) {
      console.error("Bulk AI verification failed:", error);
    } finally {
      setBulkAiProcessing(false);
      setBulkAiProgress(null);
    }
  };

  const leftActions = (
    <div className="flex items-center gap-2">
      <Button
        variant={cascadeMode ? "secondary" : "outline"}
        size="sm"
        onClick={() => setCascadeMode(!cascadeMode)}
        title={cascadeMode ? "Showing all subfolders" : "Showing this folder only"}
        className="text-xs"
      >
        <Layers className="h-3.5 w-3.5 mr-1" />
        {cascadeMode ? "All Subfolders" : "This Folder Only"}
      </Button>
      <Button>
        <Plus className="h-4 w-4 mr-2" />
        Upload
      </Button>
    </div>
  );

  if (loading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <TeeemTableView
        foundationId="company_documents"
        tableName={`${category ? category.toUpperCase() : "All"} Documents (${documents.length})`}
        entries={documents}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        onRowClick={handleSingleClick}
        onRowDoubleClick={handleDoubleClick}
        enableImport={false}
        enableExport={true}
        enableSchemaEditor={false}
        showDataHealth={false}
        leftActions={leftActions}
        customCellRenderer={customCellRenderer}
        customBulkActions={(selectedIds, clearSelection) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkAiVerify(selectedIds, clearSelection)}
            disabled={bulkAiProcessing}
            className="bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700"
          >
            {bulkAiProcessing ? (
              <>
                <Spinner size={16} className="mr-1" />
                {bulkAiProgress ? `${bulkAiProgress.current}/${bulkAiProgress.total}` : "Processing..."}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                Run AI ({selectedIds.length})
              </>
            )}
          </Button>
        )}
      />

      {/* Document Side Panel - Single click preview (inlined from DocumentSidePanel) */}
      {sidePanelDocument && (
        <Sheet open={isSidePanelOpen} onOpenChange={(open) => {
          setIsSidePanelOpen(open);
          if (!open) setSidePanelDocument(null);
        }} modal={false}>
          <SheetContent
            side="right"
            className="w-[600px] sm:max-w-[600px] p-0"
            title={sidePanelDocument.file_name || "Document"}
            aria-describedby="document-preview-description"
          >
            <div className="flex flex-col h-full">
              {/* Header with confidence badges */}
              <div className="flex items-center justify-between p-4 border-b bg-background">
                <div className="flex-1 min-w-0 mr-4">
                  <h3 className="font-semibold text-sm truncate">{sidePanelDocument.file_name || "Document"}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {sidePanelDocument.folder && (
                      <Badge variant="outline" className="text-xs">{sidePanelDocument.folder}</Badge>
                    )}
                    {sidePanelDocument.source && (
                      <Badge variant="secondary" className="text-xs">{sidePanelDocument.source}</Badge>
                    )}
                    {sidePanelDocument.ocr_confidence != null ? (
                      <Badge
                        variant="outline"
                        className={cn("text-xs font-medium",
                          sidePanelDocument.ocr_confidence >= 90
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-300 dark:border-blue-700"
                            : sidePanelDocument.ocr_confidence >= 70
                            ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-600"
                            : "bg-blue-50/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500"
                        )}
                        title={`OCR text extraction confidence (${sidePanelDocument.ocr_method || 'unknown'})`}
                      >
                        OCR {Math.round(sidePanelDocument.ocr_confidence)}%
                      </Badge>
                    ) : sidePanelDocument.ocr_method === "vision" ? (
                      <Badge
                        variant="outline"
                        className="text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700"
                        title="Document processed using AI vision (no text extraction)"
                      >
                        OCR Vision
                      </Badge>
                    ) : null}
                    {sidePanelDocument.ai_confidence_score != null && (
                      <Badge
                        variant="outline"
                        className={cn("text-xs font-medium",
                          sidePanelDocument.ai_confidence_score >= 90
                            ? "bg-status-success text-status-success-foreground border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700"
                            : sidePanelDocument.ai_confidence_score >= 70
                            ? "bg-status-warning text-status-warning-foreground border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700"
                            : "bg-status-error text-status-error-foreground border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700"
                        )}
                        title="AI classification confidence score"
                      >
                        AI {Math.round(sidePanelDocument.ai_confidence_score)}%
                      </Badge>
                    )}
                    {sidePanelDocument.human_confidence != null ? (
                      <Badge
                        variant="outline"
                        className={cn("text-xs font-medium",
                          sidePanelDocument.human_confidence >= 90
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
                            : sidePanelDocument.human_confidence >= 70
                            ? "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700"
                            : "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-400 border-cyan-300 dark:border-cyan-700"
                        )}
                        title="Human validation confidence score"
                      >
                        Human {Math.round(sidePanelDocument.human_confidence)}%
                      </Badge>
                    ) : sidePanelDocument.user_validated_at ? (
                      <Badge
                        variant="outline"
                        className="text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
                        title="Validated by human"
                      >
                        Human ✓
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={handleExpandToFullscreen} title="Open fullscreen">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                  {sidePanelDocument.file_url && (
                    <Button variant="ghost" size="icon" asChild title="Open in new tab">
                      <a href={sidePanelDocument.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => { setIsSidePanelOpen(false); setSidePanelDocument(null); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Preview Area - uses DocumentViewer for supported types */}
              <div id="document-preview-description" className="flex-1 bg-muted overflow-hidden">
                {sidePanelPreviewLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Spinner size={48} className="mb-4" />
                    <p className="text-sm">Loading preview...</p>
                  </div>
                ) : sidePanelPreviewUrl ? (
                  (() => {
                    const ft = getFileType(sidePanelDocument.file_name || "");
                    if (ft === "image") {
                      return (
                        <div className="flex items-center justify-center h-full p-4">
                          <img src={sidePanelPreviewUrl} alt={sidePanelDocument.file_name || "Document"} className="max-w-full max-h-full object-contain" />
                        </div>
                      );
                    }
                    if (ft === "pdf") {
                      return <iframe src={sidePanelPreviewUrl} className="w-full h-full border-0" title="Document Preview" allow="fullscreen" />;
                    }
                    // EML, Excel, Word, other - use DocumentViewer inline (no modal)
                    return (
                      <DocumentViewer
                        url={sidePanelPreviewUrl}
                        fileName={sidePanelDocument.file_name || "Document"}
                        showHeader={false}
                        showFooter={false}
                        theme="light"
                        className="h-full"
                      />
                    );
                  })()
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                    <FileText className="h-16 w-16 mb-4" />
                    <p className="text-lg font-medium mb-2">{sidePanelPreviewError || "Preview not available"}</p>
                    <p className="text-sm text-center mb-4">This file type cannot be previewed inline</p>
                    <div className="flex gap-2">
                      {sidePanelPreviewUrl && (
                        <Button asChild size="sm">
                          <a href={sidePanelPreviewUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open in New Tab
                          </a>
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={handleExpandToFullscreen}>
                        <Maximize2 className="h-4 w-4 mr-2" />
                        Edit Details
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer hint */}
              <div className="p-2 border-t bg-muted/50 text-center">
                <p className="text-xs text-muted-foreground">Double-click document to edit details</p>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Document Preview Modal with AI Verification - Double click for editing */}
      {selectedDocument && (
        <DocumentEditModal
          open={isPreviewOpen}
          onOpenChange={(open) => {
            setIsPreviewOpen(open);
            if (!open) setSelectedDocument(null);
          }}
          document={selectedDocument}
          onDocumentUpdate={loadDocuments}
          companies={companies}
        />
      )}
    </>
  );
}

export default CompanyDocumentsTab;
