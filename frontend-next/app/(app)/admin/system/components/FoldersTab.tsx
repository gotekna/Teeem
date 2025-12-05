"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Copy,
  Trash2,
  Folder,
  FolderTree,
  GripVertical,
  ChevronRight,
  ChevronDown,
  Edit2,
  Check,
  X,
  FolderPlus,
  ExternalLink,
  Settings2,
  Cloud,
  FolderOpen,
  Search,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { SharePointFolderBrowser } from "@/components/ui/sharepoint-folder-browser";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface FolderTemplateItem {
  id: number;
  name: string;
  item_type: "folder" | "file";
  parent_id: number | null;
  order: number;
  description?: string;
  children?: FolderTemplateItem[];
}

interface FolderTemplate {
  id: number;
  name: string;
  description: string;
  template_type: "system" | "user";
  items: FolderTemplateItem[];
  created_at: string;
}

interface SharePointConfig {
  connected: boolean;
  name?: string;
  url?: string;
  document_library?: string;
  root_folder?: string;  // Maps to root_folder_path in backend
  authenticated_as?: string;
  auth_type?: "organization" | "personal";
  drive_id?: string;
}

interface FolderValidation {
  valid: boolean;
  error?: string;
  error_type?: "not_configured" | "not_found" | "api_error";
  folder_id?: string;
  name?: string;
  web_url?: string;
  current_path?: string;
  stored_path?: string;
  stored_name?: string;
  name_changed?: boolean;
  path_changed?: boolean;
  auto_updated?: boolean;
  message?: string;
}

