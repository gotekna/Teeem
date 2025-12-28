"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Save,
  GripVertical,
  Folder,
  FolderPlus,
  Building2,
  Scale,
  Users,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Pencil
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useUrlState } from "@/hooks/useUrlState";

// Entity types
const ENTITY_TYPES = [
  { value: "trading_company", label: "Trading Company", icon: Building2, color: "blue" },
  { value: "trust", label: "Trust", icon: Scale, color: "purple" },
  { value: "trustee_company", label: "Trustee (Non-Trading)", icon: Users, color: "gray" }
];

// Initial folder/tab configuration
const INITIAL_FOLDERS = [
  {
    id: 1,
    name: "COMPANY",
    order: 1,
    entity_types: ["trading_company", "trustee_company"],
    description: "Company setup, structure, shareholding"
  },
  {
    id: 2,
    name: "XERO",
    order: 2,
    entity_types: ["trading_company", "trust"],
    description: "Xero integration, invoices, accounting"
  },
  {
    id: 3,
    name: "BANK",
    order: 3,
    entity_types: ["trading_company", "trust"],
    description: "Bank statements, accounts"
  },
  {
    id: 4,
    name: "ATO",
    order: 4,
    entity_types: ["trading_company", "trust"],
    description: "Tax returns, BAS, tax documents"
  },
  {
    id: 5,
    name: "ASIC",
    order: 5,
    entity_types: ["trading_company", "trustee_company"],
    description: "ASIC filings, company changes"
  },
  {
    id: 6,
    name: "TRUST",
    order: 6,
    entity_types: ["trust"],
    description: "Trust deeds, distributions, trustee resolutions"
  },
  {
    id: 7,
    name: "REGISTRY",
    order: 7,
    entity_types: ["trading_company"],
    description: "Share registry, shareholding changes"
  },
  {
    id: 8,
    name: "DIVIDENDS",
    order: 8,
    entity_types: ["trading_company"],
    description: "Dividend payments and records"
  },
  {
    id: 9,
    name: "FINANCIALS",
    order: 9,
    entity_types: ["trading_company", "trust"],
    description: "Financial statements, reports"
  },
  {
    id: 10,
    name: "LOANS",
    order: 10,
    entity_types: ["trading_company", "trust"],
    description: "Loan agreements, lending documents"
  },
  {
    id: 11,
    name: "ASSETS",
    order: 11,
    entity_types: ["trading_company", "trust"],
    description: "Property, equipment, asset registers"
  },
  {
    id: 12,
    name: "INSURANCE",
    order: 12,
    entity_types: ["trading_company", "trust"],
    description: "Insurance policies, claims"
  },
  {
    id: 13,
    name: "MINUTES",
    order: 13,
    entity_types: ["trading_company", "trust", "trustee_company"],
    description: "Board/trustee meeting minutes"
  },
  {
    id: 14,
    name: "ADVICE",
    order: 14,
    entity_types: ["trading_company", "trust", "trustee_company"],
    description: "Professional advice (legal, accounting, etc.)"
  },
  {
    id: 15,
    name: "GENERAL",
    order: 15,
    entity_types: ["trading_company", "trust", "trustee_company"],
    description: "Miscellaneous documents"
  }
];

interface Folder {
  id: number;
  name: string;
  order_position: number;
  entity_types: string[];
  description: string;
  sharepoint_path?: string;  // Deprecated - kept for backwards compatibility
  computed_path?: string;    // SSoT: computed from template + folder hierarchy
  active: boolean;
  parent_id?: number | null;
  children?: Folder[];
}

