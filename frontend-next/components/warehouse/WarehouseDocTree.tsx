"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  Image as ImageIcon,
  Loader2,
  Mail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/utils/formatters";
import type { DocumentItem, S3FolderEntry, S3FileEntry } from "./types";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface FolderData {
  folders: S3FolderEntry[];
  files: S3FileEntry[];
}

interface WarehouseDocTreeProps {
  onFileClick: (doc: DocumentItem) => void;
  onFileDoubleClick: (doc: DocumentItem) => void;
  onMailboxClick: (mailboxEmail: string) => void;
  onMailboxDoubleClick: (externalLink: string) => void;
  selectedDocument?: DocumentItem | null;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function deriveSourceFromPath(folderPath: string): DocumentItem["source"] {
  const root = folderPath.split("/")[0]?.toLowerCase() ?? "";
  if (root === "jobs" || root === "job") return "job";
  if (root === "corporate") return "corporate";
  if (root === "people" || root === "contacts") return "people";
  if (root === "tasks" || root === "task") return "task";
  return "job"; // fallback
}

function fileToDocumentItem(file: S3FileEntry, folderPath: string): DocumentItem {
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff?)$/i.test(file.name);
  return {
    id: file.warehouse_document_id || file.id || 0,
    source: deriveSourceFromPath(folderPath),
    fileName: file.name,
    uiName: file.name,
    mimeType: file.content_type || "",
    fileSize: file.size || 0,
    fileUrl: file.url || null,
    folderPath,
    storagePath: file.path,
    storageProvider: null,
    createdAt: "",
    isImage,
  };
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function WarehouseDocTree({
  onFileClick,
  onFileDoubleClick,
  onMailboxClick,
  onMailboxDoubleClick,
  selectedDocument,
}: WarehouseDocTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [folderCache, setFolderCache] = useState<Map<string, FolderData>>(new Map());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  // Fetch folder contents from browse_folders endpoint
  const fetchFolder = useCallback(async (path: string) => {
    if (folderCache.has(path)) return;

    setLoadingPaths((prev) => new Set(prev).add(path));
    try {
      const res = await api.get<{ success: boolean; folders: S3FolderEntry[]; files: S3FileEntry[] }>(
        `/api/v1/documents/browse_folders?path=${encodeURIComponent(path)}`
      );
      if (res?.success) {
        setFolderCache((prev) => {
          const next = new Map(prev);
          next.set(path, { folders: res.folders || [], files: res.files || [] });
          return next;
        });
      }
    } catch (err) {
      console.error(`[WarehouseDocTree] Failed to fetch folder: ${path}`, err);
    } finally {
      setLoadingPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  }, [folderCache]);

  // Load root on mount
  useEffect(() => {
    fetchFolder("");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFolder = useCallback(
    (path: string) => {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
          // Fetch if not cached
          if (!folderCache.has(path)) {
            fetchFolder(path);
          }
        }
        return next;
      });
    },
    [folderCache, fetchFolder]
  );

  // ─────────────────────────────────────────────────────────
  // Render a folder row
  // ─────────────────────────────────────────────────────────

  const renderFolder = (folder: S3FolderEntry, depth: number) => {
    const path = folder.path;
    const isExpanded = expandedPaths.has(path);
    const isLoading = loadingPaths.has(path);
    const cached = folderCache.get(path);
    const isMailbox = folder.is_mailbox === true;

    return (
      <div key={path}>
        {/* Folder row */}
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded-md cursor-pointer select-none",
            "group transition-colors"
          )}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => {
            if (isMailbox && folder.mailbox_email) {
              onMailboxClick(folder.mailbox_email);
            } else {
              toggleFolder(path);
            }
          }}
          onDoubleClick={() => {
            if (isMailbox && folder.external_link) {
              onMailboxDoubleClick(folder.external_link);
            }
          }}
        >
          {/* Chevron */}
          {isMailbox ? (
            <Mail className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
          ) : isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
          ) : isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}

          {/* Folder icon */}
          {!isMailbox && (
            isExpanded ? (
              <FolderOpen className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
            )
          )}

          {/* Name */}
          <span className="flex-1 truncate text-sm">{folder.name}</span>

          {/* Count badge */}
          {folder.count != null && folder.count > 0 && (
            <Badge variant="secondary" className="text-xs shrink-0 font-normal">
              {folder.count.toLocaleString()}
            </Badge>
          )}

          {/* Mailbox count */}
          {folder.mailbox_count != null && folder.mailbox_count > 0 && (
            <Badge variant="outline" className="text-xs shrink-0 font-normal">
              {folder.mailbox_count} {folder.mailbox_count === 1 ? "mailbox" : "mailboxes"}
            </Badge>
          )}
        </div>

        {/* Children (when expanded) */}
        {isExpanded && cached && (
          <>
            {cached.folders.map((child) => renderFolder(child, depth + 1))}
            {cached.files.map((file) => renderFile(file, path, depth + 1))}
            {cached.folders.length === 0 && cached.files.length === 0 && !isLoading && (
              <div
                className="text-xs text-muted-foreground italic py-1"
                style={{ paddingLeft: `${(depth + 1) * 20 + 20}px` }}
              >
                Empty folder
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────
  // Render a file row
  // ─────────────────────────────────────────────────────────

  const renderFile = (file: S3FileEntry, folderPath: string, depth: number) => {
    const doc = fileToDocumentItem(file, folderPath);
    const isSelected =
      selectedDocument?.id === doc.id &&
      selectedDocument?.storagePath === doc.storagePath;
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff?)$/i.test(file.name);

    return (
      <div
        key={file.path || `${folderPath}/${file.name}`}
        className={cn(
          "flex items-center gap-2 py-1 px-2 hover:bg-muted/50 rounded-md cursor-pointer group",
          isSelected && "bg-primary/10 hover:bg-primary/15"
        )}
        style={{ paddingLeft: `${depth * 20 + 20}px` }}
        onClick={() => onFileClick(doc)}
        onDoubleClick={() => onFileDoubleClick(doc)}
      >
        {isImage ? (
          <ImageIcon className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0" />
        ) : (
          <File className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="flex-1 truncate text-sm">{file.name}</span>
        {file.size > 0 && (
          <span className="text-xs text-muted-foreground shrink-0">
            {formatFileSize(file.size)}
          </span>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────
  // Root render
  // ─────────────────────────────────────────────────────────

  const rootData = folderCache.get("");
  const isRootLoading = loadingPaths.has("");

  if (isRootLoading && !rootData) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading warehouse tree...</span>
      </div>
    );
  }

  if (!rootData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No documents found
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {rootData.folders.map((folder) => renderFolder(folder, 0))}
      {rootData.files.map((file) => renderFile(file, "", 0))}
    </div>
  );
}
