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
} from "lucide-react";
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
    const newId = Math.max(0, ...template.items.map((i) => i.id)) + 1;

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

  React.useEffect(() => {
    loadTemplates();
  }, []);

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
      await api.patch(`/api/v1/folder_templates/${updatedTemplate.id}`, {
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
      });
    } catch (error) {
      console.error("Failed to save template:", error);
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
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
                      {selectedTemplate.template_type === "system"
                        ? "System template (duplicate to edit)"
                        : "Click folders to rename, drag to reorder"}
                    </p>
                  </div>
                  <Badge variant={selectedTemplate.template_type === "system" ? "secondary" : "outline"}>
                    {selectedTemplate.items.length} folders
                  </Badge>
                </div>
                <FolderTreeEditor
                  template={selectedTemplate}
                  onUpdate={handleTemplateUpdate}
                  isEditable={selectedTemplate.template_type !== "system"}
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
