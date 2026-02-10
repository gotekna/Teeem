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
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Plus, Pencil, Trash2, Lock, Folder, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { getWarehouseScopeForType } from "@/lib/placeholders";
import { PlaceholderBuilder } from "@/components/ui/placeholders";

type SortField = "code" | "display_name" | "folder_path_template" | "warehouse_folders_count" | "enabled";
type SortDirection = "asc" | "desc";

/**
 * WarehouseTypesTab - Manage warehouse types and warehouse folders
 *
 * SSoT: Database-driven warehouse types (Feb 2026)
 * Replaces the hardcoded WAREHOUSE_TYPES constant
 */

interface WarehouseType {
  id: number;
  code: string;
  display_name: string;
  description?: string;
  icon_name?: string;
  folder_path_template?: string;
  is_system: boolean;
  enabled: boolean;
  order_position: number;
  warehouse_folders_count: number;
  warehouse_folders: WarehouseFolderInType[];
  can_delete: boolean;
  created_at: string;
  updated_at: string;
}

interface WarehouseFolderInType {
  id: number;
  name: string;
  parent_id: number | null;
  children_count?: number;
  folder_path_template?: string;
  full_path_template?: string;
  path_preview?: string;
  warehouse_type_name?: string;
  warehouse_type_code?: string;
}

interface WarehouseTypesResponse {
  success: boolean;
  data: WarehouseType[];
  summary: {
    total: number;
    enabled: number;
    system: number;
    custom: number;
  };
}

interface FormData {
  code: string;
  display_name: string;
  description: string;
  icon_name: string;
  folder_path_template: string;
  enabled: boolean;
  order_position: number;
}

interface WarehouseFolderToggle {
  id: number;
  name: string;
  enabled: boolean; // true = assigned to current warehouse type (including all children)
  is_system: boolean;
  warehouse_type_id: number;
  warehouse_type_name: string;
  parent_id: number | null;      // null = root folder
  children_ids: number[];        // All descendant IDs (recursive)
}

// Flat folder from API (used to build tree view in dialog)
interface FlatFolder {
  id: number;
  name: string;
  parent_id: number | null;
  enabled: boolean;
  is_system: boolean;
  warehouse_type_id: number;
  warehouse_type_name: string;
}

const defaultFormData: FormData = {
  code: "",
  display_name: "",
  description: "",
  icon_name: "",
  folder_path_template: "",
  enabled: true,
  order_position: 0,
};

