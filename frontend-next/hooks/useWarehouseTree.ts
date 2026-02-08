"use client";

/**
 * useWarehouseTree - SSoT hook for warehouse tree state and data fetching.
 *
 * Supports two modes:
 * - "full": Main /warehouse page - shows all warehouse types, records, folders
 * - "scoped": Entity tabs (Job/Contact/Corporate) - shows folders for a single record
 *
 * Extracted from warehouse/page.tsx to eliminate SSoT violation between
 * the main page and ScopedWarehouseView.
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getIconComponent, resolvePathTokens, SCOPE_ICONS } from "@/components/warehouse/warehouse-utils";
import { Folder } from "lucide-react";
import React from "react";

import type {
  WarehouseTreeMode,
  TreeNode,
  TreeDisplayMode,
  DocumentItem,
  WarehouseTypeTreeNode,
  WarehouseFolderTreeNode2,
  WarehouseFolderChildNode,
  RecordNode,
  RecordsPagination,
  S3FolderData,
  ScopeFolders,
} from "@/components/warehouse/types";

export interface UseWarehouseTreeReturn {
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
  collapseAll: () => void;
  treeDisplayMode: TreeDisplayMode;
  setTreeDisplayMode: (mode: TreeDisplayMode) => void;
  s3Folders: Record<string, S3FolderData>;
  loadingS3Folders: Set<string>;
  loadingRecords: Set<string>;
  warehouseRecords: Record<string, {
    records: RecordNode[];
    groupingTokens?: string[];
    pagination: RecordsPagination;
  }>;
  treeLoading: boolean;
  refresh: () => void;
  fetchRecords: (warehouseTypeCode: string, offset?: number) => void;
}

export function useWarehouseTree(mode: WarehouseTreeMode): UseWarehouseTreeReturn {
  const router = useRouter();

  // ─── Shared state ───────────────────────────────────────────────
  const [treeDisplayMode, setTreeDisplayMode] = useState<TreeDisplayMode>("list");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set<string>()
  );

  // SSoT: Warehouse types tree from database (Feb 2026)
  const [warehouseTypesTree, setWarehouseTypesTree] = useState<WarehouseTypeTreeNode[]>([]);
  const [warehouseTreeLoading, setWarehouseTreeLoading] = useState(true);

  // Records per warehouse type - loaded on demand when expanding
  const [warehouseRecords, setWarehouseRecords] = useState<Record<string, {
    records: RecordNode[];
    groupingTokens?: string[];
    pagination: RecordsPagination;
  }>>({});
  const [loadingRecords, setLoadingRecords] = useState<Set<string>>(new Set());

  // S3 folder contents - loaded lazily when expanding folders
  const [s3Folders, setS3Folders] = useState<Record<string, S3FolderData>>({});
  const [loadingS3Folders, setLoadingS3Folders] = useState<Set<string>>(new Set());

  // SSoT: Scope folder names from WarehouseProvider
  const [scopeFolders, setScopeFolders] = useState<ScopeFolders>({});
  const [scopeTemplates, setScopeTemplates] = useState<Record<string, string>>({});
  const [rootPath, setRootPath] = useState<string>("");
  const [virtualScopes, setVirtualScopes] = useState<Record<string, boolean>>({});

  // ─── Fetch storage config ──────────────────────────────────────
  useEffect(() => {
    const fetchStorageConfig = async () => {
      try {
        const response = await api.get<{
          success: boolean;
          data: {
            scope_folders?: ScopeFolders;
            scope_templates?: Record<string, string>;
            root_path?: string;
            virtual_warehouses?: Record<string, boolean>;
          };
        }>("/api/v1/warehouse_provider");
        if (response?.success && response.data) {
          if (response.data.scope_folders) setScopeFolders(response.data.scope_folders);
          if (response.data.scope_templates) setScopeTemplates(response.data.scope_templates);
          if (response.data.root_path) setRootPath(response.data.root_path);
          if (response.data.virtual_warehouses) setVirtualScopes(response.data.virtual_warehouses);
        }
      } catch (err) {
        console.error("Failed to fetch storage config:", err);
      }
    };
    fetchStorageConfig();
  }, []);

  // ─── Fetch warehouse types tree ────────────────────────────────
  const fetchWarehouseTypesTree = useCallback(async () => {
    setWarehouseTreeLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        data: {
          tree: WarehouseTypeTreeNode[];
          counts: Record<string, number>;
          total: number;
        };
      }>("/api/v1/warehouse_types/tree");

      if (response?.success && response.data) {
        setWarehouseTypesTree(response.data.tree);
      }
    } catch (err) {
      console.error("Failed to fetch warehouse types tree:", err);
    } finally {
      setWarehouseTreeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWarehouseTypesTree();
  }, [fetchWarehouseTypesTree]);

  // ─── Fetch records for a warehouse type ────────────────────────
  const fetchRecords = useCallback(async (warehouseTypeCode: string, offset = 0) => {
    if (loadingRecords.has(warehouseTypeCode) && offset === 0) return;
    if (offset === 0 && warehouseRecords[warehouseTypeCode]) return;

    setLoadingRecords(prev => new Set(prev).add(warehouseTypeCode));
    try {
      const response = await api.get<{
        success: boolean;
        data: {
          records: RecordNode[];
          groupingTokens?: string[];
          pagination: RecordsPagination;
        };
      }>(`/api/v1/warehouse_types/${warehouseTypeCode}/records`, {
        params: { limit: 50, offset }
      });

      if (response?.success && response.data) {
        setWarehouseRecords(prev => ({
          ...prev,
          [warehouseTypeCode]: {
            records: offset === 0
              ? response.data.records
              : [...(prev[warehouseTypeCode]?.records || []), ...response.data.records],
            groupingTokens: response.data.groupingTokens || prev[warehouseTypeCode]?.groupingTokens,
            pagination: response.data.pagination
          }
        }));
      }
    } catch (err) {
      console.error(`Failed to fetch records for ${warehouseTypeCode}:`, err);
      if (offset === 0) {
        setWarehouseRecords(prev => ({
          ...prev,
          [warehouseTypeCode]: { records: [], pagination: { total: 0, limit: 50, offset: 0, has_more: false } }
        }));
      }
    } finally {
      setLoadingRecords(prev => {
        const next = new Set(prev);
        next.delete(warehouseTypeCode);
        return next;
      });
    }
  }, [loadingRecords, warehouseRecords]);

  // Fetch records for initially-expanded warehouse types on mount (full mode only)
  useEffect(() => {
    if (mode.type !== "full") return;
    if (!warehouseTreeLoading && warehouseTypesTree.length > 0) {
      const initiallyExpandedTypes = Array.from(expandedFolders)
        .filter(id => id.startsWith("wt-"))
        .map(id => id.replace("wt-", ""))
        .filter(code => code !== "email");

      initiallyExpandedTypes.forEach(code => {
        if (!warehouseRecords[code]) {
          fetchRecords(code);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouseTreeLoading, warehouseTypesTree.length]);

  // ─── Scope-from-path helper ────────────────────────────────────
  const getScopeFromPath = useCallback((path: string): string | null => {
    if (!path) return null;
    const firstSegment = path.split("/")[0];
    const matchingKeys: string[] = [];
    for (const [scopeKey, scopePath] of Object.entries(scopeFolders)) {
      if (scopePath && (scopePath === firstSegment || scopePath.startsWith(firstSegment + "/"))) {
        matchingKeys.push(scopeKey);
      }
    }
    if (matchingKeys.length === 0) return null;
    return matchingKeys.sort((a, b) => {
      const aSimple = !a.includes("-") && !a.includes("_");
      const bSimple = !b.includes("-") && !b.includes("_");
      if (aSimple !== bSimple) return aSimple ? -1 : 1;
      return a.length - b.length;
    })[0];
  }, [scopeFolders]);

  // ─── Fetch S3 folders ──────────────────────────────────────────
  const fetchS3Folders = useCallback(async (path: string, forceRefresh = false) => {
    const existingData = s3Folders[path];
    if (!forceRefresh && existingData && !existingData.loading) return;
    if (loadingS3Folders.has(path)) return;

    setLoadingS3Folders(prev => new Set(prev).add(path));
    try {
      const scope = getScopeFromPath(path);
      const isVirtual = scope && virtualScopes[scope];

      if (isVirtual && scope) {
        const scopeRootFolder = scopeFolders[scope] || "";
        const relativePath = path.startsWith(scopeRootFolder + "/")
          ? path.slice(scopeRootFolder.length + 1)
          : path === scopeRootFolder ? "" : path;

        const response = await api.get<{
          success: boolean;
          path: string;
          scope: string;
          template?: string;
          folders: Array<{ name: string; path: string; count: number; [key: string]: unknown }>;
          files: Array<{
            id: number;
            uiName: string;
            originalFilename?: string;
            type: string;
            mimeType: string;
            fileSize?: number;
            createdAt?: string;
            receivedAt?: string;
            fileUrl?: string | null;
            [key: string]: unknown;
          }>;
          count: { folders: number; files: number; total: number };
        }>(`/api/v1/documents/live_folder_tree?scope=${encodeURIComponent(scope)}&path=${encodeURIComponent(relativePath)}`);

        if (response?.success) {
          setS3Folders(prev => ({
            ...prev,
            [path]: {
              folders: (response.folders || []).map(f => ({
                name: f.name,
                path: scopeRootFolder ? `${scopeRootFolder}/${f.path}` : f.path,
                count: f.count,
              })),
              files: (response.files || []).map(f => ({
                name: f.uiName || f.originalFilename || "Unknown",
                path: relativePath ? `${scopeRootFolder}/${relativePath}/${f.uiName || f.originalFilename}` : `${scopeRootFolder}/${f.uiName || f.originalFilename}`,
                size: f.fileSize || 0,
                content_type: f.mimeType || "application/octet-stream",
                url: f.fileUrl ?? undefined,
                id: f.id,
                type: f.type,
              })),
            },
          }));
        }
      } else {
        const response = await api.get<{
          success: boolean;
          loading?: boolean;
          message?: string;
          progress?: { processed: number; total: number; percent: number; remaining_seconds?: number };
          path: string;
          folders: Array<{ name: string; path: string }>;
          files: Array<{ name: string; path: string; size: number; content_type: string; last_modified?: string; url?: string; id?: number; warehouse_document_id?: number }>;
          count: { folders: number; files: number; total: number };
        }>(`/api/v1/documents/s3_folders?path=${encodeURIComponent(path)}`);

        if (response?.success) {
          if (response.loading) {
            setS3Folders(prev => ({
              ...prev,
              [path]: {
                folders: [],
                files: [],
                loading: true,
                message: response.message,
                progress: response.progress,
              },
            }));
            setTimeout(() => {
              setLoadingS3Folders(prev => {
                const next = new Set(prev);
                next.delete(path);
                return next;
              });
              fetchS3Folders(path, true);
            }, 2000);
            return;
          }
          setS3Folders(prev => ({
            ...prev,
            [path]: {
              folders: response.folders || [],
              files: response.files || [],
            },
          }));
        }
      }
    } catch (err) {
      console.error(`Failed to fetch folders for ${path}:`, err);
      setS3Folders(prev => ({
        ...prev,
        [path]: { folders: [], files: [] },
      }));
    } finally {
      setLoadingS3Folders(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  }, [s3Folders, loadingS3Folders, getScopeFromPath, virtualScopes, scopeFolders]);

  // ─── Fetch virtual folder files ────────────────────────────────
  const fetchVirtualFolderFiles = useCallback(async (sourceType: string, folderName: string, scopeKey: string) => {
    if (s3Folders[scopeKey] || loadingS3Folders.has(scopeKey)) return;

    setLoadingS3Folders(prev => new Set(prev).add(scopeKey));
    try {
      const response = await api.get<{
        success: boolean;
        documents: Array<{
          id: number;
          displayName: string;
          sendName: string;
          originalFilename: string;
          folder: string;
          fileSize: number;
          mimeType: string;
          source: string;
          createdAt: string;
          fileUrl?: string;
          storagePath?: string;
        }>;
        folders: Array<{ name: string; count: number }>;
        pagination: { total: number; limit: number; offset: number; has_more: boolean };
      }>(`/api/v1/documents/warehouse?source_type=${encodeURIComponent(sourceType)}&folder=${encodeURIComponent(folderName)}&limit=500`);

      if (response?.success) {
        const files = (response.documents || []).map(doc => ({
          name: doc.displayName || doc.sendName || doc.originalFilename,
          path: `${sourceType}/${doc.folder || ""}/${doc.displayName}`.replace(/\/+/g, "/"),
          size: doc.fileSize || 0,
          content_type: doc.mimeType || "application/octet-stream",
          url: doc.fileUrl,
          id: doc.id,
          warehouse_document_id: doc.id,
        }));
        const folders = (response.folders || []).map(f => ({
          name: f.name,
          path: `${sourceType}/${folderName}/${f.name}`.replace(/\/+/g, "/"),
          count: f.count,
        }));
        setS3Folders(prev => ({ ...prev, [scopeKey]: { folders, files } }));
      }
    } catch (err) {
      console.error(`Failed to fetch virtual folder files for ${sourceType}/${folderName}:`, err);
      setS3Folders(prev => ({ ...prev, [scopeKey]: { folders: [], files: [] } }));
    } finally {
      setLoadingS3Folders(prev => {
        const next = new Set(prev);
        next.delete(scopeKey);
        return next;
      });
    }
  }, [s3Folders, loadingS3Folders]);

  // ─── Fetch email drill-down ────────────────────────────────────
  const fetchEmailDrillDown = useCallback(async (folderType: string, path: string, scopeKey: string) => {
    if (s3Folders[scopeKey] || loadingS3Folders.has(scopeKey)) return;

    setLoadingS3Folders(prev => new Set(prev).add(scopeKey));
    try {
      const params = new URLSearchParams({ scope: "email", folder_type: folderType });
      if (path) params.set("path", path);

      const response = await api.get<{
        success: boolean;
        folders: Array<{ name: string; path: string; count: number; is_mailbox?: boolean; mailbox_email?: string; external_link?: string }>;
        files: Array<{ id: number; name: string; type?: string; mimeType?: string; fileSize?: number; fileUrl?: string; displayName?: string; receivedAt?: string; from?: string; fromName?: string }>;
      }>(`/api/v1/documents/live_folder_tree?${params}`);

      if (response?.success) {
        setS3Folders(prev => ({
          ...prev,
          [scopeKey]: {
            folders: (response.folders || []).map(f => ({
              name: f.name,
              path: f.path || "",
              count: f.count || 0,
              is_mailbox: f.is_mailbox || false,
              mailbox_email: f.mailbox_email,
              external_link: f.external_link,
              email_folder_type: folderType,
            })),
            files: (response.files || []).map(f => ({
              name: f.displayName || f.name || "(Unknown)",
              path: "",
              size: f.fileSize || 0,
              content_type: f.mimeType || "application/octet-stream",
              url: f.fileUrl,
              id: f.id,
            }))
          }
        }));
      }
    } catch (err) {
      console.error(`Failed to fetch email folder tree for ${folderType}/${path}:`, err);
      setS3Folders(prev => ({ ...prev, [scopeKey]: { folders: [], files: [] } }));
    } finally {
      setLoadingS3Folders(prev => {
        const next = new Set(prev);
        next.delete(scopeKey);
        return next;
      });
    }
  }, [s3Folders, loadingS3Folders]);

  // ─── Derive email folder type ──────────────────────────────────
  const deriveEmailFolderType = useCallback((folderPath?: string): string => {
    const lastSegment = (folderPath || "").split("/").pop()?.toLowerCase() || "";
    if (lastSegment.includes("mailbox")) return "mailbox";
    if (lastSegment.includes("attachment")) return "attachments";
    return "body";
  }, []);

  // ─── Toggle folder expansion ───────────────────────────────────
  const toggleFolder = useCallback((
    folderId: string,
    folderPath?: string,
    externalLink?: string,
    sourceType?: string,
    isVirtual?: boolean,
    emailFolderType?: string
  ) => {
    if (externalLink) {
      router.push(externalLink);
      return;
    }

    const wasExpanded = expandedFolders.has(folderId);

    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });

    if (!wasExpanded) {
      if (folderId.startsWith("wt-")) {
        const warehouseTypeCode = folderId.replace("wt-", "");
        if (warehouseTypeCode !== "email") {
          fetchRecords(warehouseTypeCode);
        }
      } else if (sourceType === "email" && (isVirtual || emailFolderType)) {
        const folderType = emailFolderType || deriveEmailFolderType(folderPath);
        const drillPath = isVirtual ? "" : (folderPath || "");
        const cacheKey = isVirtual ? folderId : (folderPath || folderId);
        fetchEmailDrillDown(folderType, drillPath, cacheKey);
      } else if (isVirtual && sourceType) {
        const folderName = folderPath || "";
        fetchVirtualFolderFiles(sourceType, folderName, folderId);
      } else if (folderPath) {
        fetchS3Folders(folderPath);
      }
    }
  }, [expandedFolders, fetchS3Folders, fetchVirtualFolderFiles, fetchEmailDrillDown, fetchRecords, deriveEmailFolderType, router]);

  // ─── Build tree data ───────────────────────────────────────────
  const treeData = useMemo((): TreeNode[] => {
    // Build S3 file nodes for a folder path
    const buildS3FileNodes = (folderPath: string | null): TreeNode[] => {
      if (!folderPath) return [];
      const s3Data = s3Folders[folderPath];
      if (!s3Data?.files) return [];

      return s3Data.files.map(file => ({
        id: `s3-file-${(file.path || "").replace(/\//g, "-")}`,
        name: file.name,
        type: "file" as const,
        file: {
          id: file.id || file.warehouse_document_id || 0,
          source: "corporate" as const,
          fileName: file.name,
          uiName: file.name,
          mimeType: file.content_type || "",
          fileSize: file.size || 0,
          fileUrl: file.url || null,
          folderPath: file.path,
          storagePath: file.path,
          storageProvider: "s3_compatible",
          createdAt: new Date().toISOString(),
          isImage: /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name),
        },
      }));
    };

    // Build S3 sub-folder nodes
    const buildS3FolderNodes = (cacheKey: string | null, sourceType: string, emailFolderType?: string): TreeNode[] => {
      if (!cacheKey) return [];
      const s3Data = s3Folders[cacheKey];
      if (!s3Data?.folders?.length) return [];

      return s3Data.folders.map(folder => ({
        id: `s3-folder-${(folder.path || "").replace(/\//g, "-")}`,
        name: folder.name,
        type: "category" as const,
        icon: folder.is_mailbox ? SCOPE_ICONS.email : React.createElement(Folder, { className: "h-4 w-4" }),
        fullPath: folder.path || undefined,
        fileCount: folder.count || 0,
        sourceType,
        isMailbox: folder.is_mailbox || false,
        mailboxEmail: folder.mailbox_email || undefined,
        externalLink: folder.external_link || undefined,
        mailboxCount: folder.mailbox_count || undefined,
        emailFolderType: folder.email_folder_type || emailFolderType,
        children: [
          ...buildS3FolderNodes(folder.path, sourceType, folder.email_folder_type || emailFolderType),
          ...buildS3FileNodes(folder.path),
        ],
      }));
    };

    // Convert WarehouseFolderChildNode (tabs) to TreeNode
    const convertWarehouseFolderChildToTreeNode = (
      folder: WarehouseFolderChildNode,
      sourceType: string,
      tokenValues?: Record<string, string | null>,
      recordId?: number,
    ): TreeNode => {
      const rawPath = folder.fullPath || folder.folderPath;
      const folderPath = tokenValues ? resolvePathTokens(rawPath, tokenValues) : rawPath;
      const isVirtual = folderPath?.includes("{{") || false;
      const nodeId = recordId ? `${folder.id}-rec-${recordId}` : folder.id;
      const s3CacheKey = isVirtual ? nodeId : folderPath;
      const s3Files = buildS3FileNodes(s3CacheKey);
      const s3SubFolders = buildS3FolderNodes(s3CacheKey, sourceType);
      const children = folder.children.map(child => convertWarehouseFolderChildToTreeNode(child, sourceType, tokenValues, recordId));

      return {
        id: nodeId,
        name: folder.name,
        type: "category" as const,
        icon: getIconComponent(folder.iconName, folder.name),
        fullPath: folderPath || undefined,
        fileCount: folder.fileCount,
        sourceType,
        isVirtual,
        children: [...children, ...s3SubFolders, ...s3Files],
      };
    };

    // Convert WarehouseFolderTreeNode2 to TreeNode
    const convertWarehouseFolderToTreeNode2 = (warehouseFolder: WarehouseFolderTreeNode2, sourceType: string): TreeNode => {
      const folderPath = warehouseFolder.warehouseFolder?.folderPath || warehouseFolder.folderPathTemplate;
      const isVirtual = folderPath?.includes("{{") || false;
      const s3CacheKey = isVirtual ? warehouseFolder.id : folderPath;
      const s3Files = buildS3FileNodes(s3CacheKey);
      const s3SubFolders = buildS3FolderNodes(s3CacheKey, sourceType);
      const children = warehouseFolder.children.map(child => convertWarehouseFolderChildToTreeNode(child, sourceType));

      return {
        id: warehouseFolder.id,
        name: warehouseFolder.warehouseFolder?.displayName || warehouseFolder.name,
        type: "category" as const,
        icon: getIconComponent(warehouseFolder.warehouseFolder?.iconName || null, warehouseFolder.name),
        fullPath: folderPath || undefined,
        pathTemplate: warehouseFolder.pathPreview || warehouseFolder.folderPathTemplate || undefined,
        fileCount: 0,
        sourceType,
        isVirtual,
        isMailbox: warehouseFolder.isMailbox || false,
        children: [...children, ...s3SubFolders, ...s3Files],
      };
    };

    // Convert a RecordNode to TreeNode
    const convertRecordToTreeNode = (record: RecordNode, warehouseType: WarehouseTypeTreeNode): TreeNode => {
      const recordIcon = getIconComponent(warehouseType.iconName, warehouseType.code);
      const displayName = record.code ? `${record.code} ${record.name}` : record.name;

      const findChildWarehouseFolders = (parentId: number | null): WarehouseFolderTreeNode2[] => {
        return warehouseType.warehouseFolders.filter(wf => {
          if (parentId === null) return wf.parentId === null;
          return wf.parentId === parentId;
        });
      };

      const convertWarehouseFolderWithHierarchy = (warehouseFolder: WarehouseFolderTreeNode2): TreeNode => {
        const rawPath = warehouseFolder.warehouseFolder?.folderPath || warehouseFolder.folderPathTemplate;
        const folderPath = resolvePathTokens(rawPath, record.tokenValues);
        const isVirtual = folderPath?.includes("{{") || false;
        const nodeId = `${warehouseFolder.id}-rec-${record.id}`;
        const s3CacheKey = isVirtual ? nodeId : folderPath;
        const s3Files = buildS3FileNodes(s3CacheKey);
        const s3SubFolders = buildS3FolderNodes(s3CacheKey, warehouseType.code);

        const warehouseFolderChildren = warehouseFolder.children.map(child =>
          convertWarehouseFolderChildToTreeNode(child, warehouseType.code, record.tokenValues, record.id)
        );

        const numericId = parseInt(warehouseFolder.id.replace("wf-", ""), 10);
        const childWarehouseFolders = findChildWarehouseFolders(numericId);
        const childWarehouseFolderNodes = childWarehouseFolders.map(child => convertWarehouseFolderWithHierarchy(child));

        return {
          id: `${warehouseFolder.id}-rec-${record.id}`,
          name: warehouseFolder.warehouseFolder?.displayName || warehouseFolder.name,
          type: "category" as const,
          icon: getIconComponent(warehouseFolder.warehouseFolder?.iconName || null, warehouseFolder.name),
          fullPath: folderPath || undefined,
          pathTemplate: folderPath || warehouseFolder.pathPreview || warehouseFolder.folderPathTemplate || undefined,
          fileCount: 0,
          sourceType: warehouseType.code,
          isVirtual,
          children: [...childWarehouseFolderNodes, ...warehouseFolderChildren, ...s3SubFolders, ...s3Files],
        };
      };

      const rootWarehouseFolders = findChildWarehouseFolders(null);
      const children = rootWarehouseFolders.map(wf => convertWarehouseFolderWithHierarchy(wf));

      return {
        id: `record-${warehouseType.code}-${record.id}`,
        name: displayName,
        type: "record" as const,
        icon: recordIcon,
        recordNode: record,
        warehouseTypeCode: warehouseType.code,
        sourceType: warehouseType.code,
        children,
      };
    };

    // Convert WarehouseTypeTreeNode to TreeNode (top level)
    const convertWarehouseTypeToTreeNode = (warehouseType: WarehouseTypeTreeNode): TreeNode => {
      const folderPath = warehouseType.folderPathTemplate?.split("/")[0];
      const isVirtual = warehouseType.folderPathTemplate?.includes("{{") || false;
      const s3CacheKey = isVirtual ? `wt-${warehouseType.code}` : folderPath;
      const s3Files = s3CacheKey ? buildS3FileNodes(s3CacheKey) : [];
      const s3SubFolders = s3CacheKey ? buildS3FolderNodes(s3CacheKey, warehouseType.code) : [];

      const recordData = warehouseRecords[warehouseType.code];
      const isLoadingRecordsForType = loadingRecords.has(warehouseType.code);

      let children: TreeNode[] = [];

      if (recordData?.records?.length > 0) {
        const groupingTokens = recordData.groupingTokens || [];

        const buildGroupedHierarchy = (
          records: RecordNode[],
          tokens: string[],
          depth = 0,
        ): TreeNode[] => {
          if (depth >= tokens.length) {
            return records.map(r => convertRecordToTreeNode(r, warehouseType));
          }
          const token = tokens[depth];
          const groups = new Map<string, RecordNode[]>();
          for (const r of records) {
            const key = r.tokenValues?.[token] || `No ${token}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(r);
          }
          return Array.from(groups.entries()).map(([groupName, groupRecords]) => ({
            id: `group-${warehouseType.code}-${depth}-${groupName}`,
            name: groupName,
            type: "category" as const,
            sourceType: warehouseType.code,
            children: buildGroupedHierarchy(groupRecords, tokens, depth + 1),
          }));
        };

        if (groupingTokens.length > 0) {
          children = buildGroupedHierarchy(recordData.records, groupingTokens);
        } else {
          children = recordData.records.map(r => convertRecordToTreeNode(r, warehouseType));
        }

        if (recordData.pagination?.has_more) {
          children.push({
            id: `load-more-${warehouseType.code}`,
            name: `Load more (${recordData.pagination.total - recordData.records.length} remaining)`,
            type: "load-more" as const,
            warehouseTypeCode: warehouseType.code,
          });
        }
      } else if (isLoadingRecordsForType) {
        children = [{
          id: `loading-records-${warehouseType.code}`,
          name: "Loading records...",
          type: "loading" as const,
        }];
      } else {
        children = warehouseType.warehouseFolders.map(wf => convertWarehouseFolderToTreeNode2(wf, warehouseType.code));
      }

      return {
        id: warehouseType.id,
        name: warehouseType.displayName,
        type: "category" as const,
        icon: getIconComponent(warehouseType.iconName, warehouseType.code),
        fullPath: folderPath || undefined,
        pathTemplate: warehouseType.pathPreview || warehouseType.folderPathTemplate || undefined,
        fileCount: warehouseType.fileCount,
        sourceType: warehouseType.code,
        isVirtual,
        children: [...children, ...s3SubFolders, ...s3Files],
      };
    };

    if (warehouseTreeLoading) {
      return [{
        id: "loading-tree",
        name: "Loading folders...",
        type: "loading" as const,
      }];
    }

    // ── Scoped mode: filter to single warehouse type and inject synthetic record ──
    if (mode.type === "scoped") {
      const warehouseType = warehouseTypesTree.find(wt => wt.code === mode.warehouseTypeCode);
      if (!warehouseType) {
        return [{
          id: "no-warehouse-type",
          name: "No warehouse configuration found",
          type: "loading" as const,
        }];
      }

      // Build a synthetic record node from the props (skip the record-selection level)
      const syntheticRecord: RecordNode = {
        id: mode.linkableId,
        name: "",
        tokenValues: mode.recordTokenValues,
      };

      // Get warehouse folders as if we're inside a record
      const findChildWarehouseFolders = (parentId: number | null): WarehouseFolderTreeNode2[] => {
        return warehouseType.warehouseFolders.filter(wf => {
          if (parentId === null) return wf.parentId === null;
          return wf.parentId === parentId;
        });
      };

      const convertWarehouseFolderForScoped = (warehouseFolder: WarehouseFolderTreeNode2): TreeNode => {
        const rawPath = warehouseFolder.warehouseFolder?.folderPath || warehouseFolder.folderPathTemplate;
        const folderPath = resolvePathTokens(rawPath, syntheticRecord.tokenValues);
        const isVirtual = folderPath?.includes("{{") || false;
        const nodeId = `${warehouseFolder.id}-rec-${syntheticRecord.id}`;
        const s3CacheKey = isVirtual ? nodeId : folderPath;
        const s3Files = buildS3FileNodes(s3CacheKey);
        const s3SubFolders = buildS3FolderNodes(s3CacheKey, warehouseType.code);

        const warehouseFolderChildren = warehouseFolder.children.map(child =>
          convertWarehouseFolderChildToTreeNode(child, warehouseType.code, syntheticRecord.tokenValues, syntheticRecord.id)
        );

        const numericId = parseInt(warehouseFolder.id.replace("wf-", ""), 10);
        const childWarehouseFolders = findChildWarehouseFolders(numericId);
        const childWarehouseFolderNodes = childWarehouseFolders.map(child => convertWarehouseFolderForScoped(child));

        return {
          id: nodeId,
          name: warehouseFolder.warehouseFolder?.displayName || warehouseFolder.name,
          type: "category" as const,
          icon: getIconComponent(warehouseFolder.warehouseFolder?.iconName || null, warehouseFolder.name),
          fullPath: folderPath || undefined,
          pathTemplate: folderPath || warehouseFolder.pathPreview || warehouseFolder.folderPathTemplate || undefined,
          fileCount: 0,
          sourceType: warehouseType.code,
          isVirtual,
          children: [...childWarehouseFolderNodes, ...warehouseFolderChildren, ...s3SubFolders, ...s3Files],
        };
      };

      const rootWarehouseFolders = findChildWarehouseFolders(null);
      return rootWarehouseFolders.map(wf => convertWarehouseFolderForScoped(wf));
    }

    // ── Full mode: convert all warehouse types ──
    return warehouseTypesTree.map(convertWarehouseTypeToTreeNode);
  }, [warehouseTypesTree, warehouseTreeLoading, s3Folders, warehouseRecords, loadingRecords, mode]);

  // ─── Collapse all folders ─────────────────────────────────────
  const collapseAll = useCallback(() => {
    setExpandedFolders(new Set<string>());
  }, []);

  // ─── Refresh handler ───────────────────────────────────────────
  const refresh = useCallback(() => {
    setS3Folders({});
    setWarehouseRecords({});
    fetchWarehouseTypesTree();
  }, [fetchWarehouseTypesTree]);

  return {
    treeData,
    expandedFolders,
    toggleFolder,
    collapseAll,
    treeDisplayMode,
    setTreeDisplayMode,
    s3Folders,
    loadingS3Folders,
    loadingRecords,
    warehouseRecords,
    treeLoading: warehouseTreeLoading,
    refresh,
    fetchRecords,
  };
}
