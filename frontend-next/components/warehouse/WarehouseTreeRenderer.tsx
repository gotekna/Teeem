"use client";

/**
 * WarehouseTreeRenderer - SSoT renderer for warehouse tree nodes.
 *
 * Extracted from warehouse/page.tsx renderTreeNode().
 * Handles: loading nodes, load-more pagination, record nodes,
 * file nodes (list + gallery), folder/category nodes, mailbox handling.
 */

import React, { useCallback } from "react";
import {
  ChevronRight,
  Folder,
  File,
  Image as ImageIcon,
  ExternalLink,
  RefreshCw,
  Loader2,
  Mail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/utils/formatters";

import type {
  TreeNode,
  TreeDisplayMode,
  DocumentItem,
  S3FolderData,
  ScopeFolders,
  RecordNode,
  RecordsPagination,
} from "./types";

export interface WarehouseTreeRendererProps {
  treeData: TreeNode[];
  expandedFolders: Set<string>;
  toggleFolder: (
    folderId: string,
    folderPath?: string,
    externalLink?: string,
    sourceType?: string,
    isVirtual?: boolean,
    emailFolderType?: string
  ) => void;
  treeDisplayMode: TreeDisplayMode;
  s3Folders: Record<string, S3FolderData>;
  loadingS3Folders: Set<string>;
  loadingRecords: Set<string>;
  warehouseRecords: Record<string, {
    records: RecordNode[];
    groupingTokens?: string[];
    pagination: RecordsPagination;
  }>;
  fetchRecords: (warehouseTypeCode: string, offset?: number) => void;
  // Callbacks from parent
  onFileClick?: (doc: DocumentItem) => void;
  onFileDoubleClick?: (doc: DocumentItem) => void;
  onMailboxClick?: (email: string) => void;
  onMailboxDoubleClick?: (externalLink: string) => void;
  // Currently selected file (for highlighting)
  selectedDocument?: DocumentItem | null;
  // Optional: scopeFolders for path resolution in full mode
  scopeFolders?: ScopeFolders;
  rootPath?: string;
  // Whether to show path templates on folders
  showPathTemplates?: boolean;
}

export function WarehouseTreeRenderer({
  treeData,
  expandedFolders,
  toggleFolder,
  treeDisplayMode,
  s3Folders,
  loadingS3Folders,
  loadingRecords,
  warehouseRecords,
  fetchRecords,
  onFileClick,
  onFileDoubleClick,
  onMailboxClick,
  onMailboxDoubleClick,
  selectedDocument,
  scopeFolders,
  rootPath,
  showPathTemplates = false,
}: WarehouseTreeRendererProps) {

  const renderTreeNode = useCallback((node: TreeNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedFolders.has(node.id);
    const paddingLeft = depth * 20;

    // Loading state - folder index is being built
    if (node.type === "loading") {
      const progress = node.progress;
      return (
        <div key={node.id} className="p-6 text-center">
          <div className="animate-pulse mb-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
          <p className="text-sm font-medium mb-2">{node.name}</p>
          {progress && (
            <div className="space-y-2 max-w-xs mx-auto">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {progress.processed.toLocaleString()} / {progress.total.toLocaleString()} documents ({progress.percent}%)
                {progress.remaining_seconds && progress.remaining_seconds > 0 && (
                  <> &middot; ~{Math.ceil(progress.remaining_seconds / 60)} min remaining</>
                )}
              </p>
            </div>
          )}
        </div>
      );
    }

    // Load more button - for paginated records
    if (node.type === "load-more") {
      const warehouseTypeCode = node.warehouseTypeCode;
      const isLoadingMore = warehouseTypeCode ? loadingRecords.has(warehouseTypeCode) : false;
      const recordData = warehouseTypeCode ? warehouseRecords[warehouseTypeCode] : null;
      const currentOffset = recordData?.records?.length || 0;

      return (
        <div
          key={node.id}
          className="flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-md cursor-pointer text-primary"
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
          onClick={() => {
            if (warehouseTypeCode && !isLoadingMore) {
              fetchRecords(warehouseTypeCode, currentOffset);
            }
          }}
        >
          {isLoadingMore ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="text-sm">{node.name}</span>
        </div>
      );
    }

    // Record node - shows actual database record (job, contact, etc.)
    if (node.type === "record") {
      const hasChildren = node.children && node.children.length > 0;

      return (
        <div key={node.id}>
          <div
            className={cn(
              "flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-md cursor-pointer",
              isExpanded && "bg-muted/30"
            )}
            style={{ paddingLeft: `${paddingLeft}px` }}
            onClick={() => toggleFolder(node.id, node.fullPath, node.externalLink, node.sourceType, node.isVirtual, node.emailFolderType)}
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform shrink-0",
                isExpanded && "rotate-90",
                !hasChildren && "invisible"
              )}
            />
            {node.icon || <Folder className="h-4 w-4" />}
            <span className="flex-1 truncate font-medium">{node.name}</span>
            {node.recordNode?.subtitle && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                {node.recordNode.subtitle}
              </span>
            )}
          </div>
          {isExpanded && hasChildren && (
            <div>
              {node.children?.map(child => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // File node
    if (node.type === "file") {
      const file = node.file!;

      // Gallery mode for images within tree
      if (treeDisplayMode === "gallery" && file.isImage) {
        const isGallerySelected = selectedDocument?.id === file.id && selectedDocument?.source === file.source;
        return (
          <div
            key={node.id}
            className={cn(
              "relative group cursor-pointer",
              isGallerySelected && "ring-2 ring-primary rounded-lg"
            )}
            onClick={() => onFileClick?.(file)}
            onDoubleClick={() => onFileDoubleClick?.(file)}
          >
            <div className="aspect-square bg-muted rounded-lg overflow-hidden border hover:border-primary transition-colors">
              {file.fileUrl ? (
                <img
                  src={file.fileUrl}
                  alt={file.uiName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <p className="mt-1 text-xs truncate text-center">{file.uiName}</p>
          </div>
        );
      }

      // List mode file
      const isSelected = selectedDocument?.id === file.id && selectedDocument?.source === file.source;
      return (
        <div
          key={node.id}
          className={cn(
            "flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-md group cursor-pointer",
            isSelected && "bg-primary/10 hover:bg-primary/15"
          )}
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
          onClick={() => onFileClick?.(file)}
          onDoubleClick={() => onFileDoubleClick?.(file)}
        >
          {file.isImage ? (
            <ImageIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          ) : (
            <File className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="flex-1 truncate">{node.name}</span>
          {file.storageProvider === "s3_compatible" && (
            <Badge variant="outline" className="text-xs">S3</Badge>
          )}
          {file.fileSize > 0 && (
            <span className="text-xs text-muted-foreground">
              {formatFileSize(file.fileSize)}
            </span>
          )}
          <div className="opacity-0 group-hover:opacity-100">
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </div>
        </div>
      );
    }

    // Folder/category/parent node
    const fileCount = node.fileCount || 0;
    const hasChildren = node.children && node.children.length > 0;

    // Get images for gallery mode
    const getImagesFromNode = (n: TreeNode): DocumentItem[] => {
      if (n.type === "file" && n.file?.isImage) return [n.file];
      if (!n.children) return [];
      return n.children.flatMap(getImagesFromNode);
    };

    const images = treeDisplayMode === "gallery" ? getImagesFromNode(node) : [];

    // Get folder path for S3 lookup
    const getFolderPath = (): string | undefined => {
      const S3_SCOPE_IDS = ["job", "corporate", "contact", "contacts"];
      if (S3_SCOPE_IDS.includes(node.id)) {
        const scopePath = scopeFolders?.[node.id];
        return scopePath || node.name;
      }

      const stripRootPath = (path: string): string => {
        if (!path) return path;
        const normalizedPath = path.replace(/^\/+/, "");
        const normalizedRoot = (rootPath || "").replace(/^\/+/, "").replace(/\/+$/, "");

        if (normalizedRoot && normalizedPath.startsWith(normalizedRoot + "/")) {
          return normalizedPath.slice(normalizedRoot.length + 1);
        }
        if (normalizedRoot && normalizedPath.startsWith(normalizedRoot)) {
          return normalizedPath.slice(normalizedRoot.length).replace(/^\/+/, "");
        }
        return normalizedPath;
      };

      if (node.id.startsWith("s3-folder-")) {
        if (node.fullPath) return stripRootPath(node.fullPath);
      }

      if (node.fullPath) {
        if (node.fullPath.includes("{{")) return node.name;
        return stripRootPath(node.fullPath);
      }
      return scopeFolders?.[node.id] || undefined;
    };

    const folderPath = getFolderPath();
    const cacheKey = node.isVirtual ? node.id : folderPath;
    const isLoading = (cacheKey ? loadingS3Folders.has(cacheKey) : false);
    const s3Data = cacheKey ? s3Folders[cacheKey] : null;
    const hasS3Data = s3Data && (s3Data.folders.length > 0 || s3Data.files.length > 0);
    const s3DataLoaded = cacheKey ? s3Folders[cacheKey] !== undefined : false;

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-2 py-2 px-3 hover:bg-muted/50 cursor-pointer rounded-md",
            node.type === "category" && "font-semibold"
          )}
          style={{ paddingLeft: `${paddingLeft + 12}px` }}
          onClick={() => {
            if (node.isMailbox && node.mailboxEmail) {
              onMailboxClick?.(node.mailboxEmail);
            } else {
              toggleFolder(node.id, folderPath, node.externalLink, node.sourceType, node.isVirtual, node.emailFolderType);
            }
          }}
          onDoubleClick={() => {
            if (node.isMailbox && node.externalLink) {
              onMailboxDoubleClick?.(node.externalLink);
            }
          }}
          title={node.fullPath || undefined}
        >
          {!node.externalLink && !(node.isMailbox && node.mailboxEmail) && (hasChildren || fileCount > 0 || node.isVirtual || node.emailFolderType || node.id.startsWith("s3-folder-") || ["job", "corporate", "contact", "contacts"].includes(node.id)) ? (
            isLoading ? (
              <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
            ) : (
              <ChevronRight
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform shrink-0",
                  isExpanded && "rotate-90"
                )}
              />
            )
          ) : (
            <div className="w-4 shrink-0" />
          )}
          {node.type === "category" && node.icon}
          {node.type !== "category" && (
            <Folder className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
          )}
          <div className="flex-1 min-w-0">
            <span>{node.name}</span>
            {showPathTemplates && node.type === "category" && node.pathTemplate && (
              <span className="ml-2 text-xs font-normal text-muted-foreground font-mono truncate">
                {node.pathTemplate}
              </span>
            )}
          </div>
          {(fileCount > 0 || hasS3Data || node.mailboxCount) && (
            <Badge variant="secondary" className="text-xs">
              {hasS3Data
                ? `${s3Data!.folders.length + s3Data!.files.length} items`
                : node.mailboxCount
                  ? `${fileCount.toLocaleString()} emails • ${node.mailboxCount} ${node.mailboxCount === 1 ? "mailbox" : "mailboxes"}`
                  : `${fileCount} ${fileCount === 1 ? "file" : "files"}`
              }
            </Badge>
          )}
          {node.isMailbox && (
            <div className="flex items-center gap-1" title="Click to open drawer, double-click to open in new window">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <ExternalLink className="h-3 w-3 text-muted-foreground/50" />
            </div>
          )}
          {node.externalLink && !node.isMailbox && (
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {isExpanded && (hasChildren || hasS3Data || s3DataLoaded || isLoading) && (
          <div className={cn(depth > 0 && "border-l border-muted ml-6")}>
            {isLoading ? (
              <div className="py-2 px-3" style={{ paddingLeft: `${paddingLeft + 32}px` }}>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading files...
                </div>
              </div>
            ) : treeDisplayMode === "gallery" && images.length > 0 ? (
              <div className="p-4" style={{ paddingLeft: `${paddingLeft + 32}px` }}>
                <div className="grid grid-cols-6 gap-2 mb-4">
                  {images.slice(0, 12).map(img => {
                    const isImgSelected = selectedDocument?.id === img.id && selectedDocument?.source === img.source;
                    return (
                      <div
                        key={img.id}
                        className={cn(
                          "relative group cursor-pointer",
                          isImgSelected && "ring-2 ring-primary rounded-lg"
                        )}
                        onClick={() => onFileClick?.(img)}
                        onDoubleClick={() => onFileDoubleClick?.(img)}
                      >
                        <div className="aspect-square bg-muted rounded-lg overflow-hidden border hover:border-primary">
                          {img.fileUrl ? (
                            <img
                              src={img.fileUrl}
                              alt={img.uiName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {images.length > 12 && (
                    <div className="aspect-square bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">
                      +{images.length - 12} more
                    </div>
                  )}
                </div>
                {node.children
                  ?.filter(c => c.type === "file" && !c.file?.isImage)
                  .map(child => renderTreeNode(child, depth + 1))}
                {node.children
                  ?.filter(c => c.type !== "file")
                  .map(child => renderTreeNode(child, depth + 1))}
              </div>
            ) : (
              <>
                {node.children?.map(child => renderTreeNode(child, depth + 1))}
                {!hasChildren && !hasS3Data && !isLoading && (
                  <div
                    className="py-2 px-3 text-sm text-muted-foreground"
                    style={{ paddingLeft: `${paddingLeft + 32}px` }}
                  >
                    No files in this folder
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }, [
    expandedFolders, toggleFolder, treeDisplayMode, s3Folders,
    loadingS3Folders, loadingRecords, warehouseRecords, fetchRecords,
    onFileClick, onFileDoubleClick, onMailboxClick, onMailboxDoubleClick,
    selectedDocument, scopeFolders, rootPath, showPathTemplates,
  ]);

  return (
    <div className="space-y-1">
      {treeData.map(node => renderTreeNode(node, 0))}
    </div>
  );
}