export function WarehouseTypesTab() {

  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingType, setEditingType] = React.useState<WarehouseType | null>(null);
  const [formData, setFormData] = React.useState<FormData>(defaultFormData);
  const [warehouseFolderToggles, setWarehouseFolderToggles] = React.useState<WarehouseFolderToggle[]>([]);
  const [allFolders, setAllFolders] = React.useState<FlatFolder[]>([]);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = React.useState<Set<number>>(new Set());
  const [folderTypeFilter, setFolderTypeFilter] = React.useState<string>("all");
  // Primary tab categories for folder filter
  // Corporate, Job, Contact are primary; everything else is "System"
  const PRIMARY_FOLDER_TABS = ["Corporate", "Job", "Contact"] as const;
  const [warehouseFolderSearch, setWarehouseFolderSearch] = React.useState("");
  const [showAvailableFolders, setShowAvailableFolders] = React.useState(false);
  const [showSystemTypes, setShowSystemTypes] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortField, setSortField] = React.useState<SortField>("code");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");

  // Fetch warehouse types
  const { data, isLoading, error } = useQuery({
    queryKey: ["warehouse-types", showSystemTypes],
    queryFn: async () => {
      const response = await api.get<WarehouseTypesResponse>(
        `/api/v1/warehouse_types${showSystemTypes ? "?include_disabled=true" : ""}`
      );
      return response;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return api.post<{ success: boolean; data: WarehouseType }>("/api/v1/warehouse_types", {
        warehouse_type: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-types"] });
      toast.success("Warehouse type created successfully");
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      return api.patch<{ success: boolean; data: WarehouseType }>(`/api/v1/warehouse_types/${id}`, {
        warehouse_type: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-types"] });
      toast.success("Warehouse type updated successfully");
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete<{ success: boolean }>(`/api/v1/warehouse_types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse-types"] });
      toast.success("Warehouse type deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  // Update warehouse folder (reassign to different warehouse type)
  const updateWarehouseFolderMutation = useMutation({
    mutationFn: async ({ id, warehouse_type_id }: { id: number; warehouse_type_id: number }) => {
      return api.patch<{ success: boolean }>(`/api/v1/warehouse_folders/${id}`, {
        warehouse_folder: { warehouse_type_id },
      });
    },
  });

  const openCreateDialog = () => {
    setEditingType(null);
    setFormData(defaultFormData);
    setWarehouseFolderToggles([]);
    setIsDialogOpen(true);
  };

  // SSoT: folder_path_template stores the full path (e.g., "User/{{UserName}}")
  // but the editor shows display_name as a greyed-out prefix, so we strip
  // the first segment on load and prepend display_name on save.
  const stripRootSegment = (template: string) => {
    if (!template) return "";
    const slashIdx = template.indexOf("/");
    if (slashIdx === -1) return ""; // Single segment = just the root, suffix is empty
    return template.slice(slashIdx + 1);
  };

  const openEditDialog = async (type: WarehouseType) => {
    setEditingType(type);

    setFormData({
      code: type.code,
      display_name: type.display_name,
      description: type.description || "",
      icon_name: type.icon_name || "",
      folder_path_template: stripRootSegment(type.folder_path_template || ""),
      enabled: type.enabled,
      order_position: type.order_position,
    });

    // Fetch ALL warehouse folders (not filtered by type) so user can reassign them
    // Build tree structure to show only root folders with inheritance
    try {
      const response = await api.get<{ success: boolean; data: { tabs: Array<{ id: number; name: string; parent_id: number | null; enabled: boolean; is_system: boolean; warehouse_type_id: number; warehouse_type_name: string }> } }>(
        `/api/v1/warehouse_folders?include_disabled=true`
      );
      const folders: FlatFolder[] = response?.data?.tabs || [];
      if (folders.length > 0) {
        // Store all folders for tree rendering
        setAllFolders(folders);

        // Build a map for quick lookups
        const folderMap = new Map(folders.map(bf => [bf.id, bf]));

        // Recursive function to get all descendant IDs
        const getDescendantIds = (folderId: number): number[] => {
          const children = folders.filter(bf => bf.parent_id === folderId);
          return children.flatMap(c => [c.id, ...getDescendantIds(c.id)]);
        };

        // Only include root folders (parent_id is null) in toggles
        const rootFolders = folders.filter(bf => bf.parent_id === null);
        setWarehouseFolderToggles(
          rootFolders.map((bf) => {
            const childIds = getDescendantIds(bf.id);
            const allIds = [bf.id, ...childIds];
            // Folder is "enabled" if it AND all children belong to this warehouse type
            const allAssigned = allIds.every(id =>
              folderMap.get(id)?.warehouse_type_id === type.id
            );
            return {
              id: bf.id,
              name: bf.name,
              enabled: allAssigned,
              is_system: bf.is_system,
              warehouse_type_id: bf.warehouse_type_id,
              warehouse_type_name: bf.warehouse_type_name,
              parent_id: bf.parent_id,
              children_ids: childIds,
            };
          })
        );
      }
    } catch (err) {
      console.error("Failed to fetch warehouse folders:", err);
      setWarehouseFolderToggles([]);
    }

    setExpandedGroups(new Set([type.display_name]));
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingType(null);
    setFormData(defaultFormData);
    setWarehouseFolderToggles([]);
    setAllFolders([]);
    setExpandedGroups(new Set());
    setExpandedFolders(new Set());
    setFolderTypeFilter("all");
    setWarehouseFolderSearch("");
    setShowAvailableFolders(false);
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();

    const dataToSave = { ...formData };

    // SSoT: Reconstruct full folder_path_template by prepending display_name
    // Editor only stores the suffix (e.g., "{{UserName}}"), we prepend root (e.g., "User")
    const suffix = dataToSave.folder_path_template?.trim();
    dataToSave.folder_path_template = suffix
      ? `${dataToSave.display_name}/${suffix}`
      : dataToSave.display_name;

    // Update warehouse folder assignments using the dedicated endpoint
    // This handles BOTH adding AND removing folders from this warehouse type
    // When a root folder is selected, include ALL its children (inheritance)
    // Skip for corporate/job/contact types - those are managed via their own config pages
    // Only manages unassigned + own-type folders to avoid touching other types' assignments
    if (editingType && !["corporate", "job", "contact"].includes(editingType.code) && warehouseFolderToggles.length > 0) {
      const selectedFolderIds = warehouseFolderToggles
        .filter(bf => bf.enabled && (bf.warehouse_type_name === "Unassigned" || bf.warehouse_type_id === editingType.id))
        .flatMap(bf => [bf.id, ...bf.children_ids]);  // Include children

      try {
        await api.patch(`/api/v1/warehouse_types/${editingType.id}/update_warehouse_folders`, {
          warehouse_folder_ids: selectedFolderIds,
        });
      } catch (err: any) {
        console.error("Failed to update warehouse folder assignments:", err);
        toast.error(`Failed to update folder assignments: ${err?.message || "Unknown error"}`);
        return; // Don't continue if warehouse folder update fails
      }
    }

    if (editingType) {
      updateMutation.mutate({ id: editingType.id, data: dataToSave });
    } else {
      createMutation.mutate(dataToSave);
    }
  };

  const toggleWarehouseFolder = (folderId: number) => {
    setWarehouseFolderToggles((prev) =>
      prev.map((bf) =>
        bf.id === folderId ? { ...bf, enabled: !bf.enabled } : bf
      )
    );
  };

  const toggleGroupExpanded = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  const toggleFolderExpanded = (folderId: number) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Get direct children of a root folder from allFolders
  const getDirectChildren = (rootId: number): FlatFolder[] => {
    return allFolders.filter(f => f.parent_id === rootId);
  };

  // Map a warehouse_type_name to a primary tab category
  const getFolderCategory = React.useCallback((warehouseTypeName: string): string => {
    if (PRIMARY_FOLDER_TABS.includes(warehouseTypeName as any)) return warehouseTypeName;
    return "System";
  }, []);

  // Count folders per primary category (root + children)
  const folderCategoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = { Corporate: 0, Job: 0, Contact: 0, System: 0 };
    for (const toggle of warehouseFolderToggles) {
      const cat = getFolderCategory(toggle.warehouse_type_name || "Unassigned");
      counts[cat] = (counts[cat] || 0) + 1 + toggle.children_ids.length;
    }
    return counts;
  }, [warehouseFolderToggles, getFolderCategory]);

  const handleDelete = (type: WarehouseType) => {
    if (!type.can_delete) {
      toast.error("This warehouse type cannot be deleted");
      return;
    }
    if (confirm(`Delete warehouse type "${type.display_name}"?`)) {
      deleteMutation.mutate(type.id);
    }
  };

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

  // Filter and sort warehouse types
  // SSoT: All hooks MUST be called before any early returns (React Rules of Hooks)
  const rawTypes = data?.data || [];
  const summary = data?.summary;

  const warehouseTypes = React.useMemo(() => {
    let filtered = rawTypes;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (type) =>
          type.code.toLowerCase().includes(query) ||
          type.display_name.toLowerCase().includes(query) ||
          type.description?.toLowerCase().includes(query) ||
          type.warehouse_folders.some((bf) => bf.name.toLowerCase().includes(query))
      );
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "code":
          comparison = a.code.localeCompare(b.code);
          break;
        case "display_name":
          comparison = a.display_name.localeCompare(b.display_name);
          break;
        case "folder_path_template":
          comparison = (a.folder_path_template || "").localeCompare(b.folder_path_template || "");
          break;
        case "warehouse_folders_count":
          comparison = a.warehouse_folders.length - b.warehouse_folders.length;
          break;
        case "enabled":
          comparison = (a.enabled === b.enabled) ? 0 : a.enabled ? -1 : 1;
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [rawTypes, searchQuery, sortField, sortDirection]);

  // Early returns AFTER all hooks (React Rules of Hooks)
  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (error) {
    return (
      <div className="text-destructive p-4">
        Failed to load warehouse types: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Warehouse Types</h2>
          <p className="text-sm text-muted-foreground">
            Configure warehouse types for document storage and organization
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search types..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-[200px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="show-system"
              checked={showSystemTypes}
              onCheckedChange={setShowSystemTypes}
            />
            <Label htmlFor="show-system" className="text-sm">
              Show system types
            </Label>
          </div>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Type
          </Button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>Total: {rawTypes.length}</span>
          {searchQuery && <span>Showing: {warehouseTypes.length}</span>}
          <span>Enabled: {summary.enabled}</span>
          <span>System: {summary.system}</span>
          <span>Custom: {summary.custom}</span>
        </div>
      )}

      {/* Table - with explicit row borders */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="w-[120px] cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("code")}
              >
                <div className="flex items-center">
                  Code
                  {getSortIcon("code")}
                </div>
              </TableHead>
              <TableHead
                className="w-[120px] cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("display_name")}
              >
                <div className="flex items-center">
                  Display Name
                  {getSortIcon("display_name")}
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
              <TableHead
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort("warehouse_folders_count")}
              >
                <div className="flex items-center">
                  Warehouse Folders
                  {getSortIcon("warehouse_folders_count")}
                </div>
              </TableHead>
              <TableHead
                className="w-[100px] cursor-pointer hover:bg-muted/50"
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
            {warehouseTypes.map((type) => (
              <TableRow key={type.id} className="[&_td]:border-b [&_td]:border-border">
                <TableCell className="font-mono text-sm align-top py-2">
                  {type.code}
                  {type.is_system && (
                    <Lock className="h-3 w-3 inline ml-1 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="align-top py-2">
                  <div className="flex flex-col">
                    <span>{type.display_name}</span>
                    {type.description && (
                      <span className="text-xs text-muted-foreground">
                        {type.description}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground align-top py-2">
                  {(() => {
                    const tpl = type.folder_path_template;
                    if (!tpl) return <span className="opacity-50">{type.display_name}/</span>;
                    const slashIdx = tpl.indexOf('/');
                    if (slashIdx === -1) return <span className="opacity-50">{type.display_name}/</span>;
                    // SSoT: Show display_name as the root (greyed), then the suffix tokens
                    const suffix = tpl.slice(slashIdx);
                    return (
                      <>
                        <span className="opacity-50">{type.display_name}</span>
                        {suffix}
                      </>
                    );
                  })()}
                </TableCell>
                <TableCell className="align-top py-2">
                  {(() => {
                    const folders = type.warehouse_folders;
                    if (folders.length === 0) return <span className="text-muted-foreground text-xs">-</span>;
                    const roots = folders.filter(f => !f.parent_id);
                    const getChildren = (parentId: number) => folders.filter(f => f.parent_id === parentId);
                    const nonRoots = folders.length - roots.length;
                    return (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary" className="text-xs">{folders.length}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {roots.length} root{nonRoots > 0 && ` + ${nonRoots} sub`}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {roots.map((bf) => {
                            const kids = getChildren(bf.id);
                            return (
                              <React.Fragment key={bf.id}>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-normal py-0 bg-muted"
                                >
                                  <Folder className="h-2.5 w-2.5 mr-0.5" />
                                  {bf.name}
                                  {kids.length > 0 && (
                                    <span className="text-muted-foreground ml-0.5">({kids.length})</span>
                                  )}
                                </Badge>
                                {kids.map((child) => {
                                  const grandkids = getChildren(child.id);
                                  return (
                                    <React.Fragment key={child.id}>
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] font-normal py-0 bg-muted/30"
                                      >
                                        <span className="text-muted-foreground mr-0.5">└</span>
                                        {child.name}
                                        {grandkids.length > 0 && (
                                          <span className="text-muted-foreground ml-0.5">({grandkids.length})</span>
                                        )}
                                      </Badge>
                                      {grandkids.map((gk) => (
                                        <Badge
                                          key={gk.id}
                                          variant="outline"
                                          className="text-[10px] font-normal py-0 text-muted-foreground"
                                        >
                                          <span className="mr-0.5">└└</span>
                                          {gk.name}
                                        </Badge>
                                      ))}
                                    </React.Fragment>
                                  );
                                })}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell className="align-top py-2">
                  <Badge variant={type.enabled ? "default" : "outline"}>
                    {type.enabled ? "Yes" : "No"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right align-top py-2">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(type)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {type.can_delete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(type)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {warehouseTypes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? `No types matching "${searchQuery}"` : "No warehouse types found"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Edit Warehouse Type" : "Create Warehouse Type"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, code: e.target.value.toLowerCase() }))
                    }
                    placeholder="e.g., job"
                    disabled={editingType?.is_system}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, display_name: e.target.value }))
                    }
                    placeholder="e.g., Job"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Optional description"
                  rows={1}
                  className="min-h-[36px] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="icon_name">Icon Name</Label>
                  <Input
                    id="icon_name"
                    value={formData.icon_name}
                    onChange={(e) =>
                      setFormData(prev => ({ ...prev, icon_name: e.target.value }))
                    }
                    placeholder="e.g., Briefcase"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="enabled"
                      checked={formData.enabled}
                      onCheckedChange={(checked) =>
                        setFormData(prev => ({ ...prev, enabled: checked as boolean }))
                      }
                    />
                    <Label htmlFor="enabled">Enabled</Label>
                  </div>
                </div>
              </div>

              {/* Folder Path Template - SSoT: Uses PlaceholderBuilder (THE ONE component) */}
              <PlaceholderBuilder
                label="Folder Path Template"
                value={formData.folder_path_template}
                onChange={(value) => setFormData(prev => ({ ...prev, folder_path_template: value }))}
                scope={getWarehouseScopeForType(formData.code)}
                separator="/"
                showPreview
                prefixValue={formData.display_name}
              />

              {/* Warehouse Folders - Tree View (only show when editing, hidden for corporate/job/contact - managed via their own config pages) */}
              {editingType && !["corporate", "job", "contact"].includes(editingType.code) && warehouseFolderToggles.length > 0 && (() => {
                const searchTerm = warehouseFolderSearch.toLowerCase().trim();
                // Only show folders that are unassigned OR already belong to this type
                const availableToggles = warehouseFolderToggles.filter(
                  t => t.warehouse_type_name === "Unassigned" || t.warehouse_type_id === editingType.id
                );

                // Check if a root folder matches search filter
                // Also matches if any child folder name matches the search
                const rootMatchesFilter = (toggle: WarehouseFolderToggle): boolean => {
                  // Search - match root name OR any child name
                  if (searchTerm) {
                    if (toggle.name.toLowerCase().includes(searchTerm)) return true;
                    const children = getDirectChildren(toggle.id);
                    return children.some(c => c.name.toLowerCase().includes(searchTerm));
                  }
                  return true;
                };

                const filteredToggles = availableToggles
                  .filter(rootMatchesFilter)
                  .sort((a, b) => {
                    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
                    return a.name.localeCompare(b.name);
                  });

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Warehouse Folders</Label>
                      <span className="text-xs text-muted-foreground">
                        {availableToggles
                          .filter(bf => bf.enabled)
                          .reduce((sum, bf) => sum + 1 + bf.children_ids.length, 0)} folders assigned
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground -mt-1">
                      Selecting a root folder includes all its subfolders
                    </p>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search folders..."
                        value={warehouseFolderSearch}
                        onChange={(e) => setWarehouseFolderSearch(e.target.value)}
                        className="pl-8 h-9"
                      />
                    </div>

                    {/* Tree view - grouped by warehouse type */}
                    <div className="border rounded-md max-h-[300px] overflow-y-auto">
                      {(() => {
                        // Group filtered folders by their warehouse type
                        const groups = new Map<string, WarehouseFolderToggle[]>();
                        for (const toggle of filteredToggles) {
                          const typeName = toggle.warehouse_type_name || "Unassigned";
                          if (!groups.has(typeName)) groups.set(typeName, []);
                          groups.get(typeName)!.push(toggle);
                        }

                        // Sort groups: editing type first, then alphabetically
                        const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
                          if (a === editingType?.display_name) return -1;
                          if (b === editingType?.display_name) return 1;
                          return a.localeCompare(b);
                        });

                        if (sortedGroups.length === 0) {
                          return (
                            <div className="p-3 text-center text-xs text-muted-foreground">
                              No folders match your filter
                            </div>
                          );
                        }

                        return sortedGroups.map(([typeName, folders]) => {
                          const isExpanded = expandedGroups.has(typeName) || !!searchTerm;
                          const isEditingTypeGroup = typeName === editingType?.display_name;
                          const assignedCount = folders.filter(f => f.enabled).length;
                          const sortedFolders = [...folders].sort((a, b) => a.name.localeCompare(b.name));

                          return (
                            <div key={typeName}>
                              {/* Group header - warehouse type name */}
                              <button
                                type="button"
                                onClick={() => toggleGroupExpanded(typeName)}
                                className={cn(
                                  "flex items-center gap-1.5 w-full px-2 py-1.5 text-left hover:bg-muted/50 border-b border-border/50",
                                  isEditingTypeGroup && "bg-primary/5"
                                )}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                )}
                                <span className={cn(
                                  "text-xs font-semibold uppercase tracking-wide",
                                  isEditingTypeGroup && "text-primary"
                                )}>
                                  {typeName}
                                </span>
                                <span className="text-[10px] text-muted-foreground ml-auto">
                                  {assignedCount > 0 ? `${assignedCount}/${folders.length}` : `${folders.length}`}
                                </span>
                              </button>

                              {/* Folder rows under this type */}
                              {isExpanded && sortedFolders.map((bf, idx) => {
                                const isLastRoot = idx === sortedFolders.length - 1;
                                const children = getDirectChildren(bf.id);
                                const hasChildren = children.length > 0;
                                const isFolderExpanded = expandedFolders.has(bf.id) || !!searchTerm;
                                const sortedChildren = [...children].sort((a, b) => a.name.localeCompare(b.name));

                                return (
                                  <React.Fragment key={bf.id}>
                                    <div
                                      className={cn(
                                        "flex items-center gap-1.5 pl-5 pr-2 py-1 hover:bg-muted/50",
                                        !(isLastRoot && !isFolderExpanded) && "border-b border-border/30",
                                        !bf.enabled && "opacity-60"
                                      )}
                                    >
                                      <span className="text-border text-xs font-mono shrink-0 w-4 text-center select-none">
                                        {isLastRoot ? "└" : "├"}
                                      </span>
                                      {hasChildren ? (
                                        <button
                                          type="button"
                                          onClick={() => toggleFolderExpanded(bf.id)}
                                          className="shrink-0 p-0 h-4 w-4 flex items-center justify-center hover:bg-muted rounded"
                                        >
                                          {isFolderExpanded
                                            ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                            : <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                          }
                                        </button>
                                      ) : (
                                        <span className="shrink-0 w-4" />
                                      )}
                                      <Checkbox
                                        id={`bf-${bf.id}`}
                                        checked={bf.enabled}
                                        onCheckedChange={() => toggleWarehouseFolder(bf.id)}
                                      />
                                      <label
                                        htmlFor={`bf-${bf.id}`}
                                        className="flex items-center gap-1 text-sm cursor-pointer flex-1 min-w-0"
                                      >
                                        <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span className={cn(
                                          "truncate",
                                          searchTerm && bf.name.toLowerCase().includes(searchTerm) && "font-medium text-foreground"
                                        )}>
                                          {bf.name}
                                        </span>
                                        {hasChildren && (
                                          <span className="text-[10px] text-muted-foreground ml-1">
                                            ({children.length})
                                          </span>
                                        )}
                                      </label>
                                    </div>
                                    {/* Child folders (sub-tabs) - no checkboxes, inherit from parent */}
                                    {hasChildren && isFolderExpanded && sortedChildren.map((child, cIdx) => {
                                      const isLastChild = cIdx === sortedChildren.length - 1;
                                      return (
                                        <div
                                          key={child.id}
                                          className={cn(
                                            "flex items-center gap-1.5 pl-14 pr-2 py-0.5 hover:bg-muted/30",
                                            !(isLastRoot && isLastChild) && "border-b border-border/20",
                                            !bf.enabled && "opacity-50"
                                          )}
                                        >
                                          <span className="text-border/60 text-xs font-mono shrink-0 w-4 text-center select-none">
                                            {isLastChild ? "└" : "├"}
                                          </span>
                                          <Folder className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                                          <span className={cn(
                                            "text-xs text-muted-foreground truncate",
                                            searchTerm && child.name.toLowerCase().includes(searchTerm) && "font-medium text-foreground"
                                          )}>
                                            {child.name}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                );
              })()}

            </div>

            <DialogFooter className="pt-4 mt-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={createMutation.isPending || updateMutation.isPending}
                onClick={(e) => handleSubmit(e)}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : editingType
                  ? "Update"
                  : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
