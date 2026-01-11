"use client";

import { useState, useEffect, useRef, useCallback, ReactNode, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import { useAuthenticatedImage } from "@/lib/hooks/useAuthenticatedImage";

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
  onSelectionChange?: (ids: number[]) => void;

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

  // MASTERPIECE: Infinite scroll props
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

// Helper component for authenticated image loading
// Handles both data URLs (instant) and authenticated URLs (requires fetch)
function AuthenticatedImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  // Data URLs don't need authenticated fetch - display instantly
  const isDataUrl = src.startsWith('data:');
  const { imageUrl, loading, error } = useAuthenticatedImage(isDataUrl ? null : src);

  // Data URLs: render immediately (no loading state)
  if (isDataUrl) {
    return <img src={src} alt={alt} className={className} />;
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-muted-foreground ml-2">Loading thumbnail...</p>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={cn("flex items-center justify-center text-muted-foreground", className)}>
        <FileText className="h-16 w-16 opacity-50" />
      </div>
    );
  }

  return <img src={imageUrl} alt={alt} className={className} />;
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
  onSelectionChange,
  enableSelection = false,
  bulkActions,
  leftActions,
  loading = false,
  emptyMessage = "No documents found",
  emptyIcon,
  statusLabels: statusLabelsInput,
  actionLabels: actionLabelsInput,
  className,
  // MASTERPIECE: Infinite scroll
  onLoadMore,
  hasMore = false,
  loadingMore = false,
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

  // Fullscreen mode - hides everything except the PDF
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track previous document to detect document changes (not initial selection)
  const prevDocumentRef = useRef<T | null>(null);

  // MASTERPIECE: Infinite scroll ref and handler
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // MASTERPIECE: Virtual scrolling - only render visible rows
  // Estimated row height: py-2 (16px) + border-b (1px) + text (~20px) = ~37px
  const rowVirtualizer = useVirtualizer({
    count: documents.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 37,
    overscan: 10, // Render 10 extra rows above/below viewport for smooth scrolling
  });

  // Handle scroll for infinite loading
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !onLoadMore || !hasMore || loadingMore) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Load more when within 200px of the bottom
    if (scrollHeight - scrollTop - clientHeight < 200) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, loadingMore]);

  // Attach scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !onLoadMore) return;

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll, onLoadMore]);

  // Reset to thumbnail view only when switching between documents (not on initial selection)
  useEffect(() => {
    if (prevDocumentRef.current !== null && selectedDocument !== null) {
      // Switching from one document to another - reset thumbnail but stay in fullscreen
      setShowFullPdf(true); // Go straight to PDF when switching docs
    }
    prevDocumentRef.current = selectedDocument;
  }, [selectedDocument]);

  // Handle escape key to exit fullscreen (but keep showing full PDF)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
        // Keep showFullPdf true so PDF fills the preview area after exit
        setShowFullPdf(true);
      }
    };

    if (isFullscreen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when fullscreen
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

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

  // Notify parent when checkbox selection changes
  useEffect(() => {
    onSelectionChange?.(selectedIds);
  }, [selectedIds, onSelectionChange]);

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

  // Drag-to-select state (same pattern as TeeemTableView)
  const dragStateRef = useRef<{
    isDragging: boolean;
    startRowId: number | null;
    currentRowId: number | null;
    startX: number;
    startY: number;
  } | null>(null);

  const [dragRange, setDragRange] = useState<{
    startId: number;
    endId: number;
  } | null>(null);

  // Get ordered list of document IDs
  const getDocumentIds = useCallback(() => {
    return documents.map(getDocumentId);
  }, [documents, getDocumentId]);

  // Drag-to-select handlers
  const handleSelectMouseDown = useCallback((rowId: number, e: React.MouseEvent) => {
    // Don't start drag immediately - wait to see if mouse moves
    dragStateRef.current = {
      isDragging: false,
      startRowId: rowId,
      currentRowId: rowId,
      startX: e.clientX,
      startY: e.clientY,
    };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStateRef.current) return;

    // If not yet dragging, check if mouse has moved enough to start
    if (!dragStateRef.current.isDragging) {
      const deltaX = Math.abs(e.clientX - dragStateRef.current.startX);
      const deltaY = Math.abs(e.clientY - dragStateRef.current.startY);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Start dragging if moved more than 5 pixels
      if (distance > 5) {
        dragStateRef.current.isDragging = true;
        if (dragStateRef.current.startRowId !== null) {
          setDragRange({
            startId: dragStateRef.current.startRowId,
            endId: dragStateRef.current.startRowId,
          });
        }
      }
      return;
    }

    // During drag, find which row the mouse is over using elementFromPoint
    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element) return;

    // Find the closest element with data-doc-id
    const row = element.closest('[data-doc-id]');
    if (row) {
      const rowId = row.getAttribute('data-doc-id');
      if (rowId) {
        const parsedId = Number(rowId);
        dragStateRef.current.currentRowId = parsedId;
        if (dragStateRef.current.startRowId !== null) {
          setDragRange({
            startId: dragStateRef.current.startRowId,
            endId: parsedId,
          });
        }
      }
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    setDragRange(null);

    if (!dragStateRef.current?.isDragging) {
      // Single click - toggle selection
      const startId = dragStateRef.current?.startRowId;
      if (startId !== null && startId !== undefined) {
        setSelectedIds(prev =>
          prev.includes(startId) ? prev.filter(i => i !== startId) : [...prev, startId]
        );
      }
      dragStateRef.current = null;
      return;
    }

    // Process the drag selection
    const { startRowId, currentRowId } = dragStateRef.current;

    if (startRowId !== null && currentRowId !== null) {
      const docIds = getDocumentIds();
      const startIndex = docIds.indexOf(startRowId);
      const endIndex = docIds.indexOf(currentRowId);

      if (startIndex !== -1 && endIndex !== -1) {
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);
        const rowsInRange = docIds.slice(minIndex, maxIndex + 1);

        setSelectedIds(prev => {
          const next = new Set(prev);
          rowsInRange.forEach(id => next.add(id));
          return Array.from(next);
        });
      }
    }

    dragStateRef.current = null;
  }, [getDocumentIds]);

  // Check if a row is in the current drag range (for visual highlighting)
  const isInDragRange = useCallback((id: number) => {
    if (!dragRange) return false;
    const docIds = getDocumentIds();
    const startIndex = docIds.indexOf(dragRange.startId);
    const endIndex = docIds.indexOf(dragRange.endId);
    const rowIndex = docIds.indexOf(id);
    if (startIndex === -1 || endIndex === -1 || rowIndex === -1) return false;
    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);
    return rowIndex >= minIndex && rowIndex <= maxIndex;
  }, [dragRange, getDocumentIds]);

  // Attach global mouse listeners for drag
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

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
        className="bg-muted text-foreground dark:bg-gray-800 dark:text-muted-foreground whitespace-nowrap"
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

        {/* Document list - MASTERPIECE: Virtual scroll container */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto"
        >
          {/* MASTERPIECE: Virtualized list - only renders visible rows */}
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const doc = documents[virtualRow.index];
              const id = getDocumentId(doc);
              const name = getDocumentName(doc);
              const isSelected = selectedDocument
                ? getDocumentId(selectedDocument) === id
                : false;

              return (
                <div
                  key={id}
                  data-doc-id={id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className={cn(
                    "absolute top-0 left-0 w-full flex items-center gap-2 px-3 py-2 border-b cursor-pointer hover:bg-muted/50 transition-colors",
                    isSelected && "bg-muted",
                    isInDragRange(id) && "bg-blue-100 dark:bg-blue-900/30"
                  )}
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => setSelectedDocument(doc)}
                >
                  {enableSelection && (
                    <div
                      className="flex items-center justify-center p-1 -m-1 select-none"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleSelectMouseDown(id, e);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.includes(id)}
                        className="pointer-events-none"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* MASTERPIECE: Loading more indicator */}
          {loadingMore && (
            <div className="flex items-center justify-center py-3">
              <Spinner className="h-5 w-5" />
              <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
            </div>
          )}

          {/* MASTERPIECE: End of list indicator */}
          {!hasMore && documents.length > 0 && !loadingMore && (
            <div className="py-3 text-center text-xs text-muted-foreground">
              All {documents.length} documents loaded
            </div>
          )}
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
            className="h-full w-full flex items-center justify-center bg-muted dark:bg-gray-900 cursor-pointer group"
            onClick={() => {
              setShowFullPdf(true);
              setIsFullscreen(true);
            }}
          >
            <AuthenticatedImage
              src={thumbnailUrl}
              alt={name}
              className="max-h-full max-w-full object-contain"
            />
            {/* Overlay to indicate clickable for full PDF */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/70 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <Maximize2 className="h-4 w-4" />
                <span>View Full Screen</span>
              </div>
            </div>
          </div>
        ) : shouldShowPdf ? (
          // Show full PDF viewer with fullscreen button
          <div className="h-full relative">
            <PDFViewer
              url={previewUrl}
              fallbackUrl={externalUrl || undefined}
              className="h-full"
            />
            {/* Fullscreen button */}
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2 z-10 shadow-md"
              onClick={() => setIsFullscreen(true)}
            >
              <Maximize2 className="h-4 w-4 mr-1" />
              Fullscreen
            </Button>
          </div>
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

  // Render fullscreen overlay
  const renderFullscreenOverlay = () => {
    if (!isFullscreen || !selectedDocument) return null;

    const previewUrl = getPreviewUrl(selectedDocument);
    const externalUrl = getExternalUrl?.(selectedDocument);
    const name = getDocumentName(selectedDocument);

    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b bg-card shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium truncate max-w-[600px]">{name}</span>
          </div>
          <div className="flex items-center gap-2">
            {externalUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(externalUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open in SharePoint
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsFullscreen(false);
                // Keep showFullPdf true so PDF fills the preview area after exit
                setShowFullPdf(true);
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Close
              <span className="ml-2 text-xs text-muted-foreground">(Esc)</span>
            </Button>
          </div>
        </div>

        {/* PDF Viewer - full remaining height */}
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
              <p>No file attached</p>
            </div>
          )}
        </div>
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

      {/* Fullscreen overlay - covers entire screen */}
      {renderFullscreenOverlay()}
    </div>
  );
}
