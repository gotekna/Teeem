"use client";

// =============================================================================
// ContactTabDocuments - Shows documents filtered by WarehouseFolder tab_key
// =============================================================================
// Uses the tab_key to filter documents via document_type links (primary + also_show_in)
// Replaces custom Year → Month → Documents tree with StandardDocumentList
// =============================================================================

import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import {
  StandardDocumentList,
  type LibraryDocument,
} from "@/components/documents/StandardDocumentList";

interface ContactDocument {
  id: number;
  name: string;
  displayName: string;
  folder: string | null;
  fileSize: number | null;
  contentType: string | null;
  source: string;
  externalId: string | null;
  storagePath: string | null;
  storageProvider: string | null;
  documentType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  downloadUrl: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  datePaid: string | null;
}

interface ContactTabDocumentsProps {
  contactId: number;
  tabKey: string;
  title?: string;
}

/** Map contact document to StandardDocumentList's LibraryDocument */
function toLibraryDocument(doc: ContactDocument): LibraryDocument {
  return {
    id: doc.id,
    displayName: doc.displayName || doc.name,
    sendName: doc.name,
    originalFilename: doc.name,
    mimeType: doc.contentType || "application/octet-stream",
    fileSize: doc.fileSize || 0,
    fileUrl: doc.downloadUrl,
    storagePath: doc.storagePath,
    folder: doc.folder,
    createdAt: doc.invoiceDate || doc.createdAt || new Date().toISOString(),
    source: doc.source,
    verified: false,
    verifiedBy: null,
    verifiedAt: null,
    versionNumber: 1,
    versionLetter: null,
    versionGroupId: null,
    versionCount: 1,
    expiryDate: null,
    isExpired: false,
    isExpiringSoon: false,
    expiryStatus: null,
    daysUntilExpiry: null,
  };
}

export function ContactTabDocuments({
  contactId,
  tabKey,
  title = "Documents",
}: ContactTabDocumentsProps) {
  const [documents, setDocuments] = useState<ContactDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get<{
          success: boolean;
          documents: ContactDocument[];
          total: number;
        }>(`/api/v1/contacts/${contactId}/documents?tab_key=${tabKey}`);

        if (response?.documents) {
          setDocuments(response.documents);
        }
      } catch (err) {
        console.error("Failed to fetch documents:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch documents");
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [contactId, tabKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        <p>Error: {error}</p>
      </div>
    );
  }

  return (
    <StandardDocumentList
      documents={documents.map(toLibraryDocument)}
      loading={false}
      showVerifiedBadge={false}
      showExpiryBadge={false}
      showVerifyActions={false}
      emptyMessage={`No ${title.toLowerCase()} found`}
      emptyAction={
        <div className="flex flex-col items-center">
          <FileText className="h-12 w-12 mb-4 opacity-20" />
        </div>
      }
    />
  );
}

export default ContactTabDocuments;
