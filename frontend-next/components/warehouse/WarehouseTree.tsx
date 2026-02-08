"use client";

/**
 * WarehouseTree - SSoT component for warehouse folder trees.
 *
 * THE ONE component for rendering warehouse folder hierarchies.
 * Used on both the main /warehouse page and entity tabs (Job, Contact, Corporate).
 *
 * The mode prop controls ONLY what data is loaded - the UI is identical.
 * Full mode loads all warehouse types; scoped mode loads one type for one entity.
 *
 * Usage:
 *   // Full mode (main /warehouse page)
 *   <WarehouseTree mode={{ type: "full" }} onFileClick={...} />
 *
 *   // Scoped mode (entity tabs) - same UI, filtered data
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

import React, { useState } from "react";
import { Search, RefreshCw, Folder, ChevronsDownUp, List, LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  /** Hide the toolbar (search, display toggle, refresh). Defaults false. */
  hideToolbar?: boolean;
  /** Show path template text on folders (defaults true) */
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
  hideToolbar = false,
  showPathTemplates = true,
  treeDisplayMode: externalDisplayMode,
  onTreeDisplayModeChange,
  className,
}: WarehouseTreeProps) {
  const tree = useWarehouseTree(mode);
  const [searchQuery, setSearchQuery] = useState("");

  // Use external display mode if provided, otherwise use internal
  const displayMode = externalDisplayMode ?? tree.treeDisplayMode;
  const setDisplayMode = onTreeDisplayModeChange ?? tree.setTreeDisplayMode;

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

  // Empty state
  if (tree.treeData.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 gap-2", className)}>
        <Folder className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No warehouse documents yet</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Toolbar - identical UI regardless of mode */}
      {!hideToolbar && (
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
            {/* Sub-display mode toggle (list/gallery within expanded folders) */}
            <Select
              value={displayMode}
              onValueChange={(v) => setDisplayMode(v as TreeDisplayMode)}
            >
              <SelectTrigger className="w-28 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">
                  <div className="flex items-center gap-2">
                    <List className="h-3 w-3" />
                    List
                  </div>
                </SelectItem>
                <SelectItem value="gallery">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-3 w-3" />
                    Gallery
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Badge variant="secondary" className="text-xs">
              {tree.treeData.length} folder{tree.treeData.length !== 1 ? "s" : ""}
            </Badge>

            {/* Collapse All - shown when any folder is expanded */}
            {tree.expandedFolders.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={tree.collapseAll}
                className="h-8 px-2 text-xs text-muted-foreground"
                title="Collapse all"
              >
                <ChevronsDownUp className="h-3.5 w-3.5 mr-1" />
                Collapse
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={tree.refresh} className="h-8 w-8 p-0">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {searchQuery && filteredTreeData.length === 0 ? (
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