export function FoldersTabsConfigTab() {
  const [folders, setFolders] = React.useState<Folder[]>([]);
  const [newFolderName, setNewFolderName] = React.useState("");
  const [newFolderDescription, setNewFolderDescription] = React.useState("");
  const [newFolderParentId, setNewFolderParentId] = React.useState<number | null>(null);
  const [selectedEntityType, setSelectedEntityType] = React.useState<string | null>(null);
  const [hasChanges, setHasChanges] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // URL state for expanded folders (back button works, bookmarkable)
  const [urlState, setUrlState] = useUrlState({
    expanded: [] as string[], // Folder IDs as strings
  });
  const expandedFolders = React.useMemo(() => new Set(urlState.expanded.map(Number)), [urlState.expanded]);

  const [editingFolderNameId, setEditingFolderNameId] = React.useState<number | null>(null);
  const [editingFolderNameValue, setEditingFolderNameValue] = React.useState("");

  // Get root folders (no parent)
  const rootFolders = React.useMemo(() =>
    folders.filter(f => !f.parent_id),
    [folders]
  );

  // Get children of a folder
  const getChildren = React.useCallback((parentId: number) =>
    folders.filter(f => f.parent_id === parentId),
    [folders]
  );

  // Toggle folder expansion (persisted to URL)
  const toggleExpanded = (folderId: number) => {
    const idStr = String(folderId);
    const currentExpanded = urlState.expanded;
    if (currentExpanded.includes(idStr)) {
      setUrlState({ expanded: currentExpanded.filter(id => id !== idStr) });
    } else {
      setUrlState({ expanded: [...currentExpanded, idStr] });
    }
  };

  // Fetch folders from API on mount
  React.useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      setIsLoading(true);
      const data = await api.get<{ success: boolean; data: Folder[] }>("/api/v1/document_folders?hierarchy=true");

      if (data.success) {
        // Flatten the hierarchy for display (include both parent and children)
        const flattenedFolders: Folder[] = [];
        data.data.forEach(folder => {
          flattenedFolders.push(folder);
          if (folder.children) {
            flattenedFolders.push(...folder.children);
          }
        });
        setFolders(flattenedFolders);
      }
    } catch (error) {
      console.error("Failed to fetch folders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const moveFolder = (index: number, direction: "up" | "down") => {
    const newFolders = [...folders];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newFolders.length) return;

    [newFolders[index], newFolders[targetIndex]] = [newFolders[targetIndex], newFolders[index]];

    // Update order values
    newFolders.forEach((folder, idx) => {
      folder.order_position = idx;
    });

    setFolders(newFolders);
    setHasChanges(true);
  };

  const addFolder = async (parentId?: number | null) => {
    if (!newFolderName.trim()) return;

    const effectiveParentId = parentId ?? newFolderParentId;
    const newFolder = {
      name: newFolderName.toUpperCase(),
      order_position: folders.length,
      entity_types: [],
      description: newFolderDescription,
      parent_id: effectiveParentId,
      active: true
    };

    try {
      const data = await api.post<{ success: boolean; data: Folder }>("/api/v1/document_folders", { folder: newFolder });

      if (data?.success && data.data) {
        setFolders([...folders, data.data]);
        setNewFolderName("");
        setNewFolderDescription("");
        setNewFolderParentId(null);
        setHasChanges(false); // Just saved
        // Auto-expand parent if adding a sub-tab
        if (effectiveParentId) {
          const idStr = String(effectiveParentId);
          if (!urlState.expanded.includes(idStr)) {
            setUrlState({ expanded: [...urlState.expanded, idStr] });
          }
        }
      }
    } catch (error) {
      console.error("Failed to add folder:", error);
    }
  };

  // Quick add sub-tab under a parent
  const addSubTab = async (parentId: number, parentName: string) => {
    const name = prompt(`Enter name for new sub-tab under ${parentName}:`);
    if (!name?.trim()) return;

    const newFolder = {
      name: name.toUpperCase(),
      order_position: folders.length,
      entity_types: [],
      description: "",
      parent_id: parentId,
      active: true
    };

    try {
      const data = await api.post<{ success: boolean; data: Folder }>("/api/v1/document_folders", { folder: newFolder });

      if (data?.success && data.data) {
        setFolders([...folders, data.data]);
        // Auto-expand parent folder
        const idStr = String(parentId);
        if (!urlState.expanded.includes(idStr)) {
          setUrlState({ expanded: [...urlState.expanded, idStr] });
        }
      }
    } catch (error) {
      console.error("Failed to add sub-tab:", error);
    }
  };

  const deleteFolder = async (id: number) => {
    if (!confirm("Delete this folder? This cannot be undone.")) return;

    try {
      const data = await api.delete<{ success: boolean }>(`/api/v1/document_folders/${id}`);

      if (data?.success) {
        setFolders(folders.filter(f => f.id !== id).map((f, idx) => ({ ...f, order_position: idx })));
        setHasChanges(false);
      }
    } catch (error) {
      console.error("Failed to delete folder:", error);
    }
  };

  const toggleEntityType = (folderId: number, entityType: string) => {
    setFolders(folders.map(f => {
      if (f.id !== folderId) return f;

      const hasType = f.entity_types.includes(entityType);
      return {
        ...f,
        entity_types: hasType
          ? f.entity_types.filter(t => t !== entityType)
          : [...f.entity_types, entityType]
      };
    }));
    setHasChanges(true);
  };

  const updateDescription = (folderId: number, description: string) => {
    setFolders(folders.map(f =>
      f.id === folderId ? { ...f, description } : f
    ));
    setHasChanges(true);
  };

  // Note: sharepoint_path is now computed from template + folder hierarchy (SSoT)
  // No longer editable per-folder

  const updateFolderName = (folderId: number, name: string) => {
    setFolders(folders.map(f =>
      f.id === folderId ? { ...f, name: name.toUpperCase() } : f
    ));
    setHasChanges(true);
  };

  const startEditingFolderName = (folder: Folder) => {
    setEditingFolderNameId(folder.id);
    setEditingFolderNameValue(folder.name);
  };

  const saveEditingFolderName = () => {
    if (editingFolderNameId !== null && editingFolderNameValue.trim()) {
      updateFolderName(editingFolderNameId, editingFolderNameValue.trim());
    }
    setEditingFolderNameId(null);
    setEditingFolderNameValue("");
  };

  const cancelEditingFolderName = () => {
    setEditingFolderNameId(null);
    setEditingFolderNameValue("");
  };

  const saveChanges = async () => {
    try {
      setIsSaving(true);

      // Update each folder individually
      // Note: sharepoint_path is computed from template (SSoT), not saved per-folder
      for (const folder of folders) {
        await api.patch(`/api/v1/document_folders/${folder.id}`, {
          folder: {
            name: folder.name,
            description: folder.description,
            order_position: folder.order_position,
            entity_types: folder.entity_types,
            active: folder.active
          }
        });
      }

      // Reorder all folders
      await api.post("/api/v1/document_folders/reorder", {
        folders: folders.map(f => ({ id: f.id, order_position: f.order_position }))
      });

      setHasChanges(false);
      alert("Configuration saved successfully!");
    } catch (error) {
      console.error("Failed to save changes:", error);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const getFilteredFolders = () => {
    if (!selectedEntityType) return folders;
    return folders.filter(f => f.entity_types.includes(selectedEntityType));
  };

  // Get filtered root folders
  const getFilteredRootFolders = () => {
    const filtered = getFilteredFolders();
    return filtered.filter(f => !f.parent_id);
  };

  // Get filtered children of a folder
  const getFilteredChildren = (parentId: number) => {
    const filtered = getFilteredFolders();
    return filtered.filter(f => f.parent_id === parentId);
  };

  // Render a single folder row
  const renderFolderRow = (folder: Folder, isChild: boolean = false) => {
    const children = getFilteredChildren(folder.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedFolders.has(folder.id);

    return (
      <React.Fragment key={folder.id}>
        <div
          className={cn(
            "flex items-start gap-3 p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors",
            isChild && "ml-8 border-l-4 border-l-blue-200 dark:border-l-blue-800"
          )}
        >
          {/* Expand/collapse for parents, or indent space for children */}
          <div className="flex flex-col gap-1 items-center w-8">
            {!isChild && hasChildren ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => toggleExpanded(folder.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : !isChild ? (
              <div className="h-6 w-6" />
            ) : null}
            <div className="flex items-center justify-center h-6 w-6 text-xs font-mono text-muted-foreground">
              {folder.order_position + 1}
            </div>
          </div>

          {/* Order controls */}
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => moveFolder(folders.indexOf(folder), "up")}
              disabled={folders.indexOf(folder) === 0}
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => moveFolder(folders.indexOf(folder), "down")}
              disabled={folders.indexOf(folder) === folders.length - 1}
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
          </div>

          {/* Folder info */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              {isChild && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Sub-Tab
                </Badge>
              )}
              {editingFolderNameId === folder.id ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={editingFolderNameValue}
                    onChange={(e) => setEditingFolderNameValue(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEditingFolderName();
                      if (e.key === "Escape") cancelEditingFolderName();
                    }}
                    className="h-7 w-32 font-mono font-bold text-sm uppercase"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={saveEditingFolderName}
                  >
                    <Check className="h-3 w-3 text-green-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={cancelEditingFolderName}
                  >
                    <X className="h-3 w-3 text-red-600" />
                  </Button>
                </div>
              ) : (
                <div
                  className="flex items-center gap-1 cursor-pointer group/name"
                  onClick={() => startEditingFolderName(folder)}
                >
                  <Badge variant="secondary" className={cn(
                    "font-mono font-bold",
                    isChild && "bg-blue-100 dark:bg-blue-900/30"
                  )}>
                    {folder.name}
                  </Badge>
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity" />
                </div>
              )}
              <Input
                value={folder.description}
                onChange={(e) => updateDescription(folder.id, e.target.value)}
                placeholder="Description..."
                className="h-7 text-sm"
              />
            </div>

            {/* SharePoint path - computed from template (SSoT) */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground w-24 shrink-0">
                SharePoint:
              </Label>
              <code className="flex-1 h-7 px-2 py-1 text-xs font-mono bg-muted/50 rounded border text-muted-foreground truncate">
                {folder.computed_path || folder.sharepoint_path || "Not configured"}
              </code>
            </div>

            {/* Entity type checkboxes */}
            <div className="flex gap-3 pt-1">
              {ENTITY_TYPES.map(type => {
                const isChecked = folder.entity_types.includes(type.value);
                const Icon = type.icon;
                return (
                  <div
                    key={type.value}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded border cursor-pointer transition-colors",
                      isChecked && type.color === "blue" && "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700",
                      isChecked && type.color === "purple" && "bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700",
                      isChecked && type.color === "gray" && "bg-gray-50 dark:bg-gray-900/20 border-gray-300 dark:border-gray-700",
                      !isChecked && "hover:bg-muted"
                    )}
                    onClick={() => toggleEntityType(folder.id, type.value)}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleEntityType(folder.id, type.value)}
                    />
                    <Icon className="h-3 w-3" />
                    <Label className="cursor-pointer text-xs font-normal">
                      {type.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-1">
            {!isChild && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => addSubTab(folder.id, folder.name)}
                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                title="Add sub-tab"
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteFolder(folder.id)}
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Render children if expanded */}
        {!isChild && isExpanded && children.map(child => renderFolderRow(child, true))}
      </React.Fragment>
    );
  };

  const getEntityTypeColor = (entityType: string) => {
    const type = ENTITY_TYPES.find(t => t.value === entityType);
    return type?.color || "gray";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading folders configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Folders & Tabs Configuration</h2>
          <p className="text-muted-foreground mt-1">
            Manage document folders/tabs and configure which ones appear for different entity types
          </p>
        </div>
        <Button
          onClick={saveChanges}
          disabled={!hasChanges || isSaving}
          size="lg"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Entity Type Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter by Entity Type</CardTitle>
          <CardDescription>
            View which folders appear for each entity type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={selectedEntityType === null ? "default" : "outline"}
              onClick={() => setSelectedEntityType(null)}
              size="sm"
            >
              All Folders ({folders.length})
            </Button>
            {ENTITY_TYPES.map(type => {
              const count = folders.filter(f => f.entity_types.includes(type.value)).length;
              const Icon = type.icon;
              return (
                <Button
                  key={type.value}
                  variant={selectedEntityType === type.value ? "default" : "outline"}
                  onClick={() => setSelectedEntityType(type.value)}
                  size="sm"
                  className={cn(
                    selectedEntityType === type.value && type.color === "blue" && "bg-blue-600 hover:bg-blue-700",
                    selectedEntityType === type.value && type.color === "purple" && "bg-purple-600 hover:bg-purple-700",
                    selectedEntityType === type.value && type.color === "gray" && "bg-gray-600 hover:bg-gray-700"
                  )}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {type.label} ({count})
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Folders List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Document Folders/Tabs
          </CardTitle>
          <CardDescription>
            Drag to reorder. Check entity types to control visibility.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Render folders hierarchically - root folders first, then their children */}
          {getFilteredRootFolders().map(folder => renderFolderRow(folder, false))}

          {/* Add new folder */}
          <div className="flex gap-2 pt-4 border-t flex-wrap">
            <Input
              placeholder="Folder name (e.g., CONTRACTS)"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addFolder()}
              className="font-mono uppercase w-40"
            />
            <Select
              value={newFolderParentId?.toString() || "none"}
              onValueChange={(value) => setNewFolderParentId(value === "none" ? null : parseInt(value))}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Parent (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Parent (Root Tab)</SelectItem>
                {rootFolders.map(folder => (
                  <SelectItem key={folder.id} value={folder.id.toString()}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Description..."
              value={newFolderDescription}
              onChange={(e) => setNewFolderDescription(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addFolder()}
              className="flex-1 min-w-[200px]"
            />
            <Button onClick={() => addFolder()} disabled={!newFolderName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              {newFolderParentId ? "Add Sub-Tab" : "Add Tab"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary by entity type */}
      <div className="grid grid-cols-3 gap-4">
        {ENTITY_TYPES.map(type => {
          const Icon = type.icon;
          const typeFolders = folders.filter(f => f.entity_types.includes(type.value));
          return (
            <Card key={type.value}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {type.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground mb-2">
                  {typeFolders.length} folders
                </div>
                <div className="flex flex-wrap gap-1">
                  {typeFolders.map(f => (
                    <Badge key={f.id} variant="secondary" className="text-xs">
                      {f.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
