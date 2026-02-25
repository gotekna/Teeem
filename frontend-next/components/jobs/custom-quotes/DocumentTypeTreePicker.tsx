"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

interface DocTypeLeaf {
  id: number;
  name: string;
}

interface FolderNode {
  id: number;
  name: string;
  warehouseTypeCode: string;
  documentTypes: DocTypeLeaf[];
  children: FolderNode[];
}

type ScopeFilter = "all" | "job" | "corporate" | "contact" | "library";

const SCOPE_TABS: { key: ScopeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "corporate", label: "Corporate" },
  { key: "job", label: "Job" },
  { key: "contact", label: "Contact" },
  { key: "library", label: "Library" },
];

/** Collect all document type IDs under a folder node (recursively) */
function collectAllDocTypeIds(node: FolderNode): number[] {
  const ids = node.documentTypes.map((dt) => dt.id);
  for (const child of node.children) {
    ids.push(...collectAllDocTypeIds(child));
  }
  return ids;
}

/** Count total doc types in a tree (recursively) */
function countDocTypes(nodes: FolderNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += node.documentTypes.length;
    count += countDocTypes(node.children);
  }
  return count;
}

/** Filter tree by search term - returns nodes that match (or have matching descendants) */
function filterTree(nodes: FolderNode[], query: string): FolderNode[] {
  if (!query) return nodes;
  const q = query.toLowerCase();
  return nodes
    .map((node) => {
      const matchingDts = node.documentTypes.filter((dt) =>
        dt.name.toLowerCase().includes(q)
      );
      const matchingChildren = filterTree(node.children, query);
      const folderMatches = node.name.toLowerCase().includes(q);

      if (folderMatches) {
        // If folder name matches, show all its doc types and children
        return node;
      }
      if (matchingDts.length > 0 || matchingChildren.length > 0) {
        return {
          ...node,
          documentTypes: matchingDts,
          children: matchingChildren,
        };
      }
      return null;
    })
    .filter(Boolean) as FolderNode[];
}

/** Filter tree by scope (warehouse type code) */
function filterByScope(nodes: FolderNode[], scope: ScopeFilter): FolderNode[] {
  if (scope === "all") return nodes;
  return nodes.filter((node) => node.warehouseTypeCode === scope);
}

interface DocumentTypeTreePickerProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

/**
 * Multi-select document type picker with collapsible multi-level folder tree.
 * Uses WarehouseFolder hierarchy for full cascading structure.
 * Clicking a folder checkbox selects/deselects all nested document types.
 */
