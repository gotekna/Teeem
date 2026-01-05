"use client";

import * as React from "react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  Archive,
  AlertOctagon,
  Folder,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ExpandChevron } from "@/components/ui/expand-chevron";
import { Spinner } from "@/components/ui/spinner";
import {
  FolderTreeItem,
  FolderType,
  buildFolderHierarchy,
  sortFolders,
  loadExpandedFolders,
  saveExpandedFolders,
} from "@/lib/email-folder-utils";

// Folder type to icon mapping
const FOLDER_TYPE_ICONS: Record<FolderType, React.ElementType> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  trash: Trash2,
  archive: Archive,
  junk: AlertOctagon,
  custom: Folder,
};

export interface FolderTreeProps {
  /** Flat list of folders (will be converted to tree structure) */
  items: Array<{
    id: string;
    name: string;
    type?: string;
    parent_id?: string | null;
    parentId?: string | null;
    child_folder_count?: number;
    childFolderCount?: number;
    unread_count?: number;
    unreadCount?: number;
    total_items?: number;
    totalItems?: number;
    depth?: number;
  }>;
  /** Currently selected folder ID */
  selectedId?: string;
  /** Callback when folder is selected */
  onSelect: (item: FolderTreeItem) => void;
  /** Key for persisting expanded state (e.g., account ID) */
  persistKey?: string;
  /** Wrapper component for each item (e.g., for drag-drop) */
  renderWrapper?: (
    item: FolderTreeItem,
    children: React.ReactNode
  ) => React.ReactNode;
  /** Additional className */
  className?: string;
  /** Show loading state for specific folder IDs */
  loadingFolderIds?: Set<string>;
  /** Default to collapsed (true) or expanded (false) for new folders */
  defaultCollapsed?: boolean;
}

interface TreeNodeProps {
  item: FolderTreeItem;
  children: FolderTreeItem[];
  allItems: FolderTreeItem[];
  level: number;
  selectedId?: string;
  expandedIds: Set<string>;
  onSelect: (item: FolderTreeItem) => void;
  onToggle: (item: FolderTreeItem) => void;
  renderWrapper?: FolderTreeProps["renderWrapper"];
  loadingFolderIds?: Set<string>;
}

/**
 * Recursive tree node component
 */
