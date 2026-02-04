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
import { Plus, Pencil, Trash2, Lock, Folder, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";

type SortField = "code" | "display_name" | "folder_path_template" | "base_folders_count" | "enabled";
type SortDirection = "asc" | "desc";

/**
 * WarehouseTypesTab - Manage warehouse types and base folders
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
  base_folders_count: number;
  base_folders: BaseFolder[];
  can_delete: boolean;
  created_at: string;
  updated_at: string;
}

interface BaseFolder {
  id: number;
  name: string;
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

  const openCreateDialog = () => {
    setEditingType(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (type: WarehouseType) => {
    setEditingType(type);

    // Strip the display_name prefix from folder_path_template for editing
    let pathWithoutPrefix = type.folder_path_template || "";
    const prefix = `${type.display_name}/`;
    if (pathWithoutPrefix.startsWith(prefix)) {
      pathWithoutPrefix = pathWithoutPrefix.slice(prefix.length);
    } else if (pathWithoutPrefix === type.display_name) {
      pathWithoutPrefix = "";
    }

    setFormData({
      code: type.code,
      display_name: type.display_name,
      description: type.description || "",
      icon_name: type.icon_name || "",
      folder_path_template: pathWithoutPrefix,
      enabled: type.enabled,
      order_position: type.order_position,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingType(null);
    setFormData(defaultFormData);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Build full path with display_name prefix
    const dataToSave = {
      ...formData,
      folder_path_template: formData.folder_path_template
        ? `${formData.display_name}/${formData.folder_path_template}`
        : formData.display_name || "",
    };

    if (editingType) {
      updateMutation.mutate({ id: editingType.id, data: dataToSave });
    } else {
      createMutation.mutate(dataToSave);
    }
  };

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
          type.base_folders.some((bf) => bf.name.toLowerCase().includes(query))
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
        case "base_folders_count":
          comparison = a.base_folders.length - b.base_folders.length;
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
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
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

      {/* Table */}
      <div className="border rounded-lg">
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
                onClick={() => handleSort("base_folders_count")}
              >
                <div className="flex items-center">
                  Base Folders
                  {getSortIcon("base_folders_count")}
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
              <TableRow key={type.id}>
                <TableCell className="font-mono text-sm">
                  {type.code}
                  {type.is_system && (
                    <Lock className="h-3 w-3 inline ml-1 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{type.display_name}</span>
                    {type.description && (
                      <span className="text-xs text-muted-foreground">
                        {type.description}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {type.folder_path_template || "-"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {type.base_folders.length > 0 ? (
                      type.base_folders.map((bf) => (
                        <Badge
                          key={bf.id}
                          variant="secondary"
                          className="text-xs font-normal"
                        >
                          <Folder className="h-3 w-3 mr-1" />
                          {bf.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={type.enabled ? "default" : "outline"}>
                    {type.enabled ? "Yes" : "No"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
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
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toLowerCase() })
                  }
                  placeholder="e.g., job, contact, email"
                  disabled={editingType?.is_system}
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and underscores only
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={formData.display_name}
                  onChange={(e) =>
                    setFormData({ ...formData, display_name: e.target.value })
                  }
                  placeholder="e.g., Job, Contact, Email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Optional description"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="icon_name">Icon Name</Label>
                <Input
                  id="icon_name"
                  value={formData.icon_name}
                  onChange={(e) =>
                    setFormData({ ...formData, icon_name: e.target.value })
                  }
                  placeholder="e.g., Briefcase, FileText"
                />
                <p className="text-xs text-muted-foreground">
                  Lucide icon name (optional)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="folder_path_template">Folder Path Template</Label>
                <div className="flex items-center gap-0">
                  {/* Fixed prefix showing warehouse type name */}
                  <div className="px-3 py-2 text-sm font-mono bg-muted border border-r-0 rounded-l-md text-muted-foreground">
                    {formData.display_name || "TypeName"}/
                  </div>
                  <Input
                    id="folder_path_template"
                    value={formData.folder_path_template}
                    onChange={(e) =>
                      setFormData({ ...formData, folder_path_template: e.target.value })
                    }
                    placeholder="{{TaskId}}/{{TaskName}}"
                    className="font-mono text-sm rounded-l-none"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Full path: <code className="bg-muted px-1 rounded">{formData.display_name || "TypeName"}/{formData.folder_path_template || "..."}</code>
                </p>
                <div className="text-xs text-muted-foreground space-y-2">
                  <p>Click tokens to add:</p>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { token: "{{JobCode}}", label: "JobCode" },
                      { token: "{{JobName}}", label: "JobName" },
                      { token: "{{ContactName}}", label: "ContactName" },
                      { token: "{{CompanyCode}}", label: "CompanyCode" },
                      { token: "{{CompanyGroup}}", label: "CompanyGroup" },
                      { token: "{{UserName}}", label: "UserName" },
                      { token: "{{TaskId}}", label: "TaskId" },
                      { token: "{{TaskName}}", label: "TaskName" },
                      { token: "{{CaseId}}", label: "CaseId" },
                      { token: "{{CaseName}}", label: "CaseName" },
                      { token: "{{AssetCode}}", label: "AssetCode" },
                      { token: "{{Mailbox}}", label: "Mailbox" },
                      { token: "{{Year}}", label: "Year" },
                      { token: "{{Month}}", label: "Month" },
                    ].map(({ token, label }) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => {
                          const current = formData.folder_path_template;
                          let newPath: string;
                          if (!current) {
                            newPath = token;
                          } else if (current.endsWith("/")) {
                            newPath = current + token;
                          } else {
                            newPath = current + "/" + token;
                          }
                          setFormData({ ...formData, folder_path_template: newPath });
                        }}
                        className="px-2 py-0.5 text-[10px] font-mono bg-muted hover:bg-muted/80 rounded border cursor-pointer transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
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