function buildTree(items: FolderTemplateItem[]): FolderTemplateItem[] {
  const itemMap = new Map<number, FolderTemplateItem>();
  const roots: FolderTemplateItem[] = [];

  // First pass: create map
  items.forEach((item) => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  // Second pass: build tree
  items.forEach((item) => {
    const node = itemMap.get(item.id)!;
    if (item.parent_id === null) {
      roots.push(node);
    } else {
      const parent = itemMap.get(item.parent_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      }
    }
  });

  // Sort children by order
  const sortChildren = (items: FolderTemplateItem[]) => {
    items.sort((a, b) => a.order - b.order);
    items.forEach((item) => {
      if (item.children && item.children.length > 0) {
        sortChildren(item.children);
      }
    });
  };

  sortChildren(roots);
  return roots;
}

interface DraggableFolderItemProps {
  item: FolderTemplateItem;
  level: number;
  onDragStart: (item: FolderTemplateItem) => void;
  onDragOver: (item: FolderTemplateItem) => void;
  onDragEnd: () => void;
  onEdit: (item: FolderTemplateItem, newName: string) => void;
  onDelete: (item: FolderTemplateItem) => void;
  onAddChild: (parentItem: FolderTemplateItem) => void;
  isEditable: boolean;
  dragOverId: number | null;
}

function DraggableFolderItem({
  item,
  level,
  onDragStart,
  onDragOver,
  onDragEnd,
  onEdit,
  onDelete,
  onAddChild,
  isEditable,
  dragOverId,
}: DraggableFolderItemProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editName, setEditName] = React.useState(item.name);
  const hasChildren = item.children && item.children.length > 0;

  const handleSave = () => {
    if (editName.trim() && editName !== item.name) {
      onEdit(item, editName.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setEditName(item.name);
      setIsEditing(false);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1.5 px-2 rounded group transition-colors",
          dragOverId === item.id && "bg-blue-100 dark:bg-blue-900/30",
          !isEditing && "hover:bg-muted/50"
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        draggable={isEditable && !isEditing}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStart(item);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          onDragOver(item);
        }}
        onDragEnd={onDragEnd}
      >
        {isEditable && (
          <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
        )}

        {hasChildren ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        <Folder className="h-4 w-4 text-yellow-500 shrink-0" />

        {isEditing ? (
          <div className="flex items-center gap-1 flex-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-7 text-sm py-0"
              autoFocus
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave}>
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setEditName(item.name);
                setIsEditing(false);
              }}
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        ) : (
          <>
            <span
              className={cn(
                "text-sm flex-1",
                isEditable && "cursor-pointer hover:text-primary"
              )}
              onClick={() => isEditable && setIsEditing(true)}
            >
              {item.name}
            </span>

            {isEditable && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onAddChild(item)}
                  title="Add subfolder"
                >
                  <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setIsEditing(true)}
                  title="Rename"
                >
                  <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => onDelete(item)}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {item.children!.map((child) => (
            <DraggableFolderItem
              key={child.id}
              item={child}
              level={level + 1}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              isEditable={isEditable}
              dragOverId={dragOverId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FolderTreeEditorProps {
  template: FolderTemplate;
  onUpdate: (template: FolderTemplate) => void;
  isEditable: boolean;
}

function FolderTreeEditor({ template, onUpdate, isEditable }: FolderTreeEditorProps) {
  const [dragItem, setDragItem] = React.useState<FolderTemplateItem | null>(null);
  const [dragOverId, setDragOverId] = React.useState<number | null>(null);
  const [newFolderName, setNewFolderName] = React.useState("");
  const [showNewFolder, setShowNewFolder] = React.useState(false);
  const [newFolderParentId, setNewFolderParentId] = React.useState<number | null>(null);

  const tree = buildTree(template.items);

  const handleDragStart = (item: FolderTemplateItem) => {
    setDragItem(item);
  };

  const handleDragOver = (item: FolderTemplateItem) => {
    if (dragItem && dragItem.id !== item.id) {
      setDragOverId(item.id);
    }
  };

  const handleDragEnd = () => {
    if (dragItem && dragOverId) {
      // Reorder: move dragItem to position after dragOverId
      const newItems = [...template.items];
      const dragIndex = newItems.findIndex((i) => i.id === dragItem.id);
      const overIndex = newItems.findIndex((i) => i.id === dragOverId);

      if (dragIndex !== -1 && overIndex !== -1) {
        const [removed] = newItems.splice(dragIndex, 1);
        // If same parent, reorder within parent
        const overItem = newItems.find((i) => i.id === dragOverId);
        if (overItem) {
          removed.parent_id = overItem.parent_id;
          removed.order = overItem.order + 0.5;
        }
        newItems.splice(overIndex, 0, removed);

        // Recalculate orders for items with same parent
        const parentGroups = new Map<number | null, FolderTemplateItem[]>();
        newItems.forEach((item) => {
          const group = parentGroups.get(item.parent_id) || [];
          group.push(item);
          parentGroups.set(item.parent_id, group);
        });

        parentGroups.forEach((group) => {
          group.sort((a, b) => a.order - b.order);
          group.forEach((item, idx) => {
            item.order = idx + 1;
          });
        });

        onUpdate({ ...template, items: newItems });
      }
    }
    setDragItem(null);
    setDragOverId(null);
  };

  const handleEdit = (item: FolderTemplateItem, newName: string) => {
    const newItems = template.items.map((i) =>
      i.id === item.id ? { ...i, name: newName } : i
    );
    onUpdate({ ...template, items: newItems });
  };

  const handleDelete = (item: FolderTemplateItem) => {
    if (!confirm(`Delete "${item.name}" and all its subfolders?`)) return;

    // Get all descendant IDs
    const getDescendantIds = (parentId: number): number[] => {
      const children = template.items.filter((i) => i.parent_id === parentId);
      return children.flatMap((c) => [c.id, ...getDescendantIds(c.id)]);
    };

    const idsToDelete = new Set([item.id, ...getDescendantIds(item.id)]);
    const newItems = template.items.filter((i) => !idsToDelete.has(i.id));
    onUpdate({ ...template, items: newItems });
  };

  const handleAddChild = (parentItem: FolderTemplateItem) => {
    setNewFolderParentId(parentItem.id);
    setShowNewFolder(true);
    setNewFolderName("");
  };

  const handleAddRootFolder = () => {
    setNewFolderParentId(null);
    setShowNewFolder(true);
    setNewFolderName("");
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;

    const siblings = template.items.filter((i) => i.parent_id === newFolderParentId);
    const maxOrder = Math.max(0, ...siblings.map((i) => i.order));
    // Generate a temporary ID > 1000000 so handleTemplateUpdate knows this is a new item
    // and sends id: undefined to the backend for creation
    const newId = Date.now();

    const newItem: FolderTemplateItem = {
      id: newId,
      name: newFolderName.trim(),
      item_type: "folder",
      parent_id: newFolderParentId,
      order: maxOrder + 1,
    };

    onUpdate({ ...template, items: [...template.items, newItem] });
    setShowNewFolder(false);
    setNewFolderName("");
  };

  return (
    <div className="space-y-2">
      <div className="border rounded-lg p-3 bg-muted/30 min-h-[200px]">
        {tree.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No folders defined. Click "Add Folder" to create one.
          </div>
        ) : (
          tree.map((item) => (
            <DraggableFolderItem
              key={item.id}
              item={item}
              level={0}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddChild={handleAddChild}
              isEditable={isEditable}
              dragOverId={dragOverId}
            />
          ))
        )}
      </div>

      {isEditable && (
        <div className="flex gap-2">
          {showNewFolder ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                placeholder="New folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") setShowNewFolder(false);
                }}
                autoFocus
              />
              <Button size="sm" onClick={handleCreateFolder}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowNewFolder(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={handleAddRootFolder}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Add Folder
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function FoldersTab() {
  const { toast } = useToast();
  const [templates, setTemplates] = React.useState<FolderTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [duplicating, setDuplicating] = React.useState<number | null>(null);
  const [deleting, setDeleting] = React.useState<number | null>(null);
  const [selectedTemplate, setSelectedTemplate] = React.useState<FolderTemplate | null>(null);
  const [sharePointConfig, setSharePointConfig] = React.useState<SharePointConfig | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false);
  const [newFolderPath, setNewFolderPath] = React.useState("");
  const [savingFolder, setSavingFolder] = React.useState(false);
  const [selectedBrowserFolder, setSelectedBrowserFolder] = React.useState<{
    id: string;
    name: string;
    path: string;
  } | null>(null);
  const [folderSelectionMode, setFolderSelectionMode] = React.useState<"browse" | "type">("browse");

  // Folder validation state
  const [folderValidation, setFolderValidation] = React.useState<FolderValidation | null>(null);
  const [validatingFolder, setValidatingFolder] = React.useState(false);

  React.useEffect(() => {
    loadTemplates();
    loadSharePointConfig();
  }, []);

  const loadSharePointConfig = async () => {
    try {
      const response = await api.get<{ sharepoint: SharePointConfig }>("/api/v1/microsoft/connections");
      setSharePointConfig(response?.sharepoint || null);
      // Set initial folder path for edit dialog
      if (response?.sharepoint?.root_folder) {
        setNewFolderPath(response.sharepoint.root_folder);
      }
    } catch (error) {
      console.error("Failed to load SharePoint config:", error);
      // Not connected - that's OK
      setSharePointConfig({ connected: false });
    }
  };

  // Validate the root folder in SharePoint
  const validateFolder = async () => {
    setValidatingFolder(true);
    try {
      const result = await api.get<FolderValidation>("/api/v1/organization_onedrive/validate_folder");
      setFolderValidation(result);

      // If auto-updated, show a toast and reload config
      if (result.auto_updated) {
        toast({
          title: "Folder Location Updated",
          description: result.message || "The folder path was updated to match the current SharePoint location.",
        });
        await loadSharePointConfig();
      }
    } catch (error) {
      console.error("Failed to validate folder:", error);
      setFolderValidation({
        valid: false,
        error: error instanceof Error ? error.message : "Failed to validate folder",
        error_type: "api_error"
      });
    } finally {
      setValidatingFolder(false);
    }
  };

  // Validate folder when SharePoint config is loaded and connected
  React.useEffect(() => {
    if (sharePointConfig?.connected && sharePointConfig?.root_folder) {
      validateFolder();
    }
  }, [sharePointConfig?.connected, sharePointConfig?.root_folder]);

  const handleChangeFolderPath = async () => {
    // Check if we have a valid selection based on mode
    if (folderSelectionMode === "browse") {
      if (!selectedBrowserFolder) {
        toast({ title: "Error", description: "Please select a folder from the browser", variant: "destructive" });
        return;
      }
    } else {
      if (!newFolderPath.trim()) {
        toast({ title: "Error", description: "Please enter a folder path", variant: "destructive" });
        return;
      }
    }

    setSavingFolder(true);
    try {
      // Use folder_id if from browser, folder_name if typed
      const payload = folderSelectionMode === "browse" && selectedBrowserFolder
        ? { folder_id: selectedBrowserFolder.id }
        : { folder_name: newFolderPath.trim() };

      await api.patch("/api/v1/organization_onedrive/change_root_folder", payload);
      toast({ title: "Success", description: "Root folder updated successfully" });
      setFolderDialogOpen(false);
      setSelectedBrowserFolder(null);
      // Reload config to show updated path
      await loadSharePointConfig();
    } catch (error: unknown) {
      console.error("Failed to change folder path:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update folder path";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setSavingFolder(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await api.get<{ folder_templates: FolderTemplate[] } | FolderTemplate[]>(
        "/api/v1/folder_templates"
      );
      const data = Array.isArray(response) ? response : response?.folder_templates || [];
      setTemplates(data);
      // Select first template by default
      if (data.length > 0 && !selectedTemplate) {
        setSelectedTemplate(data[0]);
      }
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast({ title: "Error", description: "Failed to load folder templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateUpdate = async (updatedTemplate: FolderTemplate) => {
    setSelectedTemplate(updatedTemplate);
    setTemplates((prev) =>
      prev.map((t) => (t.id === updatedTemplate.id ? updatedTemplate : t))
    );

    // Auto-save to backend
    setSaving(true);
    try {
      const response = await api.patch<{ folder_template: FolderTemplate }>(
        `/api/v1/folder_templates/${updatedTemplate.id}`,
        {
          folder_template: {
            name: updatedTemplate.name,
            folder_template_items_attributes: updatedTemplate.items.map((item) => ({
              id: item.id > 1000000 ? undefined : item.id, // New items have large temp IDs
              name: item.name,
              level: getItemLevel(item, updatedTemplate.items),
              order: item.order,
              parent_id: item.parent_id,
            })),
          },
        }
      );
      // Reload templates to get fresh IDs for any newly created items
      await loadTemplates();
    } catch (error: unknown) {
      console.error("Failed to save template:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save changes";
      // If we get a 404 or 409 (out of sync), reload and let user try again
      if (errorMessage.includes("not found") || errorMessage.includes("404") ||
          errorMessage.includes("out of sync") || errorMessage.includes("409")) {
        toast({
          title: "Sync Error",
          description: "Template data was out of sync. Reloading... please try your change again.",
          variant: "destructive",
        });
        await loadTemplates();
      } else {
        toast({ title: "Error", description: errorMessage, variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const getItemLevel = (item: FolderTemplateItem, items: FolderTemplateItem[]): number => {
    if (!item.parent_id) return 1;
    const parent = items.find((i) => i.id === item.parent_id);
    if (!parent) return 1;
    return getItemLevel(parent, items) + 1;
  };

  const handleDuplicate = async (id: number) => {
    setDuplicating(id);
    try {
      await api.post(`/api/v1/folder_templates/${id}/duplicate`);
      toast({ title: "Success", description: "Template duplicated successfully" });
      loadTemplates();
    } catch (error) {
      console.error("Failed to duplicate template:", error);
      toast({ title: "Error", description: "Failed to duplicate template", variant: "destructive" });
    } finally {
      setDuplicating(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    setDeleting(id);
    try {
      await api.delete(`/api/v1/folder_templates/${id}`);
      toast({ title: "Success", description: "Template deleted successfully" });
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
      }
      loadTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const systemTemplates = templates.filter((t) => t.template_type === "system");
  const userTemplates = templates.filter((t) => t.template_type === "user");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Folder Templates</h2>
          <p className="text-sm text-muted-foreground">
            Define folder structures for new jobs. Drag to reorder, click to edit.
          </p>
        </div>
        {saving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
      </div>

      {/* SharePoint Destination Path */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Cloud className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-medium text-sm">SharePoint Destination</h3>
                <p className="text-xs text-muted-foreground">
                  Job folders will be created at this location:
                </p>
                {sharePointConfig?.connected ? (
                  <div className="space-y-2 mt-2">
                    <div className="bg-white dark:bg-slate-900 rounded-md border p-3 font-mono text-xs">
                      <div className="text-muted-foreground mb-1">SharePoint Site</div>
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400">
                          {sharePointConfig.url ? sharePointConfig.url.replace('https://', '').split('/Shared')[0] : "gotekna.sharepoint.com/sites/TEEEM"}
                        </span>
                        <a
                          href={sharePointConfig.url || "https://gotekna.sharepoint.com/sites/TEEEM/Shared%20Documents"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="text-muted-foreground mt-2 mb-1">Folder Path</div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Folder className="h-3 w-3 text-yellow-500" />
                        <span>{sharePointConfig.document_library || "Shared Documents"}</span>
                        <span className="text-muted-foreground">/</span>
                        <span>{sharePointConfig.root_folder || "TEEEM Jobs"}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{"[Job Code] - [Project Name]"}</span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-muted-foreground italic">{"[template folders...]"}</span>
                      </div>
                      {sharePointConfig.authenticated_as && (
                        <div className="text-muted-foreground mt-2 pt-2 border-t">
                          Connected as: <span className="text-foreground">{sharePointConfig.authenticated_as}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Example: <code className="bg-muted px-1 rounded">047 - Malbon Street/02 PreCon/Estimation/</code>
                    </p>

                    {/* Folder Validation Status */}
                    {validatingFolder ? (
                      <div className="flex items-center gap-2 mt-3 p-2 bg-muted/50 rounded-md text-xs">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-muted-foreground">Validating folder location...</span>
                      </div>
                    ) : folderValidation && !folderValidation.valid ? (
                      <div className={cn(
                        "flex items-start gap-2 mt-3 p-3 rounded-md text-xs",
                        folderValidation.error_type === "not_found"
                          ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                          : "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                      )}>
                        {folderValidation.error_type === "not_found" ? (
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className={folderValidation.error_type === "not_found" ? "text-red-700 dark:text-red-300 font-medium" : "text-amber-700 dark:text-amber-300 font-medium"}>
                            {folderValidation.error_type === "not_found"
                              ? "Folder Not Found"
                              : folderValidation.error_type === "not_configured"
                              ? "Folder Not Configured"
                              : "Validation Error"}
                          </p>
                          <p className={folderValidation.error_type === "not_found" ? "text-red-600 dark:text-red-400 mt-1" : "text-amber-600 dark:text-amber-400 mt-1"}>
                            {folderValidation.error}
                          </p>
                          {folderValidation.stored_path && (
                            <p className="text-muted-foreground mt-1">
                              Expected: <code className="bg-muted px-1 rounded">{folderValidation.stored_path}</code>
                            </p>
                          )}
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7"
                              onClick={() => {
                                setNewFolderPath(sharePointConfig?.root_folder || "");
                                setFolderDialogOpen(true);
                              }}
                            >
                              <FolderOpen className="h-3 w-3 mr-1" />
                              Select New Folder
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7"
                              onClick={validateFolder}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Retry
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : folderValidation?.valid ? (
                      <div className="flex items-center gap-2 mt-3 p-2 bg-green-50 dark:bg-green-950/30 rounded-md text-xs border border-green-200 dark:border-green-800">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-green-700 dark:text-green-300">Folder verified in SharePoint</span>
                        {folderValidation.auto_updated && (
                          <Badge variant="outline" className="ml-auto text-xs">Updated</Badge>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-2 text-amber-600 dark:text-amber-400">
                    <span className="text-xs">SharePoint not connected</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => window.location.href = "/settings/integrations/microsoft"}
                    >
                      Connect
                    </Button>
                  </div>
                )}
              </div>
            </div>
            {sharePointConfig?.connected && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => {
                  setNewFolderPath(sharePointConfig.root_folder || "TEEEM Jobs");
                  setFolderDialogOpen(true);
                }}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Change Folder
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={(open) => {
        setFolderDialogOpen(open);
        if (!open) {
          setSelectedBrowserFolder(null);
          setFolderSelectionMode("browse");
        }
      }}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Change Jobs Root Folder</DialogTitle>
            <DialogDescription>
              Select the folder in SharePoint where job folders will be created.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={folderSelectionMode} onValueChange={(v) => setFolderSelectionMode(v as "browse" | "type")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="browse">
                <Search className="h-4 w-4 mr-2" />
                Browse Folders
              </TabsTrigger>
              <TabsTrigger value="type">
                <Edit2 className="h-4 w-4 mr-2" />
                Type Path
              </TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="mt-4">
              <SharePointFolderBrowser
                onSelect={(folder, path) => {
                  if (folder) {
                    setSelectedBrowserFolder({ id: folder.id, name: folder.name, path });
                  } else {
                    setSelectedBrowserFolder(null);
                  }
                }}
                selectedFolderId={selectedBrowserFolder?.id}
              />
              {selectedBrowserFolder && (
                <div className="bg-primary/5 border border-primary/20 rounded-md p-3 mt-3 text-xs">
                  <div className="font-medium mb-1 text-primary">Selected Folder:</div>
                  <div className="font-mono text-foreground">
                    {selectedBrowserFolder.path}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="type" className="mt-4">
              <div className="grid gap-2">
                <Label htmlFor="folder-path">Folder Path</Label>
                <Input
                  id="folder-path"
                  value={newFolderPath}
                  onChange={(e) => setNewFolderPath(e.target.value)}
                  placeholder="TEEEM Jobs"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  This folder will be created if it doesn&apos;t exist. Use forward slashes for nested paths (e.g., &quot;TEEEM/Jobs&quot;).
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Preview */}
          <div className="bg-muted/50 rounded-md p-3 text-xs">
            <div className="font-medium mb-1">Preview:</div>
            <div className="font-mono text-muted-foreground">
              Shared Documents /{" "}
              <span className="text-foreground">
                {folderSelectionMode === "browse"
                  ? (selectedBrowserFolder?.path || "Select a folder...")
                  : (newFolderPath || "TEEEM Jobs")}
              </span>{" "}
              / [Job Code] - [Project Name] / ...
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleChangeFolderPath}
              disabled={savingFolder || (folderSelectionMode === "browse" && !selectedBrowserFolder)}
            >
              {savingFolder ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template List */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">System Templates</h3>
          {systemTemplates.length === 0 ? (
            <Card>
              <CardContent className="py-4 text-center text-muted-foreground text-sm">
                No system templates found.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {systemTemplates.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selectedTemplate?.id === template.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-muted-foreground/30"
                  )}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderTree className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{template.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        System
                      </Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDuplicate(template.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate to Edit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <h3 className="text-sm font-medium text-muted-foreground pt-4">User Templates</h3>
          {userTemplates.length === 0 ? (
            <Card>
              <CardContent className="py-4 text-center text-muted-foreground text-sm">
                No custom templates. Duplicate a system template to create one.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {userTemplates.map((template) => (
                <Card
                  key={template.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    selectedTemplate?.id === template.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-muted-foreground/30"
                  )}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderTree className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{template.name}</span>
                      <Badge variant="outline" className="text-xs">
                        Custom
                      </Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDuplicate(template.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(template.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Folder Editor */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">{selectedTemplate.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Click folders to rename, drag to reorder
                    </p>
                  </div>
                  <Badge variant={selectedTemplate.template_type === "system" ? "secondary" : "outline"}>
                    {selectedTemplate.items.length} folders
                  </Badge>
                </div>
                <FolderTreeEditor
                  template={selectedTemplate}
                  onUpdate={handleTemplateUpdate}
                  isEditable={true}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FolderTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a template to view or edit its folder structure</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
