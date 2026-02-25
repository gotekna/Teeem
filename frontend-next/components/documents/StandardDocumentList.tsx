"use client";

/**
 * StandardDocumentList - THE ONE reusable document list component
 *
 * Extracted from library/page.tsx (Feb 2026).
 * Provides: sortable rows, checkboxes, selection bar, Sheet preview,
 * drag-and-drop reordering, version history, verify/expiry badges.
 *
 * Usage:
 *   <StandardDocumentList
 *     documents={docs}
 *     onDelete={handleDelete}
 *     canDrag={isAdmin}
 *   />
 */

import * as React from "react";
import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Spinner } from "@/components/ui/spinner";
import {
  Download,
  FileText,
  File,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  ShieldCheck,
  Mail,
  History,
  Maximize2,
  X,
  CalendarDays,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { formatFileSize } from "@/utils/formatters";
import { DocumentViewer, getFileType } from "@/components/ui/document-viewer";
import { PDFViewer } from "@/components/ui/pdf-viewer";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createDndSensors, defaultCollisionDetection } from "@/components/ui/dnd/dnd-config";
import { DragHandle } from "@/components/ui/dnd";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

// ============================================================================
// Types
// ============================================================================

/** Document shape from /api/v1/documents/warehouse */
export interface LibraryDocument {
  id: number;
  displayName: string;
  sendName: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string | null;
  storagePath: string | null;
  folder: string | null;
  createdAt: string;
  source: string;
  verified: boolean;
  verifiedBy: string | null;
  verifiedAt: string | null;
  versionNumber: number;
  versionGroupId: string | null;
  versionCount: number;
  expiryDate: string | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  expiryStatus: string | null;
  daysUntilExpiry: number | null;
}

/** SM task info for linked warehouse folders */
export interface SmTaskInfo {
  taskId: number;
  taskName: string;
  startDate: string | null;
  endDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
}

export interface StandardDocumentListProps {
  documents: LibraryDocument[];
  loading?: boolean;
  /** Callback when a document is deleted */
  onDelete?: (doc: LibraryDocument, e: React.MouseEvent) => void;
  /** Callback when documents are reordered (receives new ordered IDs) */
  onReorder?: (docIds: number[]) => void;
  /** Allow drag-and-drop reordering */
  canDrag?: boolean;
  /** Callback when selected docs should be emailed */
  onEmail?: (docs: LibraryDocument[]) => void;
  /** Callback when a document is verified */
  onVerify?: (doc: LibraryDocument) => void;
  /** Callback when a document's expiry date is set/changed */
  onSetExpiry?: (doc: LibraryDocument, date: Date | null) => void;
  /** SM Task info (optional - shows status bar above list) */
  smTaskInfo?: SmTaskInfo;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state action button */
  emptyAction?: React.ReactNode;
  /** Show version badges */
  showVersionBadge?: boolean;
  /** Show verified/unverified indicators */
  showVerifiedBadge?: boolean;
  /** Show expiry badges */
  showExpiryBadge?: boolean;
  /** Show verify/expiry actions in preview sheet */
  showVerifyActions?: boolean;
  /** Controlled selection - parent manages the Map */
  selectedDocs?: Map<number, LibraryDocument>;
  /** Controlled selection change handler */
  onSelectionChange?: (docs: Map<number, LibraryDocument>) => void;
  /** Hide the built-in floating action bar (parent renders its own) */
  hideFloatingBar?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith("image/")) return ImageIcon;
  return FileText;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ============================================================================
// SortableDocumentRow
// ============================================================================

