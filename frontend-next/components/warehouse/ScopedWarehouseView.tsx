"use client";

/**
 * ScopedWarehouseView - Reusable scoped warehouse sub-tree for any linkable record
 *
 * Shows a folder tree with document counts for a specific Job, Contact, or Corporate Company.
 * Uses the new materialized path API (/api/v1/warehouse_types/scoped_tree) to fetch
 * a sub-tree of folders for the given record.
 *
 * Features:
 * - Folder tree with counts (sub-tree only, no record prefix)
 * - Click folder to expand and list documents
 * - Lazy-loads documents per folder on expand
 * - Document preview with download link
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  Image as ImageIcon,
  FileText,
  Download,
  ExternalLink,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { formatFileSize } from "@/utils/formatters";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ScopedWarehouseViewProps {
  linkableType: "Job" | "Contact" | "CorporateCompany";
  linkableId: number;
  className?: string;
}

interface ScopedTreeNode {
  name: string;
  count: number;
  fullPath: string;
  children?: ScopedTreeNode[];
}

interface ScopedTreeResponse {
  success: boolean;
  data: {
    tree: Record<string, number>;
    prefix: string;
    total: number;
  };
}

interface FolderDocument {
  id: number;
  display_name: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  file_url: string | null;
  created_at: string;
  folder_path: string;
  source_type: string;
}

interface FolderDocumentsResponse {
  success: boolean;
  data: {
    documents: FolderDocument[];
    total: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith("image/")) return ImageIcon;
  if (mimeType?.includes("pdf")) return FileText;
  return File;
}

function buildTreeFromCounts(
  counts: Record<string, number>,
  prefix: string
): ScopedTreeNode[] {
  return Object.entries(counts)
    .filter(([name]) => name && name.length > 0)
    .map(([name, count]) => ({
      name,
      count,
      fullPath: prefix ? `${prefix}/${name}` : name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function ScopedWarehouseView({
  linkableType,
  linkableId,
  className,
}: ScopedWarehouseViewProps) {
  const [tree, setTree] = useState<ScopedTreeNode[]>([]);
  const [prefix, setPrefix] = useState<string>("");
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Expanded folders tracking
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Documents loaded per folder
  const [folderDocs, setFolderDocs] = useState<Record<string, FolderDocument[]>>({});
  const [loadingDocs, setLoadingDocs] = useState<Set<string>>(new Set());

  // ─────────────────────────────────────────────────────
  // Fetch scoped tree
  // ─────────────────────────────────────────────────────

  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get<ScopedTreeResponse>(
        `/api/v1/warehouse_types/scoped_tree?linkable_type=${encodeURIComponent(linkableType)}&linkable_id=${linkableId}`
      );
      if (resp?.success && resp.data) {
        const nodes = buildTreeFromCounts(resp.data.tree, resp.data.prefix);
        setTree(nodes);
        setPrefix(resp.data.prefix);
        setTotalCount(resp.data.total);
      } else {
        setTree([]);
        setTotalCount(0);
      }
    } catch (err) {
      setError("Failed to load warehouse tree");
      console.error("[ScopedWarehouseView] Error fetching tree:", err);
    } finally {
      setLoading(false);
    }
  }, [linkableType, linkableId]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // ─────────────────────────────────────────────────────
  // Fetch documents for a folder path
  // ─────────────────────────────────────────────────────

  const fetchFolderDocuments = useCallback(
    async (folderPath: string) => {
      if (folderDocs[folderPath] || loadingDocs.has(folderPath)) return;

      setLoadingDocs((prev) => new Set(prev).add(folderPath));
      try {
        const resp = await api.get<FolderDocumentsResponse>(
          `/api/v1/documents/warehouse?linkable_type=${encodeURIComponent(linkableType)}&linkable_id=${linkableId}&folder=${encodeURIComponent(folderPath)}&limit=100`
        );
        if (resp?.success && resp.data?.documents) {
          setFolderDocs((prev) => ({
            ...prev,
            [folderPath]: resp.data.documents,
          }));
        }
      } catch (err) {
        console.error("[ScopedWarehouseView] Error fetching docs for:", folderPath, err);
      } finally {
        setLoadingDocs((prev) => {
          const next = new Set(prev);
          next.delete(folderPath);
          return next;
        });
      }
    },
    [linkableType, linkableId, folderDocs, loadingDocs]
  );

  // ─────────────────────────────────────────────────────
  // Toggle folder expand/collapse
  // ─────────────────────────────────────────────────────

  const toggleFolder = useCallback(
    (fullPath: string) => {
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(fullPath)) {
          next.delete(fullPath);
        } else {
          next.add(fullPath);
          fetchFolderDocuments(fullPath);
        }
        return next;
      });
    },
    [fetchFolderDocuments]
  );

  // ─────────────────────────────────────────────────────
  // Filter tree by search
  // ─────────────────────────────────────────────────────

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree;
    const query = searchQuery.toLowerCase();
    return tree.filter((node) => node.name.toLowerCase().includes(query));
  }, [tree, searchQuery]);

  // ─────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
        <span className="ml-2 text-sm text-muted-foreground">Loading warehouse...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchTree}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (totalCount === 0 && tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <Folder className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No warehouse documents yet</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header with search and count */}
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
            {totalCount} document{totalCount !== 1 ? "s" : ""}
          </Badge>
          <Button variant="ghost" size="sm" onClick={fetchTree} className="h-8 w-8 p-0">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Folder tree */}
      <div className="border rounded-lg divide-y">
        {filteredTree.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No folders match your search
          </div>
        ) : (
          filteredTree.map((node) => (
            <FolderNode
              key={node.fullPath}
              node={node}
              depth={0}
              isExpanded={expandedPaths.has(node.fullPath)}
              onToggle={toggleFolder}
              documents={folderDocs[node.fullPath]}
              isLoadingDocs={loadingDocs.has(node.fullPath)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FolderNode - Single folder row with expand/collapse
// ─────────────────────────────────────────────────────────────

interface FolderNodeProps {
  node: ScopedTreeNode;
  depth: number;
  isExpanded: boolean;
  onToggle: (fullPath: string) => void;
  documents?: FolderDocument[];
  isLoadingDocs: boolean;
}

function FolderNode({
  node,
  depth,
  isExpanded,
  onToggle,
  documents,
  isLoadingDocs,
}: FolderNodeProps) {
  const FolderIcon = isExpanded ? FolderOpen : Folder;
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <div>
      {/* Folder row */}
      <button
        onClick={() => onToggle(node.fullPath)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left",
          isExpanded && "bg-muted/30"
        )}
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
      >
        <ChevronIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        <FolderIcon className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
        <span className="truncate font-medium">{node.name}</span>
        <Badge variant="outline" className="ml-auto text-xs shrink-0">
          {node.count}
        </Badge>
      </button>

      {/* Expanded content - documents */}
      {isExpanded && (
        <div className="bg-muted/20">
          {isLoadingDocs ? (
            <div className="flex items-center gap-2 px-3 py-3" style={{ paddingLeft: `${depth * 20 + 44}px` }}>
              <Spinner className="h-3.5 w-3.5" />
              <span className="text-xs text-muted-foreground">Loading documents...</span>
            </div>
          ) : documents && documents.length > 0 ? (
            documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} depth={depth + 1} />
            ))
          ) : (
            <div
              className="px-3 py-2.5 text-xs text-muted-foreground"
              style={{ paddingLeft: `${depth * 20 + 44}px` }}
            >
              No documents in this folder
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DocumentRow - Single document in the expanded folder
// ─────────────────────────────────────────────────────────────

interface DocumentRowProps {
  doc: FolderDocument;
  depth: number;
}

function DocumentRow({ doc, depth }: DocumentRowProps) {
  const FileIcon = getFileIcon(doc.mime_type);

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
      style={{ paddingLeft: `${depth * 20 + 44}px` }}
    >
      <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="truncate flex-1">
        {doc.display_name || doc.file_name}
      </span>
      {doc.file_size > 0 && (
        <span className="text-xs text-muted-foreground shrink-0">
          {formatFileSize(doc.file_size)}
        </span>
      )}
      {doc.file_url && (
        <a
          href={doc.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

export default ScopedWarehouseView;
