"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Plus, Pencil, Trash2, Lock, FolderOpen, Search, ArrowUpDown, ArrowUp, ArrowDown, Mail, Zap, ChevronRight, ChevronDown } from "lucide-react";
import { TabTypeBadge } from "@/components/ui/tab-type-badge";
import { deriveTabType } from "@/lib/constants/tab-types";
import { toast } from "sonner";

type SortField = "warehouse_type_name" | "name" | "folder_path_template" | "warehouse_folders_count" | "enabled";
type SortDirection = "asc" | "desc";

/**
 * WarehouseFoldersTab - Manage warehouse folders for warehouse types
 *
 * SSoT: Database-driven warehouse folders (Feb 2026)
 * Each WarehouseType has one or more WarehouseFolders with path templates
 */

interface WarehouseType {
  id: number;
  code: string;
  display_name: string;
}

interface WarehouseFolder {
  id: number;
  warehouse_type_id: number;
  warehouse_type_code: string;
  warehouse_type_name: string;
  parent_id: number | null;
  parent_name: string | null;
  children_count: number;
  name: string;
  folder_path_template?: string;
  full_path_template?: string;
  path_preview?: string;
  is_system: boolean;  // SSoT: System-generated (can't delete)
  tab_type?: string;  // SSoT: THE ONE field for folder behavior
  is_mailbox?: boolean;     // SSoT: Mailbox tab
  enabled: boolean;
  order_position: number;
  warehouse_folders_count: number;
  can_delete: boolean;
  is_dynamic?: boolean;
  dynamic_type?: 'mailbox' | string;
  created_at: string;
  updated_at: string;
}

interface WarehouseFoldersResponse {
  success: boolean;
  data: {
    warehouse_type: string | null;
    scope: string | null;
    tabs: WarehouseFolder[];
    groups: string[];
  };
}

interface WarehouseTypesOptionsResponse {
  success: boolean;
  data: Array<{ value: number; label: string; code: string; base_path: string }>;
}

interface FormData {
  warehouse_type_id: number | null;
  parent_id: number | null;
  name: string;
  folder_path_template: string;
  enabled: boolean;
  order_position: number;
}

const defaultFormData: FormData = {
  warehouse_type_id: null,
  parent_id: null,
  name: "",
  folder_path_template: "",
  enabled: true,
  order_position: 0,
};

// Tree node for hierarchical display
interface TreeNode extends WarehouseFolder {
  children: TreeNode[];
  depth: number;
}

