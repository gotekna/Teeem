"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Paperclip,
  ChevronDown,
  Download,
  FileText,
  Image,
  File,
  FileSpreadsheet,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatFileSize, formatDateWithFallback } from "@/utils/formatters";

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

const SOURCE_LABELS: Record<string, string> = {
  po_pdf: "PO PDF",
  quote: "Quote",
  task_attachment: "Task",
  uploaded: "Uploaded",
};

const SOURCE_COLORS: Record<string, string> = {
  po_pdf: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  quote: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  task_attachment: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  uploaded: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-4 w-4 text-muted-foreground" />;
  if (mimeType.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (mimeType === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
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

  // Group documents by display section
  const poDocuments = data?.documents.filter(
    (d) => d.source === "po_pdf" || d.source === "uploaded"
  ) ?? [];
  const quoteDocuments = data?.documents.filter((d) => d.source === "quote") ?? [];
  const taskDocuments = data?.documents.filter((d) => d.source === "task_attachment") ?? [];

  const sections = [
    { label: "PO Documents", docs: poDocuments },
    { label: "Quote", docs: quoteDocuments },
    { label: "Task Attachments", docs: taskDocuments },
  ].filter((s) => s.docs.length > 0);

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

            {fetched && !loading && totalCount === 0 && (
              <p className="text-sm text-muted-foreground py-2">
                No documents attached
              </p>
            )}

            {fetched && !loading && sections.length > 0 && (
              <div className="space-y-4">
                {sections.map((section) => (
                  <div key={section.label}>
                    {sections.length > 1 && (
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                        {section.label}
                      </h4>
                    )}
                    <div className="space-y-1">
                      {section.docs.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50 group"
                        >
                          {getFileIcon(doc.mimeType)}
                          <span className="text-sm font-medium truncate flex-1 min-w-0">
                            {doc.displayName}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 shrink-0 ${
                              SOURCE_COLORS[doc.source] ?? ""
                            }`}
                          >
                            {SOURCE_LABELS[doc.source] ?? doc.source}
                          </Badge>
                          {doc.fileSize && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {formatFileSize(doc.fileSize)}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatDateWithFallback(doc.createdAt, "")}
                          </span>
                          {doc.fileUrl && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              asChild
                            >
                              <a
                                href={doc.fileUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
