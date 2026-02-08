"use client";

/**
 * WarehouseTree - SSoT component for warehouse folder trees.
 *
 * THE ONE component for rendering warehouse folder hierarchies.
 * Replaces both the inline tree in warehouse/page.tsx and
 * the separate ScopedWarehouseView component.
 *
 * Usage:
 *   // Full mode (main /warehouse page)
 *   <WarehouseTree mode={{ type: "full" }} onFileClick={...} />
 *
 *   // Scoped mode (entity tabs)
 *   <WarehouseTree
 *     mode={{
 *       type: "scoped",
 *       linkableType: "Job",
 *       linkableId: 123,
 *       warehouseTypeCode: "job",
 *       recordTokenValues: { JobCode: "J-001", JobName: "Smith" }
 *     }}
 *   />
 */

import React, { useState, useCallback } from "react";
import { Search, RefreshCw, Folder, ChevronsDownUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { useWarehouseTree } from "@/hooks/useWarehouseTree";
import { WarehouseTreeRenderer } from "./WarehouseTreeRenderer";
import type { WarehouseTreeMode, DocumentItem, TreeDisplayMode } from "./types";

export interface WarehouseTreeProps {
  mode: WarehouseTreeMode;
  onFileClick?: (doc: DocumentItem) => void;
  onFileDoubleClick?: (doc: DocumentItem) => void;
  onMailboxClick?: (email: string) => void;
  onMailboxDoubleClick?: (externalLink: string) => void;
  /** Currently selected document (for highlighting in the tree) */
  selectedDocument?: DocumentItem | null;
  /** Show search bar and document count (defaults true for scoped, false for full) */
  showHeader?: boolean;
  /** Show path template text on folders */
  showPathTemplates?: boolean;
  /** External control of tree display mode (list/gallery) */
  treeDisplayMode?: TreeDisplayMode;
  onTreeDisplayModeChange?: (mode: TreeDisplayMode) => void;
  className?: string;
}

export function WarehouseTree({
  mode,
  onFileClick,
  onFileDoubleClick,
  onMailboxClick,
  onMailboxDoubleClick,
  selectedDocument,
  showHeader,
  showPathTemplates = false,
  treeDisplayMode: externalDisplayMode,
  onTreeDisplayModeChange,
  className,
}: WarehouseTreeProps) {
  const tree = useWarehouseTree(mode);
  const [searchQuery, setSearchQuery] = useState("");

  // Use external display mode if provided, otherwise use internal
  const displayMode = externalDisplayMode ?? tree.treeDisplayMode;
  const setDisplayMode = onTreeDisplayModeChange ?? tree.setTreeDisplayMode;

  // Determine whether to show header
  const shouldShowHeader = showHeader ?? (mode.type === "scoped");

  // Filter tree by search query (shallow filter on top-level names)
  const filteredTreeData = searchQuery.trim()
    ? tree.treeData.filter(node =>
        node.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tree.treeData;

  // Loading state
  if (tree.treeLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Spinner className="h-6 w-6" />
        <span className="ml-2 text-sm text-muted-foreground">Loading warehouse...</span>
      </div>
    );
  }

  // Empty state (scoped mode)
  if (mode.type === "scoped" && tree.treeData.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 gap-2", className)}>
        <Folder className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No warehouse documents yet</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {shouldShowHeader && (
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {tree.treeData.length} folder{tree.treeData.length !== 1 ? "s" : ""}
            </Badge>
            <Button variant="ghost" size="sm" onClick={tree.refresh} className="h-8 w-8 p-0">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Collapse All button - shown in full mode when any folder is expanded */}
      {mode.type === "full" && tree.expandedFolders.size > 0 && (
        <div className="flex justify-end">
          <button
            onClick={tree.collapseAll}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
            title="Collapse all"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
            Collapse all
          </button>
        </div>
      )}

      {shouldShowHeader && searchQuery && filteredTreeData.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground border rounded-lg">
          No folders match your search
        </div>
      ) : (
        <WarehouseTreeRenderer
          treeData={filteredTreeData}
          expandedFolders={tree.expandedFolders}
          toggleFolder={tree.toggleFolder}
          treeDisplayMode={displayMode}
          s3Folders={tree.s3Folders}
          loadingS3Folders={tree.loadingS3Folders}
          loadingRecords={tree.loadingRecords}
          warehouseRecords={tree.warehouseRecords}
          fetchRecords={tree.fetchRecords}
          onFileClick={onFileClick}
          onFileDoubleClick={onFileDoubleClick}
          onMailboxClick={onMailboxClick}
          onMailboxDoubleClick={onMailboxDoubleClick}
          selectedDocument={selectedDocument}
          showPathTemplates={showPathTemplates}
        />
      )}
    </div>
  );
}

export default WarehouseTree;
