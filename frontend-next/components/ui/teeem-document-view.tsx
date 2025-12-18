"use client";

import { useState, ReactNode } from "react";
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
} from "lucide-react";
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

  // Actions
  onRename?: (doc: T, newName: string) => Promise<void>;
  onApprove?: (doc: T) => Promise<void>;
  onRefresh?: () => void;

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
  onRename,
  onApprove,
  onRefresh,
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
  };

  // Selection state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<T | null>(null);

  // Rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);

  // Approve state
  const [approveLoading, setApproveLoading] = useState(false);

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
                <StatusBadge status={status} />
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

    return (
      <div className="flex flex-col h-full">
        {/* PDF Viewer */}
        <div className="flex-1 min-h-0">
          {previewUrl ? (
            <PDFViewer
              url={previewUrl}
              fallbackUrl={externalUrl || undefined}
              className="h-full"
            />
          ) : (
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

        {/* Details bar */}
        <div className="shrink-0 border-t bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Name + badges */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {isRenaming ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="h-8"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename();
                      if (e.key === "Escape") cancelRename();
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={saveRename}
                    disabled={renameLoading}
                  >
                    {renameLoading ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelRename}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="font-medium truncate">{name}</span>
                  {revision && <Badge variant="outline">{revision}</Badge>}
                  <StatusBadge status={status} />
                </>
              )}
            </div>

            {/* Right: Action buttons */}
            {!isRenaming && (
              <div className="flex items-center gap-2 shrink-0">
                {onRename && (
                  <Button size="sm" variant="outline" onClick={startRename}>
                    <Pencil className="h-4 w-4 mr-1" />
                    {actionLabels.rename}
                  </Button>
                )}
                {onApprove && status === "draft" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleApprove}
                    disabled={approveLoading}
                  >
                    {approveLoading ? (
                      <Spinner className="h-4 w-4 mr-1" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-1" />
                    )}
                    {actionLabels.approve}
                  </Button>
                )}
                {externalUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(externalUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    {actionLabels.openExternal}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-3 shrink-0">
        <h2 className="text-lg font-semibold">
          {title} ({documents.length})
        </h2>
        <div className="flex items-center gap-2">
          {leftActions}
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Split view: 30% list / 70% preview */}
      <div className="flex-1 flex gap-4 px-4 min-h-0">
        {/* Document list (30%) */}
        <div className="w-[30%] border rounded-lg overflow-hidden bg-card">
          {renderDocumentList()}
        </div>

        {/* Preview panel (70%) */}
        <div className="w-[70%] border rounded-lg overflow-hidden bg-card">
          {renderPreviewPanel()}
        </div>
      </div>
    </div>
  );
}
