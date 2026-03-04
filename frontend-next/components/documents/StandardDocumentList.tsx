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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Upload,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { formatFileSize } from "@/utils/formatters";
import { DocumentViewer, getFileType } from "@/components/ui/document-viewer";
import { PDFViewer } from "@/components/ui/pdf-viewer";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createDndSensors, defaultCollisionDetection } from "@/components/ui/dnd/dnd-config";
import { DragHandle } from "@/components/ui/dnd";
import { api, getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
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
  versionLetter: string | null;
  versionGroupId: string | null;
  versionCount: number;
  expiryDate: string | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
  expiryStatus: string | null;
  daysUntilExpiry: number | null;
  documentTypeId?: number | null;
}

// SSoT: SmTaskInfo type defined in warehouse/types.ts, re-exported here
import type { SmTaskInfo, SmTaskRequiredDocType } from "@/components/warehouse/types";
export type { SmTaskInfo, SmTaskRequiredDocType };

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
  /** Override double-click behavior (default: open fileUrl in new tab) */
  onDocumentDoubleClick?: (doc: LibraryDocument) => void;
  /** Callback when upload is clicked on a required doc type placeholder row */
  onUploadForDocType?: (docType: SmTaskRequiredDocType) => void;
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
  onRowClick,
  onDelete,
  showVersionBadge = true,
  showExpiryBadge = true,
  showVerifiedBadge = true,
}: {
  doc: LibraryDocument;
  isSelected: boolean;
  canDrag: boolean;
  onToggleSelect: (docId: number, e: React.MouseEvent) => void;
  onRowClick: (doc: LibraryDocument, e: React.MouseEvent) => void;
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
      className={`flex items-center gap-3 px-3 py-2 w-full text-left hover:bg-muted/50 rounded-md transition-colors cursor-pointer ${isSelected ? "bg-primary/5" : ""} ${isDragging ? "opacity-50 shadow-lg z-50" : ""}`}
      onClick={(e) => onRowClick(doc, e)}
    >
      {canDrag && (
        <DragHandle {...attributes} {...listeners} size="sm" />
      )}
      <Checkbox
        checked={isSelected}
        onClick={(e) => { e.stopPropagation(); onToggleSelect(doc.id, e); }}
        className="shrink-0"
      />
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <p className="text-sm font-medium truncate flex-1 min-w-0 text-left">
        {doc.displayName || doc.originalFilename || `Document ${doc.id}`}
      </p>
      {showVersionBadge && (doc.versionLetter || doc.versionCount > 1) && (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-semibold">
          Rev {doc.versionLetter || doc.versionNumber}
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
          <span className="inline-flex items-center gap-1" title={`${doc.versionCount} versions`}>
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
          onClick={(e) => { e.stopPropagation(); onDelete(doc, e); }}
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
  const [expanded, setExpanded] = useState(false);

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
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="border-b bg-muted/30 text-sm">
      {/* Collapsed: just task name + chevron toggle */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <ClipboardList className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground truncate">{info.taskName}</span>
      </div>

      {/* Expanded: full task details */}
      {expanded && (
        <div className="flex items-center gap-3 px-3 pb-2 pl-9 flex-wrap">
          <Badge variant="outline" className={`text-[10px] px-2 py-0 h-5 border-0 font-semibold ${config.className}`}>
            <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${config.dotClass}`} />
            {config.label}
          </Badge>
          {info.startedAt ? (
            <span className="text-xs text-muted-foreground">Started: {formatDate(info.startedAt)}</span>
          ) : (
            <span className="text-xs text-muted-foreground">Started: —</span>
          )}
          {info.endDate && (
            <span className="text-xs text-muted-foreground">Due: {formatDate(info.endDate)}</span>
          )}
          {info.completedAt && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              Completed: {formatDate(info.completedAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Task status config (shared)
// ============================================================================

const taskStatusConfig = {
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

// ============================================================================
// RequiredDocPlaceholderRow - Expandable placeholder for missing documents
// Shows doc type name + Waiting badge. Click chevron to reveal task info.
// ============================================================================

function RequiredDocPlaceholderRow({
  docType,
  onUpload,
}: {
  docType: SmTaskRequiredDocType;
  onUpload?: (docType: SmTaskRequiredDocType) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const taskName = docType.taskName;
  const startDate = docType.taskStartDate;
  const endDate = docType.taskEndDate;
  const taskStatus = docType.taskStatus || "not_started";
  const config = taskStatusConfig[taskStatus as keyof typeof taskStatusConfig] || taskStatusConfig.not_started;
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="bg-amber-50/50 dark:bg-amber-950/10 border-b border-dashed border-amber-200 dark:border-amber-800/30">
      {/* Primary row: doc type name + waiting badge + chevron + upload */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div
          className="cursor-pointer p-0.5 hover:bg-amber-200/50 dark:hover:bg-amber-800/30 rounded shrink-0"
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronIcon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="h-7 w-7 rounded bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
          <FileText className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
            {docType.documentTypeName}
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 h-4 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400 shrink-0"
        >
          Waiting
        </Badge>
        {onUpload && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 h-7 text-xs"
            onClick={() => onUpload(docType)}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload
          </Button>
        )}
      </div>

      {/* Expanded: task info */}
      {expanded && taskName && (
        <div className="flex items-center gap-2 px-3 pb-2.5 pl-12 flex-wrap">
          <ClipboardList className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] text-muted-foreground">{taskName}</span>
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 border-0 font-semibold shrink-0 ${config.className}`}>
            <span className={`h-1 w-1 rounded-full mr-1 ${config.dotClass}`} />
            {config.label}
          </Badge>
          {startDate && (
            <span className="text-[11px] text-muted-foreground">
              Start: {formatDate(startDate)}
            </span>
          )}
          {endDate && (
            <span className="text-[11px] text-muted-foreground">
              Due: {formatDate(endDate)}
            </span>
          )}
        </div>
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
  onDocumentDoubleClick: customDoubleClick,
  onUploadForDocType,
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
  const [validationGateDoc, setValidationGateDoc] = useState<LibraryDocument | null>(null);

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

  // ⚠️ DO NOT SIMPLIFY - Click-count detection for single vs double click (Feb 2026)
  // ════════════════════════════════════════════
  // Why: Single click opens Sheet preview. Double click opens in new tab.
  //      Uses event.detail (native click count) + 300ms delay on single click
  //      so double-click can cancel the pending preview open.
  // ════════════════════════════════════════════
  const clickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleRowClick = useCallback((doc: LibraryDocument, e: React.MouseEvent) => {
    console.log("[SDL] click", { detail: e.detail, docId: doc.id, name: doc.displayName, fileUrl: doc.fileUrl?.substring(0, 60), hasPendingTimeout: !!clickTimeoutRef.current, customDoubleClick: !!customDoubleClick });

    // event.detail === 2 means browser detected a double-click
    if (e.detail >= 2) {
      console.log("[SDL] DOUBLE CLICK detected via e.detail", e.detail);
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      if (customDoubleClick) {
        console.log("[SDL] calling customDoubleClick");
        customDoubleClick(doc);
      } else {
        // Open document in new tab — use fileUrl or build download endpoint fallback
        const url = doc.fileUrl || `${getApiBaseUrl()}/api/v1/documents/${doc.id}/download?token=${encodeURIComponent(getStorageItem<string>(STORAGE_KEYS.TOKEN, "") || "")}`;
        console.log("[SDL] opening in new tab:", url.substring(0, 80));
        window.open(url, "_blank");
      }
      return;
    }
    // Single click — delay to allow double-click to cancel
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    clickTimeoutRef.current = setTimeout(() => {
      console.log("[SDL] single click confirmed — opening preview sheet");
      clickTimeoutRef.current = null;
      // If validation is enabled and doc is not verified, show the validation gate modal first
      if (showVerifyActions && !doc.verified) {
        setValidationGateDoc(doc);
        return;
      }
      setPreviewDoc(doc);
      setIsSheetOpen(true);
      setShowVersions(false);
      setVersionHistory([]);
      if (doc.versionCount > 1) {
        fetchVersionHistory(doc.id);
      }
    }, 300);
  }, [customDoubleClick, showVerifyActions]);

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
  // Build preview URL — use fileUrl if available, otherwise fall back to download endpoint
  const previewUrl = previewDoc
    ? (previewDoc.fileUrl || `${getApiBaseUrl()}/api/v1/documents/${previewDoc.id}/download?preview=1&token=${encodeURIComponent(getStorageItem<string>(STORAGE_KEYS.TOKEN, "") || "")}`)
    : null;

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  // Missing required doc types (exclude uploaded + completed tasks)
  const missingRequiredDocs = smTaskInfo?.requiredDocumentTypes?.filter(
    dt => !dt.uploaded && dt.taskStatus !== "completed"
  ) || [];

  // Empty state
  if (documents.length === 0 && missingRequiredDocs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <File className="h-10 w-10" />
        <p className="font-medium">{emptyMessage}</p>
        {emptyAction}
      </div>
    );
  }

  // Empty documents but has missing required docs — show expandable placeholder rows
  if (documents.length === 0 && missingRequiredDocs.length > 0) {
    return (
      <div>
        {missingRequiredDocs.map(dt => (
          <RequiredDocPlaceholderRow
            key={`required-${dt.documentTypeId}`}
            docType={dt}
            onUpload={onUploadForDocType}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Select All header */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b bg-muted/30">
        {canDrag && <div className="w-5" />}
        <Checkbox
          checked={selectedDocs.size === documents.length && documents.length > 0}
          ref={(el) => {
            if (el) {
              const input = el as unknown as HTMLButtonElement;
              input.dataset.indeterminate = String(selectedDocs.size > 0 && selectedDocs.size < documents.length);
            }
          }}
          className={selectedDocs.size > 0 && selectedDocs.size < documents.length ? "opacity-60" : ""}
          onClick={(e) => {
            e.stopPropagation();
            if (selectedDocs.size === documents.length) {
              updateSelection(new Map());
            } else {
              const all = new Map<number, LibraryDocument>();
              documents.forEach(d => all.set(d.id, d));
              updateSelection(all);
            }
          }}
        />
        <span className="text-xs text-muted-foreground">
          {selectedDocs.size > 0
            ? `${selectedDocs.size} of ${documents.length} selected`
            : `Select all ${documents.length}`
          }
        </span>
      </div>

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
                onRowClick={handleRowClick}
                onDelete={onDelete}
                showVersionBadge={showVersionBadge}
                showExpiryBadge={showExpiryBadge}
                showVerifiedBadge={showVerifiedBadge}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Expandable placeholder rows for missing required docs */}
      {missingRequiredDocs.length > 0 && (
        <div>
          {missingRequiredDocs.map(dt => (
            <RequiredDocPlaceholderRow
              key={`required-${dt.documentTypeId}`}
              docType={dt}
              onUpload={onUploadForDocType}
            />
          ))}
        </div>
      )}

      {/* Floating action bar when documents selected (hidden if parent renders its own) */}
      {!hideFloatingBar && selectedDocs.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 bg-background border rounded-lg shadow-lg">
          <span className="text-sm font-medium">
            {selectedDocs.size} selected
          </span>
          {onEmail && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (showVerifyActions) {
                  const unverified = Array.from(selectedDocs.values()).filter(d => !d.verified);
                  if (unverified.length > 0) {
                    toast({
                      title: "Validation required",
                      description: `${unverified.length} document${unverified.length > 1 ? "s" : ""} must be validated before emailing.`,
                      variant: "destructive",
                    });
                    return;
                  }
                }
                handleEmailSelected();
              }}
            >
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

      {/* Validation Gate Modal — shown when opening an unvalidated document */}
      {validationGateDoc && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setValidationGateDoc(null); }}>
          <DialogContent className="max-w-4xl w-[90vw] h-[90vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-6 py-4 border-b shrink-0">
              <DialogTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-5 w-5 text-amber-500" />
                Review &amp; Validate Document
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Please review this document carefully before validating. Validation is required before this document can be emailed.
              </p>
            </DialogHeader>

            {/* Document name bar */}
            <div className="px-6 py-2 border-b bg-muted/30 shrink-0 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">
                {validationGateDoc.displayName || validationGateDoc.originalFilename}
              </span>
              {validationGateDoc.fileSize > 0 && (
                <Badge variant="outline" className="text-xs shrink-0">
                  {formatFileSize(validationGateDoc.fileSize)}
                </Badge>
              )}
              {validationGateDoc.mimeType && (
                <Badge variant="outline" className="text-xs shrink-0">
                  {validationGateDoc.mimeType.split("/").pop()?.toUpperCase()}
                </Badge>
              )}
            </div>

            {/* Document preview */}
            <div className="flex-1 min-h-0 overflow-auto bg-muted/30">
              {(() => {
                const gateUrl = validationGateDoc.fileUrl
                  || `${getApiBaseUrl()}/api/v1/documents/${validationGateDoc.id}/download?preview=1&token=${encodeURIComponent(getStorageItem<string>(STORAGE_KEYS.TOKEN, "") || "")}`;
                const fileType = getFileType(validationGateDoc.originalFilename || "", validationGateDoc.mimeType);
                if (fileType === "pdf") {
                  return <PDFViewer url={gateUrl} className="h-full" />;
                }
                if (fileType === "image") {
                  return (
                    <div className="flex items-center justify-center h-full p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={gateUrl} alt={validationGateDoc.displayName || "Preview"} className="max-w-full max-h-full object-contain rounded-md" />
                    </div>
                  );
                }
                if (fileType === "eml") {
                  return <DocumentViewer url={gateUrl} fileName={validationGateDoc.originalFilename || ""} />;
                }
                return (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                    <FileText className="h-12 w-12" />
                    <p className="text-sm">Preview not available for this file type</p>
                    <a href={gateUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                      Download to view
                    </a>
                  </div>
                );
              })()}
            </div>

            <DialogFooter className="px-6 py-4 border-t shrink-0 flex-row items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground flex-1">
                By validating, you confirm you have reviewed this document and it is correct.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {validationGateDoc.documentTypeId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.open(`/admin/system/document-types/${validationGateDoc.documentTypeId}`, "_blank");
                    }}
                    title="Edit document type naming & settings"
                  >
                    <FileText className="h-4 w-4 mr-1.5" />
                    Edit Document Type
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setValidationGateDoc(null)}
                >
                  Cancel
                </Button>
                {onVerify && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      const doc = validationGateDoc;
                      setValidationGateDoc(null);
                      onVerify(doc);
                      // Open the normal sheet view after validation
                      setPreviewDoc({ ...doc, verified: true });
                      setIsSheetOpen(true);
                      setShowVersions(false);
                      setVersionHistory([]);
                      if (doc.versionCount > 1) {
                        fetchVersionHistory(doc.id);
                      }
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Validate Document
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Document preview sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right-wide" className="p-0 flex flex-col">
          {previewDoc && (
            <>
              {/* Sheet header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">
                      {previewDoc.displayName || previewDoc.originalFilename}
                    </p>
                    {showVersionBadge && (previewDoc.versionLetter || previewDoc.versionCount > 1) && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-semibold">
                        Rev {previewDoc.versionLetter || previewDoc.versionNumber}
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
                      <Badge
                        className={`text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 ${previewDoc.documentTypeId ? "cursor-pointer hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors" : ""}`}
                        onClick={() => {
                          if (previewDoc.documentTypeId) {
                            window.open(`/admin/system/document-types/${previewDoc.documentTypeId}`, "_blank");
                          }
                        }}
                        title={previewDoc.documentTypeId ? "Click to edit document type settings" : undefined}
                      >
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
                      disabled={showVerifyActions && !previewDoc.verified}
                      title={showVerifyActions && !previewDoc.verified ? "Validate this document before emailing" : undefined}
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
                              Rev {ver.versionLetter || ver.versionNumber}
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
              {showVerifyActions && !previewDoc.verified && (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>This document has not been validated</span>
                  </div>
                  {onVerify && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 shrink-0"
                      onClick={() => onVerify(previewDoc)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Validate Document
                    </Button>
                  )}
                </div>
              )}

              {/* Preview content */}
              <div className="flex-1 min-h-0 overflow-auto bg-muted/30">
                {previewUrl ? (
                  (() => {
                    const fileType = getFileType(previewDoc.originalFilename || "", previewDoc.mimeType);
                    if (fileType === "pdf") {
                      return (
                        <PDFViewer
                          url={previewUrl}
                          className="h-full"
                          markupContext={previewDoc ? {
                            contextType: "warehouse_document",
                            contextId: previewDoc.id,
                          } : undefined}
                        />
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