const TreeNode = memo(function TreeNode({
  item,
  children,
  allItems,
  level,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  renderWrapper,
  loadingFolderIds,
}: TreeNodeProps) {
  const isSelected = selectedId === item.id;
  const isExpanded = expandedIds.has(item.id);
  const hasChildren = children.length > 0;
  const isLoading = loadingFolderIds?.has(item.id);
  const hasUnread = (item.unreadCount ?? 0) > 0;

  // Get icon based on folder type
  const Icon = FOLDER_TYPE_ICONS[item.type] || Folder;
  const DisplayIcon =
    item.type === "custom" && (isExpanded || isSelected) ? FolderOpen : Icon;

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle(item);
    },
    [item, onToggle]
  );

  const handleSelect = useCallback(() => {
    onSelect(item);
  }, [item, onSelect]);

  const content = (
    <div
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      className={cn(
        "flex items-center gap-1 py-1.5 px-2 rounded-sm cursor-pointer transition-colors",
        "hover:bg-muted/50",
        isSelected && "bg-primary/10 text-primary",
        hasUnread && "font-semibold"
      )}
      style={{ paddingLeft: `${level * 16 + 8}px` }}
      onClick={handleSelect}
    >
      {/* Expand/Collapse chevron */}
      {hasChildren ? (
        <div
          className="shrink-0 w-5 h-5 flex items-center justify-center"
          onClick={handleToggle}
        >
          {isLoading ? (
            <Spinner size={14} className="text-muted-foreground" />
          ) : (
            <ExpandChevron expanded={isExpanded} size={14} />
          )}
        </div>
      ) : (
        <span className="w-5 shrink-0" />
      )}

      {/* Folder icon */}
      <DisplayIcon
        className={cn(
          "h-4 w-4 shrink-0",
          isSelected
            ? "text-primary"
            : item.type === "custom"
              ? "text-amber-500 dark:text-amber-400"
              : "text-muted-foreground"
        )}
      />

      {/* Folder name */}
      <span className="flex-1 truncate text-sm">{item.name}</span>

      {/* Unread count badge */}
      {hasUnread && (
        <Badge
          variant="secondary"
          className={cn(
            "text-xs px-1.5 py-0.5 min-w-[20px] text-center shrink-0",
            isSelected && "bg-primary/20"
          )}
        >
          {item.unreadCount}
        </Badge>
      )}
    </div>
  );

  // Wrap with custom wrapper if provided (e.g., for drag-drop)
  const wrappedContent = renderWrapper ? renderWrapper(item, content) : content;

  return (
    <div>
      {wrappedContent}

      {/* Render children if expanded */}
      {isExpanded && hasChildren && (
        <div role="group">
          {children.map((child) => {
            const childChildren = allItems.filter(
              (f) => f.parentId === child.id
            );
            return (
              <TreeNode
                key={child.id}
                item={child}
                children={childChildren}
                allItems={allItems}
                level={level + 1}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onSelect={onSelect}
                onToggle={onToggle}
                renderWrapper={renderWrapper}
                loadingFolderIds={loadingFolderIds}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

/**
 * FolderTree - SSoT component for hierarchical folder display
 *
 * Features:
 * - Individual folder expand/collapse
 * - Persisted expand state via localStorage
 * - Bold text for folders with unread items
 * - Smooth animations
 * - Dark mode compatible
 * - Keyboard accessible
 *
 * Usage:
 * ```tsx
 * <FolderTree
 *   items={folders}
 *   selectedId={selectedFolderId}
 *   onSelect={(folder) => selectFolder(folder.id)}
 *   persistKey={accountId}
 * />
 * ```
 */
export function FolderTree({
  items,
  selectedId,
  onSelect,
  persistKey,
  renderWrapper,
  className,
  loadingFolderIds,
  defaultCollapsed = true,
}: FolderTreeProps) {
  // Build hierarchical structure from flat items
  const folderItems = useMemo(() => {
    const hierarchy = buildFolderHierarchy(items);
    return sortFolders(hierarchy);
  }, [items]);

  // Root folders (no parent)
  const rootFolders = useMemo(() => {
    return folderItems.filter((f) => !f.parentId);
  }, [folderItems]);

  // Expanded state with persistence
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    if (persistKey) {
      return loadExpandedFolders(persistKey);
    }
    // If no persistence and defaultCollapsed is false, expand all folders with children
    if (!defaultCollapsed) {
      const foldersWithChildren = folderItems.filter(
        (f) => (f.childFolderCount ?? 0) > 0
      );
      return new Set(foldersWithChildren.map((f) => f.id));
    }
    return new Set();
  });

  // Load persisted state on mount
  useEffect(() => {
    if (persistKey) {
      const stored = loadExpandedFolders(persistKey);
      if (stored.size > 0) {
        setExpandedIds(stored);
      }
    }
  }, [persistKey]);

  // Save expanded state when it changes
  useEffect(() => {
    if (persistKey) {
      saveExpandedFolders(persistKey, expandedIds);
    }
  }, [persistKey, expandedIds]);

  const handleToggle = useCallback((item: FolderTreeItem) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }, []);

  if (folderItems.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground py-2 px-3", className)}>
        No folders found
      </div>
    );
  }

  return (
    <div role="tree" aria-label="Folder tree" className={className}>
      {rootFolders.map((folder) => {
        const children = folderItems.filter((f) => f.parentId === folder.id);
        return (
          <TreeNode
            key={folder.id}
            item={folder}
            children={children}
            allItems={folderItems}
            level={0}
            selectedId={selectedId}
            expandedIds={expandedIds}
            onSelect={onSelect}
            onToggle={handleToggle}
            renderWrapper={renderWrapper}
            loadingFolderIds={loadingFolderIds}
          />
        );
      })}
    </div>
  );
}

export default FolderTree;
export type { FolderTreeItem };
