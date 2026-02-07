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
import { Plus, Pencil, Trash2, Lock, Folder, Search, ArrowUpDown, ArrowUp, ArrowDown, Briefcase, Mail, Building2, Calendar, FileText, ListFilter, Wrench, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  STORAGE_PLACEHOLDERS,
  type PlaceholderToken,
  PLACEHOLDER_COLOR_CLASSES,
} from "@/lib/placeholders";

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

// =====================================================================
// SSoT: Category filter for folder path tokens (Feb 2026)
// Uses STORAGE_PLACEHOLDERS from lib/placeholders.ts as the gold standard
// Matches PlaceholderPalette component for consistent UX
// =====================================================================
type TokenCategory = "all" | "job" | "task" | "email" | "company" | "date" | "folder" | "other";

interface TokenCategoryConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  match: (token: PlaceholderToken) => boolean;
}

const TOKEN_CATEGORY_CONFIG: Record<TokenCategory, TokenCategoryConfig> = {
  all: {
    label: "All",
    icon: ListFilter,
    color: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
    match: () => true,
  },
  job: {
    label: "Job",
    icon: Briefcase,
    color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700",
    match: (t) => /\{?\{?Job|LotNumber|StreetName|Suburb|Project/i.test(t.code),
  },
  task: {
    label: "Task",
    icon: Wrench,
    color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700",
    match: (t) => /\{?\{?Task|Attachment|Response|\[\[Attachment|\[\[Response/i.test(t.code),
  },
  email: {
    label: "Email",
    icon: Mail,
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
    match: (t) => /\{?\{?Subject|Sender|Received|Mailbox|\[\[Email/i.test(t.code),
  },
  company: {
    label: "Company",
    icon: Building2,
    color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700",
    match: (t) => /\{?\{?Company|Person|Contact|User|Account|Asset|Bank|BSB|Loan|Lender/i.test(t.code),
  },
  date: {
    label: "Date",
    icon: Calendar,
    color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700",
    match: (t) => /\{?\{?Date|Year|Month|Time|Day|FY|Period|YYYY|DDMM|\{EX\}|Expiry/i.test(t.code),
  },
  folder: {
    label: "Doc",
    icon: FileText,
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
    match: (t) => /DocType|\{BA\}|\{FIA\}|\{Occ\}|BuildingApproval|FinalInspection|Certificate|FormNumber|Invoice|PONum|PONumber/i.test(t.code),
  },
  other: {
    label: "Other",
    icon: Folder,
    color: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
    match: () => true, // Fallback for uncategorized
  },
};

// Get category for a token (matches PlaceholderPalette logic)
function getTokenCategory(token: PlaceholderToken): TokenCategory {
  // Check in priority order (more specific first)
  // Email before task so [[Email Attachments]] categorizes as email not task
  if (TOKEN_CATEGORY_CONFIG.email.match(token)) return "email";
  if (TOKEN_CATEGORY_CONFIG.task.match(token)) return "task";
  if (TOKEN_CATEGORY_CONFIG.job.match(token)) return "job";
  if (TOKEN_CATEGORY_CONFIG.company.match(token)) return "company";
  if (TOKEN_CATEGORY_CONFIG.date.match(token)) return "date";
  if (TOKEN_CATEGORY_CONFIG.folder.match(token)) return "folder";
  if (TOKEN_CATEGORY_CONFIG.other.match(token)) return "other";
  return "other";
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
  const [warehouseFolderSearch, setWarehouseFolderSearch] = React.useState("");
  const [tokenCategory, setTokenCategory] = React.useState<TokenCategory>("all");
  const [tokensExpanded, setTokensExpanded] = React.useState(false);
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

  const openEditDialog = async (type: WarehouseType) => {
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

    // Fetch ALL warehouse folders (not filtered by type) so user can reassign them
    // Build tree structure to show only root folders with inheritance
    try {
      const response = await api.get<{ success: boolean; data: { tabs: Array<{ id: number; name: string; parent_id: number | null; enabled: boolean; is_system: boolean; warehouse_type_id: number; warehouse_type_name: string }> } }>(
        `/api/v1/warehouse_folders?include_disabled=true`
      );
      const folders = response?.data?.tabs || [];
      if (folders.length > 0) {
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

    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingType(null);
    setFormData(defaultFormData);
    setWarehouseFolderToggles([]);
    setWarehouseFolderSearch("");
    setShowAvailableFolders(false);
  };

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();

    // Build full path with display_name prefix
    const dataToSave = {
      ...formData,
      folder_path_template: formData.folder_path_template
        ? `${formData.display_name}/${formData.folder_path_template}`
        : formData.display_name || "",
    };

    // Update warehouse folder assignments using the dedicated endpoint
    // This handles BOTH adding AND removing folders from this warehouse type
    // When a root folder is selected, include ALL its children (inheritance)
    if (editingType && warehouseFolderToggles.length > 0) {
      const selectedFolderIds = warehouseFolderToggles
        .filter(bf => bf.enabled)
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
                  {type.folder_path_template || "-"}
                </TableCell>
                <TableCell className="align-top py-2">
                  <div className="flex flex-wrap gap-1">
                    {type.warehouse_folders.length > 0 ? (
                      type.warehouse_folders.map((bf) => (
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
                      setFormData(prev => ({ ...prev, folder_path_template: e.target.value }))
                    }
                    placeholder="{{TaskId}}/{{TaskName}}"
                    className="font-mono text-sm rounded-l-none"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Full path: <code className="bg-muted px-1 rounded">{formData.display_name || "TypeName"}/{formData.folder_path_template || "..."}</code>
                </p>
                <Collapsible open={tokensExpanded} onOpenChange={setTokensExpanded}>
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {tokensExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      <span>Tokens</span>
                      {!tokensExpanded && (
                        <span className="text-[10px]">
                          ({STORAGE_PLACEHOLDERS.filter(t => tokenCategory === "all" || getTokenCategory(t) === tokenCategory).length} available)
                        </span>
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="text-xs text-muted-foreground space-y-2 mt-2">
                    {/* Category Filter Buttons - SSoT (Feb 2026) */}
                    <div className="flex flex-wrap gap-1">
                      {(["all", "job", "task", "email", "company", "date", "folder", "other"] as TokenCategory[]).map((cat) => {
                        const config = TOKEN_CATEGORY_CONFIG[cat];
                        const Icon = config.icon;
                        const isActive = tokenCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setTokenCategory(cat)}
                            className={cn(
                              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border transition-all",
                              isActive
                                ? config.color + " ring-1 ring-offset-0 ring-primary/50"
                                : "bg-background hover:bg-muted text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/50"
                            )}
                          >
                            <Icon className="h-2.5 w-2.5" />
                            <span>{config.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {/* Token Buttons - SSoT: Uses STORAGE_PLACEHOLDERS from lib/placeholders.ts */}
                    <div className="flex flex-wrap">
                      {STORAGE_PLACEHOLDERS
                        .filter(t => tokenCategory === "all" || getTokenCategory(t) === tokenCategory)
                        .map((token) => {
                          const colorClasses = PLACEHOLDER_COLOR_CLASSES[token.color];
                          // Extract display label from code (remove braces)
                          const label = token.code.replace(/[\{\}\[\]]/g, "");
                          return (
                            <button
                              key={token.code}
                              type="button"
                              onClick={() => {
                                setFormData(prev => {
                                  const current = prev.folder_path_template;
                                  let newPath: string;
                                  if (!current) {
                                    newPath = token.code;
                                  } else if (current.endsWith("/")) {
                                    newPath = current + token.code;
                                  } else {
                                    newPath = current + "/" + token.code;
                                  }
                                  return { ...prev, folder_path_template: newPath };
                                });
                              }}
                              title={token.description || token.example}
                              className={cn(
                                "px-1.5 py-0.5 text-[10px] font-mono rounded border cursor-pointer transition-colors mr-1 mb-1",
                                colorClasses.bg,
                                colorClasses.text,
                                colorClasses.border,
                                "hover:opacity-80"
                              )}
                            >
                              {label}
                            </button>
                          );
                        })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              {/* Warehouse Folders - only show when editing */}
              {editingType && warehouseFolderToggles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Warehouse Folders</Label>
                    <span className="text-xs text-muted-foreground">
                      {/* Total count including children */}
                      {warehouseFolderToggles
                        .filter(bf => bf.enabled)
                        .reduce((sum, bf) => sum + 1 + bf.children_ids.length, 0)} folders assigned
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Selecting a folder includes all its subfolders
                  </p>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search folders..."
                      value={warehouseFolderSearch}
                      onChange={(e) => setWarehouseFolderSearch(e.target.value)}
                      className="pl-8 h-9"
                    />
                  </div>
                  <div className="border rounded-md p-2 max-h-[140px] overflow-y-auto">
                    {warehouseFolderToggles
                      .filter((bf) =>
                        warehouseFolderSearch.trim() === "" ||
                        bf.name.toLowerCase().includes(warehouseFolderSearch.toLowerCase())
                      )
                      .sort((a, b) => {
                        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
                        return a.name.localeCompare(b.name);
                      })
                      .map((bf) => (
                        <div
                          key={bf.id}
                          className={cn(
                            "flex items-center gap-2 hover:bg-muted/50 p-1 rounded",
                            !bf.enabled && "opacity-50"
                          )}
                        >
                          <Checkbox
                            id={`bf-${bf.id}`}
                            checked={bf.enabled}
                            onCheckedChange={() => toggleWarehouseFolder(bf.id)}
                          />
                          <label
                            htmlFor={`bf-${bf.id}`}
                            className="flex items-center gap-1 text-sm cursor-pointer flex-1 min-w-0"
                          >
                            <Folder className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{bf.name}</span>
                            {bf.children_ids.length > 0 && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                (+{bf.children_ids.length})
                              </span>
                            )}
                          </label>
                        </div>
                      ))}
                  </div>
                </div>
              )}

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
