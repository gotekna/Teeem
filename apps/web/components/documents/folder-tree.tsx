"use client";

import * as React from "react";
import { ChevronRight, FolderOpen, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface FolderTreeItem {
  id: string;
  name: string;
  path: string;
  documents_count: number;
  children?: FolderTreeItem[];
}

interface FolderTreeProps {
  folders: FolderTreeItem[];
  selectedFolderId: string | null;
  onFolderSelect: (folder: FolderTreeItem) => void;
  expandedFolders?: Set<string>;
  onToggleExpand?: (folderId: string) => void;
}

interface FolderTreeNodeProps {
  folder: FolderTreeItem;
  level: number;
  selectedFolderId: string | null;
  onFolderSelect: (folder: FolderTreeItem) => void;
  expandedFolders: Set<string>;
  onToggleExpand: (folderId: string) => void;
  isLast: boolean;
  parentLines: boolean[];
}

function FolderTreeNode({
  folder,
  level,
  selectedFolderId,
  onFolderSelect,
  expandedFolders,
  onToggleExpand,
  isLast,
  parentLines,
}: FolderTreeNodeProps) {
  const hasChildren = folder.children && folder.children.length > 0;
  const isExpanded = expandedFolders.has(folder.id);
  const isSelected = selectedFolderId === folder.id;

  return (
    <div className="folder-tree-node">
      <button
        onClick={() => {
          onFolderSelect(folder);
          if (hasChildren) {
            onToggleExpand(folder.id);
          }
        }}
        className={cn(
          "w-full flex items-center gap-2 py-1.5 px-2 text-sm transition-colors rounded-sm",
          "hover:bg-secondary/50",
          isSelected && "bg-secondary text-foreground font-medium"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {/* Tree lines for nested items */}
        {level > 0 && (
          <div className="folder-tree-lines absolute left-0" style={{ width: `${level * 16}px` }}>
            {parentLines.map((showLine, idx) => (
              <span
                key={idx}
                className={cn(
                  "folder-tree-line-vertical",
                  !showLine && "invisible"
                )}
                style={{ left: `${(idx + 1) * 16 - 8}px` }}
              />
            ))}
            <span
              className="folder-tree-line-horizontal"
              style={{ left: `${level * 16 - 8}px` }}
            />
            {isLast && (
              <span
                className="folder-tree-line-corner"
                style={{ left: `${level * 16 - 8}px` }}
              />
            )}
          </div>
        )}

        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              isExpanded && "rotate-90"
            )}
          />
        ) : (
          <span className="w-3.5" />
        )}

        {/* Folder icon */}
        {isExpanded || isSelected ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        {/* Folder name */}
        <span className="flex-1 truncate text-left">{folder.name}</span>

        {/* Document count */}
        <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0 h-5 min-w-[24px] justify-center">
          {folder.documents_count}
        </Badge>
      </button>

      {/* Render children if expanded */}
      {hasChildren && isExpanded && (
        <div className="folder-tree-children">
          {folder.children!.map((child, index) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              onFolderSelect={onFolderSelect}
              expandedFolders={expandedFolders}
              onToggleExpand={onToggleExpand}
              isLast={index === folder.children!.length - 1}
              parentLines={[...parentLines, !isLast]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree({
  folders,
  selectedFolderId,
  onFolderSelect,
  expandedFolders: controlledExpandedFolders,
  onToggleExpand: controlledOnToggleExpand,
}: FolderTreeProps) {
  const [internalExpandedFolders, setInternalExpandedFolders] = React.useState<Set<string>>(new Set());

  const expandedFolders = controlledExpandedFolders ?? internalExpandedFolders;
  const onToggleExpand = controlledOnToggleExpand ?? ((folderId: string) => {
    setInternalExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  });

  if (folders.length === 0) {
    return (
      <div className="py-8 text-center">
        <Folder className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No folders yet</p>
      </div>
    );
  }

  return (
    <div className="folder-tree space-y-0.5">
      {folders.map((folder, index) => (
        <FolderTreeNode
          key={folder.id}
          folder={folder}
          level={0}
          selectedFolderId={selectedFolderId}
          onFolderSelect={onFolderSelect}
          expandedFolders={expandedFolders}
          onToggleExpand={onToggleExpand}
          isLast={index === folders.length - 1}
          parentLines={[]}
        />
      ))}
    </div>
  );
}
