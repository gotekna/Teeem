"use client";

/**
 * CompanyDocumentsTab - Document management for corporate entities
 *
 * Uses StandardDocumentList (THE ONE document list component) to render
 * documents in a clean flat list with preview sheet, checkboxes, and actions.
 * Double-click opens DocumentEditModal for AI verification and metadata editing.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Layers,
} from "lucide-react";
import { api, getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { Spinner } from "@/components/ui/spinner";
import type { Corporate } from "@/lib/types/corporate";
import { useConfirm } from "@/contexts/ConfirmationContext";
import DocumentEditModal from "@/components/corporate/DocumentEditModal";
import {
  StandardDocumentList,
  type LibraryDocument,
} from "@/components/documents/StandardDocumentList";

// Document interface from API
interface CompanyDocument {
  id: number | string;
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
  ocr_confidence?: number;
  ocr_method?: string;
  human_confidence?: number;
}

// Map CompanyDocument to LibraryDocument for StandardDocumentList
function mapToLibraryDocument(doc: CompanyDocument): LibraryDocument {
  // Build content proxy URL (bypasses S3/B2 CORS for in-page preview)
  const contentUrl = `${getApiBaseUrl()}/api/v1/company_documents/${doc.id}/content`;
  const token = getStorageItem<string | null>(STORAGE_KEYS.TOKEN, null);
  const proxyUrl = `${contentUrl}?token=${encodeURIComponent(token || "")}`;

  const fileName = doc.file_name || doc.display_name || "";
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", gif: "image/gif",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    eml: "message/rfc822",
  };

  return {
    id: typeof doc.id === "string" ? parseInt(doc.id, 10) : doc.id,
    displayName: doc.display_name || doc.file_name || `Document ${doc.id}`,
    sendName: doc.file_name || "",
    originalFilename: doc.file_name || "",
    mimeType: mimeMap[ext] || "application/octet-stream",
    fileSize: doc.file_size || 0,
    fileUrl: proxyUrl,
    storagePath: null,
    folder: doc.folder || null,
    createdAt: doc.created_at || "",
    source: doc.source || "upload",
    verified: !!(doc.user_validated_at || doc.ai_verification_status === "verified"),
    verifiedBy: doc.user_validated_by_name || null,
    verifiedAt: doc.user_validated_at || null,
    versionNumber: 1,
    versionGroupId: null,
    versionCount: 1,
    expiryDate: null,
    isExpired: false,
    isExpiringSoon: false,
    expiryStatus: null,
    daysUntilExpiry: null,
  };
}

interface CompanyDocumentsTabProps {
  companyId: string;
  company: Corporate;
  category?: string;
}

export function CompanyDocumentsTab({ companyId, company, category }: CompanyDocumentsTabProps) {
  const { confirm } = useConfirm();
  const [documents, setDocuments] = React.useState<CompanyDocument[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [companies, setCompanies] = React.useState<Corporate[]>([]);

  // Cascade mode - shows documents from folder AND all subfolders
  const [cascadeMode, setCascadeMode] = React.useState(true);

  // DocumentEditModal state (double-click to edit)
  const [selectedDocument, setSelectedDocument] = React.useState<CompanyDocument | null>(null);
  const [isEditOpen, setIsEditOpen] = React.useState(false);

  React.useEffect(() => {
    loadDocuments();
    loadCompanies();
  }, [companyId, category, cascadeMode]);

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
        if (cascadeMode) {
          params.include_descendants = "true";
        }
      }
      const response = await api.get<{ documents: CompanyDocument[] }>("/api/v1/company_documents", { params });
      setDocuments(response.documents || []);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setLoading(false);
    }
  };

  // Delete handler
  const handleDelete = async (doc: LibraryDocument, e: React.MouseEvent) => {
    e.stopPropagation();
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

  // Double-click → open DocumentEditModal
  const handleDoubleClick = (doc: LibraryDocument) => {
    const companyDoc = documents.find(d => String(d.id) === String(doc.id));
    if (companyDoc) {
      setSelectedDocument(companyDoc);
      setIsEditOpen(true);
    }
  };

  // Map to LibraryDocument format
  const libraryDocs = React.useMemo(() => documents.map(mapToLibraryDocument), [documents]);

  if (loading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with cascade toggle and count */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
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
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">
          {documents.length} document{documents.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Document list */}
      <div className="flex-1 min-h-0 overflow-auto">
        <StandardDocumentList
          documents={libraryDocs}
          loading={loading}
          onDelete={handleDelete}
          onDocumentDoubleClick={handleDoubleClick}
          showVerifiedBadge={true}
          showVersionBadge={false}
          showExpiryBadge={false}
          emptyMessage="No documents in this folder"
        />
      </div>

      {/* Document Edit Modal - Double click for AI verification and metadata editing */}
      {selectedDocument && (
        <DocumentEditModal
          open={isEditOpen}
          onOpenChange={(open) => {
            setIsEditOpen(open);
            if (!open) {
              setSelectedDocument(null);
              loadDocuments(); // Refresh after edit
            }
          }}
          document={selectedDocument}
          onDocumentUpdate={loadDocuments}
          companies={companies}
        />
      )}
    </div>
  );
}

export default CompanyDocumentsTab;