export function DocumentTypeTreePicker({
  selectedIds,
  onChange,
}: DocumentTypeTreePickerProps) {
  const [treeData, setTreeData] = useState<FolderNode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [search, setSearch] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<number>>(
    new Set()
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ success: boolean; data: FolderNode[] }>(
          "/api/v1/document_types/tree"
        );
        if (!cancelled) {
          setTreeData(res?.data || []);
          setLoaded(true);
        }
      } catch (err) {
        console.error("[DocumentTypeTreePicker] fetch error:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter by scope then search
  const filteredTree = useMemo(() => {
    const scoped = filterByScope(treeData, scopeFilter);
    return filterTree(scoped, search.trim());
  }, [treeData, scopeFilter, search]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleItem = useCallback(
    (id: number) => {
      const next = selectedSet.has(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
      onChange(next);
    },
    [selectedIds, selectedSet, onChange]
  );

  const toggleFolder = useCallback(
    (node: FolderNode) => {
      const folderIds = collectAllDocTypeIds(node);
      if (folderIds.length === 0) return;
      const allSelected = folderIds.every((id) => selectedSet.has(id));
      if (allSelected) {
        const removeSet = new Set(folderIds);
        onChange(selectedIds.filter((id) => !removeSet.has(id)));
      } else {
        const merged = new Set([...selectedIds, ...folderIds]);
        onChange(Array.from(merged));
      }
    },
    [selectedIds, selectedSet, onChange]
  );

  const toggleFolderCollapse = useCallback((folderId: number) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  // Scope counts
  const scopeCounts = useMemo(() => {
    const counts: Record<ScopeFilter, number> = {
      all: countDocTypes(treeData),
      job: countDocTypes(filterByScope(treeData, "job")),
      corporate: countDocTypes(filterByScope(treeData, "corporate")),
      contact: countDocTypes(filterByScope(treeData, "contact")),
      library: countDocTypes(filterByScope(treeData, "library")),
    };
    return counts;
  }, [treeData]);

  if (!loaded) return null;

  const totalSelected = selectedIds.length;

  return (
    <div className="space-y-1.5">
      {/* Scope tabs */}
      <div className="flex gap-1 flex-wrap items-center">
        {SCOPE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setScopeFilter(tab.key)}
            className={cn(
              "px-2 py-0.5 text-[10px] rounded border transition-colors",
              scopeFilter === tab.key
                ? "bg-primary text-primary-foreground font-medium border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
            )}
          >
            {tab.label}
            <span className="ml-1 text-[10px] opacity-70">
              {scopeCounts[tab.key]}
            </span>
          </button>
        ))}
        {totalSelected > 0 && (
          <span className="px-2 py-0.5 text-[10px] text-green-600 dark:text-green-400 font-medium">
            {totalSelected} selected
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search document types..."
          className="h-7 pl-7 text-xs"
        />
      </div>

      {/* Tree */}
      <div className="border rounded max-h-48 overflow-y-auto">
        {filteredTree.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">
            No document types found
          </div>
        )}
        {filteredTree.map((node) => (
          <FolderTreeNode
            key={node.id}
            node={node}
            depth={0}
            selectedSet={selectedSet}
            collapsedFolders={collapsedFolders}
            onToggleItem={toggleItem}
            onToggleFolder={toggleFolder}
            onToggleCollapse={toggleFolderCollapse}
          />
        ))}
      </div>
    </div>
  );
}

interface FolderTreeNodeProps {
  node: FolderNode;
  depth: number;
  selectedSet: Set<number>;
  collapsedFolders: Set<number>;
  onToggleItem: (id: number) => void;
  onToggleFolder: (node: FolderNode) => void;
  onToggleCollapse: (folderId: number) => void;
}

function FolderTreeNode({
  node,
  depth,
  selectedSet,
  collapsedFolders,
  onToggleItem,
  onToggleFolder,
  onToggleCollapse,
}: FolderTreeNodeProps) {
  const allIds = useMemo(() => collectAllDocTypeIds(node), [node]);
  const totalCount = allIds.length;

  // Skip folders with no doc types at all (empty branches)
  if (totalCount === 0) return null;

  const allSelected = totalCount > 0 && allIds.every((id) => selectedSet.has(id));
  const someSelected = !allSelected && allIds.some((id) => selectedSet.has(id));
  const isCollapsed = collapsedFolders.has(node.id);
  const hasChildren = node.children.length > 0 || node.documentTypes.length > 0;
  const paddingLeft = 8 + depth * 16; // px

  return (
    <div>
      {/* Folder header */}
      <div
        className="flex items-center gap-2 py-1 bg-muted/50 hover:bg-muted"
        style={{ paddingLeft: `${paddingLeft}px`, paddingRight: "8px" }}
      >
        <button
          type="button"
          onClick={() => onToggleCollapse(node.id)}
          className="shrink-0"
        >
          {hasChildren ? (
            isCollapsed ? (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            )
          ) : (
            <span className="w-3" />
          )}
        </button>
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={() => onToggleFolder(node)}
          className="h-3.5 w-3.5"
        />
        <button
          type="button"
          onClick={() => onToggleFolder(node)}
          className="text-xs font-medium text-muted-foreground flex-1 text-left"
        >
          {node.name}
        </button>
        <span className="text-[10px] text-muted-foreground">{totalCount}</span>
      </div>

      {/* Expanded content */}
      {!isCollapsed && (
        <>
          {/* Direct document types */}
          {node.documentTypes.map((dt) => (
            <div
              key={dt.id}
              className="flex items-center gap-2 py-1 hover:bg-muted/30 cursor-pointer"
              style={{
                paddingLeft: `${paddingLeft + 24}px`,
                paddingRight: "8px",
              }}
              onClick={() => onToggleItem(dt.id)}
            >
              <Checkbox
                checked={selectedSet.has(dt.id)}
                className="h-3.5 w-3.5 pointer-events-none"
              />
              <span className="text-xs">{dt.name}</span>
            </div>
          ))}

          {/* Child folders (recursive) */}
          {node.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedSet={selectedSet}
              collapsedFolders={collapsedFolders}
              onToggleItem={onToggleItem}
              onToggleFolder={onToggleFolder}
              onToggleCollapse={onToggleCollapse}
            />
          ))}
        </>
      )}
    </div>
  );
}