export function WarehouseFoldersTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingFolder, setEditingFolder] = React.useState<WarehouseFolder | null>(null);
  const [formData, setFormData] = React.useState<FormData>(defaultFormData);
  const [filterWarehouseType, setFilterWarehouseType] = React.useState<string>("all");
  const [showDisabled, setShowDisabled] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortField, setSortField] = React.useState<SortField>("warehouse_type_name");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");
  const [collapsedTypes, setCollapsedTypes] = React.useState<Set<string>>(new Set());
  const [hasInitializedCollapse, setHasInitializedCollapse] = React.useState(false);

  const toggleTypeCollapse = (typeName: string) => {
    setCollapsedTypes(prev => {
      const next = new Set(prev);
      if (next.has(typeName)) {
        next.delete(typeName);
      } else {
        next.add(typeName);
      }
      return next;
    });
  };

  // Fetch warehouse types for dropdown
  const { data: warehouseTypesData } = useQuery({
    queryKey: ["warehouse-types-options"],
    queryFn: async () => {
      const response = await api.get<WarehouseTypesOptionsResponse>(
        "/api/v1/warehouse_types/options"
      );
      return response;
    },
  });

  // Fetch warehouse folders
  const { data, isLoading, error } = useQuery({
    queryKey: ["warehouse-folders", filterWarehouseType, showDisabled],
    queryFn: async () => {
      let url = "/api/v1/warehouse_folders";
      const params = new URLSearchParams();

      if (filterWarehouseType !== "all") {
        params.append("warehouse_type_code", filterWarehouseType);
      }
      if (showDisabled) {
        params.append("include_disabled", "true");
      }

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await api.get<WarehouseFoldersResponse>(url);
      return response;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return api.post<{ success: boolean; data: WarehouseFolder }>("/api/v1/warehouse_folders", {
        warehouse_folder: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-folders"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-types"] });
      toast.success("Warehouse folder created successfully");
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      return api.patch<{ success: boolean; data: WarehouseFolder }>(`/api/v1/warehouse_folders/${id}`, {
        warehouse_folder: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-folders"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-types"] });
      toast.success("Warehouse folder updated successfully");
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete<{ success: boolean }>(`/api/v1/warehouse_folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-folders"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-types"] });
      toast.success("Warehouse folder deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const openCreateDialog = () => {
    setEditingFolder(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (folder: WarehouseFolder) => {
    setEditingFolder(folder);
    // SSoT (Feb 2026): name IS the folder path - one field serves both purposes
    setFormData({
      warehouse_type_id: folder.warehouse_type_id,
      parent_id: folder.parent_id,
      name: folder.name,
      folder_path_template: folder.name, // Same as name (SSoT)
      enabled: folder.enabled,
      order_position: folder.order_position,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingFolder(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.warehouse_type_id) {
      toast.error("Please select a warehouse type");
      return;
    }

    // SSoT (Feb 2026): name IS the folder path - one field serves both purposes
    const dataToSave = {
      ...formData,
      // Use name as folder_path_template (SSoT: one field, not two)
      folder_path_template: formData.name,
    };

    if (editingFolder) {
      updateMutation.mutate({ id: editingFolder.id, data: dataToSave });
    } else {
      createMutation.mutate(dataToSave);
    }
  };

  const handleDelete = (folder: WarehouseFolder) => {
    if (!folder.can_delete) {
      toast.error("This warehouse folder cannot be deleted");
      return;
    }
    if (confirm(`Delete warehouse folder "${folder.name}"?`)) {
      deleteMutation.mutate(folder.id);
    }
  };

  const warehouseTypeOptions = warehouseTypesData?.data || [];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Filter and sort warehouse folders
  // SSoT: All hooks MUST be called before any early returns (React Rules of Hooks)
  // API returns { success, data: { tabs: [...], ... } } - access data.tabs
  // Backend returns NESTED structure (children inside parents), so we flatten it
  const flattenNestedFolders = (folders: WarehouseFolder[]): WarehouseFolder[] => {
    const result: WarehouseFolder[] = [];
    const flatten = (items: WarehouseFolder[]) => {
      items.forEach(item => {
        // Add the item without its children (we use parent_id for tree building)
        const { children, ...itemWithoutChildren } = item as WarehouseFolder & { children?: WarehouseFolder[] };
        result.push(itemWithoutChildren as WarehouseFolder);
        // Recursively flatten children
        if (children && Array.isArray(children) && children.length > 0) {
          flatten(children);
        }
      });
    };
    flatten(folders);
    return result;
  };

  const nestedTabs = Array.isArray(data?.data?.tabs) ? data.data.tabs : [];
  const rawFolders = flattenNestedFolders(nestedTabs);

  const warehouseFolders = React.useMemo(() => {
    let filtered = rawFolders;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (folder) =>
          folder.name.toLowerCase().includes(query) ||
          folder.warehouse_type_name?.toLowerCase().includes(query) ||
          folder.warehouse_type_code?.toLowerCase().includes(query) ||
          folder.folder_path_template?.toLowerCase().includes(query)
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "warehouse_type_name":
          comparison = (a.warehouse_type_name || a.warehouse_type_code).localeCompare(
            b.warehouse_type_name || b.warehouse_type_code
          );
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "folder_path_template":
          comparison = (a.folder_path_template || "").localeCompare(b.folder_path_template || "");
          break;
        case "warehouse_folders_count":
          comparison = a.warehouse_folders_count - b.warehouse_folders_count;
          break;
        case "enabled":
          comparison = (a.enabled === b.enabled) ? 0 : a.enabled ? -1 : 1;
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [rawFolders, searchQuery, sortField, sortDirection]);

  // Get all unique type names for collapse all functionality
  const allTypeNames = React.useMemo(() => {
    const types = new Set<string>();
    warehouseFolders.forEach(f => {
      types.add(f.warehouse_type_name || f.warehouse_type_code || "Unassigned");
    });
    return types;
  }, [warehouseFolders]);

  // Collapse all types by default when data first loads
  React.useEffect(() => {
    if (!hasInitializedCollapse && allTypeNames.size > 0) {
      setCollapsedTypes(new Set(allTypeNames));
      setHasInitializedCollapse(true);
    }
  }, [hasInitializedCollapse, allTypeNames]);

  const allCollapsed = allTypeNames.size > 0 && collapsedTypes.size === allTypeNames.size;

  const toggleCollapseAll = () => {
    if (allCollapsed) {
      // Expand all
      setCollapsedTypes(new Set());
    } else {
      // Collapse all
      setCollapsedTypes(new Set(allTypeNames));
    }
  };

  // Build tree structure from flat folder list
  // Groups by warehouse type, then builds parent-child hierarchy within each type
  const buildTree = React.useCallback((folders: WarehouseFolder[]): Map<string, TreeNode[]> => {
    const byType = new Map<string, TreeNode[]>();

    // Group folders by warehouse type
    const grouped = folders.reduce((acc, folder) => {
      const type = folder.warehouse_type_name || folder.warehouse_type_code || "Unassigned";
      if (!acc[type]) acc[type] = [];
      acc[type].push(folder);
      return acc;
    }, {} as Record<string, WarehouseFolder[]>);

    // For each type, build tree
    Object.entries(grouped).forEach(([typeName, typeFolders]) => {
      // Create a map of id -> TreeNode
      const nodeMap = new Map<number, TreeNode>();
      typeFolders.forEach(f => {
        nodeMap.set(f.id, { ...f, children: [], depth: 0 });
      });

      // Build tree - connect children to parents
      const roots: TreeNode[] = [];
      nodeMap.forEach(node => {
        if (node.parent_id && nodeMap.has(node.parent_id)) {
          const parent = nodeMap.get(node.parent_id)!;
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      });

      // Calculate depths
      const setDepths = (nodes: TreeNode[], depth: number) => {
        nodes.forEach(node => {
          node.depth = depth;
          if (node.children.length > 0) {
            setDepths(node.children, depth + 1);
          }
        });
      };
      setDepths(roots, 0);

      // Sort roots and children alphabetically
      const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name));
        nodes.forEach(n => sortNodes(n.children));
      };
      sortNodes(roots);

      byType.set(typeName, roots);
    });

    return byType;
  }, []);

  const folderTree = React.useMemo(() => buildTree(warehouseFolders), [warehouseFolders, buildTree]);

  // Flatten tree for rendering with proper indentation info
  const flattenTree = (nodes: TreeNode[], isLast: boolean[] = []): Array<{ node: TreeNode; isLast: boolean[] }> => {
    const result: Array<{ node: TreeNode; isLast: boolean[] }> = [];
    nodes.forEach((node, idx) => {
      const nodeIsLast = idx === nodes.length - 1;
      result.push({ node, isLast: [...isLast, nodeIsLast] });
      if (node.children.length > 0 && !collapsedTypes.has(`folder-${node.id}`)) {
        result.push(...flattenTree(node.children, [...isLast, nodeIsLast]));
      }
    });
    return result;
  };

  // Build ancestor path by walking up parent chain
  // e.g., if parent_id points to "Balance Sheet" which has parent "Xero", returns "Xero/Balance Sheet"
  const buildAncestorPath = React.useCallback((parentId: number | null): string => {
    if (!parentId) return '';

    const pathParts: string[] = [];
    let currentId: number | null = parentId;
    const visited = new Set<number>(); // Prevent infinite loops

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const folder = warehouseFolders.find(f => f.id === currentId);
      if (!folder) break;
      pathParts.unshift(folder.name);
      currentId = folder.parent_id;
    }

    return pathParts.join('/');
  }, [warehouseFolders]);

  // Get available parent options for a folder (same type, exclude self and descendants)
  const getParentOptions = React.useCallback((warehouseTypeId: number | null, currentFolderId: number | null) => {
    if (!warehouseTypeId) return [];

    const sametype = warehouseFolders.filter(f => f.warehouse_type_id === warehouseTypeId);

    // Get all descendant IDs to exclude (can't set a descendant as parent)
    const getDescendantIds = (folderId: number): Set<number> => {
      const ids = new Set<number>();
      const children = sametype.filter(f => f.parent_id === folderId);
      children.forEach(child => {
        ids.add(child.id);
        getDescendantIds(child.id).forEach(id => ids.add(id));
      });
      return ids;
    };

    const excludeIds = new Set<number>();
    if (currentFolderId) {
      excludeIds.add(currentFolderId);
      getDescendantIds(currentFolderId).forEach(id => excludeIds.add(id));
    }

    return sametype.filter(f => !excludeIds.has(f.id));
  }, [warehouseFolders]);

  // Track collapsed folder nodes (for tree expand/collapse)
  const toggleFolderCollapse = (folderId: number) => {
    const key = `folder-${folderId}`;
    setCollapsedTypes(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Early returns AFTER all hooks (React Rules of Hooks)
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive p-4">
        Failed to load warehouse folders: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Warehouse Folders</h2>
          <p className="text-sm text-muted-foreground">
            Configure warehouse folder paths and templates for each warehouse type
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-[180px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="filter-type" className="text-sm whitespace-nowrap">
              Type:
            </Label>
            <Select value={filterWarehouseType} onValueChange={setFilterWarehouseType}>
              <SelectTrigger id="filter-type" className="w-[140px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {warehouseTypeOptions.map((wt) => (
                  <SelectItem key={wt.code} value={wt.code}>
                    {wt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-disabled"
              checked={showDisabled}
              onCheckedChange={setShowDisabled}
            />
            <Label htmlFor="show-disabled" className="text-sm">
              Show disabled
            </Label>
          </div>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Folder
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>Total: {rawFolders.length}</span>
        {searchQuery && <span>Showing: {warehouseFolders.length}</span>}
        <span>Enabled: {rawFolders.filter(f => f.enabled).length}</span>
        <span>System: {rawFolders.filter(f => f.is_system).length}</span>
      </div>

      {/* Table - Cascaded by Type */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="w-[200px] cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapseAll();
                    }}
                    className="p-0.5 hover:bg-muted rounded"
                    title={allCollapsed ? "Expand all" : "Collapse all"}
                  >
                    {allCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  Name
                  {getSortIcon("name")}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("folder_path_template")}
              >
                <div className="flex items-center">
                  Path Template
                  {getSortIcon("folder_path_template")}
                </div>
              </TableHead>
              <TableHead className="w-[200px]">Path Preview</TableHead>
              <TableHead
                className="w-[80px] cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("warehouse_folders_count")}
              >
                <div className="flex items-center">
                  Child Folders
                  {getSortIcon("warehouse_folders_count")}
                </div>
              </TableHead>
              <TableHead
                className="w-[80px] cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("enabled")}
              >
                <div className="flex items-center">
                  Enabled
                  {getSortIcon("enabled")}
                </div>
              </TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              // Get sorted type names from the tree
              const sortedTypes = Array.from(folderTree.keys()).sort();

              // Count total folders for each type (including nested)
              const countFolders = (nodes: TreeNode[]): number => {
                return nodes.reduce((sum, n) => sum + 1 + countFolders(n.children), 0);
              };

              return sortedTypes.map((typeName) => {
                const roots = folderTree.get(typeName) || [];
                const isTypeCollapsed = collapsedTypes.has(typeName);
                const totalCount = countFolders(roots);

                // Flatten tree for this type
                const flatFolders = !isTypeCollapsed ? flattenTree(roots) : [];

                return (
                <React.Fragment key={typeName}>
                  {/* Type Header Row - Clickable */}
                  <TableRow
                    className="bg-muted/50 hover:bg-muted cursor-pointer"
                    onClick={() => toggleTypeCollapse(typeName)}
                  >
                    <TableCell colSpan={6} className="py-2">
                      <div className="flex items-center gap-2">
                        {isTypeCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Badge variant="outline" className="font-medium">
                          {typeName}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({totalCount} folder{totalCount !== 1 ? "s" : ""})
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                  {/* Folder Rows - Tree structure */}
                  {flatFolders.map(({ node: folder, isLast }) => {
                    const hasChildren = folder.children.length > 0;
                    const isFolderCollapsed = collapsedTypes.has(`folder-${folder.id}`);
                    const depth = folder.depth;

                    // Build tree line indicators
                    const treeLines = isLast.slice(0, -1).map((last, idx) => (
                      <span
                        key={idx}
                        className="inline-block w-4 text-muted-foreground/50"
                      >
                        {!last ? "│" : " "}
                      </span>
                    ));

                    const lastLine = isLast[isLast.length - 1];

                    return (
                      <TableRow key={folder.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            {/* Tree indent lines */}
                            <span className="font-mono text-xs text-muted-foreground/50 whitespace-pre">
                              {treeLines}
                              {depth > 0 && (
                                <span className="inline-block w-4">{lastLine ? "└" : "├"}</span>
                              )}
                            </span>
                            {/* Expand/collapse button for folders with children */}
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFolderCollapse(folder.id);
                                }}
                                className="p-0.5 hover:bg-muted rounded mr-1"
                              >
                                {isFolderCollapsed ? (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </button>
                            ) : (
                              <span className="w-5" /> // Spacer for alignment
                            )}
                            <div className="flex items-center gap-1">
                              {folder.is_dynamic && folder.dynamic_type === "mailbox" ? (
                                <Mail className="h-4 w-4 text-blue-500" />
                              ) : (
                                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                              )}
                              {folder.name}
                              {folder.is_system && (
                                <Lock className="h-3 w-3 text-muted-foreground" />
                              )}
                              {folder.is_dynamic && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                                  Dynamic
                                </Badge>
                              )}
                              {hasChildren && (
                                <span className="text-[10px] text-muted-foreground ml-1">
                                  ({folder.children_count})
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {(folder.full_path_template || folder.folder_path_template || "-").replace(/\/\s*\//g, '/')}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {(folder.path_preview || "-").replace(/\/\s*\//g, '/')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {folder.warehouse_folders_count}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={folder.enabled ? "default" : "outline"}>
                            {folder.enabled ? "Yes" : "No"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(folder)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {!folder.is_system && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(folder)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              );
              });
            })()}
            {warehouseFolders.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? `No folders matching "${searchQuery}"` : "No warehouse folders found"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>
                {editingFolder ? "Edit Warehouse Folder" : "Create Warehouse Folder"}
              </DialogTitle>
              {/* SSoT: Tab type badge */}
              {editingFolder && (
                <TabTypeBadge tabType={deriveTabType(editingFolder)} isSystem={editingFolder.is_system} />
              )}
            </div>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="warehouse_type_id">Warehouse Type</Label>
                <Select
                  value={formData.warehouse_type_id?.toString() || ""}
                  onValueChange={(val) => {
                    const selectedId = parseInt(val);
                    // Clear parent when warehouse type changes (parent must be same type)
                    setFormData({ ...formData, warehouse_type_id: selectedId, parent_id: null });
                  }}
                  disabled={false}
                >
                  <SelectTrigger id="warehouse_type_id">
                    <SelectValue placeholder="Select warehouse type" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseTypeOptions.map((wt) => (
                      <SelectItem key={wt.value} value={wt.value.toString()}>
                        {wt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Show the base path hint if a type is selected */}
                {formData.warehouse_type_id && (() => {
                  const selectedType = warehouseTypeOptions.find(wt => wt.value === formData.warehouse_type_id);
                  return selectedType?.base_path ? (
                    <p className="text-xs text-muted-foreground">
                      Base path: <code className="bg-muted px-1 rounded">{selectedType.base_path}</code>
                    </p>
                  ) : null;
                })()}
              </div>

              {/* Parent Folder Selection - Only show if warehouse type is selected */}
              {formData.warehouse_type_id && (
                <div className="space-y-2">
                  <Label htmlFor="parent_id">Parent Folder (optional)</Label>
                  <Select
                    value={formData.parent_id?.toString() || "none"}
                    onValueChange={(val) => {
                      setFormData({
                        ...formData,
                        parent_id: val === "none" ? null : parseInt(val)
                      });
                    }}
                  >
                    <SelectTrigger id="parent_id">
                      <SelectValue placeholder="None (root level)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (root level)</SelectItem>
                      {getParentOptions(formData.warehouse_type_id, editingFolder?.id || null).map((folder) => (
                        <SelectItem key={folder.id} value={folder.id.toString()}>
                          {folder.parent_name ? `${folder.parent_name} / ${folder.name}` : folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select a parent to create a nested hierarchy within this warehouse type
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">Name (also used as folder path)</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Responses, Attachments, Documents"
                />
              </div>

              {/* Full path preview - includes parent hierarchy */}
              {(() => {
                const selectedType = warehouseTypeOptions.find(wt => wt.value === formData.warehouse_type_id);
                const rawBasePath = selectedType?.base_path || '';
                const rawName = formData.name || '';
                if (!rawBasePath || !rawName) return null;
                // Build ancestor path from parent hierarchy
                const ancestorPath = buildAncestorPath(formData.parent_id);
                // Build full path: basePath + ancestorPath + name
                const fullPath = [rawBasePath, ancestorPath, rawName]
                  .map(p => p.trim().replace(/^\/+|\/+$/g, ''))  // Trim and remove leading/trailing slashes
                  .filter(Boolean)
                  .join('/');
                return (
                  <div className="text-xs text-muted-foreground">
                    Full path: <code className="bg-muted px-1 rounded font-mono">{fullPath}</code>
                  </div>
                );
              })()}

              <div className="flex items-center gap-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, enabled: checked })
                  }
                />
                <Label htmlFor="enabled">Enabled</Label>
              </div>
            </div>

            <DialogFooter className="flex justify-between sm:justify-between">
              {/* Delete button - only show for non-system folders when editing */}
              {editingFolder && !editingFolder.is_system ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (confirm(`Delete warehouse folder "${editingFolder.name}"?`)) {
                      deleteMutation.mutate(editingFolder.id);
                      closeDialog();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              ) : (
                <div /> // Spacer
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingFolder
                    ? "Update"
                    : "Create"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
