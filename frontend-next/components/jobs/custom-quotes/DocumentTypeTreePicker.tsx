"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Minus,
  Search,
  X,
} from "lucide-react";
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

/** Collect all folder IDs in a tree (recursively) */
function collectAllFolderIds(nodes: FolderNode[]): number[] {
  const ids: number[] = [];
  for (const node of nodes) {
    if (collectAllDocTypeIds(node).length > 0) {
      ids.push(node.id);
      ids.push(...collectAllFolderIds(node.children));
    }
  }
  return ids;
}

/** Collect all unique doc types {id, name} from tree (deduplicated by id) */
function collectAllDocTypes(nodes: FolderNode[]): DocTypeLeaf[] {
  const map = new Map<number, DocTypeLeaf>();
  function walk(list: FolderNode[]) {
    for (const node of list) {
      for (const dt of node.documentTypes) {
        if (!map.has(dt.id)) map.set(dt.id, dt);
      }
      walk(node.children);
    }
  }
  walk(nodes);
  return Array.from(map.values());
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
function filterByScope(
  nodes: FolderNode[],
  scope: ScopeFilter
): FolderNode[] {
  if (scope === "all") return nodes;
  return nodes.filter((node) => node.warehouseTypeCode === scope);
}

/** Simple visual checkbox - no Radix, no button, no event conflicts */
function VisualCheckbox({
  checked,
  indeterminate,
}: {
  checked: boolean;
  indeterminate?: boolean;
}) {
  return (
    <div
      className={cn(
        "h-3.5 w-3.5 shrink-0 rounded-sm border flex items-center justify-center",
        checked || indeterminate
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background"
      )}
    >
      {checked && <Check className="h-2.5 w-2.5" />}
      {indeterminate && !checked && <Minus className="h-2.5 w-2.5" />}
    </div>
  );
}

interface DocumentTypeTreePickerProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  /** Called with the names of currently selected doc types (for display elsewhere) */
  onSelectedNamesChange?: (names: string[]) => void;
}

/**
 * Multi-select document type picker with collapsible multi-level folder tree.
 * Uses WarehouseFolder hierarchy for full cascading structure.
 * Clicking a folder checkbox selects/deselects all nested document types.
 * Defaults to all folders collapsed.
 */
