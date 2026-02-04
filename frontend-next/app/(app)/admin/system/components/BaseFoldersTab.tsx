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
import { toast } from "sonner";

type SortField = "warehouse_type_name" | "name" | "folder_path_template" | "warehouse_folders_count" | "enabled";
type SortDirection = "asc" | "desc";

/**
 * BaseFoldersTab - Manage base folders for warehouse types
 *
 * SSoT: Database-driven base folders (Feb 2026)
 * Each WarehouseType has one or more BaseFolders with path templates
 */

interface WarehouseType {
  id: number;
  code: string;
  display_name: string;
}

interface BaseFolder {
  id: number;
  warehouse_type_id: number;
  warehouse_type_code: string;
  warehouse_type_name: string;
  name: string;
  folder_path_template?: string;
  full_path_template?: string;
  path_preview?: string;
  is_system: boolean;
  enabled: boolean;
  order_position: number;
  warehouse_folders_count: number;
  can_delete: boolean;
  is_dynamic?: boolean;
  dynamic_type?: string;
  created_at: string;
  updated_at: string;
}

interface BaseFoldersResponse {
  success: boolean;
  data: BaseFolder[];
}

interface WarehouseTypesOptionsResponse {
  success: boolean;
  data: Array<{ value: number; label: string; code: string; base_path: string }>;
}

interface FormData {
  warehouse_type_id: number | null;
  name: string;
  folder_path_template: string;
  enabled: boolean;
  order_position: number;
}

const defaultFormData: FormData = {
  warehouse_type_id: null,
  name: "",
  folder_path_template: "",
  enabled: true,
  order_position: 0,
};

export function BaseFoldersTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [editingFolder, setEditingFolder] = React.useState<BaseFolder | null>(null);
  const [formData, setFormData] = React.useState<FormData>(defaultFormData);
  const [filterWarehouseType, setFilterWarehouseType] = React.useState<string>("all");
  const [showDisabled, setShowDisabled] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortField, setSortField] = React.useState<SortField>("warehouse_type_name");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");
  const [collapsedTypes, setCollapsedTypes] = React.useState<Set<string>>(new Set());

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

  // Fetch base folders
  const { data, isLoading, error } = useQuery({
    queryKey: ["base-folders", filterWarehouseType, showDisabled],
    queryFn: async () => {
      let url = "/api/v1/base_folders";
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

      const response = await api.get<BaseFoldersResponse>(url);
      return response;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return api.post<{ success: boolean; data: BaseFolder }>("/api/v1/base_folders", {
        base_folder: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["base-folders"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-types"] });
      toast.success("Base folder created successfully");
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(`Failed to create: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      return api.patch<{ success: boolean; data: BaseFolder }>(`/api/v1/base_folders/${id}`, {
        base_folder: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["base-folders"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-types"] });
      toast.success("Base folder updated successfully");
      closeDialog();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete<{ success: boolean }>(`/api/v1/base_folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["base-folders"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse-types"] });
      toast.success("Base folder deleted successfully");
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

  const openEditDialog = (folder: BaseFolder) => {
    setEditingFolder(folder);
    // SSoT (Feb 2026): name IS the folder path - one field serves both purposes
    setFormData({
      warehouse_type_id: folder.warehouse_type_id,
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

  const handleDelete = (folder: BaseFolder) => {
    if (!folder.can_delete) {
      toast.error("This base folder cannot be deleted");
      return;
    }
    if (confirm(`Delete base folder "${folder.name}"?`)) {
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

  // Filter and sort base folders
  // SSoT: All hooks MUST be called before any early returns (React Rules of Hooks)
  const rawFolders = data?.data || [];

  const baseFolders = React.useMemo(() => {
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
    baseFolders.forEach(f => {
      types.add(f.warehouse_type_name || f.warehouse_type_code || "Unassigned");
    });
    return types;
  }, [baseFolders]);

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
        Failed to load base folders: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Base Folders</h2>
          <p className="text-sm text-muted-foreground">
            Configure base folder paths and templates for each warehouse type
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
        {searchQuery && <span>Showing: {baseFolders.length}</span>}
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
                  Folders
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
              // Group folders by warehouse type
              const grouped = baseFolders.reduce((acc, folder) => {
                const type = folder.warehouse_type_name || folder.warehouse_type_code || "Unassigned";
                if (!acc[type]) acc[type] = [];
                acc[type].push(folder);
                return acc;
              }, {} as Record<string, BaseFolder[]>);

              // Sort types alphabetically
              const sortedTypes = Object.keys(grouped).sort();

              return sortedTypes.map((typeName) => {
                const isCollapsed = collapsedTypes.has(typeName);
                return (
                <React.Fragment key={typeName}>
                  {/* Type Header Row - Clickable */}
                  <TableRow
                    className="bg-muted/50 hover:bg-muted cursor-pointer"
                    onClick={() => toggleTypeCollapse(typeName)}
                  >
                    <TableCell colSpan={6} className="py-2">
                      <div className="flex items-center gap-2">
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Badge variant="outline" className="font-medium">
                          {typeName}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({grouped[typeName].length} folder{grouped[typeName].length !== 1 ? "s" : ""})
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                  {/* Folder Rows - Collapsible */}
                  {!isCollapsed && grouped[typeName].map((folder) => (
                    <TableRow key={folder.id}>
                      <TableCell className="font-medium pl-6">
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
                  ))}
                </React.Fragment>
              );
              });
            })()}
            {baseFolders.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? `No folders matching "${searchQuery}"` : "No base folders found"}
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
            <DialogTitle>
              {editingFolder ? "Edit Base Folder" : "Create Base Folder"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="warehouse_type_id">Warehouse Type</Label>
                <Select
                  value={formData.warehouse_type_id?.toString() || ""}
                  onValueChange={(val) => {
                    const selectedId = parseInt(val);
                    setFormData({ ...formData, warehouse_type_id: selectedId });
                  }}
                  disabled={editingFolder?.is_system}
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

              {/* Full path preview - uses name as folder path */}
              {(() => {
                const selectedType = warehouseTypeOptions.find(wt => wt.value === formData.warehouse_type_id);
                const rawBasePath = selectedType?.base_path || '';
                const rawName = formData.name || '';
                if (!rawBasePath || !rawName) return null;
                // Build full path, normalizing slashes
                const fullPath = [rawBasePath, rawName]
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
                    if (confirm(`Delete base folder "${editingFolder.name}"?`)) {
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
