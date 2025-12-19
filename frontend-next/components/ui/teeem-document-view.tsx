"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PDFViewer } from "@/components/ui/pdf-viewer";
import { Spinner } from "@/components/ui/spinner";
import {
  FileText,
  ExternalLink,
  RefreshCw,
  Pencil,
  Check,
  X,
  CheckCircle,
  MoreHorizontal,
  Sparkles,
  Maximize2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Base document interface - consumers extend this
export interface DocumentItem {
  id: number;
}

export interface TeeemDocumentViewProps<T extends DocumentItem> {
  // Required
  documents: T[];
  title: string;

  // Document field getters (map your data to standard interface)
  getDocumentId: (doc: T) => number;
  getDocumentName: (doc: T) => string;
  getDocumentStatus: (doc: T) => "draft" | "approved";
  getPreviewUrl: (doc: T) => string | null;
  getExternalUrl?: (doc: T) => string | null;
  getRevision?: (doc: T) => string | null;
  // Thumbnail for instant preview (PNG/JPEG image)
  getThumbnailUrl?: (doc: T) => string | null;

  // Actions
  onRename?: (doc: T, newName: string) => Promise<void>;
  onApprove?: (doc: T) => Promise<void>;
  onReprocess?: (doc: T) => Promise<void>;
  onRefresh?: () => void;
  onSelect?: (doc: T | null) => void;

  // Selection & Bulk Actions
  enableSelection?: boolean;
  bulkActions?: (
    selectedIds: number[],
    clearSelection: () => void
  ) => ReactNode;

  // Header customization
  leftActions?: ReactNode;

  // State
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: ReactNode;

  // Labels (customizable)
  statusLabels?: {
    draft?: string;
    approved?: string;
  };
  actionLabels?: {
    rename?: string;
    approve?: string;
    openExternal?: string;
    reprocess?: string;
  };

  // Styling
  className?: string;
}

export function TeeemDocumentView<T extends DocumentItem>({
  documents,
  title,
  getDocumentId,
  getDocumentName,
  getDocumentStatus,
  getPreviewUrl,
  getExternalUrl,
  getRevision,
  getThumbnailUrl,
  onRename,
  onApprove,
  onReprocess,
  onRefresh,
  onSelect,
  enableSelection = false,
  bulkActions,
  leftActions,
  loading = false,
  emptyMessage = "No documents found",
  emptyIcon,
  statusLabels: statusLabelsInput,
  actionLabels: actionLabelsInput,
  className,
}: TeeemDocumentViewProps<T>) {
  // Merge labels with defaults
  const statusLabels = {
    draft: statusLabelsInput?.draft ?? "Draft",
    approved: statusLabelsInput?.approved ?? "Approved",
  };
  const actionLabels = {
    rename: actionLabelsInput?.rename ?? "Rename",
    approve: actionLabelsInput?.approve ?? "Approve",
    openExternal: actionLabelsInput?.openExternal ?? "Open",
    reprocess: actionLabelsInput?.reprocess ?? "Re-extract from PDF",
  };

  // Selection state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<T | null>(null);

  // Thumbnail vs Full PDF state
  // Start with thumbnail (instant), user clicks to load full PDF
  const [showFullPdf, setShowFullPdf] = useState(false);

  // Reset to thumbnail view when document changes
  useEffect(() => {
    setShowFullPdf(false);
  }, [selectedDocument]);

  // Notify parent when selection changes (skip initial null)
  const hasSelectedRef = useRef(false);
  useEffect(() => {
    if (selectedDocument) {
      hasSelectedRef.current = true;
      onSelect?.(selectedDocument);
    } else if (hasSelectedRef.current) {
      // Only notify null if we previously had a selection
      onSelect?.(null);
    }
  }, [selectedDocument, onSelect]);

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  // Approve state
  const [approveLoading, setApproveLoading] = useState(false);

  // Reprocess state
  const [reprocessLoading, setReprocessLoading] = useState(false);

  // Selection handlers
  const toggleSelection = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === documents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(documents.map(getDocumentId));
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  // Rename handlers
  const startRename = () => {
    if (selectedDocument) {
      setRenameValue(getDocumentName(selectedDocument));
      setIsRenaming(true);
    }
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setRenameValue("");
  };

  const saveRename = async () => {
    if (!selectedDocument || !onRename || !renameValue.trim()) return;

    setRenameLoading(true);
    try {
      await onRename(selectedDocument, renameValue.trim());
      setIsRenaming(false);
      setRenameValue("");
    } finally {
      setRenameLoading(false);
    }
  };

  // Approve handler
  const handleApprove = async () => {
    if (!selectedDocument || !onApprove) return;

    setApproveLoading(true);
    try {
      await onApprove(selectedDocument);
    } finally {
      setApproveLoading(false);
    }
  };

  // Reprocess handler
  const handleReprocess = async () => {
    if (!selectedDocument || !onReprocess) return;

    setReprocessLoading(true);
    try {
      await onReprocess(selectedDocument);
    } finally {
      setReprocessLoading(false);
    }
  };

  // Status badge component
  const StatusBadge = ({ status }: { status: "draft" | "approved" }) => {
    if (status === "approved") {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 whitespace-nowrap">
          <CheckCircle className="h-3 w-3 mr-1" />
          {statusLabels.approved}
        </Badge>
      );
    }
    return (
      <Badge
        variant="secondary"
        className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 whitespace-nowrap"
      >
        {statusLabels.draft}
      </Badge>
    );
  };

  // Render document list (left panel)
  const renderDocumentList = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Spinner className="h-8 w-8" />
        </div>
      );
    }

    if (documents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
          {emptyIcon || <FileText className="h-12 w-12 mb-3 opacity-50" />}
          <p className="text-sm text-center">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        {/* Select all header */}
        {enableSelection && (
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
            <Checkbox
              checked={
                selectedIds.length === documents.length && documents.length > 0
              }
              onCheckedChange={selectAll}
            />
            <span className="text-xs text-muted-foreground">
              {selectedIds.length > 0
                ? `${selectedIds.length} selected`
                : "Select all"}
            </span>
          </div>
        )}

        {/* Document list */}
        <div className="flex-1 overflow-y-auto">
          {documents.map((doc) => {
            const id = getDocumentId(doc);
            const name = getDocumentName(doc);
            const status = getDocumentStatus(doc);
            const isSelected = selectedDocument
              ? getDocumentId(selectedDocument) === id
              : false;

            return (
              <div
                key={id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 border-b cursor-pointer hover:bg-muted/50 transition-colors",
                  isSelected && "bg-muted"
                )}
                onClick={() => setSelectedDocument(doc)}
              >
                {enableSelection && (
                  <Checkbox
                    checked={selectedIds.includes(id)}
                    onCheckedChange={() => toggleSelection(id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{name}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bulk actions footer */}
        {enableSelection && selectedIds.length > 0 && bulkActions && (
          <div className="p-2 border-t bg-muted/30">
            {bulkActions(selectedIds, clearSelection)}
          </div>
        )}
      </div>
    );
  };

  // Render preview panel (right panel)
  const renderPreviewPanel = () => {
    if (!selectedDocument) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
          <FileText className="h-16 w-16 mb-4 opacity-50" />
          <p>Select a document to preview</p>
        </div>
      );
    }

    const previewUrl = getPreviewUrl(selectedDocument);
    const externalUrl = getExternalUrl?.(selectedDocument);
    const revision = getRevision?.(selectedDocument);
    const status = getDocumentStatus(selectedDocument);
    const name = getDocumentName(selectedDocument);
    const thumbnailUrl = getThumbnailUrl?.(selectedDocument);

    // Determine what to show: thumbnail (instant) or full PDF
    const hasThumbnail = thumbnailUrl && !showFullPdf;
    const shouldShowPdf = previewUrl && (showFullPdf || !thumbnailUrl);

    return (
      <div className="h-full relative">
        {hasThumbnail ? (
          // Show instant thumbnail preview
          <div
            className="h-full w-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 cursor-pointer group"
            onClick={() => setShowFullPdf(true)}
          >
            <img
              src={thumbnailUrl}
              alt={name}
              className="max-h-full max-w-full object-contain"
            />
            {/* Overlay to indicate clickable for full PDF */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <Maximize2 className="h-4 w-4" />
                <span>View Full PDF</span>
              </div>
            </div>
          </div>
        ) : shouldShowPdf ? (
          // Show full PDF viewer
          <PDFViewer
            url={previewUrl}
            fallbackUrl={externalUrl || undefined}
            className="h-full"
          />
        ) : (
          // No file attached
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileText className="h-16 w-16 mb-4 opacity-50" />
            <p className="mb-2">{name}</p>
            <p className="text-sm">No file attached</p>
            {externalUrl && (
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => window.open(externalUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                {actionLabels.openExternal}
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("relative h-full", className)}>
      {/* Preview panel - right 70% */}
      <div className="absolute top-0 left-[30%] right-0 bottom-0 border-l bg-card">
        {renderPreviewPanel()}
      </div>

      {/* Document list - left 30%, starts below header */}
      <div className="absolute top-11 left-0 bottom-0 w-[30%] bg-card">
        {renderDocumentList()}
      </div>
    </div>
  );
}