export function DocumentTypeTreePicker({
  selectedIds,
  onChange,
  onSelectedNamesChange,
}: DocumentTypeTreePickerProps) {
  const [treeData, setTreeData] = useState<FolderNode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [search, setSearch] = useState("");
  // Tracks which folders are expanded (default: all collapsed)
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(
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

  // Local optimistic state for instant UI feedback
  const [localIds, setLocalIds] = useState<number[]>(selectedIds);

  // Sync when parent props change (e.g., after refresh)
  useEffect(() => {
    setLocalIds(selectedIds);
  }, [selectedIds]);

  // Filter by scope then search
  const filteredTree = useMemo(() => {
    const scoped = filterByScope(treeData, scopeFilter);
    return filterTree(scoped, search.trim());
  }, [treeData, scopeFilter, search]);

  const selectedSet = useMemo(() => new Set(localIds), [localIds]);

  // Build a map of all doc types for badge display
  const allDocTypes = useMemo(() => collectAllDocTypes(treeData), [treeData]);
  const selectedDocTypes = useMemo(
    () => allDocTypes.filter((dt) => selectedSet.has(dt.id)),
    [allDocTypes, selectedSet]
  );

  // Report selected names to parent
  useEffect(() => {
    onSelectedNamesChange?.(selectedDocTypes.map((dt) => dt.name));
  }, [selectedDocTypes, onSelectedNamesChange]);

  const toggleItem = useCallback(
    (id: number) => {
      setLocalIds((prev) => {
        const set = new Set(prev);
        const next = set.has(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id];
        onChange(next);
        return next;
      });
    },
    [onChange]
  );

  const toggleFolder = useCallback(
    (node: FolderNode) => {
      const folderIds = collectAllDocTypeIds(node);
      if (folderIds.length === 0) return;
      setLocalIds((prev) => {
        const prevSet = new Set(prev);
        const allSelected = folderIds.every((id) => prevSet.has(id));
        let next: number[];
        if (allSelected) {
          const removeSet = new Set(folderIds);
          next = prev.filter((id) => !removeSet.has(id));
        } else {
          const merged = new Set([...prev, ...folderIds]);
          next = Array.from(merged);
        }
        onChange(next);
        return next;
      });
    },
    [onChange]
  );

  const toggleExpand = useCallback((folderId: number) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = collectAllFolderIds(filteredTree);
    setExpandedFolders(new Set(allIds));
  }, [filteredTree]);

  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set());
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

  // Picker open/closed state - default closed
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!loaded) return null;

  const totalSelected = localIds.length;
  const anyExpanded = expandedFolders.size > 0;

  return (
    <div className="space-y-1.5">
      {/* Collapsed view: clickable summary with badges */}
      <div
        className="flex items-center gap-1.5 cursor-pointer group"
        onClick={() => setPickerOpen(!pickerOpen)}
      >
        {pickerOpen ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <span className="text-[10px] text-muted-foreground group-hover:text-foreground">
          Document Types
        </span>
        {!pickerOpen && totalSelected > 0 && (
          <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
            ({totalSelected})
          </span>
        )}
      </div>

      {/* Collapsed badges - show selected when picker is closed */}
      {!pickerOpen && selectedDocTypes.length > 0 && (
        <div className="flex flex-wrap gap-1 ml-4">
          {selectedDocTypes.map((dt) => (
            <span
              key={dt.id}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary border border-primary/20"
            >
              {dt.name}
              <button
                type="button"
                className="hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); toggleItem(dt.id); }}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Expanded picker */}
      {pickerOpen && (
        <>
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

          {/* Search + expand/collapse */}
          <div className="flex gap-1 items-center">
            <button
              type="button"
              onClick={anyExpanded ? collapseAll : expandAll}
              className={cn(
                "shrink-0 px-2 py-0.5 text-[10px] rounded border transition-colors",
                "text-muted-foreground hover:text-foreground hover:bg-muted border-transparent"
              )}
            >
              {anyExpanded ? (
                <>
                  <ChevronsDownUp className="h-3 w-3 inline mr-0.5" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronsUpDown className="h-3 w-3 inline mr-0.5" />
                  Expand
                </>
              )}
            </button>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search document types..."
                className="h-7 pl-7 text-xs"
              />
            </div>
          </div>

          {/* Selected badges */}
          {selectedDocTypes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedDocTypes.map((dt) => (
                <span
                  key={dt.id}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full bg-primary/10 text-primary border border-primary/20"
                >
                  {dt.name}
                  <button
                    type="button"
                    className="hover:text-destructive"
                    onClick={() => toggleItem(dt.id)}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

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
                expandedFolders={expandedFolders}
                onToggleItem={toggleItem}
                onToggleFolder={toggleFolder}
                onToggleExpand={toggleExpand}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface FolderTreeNodeProps {
  node: FolderNode;
  depth: number;
  selectedSet: Set<number>;
  expandedFolders: Set<number>;
  onToggleItem: (id: number) => void;
  onToggleFolder: (node: FolderNode) => void;
  onToggleExpand: (folderId: number) => void;
}

function FolderTreeNode({
  node,
  depth,
  selectedSet,
  expandedFolders,
  onToggleItem,
  onToggleFolder,
  onToggleExpand,
}: FolderTreeNodeProps) {
  const allIds = useMemo(() => collectAllDocTypeIds(node), [node]);
  const totalCount = allIds.length;

  // Skip folders with no doc types at all (empty branches)
  if (totalCount === 0) return null;

  const allSelected =
    totalCount > 0 && allIds.every((id) => selectedSet.has(id));
  const someSelected =
    !allSelected && allIds.some((id) => selectedSet.has(id));
  const isExpanded = expandedFolders.has(node.id);
  const hasChildren =
    node.children.length > 0 || node.documentTypes.length > 0;
  const paddingLeft = 8 + depth * 16;

  return (
    <div>
      {/* Folder header */}
      <div
        className="flex items-center gap-2 py-1 bg-muted/50 hover:bg-muted cursor-pointer select-none"
        style={{ paddingLeft: `${paddingLeft}px`, paddingRight: "8px" }}
        onClick={() => onToggleFolder(node)}
      >
        <div
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(node.id);
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )
          ) : (
            <span className="w-3" />
          )}
        </div>
        <VisualCheckbox checked={allSelected} indeterminate={someSelected} />
        <span className="text-xs font-medium text-muted-foreground flex-1 text-left">
          {node.name}
        </span>
        <span className="text-[10px] text-muted-foreground">{totalCount}</span>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <>
          {/* Direct document types */}
          {node.documentTypes.map((dt) => (
            <div
              key={dt.id}
              className="flex items-center gap-2 py-1 hover:bg-muted/30 cursor-pointer select-none"
              style={{
                paddingLeft: `${paddingLeft + 24}px`,
                paddingRight: "8px",
              }}
              onClick={() => onToggleItem(dt.id)}
            >
              <VisualCheckbox checked={selectedSet.has(dt.id)} />
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
              expandedFolders={expandedFolders}
              onToggleItem={onToggleItem}
              onToggleFolder={onToggleFolder}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </>
      )}
    </div>
  );
}