function SortableDocumentRow({
  doc,
  isSelected,
  canDrag,
  onToggleSelect,
  onClick,
  onDoubleClick,
  onDelete,
  showVersionBadge = true,
  showExpiryBadge = true,
  showVerifiedBadge = true,
}: {
  doc: LibraryDocument;
  isSelected: boolean;
  canDrag: boolean;
  onToggleSelect: (docId: number, e: React.MouseEvent) => void;
  onClick: (doc: LibraryDocument) => void;
  onDoubleClick: (doc: LibraryDocument) => void;
  onDelete?: (doc: LibraryDocument, e: React.MouseEvent) => void;
  showVersionBadge?: boolean;
  showExpiryBadge?: boolean;
  showVerifiedBadge?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: doc.id, disabled: !canDrag });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = getFileIcon(doc.mimeType);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-3 py-2 w-full text-left hover:bg-muted/50 rounded-md transition-colors ${isSelected ? "bg-primary/5" : ""} ${isDragging ? "opacity-50 shadow-lg z-50" : ""}`}
    >
      {canDrag && (
        <DragHandle {...attributes} {...listeners} size="sm" />
      )}
      <Checkbox
        checked={isSelected}
        onClick={(e) => onToggleSelect(doc.id, e)}
        className="shrink-0"
      />
      <button
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        onClick={() => onClick(doc)}
        onDoubleClick={() => onDoubleClick(doc)}
      >
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <p className="text-sm font-medium truncate flex-1 min-w-0 text-left">
          {doc.originalFilename || doc.displayName || `Document ${doc.id}`}
        </p>
      </button>
      {showVersionBadge && doc.versionCount > 1 && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-semibold">
          v{doc.versionNumber}
        </Badge>
      )}
      {showExpiryBadge && doc.expiryDate && (
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 h-4 shrink-0 font-semibold border-0 ${
            doc.isExpired
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              : doc.isExpiringSoon
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          }`}
        >
          {doc.isExpired
            ? "Expired"
            : doc.isExpiringSoon
              ? `${doc.daysUntilExpiry}d left`
              : `EX ${new Date(doc.expiryDate).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`
          }
        </Badge>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
        {doc.fileSize > 0 && <span>{formatFileSize(doc.fileSize)}</span>}
        {doc.createdAt && <span>{formatDate(doc.createdAt)}</span>}
        {showVersionBadge && doc.versionCount > 1 && (
          <span className="inline-flex items-center gap-1">
            <History className="h-3 w-3" />
            {doc.versionCount}
          </span>
        )}
        {showVerifiedBadge && (doc.verified ? (
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle2 className="h-3 w-3" />
          </span>
        ) : (
          <span className="text-amber-500 dark:text-amber-400 text-[10px]">!</span>
        ))}
      </div>
      {doc.fileUrl && (
        <a
          href={doc.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 p-1.5 hover:bg-muted rounded-md"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="h-4 w-4 text-muted-foreground" />
        </a>
      )}
      {onDelete && (
        <button
          className="shrink-0 p-1.5 hover:bg-destructive/10 rounded-md"
          onClick={(e) => onDelete(doc, e)}
          title="Delete"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// SmTaskStatusBar
// ============================================================================

export function SmTaskStatusBar({ info }: { info: SmTaskInfo }) {
  const statusConfig = {
    not_started: {
      label: "Not Started",
      className: "bg-muted text-muted-foreground",
      dotClass: "bg-muted-foreground",
    },
    started: {
      label: "In Progress",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      dotClass: "bg-blue-500",
    },
    completed: {
      label: "Completed",
      className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      dotClass: "bg-emerald-500",
    },
    waiting_for_response: {
      label: "Waiting",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      dotClass: "bg-amber-500",
    },
    waiting_for_info: {
      label: "Waiting for Info",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      dotClass: "bg-amber-500",
    },
  };

  const config = statusConfig[info.status as keyof typeof statusConfig] || statusConfig.not_started;

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b bg-muted/30 text-sm">
      <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="font-medium truncate">{info.taskName}</span>
      <span className="text-muted-foreground">·</span>
      <Badge variant="outline" className={`text-[10px] px-2 py-0 h-5 border-0 font-semibold ${config.className}`}>
        <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${config.dotClass}`} />
        {config.label}
      </Badge>
      {info.startedAt && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            Started {formatDate(info.startedAt)}
          </span>
        </>
      )}
      {info.completedAt && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            Completed {formatDate(info.completedAt)}
          </span>
        </>
      )}
      {!info.completedAt && info.endDate && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            Due {formatDate(info.endDate)}
          </span>
        </>
      )}
    </div>
  );
}

// ============================================================================
// StandardDocumentList
// ============================================================================

export function StandardDocumentList({
  documents: externalDocuments,
  loading = false,
  onDelete,
  onReorder,
  canDrag = false,
  onEmail,
  onVerify,
  onSetExpiry,
  smTaskInfo,
  emptyMessage = "No documents yet",
  emptyAction,
  showVersionBadge = true,
  showVerifiedBadge = true,
  showExpiryBadge = true,
  showVerifyActions = true,
  selectedDocs: controlledSelectedDocs,
  onSelectionChange,
  hideFloatingBar = false,
}: StandardDocumentListProps) {
  const { toast } = useToast();

  // Internal documents state (for reorder support)
  const [documents, setDocuments] = useState(externalDocuments);
  React.useEffect(() => {
    setDocuments(externalDocuments);
  }, [externalDocuments]);

  // Selection state - supports controlled (parent manages) or uncontrolled (internal) mode
  const [internalSelectedDocs, setInternalSelectedDocs] = useState<Map<number, LibraryDocument>>(new Map());
  const isControlled = controlledSelectedDocs !== undefined;
  const selectedDocs = isControlled ? controlledSelectedDocs : internalSelectedDocs;

  const updateSelection = useCallback((next: Map<number, LibraryDocument>) => {
    if (isControlled && onSelectionChange) {
      onSelectionChange(next);
    } else {
      setInternalSelectedDocs(next);
    }
  }, [isControlled, onSelectionChange]);

  // Sheet preview state
  const [previewDoc, setPreviewDoc] = useState<LibraryDocument | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Version history
  const [versionHistory, setVersionHistory] = useState<LibraryDocument[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  // DnD sensors
  const sensors = createDndSensors();

  // Toggle selection
  const toggleSelect = useCallback((docId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const doc = documents.find(d => d.id === docId);
    const next = new Map(selectedDocs);
    if (next.has(docId)) {
      next.delete(docId);
    } else if (doc) {
      next.set(docId, doc);
    }
    updateSelection(next);
  }, [documents, selectedDocs, updateSelection]);

  // Single click -> preview
  const handleDocumentClick = useCallback((doc: LibraryDocument) => {
    setPreviewDoc(doc);
    setIsSheetOpen(true);
    setShowVersions(false);
    setVersionHistory([]);
    if (doc.versionCount > 1) {
      fetchVersionHistory(doc.id);
    }
  }, []);

  // Double click -> open in new tab
  const handleDocumentDoubleClick = useCallback((doc: LibraryDocument) => {
    if (doc.fileUrl) {
      window.open(doc.fileUrl, "_blank");
    }
  }, []);

  // Fetch version history
  const fetchVersionHistory = useCallback(async (docId: number) => {
    setVersionsLoading(true);
    try {
      const res = await api.get<{ success: boolean; versions: LibraryDocument[] }>(
        `/api/v1/documents/${docId}/versions`
      );
      if (res?.success) {
        setVersionHistory(res.versions || []);
      }
    } catch (error) {
      console.error("Failed to fetch version history:", error);
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  // DnD drag end handler
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDocuments(prev => {
      const oldIndex = prev.findIndex(d => d.id === active.id);
      const newIndex = prev.findIndex(d => d.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;

      const reordered = arrayMove(prev, oldIndex, newIndex);
      onReorder?.(reordered.map(d => d.id));
      return reordered;
    });
  }, [onReorder]);

  // Email selected
  const handleEmailSelected = useCallback(() => {
    const docs = Array.from(selectedDocs.values());
    if (docs.length > 0) {
      onEmail?.(docs);
    }
  }, [selectedDocs, onEmail]);

  // Build preview URL
  const previewUrl = previewDoc?.fileUrl || null;

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  // Empty state
  if (documents.length === 0) {
    return (
      <>
        {smTaskInfo && <SmTaskStatusBar info={smTaskInfo} />}
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <File className="h-10 w-10" />
          <p className="font-medium">{emptyMessage}</p>
          {emptyAction}
        </div>
      </>
    );
  }

  return (
    <>
      {/* SM Task status bar */}
      {smTaskInfo && <SmTaskStatusBar info={smTaskInfo} />}

      {/* Document list with DnD */}
      <DndContext
        sensors={sensors}
        collisionDetection={defaultCollisionDetection}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={documents.map(d => d.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="divide-y">
            {documents.map((doc) => (
              <SortableDocumentRow
                key={doc.id}
                doc={doc}
                isSelected={selectedDocs.has(doc.id)}
                canDrag={canDrag}
                onToggleSelect={toggleSelect}
                onClick={handleDocumentClick}
                onDoubleClick={handleDocumentDoubleClick}
                onDelete={onDelete}
                showVersionBadge={showVersionBadge}
                showExpiryBadge={showExpiryBadge}
                showVerifiedBadge={showVerifiedBadge}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Floating action bar when documents selected (hidden if parent renders its own) */}
      {!hideFloatingBar && selectedDocs.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 bg-background border rounded-lg shadow-lg">
          <span className="text-sm font-medium">
            {selectedDocs.size} selected
          </span>
          {onEmail && (
            <Button size="sm" variant="outline" onClick={handleEmailSelected}>
              <Mail className="h-4 w-4 mr-1.5" />
              Email
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-muted-foreground"
            onClick={() => updateSelection(new Map())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Document preview sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-[600px] sm:max-w-[600px] p-0 flex flex-col">
          {previewDoc && (
            <>
              {/* Sheet header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">
                      {previewDoc.originalFilename || previewDoc.displayName}
                    </p>
                    {showVersionBadge && previewDoc.versionCount > 1 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-semibold">
                        v{previewDoc.versionNumber}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {previewDoc.fileSize > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {formatFileSize(previewDoc.fileSize)}
                      </Badge>
                    )}
                    {previewDoc.mimeType && (
                      <Badge variant="outline" className="text-xs">
                        {previewDoc.mimeType.split("/").pop()?.toUpperCase()}
                      </Badge>
                    )}
                    {showExpiryBadge && previewDoc.expiryDate && (
                      <Badge
                        className={`text-xs border-0 ${
                          previewDoc.isExpired
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : previewDoc.isExpiringSoon
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        }`}
                      >
                        <CalendarDays className="h-3 w-3 mr-1" />
                        {previewDoc.isExpired
                          ? "Expired"
                          : previewDoc.isExpiringSoon
                            ? `Expires in ${previewDoc.daysUntilExpiry} days`
                            : `Expires ${new Date(previewDoc.expiryDate).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`
                        }
                      </Badge>
                    )}
                    {showVerifiedBadge && previewDoc.verified ? (
                      <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Verified{previewDoc.verifiedBy ? ` by ${previewDoc.verifiedBy}` : ""}{previewDoc.verifiedAt ? ` on ${new Date(previewDoc.verifiedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {showVersionBadge && previewDoc.versionCount > 1 && (
                    <Button
                      size="sm"
                      variant={showVersions ? "default" : "outline"}
                      className="text-xs h-7"
                      onClick={() => {
                        setShowVersions(!showVersions);
                        if (!showVersions && versionHistory.length === 0) {
                          fetchVersionHistory(previewDoc.id);
                        }
                      }}
                    >
                      <History className="h-3.5 w-3.5 mr-1" />
                      {previewDoc.versionCount} versions
                    </Button>
                  )}
                  {showVerifyActions && onSetExpiry && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7"
                        >
                          <CalendarDays className="h-3.5 w-3.5 mr-1" />
                          {previewDoc.expiryDate ? "Edit Expiry" : "Set Expiry"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={previewDoc.expiryDate ? new Date(previewDoc.expiryDate) : undefined}
                          onSelect={(date) => {
                            if (date) onSetExpiry(previewDoc, date);
                          }}
                        />
                        {previewDoc.expiryDate && (
                          <div className="px-3 pb-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-xs text-destructive hover:text-destructive"
                              onClick={() => onSetExpiry(previewDoc, null)}
                            >
                              Remove Expiry Date
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  )}
                  {showVerifyActions && onVerify && !previewDoc.verified && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                      onClick={() => onVerify(previewDoc)}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                      Validate
                    </Button>
                  )}
                  {onEmail && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => onEmail([previewDoc])}
                    >
                      <Mail className="h-3.5 w-3.5 mr-1" />
                      Email
                    </Button>
                  )}
                  <button
                    onClick={() => previewDoc.fileUrl && window.open(previewDoc.fileUrl, "_blank")}
                    className="p-1.5 hover:bg-muted rounded-md"
                    title="Open in new tab"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setIsSheetOpen(false)}
                    className="p-1.5 hover:bg-muted rounded-md"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Version history panel */}
              {showVersions && previewDoc.versionCount > 1 && (
                <div className="border-b bg-muted/20 px-4 py-2 max-h-48 overflow-auto">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Version History</p>
                  {versionsLoading ? (
                    <div className="flex items-center justify-center py-3">
                      <Spinner className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {versionHistory.map((ver) => {
                        const isCurrent = ver.id === previewDoc.id;
                        return (
                          <button
                            key={ver.id}
                            className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                              isCurrent
                                ? "bg-primary/10 text-primary font-medium"
                                : "hover:bg-muted/50 text-muted-foreground"
                            }`}
                            onClick={() => {
                              if (!isCurrent) {
                                setPreviewDoc(ver);
                              }
                            }}
                          >
                            <Badge
                              variant={isCurrent ? "default" : "secondary"}
                              className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-semibold"
                            >
                              v{ver.versionNumber}
                            </Badge>
                            <span className="truncate flex-1">
                              {ver.originalFilename || ver.displayName}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {formatFileSize(ver.fileSize)}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {ver.createdAt && formatDate(ver.createdAt)}
                            </span>
                            {ver.fileUrl && (
                              <a
                                href={ver.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 p-0.5 hover:bg-muted rounded"
                                onClick={(e) => e.stopPropagation()}
                                title="Download this version"
                              >
                                <Download className="h-3 w-3" />
                              </a>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Expiry banner */}
              {previewDoc.isExpired && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      This document expired on {new Date(previewDoc.expiryDate!).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </div>
                </div>
              )}
              {previewDoc.isExpiringSoon && !previewDoc.isExpired && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      This document expires in {previewDoc.daysUntilExpiry} day{previewDoc.daysUntilExpiry !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              )}

              {/* Validation banner */}
              {showVerifyActions && !previewDoc.verified && onVerify && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>This document has not been validated</span>
                  </div>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 shrink-0"
                    onClick={() => onVerify(previewDoc)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Validate Document
                  </Button>
                </div>
              )}

              {/* Preview content */}
              <div className="flex-1 min-h-0 overflow-auto bg-muted/30">
                {previewUrl ? (
                  (() => {
                    const fileType = getFileType(previewDoc.originalFilename || "");
                    if (fileType === "pdf") {
                      return (
                        <PDFViewer url={previewUrl} className="h-full" />
                      );
                    }
                    if (fileType === "image") {
                      return (
                        <div className="flex items-center justify-center h-full p-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={previewUrl}
                            alt={previewDoc.displayName || "Preview"}
                            className="max-w-full max-h-full object-contain rounded-md"
                          />
                        </div>
                      );
                    }
                    if (fileType === "eml") {
                      return (
                        <DocumentViewer
                          url={previewUrl}
                          fileName={previewDoc.originalFilename || ""}
                        />
                      );
                    }
                    return (
                      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                        <FileText className="h-12 w-12" />
                        <p className="text-sm">Preview not available for this file type</p>
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          Download to view
                        </a>
                      </div>
                    );
                  })()
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                    <FileText className="h-10 w-10" />
                    <p className="text-sm">No preview available</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
