"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Paperclip, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import {
  StandardDocumentList,
  type LibraryDocument,
} from "@/components/documents/StandardDocumentList";

interface PODocument {
  id: number;
  displayName: string;
  mimeType: string | null;
  fileSize: number | null;
  fileUrl: string | null;
  source: "po_pdf" | "quote" | "task_attachment" | "uploaded";
  createdAt: string | null;
  originalFilename: string | null;
}

interface PODocumentsResponse {
  documents: PODocument[];
  totalCount: number;
  sources: Record<string, number>;
}

/** Map PO-specific document shape to StandardDocumentList's LibraryDocument */
function toLibraryDocument(doc: PODocument): LibraryDocument {
  return {
    id: doc.id,
    displayName: doc.displayName,
    sendName: doc.originalFilename || doc.displayName,
    originalFilename: doc.originalFilename || doc.displayName,
    mimeType: doc.mimeType || "application/octet-stream",
    fileSize: doc.fileSize || 0,
    fileUrl: doc.fileUrl,
    storagePath: null,
    folder: doc.source,
    createdAt: doc.createdAt || new Date().toISOString(),
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

interface PODocumentsSectionProps {
  purchaseOrderId: string | number;
}

export default function PODocumentsSection({ purchaseOrderId }: PODocumentsSectionProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [data, setData] = useState<PODocumentsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    if (fetched) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<PODocumentsResponse>(
        `/api/v1/purchase_orders/${purchaseOrderId}/documents`
      );
      if (response) {
        setData(response);
      }
      setFetched(true);
    } catch {
      setError("Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [purchaseOrderId, fetched]);

  // Fetch on expand
  useEffect(() => {
    if (open && !fetched) {
      fetchDocuments();
    }
  }, [open, fetched, fetchDocuments]);

  const totalCount = data?.totalCount ?? 0;
  const libraryDocs = (data?.documents || []).map(toLibraryDocument);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-6 py-4 text-left hover:bg-muted/50 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold">Documents & Attachments</span>
              {fetched && totalCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {totalCount}
                </Badge>
              )}
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {fetched && !loading && (
              <StandardDocumentList
                documents={libraryDocs}
                loading={false}
                showVerifiedBadge={false}
                showExpiryBadge={false}
                showVerifyActions={false}
                emptyMessage="No documents attached"
              />
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
